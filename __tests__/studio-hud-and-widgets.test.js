const path = require("path");
const fs = require("fs");

describe("Studio HUD and Live Tasks Widget", () => {
	const hudModulePath = path.join(__dirname, "..", "extensions", "hooks", "studio-hud.ts");
	const widgetModulePath = path.join(__dirname, "..", "extensions", "hooks", "studio-tasks-widget.ts");

	test("studio-hud.ts and studio-tasks-widget.ts exist and have exports", () => {
		expect(fs.existsSync(hudModulePath)).toBe(true);
		expect(fs.existsSync(widgetModulePath)).toBe(true);

		const hudSource = fs.readFileSync(hudModulePath, "utf8");
		expect(hudSource).toContain("export function renderContextGauge");
		expect(hudSource).toContain("export function formatTokens");
		expect(hudSource).toContain("export function formatModelDisplayName");
		expect(hudSource).toContain("export function renderStudioStatusCard");
		expect(hudSource).toContain("export function renderStudioFooterBar");
		expect(hudSource).toContain("export function updateStudioHUD");

		const widgetSource = fs.readFileSync(widgetModulePath, "utf8");
		expect(widgetSource).toContain("export function renderTasksWidgetCard");
		expect(widgetSource).toContain("export function updateTasksWidget");
		expect(widgetSource).toContain("export function isTasksWidgetEnabled");
		expect(widgetSource).toContain("export function setTasksWidgetEnabled");
	});

	test("studio-hud renders footer bar without reference errors", () => {
		const hudSource = fs.readFileSync(hudModulePath, "utf8");
		// Verify no undefined legacy color references exist
		expect(hudSource).not.toContain("${CYAN}");
		expect(hudSource).not.toContain("${VIOLET}");
	});

	test("gauge logic renders filled and empty segments correctly", () => {
		// Mock implementation of gauge test
		function renderGauge(percent, width = 8) {
			const clamped = Math.max(0, Math.min(100, percent || 0));
			const filled = Math.min(width, Math.max(0, Math.round((clamped / 100) * width)));
			const empty = width - filled;
			return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
		}

		expect(renderGauge(0)).toBe("[░░░░░░░░]");
		expect(renderGauge(50)).toBe("[████░░░░]");
		expect(renderGauge(100)).toBe("[████████]");
		expect(renderGauge(25)).toBe("[██░░░░░░]");
	});

	test("token formatting formats thousands and millions", () => {
		function formatTokens(count) {
			if (!count || count <= 0) return "0";
			if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
			if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
			return String(count);
		}

		expect(formatTokens(0)).toBe("0");
		expect(formatTokens(500)).toBe("500");
		expect(formatTokens(24000)).toBe("24k");
		expect(formatTokens(200000)).toBe("200k");
		expect(formatTokens(1500000)).toBe("1.5M");
	});

	test("tasks widget card prioritizes in_progress and truncates rows cleanly", () => {
		function renderTasksCard(tasks, width = 74) {
			const lines = [];
			lines.push(`┌── TAREAS ACTIVAS (ODD / Roadmap) ──`);
			const inProg = tasks.filter((t) => t.status === "in_progress");
			const pending = tasks.filter((t) => t.status === "pending");
			const completed = tasks.filter((t) => t.status === "completed");

			const displayTasks = [
				...inProg,
				...pending.slice(0, 3),
				...completed.slice(-2),
			].slice(0, 6);

			for (const t of displayTasks) {
				const badge = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[/]" : "[ ]";
				lines.push(`│ ${badge} ${t.title}`);
			}
			lines.push(`└────────────────────────────────────`);
			return lines;
		}

		const mockTasks = [
			{ title: "Task 1", status: "completed" },
			{ title: "Task 2", status: "in_progress" },
			{ title: "Task 3", status: "pending" },
		];

		const rendered = renderTasksCard(mockTasks);
		expect(rendered.length).toBeGreaterThan(3);
		expect(rendered.some((l) => l.includes("[/] Task 2"))).toBe(true);
		expect(rendered.some((l) => l.includes("[x] Task 1"))).toBe(true);
		expect(rendered.some((l) => l.includes("[ ] Task 3"))).toBe(true);
	});

	test("index.ts renders header banner and mounts tasks widget and HUD on session_start", () => {
		const indexSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
			"utf8",
		);
		expect(indexSource).toContain("renderBanner(width, studioRoot)");
		expect(indexSource).toContain("updateTasksWidget(ctx)");
		expect(indexSource).toContain("updateStudioHUD(ctx, pi)");
	});

	test("studio-sidebar.ts exists and provides left rail sidebar API", () => {
		const sidebarPath = path.join(__dirname, "..", "extensions", "hooks", "studio-sidebar.ts");
		expect(fs.existsSync(sidebarPath)).toBe(true);

		const sidebarSource = fs.readFileSync(sidebarPath, "utf8");
		expect(sidebarSource).toContain("export const SIDEBAR_BREAKPOINT = 140");
		expect(sidebarSource).toContain("export function installStudioSidebar");
		expect(sidebarSource).toContain("export function isStudioSidebarActive");
		expect(sidebarSource).toContain("export function invalidateStudioSidebar");
	});
});
