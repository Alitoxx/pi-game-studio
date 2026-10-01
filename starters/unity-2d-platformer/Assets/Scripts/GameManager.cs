using UnityEngine;

namespace Game.Scripts
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public enum GameState
        {
            Playing,
            Paused,
            GameOver
        }

        public GameState State { get; private set; }

        // [SerializeField] private int score = 0;
        // [SerializeField] private int lives = 3;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                State = GameState.Playing;
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void PauseGame()
        {
            State = GameState.Paused;
            Time.timeScale = 0f;
        }

        public void ResumeGame()
        {
            State = GameState.Playing;
            Time.timeScale = 1f;
        }

        // Métodos de puntuación y vidas pueden añadirse aquí
    }
}
