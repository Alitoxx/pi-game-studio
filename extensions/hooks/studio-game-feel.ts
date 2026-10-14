import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import {
	ACCENT,
	BOLD,
	BORDER,
	DIM,
	GRAY,
	GREEN,
	HEADING,
	RED,
	RESET,
	SECONDARY,
	WHITE,
	YELLOW,
} from "./studio-palette.ts";

export type PillarId =
	| "coyote_time"
	| "jump_buffering"
	| "variable_jump"
	| "acceleration_friction"
	| "game_juice";

export interface PillarStatus {
	id: PillarId;
	name: string;
	description: string;
	detected: boolean;
	evidence?: string;
	line?: number;
}

export interface GameFeelAuditResult {
	filePath: string;
	relPath: string;
	language: "GDScript" | "Rust" | "C++" | "C#" | "Unknown";
	engine: string;
	score: number;
	total: number;
	rating: string;
	pillars: PillarStatus[];
	snippets: { pillarId: PillarId; title: string; code: string }[];
}

export interface ScriptCandidate {
	path: string;
	relPath: string;
	language: "GDScript" | "Rust" | "C++" | "C#" | "Unknown";
	score: number;
	content: string;
}

// ──────────────────────────────────────────────
// Movement Script Scanner
// ──────────────────────────────────────────────

const IGNORED_DIRS = new Set([
	".git",
	".godot",
	"target",
	"build",
	"bin",
	"obj",
	"node_modules",
	".pi",
	"dist",
	".cargo",
	".import",
]);

function detectLanguageFromExt(ext: string): ScriptCandidate["language"] {
	if (ext === ".gd") return "GDScript";
	if (ext === ".rs") return "Rust";
	if (ext === ".cpp" || ext === ".c" || ext === ".hpp" || ext === ".h") return "C++";
	if (ext === ".cs") return "C#";
	return "Unknown";
}

function calculateMovementRelevance(content: string, filename: string): number {
	let score = 0;
	const lowerContent = content.toLowerCase();
	const lowerName = filename.toLowerCase();

	if (lowerName.includes("player")) score += 30;
	if (lowerName.includes("character")) score += 25;
	if (lowerName.includes("movement") || lowerName.includes("controller")) score += 20;
	if (lowerName.includes("playground")) score += 15;

	if (/extends\s+CharacterBody[23]D/i.test(content)) score += 40;
	if (/move_and_slide/i.test(content)) score += 30;
	if (/\bvelocity\b/i.test(content)) score += 20;
	if (/\bjump\b/i.test(content)) score += 15;
	if (/\bis_on_floor\b/i.test(content)) score += 20;
	if (/\bgravity\b/i.test(content)) score += 15;
	if (/ButtonInput<KeyCode>|Input\.is_/i.test(content)) score += 15;

	return score;
}

export function findMovementScripts(studioRoot: string): ScriptCandidate[] {
	const candidates: ScriptCandidate[] = [];

	function walk(dir: string, depth = 0) {
		if (depth > 6) return;
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					if (!IGNORED_DIRS.has(entry.name)) {
						walk(join(dir, entry.name), depth + 1);
					}
				} else if (entry.isFile()) {
					const ext = extname(entry.name).toLowerCase();
					if ([".gd", ".rs", ".cpp", ".cs"].includes(ext)) {
						const fullPath = join(dir, entry.name);
						try {
							const content = readFileSync(fullPath, "utf8");
							const score = calculateMovementRelevance(content, entry.name);
							if (score > 25) {
								candidates.push({
									path: fullPath,
									relPath: relative(studioRoot, fullPath),
									language: detectLanguageFromExt(ext),
									score,
									content,
								});
							}
						} catch {}
					}
				}
			}
		} catch {}
	}

	walk(studioRoot);
	return candidates.sort((a, b) => b.score - a.score);
}

// ──────────────────────────────────────────────
// Pillar Static Analysis Heuristics
// ──────────────────────────────────────────────

function findPatternInLines(lines: string[], pattern: RegExp): { line: number; text: string } | undefined {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Skip pure comment lines
		const trimmed = line.trim();
		if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
			continue;
		}
		if (pattern.test(line)) {
			return { line: i + 1, text: trimmed };
		}
	}
	return undefined;
}

