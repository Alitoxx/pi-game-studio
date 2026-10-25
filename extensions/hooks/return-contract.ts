/**
 * A specialist cannot show a UI: when a decision is genuinely above its role it
 * stops with `interaction_required` and this payload, which the parent relays as
 * a blocking choice. This is a real return channel, not an enum value.
 */
export interface InteractionRequest {
	question: string;
	options: string[];
	blocking: boolean;
}

export interface SpecialistReturn {
	status: "completed" | "partial" | "blocked" | "interaction_required";
	summary: string;
	files_changed?: string[];
	validation?: string[];
	gameplay_impact?: string[];
	risks?: string[];
	next_recommended_specialist?: string;
	interaction?: InteractionRequest;
}

export type EvidenceForm = "cmd" | "structural" | "exception";

/**
 * The agent's declared tools, forwarded by the runner. `bash` decides which
 * evidence family is admissible: an agent that can execute reports
 * `<exact command>: <observed result>`, and an agent that cannot reports the
 * property it read back. Omitted means the capability is unknown, so both
 * families parse; the runner always supplies it, so a real delivery is judged.
 */
export interface ReturnValidationOptions {
	tools?: string[];
}

const CMD_HINT = "'<comando exacto>: <resultado observado>'";
const STRUCTURAL_HINT = "'structural: <propiedad leída>: <resultado>'";
const EXCEPTION_HINT = "'exception: <razón>'";

const splitPair = (value: string): { left: string; right: string } => {
	const separator = value.indexOf(":");
	return separator > 0
		? { left: value.slice(0, separator).trim(), right: value.slice(separator + 1).trim() }
		: { left: "", right: "" };
};

/**
 * A completion claim is evidence, not prose: every entry must name what was run
 * and what it said, or name the property that was read back instead.
 */
function classifyEvidence(entry: string): { form: EvidenceForm } | { problem: string } {
	const value = entry.trim();

	const structural = value.match(/^structural\s*:\s*(.*)$/i);
	if (structural) {
		const { left, right } = splitPair(structural[1].trim());
		if (!left || !right) {
			return { problem: `La entrada '${value}' no es un readback verificable: usa ${STRUCTURAL_HINT}.` };
		}
		return { form: "structural" };
	}

	const exception = value.match(/^exception\s*:\s*(.*)$/i);
	if (exception) {
		if (!exception[1].trim()) {
			return { problem: `La entrada '${value}' no nombra la razón: usa ${EXCEPTION_HINT}.` };
		}
		return { form: "exception" };
	}

	const { left, right } = splitPair(value);
	if (!left || !right) {
		return { problem: `La entrada '${value}' no es evidencia ejecutada: usa ${CMD_HINT}.` };
	}
	return { form: "cmd" };
}

/**
 * Each agent class has exactly one admissible family: borrowing the other
 * class's escape hatch is what turned `validation` into prose in the first place.
 */
function validateEvidence(validation: string[], options?: ReturnValidationOptions): string[] {
	const errors: string[] = [];

	if (validation.length === 0) {
		errors.push(
			`Un 'status: completed' exige evidencia en 'validation': ${CMD_HINT} o, si el agente no tiene 'bash', ${STRUCTURAL_HINT} / ${EXCEPTION_HINT}. 'files_changed' no es evidencia: nombra archivos, no verificación.`,
		);
		return errors;
	}

	const tools = options?.tools;
	const canExecute = tools ? tools.includes("bash") : null;

	for (const entry of validation) {
		const classified = classifyEvidence(entry);
		if ("problem" in classified) {
			errors.push(classified.problem);
			continue;
		}

		if (canExecute === true && classified.form !== "cmd") {
			errors.push(
				`Un agente con 'bash' reporta la forma ${CMD_HINT}: 'structural:' y 'exception:' son el modo pasivo de los agentes sin 'bash'. Si no pudiste verificarlo, devuelve 'status: partial'.`,
			);
		}

		if (canExecute === false && classified.form === "cmd") {
			errors.push(
				`Un agente sin 'bash' no ejecuta comandos: reporta ${STRUCTURAL_HINT} o ${EXCEPTION_HINT}. Si la entrega no se puede verificar así, devuelve 'status: partial'.`,
			);
		}
	}

	return errors;
}

export interface ReturnValidationResult {
	isValid: boolean;
	hasYamlBlock: boolean;
	parsed?: SpecialistReturn;
	errors: string[];
	hasConversationalBleed: boolean;
	conversationalWarnings: string[];
}

