import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { playAlertChime } from "./studio-sound.ts";

let Text: any;
try {
	Text = (await import("@earendil-works/pi-tui")).Text;
} catch {
	Text = class Text {
		text: string;
		x: number;
		y: number;
		constructor(text = "", x = 0, y = 0) {
			this.text = text;
			this.x = x;
			this.y = y;
		}
	};
}
import {
	ACCENT,
	SECONDARY,
	GREEN,
	WHITE,
	GRAY,
	BORDER,
	RESET,
	BOLD,
	DIM,
} from "./studio-palette.ts";

export interface QuestionOption {
	label: string;
	description?: string;
	preview?: string;
}

export interface QuestionItem {
	question: string;
	header?: string;
	options: QuestionOption[];
	multiSelect?: boolean;
	allowCustomResponse?: boolean;
}

export interface QuestionParams {
	questions: QuestionItem[];
}

export interface CommittedAnswer {
	questionIndex: number;
	question: string;
	header?: string;
	answer: string;
	custom?: boolean;
}

export interface QuestionnaireResult {
	cancelled: boolean;
	answers: CommittedAnswer[];
}

export const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";

/**
 * Renders tab indicators for multi-step questionnaires:
 * e.g. [ 1. Header* ]  [ 2. Header ]
 */
export function renderQuestionTabs(currentIndex: number, questions: QuestionItem[]): string {
	return questions
		.map((q, idx) => {
			const label = q.header || `Pregunta ${idx + 1}`;
			return idx === currentIndex ? `[ ${idx + 1}. ${label}* ]` : `[ ${idx + 1}. ${label} ]`;
		})
		.join("  ");
}

/**
 * Formats question prompt using Gentle Shell style left accent bar ▎
 * and tab indicators for multi-step questions.
 */
export function formatQuestionPrompt(currentIndex: number, questions: QuestionItem[]): string {
	const q = questions[currentIndex];
	if (questions.length > 1) {
		const tabs = renderQuestionTabs(currentIndex, questions);
		return `▎ ${tabs}\n▎ ${q.question}`;
	}
	const headerPrefix = q.header ? `[${q.header}] ` : "";
	return `▎ ${headerPrefix}${q.question}`;
}

let piTuiModule: any = null;
let piTuiAttempted = false;

export async function getPiTuiModule(): Promise<any> {
	if (!piTuiAttempted) {
		piTuiAttempted = true;
		try {
			piTuiModule = await import("@earendil-works/pi-tui");
		} catch {}
	}
	return piTuiModule;
}