export function auditGameFeelCode(
	content: string,
	language: ScriptCandidate["language"],
	filePath: string,
	engine = "Godot",
): GameFeelAuditResult {
	const lines = content.split("\n");

	// 1. Coyote Time
	const coyotePattern = /(coyote|was_on_floor|off_ground|ledge_timer|air_timer|time_since_ground)/i;
	const coyoteMatch = findPatternInLines(lines, coyotePattern);

	// 2. Jump Buffering
	const bufferPattern = /(jump_?buffer|buffer_?jump|jump_?queue|pre_?jump|queued_?jump|jump_?memory|input_?buffer|jump_?timer|jump_?pressed_?time)/i;
	const bufferMatch = findPatternInLines(lines, bufferPattern);

	// 3. Variable Jump Height
	const variableJumpPattern = /(just_released|is_action_just_released|action_just_released|is_key_released|iskeyreleased|jump_?cut|variable_?jump|min_?jump|cut_?jump)/i;
	const variableJumpMatch = findPatternInLines(lines, variableJumpPattern);

	// 4. Acceleration & Friction
	const accelPattern = /(move_toward|lerp|friction|acceleration|accel|decel|damp|smoothstep|approach)/i;
	const accelMatch = findPatternInLines(lines, accelPattern);

	// 5. Game Juice / Screen Shake
	const juicePattern = /(shake|screen_?shake|camera_?shake|trauma|particle|squash|stretch|juice|impact_?recoil|camera_?kick|dust|puff|\bsfx\b|play_sound)/i;
	const juiceMatch = findPatternInLines(lines, juicePattern);

	const pillars: PillarStatus[] = [
		{
			id: "coyote_time",
			name: "1. Coyote Time",
			description: "Ventana de tolerancia tras abandonar una plataforma para saltar en el aire",
			detected: !!coyoteMatch,
			evidence: coyoteMatch?.text,
			line: coyoteMatch?.line,
		},
		{
			id: "jump_buffering",
			name: "2. Jump Buffering",
			description: "Encolado del comando de salto previo al aterrizaje",
			detected: !!bufferMatch,
			evidence: bufferMatch?.text,
			line: bufferMatch?.line,
		},
		{
			id: "variable_jump",
			name: "3. Salto Variable (Jump Cut)",
			description: "Corte de velocidad vertical al soltar anticipadamente el botón",
			detected: !!variableJumpMatch,
			evidence: variableJumpMatch?.text,
			line: variableJumpMatch?.line,
		},
		{
			id: "acceleration_friction",
			name: "4. Aceleración e Inercia",
			description: "Transición suave (lerp/move_toward) vs asignación instantánea y rígida",
			detected: !!accelMatch,
			evidence: accelMatch?.text,
			line: accelMatch?.line,
		},
		{
			id: "game_juice",
			name: "5. Game Juice y Feedback",
			description: "Ganchos para Screen Shake, partículas al caer o squash/stretch",
			detected: !!juiceMatch,
			evidence: juiceMatch?.text,
			line: juiceMatch?.line,
		},
	];

	const score = pillars.filter((p) => p.detected).length;

	let rating = "";
	switch (score) {
		case 0:
			rating = "0/5 — Inanimado / Inerte (Sin feedback ni dinámicas)";
			break;
		case 1:
			rating = "1/5 — Hiper-Rígido / Bloque (Control tosco tipo 1985)";
			break;
		case 2:
			rating = "2/5 — Rígido / Tosco (Mecánica básica sin gracia)";
			break;
		case 3:
			rating = "3/5 — Jugable / Estándar (Sensación arcade funcional)";
			break;
		case 4:
			rating = "4/5 — Fluido / Responsivo (Buen feedback y control reactivo)";
			break;
		case 5:
			rating = "5/5 — Nintendo-Grade / Jugoso (Máxima reactividad y Game Feel premium)";
			break;
	}

	// Generate code snippets for missing pillars
	const snippets: { pillarId: PillarId; title: string; code: string }[] = [];
	for (const p of pillars) {
		if (!p.detected) {
			const snippetCode = getIdiomaticSnippet(p.id, language, engine);
			snippets.push({
				pillarId: p.id,
				title: p.name,
				code: snippetCode,
			});
		}
	}

	return {
		filePath,
		relPath: filePath,
		language,
		engine,
		score,
		total: 5,
		rating,
		pillars,
		snippets,
	};
}

