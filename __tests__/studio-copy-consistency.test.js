const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// The studio described itself three different ways on one screen: the banner
// said "8 Core + 1 Motor", the setup command said nine agents, the installer
// reported "OK (9 agentes activos)" and the docs say ten. An unconfigured
// project got three different engine labels depending on which line you read.
// A roster count is the first invariant the product asserts about itself, and a
// state with three names is three states.
describe("Copy consistency", () => {
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
		const studioRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-copy-"));
		const plain = (s) => s.replace(/\\x1b\\[[0-9;]*m/g, "");
	`;

	test("every banner layout names the roster the installer deploys", () => {
		runScript(`
			${PRELUDE}
			const banner = await import("./extensions/hooks/banner.ts");
			if (typeof banner.renderBanner !== "function") throw new Error("renderBanner must be exported");

			// A project with an engine declared is the case that matters: expectedAgents
			// is 8 core + 1 engine specialist + 1 verifier, and every layout must agree
			// on that number instead of restating a shape of its own.
			fs.writeFileSync(path.join(studioRoot, "project.yaml"), 'engine: "Bevy"');

			// Three layouts, three phrasings before this fix, and the narrow one still
			// claimed the pre-verifier shape. The count must be derived from setup.
			for (const width of [50, 80, 120]) {
				const text = plain(banner.renderBanner(width, studioRoot, undefined).join("\\n"));
				if (/\(8 Core \+ 1 Motor\)/.test(text)) {
					throw new Error("width " + width + " restates the stale roster shape: " + text);
				}
				const row = /AGENTS:[^\\n]*/.exec(text);
				if (!row) throw new Error("width " + width + " has no AGENTS row: " + text);
				if (!/\\b10\\b/.test(row[0])) {
					throw new Error("width " + width + " does not name the expected total: " + row[0]);
				}
			}
		`);
	}, 60000);

	test("no surface still counts nine agents", () => {
		const offenders = fs
			.readdirSync(hooksDir)
			.filter((f) => f.endsWith(".ts"))
			.filter((f) => {
				const source = fs.readFileSync(path.join(hooksDir, f), "utf8");
				return /9 agentes|los 9 |OK \(9 /.test(source);
			});
		expect(offenders).toEqual([]);
	});

	test("an unconfigured project gets one engine label on all three surfaces", () => {
		runScript(`
			${PRELUDE}
			const hud = await import("./extensions/hooks/studio-hud.ts");
			const expected = "Sin motor (/studio:setup)";

			const card = plain(hud.renderStudioStatusCard({ cwd: studioRoot }, studioRoot, 46).join("\\n"));
			if (!card.includes(expected)) throw new Error("status card label drifted: " + card);

			const footer = plain(hud.renderStudioFooterBar({}, { cwd: studioRoot }, 100));
			if (!footer.includes(expected)) throw new Error("footer label drifted: " + footer);

			let statusLine = "";
			hud.updateStudioHUD({
				cwd: studioRoot,
				hasUI: true,
				model: { id: "test-model" },
				ui: { setStatus: (_key, value) => { statusLine = value; }, setFooter() {}, setWidget() {} },
			});
			if (!statusLine.includes(expected)) {
				throw new Error("status line label drifted: " + statusLine);
			}
		`);
	}, 60000);

	test("the tasks card speaks one language", () => {
		runScript(`
			${PRELUDE}
			const widget = await import("./extensions/hooks/studio-tasks-widget.ts");
			const tasks = [
				{ id: "t1", title: "Uno", sourceFile: "design/gdd/combate.md", status: "completed", isStale: false },
				{ id: "t2", title: "Dos", sourceFile: "design/gdd/combate.md", status: "pending", isStale: false },
			];
			const text = plain(widget.renderTasksWidgetCard(tasks, 56, false, undefined).join("\\n"));
			if (!text.includes("1 de 2")) throw new Error("the count must read in Spanish: " + text);
			if (/\\d of \\d/.test(text)) throw new Error("the count still reads in English: " + text);
		`);
	}, 60000);
});
