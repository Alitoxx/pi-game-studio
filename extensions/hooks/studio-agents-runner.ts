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
			record.latestActivity = "Iniciando especialista en modo RPC...";
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
			
			// Preparar flags de Pi en modo RPC bidireccional (idéntico a Gentle Shell)
			const args: string[] = [
				"--mode", "rpc",
				"--append-system-prompt",
				manifest.systemPrompt,
			];

			// Añadir modelo si no es inherit
			if (manifest.model && manifest.model !== "inherit") {
				args.push("--model", manifest.model);
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

			let resultText = "";
			let stderr = "";
			let rpcBuffer = "";
			let promptSent = false;

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
							this.notifyListeners(record);
						}

						// 1. Detección de inicio de herramientas (TOOL_START)
						if (event.type === "tool_execution_start" || event.type === "tool_start") {
							const toolName = event.toolName || event.name || "tool";
							const args = event.args || {};
							let detail = toolName;
							if (toolName === "bash" && typeof args.command === "string") {
								detail = `bash: ${args.command.slice(0, 30)}`;
							} else if ((toolName === "edit" || toolName === "write" || toolName === "read") && typeof args.path === "string") {
								const shortPath = args.path.split("/").pop() || args.path;
								detail = `${toolName}: ${shortPath}`;
							}
							record.latestActivity = detail;
							this.notifyListeners(record);
						}

						// 2. Acumulación de texto del asistente
						if (event.type === "message_update") {
							const inner = event.assistantMessageEvent;
							if (inner?.type === "text_delta" && typeof inner.delta === "string") {
								resultText += inner.delta;
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
							record.latestActivity = "Sintetizando entrega...";
							this.notifyListeners(record);
						}
					} catch {
						// Si la línea no es JSON puro, podría ser log estándar
						if (line.length > 0 && !line.startsWith("{")) {
							record.latestActivity = line.slice(0, 35);
							this.notifyListeners(record);
						}
					}
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
				clearTimeout(initTimer);
				this.liveProcesses.delete(record.id);
				record.endedAt = Date.now();

				if (record.status === "cancelled") {
					record.latestActivity = "Cancelado por usuario/timeout";
					this.notifyListeners(record);
					return resolve(record);
				}

				if (code === 0) {
					record.status = "completed";
					record.result = resultText.trim() || "(el especialista no produjo salida)";
					record.latestActivity = "Completado exitosamente";
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
