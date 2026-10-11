#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell — macOS double-click entry point.
#  A .command file opens in Terminal when you double-click it, which also
#  means you can read any error message instead of it vanishing silently.
# ─────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")" || exit 1
chmod +x ghostshell.sh 2>/dev/null
exec ./ghostshell.sh "$@"
