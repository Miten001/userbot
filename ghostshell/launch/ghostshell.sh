#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell — hardened Chromium launcher (Linux / macOS)
#
#  Chrome leaks in ways an extension literally cannot reach: QUIC over UDP,
#  IPv6 outside the tunnel, the WebRTC ICE policy, and process-level DNS
#  behaviour. Those are flags, not APIs. This script applies them and runs
#  Chrome in an isolated profile.
#
#  Usage:
#    ./ghostshell.sh                       launch
#    ./ghostshell.sh --proxy=socks5://127.0.0.1:1080
#    ./ghostshell.sh --tz=Europe/Berlin --locale=de-DE
#    ./ghostshell.sh --print               print the flags, don't launch
#    ./ghostshell.sh --check               run the leak pre-flight
#    ./ghostshell.sh --help
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

# A CHROME_PATH already exported in the environment wins over ghostshell.conf.
ENV_CHROME_PATH="${CHROME_PATH:-}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
CONF="$HERE/ghostshell.conf"
OS="$(uname -s)"

# ── defaults ─────────────────────────────────────────────────────────────
CHROME_PATH=auto
PROFILE_DIR="$HOME/.ghostshell/profile"
TIMEZONE=""
LOCALE=""
PROXY=""
PROXY_BYPASS="localhost;127.0.0.1;[::1]"
DISABLE_QUIC=1
BLOCK_IPV6=1
DISABLE_SAFE_BROWSING=0
WINDOW_SIZE="1440,900"
EXTRA_FLAGS=""

# ── load config (shell-safe subset: KEY=value, # comments) ───────────────
if [[ -f "$CONF" ]]; then
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    key="$(echo "$key" | tr -d '[:space:]')"
    [[ -z "$key" || "$key" == \#* ]] && continue
    value="${value%%#*}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value%\"}"; value="${value#\"}"
    case "$key" in
      CHROME_PATH|PROFILE_DIR|TIMEZONE|LOCALE|PROXY|PROXY_BYPASS|WINDOW_SIZE|EXTRA_FLAGS|\
      DISABLE_QUIC|BLOCK_IPV6|DISABLE_SAFE_BROWSING) printf -v "$key" '%s' "$value" ;;
    esac
  done < "$CONF"
fi

[[ -n "$ENV_CHROME_PATH" ]] && CHROME_PATH="$ENV_CHROME_PATH"

# ── CLI overrides ────────────────────────────────────────────────────────
PRINT_ONLY=0
DO_CHECK=0
OPEN_URL=""
for arg in "$@"; do
  case "$arg" in
    --help|-h)      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --print)        PRINT_ONLY=1 ;;
    --check)        DO_CHECK=1 ;;
    --proxy=*)      PROXY="${arg#*=}" ;;
    --tz=*)         TIMEZONE="${arg#*=}" ;;
    --locale=*)     LOCALE="${arg#*=}" ;;
    --profile=*)    PROFILE_DIR="${arg#*=}" ;;
    --chrome=*)     CHROME_PATH="${arg#*=}" ;;
    --incognito)    EXTRA_FLAGS="$EXTRA_FLAGS --incognito" ;;
    -*)             EXTRA_FLAGS="$EXTRA_FLAGS $arg" ;;
    *)              OPEN_URL="$arg" ;;
  esac
done

# ── pre-flight leak check (runs before we insist on a browser) ───────────
if [[ "$DO_CHECK" == "1" ]]; then
  exec bash "$ROOT/tools/preflight.sh"
fi

# ── locate the browser ───────────────────────────────────────────────────
find_chrome() {
  if [[ -n "${CHROME_BIN:-}" && -x "${CHROME_BIN}" ]]; then echo "$CHROME_BIN"; return 0; fi
  if [[ "$CHROME_PATH" != "auto" ]]; then
    [[ -x "$CHROME_PATH" ]] && { echo "$CHROME_PATH"; return 0; }
    echo "ghostshell: CHROME_PATH is set but not executable: $CHROME_PATH" >&2
    return 1
  fi
  local candidates=()
  if [[ "$OS" == "Darwin" ]]; then
    candidates=(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    )
  else
    candidates=(
      /usr/bin/google-chrome /usr/bin/google-chrome-stable
      /usr/bin/chromium /usr/bin/chromium-browser
      /usr/bin/brave-browser /usr/bin/microsoft-edge
      /snap/bin/chromium /opt/google/chrome/chrome
      /usr/bin/thorium-browser /usr/bin/ungoogled-chromium
    )
  fi
  local c
  for c in "${candidates[@]}"; do [[ -x "$c" ]] && { echo "$c"; return 0; }; done
  if command -v google-chrome    >/dev/null 2>&1; then command -v google-chrome; return 0; fi
  if command -v chromium         >/dev/null 2>&1; then command -v chromium;      return 0; fi
  if command -v chromium-browser >/dev/null 2>&1; then command -v chromium-browser; return 0; fi
  return 1
}

