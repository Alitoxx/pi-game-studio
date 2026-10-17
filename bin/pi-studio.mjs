#!/usr/bin/env node
/**
 * pi-studio — Isolated CLI Launcher for Pi Game Studio
 *
 * Runs Pi inside a dedicated, isolated profile (~/.pi/game-studio/agent)
 * completely decoupled from Gentle Shell or any external web coding agents.
 *
 * Automatically:
 * 1. Provisions ~/.pi/game-studio/agent if missing.
 * 2. Mirrors auth.json and models-store.json from ~/.pi/agent so credentials work seamlessly.
 * 3. Registers pi-game-studio as the active package without third-party pollution.
 * 4. Clears Gentle Shell environment variables (GENTLE_PI_CONFIG_HOME, etc.).
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

function shareCredentialFile(filename) {
	const source = join(defaultPiAgentDir, filename);
	const target = join(studioAgentDir, filename);

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

function provisionStudioProfile() {
	ensureDirectory(studioAgentDir);
	ensureDirectory(join(studioAgentDir, "sessions"));

	// Mirror authentication, model store and trust so user never needs to re-login or re-approve
	shareCredentialFile("auth.json");
	shareCredentialFile("models-store.json");
	shareCredentialFile("trust.json");
	shareCredentialFile("keybindings.json");

	// Ensure pristine settings.json referencing pi-game-studio
	const settingsPath = join(studioAgentDir, "settings.json");
	let currentSettings = {};

	if (existsSync(settingsPath)) {
		try {
			currentSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
		} catch {
			currentSettings = {};
		}
	}

	const packages = Array.isArray(currentSettings.packages) ? currentSettings.packages : [];
	const hasStudioPkg = packages.some(
		(p) => typeof p === "string" && (p === packageRoot || p.includes("pi-game-studio")),
	);

	if (!hasStudioPkg) {
		packages.unshift(packageRoot);
	}

	const defaultAuxPackages = ["npm:pi-web-access", "npm:pi-antigravity", "npm:pi-btw"];
	for (const aux of defaultAuxPackages) {
		if (!packages.includes(aux)) {
			packages.push(aux);
		}
	}

	// Strictly filter out any gentle packages if they ever leaked in
	const cleanPackages = packages.filter((p) => {
		if (typeof p !== "string") return false;
		return !p.toLowerCase().includes("gentle");
	});

	const updatedSettings = {
		tuiMode: "fullscreen",
		...currentSettings,
		packages: cleanPackages,
	};

	try {
		writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), "utf8");
	} catch {}
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

run();
