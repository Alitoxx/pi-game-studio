import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { loadAgentManifest, listAvailableAgents } from "./studio-agent-loader.ts";
import { studioAgentsRunner } from "./studio-agents-runner.ts";

export function registerStudioSubagentTools(pi: ExtensionAPI): void {
	// If tools are already provided globally (e.g. by host or another extension), don't register duplicates
	const hasTool = (name: string) => {
		try {
			if (typeof (pi as any).hasTool === "function") return (pi as any).hasTool(name);
			if (typeof (pi as any).getAllTools === "function") {
				const tools = (pi as any).getAllTools();
				return Array.isArray(tools) && tools.some((t: any) => t?.name === name);
			}
			return false;
		} catch {
			return false;
		}
	};

	const safeRegisterTool = (toolDef: any) => {
		if (hasTool(toolDef.name)) {
			return;
		}
		try {
			(pi as any).registerTool?.(toolDef);
		} catch {}
	};

	// ──────────────────────────────────────────────
	// Tool: subagent_run
	// Ejecuta un especialista aislado en un proceso hijo de Pi
	// ──────────────────────────────────────────────
	safeRegisterTool({
		name: "subagent_run",
		label: "Studio Subagent Run",
		description:
			"Delegates an isolated implementation, design, or review task to one of the specialized game studio agents (8+1 architecture). The subagent runs in an isolated child process and returns a structured YAML completion receipt.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["agent", "task"],
			properties: {
				agent: {
					type: "string",
					description:
						"The name of the specialist agent to invoke (e.g. 'game-designer', 'gameplay-programmer', 'bevy-specialist', 'godot-specialist', 'raylib-specialist', 'qa-lead').",
				},
				task: {
					type: "string",
					description:
						"Self-contained, concrete instructions for the subagent describing what to design, code, review, or validate.",
				},
				mode: {
					type: "string",
					enum: ["task", "background"],
					description:
						"'task' waits for the subagent to finish (default); 'background' spawns the subagent and returns immediately with a task ID.",
				},
				timeout_seconds: {
					type: "number",
					description:
						"Optional timeout limit in seconds (default is 300s for task mode, 900s for background mode).",
				},
				target_dir: {
					type: "string",
					description:
						"Optional relative subdirectory or crate path to scope execution (e.g. 'crates/radio-core' or 'src').",
				},
			},
		} as never,
		renderCall(args: any, theme: any, _context?: any) {
			const agentName = String(args?.agent || "").trim() || "unknown";
			let title = agentName;
			try {
				const manifest = loadAgentManifest(agentName, _context?.cwd || process.cwd());
				if (manifest?.title) {
					title = manifest.title;
				}
			} catch {}

			const fg = (slot: string, text: string) => (theme?.fg ? theme.fg(slot as any, text) : text);
			const bold = (text: string) => (theme?.bold ? theme.bold(text) : text);

			const badge = fg("accent", "▌ ◈ ENGINE DISPATCH");
			const header = `${badge} · ${bold(agentName)} (${title})`;

			const rawTask = String(args?.task || "").trim();
			const firstLine = rawTask.split(/\r?\n/)[0].trim();
			const compactTask = firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : (firstLine || "...");

			const modeStr = (args?.mode === "background" || args?.mode === "bg") ? "bg" : "task";
			const taskLine = `  ${fg("dim", `Task: ${compactTask} [mode: ${modeStr}]`)}`;

			return new Text(`${header}\n${taskLine}`, 0, 0);
		},
		renderResult(result: any, options: { expanded?: boolean; isPartial?: boolean } = {}, theme: any, _context?: any) {
			const expanded = Boolean(options?.expanded);
			const isPartial = Boolean(options?.isPartial);

			const fg = (slot: string, text: string) => (theme?.fg ? theme.fg(slot as any, text) : text);
			const bold = (text: string) => (theme?.bold ? theme.bold(text) : text);

			const agentName = String((result?.details as any)?.agent || _context?.args?.agent || "").trim() || "unknown";

			// 1. Partial / running state
			if (isPartial) {
				const badge = fg("accent", "▌ ● COMPILANDO / EJECUTANDO");
				return new Text(`${badge} · ${bold(agentName)}...`, 0, 0);
			}

			// 2. Failed state
			const isFailed = Boolean(
				(result as any)?.isError ||
				(result?.details as any)?.error ||
				(result?.details as any)?.status === "failed" ||
				(result?.details as any)?.status === "error" ||
				(result?.details as any)?.status === "timeout" ||
				(typeof result?.content?.[0]?.text === "string" && (
					result.content[0].text.startsWith("Error:") ||
					result.content[0].text.startsWith("[STUDIO TASK FAILED]") ||
					result.content[0].text.startsWith("[STUDIO TASK TIMEOUT]") ||
					result.content[0].text.startsWith("[STUDIO TASK ERROR]")
				))
			);

			if (isFailed) {
				let errorMsg = "";
				if (typeof (result?.details as any)?.error === "string") {
					errorMsg = (result.details as any).error;
				}
				const raw = typeof result?.content?.[0]?.text === "string" ? result.content[0].text : "";
				if (!errorMsg && raw) {
					const match = raw.match(/^(?:Error:\s*|\[STUDIO TASK [^\]]+\]\s*(?:[^:]+:\s*)?)(.+)/m);
					if (match) {
						errorMsg = match[1].trim();
					} else {
						errorMsg = raw.split(/\r?\n/)[0].trim();
					}
				}
				if (!errorMsg) {
					errorMsg = "unknown error";
				}

				const badge = fg("error", "▌ ■ DISPATCH ERROR");
				const line = `${badge} · ${bold(agentName)}: ${errorMsg}`;
				return new Text(line, 0, 0);
			}

			// 3. Complete and not expanded
			const raw = typeof result?.content?.[0]?.text === "string" ? result.content[0].text : "";
			const yamlMatch = raw.match(/```(?:yaml)?\s*([\s\S]*?)\s*```/);
			const block = yamlMatch ? yamlMatch[1] : raw;

			let summary = block.match(/summary:\s*["']?([^"'\n]+)/i)?.[1]?.trim() || "";
			if (!summary) {
				summary = raw.match(/(?:Resumen|Summary):\s*([^\n│]+)/i)?.[1]?.trim() || "";
			}
			if (!summary) {
				summary = (result?.details as any)?.taskId ? `Task ${(result.details as any).taskId}` : "(sin resumen)";
			}
			if (summary.length > 80) {
				summary = summary.slice(0, 77) + "...";
			}

			let files: string[] = [];
			const filesMatch = block.match(/files_changed:\s*([\s\S]*?)(?:validation:|tdd_evidence:|gameplay_impact:|risks:|review_focus:|$)/i)?.[1];
			if (filesMatch) {
				files = filesMatch
					.split(/\r?\n/)
					.map((l) => l.replace(/^\s*-\s*["']?/, "").replace(/["']?\s*$/, "").trim())
					.filter((f) => f && !f.startsWith("#") && !f.startsWith("["));
			}
			if (files.length === 0) {
				const boxFiles = raw.match(/(?:Archivos|Files):\s*([^\n│]+)/i)?.[1];
				if (boxFiles) {
					files = boxFiles.split(",").map((f) => f.trim()).filter(Boolean);
				}
			}
			const filesStr = files.length > 0 ? files.join(", ") : "(ninguno)";

			if (!expanded) {
				const badge = fg("success", "▌ ▲ DISPATCH OK");
				const header = `${badge} · ${bold(agentName)}`;
				const hint = fg("dim", "(Ctrl+O para expandir entrega completa)");
				const lines = [
					header,
					`  Resumen: ${summary}`,
					`  Archivos: ${filesStr}`,
					`  ${hint}`,
				];
				return new Text(lines.join("\n"), 0, 0);
			}

			// 4. Complete and expanded
			const badge = fg("success", "▌ ▲ DISPATCH OK");
			const header = `${badge} · ${bold(agentName)}`;
			const receiptBox = [
				`┌── DELIVERY RECEIPT: ${agentName.toUpperCase()} ────────────────────────┐`,
				summary ? `│ Resumen:    ${summary.padEnd(52, " ")}│` : null,
				files.length > 0 ? `│ Archivos:   ${files.slice(0, 2).join(", ").padEnd(52, " ")}│` : null,
				`└────────────────────────────────────────────────────────────┘`,
			].filter(Boolean).join("\n");

			const formattedBody = raw.includes("DELIVERY RECEIPT") ? raw : `${receiptBox}\n\n${raw}`.trim();
			return new Text(`${header}\n\n${formattedBody}`.trim(), 0, 0);
		},
		async execute(
			_id: string,
			params: Record<string, unknown>,
			_signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		) {
			const agentName = String(params.agent || "").trim();
			const taskPrompt = String(params.task || "").trim();
			const mode = (params.mode === "background" ? "background" : "task") as "task" | "background";
			const timeoutSeconds = typeof params.timeout_seconds === "number" && params.timeout_seconds > 0
				? params.timeout_seconds
				: undefined;
			const timeoutMs = timeoutSeconds ? timeoutSeconds * 1000 : undefined;
			const targetDir = typeof params.target_dir === "string" ? params.target_dir.trim() : "";
			// El hijo SIEMPRE corre en la raíz del proyecto: necesita design/gdd/ (Live Spec) y .pi/.
			// target_dir sólo acota el alcance de edición y validación.
			const executionCwd = ctx.cwd;
			let scopedTaskPrompt = String(params.task || "").trim();
			if (targetDir) {
				const root = resolve(ctx.cwd);
				const abs = resolve(root, targetDir);
				if ((abs !== root && !abs.startsWith(root + sep)) || !existsSync(abs)) {
					return {
						content: [{ type: "text", text: `Error: target_dir '${targetDir}' no existe o queda fuera del proyecto.` }],
						details: { error: "invalid_target_dir" },
					};
				}
				scopedTaskPrompt += `\n\n[SCOPE] Edit only files under '${targetDir}' (Live Specs in design/gdd/ remain readable). Validate only this unit (e.g. 'cargo test -p <crate>' if it is a Rust crate).`;
			}

			if (!agentName) {
				return {
					content: [{ type: "text", text: "Error: 'agent' parameter is required." }],
					details: { error: "missing_agent" },
				};
			}

			if (!taskPrompt) {
				return {
					content: [{ type: "text", text: "Error: 'task' parameter is required." }],
					details: { error: "missing_task" },
				};
			}

			const manifest = loadAgentManifest(agentName, ctx.cwd);
			if (!manifest) {
				const available = listAvailableAgents(ctx.cwd);
				return {
					content: [
						{
							type: "text",
							text: `Error: Agent '${agentName}' not found. Available agents: ${available.slice(0, 10).join(", ")}... (use subagent_list for all).`,
						},
					],
					details: { error: "agent_not_found", available },
				};
			}

			// Notificación sobria en la TUI
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(
					`[STUDIO DISPATCH] ${manifest.title} (${manifest.name}) · Modo: ${mode}`,
					"info",
				);
			}

			// ctx.model es un objeto ({ id, provider, ... }); el CLI de Pi espera "provider/id"
			const sessionModel = (ctx as any)?.model;
			const activeModel: string | undefined = sessionModel?.id
				? (sessionModel.provider && !String(sessionModel.id).includes("/")
					? `${sessionModel.provider}/${sessionModel.id}`
					: String(sessionModel.id))
				: undefined;
			const record = await studioAgentsRunner.run(
				manifest,
				scopedTaskPrompt,
				executionCwd,
				mode,
				_signal,
				timeoutMs,
				activeModel,
			);

			if (mode === "background") {
				return {
					content: [
						{
							type: "text",
							text: [
								`┌── STUDIO BACKGROUND DISPATCH ─────────────────────────────┐`,
								`│ Especialista: ${manifest.title.padEnd(44, " ")}│`,
								`│ Task ID:      ${record.id.padEnd(44, " ")}│`,
								`│ Estado:       ${record.status.padEnd(44, " ")}│`,
								`└───────────────────────────────────────────────────────────┘`,
								`Usa subagent_status ("${record.id}") para progreso o subagent_result para el resultado.`,
							].join("\n"),
						},
					],
					details: { taskId: record.id, agent: manifest.name, status: record.status },
				};
			}

			// Modo task síncrono
			if (record.status === "completed") {
				const raw = record.result || "";
				// Intentar parsear el YAML final para construir un Delivery Receipt estructurado
				const yamlMatch = raw.match(/```yaml\s*([\s\S]*?)\s*```/);
				if (yamlMatch) {
					const block = yamlMatch[1];
					const summary = block.match(/summary:\s*["']?([^"'\n]+)/i)?.[1] || "";
					const validation = block.match(/validation:\s*["']?([^"'\n]+)/i)?.[1] || "";
					const impact = block.match(/gameplay_impact:\s*["']?([^"'\n]+)/i)?.[1] || "";
					const filesMatch = block.match(/files_changed:\s*([\s\S]*?)(?:validation:|$)/i)?.[1];
					const files = filesMatch
						? filesMatch.split("\n").map(l => l.replace(/^\s*-\s*["']?/, "").replace(/["']?\s*$/, "").trim()).filter(Boolean)
						: [];

					const receiptText = [
						`┌── DELIVERY RECEIPT: ${manifest.title.toUpperCase()} ────────────────────────┐`,
						summary ? `│ Resumen:    ${summary.padEnd(52, " ")}│` : null,
						files.length > 0 ? `│ Archivos:   ${files.slice(0, 2).join(", ").padEnd(52, " ")}│` : null,
						validation ? `│ Validación: ${validation.padEnd(52, " ")}│` : null,
						impact ? `│ Game Feel:  ${impact.padEnd(52, " ")}│` : null,
						`└────────────────────────────────────────────────────────────┘`,
						``,
						raw,
					].filter(Boolean).join("\n");

					return {
						content: [
							{
								type: "text",
								text: receiptText,
							},
						],
						details: { taskId: record.id, agent: manifest.name, status: record.status },
					};
				}

				return {
					content: [
						{
							type: "text",
							text: record.result || "(el especialista no produjo salida)",
						},
					],
					details: { taskId: record.id, agent: manifest.name, status: record.status },
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `[STUDIO TASK ${record.status.toUpperCase()}] ${manifest.name}${record.error ? `: ${record.error}` : ""}${record.result ? `\n\n${record.result}` : ""}`,
					},
				],
				details: {
					taskId: record.id,
					agent: manifest.name,
					status: record.status,
					error: record.error,
				},
			};
		},
	});

	// ──────────────────────────────────────────────
	// Tool: subagent_list
	// Lista los especialistas disponibles
	// ──────────────────────────────────────────────
	safeRegisterTool({
		name: "subagent_list",
		label: "Studio Subagent List",
		description: "Lists all available specialized game studio agents with their roles and descriptions.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: {},
		} as never,
		async execute(_id: string, _params: any, _signal: any, _onUpdate: any, ctx: ExtensionContext) {
			const agents = listAvailableAgents(ctx.cwd);
			const lines = agents.map((name) => {
				const m = loadAgentManifest(name, ctx.cwd);
				return `- **${name}** [${m?.tier || "specialist"}]: ${m?.description || m?.title || "No description"}`;
			});

			return {
				content: [
					{
						type: "text",
						text: `Pi Game Studio — Available Specialists (${agents.length}):\n\n${lines.join("\n")}`,
					},
				],
				details: { count: agents.length, agents },
			};
		},
	});

	// ──────────────────────────────────────────────
	// Tool: subagent_status
	// Consulta el estado de una tarea
	// ──────────────────────────────────────────────
	safeRegisterTool({
		name: "subagent_status",
		label: "Studio Subagent Status",
		description: "Checks the execution status of a subagent task running in background mode.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["task_id"],
			properties: {
				task_id: {
					type: "string",
					description: "The task ID returned when launching the subagent in background mode.",
				},
			},
		} as never,
		async execute(_id: string, params: Record<string, unknown>) {
			const taskId = String(params.task_id || "").trim();
			const task = studioAgentsRunner.getTask(taskId);

			if (!task) {
				return {
					content: [{ type: "text", text: `Error: Task '${taskId}' not found.` }],
					details: { error: "not_found" },
				};
			}

			const duration = task.endedAt
				? `${((task.endedAt - (task.startedAt || task.endedAt)) / 1000).toFixed(1)}s`
				: task.startedAt
					? `${((Date.now() - task.startedAt) / 1000).toFixed(1)}s (running)`
					: "queued";

			return {
				content: [
					{
						type: "text",
						text: `Task: ${task.id}\nAgent: ${task.agent}\nStatus: ${task.status}\nDuration: ${duration}${task.error ? `\nError: ${task.error}` : ""}`,
					},
				],
				details: { task },
			};
		},
	});

	// ──────────────────────────────────────────────
	// Tool: subagent_result
	// Obtiene el resultado final de una tarea
	// ──────────────────────────────────────────────
	safeRegisterTool({
		name: "subagent_result",
		label: "Studio Subagent Result",
		description: "Retrieves the final output and completion receipt of a finished subagent task.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["task_id"],
			properties: {
				task_id: {
					type: "string",
					description: "The task ID of the completed subagent task.",
				},
			},
		} as never,
		async execute(_id: string, params: Record<string, unknown>) {
			const taskId = String(params.task_id || "").trim();
			const task = studioAgentsRunner.getTask(taskId);

			if (!task) {
				return {
					content: [{ type: "text", text: `Error: Task '${taskId}' not found.` }],
					details: { error: "not_found" },
				};
			}

			if (task.status === "running" || task.status === "queued") {
				return {
					content: [
						{
							type: "text",
							text: `Task '${taskId}' is still ${task.status}. Wait for it to finish or check subagent_status.`,
						},
					],
					details: { task },
				};
			}

			return {
				content: [
					{
						type: "text",
						text: task.result || `Task ended with status '${task.status}'. ${task.error || ""}`,
					},
				],
				details: { task },
			};
		},
	});
}
