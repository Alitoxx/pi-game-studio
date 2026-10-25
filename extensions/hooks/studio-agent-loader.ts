import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Thinking levels Pi accepts for `--thinking`. Pi clamps a level the selected
 * model does not support, so an unknown value here is a typo, not a capability
 * limit: it must never reach the child process.
 */
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

/**
 * Resolves the reasoning budget declared by an agent template, falling back to
 * the tier default when the value is missing or outside Pi's vocabulary.
 */
export function resolveThinkingLevel(
	raw: unknown,
	tier: "director" | "lead" | "specialist",
): ThinkingLevel {
	const fallback: ThinkingLevel = tier === "director" ? "high" : "medium";
	if (typeof raw !== "string") return fallback;
	const value = raw.trim().toLowerCase();
	return (THINKING_LEVELS as readonly string[]).includes(value)
		? (value as ThinkingLevel)
		: fallback;
}

export interface AgentManifest {
	name: string;
	title: string;
	description: string;
	tier: "director" | "lead" | "specialist";
	model: string;
	thinking: ThinkingLevel;
	tools: string[];
	filePath: string;
	systemPrompt: string;
}

export function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "agents"))) return candidate1;
	} catch {}
	try {
		const candidate2 = resolve(__dirname, "..", "..");
		if (existsSync(join(candidate2, "agents"))) return candidate2;
	} catch {}
	return process.cwd();
}

export function getAgentTier(name: string): "director" | "lead" | "specialist" {
	if (["creative-director", "technical-director", "producer"].includes(name)) {
		return "director";
	}
	if (
		[
			"game-designer",
			"gameplay-programmer",
			"art-director",
			"audio-director",
			"qa-lead",
		].includes(name)
	) {
		return "lead";
	}
	return "specialist";
}

export function parseAgentFrontmatter(content: string): {
	meta: Record<string, any>;
	body: string;
} {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) {
		return { meta: {}, body: content.trim() };
	}

	const rawYaml = match[1];
	const body = match[2].trim();
	const meta: Record<string, any> = {};

	const lines = rawYaml.split(/\r?\n/);
	let currentKey = "";
	let isList = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (trimmed.startsWith("- ") && currentKey && isList) {
			meta[currentKey].push(trimmed.slice(2).trim());
			continue;
		}

		const colonIdx = trimmed.indexOf(":");
		if (colonIdx > 0) {
			const key = trimmed.slice(0, colonIdx).trim();
			const val = trimmed.slice(colonIdx + 1).trim();

			if (!val) {
				currentKey = key;
				isList = true;
				meta[currentKey] = [];
			} else {
				currentKey = key;
				isList = false;
				let cleanVal: any = val;
				if (
					(cleanVal.startsWith('"') && cleanVal.endsWith('"')) ||
					(cleanVal.startsWith("'") && cleanVal.endsWith("'"))
				) {
					cleanVal = cleanVal.slice(1, -1);
				}
				if (cleanVal === "true") cleanVal = true;
				else if (cleanVal === "false") cleanVal = false;
				meta[currentKey] = cleanVal;
			}
		}
	}

	return { meta, body };
}

export function loadAgentManifest(name: string, cwd: string): AgentManifest | null {
	const cleanName = name.replace(/\.md$/, "");
	const pkgRoot = resolvePackageRoot();

	const projectAgentPath = join(cwd, ".pi", "agents", `${cleanName}.md`);
	const pkgAgentPath = join(pkgRoot, "agents", `${cleanName}.md`);

	let targetPath = existsSync(projectAgentPath) ? projectAgentPath : pkgAgentPath;
	if (!existsSync(targetPath)) {
		return null;
	}

	try {
		const raw = readFileSync(targetPath, "utf8");
		const { meta, body } = parseAgentFrontmatter(raw);

		const tier = getAgentTier(cleanName);
		const defaultThinking = tier === "director" ? "high" : tier === "lead" ? "medium" : "medium";

		return {
			name: meta.name || cleanName,
			title: meta.title || cleanName.replace(/-/g, " "),
			description: meta.description || "",
			tier,
			model: meta.model || "inherit",
			thinking: resolveThinkingLevel(meta.thinking, tier),
			tools: Array.isArray(meta.tools) ? meta.tools : ["read", "write", "edit", "bash"],
			filePath: targetPath,
			systemPrompt: body,
		};
	} catch {
		return null;
	}
}

export function listAvailableAgents(cwd: string): string[] {
	const pkgRoot = resolvePackageRoot();
	const agents = new Set<string>();

	const scan = (dir: string) => {
		if (!existsSync(dir)) return;
		try {
			for (const file of readdirSync(dir)) {
				if (file.endsWith(".md") && !file.startsWith(".")) {
					agents.add(file.replace(/\.md$/, ""));
				}
			}
		} catch {}
	};

	scan(join(pkgRoot, "agents"));
	scan(join(cwd, ".pi", "agents"));

	return Array.from(agents).sort();
}

export function loadAllAgents(cwd: string): AgentManifest[] {
	return listAvailableAgents(cwd)
		.map((name) => loadAgentManifest(name, cwd))
		.filter((manifest): manifest is AgentManifest => manifest !== null);
}
