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

export interface ChoiceResult {
	value?: string;
	label?: string;
	index?: number;
	customResponse?: string;
}

export function registerAskUserChoice(pi: ExtensionAPI): void {
	(pi as any).registerTool?.({
		name: "ask_user_choice",
		label: "Ask User Choice",
		description:
			"Presents an interactive menu to the user in the TUI allowing them to navigate with arrow keys (↑/↓) and select an option with Enter. Use this whenever asking the user for decisions, options, or selections instead of printing text numbers in the chat.",
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

			// Format options for TUI display
			const optionLabels = params.options.map((opt, i) => {
				const desc = opt.description ? ` — ${opt.description}` : "";
				return `${i + 1}. ${opt.label}${desc}`;
			});

			const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";
			if (params.allowCustomResponse) {
				optionLabels.push(OTHER_LABEL);
			}

			// Interactive selection using Pi's native UI dialog
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

			// Fallback if no interactive UI
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
}
