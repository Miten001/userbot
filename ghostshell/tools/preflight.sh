#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell pre-flight — "am I about to leak?"
#
#  Checks the four things that actually get people caught, before you open
#  the browser. Every check degrades gracefully if a tool is missing.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail

OS="$(uname -s)"
PASS=0; WARN=0; FAIL=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARN=$((WARN+1)); }
bad()  { printf '  \033[31mLEAK\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
info() { printf '  \033[90m····\033[0m  %s\n' "$1"; }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

have() { command -v "$1" >/dev/null 2>&1; }

echo "GhostShell pre-flight — $(date -u '+%Y-%m-%d %H:%M UTC')"

# ── 1. Tunnel / VPN interface ────────────────────────────────────────────
head "1. VPN tunnel"
TUNNEL=""
if [[ "$OS" == "Darwin" ]]; then
  TUNNEL="$(ifconfig 2>/dev/null | awk '/^(utun|ppp|ipsec|tun)[0-9]+:/ {sub(/:.*/,""); print; exit}')"
else
  TUNNEL="$(ip -o link show 2>/dev/null | awk -F': ' '/(tun[0-9]+|wg[0-9]+|ppp[0-9]+|tailscale[0-9]+|zt[0-9]+)/ {print $2; exit}')"
fi
if [[ -n "$TUNNEL" ]]; then
  ok "tunnel interface detected: $TUNNEL"
else
  warn "no tunnel interface found — you may be using a browser-level proxy (UDP will leak) or no VPN at all"
fi

# ── 2. DNS ───────────────────────────────────────────────────────────────
head "2. DNS resolver"
if [[ "$OS" == "Darwin" ]]; then
  DNS="$(scutil --dns 2>/dev/null | awk '/nameserver\[[0-9]+\]/ {print $3; exit}')"
else
  DNS="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf 2>/dev/null)"
fi
if [[ -z "$DNS" ]]; then
  info "could not read resolver"
elif [[ "$DNS" == "127.0.0.1" || "$DNS" == "::1" || "$DNS" =~ ^127\.0\.0\.[0-9]+$ || "$DNS" =~ ^(10|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\. ]]; then
  warn "resolver is $DNS — a LAN/loopback resolver usually forwards to your ISP and leaks every hostname you look up"
else
  ok "resolver is $DNS"
fi

# ── 3. IPv6 ──────────────────────────────────────────────────────────────
head "3. IPv6"
V6_GLOBAL=""
if [[ "$OS" == "Darwin" ]]; then
  V6_GLOBAL="$(ifconfig 2>/dev/null | awk '/inet6 / && !/fe80/ && !/::1/ {print $2; exit}')"
else
  V6_GLOBAL="$(ip -6 addr show scope global 2>/dev/null | awk '/inet6/ {print $2; exit}')"
fi
if [[ -z "$V6_GLOBAL" ]]; then
  ok "no global IPv6 address — nothing can bypass the tunnel over IPv6"
else
  warn "global IPv6 present ($V6_GLOBAL). Unless your VPN tunnels IPv6, this traffic exits un-tunnelled. GhostShell passes --disable-ipv6."
fi

# ── 4. Exit IP vs. what the world sees ───────────────────────────────────
head "4. Exit IP"
if have curl; then
  PUB="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  if [[ -n "$PUB" ]]; then
    ok "public IP: $PUB"
    META="$(curl -fsS --max-time 8 "https://ipapi.co/$PUB/json/" 2>/dev/null || true)"
    if [[ -n "$META" ]]; then
      COUNTRY="$(printf '%s' "$META" | grep -o '"country_name" *: *"[^"]*"' | head -1 | sed 's/.*: *"//; s/"//')"
      CITY="$(printf '%s' "$META" | grep -o '"city" *: *"[^"]*"' | head -1 | sed 's/.*: *"//; s/"//')"
      ASN="$(printf '%s' "$META" | grep -o '"org" *: *"[^"]*"' | head -1 | sed 's/.*: *"//; s/"//')"
      [[ -n "$CITY" || -n "$COUNTRY" ]] && info "geolocated to: ${CITY:-?}, ${COUNTRY:-?}"
      [[ -n "$ASN" ]] && info "network: $ASN"
      if printf '%s' "$ASN" | grep -qiE 'hosting|datacenter|data center|cloud|vps|leaseweb|digitalocean|hetzner|ovh|linode|vultr|aws|amazon|google|m247|frantech|psychz|quadranet|servermania|aeza|aeza'; then
        bad "this IP belongs to a hosting/cloud provider. No browser setting can hide that — commercial VPN/datacentre ranges are published in MaxMind, IPQualityScore and IP2Location, and every serious site checks them. Use a residential or mobile exit if the site is strict."
      fi
      SYSTZ="$(readlink -f /etc/localtime 2>/dev/null || echo '')"
      if [[ -n "$SYSTZ" && -n "$COUNTRY" ]]; then
        if printf '%s' "$SYSTZ" | grep -qi "$(printf '%s' "$COUNTRY" | tr ' ' '_')"; then
          ok "system timezone matches the exit country"
        else
          warn "system timezone is ${SYSTZ#*/zoneinfo/} but your IP geolocates to $COUNTRY. Set TIMEZONE in ghostshell.conf (or pick the country in the extension popup)."
        fi
      fi
    else
      info "geolocation lookup unavailable"
    fi
  else
    info "could not reach ipify.org (offline or blocked)"
  fi
else
  info "curl not installed — skipping exit-IP checks"
fi

# ── 5. Browser ───────────────────────────────────────────────────────────
head "5. Browser"
BIN="${CHROME_BIN:-}"
if [[ -z "$BIN" ]]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
    if command -v "$c" >/dev/null 2>&1; then BIN="$(command -v "$c")"; break; fi
  done
fi
if [[ -n "$BIN" ]]; then
  ok "found $(basename "$BIN")"
  VER="$("$BIN" --version 2>/dev/null || echo unknown)"
  info "$VER"
else
  warn "no Chromium browser on PATH — set CHROME_PATH in ghostshell.conf"
fi

# ── summary ──────────────────────────────────────────────────────────────
head "Summary"
printf '  %d passed, %d warnings, %d leaks\n\n' "$PASS" "$WARN" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  echo "  Fix the LEAK lines first — they are outside the browser's control."
fi
echo "  After launching, verify in the browser:"
echo "    https://browserleaks.com/webrtc      -> no local/public IP other than your VPN's"
echo "    https://dnsleaktest.com              -> only your VPN's DNS servers"
echo "    https://browserleaks.com/canvas      -> a hash that changes between sites"
echo
exit 0
