#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell relay launcher (Linux / macOS)
#
#  Starts the local fetch+rewrite relay and the in-site browser with it.
#  Node.js 18+ required, zero npm dependencies.
#
#  Usage:
#    ./relay.sh                    start on 127.0.0.1:8787
#    ./relay.sh --port=9000        pick another port
#    ./relay.sh --open             start and open the in-site browser
#    ./relay.sh --print            print the URL and command, don't start
#    ./relay.sh --help
#
#  The relay binds to 127.0.0.1 only. browser.html on the static Pages site
#  shows "relay not running" until this is up — that is expected.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SERVER="$ROOT/relay/server.js"

# ── node ─────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "relay.sh: Node.js 18+ is required but node was not found." >&2
  echo "           install it from https://nodejs.org (LTS is fine)" >&2
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [[ -z "$NODE_MAJOR" || "$NODE_MAJOR" -lt 18 ]]; then
  echo "relay.sh: Node.js 18+ is required, found $(node -v)." >&2
  exit 1
fi

[[ -f "$SERVER" ]] || { echo "relay.sh: missing $SERVER" >&2; exit 1; }

# ── --print: show what would run ─────────────────────────────────────────
PORT=8787
for arg in "$@"; do
  case "$arg" in
    --port=*) PORT="${arg#*=}" ;;
  esac
done

if [[ " $* " == *" --print "* ]]; then
  echo "node     $(node -v)"
  echo "server   $SERVER"
  echo "url      http://127.0.0.1:$PORT/browser.html"
  exit 0
fi

exec node "$SERVER" "$@"
