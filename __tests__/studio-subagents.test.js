const path = require("path");
const fs = require("fs");

describe("Studio Subagents & Isolated Execution Engine", () => {
	const loaderPath = path.join(__dirname, "..", "extensions", "hooks", "studio-agent-loader.ts");
	const runnerPath = path.join(__dirname, "..", "extensions", "hooks", "studio-agents-runner.ts");
	const subagentsPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents.ts");
	const choicePath = path.join(__dirname, "..", "extensions", "hooks", "studio-choice.ts");
	const indexPath = path.join(__dirname, "..", "extensions", "hooks", "index.ts");

	test("subagent implementation files exist and export required contracts", () => {
		expect(fs.existsSync(loaderPath)).toBe(true);
		expect(fs.existsSync(runnerPath)).toBe(true);
		expect(fs.existsSync(subagentsPath)).toBe(true);
		expect(fs.existsSync(choicePath)).toBe(true);
		expect(fs.existsSync(indexPath)).toBe(true);

		const loaderSource = fs.readFileSync(loaderPath, "utf8");
		expect(loaderSource).toContain("export function loadAgentManifest");
		expect(loaderSource).toContain("export function listAvailableAgents");
		expect(loaderSource).toContain("export function getAgentTier");
		expect(loaderSource).toContain('"gameplay-programmer"');
		expect(loaderSource).not.toContain('"lead-programmer"');
		expect(loaderSource).not.toContain('"narrative-director"');
		expect(loaderSource).not.toContain('"release-manager"');
		expect(loaderSource).not.toContain('"localization-lead"');

		const runnerSource = fs.readFileSync(runnerPath, "utf8");
		expect(runnerSource).toContain("export class StudioAgentsRunner");
		expect(runnerSource).toContain("export const studioAgentsRunner");
		expect(runnerSource).toContain('"rpc"'); // Non-interactive isolated RPC execution

		const subagentsSource = fs.readFileSync(subagentsPath, "utf8");
		expect(subagentsSource).toContain("export function registerStudioSubagentTools");
		expect(subagentsSource).toContain('name: "subagent_run"');
		expect(subagentsSource).toContain('name: "subagent_list"');
		expect(subagentsSource).toContain('name: "subagent_status"');
		expect(subagentsSource).toContain('name: "subagent_result"');

		const choiceSource = fs.readFileSync(choicePath, "utf8");
		expect(choiceSource).toContain("export function registerAskUserQuestion");
		expect(choiceSource).toContain('name: "ask_user_question"');
		expect(choiceSource).not.toContain('name: "ask_user_choice"');

		const indexSource = fs.readFileSync(indexPath, "utf8");
		expect(indexSource).toContain("registerStudioSubagentTools(pi)");
		expect(indexSource).toContain("registerAskUserQuestion(pi)");
		expect(indexSource).toContain("Interactive Question Protocol (Mandatory Native Menus)");
	});

	test("frontmatter parser extracts YAML block from agent markdown files", () => {
		const sampleAgent = fs.readFileSync(
			path.join(__dirname, "..", "agents", "gameplay-programmer.md"),
			"utf8"
		);

		const match = sampleAgent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
		expect(match).not.toBeNull();
		const rawYaml = match[1];
		expect(rawYaml).toContain("name: gameplay-programmer");
		expect(rawYaml).toContain("tools:");
		expect(match[2].length).toBeGreaterThan(100);
	});

	test("subagent runner captures streaming logs and provides interactive viewer command", () => {
		const viewerPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-viewer.ts");
		expect(fs.existsSync(viewerPath)).toBe(true);

		const runnerSource = fs.readFileSync(runnerPath, "utf8");
		expect(runnerSource).toContain("logs: string[]");

		const viewerSource = fs.readFileSync(viewerPath, "utf8");
		expect(viewerSource).toContain("handleStudioSubagentsViewer");
		expect(viewerSource).toContain("INSPECTOR DE ESPECIALISTA");

		const indexSource = fs.readFileSync(indexPath, "utf8");
		expect(indexSource).toContain('registerCommand?.("studio:subagents"');
		expect(indexSource).toContain('registerCommand?.("studio:logs"');
	});

	test("subagent runner and index support immediate abort on Escape / interrupt", () => {
		const runnerSource = fs.readFileSync(runnerPath, "utf8");
		expect(runnerSource).toContain("cancel(");
		expect(runnerSource).toContain("cancelTask(");
		expect(runnerSource).toContain("cancelAll(");
		expect(runnerSource).toContain("abortHandler");

		const subagentsSource = fs.readFileSync(subagentsPath, "utf8");
		expect(subagentsSource).toContain("_signal");

		const indexSource = fs.readFileSync(indexPath, "utf8");
		expect(indexSource).toContain('"session_abort"');
		expect(indexSource).toContain('"turn_abort"');
		expect(indexSource).toContain("studioAgentsRunner.cancelAll");
	});

	test("subagent viewer supports history scrolling in split, modal and stream views with wheel and keys", () => {
		const viewerPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-viewer.ts");
		const viewerSource = fs.readFileSync(viewerPath, "utf8");

		// ScrollOffset support in views
		expect(viewerSource).toContain("scrollOffset: number = 0");
		expect(viewerSource).toContain("scrollOffset?: number");
		expect(viewerSource).toContain("clampedOffset");

		// Mouse wheel and click region handling
		expect(viewerSource).toContain("handleMouse(event: any)");
		expect(viewerSource).toContain('event?.type === "wheel"');
		expect(viewerSource).toContain("wheelDelta");

		// Extended navigation keys
		expect(viewerSource).toContain('"shift+up"');
		expect(viewerSource).toContain('"shift+down"');
		expect(viewerSource).toContain('"pageup"');
		expect(viewerSource).toContain('"pagedown"');
		expect(viewerSource).toContain('"home"');
		expect(viewerSource).toContain('"end"');
	});
});

