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
	// FAKE_COMMAND_LOG records every RPC command the child actually receives, so a
	// test can prove a command reached the process rather than a function return.
	if (process.env.FAKE_COMMAND_LOG) {
		require("node:fs").appendFileSync(process.env.FAKE_COMMAND_LOG, String(chunk).replace(/\n/g, "\n") + "\n");
	}

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

	// FAKE_STDERR_FLOOD models a child that fails noisily: N long lines on stderr and
	// then a non-zero exit, so the error text the runner keeps can be bounded.
	if (process.env.FAKE_STDERR_FLOOD) {
		const lines = Number(process.env.FAKE_STDERR_FLOOD);
		const pad = "y".repeat(180);
		for (let i = 0; i < lines; i++) process.stderr.write(`flood-${i} ${pad}\n`);
		setTimeout(() => process.exit(Number(process.env.FAKE_EXIT_CODE || 3)), 30);
		return;
	}

	// A child that keeps working is not a child that is stuck: the watchdog must
	// see activity, not elapsed time.
	if (process.env.FAKE_SILENT_AFTER_PROMPT) return;

	// FAKE_USAGE_INPUT/OUTPUT/COST model the authoritative per-message usage Pi
	// reports. Two turns are emitted so accumulation is observable.
	const emitUsage = () => {
		const usage = {
			input: Number(process.env.FAKE_USAGE_INPUT || 0),
			output: Number(process.env.FAKE_USAGE_OUTPUT || 0),
			cacheRead: 0,
			cacheWrite: 0,
			cost: Number(process.env.FAKE_USAGE_COST || 0),
		};
		for (let turn = 0; turn < 2; turn++) {
			emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", delta: "" } });
			emit({ type: "message_end", usage, message: { role: "assistant", usage } });
		}
	};

	const finish = () => {
		if (process.env.FAKE_USAGE_INPUT) emitUsage();

		// FAKE_COMPACTION: the child compacts mid-run, as a long task does.
		if (process.env.FAKE_COMPACTION) {
			const reason = process.env.FAKE_COMPACTION;
			emit({ type: "compaction_start", reason });
			emit({
				type: "compaction_end",
				reason,
				...(process.env.FAKE_COMPACTION_FAILS
					? { aborted: false, errorMessage: "context too large" }
					: { result: { summary: "resumen", tokensBefore: 150000, estimatedTokensAfter: 32000 }, aborted: false, willRetry: false }),
			});
		}

		// FAKE_MESSAGE_END_ONLY: the deltas are lost, the authoritative final
		// message is the only place the delivery survives.
		if (process.env.FAKE_MESSAGE_END_ONLY) {
			emit({
				type: "message_end",
				message: { role: "assistant", content: [{ type: "text", text: receipt }] },
			});
			emit({ type: "agent_settled" });
			setTimeout(() => process.exit(0), 20);
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
	};

	// FAKE_TOOL_THEN_SILENCE: a long running tool emits one start and then works
	// silently for a while, which deserves a larger budget than plain idle.
	if (process.env.FAKE_TOOL_THEN_SILENCE) {
		emit({ type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: { command: "cargo build" } });
		setTimeout(finish, Number(process.env.FAKE_TOOL_THEN_SILENCE));
		return;
	}

	const keepAliveMs = Number(process.env.FAKE_KEEPALIVE_MS || 0);
	const ticks = Number(process.env.FAKE_KEEPALIVE_TICKS || 0);
	if (keepAliveMs > 0 && ticks > 0) {
		let sent = 0;
		const beat = setInterval(() => {
			sent += 1;
			emit({ type: "status", message: "working " + sent });
			if (sent >= ticks) {
				clearInterval(beat);
				finish();
			}
		}, keepAliveMs);
		return;
	}

	finish();
});
