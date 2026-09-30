import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface ChoiceOption {
	label: string;
	description?: string;
	value: string;
}

export interface ChoiceParams {
	question: string;
	options: ChoiceOption[];
	allowCustomResponse?: boolean;
}

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

export function registerAskUserChoice(pi: ExtensionAPI): void {
	// ──────────────────────────────────────────────
	// 1. Tool: ask_user_choice (Single Question Menu)
	// ──────────────────────────────────────────────
	(pi as any).registerTool?.({
		name: "ask_user_choice",
		label: "Ask User Choice",
		description:
			"Presents an interactive menu to the user in the TUI allowing them to navigate with arrow keys (↑/↓) and select an option with Enter. Use this whenever asking the user for a single decision or choice.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["question", "options"],
			properties: {
				question: {
					type: "string",
					description: "The header or question to display above the choices.",
				},
				options: {
					type: "array",
					minItems: 2,
					maxItems: 8,
					description: "List of selectable options with label, optional description, and return value.",
					items: {
						type: "object",
						additionalProperties: false,
						required: ["label", "value"],
						properties: {
							label: { type: "string", description: "Display label for the option" },
							description: { type: "string", description: "Brief description of the option" },
							value: { type: "string", description: "Value or identifier returned when selected" },
						},
					},
				},
				allowCustomResponse: {
					type: "boolean",
					description: "Allow the user to type a custom response (Other...)",
				},
			},
		} as never,
		async execute(
			_id: string,
			params: ChoiceParams,
			_signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		) {
			if (!params.options || !Array.isArray(params.options) || params.options.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No options provided to ask_user_choice." }],
					details: { error: "empty_options" },
				};
			}

			const optionLabels = params.options.map((opt, i) => {
				const desc = opt.description ? ` — ${opt.description}` : "";
				return `${i + 1}. ${opt.label}${desc}`;
			});

			const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";
			if (params.allowCustomResponse) {
				optionLabels.push(OTHER_LABEL);
			}

			if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
				const picked = await (ctx.ui as any).select(params.question, optionLabels);

				if (picked === undefined || picked === null) {
					return {
						content: [{ type: "text", text: "User cancelled the selection." }],
						details: { cancelled: true },
					};
				}

				if (params.allowCustomResponse && picked === OTHER_LABEL) {
					let customText = "";
					if (typeof (ctx.ui as any)?.input === "function") {
						customText = await (ctx.ui as any).input(params.question, "");
					}
					return {
						content: [{ type: "text", text: `User provided custom response: ${customText}` }],
						details: { customResponse: customText },
					};
				}

				const idx = typeof picked === "number" ? picked : optionLabels.indexOf(picked);
				const selectedOption = params.options[idx] || params.options[0];

				return {
					content: [
						{
							type: "text",
							text: `User selected: ${idx + 1}. ${selectedOption.label} (value: ${selectedOption.value})`,
						},
					],
					details: {
						selection: {
							index: idx + 1,
							label: selectedOption.label,
							value: selectedOption.value,
						},
					},
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `Interactive UI unavailable. Presented choices:\n${optionLabels.join("\n")}`,
					},
				],
				details: { fallback: true },
			};
		},
	});

	// ──────────────────────────────────────────────
	// 2. Tool: ask_user_question (Batch Questionnaire)
	// Como lo hace Gentle Shell: pregunta 1 a 4 preguntas seguidas en lote
	// ──────────────────────────────────────────────
	(pi as any).registerTool?.({
		name: "ask_user_question",
		label: "Ask User Question",
		description:
			"Ask 1 to 4 structured questions in a single batch, each with 2 to 4 options. The user answers them sequentially using interactive TUI menus with arrow keys (↑/↓) and Enter, and all answers are returned in a single result.",
		parameters: {
			type: "object",
			additionalProperties: false,
			required: ["questions"],
			properties: {
				questions: {
					type: "array",
					minItems: 1,
					maxItems: 4,
					description: "List of 1 to 4 questions to present in batch.",
					items: {
						type: "object",
						additionalProperties: false,
						required: ["question", "options"],
						properties: {
							question: { type: "string", description: "The full question text" },
							header: { type: "string", description: "Short header or step label (e.g. 'Paso 1: Motor')" },
							allowCustomResponse: {
								type: "boolean",
								description: "If true, appends an option to type a custom response",
							},
							options: {
								type: "array",
								minItems: 2,
								maxItems: 6,
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
			if (!params.questions || !Array.isArray(params.questions) || params.questions.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No questions provided to ask_user_question." }],
					details: { error: "empty_questions" },
				};
			}

			if (!ctx.hasUI || typeof (ctx.ui as any)?.select !== "function") {
				return {
					content: [{ type: "text", text: "Error: Interactive UI unavailable for questionnaires." }],
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
			for (let i = 0; i < params.questions.length; i++) {
				const q = params.questions[i];
				const header = q.header ? `[${q.header}] ` : `[${i + 1}/${params.questions.length}] `;
				const title = `${header}${q.question}`;

				const labels = q.options.map((opt, optIdx) => {
					const desc = opt.description ? ` — ${opt.description}` : "";
					return `${optIdx + 1}. ${opt.label}${desc}`;
				});

				// Permitir respuesta personalizada si está habilitado en la pregunta (por defecto true si allowCustomResponse !== false)
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
						answer: chosenOpt.label,
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
						text: `The user answered the questionnaire:\n${summaryLines.join("\n")}`,
					},
				],
				details: {
					answers: committedAnswers,
				},
			};
		},
	});
}
