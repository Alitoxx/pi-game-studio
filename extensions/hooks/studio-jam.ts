import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	ACCENT as PURPLE,
	WHITE,
	GRAY,
	BORDER,
	padAnsi,
	panelBottom,
	panelRow,
	panelTop,
} from "./studio-palette.ts";

const JAM_FILE_RELATIVE = join(".pi", "game-studio", "jam-mode");

/**
 * Checks if Game Jam / Rapid Prototyping mode is currently active.
 */
export function isJamModeActive(cwd?: string): boolean {
	const root = findStudioRoot(cwd || process.cwd()) || (cwd || process.cwd());
	const filePath = join(root, JAM_FILE_RELATIVE);

	if (!existsSync(filePath)) {
		return false;
	}

	try {
		const content = readFileSync(filePath, "utf8").trim().toLowerCase();
		if (content === "false" || content === "disabled" || content === "off" || content === "0") {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Explicitly sets Game Jam mode on or off.
 */
export function setJamMode(active: boolean, cwd?: string): boolean {
	const root = findStudioRoot(cwd || process.cwd()) || (cwd || process.cwd());
	const studioDir = join(root, ".pi", "game-studio");
	const filePath = join(root, JAM_FILE_RELATIVE);

	if (active) {
		try {
			if (!existsSync(studioDir)) {
				mkdirSync(studioDir, { recursive: true });
			}
			writeFileSync(filePath, "enabled", "utf8");
			return true;
		} catch {
			return false;
		}
	} else {
		try {
			if (existsSync(filePath)) {
				unlinkSync(filePath);
			}
			return false;
		} catch {
			try {
				writeFileSync(filePath, "disabled", "utf8");
			} catch {}
			return false;
		}
	}
}

/**
 * Toggles Jam Mode and returns the new active status.
 */
export function toggleJamMode(cwd?: string): boolean {
	const current = isJamModeActive(cwd);
	const next = !current;
	setJamMode(next, cwd);
	return next;
}

/**
 * Renders the terminal status banner for Game Jam Mode.
 */
export function renderJamBanner(active: boolean): string[] {
	const width = 68;
	const innerWidth = width - 4;
	const lines: string[] = [];

	lines.push(panelTop(width - 2, undefined, "rounded", BORDER));
	if (active) {
		lines.push(`${panelRow(`${YELLOW}${BOLD}⚡ GAME JAM / RAPID PROTOTYPING MODE ACTIVADO${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• Confirmaciones no críticas:${RESET} ${GREEN}SILENCIADAS${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• Perf Guard estricto:${RESET}        ${YELLOW}MODO SOFT (solo advertencias)${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• ODD Pipeline:${RESET}               ${PURPLE}Iteración rápida, foco en jugabilidad${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• Persistencia:${RESET}               ${WHITE}.pi/game-studio/jam-mode${RESET}`, innerWidth + 2, BORDER)}`);
	} else {
		lines.push(`${panelRow(`${PURPLE}${BOLD}🛡️ MODO STUDIO ESTÁNDAR (PRODUCCIÓN)${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• Confirmaciones interactivas:${RESET} ${GREEN}ACTIVAS${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• Perf Guard:${RESET}                  ${GREEN}ESTRICTO (cero allocs en loop)${RESET}`, innerWidth + 2, BORDER)}`);
		lines.push(`${panelRow(`${GRAY}• ODD Pipeline:${RESET}               ${WHITE}Estándar (~400 líneas / test)${RESET}`, innerWidth + 2, BORDER)}`);
	}
	lines.push(panelBottom(width - 2, "rounded", BORDER));

	return lines;
}

/**
 * Command handler for /studio:jam and /jam.
 */
export function handleStudioJam(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	return handleStudioJamImpl(args, ctx);
}

async function handleStudioJamImpl(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const root = findStudioRoot(ctx.cwd) || ctx.cwd;
	const query = (args || "").trim().toLowerCase();

	let nextState: boolean;
	if (query === "on" || query === "enable" || query === "1" || query === "activar") {
		setJamMode(true, root);
		nextState = true;
	} else if (query === "off" || query === "disable" || query === "0" || query === "desactivar") {
		setJamMode(false, root);
		nextState = false;
	} else if (query === "status" || query === "info") {
		nextState = isJamModeActive(root);
	} else {
		nextState = toggleJamMode(root);
	}

	const banner = renderJamBanner(nextState);
	for (const line of banner) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const notifyMsg = nextState
			? "⚡ Jam Mode Activado: Perf Guard relajado a soft warnings y prompts de rápida iteración."
			: "🛡️ Jam Mode Desactivado: Restaurado modo producción con controles estrictos.";
		(ctx.ui as any).notify(notifyMsg, nextState ? "warning" : "info");
	}
}
