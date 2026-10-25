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

describe("Runner forwards the declared reasoning budget", () => {
	const repoRoot = path.join(__dirname, "..");

	test("directors run at high and leads at medium, as their templates declare", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-thinking-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);

			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_ECHO_ARGV = "1";
			process.env.FAKE_RECEIPT = [
				"status: completed",
				"summary: ok",
				"files_changed:",
				"  - src/a.rs",
			].join("\\n");

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const base = { tier: "director", model: "inherit", tools: ["read"], systemPrompt: "test" };

			const director = await studioAgentsRunner.run(
				{ ...base, name: "creative-director", title: "Creative Director", thinking: "high" },
				"Define el pilar de combate.",
				tmp,
				"task",
			);
			if (!(director.result || "").includes("ARGV=")) {
				throw new Error("child did not report its argv: " + director.result);
			}
			if (!(director.result || "").includes("--thinking high")) {
				throw new Error("director did not receive --thinking high: " + /ARGV=(.*)/.exec(director.result || "")?.[1]);
			}

			const lead = await studioAgentsRunner.run(
				{ ...base, name: "gameplay-programmer", title: "Gameplay Programmer", tier: "lead", thinking: "medium" },
				"Implementa el movimiento.",
				tmp,
				"task",
			);
			if (!(lead.result || "").includes("--thinking medium")) {
				throw new Error("lead did not receive --thinking medium: " + /ARGV=(.*)/.exec(lead.result || "")?.[1]);
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], { cwd: repoRoot });
		}).not.toThrow();
	}, 30000);
});

describe("Thinking level vocabulary", () => {
	test("unknown or missing values normalize to the tier default", () => {
		const script = `
			const { resolveThinkingLevel } = await import("./extensions/hooks/studio-agent-loader.ts");

			const cases = [
				["hight", "director", "high"],      // typo must not reach the child
				["max", "lead", "max"],             // wide Pi vocabulary is preserved
				[undefined, "lead", "medium"],
				["", "specialist", "medium"],
			];
			for (const [raw, tier, expected] of cases) {
				const got = resolveThinkingLevel(raw, tier);
				if (got !== expected) throw new Error("resolveThinkingLevel(" + raw + ", " + tier + ") = " + got + ", expected " + expected);
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	});
});

describe("Runner correlates the prompt response and the settlement flag", () => {
	const repoRoot = path.join(__dirname, "..");

	function scenario(body) {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-prompt-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "gameplay-programmer", title: "GP", tier: "lead", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };
			const started = Date.now();
			// Short watchdog: without response correlation the task can only end by timeout.
			const record = await studioAgentsRunner.run(manifest, "Implementa el movimiento.", tmp, "task", undefined, 3000);
			const elapsed = Date.now() - started;

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(tmp, { recursive: true, force: true });
			${body}
		`;
		const { execFileSync } = require("child_process");
		return () => execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			env: { ...process.env },
		});
	}

	test("a rejected prompt fails the task immediately, naming the rejection", () => {
		process.env.FAKE_PROMPT_REJECT = "prompt rejected: agent busy";
		try {
			expect(scenario(`
				if (record.status !== "failed") throw new Error("rejected prompt should fail, got: " + record.status);
				if (!/agent busy|rechaz/i.test(record.error || "")) throw new Error("error must name the rejection, got: " + record.error);
				if (elapsed > 2500) throw new Error("must resolve on the response, not the watchdog; took " + elapsed + "ms");
			`)).not.toThrow();
		} finally {
			delete process.env.FAKE_PROMPT_REJECT;
		}
	}, 30000);

	test("an aborted settlement is reported as cancelled, not completed", () => {
		process.env.FAKE_SETTLED_ABORTED = "1";
		try {
			expect(scenario(`
				if (record.status !== "cancelled") throw new Error("aborted settlement should cancel the task, got: " + record.status);
			`)).not.toThrow();
		} finally {
			delete process.env.FAKE_SETTLED_ABORTED;
		}
	}, 30000);
});

