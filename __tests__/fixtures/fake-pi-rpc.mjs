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
