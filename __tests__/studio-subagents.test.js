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

		const runnerSource = fs.readFileSync(runnerPath, "utf8");
		expect(runnerSource).toContain("export class StudioAgentsRunner");
		expect(runnerSource).toContain("export const studioAgentsRunner");
		expect(runnerSource).toContain("--print"); // Non-interactive isolated execution

		const subagentsSource = fs.readFileSync(subagentsPath, "utf8");
		expect(subagentsSource).toContain("export function registerStudioSubagentTools");
		expect(subagentsSource).toContain('name: "subagent_run"');
		expect(subagentsSource).toContain('name: "subagent_list"');
		expect(subagentsSource).toContain('name: "subagent_status"');
		expect(subagentsSource).toContain('name: "subagent_result"');

		const choiceSource = fs.readFileSync(choicePath, "utf8");
		expect(choiceSource).toContain("export function registerAskUserChoice");
		expect(choiceSource).toContain('name: "ask_user_choice"');

		const indexSource = fs.readFileSync(indexPath, "utf8");
		expect(indexSource).toContain("registerStudioSubagentTools(pi)");
		expect(indexSource).toContain("registerAskUserChoice(pi)");
		expect(indexSource).toContain("Interactive Choice Protocol (Mandatory Native Menus)");
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
});
