import { spawn, type ChildProcess } from "node:child_process";
import { recordFailure } from "./studio-diagnostics.ts";
import { findStudioRoot } from "./studio-root.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentManifest } from "./studio-agent-loader.ts";
import { chooseModelForAgent } from "./studio-model-config.ts";
import { validateSpecialistReturn } from "./return-contract.ts";
import { parseAllowedSurfaces } from "./studio-surfaces-guard.ts";

/**
 * Builds the child process environment for a dispatched specialist, forwarding
 * the bounded edit surfaces declared in the task so the child-side guard can
 * enforce the same boundaries as the parent. Tasks that declare no surfaces
 * keep the historical unbounded behaviour.
 */
export function buildSubagentEnv(
	task: string,
	base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...base };
	const surfaces = parseAllowedSurfaces(task);
	if (surfaces.length > 0) {
		env.PI_STUDIO_ALLOWED_SURFACES = JSON.stringify(surfaces);
	} else {
		// Never inherit a stale scope from a parent that was itself a child process.
		delete env.PI_STUDIO_ALLOWED_SURFACES;
	}
	return env;
}

export interface TaskRecord {
	id: string;
	agent: string;
	title: string;
	task: string;
	mode: "task" | "background";
	cwd: string;
	/** Studio root the dispatch actually operated on: the receipt must prove it. */
	resolvedRoot: string;
	/** Compactions that happened inside the child, with their reason and outcome. */
	compactions?: Array<{ reason: string; ok: boolean }>;
	/** Delegation tools a child declared but never received: depth is one. */
	delegationStripped?: string[];
	/** Deny patterns actually forwarded to the child as --exclude-tools. */
	deniedTools?: string[];
	/** Exact tool names both allowed and denied: deny wins, the contradiction is on record. */
	denyConflicts?: string[];
	/** Memory tools a child declared but never received: no provider installed. */
	memoryUnavailable?: string[];
	/** Real usage reported by the child, accumulated per completed message. */
	usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
	/** Timestamp of the last sign of life from the child, for the idle watchdog. */
	lastActivityAt?: number;
	/** Last stderr lines, kept because children no longer persist a session. */
	stderrTail?: string[];
	status: "queued" | "running" | "completed" | "failed" | "cancelled" | "interaction_required";
	/** Escalation payload when the specialist needs a decision it cannot take. */
	interaction?: { question: string; options: string[]; blocking: boolean } | null;
	model?: string;
	latestActivity?: string;
	result: string | null;
	error: string | null;
	startedAt: number | null;
	endedAt: number | null;
	timeoutMs?: number;
	logs: string[];
	/** Log lines the ring buffer discarded, so a viewer never implies it sees all of them. */
	logsDropped?: number;
}

/**
 * The runner is long-lived: every specialist keeps pushing lines into its record,
 * and a verbose child (27 push sites) grows the array for the whole session. Only
 * the tail is ever rendered, so the buffer keeps the tail and counts the rest.
 */
export const MAX_TASK_LOG_LINES = 400;

export function appendTaskLog(record: TaskRecord, line: string): void {
	record.logs.push(line);
	const overflow = record.logs.length - MAX_TASK_LOG_LINES;
	if (overflow > 0) {
		record.logs.splice(0, overflow);
		record.logsDropped = (record.logsDropped ?? 0) + overflow;
	}
}

/** Finished tasks are kept only while a user could still act on them. */
export const DEFAULT_TASK_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_MAX_TASKS = 100;

export type TaskListener = (task: TaskRecord) => void;

export interface RunnerOptions {
	piCommand?: string;
	piArgs?: string[];
	timeoutMs?: number;
	/** How many finished task records to keep before the oldest are dropped. */
	maxTasks?: number;
	/** How long a finished task record stays readable. */
	taskTtlMs?: number;
	/**
	 * Answers whether the host exposes a tool. Absent means "cannot know", and the
	 * runner then grants the tool: Pi ignores a name it does not recognize, so
	 * granting is the harmless direction, while stripping a provider that is
	 * actually installed would silently remove the capability.
	 */
	hasTool?: (name: string) => boolean;
	/**
	 * Returns the host's whole tool inventory (documented `getAllTools()` probe).
	 * Used to derive the complement a `deny: ["*"]` baseline must exclude, so an
	 * empty or missing allow list cannot let a child inherit Pi's defaults.
	 */
	toolInventory?: () => string[];
}

export function formatRel(startedAt?: number | null): string {
	if (!startedAt) return "+0.0s";
	const sec = Math.max(0, (Date.now() - startedAt) / 1000);
	return `+${sec.toFixed(1)}s`.padStart(6, " ");
}

/**
 * Token accounting for a finished task. Reported usage wins; the character
 * heuristic survives only as a flagged estimate for a record that never received
 * a message_end, so the budget widget stops inventing numbers for delegated work.
 */
export function usageToTokens(record: TaskRecord): { input: number; output: number; estimated: boolean } {
	if (record.usage) {
		return { input: record.usage.input, output: record.usage.output, estimated: false };
	}
	return {
		input: Math.ceil((record.task?.length || 0) / 4),
		output: Math.ceil(((record.result?.length || 0) + (record.logs?.join("\n").length || 0)) / 4),
		estimated: true,
	};
}

/**
 * Signals the child's whole process group. A specialist that shells out (a build
 * tool, a test runner) leaves grandchildren that a plain SIGTERM to the direct
 * child never reaches, so the group is the only reliable target.
 */
