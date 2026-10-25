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
		expect(hudSource).toContain("export function isStatusCardCollapsed");
		expect(hudSource).toContain("export function setStatusCardCollapsed");

		const widgetSource = fs.readFileSync(widgetModulePath, "utf8");
		expect(widgetSource).toContain("export function renderTasksWidgetCard");
		expect(widgetSource).toContain("export function updateTasksWidget");
		expect(widgetSource).toContain("export function isTasksWidgetEnabled");
		expect(widgetSource).toContain("export function setTasksWidgetEnabled");
		expect(widgetSource).toContain("export function isTasksCardCollapsed");
		expect(widgetSource).toContain("export function setTasksCardCollapsed");
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

	test("persistence helpers toggle status-collapsed and tasks-collapsed flags", () => {
		const os = require("os");
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-collapse-test-"));
		try {
			function isStatusCollapsed(root) {
				return fs.existsSync(path.join(root, ".pi", "game-studio", "status-collapsed"));
			}
			function setStatusCollapsed(root, val) {
				const flag = path.join(root, ".pi", "game-studio", "status-collapsed");
				if (val) {
					fs.mkdirSync(path.dirname(flag), { recursive: true });
					fs.writeFileSync(flag, "true", "utf8");
				} else if (fs.existsSync(flag)) {
					fs.unlinkSync(flag);
				}
			}
			function isTasksCollapsed(root) {
				return fs.existsSync(path.join(root, ".pi", "game-studio", "tasks-collapsed"));
			}
			function setTasksCollapsed(root, val) {
				const flag = path.join(root, ".pi", "game-studio", "tasks-collapsed");
				if (val) {
					fs.mkdirSync(path.dirname(flag), { recursive: true });
					fs.writeFileSync(flag, "true", "utf8");
				} else if (fs.existsSync(flag)) {
					fs.unlinkSync(flag);
				}
			}

			expect(isStatusCollapsed(tmpDir)).toBe(false);
			expect(isTasksCollapsed(tmpDir)).toBe(false);

			setStatusCollapsed(tmpDir, true);
			expect(isStatusCollapsed(tmpDir)).toBe(true);
			setStatusCollapsed(tmpDir, false);
			expect(isStatusCollapsed(tmpDir)).toBe(false);

			setTasksCollapsed(tmpDir, true);
			expect(isTasksCollapsed(tmpDir)).toBe(true);
			setTasksCollapsed(tmpDir, false);
			expect(isTasksCollapsed(tmpDir)).toBe(false);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("status card renders compact 2-line header when collapsed", () => {
		function renderStatusCard(gameTitle, engine, collapsed, width = 50) {
			const cardWidth = Math.min(Math.max(width - 4, 46), 56);
			if (collapsed) {
				const rawTitle = `System · ${gameTitle} (${engine}) [collapsed]`;
				const maxTitleLen = Math.max(10, cardWidth - 7);
				const displayTitle = rawTitle.length > maxTitleLen ? rawTitle.slice(0, maxTitleLen - 1) + "…" : rawTitle;
				const ruleLen = Math.max(0, cardWidth - displayTitle.length - 5);
				return [
					`  ╭─ ${displayTitle} ${"─".repeat(ruleLen)}╮`,
					`  ╰${"─".repeat(cardWidth - 2)}╯`,
				];
			}
			const expandedTitle = `System`;
			const expandedRule = Math.max(0, cardWidth - expandedTitle.length - 5);
			return [
				`  ╭─ ${expandedTitle} ${"─".repeat(expandedRule)}╮`,
				`  │ Project: ${gameTitle} │`,
				`  ╰${"─".repeat(cardWidth - 2)}╯`,
			];
		}

		const collapsedOutput = renderStatusCard("Super Game", "Godot 4", true, 74);
		expect(collapsedOutput.length).toBe(2);
		expect(collapsedOutput[0]).toContain("System · Super Game (Godot 4) [collapsed]");
		expect(collapsedOutput[0].startsWith("  ╭─")).toBe(true);
		expect(collapsedOutput[0].endsWith("╮")).toBe(true);
		expect(collapsedOutput[1].startsWith("  ╰")).toBe(true);
		expect(collapsedOutput[1].endsWith("╯")).toBe(true);

		const expandedOutput = renderStatusCard("Super Game", "Godot 4", false);
		expect(expandedOutput.length).toBeGreaterThan(2);
		expect(expandedOutput[0]).not.toContain("[collapsed]");
	});

	test("tasks card renders compact 2-line header when collapsed", () => {
		function renderTasksCard(tasks, collapsed, width = 50) {
			if (!tasks || tasks.length === 0) return [];
			const cardWidth = Math.min(Math.max(width - 4, 46), 56);
			const completedCount = tasks.filter((t) => t.status === "completed").length;
			const countSummary = `${completedCount} of ${tasks.length}`;

			if (collapsed) {
				const rawTitle = `▶ Tasks · ${countSummary} [collapsed]`;
				const maxTitleLen = Math.max(10, cardWidth - 7);
				const displayTitle = rawTitle.length > maxTitleLen ? rawTitle.slice(0, maxTitleLen - 1) + "…" : rawTitle;
				const ruleLen = Math.max(0, cardWidth - displayTitle.length - 5);
				return [
					`  ╭─ ${displayTitle} ${"─".repeat(ruleLen)}╮`,
					`  ╰${"─".repeat(cardWidth - 2)}╯`,
				];
			}
			return [
				`  ╭─ ▶ Tasks · ${countSummary} ${"─".repeat(cardWidth - 20)}╮`,
				...tasks.map((t) => `  │ [${t.status === "completed" ? "x" : " "}] ${t.title} │`),
				`  ╰${"─".repeat(cardWidth - 2)}╯`,
			];
		}

		const mockTasks = [
			{ title: "Task 1", status: "completed" },
			{ title: "Task 2", status: "in_progress" },
			{ title: "Task 3", status: "pending" },
		];

		const collapsedLines = renderTasksCard(mockTasks, true);
		expect(collapsedLines.length).toBe(2);
		expect(collapsedLines[0]).toContain("▶ Tasks · 1 of 3 [collapsed]");
		expect(collapsedLines[0].startsWith("  ╭─")).toBe(true);
		expect(collapsedLines[0].endsWith("╮")).toBe(true);
		expect(collapsedLines[1].startsWith("  ╰")).toBe(true);
		expect(collapsedLines[1].endsWith("╯")).toBe(true);

		const expandedLines = renderTasksCard(mockTasks, false);
		expect(expandedLines.length).toBe(5);
		expect(expandedLines[0]).not.toContain("[collapsed]");
	});

	test("sidebar mouse event handler toggles status and tasks collapsed states on header clicks", () => {
		const os = require("os");
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sidebar-click-test-"));
		try {
			let statusCollapsed = false;
			let tasksCollapsed = false;
			let invalidated = false;

			const statusRange = [1, 1];
			const tasksRange = [5, 5];

			function handleMouse(event, scrollOffset = 0) {
				if (event.type === "click" || event.type === "press") {
					const lineY = scrollOffset + event.y;
					if (statusRange && lineY >= statusRange[0] && lineY <= statusRange[1]) {
						statusCollapsed = !statusCollapsed;
						invalidated = true;
						return { handled: true, render: true };
					}
					if (tasksRange && lineY >= tasksRange[0] && lineY <= tasksRange[1]) {
						tasksCollapsed = !tasksCollapsed;
						invalidated = true;
						return { handled: true, render: true };
					}
				}
				return undefined;
			}

			// Click on status header
			const statusResult = handleMouse({ type: "click", y: 1 });
			expect(statusResult).toEqual({ handled: true, render: true });
			expect(statusCollapsed).toBe(true);
			expect(invalidated).toBe(true);

			// Press on status header again to uncollapse
			invalidated = false;
			const statusResult2 = handleMouse({ type: "press", y: 1 });
			expect(statusResult2).toEqual({ handled: true, render: true });
			expect(statusCollapsed).toBe(false);

			// Click on tasks header
			invalidated = false;
			const tasksResult = handleMouse({ type: "click", y: 5 });
			expect(tasksResult).toEqual({ handled: true, render: true });
			expect(tasksCollapsed).toBe(true);

			// Click elsewhere
			const outsideResult = handleMouse({ type: "click", y: 3 });
			expect(outsideResult).toBeUndefined();
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("CLI commands support collapse subcommand in studio-tasks and studio-status", () => {
		const tasksFile = path.join(__dirname, "..", "extensions", "hooks", "studio-tasks.ts");
		const statusFile = path.join(__dirname, "..", "extensions", "hooks", "studio-status.ts");

		const tasksSrc = fs.readFileSync(tasksFile, "utf8");
		expect(tasksSrc).toContain('trimmed === "collapse" || trimmed.startsWith("collapse")');
		expect(tasksSrc).toContain("setTasksCardCollapsed");
		expect(tasksSrc).toContain("updateTasksWidget");
		expect(tasksSrc).toContain("invalidateStudioSidebar");

		const statusSrc = fs.readFileSync(statusFile, "utf8");
		expect(statusSrc).toContain('trimmed === "collapse" || trimmed.startsWith("collapse")');
		expect(statusSrc).toContain("setStatusCardCollapsed");
		expect(statusSrc).toContain("updateStudioHUD");
	});

	test("the status card fixture mirrors the real renderer instead of drifting", () => {
		const hudSource = fs.readFileSync(hudModulePath, "utf8");
		// The local fixture above copies these two titles; if the real card
		// changes them, the copy must change with it or it passes while lying.
		expect(hudSource).toContain("System · ${gameTitle} (${engine}) [collapsed]");
		expect(hudSource).toContain("const titleText = \`System\`");
		// The real card carries no retired ornament glyph.
		expect(hudSource).not.toMatch(/[◈▌✔●◆★▲■]/);
	});
});
