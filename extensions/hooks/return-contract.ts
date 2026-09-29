export interface SpecialistReturn {
	status: "completed" | "partial" | "blocked" | "interaction_required";
	summary: string;
	files_changed?: string[];
	validation?: string[];
	gameplay_impact?: string[];
	risks?: string[];
	next_recommended_specialist?: string;
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

export function validateSpecialistReturn(rawText: string): ReturnValidationResult {
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

	const parseList = (block?: string | null): string[] => {
		if (!block) return [];
		return block
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.startsWith("-"))
			.map((l) => l.replace(/^-\s*/, ""));
	};

	const parsed: SpecialistReturn | undefined = statusMatch && summaryMatch ? {
		status: statusMatch[1].toLowerCase().trim() as any,
		summary: summaryMatch[1].trim(),
		files_changed: parseList(filesMatch ? filesMatch[1] : null),
		validation: parseList(validationMatch ? validationMatch[1] : null),
		gameplay_impact: parseList(impactMatch ? impactMatch[1] : null),
		risks: parseList(risksMatch ? risksMatch[1] : null),
		next_recommended_specialist: nextMatch ? nextMatch[1].trim() : undefined,
	} : undefined;

	return {
		isValid: errors.length === 0,
		hasYamlBlock: !!yamlBlockMatch || (!!statusMatch && !!summaryMatch),
		parsed,
		errors,
		hasConversationalBleed: conversationalWarnings.length > 0,
		conversationalWarnings,
	};
}