export function isKey(
	data: string,
	name:
		| "up"
		| "down"
		| "left"
		| "right"
		| "enter"
		| "escape"
		| "tab"
		| "shift_tab"
		| "backspace"
		| "space",
	kb?: any,
): boolean {
	// 1. Injected keybindings manager from Pi
	if (kb && typeof kb.matches === "function") {
		try {
			if (
				name === "up" &&
				(kb.matches(data, "tui.select.up") || kb.matches(data, "tui.editor.cursorUp"))
			)
				return true;
			if (
				name === "down" &&
				(kb.matches(data, "tui.select.down") || kb.matches(data, "tui.editor.cursorDown"))
			)
				return true;
			if (
				name === "left" &&
				(kb.matches(data, "tui.editor.cursorLeft") || kb.matches(data, "tui.select.left"))
			)
				return true;
			if (
				name === "right" &&
				(kb.matches(data, "tui.editor.cursorRight") || kb.matches(data, "tui.select.right"))
			)
				return true;
			if (
				name === "enter" &&
				(kb.matches(data, "tui.select.confirm") ||
					kb.matches(data, "tui.editor.submit") ||
					kb.matches(data, "tui.editor.newline"))
			)
				return true;
			if (
				name === "escape" &&
				(kb.matches(data, "tui.select.cancel") ||
					kb.matches(data, "app.interrupt") ||
					kb.matches(data, "app.escape"))
			)
				return true;
		} catch {}
	}

	// 2. Pi TUI matchesKey helper (if preloaded or available)
	if (piTuiModule?.matchesKey) {
		try {
			const K = piTuiModule.Key;
			if (
				name === "up" &&
				(piTuiModule.matchesKey(data, K?.up || "up") || piTuiModule.matchesKey(data, "k"))
			)
				return true;
			if (
				name === "down" &&
				(piTuiModule.matchesKey(data, K?.down || "down") || piTuiModule.matchesKey(data, "j"))
			)
				return true;
			if (
				name === "left" &&
				(piTuiModule.matchesKey(data, K?.left || "left") || piTuiModule.matchesKey(data, "h"))
			)
				return true;
			if (
				name === "right" &&
				(piTuiModule.matchesKey(data, K?.right || "right") || piTuiModule.matchesKey(data, "l"))
			)
				return true;
			if (name === "enter" && piTuiModule.matchesKey(data, K?.enter || "enter")) return true;
			if (name === "space" && piTuiModule.matchesKey(data, K?.space || "space")) return true;
			if (
				name === "escape" &&
				(piTuiModule.matchesKey(data, K?.escape || "escape") ||
					piTuiModule.matchesKey(data, "ctrl+c"))
			)
				return true;
			if (name === "tab" && piTuiModule.matchesKey(data, K?.tab || "tab")) return true;
			if (
				name === "shift_tab" &&
				(piTuiModule.matchesKey(data, K?.shift ? K.shift("tab") : "shift+tab") ||
					piTuiModule.matchesKey(data, "shift+tab"))
			)
				return true;
			if (name === "backspace" && piTuiModule.matchesKey(data, K?.backspace || "backspace"))
				return true;
		} catch {}
	}

	// 3. Robust raw escape sequences & protocols (Kitty keyboard protocol, VT100 / xterm application keys, legacy ANSI)
	switch (name) {
		case "up":
			return (
				data === "\x1b[A" ||
				data === "\x1bOA" ||
				data === "k" ||
				data === "K" ||
				/^(\x1b\[1;[0-9]+A|\x1b\[[0-9;]*A|\x1b\[57373[;0-9]*u)$/.test(data)
			);
		case "down":
			return (
				data === "\x1b[B" ||
				data === "\x1bOB" ||
				data === "j" ||
				data === "J" ||
				/^(\x1b\[1;[0-9]+B|\x1b\[[0-9;]*B|\x1b\[57374[;0-9]*u)$/.test(data)
			);
		case "left":
			return (
				data === "\x1b[D" ||
				data === "\x1bOD" ||
				data === "h" ||
				data === "H" ||
				/^(\x1b\[1;[0-9]+D|\x1b\[[0-9;]*D|\x1b\[57376[;0-9]*u)$/.test(data)
			);
		case "right":
			return (
				data === "\x1b[C" ||
				data === "\x1bOC" ||
				data === "l" ||
				data === "L" ||
				/^(\x1b\[1;[0-9]+C|\x1b\[[0-9;]*C|\x1b\[57375[;0-9]*u)$/.test(data)
			);
		case "enter":
			return (
				data === "\r" ||
				data === "\n" ||
				data === "\r\n" ||
				data === "\x1bOM" ||
				/^(\x1b\[13[;0-9]*u|\x1b\[13;[0-9]+u)$/.test(data)
			);
		case "space":
			return data === " " || /^\x1b\[32[;0-9]*u$/.test(data);
		case "escape":
			return (
				data === "\x1b" ||
				data === "\x1b\x1b" ||
				data === "\x03" ||
				/^\x1b\[27[;0-9]*u$/.test(data) ||
				data === "q" ||
				data === "Q"
			);
		case "tab":
			return data === "\t" || /^\x1b\[9[;0-9]*u$/.test(data);
		case "shift_tab":
			return data === "\x1b[Z" || /^\x1b\[9;2u$/.test(data) || data === "\x1b[1;2Z";
		case "backspace":
			return data === "\x7f" || data === "\b" || /^\x1b\[127[;0-9]*u$/.test(data);
	}
	return false;
}

/**
 * Interactive Sovereign TUI Questionnaire Component for Pi Game Studio.
 * Mounts in ctx.ui.custom with top tab strip, cursor navigation, dimmed descriptions,
 * inline custom text editor, and keyboard shortcuts (Tab, Shift+Tab, Up/Down, Enter, Esc).
 */
export class StudioQuestionnaireComponent {
	public questions: QuestionItem[];
	public activeQuestion: number = 0;
	public cursor: number[];
	public answers: Array<CommittedAnswer | undefined>;
	public drafts: string[];
	public isEditingCustom: boolean = false;
	public textCursor: number = 0;
	private tui: any;
	private theme: any;
	private done: (result?: QuestionnaireResult) => void;
	private kb?: any;

	constructor(
		questions: QuestionItem[],
		tui: any,
		theme: any,
		done: (result?: QuestionnaireResult) => void,
		kb?: any,
	) {
		this.questions = questions;
		this.tui = tui;
		this.theme = theme;
		this.done = done;
		this.kb = kb;
		this.cursor = questions.map(() => 0);
		this.answers = questions.map(() => undefined);
		this.drafts = questions.map(() => "");
	}

	public requestRender(): void {
		if (this.tui?.requestRender) {
			try {
				this.tui.requestRender();
			} catch {}
		}
	}

	public invalidate(): void {
		this.requestRender();
	}

	public getCommittedAnswers(): CommittedAnswer[] {
		const result: CommittedAnswer[] = [];
		for (let i = 0; i < this.questions.length; i++) {
			const ans = this.answers[i];
			if (ans) {
				result.push(ans);
			} else {
				const q = this.questions[i];
				result.push({
					questionIndex: i + 1,
					question: q.question,
					header: q.header,
					answer: q.options[0]?.label || "",
				});
			}
		}
		return result;
	}

	public handleInput(data: string): void {
		// When user is currently typing a custom free-text response
		if (this.isEditingCustom) {
			if (isKey(data, "tab", this.kb)) {
				this.isEditingCustom = false;
				this.activeQuestion = (this.activeQuestion + 1) % this.questions.length;
				this.requestRender();
				return;
			}
			if (isKey(data, "shift_tab", this.kb)) {
				this.isEditingCustom = false;
				this.activeQuestion =
					(this.activeQuestion - 1 + this.questions.length) % this.questions.length;
				this.requestRender();
				return;
			}
			if (isKey(data, "escape", this.kb)) {
				this.isEditingCustom = false;
				this.requestRender();
				return;
			}
			if (data === "\x03") {
				this.done({ cancelled: true, answers: this.getCommittedAnswers() });
				return;
			}
			if (isKey(data, "enter", this.kb)) {
				const q = this.questions[this.activeQuestion];
				const draftVal = this.drafts[this.activeQuestion].trim() || "Otro";
				this.answers[this.activeQuestion] = {
					questionIndex: this.activeQuestion + 1,
					question: q.question,
					header: q.header,
					answer: draftVal,
					custom: true,
				};
				this.isEditingCustom = false;

				const isLastQuestion = this.activeQuestion === this.questions.length - 1;
				const allAnswered = this.questions.every((_, idx) => Boolean(this.answers[idx]));

				if (isLastQuestion && allAnswered) {
					this.done({ cancelled: false, answers: this.getCommittedAnswers() });
					return;
				}

				if (isLastQuestion && !allAnswered) {
					const nextUnanswered = this.questions.findIndex((_, idx) => !this.answers[idx]);
					this.activeQuestion = nextUnanswered !== -1 ? nextUnanswered : 0;
				} else {
					this.activeQuestion = (this.activeQuestion + 1) % this.questions.length;
				}
				this.requestRender();
				return;
			}
			if (isKey(data, "backspace", this.kb)) {
				if (this.textCursor > 0) {
					const draft = this.drafts[this.activeQuestion];
					this.drafts[this.activeQuestion] =
						draft.slice(0, this.textCursor - 1) + draft.slice(this.textCursor);
					this.textCursor--;
					this.requestRender();
				}
				return;
			}
			if (isKey(data, "left", this.kb)) {
				this.textCursor = Math.max(0, this.textCursor - 1);
				this.requestRender();
				return;
			}
			if (isKey(data, "right", this.kb)) {
				this.textCursor = Math.min(this.drafts[this.activeQuestion].length, this.textCursor + 1);
				this.requestRender();
				return;
			}
			if (data === "\x15") {
				this.drafts[this.activeQuestion] = "";
				this.textCursor = 0;
				this.requestRender();
				return;
			}
			if (data.length === 1 && data.charCodeAt(0) >= 32) {
				const draft = this.drafts[this.activeQuestion];
				this.drafts[this.activeQuestion] =
					draft.slice(0, this.textCursor) + data + draft.slice(this.textCursor);
				this.textCursor++;
				this.requestRender();
				return;
			}
			return;
		}

		// Navigation mode: Tab / Shift+Tab to switch between question steps (for multi-step)
		if (this.questions.length > 1) {
			if (isKey(data, "tab", this.kb) || isKey(data, "right", this.kb)) {
				this.activeQuestion = (this.activeQuestion + 1) % this.questions.length;
				this.requestRender();
				return;
			}
			if (isKey(data, "shift_tab", this.kb) || isKey(data, "left", this.kb)) {
				this.activeQuestion =
					(this.activeQuestion - 1 + this.questions.length) % this.questions.length;
				this.requestRender();
				return;
			}
		}

		// Up to move option cursor
		if (isKey(data, "up", this.kb)) {
			if (this.cursor[this.activeQuestion] > 0) {
				this.cursor[this.activeQuestion]--;
				this.requestRender();
			}
			return;
		}

		// Down to move option cursor
		if (isKey(data, "down", this.kb)) {
			const q = this.questions[this.activeQuestion];
			const allowCustom = q.allowCustomResponse !== false;
			const maxRow = allowCustom ? q.options.length : q.options.length - 1;
			if (this.cursor[this.activeQuestion] < maxRow) {
				this.cursor[this.activeQuestion]++;
				this.requestRender();
			}
			return;
		}

		// Number keys (1-9) to quickly move cursor to option
		if (/^[1-9]$/.test(data)) {
			const numIdx = parseInt(data, 10) - 1;
			const q = this.questions[this.activeQuestion];
			const allowCustom = q.allowCustomResponse !== false;
			const maxRow = allowCustom ? q.options.length : q.options.length - 1;
			if (numIdx <= maxRow) {
				this.cursor[this.activeQuestion] = numIdx;
				this.requestRender();
				return;
			}
		}

		// Enter or Space: Select option or trigger custom text edit
		if (isKey(data, "enter", this.kb) || isKey(data, "space", this.kb)) {
			const q = this.questions[this.activeQuestion];
			const allowCustom = q.allowCustomResponse !== false;
			const cur = this.cursor[this.activeQuestion];

			if (allowCustom && cur === q.options.length) {
				this.isEditingCustom = true;
				this.textCursor = this.drafts[this.activeQuestion].length;
				this.requestRender();
				return;
			}

			const chosenOpt = q.options[cur] || q.options[0];
			this.answers[this.activeQuestion] = {
				questionIndex: this.activeQuestion + 1,
				question: q.question,
				header: q.header,
				answer: chosenOpt?.label || "",
			};

			const isLastQuestion = this.activeQuestion === this.questions.length - 1;
			const allAnswered = this.questions.every((_, idx) => Boolean(this.answers[idx]));

			if (isLastQuestion && allAnswered) {
				this.done({ cancelled: false, answers: this.getCommittedAnswers() });
				return;
			}

			if (isLastQuestion && !allAnswered) {
				const nextUnanswered = this.questions.findIndex((_, idx) => !this.answers[idx]);
				this.activeQuestion = nextUnanswered !== -1 ? nextUnanswered : 0;
			} else {
				this.activeQuestion = (this.activeQuestion + 1) % this.questions.length;
			}
			this.requestRender();
			return;
		}

		// Esc / q / Ctrl+C to cancel questionnaire
		if (isKey(data, "escape", this.kb)) {
			this.done({ cancelled: true, answers: this.getCommittedAnswers() });
			return;
		}
	}

	public renderTabs(): string {
		const total = this.questions.length;
		const progress = `${GRAY}[${this.activeQuestion + 1}/${total}]${RESET}`;
		const chips = this.questions.map((q, idx) => {
			const header = q.header || `Paso ${idx + 1}`;
			const isAnswered = Boolean(this.answers[idx]);
			const isActive = idx === this.activeQuestion;

			if (isActive) {
				const check = isAnswered ? `${GREEN}✓ ${RESET}${ACCENT}${BOLD}` : "";
				return `${ACCENT}${BOLD}▸ ${check}${header}${RESET}`;
			}
			if (isAnswered) {
				return `${GREEN}✓ ${RESET}${WHITE}${header}${RESET}`;
			}
			return `${GRAY}${header}${RESET}`;
		});

		return `  ${progress}   ${chips.join("   ")}`;
	}

	public renderBody(): string[] {
		const lines: string[] = [];
		const q = this.questions[this.activeQuestion];
		if (!q) return lines;

		// Bold question title
		lines.push(`  ${BOLD}${WHITE}${q.question}${RESET}`);
		lines.push("");

		if (this.isEditingCustom) {
			const draft = this.drafts[this.activeQuestion];
			const beforeCursor = draft.slice(0, this.textCursor);
			const atCursor = draft[this.textCursor] || " ";
			const afterCursor = draft.slice(this.textCursor + 1);

			lines.push(`  ${SECONDARY}${BOLD}Respuesta personalizada:${RESET}`);
			lines.push(`  ${BORDER}╭──────────────────────────────────────────────────────────╮${RESET}`);
			lines.push(
				`  ${BORDER}│${RESET} > ${WHITE}${beforeCursor}${RESET}\x1b[7m${atCursor}\x1b[27m${WHITE}${afterCursor}${RESET}`,
			);
			lines.push(`  ${BORDER}╰──────────────────────────────────────────────────────────╯${RESET}`);
			return lines;
		}

		const allowCustom = q.allowCustomResponse !== false;
		const cur = this.cursor[this.activeQuestion];

		for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
			const opt = q.options[optIdx];
			const isCursor = cur === optIdx;
			const isSelected =
				this.answers[this.activeQuestion]?.answer === opt.label &&
				!this.answers[this.activeQuestion]?.custom;

			const cursorSymbol = isCursor ? `${SECONDARY}${BOLD}❯ ${RESET}` : "  ";
			const titleText = isCursor
				? `${ACCENT}${BOLD}${opt.label}${RESET}`
				: `${WHITE}${opt.label}${RESET}`;
			const selectedBadge = isSelected ? ` ${GREEN}✓${RESET}` : "";

			lines.push(`  ${cursorSymbol}${titleText}${selectedBadge}`);

			if (opt.description) {
				lines.push(`      ${GRAY}${opt.description}${RESET}`);
			}
		}

		if (allowCustom) {
			const customIdx = q.options.length;
			const isCustomCursor = cur === customIdx;
			const isCustomAnswered = Boolean(this.answers[this.activeQuestion]?.custom);
			const customAns = this.answers[this.activeQuestion]?.answer;

			const cursorSymbol = isCustomCursor ? `${SECONDARY}${BOLD}❯ ${RESET}` : "  ";
			const labelText = isCustomCursor
				? `${ACCENT}${BOLD}${OTHER_LABEL}${RESET}`
				: `${GRAY}${OTHER_LABEL}${RESET}`;

			lines.push(`  ${cursorSymbol}${labelText}`);

			if (isCustomAnswered && customAns) {
				lines.push(`      ${GREEN}✓ ${WHITE}"${customAns}"${RESET}`);
			} else if (this.drafts[this.activeQuestion]) {
				lines.push(`      ${GRAY}Borrador: "${this.drafts[this.activeQuestion]}"${RESET}`);
			}
		}

		return lines;
	}

	public renderFooter(): string {
		if (this.isEditingCustom) {
			return `  ${GRAY}enter confirmar · esc volver a opciones · tab cambiar pregunta${RESET}`;
		}
		if (this.questions.length > 1) {
			return `  ${GRAY}↑↓ navegar · enter seleccionar · tab cambiar pregunta · esc cancelar${RESET}`;
		}
		return `  ${GRAY}↑↓ navegar · enter seleccionar · esc cancelar${RESET}`;
	}

	public render(_width: number): string[] {
		const lines: string[] = [];
		lines.push("");
		lines.push(this.renderTabs());
		lines.push("");
		lines.push(...this.renderBody());
		lines.push("");
		lines.push(this.renderFooter());
		lines.push("");
		return lines;
	}
}

export function registerAskUserQuestion(pi: ExtensionAPI): void {
	// If tool is already registered globally (e.g. by gentle-pi or host), don't register duplicate
	const hasTool = (name: string) => {
		try {
			if (typeof (pi as any).hasTool === "function") return (pi as any).hasTool(name);
			if (typeof (pi as any).getAllTools === "function") {
				const tools = (pi as any).getAllTools();
				return Array.isArray(tools) && tools.some((t: any) => t?.name === name);
			}
			return false;
		} catch {
			return false;
		}
	};

	if (hasTool("ask_user_question")) {
		return;
	}

	// ──────────────────────────────────────────────
	// Unified Tool: ask_user_question (Single & Batch Questions)
	// ──────────────────────────────────────────────
	try {
		(pi as any).registerTool?.({
		name: "ask_user_question",
		label: "Ask User Question",
		description:
			"Presents interactive questions to the user in the TUI (1 to 4 questions). The user navigates options using arrow keys (↑/↓) and selects with Enter, with an automatic option to type custom free-text responses ('Otro...'). Use this whenever asking the user for decisions, choices, design directions, or multi-step questionnaires.",
		renderCall(args: any, theme: any, _context?: any) {
			const fg = (slot: string, text: string) => (theme?.fg ? theme.fg(slot as any, text) : text);
			const bold = (text: string) => (theme?.bold ? theme.bold(text) : text);

			const questions = (args?.questions || []) as any[];
			const count = questions.length;
			const firstHeader = questions[0]?.header ? ` · ${questions[0].header}` : "";
			const label = count > 1 ? `DECISIONES (${count})${firstHeader}` : `DECISIÓN${firstHeader}`;

			const badge = fg("accent", "▌ ◈ STUDIO CHOICE");
			const line = `${badge} · ${bold(label)}`;
			return new Text(line, 0, 0);
		},
		renderResult(result: any, options: { expanded?: boolean; isPartial?: boolean } = {}, theme: any, _context?: any) {
			const fg = (slot: string, text: string) => (theme?.fg ? theme.fg(slot as any, text) : text);
			const bold = (text: string) => (theme?.bold ? theme.bold(text) : text);

			if (options?.isPartial) {
				return new Text(fg("accent", "▌ ◈ ESPERANDO RESPUESTA..."), 0, 0);
			}

			const answers = (result?.details as any)?.answers || [];
			if (answers.length === 0) {
				if (result?.details?.cancelled) {
					return new Text(fg("muted", "▌ ◈ Cuestionario cancelado por el usuario"), 0, 0);
				}
				return new Text(fg("muted", "▌ ◈ Sin respuesta registrada"), 0, 0);
			}

			const badge = fg("success", "▌ ◈ RESPUESTA CONFIRMADA");
			const answerLines = answers
				.map((a: any) => `  ${fg("dim", `${a.question}`)}\n  → ${bold(a.answer)}`)
				.join("\n");
			return new Text(`${badge}\n${answerLines}`, 0, 0);
		},
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["questions"],
			properties: {
				questions: {
					type: "array",
					minItems: 1,
					maxItems: 4,
					description: "List of 1 to 4 questions to present in sequence.",
					items: {
						type: "object",
						additionalProperties: false,
						required: ["question", "options"],
						properties: {
							question: { type: "string", description: "The full question text" },
							header: { type: "string", description: "Short header or step label (e.g. 'Paso 1: Motor')" },
							allowCustomResponse: {
								type: "boolean",
								description: "If true, appends an option to type a custom response. Defaults to true.",
							},
							options: {
								type: "array",
								minItems: 2,
								maxItems: 8,
								description: "Options to select from",
								items: {
									type: "object",
									additionalProperties: false,
									required: ["label"],
									properties: {
										label: { type: "string", description: "Option label" },
										description: { type: "string", description: "Option description" },
									},
								},
							},
						},
					},
				},
			},
		} as never,
		async execute(
			_id: string,
			params: QuestionParams,
			_signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		) {
			const questions: QuestionItem[] = Array.isArray(params?.questions)
				? params.questions
				: (params as any)?.question
					? [
							{
								question: (params as any).question,
								header: (params as any).header,
								options: (params as any).options,
								allowCustomResponse: (params as any).allowCustomResponse,
							},
						]
					: [];

			if (questions.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No questions provided to ask_user_question." }],
					details: { error: "empty_questions" },
				};
			}

			// Trigger sound alert when user interaction is required
			try {
				playAlertChime();
			} catch {}

			// 1. Primary native UI: Pi's built-in select dialog (guaranteed arrow key & enter navigation)
			if (Boolean(ctx?.hasUI) && typeof (ctx.ui as any)?.select === "function") {
				const committedAnswers: CommittedAnswer[] = [];

				for (let i = 0; i < questions.length; i++) {
					const q = questions[i];
					const title = formatQuestionPrompt(i, questions);

					const labels = (q.options || []).map((opt, optIdx) => {
						const desc = opt.description ? ` — ${opt.description}` : "";
						return `${optIdx + 1}. ${opt.label}${desc}`;
					});

					const allowCustom = q.allowCustomResponse !== false;
					if (allowCustom) {
						labels.push(OTHER_LABEL);
					}

					const picked = await (ctx.ui as any).select(title, labels);

					if (picked === undefined || picked === null) {
						return {
							content: [
								{
									type: "text",
									text: `User cancelled the questionnaire at step ${i + 1}.`,
								},
							],
							details: { cancelled: true, completedCount: i },
						};
					}

					if (allowCustom && picked === OTHER_LABEL) {
						let customText = "";
						if (typeof (ctx.ui as any)?.input === "function") {
							customText = await (ctx.ui as any).input(title, "");
						}
						committedAnswers.push({
							questionIndex: i + 1,
							question: q.question,
							header: q.header,
							answer: customText || "Otro",
							custom: true,
						});
					} else {
						const idx = typeof picked === "number" ? picked : labels.indexOf(picked);
						const chosenOpt = q.options[idx] || q.options[0];

						committedAnswers.push({
							questionIndex: i + 1,
							question: q.question,
							header: q.header,
							answer: chosenOpt?.label || String(picked),
						});
					}
				}

				const summaryLines = committedAnswers.map(
					(a) => `${a.questionIndex}. ${a.question} -> ${a.answer}`,
				);

				return {
					content: [
						{
							type: "text",
							text: `The user answered the question(s):\n${summaryLines.join("\n")}`,
						},
					],
					details: {
						answers: committedAnswers,
						selection: committedAnswers[0] || null,
					},
				};
			}

			// 2. Custom TUI component (for environments/tests where custom is provided)
			const isInteractiveTui =
				Boolean(ctx?.hasUI) &&
				(ctx as any)?.mode === "tui" &&
				typeof (ctx.ui as any)?.custom === "function";

			if (isInteractiveTui) {
				await getPiTuiModule();
				const selection = await (ctx.ui as any).custom(
					(
						tui: any,
						theme: any,
						kb: any,
						done: (res?: QuestionnaireResult) => void,
					) => {
						return new StudioQuestionnaireComponent(questions, tui, theme, done, kb);
					},
				);

				if (!selection || selection.cancelled) {
					return {
						content: [
							{
								type: "text",
								text: "User cancelled the questionnaire.",
							},
						],
						details: { cancelled: true, completedCount: selection?.answers?.length || 0 },
					};
				}

				const summaryLines = selection.answers.map(
					(a: CommittedAnswer) => `${a.questionIndex}. ${a.question} -> ${a.answer}`,
				);

				return {
					content: [
						{
							type: "text",
							text: `The user answered the question(s):\n${summaryLines.join("\n")}`,
						},
					],
					details: {
						answers: selection.answers,
						selection: selection.answers[0] || null,
					},
				};
			}

			// Fallback: Headless / Tests / Non-UI mode
			return {
				content: [{ type: "text", text: "Error: Interactive UI unavailable for questions." }],
				details: { fallback: true },
			};
		},
	});
	} catch {}
}
