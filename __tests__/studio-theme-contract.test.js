const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Theme contract applied on screen (issue #115, T8). `palette.test.js` already
// fixes the contract these probes apply — semantic roles follow the host theme,
// the brand never does, `faint` never reroutes, and no theme keeps today's
// palette. What was missing is the wiring: the overlays and `/changes` imported
// raw colour constants and reverse video ignored `NO_COLOR`.
describe("Studio theme contract on screen", () => {
	const repoRoot = path.join(__dirname, "..");
	const hooksDir = path.join(repoRoot, "extensions", "hooks");

	const runScript = (script, env) =>
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
			env: env ? { ...process.env, ...env } : process.env,
		}).toString();

	test("the live theme role the footer publishes reaches /changes", () => {
		// A command handler never receives the theme handle, so an accepted `role`
		// parameter nobody passes is a dead capability. The footer publishes the
		// live role; the command reads it. This is the wiring, not the contract.
		runScript(`
			const p = await import("./extensions/hooks/studio-palette.ts");
			const changes = await import("./extensions/hooks/studio-changes.ts");
			const file = { path: "src/main.rs", status: "M", category: "CODE", additions: 52, deletions: 10 };
			const summary = { design: [], code: [file], dataAssets: [], production: [], config: [], other: [], driftWarnings: [] };

			p.setActiveThemeRole(undefined);
			const plain = changes.formatChangesOutput(summary, p.getActiveThemeRole()).join("\\n");
			if (!plain.includes(p.SUCCESS + "+52" + p.RESET)) {
				throw new Error("with no recorded role /changes must keep the studio palette");
			}

			const marker = (name) => (text) => "MARK:" + name + ":" + text;
			p.setActiveThemeRole({
				success: marker("success"), error: marker("error"), warn: marker("warn"),
				muted: marker("muted"), accent: marker("accent"), text: (t) => t, faint: (t) => t,
			});
			const themed = changes.formatChangesOutput(summary, p.getActiveThemeRole()).join("\\n");
			if (!/MARK:success:/.test(themed)) throw new Error("the role the footer publishes must reach /changes");
			// The card clips at 66 columns, so the error marker arrives as a prefix;
			// what matters is that the palette escape for deletions is gone.
			if (!/MARK:err/.test(themed)) throw new Error("the deletions must follow the error role");
			if (themed.includes(p.ERROR + "-10")) throw new Error("deletions still paint the studio palette");
			p.setActiveThemeRole(undefined);
		`);
	}, 60000);

	// Shared preamble: an ANSI stripper plus an assertion helper. Probes throw,
	// so the failure message names the invariant instead of a diff.
	const PRELUDE = `
		const plain = (s) => s.replace(/\\x1b\\[[0-9;]*m/g, "");
		const must = (cond, message) => { if (!cond) throw new Error(message); };
		const MARKER_THEME = { appearance: "dark", fg: undefined };
		const markerRole = (p) => p.resolveStudioTheme({
			appearance: "dark",
			fg: (token, text) => "MARKER:" + token + ":" + text,
		});
		// The /changes card is panelled and truncates by visible width, so its
		// probe needs a marker that does not inflate the row past the frame.
		const compactRole = (p) => p.resolveStudioTheme({
			appearance: "dark",
			fg: (token, text) => "<" + token + ">" + text,
		});
	`;

	describe("/changes follows the theme's semantic states", () => {
		test("figures, muted labels and drift warnings route through the role; the title keeps the brand", () => {
			runScript(`
				${PRELUDE}
				const p = await import("./extensions/hooks/studio-palette.ts");
				const changes = await import("./extensions/hooks/studio-changes.ts");
				must(p.COLORS_ENABLED, "the palette must be coloured for this probe to mean anything");

				const role = compactRole(p);
				const summary = {
					design: [{ path: "design/gdd/combat.md", status: "M", additions: 12, deletions: 3 }],
					code: [{ path: "src/combat.rs", status: "M", additions: 40, deletions: 7 }],
					dataAssets: [], production: [], config: [], other: [],
					driftWarnings: ["ALERTA DRIFT: código sin spec viva."],
				};
				const out = changes.renderChangesCard(summary, role).join("\\n");

				must(out.includes("<success>+52"), "/changes did not paint its additions through the theme: " + JSON.stringify(out));
				must(out.includes("<error>-10"), "/changes did not paint its deletions through the theme: " + JSON.stringify(out));
				must(out.includes("<warning>"), "/changes did not paint its drift warning through the theme");
				must(out.includes("<dim>"), "/changes did not paint its muted labels through the theme");

				must(!out.includes(p.SUCCESS), "/changes still carries the raw palette success escape");
				must(!out.includes(p.ERROR), "/changes still carries the raw palette error escape");
				must(!out.includes(p.WARNING), "/changes still carries the raw palette warning escape");
				must(!out.includes(p.MUTED), "/changes still carries the raw palette muted escape");

				// The brand never reroutes: the card title stays on the studio accent.
				must(
					out.includes(p.ACCENT + "CAMBIOS DEL ESTUDIO (STUDIO CHANGES)"),
					"/changes lost its studio accent title: " + JSON.stringify(plain(out)),
				);
				must(!out.includes("<accent>"), "/changes routed the brand accent through the theme");
			`);
		}, 60000);

		test("with no theme the card keeps today's palette exactly", () => {
			runScript(`
				${PRELUDE}
				const p = await import("./extensions/hooks/studio-palette.ts");
				const changes = await import("./extensions/hooks/studio-changes.ts");
				must(p.COLORS_ENABLED, "the palette must be coloured for this probe to mean anything");

				const summary = {
					design: [{ path: "design/gdd/combat.md", status: "M", additions: 12, deletions: 3 }],
					code: [{ path: "src/combat.rs", status: "M", additions: 40, deletions: 7 }],
					dataAssets: [], production: [], config: [], other: [], driftWarnings: [],
				};
				const out = changes.renderChangesCard(summary).join("\\n");

				must(out.includes(p.SUCCESS + "+52" + p.RESET), "/changes drifted from the palette success role: " + JSON.stringify(out));
				must(out.includes(p.ERROR + "-10" + p.RESET), "/changes drifted from the palette error role");
				must(out.includes(p.MUTED + "DESIGN" + p.RESET), "/changes drifted from the palette muted role");
				must(out.includes(p.ACCENT + "CAMBIOS DEL ESTUDIO (STUDIO CHANGES)" + p.RESET), "/changes lost the studio accent title");
			`);
		}, 60000);

		test("the card renderer reaches the live command path with the resolved role as its default", () => {
			const source = fs.readFileSync(path.join(hooksDir, "studio-changes.ts"), "utf8");
			expect(source).toMatch(/renderChangesCard\(\s*summary[^)]*role/);
			expect(source).toMatch(/formatChangesOutput\(\s*summary[^)]*role/);
		});
	});

	describe("reverse video honours NO_COLOR", () => {
		test("NO_COLOR removes the reverse escape like every other escape", () => {
			const off = runScript(
				`
					const p = await import("./extensions/hooks/studio-palette.ts");
					process.stdout.write(JSON.stringify({ text: p.reverse("x"), enabled: p.COLORS_ENABLED }));
				`,
				{ NO_COLOR: "1" },
			);
			const disabled = JSON.parse(off);
			expect(disabled.enabled).toBe(false);
			expect(disabled.text).toBe("x");
		}, 60000);

		test("with colour enabled the text is wrapped in reverse video", () => {
			const on = runScript(
				`
					const p = await import("./extensions/hooks/studio-palette.ts");
					process.stdout.write(JSON.stringify({ text: p.reverse("x"), enabled: p.COLORS_ENABLED }));
				`,
				{ NO_COLOR: "" },
			);
			const enabled = JSON.parse(on);
			expect(enabled.enabled).toBe(true);
			expect(enabled.text).toContain("\x1b[7m");
			expect(enabled.text).toContain("x");
			expect(enabled.text.replace(/\x1b\[[0-9;]*m/g, "")).toBe("x");
		}, 60000);

		test("reverse video has one owner: the palette module", () => {
			const files = fs.readdirSync(hooksDir).filter((f) => f.endsWith(".ts"));
			const offenders = files
				.filter((f) => f !== "studio-palette.ts")
				.filter((f) => /\\x1b\[7m/.test(fs.readFileSync(path.join(hooksDir, f), "utf8")));
			expect(offenders).toEqual([]);
		});
	});

	describe("overlays paint semantic states through the role", () => {
		// The timeline is the overlay used for the role probe: `renderTimelineSplitView`
		// is a pure exported renderer that takes its whole input as arguments, so the
		// role can be injected without constructing a TUI component.
		test("the timeline split view routes success, warning and muted through the role", () => {
			runScript(`
				${PRELUDE}
				const p = await import("./extensions/hooks/studio-palette.ts");
				const viewer = await import("./extensions/hooks/studio-timeline-viewer.ts");
				must(p.COLORS_ENABLED, "the palette must be coloured for this probe to mean anything");

				const role = markerRole(p);
				const items = [
					{
						id: "m0", type: "milestone", category: "Milestones", title: "M0 - Concepto",
						status: "Completed", icon: "\u25CF", sourceFile: "production/roadmap.md",
						progress: 100, treeSpine: "", details: { summary: "Visión inicial del juego." },
					},
					{
						id: "m1", type: "milestone", category: "Milestones", title: "M1 - Prototipo",
						status: "In Progress", icon: "\u25D0", sourceFile: "production/roadmap.md",
						progress: 40, treeSpine: "", details: { summary: "Prototipo jugable." },
					},
				];

				const completed = viewer.renderTimelineSplitView(items, 0, "All", 80, role).join("\\n");
				must(completed.includes("MARKER:success:"), "the completed badge never reached the theme: " + JSON.stringify(plain(completed)));
				must(completed.includes("MARKER:dim:"), "the timeline labels never reached the theme's muted role");
				must(!completed.includes(p.SUCCESS), "the timeline still carries the raw palette success escape");
				must(!completed.includes(p.MUTED), "the timeline still carries the raw palette muted escape");
				// Brand colours stay on the palette: the accent title is the studio's own.
				must(completed.includes(p.ACCENT), "the timeline lost the studio accent on its title");
				must(!completed.includes("MARKER:accent"), "the timeline routed the brand accent through the theme");

				const inProgress = viewer.renderTimelineSplitView(items, 1, "All", 80, role).join("\\n");
				must(inProgress.includes("MARKER:warning:"), "the in-progress state never reached the theme's warning role");
				must(!inProgress.includes(p.WARNING), "the timeline still carries the raw palette warning escape");
			`);
		}, 60000);

		test("the subagents split view routes a failed task through the error role", () => {
			runScript(`
				${PRELUDE}
				const p = await import("./extensions/hooks/studio-palette.ts");
				const viewer = await import("./extensions/hooks/studio-subagents-viewer.ts");
				must(p.COLORS_ENABLED, "the palette must be coloured for this probe to mean anything");

				const role = markerRole(p);
				const task = {
					id: "t-1", agent: "qa-verifier", title: "Verificación", status: "failed",
					model: "inherit", task: "Auditar el slice", logs: [], error: "assertion failed",
					startedAt: Date.now() - 1000, endedAt: Date.now(),
				};
				const out = viewer.renderSubagentSplitView([task], 0, 100, 30, 0, role).join("\\n");

				must(out.includes("MARKER:error:"), "the failed state never reached the theme's error role: " + JSON.stringify(plain(out)));
				must(out.includes("MARKER:dim:"), "the subagents labels never reached the theme's muted role");
				must(!out.includes(p.ERROR), "the subagents overlay still carries the raw palette error escape");
				must(!out.includes(p.MUTED), "the subagents overlay still carries the raw palette muted escape");
				must(out.includes(p.ACCENT), "the subagents overlay lost the studio accent on its title");
			`);
		}, 60000);
	});
});