CHROME="$(find_chrome)" || {
  echo "ghostshell: could not find a Chromium-based browser." >&2
  echo "            Install Google Chrome, or set CHROME_PATH in $CONF" >&2
  exit 1
}

# ── profile ──────────────────────────────────────────────────────────────
PROFILE_DIR="${PROFILE_DIR/#\~/$HOME}"
mkdir -p "$PROFILE_DIR"

# Chrome's own "first run" state decides the profile locale, so seed it once
# for a fresh profile. Without this, --lang silently does nothing.
if [[ ! -f "$PROFILE_DIR/First Run" && ! -d "$PROFILE_DIR/Default" ]]; then
  : > "$PROFILE_DIR/First Run"
fi

# ── build the flag list ──────────────────────────────────────────────────
FLAGS=(
  "--user-data-dir=$PROFILE_DIR"
  --no-first-run
  --no-default-browser-check
  --no-pings
  --disable-sync
  --disable-breakpad
  --disable-component-update
  --disable-background-networking
  --disable-domain-reliability
  --disable-client-side-phishing-detection
  --metrics-recording-only
  --disable-blink-features=AutomationControlled
  --exclude-switches=enable-automation
  --force-color-profile=srgb
  "--window-size=$WINDOW_SIZE"
)

# WebRTC: never let ICE gather candidates on an interface that isn't the
# tunnel. Without this, one RTCPeerConnection publishes your real public IP.
FLAGS+=( --force-webrtc-ip-handling-policy=disable_non_proxied_udp )

FEATURES_DISABLE=(
  OptimizationHints
  OptimizationHintsFetching
  OptimizationTargetPrediction
  OptimizationGuidePushNotification
  MediaRouter
  Translate
  AutofillServerCommunication
  NetworkTimeServiceQuerying
  InterestFeedContentSuggestions
  CalculateNativeWinOcclusion
  PrivacySandboxSettings4
  FirstPartySets
  StorageAccessAPI
  AsyncDns
  DirectSockets
  WebBluetooth
  IdleDetection
  DigitalGoodsApi
  FedCm
  AcceptCHFrame
)
FEATURES_ENABLE=(
  WebRtcHideLocalIpsWithMdns
)

[[ "$DISABLE_QUIC" == "1" ]] && FLAGS+=( --disable-quic )
[[ "$BLOCK_IPV6"  == "1" ]] && FLAGS+=( --disable-ipv6 )
if [[ "$DISABLE_SAFE_BROWSING" == "1" ]]; then
  FLAGS+=( --disable-features=SafeBrowsing --safebrowsing-disable-auto-update )
fi

FLAGS+=( "--disable-features=$(IFS=,; echo "${FEATURES_DISABLE[*]}")" )
FLAGS+=( "--enable-features=$(IFS=,; echo "${FEATURES_ENABLE[*]}")" )

[[ -n "$LOCALE" ]] && FLAGS+=( "--lang=$LOCALE" )

if [[ -n "$PROXY" ]]; then
  FLAGS+=( "--proxy-server=$PROXY" )
  [[ -n "$PROXY_BYPASS" ]] && FLAGS+=( "--proxy-bypass-list=$PROXY_BYPASS" )
fi

if [[ "$OS" == "Linux" ]]; then
  FLAGS+=( --disable-dev-shm-usage )
fi

# shellcheck disable=SC2206
FLAGS+=( $EXTRA_FLAGS )

# ── TZ: the browser inherits it, and the extension's "real" mode reads it ──
if [[ -n "$TIMEZONE" ]]; then
  if [[ "$OS" == "Darwin" ]]; then
    export TZ="$TIMEZONE"
  else
    if [[ -f "/usr/share/zoneinfo/$TIMEZONE" ]]; then
      export TZ="$TIMEZONE"
    else
      echo "ghostshell: warning — no /usr/share/zoneinfo/$TIMEZONE; ignoring TIMEZONE" >&2
    fi
  fi
fi

# ── run ──────────────────────────────────────────────────────────────────
if [[ "$PRINT_ONLY" == "1" ]]; then
  echo "TZ=${TZ:-<system>}"
  echo "$CHROME"
  printf '  %s\n' "${FLAGS[@]}"
  [[ -n "$OPEN_URL" ]] && echo "  $OPEN_URL"
  exit 0
fi

echo "ghostshell  ·  $(basename "$CHROME")"
echo "  profile   $PROFILE_DIR"
[[ -n "$PROXY" ]] && echo "  proxy     $PROXY" || echo "  proxy     system (VPN)"
[[ -n "$TIMEZONE" ]] && echo "  timezone  $TIMEZONE"
[[ -n "$LOCALE" ]] && echo "  locale    $LOCALE"
echo

if [[ "$OS" == "Darwin" ]]; then
  open -na "$CHROME" --args "${FLAGS[@]}" ${OPEN_URL:+$OPEN_URL}
else
  nohup "$CHROME" "${FLAGS[@]}" ${OPEN_URL:+$OPEN_URL} >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi
