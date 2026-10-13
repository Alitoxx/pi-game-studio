import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { playAlertChime } from "./studio-sound.ts";

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

export function registerAskUserQuestion(pi: ExtensionAPI): void {
	// If tool is already registered globally (e.g. by gentle-pi), don't register duplicate
	const hasTool = (name: string) => {
		try {
			return typeof (pi as any).hasTool === "function" ? (pi as any).hasTool(name) : false;
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
	(pi as any).registerTool?.({
		name: "ask_user_question",
		label: "Ask User Question",
		description:
			"Presents interactive questions to the user in the TUI (1 to 4 questions). The user navigates options using arrow keys (↑/↓) and selects with Enter, with an automatic option to type custom free-text responses ('Otro...'). Use this whenever asking the user for decisions, choices, design directions, or multi-step questionnaires.",
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
			const questions = Array.isArray(params?.questions)
				? params.questions
				: (params as any)?.question
					? [
							{
								question: (params as any).question,
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

			if (!ctx.hasUI || typeof (ctx.ui as any)?.select !== "function") {
				return {
					content: [{ type: "text", text: "Error: Interactive UI unavailable for questions." }],
					details: { fallback: true },
				};
			}

			const committedAnswers: Array<{
				questionIndex: number;
				question: string;
				header?: string;
				answer: string;
				custom?: boolean;
			}> = [];

			const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";

			// Presentar cada pregunta secuencialmente con el selector de flechas
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				const title = formatQuestionPrompt(i, questions);

				const labels = (q.options || []).map((opt, optIdx) => {
					const desc = opt.description ? ` — ${opt.description}` : "";
					return `${optIdx + 1}. ${opt.label}${desc}`;
				});

				// Permitir respuesta personalizada si está habilitado (por defecto true)
				const allowCustom = q.allowCustomResponse !== false;
				if (allowCustom) {
					labels.push(OTHER_LABEL);
				}

				// Trigger sound alert when user interaction is required
				try {
					playAlertChime();
				} catch {}

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

			// Formatear resumen final de respuestas para el LLM
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
		},
	});
}
