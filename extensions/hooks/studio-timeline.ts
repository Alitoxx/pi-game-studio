import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { handleStudioTimelineViewer } from "./studio-timeline-viewer.ts";

export type TimelineCategory = "Milestones" | "ADRs" | "Specs";

export interface TimelineItem {
	id: string;
	type: "milestone" | "task" | "adr" | "spec";
	category: TimelineCategory;
	title: string;
	status: string;
	date?: string;
	timestamp?: number;
	icon: string;
	sourceFile: string;
	progress?: number;
	milestoneId?: string;
	treeSpine?: string;
	details: {
		summary?: string;
		context?: string;
		decision?: string;
		consequences?: string;
		tradeoffs?: string;
		acceptanceCriteria?: string[];
		tuningKnobs?: string[];
		producerState?: Record<string, string>;
		rawContent?: string;
	};
}

export interface TimelineData {
	items: TimelineItem[];
	producerState?: Record<string, string>;
	milestonesCount: number;
	adrsCount: number;
	specsCount: number;
	totalCount: number;
}

/**
 * Extracts the PRODUCER_STATE metadata block from roadmap content.
 */
function parseProducerStateBlock(content: string): Record<string, string> | undefined {
	const match = content.match(/<!--\s*PRODUCER_STATE\s*([\s\S]*?)<!--\s*\/PRODUCER_STATE\s*-->/i);
	if (!match || !match[1]) return undefined;

	const block = match[1];
	const state: Record<string, string> = {};

	const game = block.match(/(?:Juego|Game|Project|Title):\s*([^\n]+)/i);
	if (game) state.gameTitle = game[1].trim();

	const engine = block.match(/(?:Motor|Engine):\s*([^\n]+)/i);
	if (engine) state.engine = engine[1].trim();

	const milestone = block.match(/(?:Hito Actual|Milestone|Current Milestone):\s*([^\n]+)/i);
	if (milestone) state.milestone = milestone[1].trim();

	const sprint = block.match(/(?:Sprint Activo|Sprint|Active Sprint):\s*([^\n]+)/i);
	if (sprint) state.sprint = sprint[1].trim();

	const inProgress = block.match(/(?:En Progreso|In Progress|Working On):\s*([^\n]+)/i);
	if (inProgress) state.inProgress = inProgress[1].trim();

	const nextStep = block.match(/(?:Siguiente Paso|Next Step|Next):\s*([^\n]+)/i);
	if (nextStep) state.nextStep = nextStep[1].trim();

	return state;
}

/**
 * Extracts a Markdown section by heading.
 */
function extractSection(content: string, headingRegex: RegExp): string {
	const lines = content.split("\n");
	let capturing = false;
	const captured: string[] = [];

	for (const line of lines) {
		if (capturing) {
			if (/^#{1,3}\s+/.test(line)) {
				break;
			}
			captured.push(line);
		} else if (headingRegex.test(line)) {
			capturing = true;
		}
	}
	return captured.join("\n").trim();
}

/**
 * Scans and unifies production milestones, Architecture Decision Records (ADRs),
 * and Live Specs into a coherent timeline dataset.
 */
export function parseProductionTimeline(cwd: string): TimelineData {
	const root = findStudioRoot(cwd) || cwd;
	const items: TimelineItem[] = [];

	let milestonesCount = 0;
	let adrsCount = 0;
	let specsCount = 0;

	// ──────────────────────────────────────────────
	// 1. Source 1: Roadmap & Milestones (production/roadmap.md)
	// ──────────────────────────────────────────────
	const possibleRoadmaps = [
		join(root, "production", "roadmap.md"),
		join(root, "roadmap.md"),
		join(root, "docs", "roadmap.md"),
	];
	const targetRoadmap = possibleRoadmaps.find((p) => existsSync(p)) || join(root, "production", "roadmap.md");
	let rawProdState: Record<string, string> | undefined = undefined;

	if (existsSync(targetRoadmap)) {
		try {
			const roadmapContent = readFileSync(targetRoadmap, "utf8");
			rawProdState = parseProducerStateBlock(roadmapContent);
			const stat = statSync(targetRoadmap);
			const lines = roadmapContent.split("\n");

			interface RawMilestone {
				id: string;
				title: string;
				tasks: { title: string; status: "Completed" | "In Progress" | "Pending"; mark: string }[];
			}

			const parsedMilestones: RawMilestone[] = [];
			let currentMilestone: RawMilestone | null = null;

			for (const line of lines) {
				const trimmed = line.trim();
				// Milestone header: ### M0 — Visión, ## Hito 1: ..., etc.
				const mMatch = trimmed.match(/^#{2,3}\s+(M\d+[^#\n]*|Hito\s+\d+[^#\n]*)/i);
				if (mMatch) {
					if (currentMilestone) {
						parsedMilestones.push(currentMilestone);
					}
					const title = mMatch[1].trim();
					currentMilestone = {
						id: `m-${parsedMilestones.length}`,
						title,
						tasks: [],
					};
					continue;
				}

				// Task item under milestone
				const tMatch = trimmed.match(/^-\s*\[([ x/])\]\s*(.+)$/i);
				if (tMatch && currentMilestone) {
					const mark = tMatch[1].toLowerCase();
					const title = tMatch[2].trim();
					const status = mark === "x" ? "Completed" : mark === "/" ? "In Progress" : "Pending";
					currentMilestone.tasks.push({ title, status, mark });
				}
			}

			if (currentMilestone) {
				parsedMilestones.push(currentMilestone);
			}

			// Convert milestones and their tasks to timeline items
			for (let mIdx = 0; mIdx < parsedMilestones.length; mIdx++) {
				const m = parsedMilestones[mIdx];
				milestonesCount++;
				const total = m.tasks.length;
				const completed = m.tasks.filter((t) => t.status === "Completed").length;
				const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

				let icon = "○";
				let status = "Pending";
				if (progress === 100) {
					icon = "◉";
					status = "Completed";
				} else if (progress > 0) {
					icon = "◐";
					status = "In Progress";
				}

				items.push({
					id: m.id,
					type: "milestone",
					category: "Milestones",
					title: `${m.title} [${progress}%]`,
					status,
					progress,
					icon,
					sourceFile: targetRoadmap.replace(root + "/", ""),
					timestamp: stat.mtimeMs - (parsedMilestones.length - mIdx) * 1000,
					details: {
						summary: `Hito con ${completed}/${total} tareas completadas (${progress}%).`,
						producerState: rawProdState,
					},
				});

				// Sub-tasks with tree spine
				for (let tIdx = 0; tIdx < m.tasks.length; tIdx++) {
					const task = m.tasks[tIdx];
					const isLast = tIdx === m.tasks.length - 1;
					const treeSpine = isLast ? "└─ " : "├─ ";
					const taskIcon = task.status === "Completed" ? "✓" : task.status === "In Progress" ? "◐" : "○";

					items.push({
						id: `${m.id}-t${tIdx + 1}`,
						type: "task",
						category: "Milestones",
						title: task.title,
						status: task.status,
						icon: taskIcon,
						milestoneId: m.id,
						treeSpine,
						sourceFile: targetRoadmap.replace(root + "/", ""),
						timestamp: stat.mtimeMs,
						details: {
							summary: `Tarea de ${m.title}: ${task.title} (${task.status})`,
						},
					});
				}
			}
		} catch {}
	}

	// ──────────────────────────────────────────────
	// 2. Source 2: Architecture Decision Records (docs/architecture/adr-*.md)
	// ──────────────────────────────────────────────
	const archDir = join(root, "docs", "architecture");
	if (existsSync(archDir)) {
		try {
			const files = readdirSync(archDir).filter((f) => f.endsWith(".md"));
			for (const file of files) {
				const fullPath = join(archDir, file);
				const isAdrFile = file.toLowerCase().includes("adr") || file.toLowerCase().startsWith("adr-");

				try {
					const content = readFileSync(fullPath, "utf8");
					if (!isAdrFile && !content.includes("# ADR") && !content.includes("Decision")) {
						continue;
					}

					adrsCount++;
					const stat = statSync(fullPath);

					const titleMatch = content.match(/^#\s+(.+)$/m);
					const title = titleMatch ? titleMatch[1].trim() : file.replace(".md", "");

					const statusMatch = content.match(/(?:Status|Estado):\s*([^\n]+)/i);
					const status = statusMatch ? statusMatch[1].trim() : "Accepted";

					const dateMatch = content.match(/(?:Date|Fecha):\s*([^\n]+)/i);
					const date = dateMatch ? dateMatch[1].trim() : new Date(stat.mtimeMs).toISOString().split("T")[0];

					const context = extractSection(content, /^#{2,3}\s+(Context|Contexto)/i);
					const decision = extractSection(content, /^#{2,3}\s+(Decision|Decisión)/i);
					const consequences = extractSection(content, /^#{2,3}\s+(Consequences|Consecuencias)/i);
					const tradeoffs = extractSection(content, /^#{2,3}\s+(Trade-offs|Alternativas|Tradeoffs)/i);

					items.push({
						id: `adr-${file.replace(".md", "")}`,
						type: "adr",
						category: "ADRs",
						title,
						status,
						date,
						icon: "◈",
						sourceFile: join("docs", "architecture", file),
						timestamp: stat.mtimeMs,
						details: {
							context: context || "No se especificó contexto.",
							decision: decision || "Decisión registrada en arquitectura.",
							consequences: consequences || "Sin consecuencias documentadas.",
							tradeoffs: tradeoffs || undefined,
							rawContent: content,
						},
					});
				} catch {}
			}
		} catch {}
	}

	// ──────────────────────────────────────────────
	// 3. Source 3: Live Specs & Reviews (design/gdd/*.md)
	// ──────────────────────────────────────────────
	const gddDir = join(root, "design", "gdd");
	if (existsSync(gddDir)) {
		try {
			const files = readdirSync(gddDir).filter((f) => f.endsWith(".md"));
			for (const file of files) {
				const fullPath = join(gddDir, file);
				try {
					const content = readFileSync(fullPath, "utf8");
					specsCount++;
					const stat = statSync(fullPath);

					const titleMatch = content.match(/^#\s+(.+)$/m);
					const title = titleMatch ? titleMatch[1].trim() : `Spec: ${file.replace(".md", "")}`;

					const statusMatch = content.match(/(?:Status|Estado|Fase):\s*([^\n]+)/i);
					const status = statusMatch ? statusMatch[1].trim() : "Approved";

					const overview = extractSection(content, /^#{2,3}\s+(Overview|Resumen|Player Fantasy|Concept)/i);

					// Acceptance criteria list
					const criteriaSection = extractSection(content, /^#{2,3}\s+(Acceptance Criteria|Criterios de Aceptación)/i);
					const criteriaLines = criteriaSection
						.split("\n")
						.map((l) => l.trim())
						.filter((l) => l.startsWith("-") || l.startsWith("*"));

					// Tuning knobs
					const tuningSection = extractSection(content, /^#{2,3}\s+(Tuning Knobs|Variables de Balance)/i);
					const tuningLines = tuningSection
						.split("\n")
						.map((l) => l.trim())
						.filter((l) => l.startsWith("-") || l.startsWith("*"));

					items.push({
						id: `spec-${file.replace(".md", "")}`,
						type: "spec",
						category: "Specs",
						title,
						status,
						icon: "📄",
						sourceFile: join("design", "gdd", file),
						timestamp: stat.mtimeMs,
						details: {
							summary: overview || `Live Spec de ${file.replace(".md", "")}`,
							acceptanceCriteria: criteriaLines.length > 0 ? criteriaLines : undefined,
							tuningKnobs: tuningLines.length > 0 ? tuningLines : undefined,
							rawContent: content,
						},
					});
				} catch {}
			}
		} catch {}
	}

	return {
		items,
		producerState: rawProdState,
		milestonesCount,
		adrsCount,
		specsCount,
		totalCount: items.length,
	};
}

/**
 * Command handler for /studio:timeline and /timeline.
 */
export function handleStudioTimeline(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	return handleStudioTimelineViewer(args, ctx);
}
