// Studio Palette — Unified Nordic & Sober GameDev Theme
// Inspired by Gentle Shell's sober aesthetic, tuned with Midnight Amethyst & Glacial Cyan for Pi Game Studio

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

// Primary Accents
export const ACCENT = "\x1b[38;2;167;139;250m";     // #A78BFA — Soft Amethyst / Violet (Brand core)
export const SECONDARY = "\x1b[38;2;103;232;249m";  // #67E8F9 — Glacial Cyan / Tech Blue
export const HEADING = "\x1b[38;2;196;181;253m";    // #C4B5FD — Light Lavender heading

// Status & Semantic Colors (Soft, desaturated pastel tones)
export const GREEN = "\x1b[38;2;167;243;208m";      // #A7F3D0 — Soft Sage / Mint Green (Success)
export const YELLOW = "\x1b[38;2;253;230;138m";     // #FDE68A — Warm Soft Gold / Amber (Warning)
export const RED = "\x1b[38;2;244;114;182m";        // #F472B6 — Soft Rose / Crimson (Error)

// Neutrals & Surface
export const WHITE = "\x1b[38;2;243;244;246m";      // #F3F4F6 — Pearl White / Clean text
export const GRAY = "\x1b[38;2;107;114;128m";       // #6B7280 — Muted Slate Gray
export const BORDER = "\x1b[38;2;49;51;66m";        // #313342 — Subtle dark card border

/**
 * Truncates a string containing ANSI escape codes while preserving color formatting
 * and calculating length strictly based on visible character count.
 */
export function truncateAnsi(str: string, maxLen: number): string {
	const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
	if (visibleLen <= maxLen) return str;

	let visibleCount = 0;
	let result = "";
	let i = 0;
	while (i < str.length) {
		if (str[i] === "\x1b") {
			const m = str.slice(i).match(/^\x1b\[[0-9;]*m/);
			if (m) {
				result += m[0];
				i += m[0].length;
				continue;
			}
		}
		if (visibleCount < maxLen - 1) {
			result += str[i];
			visibleCount++;
			i++;
		} else {
			result += `…${RESET}`;
			break;
		}
	}
	return result;
}

/**
 * Right-pads an ANSI-formatted string up to the specified visible length.
 */
export function padAnsi(str: string, len: number): string {
	const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
	return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
}

