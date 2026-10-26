import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { runGit } from "./studio-exec.ts";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";
import { readProducerState } from "./studio-start.ts";

import { BOLD, DIM, RESET, gradientEscape, resolveStudioTheme, type StudioThemeRoles } from "./studio-palette.ts";

export function isArtEnabled(root: string): boolean {
	try {
		const flag = join(root, ".pi", "game-studio", "art-enabled");
		if (existsSync(flag)) {
			return readFileSync(flag, "utf8").trim() !== "false";
		}
	} catch {}
	return true;
}

export function setArtEnabled(root: string, enabled: boolean): void {
	try {
		const dir = join(root, ".pi", "game-studio");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(join(dir, "art-enabled"), enabled ? "true" : "false");
	} catch {}
}

const ART_RAW = [
	"               ⠐⢿⡿⠂               ",
	"           ⢀⣤⣶⣶⣶⣾⣷⣶⣶⣶⣤⡀           ",
	"           ⣿⡇⢸⡏⢩⡍⢩⡍⢹⡇⢸⣿           ",
	"           ⣿⡇⢸⣇⣐⣒⣒⣂⣸⡇⢸⣿           ",
	"           ⠈⠛⠛⣛⣿⣿⣿⣿⣛⠛⠛⠁           ",
	"            ⣴⡟⠩⣿⠍⢉⣭⡉⢻⣦            ",
	"            ⠙⢷⣤⣴⣶⣶⣯⣤⡾⠋            ",
	"              ⣿⠉⣭⣭⠉⣿              ",
	"             ⣿⣶    ⣶⣿             ",
	"           ⢾⣿⣿⡷  ⠸⣿⣿⣷⠆            ",
	"           ⠐⠶⠶⠶⠶  ⠶⠶⠶⠶⠂           ",
];

function getGradientArtLine(line: string, index: number, total: number): string {
	// The art fades from the structural tone into the accent: same family, so the
	// banner stays part of the palette instead of introducing its own colours.
	const t = index / Math.max(1, total - 1);
	return `${gradientEscape(
		[147, 163, 190], // SECONDARY #93A3BE
		[122, 147, 201], // ACCENT #7A93C9
		t,
	)}${line}${RESET}`;
}

function getGitBranch(cwd: string): string {
	const out = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd, timeoutMs: 500 });
	return out || "main";
}

function fit(val: unknown, len: number): string {
	const str = String(val ?? "").replace(/\s+/g, " ").trim();
	if (str.length > len) return str.slice(0, len - 1) + "…";
	return str.padEnd(len);
}

