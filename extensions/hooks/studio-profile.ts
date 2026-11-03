import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { findStudioRoot } from "./studio-root.ts";

export interface PerfBudget {
	targetFps: number;
	maxMemoryMb: number;
	maxFrameTimeMs: number;
}

/**
 * A measured metric is a `number`; an unmeasured one is `null`. There is no
 * "estimated" member on purpose: the studio can read resident memory from
 * outside the game process, but it cannot read a frame rate from there. A null
 * fps is the difference between "not measured" and "measured as 60", and only
 * one of those is a lie.
 */
export interface LivePerfMetrics {
	engine: string;
	fps: number | null;
	frameTimeMs: number | null;
	memoryMb: number | null;
	status: "OK" | "WARNING" | "CRITICAL" | "UNKNOWN";
	alerts: string[];
}

let activeMetrics: LivePerfMetrics | null = null;

export function getActivePerfMetrics(): LivePerfMetrics | null {
	return activeMetrics;
}

export function setActivePerfMetrics(metrics: LivePerfMetrics | null): void {
	activeMetrics = metrics;
}

export function auditPerformanceBudgets(studioRoot: string): PerfBudget {
	return {
		targetFps: 60,
		maxMemoryMb: 256,
		maxFrameTimeMs: 16.6,
	};
}

/**
 * Maps `ps` output to metrics without inventing anything. `RSS` is the sixth
 * column of the default `ps aux` layout (index 5). No matching process means no
 * memory value, and an aborted or malformed parse counts as no match.
 */
export function measurePerfMetrics(psOutput: string, budget: PerfBudget): LivePerfMetrics {
	const lines = (psOutput || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	let memoryMb: number | null = null;
	if (lines.length > 0) {
		const rssKb = Number.parseInt(lines[0].split(/\s+/)[5] || "", 10);
		if (Number.isFinite(rssKb) && rssKb > 0) {
			memoryMb = Math.round(rssKb / 1024);
		}
	}

	const alerts: string[] = [];
	if (memoryMb !== null && memoryMb > budget.maxMemoryMb) {
		alerts.push(`Memoria superada (${memoryMb}MB > ${budget.maxMemoryMb}MB)`);
	}

	const status: LivePerfMetrics["status"] =
		alerts.length > 0 ? "WARNING" : memoryMb === null ? "UNKNOWN" : "OK";

	return {
		engine: "Active Engine",
		fps: null,
		frameTimeMs: null,
		memoryMb,
		status,
		alerts,
	};
}

export async function handleStudioProfile(args: string, ctx: ExtensionContext): Promise<void> {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const budget = auditPerformanceBudgets(studioRoot);

	// The sample is awaited: the command must not resolve before it has measured
	// anything, and its report must exist by the time it returns.
	const processSample = await new Promise<string>((resolve) => {
		exec("ps aux | grep -iE 'godot|bevy|raylib|main' | grep -v grep | head -n 3", (err, stdout) => {
			resolve(err ? "" : stdout || "");
		});
	});

	const metrics = measurePerfMetrics(processSample, budget);
	setActivePerfMetrics(metrics);

	const memoryDisplay = metrics.memoryMb === null ? "n/d (sin proceso del juego)" : `${metrics.memoryMb} MB`;
	const fpsDisplay = metrics.fps === null ? "n/d (el juego no reporta telemetría)" : `${metrics.fps} FPS`;
	const statusDisplay =
		metrics.status === "OK"
			? "DENTRO DE PRESUPUESTO"
			: metrics.status === "UNKNOWN"
				? "SIN MEDICIÓN"
				: "ALERTA DE RENDIMIENTO";

	const report = [
		"LIVE PERFORMANCE & BUDGET TRACKER",
		"──────────────────────────────────────────────",
		`Presupuesto FPS:   ${budget.targetFps} FPS (${budget.maxFrameTimeMs}ms por frame)`,
		`Presupuesto Mem:   ${budget.maxMemoryMb} MB (Actual: ${memoryDisplay})`,
		`FPS medido:        ${fpsDisplay}`,
		`Estado General:    ${statusDisplay}`,
	];

	if (metrics.alerts.length > 0) {
		report.push("──────────────────────────────────────────────");
		metrics.alerts.forEach((a) => report.push(`[!] ${a}`));
	}

	const text = report.join("\n");
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(text, metrics.status === "OK" ? "info" : "warning");
	} else {
		console.log(`\n${text}\n`);
	}
}
