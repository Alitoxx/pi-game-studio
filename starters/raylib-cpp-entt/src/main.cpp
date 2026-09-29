#include "raylib.h"
#include <entt/entt.hpp>
#include <iostream>

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

int main() {
    const int screenWidth = 1280;
    const int screenHeight = 720;

    InitWindow(screenWidth, screenHeight, "Raylib + EnTT Starter — Pi Game Studio");
    SetTargetFPS(60);

    entt::registry registry;

    // Spawn Player Entity
    const auto player = registry.create();
    registry.emplace<PlayerTag>(player);
    registry.emplace<Position>(player, screenWidth / 2.0f, screenHeight / 2.0f);
    registry.emplace<Velocity>(player, 0.0f, 0.0f);
    registry.emplace<Renderable>(player, 36.0f, 36.0f, SKYBLUE);

    std::cout << "[Studio] Raylib + EnTT Starter inicializado correctamente!" << std::endl;

    while (!WindowShouldClose()) {
        float dt = GetFrameTime();

        // 1. Input & Movement System
        auto playerView = registry.view<PlayerTag, Position, Velocity>();
        for (auto entity : playerView) {
            auto &pos = playerView.get<Position>(entity);
            float speed = 300.0f;
            float moveX = 0.0f;
            float moveY = 0.0f;

            if (IsKeyDown(KEY_W) || IsKeyDown(KEY_UP)) moveY -= 1.0f;
            if (IsKeyDown(KEY_S) || IsKeyDown(KEY_DOWN)) moveY += 1.0f;
            if (IsKeyDown(KEY_A) || IsKeyDown(KEY_LEFT)) moveX -= 1.0f;
            if (IsKeyDown(KEY_D) || IsKeyDown(KEY_RIGHT)) moveX += 1.0f;

            pos.x += moveX * speed * dt;
            pos.y += moveY * speed * dt;
        }

        // 2. Render System
        BeginDrawing();
        ClearBackground({ 24, 24, 30, 255 });

        DrawText("Raylib + EnTT ECS C++20", 20, 20, 22, LIGHTGRAY);
        DrawText("Usa WASD o Flechas para moverte", 20, 50, 18, GRAY);

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

        DrawFPS(screenWidth - 100, 20);
        EndDrawing();
    }

    CloseWindow();
    return 0;
}
