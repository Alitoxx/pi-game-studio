import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentManifest } from "./studio-agent-loader.ts";

export interface TaskRecord {
	id: string;
	agent: string;
	title: string;
	task: string;
	mode: "task" | "background";
	cwd: string;
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
	model?: string;
	latestActivity?: string;
	result: string | null;
	error: string | null;
	startedAt: number | null;
	endedAt: number | null;
}

export type TaskListener = (task: TaskRecord) => void;

export interface RunnerOptions {
	piCommand?: string;
	piArgs?: string[];
	timeoutMs?: number;
}

export class StudioAgentsRunner {
	private tasks = new Map<string, TaskRecord>();
	private liveProcesses = new Map<string, ChildProcess>();
	private listeners = new Set<TaskListener>();
	private counter = 0;
	private timeoutMs = 300000; // 5 min default stall/run limit for complex chain tasks

	constructor(options: RunnerOptions = {}) {
		if (options.timeoutMs) {
			this.timeoutMs = options.timeoutMs;
		}
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
		return Array.from(this.tasks.values()).reverse();
	}

	cancel(id: string, reason = "cancelled by user"): boolean {
		const task = this.tasks.get(id);
		if (!task) return false;

		const child = this.liveProcesses.get(id);
		if (child) {
			try {
				child.kill("SIGTERM");
			} catch {}
			this.liveProcesses.delete(id);
		}

		if (task.status === "running" || task.status === "queued") {
			task.status = "cancelled";
			task.error = reason;
			task.endedAt = Date.now();
			return true;
		}
		return false;
	}

	async run(
		manifest: AgentManifest,
		taskPrompt: string,
		cwd: string,
		mode: "task" | "background" = "task",
	): Promise<TaskRecord> {
		this.counter++;
		const now = Date.now();
		const taskId = `task-${now.toString(36)}-${this.counter.toString(36)}`;

		const chosenModel = manifest.model && manifest.model !== "inherit"
			? manifest.model
			: "space-bunny-free";

		const record: TaskRecord = {
			id: taskId,
			agent: manifest.name,
			title: manifest.title,
			task: taskPrompt,
			mode,
			cwd,
			status: "queued",
			model: chosenModel,
			latestActivity: "En cola para ejecución...",
			result: null,
			error: null,
			startedAt: null,
			endedAt: null,
		};

		this.tasks.set(taskId, record);
		this.notifyListeners(record);

		const executionPromise = this.executeSubprocess(record, manifest);

		if (mode === "background") {
			// Retornar de inmediato sin esperar
			return record;
		}

		return await executionPromise;
	}

	private executeSubprocess(
		record: TaskRecord,
		manifest: AgentManifest,
	): Promise<TaskRecord> {
		return new Promise<TaskRecord>((resolve) => {
			record.status = "running";
			record.startedAt = Date.now();
			record.latestActivity = "Iniciando especialista...";
			this.notifyListeners(record);

			// Preparar instrucción ejecutiva para el especialista
			const executivePrompt = [
				`[PI GAME STUDIO SPECIALIST DISPATCH]`,
				`Role: ${manifest.name} (${manifest.title} - Tier: ${manifest.tier})`,
				`Working Directory: ${record.cwd}`,
				`Assigned Task:`,
				record.task,
				``,
				`[STRICT RETURN CONTRACT - GENTLE HIGH-SIGNAL ODD STANDARD]`,
				`Do NOT output chit-chat, conversational filler, greetings, or meta-explanations.`,
				`Execute your assigned role using your allowed tools (${manifest.tools.join(", ")}).`,
				`At the very end of your response, output ONLY a clean YAML block formatted exactly like this:`,
				`\`\`\`yaml`,
				`status: completed # or partial / failed / blocked`,
				`summary: "<executive 1-2 sentence summary of what was done>"`,
				`files_changed:`,
				`  - "<path_to_file>"`,
				`validation: "<tests run, clean compile, or fps checks>"`,
				`gameplay_impact: "<game feel, latency, memory allocations, or trade-offs>"`,
				`\`\`\``,
			].join("\n");

			// Resolver binario de Pi
			const piExecutable = process.execPath.includes("pi") ? process.execPath : "pi";
			
			// Preparar flags de Pi
			// Pasamos el prompt del sistema del agente como append-system-prompt
			const args: string[] = [
				"--print", // Non-interactive mode (proceso aislado que procesa y termina)
				"--append-system-prompt",
				manifest.systemPrompt,
				executivePrompt,
			];

			// Añadir modelo si no es inherit
			if (manifest.model && manifest.model !== "inherit") {
				args.unshift("--model", manifest.model);
			} else {
				// Proveedor y modelo por defecto configurados en el entorno del usuario
				args.unshift("--provider", "opencode-go", "--model", "space-bunny-free");
			}

			let child: ChildProcess;
			try {
				child = spawn(piExecutable, args, {
					cwd: record.cwd,
					env: {
						...process.env,
						PI_GAME_STUDIO_CHILD: "1",
						PI_GAME_STUDIO_AGENT: manifest.name,
					},
					stdio: ["ignore", "pipe", "pipe"],
				});
			} catch (err: any) {
				record.status = "failed";
				record.error = `Could not spawn pi process: ${err?.message || String(err)}`;
				record.endedAt = Date.now();
				record.latestActivity = "Fallo al iniciar subproceso";
				this.notifyListeners(record);
				return resolve(record);
			}

			this.liveProcesses.set(record.id, child);

			let stdout = "";
			let stderr = "";

			child.stdout?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				stdout += chunk;
				// Detectar indicios de herramientas activas en stdout
				const lastLine = chunk.trim().split("\n").pop() || "";
				if (lastLine.length > 0) {
					const clean = lastLine.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 40);
					record.latestActivity = clean;
					this.notifyListeners(record);
				}
			});

			child.stderr?.setEncoding("utf8");
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
			});

			// Watchdog timeout
			const timer = setTimeout(() => {
				if (this.liveProcesses.has(record.id)) {
					this.cancel(record.id, `Timeout: agent exceeded ${this.timeoutMs / 1000}s limit`);
					resolve(record);
				}
			}, this.timeoutMs);

			child.on("close", (code) => {
				clearTimeout(timer);
				this.liveProcesses.delete(record.id);
				record.endedAt = Date.now();

				if (record.status === "cancelled") {
					record.latestActivity = "Cancelado por usuario/timeout";
					this.notifyListeners(record);
					return resolve(record);
				}

				if (code === 0) {
					record.status = "completed";
					record.result = stdout.trim() || "(the subagent produced no output)";
					record.latestActivity = "Finalizado exitosamente";
				} else {
					record.status = "failed";
					record.error = stderr.trim() || `Subagent process exited with code ${code}`;
					record.result = stdout.trim() || null;
					record.latestActivity = `Error al salir (código ${code})`;
				}

				this.notifyListeners(record);
				resolve(record);
			});

			child.on("error", (err) => {
				clearTimeout(timer);
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
