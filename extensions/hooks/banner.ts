import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const VIOLET = "\x1b[38;2;167;139;250m";
const CYAN = "\x1b[38;2;56;189;248m";
const GREEN = "\x1b[38;2;52;211;153m";
const GOLD = "\x1b[38;2;251;191;36m";
const DIM = "\x1b[38;2;107;114;128m";
const WHITE = "\x1b[38;2;243;244;246m";

function visibleLength(str: string): number {
	const clean = str.replace(/\x1b\[[0-9;]*m/g, "");
	let len = 0;
	for (const ch of clean) {
		const cp = ch.codePointAt(0) ?? 0;
		if (cp >= 0x1f000 && cp <= 0x1f9ff) {
			len += 2;
		} else {
			len += 1;
		}
	}
	return len;
}

function formatRow(styledContent: string, targetWidth = 73): string {
	const vis = visibleLength(styledContent);
	const pad = Math.max(0, targetWidth - vis);
	return `  ${DIM}│${RESET} ${styledContent}${" ".repeat(pad)} ${DIM}│${RESET}`;
}

export function renderBanner(width = 80, cwd = process.cwd()): string[] {
	const lines: string[] = [];
	const root = findStudioRoot(cwd) || cwd;

	// Package version detection
	let version = "0.8.17";
	try {
		const pkgUrl = new URL("../../package.json", import.meta.url);
		if (existsSync(pkgUrl)) {
			const pkg = JSON.parse(readFileSync(pkgUrl, "utf8"));
			if (pkg.version) version = pkg.version;
		}
	} catch {}

	// Storage / Engram detection
	let engramStatus = "Local storage";
	try {
		const engramFlag = join(root, ".pi", "game-studio", "engram-enabled");
		if (existsSync(engramFlag) && readFileSync(engramFlag, "utf8").trim() === "true") {
			engramStatus = "Engram connected";
		}
	} catch {}

	// Engine detection & auto-sniffing
	const engineResult = detectProjectEngine(root);
	let engineInfo = formatEngineBadge(engineResult);

	if (!engineResult.detected) {
		engineInfo = "Godot · Unity · Unreal · Bevy · Raylib";
		try {
			const prefsPath = join(root, ".pi", "game-studio", "technical-preferences.md");
			if (existsSync(prefsPath)) {
				const prefs = readFileSync(prefsPath, "utf8");
				const engineMatch = prefs.match(/Engine:\s*([^\n]+)/i);
				if (engineMatch && !engineMatch[1].includes("[TO BE CONFIGURED]")) {
					engineInfo = engineMatch[1].trim();
				}
			}
		} catch {}
	}

	const setup = inspectSetup(root);
	const cardWidth = Math.min(Math.max(width - 4, 60), 74);
	const ruleLen = Math.max(0, cardWidth - 30);

	const envBadge = setup.isConfigured
		? `${GREEN}✔ Configurado (${setup.agentsInstalled} agentes activos)${RESET}`
		: `${GOLD}⚠ Pendiente (/start o /studio:setup)${RESET}`;

	lines.push("");
	lines.push(`  ${DIM}╭─${RESET} ${VIOLET}${BOLD}🎮 PI GAME STUDIO${RESET} ${DIM}·${RESET} ${CYAN}v${version}${RESET} ${DIM}${"─".repeat(ruleLen)}╮${RESET}`);
	lines.push(formatRow(`${VIOLET}${BOLD}DIRECTORS  ${RESET}${DIM}:${RESET} ${WHITE}3 activos${RESET} ${DIM}(Creative · Technical · Producer)${RESET}`, cardWidth));
	lines.push(formatRow(`${VIOLET}${BOLD}WORKHORSES ${RESET}${DIM}:${RESET} ${WHITE}52 especialistas & leads${RESET} ${DIM}(Diseño, Código, Arte, Audio, QA)${RESET}`, cardWidth));
	lines.push(formatRow(`${VIOLET}${BOLD}ENGINES    ${RESET}${DIM}:${RESET} ${CYAN}${engineInfo}${RESET}`, cardWidth));
	lines.push(formatRow(`${VIOLET}${BOLD}SKILLS     ${RESET}${DIM}:${RESET} ${GREEN}80 comandos slash${RESET}  ${DIM}│${RESET}  ${VIOLET}${BOLD}TEMPLATES :${RESET} ${GREEN}44 docs${RESET}`, cardWidth));
	lines.push(formatRow(`${VIOLET}${BOLD}ENTORNO    ${RESET}${DIM}:${RESET} ${envBadge}`, cardWidth));
	lines.push(formatRow(`${VIOLET}${BOLD}CONFIG     ${RESET}${DIM}:${RESET} ${WHITE}project.yaml${RESET}       ${DIM}│${RESET}  ${VIOLET}${BOLD}STORAGE   :${RESET} ${GREEN}${engramStatus}${RESET}`, cardWidth));
	lines.push(`  ${DIM}├${"─".repeat(cardWidth + 2)}┤${RESET}`);
	lines.push(formatRow(`${GOLD}${BOLD}💡 COMANDOS${RESET}${DIM}:${RESET} ${WHITE}/studio${RESET} ${DIM}(Menú)${RESET} · ${WHITE}/studio:setup${RESET} ${DIM}(Setup)${RESET} · ${WHITE}/start${RESET} ${DIM}(Inicio)${RESET}`, cardWidth));
	lines.push(`  ${DIM}╰${"─".repeat(cardWidth + 2)}╯${RESET}`);
	lines.push("");

	return lines;
}
