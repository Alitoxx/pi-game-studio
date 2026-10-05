using UnityEngine;

namespace Game.Scripts
{
    /// <summary>
    /// Pi Game Studio — Standard 5: F3 Debug Overlay
    /// Toggles via F3 or Backquote (~).
    /// </summary>
    public class DebugOverlay : MonoBehaviour
    {
        [SerializeField] private bool showOverlay = false;

        private float deltaTime = 0.0f;

        private void Update()
        {
            deltaTime += (Time.unscaledDeltaTime - deltaTime) * 0.1f;

            if (Input.GetKeyDown(KeyCode.F3) || Input.GetKeyDown(KeyCode.BackQuote))
            {
                showOverlay = !showOverlay;
            }
        }

        private void OnGUI()
        {
            if (!showOverlay) return;

            int w = Screen.width, h = Screen.height;
            GUIStyle style = new GUIStyle();

            Rect rect = new Rect(20, 20, 300, 140);
            GUI.Box(rect, "[F3 DEBUG OVERLAY]");

            style.alignment = TextAnchor.UpperLeft;
            style.fontSize = 14;
            style.normal.textColor = Color.cyan;

            float msec = deltaTime * 1000.0f;
            float fps = 1.0f / deltaTime;
            string text = string.Format("FPS: {0:0.} ({1:0.0} ms)\nRAM: {2} MB\nTimeScale: {3}",
                fps, msec, (System.GC.GetTotalMemory(false) / (1024 * 1024)), Time.timeScale);

            GUI.Label(new Rect(30, 50, 280, 90), text, style);
        }
    }
}
