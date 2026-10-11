# HARDENING.md — everything outside the browser

GhostShell controls the browser. These are the OS-level leaks it cannot reach.
None of them are required; all of them matter if the site you care about is strict.

---

## 1. DNS

### The leak

Your resolver can see every hostname you look up, even when the traffic itself is
tunnelled. A LAN resolver (`192.168.1.1`) forwards to your ISP, so your ISP gets a
complete list.

### Check

```bash
# Linux
resolvectl status | grep -i 'current dns'
# macOS
scutil --dns | grep 'nameserver\['
# any OS — the authoritative test
open https://dnsleaktest.com     # use the Extended test
```

### Fix

The clean fix is a VPN that installs its own resolver (WireGuard with `DNS =` in the
config, or OpenVPN with `dhcp-option DNS`). Verify afterwards — a surprising number of
VPN clients leave the resolver pointing at your ISP.

Linux with systemd-resolved, pinning DNS to the tunnel:

```bash
sudo resolvectl dns wg0 10.64.0.1
sudo resolvectl default-route wg0 yes
sudo resolvectl domain wg0 '~.'
```

macOS:

```bash
sudo dscacheutil -flushcache
networksetup -listallnetworkservices
sudo networksetup -setdnsservers Wi-Fi 10.64.0.1
```

---

## 2. IPv6

### The leak

Most VPNs route `0.0.0.0/0` and nothing else. Your global IPv6 address keeps its
default route, and Chrome prefers IPv6 when both exist (RFC 6724).

### Check

```bash
ip -6 addr show scope global          # Linux
ifconfig | grep inet6                 # macOS — ignore fe80:: (link-local)
curl -6 https://ipv6.icanhazip.com    # if this prints anything, you have IPv6
```

### Fix

Best: a VPN that tunnels IPv6 too (or a `::/0` route in the WireGuard config).
Otherwise, GhostShell's `--disable-ipv6` handles Chrome, and for the rest of the
system:

```bash
# Linux — runtime
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1

# Linux — persistent
echo 'net.ipv6.conf.all.disable_ipv6 = 1' | sudo tee -a /etc/sysctl.d/99-no-ipv6.conf

# macOS
networksetup -setv6off Wi-Fi
```

---

## 3. TCP/IP stack fingerprint (p0f)

### The leak

The kernel's TCP behaviour identifies the OS, independently of your user agent.
Observed passively, from the very first packet:

| Field | Linux | Windows | macOS |
|---|---|---|---|
| Initial TTL | 64 | 128 | 64 |
| Initial window | 64240 | 65535 | 65535 |
| TCP options order | mss,sackTS,ws,nop,nop | mss,nop,ws,nop,nop,sackOK | mss,nop,ws,nop,nop,sackOK |
| Timestamp | yes | yes | yes |

A "Windows/Chrome" user-agent arriving on packets with TTL 64 does not match.

### Linux

```bash
# Make a Linux box look like Windows to p0f (TTL 128)
sudo sysctl -w net.ipv4.ip_default_ttl=128

# Persistent
echo 'net.ipv4.ip_default_ttl = 128' | sudo tee -a /etc/sysctl.d/99-ttl.conf
```

Changing the initial window size and the TCP option ordering requires a kernel
patch or an eBPF/nftables mangle rule — realistically out of scope. TTL is the
field nearly every passive checker reads.

### macOS / Windows

Not tunable without kernel extensions. Either accept the mismatch or make your
*browser profile* match your *real OS* — which is what GhostShell's `real` profile
does, and why it's the default.

> **Design note:** this is exactly why GhostShell defaults to `profile = real`.
> Spoofing a Windows UA from Linux fixes the JS layer and breaks the network layer.
> Know which one your adversary actually reads.

---

## 4. Local network discovery

### The leak

Your WAN IP is hidden, but your LAN is still enumerable: mDNS (`_services._dns-sd._udp.local`),
NetBIOS, SSDP/UPnP, and Chrome's MediaRouter. A page that finds `Living Room TV`
and your printer knows a lot about you even behind a VPN.

### Fix

- GhostShell disables `MediaRouter` and `WebBluetooth` at launch
- Guest-network or VLAN the machine you browse from
- Disable mDNS responder if you don't use AirPrint / AirPlay / Chromecast

```bash
# Linux — stop avahi
sudo systemctl disable --now avahi-daemon
# macOS — will break AirDrop and AirPlay
sudo launchctl unload -w /System/Library/LaunchDaemons/com.apple.mDNSResponder.plist
```

---

## 5. Browser-level chatter

Chrome talks to Google whether you ask it to or not:

| Service | What it sends |
|---|---|
| Optimization Guide | URLs you visit, for prediction hints |
| Component Updater | Your Chrome version and channel |
| Domain Reliability | Which domains failed and how |
| Safe Browsing | Hashes of URLs you visit |
| Variations / field trials | Your experiment cohort — a real fingerprint |
| Network Time Service | Query timing, outside the tunnel |

GhostShell disables the first four by default and leaves Safe Browsing on, because
losing phishing protection is a bad trade for most people. Set
`DISABLE_SAFE_BROWSING=1` in `ghostshell.conf` if you disagree.

---

## 6. Habits that leak more than any setting

- **Logging into the same account from both IPs.** Instant correlation, and nothing
  in this repository can help you.
- **The same browser profile before and after.** GhostShell's isolated
  `--user-data-dir` exists precisely to prevent this.
- **Time pattern.** Switching exit country every hour is not a normal user pattern.
- **Payment instruments.** Billing-country mismatches are checked at the processor,
  not the browser.
- **Mobile apps on the same network.** Your phone's apps usually bypass the VPN
  configuration you set up for your laptop.

---

## Verification checklist

```bash
ghostshell --check                                  # local pre-flight
```

Then, inside GhostShell:

| Page | Expect |
|---|---|
| https://browserleaks.com/webrtc | No address except your VPN's |
| https://dnsleaktest.com (extended) | Only your VPN's resolvers |
| https://ipleak.net | No IPv6, no WebRTC, no DNS leak |
| https://browserleaks.com/canvas | A hash that changes between sites, stable on reload |
| https://amiunique.org | How unusual your combined fingerprint is |
| https://abrahamjuliot.github.io/creepjs/ | The most aggressive open-source tester — expect partial resistance, nobody passes clean |
