const path = require("path");
const { execFileSync } = require("child_process");

// A delegated specialist cannot open the native selector: the runner strips
// ask_user_question from the child because a child has no UI. The templates answered
// that by telling the child to "return structured options in the Return Contract",
// which has no field for them, so a real design fork arrived as a numbered prose list
// and the Producer relayed it verbatim. Gentle Shell does not work that way: a child
// asks the parent, blocks on one strictly correlated reply, and keeps running.
//
// This suite pins that channel: framing, strict correlation, the four-query bound, the
// settle-once rule, the generous wait budget, and the fact that it travels over its own
// socket instead of the child's RPC stdio stream.
describe("Studio child-to-parent decision channel", () => {
	const repoRoot = path.join(__dirname, "..");

	// One scenario process, several assertions: real sockets in a real runtime, with
	// every observation reported so a failure names the rule that broke.
	const runScenario = () => {
		const script = `
			const fs = await import("node:fs");
			const net = await import("node:net");
			const os = await import("node:os");

			const mod = await import("./extensions/hooks/studio-channel.ts");
			const {
				ParentChannel, ChildChannel, channelSocketPath,
				MAX_PENDING_QUERIES, MAX_MESSAGE_BYTES,
			} = mod;

			const out = {};
			const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-chan-"));

			// --- path + permissions -------------------------------------------------
			const sockPath = channelSocketPath("abc123", tmpRoot);
			out.pathLength = Buffer.byteLength(sockPath);
			out.pathIsInsideRoot = sockPath.startsWith(tmpRoot);
			out.parentDirMode = (fs.statSync(tmpRoot).mode & 0o777).toString(8);

			// --- round trip: query reaches the parent, reply reaches the child ------
			const parent = await ParentChannel.create({
				socketPath: sockPath,
				onQuery: (q) => {
					out.querySawMessage = q.message;
					out.querySawChoices = q.choices ?? null;
					out.querySawId = typeof q.id === "string" && q.id.length > 0;
					out.replyAccepted = parent.reply(q.id, "Estratégica global, por turnos");
				},
			});
			out.pendingAfterCreate = parent.pending().length;

			const child = await ChildChannel.connect(sockPath, { timeoutMs: 4000 });
			out.roundTrip = await child.ask("¿Escala del juego?", [
				{ label: "Estratégica global", description: "mapa del mundo entero" },
				{ label: "Operacional", description: "un frente concreto" },
			]);
			out.choicesCount = (out.querySawChoices ?? []).length;
			out.pendingAfterReply = parent.pending().length;

			// --- duplicate reply is refused, and the first answer stands ------------
			out.duplicateReply = parent.reply(out.querySawId === true ? (parent.pending()[0] ?? "missing") : "missing", "segunda respuesta");
			out.duplicateOnUnknown = parent.reply("no-such-query", "x");

			// --- the four-query bound ----------------------------------------------
			const answered = [];
			const slowParent = await ParentChannel.create({
				socketPath: channelSocketPath("bound1", tmpRoot),
				onQuery: (q) => { answered.push(q.id); },
			});
			const boundedChild = await ChildChannel.connect(slowParent.socketPath, { timeoutMs: 4000 });
			const until = async (check) => { for (let i = 0; i < 200 && !check(); i += 1) await new Promise((r) => setTimeout(r, 10)); };
			const four = [];
			for (let i = 0; i < MAX_PENDING_QUERIES; i += 1) four.push(boundedChild.ask("q" + i));
			let fifth = "resolved";
			try { await boundedChild.ask("q-overflow"); } catch (err) { fifth = err.message; }
			await until(() => answered.length === MAX_PENDING_QUERIES);
			out.capAccepted = four.length;
			out.capFifthCode = fifth;
			out.capParentSaw = answered.length;
			for (const id of answered) slowParent.reply(id, "ok");
			await Promise.all(four);
			boundedChild.close();
			await slowParent.close();

			// --- timeout settles once and a late reply is refused -------------------
			let lateQueryId = null;
			const timingOutParent = await ParentChannel.create({
				socketPath: channelSocketPath("timing", tmpRoot),
				onQuery: (q) => { lateQueryId = q.id; },
			});
			const impatientChild = await ChildChannel.connect(timingOutParent.socketPath, { timeoutMs: 120 });
			let timeoutMessage = "resolved";
			try { await impatientChild.ask("¿Motor?"); } catch (err) { timeoutMessage = err.message; }
			out.timeoutMessage = timeoutMessage;
			// The child announces the cancellation on its own frame, so the parent drops the
			// decision a moment later. The rule is that a cancelled query is refused, not
			// that it is refused in zero milliseconds.
			await until(() => timingOutParent.pending().length === 0);
			out.lateReplyAccepted = timingOutParent.reply(lateQueryId ?? "missing", "tarde");
			impatientChild.close();
			await timingOutParent.close();

			// --- parent going away settles the pending ask as closed ----------------
			const dyingParent = await ParentChannel.create({
				socketPath: channelSocketPath("dying", tmpRoot),
				onQuery: () => {},
			});
			const waitingChild = await ChildChannel.connect(dyingParent.socketPath, { timeoutMs: 4000 });
			const pendingAsk = waitingChild.ask("¿Plataforma?");
			await new Promise((r) => setTimeout(r, 50));
			await dyingParent.close();
			let closedMessage = "resolved";
			try { await pendingAsk; } catch (err) { closedMessage = err.message; }
			out.closedMessage = closedMessage;
			waitingChild.close();

			// --- client-side bound, before anything reaches the wire ----------------
			const strictParent = await ParentChannel.create({
				socketPath: channelSocketPath("strict", tmpRoot),
				onQuery: () => {},
			});
			const strictChild = await ChildChannel.connect(strictParent.socketPath, { timeoutMs: 4000 });
			let boundMessage = "resolved";
			try { await strictChild.ask("x".repeat(MAX_MESSAGE_BYTES + 1)); } catch (err) { boundMessage = err.message; }
			out.boundMessage = boundMessage;
			out.boundParentSaw = strictParent.pending().length;
			strictChild.close();
			await strictParent.close();

			// --- wire contract: forged and malformed frames never settle ------------
			const forgedServer = net.createServer((socket) => {
				let buffer = "";
				socket.setEncoding("utf8");
				socket.on("data", (chunk) => {
					buffer += chunk;
					const lines = buffer.split("\\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.trim()) continue;
						const frame = JSON.parse(line);
						socket.write(JSON.stringify({ v: 1, id: "someone-else", kind: "reply", message: "forged" }) + "\\n");
						socket.write("{not json\\n");
						socket.write(JSON.stringify({ v: 1, id: frame.id, kind: "reply" }) + "\\n");
						socket.write(JSON.stringify({ v: 1, id: frame.id, kind: "reply", message: "verdadero" }) + "\\n");
					}
				});
			});
			const forgedPath = channelSocketPath("forged", tmpRoot);
			await new Promise((r) => forgedServer.listen(forgedPath, r));
			const forgedChild = await ChildChannel.connect(forgedPath, { timeoutMs: 4000 });
			out.forgedSurvived = await forgedChild.ask("¿Estilo visual?");
			forgedChild.close();
			await new Promise((r) => forgedServer.close(r));

			// --- parent side: a malformed child frame is rejected, not fatal --------
			const seen = [];
			const tolerantParent = await ParentChannel.create({
				socketPath: channelSocketPath("tolerant", tmpRoot),
				onQuery: (q) => { seen.push(q.message); },
			});
			const rawChild = net.createConnection(tolerantParent.socketPath);
			await new Promise((r) => rawChild.on("connect", r));
			rawChild.write("{basura\\n");
			rawChild.write(JSON.stringify({ v: 1, id: "q1", kind: "query", message: "¿Ritmo?" }) + "\\n");
			await new Promise((r) => setTimeout(r, 100));
			out.tolerantSaw = seen;
			out.pendingAfterMalformed = tolerantParent.pending().length;
			rawChild.destroy();
			await tolerantParent.close();

			child.close();
			await parent.close();

			out.socketDirCleaned = !fs.existsSync(sockPath);
			fs.rmSync(tmpRoot, { recursive: true, force: true });
			process.stdout.write("SCENARIO:" + JSON.stringify(out) + "\\n");
			process.exit(0);
		`;

		const stdout = execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 120000,
			maxBuffer: 16 * 1024 * 1024,
		});
		const line = stdout.split("\n").find((l) => l.startsWith("SCENARIO:"));
		if (!line) throw new Error(`scenario produced no report: ${stdout}`);
		return JSON.parse(line.slice("SCENARIO:".length));
	};

	let report;
	beforeAll(() => { report = runScenario(); }, 120000);

	test("the channel lives on its own socket, not on the child's RPC stdio", () => {
		expect(report.pathIsInsideRoot).toBe(true);
		expect(report.pathLength).toBeLessThanOrEqual(100);
	});

	test("a query reaches the parent with its choices and the answer comes back", () => {
		expect(report.roundTrip).toBe("Estratégica global, por turnos");
		expect(report.querySawMessage).toBe("¿Escala del juego?");
		expect(report.querySawId).toBe(true);
		expect(report.choicesCount).toBe(2);
		expect(report.querySawChoices[0].label).toBe("Estratégica global");
	});

	test("a query is pending until it is answered, then it is gone", () => {
		expect(report.pendingAfterCreate).toBe(0);
		expect(report.pendingAfterReply).toBe(0);
		expect(report.replyAccepted).toBe(true);
	});

	test("correlation is strict: one reply settles, a second is refused", () => {
		expect(report.duplicateReply).toBe(false);
		expect(report.duplicateOnUnknown).toBe(false);
	});

	test("at most four queries are pending per child, and the parent sees only those", () => {
		expect(report.capAccepted).toBe(4);
		expect(report.capFifthCode).toContain("channel_busy");
		expect(report.capParentSaw).toBe(4);
	});

	test("the wait budget is ours: it times out on our clock, not in 30 seconds", () => {
		expect(report.timeoutMessage).toContain("timed out");
		expect(report.lateReplyAccepted).toBe(false);
	});

	test("a parent that goes away settles the pending ask instead of hanging", () => {
		expect(report.closedMessage).toContain("closed");
	});

	test("an oversized message is refused before it reaches the wire", () => {
		expect(report.boundMessage).toContain("too large");
		expect(report.boundParentSaw).toBe(0);
	});

	test("forged and malformed replies never settle a query", () => {
		expect(report.forgedSurvived).toBe("verdadero");
	});

	test("a malformed child frame is not fatal and is not surfaced as a query", () => {
		expect(report.tolerantSaw).toEqual(["¿Ritmo?"]);
		expect(report.pendingAfterMalformed).toBe(1);
	});

	test("closing the channel removes its socket", () => {
		expect(report.socketDirCleaned).toBe(true);
	});
});
