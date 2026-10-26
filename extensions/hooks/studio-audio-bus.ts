import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import { writeFileAtomicSync } from "./studio-fs.ts";
import {
	RESET,
	BOLD,
	DIM,
	BORDER,
	ACCENT,
	SECONDARY,
	HEADING,
	GREEN,
	YELLOW,
	RED,
	WHITE,
	GRAY,
	padAnsi,
	panelBottom,
	panelRule,
	panelRow,
	panelTop,
} from "./studio-palette.ts";

export type SupportedEngine = "Godot" | "Bevy" | "Raylib" | "Unity" | "Unreal" | "Phaser";

export interface BusScaffoldResult {
	engine: SupportedEngine;
	targetFilePath: string;
	relPath: string;
	buses: string[];
	duckingConfig: string;
	routingCodeSnippet: string;
	content: string;
}

/**
 * Normalizes engine name string into SupportedEngine.
 */
export function resolveEngine(engineStr: string): SupportedEngine {
	const normalized = (engineStr || "").trim().toLowerCase();
	if (normalized.includes("godot")) return "Godot";
	if (normalized.includes("bevy") || normalized.includes("rust")) return "Bevy";
	if (normalized.includes("raylib") || normalized.includes("cpp") || normalized.includes("c++")) return "Raylib";
	if (normalized.includes("unity")) return "Unity";
	if (normalized.includes("unreal") || normalized.includes("ue5")) return "Unreal";
	if (normalized.includes("phaser")) return "Phaser";
	return "Godot";
}

/**
 * Resolves the target game engine based on user args or project inspection.
 */
export function resolveEngineTarget(args: string, rootDir: string): SupportedEngine {
	const normalized = (args || "").trim().toLowerCase();
	if (normalized.includes("godot")) return "Godot";
	if (normalized.includes("bevy") || normalized.includes("rust")) return "Bevy";
	if (normalized.includes("raylib") || normalized.includes("cpp") || normalized.includes("c++")) return "Raylib";
	if (normalized.includes("unity")) return "Unity";
	if (normalized.includes("unreal") || normalized.includes("ue5")) return "Unreal";
	if (normalized.includes("phaser")) return "Phaser";

	const detected = detectProjectEngine(rootDir);
	if (detected.detected && detected.engine !== "Desconocido") {
		return detected.engine as SupportedEngine;
	}

	// Default fallback to Godot if engine is unspecified
	return "Godot";
}

// ──────────────────────────────────────────────
// Engine Generators
// ──────────────────────────────────────────────

export function generateGodotBusLayout(rootDir: string): BusScaffoldResult {
	let targetPath = join(rootDir, "default_bus_layout.tres");
	const audioDir = join(rootDir, "audio");
	if (existsSync(audioDir)) {
		targetPath = join(audioDir, "default_bus_layout.tres");
	}

	const content = `[gd_resource type="AudioBusLayout" load_steps=2 format=3]

[sub_resource type="AudioEffectCompressor" id="AudioEffectCompressor_sidechain"]
resource_name = "Compressor"
threshold = -18.0
ratio = 4.0
gain = 0.0
attack_us = 20000.0
release_ms = 250.0
mix = 1.0
sidechain = &"Voice"

[resource]
bus/0/name = &"Master"
bus/0/solo = false
bus/0/mute = false
bus/0/bypass_fx = false
bus/0/volume_db = 0.0
bus/0/send = &""
bus/1/name = &"Music"
bus/1/solo = false
bus/1/mute = false
bus/1/bypass_fx = false
bus/1/volume_db = -3.0
bus/1/send = &"Master"
bus/1/effect/0/effect = SubResource("AudioEffectCompressor_sidechain")
bus/1/effect/0/enabled = true
bus/2/name = &"SFX"
bus/2/solo = false
bus/2/mute = false
bus/2/bypass_fx = false
bus/2/volume_db = 0.0
bus/2/send = &"Master"
bus/3/name = &"Voice"
bus/3/solo = false
bus/3/mute = false
bus/3/bypass_fx = false
bus/3/volume_db = 0.0
bus/3/send = &"Master"
bus/4/name = &"UI"
bus/4/solo = false
bus/4/mute = false
bus/4/bypass_fx = false
bus/4/volume_db = 0.0
bus/4/send = &"Master"
bus/5/name = &"Ambient"
bus/5/solo = false
bus/5/mute = false
bus/5/bypass_fx = false
bus/5/volume_db = -4.0
bus/5/send = &"Master"
`;

	const snippet = `# Routing en GDScript (AudioStreamPlayer / 2D / 3D)
$MusicPlayer.bus = "Music"     # Se atenúa automáticamente al hablar Voice
$SfxPlayer.bus = "SFX"         # Efectos de impacto y gameplay
$VoicePlayer.bus = "Voice"     # Diálogos: activa ducking sobre Music (-9dB)
$UiPlayer.bus = "UI"           # Clics y menús sin alteración
$AmbientPlayer.bus = "Ambient" # Paisajes sonoros de fondo

# Control de volumen desde menú de opciones:
AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Music"), linear_to_db(slider_value))`;

	return {
		engine: "Godot",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "AudioEffectCompressor en bus Music con sidechain hacia Voice (Threshold: -18dB, Ratio: 4:1)",
		routingCodeSnippet: snippet,
		content,
	};
}

