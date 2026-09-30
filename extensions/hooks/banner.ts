import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";
import { readProducerState } from "./studio-start.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
// Gentle Shell authentic color palette
const GENTLE_ACCENT = "\x1b[38;2;255;118;195m"; // Rose / Brand Accent
const GENTLE_LABEL = "\x1b[38;2;200;100;160m";  // Muted Rose Label
const GENTLE_VALUE = "\x1b[38;2;246;239;243m";  // Pearl White Text
const GENTLE_HIGHLIGHT = "\x1b[38;2;255;177;221m"; // Version Highlight
const GENTLE_DIM = "\x1b[38;2;118;97;107m";     // Subdued Rose Dim
const GENTLE_GOLD = "\x1b[38;2;224;194;122m";    // Tips Champagne Gold

export function isArtEnabled(_root: string): boolean {
	return false;
}

export function setArtEnabled(_root: string, _enabled: boolean): void {}

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
	let version = "0.8.18";
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

	const isWide = width >= 105;
	lines.push("");

	// Title centered
	const titleRaw = `PI GAME STUDIO · v${version} · 55 agents / 80 skills`;
	const titlePad = Math.max(0, Math.floor((width - titleRaw.length) / 2));
	const titleLine = " ".repeat(titlePad) + `${GENTLE_ACCENT}${BOLD}PI GAME STUDIO${RESET} ${GENTLE_DIM}·${RESET} ${GENTLE_HIGHLIGHT}v${version}${RESET} ${GENTLE_DIM}· 55 agents / 80 skills${RESET}`;
	lines.push(titleLine);
	lines.push("");

	const lW = 10;
	if (isWide) {
		const vW = 38;
		const gridSpan = lW + vW + 3 + lW + vW; // 99 columns
		const gridPad = Math.max(0, Math.floor((width - gridSpan) / 2));
		const padStr = " ".repeat(gridPad);

		const addWide = (l1: string, v1: string, l2: string, v2: string) => {
			const col1 = `${GENTLE_LABEL}${fit(l1, lW)}${RESET} ${GENTLE_VALUE}${fit(v1, vW)}${RESET}`;
			const col2 = `${GENTLE_LABEL}${fit(l2, lW)}${RESET} ${GENTLE_VALUE}${fit(v2, vW)}${RESET}`;
			lines.push(`${padStr}${col1}   ${col2}`);
		};
		addWide("GIT:", gitBranch, "PATH:", shortPath);
		addWide("ENGINE:", engineInfo, "STORAGE:", engramStatus);
		addWide("AGENTS:", `${setup.agentsInstalled} activos (52 especialistas & leads)`, "SKILLS:", "80 loaded · 44 templates");
		addWide("STAGE:", stage, "CONFIG:", setup.hasProjectYaml ? "project.yaml" : "default");
		lines.push(`${padStr}${GENTLE_GOLD}${fit("TIPS:", lW)}${RESET} ${GENTLE_DIM}/studio (Catálogo) · /studio:setup (Setup) · /start (Inicio)${RESET}`);
	} else {
		const vW = Math.max(20, width - lW - 6);
		const narrowPad = Math.max(0, Math.floor((width - (lW + vW + 1)) / 2));
		const padStr = " ".repeat(narrowPad);
		const addNarrow = (label: string, value: string) => {
			lines.push(`${padStr}${GENTLE_LABEL}${fit(label, lW)}${RESET} ${GENTLE_VALUE}${fit(value, vW)}${RESET}`);
		};
		addNarrow("GIT:", gitBranch);
		addNarrow("PATH:", shortPath);
		addNarrow("ENGINE:", engineInfo);
		addNarrow("AGENTS:", `${setup.agentsInstalled} activos (52 especialistas & leads)`);
		addNarrow("STAGE:", stage);
		addNarrow("STORAGE:", engramStatus);
		lines.push(`${padStr}${GENTLE_GOLD}${fit("TIPS:", lW)}${RESET} ${GENTLE_DIM}/studio · /start${RESET}`);
	}

	lines.push("");
	return lines;
}
