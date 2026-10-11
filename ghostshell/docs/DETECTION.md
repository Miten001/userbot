# How VPN / proxy detection actually works

Every check falls into one of three buckets. Only the third is worth arguing with.

---

## Bucket 1 — the server already knows (nothing you install can change this)

This happens from your **IP address**, before your browser sends a byte.

| Check | How it works |
|---|---|
| **IP reputation databases** | MaxMind `GeoIP2 Insights`, IPQualityScore, IP2Location, Neustar, Digital Element. Each returns a probability that the address is a VPN / proxy / TOR exit / hosting range. |
| **ASN lookup** | The autonomous system owner is public. `AS14061 DigitalOcean` is not a home ISP. |
| **Datacentre range lists** | Published and freely downloadable. Many sites maintain their own. |
| **Reverse DNS** | `1.2.3.4.static.hostwindsdns.com` is not subtle. |
| **Port / protocol reputation** | An IP that has opened thousands of connections to one site in an hour behaves like a proxy. |
| **Cross-account correlation** | Your IP today was someone else's yesterday. Shared-exit VPNs leak this constantly. |

**The only fix is a different IP**: residential or mobile. Everything else in this
repository is downstream of this decision.

### How to check where you stand

```bash
curl -s https://ipapi.co/json/ | python3 -m json.tool | grep -Ei 'org|asn|country|city'
curl -s "https://scamalytics.com/ip/$(curl -s https://api.ipify.org)"   # fraud-score style report
```

If `org` reads like a hosting company, that is the problem to solve first.

---

## Bucket 2 — the browser contradicts itself (entirely fixable)

These are the ones that actually catch people, because they are loud and cheap to check.

### 2.1 WebRTC ICE candidates — the classic

A page creates an `RTCPeerConnection`, points it at a STUN server, and reads back
every network interface your machine has.

```js
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
pc.createDataChannel('x');
pc.onicecandidate = e => e.candidate && fetch('/leak?ip=' + e.candidate.candidate);
pc.createOffer().then(o => pc.setLocalDescription(o));
```

Behind a **system VPN** this is mostly safe, because the tunnel is the only route.
Behind a **browser-level proxy** it is catastrophic: the proxy only carries TCP, so
Chrome gathers candidates on the physical NIC and hands the page your real public IP.

Chrome obfuscates local addresses with mDNS (`.local`) by default, which hides
`192.168.x.x` — but **not** the server-reflexive (public) candidate.

> **Fix:** `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` at launch, plus
> candidate filtering in the extension, plus `disable_non_proxied_udp` set through
> `chrome.privacy.network.webRTCIPHandling`.

### 2.2 Timezone vs. IP — the loudest one

```js
Intl.DateTimeFormat().resolvedOptions().timeZone   // "Asia/Kolkata"
new Date().getTimezoneOffset()                     // -330
new Date().toString()                              // "…GMT+0530 (India Standard Time)"
```

Your IP geolocates to Frankfurt. Your clock says Mumbai. That is a contradiction
no legitimate user produces, and it takes one line of JS to read.

> **Fix:** set `TIMEZONE`/`LOCALE` in `ghostshell.conf`, or pick the exit country in
> the popup. GhostShell patches `Intl.DateTimeFormat`, `Date.prototype.getTimezoneOffset`,
> `Date.prototype.toString`, the `toLocale*` family and `Accept-Language` together,
> because fixing only one of them creates a *different* contradiction.

### 2.3 Locale and `Accept-Language`

`navigator.language`, `navigator.languages` and the `Accept-Language` header come from
three different places in Chrome and are frequently inconsistent. A page that sends
`Accept-Language: en-US,en` while `navigator.language === 'de-DE'` is suspicious.

### 2.4 Geolocation vs. IP

The permission prompt is the only thing standing between a page and your GPS (on
mobile) or your Wi-Fi-derived position (on desktop). Grant it and it must match
where your IP says you are.

### 2.5 QUIC / HTTP3

