const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// The registration surface is the one place where the extension talks to the host.
// A name the host does not emit, or a cast that hides it, fails silently at runtime:
// these tests are the only guard that runs on every commit.
describe("Studio extension registration surface", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "registration-probe.mjs");
	const indexPath = path.join(repoRoot, "extensions", "hooks", "index.ts");
	const piTypesPath = path.join(
		repoRoot,
		"node_modules",
		"@earendil-works",
		"pi-coding-agent",
		"dist",
		"core",
		"extensions",
		"types.d.ts",
	);

	let registration;

	beforeAll(() => {
		const stdout = execFileSync(process.execPath, ["--experimental-strip-types", probePath], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 120000,
		});
		registration = JSON.parse(stdout);
	});

	test("declares the events Pi actually emits", () => {
		const types = fs.readFileSync(piTypesPath, "utf8");
		const emitted = new Set(
			[...types.matchAll(/^\s+on\(event: "([a-z_]+)"/gm)].map((m) => m[1]),
		);
		expect(emitted.size).toBeGreaterThan(20);

		const unknown = registration.events.filter((name) => !emitted.has(name));
		expect({ subscribed: registration.events, unknown }).toEqual({
			subscribed: registration.events,
			unknown: [],
		});
	});

	test("cancels dispatched work when the turn is aborted through the real signal", () => {
		// Pi has no abort event, so the turn's AbortSignal is the only authority.
		const source = fs.readFileSync(indexPath, "utf8");
		expect(source).toMatch(/addEventListener\(\s*["']abort["']/);
		expect(source).toContain("studioAgentsRunner.cancelAll");
	});

	test("registers commands through the typed host API, not through a cast", () => {
		const source = fs.readFileSync(indexPath, "utf8");
		const casts = Array.from(
			source.matchAll(/\(pi as any\)\.(on|registerCommand|registerShortcut|registerTool)\b/g),
			(match) => match[0],
		);
		expect(casts).toEqual([]);
		expect(registration.commands.length).toBeGreaterThan(50);
		expect(new Set(registration.commands).size).toBe(registration.commands.length);
	});

	test("registers every tool the studio documents as its own", () => {
		expect(registration.tools).toEqual(
			expect.arrayContaining(["subagent_run", "ask_user_question"]),
		);
	});
});
