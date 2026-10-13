# GhostShell

Hardened Chromium launcher + anti-leak extension.

GhostShell exists because Chrome leaks information about you in two very different
places, and only one of them is reachable from an extension.

| Where | What leaks | Who fixes it |
|---|---|---|
| **The page** | timezone vs. IP mismatch, WebRTC candidates, canvas/audio GPU hashes, `navigator.webdriver`, device IDs | the **extension** |
| **The process** | QUIC over UDP, IPv6 outside the tunnel, the WebRTC ICE policy, Google background chatter | the **launcher** — Chrome exposes no API for these |

Run both and your browser stops contradicting your exit IP.

---

## Read this before anything else

**No browser can make a flagged IP address unflagged.**

Commercial VPN and hosting ranges are published in MaxMind, IPQualityScore and
IP2Location. Strict sites check every incoming connection against those databases
*on their server*, before your browser has rendered a pixel. Nothing you install
changes that lookup. If the site you care about is strict, the IP is the deciding
factor — use a residential or mobile exit.

What GhostShell fixes is the second, much larger category: the browser giving you
away *on top of* the IP. A Frankfurt exit IP with an `Asia/Kolkata` clock. A proxy
tunnel with WebRTC cheerfully publishing your real public IP. A Windows user-agent
sitting on a Retina screen at DPR 2. Those are entirely fixable, and they are what
actually catches most people.

---

## Install

```bash
curl -fsSL https://miten001.github.io/userbot/install.sh | bash
```

Then load the extension once:

1. `ghostshell` (or double-click `launch/ghostshell.command` on macOS, `GhostShell.bat` on Windows)
2. `chrome://extensions` → **Developer mode** → **Load unpacked** → pick the `extension/` folder
3. Click the shield icon and choose your exit country

