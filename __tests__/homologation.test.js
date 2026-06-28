const fs = require("fs");
const path = require("path");

function countFiles(dir, predicate) {
	return fs.readdirSync(dir, { withFileTypes: true }).filter(predicate).length;
}

function countMarkdownFilesRecursive(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			total += countMarkdownFilesRecursive(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			total += 1;
		}
	}
	return total;
}

describe("Homologation metadata", () => {
	test("README inventory counts match repository contents", () => {
		const readme = fs.readFileSync(
			path.join(__dirname, "..", "README.md"),
			"utf8",
		);

		const agents = countFiles(
			path.join(__dirname, "..", "agents"),
			(d) => d.isFile() && d.name.endsWith(".md"),
		);
		const skills = fs
			.readdirSync(path.join(__dirname, "..", "skills"), {
				withFileTypes: true,
			})
			.filter(
				(d) =>
					d.isDirectory() &&
					fs.existsSync(
						path.join(__dirname, "..", "skills", d.name, "SKILL.md"),
					),
			).length;
		const prompts = countMarkdownFilesRecursive(
			path.join(__dirname, "..", "prompts"),
		);
		const hooksSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
			"utf8",
		);
		const hooks = (hooksSource.match(/pi\.on\(/g) || []).length;

		expect(readme).toContain(`${agents} agents`);
		expect(readme).toContain(`${skills} skills`);
		expect(readme).toContain(`${prompts} templates`);
		expect(readme).toContain(`${hooks} hooks`);
	});

	test("README hooks inventory table reflects the actual handler count", () => {
		const readme = fs.readFileSync(
			path.join(__dirname, "..", "README.md"),
			"utf8",
		);
		const hooksSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
			"utf8",
		);
		const hooks = (hooksSource.match(/pi\.on\(/g) || []).length;
		const hooksRow = readme
			.split("\n")
			.find((line) => line.includes("**Hooks**"));

		expect(hooksRow).toBeDefined();
		expect(hooksRow).toMatch(
			new RegExp(`\\| \\*\\*Hooks\\*\\*\\s*\\|\\s*${hooks}\\s*\\|`),
		);
	});
});
