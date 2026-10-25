#!/usr/bin/env node
// Fake Pi RPC child used by the runner contract tests.
// Emits the minimal event stream StudioAgentsRunner needs and answers the first
// prompt with the receipt provided in FAKE_RECEIPT, then exits cleanly.

process.stdin.setEncoding("utf8");
const receipt = process.env.FAKE_RECEIPT || "";
let answered = false;

const emit = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);

emit({ type: "ready" });

process.stdin.on("data", (chunk) => {
	if (answered || !chunk.includes('"prompt"')) return;
	answered = true;
	emit({
		type: "message_update",
		assistantMessageEvent: { type: "text_delta", delta: receipt },
	});
	emit({ type: "agent_settled" });
	setTimeout(() => process.exit(0), 20);
});
