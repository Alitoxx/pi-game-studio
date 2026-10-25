const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const hooksDir = path.join(__dirname, "..", "extensions", "hooks");
const files = fs.readdirSync(hooksDir).filter((f) => f.endsWith(".ts"));

describe("Studio palette", () => {
	test("no file outside the palette module hardcodes a colour", () => {
		const offenders = files
			.filter((f) => f !== "studio-palette.ts")
			// Match the escape PREFIX, not only literal triples: a colour built by
			// interpolation (a gradient) bypasses a triple-only check.
			.filter((f) => /38;2;/.test(fs.readFileSync(path.join(hooksDir, f), "utf8")))
			.map((f) => `${f} (${(fs.readFileSync(path.join(hooksDir, f), "utf8").match(/38;2;/g) || []).length})`);
		expect(offenders).toEqual([]);
	});

	test("hierarchy comes from brightness: text > states > borders", () => {
		const script = `
			const p = await import("./extensions/hooks/studio-palette.ts");
			const brightness = (escape) => {
				const m = /38;2;(\\d+);(\\d+);(\\d+)/.exec(escape);
				if (!m) throw new Error("not a colour: " + JSON.stringify(escape));
				return Math.max(Number(m[1]), Number(m[2]), Number(m[3]));
			};
			const text = brightness(p.TEXT);
			const states = [brightness(p.SUCCESS), brightness(p.WARNING), brightness(p.ERROR)];
			const border = brightness(p.BORDER);
			if (!states.every((s) => s < text)) {
				throw new Error("every state must sit below body text: text " + text + " vs states " + states.join(","));
			}
			if (!states.every((s) => s > border)) {
				throw new Error("states must stay readable above borders: states " + states.join(",") + " vs border " + border);
			}
			if (p.ACCENT === p.SECONDARY) throw new Error("the accent and the secondary tone must differ");
		`;
		expect(() =>
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			}),
		).not.toThrow();
	}, 30000);

	describe("ornament vocabulary", () => {
		const read = (f) => fs.readFileSync(path.join(hooksDir, f), "utf8");

		test("retired ornament glyphs do not come back", () => {
			const retired = /[◈▌✔●◆★╔╗╚╝╠╣═║▲■]/;
			const offenders = files
				.filter((f) => f !== "studio-palette.ts")
				.filter((f) => retired.test(read(f)))
				.map((f) => `${f} (${(read(f).match(new RegExp(retired.source, "g")) || []).length})`);
			expect(offenders).toEqual([]);
		});

		test("emphasis stays on the title", () => {
			const total = files
				.filter((f) => f !== "studio-palette.ts")
				.reduce((n, f) => n + (read(f).match(/BOLD/g) || []).length, 0);
			expect(total).toBeLessThanOrEqual(40);
		});
	});

	test("NO_COLOR disables every escape instead of forcing the studio palette", () => {
		const script = `
			const p = await import("./extensions/hooks/studio-palette.ts");
			const coloured = Object.entries(p).filter(([, v]) => typeof v === "string" && v.includes("\\x1b"));
			if (coloured.length > 0) throw new Error("NO_COLOR must disable colour, still set: " + coloured.map(([k]) => k).join(","));
		`;
		expect(() =>
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
				env: { ...process.env, NO_COLOR: "1" },
			}),
		).not.toThrow();
	}, 30000);
});
