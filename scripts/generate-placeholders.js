#!/usr/bin/env node
/**
 * Pi Game Studio — Procedural Placeholder Generator
 * Generates zero-dependency procedural WAV audio and BMP textures for rapid prototyping.
 * Usage:
 *   node scripts/generate-placeholders.js [--type sfx|texture|all] [--out <dir>]
 */

const { writeFileSync, mkdirSync, existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const SAMPLE_RATE = 44100;

/**
 * Creates a valid 16-bit Mono PCM WAV buffer
 */
function createWavBuffer(samples) {
	const numSamples = samples.length;
	const byteRate = SAMPLE_RATE * 2; // 16-bit mono = 2 bytes per sample
	const blockAlign = 2;
	const subChunk2Size = numSamples * 2;
	const chunkSize = 36 + subChunk2Size;

	const buffer = Buffer.alloc(44 + subChunk2Size);

	// RIFF header
	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(chunkSize, 4);
	buffer.write("WAVE", 8);

	// fmt sub-chunk
	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
	buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
	buffer.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
	buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
	buffer.writeUInt32LE(byteRate, 28); // ByteRate
	buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
	buffer.writeUInt16LE(16, 34); // BitsPerSample

	// data sub-chunk
	buffer.write("data", 36);
	buffer.writeUInt32LE(subChunk2Size, 40);

	// Write PCM samples
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
 * Procedural SFX Generators
 */
const sfxGenerators = {
	jump() {
		const duration = 0.25;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			// Upward frequency sweep 150Hz -> 600Hz
			const freq = 150 + 450 * Math.pow(t, 0.7);
			const env = 1 - t; // Linear decay
			samples[i] = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * env * 0.8;
		}
		return createWavBuffer(samples);
	},
	coin() {
		const duration = 0.3;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		const half = Math.floor(totalSamples / 2);
		for (let i = 0; i < totalSamples; i++) {
			const freq = i < half ? 987.77 : 1318.51; // B5 to E6
			const env = 1 - (i / totalSamples) * 0.9;
			const phase = ((freq * i) / SAMPLE_RATE) % 1;
			const square = phase > 0.5 ? 0.6 : -0.6;
			samples[i] = square * env;
		}
		return createWavBuffer(samples);
	},
	hit() {
		const duration = 0.2;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			const noise = Math.random() * 2 - 1;
			const sine = Math.sin((2 * Math.PI * (120 - 80 * t) * i) / SAMPLE_RATE);
			const env = Math.exp(-t * 8);
			samples[i] = (noise * 0.4 + sine * 0.6) * env;
		}
		return createWavBuffer(samples);
	},
	laser() {
		const duration = 0.22;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			const freq = 880 * Math.exp(-t * 5) + 110;
			const env = 1 - t;
			samples[i] = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * env * 0.75;
		}
		return createWavBuffer(samples);
	},
	explosion() {
		const duration = 0.6;
		const totalSamples = Math.floor(SAMPLE_RATE * duration);
		const samples = new Float32Array(totalSamples);
		let filter = 0;
		for (let i = 0; i < totalSamples; i++) {
			const t = i / totalSamples;
			const rawNoise = Math.random() * 2 - 1;
			filter += (rawNoise - filter) * 0.15;
			const env = Math.exp(-t * 4);
			samples[i] = filter * env * 0.9;
		}
		return createWavBuffer(samples);
	},
};

/**
 * Creates an uncompressed 24-bit BMP image
 */
function createBmpBuffer(width, height, pixelFn) {
	const rowSize = Math.floor((24 * width + 31) / 32) * 4;
	const pixelArraySize = rowSize * height;
	const fileSize = 54 + pixelArraySize;

	const buffer = Buffer.alloc(fileSize);

	// Bitmap file header (14 bytes)
	buffer.write("BM", 0);
	buffer.writeUInt32LE(fileSize, 2);
	buffer.writeUInt32LE(0, 6);
	buffer.writeUInt32LE(54, 10);

	// DIB header (BITMAPINFOHEADER - 40 bytes)
	buffer.writeUInt32LE(40, 14);
	buffer.writeInt32LE(width, 18);
	buffer.writeInt32LE(height, 22);
	buffer.writeUInt16LE(1, 26);
	buffer.writeUInt16LE(24, 28);
	buffer.writeUInt32LE(0, 30);
	buffer.writeUInt32LE(pixelArraySize, 34);
	buffer.writeInt32LE(2835, 38);
	buffer.writeInt32LE(2835, 42);
	buffer.writeUInt32LE(0, 46);
	buffer.writeUInt32LE(0, 50);

	// Write pixels (Bottom-up, BGR order)
	let offset = 54;
	for (let y = 0; y < height; y++) {
		const rowStart = offset;
		for (let x = 0; x < width; x++) {
			const [r, g, b] = pixelFn(x, height - 1 - y, width, height);
			buffer.writeUInt8(b & 0xff, offset++);
			buffer.writeUInt8(g & 0xff, offset++);
			buffer.writeUInt8(r & 0xff, offset++);
		}
		while (offset < rowStart + rowSize) {
			buffer.writeUInt8(0, offset++);
		}
	}

	return buffer;
}

