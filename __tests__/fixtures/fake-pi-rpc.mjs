#!/usr/bin/env node
// Fake Pi RPC child used by the runner contract tests.
// Emits the minimal event stream StudioAgentsRunner needs and answers the first
// prompt with the receipt provided in FAKE_RECEIPT, then exits cleanly.
// FAKE_ECHO_SURFACES appends the bounded edit surfaces the child received.

process.stdin.setEncoding("utf8");
const echo = process.env.FAKE_ECHO_SURFACES
	? `\nSURFACES=${process.env.PI_STUDIO_ALLOWED_SURFACES || "<unset>"}`
	: "";
// FAKE_ECHO_ARGV exposes the flags the runner actually passed to the child.
const argvEcho = process.env.FAKE_ECHO_ARGV
	? `\nARGV=${process.argv.slice(2).join(" ")}`
	: "";
const receipt = `${process.env.FAKE_RECEIPT || ""}${echo}${argvEcho}`;
let answered = false;

const emit = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);

emit({ type: "ready" });

process.stdin.on("data", (chunk) => {
	if (answered) return;

	// Parse the request so the response can be correlated by id, as Pi does.
	let request = null;
	for (const line of String(chunk).split("\n")) {
		if (!line.trim()) continue;
		try {
			const parsed = JSON.parse(line);
			if (parsed?.type === "prompt") request = parsed;
		} catch {
			// ignore partial lines
		}
	}
	if (!request) return;
	answered = true;

	// FAKE_PROMPT_REJECT models a prompt Pi refuses before acceptance: it answers
	// with success:false and stays alive, so a runner that ignores the response
	// can only learn about it from the watchdog.
	if (process.env.FAKE_PROMPT_REJECT) {
		emit({
			id: request.id,
			type: "response",
			command: "prompt",
			success: false,
			error: process.env.FAKE_PROMPT_REJECT,
		});
		return;
	}

	// FAKE_SPAWN_GRANDCHILD models a specialist that launches a build tool: the
	// grandchild survives a plain SIGTERM to the direct child, so the runner must
	// signal the whole process group.
	if (process.env.FAKE_SPAWN_GRANDCHILD) {
		const { spawn } = require("node:child_process");
		const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
			stdio: "ignore",
		});
		if (process.env.FAKE_GRANDCHILD_PID_FILE) {
			require("node:fs").writeFileSync(process.env.FAKE_GRANDCHILD_PID_FILE, String(grandchild.pid));
		}
		emit({
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: `GRANDCHILD_PID=${grandchild.pid}` },
		});
		return; // stays alive: only cancellation can end this run
	}

	// FAKE_STDERR models the diagnostic noise a real child writes while succeeding.
	if (process.env.FAKE_STDERR) process.stderr.write(process.env.FAKE_STDERR + "\n");

	emit({
		type: "message_update",
		assistantMessageEvent: { type: "text_delta", delta: receipt },
	});
	emit({
		type: "agent_settled",
		...(process.env.FAKE_SETTLED_ABORTED ? { aborted: true } : {}),
	});
	setTimeout(() => process.exit(0), 20);
});
