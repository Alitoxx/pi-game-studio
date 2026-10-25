import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentManifest } from "./studio-agent-loader.ts";
import { validateSpecialistReturn } from "./return-contract.ts";

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
	timeoutMs?: number;
	logs: string[];
}

export type TaskListener = (task: TaskRecord) => void;

export interface RunnerOptions {
	piCommand?: string;
	piArgs?: string[];
	timeoutMs?: number;
}

export function formatRel(startedAt?: number | null): string {
	if (!startedAt) return "+0.0s";
	const sec = Math.max(0, (Date.now() - startedAt) / 1000);
	return `+${sec.toFixed(1)}s`.padStart(6, " ");
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
			try {
				child.kill("SIGTERM");
			} catch {}
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

		// Si el modelo es inherit o no está definido, hereda el modelo activo de la sesión; si no, usa el manifest o fallback
		const chosenModel = manifest.model && manifest.model !== "inherit"
			? manifest.model
			: activeModel || "inherit";

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
			timeoutMs: timeoutMs || (mode === "background" ? 900000 : this.timeoutMs),
			logs: [],
		};

		this.tasks.set(taskId, record);
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

			// Watchdog timeout específico o según modo (background: 15 min, task: 5 min)
			const activeTimeout = record.timeoutMs
				|| (record.mode === "background" ? 900000 : this.timeoutMs);

			// Preparar instrucción ejecutiva para el especialista bajo protocolo ODD estricto
			const executivePrompt = [
				`[PI GAME STUDIO SPECIALIST DISPATCH — ODD PROTOCOL ACTIVE]`,
				`Role: ${manifest.name} (${manifest.title} - Tier: ${manifest.tier})`,
				`Working Directory: ${record.cwd}`,
				`Assigned Task:`,
				record.task,
				``,
				`[ODD GAMEDEV EXECUTION RULES — MANDATORY]`,
				`1. AUTONOMOUS DIRECT EXECUTION: This task has already been authorized by the Producer/User. Do NOT ask conversational questions, do NOT output menus, and do NOT wait for confirmation before writing files. Execute the task directly on disk using your allowed tools (${manifest.tools.join(", ")}).`,
				`2. ATOMIC SCOPE (~400 LINES): Deliver coherent changes of ~400 lines (code + data/tests). Do NOT dump monolithic 800+ line blocks in one pass. If the design requires more, implement the foundational core cleanly and set status: partial in the completion receipt.`,
				`3. SCOPED ENGINE VALIDATION (NO MONOLITHIC BUILDS): If you validate via bash:`,
				`   - If working on an isolated crate or component (e.g. crates/radio-core), run ONLY focused tests: e.g. 'cargo test -p <crate>' or 'cargo check -p <crate>'.`,
				`   - NEVER trigger full workspace builds or tests that recompile heavy game engines (like Bevy, Unreal, Unity) during an isolated logic task. Keep bash commands bounded and fast.`,
				`4. SINGLE SOURCE OF TRUTH (LIVE SPECS): Read existing design documents in 'design/gdd/<feature>.md' and current code in 'src/'. Never assume non-existent APIs.`,
				`5. FOSS CLI TOOLCHAIN ACCELERATION: Use available CLI tools via bash when relevant: 'magick' (image manipulation), 'oxipng' (lossless PNG compression), 'pngquant' (8-bit alpha quantization), 'free-tex-packer-cli' (atlas/spritesheets with JSON metadata), 'gltf-transform' (3D mesh inspection & polygon audit), 'gltfpack' (meshopt 3D GPU optimization), 'assimp' (fast 3D to GLB conversion), 'ffmpeg' (audio conversion/normalization to .ogg), 'wasm-opt' (WASM optimization), 'butler' (itch.io push), 'gh' (GitHub releases/PRs), and 'watchexec' (live-reload testing).`,
				`6. 2D VS 3D PIPELINE GUIDANCE: Check 'project.yaml' for dimension ('2d' or '3d'). When project is 2D: prioritize 'free-tex-packer-cli', 'oxipng', 'TileMaps', and 2D sprite physics. When project is 3D: prioritize 'gltf-transform inspect' to audit polygon budgets, 'gltfpack' for GPU LODs/compression, and adopt the Graybox CSG -> Modular Kits methodology.`,
				`7. STRICT RETURN CONTRACT: At the very end of your response, output ONLY a clean YAML block formatted exactly like this:`,
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

			// Herramientas permitidas
			if (manifest.tools && manifest.tools.length > 0) {
				args.push("--tools", manifest.tools.join(","));
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
					stdio: ["pipe", "pipe", "pipe"],
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
			let stderr = "";
			let rpcBuffer = "";
			let promptSent = false;
			let agentSettled = false; // true tras agent_settled: un SIGTERM de gracia posterior no es un fallo
			let thinkingBuffer = "";
			let textBuffer = "";
			const activeToolCalls = new Map<string, { toolName: string; detail: string; startedAt: number }>();
			const lastLoggedThinking = new Set<string>();

			const sendRpc = (payload: Record<string, unknown>) => {
				try {
					child.stdin?.write(`${JSON.stringify(payload)}\n`);
				} catch {}
			};

			// Enviar prompt inicial al conectarse
			const initTimer = setTimeout(() => {
				if (!promptSent) {
					promptSent = true;
					sendRpc({ type: "prompt", message: executivePrompt });
					record.latestActivity = "Prompt enviado al especialista";
					this.notifyListeners(record);
				}
			}, 300);

			// Procesar eventos JSON streaming de la RPC (idéntico a Gentle Shell)
			child.stdout?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
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
							sendRpc({ type: "prompt", message: executivePrompt });
							record.latestActivity = "Especialista conectado";
							record.logs.push(`${formatRel(record.startedAt)}  rpc   conexión establecida`);
							this.notifyListeners(record);
						}

						// 1. Detección de inicio de herramientas (TOOL_START)
						if (event.type === "tool_execution_start" || event.type === "tool_start") {
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
							record.logs.push(logLine);
							this.notifyListeners(record);
						}

						// 2. Finalización de herramienta con salida real (TOOL_END)
						if (event.type === "tool_execution_end") {
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
								record.logs.push(`        err (${durationStr}): ${errLine}`);
							} else if (toolName === "bash") {
								const outLines = outputText.trim().split("\n").filter((l: string) => l.trim().length > 0);
								if (outLines.length > 0) {
									record.logs.push(`        out (${durationStr}):`);
									const previewCount = Math.min(outLines.length, 5);
									for (let i = 0; i < previewCount; i++) {
										record.logs.push(`          ${outLines[i]}`);
									}
									if (outLines.length > 5) {
										record.logs.push(`          ... (${outLines.length - 5} líneas más)`);
									}
								} else {
									record.logs.push(`        ok (${durationStr})`);
								}
							} else if (toolName === "read") {
								const lineCount = outputText.split("\n").length;
								record.logs.push(`        ok (${durationStr}): ${lineCount} líneas`);
							} else if (toolName === "write" || toolName === "edit") {
								record.logs.push(`        ok (${durationStr}): cambios guardados`);
							} else if (toolName === "find" || toolName === "grep") {
								const matchLines = outputText.trim().split("\n").filter((l: string) => l.trim().length > 0);
								record.logs.push(`        ok (${durationStr}): ${matchLines.length} coincidencia(s)`);
							} else if (outputText.trim()) {
								const firstLine = outputText.trim().split("\n")[0].slice(0, 80);
								record.logs.push(`        ok (${durationStr}): ${firstLine}`);
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
										record.logs.push(`${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
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
										record.logs.push(`${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
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
											record.logs.push(`${formatRel(record.startedAt)}  text  ${clean.slice(0, 90)}`);
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
							if (thinkingBuffer.trim()) {
								const headline = thinkingBuffer.trim().split("\n")[0]?.trim();
								if (headline && !lastLoggedThinking.has(headline)) {
									record.logs.push(`${formatRel(record.startedAt)}  think ${headline.slice(0, 90)}`);
								}
								thinkingBuffer = "";
							}
							record.latestActivity = "Sintetizando entrega...";
							record.logs.push(`${formatRel(record.startedAt)}  done  entrega completada`);
							this.notifyListeners(record);
							// Cerrar stdin para que el hijo termine solo
							try {
								child.stdin?.end();
							} catch {}

							// Timer de gracia: si tras 2.5s el proceso hijo no cerró, forzar cierre limpio con SIGTERM
							setTimeout(() => {
								if (this.liveProcesses.has(record.id)) {
									try {
										child.kill("SIGTERM");
									} catch {}
								}
							}, 2500);
						}
					} catch {
						// Si la línea no es JSON puro, podría ser log estándar
						if (line.length > 0 && !line.startsWith("{")) {
							record.latestActivity = line.slice(0, 35);
							record.logs.push(`${formatRel(record.startedAt)}  raw   ${line.slice(0, 90)}`);
							this.notifyListeners(record);
						}
					}
				}
			});

			child.stderr?.setEncoding("utf8");
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
				const clean = chunk.trim();
				if (clean) {
					record.logs.push(`        stderr: ${clean.slice(0, 100)}`);
				}
			});

			// Watchdog timeout adaptativo (activeTimeout)
			const timer = setTimeout(() => {
				if (this.liveProcesses.has(record.id)) {
					this.cancel(record.id, `Timeout: agent exceeded ${activeTimeout / 1000}s limit`);
					resolve(record);
				}
			}, activeTimeout);

			child.on("close", (code) => {
				clearTimeout(timer);
				clearTimeout(initTimer);
				if (signal) {
					signal.removeEventListener("abort", abortHandler);
				}
				this.liveProcesses.delete(record.id);
				record.endedAt = Date.now();

				if (record.status === "cancelled") {
					record.latestActivity = "Cancelado por usuario/timeout";
					this.notifyListeners(record);
					return resolve(record);
				}

				if (code === 0 || (agentSettled && code === null)) {
					const delivery = resultText.trim();
					const contract = validateSpecialistReturn(delivery);

					if (!contract.isValid) {
						// El contrato de retorno es la puerta del Zero Bleed: una entrega que no
						// lo cumple no se marca completada, se reporta como fallo con sus razones.
						record.status = "failed";
						record.error = `Return contract violation: ${contract.errors.join(" ")}`;
						record.result = delivery || null;
						record.latestActivity = "Contrato de retorno inválido";
						record.logs.push(`        contract: ${contract.errors.length} violación(es)`);
					} else {
						record.status = "completed";
						record.result = delivery || "(el especialista no produjo salida)";
						record.latestActivity = "Completado exitosamente";
					}
				} else {
					record.status = "failed";
					record.error = stderr.trim() || `Subagent process exited with code ${code}`;
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
