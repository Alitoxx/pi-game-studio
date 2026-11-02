const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// A dispatch that never starts must not leave its decision channel behind. The channel
// is created before the spawn, so every path that fails to produce a child — a binary
// that does not exist, the concurrency gate refusing the dispatch — has to reclaim it.
// A spawn failure emits 'error' and never 'close', which is exactly the shape of leak
// that a test asserting only on the happy path would never see.
describe("Decision channel lifecycle", () => {
	const repoRoot = path.join(__dirname, "..");

	const dispatchInto = (env, extra = "") => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const { StudioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "probe", title: "Probe", tier: "workhorse", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "probe" };
			const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "chan-cwd-"));
			const asked = [];
			const record = await new StudioAgentsRunner().run(
				manifest,
				"probe task",
				cwd,
				"task",
				undefined,
				2000,
				undefined,
				async (query) => { asked.push(query.id); return "answer"; },
			);
			process.stdout.write("RESULT:" + JSON.stringify({ status: record.status, asked: asked.length }) + "\\n");
			fs.rmSync(cwd, { recursive: true, force: true });
			${extra}
			process.exit(0);
		`;
		return execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
			env: { ...process.env, ...env },
		});
	};

	const leftoverChannels = (tmpRoot) =>
		fs.readdirSync(tmpRoot).filter((name) => name.startsWith("pi-std-"));

	test("a dispatch whose binary does not exist leaves no channel behind", () => {
		const tmpRoot = fs.mkdtempSync(path.join("/tmp", "chan-leak-"));
		try {
			const stdout = dispatchInto({ TMPDIR: tmpRoot, PI_PATH: "/nonexistent/pi-binary" });
			const result = JSON.parse(stdout.split("\n").find((l) => l.startsWith("RESULT:")).slice(7));
			expect(result.status).toBe("failed");
			expect(leftoverChannels(tmpRoot)).toEqual([]);
		} finally {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		}
	}, 60000);

	test("a channel that is created and closed leaves neither socket nor directory", () => {
		const script = `
			const fs = await import("node:fs");
			const path = await import("node:path");
			const { ParentChannel, channelSocketPath, removeChannelDirectory } = await import("./extensions/hooks/studio-channel.ts");
			const tmpRoot = fs.mkdtempSync(path.join("/tmp", "chan-direct-"));
			const socketPath = channelSocketPath("probe", tmpRoot);
			const channel = await ParentChannel.create({ socketPath, onQuery: () => {} });
			const socketExisted = fs.existsSync(socketPath);
			await channel.close();
			removeChannelDirectory(tmpRoot);
			process.stdout.write("RESULT:" + JSON.stringify({
				socketExisted,
				socketGone: !fs.existsSync(socketPath),
				dirGone: !fs.existsSync(tmpRoot),
			}) + "\\n");
			process.exit(0);
		`;
		const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chan-direct-root-"));
		try {
			const stdout = execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
				env: { ...process.env, TMPDIR: tmpRoot },
			});
			const result = JSON.parse(stdout.split("\n").find((l) => l.startsWith("RESULT:")).slice(7));
			expect(result.socketExisted).toBe(true);
			expect(result.socketGone).toBe(true);
			expect(result.dirGone).toBe(true);
		} finally {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		}
	}, 60000);
});