const FORBIDDEN_CONVERSATIONAL_PHRASES = [
	"espero que te sirva",
	"espero que esto ayude",
	"quedo a tu disposición",
	"avísame si necesitas",
	"cualquier duda me dices",
	"¡excelente idea!",
	"¡qué gran diseño!",
	"¡fantástico código!",
	"hola,",
	"buenas,",
	"un placer ayudarte",
];

export function validateSpecialistReturn(
	rawText: string,
	options?: ReturnValidationOptions,
): ReturnValidationResult {
	const errors: string[] = [];
	const conversationalWarnings: string[] = [];

	const lower = rawText.toLowerCase();
	for (const phrase of FORBIDDEN_CONVERSATIONAL_PHRASES) {
		if (lower.includes(phrase)) {
			conversationalWarnings.push(`Se detectó prosa conversacional innecesaria: "${phrase}"`);
		}
	}

	// Buscar bloque yaml o bloque de retorno estricto
	const yamlBlockMatch = rawText.match(/```(?:yaml)?\s*\n([\s\S]*?)\n```/i);
	const textToParse = yamlBlockMatch ? yamlBlockMatch[1] : rawText;

	// Validar campos requeridos mínimos: status y summary
	const statusMatch = textToParse.match(/status:\s*([a-z_]+)/i);
	const summaryMatch = textToParse.match(/summary:\s*([^\n]+)/i);

	if (!statusMatch) {
		errors.push("Falta el campo obligatorio 'status' (completed | partial | blocked | interaction_required).");
	} else {
		const validStatuses = ["completed", "partial", "blocked", "interaction_required"];
		if (!validStatuses.includes(statusMatch[1].toLowerCase().trim())) {
			errors.push(`Status inválido '${statusMatch[1]}'. Debe ser uno de: ${validStatuses.join(", ")}`);
		}
	}

	if (!summaryMatch || !summaryMatch[1].trim()) {
		errors.push("Falta el campo obligatorio 'summary' con el resumen de la tarea.");
	}

	const filesMatch = textToParse.match(/files_changed:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/i);
	const validationMatch = textToParse.match(/validation:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/i);
	const impactMatch = textToParse.match(/gameplay_impact:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/i);
	const risksMatch = textToParse.match(/risks:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/i);
	const nextMatch = textToParse.match(/next_recommended_specialist:\s*([^\n]+)/i);
	const questionMatch = textToParse.match(/(?:^|\n)\s*question:\s*([^\n]+)/i);
	const optionsMatch = textToParse.match(/(?:^|\n)\s*options:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/i);
	const blockingMatch = textToParse.match(/(?:^|\n)\s*blocking:\s*(true|false)/i);

	const parseList = (block?: string | null): string[] => {
		if (!block) return [];
		return block
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.startsWith("-"))
			.map((l) => l.replace(/^-\s*/, ""));
	};

	const interaction: InteractionRequest | undefined = questionMatch
		? {
				question: questionMatch[1].trim().replace(/^["']|["']$/g, ""),
				options: parseList(optionsMatch ? optionsMatch[1] : null).map((o) =>
					o.replace(/^["']|["']$/g, ""),
				),
				blocking: blockingMatch ? blockingMatch[1].toLowerCase() === "true" : true,
			}
		: undefined;

	const parsed: SpecialistReturn | undefined = statusMatch && summaryMatch ? {
		status: statusMatch[1].toLowerCase().trim() as any,
		summary: summaryMatch[1].trim(),
		files_changed: parseList(filesMatch ? filesMatch[1] : null),
		validation: parseList(validationMatch ? validationMatch[1] : null),
		gameplay_impact: parseList(impactMatch ? impactMatch[1] : null),
		risks: parseList(risksMatch ? risksMatch[1] : null),
		next_recommended_specialist: nextMatch ? nextMatch[1].trim() : undefined,
		interaction,
	} : undefined;

	// Un 'completed' sin evidencia es una afirmación, no una entrega: el
	// especialista nombra qué corrió y qué devolvió, o qué propiedad leyó.
	if (parsed && parsed.status === "completed") {
		errors.push(...validateEvidence(parsed.validation ?? [], options));
	}

	// An escalation without a concrete question is not actionable: the parent
	// would relay an empty choice and the child would stall anyway.
	if (parsed && parsed.status === "interaction_required" && !parsed.interaction?.question) {
		errors.push(
			"Un 'status: interaction_required' exige 'question' con la decisión concreta y, preferentemente, 'options'.",
		);
	}

	return {
		isValid: errors.length === 0,
		hasYamlBlock: !!yamlBlockMatch || (!!statusMatch && !!summaryMatch),
		parsed,
		errors,
		hasConversationalBleed: conversationalWarnings.length > 0,
		conversationalWarnings,
	};
}