export function generateBevyBusModule(rootDir: string): BusScaffoldResult {
	const srcDir = join(rootDir, "src");
	const targetPath = join(srcDir, "audio_bus.rs");

	const content = `//! Audio Bus Hierarchy & Sidechain Ducking Plugin for Bevy
//!
//! Hierarchy:
//! Master (0.0 dB)
//!   ├── Music (-3.0 dB) [Sidechain Ducking: Voice & Heavy SFX]
//!   ├── SFX (0.0 dB)
//!   ├── Voice (0.0 dB) [Ducking Trigger: Attenuates Music]
//!   ├── UI (0.0 dB) [Independent UI Feedback]
//!   └── Ambient (-4.0 dB)

use bevy::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Component, Reflect)]
pub enum AudioBus {
    Master,
    Music,
    SFX,
    Voice,
    UI,
    Ambient,
}

#[derive(Resource, Reflect)]
#[reflect(Resource)]
pub struct AudioBusSettings {
    pub master_volume: f32,
    pub music_volume: f32,
    pub sfx_volume: f32,
    pub voice_volume: f32,
    pub ui_volume: f32,
    pub ambient_volume: f32,
    pub master_muted: bool,
    pub music_muted: bool,
    pub sfx_muted: bool,
}

impl Default for AudioBusSettings {
    fn default() -> Self {
        Self {
            master_volume: 1.0,
            music_volume: 0.75, // -2.5 dB nominal
            sfx_volume: 1.0,
            voice_volume: 1.0,
            ui_volume: 0.9,
            ambient_volume: 0.65,
            master_muted: false,
            music_muted: false,
            sfx_muted: false,
        }
    }
}

/// Dynamic sidechain ducking configuration.
#[derive(Resource)]
pub struct SidechainDucking {
    /// Target attenuation multiplier when dialogue or voice is playing (e.g. 0.35 = ~-9 dB).
    pub duck_factor: f32,
    /// Smooth interpolation speed when lowering volume.
    pub attack_speed: f32,
    /// Smooth recovery speed when voice ends.
    pub release_speed: f32,
    /// Current calculated dynamic multiplier [duck_factor .. 1.0].
    pub current_multiplier: f32,
}

impl Default for SidechainDucking {
    fn default() -> Self {
        Self {
            duck_factor: 0.35,
            attack_speed: 14.0,
            release_speed: 3.5,
            current_multiplier: 1.0,
        }
    }
}

/// Marker component for voice entities that activate sidechain ducking on the Music bus.
#[derive(Component)]
pub struct VoiceDuckingSource;

/// Marker component to tag audio entities with their target bus.
#[derive(Component)]
pub struct AudioBusSource(pub AudioBus);

pub struct AudioBusPlugin;

impl Plugin for AudioBusPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<AudioBusSettings>()
            .init_resource::<SidechainDucking>()
            .add_systems(Update, update_audio_ducking_system);
    }
}

/// Smoothly modulates music volume whenever Voice entities are active.
fn update_audio_ducking_system(
    time: Res<Time>,
    voice_query: Query<&AudioSink, With<VoiceDuckingSource>>,
    mut ducking: ResMut<SidechainDucking>,
    settings: Res<AudioBusSettings>,
    mut music_query: Query<&mut AudioSink, (With<AudioBusSource>, Without<VoiceDuckingSource>)>,
) {
    let dt = time.delta_secs();
    let has_active_voice = voice_query.iter().any(|sink| !sink.is_paused() && !sink.empty());

    let target_mult = if has_active_voice {
        ducking.duck_factor
    } else {
        1.0
    };

    let speed = if has_active_voice {
        ducking.attack_speed
    } else {
        ducking.release_speed
    };

    ducking.current_multiplier += (target_mult - ducking.current_multiplier) * (speed * dt).min(1.0);

    let effective_music_vol = if settings.music_muted || settings.master_muted {
        0.0
    } else {
        settings.master_volume * settings.music_volume * ducking.current_multiplier
    };

    for mut sink in &mut music_query {
        sink.set_volume(effective_music_vol);
    }
}
`;

	const snippet = `// 1. Añade el plugin en tu App de Bevy (main.rs):
app.add_plugins(audio_bus::AudioBusPlugin);

// 2. Spawn de Música con AudioBusSource(AudioBus::Music):
commands.spawn((
    AudioPlayer::new(asset_server.load("audio/music/battle.ogg")),
    audio_bus::AudioBusSource(audio_bus::AudioBus::Music),
    PlaybackSettings::LOOP,
));

// 3. Spawn de Voz / Diálogo que activa Ducking automático:
commands.spawn((
    AudioPlayer::new(asset_server.load("audio/voice/npc_intro.ogg")),
    audio_bus::AudioBusSource(audio_bus::AudioBus::Voice),
    audio_bus::VoiceDuckingSource,
));`;

	return {
		engine: "Bevy",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "Resource SidechainDucking con lerp suave de volumen (duck_factor: 0.35, attack: 14.0, release: 3.5)",
		routingCodeSnippet: snippet,
		content,
	};
}