export function signalChildTree(child: ChildProcess, signal: NodeJS.Signals): boolean {
	if (!child?.pid) return false;

	if (process.platform !== "win32") {
		try {
			process.kill(-child.pid, signal);
			return true;
		} catch (error) {
			recordFailure("runner.signal.group", error);
		}
	}

	try {
		return child.kill(signal);
	} catch (error) {
		recordFailure("runner.signal", error);
		return false;
	}
}

export const CHILD_TERM_GRACE_MS = 2500;
export const CHILD_KILL_GRACE_MS = 2500;

/**
 * Cooperative first, then escalating signals to the whole group. Closing stdin is
 * not enough: a child that ignores its own abort would live forever.
 */
export function terminateChild(child: ChildProcess): void {
	try {
		child.stdin?.write(`${JSON.stringify({ type: "abort" })}\n`);
	} catch (error) {
		recordFailure("runner.abort", error);
	}

	const alive = () => child.exitCode === null && child.signalCode === null;
	setTimeout(() => {
		if (alive()) signalChildTree(child, "SIGTERM");
	}, CHILD_TERM_GRACE_MS);
	setTimeout(() => {
		if (alive()) signalChildTree(child, "SIGKILL");
	}, CHILD_TERM_GRACE_MS + CHILD_KILL_GRACE_MS);
}

export class StudioAgentsRunner {
	private tasks = new Map<string, TaskRecord>();
	private liveProcesses = new Map<string, ChildProcess>();
	private listeners = new Set<TaskListener>();
	private counter = 0;
	private timeoutMs = 300000; // 5 min default stall/run limit for complex chain tasks
	private maxTasks = DEFAULT_MAX_TASKS;
	private taskTtlMs = DEFAULT_TASK_TTL_MS;
	private hasTool: ((name: string) => boolean) | null = null;
	private toolInventory: (() => string[]) | null = null;

	constructor(options: RunnerOptions = {}) {
		if (options.timeoutMs) {
			this.timeoutMs = options.timeoutMs;
		}
		if (options.maxTasks) {
			this.maxTasks = options.maxTasks;
		}
		if (options.taskTtlMs) {
			this.taskTtlMs = options.taskTtlMs;
		}
		if (options.hasTool) {
			this.hasTool = options.hasTool;
		}
		if (options.toolInventory) {
			this.toolInventory = options.toolInventory;
		}
	}

	/**
	 * The host knows which tools exist; the singleton is built before the extension
	 * receives the API, so the probe is installed at activation instead of at
	 * construction.
	 */
	setToolProbe(probe: ((name: string) => boolean) | null): void {
		this.hasTool = probe;
	}

	/** Installs (or clears) the host inventory probe used by the deny baseline. */
	setToolInventory(inventory: (() => string[]) | null): void {
		this.toolInventory = inventory;
	}