describe("Studio tool registration is observable", () => {
	const repoRoot = path.join(__dirname, "..");
	const run = (body) => {
		const { execFileSync } = require("child_process");
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", body], { cwd: repoRoot });
	};

	test("a tool provided by another provider is skipped AND reported, not silently dropped", () => {
		expect(() => run(`
			const { registerStudioSubagentTools, getStudioToolRegistrations } =
				await import("./extensions/hooks/studio-subagents.ts");

			const registered = [];
			const fakePi = {
				getAllTools: () => [{ name: "subagent_run" }],
				registerTool: (t) => { registered.push(t.name); },
			};
			registerStudioSubagentTools(fakePi);

			if (registered.includes("subagent_run")) throw new Error("subagent_run was registered twice");
			if (!registered.includes("subagent_list")) throw new Error("non-conflicting tools must still register");

			const regs = getStudioToolRegistrations();
			const run = regs.find((r) => r.name === "subagent_run");
			if (!run) throw new Error("the skipped tool left no record: it is still silent");
			if (run.status !== "skipped") throw new Error("expected skipped, got " + run.status);
			if (!run.reason) throw new Error("a skip must carry a reason");
		`)).not.toThrow();
	}, 30000);

	test("a registration failure is recorded with its message instead of being swallowed", () => {
		expect(() => run(`
			const { registerStudioSubagentTools, getStudioToolRegistrations } =
				await import("./extensions/hooks/studio-subagents.ts");

			const fakePi = {
				getAllTools: () => [],
				registerTool: () => { throw new Error("host refused registration"); },
			};
			registerStudioSubagentTools(fakePi);

			const regs = getStudioToolRegistrations();
			const failed = regs.filter((r) => r.status === "failed");
			if (failed.length < 4) throw new Error("expected every studio tool to fail, got " + failed.length);
			if (regs.some((r) => r.status !== "failed")) {
				throw new Error("a throwing registerTool must mark every tool failed, got: " + JSON.stringify(regs));
			}
			if (!/host refused registration/.test(failed[0].reason || "")) {
				throw new Error("the failure message was lost: " + failed[0].reason);
			}
		`)).not.toThrow();
	}, 30000);

	test("diagnostics stay quiet when every tool registered, and name the culprit when not", () => {
		expect(() => run(`
			const mod = await import("./extensions/hooks/studio-subagents.ts");

			mod.registerStudioSubagentTools({ getAllTools: () => [], registerTool: () => {} });
			const quiet = mod.formatStudioToolDiagnostics();
			if (quiet.length !== 0) throw new Error("clean registration must not warn: " + quiet.join(" / "));
		`)).not.toThrow();

		expect(() => run(`
			const mod = await import("./extensions/hooks/studio-subagents.ts");
			mod.registerStudioSubagentTools({ getAllTools: () => [{ name: "subagent_run" }], registerTool: () => {} });
			const loud = mod.formatStudioToolDiagnostics();
			if (loud.length === 0) throw new Error("a skipped tool must produce a diagnostic");
			const text = loud.join(" ");
			if (!text.includes("subagent_run")) throw new Error("the diagnostic must name the tool: " + text);
			if (!text.includes("/studio:doctor")) throw new Error("the diagnostic must say where to look: " + text);
		`)).not.toThrow();
	}, 30000);
});

