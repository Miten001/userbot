# Authenticated proxies — and why Chrome can't remember the password

## The problem

You bought a residential proxy that looks like this:

```
host:  proxy.example.com
port:  8000
user:  myuser-cc-de
pass:  s3cr3t
```

You try:

```
--proxy-server=http://myuser-cc-de:s3cr3t@proxy.example.com:8000    # deprecated
--proxy-server=socks5://myuser-cc-de:s3cr3t@proxy.example.com:8000  # ignored
```

Chrome stripped userinfo from `--proxy-server` years ago (it was a credential-leak
vector — the credentials showed up in process listings, crash dumps and
`chrome://net-export`). It is silently discarded now.

The extension API is no help either:

```js
chrome.proxy.settings.set({ value: {
  mode: 'fixed_servers',
  rules: { singleProxy: { scheme: 'socks5', host: '…', port: 8000 } }
}});
```

There is **no `username` or `password` field**. This is a deliberate upstream design
decision in Chromium, not an oversight, and it is not going to change.

## What actually happens

Chrome gets a `407 Proxy Authentication Required`, shows a modal login dialog, and
caches the credentials for the session. It works — it is just not silent, and it
re-prompts when the service worker restarts or Chrome restarts.

## The fix: move the authentication to localhost

Terminate the authenticated connection in a local process, and point GhostShell at
`127.0.0.1`. Chrome sees an unauthenticated proxy; the local process handles auth.

### Option A — SSH dynamic tunnel (SOCKS5, encrypted, no extra software)

```bash
ssh -N -D 127.0.0.1:1080 user@your-exit-server
```

Then:

```ini
PROXY=socks5://127.0.0.1:1080
```

Add `-o ServerAliveInterval=60` and run it under a supervisor if you want it to
survive a dropped connection. This is the cleanest option when you control the
exit server.

### Option B — your VPN client's local proxy port

Most commercial VPN clients expose one:

| Client | Where |
|---|---|
| Mullvad | SOCKS5 on `10.64.0.1:1080` while connected |
| NordVPN | Settings → Connection → Proxy (per-country) |
| Proton VPN | Settings → Connection → Port forwarding / SOCKS |
| Surfshark | Settings → Advanced → Proxy (per-country) |

Prefer this over a third-party proxy: it's the same exit IP, already authenticated,
with no extra hop.

### Option C — `gost`, when you need to chain

[gost](https://github.com/go-gost/gost) is a single static binary that terminates
authenticated upstreams and re-serves them locally.

```bash
# Local unauthenticated SOCKS5 → authenticated upstream SOCKS5
gost -L socks5://:1080 -F socks5://myuser-cc-de:s3cr3t@proxy.example.com:8000

# Local unauthenticated HTTP → authenticated upstream HTTP
gost -L http://:8080 -F http://myuser-cc-de:s3cr3t@proxy.example.com:8000
```

### Option D — `privoxy`, if you need HTTP→SOCKS translation

```conf
# /etc/privoxy/config
forward-socks5t / 127.0.0.1:1080 .
listen-address 127.0.0.1:8118
```

---

## Still UDP-blind

All of the above proxy **TCP only**. SOCKS5's UDP ASSOCIATE exists but Chrome does
not use it for QUIC or WebRTC. So:

- Keep `DISABLE_QUIC=1` (the default)
- Keep `BLOCK_IPV6=1` (the default)
- Keep the strict WebRTC policy (the default)

Or stop fighting it and use a system VPN, which tunnels UDP properly and makes the
entire problem disappear.

---

## Verifying

```bash
ghostshell --check
curl -x socks5h://127.0.0.1:1080 https://api.ipify.org    # should print your exit IP
```

Note the `h` in `socks5h` — it forces hostname resolution through the proxy, which
is what Chrome does for SOCKS5 too. Plain `socks5://` resolves locally and your
local resolver sees everything.

Inside the browser: <https://browserleaks.com/webrtc> should show nothing but your
proxy's exit address, and <https://ipleak.net> should show no IPv6.
