extends Node

## Pi Game Studio — App State Machine & Pause Manager
## States: Boot, MainMenu, InGame, Paused, GameOver
## Handles genuine process pause and audio ducking on UI cancel / Escape.

enum State {
	BOOT,
	MAIN_MENU,
	IN_GAME,
	PAUSED,
	GAME_OVER,
}

var current_state: State = State.IN_GAME

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if current_state == State.IN_GAME:
			set_state(State.PAUSED)
		elif current_state == State.PAUSED:
			set_state(State.IN_GAME)

func set_state(new_state: State) -> void:
	current_state = new_state
	match current_state:
		State.IN_GAME:
			get_tree().paused = false
		State.PAUSED:
			get_tree().paused = true
		State.GAME_OVER:
			get_tree().paused = true
		_:
			get_tree().paused = false