export function generateRaylibBusHeader(rootDir: string): BusScaffoldResult {
	const srcDir = existsSync(join(rootDir, "include")) ? join(rootDir, "include") : join(rootDir, "src");
	const targetPath = join(srcDir, "audio_bus.hpp");

	const content = `#pragma once
// Audio Bus Hierarchy & Sidechain Ducking Manager for Raylib (C++17/20)
//
// Hierarchy:
// Master (0 dB)
//   ├── Music (-3 dB) [Ducked by Voice/SFX]
//   ├── SFX (0 dB)
//   ├── Voice (0 dB) [Ducking Trigger: Attenuates Music]
//   ├── UI (0 dB)
//   └── Ambient (-4 dB)

#include <raylib.h>
#include <algorithm>
#include <array>

enum class AudioBus {
    Master = 0,
    Music,
    SFX,
    Voice,
    UI,
    Ambient,
    Count
};

struct AudioBusManager {
    static AudioBusManager& Instance() {
        static AudioBusManager instance;
        return instance;
    }

    std::array<float, static_cast<size_t>(AudioBus::Count)> volumes = {
        1.0f, // Master
        0.75f, // Music (-2.5 dB)
        1.0f, // SFX
        1.0f, // Voice
        0.9f, // UI
        0.65f // Ambient
    };

    std::array<bool, static_cast<size_t>(AudioBus::Count)> mutes = { false };

    // Sidechain Ducking Parameters
    float duckFactor = 0.35f;      // Music volume multiplier during speech (~-9 dB)
    float attackSpeed = 14.0f;     // Speed to enter ducking
    float releaseSpeed = 3.5f;     // Speed to restore music volume
    float currentDucking = 1.0f;   // Dynamic envelope multiplier
    float voiceActiveTimer = 0.0f; // Seconds remaining of voice playback

    void Init() {
        InitAudioDevice();
    }

    void Close() {
        CloseAudioDevice();
    }

    void SetBusVolume(AudioBus bus, float volume) {
        volumes[static_cast<size_t>(bus)] = std::clamp(volume, 0.0f, 1.0f);
    }

    float GetEffectiveVolume(AudioBus bus) const {
        if (mutes[static_cast<size_t>(AudioBus::Master)] || mutes[static_cast<size_t>(bus)]) {
            return 0.0f;
        }
        float vol = volumes[static_cast<size_t>(AudioBus::Master)] * volumes[static_cast<size_t>(bus)];
        if (bus == AudioBus::Music) {
            vol *= currentDucking;
        }
        return vol;
    }

    void PlaySoundBus(Sound sound, AudioBus bus = AudioBus::SFX) {
        SetSoundVolume(sound, GetEffectiveVolume(bus));
        PlaySound(sound);
    }

    void PlayVoice(Sound voiceSound, float durationSeconds) {
        voiceActiveTimer = std::max(voiceActiveTimer, durationSeconds);
        PlaySoundBus(voiceSound, AudioBus::Voice);
    }

    void PlayMusicBus(Music music) {
        SetMusicVolume(music, GetEffectiveVolume(AudioBus::Music));
        PlayMusicStream(music);
    }

    void Update(Music activeMusic, float dt) {
        // Decrement voice timer
        if (voiceActiveTimer > 0.0f) {
            voiceActiveTimer -= dt;
            if (voiceActiveTimer < 0.0f) voiceActiveTimer = 0.0f;
        }

        // Sidechain Ducking envelope smoothing
        bool voiceActive = voiceActiveTimer > 0.0f;
        float target = voiceActive ? duckFactor : 1.0f;
        float speed = voiceActive ? attackSpeed : releaseSpeed;
        currentDucking += (target - currentDucking) * std::min(speed * dt, 1.0f);

        // Update active music stream
        SetMusicVolume(activeMusic, GetEffectiveVolume(AudioBus::Music));
        UpdateMusicStream(activeMusic);
    }
};
`;

	const snippet = `// En tu bucle principal de Raylib (main.cpp):
AudioBusManager::Instance().Init();
Music bgMusic = LoadMusicStream("assets/music/theme.ogg");
AudioBusManager::Instance().PlayMusicBus(bgMusic);

while (!WindowShouldClose()) {
    float dt = GetFrameTime();
    // Actualiza ducking y streaming de música:
    AudioBusManager::Instance().Update(bgMusic, dt);

    // Disparar diálogo / voz con ducking automático sobre la música:
    if (IsKeyPressed(KEY_SPACE)) {
        Sound dialog = LoadSound("assets/voice/line_01.wav");
        AudioBusManager::Instance().PlayVoice(dialog, 2.5f); // 2.5 segundos de duración
    }
}`;

	return {
		engine: "Raylib",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "Gestor con envelope follower en C++ (duckFactor: 0.35, attack: 14.0, release: 3.5)",
		routingCodeSnippet: snippet,
		content,
	};
}

