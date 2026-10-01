# Godot - Audio

## AudioServer Busses
Organizar el sonido en diferentes canales (Master, Music, SFX) utilizando `AudioServer`. Esto permite aplicar efectos globales (Reverb, EQ) por canal.

## AudioStreamPlayer Pooling
Evitar crear un nuevo `AudioStreamPlayer` para cada sonido concurrente. Pre-instanciar un pool de players y reusarlos (Node Pooling) para evitar carga al recolector de basura o retrasos de instanciación.
