extends CanvasLayer

## Pi Game Studio — F3 / ~ Debug Overlay
## Displays live FPS, memory footprint, position, and entity count.
## Toggled via F3 or ~ (tilde).

@export var enabled: bool = false
@onready var label: Label = $Label

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = enabled

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F3 or event.keycode == KEY_QUOTELEFT:
			enabled = !enabled
			visible = enabled

func _process(_delta: float) -> void:
	if not visible:
		return

	var fps := Engine.get_frames_per_second()
	var mem_static := OS.get_static_memory_usage() / (1024.0 * 1024.0)
	var node_count := get_tree().get_node_count()

	label.text = "[DEBUG OVERLAY (F3 / ~)]\n" + \
		"FPS: %d\n" % fps + \
		"Static RAM: %.2f MB\n" % mem_static + \
		"Active Nodes: %d\n" % node_count + \
		"Process Paused: %s" % str(get_tree().paused)
