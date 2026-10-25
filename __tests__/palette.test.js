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

	describe("theme integration (resolveStudioTheme)", () => {
		const runScript = (script) =>
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			}).toString();

		// WCAG 2.x relative luminance + contrast ratio, plus a parser that accepts
		// both raw hex ("#RRGGBB") and any string carrying an RGB escape.
		const WCAG_HELPERS = `
			const srgb = (c) => {
				c = c / 255;
				return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
			};
			const luminance = ({ r, g, b }) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
			const parseColor = (s) => {
				if (/^#[0-9a-f]{6}$/i.test(s)) {
					return { r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16) };
				}
				const m = /38;2;(\\d+);(\\d+);(\\d+)/.exec(s);
				if (!m) throw new Error("no colour found in: " + JSON.stringify(s));
				return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
			};
			const contrast = (fg, bg) => {
				const l1 = luminance(parseColor(fg));
				const l2 = luminance(parseColor(bg));
				const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
				return (hi + 0.05) / (lo + 0.05);
			};
		`;

		test("the light appearance meets the contrast it promised", () => {
			const script = `
				const p = await import("./extensions/hooks/studio-palette.ts");
				${WCAG_HELPERS}
				const ratios = {};
				for (const appearance of ["light", "dark"]) {
					const role = p.resolveStudioTheme({ appearance, fg: (_token, text) => text });
					const bg = appearance === "light" ? "#FFFFFF" : "#1E1E1E";
					ratios[appearance + "/text"] = contrast(role.text("x"), bg);
					ratios[appearance + "/accent"] = contrast(role.accent("x"), bg);
				}
				for (const [key, value] of Object.entries(ratios)) {
					if (value < 4.5) throw new Error("contrast below 4.5:1 for " + key + ": " + value.toFixed(2));
				}
				console.log("RATIOS " + JSON.stringify(Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, Number(v.toFixed(2))]))));
			`;
			const out = runScript(script);
			// Surfaced for the delivery receipt: the exact ratios the suite computes.
			const ratios = /RATIOS (\{.*\})/.exec(out);
			if (ratios) process.stdout.write("computed contrast: " + ratios[1] + "\n");
		}, 30000);

		test("semantic roles follow the theme, the brand does not", () => {
			const script = `
				const p = await import("./extensions/hooks/studio-palette.ts");
				${WCAG_HELPERS}
				const tokens = [];
				const role = p.resolveStudioTheme({
					appearance: "dark",
					fg: (token, text) => { tokens.push(token); return "MARKER:" + token + ":" + text; },
				});
				const routed = [["success", "success"], ["error", "error"], ["warn", "warning"], ["muted", "dim"]];
				for (const [fn, token] of routed) {
					const out = role[fn]("x");
					if (out !== "MARKER:" + token + ":x") {
						throw new Error("role " + fn + " did not route through the theme token '" + token + "': " + JSON.stringify(out));
					}
				}
				if (JSON.stringify(tokens) !== JSON.stringify(["success", "error", "warning", "dim"])) {
					throw new Error("unexpected token calls: " + tokens.join(","));
				}
				// The brand accent is a hue with two luminances, never a theme token.
				const before = tokens.length;
				role.accent("x");
				if (tokens.length !== before) throw new Error("the brand accent must never call the theme");
				const light = p.resolveStudioTheme({ appearance: "light", fg: (token) => { tokens.push(token); return "MARKER"; } });
				if (JSON.stringify(parseColor(light.accent("x"))) !== JSON.stringify(parseColor("#5C6E97"))) {
					throw new Error("light accent must be BRAND_LIGHT #5C6E97");
				}
				if (JSON.stringify(parseColor(light.text("x"))) !== JSON.stringify(parseColor("#2F333A"))) {
					throw new Error("light text must be TEXT_LIGHT #2F333A");
				}
			`;
			runScript(script);
		}, 30000);

		test("no theme keeps today's palette", () => {
			const script = `
				const p = await import("./extensions/hooks/studio-palette.ts");
				const expected = {
					success: p.SUCCESS, error: p.ERROR, warn: p.WARNING, muted: p.MUTED,
					accent: p.ACCENT, text: p.TEXT, faint: p.FAINT,
				};
				const check = (label, role) => {
					for (const [fn, colour] of Object.entries(expected)) {
						const out = role[fn]("x");
						if (out !== colour + "x" + p.RESET) {
							throw new Error(label + ": role " + fn + " drifted from the studio palette: " + JSON.stringify(out));
						}
					}
				};
				check("no theme", p.resolveStudioTheme());
				check("undefined theme", p.resolveStudioTheme(undefined));
				check("theme without fg", p.resolveStudioTheme({}));
				check("throwing fg", p.resolveStudioTheme({ fg: () => { throw new Error("boom"); } }));
				// faint is decoration, not text: even a working theme never reroutes it.
				const themed = p.resolveStudioTheme({ appearance: "dark", fg: (token, text) => "MARKER:" + text });
				if (themed.faint("x") !== p.FAINT + "x" + p.RESET) {
					throw new Error("faint must stay the studio's own decoration colour");
				}
			`;
			runScript(script);
		}, 30000);
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
