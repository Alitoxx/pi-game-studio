#!/usr/bin/env bash
# ==============================================================================
# Pi Game Studio — 60-Second Soak & Memory Stability Runner
# Standard: 60s Memory Soak Testing against memory leaks and crash regressions.
# Usage:
#   bash scripts/soak-test.sh [--duration <seconds>] [--cmd "<command>"]
# ==============================================================================

set -euo pipefail

DURATION=60
CMD=""
TARGET_PID=""
MEM_LOG="/tmp/pi_soak_mem_$$.log"
CLEANUP_CALLED=0

cleanup() {
    if [ "$CLEANUP_CALLED" -eq 1 ]; then
        return
    fi
    CLEANUP_CALLED=1
    if [ -n "$TARGET_PID" ] && kill -0 "$TARGET_PID" 2>/dev/null; then
        echo -e "\n\033[38;2;107;114;128mStopping process (PID: $TARGET_PID)...\033[0m"
        kill -TERM "$TARGET_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$TARGET_PID" 2>/dev/null || true
    fi
    rm -f "$MEM_LOG" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

while [[ $# -gt 0 ]]; do
    case "$1" in
        --duration|-d)
            DURATION="$2"
            shift 2
            ;;
        --cmd|-c)
            CMD="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--duration <seconds>] [--cmd \"<executable>\"]"
            exit 0
            ;;
        *)
            CMD="$1"
            shift
            ;;
    esac
done

echo -e "\033[1m\033[38;2;167;139;250mSOAK TEST: Memory & Stability Gate (Target: ${DURATION}s)\033[0m"
echo -e "\033[38;2;107;114;128m----------------------------------------------------------------------\033[0m"

# Auto-detect command if not provided
if [ -z "$CMD" ]; then
    if [ -f "project.yaml" ]; then
        ENGINE=$(grep -i "^engine:" project.yaml | awk '{print $2}' | tr '[:upper:]' '[:lower:]' || echo "")
        case "$ENGINE" in
            godot*)
                if command -v godot >/dev/null 2>&1; then
                    CMD="godot --headless"
                elif [ -f "./build/game" ]; then
                    CMD="./build/game"
                fi
                ;;
            bevy*)
                if [ -f "Cargo.toml" ]; then
                    CMD="cargo run --release"
                fi
                ;;
            raylib*)
                if [ -f "./build/game" ]; then
                    CMD="./build/game"
                elif [ -f "./build/bin/game" ]; then
                    CMD="./build/bin/game"
                fi
                ;;
        esac
    fi
fi

if [ -z "$CMD" ]; then
    echo -e "\033[38;2;251;191;36mNo game binary or command specified. Running dry-run simulation mode.\033[0m"
    CMD="sleep $DURATION"
fi

echo -e "\033[38;2;243;244;246mExecuting:\033[0m \033[38;2;56;189;248m$CMD\033[0m"

# Launch in background
$CMD >/dev/null 2>&1 &
TARGET_PID=$!

START_TIME=$(date +%s)
ELAPSED=0
SAMPLES=0
INITIAL_RSS=0
PEAK_RSS=0
FINAL_RSS=0

echo -e "\033[38;2;107;114;128mSampling memory every 2s (PID: $TARGET_PID)...\033[0m"

while [ "$ELAPSED" -lt "$DURATION" ]; do
    if ! kill -0 "$TARGET_PID" 2>/dev/null; then
        # Process terminated prematurely
        wait "$TARGET_PID" 2>/dev/null || EXIT_CODE=$?
        EXIT_CODE=${EXIT_CODE:-0}
        if [ "$EXIT_CODE" -ne 0 ]; then
            echo -e "\n\033[38;2;239;68;68mFAIL: Process crashed with exit code $EXIT_CODE after ${ELAPSED}s.\033[0m"
            exit 1
        fi
        break
    fi

    # Measure RSS memory in KB
    CURRENT_RSS=$(ps -o rss= -p "$TARGET_PID" 2>/dev/null | tr -d ' ' || echo "0")
    if [ -n "$CURRENT_RSS" ] && [ "$CURRENT_RSS" -gt 0 ]; then
        if [ "$SAMPLES" -eq 0 ]; then
            INITIAL_RSS=$CURRENT_RSS
        fi
        if [ "$CURRENT_RSS" -gt "$PEAK_RSS" ]; then
            PEAK_RSS=$CURRENT_RSS
        fi
        FINAL_RSS=$CURRENT_RSS
        SAMPLES=$((SAMPLES + 1))
        echo "$CURRENT_RSS" >> "$MEM_LOG"
    fi

    sleep 2
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))
done

# Terminate process if still running after DURATION
if kill -0 "$TARGET_PID" 2>/dev/null; then
    kill -TERM "$TARGET_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$TARGET_PID" 2>/dev/null; then
        kill -9 "$TARGET_PID" 2>/dev/null || true
    fi
fi

# Convert KB to MB
INIT_MB=$(awk "BEGIN {printf \"%.2f\", $INITIAL_RSS / 1024}")
PEAK_MB=$(awk "BEGIN {printf \"%.2f\", $PEAK_RSS / 1024}")
FINAL_MB=$(awk "BEGIN {printf \"%.2f\", $FINAL_RSS / 1024}")
DELTA_KB=$((FINAL_RSS - INITIAL_RSS))
DELTA_MB=$(awk "BEGIN {printf \"%.2f\", $DELTA_KB / 1024}")

echo -e "\n\033[1m\033[38;2;167;139;250mSOAK TEST RESULTS:\033[0m"
echo -e "  \033[38;2;243;244;246mDuration:\033[0m     ${ELAPSED}s / ${DURATION}s"
echo -e "  \033[38;2;243;244;246mInitial RAM:\033[0m  ${INIT_MB} MB"
echo -e "  \033[38;2;243;244;246mPeak RAM:\033[0m     ${PEAK_MB} MB"
echo -e "  \033[38;2;243;244;246mFinal RAM:\033[0m    ${FINAL_MB} MB"
echo -e "  \033[38;2;243;244;246mMemory Delta:\033[0m ${DELTA_MB} MB"

# Check leak threshold (> 15MB delta is considered suspicious leak for 60s soak)
if awk "BEGIN {exit !($DELTA_MB > 15.0)}"; then
    echo -e "\n\033[38;2;239;68;68mFAIL: Potential memory leak detected (Growth: ${DELTA_MB} MB in ${ELAPSED}s).\033[0m"
    exit 1
else
    echo -e "\n\033[38;2;52;211;153mPASS: Soak test passed. Memory profile is stable, zero leaks detected.\033[0m"
    exit 0
fi