// ──────────────────────────────────────────────
// Idiomatic Snippet Generators
// ──────────────────────────────────────────────

function getIdiomaticSnippet(
	pillar: PillarId,
	language: ScriptCandidate["language"],
	engine: string,
): string {
	if (language === "GDScript" || engine.toLowerCase().includes("godot")) {
		switch (pillar) {
			case "coyote_time":
				return `# --- Coyote Time (GDScript 4) ---
@export var coyote_time: float = 0.12 # ~7 frames de margen
var coyote_timer: float = 0.0

# En _physics_process(delta):
if is_on_floor():
    coyote_timer = coyote_time
else:
    coyote_timer -= delta

# Al evaluar salto, reemplaza "is_on_floor()" por:
if jump_pressed and coyote_timer > 0.0:
    velocity.y = jump_velocity
    coyote_timer = 0.0`;

			case "jump_buffering":
				return `# --- Jump Buffering (GDScript 4) ---
@export var jump_buffer_time: float = 0.12 # ~7 frames
var jump_buffer_timer: float = 0.0

# En _physics_process(delta):
if Input.is_action_just_pressed("ui_accept") or Input.is_key_pressed(KEY_SPACE):
    jump_buffer_timer = jump_buffer_time
else:
    jump_buffer_timer -= delta

if jump_buffer_timer > 0.0 and (is_on_floor() or coyote_timer > 0.0):
    velocity.y = jump_velocity
    jump_buffer_timer = 0.0
    coyote_timer = 0.0`;

			case "variable_jump":
				return `# --- Variable Jump Height / Jump Cut (GDScript 4) ---
@export var min_jump_cut_ratio: float = 0.5 # Reduce a la mitad al soltar

# En _physics_process(delta):
var jump_released := Input.is_action_just_released("ui_accept") or !Input.is_key_pressed(KEY_SPACE)
if jump_released and velocity.y < 0.0:
    velocity.y *= min_jump_cut_ratio`;

			case "acceleration_friction":
				return `# --- Aceleración e Inercia Orgánica (GDScript 4) ---
@export var accel: float = 1400.0
@export var friction: float = 1800.0

# En _physics_process(delta):
if direction != 0.0:
    velocity.x = move_toward(velocity.x, direction * speed, accel * delta)
else:
    velocity.x = move_toward(velocity.x, 0.0, friction * delta)`;

			case "game_juice":
				return `# --- Game Juice & Impact Feedback (GDScript 4) ---
signal player_landed(impact_force: float)
var was_on_air: bool = false

# En _physics_process(delta) tras move_and_slide():
if is_on_floor():
    if was_on_air:
        emit_signal("player_landed", abs(velocity.y))
        # Hook: Llamar screen shake o spawn de partículas de polvo aquí
    was_on_air = false
else:
    was_on_air = true`;
		}
	} else if (language === "Rust" || engine.toLowerCase().includes("bevy")) {
		switch (pillar) {
			case "coyote_time":
				return `// --- Coyote Time (Bevy Rust) ---
#[derive(Component)]
struct CoyoteTimer(Timer);

// En sistema de movimiento:
if player.is_grounded {
    coyote.0.reset();
} else {
    coyote.0.tick(time.delta());
}

if jump_input && !coyote.0.finished() {
    player.velocity_y = player.jump_velocity;
    coyote.0.finish();
}`;

			case "jump_buffering":
				return `// --- Jump Buffering (Bevy Rust) ---
#[derive(Component)]
struct JumpBufferTimer(Timer);

if keyboard.just_pressed(KeyCode::Space) {
    jump_buffer.0.reset();
} else {
    jump_buffer.0.tick(time.delta());
}

if !jump_buffer.0.finished() && player.is_grounded {
    player.velocity_y = player.jump_velocity;
    jump_buffer.0.finish();
}`;

			case "variable_jump":
				return `// --- Variable Jump (Bevy Rust) ---
if keyboard.just_released(KeyCode::Space) && player.velocity_y > 0.0 {
    player.velocity_y *= 0.5;
}`;

			case "acceleration_friction":
				return `// --- Smooth Accel / Friction (Bevy Rust) ---
let target_vel = direction * player.speed;
player.velocity_x = player.velocity_x.lerp(target_vel, 15.0 * delta);`;

			case "game_juice":
				return `// --- Juice / Camera Shake Hook (Bevy Rust) ---
#[derive(Event)]
struct LandingImpactEvent(f32);

if just_landed {
    events.send(LandingImpactEvent(impact_velocity));
}`;
		}
	} else if (language === "C++" || engine.toLowerCase().includes("raylib")) {
		switch (pillar) {
			case "coyote_time":
				return `// --- Coyote Time (Raylib C++) ---
float coyoteTimer = 0.0f;
const float coyoteDuration = 0.12f;

if (player.isGrounded) {
    coyoteTimer = coyoteDuration;
} else {
    coyoteTimer -= delta;
}

if (jumpPressed && coyoteTimer > 0.0f) {
    player.velocity.y = jumpVelocity;
    coyoteTimer = 0.0f;
}`;

			case "jump_buffering":
				return `// --- Jump Buffering (Raylib C++) ---
float jumpBufferTimer = 0.0f;
const float jumpBufferDuration = 0.12f;

if (IsKeyPressed(KEY_SPACE)) jumpBufferTimer = jumpBufferDuration;
else jumpBufferTimer -= delta;

if (jumpBufferTimer > 0.0f && player.isGrounded) {
    player.velocity.y = jumpVelocity;
    jumpBufferTimer = 0.0f;
}`;

			case "variable_jump":
				return `// --- Variable Jump Height (Raylib C++) ---
if (IsKeyReleased(KEY_SPACE) && player.velocity.y < 0.0f) {
    player.velocity.y *= 0.5f;
}`;

			case "acceleration_friction":
				return `// --- Acceleration & Friction (Raylib C++) ---
float targetSpeed = direction * moveSpeed;
float rate = (direction != 0.0f) ? accelRate : frictionRate;
player.velocity.x += (targetSpeed - player.velocity.x) * rate * delta;`;

			case "game_juice":
				return `// --- Game Juice / Screen Shake (Raylib C++) ---
float cameraTrauma = 0.0f;
if (justLanded && impactForce > 200.0f) {
    cameraTrauma = 0.4f; // Trigger screen shake
}`;
		}
	} else {
		// Generic C# / Unity fallback
		switch (pillar) {
			case "coyote_time":
				return `// --- Coyote Time (C#) ---
[SerializeField] float coyoteTime = 0.12f;
float coyoteCounter;

if (isGrounded) coyoteCounter = coyoteTime;
else coyoteCounter -= Time.deltaTime;

if (jumpPressed && coyoteCounter > 0f) {
    velocity.y = jumpVelocity;
    coyoteCounter = 0f;
}`;
			case "jump_buffering":
				return `// --- Jump Buffering (C#) ---
[SerializeField] float jumpBufferTime = 0.12f;
float bufferCounter;

if (Input.GetButtonDown("Jump")) bufferCounter = jumpBufferTime;
else bufferCounter -= Time.deltaTime;

if (bufferCounter > 0f && isGrounded) {
    velocity.y = jumpVelocity;
    bufferCounter = 0f;
}`;
			case "variable_jump":
				return `// --- Variable Jump (C#) ---
if (Input.GetButtonUp("Jump") && velocity.y > 0f) {
    velocity.y *= 0.5f;
}`;
			case "acceleration_friction":
				return `// --- Acceleration & Friction (C#) ---
float targetSpeed = inputDir * moveSpeed;
velocity.x = Mathf.MoveTowards(velocity.x, targetSpeed, accel * Time.deltaTime);`;
			case "game_juice":
				return `// --- Game Juice (C#) ---
if (justLanded) {
    OnLandedEvent?.Invoke(Mathf.Abs(velocity.y));
}`;
		}
	}
}

