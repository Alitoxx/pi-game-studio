import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { writeFileAtomicSync } from "./studio-fs.ts";
import { recordFailure } from "./studio-diagnostics.ts";
import { ACCENT, ACCENT as BLUE, BORDER, CYAN, DIM, GRAY, GREEN, RED, RESET, SECONDARY, WHITE, YELLOW, padAnsi } from "./studio-palette.ts";

export interface TuningVar {
	key: string;
	value: string | number | boolean;
	type: "number" | "boolean" | "string";
	filePath: string;
	relPath: string;
}

/**
 * Searches for gameplay balance and tuning files (YAML/JSON) in assets/ and data/.
 */
export function findTuningFiles(studioRoot: string): string[] {
	const candidates: string[] = [];
	const searchDirs = [
		join(studioRoot, "assets", "data"),
		join(studioRoot, "assets"),
		join(studioRoot, "data"),
	];

	for (const dir of searchDirs) {
		if (!existsSync(dir)) continue;
		try {
			for (const file of readdirSync(dir)) {
				if (
					(file.endsWith(".yaml") || file.endsWith(".yml") || file.endsWith(".json")) &&
					!file.startsWith(".")
				) {
					candidates.push(join(dir, file));
				}
			}
		} catch {}
	}

	return [...new Set(candidates)];
}

/**
 * Extracts scalar gameplay variables from simple YAML or JSON files.
 */
