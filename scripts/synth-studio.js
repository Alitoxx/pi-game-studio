#!/usr/bin/env node
/**
 * scripts/synth-studio.js — Procedural Audio Synth & Shader Palette Studio
 * - SFX Synthesis: custom waveforms (sine, square, saw, noise), ADSR envelopes, pitch sweep
 * - Palette Exporter: generates color ramps and shader code (.gdshader, GLSL, WGSL)
 */

const { writeFileSync, mkdirSync, existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
	const numSamples = samples.length;
	const subChunk2Size = numSamples * 2;
	const chunkSize = 36 + subChunk2Size;
	const buffer = Buffer.alloc(44 + subChunk2Size);

	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(chunkSize, 4);
	buffer.write("WAVE", 8);
	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20); // PCM
	buffer.writeUInt16LE(1, 22); // Mono
	buffer.writeUInt32LE(SAMPLE_RATE, 24);
	buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
	buffer.writeUInt16LE(2, 32);
	buffer.writeUInt16LE(16, 34);
	buffer.write("data", 36);
	buffer.writeUInt32LE(subChunk2Size, 40);

	let offset = 44;
	for (let i = 0; i < numSamples; i++) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
		buffer.writeInt16LE(Math.floor(intSample), offset);
		offset += 2;
	}
	return buffer;
}

/**
 * Synthesize custom sound effect based on procedural parameters
 */
function synthesizeSfx(opts = {}) {
	const type = opts.type || "custom";
	const duration = Number(opts.duration || 0.3);
	const startFreq = Number(opts.freq || 440);
	const endFreq = Number(opts.endFreq || startFreq * 0.5);
	const wave = opts.wave || "square"; // sine, square, saw, noise
	const attack = Number(opts.attack || 0.02);
	const decay = Number(opts.decay || 0.2);

	const totalSamples = Math.floor(SAMPLE_RATE * duration);
	const samples = new Float32Array(totalSamples);

	for (let i = 0; i < totalSamples; i++) {
		const t = i / totalSamples;
		const curTime = i / SAMPLE_RATE;

		// Frequency sweep
		const curFreq = startFreq + (endFreq - startFreq) * Math.pow(t, 1.2);
		const phase = ((curFreq * curTime) % 1);

		// Waveform calculation
		let val = 0;
		if (wave === "sine") {
			val = Math.sin(2 * Math.PI * phase);
		} else if (wave === "square") {
			val = phase > 0.5 ? 0.7 : -0.7;
		} else if (wave === "saw") {
			val = (phase * 2 - 1) * 0.7;
		} else if (wave === "noise") {
			val = (Math.random() * 2 - 1) * 0.8;
		}

		// Envelope
		let env = 1.0;
		if (curTime < attack) {
			env = curTime / attack;
		} else {
			const decayTime = curTime - attack;
			env = Math.max(0, 1 - decayTime / Math.max(0.001, duration - attack));
		}

		samples[i] = val * env;
	}

	return createWavBuffer(samples);
}

/**
 * Curated retro color palettes
 */
const PALETTES = {
	gameboy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
	cyberpunk: ["#0d0221", "#0f084b", "#26408b", "#a6cfd5", "#c2e7da", "#ff007f"],
	pico8: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
	solarized: ["#002b36", "#073642", "#586e75", "#657b83", "#839496", "#93a1a1", "#eee8d5", "#fdf6e3", "#b58900", "#cb4b16", "#dc322f", "#d33682", "#6c71c4", "#268bd2", "#2aa198", "#859900"]
};

function hexToRgb(hex) {
	const c = hex.replace("#", "");
	const num = parseInt(c, 16);
	if (c.length === 6) {
		return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
	}
	return [255, 255, 255];
}

/**
 * Generate Shader code from a chosen color palette
 */
