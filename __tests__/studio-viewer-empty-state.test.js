const path = require("path");
const { execFileSync } = require("child_process");

// Pruning (issue #87) can empty the runner's task map, and the viewer keeps its
// own snapshot of that list, refreshed on every runner notification. Before this
// suite, all three renderers assumed at least one record existed: the live
// console, the split view and — the one a slip missed — the modal renderer threw
// instead of drawing. A renderer that throws on an empty list is a viewer crash
// the user reaches by waiting.
describe("Subagent viewer with no tasks", () => {
	const repoRoot = path.join(__dirname, "..");

	test("every renderer and the component draw a panel instead of throwing", () => {
		const script = `
			const viewer = await import("./extensions/hooks/studio-subagents-viewer.ts");

			const blank = (lines) => Array.isArray(lines) && lines.length > 0;

			const cases = [
				["liveConsole(undefined)", () => viewer.renderSubagentLiveConsoleView(undefined, 80)],
				["liveConsole(null)", () => viewer.renderSubagentLiveConsoleView(null, 90)],
				["modal(undefined)", () => viewer.renderSubagentModalView(undefined, 80)],
				["modal(undefined,{totalTasks:0})", () => viewer.renderSubagentModalView(undefined, 80, { totalTasks: 0 })],
				["split([],0)", () => viewer.renderSubagentSplitView([], 0, 84)],
			];

			for (const [name, render] of cases) {
				let lines = null;
				try {
					lines = render();
				} catch (error) {
					throw new Error("renderer " + name + " threw: " + error.message);
				}
				if (!blank(lines)) throw new Error("renderer " + name + " returned no lines");
				const text = lines.join("\\n");
				if (!/INSPECTOR DE ESPECIALISTA/i.test(text)) {
					throw new Error("renderer " + name + " lost the panel frame: " + text);
				}
				if (!/No hay subagentes/i.test(text)) {
					throw new Error("renderer " + name + " must say the list is empty: " + text);
				}
			}

			// The component refreshes its snapshot from the runner, so it must survive
			// the transition to an empty list rather than only being constructed empty.
			const tui = { requestRender() {}, terminal: { rows: 40, columns: 120 } };
			const component = new viewer.SubagentsViewerComponent([], tui, {}, () => {}, 0);
			for (const width of [80, 120]) {
				let rendered = null;
				try {
					rendered = component.render(width, 40);
				} catch (error) {
					throw new Error("component at width " + width + " threw: " + error.message);
				}
				if (!blank(rendered)) throw new Error("component at width " + width + " returned no lines");
			}
			component.dispose?.();
		`;

		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			});
		}).not.toThrow();
	});
});
