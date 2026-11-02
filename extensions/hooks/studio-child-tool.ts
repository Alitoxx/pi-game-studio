// Child end of the studio decision channel. Loaded into a delegated specialist with
// `pi --extension <this file>` and activated only when the runner says so: the two env
// vars below are the whole handshake.
//
// Why this exists: a child has no UI, so the runner strips `ask_user_question` from it.
// The templates used to answer that by asking the child to return its options "in the
// Return Contract", which has no field for a choice, so a design fork left the child as
// a numbered prose list and the Producer relayed it verbatim. Here the child asks the
// parent instead, blocks on one correlated reply, and continues with the answer.
//
// Gentle Shell shape (`docs/gentle-shell.md:292`), studio transport: a socket named by
// an env var, never the child's RPC stdio stream.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ChildChannel, MAX_MESSAGE_BYTES, type ChannelChoice } from "./studio-channel.ts";

/** Set by the runner: the socket the parent is listening on. Without it, no tool. */
export const CHILD_CHANNEL_SOCKET_ENV = "PI_STUDIO_CHANNEL_SOCKET";

/** Set by the runner: proves this process is a delegated specialist, not the session. */
export const CHILD_MARKER_ENV = "PI_GAME_STUDIO_CHILD";

export const CHILD_CHANNEL_TOOL = "studio_parent_message";

/** One connection per child process, so the four-pending-query bound is about the agent. */
let sharedChannel: ChildChannel | null = null;

async function channelFor(socketPath: string): Promise<ChildChannel> {
	if (sharedChannel) return sharedChannel;
	sharedChannel = await ChildChannel.connect(socketPath);
	return sharedChannel;
}

export interface ParentMessageParams {
	message: string;
	choices?: ChannelChoice[];
}

/**
 * Ask the studio producer and wait for the human's answer. Returns a string either way:
 * a dismissed question is guidance ("choose the safest default and state it"), never a
 * broken tool call the child has to invent a recovery for.
 */
export async function askProducer(
	socketPath: string,
	params: ParentMessageParams,
): Promise<{ answer: string; source: "human" | "unavailable" }> {
	const connection = await channelFor(socketPath);
	const answer = await connection.ask(params.message, params.choices ?? []);
	return { answer, source: "human" };
}

export default function (pi: ExtensionAPI): void {
	if (process.env[CHILD_MARKER_ENV] !== "1") return;
	const socketPath = process.env[CHILD_CHANNEL_SOCKET_ENV];
	if (!socketPath) return;
	if (typeof (pi as any)?.registerTool !== "function") return;

	(pi as any).registerTool({
		name: CHILD_CHANNEL_TOOL,
		label: "Ask the studio producer",
		description:
			"Ask the studio producer a question and wait for the human's answer. Use this instead of printing a decision request in your output: when a design, scope, engine or art choice is genuinely the human's to make, ask here and continue with the answer. Prefer two to four concrete choices, each with its consequence.",
		parameters: {
			type: "object",
			properties: {
				message: {
					type: "string",
					description: "The decision, stated as one question a human can answer.",
				},
				choices: {
					type: "array",
					description: "Two to four concrete options. The human may also type their own answer.",
					items: {
						type: "object",
						properties: {
							label: { type: "string", description: "Short option label." },
							description: { type: "string", description: "What this option costs or implies." },
						},
						required: ["label"],
					},
				},
			},
			required: ["message"],
		},
		execute: async (_id: string, params: Record<string, unknown>) => {
			const message = String(params?.message ?? "").trim();
			if (!message) {
				return {
					content: [{ type: "text", text: "Error: studio_parent_message needs a message." }],
					details: { error: "empty_message" },
				};
			}
			if (Buffer.byteLength(message) > MAX_MESSAGE_BYTES) {
				return {
					content: [
						{
							type: "text",
							text: `Error: the question is longer than ${MAX_MESSAGE_BYTES} bytes. Ask it in one sentence.`,
						},
					],
					details: { error: "message_too_large" },
				};
			}
			const choices = Array.isArray(params?.choices)
				? (params.choices as any[])
						.filter((c) => c && typeof c.label === "string" && c.label.trim())
						.map((c) => ({
							label: String(c.label).trim(),
							...(typeof c.description === "string" && c.description.trim()
								? { description: String(c.description).trim() }
								: {}),
						}))
				: [];

			try {
				const { answer } = await askProducer(socketPath, { message, choices });
				return {
					content: [
						{
							type: "text",
							text: `Answer from the studio producer (the human decided): ${answer}`,
						},
					],
					details: { answer, source: "human" },
				};
			} catch (err: any) {
				// The channel is an outside view on the decision, not the run's lifeline:
				// losing it must leave the child able to finish and say what it assumed.
				sharedChannel = null;
				const reason = err?.message || String(err);
				return {
					content: [
						{
							type: "text",
							text: [
								`No answer from the studio producer (${reason}).`,
								"Do not stall. Take the safest default, state the assumption explicitly in your receipt, and continue.",
							].join(" "),
						},
					],
					details: { error: "channel_unavailable", reason },
				};
			}
		},
	});
}