describe("Split view paging", () => {
	test("the split view pages the log window instead of throwing", () => {
		const script = `
			const { renderSubagentSplitView } = await import("./extensions/hooks/studio-subagents-viewer.ts");

			const logs = Array.from({ length: 60 }, (_, i) => "event line " + i);
			const task = {
				id: "t1", agent: "bevy-specialist", title: "run", task: "t", mode: "task", cwd: ".",
				status: "running", result: null, error: null, startedAt: Date.now(), endedAt: null, logs,
			};

			const bottom = renderSubagentSplitView([task], 0, 100, 30, 0);
			if (!Array.isArray(bottom) || bottom.length === 0) throw new Error("no lines rendered");
			if (!bottom.join("\\n").includes("event line 59")) {
				throw new Error("offset 0 must show the tail of the log");
			}

			const scrolled = renderSubagentSplitView([task], 0, 100, 30, 10);
			if (!scrolled.join("\\n").includes("event line")) {
				throw new Error("scrolled view lost the log lines");
			}
			if (scrolled.join("\\n").includes("event line 59")) {
				throw new Error("scrolling back must move the window off the tail");
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 30000);
});

describe("Critical-path failures are recorded", () => {
	test("a recorded failure is deduplicated in the log and surfaced in diagnostics", () => {
		const script = `
			const { recordFailure, getRecentFailures, formatFailureDiagnostics } =
				await import("./extensions/hooks/studio-diagnostics.ts");

			recordFailure("runner.spawn", new Error("ENOENT pi"));
			recordFailure("runner.spawn", new Error("ENOENT pi"));
			recordFailure("roadmap.write", "EACCES");

			const failures = getRecentFailures();
			if (failures.length !== 3) throw new Error("every failure must be recorded, got " + failures.length);
			if (failures[0].area !== "runner.spawn") throw new Error("area lost");
			const text = formatFailureDiagnostics().join(" ");
			if (!text.includes("runner.spawn") || !text.includes("ENOENT pi")) {
				throw new Error("diagnostics must name the area and the cause: " + text);
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 30000);
});

describe("Child termination", () => {
	test("cancelling a run kills the whole process group, not just the direct child", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-tree-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_SPAWN_GRANDCHILD = "1";
			const pidFile = path.join(tmp, "grandchild.pid");
			process.env.FAKE_GRANDCHILD_PID_FILE = pidFile;

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };

			const record = await studioAgentsRunner.run(manifest, "Lanza el build.", tmp, "background", undefined, 60000);

			const deadline = Date.now() + 15000;
			const findPid = () => {
				try {
					const raw = fs.readFileSync(pidFile, "utf8").trim();
					return raw ? Number(raw) : null;
				} catch {
					return null;
				}
			};
			let gpid = null;
			while (!gpid && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 100));
				gpid = findPid();
			}
			if (!gpid) throw new Error("the child never reported a grandchild pid");

			const alive = () => {
				try { process.kill(gpid, 0); return true; } catch { return false; }
			};
			if (!alive()) throw new Error("the grandchild should be running before the cancel");

			const startedCancel = Date.now();
			studioAgentsRunner.cancel(record.id, "test cancel");

			const killBy = Date.now() + 12000;
			while (alive() && Date.now() < killBy) await new Promise((r) => setTimeout(r, 100));

			const survived = alive();
			if (survived) {
				try { process.kill(gpid, "SIGKILL"); } catch {}
				throw new Error("the grandchild survived cancellation after " + (Date.now() - startedCancel) + "ms: the runner signals only the direct child");
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_SPAWN_GRANDCHILD;
			delete process.env.FAKE_GRANDCHILD_PID_FILE;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);
});

