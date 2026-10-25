/**
 * Bounded Edit Surfaces Guard for Pi Game Studio.
 * Enforces task-level edit boundary contracts (## Allowed edit surfaces)
 * preventing subagents and specialized workers from corrupting files
 * outside their designated discipline or assigned scope.
 */

export interface SurfaceValidationResult {
	allowed: boolean;
	reason?: string;
}

/**
 * Normalizes a file or directory path for cross-platform comparison.
 */
export function normalizePath(p: string): string {
	if (!p) return "";
	return p
		.replace(/\\/g, "/")
		.replace(/^\.\//, "")
		.replace(/\/+$/, "")
		.trim();
}

/**
 * Parses the authorized paths listed under `## Allowed edit surfaces` from a task prompt.
 */
export function parseAllowedSurfaces(taskText: string): string[] {
	if (!taskText || typeof taskText !== "string") return [];

	const headingMatch = taskText.match(/(?:^|\n)##\s+Allowed edit surfaces\s*\n([\s\S]*?)(?=(?:\n##\s+|\n#\s+|$))/i);
	if (!headingMatch || !headingMatch[1]) return [];

	const body = headingMatch[1];
	const lines = body.split("\n");
	const surfaces: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		// Strip list bullets (-, *, •) and code formatting (`, quotes)
		const cleaned = line
			.replace(/^[-*•]\s+/, "")
			.replace(/[`"']/g, "")
			.trim();

		if (cleaned) {
			surfaces.push(normalizePath(cleaned));
		}
	}

	return surfaces;
}

/**
 * Checks whether targetPath is permitted within the given allowedSurfaces list.
 * If allowedSurfaces is empty, any path is considered allowed (unbounded task).
 */
export function isPathAllowed(
	targetPath: string,
	allowedSurfaces: string[],
): boolean {
	if (!allowedSurfaces || allowedSurfaces.length === 0) {
		return true; // No boundary restrictions specified
	}

	const normTarget = normalizePath(targetPath);
	if (!normTarget) return false;

	for (const rawSurface of allowedSurfaces) {
		const normSurface = normalizePath(rawSurface);
		if (!normSurface) continue;

		// 1. Exact match
		if (normTarget === normSurface) {
			return true;
		}

		// 2. Directory prefix (surface is a folder containing targetPath)
		if (normTarget.startsWith(`${normSurface}/`)) {
			return true;
		}

		// 3. Glob wildcard prefix (e.g., src/* or src/**)
		if (normSurface.endsWith("/*") || normSurface.endsWith("/**")) {
			const prefix = normSurface.replace(/\/\*+$/, "");
			if (normTarget === prefix || normTarget.startsWith(`${prefix}/`)) {
				return true;
			}
		}

		// 4. Relative suffix match (e.g. repo-relative vs absolute path)
		if (normTarget.endsWith(`/${normSurface}`)) {
			return true;
		}
	}

	return false;
}

/**
 * Validates a file edit against allowed surfaces.
 */
export function validateEditSurface(
	targetPath: string,
	allowedSurfaces?: string[],
): SurfaceValidationResult {
	if (!allowedSurfaces || allowedSurfaces.length === 0) {
		return { allowed: true };
	}

	if (isPathAllowed(targetPath, allowedSurfaces)) {
		return { allowed: true };
	}

	return {
		allowed: false,
		reason: `Edit surface violation: "${targetPath}" is outside the authorized edit surfaces: [${allowedSurfaces.join(", ")}]. Mutations outside declared boundaries are blocked to prevent cross-discipline corruption.`,
	};
}

/**
 * Reads bounded edit surfaces forwarded by the parent runner through the child
 * environment. Malformed or absent values yield an empty list, which keeps the
 * historical unbounded behaviour for tasks that never declared surfaces.
 */
export function surfacesFromEnv(raw: string | undefined): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((entry): entry is string => typeof entry === "string")
			.map(normalizePath)
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Stateful manager tracking currently active bounded edit surfaces.
 */
export class BoundedSurfacesGuard {
	/**
	 * One scope per dispatched task. A single shared list meant the first task to
	 * finish released the boundary still constraining its neighbours, so concurrent
	 * background work could write outside its declared scope.
	 */
	private scopes = new Map<string, string[]>();
	private processSurfaces: string[] = [];

	public setAllowedSurfaces(surfaces: string[]): void {
		this.processSurfaces = surfaces.map(normalizePath).filter(Boolean);
	}

	/** Union of every active scope; empty means unbounded, as before. */
	public getAllowedSurfaces(): string[] {
		const union = new Set<string>(this.processSurfaces);
		for (const surfaces of this.scopes.values()) {
			for (const surface of surfaces) union.add(surface);
		}
		return Array.from(union);
	}

	public setForTask(taskId: string, surfaces: string[]): string[] {
		const parsed = surfaces.map(normalizePath).filter(Boolean);
		this.scopes.set(taskId, parsed);
		return parsed;
	}

	public setFromTask(taskDescription: string, taskId = "default"): string[] {
		return this.setForTask(taskId, parseAllowedSurfaces(taskDescription));
	}

	/** Releases one task's scope without touching the others. */
	public clearTask(taskId: string): void {
		this.scopes.delete(taskId);
	}

	/**
	 * Loads the surfaces a dispatched subagent received from its parent runner.
	 * Used inside the child process, where the task text is not available.
	 */
	public setFromEnv(raw: string | undefined): string[] {
		const parsed = surfacesFromEnv(raw);
		this.processSurfaces = parsed;
		return parsed;
	}

	public clear(): void {
		this.scopes.clear();
		this.processSurfaces = [];
	}

	public isAllowed(filePath: string): boolean {
		return isPathAllowed(filePath, this.getAllowedSurfaces());
	}

	public validate(filePath: string): SurfaceValidationResult {
		return validateEditSurface(filePath, this.getAllowedSurfaces());
	}
}

export const boundedSurfacesGuard = new BoundedSurfacesGuard();
