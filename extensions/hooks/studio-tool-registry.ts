/**
 * Observable registration for the studio's own tools.
 *
 * A studio tool can collide with one the host or another extension already
 * provides. Pi documents no error for a name collision, so skipping silently
 * would replace the whole delegation path — receipts, widgets, contract
 * validation, surface propagation — with someone else's implementation while
 * the user still believes the studio is driving.
 *
 * Every outcome is recorded here and surfaced at `session_start` and in
 * `/studio:doctor`. A tool is only ever "registered", "skipped" with a reason,
 * or "failed" with the error message.
 */

export type StudioToolStatus = "registered" | "skipped" | "failed";

export interface StudioToolRegistration {
	name: string;
	status: StudioToolStatus;
	reason: string | null;
}

const REGISTRATIONS: StudioToolRegistration[] = [];

function record(
	name: string,
	status: StudioToolStatus,
	reason: string | null,
): StudioToolStatus {
	const previous = REGISTRATIONS.findIndex((r) => r.name === name);
	const entry: StudioToolRegistration = { name, status, reason };
	if (previous === -1) REGISTRATIONS.push(entry);
	else REGISTRATIONS[previous] = entry;
	return status;
}

/**
 * Reports whether another provider already owns this tool name. The documented
 * `getAllTools` probe is authoritative; `hasTool` is an undocumented fallback
 * used only when `getAllTools` is missing or throws.
 */
export function hasStudioTool(pi: any, name: string): boolean {
	if (typeof pi?.getAllTools === "function") {
		try {
			const tools = pi.getAllTools();
			if (Array.isArray(tools)) return tools.some((t: any) => t?.name === name);
		} catch {
			// fall through to the undocumented probe
		}
	}
	if (typeof pi?.hasTool === "function") {
		try {
			return Boolean(pi.hasTool(name));
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * The documented `getAllTools()` probe, reduced to tool names. This is the
 * runtime's whole tool inventory; the runner uses it to derive the complement
 * a `deny: ["*"]` baseline must exclude. `[]` when the API is missing or
 * throws: a deny baseline that cannot know the inventory still applies its
 * fixed baseline, but never throws into dispatch.
 */
export function listStudioTools(pi: any): string[] {
	if (typeof pi?.getAllTools !== "function") return [];
	try {
		const tools = pi.getAllTools();
		if (!Array.isArray(tools)) return [];
		return tools
			.map((t: any) => t?.name)
			.filter((name: any): name is string => typeof name === "string");
	} catch {
		return [];
	}
}

export function noteStudioToolSkip(name: string, reason: string): void {
	record(name, "skipped", reason);
}

export function noteStudioToolFailure(name: string, error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	record(name, "failed", message || "unknown error");
}

/**
 * Registers one studio tool, recording the outcome instead of swallowing it.
 */
export function registerStudioTool(pi: any, toolDef: any): StudioToolStatus {
	const name = toolDef?.name;
	if (!name) {
		throw new Error("registerStudioTool requires a tool definition with a name");
	}

	if (hasStudioTool(pi, name)) {
		return record(name, "skipped", "another provider already exposes it");
	}

	if (typeof pi?.registerTool !== "function") {
		return record(name, "failed", "the host exposes no registerTool");
	}

	try {
		pi.registerTool(toolDef);
		return record(name, "registered", null);
	} catch (error) {
		noteStudioToolFailure(name, error);
		return "failed";
	}
}

export function getStudioToolRegistrations(): StudioToolRegistration[] {
	return REGISTRATIONS.map((r) => ({ ...r }));
}

/**
 * Human-readable lines for a replaced or broken studio tool. Empty when every
 * tool registered as expected, so a healthy session stays quiet.
 */
export function formatStudioToolDiagnostics(): string[] {
	const affected = REGISTRATIONS.filter((r) => r.status !== "registered");
	if (affected.length === 0) return [];

	const lines = affected.map((r) =>
		r.status === "skipped"
			? `[WARN] Studio tool "${r.name}" no está activo: ${r.reason}.`
			: `[ERROR] Studio tool "${r.name}" no pudo registrarse: ${r.reason}.`,
	);
	lines.push(
		`       ${affected.length} herramienta(s) del estudio quedaron fuera del runtime: su comportamiento lo decide otro paquete.`,
	);
	lines.push("       Revisa /studio:doctor para el detalle.");
	return lines;
}

/** Test hook: isolates registration state between scenarios. */
export function resetStudioToolRegistrations(): void {
	REGISTRATIONS.length = 0;
}