export function generateUnityBusController(rootDir: string): BusScaffoldResult {
	const scriptsDir = join(rootDir, "Assets", "Scripts", "Audio");
	const targetPath = join(scriptsDir, "AudioBusController.cs");

	const content = `using UnityEngine;
using UnityEngine.Audio;

/// <summary>
/// Audio Bus Controller & Sidechain Ducking Manager for Unity.
/// </summary>
public class AudioBusController : MonoBehaviour
{
    public static AudioBusController Instance { get; private set; }

    [Header("Audio Mixer")]
    [SerializeField] private AudioMixer mainMixer;

    [Header("Ducking Configuration")]
    [SerializeField] private float duckFactorLinear = 0.35f; // ~-9 dB
    [SerializeField] private float attackSpeed = 12f;
    [SerializeField] private float releaseSpeed = 4f;

    private float currentDucking = 1.0f;
    private float voiceTimer = 0f;

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    private void Update()
    {
        if (voiceTimer > 0f)
        {
            voiceTimer -= Time.deltaTime;
        }

        bool voiceActive = voiceTimer > 0f;
        float target = voiceActive ? duckFactorLinear : 1.0f;
        float speed = voiceActive ? attackSpeed : releaseSpeed;
        currentDucking = Mathf.Lerp(currentDucking, target, speed * Time.deltaTime);

        // Apply ducking to Music bus in AudioMixer
        float musicDb = Mathf.Log10(Mathf.Max(0.0001f, currentDucking)) * 20f;
        mainMixer.SetFloat("MusicDuckingDb", musicDb);
    }

    public void TriggerVoice(float duration)
    {
        voiceTimer = Mathf.Max(voiceTimer, duration);
    }
}
`;

	const snippet = `// Reproducir sonido con sidechain ducking en Unity:
AudioBusController.Instance.TriggerVoice(clip.length);
voiceAudioSource.PlayOneShot(clip);`;

	return {
		engine: "Unity",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "AudioMixer sidechain expuesto + Controller lerp dinámico",
		routingCodeSnippet: snippet,
		content,
	};
}