describe("Runner enforces the specialist return contract", () => {
	const repoRoot = path.join(__dirname, "..");

	test("contract violation fails the task and preserves the raw report", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-runner-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);

			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = {
				name: "gameplay-programmer",
				title: "Gameplay Programmer",
				tier: "leads",
				model: "inherit",
				tools: ["read"],
				systemPrompt: "test",
			};
			const task = "Implementa el movimiento base.\\n\\n## Allowed edit surfaces\\n- src/";

			process.env.FAKE_RECEIPT = ["status: completed", "summary: Todo listo"].join("\\n");
			const bad = await studioAgentsRunner.run(manifest, task, tmp, "task");
			if (bad.status !== "failed") {
				throw new Error("contract violation should fail the task, got status: " + bad.status);
			}
			if (!/contrato|contract/i.test(bad.error || "")) {
				throw new Error("failure must name the contract violation, got: " + bad.error);
			}
			if (!(bad.result || "").includes("summary: Todo listo")) {
				throw new Error("raw specialist report must be preserved for the Producer");
			}

			process.env.FAKE_RECEIPT = [
				"status: completed",
				"summary: Movimiento base implementado",
				"files_changed:",
				"  - src/player.rs",
				"validation:",
				"  - cargo test -p game",
			].join("\\n");
			const good = await studioAgentsRunner.run(manifest, task, tmp, "task");
			if (good.status !== "completed") {
				throw new Error("valid contract should complete, got: " + good.status + " / " + good.error);
			}

			// The child must receive the declared edit surfaces, and stay unbounded without them.
			process.env.FAKE_ECHO_SURFACES = "1";
			const scoped = await studioAgentsRunner.run(manifest, task, tmp, "task");
			const scopedResult = scoped.result || "";
			if (scoped.status !== "completed") {
				throw new Error("scoped run should complete, got: " + scoped.status + " / " + scoped.error);
			}
			if (!scopedResult.includes("src/") || scopedResult.includes("<unset>")) {
				throw new Error("child did not receive the allowed edit surfaces: " + scopedResult);
			}

			const unscoped = await studioAgentsRunner.run(manifest, "Implementa el movimiento base.", tmp, "task");
			if (!(unscoped.result || "").includes("<unset>")) {
				throw new Error("undisclosed surfaces must stay unbounded: " + unscoped.result);
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
			});
		}).not.toThrow();
	}, 30000);
});
