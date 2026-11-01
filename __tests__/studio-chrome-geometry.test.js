const path = require("path");
const { execFileSync } = require("child_process");

// Chrome geometry (issues #111, #112). A frame whose header, body and rule each
// pick a different width stops reading as a frame, and a widget that renders
// past the width it was handed is clipped by the host rather than by itself.
// These probes measure visible columns (ANSI stripped) on the real renderers.
describe("Studio chrome geometry", () => {
	const repoRoot = path.join(__dirname, "..");

	const runScript = (script) =>
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		});

	// Shared preamble: an ANSI stripper that measures columns, not bytes.
	const PRELUDE = `
		const plain = (s) => s.replace(/\\x1b\\[[0-9;]*m/g, "");
		const widthOf = (s) => plain(s).length;
	`;

	describe("timeline split view frame", () => {
		test("header, mid rule, body and bottom share one visible width at 76, 100 and 140", () => {
			runScript(`
				${PRELUDE}
				const viewer = await import("./extensions/hooks/studio-timeline-viewer.ts");

				const items = [
					{
						id: "m0", type: "milestone", category: "Milestones",
						title: "M0 — Concepto", status: "Completed", icon: "●",
						sourceFile: "production/roadmap.md", progress: 100, treeSpine: "",
						details: {
							summary: "Visión inicial del juego y pilares.",
							producerState: {
								gameTitle: "Nordic Drift", engine: "Bevy",
								milestone: "M0 — Concepto", sprint: "Sprint 1",
								nextStep: "Diseñar el bucle principal",
							},
						},
					},
					{
						id: "adr-1", type: "adr", category: "ADRs",
						title: "ADR-001: ECS con Bevy frente a un bucle manual",
						status: "Accepted", icon: "◆", sourceFile: "design/architecture/adr-001.md",
						treeSpine: "├─ ",
						details: {
							context: "Necesitamos un modelo de datos cache-friendly.",
							decision: "Adoptar el ECS de Bevy.",
							consequences: "El gameplay se expresa como sistemas.",
							tradeoffs: "Curva de aprendizaje frente a rendimiento.",
						},
					},
					{
						id: "spec-1", type: "spec", category: "Specs",
						title: "Live Spec: Dash y esquiva", status: "Approved", icon: "◇",
						sourceFile: "design/gdd/dash.md", treeSpine: "",
						details: {
							summary: "El dash responde en el mismo frame y no cancela el ataque.",
							acceptanceCriteria: ["El dash responde en 1 frame", "Cooldown visible en HUD"],
							tuningKnobs: ["dash_cooldown_s: 0.35", "dash_distance_m: 4"],
						},
					},
				];

				for (const width of [76, 100, 140]) {
					const lines = viewer.renderTimelineSplitView(items, 0, "All", width);
					// The last line is the navigation hint, not part of the frame.
					const frame = lines.slice(0, -1);
					const widths = frame.map(widthOf);
					const unique = [...new Set(widths)];
					if (unique.length !== 1) {
						throw new Error(
							"timeline frame at width " + width + " has " + unique.length +
							" widths (" + unique.join("/") + "):\\n" +
							frame.map((l, i) => "  " + i + " [" + widthOf(l) + "] " + plain(l)).join("\\n"),
						);
					}
				}
			`);
		}, 60000);

		test("the frame fits the surface it was handed instead of overflowing by its border", () => {
			runScript(`
				${PRELUDE}
				const viewer = await import("./extensions/hooks/studio-timeline-viewer.ts");
				const items = [
					{
						id: "m0", type: "milestone", category: "Milestones",
						title: "M0 - Concepto", status: "Completed", icon: "*",
						sourceFile: "production/roadmap.md", progress: 100, treeSpine: "",
						details: { summary: "Vision inicial." },
					},
				];

				// The split view declares a 76-column minimum; above it the frame must fit
				// the surface exactly, because a frame one column wider than the terminal
				// wraps and the box breaks at the edge.
				for (const width of [76, 80, 100, 140]) {
					const lines = viewer.renderTimelineSplitView(items, 0, "All", width);
					const frameWidth = widthOf(lines[0]);
					if (frameWidth !== Math.max(76, width)) {
						throw new Error("frame at width " + width + " renders " + frameWidth + " columns");
					}
				}
			`);
		}, 60000);
	});

	describe("footer bar", () => {
		test("a long engine name never renders past the width it was given", () => {
			runScript(`
				${PRELUDE}
				const fs = await import("node:fs");
				const os = await import("node:os");
				const path = await import("node:path");
				const hud = await import("./extensions/hooks/studio-hud.ts");

				const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-geometry-"));
				fs.writeFileSync(
					path.join(root, "project.yaml"),
					"engine: Unreal Engine 5.5 (source build, custom toolchain)\\n",
				);

				const ctx = {
					cwd: root,
					model: { id: "openrouter/deepseek-r1-distill-llama-70b-instruct-free-preview" },
				};

				for (const width of [40, 60, 80]) {
					const line = hud.renderStudioFooterBar({}, ctx, width);
					const visible = widthOf(line);
					if (visible > width) {
						throw new Error(
							"footer rendered " + visible + " columns at width " + width + ": " + plain(line),
						);
					}
				}
			`);
		}, 60000);
	});

	describe("command palette overlay", () => {
		test("a narrow terminal never receives a line wider than itself", () => {
			runScript(`
				${PRELUDE}
				const overlay = await import("./extensions/hooks/studio-palette-overlay.ts");

				const tui = { requestRender() {} };
				const component = new overlay.CommandPaletteOverlayComponent(
					tui, {}, () => {}, { cwd: process.cwd() },
				);

				for (const width of [40, 60, 80]) {
					const lines = component.render(width);
					for (const line of lines) {
						if (widthOf(line) > width) {
							throw new Error(
								"overlay rendered " + widthOf(line) + " columns at width " + width +
								": " + plain(line),
							);
						}
					}
				}
			`);
		}, 60000);
	});

	describe("/changes card idiom", () => {
		const SUMMARY = `
			const summary = {
				design: [{ path: "design/gdd/combat.md", status: "M", category: "DESIGN", additions: 12, deletions: 3 }],
				code: [{ path: "src/combat.rs", status: "M", category: "CODE", additions: 40, deletions: 7 }],
				dataAssets: [], production: [], config: [], other: [], driftWarnings: [],
			};
			const clean = {
				design: [], code: [], dataAssets: [], production: [], config: [], other: [], driftWarnings: [],
			};
		`;

		test("renders one rounded, coloured card and still lists the changed files", () => {
			runScript(`
				${PRELUDE}
				const changes = await import("./extensions/hooks/studio-changes.ts");
				${SUMMARY}

				const out = changes.formatChangesOutput(summary).join("\\n");

				if (!out.includes("\\u256d")) throw new Error("/changes lost the rounded card idiom:\\n" + plain(out));
				if (out.includes("\\u250c")) throw new Error("/changes still draws the square idiom:\\n" + plain(out));
				if (!/\\x1b\\[[0-9;]*m/.test(out)) throw new Error("/changes card carries no colour escape");
				if (!out.includes("design/gdd/combat.md")) throw new Error("/changes dropped a design file path");
				if (!out.includes("src/combat.rs")) throw new Error("/changes dropped a code file path");
			`);
		}, 60000);

		test("a clean tree is still reported", () => {
			runScript(`
				${PRELUDE}
				const changes = await import("./extensions/hooks/studio-changes.ts");
				${SUMMARY}

				const out = changes.formatChangesOutput(clean).join("\\n");
				if (!/limpio/i.test(plain(out))) throw new Error("/changes stopped reporting a clean tree:\\n" + plain(out));
				if (!out.includes("\\u256d")) throw new Error("the clean-tree case must still draw the studio card");
			`);
		}, 60000);

		test("the exported card renderer is reachable from the live command path", () => {
			const fs = require("fs");
			const source = fs.readFileSync(
				path.join(repoRoot, "extensions", "hooks", "studio-changes.ts"),
				"utf8",
			);
			const calls = source.match(/renderChangesCard\s*\(/g) || [];
			// One definition, at least one real call.
			expect(calls.length).toBeGreaterThan(1);
		});
	});
});
