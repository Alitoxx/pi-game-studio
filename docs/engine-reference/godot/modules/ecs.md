# Godot - ECS

## SceneTree como jerarquía vs ECS
Godot utiliza un enfoque Orientado a Objetos mediante el `SceneTree` y Nodos. Para juegos con un número masivo de entidades, este modelo puede tener cuellos de botella por falta de localidad en caché.

## Patrones GDExtension ECS/EnTT
Para implementar Entity Component System (ECS) en Godot:
- Se recomienda el uso de GDExtension con librerías de C++ como `EnTT`.
- Las entidades visuales pueden ser instancias de un `MultiMeshInstance` mientras que la lógica de transformación y comportamiento se mantiene en arrays continuos en C++.