QUIC runs over UDP. A TCP proxy does not carry UDP, so Chrome opens a direct
QUIC connection and your real IP appears in the server logs while your TCP traffic
goes through the tunnel. **Half-leaked, which is worse than fully leaked**: it
produces two different source addresses for one session.

> **Fix:** `--disable-quic`.

### 2.6 IPv6

Most VPNs tunnel IPv4 only. If you have a global IPv6 address, Chrome prefers it
(per RFC 6724) and your IPv6 traffic never enters the tunnel.

> **Fix:** `--disable-ipv6`, or use a VPN that tunnels IPv6.

### 2.7 DNS

With a system VPN, resolution goes through the tunnel. With a browser proxy, or with
a LAN resolver that forwards to your ISP, every hostname you look up is visible.
Chrome's Secure DNS (DoH) is a *separate* path that can bypass both.

> **Fix:** use a real VPN; run `ghostshell --check` to catch the cases where you aren't.

### 2.8 Automation markers

```js
navigator.webdriver === true
window.cdc_adoQpoasnfa76pfcZLmcfl_Array   // ChromeDriver
window.__playwright                        // Playwright
window.domAutomationController             // CDP
```

Any real Chrome has none of these. One hit and your score is zero.

### 2.9 Internal contradictions

- Windows UA, `navigator.platform === 'Linux x86_64'`
- macOS UA at `devicePixelRatio === 1`
- 1920×1080 screen with `window.outerHeight === 0` (headless)
- `navigator.plugins.length === 0` (no PDF viewer — no real Chrome does this)
- `hardwareConcurrency: 128` (a server CPU reported from a "laptop")
- `navigator.connection.rtt === 0` (datacentre latency)

Each is invisible alone and obvious together. This is why GhostShell drives every
value from **one profile** rather than letting you set them one at a time.

---

## Bucket 3 — statistical fingerprinting (mitigated, never eliminated)

### Canvas / WebGL / audio

The page draws something and hashes the pixels. Your GPU, driver and font
configuration produce a value that is stable for you and different for almost
everyone else.

The naive defence — return a *fixed* fake value — is worse than nothing: thousands
of users then share one hash, which is trivially clustered. The naive defence after
that — return `Math.random()` every read — is also detected instantly, because a real
browser returns identical bytes on repeated reads.

GhostShell's approach: seed from `origin + sessionSalt`. Identical within a session,
different across sites. You look like a distinct real user to each site.

### TLS (JA3 / JA4)

The TLS `ClientHello` — cipher order, extensions, ALPN — fingerprints your TLS stack.
You inherit Chrome's. Chrome's is the most common fingerprint on the web, so this is
the best available outcome. A custom TLS stack would make you *more* unusual.

### TCP/IP stack (p0f)

TTL, initial window size, TCP options ordering and timestamps identify the OS:

| OS | Initial TTL |
|---|---|
| Linux | 64 |
| macOS / BSD | 64 |
| Windows | 128 |

A "Windows" UA arriving on packets with TTL 64 does not match. See
[`HARDENING.md`](HARDENING.md) for the Linux-side `sysctl` fix.

### Fonts

`document.fonts.check()` and canvas text measurement both enumerate fonts. GhostShell
covers the first; measurement is left alone because perturbing it breaks layout.

### Behavioural

Mouse paths, typing cadence, scroll velocity, time-on-page, click timing. No browser
solves this, and aggressive fingerprint randomisation tends to make it *worse*,
because unusual configurations get weighted more heavily.

---

## Where the effort actually pays off

1. **Get a clean exit IP.** Nothing else comes close.
2. **Close the UDP leaks** — WebRTC, QUIC, IPv6. Cheap, common, fatal.
3. **Make the location consistent** — timezone, locale, geolocation, `Accept-Language`.
4. **Remove the automation markers.** One line of JS, instant zero.
5. **Stop internal contradictions** — drive every value from one profile.
6. *Then* worry about canvas noise.

Most guides start at step 6. That is why they don't work.