	subscribe(listener: TaskListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners(task: TaskRecord): void {
		for (const listener of this.listeners) {
			try {
				listener(task);
			} catch {}
		}
	}

	getTask(id: string): TaskRecord | undefined {
		return this.tasks.get(id);
	}

	listTasks(): TaskRecord[] {
		this.pruneTasks();
		return Array.from(this.tasks.values()).reverse();
	}

	/**
	 * Drops finished task records past their TTL, then the oldest ones above the
	 * cap. A queued or running task is never pruned: its record is the only handle
	 * on a live child.
	 */
	pruneTasks(now: number = Date.now()): number {
		const finished = (task: TaskRecord): boolean =>
			task.status === "completed" || task.status === "failed" || task.status === "cancelled";
		const endedAt = (task: TaskRecord): number => task.endedAt ?? task.startedAt ?? 0;
		let pruned = 0;

		for (const [id, task] of this.tasks) {
			if (!finished(task)) continue;
			const ended = endedAt(task);
			if (ended > 0 && now - ended > this.taskTtlMs) {
				this.tasks.delete(id);
				pruned++;
			}
		}

		if (this.tasks.size > this.maxTasks) {
			const oldestFirst = Array.from(this.tasks.values())
				.filter(finished)
				.sort((a, b) => endedAt(a) - endedAt(b));
			for (const task of oldestFirst) {
				if (this.tasks.size <= this.maxTasks) break;
				this.tasks.delete(task.id);
				pruned++;
			}
		}

		return pruned;
	}

	/**
	 * Delivers a steering message to a running child. Pi queues it and applies it
	 * after the current tool calls, before the next model call — the alternative is
	 * killing the specialist and paying the whole read-and-setup cost again.
	 */
	steer(id: string, message: string): boolean {
		const child = this.liveProcesses.get(id);
		const task = this.tasks.get(id);
		const text = message?.trim();
		if (!child || !task || !text) return false;

		try {
			child.stdin?.write(`${JSON.stringify({ type: "steer", message: text })}\n`);
		} catch (error) {
			recordFailure("runner.steer", error);
			return false;
		}

		task.lastActivityAt = Date.now();
		appendTaskLog(task, `        steer  ${text.slice(0, 80)}`);
		task.latestActivity = `Steering: ${text.slice(0, 35)}`;
		this.notifyListeners(task);
		return true;
	}

	cancel(id: string, reason = "cancelled by user"): boolean {
		const task = this.tasks.get(id);
		if (!task) return false;

		const child = this.liveProcesses.get(id);
		if (child) {
			terminateChild(child);
			this.liveProcesses.delete(id);
		}

		if (task.status === "running" || task.status === "queued") {
			task.status = "cancelled";
			task.error = reason;
			task.endedAt = Date.now();
			this.notifyListeners(task);
			return true;
		}
		return false;
	}

	cancelTask(id: string, reason = "cancelled by user"): boolean {
		return this.cancel(id, reason);
	}

	cancelAll(reason = "cancelled by user"): number {
		let count = 0;
		for (const [id, child] of this.liveProcesses.entries()) {
			terminateChild(child);
			this.liveProcesses.delete(id);
			const task = this.tasks.get(id);
			if (task && (task.status === "running" || task.status === "queued")) {
				task.status = "cancelled";
				task.error = reason;
				task.endedAt = Date.now();
				this.notifyListeners(task);
				count++;
			}
		}
		return count;
	}

	async run(
		manifest: AgentManifest,
		taskPrompt: string,
		cwd: string,
		mode: "task" | "background" = "task",
		signal?: AbortSignal,
		timeoutMs?: number,
		activeModel?: string,
	): Promise<TaskRecord> {
		this.counter++;
		const now = Date.now();
		const taskId = `task-${now.toString(36)}-${this.counter.toString(36)}`;

		// Precedence: role contract (manifest.model) > per-agent/per-tier config in
		// .pi/game-studio/models.json > the session's active model > literal inherit.
		const chosenModel = chooseModelForAgent({
			manifestModel: manifest.model,
			projectRoot: cwd,
			agentName: manifest.name,
			activeModel,
		});

		const stderrTail: string[] = [];

		const record: TaskRecord = {
			id: taskId,
			agent: manifest.name,
			title: manifest.title,
			task: taskPrompt,
			mode,
			cwd,
			resolvedRoot: findStudioRoot(cwd) ?? resolve(cwd),
			stderrTail,
			status: "queued",
			model: chosenModel,
			latestActivity: "En cola para ejecución...",
			result: null,
			error: null,
			startedAt: null,
			endedAt: null,
			timeoutMs: timeoutMs || (mode === "background" ? 900000 : this.timeoutMs),
			logs: [],
		};

		this.tasks.set(taskId, record);
		this.pruneTasks(now);
		this.notifyListeners(record);

		const executionPromise = this.executeSubprocess(record, manifest, signal);

		if (mode === "background") {
			// Retornar de inmediato sin esperar
			return record;
		}

		return await executionPromise;
	}

	private executeSubprocess(
		record: TaskRecord,
		manifest: AgentManifest,
		signal?: AbortSignal,
	): Promise<TaskRecord> {
		return new Promise<TaskRecord>((resolve) => {
			if (signal?.aborted) {
				record.status = "cancelled";
				record.error = "Operación abortada por el usuario (Escape)";
				record.endedAt = Date.now();
				record.latestActivity = "Cancelado por usuario";
				this.notifyListeners(record);
				return resolve(record);
			}

			record.status = "running";
			record.startedAt = Date.now();
			record.latestActivity = "Iniciando especialista en modo RPC...";
			this.notifyListeners(record);

			// Two budgets, not one deadline: silence means stuck, elapsed time does not.
			// A child that keeps reporting activity may run as long as it needs; a tool in
			// flight (a build, a test suite) gets a larger allowance than plain idle.
			const idleBudget = record.timeoutMs
				|| (record.mode === "background" ? 900000 : this.timeoutMs);
			const toolIdleBudget =
				Number(process.env.PI_STUDIO_TOOL_IDLE_MS) || Math.max(idleBudget * 3, 30000);
			record.lastActivityAt = Date.now();
			let activeTool: string | null = null;

			// Preparar instrucción ejecutiva para el especialista bajo protocolo ODD estricto
			// A dispatched child has no UI, so granting ask_user_question only produces a
			// cancelled request and a stalled run. Escalation goes through the return
			// contract instead, where the parent can relay it as a blocking choice.
			//
			// Depth is one. A child that could dispatch again would launch work it has no
			// tool to inspect, collect or cancel, while its own parent sees a completed
			// agent that produced nothing. The whole subagent_* family is stripped — not
			// just subagent_run — so a template cannot reopen the hole by declaring a
			// sibling tool, and the strip is recorded instead of happening in silence.
			const declaredTools = manifest.tools ?? [];
			const delegationTools = declaredTools.filter((t) => t.startsWith("subagent_"));

			// A specialist is an isolated process: a discovery that outlives the task has
			// no other channel. The provider that supplies mem_save is optional, though,
			// and a child told to save with a tool it does not have either stalls or
			// spends turns on a dead end. Probe the host, grant when it can answer yes,
			// strip and say so when it answers no, and grant when it cannot answer at all.
			const memoryTools = declaredTools.filter((t) => t.startsWith("mem_"));
			const unavailableMemory = memoryTools.filter((t) => {
				if (!this.hasTool) return false;
				try {
					return !this.hasTool(t);
				} catch {
					return false;
				}
			});
			const memoryGranted = memoryTools.some((t) => !unavailableMemory.includes(t));

			const childTools = declaredTools.filter(
				(t) =>
					t !== "ask_user_question" &&
					!t.startsWith("subagent_") &&
					!unavailableMemory.includes(t),
			);
			if (delegationTools.length > 0) {
				record.delegationStripped = delegationTools;
				record.latestActivity = `Profundidad 1: ${delegationTools.join(", ")} no otorgado a ${manifest.name}`;
			}
			if (unavailableMemory.length > 0) {
				record.memoryUnavailable = unavailableMemory;
				record.latestActivity = `Sin proveedor de memoria: ${unavailableMemory.join(", ")} no otorgado a ${manifest.name}`;
			}

			// Least-privilege deny baseline. Allow lists say what a role gets; the deny
			// list says what it may never get, and deny wins. Without it, a tool added
			// to the runtime would silently widen every agent, and an empty allow list
			// would make the child inherit Pi's defaults (read, bash, edit, write).
			const declaredDeny = Array.isArray(manifest.deny) ? manifest.deny : [];
			const denyConflicts = declaredDeny.filter(
				(d) => d !== "*" && declaredTools.includes(d),
			);
			if (denyConflicts.length > 0) {
				record.denyConflicts = denyConflicts;
				record.latestActivity = `Contradicción de privilegios: ${denyConflicts.join(", ")} declarado(s) en tools y en deny; deny gana`;
			}

			let excludedTools: string[];
			if (declaredDeny.includes("*")) {
				// Default deny: exclude everything the host exposes that the allow list
				// does not grant, plus a fixed baseline for tools the inventory probe
				// cannot see. This is what closes the empty-allow-list hole: bash stays
				// granted because the allow list names it, write and edit never do.
				let inventory: string[] = [];
				if (this.toolInventory) {
					try {
						inventory = this.toolInventory() ?? [];
					} catch {
						inventory = [];
					}
				}
				const baseline = ["write", "edit", "powershell", "codemode"];
				const pool = new Set([...inventory, ...baseline]);
				excludedTools = Array.from(pool).filter((t) => !childTools.includes(t));
			} else {
				excludedTools = declaredDeny.filter((d) => d !== "*");
			}
			// Dedupe, keep declaration order.
			excludedTools = Array.from(new Set(excludedTools));

			const executivePrompt = [
				`[PI GAME STUDIO SPECIALIST DISPATCH — ODD PROTOCOL ACTIVE]`,
				`Role: ${manifest.name} (${manifest.title} - Tier: ${manifest.tier})`,
				`Working Directory: ${record.cwd}`,
				`Assigned Task:`,
				record.task,
				``,
				`[ODD GAMEDEV EXECUTION RULES — MANDATORY]`,
				`1. AUTONOMOUS DIRECT EXECUTION: This task has already been authorized by the Producer/User. Do NOT ask conversational questions, do NOT output menus, and do NOT wait for confirmation before writing files. Execute the task directly on disk using your allowed tools (${childTools.join(", ")}). If a decision is genuinely above your role, stop with 'status: interaction_required' and a 'question' instead of guessing.`,
				`2. ATOMIC SCOPE (~400 LINES): Deliver coherent changes of ~400 lines (code + data/tests). Do NOT dump monolithic 800+ line blocks in one pass. If the design requires more, implement the foundational core cleanly and set status: partial in the completion receipt.`,
				`3. SCOPED ENGINE VALIDATION (NO MONOLITHIC BUILDS): If you validate via bash:`,
				`   - If working on an isolated crate or component (e.g. crates/radio-core), run ONLY focused tests: e.g. 'cargo test -p <crate>' or 'cargo check -p <crate>'.`,
				`   - NEVER trigger full workspace builds or tests that recompile heavy game engines (like Bevy, Unreal, Unity) during an isolated logic task. Keep bash commands bounded and fast.`,
				`4. SINGLE SOURCE OF TRUTH (LIVE SPECS): Read existing design documents in 'design/gdd/<feature>.md' and current code in 'src/'. Never assume non-existent APIs.`,
				`5. FOSS CLI TOOLCHAIN ACCELERATION: Use available CLI tools via bash when relevant: 'magick' (image manipulation), 'oxipng' (lossless PNG compression), 'pngquant' (8-bit alpha quantization), 'free-tex-packer-cli' (atlas/spritesheets with JSON metadata), 'gltf-transform' (3D mesh inspection & polygon audit), 'gltfpack' (meshopt 3D GPU optimization), 'assimp' (fast 3D to GLB conversion), 'ffmpeg' (audio conversion/normalization to .ogg), 'wasm-opt' (WASM optimization), 'butler' (itch.io push), 'gh' (GitHub releases/PRs), and 'watchexec' (live-reload testing).`,
				`6. 2D VS 3D PIPELINE GUIDANCE: Check 'project.yaml' for dimension ('2d' or '3d'). When project is 2D: prioritize 'free-tex-packer-cli', 'oxipng', 'TileMaps', and 2D sprite physics. When project is 3D: prioritize 'gltf-transform inspect' to audit polygon budgets, 'gltfpack' for GPU LODs/compression, and adopt the Graybox CSG -> Modular Kits methodology.`,
				`7. DURABLE DISCOVERIES: ${memoryGranted
					? `Before you return, persist what the next specialist would otherwise pay for again — an engine API that changed, a subsystem that must not be touched, a constraint the live spec omits — with 'mem_save'. Do not save task status, prose summaries or your own receipt.`
					: unavailableMemory.length > 0
						? `No memory provider is installed in this project, so persist nothing. Report durable discoveries in 'risks' (or 'summary' when they change the plan) so the Producer can record them.`
						: `This role holds no memory tool by design, so persist nothing. Report durable discoveries in 'risks' (or 'summary' when they change the plan) so the Producer can record them.`}`,
				`8. STRICT RETURN CONTRACT: At the very end of your response, output ONLY a clean YAML block formatted exactly like this:`,
				`\`\`\`yaml`,
				`status: completed # or partial / failed / blocked`,
				`summary: "<executive 1-2 sentence summary of what was done>"`,
				`files_changed:`,
				`  - "<path_to_file>"`,
				`validation: "<tests run, clean compile, or fps checks>"`,
				`gameplay_impact: "<game feel, latency, memory allocations, or trade-offs>"`,
				`\`\`\``,
			].join("\n");

			// Resolver binario de Pi (PI_PATH permite entornos aislados y tests herméticos)
			const piExecutable = process.env.PI_PATH || (process.execPath.includes("pi") ? process.execPath : "pi");
			
			// Preparar flags de Pi en modo RPC bidireccional (idéntico a Gentle Shell)
			const args: string[] = [
				"--mode", "rpc",
				"--append-system-prompt",
				manifest.systemPrompt,
			];

			// Añadir modelo si se resolvió uno explícito
			const targetModel = (manifest.model && manifest.model !== "inherit")
				? manifest.model
				: (record.model && record.model !== "inherit" ? record.model : undefined);

			if (targetModel) {
				args.push("--model", targetModel);
			}

			// The declared reasoning budget is part of the role contract: forward it
			// instead of letting every agent run at the session default.
			if (manifest.thinking) {
				args.push("--thinking", manifest.thinking);
			}

			// Herramientas permitidas
			if (childTools.length > 0) {
				args.push("--tools", childTools.join(","));
			}

			// Deny baseline: forwarded as Pi's own exclusion flag, applied after every
			// other selection, so a denied tool cannot reach the child even if a future
			// template allows it.
			if (excludedTools.length > 0) {
				args.push("--exclude-tools", excludedTools.join(","));
				record.deniedTools = excludedTools;
			}

			// A specialist session has no consumer: the studio cannot resume it, so
			// persisting one only fills the user's session list. The stderr tail below
			// keeps what is needed to diagnose a failed run.
			args.push("--no-session");

			// Unbounded parallelism means several specialists competing for the same
			// worktree with nobody watching. Refuse rather than queue: the caller decides.
			const maxConcurrency = Number(process.env.PI_STUDIO_MAX_CONCURRENCY) || 4;
			if (this.liveProcesses.size >= maxConcurrency) {
				record.status = "failed";
				record.error = `Concurrencia maxima alcanzada (${maxConcurrency} especialistas en ejecucion). Espera o cancela uno antes de despachar otro.`;
				record.endedAt = Date.now();
				record.latestActivity = "Rechazado por concurrencia";
				this.notifyListeners(record);
				return resolve(record);
			}

			let child: ChildProcess;
			try {
				child = spawn(piExecutable, args, {
					cwd: record.cwd,
					env: buildSubagentEnv(record.task, {
						...process.env,
						PI_GAME_STUDIO_CHILD: "1",
						PI_GAME_STUDIO_AGENT: manifest.name,
					}),
					stdio: ["pipe", "pipe", "pipe"],
					// Own process group, so termination can reach grandchildren.
					detached: process.platform !== "win32",
				});
			} catch (err: any) {
				record.status = "failed";
				record.error = `Could not spawn pi RPC process: ${err?.message || String(err)}`;
				record.endedAt = Date.now();
				record.latestActivity = "Fallo al iniciar RPC";
				this.notifyListeners(record);
				return resolve(record);
			}

			this.liveProcesses.set(record.id, child);

			const abortHandler = () => {
				this.cancel(record.id, "Operación abortada por el usuario (Escape)");
			};
			if (signal) {
				signal.addEventListener("abort", abortHandler, { once: true });
			}

			let resultText = "";
			// The authoritative final message: compaction can leave the accumulated
			// deltas truncated, but message_end carries the whole message.
			let lastAssistantText = "";
			let rpcBuffer = "";
			let promptSent = false;
			let agentSettled = false; // true tras agent_settled: un SIGTERM de gracia posterior no es un fallo
			const promptRequestId = `prompt-${record.id}`;
			let superseded = false; // el runner ya decidió el desenlace (prompt rechazado)
			let settledAborted = false; // agent_settled.aborted === true

			let thinkingBuffer = "";
			let textBuffer = "";
			const activeToolCalls = new Map<string, { toolName: string; detail: string; startedAt: number }>();
			const lastLoggedThinking = new Set<string>();

			const sendRpc = (payload: Record<string, unknown>) => {
				try {
					child.stdin?.write(`${JSON.stringify(payload)}\n`);
				} catch (error) {
					recordFailure("runner.stdin.write", error);
				}
			};

			// Enviar prompt inicial al conectarse
			const initTimer = setTimeout(() => {
				if (!promptSent) {
					promptSent = true;
					sendRpc({ id: promptRequestId, type: "prompt", message: executivePrompt });
					record.latestActivity = "Prompt enviado al especialista";
					this.notifyListeners(record);
				}
			}, 300);

			// Procesar eventos JSON streaming de la RPC (idéntico a Gentle Shell)
			child.stdout?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				record.lastActivityAt = Date.now();
				rpcBuffer += chunk;
				const lines = rpcBuffer.split("\n");
				rpcBuffer = lines.pop() ?? "";

				for (const rawLine of lines) {
					const line = rawLine.trim();
					if (!line) continue;
					try {
						const event = JSON.parse(line);
						
						// Enviar prompt si recibimos el primer estado
						if (!promptSent && (event.type === "response" || event.type === "turn_start" || event.type === "ready")) {
							promptSent = true;
							clearTimeout(initTimer);
							sendRpc({ id: promptRequestId, type: "prompt", message: executivePrompt });
							record.latestActivity = "Especialista conectado";
							appendTaskLog(record, `${formatRel(record.startedAt)}  rpc   conexión establecida`);
							this.notifyListeners(record);
						}

						// 0. Correlación del prompt: Pi responde a cada comando y la respuesta
						// dice si el run arrancó. Ignorarla convierte un rechazo en un timeout ciego.
						if (event.type === "response" && event.command === "prompt" && event.id === promptRequestId) {
							const disposition = event.data?.disposition;
							if (event.success === false) {
								superseded = true;
								record.status = "failed";
								record.error = `Prompt rejected by the child: ${event.error || "unknown reason"}`;
								record.latestActivity = "Prompt rechazado";
								appendTaskLog(record, `${formatRel(record.startedAt)}  rpc   prompt rechazado`);
								this.notifyListeners(record);
								signalChildTree(child, "SIGTERM");
							} else if (disposition === "handled") {
								superseded = true;
								record.status = "failed";
								record.error = "Prompt handled by a child extension command: no run started";
								record.latestActivity = "Prompt consumido sin run";
								this.notifyListeners(record);
								signalChildTree(child, "SIGTERM");
							}
						}

						// 0a. Compactación: invisible hasta ahora, y capaz de truncar la
						// entrega sin que nadie se entere.
						if (event.type === "compaction_start") {
							const reason = String(event.reason || "unknown");
							record.compactions = [...(record.compactions ?? []), { reason, ok: false }];
							appendTaskLog(record, `        compactación inicio (${reason})`);
							record.latestActivity = `Compactando contexto (${reason})`;
							this.notifyListeners(record);
						}

						if (event.type === "compaction_end") {
							const compactions = record.compactions ?? [];
							const entry = compactions[compactions.length - 1];
							if (entry) entry.ok = Boolean(event.result) && event.aborted !== true;
							if (event.aborted === true) {
								appendTaskLog(record, "        compactación abortada");
							} else if (!event.result) {
								appendTaskLog(record, `        compactación fallida: ${event.errorMessage || "sin detalle"}`);
								recordFailure("runner.compaction", event.errorMessage || "compaction failed");
							} else {
								const before = event.result.tokensBefore;
								const after = event.result.estimatedTokensAfter;
								appendTaskLog(record, `        compactación ok (${before} -> ${after} tokens)`);
							}
							this.notifyListeners(record);
						}

						// 0b. Uso real reportado por Pi: un mensaje completado es la fuente
						// autoritativa, y message_update es el mismo mensaje en curso.
						if (event.type === "message_end") {
							const blocks = Array.isArray(event.message?.content) ? event.message.content : [];
							const messageText = blocks
								.filter((b: any) => b?.type === "text" && typeof b.text === "string")
								.map((b: any) => b.text)
								.join("");
							if (messageText.trim()) lastAssistantText = messageText;

							const usage = event.message?.usage || event.usage;
							if (usage) {
								const totals = record.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
								totals.input += Number(usage.input) || 0;
								totals.output += Number(usage.output) || 0;
								totals.cacheRead += Number(usage.cacheRead) || 0;
								totals.cacheWrite += Number(usage.cacheWrite) || 0;
								totals.cost += Number(usage.cost) || 0;
								record.usage = totals;
							}
						}

						// 1. Detección de inicio de herramientas (TOOL_START)
						if (event.type === "tool_execution_start" || event.type === "tool_start") {
							activeTool = String(event.toolName || event.name || "tool");
							const toolCallId = event.toolCallId || event.id || `call_${Date.now()}_${Math.random()}`;
							const toolName = event.toolName || event.name || "tool";
							const args = event.args || {};
							let detail = toolName;
							let logLine = "";
							const rel = formatRel(record.startedAt);

							if (toolName === "bash" && typeof args.command === "string") {
								detail = `bash: ${args.command}`;
								logLine = `${rel}  bash  ${args.command}`;
							} else if (toolName === "read" && typeof args.path === "string") {
								detail = `read: ${args.path}`;
								logLine = `${rel}  read  ${args.path}`;
							} else if (toolName === "write" && typeof args.path === "string") {
								detail = `write: ${args.path}`;
								logLine = `${rel}  write ${args.path}`;
							} else if (toolName === "edit" && typeof args.path === "string") {
								detail = `edit: ${args.path}`;
								logLine = `${rel}  edit  ${args.path}`;
							} else if (toolName === "find") {
								const query = args.pattern || args.path || "";
								detail = `find: ${query}`;
								logLine = `${rel}  find  ${query}`;
							} else if (toolName === "grep") {
								detail = `grep: "${args.pattern || ""}" in ${args.path || "."}`;
								logLine = `${rel}  grep  "${args.pattern || ""}" in ${args.path || "."}`;
							} else {
								const argStr = JSON.stringify(args);
								detail = `${toolName}`;
								logLine = `${rel}  call  ${toolName}${argStr && argStr !== "{}" ? `: ${argStr.slice(0, 80)}` : ""}`;
							}

							activeToolCalls.set(toolCallId, { toolName, detail, startedAt: Date.now() });
							record.latestActivity = detail.slice(0, 45);
							appendTaskLog(record, logLine);
							this.notifyListeners(record);
						}

						// 2. Finalización de herramienta con salida real (TOOL_END)
						if (event.type === "tool_execution_end") {
							activeTool = null;
							const toolCallId = event.toolCallId || event.id;
							const tracked = toolCallId ? activeToolCalls.get(toolCallId) : undefined;
							const toolName = event.toolName || tracked?.toolName || "tool";
							const durationMs = event.durationMs ?? (tracked ? Date.now() - tracked.startedAt : undefined);
							const durationStr = durationMs !== undefined ? `${durationMs}ms` : "";

							let outputText = "";
							if (typeof event.result === "string") {
								outputText = event.result;
							} else if (event.result && Array.isArray(event.result.content)) {
								outputText = event.result.content
									.filter((c: any) => c?.type === "text" && typeof c.text === "string")
									.map((c: any) => c.text)
									.join("\n");
							} else if (event.result?.text) {
								outputText = event.result.text;
							}

							if (event.isError) {
								const errLine = (outputText.trim().split("\n")[0] || "error en ejecución").slice(0, 100);
								appendTaskLog(record, `        err (${durationStr}): ${errLine}`);
							} else if (toolName === "bash") {
								const outLines = outputText.trim().split("\n").filter((l: string) => l.trim().length > 0);
								if (outLines.length > 0) {
									appendTaskLog(record, `        out (${durationStr}):`);
									const previewCount = Math.min(outLines.length, 5);
									for (let i = 0; i < previewCount; i++) {
										appendTaskLog(record, `          ${outLines[i]}`);
									}
									if (outLines.length > 5) {
										appendTaskLog(record, `          ... (${outLines.length - 5} líneas más)`);
									}
								} else {
									appendTaskLog(record, `        ok (${durationStr})`);
								}
							} else if (toolName === "read") {
								const lineCount = outputText.split("\n").length;
								appendTaskLog(record, `        ok (${durationStr}): ${lineCount} líneas`);
							} else if (toolName === "write" || toolName === "edit") {
								appendTaskLog(record, `        ok (${durationStr}): cambios guardados`);
							} else if (toolName === "find" || toolName === "grep") {
								const matchLines = outputText.trim().split("\n").filter((l: string) => l.trim().length > 0);
								appendTaskLog(record, `        ok (${durationStr}): ${matchLines.length} coincidencia(s)`);
							} else if (outputText.trim()) {
								const firstLine = outputText.trim().split("\n")[0].slice(0, 80);
								appendTaskLog(record, `        ok (${durationStr}): ${firstLine}`);
							}

							if (toolCallId) {
								activeToolCalls.delete(toolCallId);
							}
							this.notifyListeners(record);
						}

						// 3. Streaming de pensamiento y texto del asistente
						if (event.type === "message_update") {
							const inner = event.assistantMessageEvent;
							if (inner?.type === "thinking_delta" && typeof inner.delta === "string") {
								thinkingBuffer += inner.delta;
								const firstIntention = thinkingBuffer.trim().split("\n")[0]?.trim();
								if (firstIntention) {
									record.latestActivity = `pensando: ${firstIntention}`.slice(0, 45);
								}
								// Colapsar monólogo interno en hitos ejecutivos (máx 1 línea por bloque)
								if (thinkingBuffer.length > 200 && thinkingBuffer.includes("\n")) {
									const lines = thinkingBuffer.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
									const headline = lines.find((l: string) => l.length > 10 && !l.startsWith("-") && !l.startsWith("*")) || lines[0];
									if (headline && !lastLoggedThinking.has(headline)) {
										lastLoggedThinking.add(headline);
										appendTaskLog(record, `${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
										this.notifyListeners(record);
									}
									thinkingBuffer = "";
								}
							}
							if (inner?.type === "thinking_end") {
								if (thinkingBuffer.trim()) {
									const headline = thinkingBuffer.trim().split("\n")[0]?.trim();
									if (headline && !lastLoggedThinking.has(headline)) {
										lastLoggedThinking.add(headline);
										appendTaskLog(record, `${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
									}
									thinkingBuffer = "";
									this.notifyListeners(record);
								}
							}
							if (inner?.type === "text_delta" && typeof inner.delta === "string") {
								resultText += inner.delta;
								textBuffer += inner.delta;
								if (textBuffer.includes("\n")) {
									const chunks = textBuffer.split("\n");
									textBuffer = chunks.pop() ?? "";
									for (const chunk of chunks) {
										const clean = chunk.trim();
										if (clean && !clean.startsWith("{") && !clean.startsWith("```")) {
											appendTaskLog(record, `${formatRel(record.startedAt)}  text  ${clean.slice(0, 90)}`);
										}
									}
									this.notifyListeners(record);
								}
							}
						}

						// 3. Captura final en agent_end / terminalAssistant
						if (event.type === "agent_end" && Array.isArray(event.messages)) {
							for (let i = event.messages.length - 1; i >= 0; i--) {
								const m = event.messages[i];
								if (m?.role === "assistant" && Array.isArray(m.content)) {
									const text = m.content
										.filter((c: any) => c?.type === "text" && typeof c.text === "string")
										.map((c: any) => c.text)
										.join("\n");
									if (text) {
										resultText = text;
										break;
									}
								}
							}
						}

						// 4. Auto-respuesta si el subagente intenta abrir diálogo (prevenir bloqueos huérfanos)
						if (event.type === "extension_ui_request" && event.id) {
							sendRpc({
								type: "extension_ui_response",
								id: event.id,
								cancelled: true,
							});
						}

						// 5. Finalización natural en agent_settled
						if (event.type === "agent_settled") {
							agentSettled = true;
							if (event.aborted === true) settledAborted = true;
							if (thinkingBuffer.trim()) {
								const headline = thinkingBuffer.trim().split("\n")[0]?.trim();
								if (headline && !lastLoggedThinking.has(headline)) {
									appendTaskLog(record, `${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
								}
								thinkingBuffer = "";
							}
							record.latestActivity = "Sintetizando entrega...";
							appendTaskLog(record, `${formatRel(record.startedAt)}  done  entrega completada`);
							this.notifyListeners(record);
							// Cerrar stdin para que el hijo termine solo
							try {
								child.stdin?.end();
							} catch (error) {
								recordFailure("runner.stdin.close", error);
							}

							// Timer de gracia: si tras 2.5s el proceso hijo no cerró, forzar cierre limpio con SIGTERM
							setTimeout(() => {
								if (this.liveProcesses.has(record.id) && child.exitCode === null) {
									signalChildTree(child, "SIGTERM");
								}
							}, CHILD_TERM_GRACE_MS);
						}
					} catch {
						// Si la línea no es JSON puro, podría ser log estándar
						if (line.length > 0 && !line.startsWith("{")) {
							record.latestActivity = line.slice(0, 35);
							appendTaskLog(record, `${formatRel(record.startedAt)}  raw   ${line.slice(0, 90)}`);
							this.notifyListeners(record);
						}
					}
				}
			});

			child.stderr?.setEncoding("utf8");
			child.stderr?.on("data", (chunk: string) => {
				record.lastActivityAt = Date.now();
				const clean = chunk.trim();
				if (clean) {
					appendTaskLog(record, `        stderr: ${clean.slice(0, 100)}`);
					for (const line of clean.split("\n")) {
						if (!line.trim()) continue;
						// Both dimensions are bounded: 20 lines, and each line capped, so one
						// enormous line cannot become the whole error text either.
						record.stderrTail!.push(line.trim().slice(0, 400));
						if (record.stderrTail!.length > 20) record.stderrTail!.shift();
					}
				}
			});

			// Watchdog timeout adaptativo (activeTimeout)
			const tickMs = Math.max(150, Math.min(2000, Math.floor(idleBudget / 4)));
			const timer = setInterval(() => {
				if (!this.liveProcesses.has(record.id)) return;
				const idleFor = Date.now() - (record.lastActivityAt ?? Date.now());
				const budget = activeTool ? toolIdleBudget : idleBudget;
				if (idleFor < budget) return;
				const seconds = Math.round(idleFor / 1000);
				this.cancel(
					record.id,
					activeTool
						? `Timeout: sin actividad de la herramienta '${activeTool}' durante ${seconds}s`
						: `Timeout: sin actividad del especialista durante ${seconds}s`,
				);
			}, tickMs);

			child.on("close", (code) => {
				clearTimeout(timer);
				clearTimeout(initTimer);
				if (signal) {
					signal.removeEventListener("abort", abortHandler);
				}
				this.liveProcesses.delete(record.id);
				record.endedAt = Date.now();

				if (superseded) {
					// El desenlace ya se decidió al leer la respuesta del prompt.
					this.notifyListeners(record);
					return resolve(record);
				}

				if (settledAborted) {
					record.status = "cancelled";
					record.result = resultText.trim() || null;
					record.latestActivity = "Abortado por el hijo (agent_settled.aborted)";
					this.notifyListeners(record);
					return resolve(record);
				}

				if (record.status === "cancelled") {
					record.latestActivity = "Cancelado por usuario/timeout";
					this.notifyListeners(record);
					return resolve(record);
				}

				if (code === 0 || (agentSettled && code === null)) {
					let delivery = resultText.trim();
					const contractOptions = { tools: manifest.tools };
					let contract = validateSpecialistReturn(delivery, contractOptions);

					// If the deltas did not survive (compaction truncation), fall back to the
					// final message Pi already sent: a recoverable delivery must not be read
					// as a contract violation.
					if (!contract.isValid && lastAssistantText.trim()) {
						const recovered = validateSpecialistReturn(lastAssistantText.trim(), contractOptions);
						if (recovered.isValid) {
							delivery = lastAssistantText.trim();
							contract = recovered;
							appendTaskLog(record, "        entrega recuperada del mensaje final (deltas incompletos)");
						}
					}

					if (!contract.isValid) {
						// El contrato de retorno es la puerta del Zero Bleed: una entrega que no
						// lo cumple no se marca completada, se reporta como fallo con sus razones.
						record.status = "failed";
						record.error = `Return contract violation: ${contract.errors.join(" ")}`;
						record.result = delivery || null;
						record.latestActivity = "Contrato de retorno inválido";
						appendTaskLog(record, `        contract: ${contract.errors.length} violación(es)`);
					} else if (contract.parsed?.status === "interaction_required") {
						record.status = "interaction_required";
						record.interaction = contract.parsed.interaction ?? null;
						record.result = delivery || null;
						record.latestActivity = "Esperando decisión del usuario";
						appendTaskLog(record, "        contract: interaction_required");
					} else {
						record.status = "completed";
						record.result = delivery || "(el especialista no produjo salida)";
						record.latestActivity = "Completado exitosamente";
					}
				} else {
					record.status = "failed";
					// The bounded tail is the diagnostic; the full stream was only ever read here.
					record.error = record.stderrTail?.length
						? record.stderrTail.join("\n")
						: `Subagent process exited with code ${code}`;
					record.result = resultText.trim() || null;
					record.latestActivity = `Error al salir (código ${code})`;
				}

				this.notifyListeners(record);
				resolve(record);
			});

			child.on("error", (err) => {
				clearTimeout(timer);
				clearTimeout(initTimer);
				if (signal) {
					signal.removeEventListener("abort", abortHandler);
				}
				this.liveProcesses.delete(record.id);
				record.status = "failed";
				record.error = err.message;
				record.endedAt = Date.now();
				record.latestActivity = `Error de proceso: ${err.message}`;
				this.notifyListeners(record);
				resolve(record);
			});
		});
	}
}

// Instancia singleton para compartir entre tools de la sesión
export const studioAgentsRunner = new StudioAgentsRunner();
