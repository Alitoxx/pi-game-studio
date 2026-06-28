const pkg = require("../package.json");

describe("Pi Game Studio Package", () => {
	test("should have correct name", () => {
		expect(pkg.name).toBe("pi-game-studio");
	});

	test("should have correct version", () => {
		expect(pkg.version).toBe("0.3.0");
	});

	test("should have Pi configuration", () => {
		expect(pkg.pi).toBeDefined();
		expect(pkg.pi.skills).toEqual(["./skills"]);
		expect(pkg.pi.prompts).toEqual(["./prompts"]);
		expect(pkg.pi.extensions).toEqual(["./extensions"]);
	});

	test("should have required files", () => {
		const requiredFiles = ["agents/", "skills/", "prompts/", "extensions/"];
		requiredFiles.forEach((file) => {
			expect(pkg.files).toContain(file);
		});
	});
});

describe("Agents Configuration", () => {
	test("should have agents directory", () => {
		const fs = require("fs");
		expect(fs.existsSync("./agents")).toBe(true);
	});

	test("should have skills directory", () => {
		const fs = require("fs");
		expect(fs.existsSync("./skills")).toBe(true);
	});
});