export function generateUnrealBusConfig(rootDir: string): BusScaffoldResult {
	const sourceDir = join(rootDir, "Source");
	const targetPath = join(sourceDir, "AudioBusConfig.h");

	const content = `#pragma once

#include "CoreMinimal.h"

/**
 * Pi Game Studio — Audio Bus & SoundClass Hierarchy for Unreal Engine 5
 *
 * Hierarchy:
 * Master_SoundClass (0 dB)
 *   ├── Music_SoundClass (-3 dB) [Receives ducking send from Voice]
 *   ├── SFX_SoundClass (0 dB)
 *   ├── Voice_SoundClass (0 dB) [Triggers passive ducking modulation]
 *   ├── UI_SoundClass (0 dB)
 *   └── Ambient_SoundClass (-4 dB)
 */
struct FAudioBusHierarchy
{
    static constexpr const TCHAR* MasterBus = TEXT("/Game/Audio/Classes/SC_Master");
    static constexpr const TCHAR* MusicBus = TEXT("/Game/Audio/Classes/SC_Music");
    static constexpr const TCHAR* SFXBus = TEXT("/Game/Audio/Classes/SC_SFX");
    static constexpr const TCHAR* VoiceBus = TEXT("/Game/Audio/Classes/SC_Voice");
    static constexpr const TCHAR* UIBus = TEXT("/Game/Audio/Classes/SC_UI");
    static constexpr const TCHAR* AmbientBus = TEXT("/Game/Audio/Classes/SC_Ambient");
};
`;

	const snippet = `// En Unreal Engine 5 (C++ / Blueprint):
// Asigna SC_Voice al SoundWave o AudioComponent.
// El SoundClass SC_Voice modula pasivamente el volumen de SC_Music en -9dB.`;

	return {
		engine: "Unreal",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "SoundClass Passive Sound Modulation (SC_Voice -> SC_Music)",
		routingCodeSnippet: snippet,
		content,
	};
}

