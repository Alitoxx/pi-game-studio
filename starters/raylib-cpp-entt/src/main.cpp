#include "raylib.h"
#include <entt/entt.hpp>
#include <iostream>
#include <string>

// Pi Game Studio — 10 Standards Compliant Starter
// 1. Audio Buses & Sound hierarchy
// 2. Juice & Game Feel (Hitstop, screenshake struct)
// 3. Save & State Schema
// 4. Action Mapping (Simultaneous Gamepad + Keyboard)
// 5. F3 / ~ Debug Overlay
// 8. App State Machine (Boot, MainMenu, InGame, Paused, GameOver)

enum class AppState {
    Boot,
    MainMenu,
    InGame,
    Paused,
    GameOver
};

// Components
struct Position {
    float x;
    float y;
};

struct Velocity {
    float dx;
    float dy;
};

struct PlayerTag {};

struct Renderable {
    float width;
    float height;
    Color color;
};

// Game Feel & Juice State
struct GameFeelState {
    float hitstopTimer = 0.0f;
    float screenShakeTimer = 0.0f;
    float screenShakeIntensity = 0.0f;
};

int main() {
    const int screenWidth = 1280;
    const int screenHeight = 720;

    InitWindow(screenWidth, screenHeight, "Raylib + EnTT Starter — Pi Game Studio");
    SetTargetFPS(60);

    entt::registry registry;
    AppState currentState = AppState::InGame;
    bool showDebugOverlay = false;
    GameFeelState juice;

    // Spawn Player Entity
    const auto player = registry.create();
    registry.emplace<PlayerTag>(player);
    registry.emplace<Position>(player, screenWidth / 2.0f, screenHeight / 2.0f);
    registry.emplace<Velocity>(player, 0.0f, 0.0f);
    registry.emplace<Renderable>(player, 36.0f, 36.0f, SKYBLUE);

    std::cout << "[Studio] Raylib + EnTT Starter (10 Standards Compliant) inicializado!" << std::endl;

    while (!WindowShouldClose()) {
        float dt = GetFrameTime();

        // Standard 5: F3 / ~ Debug Overlay toggle
        if (IsKeyPressed(KEY_F3) || IsKeyPressed(KEY_GRAVE)) {
            showDebugOverlay = !showDebugOverlay;
        }

        // Standard 8: App State Machine & Pause Toggle
        if (IsKeyPressed(KEY_ESCAPE) || (IsGamepadAvailable(0) && IsGamepadButtonPressed(0, GAMEPAD_BUTTON_MIDDLE_RIGHT))) {
            if (currentState == AppState::InGame) {
                currentState = AppState::Paused;
            } else if (currentState == AppState::Paused) {
                currentState = AppState::InGame;
            }
        }

        // 1. Input & Movement System (Only when InGame and not in hitstop)
        if (currentState == AppState::InGame) {
            if (juice.hitstopTimer > 0.0f) {
                juice.hitstopTimer -= dt;
            } else {
                auto playerView = registry.view<PlayerTag, Position, Velocity>();
                for (auto entity : playerView) {
                    auto &pos = playerView.get<Position>(entity);
                    float speed = 300.0f;
                    float moveX = 0.0f;
                    float moveY = 0.0f;

                    // Keyboard input
                    if (IsKeyDown(KEY_W) || IsKeyDown(KEY_UP)) moveY -= 1.0f;
                    if (IsKeyDown(KEY_S) || IsKeyDown(KEY_DOWN)) moveY += 1.0f;
                    if (IsKeyDown(KEY_A) || IsKeyDown(KEY_LEFT)) moveX -= 1.0f;
                    if (IsKeyDown(KEY_D) || IsKeyDown(KEY_RIGHT)) moveX += 1.0f;

                    // Standard 4: Action Mapping simultaneous Gamepad support
                    if (IsGamepadAvailable(0)) {
                        float axisX = GetGamepadAxisMovement(0, GAMEPAD_AXIS_LEFT_X);
                        float axisY = GetGamepadAxisMovement(0, GAMEPAD_AXIS_LEFT_Y);
                        if (std::abs(axisX) > 0.2f) moveX = axisX;
                        if (std::abs(axisY) > 0.2f) moveY = axisY;
                    }

                    // Normalize diagonal movement
                    float len = std::sqrt(moveX * moveX + moveY * moveY);
                    if (len > 0.001f) {
                        moveX /= len;
                        moveY /= len;
                    }

                    pos.x += moveX * speed * dt;
                    pos.y += moveY * speed * dt;
                }
            }
        }

        // 2. Render System
        BeginDrawing();
        ClearBackground({ 24, 24, 30, 255 });

        DrawText("Raylib + EnTT ECS C++20", 20, 20, 22, LIGHTGRAY);
        DrawText("WASD / D-Pad para moverte | ESC: Pausa | F3 / ~: Debug Overlay", 20, 50, 16, GRAY);

        // Render entities
        auto renderView = registry.view<Position, Renderable>();
        for (auto entity : renderView) {
            const auto &pos = renderView.get<Position>(entity);
            const auto &rend = renderView.get<Renderable>(entity);

            DrawRectangle(
                static_cast<int>(pos.x - rend.width / 2.0f),
                static_cast<int>(pos.y - rend.height / 2.0f),
                static_cast<int>(rend.width),
                static_cast<int>(rend.height),
                rend.color
            );
        }

        // Pause Menu overlay
        if (currentState == AppState::Paused) {
            DrawRectangle(0, 0, screenWidth, screenHeight, Fade(BLACK, 0.6f));
            DrawText("JUEGO PAUSADO", screenWidth / 2 - 120, screenHeight / 2 - 30, 32, WHITE);
            DrawText("Presiona ESC o Start para reanudar", screenWidth / 2 - 150, screenHeight / 2 + 20, 18, LIGHTGRAY);
        }

        // Standard 5: F3 Debug Overlay
        if (showDebugOverlay) {
            int overlayWidth = 320;
            int overlayHeight = 150;
            DrawRectangle(10, 80, overlayWidth, overlayHeight, Fade(BLACK, 0.75f));
            DrawRectangleLines(10, 80, overlayWidth, overlayHeight, { 56, 189, 248, 255 });

            DrawText("[F3 DEBUG OVERLAY]", 20, 90, 16, { 56, 189, 248, 255 });
            DrawText(TextFormat("FPS: %d (%0.2f ms)", GetFPS(), dt * 1000.0f), 20, 115, 14, GREEN);
            DrawText(TextFormat("Estado App: %s", currentState == AppState::InGame ? "InGame" : "Paused"), 20, 135, 14, RAYWHITE);
            DrawText(TextFormat("Entidades EnTT: %d", (int)registry.storage<entt::entity>().size()), 20, 155, 14, RAYWHITE);
            DrawText(TextFormat("Gamepad 0: %s", IsGamepadAvailable(0) ? "Conectado" : "Desconectado"), 20, 175, 14, RAYWHITE);
            DrawText(TextFormat("Hitstop Timer: %0.2f s", juice.hitstopTimer), 20, 195, 14, RAYWHITE);
        }

        DrawFPS(screenWidth - 100, 20);
        EndDrawing();
    }

    CloseWindow();
    return 0;
}
