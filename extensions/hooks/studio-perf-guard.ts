import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	RED,
	ACCENT as BLUE,
	SECONDARY,
	WHITE,
} from "./studio-palette.ts";

export interface PerfIssue {
	line: number;
	type: "frame_loop_allocation" | "blocking_call" | "gc_pressure";
	severity: "warning" | "error";
	message: string;
	snippet: string;
	functionName?: string;
}

export interface PerfAuditResult {
	filePath: string;
	language: "Rust" | "GDScript" | "C++" | "C#" | "Unknown";
	issues: PerfIssue[];
	allocationsCount: number;
	blockingCallsCount: number;
	isClean: boolean;
	summary: string;
}

const FRAME_LOOP_SIGNATURES: RegExp[] = [
	// GDScript
	/func\s+(_process|_physics_process|_integrate_forces|update|tick)\s*\(/,
	// Rust (Bevy / generic systems)
	/fn\s+([a-zA-Z0-9_]*(?:update|tick|frame|system|draw|render)[a-zA-Z0-9_]*)\s*\(/,
	// C++ / Raylib / EnTT
	/(?:void|bool|int)\s+([a-zA-Z0-9_]*(?:update|tick|process|render|draw)[a-zA-Z0-9_]*)\s*\(/i,
	/while\s*\(\s*!WindowShouldClose\s*\(\s*\)\s*\)/,
	// C# (Unity / Godot / Mono)
	/(?:void|IEnumerator)\s+(Update|FixedUpdate|LateUpdate|OnGUI|Tick)\s*\(/,
];

const ALLOCATION_PATTERNS: { name: string; pattern: RegExp; languages?: string[] }[] = [
	{ name: ".clone()", pattern: /\.clone\s*\(\s*\)/, languages: ["Rust"] },
	{ name: "Box::new", pattern: /Box::new\s*\(/, languages: ["Rust"] },
	{ name: "Vec::new", pattern: /Vec::new\s*\(/, languages: ["Rust"] },
	{ name: "vec![]", pattern: /vec!\s*\[/, languages: ["Rust"] },
	{ name: "String::from", pattern: /String::from\s*\(/, languages: ["Rust"] },
	{ name: "to_string()", pattern: /\.to_string\s*\(\s*\)/, languages: ["Rust"] },
	{ name: "format!", pattern: /format!\s*\(/, languages: ["Rust"] },
	{ name: "malloc", pattern: /\bmalloc\s*\(/, languages: ["C++"] },
	{ name: "calloc", pattern: /\bcalloc\s*\(/, languages: ["C++"] },
	{ name: "new", pattern: /\bnew\s+[A-Za-z0-9_]+/, languages: ["C++", "C#", "GDScript"] },
	{ name: ".new()", pattern: /\.new\s*\(/, languages: ["GDScript"] },
	{ name: "Array()", pattern: /\bArray\s*\(/, languages: ["GDScript"] },
	{ name: "Dictionary()", pattern: /\bDictionary\s*\(/, languages: ["GDScript"] },
	{ name: "ResourceLoader.load", pattern: /ResourceLoader\.load\s*\(/, languages: ["GDScript"] },
	{ name: "preload()", pattern: /\bpreload\s*\(/, languages: ["GDScript"] },
	{ name: "std::make_shared", pattern: /std::make_shared\b/, languages: ["C++"] },
	{ name: "std::make_unique", pattern: /std::make_unique\b/, languages: ["C++"] },
	{ name: "std::vector", pattern: /std::vector<[^>]+>\s+[a-zA-Z0-9_]+\s*;/, languages: ["C++"] },
	{ name: "GetComponent", pattern: /GetComponent\s*<[^>]+>\s*\(/, languages: ["C#"] },
	{ name: "GC.Collect", pattern: /GC\.Collect\s*\(/, languages: ["C#"] },
];

const BLOCKING_CALL_PATTERNS: { name: string; pattern: RegExp }[] = [
	{ name: "thread::sleep", pattern: /(?:std::)?(?:thread|this_thread)::sleep(?:_for)?\s*\(/ },
	{ name: "Sleep / usleep", pattern: /\b(?:Sleep|usleep|sleep)\s*\([0-9]/ },
	{ name: "Thread.Sleep", pattern: /Thread\.Sleep\s*\(/ },
	{ name: "OS.delay", pattern: /OS\.delay\s*\(/ },
	{ name: "Thread.wait", pattern: /Thread\.wait\s*\(/ },
	{ name: "File::open / fs::read", pattern: /(?:File::open|fs::read(?:_to_string)?)\s*\(/ },
	{ name: "FileAccess.open", pattern: /FileAccess\.open\s*\(/ },
	{ name: "fopen / ifstream", pattern: /\b(?:fopen|ifstream|ofstream)\s*\(/ },
	{ name: "File.ReadAllText", pattern: /File\.ReadAll(?:Text|Bytes)\s*\(/ },
	{ name: "reqwest::blocking", pattern: /reqwest::blocking/ },
	{ name: "TcpStream::connect", pattern: /TcpStream::connect\s*\(/ },
];

export function detectLanguageFromPath(filePath: string): "Rust" | "GDScript" | "C++" | "C#" | "Unknown" {
	const ext = extname(filePath).toLowerCase();
	if (ext === ".rs") return "Rust";
	if (ext === ".gd") return "GDScript";
	if (ext === ".cs") return "C#";
	if (ext === ".cpp" || ext === ".hpp" || ext === ".h" || ext === ".cc" || ext === ".cxx" || ext === ".c") {
		return "C++";
	}
	return "Unknown";
}

/**
 * Scans code files touched by specialists (Rust, GDScript, C++, C#) for game engine
 * performance anti-patterns:
 * - Allocations in tick loops (.clone(), Box::new, new, malloc, Vec::new)
 * - Blocking I/O or sleep calls in main frame thread
 */
export function auditFilePerformance(filePath: string, fileContent?: string): PerfAuditResult {
	const lang = detectLanguageFromPath(filePath);
	let content = fileContent;

	if (content === undefined) {
		try {
			if (existsSync(filePath)) {
				content = readFileSync(filePath, "utf8");
			} else {
				content = "";
			}
		} catch {
			content = "";
		}
	}

	const issues: PerfIssue[] = [];
	if (!content || lang === "Unknown") {
		return {
			filePath,
			language: lang,
			issues: [],
			allocationsCount: 0,
			blockingCallsCount: 0,
			isClean: true,
			summary: `◈ PERF AUDIT: ${filePath} (ignorado o sin contenido)`,
		};
	}

	const lines = content.split(/\r?\n/);
	let inFrameLoop = false;
	let currentFunctionName = "";
	let braceDepth = 0;
	let frameLoopBraceDepth = 0;
	let gdscriptIndentLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const lineNum = i + 1;
		const rawLine = lines[i];
		const trimmed = rawLine.trim();

		// Skip comments
		if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
			continue;
		}

		// Detect entering frame loops
		if (!inFrameLoop) {
			for (const sig of FRAME_LOOP_SIGNATURES) {
				const match = trimmed.match(sig);
				if (match) {
					inFrameLoop = true;
					currentFunctionName = match[1] || "frame_loop";
					frameLoopBraceDepth = braceDepth;
					if (lang === "GDScript") {
						gdscriptIndentLevel = rawLine.search(/\S/);
					}
					break;
				}
			}
		}

		// Brace tracking for C++, Rust, C#
		const openBraces = (rawLine.match(/\{/g) || []).length;
		const closeBraces = (rawLine.match(/\}/g) || []).length;
		braceDepth += openBraces - closeBraces;

		if (inFrameLoop && lang !== "GDScript") {
			if (openBraces > 0 || closeBraces > 0) {
				if (braceDepth <= frameLoopBraceDepth && closeBraces > 0) {
					inFrameLoop = false;
					currentFunctionName = "";
				}
			}
		} else if (inFrameLoop && lang === "GDScript") {
			// In GDScript, exiting function is indicated by unindented code
			const currentIndent = rawLine.search(/\S/);
			if (trimmed.length > 0 && currentIndent <= gdscriptIndentLevel && !trimmed.startsWith("func ")) {
				inFrameLoop = false;
				currentFunctionName = "";
			} else if (trimmed.startsWith("func ") && currentIndent <= gdscriptIndentLevel) {
				// Entered another function
				inFrameLoop = false;
				currentFunctionName = "";
			}
		}

		// Check allocations inside frame loop
		if (inFrameLoop) {
			for (const alloc of ALLOCATION_PATTERNS) {
				if (alloc.languages && !alloc.languages.includes(lang)) {
					continue;
				}
				if (alloc.pattern.test(trimmed)) {
					issues.push({
						line: lineNum,
						type: "frame_loop_allocation",
						severity: "warning",
						message: `Allocación detectada en frame loop (${currentFunctionName}): ${alloc.name}`,
						snippet: trimmed,
						functionName: currentFunctionName,
					});
				}
			}
		}

		// Check blocking calls (flag whether inside loop or general game thread)
		for (const block of BLOCKING_CALL_PATTERNS) {
			if (block.pattern.test(trimmed)) {
				issues.push({
					line: lineNum,
					type: "blocking_call",
					severity: "error",
					message: `Llamada bloqueante en hilo principal: ${block.name}`,
					snippet: trimmed,
					functionName: currentFunctionName || "main",
				});
			}
		}
	}

	const allocationsCount = issues.filter((iss) => iss.type === "frame_loop_allocation").length;
	const blockingCallsCount = issues.filter((iss) => iss.type === "blocking_call").length;
	const isClean = issues.length === 0;

	let summary = "";
	if (allocationsCount > 0) {
		summary = `◈ PERF ALERT: ${allocationsCount} allocations detected in frame loop of ${filePath}`;
	} else if (blockingCallsCount > 0) {
		summary = `◈ PERF ALERT: ${blockingCallsCount} blocking calls detected in ${filePath}`;
	} else {
		summary = `▲ PERF OK: ${filePath} limpio de allocs en frame loop`;
	}

	return {
		filePath,
		language: lang,
		issues,
		allocationsCount,
		blockingCallsCount,
		isClean,
		summary,
	};
}

/**
 * Recursively scans directory for game engine code files.
 */
function findCodeFiles(dir: string, filesList: string[] = []): string[] {
	if (!existsSync(dir)) return filesList;
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name === "node_modules" ||
					entry.name === ".git" ||
					entry.name === "target" ||
					entry.name === ".godot" ||
					entry.name === "build" ||
					entry.name === "bin" ||
					entry.name === ".pi"
				) {
					continue;
				}
				findCodeFiles(full, filesList);
			} else if (entry.isFile()) {
				const ext = extname(entry.name).toLowerCase();
				if (
					ext === ".rs" ||
					ext === ".gd" ||
					ext === ".cs" ||
					ext === ".cpp" ||
					ext === ".hpp" ||
					ext === ".h" ||
					ext === ".cc"
				) {
					filesList.push(full);
				}
			}
		}
	} catch {}
	return filesList;
}

/**
 * CLI command handler for /studio:perf-guard (or /perf-guard)
 */
export async function handleStudioPerfAudit(
	args?: string,
	ctx?: ExtensionContext,
): Promise<PerfAuditResult[]> {
	const cwd = ctx?.cwd || process.cwd();
	const studioRoot = findStudioRoot(cwd) || cwd;

	let targetPath = (args || "").trim();
	let filesToScan: string[] = [];

	if (targetPath) {
		const fullPath = join(studioRoot, targetPath);
		if (existsSync(fullPath)) {
			const st = statSync(fullPath);
			if (st.isDirectory()) {
				filesToScan = findCodeFiles(fullPath);
			} else {
				filesToScan = [fullPath];
			}
		} else {
			console.log(`${RED}■ Error: Ruta no encontrada: ${targetPath}${RESET}`);
			return [];
		}
	} else {
		// Scan standard source locations
		const srcDir = join(studioRoot, "src");
		const scriptsDir = join(studioRoot, "scripts");
		if (existsSync(srcDir)) {
			filesToScan.push(...findCodeFiles(srcDir));
		}
		if (existsSync(scriptsDir)) {
			filesToScan.push(...findCodeFiles(scriptsDir));
		}
		if (filesToScan.length === 0) {
			filesToScan = findCodeFiles(studioRoot);
		}
	}

	console.log(`\n${BLUE}▌ ◈ PERFORMANCE & ALLOCATIONS GUARD${RESET}`);
	console.log(`${DIM}Analizando frame loops, allocs y llamadas bloqueantes en ${filesToScan.length} archivos...${RESET}\n`);

	const results: PerfAuditResult[] = [];
	let totalAllocs = 0;
	let totalBlocking = 0;

	for (const file of filesToScan) {
		const res = auditFilePerformance(file);
		results.push(res);
		totalAllocs += res.allocationsCount;
		totalBlocking += res.blockingCallsCount;

		if (!res.isClean) {
			const relPath = file.startsWith(studioRoot) ? file.slice(studioRoot.length + 1) : file;
			console.log(`${YELLOW}◈ PERF ALERT: ${res.allocationsCount} allocations detected in frame loop of ${relPath}${RESET}`);
			for (const issue of res.issues) {
				const tag = issue.severity === "error" ? `${RED}BLOQUEO${RESET}` : `${YELLOW}ALLOC${RESET}`;
				console.log(`   ${DIM}L${issue.line}:${RESET} [${tag}] ${issue.message}`);
				console.log(`         ${DIM}> ${issue.snippet}${RESET}`);
			}
			console.log("");
		}
	}

	if (totalAllocs === 0 && totalBlocking === 0) {
		const okMsg = `▲ PERF AUDIT OK: 0 frame loop allocations found across ${filesToScan.length} files.`;
		console.log(`${GREEN}${okMsg}${RESET}\n`);
		if (ctx?.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(okMsg, "info");
		}
	} else {
		const alertMsg = `◈ PERF ALERT: ${totalAllocs} allocs en frame loops y ${totalBlocking} llamadas bloqueantes detectadas.`;
		console.log(`${YELLOW}${alertMsg}${RESET}\n`);
		if (ctx?.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(alertMsg, "warning");
		}
	}

	return results;
}