export function generatePhaserBusManager(rootDir: string): BusScaffoldResult {
	const srcDir = existsSync(join(rootDir, "src", "audio"))
		? join(rootDir, "src", "audio")
		: existsSync(join(rootDir, "src"))
		? join(rootDir, "src", "audio")
		: join(rootDir, "audio");
	const targetPath = join(srcDir, "AudioManager.ts");

	const content = `/**
 * Pi Game Studio — Audio Bus & Sidechain Ducking Manager for Phaser 3/4
 *
 * Jerarquía de buses sobre Phaser Web Audio API:
 * Master (1.0)
 *   ├── Music (0.75 / -2.5 dB) [Sidechain Ducking: atenuado por Voice]
 *   ├── SFX (1.0)
 *   ├── Voice (1.0) [Ducking Trigger: atenúa Music a 0.35]
 *   ├── UI (0.9)
 *   └── Ambient (0.65 / -4.0 dB)
 */

export type AudioBus = "master" | "music" | "sfx" | "voice" | "ui" | "ambient";

export interface BusVolumeConfig {
    master: number;
    music: number;
    sfx: number;
    voice: number;
    ui: number;
    ambient: number;
}

export class AudioManager {
    private static instance: AudioManager;
    private scene!: Phaser.Scene;

    private volumes: BusVolumeConfig = {
        master: 1.0,
        music: 0.75,
        sfx: 1.0,
        voice: 1.0,
        ui: 0.9,
        ambient: 0.65,
    };

    private mutes: Record<AudioBus, boolean> = {
        master: false,
        music: false,
        sfx: false,
        voice: false,
        ui: false,
        ambient: false,
    };

    // Sidechain Ducking (Web Audio Gain modulation)
    private duckFactor = 0.35;    // ~ -9 dB al hablar Voice
    private attackSpeed = 14.0;   // Velocidad de entrada de ducking
    private releaseSpeed = 3.5;   // Velocidad de recuperación de volumen
    private currentDucking = 1.0;
    private voiceTimer = 0.0;

    private currentMusic?: Phaser.Sound.BaseSound;
    private currentAmbient?: Phaser.Sound.BaseSound;

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public init(scene: Phaser.Scene): void {
        this.scene = scene;
    }

    public getEffectiveVolume(bus: AudioBus): number {
        if (this.mutes.master || this.mutes[bus]) return 0.0;
        let vol = this.volumes.master * this.volumes[bus];
        if (bus === "music") {
            vol *= this.currentDucking;
        }
        return Math.max(0.0, Math.min(1.0, vol));
    }

    public setBusVolume(bus: AudioBus, volume: number): void {
        this.volumes[bus] = Phaser.Math.Clamp(volume, 0.0, 1.0);
        if (bus === "music" && this.currentMusic && "setVolume" in this.currentMusic) {
            (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(this.getEffectiveVolume("music"));
        }
    }

    public playMusic(key: string, config: Phaser.Types.Sound.SoundConfig = { loop: true }): Phaser.Sound.BaseSound {
        if (this.currentMusic) {
            this.currentMusic.stop();
        }
        const sound = this.scene.sound.add(key, {
            ...config,
            volume: this.getEffectiveVolume("music"),
        });
        sound.play();
        this.currentMusic = sound;
        return sound;
    }

    public playSFX(key: string, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound {
        const sound = this.scene.sound.add(key, {
            ...config,
            volume: this.getEffectiveVolume("sfx"),
        });
        sound.play();
        return sound;
    }

    public playVoice(key: string, durationSeconds: number, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound {
        this.voiceTimer = Math.max(this.voiceTimer, durationSeconds);
        const sound = this.scene.sound.add(key, {
            ...config,
            volume: this.getEffectiveVolume("voice"),
        });
        sound.play();
        return sound;
    }

    public playAudioSprite(spriteKey: string, soundKey: string, bus: AudioBus = "sfx"): void {
        const vol = this.getEffectiveVolume(bus);
        this.scene.sound.playAudioSprite(spriteKey, soundKey, { volume: vol });
    }

    public update(deltaSeconds: number): void {
        if (this.voiceTimer > 0) {
            this.voiceTimer -= deltaSeconds;
            if (this.voiceTimer < 0) this.voiceTimer = 0;
        }

        const voiceActive = this.voiceTimer > 0;
        const target = voiceActive ? this.duckFactor : 1.0;
        const speed = voiceActive ? this.attackSpeed : this.releaseSpeed;
        this.currentDucking += (target - this.currentDucking) * Math.min(speed * deltaSeconds, 1.0);

        if (this.currentMusic && "setVolume" in this.currentMusic && this.currentMusic.isPlaying) {
            (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(this.getEffectiveVolume("music"));
        }
    }
}
`;

	const snippet = `// 1. Inicializar en tu Scene de Phaser (create):
const audio = AudioManager.getInstance();
audio.init(this);
audio.playMusic("bgm_battle");

// 2. Disparar diálogo con ducking automático sobre la música:
audio.playVoice("voice_dialogue_01", 3.2); // 3.2s de voz atenúa Music a 0.35

// 3. Efectos y audio sprites:
audio.playSFX("hit_punch");
audio.playAudioSprite("game_audio_sprite", "coin_pickup", "sfx");

// 4. En el ciclo update(time, delta):
audio.update(delta / 1000);`;

	return {
		engine: "Phaser",
		targetFilePath: targetPath,
		relPath: relative(rootDir, targetPath),
		buses: ["Master", "Music (Ducked)", "SFX", "Voice (Ducking Trigger)", "UI", "Ambient"],
		duckingConfig: "AudioManager en TypeScript con Web Audio Gain lerp (duckFactor: 0.35, attack: 14.0, release: 3.5)",
		routingCodeSnippet: snippet,
		content,
	};
}

/**
 * Scaffolds the audio bus hierarchy for the selected engine.
 */
export function scaffoldAudioBus(engine: SupportedEngine, rootDir: string): BusScaffoldResult {
	switch (engine) {
		case "Godot":
			return generateGodotBusLayout(rootDir);
		case "Bevy":
			return generateBevyBusModule(rootDir);
		case "Raylib":
			return generateRaylibBusHeader(rootDir);
		case "Unity":
			return generateUnityBusController(rootDir);
		case "Unreal":
			return generateUnrealBusConfig(rootDir);
		case "Phaser":
			return generatePhaserBusManager(rootDir);
	}
}

/**
 * Renders an ANSI confirmation card with the bus hierarchy and routing instructions.
 */