describe("Specialist escalation", () => {
	test("a child escalates through interaction_required and cannot be granted ask_user_question", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-escalate-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_ECHO_ARGV = "1";
			process.env.FAKE_RECEIPT = [
				"status: interaction_required",
				'summary: "Necesito una decisión de arquitectura"',
				'question: "¿ECS o jerarquía?"',
				"options:",
				'  - "ECS"',
				'  - "Jerarquía"',
				"blocking: true",
			].join("\\n");

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read", "ask_user_question"], systemPrompt: "test" };
			const record = await studioAgentsRunner.run(manifest, "Diseña el sistema de combate.", tmp, "task");

			if (record.status !== "interaction_required") {
				throw new Error("expected interaction_required, got " + record.status + " (" + (record.error || "") + ")");
			}
			if (!record.interaction || record.interaction.question !== "¿ECS o jerarquía?") {
				throw new Error("the payload did not reach the record: " + JSON.stringify(record.interaction));
			}

			const argv = /ARGV=(.*)/.exec(record.result || "")?.[1] || "";
			if (argv.includes("ask_user_question")) {
				throw new Error("a child has no UI: ask_user_question must not be granted, argv was " + argv);
			}
			if (!argv.includes("--tools read")) {
				throw new Error("the other tools must still be granted, argv was " + argv);
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_ECHO_ARGV;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 40000);
});

describe("Dispatch context", () => {
	test("children run without persisting a session, and keep their stderr tail", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-session-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_ECHO_ARGV = "1";
			process.env.FAKE_STDERR = "warning: deprecated engine api";
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };
			const record = await studioAgentsRunner.run(manifest, "Tarea.", tmp, "task");

			const argv = /ARGV=(.*)/.exec(record.result || "")?.[1] || "";
			if (!argv.includes("--no-session")) {
				throw new Error("a discarded session should not be written; argv was " + argv);
			}

			const tail = (record.stderrTail || []).join("\\n");
			if (!tail.includes("deprecated engine api")) {
				throw new Error("the stderr tail must survive a successful run instead of being dropped: " + JSON.stringify(record.stderrTail));
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_ECHO_ARGV;
			delete process.env.FAKE_STDERR;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 40000);

	test("a dispatch outside a studio project is refused instead of operating on the wrong tree", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const outside = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-studio-"));
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = path.join(outside, "pi-does-not-exist");

			const { registerStudioSubagentTools } = await import("./extensions/hooks/studio-subagents.ts");
			const tools = {};
			registerStudioSubagentTools({ getAllTools: () => [], registerTool: (t) => { tools[t.name] = t; } });

			const res = await tools.subagent_run.execute(
				"id", { agent: "qa-lead", task: "Revisa el build." }, undefined, undefined, { cwd: outside },
			);
			const text = (res.content || []).map((c) => c.text || "").join(" ");
			if (res.details?.error !== "outside_studio") {
				throw new Error("expected outside_studio, got: " + JSON.stringify(res.details) + " / " + text);
			}
			if (!/proyecto|setup/i.test(text)) {
				throw new Error("the refusal must say what to do: " + text);
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(outside, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 40000);

	test("the receipt records the studio root the work happened in", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-root-"));
			fs.mkdirSync(path.join(root, ".pi", "game-studio"), { recursive: true });
			const fakePi = path.join(root, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "qa-lead", title: "QA", tier: "lead", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };
			const record = await studioAgentsRunner.run(manifest, "Tarea.", root, "task");

			if (!record.resolvedRoot) throw new Error("the record does not say where the work happened");
			if (record.resolvedRoot !== path.resolve(root)) {
				throw new Error("resolvedRoot must be the studio root, got " + record.resolvedRoot);
			}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(root, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 40000);
});

describe("Inactivity watchdog", () => {
	const scenario = (env, body) => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-idle-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";
			${Object.entries(env).map(([k, v]) => `process.env.${k} = ${JSON.stringify(String(v))};`).join("\n\t\t\t")}

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "t" };
			const record = await studioAgentsRunner.run(manifest, "Tarea larga.", tmp, "task", undefined, ${body.timeout});
			const elapsed = Date.now() - ${body.startedVar || "0"} + 0;

			${body.assert}

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		return script;
	};

	test("a child that keeps producing activity outlives the idle budget", () => {
		const script = scenario(
			{ FAKE_KEEPALIVE_MS: 400, FAKE_KEEPALIVE_TICKS: 8 },
			{
				timeout: 1500,
				assert: `
			if (record.status !== "completed") {
				throw new Error("a child that keeps reporting activity must not be killed by elapsed time: " + record.status + " / " + (record.error || ""));
			}
			if (typeof record.lastActivityAt !== "number") throw new Error("activity must be tracked on the record");`,
			},
		);
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);

	test("a child that goes silent is cancelled naming inactivity, not elapsed time", () => {
		const script = scenario(
			{ FAKE_SILENT_AFTER_PROMPT: 1 },
			{
				timeout: 1200,
				assert: `
			if (record.status !== "cancelled") throw new Error("a silent child must be cancelled, got " + record.status);
			if (!/sin actividad|inactiv/i.test(record.error || "")) {
				throw new Error("the cancellation must name inactivity, got: " + record.error);
			}`,
			},
		);
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);

	test("a long running tool gets its own budget", () => {
		const script = scenario(
			{ FAKE_TOOL_THEN_SILENCE: 2000, PI_STUDIO_TOOL_IDLE_MS: 6000 },
			{
				timeout: 800,
				assert: `
			if (record.status !== "completed") {
				throw new Error("a tool in flight must not be judged by the plain idle budget: " + record.status + " / " + (record.error || ""));
			}`,
			},
		);
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);

	test("concurrency is capped instead of unbounded", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-cap-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_SILENT_AFTER_PROMPT = "1";
			process.env.PI_STUDIO_MAX_CONCURRENCY = "1";

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "qa-lead", title: "QA", tier: "lead", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "t" };
			const first = await studioAgentsRunner.run(manifest, "uno", tmp, "background", undefined, 20000);
			const second = await studioAgentsRunner.run(manifest, "dos", tmp, "background", undefined, 20000);

			if (second.status !== "failed" || !/concurren/i.test(second.error || "")) {
				throw new Error("the second dispatch must be refused naming the cap, got: " + second.status + " / " + (second.error || ""));
			}

			studioAgentsRunner.cancel(first.id, "fin del test");
			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_SILENT_AFTER_PROMPT;
			delete process.env.PI_STUDIO_MAX_CONCURRENCY;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);
});

describe("Token accounting", () => {
	test("usage comes from what the child reported, not from character counts", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-usage-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";
			process.env.FAKE_USAGE_INPUT = "120";
			process.env.FAKE_USAGE_OUTPUT = "40";
			process.env.FAKE_USAGE_COST = "0.0025";

			const { studioAgentsRunner, usageToTokens } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "qa-lead", title: "QA", tier: "lead", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "t" };
			const record = await studioAgentsRunner.run(manifest, "Tarea.", tmp, "task");

			if (!record.usage) throw new Error("the child reported usage and the record dropped it");
			if (record.usage.input !== 240) throw new Error("two turns of 120 input tokens must sum to 240, got " + record.usage.input);
			if (record.usage.output !== 80) throw new Error("two turns of 40 output tokens must sum to 80, got " + record.usage.output);
			if (Math.abs(record.usage.cost - 0.005) > 1e-9) throw new Error("cost must accumulate, got " + record.usage.cost);

			const tokens = usageToTokens(record);
			if (tokens.input !== 240 || tokens.output !== 80) {
				throw new Error("the accounting must use reported usage, not length/4: " + JSON.stringify(tokens));
			}
			if (tokens.estimated) throw new Error("reported usage must not be flagged as estimated");

			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_USAGE_INPUT;
			delete process.env.FAKE_USAGE_OUTPUT;
			delete process.env.FAKE_USAGE_COST;
			fs.rmSync(tmp, { recursive: true, force: true });
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 40000);
});

describe("Live steering", () => {
	test("a steering message reaches the running child instead of forcing a re-dispatch", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-steer-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			const commandLog = path.join(tmp, "commands.log");
			const previousPiPath = process.env.PI_PATH;
			process.env.PI_PATH = fakePi;
			process.env.FAKE_SILENT_AFTER_PROMPT = "1";
			process.env.FAKE_COMMAND_LOG = commandLog;

			const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "t" };
			const record = await studioAgentsRunner.run(manifest, "Implementa el combate.", tmp, "background", undefined, 30000);

			const read = () => { try { return fs.readFileSync(commandLog, "utf8"); } catch { return ""; } };
			const waitFor = async (pattern) => {
				const deadline = Date.now() + 10000;
				while (Date.now() < deadline) {
					if (pattern.test(read())) return true;
					await new Promise((r) => setTimeout(r, 100));
				}
				return false;
			};

			if (!(await waitFor(/"prompt"/))) throw new Error("the child never received the prompt");

			if (studioAgentsRunner.steer("task-que-no-existe", "x") !== false) {
				throw new Error("steering a task that is not running must report false");
			}

			if (studioAgentsRunner.steer(record.id, "Corrige el rumbo: usa ECS.") !== true) {
				throw new Error("steering a running task must report true");
			}

			if (!(await waitFor(/"type":"steer"[^}]*(Corrige el rumbo)/))) {
				throw new Error("the steering message never reached the child: " + read().slice(-400));
			}
			if (!(record.logs || []).some((l) => /steer/i.test(l))) {
				throw new Error("the record must log the steering for the viewer");
			}

			studioAgentsRunner.cancel(record.id, "fin del test");
			await new Promise((r) => setTimeout(r, 300));
			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			delete process.env.FAKE_SILENT_AFTER_PROMPT;
			delete process.env.FAKE_COMMAND_LOG;
			try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* el hijo puede seguir escribiendo */ }
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);
});