export function parseTuningVariables(content: string, filePath: string, studioRoot: string): TuningVar[] {
	const vars: TuningVar[] = [];
	const relPath = relative(studioRoot, filePath);
	const lines = content.split("\n");

	let currentPrefix = "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

		// Check section header or dictionary key without scalar value
		const sectionMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
		if (sectionMatch) {
			currentPrefix = sectionMatch[1];
			continue;
		}

		// Scalar key-value match
		const kvMatch = line.match(/^\s*([a-zA-Z0-9_-]+):\s*(.+)$/);
		if (kvMatch) {
			const rawKey = kvMatch[1].trim();
			const rawVal = kvMatch[2].trim().replace(/^['"]|['"]$/g, "");

			// Skip comments at end of line
			const cleanVal = rawVal.split(/\s+#/)[0].trim();
			if (!cleanVal || cleanVal === "{" || cleanVal === "[") continue;

			const fullKey = currentPrefix ? `${currentPrefix}.${rawKey}` : rawKey;

			let typedVal: string | number | boolean = cleanVal;
			let type: "number" | "boolean" | "string" = "string";

			if (cleanVal === "true" || cleanVal === "false") {
				typedVal = cleanVal === "true";
				type = "boolean";
			} else if (!Number.isNaN(Number(cleanVal)) && cleanVal !== "") {
				typedVal = Number(cleanVal);
				type = "number";
			}

			vars.push({
				key: fullKey,
				value: typedVal,
				type,
				filePath,
				relPath,
			});
		}
	}

	return vars;
}

/**
 * Scans all tuning files in a studio project and aggregates variables.
 */
export function inspectStudioTuning(studioRoot: string): TuningVar[] {
	const files = findTuningFiles(studioRoot);
	const allVars: TuningVar[] = [];

	for (const file of files) {
		try {
			const content = readFileSync(file, "utf8");
			const vars = parseTuningVariables(content, file, studioRoot);
			allVars.push(...vars);
		} catch {}
	}

	return allVars;
}

/**
 * Updates a scalar variable in a YAML file while preserving surrounding formatting.
 */
export function updateTuningVariable(
	filePath: string,
	targetKey: string,
	newValue: string | number | boolean,
): boolean {
	if (!existsSync(filePath)) return false;
	try {
		const content = readFileSync(filePath, "utf8");
		const lines = content.split("\n");

		const parts = targetKey.split(".");
		const section = parts.length > 1 ? parts[0] : "";
		const field = parts.length > 1 ? parts[1] : parts[0];

		let inTargetSection = !section;
		let replaced = false;

		const updatedLines = lines.map((line) => {
			if (replaced) return line;

			if (section) {
				const secMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
				if (secMatch) {
					inTargetSection = secMatch[1] === section;
				}
			}

			if (inTargetSection) {
				const regex = new RegExp(`^(\\s*${field}:\\s*)([^#\\n]+)(.*)$`);
				const m = line.match(regex);
				if (m) {
					replaced = true;
					const formattedVal = typeof newValue === "string" && !/^[0-9.]+$/.test(newValue)
						? `"${newValue}"`
						: String(newValue);
					return `${m[1]}${formattedVal}${m[3] || ""}`;
				}
			}
			return line;
		});

		if (replaced) {
			// Tuning values are hand-balanced game feel knobs; a truncated file would
			// wipe the player's calibration, so it is replaced atomically.
			writeFileAtomicSync(filePath, updatedLines.join("\n"), "utf8");
			return true;
		}
		return false;
	} catch (error) {
		// The caller only sees a boolean, so the cause has to be recorded here or the
		// calibration is silently left untouched.
		recordFailure("tuning.write", error);
		return false;
	}
}

/**
 * Command: /studio:tuning [list | get <key> | set <key> <val>]
 */
export async function handleStudioTuning(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const parts = (args || "").trim().split(/\s+/).filter(Boolean);
	const action = (parts[0] || "list").toLowerCase();

	const vars = inspectStudioTuning(studioRoot);

	if (vars.length === 0) {
		console.log("\n" + YELLOW + "⚠ No se detectaron archivos de tuning ni balance en assets/data/ ni assets/.\x1b[0m");
		console.log("Crea archivos de balance como assets/data/santuario.yaml o balance.yaml para ajustar parámetros de gameplay.\n");
		return;
	}

	if (action === "set" && parts.length >= 3) {
		const keyToSet = parts[1];
		const rawVal = parts.slice(2).join(" ");
		const targetVar = vars.find((v) => v.key.toLowerCase() === keyToSet.toLowerCase());

		if (!targetVar) {
			console.log(`\n${RED}Variable de tuning no encontrada:\x1b[0m ${keyToSet}\n`);
			return;
		}

		let typedVal: string | number | boolean = rawVal;
		if (rawVal === "true" || rawVal === "false") typedVal = rawVal === "true";
		else if (!Number.isNaN(Number(rawVal))) typedVal = Number(rawVal);

		const success = updateTuningVariable(targetVar.filePath, targetVar.key, typedVal);
		if (success) {
			console.log(`\n${GREEN}✓ Variable de tuning actualizada:\x1b[0m`);
			console.log(`  • Clave:   \x1b[1m${WHITE}${targetVar.key}\x1b[0m`);
			console.log(`  • Antes:   ${GRAY}${targetVar.value}\x1b[0m`);
			console.log(`  • Ahora:   ${GREEN}${typedVal}\x1b[0m`);
			console.log(`  • Archivo: ${ACCENT}${targetVar.relPath}\x1b[0m\n`);
		} else {
			console.log(`\n${RED}Fallo al guardar la variable en disco.\x1b[0m\n`);
		}
		return;
	}

	if (action === "get" && parts.length >= 2) {
		const keyToGet = parts[1];
		const targetVar = vars.find((v) => v.key.toLowerCase() === keyToGet.toLowerCase());
		if (targetVar) {
			console.log(`\n\x1b[1m${targetVar.key}\x1b[0m = ${GREEN}${targetVar.value}\x1b[0m ${GRAY}(${targetVar.relPath})\x1b[0m\n`);
		} else {
			console.log(`\n${RED}Variable no encontrada:\x1b[0m ${keyToGet}\n`);
		}
		return;
	}

	// Default: list all variables
	console.log("");
	console.log("┌── GAME FEEL & TUNING INSPECTOR (/studio:tuning) ────────────────┐");
	console.log(`│ Variables detectadas: ${String(vars.length).padEnd(46, " ")} │`);
	console.log("└─────────────────────────────────────────────────────────────────┘");
	console.log("");

	// Group by file
	const byFile = new Map<string, TuningVar[]>();
	for (const v of vars) {
		const list = byFile.get(v.relPath) || [];
		list.push(v);
		byFile.set(v.relPath, list);
	}

	for (const [file, items] of byFile.entries()) {
		console.log(`\x1b[1m${ACCENT}• ${file}\x1b[0m`);
		for (const it of items) {
			const typeColor = it.type === "number" ? "" + SECONDARY + "" : it.type === "boolean" ? "" + YELLOW + "" : "" + WHITE + "";
			console.log(`    ${it.key.padEnd(32, " ")} = ${typeColor}${String(it.value)}\x1b[0m " + GRAY + "(${it.type})\x1b[0m`);
		}
		console.log("");
	}

	console.log("" + GRAY + "Para modificar un valor: /studio:tuning set <clave> <nuevo_valor>\x1b[0m\n");
}
