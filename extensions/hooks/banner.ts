import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";
import { readProducerState } from "./studio-start.ts";

import {
	RESET,
	BOLD,
	DIM,
	ACCENT as STUDIO_ACCENT,
	SECONDARY as STUDIO_LABEL,
	WHITE as STUDIO_VALUE,
	HEADING as STUDIO_HIGHLIGHT,
	GRAY as STUDIO_DIM,
	YELLOW as STUDIO_GOLD,
} from "./studio-palette.ts";

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
	"        ⢀⣀⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⠀  ",
	"   ⠀⢀⣴⠟⠋⠁⠀⠀⠀⠀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀  ",
	"  ⢠⡿⣡⡶⠾⠟⢿⡇⠀⣼⡏⣉⣍⠙⣷⠀⠀⣿⠛⠛⠛⠛⠛⠛⠀  ",
	"  ⢼⣿⠏⠀⠀⠀⢸⡇⠀⣿⡟⢻⡟⠃⣿⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀  ",
	"  ⠀⠀⠀⠀⢰⡾⠿⣿⠿⠿⠃⠈⠁⠀⠿⠾⢿⠿⢷⣆⠀⠀⠀⠀⠀  ",
	"  ⠀⠀⠀⠀⢸⡇⢾⣿⠶⠆⠀⠀⠀⠀⠰⠶⢾⣷⢸⣿⠀⠀⠀⠀⠀  ",
	"  ⠀⠀⠀⠀⠸⣧⣤⣭⣤⣤⡄⢀⡀⠀⣤⣤⣬⣥⣼⠟⠀⠀⠀⠀⠀  ",
	"  ⠀⠀⠀⠀⠀⠀⣼⠇⠀⣾⣧⣼⣧⡄⣿⠀⠀⣿⠀⠀⠀⢠⣶⣶⠀  ",
	"  ⠀⠀⣠⣤⣴⠾⠋⠀⠀⣿⣇⣙⣋⣠⣿⡀⠀⠻⣦⣤⣴⠟⢱⡟⠀  ",
	"  ⠀⠀⣽⡇⠀⠀⠀⠀⢰⡟⠉⠉⠉⠉⠙⢷⣄⠀⠀⠀⢀⣴⠟⠁⠀  ",
	"  ⠀⠀⠙⠛⠛⠛⠛⠛⠛⠁⠀⠀⠀⠀⠀⠀⠙⠛⠛⠛⠛⠁⠀⠀⠀  ",
];

function getGradientArtLine(line: string, index: number, total: number): string {
	const c1 = [103, 232, 249]; // Glacial Cyan #67E8F9
	const c2 = [167, 139, 250]; // Midnight Amethyst #A78BFA
	const t = index / Math.max(1, total - 1);
	const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
	const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
	const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
	return `\x1b[38;2;${r};${g};${b}m${line}${RESET}`;
}

function getGitBranch(cwd: string): string {
	try {
		const out = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
			cwd,
			encoding: "utf8",
			timeout: 500,
		}).trim();
		if (out) return out;
	} catch {}
	return "main";
}

function fit(val: unknown, len: number): string {
	const str = String(val ?? "").replace(/\s+/g, " ").trim();
	if (str.length > len) return str.slice(0, len - 1) + "…";
	return str.padEnd(len);
}

