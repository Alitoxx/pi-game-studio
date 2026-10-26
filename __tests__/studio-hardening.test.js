const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Two invariants that were only ever documented in prose: the sub-package
// manifest must declare exactly what the code imports, and one event must have
// one handler, because that handler writes an audit line and re-reads setup.
describe("Studio hardening invariants", () => {
	const repoRoot = path.join(__dirname, "..");
	const hooksDir = path.join(repoRoot, "extensions", "hooks");
	const indexPath = path.join(hooksDir, "index.ts");
	const modules = fs
		.readdirSync(hooksDir)
		.filter((file) => file.endsWith(".ts"))
		.map((file) => ({
			file,
			source: fs.readFileSync(path.join(hooksDir, file), "utf8"),
		}));

	test("the hooks manifest declares exactly the packages the code imports", () => {
		const imported = new Set();
		for (const { source } of modules) {
			// Generated code lives inside template literals (studio-scaffold writes
			// `import Phaser from "phaser"` as a string); those are not this package's
			// dependencies, so strip template literals before scanning.
			const code = source.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '""');
			const specifiers = [
				...code.matchAll(/(?:from\s+|import\(\s*|require\(\s*)["']([^"']+)["']/g),
			].map((match) => match[1]);

			for (const specifier of specifiers) {
				if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
				// @scope/name -> @scope/name, bare package -> first path segment
				const parts = specifier.split("/");
				imported.add(specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]);
			}
		}

		const manifest = JSON.parse(fs.readFileSync(path.join(hooksDir, "package.json"), "utf8"));
		const declared = Object.keys(manifest.dependencies || {}).sort();

		expect(declared).toEqual([...imported].sort());
	});

	test("registers the turn handler exactly once", () => {
		const source = fs.readFileSync(indexPath, "utf8");
		const registrations = [...source.matchAll(/on\(\s*"[a-z_]+"\s*,\s*handleAgentTurnStart\s*\)/g)];
		expect(registrations).toHaveLength(1);
		// Definition plus that single registration.
		expect(source.match(/handleAgentTurnStart/g)).toHaveLength(2);
	});

	test("appends to the audit log without a read-modify-write race", () => {
		const source = fs.readFileSync(indexPath, "utf8");
		const helper = source.slice(source.indexOf("async function appendToFile"));
		expect(helper.slice(0, 400)).toMatch(/appendFile\(/);
		expect(helper.slice(0, 400)).not.toMatch(/existing\s*\+/);
	});

	test("the sub-package manifest points at the runtime this repository runs", () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(hooksDir, "package.json"), "utf8"));
		const rootManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
		const rootAgent = rootManifest.devDependencies["@earendil-works/pi-coding-agent"];
		const hooksAgent = (manifest.dependencies || {})["@earendil-works/pi-coding-agent"];
		expect(hooksAgent).toBe(rootAgent);
	});
});
