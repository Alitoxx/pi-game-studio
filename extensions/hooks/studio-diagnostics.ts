/**
 * Critical-path failure recorder.
 *
 * The studio tolerated failures with empty `catch {}` blocks, which made a broken
 * spawn, a failed write and a malformed event indistinguishable from success. The
 * tolerance is not the problem: the silence is. Every instrumented path records
 * here, logs one line per distinct cause, and surfaces the rest in
 * `/studio:doctor`.
 */

export interface StudioFailure {
	area: string;
	message: string;
	at: number;
}

const MAX_FAILURES = 50;
const FAILURES: StudioFailure[] = [];
const ANNOUNCED = new Set<string>();

function describe(error: unknown): string {
	if (error instanceof Error) return error.message || error.name;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

/**
 * Records a caught failure. The first occurrence of a cause is printed once, so a
 * failing path is visible without flooding the terminal on every retry.
 */
export function recordFailure(area: string, error: unknown): StudioFailure {
	const entry: StudioFailure = {
		area,
		message: describe(error) || "unknown error",
		at: Date.now(),
	};

	FAILURES.push(entry);
	if (FAILURES.length > MAX_FAILURES) FAILURES.shift();

	const key = `${entry.area}::${entry.message}`;
	if (!ANNOUNCED.has(key)) {
		ANNOUNCED.add(key);
		console.error(`[studio] ${entry.area} failed: ${entry.message}`);
	}

	return entry;
}

export function getRecentFailures(): StudioFailure[] {
	return FAILURES.map((f) => ({ ...f }));
}

export function formatFailureDiagnostics(): string[] {
	if (FAILURES.length === 0) return [];
	const lines = FAILURES.slice(-5).map((f) => `[ERROR] ${f.area}: ${f.message}`);
	if (FAILURES.length > 5) {
		lines.unshift(`       ... ${FAILURES.length - 5} fallo(s) previos`);
	}
	lines.push(`       ${FAILURES.length} fallo(s) registrados en esta sesión.`);
	return lines;
}

/** Test hook: isolates failure state between scenarios. */
export function resetFailures(): void {
	FAILURES.length = 0;
	ANNOUNCED.clear();
}
