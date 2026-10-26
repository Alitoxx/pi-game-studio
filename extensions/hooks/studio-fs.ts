import {
	chmodSync,
	closeSync,
	fsyncSync,
	openSync,
	renameSync,
	statSync,
	unlinkSync,
	writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join } from "node:path";

/**
 * Atomic writes for user-facing config.
 *
 * A plain `writeFileSync` truncates the target first and then streams the new
 * bytes, so an interrupted process (a crash, a full disk, a killed CLI) leaves a
 * half-written `project.yaml` or `.pi/settings.json`. The next `/studio:setup`
 * then refuses to recognize its own project and the user is never told why.
 *
 * Writing to a temp file in the same directory and renaming it over the target
 * makes the replacement observable only once the bytes are on disk: readers see
 * the old file or the new one, never a prefix. `rename` within one directory is
 * atomic on POSIX and on Windows (Node maps it to MOVEFILE_REPLACE_EXISTING).
 *
 * Every module that owns config the studio re-reads goes through here; the
 * `studio-atomic-writes` suite fails if one of them calls `writeFileSync`.
 */

let tempCounter = 0;

function tempPathFor(target: string): string {
	tempCounter += 1;
	const suffix = randomBytes(4).toString("hex");
	return join(dirname(target), `.${basename(target)}.${process.pid}.${tempCounter}.${suffix}.tmp`);
}

function existingMode(target: string): number | null {
	try {
		return statSync(target).mode & 0o777;
	} catch {
		return null;
	}
}

/**
 * Writes `data` to `target` so that the target either keeps its previous
 * contents or holds the complete new ones. A pre-existing file keeps its
 * permissions: replacing a 0600 file must not publish it as 0644.
 *
 * Failures propagate. The temp file is removed first, so a failed write cannot
 * leave residue that a later setup would find and misread.
 */
export function writeFileAtomicSync(
	target: string,
	data: string | Uint8Array,
	encoding: BufferEncoding = "utf8",
): void {
	const temp = tempPathFor(target);
	const mode = existingMode(target);
	let fd: number | null = null;

	try {
		fd = openSync(temp, "wx", mode ?? 0o644);
		const payload = typeof data === "string" ? Buffer.from(data, encoding) : data;
		writeSync(fd, payload);
		// Durability before visibility: the rename must not be observable while the
		// bytes are still only in the page cache.
		fsyncSync(fd);
		closeSync(fd);
		fd = null;
		if (mode !== null) chmodSync(temp, mode);
		renameSync(temp, target);
	} catch (error) {
		if (fd !== null) {
			try {
				closeSync(fd);
			} catch {}
		}
		try {
			unlinkSync(temp);
		} catch {}
		throw error;
	}
}

/**
 * JSON config (`models.json`, `.pi/settings.json`, `mcp.json`) is written with
 * the project's two-space convention and no trailing newline, so an atomic write
 * is byte-identical to the direct one it replaces.
 */
export function writeJsonAtomicSync(target: string, value: unknown, indent = 2): void {
	writeFileAtomicSync(target, JSON.stringify(value, null, indent), "utf8");
}
