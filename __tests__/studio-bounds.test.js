const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Issue #87: two long-lived structures in the studio grow with no cap — the
// runner's per-task log array (27 push sites, only `stderrTail` was capped) and
// the budget's record array, fed on every tool call and every message end. A
// long session therefore grows memory monotonically in the hottest path of the
// extension. This suite pins the three bounds and, just as importantly, that
// bounding the records does not corrupt the numbers the user reads.
describe("Studio bounded state", () => {
	const repoRoot = path.join(__dirname, "..");

	const runScript = (script) => {
		try {
			return execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 120000,
			});
		} catch (error) {
			throw new Error(
				`child script failed:\n${error.message}\nstdout:\n${error.stdout}\nstderr:\n${error.stderr}`,
			);
		}
	};

	test("task logs keep the tail instead of growing without bound", () => {
		runScript(`
			const { appendTaskLog, MAX_TASK_LOG_LINES } = await import("./extensions/hooks/studio-agents-runner.ts");
			const record = { logs: [] };

			for (let i = 0; i < MAX_TASK_LOG_LINES * 3; i++) appendTaskLog(record, "line " + i);

			if (record.logs.length !== MAX_TASK_LOG_LINES) {
				throw new Error("expected the log capped at " + MAX_TASK_LOG_LINES + ", got " + record.logs.length);
			}
			if (record.logs[record.logs.length - 1] !== "line " + (MAX_TASK_LOG_LINES * 3 - 1)) {
				throw new Error("the newest line must survive, tail was " + record.logs[record.logs.length - 1]);
			}
			if (record.logs[0] !== "line " + MAX_TASK_LOG_LINES * 2) {
				throw new Error("the oldest lines must be dropped first, head was " + record.logs[0]);
			}
			if (record.logsDropped !== MAX_TASK_LOG_LINES * 2) {
				throw new Error("the drop count must be honest, got " + record.logsDropped);
			}
		`);
	});

	test("no runner path writes the log array directly", () => {
		const source = fs.readFileSync(
			path.join(repoRoot, "extensions", "hooks", "studio-agents-runner.ts"),
			"utf8",
		);

		// A single push site is the ring buffer itself; any second one is a path that
		// would bypass the cap.
		expect((source.match(/\.logs\.push\(/g) || []).length).toBe(1);
		expect(source).toContain("export function appendTaskLog(");
	});

	test("finished tasks age out, the newest survive the cap, a live one is kept", () => {
		runScript(`
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-bounds-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			process.env.PI_PATH = fakePi;
			process.env.FAKE_RECEIPT = "status: completed\\nsummary: ok\\nvalidation:\\n  - structural: src/a.rs: presente";

			const { StudioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "qa-lead", title: "QA", tier: "workhorse", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };

			const capped = new StudioAgentsRunner({ maxTasks: 3, taskTtlMs: 60 * 60 * 1000 });
			for (let i = 0; i < 5; i++) {
				const record = await capped.run(manifest, "Tarea " + i, tmp, "task");
				if (record.status !== "completed") {
					throw new Error("dispatch " + i + " failed: " + record.status + " (" + (record.error || "") + ")");
				}
			}

			const kept = capped.listTasks();
			if (kept.length !== 3) throw new Error("expected 3 retained tasks, got " + kept.length);
			const titles = kept.map((t) => t.task).join(",");
			if (titles !== "Tarea 4,Tarea 3,Tarea 2") throw new Error("the newest tasks must survive the cap, kept " + titles);

			// Inside the TTL the record must survive: the bound is a leak stop, not an
			// eager eraser of the result the user is about to read.
			const early = capped.pruneTasks(Date.now() + 30 * 60 * 1000);
			if (early !== 0) throw new Error("no task may age out inside its TTL, pruned " + early);
			if (capped.listTasks().length !== 3) throw new Error("inside the TTL every finished task stays readable");

			// Past the TTL the same records are dropped.
			const aged = capped.pruneTasks(Date.now() + 2 * 60 * 60 * 1000);
			if (aged !== 3) throw new Error("every finished task should age out past its TTL, pruned " + aged);

			const stalled = new StudioAgentsRunner();
			process.env.FAKE_SILENT_AFTER_PROMPT = "1";
			const live = await stalled.run(manifest, "Tarea larga", tmp, "background");
			const deadline = Date.now() + 10000;
			while (live.status !== "running" && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 50));
			}
			if (live.status !== "running") throw new Error("the fake child never started, status " + live.status);

			const prunedLive = stalled.pruneTasks(Date.now() + 31 * 60 * 60 * 1000);
			if (prunedLive !== 0) throw new Error("a running task must never be pruned, pruned " + prunedLive);
			if (!stalled.getTask(live.id)) throw new Error("the running task must still be readable");

			stalled.cancelAll();
			if (capped.listTasks().length !== 0) throw new Error("every finished task aged out, so the map must be empty");
			fs.rmSync(tmp, { recursive: true, force: true });
			process.exit(0);
		`);
	});

	test("records are capped while the report totals stay exact", () => {
		runScript(`
			const { recordTokenUsage, getBudgetReport, resetBudget, MAX_SESSION_RECORDS } =
				await import("./extensions/hooks/studio-budget.ts");

			resetBudget();
			const events = 5000;
			for (let i = 0; i < events; i++) {
				// A free model keeps the cost at zero, so the assertion is about tokens.
				recordTokenUsage("bevy-specialist", "openrouter/openai/gpt-oss-120b:free", 100, 10, 0);
			}

			const retained = getBudgetReport().retainedRecords;
			if (retained > MAX_SESSION_RECORDS) {
				throw new Error("retained records must stay capped at " + MAX_SESSION_RECORDS + ", got " + retained);
			}

			const report = getBudgetReport();
			if (report.totalInputTokens !== events * 100) {
				throw new Error("dropping records lost input tokens: " + report.totalInputTokens);
			}
			if (report.totalOutputTokens !== events * 10) {
				throw new Error("dropping records lost output tokens: " + report.totalOutputTokens);
			}
			if (report.totalTokens !== events * 110) {
				throw new Error("dropping records lost tokens: " + report.totalTokens);
			}
			if (report.byAgent["bevy-specialist"].totalTokens !== events * 110) {
				throw new Error("the per-agent rollup lost tokens: " + report.byAgent["bevy-specialist"].totalTokens);
			}
			if (report.byModel["openrouter/openai/gpt-oss-120b:free"].total !== events * 110) {
				throw new Error("the per-model rollup lost tokens");
			}
			if (report.recordCount !== events) {
				throw new Error("the event count must stay truthful after folding, got " + report.recordCount);
			}

			resetBudget();
			if (getBudgetReport().retainedRecords !== 0) throw new Error("reset must clear the retained records");
			if (getBudgetReport().totalTokens !== 0) throw new Error("reset must clear the archived totals too");
		`);
	});
});
