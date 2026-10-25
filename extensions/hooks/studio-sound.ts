import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findStudioRoot } from "./studio-root.ts";

export type ChimeType = "success" | "alert" | "error";

let soundEnabledInMemory = true;
export const playedChimesHistory: ChimeType[] = [];

const SAMPLE_RATE = 22050; // Authentic 8-bit / chiptune sample rate

/**
 * Creates an uncompressed 16-bit mono PCM WAV buffer from float samples [-1.0, 1.0].
 */
function createWavBuffer(samples: Float32Array): Buffer {
	const numSamples = samples.length;
	const subChunk2Size = numSamples * 2;
	const chunkSize = 36 + subChunk2Size;
	const buffer = Buffer.alloc(44 + subChunk2Size);

	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(chunkSize, 4);
	buffer.write("WAVE", 8);
	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20); // PCM format
	buffer.writeUInt16LE(1, 22); // Mono
	buffer.writeUInt32LE(SAMPLE_RATE, 24);
	buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // Byte rate
	buffer.writeUInt16LE(2, 32); // Block align
	buffer.writeUInt16LE(16, 34); // Bits per sample
	buffer.write("data", 36);
	buffer.writeUInt32LE(subChunk2Size, 40);

	let offset = 44;
	for (let i = 0; i < numSamples; i++) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
		buffer.writeInt16LE(Math.floor(intSample), offset);
		offset += 2;
	}
	return buffer;
}

/**
 * Synthesizes retro chiptune / arcade 8-bit sound effects:
 * - success: Classic arcade coin / power-up rising tone sequence (B5 988Hz -> E6 1319Hz)
 * - alert: Crisp arcade menu blip / select sound (high 1760Hz pulse)
 * - error: Damage / low buzz falling sequence (downward pitch drop 260Hz -> 65Hz)
 */
export function synthesizeRetroChime(type: ChimeType): Buffer {
	if (type === "success") {
		// 8-bit Coin / Power-up: 2-tone rising arpeggio sequence
		const duration = 0.32;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		const splitSample = Math.floor(totalSamples * 0.28);

		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			const isSecondTone = i >= splitSample;
			const freq = isSecondTone ? 1318.51 : 987.77; // B5 then E6
			const phase = ((freq * (i / SAMPLE_RATE)) % 1);
			// Pulse wave with 25% duty cycle for authentic NES/arcade timbre
			const wave = phase > 0.35 ? 0.6 : -0.6;
			const decay = isSecondTone
				? Math.max(0, 1 - (i - splitSample) / (totalSamples - splitSample))
				: 1.0;
			samples[i] = wave * decay;
		}
		return createWavBuffer(samples);
	}

	if (type === "alert") {
		// Crisp arcade menu blip / select sound
		const duration = 0.08;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		const freq = 1760.0; // A6

		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			const phase = ((freq * (i / SAMPLE_RATE)) % 1);
			const wave = phase > 0.5 ? 0.7 : -0.7;
			const env = Math.max(0, 1 - Math.pow(t, 0.7));
			samples[i] = wave * env;
		}
		return createWavBuffer(samples);
	}

	// error: Damage / low buzz falling frequency sweep
	const duration = 0.35;
	const totalSamples = Math.floor(SAMPLE_RATE * duration);
	const samples = new Float32Array(totalSamples);

	for (let i = 0; i < totalSamples; i++) {
		const t = i / totalSamples;
		const curFreq = 260 - 195 * Math.pow(t, 0.7); // 260Hz down to 65Hz
		const phase = ((curFreq * (i / SAMPLE_RATE)) % 1);
		// Harsh square/saw buzz with grit
		const wave = (phase > 0.6 ? 0.8 : -0.8) + (Math.random() * 0.15 - 0.075);
		const env = Math.max(0, 1 - t);
		samples[i] = wave * env;
	}
	return createWavBuffer(samples);
}

/**
 * Returns cached path to synthesized arcade audio file.
 */
function getCachedChimeFile(type: ChimeType): string {
	const cacheDir = join(tmpdir(), "pi-studio-sfx");
	try {
		mkdirSync(cacheDir, { recursive: true });
	} catch {}

	const filePath = join(cacheDir, `arcade_${type}.wav`);
	if (!existsSync(filePath)) {
		try {
			const buf = synthesizeRetroChime(type);
			writeFileSync(filePath, buf);
		} catch {}
	}
	return filePath;
}

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
 * Executes a lightweight cross-platform retro chiptune sound notification.
 * Uses synthesized arcade WAVs with paplay, pw-play, aplay on Linux, afplay on macOS,
 * powershell Beep on Windows, with terminal bell \x07 as universal fallback.
 */
function triggerSound(type: ChimeType, studioRoot?: string): void {
	if (!isSoundEnabled(studioRoot)) return;

	playedChimesHistory.push(type);

	// In test environment, skip system audio calls
	if (process.env.NODE_ENV === "test") {
		return;
	}

	const wavPath = getCachedChimeFile(type);
	const platform = process.platform;
	let command = "";

	if (platform === "linux") {
		command = `paplay "${wavPath}" 2>/dev/null || pw-play "${wavPath}" 2>/dev/null || aplay -q "${wavPath}" 2>/dev/null || paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null`;
	} else if (platform === "darwin") {
		command = `afplay "${wavPath}" 2>/dev/null || afplay /System/Library/Sounds/Ping.aiff 2>/dev/null`;
	} else if (platform === "win32") {
		if (type === "success") {
			command = 'powershell -c "[console]::beep(988, 80); [console]::beep(1319, 220)"';
		} else if (type === "alert") {
			command = 'powershell -c "[console]::beep(1760, 60)"';
		} else {
			// error: damage / low buzz falling sequence
			command = 'powershell -c "[console]::beep(260, 100); [console]::beep(90, 220)"';
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
 * Retro coin / power-up rising tone sequence.
 */
export function playSuccessChime(studioRoot?: string): void {
	triggerSound("success", studioRoot);
}

/**
 * Plays alert chime: interactive user input/choice is needed.
 * Crisp arcade menu blip / select sound.
 */
export function playAlertChime(studioRoot?: string): void {
	triggerSound("alert", studioRoot);
}

/**
 * Plays error chime: build, test, or QA gate failed.
 * Damage / low buzz falling sequence.
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
		console.log("Notificaciones de audio del estudio: DESACTIVADAS (off)");
		return;
	}

	if (arg === "on" || arg === "enable" || arg === "1") {
		setSoundEnabled(true, root);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify("Notificaciones sonoras activadas.", "info");
		}
		console.log("Notificaciones de audio del estudio: ACTIVADAS (on)");
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
	console.log(`Notificaciones de audio del estudio: ${statusMsg}`);
	if (next) {
		playSuccessChime(root);
	}
}