function generateShader(paletteName = "pico8", target = "godot") {
	const colors = PALETTES[paletteName] || PALETTES.pico8;

	if (target === "godot") {
		const vec4Array = colors.map(h => {
			const [r, g, b] = hexToRgb(h);
			return `\tvec4(${(r / 255).toFixed(3)}, ${(g / 255).toFixed(3)}, ${(b / 255).toFixed(3)}, 1.0)`;
		}).join(",\n");

		return `// Pi Game Studio — Palette Quantizer Shader (${paletteName})
shader_type canvas_item;

const int PALETTE_SIZE = ${colors.length};
const vec4 PALETTE[${colors.length}] = vec4[](\n${vec4Array}\n);

void fragment() {
\tvec4 tex_color = texture(TEXTURE, UV);
\tfloat min_dist = 1000.0;
\tvec4 closest = PALETTE[0];
\tfor (int i = 0; i < PALETTE_SIZE; i++) {
\t\tfloat d = distance(tex_color.rgb, PALETTE[i].rgb);
\t\tif (d < min_dist) {
\t\t\tmin_dist = d;
\t\t\tclosest = PALETTE[i];
\t\t}
\t}
\tCOLOR = vec4(closest.rgb, tex_color.a);
}
`;
	}

	// GLSL format (Raylib)
	const vec3Array = colors.map(h => {
		const [r, g, b] = hexToRgb(h);
		return `\tvec3(${(r / 255).toFixed(3)}, ${(g / 255).toFixed(3)}, ${(b / 255).toFixed(3)})`;
	}).join(",\n");

	return `// Pi Game Studio — GLSL Palette Shader (${paletteName})
#version 330 core
in vec2 fragTexCoord;
in vec4 fragColor;
out vec4 finalColor;
uniform sampler2D texture0;

const int PALETTE_SIZE = ${colors.length};
const vec3 PALETTE[${colors.length}] = vec3[](\n${vec3Array}\n);

void main() {
    vec4 tex = texture(texture0, fragTexCoord);
    float minDist = 1000.0;
    vec3 closest = PALETTE[0];
    for (int i = 0; i < PALETTE_SIZE; i++) {
        float d = distance(tex.rgb, PALETTE[i]);
        if (d < minDist) {
            minDist = d;
            closest = PALETTE[i];
        }
    }
    finalColor = vec4(closest, tex.a) * fragColor;
}
`;
}

function main() {
	const args = process.argv.slice(2);
	const command = args[0] || "help";

	if (command === "sfx") {
		const name = args[1] || "synth_fx";
		let wave = "square";
		let freq = 440;
		let duration = 0.25;

		for (let i = 2; i < args.length; i++) {
			if (args[i] === "--wave" && args[i + 1]) wave = args[++i];
			if (args[i] === "--freq" && args[i + 1]) freq = Number(args[++i]);
			if (args[i] === "--duration" && args[i + 1]) duration = Number(args[++i]);
		}

		const outDir = resolve(process.cwd(), "assets/sfx");
		mkdirSync(outDir, { recursive: true });
		const filePath = join(outDir, `${name}.wav`);
		const wav = synthesizeSfx({ wave, freq, duration });
		writeFileSync(filePath, wav);
		console.log(`\x1b[32m✔ Synthesized SFX:\x1b[0m ${filePath} (${wav.length} bytes, wave: ${wave}, freq: ${freq}Hz)`);
	} else if (command === "palette") {
		const paletteName = args[1] || "pico8";
		const targetEngine = args[2] || "godot";
		const shaderCode = generateShader(paletteName, targetEngine);
		const outDir = resolve(process.cwd(), "shaders");
		mkdirSync(outDir, { recursive: true });
		const ext = targetEngine === "godot" ? "gdshader" : "fs";
		const filePath = join(outDir, `palette_${paletteName}.${ext}`);
		writeFileSync(filePath, shaderCode, "utf8");
		console.log(`\x1b[32m✔ Generated Palette Shader:\x1b[0m ${filePath} (${paletteName}, target: ${targetEngine})`);
	} else {
		console.log("Usage: node scripts/synth-studio.js sfx <name> [--wave sine|square|saw|noise] [--freq <hz>] [--duration <sec>]");
		console.log("       node scripts/synth-studio.js palette <name> [godot|raylib]");
	}
}

if (require.main === module) {
	main();
}

module.exports = {
	synthesizeSfx,
	generateShader,
	PALETTES,
	createWavBuffer
};
