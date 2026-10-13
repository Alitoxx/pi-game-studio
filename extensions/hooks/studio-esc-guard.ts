import { studioAgentsRunner } from "./studio-agents-runner.ts";
import { playAlertChime } from "./studio-sound.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Tracks consecutive Escape keypresses to distinguish between
 * a single cancel (e.g., closing a modal or current turn) and
 * an emergency double-escape that cancels all background tasks and subagents.
 */
export class DoubleEscapeGuard {
	private lastEscapeTimestamp: number = 0;
	private readonly thresholdMs: number;

	constructor(thresholdMs: number = 1000) {
		this.thresholdMs = thresholdMs;
	}

	/**
	 * Records an Escape keypress.
	 * Returns false on the 1st Escape (letting normal UI/modals handle it).
	 * Returns true on the 2nd Escape within thresholdMs and triggers emergency cancel.
	 */
	public handleEscape(ctx?: ExtensionContext): boolean {
		const now = Date.now();
		const diff = now - this.lastEscapeTimestamp;

		if (this.lastEscapeTimestamp > 0 && diff <= this.thresholdMs) {
			this.lastEscapeTimestamp = 0;
			studioAgentsRunner.cancelAll("Emergency cancel (Double-Esc)");
			try {
				playAlertChime();
			} catch {}
			if (ctx?.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(
					"Cancelación de emergencia ejecutada (Escape x 2)",
					"warning",
				);
			}
			return true;
		}

		this.lastEscapeTimestamp = now;
		return false;
	}

	public reset(): void {
		this.lastEscapeTimestamp = 0;
	}

	public getLastTimestamp(): number {
		return this.lastEscapeTimestamp;
	}

	public getThresholdMs(): number {
		return this.thresholdMs;
	}
}

export const doubleEscapeGuard = new DoubleEscapeGuard(1000);
