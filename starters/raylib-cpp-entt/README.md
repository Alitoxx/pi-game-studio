# Raylib + EnTT ECS Starter — Pi Game Studio

Starter boilerplate en **Modern C++ (C++20)** usando **Raylib 5.5** y la librería ECS de alto rendimiento **EnTT v3.13**.

## Requisitos

- CMake >= 3.20
- Compilador C++20 (Clang++, G++, o MSVC)
- Git (para descarga automática con FetchContent)

## Cómo compilar y ejecutar

```bash
# Configurar y descargar dependencias
cmake -B build -DCMAKE_BUILD_TYPE=Debug

# Compilar
cmake --build build

# Ejecutar
./build/game
```

## Controles

- **Mover:** Teclas `W`, `A`, `S`, `D` o Flechas