export function renderBanner(width = 80, cwd = process.cwd()): string[] {
	const lines: string[] = [];
	const root = findStudioRoot(cwd) || cwd;

	// Version
	let version = "1.2.0";
	try {
		const pkgUrl = new URL("../../package.json", import.meta.url);
		if (existsSync(pkgUrl)) {
			const pkg = JSON.parse(readFileSync(pkgUrl, "utf8"));
			if (pkg.version) version = pkg.version;
		}
	} catch {}

	// Storage / Engram
	let engramStatus = "Local storage";
	try {
		const engramFlag = join(root, ".pi", "game-studio", "engram-enabled");
		if (existsSync(engramFlag) && readFileSync(engramFlag, "utf8").trim() === "true") {
			engramStatus = "Engram connected";
		}
	} catch {}

	// Engine
	const engineResult = detectProjectEngine(root);
	let engineInfo = formatEngineBadge(engineResult);
	if (!engineResult.detected) {
		engineInfo = "Godot · Unity · Unreal · Bevy · Raylib";
	}

	const setup = inspectSetup(root);
	const { state: prodState } = readProducerState(root);
	const stage = prodState?.milestone || (setup.isConfigured ? "Entorno OK" : "Pendiente setup (/start)");
	const gitBranch = getGitBranch(root);
	const shortPath = root.replace(process.env.HOME || "", "~");

	lines.push("");

	const showArt = isArtEnabled(root) && width >= 90;

	if (showArt) {
		const rightLines: string[] = [
			`${STUDIO_ACCENT}${BOLD}P I   G A M E   S T U D I O${RESET}   ${STUDIO_HIGHLIGHT}v${version}${RESET}`,
			`${STUDIO_DIM}Autonomous Game Development Studio for Pi${RESET}`,
			`${STUDIO_DIM}──────────────────────────────────────────────────────────${RESET}`,
			`${STUDIO_LABEL}${fit("GIT:", 11)}${RESET}${STUDIO_VALUE}On branch ${gitBranch}${RESET}`,
			`${STUDIO_LABEL}${fit("PATH:", 11)}${RESET}${STUDIO_VALUE}${shortPath}${RESET}`,
			`${STUDIO_LABEL}${fit("ENGINE:", 11)}${RESET}${STUDIO_VALUE}${engineInfo}${RESET}`,
			`${STUDIO_LABEL}${fit("AGENTS:", 11)}${RESET}${STUDIO_VALUE}${setup.agentsInstalled} activos (Directors, Leads, Devs)${RESET}`,
			`${STUDIO_LABEL}${fit("STAGE:", 11)}${RESET}${STUDIO_VALUE}${stage}${RESET}`,
			`${STUDIO_LABEL}${fit("SKILLS:", 11)}${RESET}${STUDIO_VALUE}6 ODD pipeline (/concept, /spec, /arch, /code, /test, /ship)${RESET}`,
			`${STUDIO_LABEL}${fit("STORAGE:", 11)}${RESET}${STUDIO_VALUE}${engramStatus} (Persistent Memory)${RESET}`,
			`${STUDIO_GOLD}${fit("TIPS:", 11)}${RESET}${STUDIO_DIM}/concept · /spec · /code · /studio · /studio:setup${RESET}`,
		];

		const totalBlockW = 104;
		const pad = Math.max(0, Math.floor((width - totalBlockW) / 2));
		const padStr = " ".repeat(pad);

		for (let i = 0; i < ART_RAW.length; i++) {
			lines.push(`${padStr}${getGradientArtLine(ART_RAW[i], i, ART_RAW.length)}    ${rightLines[i] || ""}`);
		}
	} else {
		// Clean centered compact table
		const titleRaw = `PI GAME STUDIO · v${version} · 8+1 agents / 6 ODD skills`;
		const titlePad = Math.max(0, Math.floor((width - titleRaw.length) / 2));
		lines.push(" ".repeat(titlePad) + `${STUDIO_ACCENT}${BOLD}PI GAME STUDIO${RESET} ${STUDIO_DIM}·${RESET} ${STUDIO_HIGHLIGHT}v${version}${RESET} ${STUDIO_DIM}· 8+1 agents / 6 ODD skills${RESET}`);
		lines.push("");

		const lW = 10;
		const vW = Math.max(20, width - lW - 6);
		const narrowPad = Math.max(0, Math.floor((width - (lW + vW + 1)) / 2));
		const padStr = " ".repeat(narrowPad);
		const addNarrow = (label: string, value: string) => {
			lines.push(`${padStr}${STUDIO_LABEL}${fit(label, lW)}${RESET} ${STUDIO_VALUE}${fit(value, vW)}${RESET}`);
		};
		addNarrow("GIT:", `On branch ${gitBranch}`);
		addNarrow("PATH:", shortPath);
		addNarrow("ENGINE:", engineInfo);
		addNarrow("AGENTS:", `${setup.agentsInstalled} activos (8 Core + 1 Motor)`);
		addNarrow("STAGE:", stage);
		addNarrow("STORAGE:", engramStatus);
		lines.push(`${padStr}${STUDIO_GOLD}${fit("TIPS:", lW)}${RESET} ${STUDIO_DIM}/concept · /spec · /code · /studio · /studio:setup${RESET}`);
	}

	lines.push("");
	return lines;
}