describe("Compaction during a child run", () => {
	const scenario = (env) => `
		const fs = await import("node:fs");
		const os = await import("node:os");
		const path = await import("node:path");

		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-compact-"));
		const fakePi = path.join(tmp, "pi");
		fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
		fs.chmodSync(fakePi, 0o755);
		const previousPiPath = process.env.PI_PATH;
		process.env.PI_PATH = fakePi;
		process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nfiles_changed:\\n  - src/a.rs";
		${Object.entries(env).map(([k, v]) => `process.env.${k} = ${JSON.stringify(String(v))};`).join("\n\t\t")}

		const { studioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
		const manifest = { name: "bevy-specialist", title: "BS", tier: "specialist", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "t" };
		const record = await studioAgentsRunner.run(manifest, "Tarea larga.", tmp, "task");

		const done = () => {
			if (previousPiPath === undefined) delete process.env.PI_PATH;
			else process.env.PI_PATH = previousPiPath;
			${Object.keys(env).map((k) => `delete process.env.${k};`).join("\n\t\t\t")}
			fs.rmSync(tmp, { recursive: true, force: true });
		};
	`;

	test("a compaction inside the child is visible on the task", () => {
		const script = scenario({ FAKE_COMPACTION: "threshold" }) + `
			const entry = (record.compactions || [])[0];
			if (!entry) throw new Error("compaction_start was ignored: the task reports nothing");
			if (entry.reason !== "threshold") throw new Error("the reason was lost: " + JSON.stringify(entry));
			if (entry.ok !== true) throw new Error("a successful compaction must be recorded as such: " + JSON.stringify(entry));
			if (!(record.logs || []).some((l) => /compactaci/i.test(l))) {
				throw new Error("the viewer log must show the compaction");
			}
			done();
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);

	test("a failed compaction is recorded as a failure, not as a silent no-op", () => {
		const script = scenario({ FAKE_COMPACTION: "overflow", FAKE_COMPACTION_FAILS: 1 }) + `
			const entry = (record.compactions || [])[0];
			if (!entry) throw new Error("compaction_start was ignored");
			if (entry.ok !== false) throw new Error("a failed compaction must not be recorded as ok");
			if (!(record.logs || []).some((l) => /fallid|context too large/i.test(l))) {
				throw new Error("the failure reason must reach the log");
			}
			done();
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);

	test("a delivery that only survives in the final message is not reported as a contract violation", () => {
		const script = scenario({ FAKE_MESSAGE_END_ONLY: 1 }) + `
			if (record.status !== "completed") {
				throw new Error("the authoritative final message must be used when the deltas are gone: " + record.status + " / " + (record.error || ""));
			}
			done();
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				timeout: 60000,
			});
		}).not.toThrow();
	}, 70000);
});
