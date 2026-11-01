const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Three chrome defects that share one root cause: no single owner.
//
// #109 — the rail rendered all three cards without the theme role, so the same
// card changed colour with the window width while the dock followed the theme.
// #110 — the subagents card had two renderers (footer and widget), two recency
// thresholds (60s and 45s) and painted `interaction_required` as if it were
// merely queued.
// #113 — the widget subscribed to the runner on every turn and never released.
describe("Studio chrome ownership", () => {
	const repoRoot = path.join(__dirname, "..");
	const hooksDir = path.join(repoRoot, "extensions", "hooks");

	const runScript = (script) =>
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		});

	const PRELUDE = `
		const fs = await import("node:fs");
		const os = await import("node:os");
		const path = await import("node:path");
		const p = await import("./extensions/hooks/studio-palette.ts");
		const studioRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-rail-"));
		const ctx = { cwd: studioRoot, model: { id: "test-model" } };
		const strip = (s) => s.replace(/\\x1b\\[[0-9;]*m/g, "");
	`;

	test("the rail routes every card through the theme role it was given", () => {
		runScript(`
			${PRELUDE}
			const rail = await import("./extensions/hooks/studio-sidebar.ts");
			if (typeof rail.renderRailCards !== "function") {
				throw new Error("renderRailCards must be exported so the rail's colour routing is testable");
			}

			// A marker role proves routing without depending on any hex value.
			let calls = [];
			const marker = (name) => (text) => { calls.push(name); return "MARK:" + name + ":" + text; };
			const role = {
				success: marker("success"), error: marker("error"), warn: marker("warn"), muted: marker("muted"),
				accent: marker("accent"), text: marker("text"), faint: marker("faint"),
			};

			const cards = rail.renderRailCards(ctx, studioRoot, 46, role);
			const joined = [...cards.status, ...cards.tasks, ...cards.subagents].join("\\n");

			if (!/MARK:accent:/.test(joined)) {
				throw new Error("the rail must paint card titles through the role, got: " + JSON.stringify(joined.slice(0, 200)));
			}
			if (calls.length === 0) throw new Error("the role was never called by the rail");

			// The default palette must not leak into a themed rail: these four
			// escapes are exactly what a missing role argument produces.
			for (const [name, escape] of [["TEXT", p.TEXT], ["ACCENT", p.ACCENT], ["MUTED", p.MUTED], ["SUCCESS", p.SUCCESS]]) {
				if (joined.includes(escape)) {
					throw new Error("the rail fell back to the studio palette for " + name + " despite a role being passed");
				}
			}
		`);
	}, 60000);

	test("a finished task leaves the card when the widget drops it, not 15 seconds later", () => {
		runScript(`
			${PRELUDE}
			const widget = await import("./extensions/hooks/studio-subagents-widget.ts");
			const now = Date.now();
			const task = (endedAgoMs) => ({
				id: "t1", agent: "bevy-specialist", task: "build", status: "completed",
				startedAt: now - endedAgoMs - 5000, endedAt: now - endedAgoMs,
				latestActivity: "listo", model: "inherit", cwd: studioRoot,
			});

			const inside = widget.renderSubagentsWidgetCard([task(40000)], 74);
			if (inside.length === 0) throw new Error("a task ended 40s ago must still be shown");

			const outside = widget.renderSubagentsWidgetCard([task(50000)], 74);
			if (outside.length !== 0) {
				throw new Error("a task ended 50s ago must be gone: the card and the widget cannot use different windows");
			}

			// The threshold is one exported constant, not two literals.
			if (typeof widget.SUBAGENTS_RECENT_WINDOW_MS !== "number") {
				throw new Error("SUBAGENTS_RECENT_WINDOW_MS must be exported as the single window");
			}
			if (widget.SUBAGENTS_RECENT_WINDOW_MS >= 60000) {
				throw new Error("the unified window must be the widget's 45s, not the card's 60s");
			}
		`);
	}, 60000);

	test("interaction_required gets its own badge instead of reading as queued", () => {
		runScript(`
			${PRELUDE}
			const widget = await import("./extensions/hooks/studio-subagents-widget.ts");
			const now = Date.now();
			const lines = widget.renderSubagentsWidgetCard([{
				id: "t2", agent: "game-designer", task: "decidir alcance", status: "interaction_required",
				startedAt: now - 3000, latestActivity: "necesita una decisión", model: "inherit", cwd: studioRoot,
			}], 74);
			const text = lines.map(strip).join("\\n");
			if (/EN COLA/.test(text)) throw new Error("a blocking request must not read as queued: " + text);
			if (!/RESPUESTA|DECISI[OÓ]N/i.test(text)) throw new Error("the badge must name the request: " + text);
		`);
	}, 60000);

	test("the subagents widget subscribes once and says so", () => {
		runScript(`
			const widget = await import("./extensions/hooks/studio-subagents-widget.ts");
			const ctx = { hasUI: true, cwd: process.cwd(), ui: { setWidget() {} } };
			const first = widget.installSubagentsWidget(ctx);
			const second = widget.installSubagentsWidget(ctx);
			const third = widget.installSubagentsWidget(ctx);
			if (first !== true) throw new Error("the first install must subscribe and report it, got " + first);
			if (second !== false || third !== false) {
				throw new Error("later installs must be no-ops: " + [first, second, third].join(","));
			}
		`);
	}, 60000);

	test("the footer does not own the subagents card any more", () => {
		const footer = fs.readFileSync(path.join(hooksDir, "studio-hud.ts"), "utf8");
		// One card, one owner: the widget gates on the rail and renders it. A second
		// renderer in the footer is what produced the doubled card below 140 columns.
		expect(footer).not.toContain("renderSubagentsWidgetCard");
	});
});
