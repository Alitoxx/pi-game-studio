#!/usr/bin/env node
/**
 * scripts/palette-preview.js — Muestrario de la paleta viva del estudio.
 *
 * Lee extensions/hooks/studio-palette.ts (única fuente de verdad) e imprime los
 * roles con su saturación y brillo, más un panel de ejemplo con los colores
 * reales. Sirve para revisar cualquier cambio de paleta sin abrir la TUI.
 *
 * Ejecutar:  node scripts/palette-preview.js
 */

const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
	path.join(__dirname, "..", "extensions", "hooks", "studio-palette.ts"),
	"utf8",
);

const colorEnabled = !process.env.NO_COLOR;
const fg = (rgb, text) =>
	colorEnabled && rgb ? `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[0m` : text;
const bold = (text) => (colorEnabled ? `\x1b[1m${text}\x1b[0m` : text);
const dim = (text) => (colorEnabled ? `\x1b[2m${text}\x1b[0m` : text);

/** Extrae las constantes con escape RGB del módulo de paleta. */
function readPalette() {
	const palette = {};
	const re = /export const (\w+)\s*=\s*(?:colorEnabled\s*\?\s*)?"\\x1b\[38;2;(\d+);(\d+);(\d+)m"/g;
	for (const m of source.matchAll(re)) {
		palette[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
	}
	// Alias (WHITE = TEXT, etc.) no llevan escape propio en el regex de arriba.
	const aliases = [...source.matchAll(/export const (\w+)\s*=\s*(\w+);/g)];
	for (const [, alias, target] of aliases) {
		if (palette[target]) palette[alias] = palette[target];
	}
	return palette;
}

const hex = ([r, g, b]) =>
	`#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

function stats([r, g, b]) {
	const max = Math.max(r, g, b) / 255;
	const min = Math.min(r, g, b) / 255;
	return { sat: Math.round((max === 0 ? 0 : (max - min) / max) * 100), value: Math.round(max * 100) };
}

const palette = readPalette();
const roles = [
	["TEXT", "cuerpo"],
	["HEADING", "títulos"],
	["MUTED", "etiquetas"],
	["FAINT", "separadores"],
	["BORDER", "marcos"],
	["ACCENT", "foco"],
	["SECONDARY", "estructura"],
	["SUCCESS", "ok"],
	["WARNING", "atención"],
	["ERROR", "fallo"],
].filter(([name]) => palette[name]);

const swatches = roles.map(([name, use]) => {
	const { sat, value } = stats(palette[name]);
	return `  ${fg(palette[name], "████████")}  ${name.padEnd(10)} ${hex(palette[name])}  ${dim(
		`sat ${String(sat).padStart(3)}%  brillo ${String(value).padStart(3)}%  · ${use}`,
	)}`;
});

const P = palette;
const panel = [
	fg(P.BORDER, "─".repeat(58)),
	`${fg(P.ACCENT, "──")} ${bold(fg(P.TEXT, "Especialistas"))} ${fg(P.FAINT, "(2)")}`,
	fg(P.BORDER, "─".repeat(58)),
	`${fg(P.SUCCESS, "✓")} ${fg(P.TEXT, "bevy-specialist")}`,
	`  ${fg(P.ACCENT, "◐")} ${fg(P.MUTED, "implementando · src/player/movement.rs")}`,
	`${fg(P.ERROR, "✗")} ${fg(P.TEXT, "qa-lead")}`,
	`  ${fg(P.ERROR, "timeout")} ${fg(P.FAINT, "sin actividad 45s")}`,
	fg(P.BORDER, "─".repeat(58)),
	fg(P.MUTED, "presupuesto ") + fg(P.TEXT, "18.4k / 25k") + fg(P.FAINT, "  ·  FPS ") + fg(P.TEXT, "58.2"),
	fg(P.BORDER, "─".repeat(58)),
];

process.stdout.write(
	[
		"",
		bold("  PALETA VIVA — extensions/hooks/studio-palette.ts"),
		"",
		...swatches,
		"",
		"  Panel de ejemplo:",
		"",
		...panel.map((l) => `  ${l}`),
		"",
		dim("  Jerarquía por brillo: texto > estados > muted > faint > borde. Un solo acento."),
		dim("  NO_COLOR=1 node scripts/palette-preview.js  ·  imprime sin escapes."),
		"",
	].join("\n"),
);
