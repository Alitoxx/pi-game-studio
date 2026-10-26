const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// A command the docs advertise but the extension never registers is a dead
// entry point: the user types it and nothing happens. Two such commands shipped
// (documented in README and AGENTS.md) while every guard stayed green, so this
// suite compares the three inventories that are supposed to agree: what the
// registry registers, what the /studio catalog lists, and what the docs promise.
describe("Studio command surface", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "registration-probe.mjs");
	const DOCS = ["README.md", "AGENTS.md", path.join("docs", "skills-reference.md")];

	let registered;
	let catalog;
	let skills;

	beforeAll(() => {
		const registration = JSON.parse(
			execFileSync(process.execPath, ["--experimental-strip-types", probePath], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 120000,
			}),
		);
		registered = new Set(registration.commands);
		catalog = registration.catalog;
		// /concept, /spec, ... are skill commands: their entry point is the skill
		// file, not a registered extension command.
		skills = new Set(
			fs
				.readdirSync(path.join(repoRoot, "skills"), { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.filter((entry) =>
					fs.existsSync(path.join(repoRoot, "skills", entry.name, "SKILL.md")),
				)
				.map((entry) => entry.name),
		);
	});

	test("registers every command the /studio catalog advertises", () => {
		const missing = catalog.filter((name) => !registered.has(name) && !skills.has(name));
		expect(missing).toEqual([]);
		expect(catalog.length).toBeGreaterThan(10);
	});

	test("registers every studio:* command the documentation promises", () => {
		const documented = new Map();
		for (const doc of DOCS) {
			const text = fs.readFileSync(path.join(repoRoot, doc), "utf8");
			for (const match of text.matchAll(/(?<![\w./-])\/(studio:[a-z0-9-]+)/g)) {
				if (!documented.has(match[1])) documented.set(match[1], []);
				documented.get(match[1]).push(doc);
			}
		}
		expect(documented.size).toBeGreaterThan(20);

		const missing = [...documented.keys()]
			.filter((name) => !registered.has(name))
			.map((name) => `${name} (${[...new Set(documented.get(name))].join(", ")})`);
		expect(missing).toEqual([]);
	});

	test("registers the non-namespaced commands the documentation promises", () => {
		// Aliases documented without the studio: prefix. Add a name here only when a
		// document promises it as a runnable command.
		const documentedAliases = ["assign-models"];
		const missing = documentedAliases.filter((name) => !registered.has(name));
		expect(missing).toEqual([]);
	});
});
