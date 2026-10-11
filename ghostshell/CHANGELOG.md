# Changelog

## 1.0.0 — initial release

### Launcher

- Chromium launcher for Linux, macOS and Windows sharing one config format
- `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`
- `--disable-quic` and `--disable-ipv6` as first-class, configurable switches
- `--disable-blink-features=AutomationControlled` and `--exclude-switches=enable-automation`
- Process-level `TZ` and `--lang` so the browser agrees with the exit country
- Google background chatter off: optimization hints, component update, domain
  reliability, metrics recording, network time service
- `MediaRouter`, `WebBluetooth`, `IdleDetection`, `DirectSockets` and
  `FedCm` disabled — they enumerate your LAN and your accounts
- Isolated `--user-data-dir`, with first-run seeding so `--lang` actually applies
- `--check` runs the leak pre-flight before you open a page

### Extension (MV3)

- Main-world injection at `document_start`, before any page script
- WebRTC: local/public ICE candidate filtering, plus a `block` mode
- Timezone: `Intl.DateTimeFormat`, `Date.prototype.getTimezoneOffset`,
  `Date.prototype.toString`, the `toLocale*` family
- Locale: `navigator.language(s)` plus an `Accept-Language` rule via
  `declarativeNetRequest`
- Geolocation: spoof to exit-matched coordinates with stable jitter, or block
- Canvas / WebGL / audio: deterministic per-origin noise — stable within a
  session, different across sites
- Consistent device profiles (UA + client hints + platform + screen + CPU/RAM + GPU)
- Plugins, MIME types, media device IDs, battery, connection, permissions state
- `navigator.webdriver` and Puppeteer / Playwright / CDP marker removal
- 39 exit-country presets that set timezone, locale, languages and GPS together

### Tooling

- `tools/preflight.sh` — tunnel, DNS, IPv6, exit IP, hosting-range detection
- `tools/make_icons.py` — icon generation, standard library only
- `site/leak-test.html` — in-browser self-test with a live ICE capture

### Docs

- `docs/DETECTION.md` — every detection vector, bucketed by whether you can fix it
- `docs/HARDENING.md` — DNS, IPv6, TCP stack fingerprinting, LAN discovery
- `docs/PROXY-AUTH.md` — why Chrome can't store a proxy password, and the four
  workarounds
