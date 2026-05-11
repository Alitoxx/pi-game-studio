import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { opendir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
	// ──────────────────────────────────────────────
	// Hook: Validate git commits
	// Fires on tool_call for git commit commands
	// ──────────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const cmd = event.input.command?.trim() || "";

		// --- Git commit validation ---
		if (/^git\s+commit/.test(cmd)) {
			return handleGitCommit(event, cmd, ctx);
		}

		// --- Git push protection ---
		if (/^git\s+push/.test(cmd)) {
			return handleGitPush(event, cmd, ctx);
		}
	});

	// ──────────────────────────────────────────────
	// Hook: Validate skill changes
	// Fires on tool_call for write/edit on skill files
	// ──────────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if (
			!isToolCallEventType("write", event) &&
			!isToolCallEventType("edit", event)
		)
			return;

		// Check if writing to a skill file (skills/ or .pi/skills/)
		const filePath = event.input.path || "";
		const skillMatch = filePath.match(/(?:\/skills\/|\.pi\/skills\/)([^/]+)/);

		if (skillMatch) {
			const skillName = skillMatch[1];
			// Advisory only — don't block
			console.log(
				`Reminder: run skill-test to validate ${skillName} after changes.`,
			);
		}
	});

	// ──────────────────────────────────────────────
	// Hook: Agent audit trail
	// Logs agent invocations for debugging
	// ──────────────────────────────────────────────
	pi.on("turn_start", async (event, ctx) => {
		const logDir = join(ctx.cwd, "production", "session-logs");
		await mkdir(logDir, { recursive: true }).catch(() => {});

		const line = `${new Date().toISOString()} | Agent called\n`;
		await appendToFile(join(logDir, "agent-audit.log"), line).catch(() => {});
	});

	// ──────────────────────────────────────────────
	// Hook: Documentation gap detection
	// Fires on session_start to check for missing docs
	// ──────────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		// Only run in the game-studio project context
		if (!existsSync(join(ctx.cwd, ".pi", "game-studio"))) return;

		const gaps: string[] = [];

		// Check 1: Code without design docs
		const srcExists = existsSync(join(ctx.cwd, "src"));
		const designExists = existsSync(join(ctx.cwd, "design", "gdd"));

		if (srcExists) {
			let srcCount = 0;
			try {
				const dir = await opendir(join(ctx.cwd, "src"));
				for await (const _ of dir) srcCount++;
			} catch {}

			let designCount = 0;
			if (designExists) {
				try {
					const dir = await opendir(join(ctx.cwd, "design", "gdd"));
					for await (const _ of dir) designCount++;
				} catch {}
			}

			if (srcCount > 50 && designCount < 5) {
				gaps.push(
					`Codebase with ${srcCount}+ files but only ${designCount} design docs. Run /reverse-document or /project-stage-detect.`,
				);
			}
		}

		// Check 2: Prototypes without README
		const protoExists = existsSync(join(ctx.cwd, "prototypes"));
		if (protoExists) {
			try {
				const dir = await opendir(join(ctx.cwd, "prototypes"));
				for await (const entry of dir) {
					if (entry.isDirectory()) {
						const protoDir = join(ctx.cwd, "prototypes", entry.name);
						if (
							!existsSync(join(protoDir, "README.md")) &&
							!existsSync(join(protoDir, "CONCEPT.md"))
						) {
							gaps.push(
								`Undocumented prototype: prototypes/${entry.name}/. Run /reverse-document concept prototypes/${entry.name}`,
							);
						}
					}
				}
			} catch {}
		}

		// Check 3: Core systems without architecture docs
		const coreExists =
			existsSync(join(ctx.cwd, "src", "core")) ||
			existsSync(join(ctx.cwd, "src", "engine"));
		const archExists = existsSync(join(ctx.cwd, "docs", "architecture"));

		if (coreExists && !archExists) {
			gaps.push(
				"Core systems exist but no docs/architecture/ directory. Start with /architecture-decision.",
			);
		}

		if (gaps.length > 0) {
			ctx.ui.notify(`Documentation gaps found: ${gaps.length}`, "info");
		}
	});
}

// ──────────────────────────────────────────────
// Git commit validation
// ──────────────────────────────────────────────
async function handleGitCommit(
	event: any,
	_cmd: string,
	ctx: ExtensionContext,
) {
	const warnings: string[] = [];

	// Get staged files
	let staged: string[] = [];
	try {
		const output = execSync("git diff --cached --name-only", {
			encoding: "utf-8",
			cwd: ctx.cwd,
		});
		staged = output.trim().split("\n").filter(Boolean);
	} catch {
		return; // Not a git repo or no staged files
	}

	if (staged.length === 0) return;

	// Check design docs for required sections
	const designFiles = staged.filter((f) => f.startsWith("design/gdd/"));
	for (const file of designFiles) {
		if (!file.endsWith(".md")) continue;
		const fullPath = join(ctx.cwd, file);
		if (!existsSync(fullPath)) continue;

		try {
			const content = await readFile(fullPath, "utf-8");
			const required = [
				"Overview",
				"Player Fantasy",
				"Formulas",
				"Edge Cases",
				"Dependencies",
				"Tuning Knobs",
			];
			for (const section of required) {
				if (!content.toLowerCase().includes(section.toLowerCase())) {
					warnings.push(`DESIGN: ${file} missing required section: ${section}`);
				}
			}
		} catch {}
	}

	// Check for hardcoded gameplay values
	const codeFiles = staged.filter((f) => f.startsWith("src/gameplay/"));
	for (const file of codeFiles) {
		const fullPath = join(ctx.cwd, file);
		if (!existsSync(fullPath)) continue;
		try {
			const content = await readFile(fullPath, "utf-8");
			const matches = content.match(
				/(damage|health|speed|rate|chance|cost|duration)\s*[:=]\s*\d+/g,
			);
			if (matches?.length) {
				warnings.push(
					`CODE: ${file} may contain hardcoded gameplay values. Use data files.`,
				);
			}
		} catch {}
	}

	if (warnings.length > 0) {
		ctx.ui.notify(
			`Commit validation: ${warnings.length} warning(s). Check output for details.`,
			"warning",
		);
		// Don't block — just warn via notification
	}
}

// ──────────────────────────────────────────────
// Git push protection
// ──────────────────────────────────────────────
async function handleGitPush(event: any, cmd: string, ctx: ExtensionContext) {
	const protectedBranches = ["main", "master", "develop"];

	// Get current branch
	let currentBranch = "";
	try {
		currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
			encoding: "utf-8",
			cwd: ctx.cwd,
		}).trim();
	} catch {
		return;
	}

	for (const branch of protectedBranches) {
		if (
			currentBranch === branch ||
			new RegExp(`\\b${branch}(\\s|$)`).test(cmd)
		) {
			ctx.ui.notify(
				`Push to protected branch '${branch}'. Ensure builds and tests pass first.`,
				"warning",
			);
			return;
		}
	}
}

// ──────────────────────────────────────────────
// File append utility
// ──────────────────────────────────────────────
async function appendToFile(filePath: string, content: string): Promise<void> {
	const existing = existsSync(filePath)
		? await readFile(filePath, "utf-8")
		: "";
	await writeFile(filePath, existing + content, "utf-8");
}