export function renderBanner(width = 80, cwd = process.cwd(), role?: StudioThemeRoles): string[] {
	const lines: string[] = [];
	const root = findStudioRoot(cwd) || cwd;
	// Total by construction: without a theme handle the studio palette is used as-is.
	const r = role ?? resolveStudioTheme();

// Version: resolve dynamically; never hardcode a release number.
// Order: studio repo root package.json (dev checkout), then the stamped
// marker .pi/game-studio/studio.json written when hooks are copied into a
// game project, then a neutral fallback.
let version = "dev";
try {
	const pkgUrl = new URL("../../package.json", import.meta.url);
	if (existsSync(pkgUrl)) {
		const pkg = JSON.parse(readFileSync(pkgUrl, "utf8"));
		if (pkg.version) version = pkg.version;
	}
} catch {}
if (version === "dev") {
	try {
		const stampPath = join(root, ".pi", "game-studio", "studio.json");
		if (existsSync(stampPath)) {
			const stamp = JSON.parse(readFileSync(stampPath, "utf8"));
			if (stamp.studioVersion) version = stamp.studioVersion;
		}
	} catch {}
}

	// Storage / Engram
	let engramStatus = "Local storage";
	try {
		const engramFlag = join(root, ".pi", "game-studio", "engram-enabled");
		if (existsSync(engramFlag) && readFileSync(engramFlag, "utf8").trim() === "true") {
			engramStatus = "Engram connected";
		}
	} catch {}

	const setup = inspectSetup(root);
	const { state: prodState } = readProducerState(root);

	// Engine
	const engineResult = detectProjectEngine(root);
	let engineInfo = formatEngineBadge(engineResult);
	const hasConfiguredEngine = engineResult.detected ||
		(prodState?.engine && prodState.engine !== "Sin motor" && prodState.engine !== "Sin configurar") ||
		(setup.currentEngine && setup.currentEngine !== "Sin configurar");

	if (!hasConfiguredEngine) {
		engineInfo = "Sin motor";
	} else if (!engineResult.detected) {
		engineInfo = prodState?.engine || setup.currentEngine || "Godot · Unity · Unreal · Bevy · Raylib · Phaser";
	}

	const stage = prodState?.milestone || (setup.isConfigured ? "Entorno OK" : "Pendiente setup (/studio:setup)");
	const gitBranch = getGitBranch(root);
	const shortPath = root.replace(process.env.HOME || "", "~");

	lines.push("");

	const artOn = isArtEnabled(root);

	if (artOn && width >= 98) {
		const rightLines: string[] = [
			`${r.accent(BOLD + "P I   G A M E   S T U D I O")}${RESET}   ${r.text("v" + version)}${RESET}`,
			`${r.muted("Autonomous Game Development Studio for Pi")}${RESET}`,
			`${r.muted("──────────────────────────────────────────────────────────")}${RESET}`,
			`${r.muted(fit("GIT:", 11))}${RESET}${r.text(`On branch ${gitBranch}`)}${RESET}`,
			`${r.muted(fit("PATH:", 11))}${RESET}${r.text(shortPath)}${RESET}`,
			`${r.muted(fit("ENGINE:", 11))}${RESET}${r.text(engineInfo)}${RESET}`,
			`${r.muted(fit("AGENTS:", 11))}${RESET}${r.text(`${setup.agentsInstalled} activos (Directors, Leads, Devs)`)}${RESET}`,
			`${r.muted(fit("STAGE:", 11))}${RESET}${r.text(stage)}${RESET}`,
			`${r.muted(fit("SKILLS:", 11))}${RESET}${r.text("6 ODD pipeline (/concept, /spec, /arch, /code, /test, /ship)")}${RESET}`,
			`${r.muted(fit("STORAGE:", 11))}${RESET}${r.text(`${engramStatus} (Persistent Memory)`)}${RESET}`,
			`${r.warn(fit("TIPS:", 11))}${RESET}${r.muted("/concept · /spec · /code · /studio · /studio:setup")}${RESET}`,
		];

		const padStr = "  "; // Clean 2-space left margin, aligned with CLI

		for (let i = 0; i < ART_RAW.length; i++) {
			lines.push(`${padStr}${getGradientArtLine(ART_RAW[i], i, ART_RAW.length)}    ${rightLines[i] || ""}`);
		}
	} else if (artOn && width >= 55) {
		// Stacked layout: Centered Braille art on top, clean status table below (for standard 80-col terminals)
		const artW = 34;
		const artPad = Math.max(0, Math.floor((width - artW) / 2));
		const artPadStr = " ".repeat(artPad);
		for (let i = 0; i < ART_RAW.length; i++) {
			lines.push(`${artPadStr}${getGradientArtLine(ART_RAW[i], i, ART_RAW.length)}`);
		}
		lines.push("");

		const titleRaw = `PI GAME STUDIO · v${version} · 8+1 agents / 6 ODD skills`;
		const titlePad = Math.max(0, Math.floor((width - titleRaw.length) / 2));
		lines.push(" ".repeat(titlePad) + `${r.accent(BOLD + "PI GAME STUDIO")}${RESET} ${r.muted("·")} ${r.text("v" + version)}${RESET} ${r.muted("· 8+1 agents / 6 ODD skills")}${RESET}`);
		lines.push("");

		const lW = 10;
		const vW = Math.max(20, Math.min(width - lW - 6, 60));
		const narrowPad = Math.max(0, Math.floor((width - (lW + vW + 1)) / 2));
		const padStr = " ".repeat(narrowPad);
		const addNarrow = (label: string, value: string) => {
			lines.push(`${padStr}${r.muted(fit(label, lW))}${RESET} ${r.text(fit(value, vW))}${RESET}`);
		};
		addNarrow("GIT:", `On branch ${gitBranch}`);
		addNarrow("PATH:", shortPath);
		addNarrow("ENGINE:", engineInfo);
		addNarrow("AGENTS:", `${setup.agentsInstalled} activos (8 Core + 1 Motor)`);
		addNarrow("STAGE:", stage);
		addNarrow("STORAGE:", engramStatus);
		lines.push(`${padStr}${r.warn(fit("TIPS:", lW))}${RESET} ${r.muted("/concept · /spec · /code · /studio · /studio:setup")}${RESET}`);
	} else {
		// Clean centered compact table
		const titleRaw = `PI GAME STUDIO · v${version} · 8+1 agents / 6 ODD skills`;
		const titlePad = Math.max(0, Math.floor((width - titleRaw.length) / 2));
		lines.push(" ".repeat(titlePad) + `${r.accent(BOLD + "PI GAME STUDIO")}${RESET} ${r.muted("·")} ${r.text("v" + version)}${RESET} ${r.muted("· 8+1 agents / 6 ODD skills")}${RESET}`);
		lines.push("");

		const lW = 10;
		const vW = Math.max(20, width - lW - 6);
		const narrowPad = Math.max(0, Math.floor((width - (lW + vW + 1)) / 2));
		const padStr = " ".repeat(narrowPad);
		const addNarrow = (label: string, value: string) => {
			lines.push(`${padStr}${r.muted(fit(label, lW))}${RESET} ${r.text(fit(value, vW))}${RESET}`);
		};
		addNarrow("GIT:", `On branch ${gitBranch}`);
		addNarrow("PATH:", shortPath);
		addNarrow("ENGINE:", engineInfo);
		addNarrow("AGENTS:", `${setup.agentsInstalled} activos (8 Core + 1 Motor)`);
		addNarrow("STAGE:", stage);
		addNarrow("STORAGE:", engramStatus);
		lines.push(`${padStr}${r.warn(fit("TIPS:", lW))}${RESET} ${r.muted("/concept · /spec · /code · /studio · /studio:setup")}${RESET}`);
	}

	lines.push("");
	return lines;
}
