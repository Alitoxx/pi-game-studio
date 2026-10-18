#!/usr/bin/env node
/**
 * pi-studio — Dedicated CLI Launcher for Pi Game Studio
 *
 * Runs Pi inside a dedicated studio profile (~/.pi/game-studio/agent)
 * scoped for game development while preserving user package sovereignty
 * and compatibility with the Pi ecosystem philosophy.
 *
 * Automatically:
 * 1. Provisions ~/.pi/game-studio/agent if missing, inheriting user preferences.
 * 2. Mirrors auth.json, models-store.json, trust.json, and keybindings.json from ~/.pi/agent.
 * 3. Additively ensures pi-game-studio and clean auxiliary packages (web-access, antigravity, btw)
 *    are registered without removing, censoring, or filtering any user-configured packages.
 * 4. Cleans external harness environment variables to prevent persona leaks.
 * 5. Launches Pi with full argument and signal pass-through.
 */

import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	symlinkSync,
	copyFileSync,
	writeFileSync,
	readFileSync,
	realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const home = homedir();
const packageRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const studioAgentDir = process.env.PI_STUDIO_AGENT_DIR || join(home, ".pi", "game-studio", "agent");
const defaultPiAgentDir = join(home, ".pi", "agent");

function ensureDirectory(dir) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function provisionStudioProfile(targetDir = studioAgentDir, baseDir = defaultPiAgentDir) {
	ensureDirectory(targetDir);
	ensureDirectory(join(targetDir, "sessions"));

	// Mirror authentication, model store, trust, and keybindings so user never needs to re-login or re-approve
	const mirrorFiles = ["auth.json", "models-store.json", "trust.json", "keybindings.json"];
	for (const filename of mirrorFiles) {
		const source = join(baseDir, filename);
		const target = join(targetDir, filename);
		if (existsSync(source) && !existsSync(target)) {
			try {
				symlinkSync(source, target);
			} catch {
				try {
					copyFileSync(source, target);
				} catch {}
			}
		}
	}

	// Ensure pi-web-access operates with eager tool activation to prevent mid-conversation tool addition failures
	const webSearchConfigPath = join(targetDir, "web-search.json");
	if (!existsSync(webSearchConfigPath)) {
		try {
			writeFileSync(
				webSearchConfigPath,
				JSON.stringify({ toolActivation: "eager" }, null, 2),
				"utf8",
			);
		} catch {}
	}

	// Read existing settings or inherit user's base settings on first creation
	const settingsPath = join(targetDir, "settings.json");
	const baseSettingsPath = join(baseDir, "settings.json");
	let currentSettings = {};

	if (existsSync(settingsPath)) {
		try {
			currentSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
		} catch {
			currentSettings = {};
		}
	} else if (existsSync(baseSettingsPath)) {
		try {
			// Inherit base preferences (themes, default models, etc.) while establishing dedicated studio packages
			currentSettings = JSON.parse(readFileSync(baseSettingsPath, "utf8"));
		} catch {
			currentSettings = {};
		}
	}

	const packages = Array.isArray(currentSettings.packages) ? [...currentSettings.packages] : [];
	const getPkgSource = (p) =>
		typeof p === "string" ? p : typeof p?.source === "string" ? p.source : "";

	const hasStudioPkg = packages.some((p) => {
		const src = getPkgSource(p);
		return src === packageRoot || src.includes("pi-game-studio");
	});

	if (!hasStudioPkg) {
		packages.unshift(packageRoot);
	}

	const defaultAuxPackages = ["npm:pi-web-access", "npm:pi-antigravity", "npm:pi-btw"];
	for (const aux of defaultAuxPackages) {
		const auxName = aux.replace(/^npm:/, "").split("@")[0];
		const exists = packages.some((p) => {
			const src = getPkgSource(p);
			return src === aux || src.replace(/^npm:/, "").split("@")[0] === auxName;
		});
		if (!exists) {
			packages.push(aux);
		}
	}

	// Additive provisioning: we preserve all existing user packages and never censor/filter them
	const updatedSettings = {
		tuiMode: "fullscreen",
		...currentSettings,
		packages,
	};

	try {
		writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), "utf8");
	} catch {}

	return updatedSettings;
}

function run() {
	provisionStudioProfile();

	// Prepare isolated environment
	const env = { ...process.env };
	env.PI_CODING_AGENT_DIR = studioAgentDir;

	// Strip Gentle Shell variables to avoid agent or configuration cross-contamination
	delete env.GENTLE_PI_CONFIG_HOME;
	delete env.GENTLE_PI_AGENT_HOME;
	delete env.GENTLE_SHELL_USER_PI_HOME;
	env.GENTLE_PI_SHELL = "0";

	// Ensure npm does not block newly published packages if user has min-release-age configured in ~/.npmrc
	env.npm_config_min_release_age = "0";

	const args = process.argv.slice(2);
	const piExecutable = process.env.PI_PATH || "pi";

	const child = spawn(piExecutable, args, {
		stdio: "inherit",
		env,
		cwd: process.cwd(),
	});

	child.on("error", (err) => {
		if (err.code === "ENOENT") {
			console.error(`\x1b[31mError:\x1b[0m Could not find 'pi' executable in PATH.`);
			console.error(`Ensure Pi is installed: npm install -g @earendil-works/pi-coding-agent`);
		} else {
			console.error(`\x1b[31mFailed to start pi-studio:\x1b[0m ${err.message}`);
		}
		process.exit(1);
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
		} else {
			process.exit(code ?? 0);
		}
	});

	// Handle standard termination signals gracefully
	const forwardSignal = (sig) => {
		try {
			child.kill(sig);
		} catch {}
	};

	process.on("SIGINT", () => forwardSignal("SIGINT"));
	process.on("SIGTERM", () => forwardSignal("SIGTERM"));
}

export { run };

function isDirectExecution() {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
	}
}

if (isDirectExecution()) {
	run();
}