/**
 * Procedural Texture Generators
 */
const textureGenerators = {
	"checker-magenta-32": () =>
		createBmpBuffer(32, 32, (x, y) => {
			const check = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
			return check ? [255, 0, 255] : [20, 20, 20];
		}),
	"checker-uv-64": () =>
		createBmpBuffer(64, 64, (x, y, w, h) => {
			const border = x === 0 || x === w - 1 || y === 0 || y === h - 1;
			if (border) return [255, 255, 255];
			const check = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
			return check ? [56, 189, 248] : [30, 41, 59];
		}),
	"player-dummy-32": () =>
		createBmpBuffer(32, 32, (x, y) => {
			const dx = x - 15.5;
			const dy = y - 15.5;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist <= 12) {
				return [52, 211, 153];
			}
			return [0, 0, 0];
		}),
};

/**
 * Main Runner
 */
function main() {
	const args = process.argv.slice(2);
	let targetType = "all";
	let outDir = "assets/placeholders";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--type" && args[i + 1]) {
			targetType = args[i + 1].toLowerCase();
			i++;
		} else if (args[i] === "--out" && args[i + 1]) {
			outDir = args[i + 1];
			i++;
		}
	}

	const baseDir = resolve(process.cwd(), outDir);
	const sfxDir = join(baseDir, "sfx");
	const texDir = join(baseDir, "textures");

	console.log(`\x1b[1m\x1b[38;2;167;139;250mGENERATING PLACEHOLDER ASSETS\x1b[0m`);
	console.log(`\x1b[38;2;107;114;128mTarget: ${baseDir}\x1b[0m\n`);

	const generated = [];

	if (targetType === "all" || targetType === "sfx") {
		mkdirSync(sfxDir, { recursive: true });
		for (const [name, generator] of Object.entries(sfxGenerators)) {
			const filePath = join(sfxDir, `${name}.wav`);
			const buf = generator();
			writeFileSync(filePath, buf);
			generated.push({ type: "audio", path: filePath, name: `${name}.wav` });
			console.log(`  \x1b[38;2;52;211;153m✔ SFX:\x1b[0m ${name}.wav (${buf.length} bytes)`);
		}
	}

	if (targetType === "all" || targetType === "texture") {
		mkdirSync(texDir, { recursive: true });
		for (const [name, generator] of Object.entries(textureGenerators)) {
			const filePath = join(texDir, `${name}.bmp`);
			const buf = generator();
			writeFileSync(filePath, buf);
			generated.push({ type: "texture", path: filePath, name: `${name}.bmp` });
			console.log(`  \x1b[38;2;52;211;153m✔ Texture:\x1b[0m ${name}.bmp (${buf.length} bytes)`);
		}
	}

	const manifestPath = resolve(process.cwd(), "assets", "manifest.yaml");
	if (existsSync(manifestPath)) {
		let content = readFileSync(manifestPath, "utf8");
		let addedCount = 0;
		for (const item of generated) {
			const relPath = item.path.replace(process.cwd() + "/", "");
			if (!content.includes(relPath)) {
				content += `\n  - path: "${relPath}"\n    type: "${item.type}"\n    status: "placeholder"\n    description: "Procedural prototype asset"`;
				addedCount++;
			}
		}
		if (addedCount > 0) {
			writeFileSync(manifestPath, content, "utf8");
			console.log(`\n  \x1b[38;2;56;189;248mUpdated assets/manifest.yaml (+${addedCount} assets registered)\x1b[0m`);
		}
	}

	console.log(`\n\x1b[38;2;52;211;153mDONE: Generated ${generated.length} prototype assets successfully.\x1b[0m\n`);
}

if (require.main === module) {
	main();
}

module.exports = {
	createWavBuffer,
	createBmpBuffer,
	sfxGenerators,
	textureGenerators,
};