Manual: download [`ghostshell.tar.gz`](https://miten001.github.io/userbot/ghostshell.tar.gz)
or just [`extension.zip`](https://miten001.github.io/userbot/extension.zip).

---

## What it does

### Launcher (`launch/`)

| Flag | Why |
|---|---|
| `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` | Stops STUN gathering your real public IP through the physical NIC |
| `--disable-quic` | QUIC is UDP; most proxies don't tunnel UDP, so Chrome silently reconnects direct |
| `--disable-ipv6` | Most VPNs tunnel IPv4 only — IPv6 walks straight past the tunnel |
| `--disable-blink-features=AutomationControlled` + `--exclude-switches=enable-automation` | Removes the automation flags that bot detectors read first |
| `TZ` + `--lang` | Makes the whole process agree with your exit country, not just the page |
| `--disable-features=OptimizationHints,…` | Turns off Google background chatter that correlates your profile |
| `--user-data-dir` | Isolated profile, so none of this touches your real Chrome |
| `--new-identity` / `-NewIdentity` | Wipes the isolated profile (fresh fingerprint seed) and tells a running relay to drop its cookies and rotate the proxy |

### Extension (`extension/`)

Runs in the main world at `document_start`, before any page script.

- **WebRTC** — strips ICE candidates that expose non-tunnel addresses; `block` mode disables it entirely
- **Location** — rewrites `Intl`, `Date`, `navigator.language`, `Accept-Language` and `navigator.geolocation` so all four agree with your exit country
- **Canvas / WebGL / audio** — deterministic per-site noise: stable within a session like a real browser, different across sites, because a value that changes on every read is itself a tell
- **Hardware** — CPU/RAM, screen, DPR, inner-vs-outer window geometry, all pulled from one coherent profile
- **Surfaces** — plugins, MIME types, media device IDs, battery, GPU string, permissions state, font list
- **Automation** — removes `navigator.webdriver` and every Puppeteer / Playwright / CDP marker on `window`

### Pre-flight (`tools/preflight.sh`)

```bash
ghostshell --check
```

Checks the tunnel interface, your DNS resolver, whether you have IPv6, what your
exit IP geolocates to, whether it's a hosting range, and whether your system
timezone matches — then tells you which third-party pages to verify in.

### Relay (`relay/`) + in-site browser (`site/browser.html`)

A local fetch+rewrite viewer with a scoring proxy manager. Node 18+, zero
npm dependencies, bound to `127.0.0.1` only.

```bash
./tools/relay.sh --open          # starts the relay, opens the browser UI
# → http://127.0.0.1:8787/browser.html
```

- **Search + viewer** — type a search or a URL; the relay fetches it (direct or
  through the pool), rewrites every URL (`<base>` deleted, `srcset`, CSS
  `url()`/`@import`, meta-refresh), strips CSP and active content, and renders
  it in a sandboxed frame. Forms POST through the relay so logins/searches work.
- **Proxy manager** — paste `socks5://user:pass@host:port`, `http://…`,
  `socks4://…` or bare `host:port` lines; the relay tests each one for real
  (latency, exit IP, datacenter or not) and scores it 0–100. Pick one
  explicitly or let *Select best* decide.
- **SSRF guard** — every target, including redirect hops and form POSTs, is
  resolved and checked against loopback/private/link-local/metadata ranges
  before a socket opens, and again at DNS time.
- **New identity** — one click (or `ghostshell.sh --new-identity`) drops the
  relay's cookie jar and rotates the proxy.

### Web mode — `browser.html` without the relay

On a static deployment (GitHub Pages) there is no local relay, so the browser
runs **web mode** instead of showing “relay not running”:

- pages are fetched through a pool of **CORS gateways** (any HTTPS URL
  containing `{url}`), rewritten in the browser — scripts and `on*` handlers
  stripped, every URL re-pointed at the chosen gateway — and rendered into the
  sandboxed iframe with `srcdoc`
- the pool is seeded with built-in gateways, merged with the public list in
  `site/proxy-sources.json`, and saved to `localStorage`
- **Test all** asks each gateway for its exit IP, country and ISP
  (ipwho.is / ipapi.co) and its proxy & hosting flags (ip-api.com)
- country filter, **Random clean**, **Select best** and **New non-detected IP on
  every search / site** all work — each search can leave through a different
  gateway, i.e. a different exit IP
- if a local relay appears, the page notices within 30 seconds and switches to
  it automatically; if every gateway fails, one page loads directly (unproxied)
  rather than dead-ending

The relay is still the real thing: only it can dial `socks5://` / `http://`
proxies, keep a cookie jar and enforce the SSRF guard. It now also answers the
CORS preflight with `Access-Control-Allow-Private-Network: true`, so an HTTPS
page (like the Pages build) is allowed to talk to a relay running on your
machine.

---

## Configuration

`launch/ghostshell.conf` (understood by both the bash and the PowerShell launcher):

```ini
CHROME_PATH=auto
PROFILE_DIR=~/.ghostshell/profile
TIMEZONE=Europe/Berlin       # must match your real exit country
LOCALE=de-DE
PROXY=                       # empty = use a system VPN (recommended)
DISABLE_QUIC=1
BLOCK_IPV6=1
WINDOW_SIZE=1440,900
```

If you set the exit country from the extension popup instead, leave `TIMEZONE`
and `LOCALE` empty so the two can't disagree.

---

## Layout

```
ghostshell/
├── launch/
│   ├── ghostshell.sh          Linux · also used by macOS
│   ├── ghostshell.command     macOS double-click entry
│   ├── GhostShell.ps1         Windows
│   ├── ghostshell.bat         Windows double-click entry
│   └── ghostshell.conf        shared config
├── extension/
│   ├── manifest.json          MV3
│   ├── src/inject-main.js     MAIN world — all the page-facing patches
│   ├── src/content.js         ISOLATED world — config bridge
│   ├── src/background.js      proxy, WebRTC policy, Accept-Language
│   ├── src/popup.js|options.js|ui-shared.js|styles.css
│   └── icons/
├── relay/
│   ├── server.js              fetch+rewrite viewer + pool API (127.0.0.1 only)
│   └── lib/net.js|rewrite.js|pool.js
├── tools/
│   ├── preflight.sh           leak pre-flight
│   ├── relay.sh               relay launcher (Node 18+)
│   └── make_icons.py          icon generator (stdlib only)
├── docs/
├── site/                      the GitHub Pages site + in-site browser
│   ├── index.html             landing page
│   ├── browser.html|browser.js  in-site browser (relay mode + built-in web mode)
│   ├── proxy-sources.json       public gateway list fetched by web mode
│   └── leak-test.html         self-test
└── install.sh
```

---

## Docs

- [`docs/DETECTION.md`](docs/DETECTION.md) — how VPN/proxy detection actually works, vector by vector
- [`docs/PROXY-AUTH.md`](docs/PROXY-AUTH.md) — authenticated proxies, and why Chrome can't store the password
- [`docs/HARDENING.md`](docs/HARDENING.md) — OS-level extras: DNS, IPv6, TCP stack fingerprinting

---

## Limitations, stated plainly

- **IP reputation is out of scope.** See the top of this file.
- **Behavioural analysis is out of scope.** Mouse paths, typing cadence, session timing. Heavy fingerprint randomisation can *increase* your score here, because unusual fingerprints get weighted.
- **Font detection is only partially covered.** `document.fonts.check` is handled; measurement-based enumeration still works.
- **TLS (JA3/JA4) is inherited.** You get Chrome's, which is the most common fingerprint on the web. That is the good outcome, not a bad one.
- **The TCP/IP stack fingerprint is OS-level.** Tunable on Linux, effectively fixed on Windows and macOS.
- **Windows timezone.** Chrome on Windows reads the OS clock for non-JS surfaces. The extension covers what web pages read; set the OS timezone too if you want full consistency.

---

## Responsible use

Hardening your own browser is ordinary privacy practice, and closing WebRTC and
DNS leaks is what any competent VPN setup guide tells you to do. Use it for
privacy, for research, and for testing systems you own.

Bypassing geo-restrictions usually breaches the terms of service of the site
involved. Using this for fraud, for evading enforcement, or to harm other people
is not what it is for, and no part of this project is designed to help with that.

MIT licensed. As-is, no warranty, and no guarantee of undetectability — see the
top of this file.
