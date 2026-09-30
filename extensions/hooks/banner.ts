import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";
import { readProducerState } from "./studio-start.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[38;2;107;114;128m";
const VIOLET = "\x1b[38;2;167;139;250m";
const CYAN = "\x1b[38;2;56;189;248m";
const GREEN = "\x1b[38;2;52;211;153m";
const WHITE = "\x1b[38;2;243;244;246m";
const GOLD = "\x1b[38;2;251;191;36m";

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

	lines.push("");
	// Header Brand — clean single line like Gentle Shell
	lines.push(`  ${VIOLET}${BOLD}🎮 PI GAME STUDIO${RESET} ${DIM}·${RESET} ${CYAN}v${version}${RESET} ${DIM}· 55 agents / 80 skills${RESET}`);
	lines.push("");

	const isWide = width >= 105;

	if (isWide) {
		const lW = 10;
		const v1W = Math.min(38, Math.floor((width - 40) / 2));
		const v2W = Math.min(42, Math.floor((width - 40) / 2));

		const addWide = (l1: string, v1: string, l2: string, v2: string) => {
			const col1 = `${VIOLET}${fit(l1, lW)}${RESET} ${WHITE}${fit(v1, v1W)}${RESET}`;
			const col2 = `${VIOLET}${fit(l2, lW)}${RESET} ${WHITE}${fit(v2, v2W)}${RESET}`;
			lines.push(`  ${col1}   ${col2}`);
		};

		addWide("GIT:", gitBranch, "PATH:", shortPath);
		addWide("ENGINE:", engineInfo, "STORAGE:", engramStatus);
		addWide("AGENTS:", `${setup.agentsInstalled} activos (52 especialistas & leads)`, "SKILLS:", "80 loaded · 44 templates");
		addWide("STAGE:", stage, "CONFIG:", setup.hasProjectYaml ? "project.yaml" : "default");
		lines.push(`  ${GOLD}${fit("TIPS:", lW)}${RESET} ${DIM}/studio (Catálogo) · /studio:setup (Setup) · /start (Inicio)${RESET}`);
	} else {
		const lW = 10;
		const vW = Math.max(20, width - lW - 6);

		const addNarrow = (label: string, value: string) => {
			lines.push(`  ${VIOLET}${fit(label, lW)}${RESET} ${WHITE}${fit(value, vW)}${RESET}`);
		};

		addNarrow("GIT:", gitBranch);
		addNarrow("PATH:", shortPath);
		addNarrow("ENGINE:", engineInfo);
		addNarrow("AGENTS:", `${setup.agentsInstalled} activos`);
		addNarrow("STAGE:", stage);
		addNarrow("STORAGE:", engramStatus);
		lines.push(`  ${GOLD}${fit("TIPS:", lW)}${RESET} ${DIM}/studio · /start${RESET}`);
	}

	lines.push("");
	return lines;
}
