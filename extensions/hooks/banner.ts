import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
		// Emoji & wide unicode range
		if (cp >= 0x1f000 && cp <= 0x1f9ff) {
			len += 2;
		} else {
			len += 1;
		}
	}
	return len;
}

function center(line: string, totalWidth: number): string {
	const vis = visibleLength(line);
	if (vis === 0) return "";
	const pad = Math.max(0, Math.floor((totalWidth - vis) / 2));
	return " ".repeat(pad) + line;
}

function formatRow(styledContent: string, targetWidth = 75): string {
	const vis = visibleLength(styledContent);
	const pad = Math.max(0, targetWidth - vis);
	return `${DIM}│ ${RESET}${styledContent}${" ".repeat(pad)}${DIM} │${RESET}`;
}

export function renderBanner(width = 80, cwd = process.cwd()): string[] {
	const lines: string[] = [];

	// Package version detection
	let version = "0.6.3";
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
		const engramFlag = join(cwd, ".pi", "game-studio", "engram-enabled");
		if (existsSync(engramFlag) && readFileSync(engramFlag, "utf8").trim() === "true") {
			engramStatus = "Engram connected";
		}
	} catch {}

	// Engine detection
	let engineInfo = "Godot · Unity · Unreal · Bevy";
	try {
		const projectYaml = join(cwd, "project.yaml");
		if (existsSync(projectYaml)) {
			const yamlContent = readFileSync(projectYaml, "utf8");
			const m = yamlContent.match(/^engine:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1] && m[1] !== "null" && m[1] !== "unknown") {
				engineInfo = m[1].charAt(0).toUpperCase() + m[1].slice(1);
			}
		}
	} catch {}

	if (engineInfo === "Godot · Unity · Unreal · Bevy") {
		try {
			const prefsPath = join(cwd, ".pi", "game-studio", "technical-preferences.md");
			if (existsSync(prefsPath)) {
				const prefs = readFileSync(prefsPath, "utf8");
				const engineMatch = prefs.match(/Engine:\s*([^\n]+)/i);
				if (engineMatch && !engineMatch[1].includes("[TO BE CONFIGURED]")) {
					engineInfo = engineMatch[1].trim();
				}
			}
		} catch {}
	}

	if (width >= 80) {
		const boxWidth = 75; // inner width between │ and │
		lines.push("");

		const logoLines = [
			"██████╗ ██╗     ██████╗  █████╗ ███╗   ███╗███████╗",
			"██╔══██╗██║    ██╔════╝ ██╔══██╗████╗ ████║██╔════╝",
			"██████╔╝██║    ██║  ███╗███████║██╔████╔██║█████╗  ",
			"██╔═══╝ ██║    ██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ",
			"██║     ██║    ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗",
			"╚═╝     ╚═╝     ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝",
		];
		for (const logo of logoLines) {
			lines.push(center(`${VIOLET}${BOLD}${logo}${RESET}`, width));
		}
		lines.push(center(`${CYAN}S  T  U  D  I  O   ·   v ${version.split("").join(" ")}${RESET}`, width));
		lines.push("");

		lines.push(center(`${DIM}┌${"─".repeat(boxWidth + 2)}┐${RESET}`, width));

		lines.push(
			center(
				formatRow(
					`${VIOLET}${BOLD}DIRECTORS  ${RESET}${DIM}:${RESET} ${WHITE}3 activos${RESET} ${DIM}(Creative · Technical · Producer)${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(
			center(
				formatRow(
					`${VIOLET}${BOLD}WORKHORSES ${RESET}${DIM}:${RESET} ${WHITE}44 especialistas${RESET} ${DIM}(Diseño, Código, Arte, Audio, QA)${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(
			center(
				formatRow(
					`${VIOLET}${BOLD}ENGINES    ${RESET}${DIM}:${RESET} ${CYAN}${engineInfo}${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(
			center(
				formatRow(
					`${VIOLET}${BOLD}SKILLS     ${RESET}${DIM}:${RESET} ${GREEN}77 comandos slash${RESET}  ${DIM}│${RESET}  ${VIOLET}${BOLD}TEMPLATES :${RESET} ${GREEN}43 docs${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(
			center(
				formatRow(
					`${VIOLET}${BOLD}CONFIG     ${RESET}${DIM}:${RESET} ${WHITE}project.yaml${RESET}       ${DIM}│${RESET}  ${VIOLET}${BOLD}STORAGE   :${RESET} ${GREEN}${engramStatus}${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(center(`${DIM}├${"─".repeat(boxWidth + 2)}┤${RESET}`, width));
		lines.push(
			center(
				formatRow(
					`${GOLD}${BOLD}💡 TIPS     ${RESET}${DIM}:${RESET} ${WHITE}/studio${RESET} ${DIM}(Menú)${RESET} · ${WHITE}/studio:setup${RESET} ${DIM}(Setup)${RESET} · ${WHITE}/start${RESET} ${DIM}(Inicio)${RESET}`,
					boxWidth,
				),
				width,
			),
		);
		lines.push(center(`${DIM}└${"─".repeat(boxWidth + 2)}┘${RESET}`, width));
		lines.push("");
	} else {
		lines.push(center(`${VIOLET}${BOLD}🎮 PI GAME STUDIO v${version}${RESET}`, width));
		lines.push(center(`${CYAN}50 Agentes · 77 Skills · 43 Templates · 4 Hooks${RESET}`, width));
		lines.push(center(`${WHITE}Motores: ${engineInfo}${RESET}`, width));
		lines.push(center(`${GOLD}💡 Usa /studio o /studio:setup para comenzar con tu videojuego${RESET}`, width));
	}

	return lines;
}
