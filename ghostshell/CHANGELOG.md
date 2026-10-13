# Changelog

## 1.3.0 — in-site browser without the relay (web mode)

### In-site browser (`site/browser.html` + `site/browser.js`)

- Two transport modes, chosen automatically: **relay mode** when
  `127.0.0.1:8787` answers, **web mode** everywhere else (static GitHub Pages
  included). The “relay not running” overlay is gone; the relay is now an
  optional upgrade, not a prerequisite.
- Web mode fetches documents through a pool of CORS gateways, rewrites them in
  the browser (`<script>` / `on*` / meta-refresh stripped, every URL absolutised
  and re-pointed at the chosen gateway, `srcset` + CSS `url()` included) and
  renders the result into the sandboxed iframe via `srcdoc`
- The sandboxed document is opaque-origin (`allow-scripts` without
  `allow-same-origin`) and talks back through a tiny `postMessage` bridge, so
  link clicks and form submissions become real parent-frame navigations
- Gateway pool: built-in defaults + the public list in
  `site/proxy-sources.json`, persisted to `localStorage`, with
  add / test / use / remove, `Defaults`, `Fetch list` and `Clear`
- Live tests per gateway through the gateway itself: exit IP, country and ISP
  from ipwho.is / ipapi.co, proxy & hosting flags from ip-api.com (the same
  source the relay uses), timed and scored 0–100
- Country filter (ALL / US / GB / DE / IN …), **Random clean**, **Select best**,
  **New identity** and **New non-detected IP on every search / site**
  (`#chkRotateSearch`) all work without `relay.sh` — each rotated search leaves
  through a different gateway, i.e. a different exit IP
- Failure handling: a gateway that errors is scored down and the next one is
  tried (up to four), and only then does a single page fall back to a direct
  (unproxied) iframe load — with the selection left intact so the next request
  retries the pool
- Status pill reports `relay: online · vX`, `relay: web mode` or, before the
  first probe, `relay: checking…`; Retry no longer dead-ends on
  “still not running”

### Relay (`relay/server.js`)

- CORS headers on every response and a real `OPTIONS` preflight answer,
  including `Access-Control-Allow-Private-Network: true`, so an HTTPS page (the
  Pages build) is allowed to reach a relay on loopback. The listener is still
  bound to `127.0.0.1` and non-loopback peers are still destroyed on connect.

## 1.1.0 — GhostShell relay

### Relay (`relay/`)

- Local fetch+rewrite viewer + proxy pool API, Node 18+, zero dependencies
- Binds `127.0.0.1` only and refuses non-loopback peers
- Egress modes with auth: direct, HTTP `CONNECT`, HTTPS proxy, SOCKS4/4a
  (userid), SOCKS5 (RFC 1929 username/password)
- HTML rewriting: URLs absolutised against the final hop, `<base>` deleted,
  `srcset`/`imagesrcset`, CSS `url()`/`@import`, meta-refresh, form POSTs
  forwarded through the relay with an explicit `_target`
- CSP stripped (headers and meta), `X-Frame-Options` & friends dropped,
  `integrity`/`nonce`/`crossorigin` removed, `<script>`/`on*`/`javascript:`
  neutralised — a rendered page cannot beacon behind the relay's back
- SSRF guard on every target and redirect hop: loopback, private, CGNAT,
  link-local, metadata and multicast ranges blocked before connect, with a
  re-validating DNS lookup at socket time (rebinding-safe)
- Cookie jar per identity; `/api/identity` drops it and rotates the proxy

### Proxy pool (`relay/lib/pool.js`)

- Parse `socks5://user:pass@host:port`, `http://…`, `socks4://…`, bare
  `host:port`; dedupe, persist to `~/.ghostshell/proxy-pool.json`
- Test against `ip-api.com` (exit IP, ISP, datacenter/proxy flags), timed
- Score 0–100 from Laplace-smoothed reliability, speed, freshness and exit
  quality; select `best` (jittered top-3), `rotate` or `random`

### In-site browser (`site/browser.html` + `browser.js`)

- Search (DuckDuckGo lite) or direct URL, embedded sandboxed viewer
- Proxy manager UI: add / test / score / use / remove, browse direct
- “New identity” button; live relay pill and rewrite-stat readout
- On the static Pages site it shows “relay not running” — expected

### Launcher & tooling

- `--new-identity` (bash) / `-NewIdentity` (PowerShell): wipe the isolated
  profile and rotate a running relay's identity
- `tools/relay.sh` — relay launcher with `--port`, `--open`, `--print`
- `install.sh` now ships `relay/` + `site/` and tracks the default branch

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
