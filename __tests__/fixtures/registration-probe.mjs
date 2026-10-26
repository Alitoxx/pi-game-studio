#!/usr/bin/env node
// Loads the studio extension against a mock ExtensionAPI and prints what it registers.
// Read-only: no command handler is executed, no file is written.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const commands = [];
const tools = [];
const events = [];
const shortcuts = [];

const pi = {
	on: (name) => {
		events.push(name);
		return () => {};
	},
	registerCommand: (name) => {
		commands.push(name);
	},
	registerTool: (tool) => {
		tools.push(tool?.name ?? "?");
	},
	registerShortcut: (key) => {
		shortcuts.push(key);
	},
	registerFlag: () => {},
	registerMessageRenderer: () => {},
	registerToolRenderer: () => {},
	registerMarkdownTransformer: () => {},
	registerEntryRenderer: () => {},
	sendMessage: () => {},
	appendEntry: () => {},
	exec: async () => ({ code: 0, stdout: "", stderr: "" }),
	getActiveTools: () => ["read", "write", "edit", "bash", "grep", "find"],
	getAllTools: () =>
		["read", "write", "edit", "bash", "grep", "find"].map((name) => ({ name })),
	getSettings: () => ({}),
	setActiveTools: () => {},
	getCommands: () => [],
	setModel: async () => true,
	getThinkingLevel: () => "medium",
	setThinkingLevel: () => {},
	hasTool: (name) => ["read", "write", "edit", "bash", "grep", "find"].includes(name),
};

const mod = await import(join(repoRoot, "extensions", "hooks", "index.ts"));
mod.default(pi);

// The catalog is what /studio advertises to the user: it must not list a
// command the extension does not register.
const { STUDIO_CATEGORIES } = await import(join(repoRoot, "extensions", "hooks", "studio-command.ts"));
const catalog = STUDIO_CATEGORIES.flatMap((category) =>
	category.commands.map(({ cmd }) => cmd.replace(/^\//, "")),
);

process.stdout.write(
	JSON.stringify({ commands, tools, events, shortcuts, catalog }, null, 2) + "\n",
);
