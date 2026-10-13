import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";

export type ChimeType = "success" | "alert" | "error";

let soundEnabledInMemory = true;
export const playedChimesHistory: ChimeType[] = [];

/**
 * Checks whether audio notifications are enabled.
 * Defaults to true.
 */
export function isSoundEnabled(studioRoot?: string): boolean {
	if (studioRoot) {
		const flag = join(studioRoot, ".pi", "game-studio", "sound-disabled");
		if (existsSync(flag)) return false;

		const soundFile = join(studioRoot, ".pi", "game-studio", "sound");
		if (existsSync(soundFile)) {
			try {
				const val = readFileSync(soundFile, "utf8").trim().toLowerCase();
				if (val === "off" || val === "false" || val === "0") return false;
				if (val === "on" || val === "true" || val === "1") return true;
			} catch {}
		}
	}
	return soundEnabledInMemory;
}

/**
 * Toggles audio notifications on or off and persists preference.
 */
export function setSoundEnabled(enabled: boolean, studioRoot?: string): void {
	soundEnabledInMemory = enabled;

	if (studioRoot) {
		try {
			const dir = join(studioRoot, ".pi", "game-studio");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "sound"), enabled ? "on" : "off", "utf8");

			const flag = join(dir, "sound-disabled");
			if (!enabled) {
				writeFileSync(flag, "true", "utf8");
			} else if (existsSync(flag)) {
				unlinkSync(flag);
			}
		} catch {}
	}
}

/**
 * Executes a lightweight cross-platform sound notification.
 * Uses paplay, pw-play, aplay on Linux, afplay on macOS, powershell Beep on Windows,
 * with terminal bell \x07 as universal fallback.
 */
function triggerSound(type: ChimeType, studioRoot?: string): void {
	if (!isSoundEnabled(studioRoot)) return;

	playedChimesHistory.push(type);

	// In test environment, skip system audio calls
	if (process.env.NODE_ENV === "test") {
		return;
	}

	const platform = process.platform;
	let command = "";

	if (platform === "linux") {
		if (type === "success") {
			command =
				"paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || pw-play /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null";
		} else if (type === "alert") {
			command =
				"paplay /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null || pw-play /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null || paplay /usr/share/sounds/freedesktop/stereo/message.oga 2>/dev/null";
		} else {
			// error
			command =
				"paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga 2>/dev/null || pw-play /usr/share/sounds/freedesktop/stereo/dialog-error.oga 2>/dev/null || paplay /usr/share/sounds/freedesktop/stereo/dialog-warning.oga 2>/dev/null";
		}
	} else if (platform === "darwin") {
		if (type === "success") {
			command = "afplay /System/Library/Sounds/Glass.aiff 2>/dev/null";
		} else if (type === "alert") {
			command = "afplay /System/Library/Sounds/Ping.aiff 2>/dev/null";
		} else {
			// error
			command =
				"afplay /System/Library/Sounds/Basso.aiff 2>/dev/null || afplay /System/Library/Sounds/Sosumi.aiff 2>/dev/null";
		}
	} else if (platform === "win32") {
		if (type === "success") {
			command = 'powershell -c "[console]::beep(1046, 120); [console]::beep(1318, 160)"';
		} else if (type === "alert") {
			command = 'powershell -c "[console]::beep(880, 150)"';
		} else {
			// error
			command = 'powershell -c "[console]::beep(440, 250); [console]::beep(330, 300)"';
		}
	}

	if (command) {
		exec(command, (err) => {
			if (err) {
				try {
					process.stdout.write("\x07");
				} catch {}
			}
		});
	} else {
		try {
			process.stdout.write("\x07");
		} catch {}
	}
}

/**
 * Plays success chime: subagent finished successfully or milestone hit.
 */
export function playSuccessChime(studioRoot?: string): void {
	triggerSound("success", studioRoot);
}

/**
 * Plays alert chime: interactive user input/choice is needed.
 */
export function playAlertChime(studioRoot?: string): void {
	triggerSound("alert", studioRoot);
}

/**
 * Plays error chime: build, test, or QA gate failed.
 */
export function playErrorChime(studioRoot?: string): void {
	triggerSound("error", studioRoot);
}

/**
 * CLI command handler for /studio:sound on|off
 */
export async function handleStudioSound(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const root = findStudioRoot(ctx.cwd) || ctx.cwd;
	const arg = (args || "").trim().toLowerCase();

	if (arg === "off" || arg === "disable" || arg === "0") {
		setSoundEnabled(false, root);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify("Notificaciones sonoras desactivadas.", "info");
		}
		console.log("▎ Notificaciones de audio del estudio: DESACTIVADAS (off)");
		return;
	}

	if (arg === "on" || arg === "enable" || arg === "1") {
		setSoundEnabled(true, root);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify("Notificaciones sonoras activadas.", "info");
		}
		console.log("▎ Notificaciones de audio del estudio: ACTIVADAS (on)");
		playSuccessChime(root);
		return;
	}

	// Toggle if no argument or invalid
	const current = isSoundEnabled(root);
	const next = !current;
	setSoundEnabled(next, root);
	const statusMsg = next ? "ACTIVADAS (on)" : "DESACTIVADAS (off)";

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(
			`Notificaciones sonoras ${next ? "activadas" : "desactivadas"}.`,
			"info",
		);
	}
	console.log(`▎ Notificaciones de audio del estudio: ${statusMsg}`);
	if (next) {
		playSuccessChime(root);
	}
}
