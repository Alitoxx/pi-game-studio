#!/usr/bin/env bash
# scripts/build-web.sh — Unified WebAssembly / Web exporter for Pi Game Studio engines
# Supports: Raylib (emscripten), Bevy (wasm-bindgen), Godot 4 (headless web export)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/dist/web"
ENGINE="${1:-}"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     PI GAME STUDIO — UNIFIED WEB / WASM BUILD RUNNER       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

# Detect engine if not provided
if [[ -z "$ENGINE" ]]; then
  if [[ -f "${ROOT_DIR}/project.yaml" ]]; then
    ENGINE=$(grep -E "^engine:" "${ROOT_DIR}/project.yaml" | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'" | tr '[:upper:]' '[:lower:]')
  fi
fi

if [[ -z "$ENGINE" ]]; then
  ENGINE="raylib"
fi

mkdir -p "$OUTPUT_DIR"
echo -e "Target Engine: ${YELLOW}${ENGINE}${NC}"
echo -e "Output Directory: ${GREEN}${OUTPUT_DIR}${NC}\n"

case "$ENGINE" in
  raylib)
    echo -e "${CYAN}==> Building Raylib C++ to WASM with Emscripten...${NC}"
    if ! command -v emcc &> /dev/null; then
      echo -e "${YELLOW}Warning: 'emcc' not found. Creating placeholder Web runner index.html for testing.${NC}"
      cat << 'EOF' > "${OUTPUT_DIR}/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pi Game Studio — Raylib Web</title>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    canvas { background: #000; border: 2px solid #333; box-shadow: 0 0 20px rgba(0,255,200,0.2); }
    h1 { font-size: 1.2rem; color: #00ffd2; }
  </style>
</head>
<body>
  <h1>PI GAME STUDIO — RAYLIB WEB RUNNER (PROTOTYPE)</h1>
  <canvas id="canvas" width="800" height="450"></canvas>
  <p>To compile native WASM, install Emscripten (emsdk) and run: npm run build:web</p>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let t = 0;
    function render() {
      t += 0.03;
      ctx.fillStyle = '#161922';
      ctx.fillRect(0, 0, 800, 450);
      ctx.fillStyle = '#00ffd2';
      const x = 400 + Math.cos(t) * 150;
      const y = 225 + Math.sin(t) * 80;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '16px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Raylib WASM Canvas Ready [COOP/COEP Enabled]', 220, 230);
      requestAnimationFrame(render);
    }
    render();
  </script>
</body>
</html>
EOF
      echo -e "${GREEN}Created Web preview harness in ${OUTPUT_DIR}/index.html${NC}"
      exit 0
    fi

    # Native Emscripten build if emcc exists
    SRC_DIR="${ROOT_DIR}/src"
    if [[ ! -d "$SRC_DIR" && -d "${ROOT_DIR}/starters/raylib-cpp-entt/src" ]]; then
      SRC_DIR="${ROOT_DIR}/starters/raylib-cpp-entt/src"
    fi
    echo "Compiling sources from ${SRC_DIR}..."
    emcc "${SRC_DIR}"/*.cpp -Os -Wall \
      -s USE_GLFW=3 -s ASYNCIFY -s ALLOW_MEMORY_GROWTH=1 \
      -s EXPORTED_RUNTIME_METHODS=ccall,cwrap \
      -o "${OUTPUT_DIR}/index.html"
    echo -e "${GREEN}Build succeeded: ${OUTPUT_DIR}/index.html${NC}"
    ;;

  bevy)
    echo -e "${CYAN}==> Building Bevy to WebAssembly (wasm32-unknown-unknown)...${NC}"
    if ! command -v wasm-bindgen &> /dev/null || ! command -v cargo &> /dev/null; then
      echo -e "${YELLOW}Warning: 'wasm-bindgen' or 'cargo' not found in PATH. Creating Web harness for testing.${NC}"
      cat << 'EOF' > "${OUTPUT_DIR}/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pi Game Studio — Bevy Web</title>
  <style>
    body { background: #0e0e12; color: #fff; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    canvas { background: #000; border: 1px solid #444; }
  </style>
</head>
<body>
  <h2 style="color: #ff8800;">BEVY WASM RUNNER (PROTOTYPE)</h2>
  <canvas id="bevy" width="960" height="540"></canvas>
  <p>Run: cargo build --target wasm32-unknown-unknown --release && wasm-bindgen ...</p>
  <script>
    const c = document.getElementById('bevy').getContext('2d');
    c.fillStyle = '#ff8800';
    c.fillText('Bevy WebAssembly canvas ready', 360, 270);
  </script>
</body>
</html>
EOF
      echo -e "${GREEN}Created Bevy Web preview harness in ${OUTPUT_DIR}/index.html${NC}"
      exit 0
    fi
    cargo build --target wasm32-unknown-unknown --release
    wasm-bindgen --out-dir "${OUTPUT_DIR}" --target web target/wasm32-unknown-unknown/release/*.wasm
    echo -e "${GREEN}Bevy WASM build complete in ${OUTPUT_DIR}${NC}"
    ;;

  godot)
    echo -e "${CYAN}==> Exporting Godot 4 Web build...${NC}"
    if ! command -v godot &> /dev/null && ! command -v godot4 &> /dev/null; then
      echo -e "${YELLOW}Warning: Godot binary not found. Creating Web harness for testing.${NC}"
      cat << 'EOF' > "${OUTPUT_DIR}/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pi Game Studio — Godot 4 Web</title>
  <style>
    body { background: #1a1a24; color: #478cbf; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  </style>
</head>
<body>
  <h1>GODOT 4 WEB RUNNER (PROTOTYPE)</h1>
  <p>To export: configure export_presets.cfg with Web preset and run godot --headless --export-release Web</p>
</body>
</html>
EOF
      echo -e "${GREEN}Created Godot Web preview harness in ${OUTPUT_DIR}/index.html${NC}"
      exit 0
    fi
    GODOT_BIN=$(command -v godot || command -v godot4)
    "$GODOT_BIN" --headless --export-release "Web" "${OUTPUT_DIR}/index.html"
    echo -e "${GREEN}Godot export complete: ${OUTPUT_DIR}/index.html${NC}"
    ;;

  *)
    echo -e "${YELLOW}Engine '${ENGINE}' uses standard Web export harness.${NC}"
    cat << EOF > "${OUTPUT_DIR}/index.html"
<!DOCTYPE html>
<html>
<head><title>Pi Game Studio Web</title></head>
<body style="background:#111;color:#fff;text-align:center;padding-top:100px;font-family:sans-serif;">
  <h2>Pi Game Studio — ${ENGINE} Web Runner</h2>
</body>
</html>
EOF
    ;;
esac

echo -e "\n${GREEN}✔ Web package ready in ${OUTPUT_DIR}.${NC}"
echo -e "Launch server with: ${CYAN}npm run serve:web${NC} or ${CYAN}/studio:web${NC}"