export function renderAudioBusConfirmation(result: BusScaffoldResult, termWidth = 80): string[] {
	const width = Math.max(76, Math.min(termWidth, 96));
	const innerWidth = width - 4;
	const lines: string[] = [];

	lines.push("");
	lines.push(panelTop(width - 2, undefined, "square", BORDER));
	lines.push(
		`${panelRow(`${ACCENT}${BOLD}AUDIO BUS HIERARCHY & DUCKING MATRIX${RESET} ${GRAY}(Audio Director)${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Engine & target file
	lines.push(
		`${panelRow(`  ${DIM}Motor activo:${RESET} ${WHITE}${result.engine}${RESET} ${DIM}│ Archivo:${RESET} ${SECONDARY}${result.relPath}${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Tree view
	lines.push(
		`${panelRow(`${HEADING}JERARQUÍA DE BUSES Y SIDECHAIN DUCKING:${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(`${panelRow(`  ${WHITE}Master Bus${RESET} ${GRAY}(0.0 dB)${RESET}`, innerWidth + 2, BORDER)}`);
	lines.push(
		`${panelRow(`    ${DIM}├──${RESET} ${SECONDARY}Music${RESET} ${GRAY}(-3.0 dB)${RESET} ${YELLOW}[Sidechain Ducking: se atenúa al hablar Voice]${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(`${panelRow(`    ${DIM}├──${RESET} ${WHITE}SFX${RESET} ${GRAY}(0.0 dB)${RESET} ${DIM}— Efectos, armas, colisiones${RESET}`, innerWidth + 2, BORDER)}`);
	lines.push(
		`${panelRow(`    ${DIM}├──${RESET} ${GREEN}Voice${RESET} ${GRAY}(0.0 dB)${RESET} ${RED}[Trigger Ducking: baja Music -9dB durante diálogo]${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(`${panelRow(`    ${DIM}├──${RESET} ${WHITE}UI${RESET} ${GRAY}(0.0 dB)${RESET} ${DIM}— Clics, botones, feedback directo${RESET}`, innerWidth + 2, BORDER)}`);
	lines.push(`${panelRow(`    ${DIM}└──${RESET} ${WHITE}Ambient${RESET} ${GRAY}(-4.0 dB)${RESET} ${DIM}— Loops de viento, cuevas, fondos${RESET}`, innerWidth + 2, BORDER)}`);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Ducking configuration details
	lines.push(
		`${panelRow(`${HEADING}CONFIGURACIÓN DEL COMPRESOR / DUCKING:${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(
		`${panelRow(`  ${GRAY}${result.duckingConfig}${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Instructions
	lines.push(
		`${panelRow(`${HEADING}CÓMO ENRUTAR REPRODUCTORES DE AUDIO (${result.engine}):${RESET}`, innerWidth + 2, BORDER)}`,
	);

	const codeLines = result.routingCodeSnippet.split("\n");
	for (const cl of codeLines) {
		lines.push(`${panelRow(`  ${DIM}${cl}${RESET}`, innerWidth + 2, BORDER)}`);
	}

	lines.push(panelRule(width - 2, "square", BORDER));
	lines.push(
		`${panelRow(`${GREEN}[CREACIÓN EXITOSA]${RESET} Jerarquía de audio profesional generada en disco.`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelBottom(width - 2, "square", BORDER));
	lines.push("");

	return lines;
}

/**
 * Main command handler for /audio-bus and /studio:audio-bus.
 */
export async function handleStudioAudioBus(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const engine = resolveEngineTarget(args, rootDir);

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(`Generando jerarquía de audio buses para ${engine}...`, "info");
	}

	const result = scaffoldAudioBus(engine, rootDir);

	// Ensure parent directory exists before writing
	const parentDir = dirname(result.targetFilePath);
	try {
		mkdirSync(parentDir, { recursive: true });
	} catch {}

	// Generated engine source is non-trivial work the user would have to rewrite
	// by hand if a crash left it truncated.
	writeFileAtomicSync(result.targetFilePath, result.content, "utf8");

	const termWidth = process.stdout.columns || 80;
	const reportLines = renderAudioBusConfirmation(result, termWidth);

	for (const line of reportLines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(
			`Audio Bus layout generado en ${result.relPath} (${engine})`,
			"info",
		);
	}
}
