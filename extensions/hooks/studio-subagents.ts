import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadAgentManifest, listAvailableAgents } from "./studio-agent-loader.ts";
import { studioAgentsRunner } from "./studio-agents-runner.ts";

export function registerStudioSubagentTools(pi: ExtensionAPI): void {
	// ──────────────────────────────────────────────
	// Tool: subagent_run
	// Ejecuta un especialista aislado en un proceso hijo de Pi
	// ──────────────────────────────────────────────
	(pi as any).registerTool?.({
		name: "subagent_run",
		label: "Studio Subagent Run",
		description:
			"Delegates an isolated implementation, design, or review task to one of the 55 specialized game studio agents. The subagent runs in an isolated child process and returns a structured YAML completion receipt.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["agent", "task"],
			properties: {
				agent: {
					type: "string",
					description:
						"The name of the specialist agent to invoke (e.g. 'game-designer', 'lead-programmer', 'gameplay-programmer', 'raylib-specialist', 'systems-designer', 'qa-tester').",
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
			},
		} as never,
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

			const record = await studioAgentsRunner.run(manifest, taskPrompt, ctx.cwd, mode);

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
	(pi as any).registerTool?.({
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
	(pi as any).registerTool?.({
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
	(pi as any).registerTool?.({
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
