cmake_minimum_required(VERSION 3.20)
project(RaylibEnTTStarter LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# 1. Raylib 5.5
FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 5.5
)
FetchContent_MakeAvailable(raylib)

# 2. EnTT v3.13.2
FetchContent_Declare(
    entt
    GIT_REPOSITORY https://github.com/skypjack/entt.git
    GIT_TAG v3.13.2
)
FetchContent_MakeAvailable(entt)

add_executable(game src/main.cpp)
target_link_libraries(game PRIVATE raylib EnTT::EnTT)
target_include_directories(game PRIVATE src)