// ──────────────────────────────────────────────
// CLI Command Handler
// ──────────────────────────────────────────────

export async function handleStudioGameFeel(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const cwd = ctx.cwd || process.cwd();
	const studioRoot = findStudioRoot(cwd) || cwd;
	const engineResult = detectProjectEngine(studioRoot);
	const targetEngine = engineResult.engine || "Godot";

	console.log(`\n${ACCENT}${BOLD}▌ ◈ GAME FEEL & MOVEMENT AUDITOR${RESET}`);
	console.log(`${DIM}Inspección estática de las 5 dinámicas estándar de Game Feel...${RESET}\n`);

	let targetFile: ScriptCandidate | undefined;
	const trimmedArgs = args.trim();

	if (trimmedArgs && !trimmedArgs.startsWith("-")) {
		const directPath = join(studioRoot, trimmedArgs);
		if (existsSync(directPath)) {
			try {
				const content = readFileSync(directPath, "utf8");
				targetFile = {
					path: directPath,
					relPath: relative(studioRoot, directPath),
					language: detectLanguageFromExt(extname(directPath)),
					score: calculateMovementRelevance(content, basename(directPath)),
					content,
				};
			} catch {}
		}
	}

	if (!targetFile) {
		const candidates = findMovementScripts(studioRoot);
		if (candidates.length === 0) {
			console.log(`${YELLOW}No se encontraron scripts de movimiento/controlador en el proyecto.${RESET}`);
			console.log(`\n${GRAY}Sugerencia: Puedes generar un sandbox interactivo listo para auditar ejecutando:${RESET}`);
			console.log(`  ${SECONDARY}${BOLD}/studio:scaffold${RESET}  o  ${SECONDARY}${BOLD}godot / bevy / raylib${RESET}\n`);
			return;
		}
		targetFile = candidates[0];
	}

	const audit = auditGameFeelCode(
		targetFile.content,
		targetFile.language,
		targetFile.path,
		targetEngine,
	);
	audit.relPath = targetFile.relPath;

	// Print File Header
	console.log(`${BOLD}${WHITE}Script Inspeccionado:${RESET}  ${SECONDARY}${targetFile.relPath}${RESET} (${targetFile.language})`);
	console.log(`${BORDER}──────────────────────────────────────────────────────────────────────${RESET}`);

	// Print Pillars
	for (const p of audit.pillars) {
		const statusBadge = p.detected
			? `${GREEN}${BOLD}[OK]${RESET}`
			: `${RED}${BOLD}[FALTA]${RESET}`;

		const nameColor = p.detected ? WHITE : GRAY;
		console.log(`  ${statusBadge} ${BOLD}${nameColor}${p.name}${RESET}`);
		console.log(`         ${DIM}${p.description}${RESET}`);

		if (p.detected && p.evidence) {
			console.log(`         ${GREEN}↳ Línea ${p.line}: ${DIM}"${p.evidence}"${RESET}`);
		}
	}

	// Print Score & Verdict
	console.log(`${BORDER}──────────────────────────────────────────────────────────────────────${RESET}`);
	const scoreColor = audit.score >= 4 ? GREEN : audit.score >= 3 ? YELLOW : RED;
	console.log(`${BOLD}${WHITE}Puntuación Game Feel:${RESET} ${scoreColor}${BOLD}${audit.rating}${RESET}`);

	// Print Missing Snippets
	if (audit.snippets.length > 0) {
		console.log(`\n${HEADING}${BOLD}⚡ CÓDIGO IDIOMÁTICO LISTO PARA COPIAR (${audit.snippets.length} faltante${audit.snippets.length > 1 ? "s" : ""}):${RESET}\n`);
		for (const s of audit.snippets) {
			console.log(`${SECONDARY}${BOLD}► ${s.title}:${RESET}`);
			console.log(`${DIM}${BORDER}┌${"─".repeat(68)}┐${RESET}`);
			for (const line of s.code.split("\n")) {
				console.log(`${DIM}${BORDER}│${RESET}  ${line}`);
			}
			console.log(`${DIM}${BORDER}└${"─".repeat(68)}┘${RESET}\n`);
		}
	} else {
		console.log(`\n${GREEN}${BOLD}★ ¡EXCELENTE! Todas las 5 dinámicas de Game Feel están implementadas.${RESET}`);
		console.log(`${DIM}El control cuenta con buffer, coyote time, salto variable, inercia y feedback visual/sonoro.${RESET}\n`);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const msg = `Game Feel: ${audit.score}/5 en ${targetFile.relPath}`;
		ctx.ui.notify(msg, audit.score >= 3 ? "info" : "warning");
	}
}
