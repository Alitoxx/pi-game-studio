const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// Issue #88: `/studio:budget` only saw the current process. The per-day
// aggregates now survive restarts in `.pi/game-studio/budget.json`, but the
// hottest path (recordTokenUsage) must stay memory-only: nothing touches the
// disk until flushBudgetToDisk() folds the pending day bucket in. This suite
// pins the observable effects through the public interface.
describe("Studio budget persistence", () => {
	const repoRoot = path.join(__dirname, "..");
	const tmpDirs = [];

	const makeDir = () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-budget-"));
		tmpDirs.push(dir);
		return dir;
	};

	const run = (script) => {
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		});
	};

	const budgetPath = (root) => path.join(root, ".pi", "game-studio", "budget.json");

	afterAll(() => {
		for (const dir of tmpDirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("recordTokenUsage never writes to disk: the file does not exist until a flush", () => {
		const root = makeDir();
		const file = budgetPath(root);
		run(`
			const fs = await import("node:fs");
			const { recordTokenUsage } = await import("./extensions/hooks/studio-budget.ts");

			for (let i = 0; i < 25; i++) {
				recordTokenUsage("producer", "anthropic/claude-sonnet-4", 100 + i, 50, 10);
			}

			if (fs.existsSync(${JSON.stringify(file)})) {
				throw new Error("recordTokenUsage must be memory-only: budget.json exists after 25 records");
			}
		`);
		expect(fs.existsSync(file)).toBe(false);
	});

	test("flushBudgetToDisk then readBudgetHistory round-trips the day's aggregates exactly", () => {
		const root = makeDir();
		run(`
			const { recordTokenUsage, flushBudgetToDisk, readBudgetHistory } =
				await import("./extensions/hooks/studio-budget.ts");

			const root = ${JSON.stringify(root)};
			// Free model keeps the cost at exactly zero, so the numbers are exact.
			recordTokenUsage("producer", "openrouter/openai/gpt-oss-120b:free", 1200, 340, 60);
			recordTokenUsage("game-designer", "openrouter/openai/gpt-oss-120b:free", 800, 160, 40);
			flushBudgetToDisk(root);

			const history = readBudgetHistory(root);
			if (history.schema !== 1) throw new Error("schema must be 1, got " + history.schema);
			const keys = Object.keys(history.days);
			if (keys.length !== 1) throw new Error("expected exactly one day bucket, got " + keys.length);

			const bucket = history.days[keys[0]];
			if (bucket.input !== 2000) throw new Error("input mismatch: " + bucket.input);
			if (bucket.output !== 500) throw new Error("output mismatch: " + bucket.output);
			if (bucket.cache !== 100) throw new Error("cache mismatch: " + bucket.cache);
			if (bucket.total !== 2600) throw new Error("total mismatch: " + bucket.total);
			if (bucket.costUsd !== 0) throw new Error("cost mismatch: " + bucket.costUsd);
			if (bucket.events !== 2) throw new Error("events mismatch: " + bucket.events);

			// Repeated flushes must not double-count: the accumulator restarts empty.
			flushBudgetToDisk(root);
			const again = readBudgetHistory(root);
			if (again.days[keys[0]].total !== 2600) {
				throw new Error("second flush double-counted: " + again.days[keys[0]].total);
			}
		`);
	});

	test("a malformed budget.json yields an empty history and a recorded failure instead of a throw", () => {
		const root = makeDir();
		fs.mkdirSync(path.join(root, ".pi", "game-studio"), { recursive: true });
		fs.writeFileSync(budgetPath(root), "{ not valid json !!", "utf8");

		run(`
			const { readBudgetHistory } = await import("./extensions/hooks/studio-budget.ts");
			const { resetFailures, getRecentFailures } = await import("./extensions/hooks/studio-diagnostics.ts");

			const root = ${JSON.stringify(root)};
			resetFailures();

			let history;
			try {
				history = readBudgetHistory(root);
			} catch (error) {
				throw new Error("readBudgetHistory threw on a malformed file: " + error.message);
			}

			if (Object.keys(history.days).length !== 0) {
				throw new Error("a malformed file must read as empty, got " + JSON.stringify(history.days));
			}

			const failures = getRecentFailures().filter((f) => f.area === "studio-budget");
			if (failures.length === 0) throw new Error("the malformed file was not recorded as a failure");
		`);
	});

	test("the persisted file keeps at most 30 day buckets, dropping the oldest", () => {
		const root = makeDir();
		fs.mkdirSync(path.join(root, ".pi", "game-studio"), { recursive: true });

		const days = {};
		for (let i = 0; i < 40; i++) {
			const date = new Date(Date.UTC(2000, 0, 1 + i));
			const key = date.toISOString().slice(0, 10);
			days[key] = { input: 1, output: 1, cache: 0, total: 2, costUsd: 0, events: 1 };
		}
		fs.writeFileSync(budgetPath(root), JSON.stringify({ schema: 1, days }), "utf8");

		run(`
			const { recordTokenUsage, flushBudgetToDisk, readBudgetHistory } =
				await import("./extensions/hooks/studio-budget.ts");

			const root = ${JSON.stringify(root)};
			recordTokenUsage("producer", "openrouter/openai/gpt-oss-120b:free", 10, 0, 0);
			flushBudgetToDisk(root);

			const history = readBudgetHistory(root);
			const keys = Object.keys(history.days).sort();
			if (keys.length !== 30) {
				throw new Error("expected 30 buckets after pruning, got " + keys.length);
			}
			if (keys.includes("2000-01-01")) throw new Error("the oldest bucket survived pruning");
			if (keys.includes("2000-01-11")) throw new Error("buckets older than 30 days survived pruning");
			if (!keys.includes("2000-02-09")) throw new Error("the newest seeded bucket was dropped");
			if (keys[keys.length - 1] < "2000-02-09") throw new Error("today's bucket must be the newest");
		`);
		expect(Object.keys(JSON.parse(fs.readFileSync(budgetPath(root), "utf8")).days)).toHaveLength(30);
	});

	test("resetBudget zeroes the session report but leaves the persisted history intact", () => {
		const root = makeDir();
		run(`
			const { recordTokenUsage, flushBudgetToDisk, resetBudget, getBudgetReport, readBudgetHistory } =
				await import("./extensions/hooks/studio-budget.ts");

			const root = ${JSON.stringify(root)};
			recordTokenUsage("producer", "openrouter/openai/gpt-oss-120b:free", 900, 100, 0);
			flushBudgetToDisk(root);

			resetBudget();
			const report = getBudgetReport();
			if (report.totalTokens !== 0) throw new Error("session tokens must be zero after reset, got " + report.totalTokens);
			if (report.recordCount !== 0) throw new Error("session record count must be zero after reset");

			const history = readBudgetHistory(root);
			const keys = Object.keys(history.days);
			if (keys.length !== 1) throw new Error("persisted history must survive a reset, got " + keys.length);
			if (history.days[keys[0]].total !== 1000) {
				throw new Error("persisted totals changed after reset: " + history.days[keys[0]].total);
			}
		`);
	});
});
