'use strict';
// ─────────────────────────────────────────────────────────────────────────
//  GhostShell relay — transport layer
//
//  Zero dependencies (node:net, node:tls, node:http, node:https, node:zlib).
//  Speaks four egress modes, all with optional authentication:
//
//    direct    plain TCP to the target (validated lookup supplied by caller)
//    http      HTTP CONNECT through an HTTP proxy  (Proxy-Authorization: Basic)
//    https     CONNECT through an HTTP proxy over TLS
//    socks4    SOCKS4 / SOCKS4a (userid = auth)
//    socks5    SOCKS5 RFC 1928 + RFC 1929 username/password auth
//
//  Everything above the socket is a normal HTTP/1.1 exchange built from the
//  stock http/https modules, so redirects, gzip and chunked bodies come free.
// ─────────────────────────────────────────────────────────────────────────

const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { URL } = require('url');

const DNS_TIMEOUT = 8000;
const CONNECT_TIMEOUT = 15000;

// A plain, widely-seen desktop Chrome UA. The viewer should look like an
// ordinary browser to the far end, not like a Node fetcher.
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── proxy parsing ────────────────────────────────────────────────────────

/**
 * Parse a proxy spec into {type, host, port, user, pass, raw}.
 *   socks5://user:pass@127.0.0.1:1080
 *   http://user:pass@10.0.0.2:8080        https://10.0.0.2:8443
 *   socks4://127.0.0.1:1080               socks://…  (alias for socks5)
 *   1.2.3.4:8080                          (bare host:port → http)
 * Returns null for "no proxy" (direct), throws for malformed input.
 */
function parseProxy(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === '' || raw === 'direct' || raw === 'none') return null;

  let s = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;

  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`bad proxy spec: ${raw}`);
  }

  let type;
  switch (u.protocol.replace(/:$/, '').toLowerCase()) {
    case 'http':   type = 'http';   break;
    case 'https':  type = 'https';  break;
    case 'socks4':
    case 'socks4a': type = 'socks4'; break;
    case 'socks5':
    case 'socks':  type = 'socks5'; break;
    default:
      throw new Error(`unsupported proxy type "${u.protocol}" in ${raw}`);
  }
  if (!u.hostname) throw new Error(`proxy has no host: ${raw}`);

  const defaultPort = type === 'socks4' || type === 'socks5' ? 1080 : 8080;
  const port = u.port ? Number(u.port) : defaultPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`bad proxy port in ${raw}`);
  }

  return {
    type,
    host: u.hostname,
    port,
    user: u.username ? decodeURIComponent(u.username) : '',
    pass: u.password ? decodeURIComponent(u.password) : '',
    raw,
  };
}

// ── socket plumbing ──────────────────────────────────────────────────────

function once(socket, event, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error(`${label || 'connect'} timed out after ${ms}ms`));
    }, ms);
    const onEvent = (arg) => { cleanup(); resolve(arg); };
    const onError = (err) => { cleanup(); socket.destroy(); reject(err); };
    const onClose = () => {
      cleanup();
      reject(new Error(`${label || 'connect'} closed before ${event}`));
    };
    function cleanup() {
      clearTimeout(timer);
      socket.removeListener(event, onEvent);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    }
    socket.once(event, onEvent);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function readUntil(socket, marker, maxBytes) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf(marker);
      if (idx !== -1) {
        cleanup();
        resolve({ head: buf.slice(0, idx + marker.length), rest: buf.slice(idx + marker.length) });
      } else if (buf.length > maxBytes) {
        cleanup();
        socket.destroy();
        reject(new Error('proxy handshake too large'));
      }
    };
    const onErr = (e) => { cleanup(); reject(e); };
    const onClose = () => { cleanup(); reject(new Error('proxy closed during handshake')); };
    function cleanup() {
      socket.removeListener('data', onData);
      socket.removeListener('error', onErr);
      socket.removeListener('close', onClose);
    }
    socket.on('data', onData);
    socket.once('error', onErr);
    socket.once('close', onClose);
  });
}

function connectTcp(opts, timeout, label) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(opts);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${label || 'connect'} timed out after ${timeout}ms`));
    }, timeout);
    socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

function wrapTls(socket, servername, timeout) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ socket, servername });
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error(`TLS handshake timed out after ${timeout}ms`));
    }, timeout);
    s.once('secureConnect', () => { clearTimeout(timer); resolve(s); });
    s.once('error', (err) => {
      clearTimeout(timer);
      s.destroy();
      reject(err);
    });
  });
}

// ── HTTP CONNECT (http / https proxies) ──────────────────────────────────

async function openHttpConnect(proxy, host, port, timeout) {
  let socket = await connectTcp({ host: proxy.host, port: proxy.port }, timeout, 'proxy connect');
  if (proxy.type === 'https') {
    socket = await wrapTls(socket, proxy.host, timeout);
  }

  const lines = [
    `CONNECT ${host}:${port} HTTP/1.1`,
    `Host: ${host}:${port}`,
    'Proxy-Connection: keep-alive',
  ];
  if (proxy.user) {
    const cred = Buffer.from(`${proxy.user}:${proxy.pass || ''}`).toString('base64');
    lines.push(`Proxy-Authorization: Basic ${cred}`);
  }
  socket.write(lines.join('\r\n') + '\r\n\r\n');

  const { head, rest } = await readUntil(socket, '\r\n\r\n', 16384);
  const statusLine = head.toString('latin1').split('\r\n')[0];
  const m = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine);
  if (!m || m[1] !== '200') {
    socket.destroy();
    const err = new Error(`proxy refused CONNECT: ${statusLine || 'no response'}`);
    err.status = 502;
    throw err;
  }
  if (rest.length) socket.unshift(rest);
  socket.setTimeout(timeout * 4);
  return socket;
}

// ── SOCKS4 / SOCKS4a ────────────────────────────────────────────────────

async function openSocks4(proxy, host, port, timeout) {
  const socket = await connectTcp({ host: proxy.host, port: proxy.port }, timeout, 'proxy connect');

  const isIp = net.isIP(host);
  let addr;
  if (isIp === 4) {
    addr = host.split('.').map(Number);
  } else if (isIp === 6) {
    socket.destroy();
    throw new Error('SOCKS4 cannot carry IPv6 literals — use SOCKS5');
  } else {
    addr = [0, 0, 0, 1]; // SOCKS4a: 0.0.0.1 + domain name
  }

  const userid = Buffer.from(proxy.user || '', 'latin1');
  const parts = [
    Buffer.from([4, 1, (port >> 8) & 0xff, port & 0xff, ...addr]),
    userid,
    Buffer.from([0]),
  ];
  if (isIp !== 4) parts.push(Buffer.from(host, 'latin1'), Buffer.from([0]));
  socket.write(Buffer.concat(parts));

  const res = await once(socket, 'data', timeout, 'SOCKS4 handshake');
  if (res.length < 8 || res[0] !== 0) {
    socket.destroy();
    throw new Error('malformed SOCKS4 reply');
  }
  const code = res[1];
  if (code !== 0x5a) {
    socket.destroy();
    const names = { 0x5b: 'rejected', 0x5c: 'identd unreachable', 0x5d: 'userid mismatch' };
    throw new Error(`SOCKS4 refused: ${names[code] || 'code ' + code}`);
  }
  socket.setTimeout(timeout * 4);
  return socket;
}

// ── SOCKS5 (RFC 1928 + RFC 1929) ────────────────────────────────────────

async function openSocks5(proxy, host, port, timeout) {
  const socket = await connectTcp({ host: proxy.host, port: proxy.port }, timeout, 'proxy connect');

  // greeting: offer no-auth and/or username/password
  const methods = proxy.user ? [0x00, 0x02] : [0x00];
  socket.write(Buffer.from([0x05, methods.length, ...methods]));

  let res = await once(socket, 'data', timeout, 'SOCKS5 greeting');
  if (res.length < 2 || res[0] !== 0x05) {
    socket.destroy();
    throw new Error('not a SOCKS5 server');
  }
  const method = res[1];
  if (method === 0xff) {
    socket.destroy();
    throw new Error('SOCKS5 proxy accepted no auth method' + (proxy.user ? ' (it does not accept user/pass)' : ''));
  }
  if (method === 0x02) {
    if (!proxy.user) {
      socket.destroy();
      throw new Error('SOCKS5 proxy requires username/password');
    }
    const user = Buffer.from(proxy.user, 'utf8');
    const pass = Buffer.from(proxy.pass || '', 'utf8');
    if (user.length > 255 || pass.length > 255) {
      socket.destroy();
      throw new Error('SOCKS5 credentials too long (max 255 bytes)');
    }
    socket.write(Buffer.concat([
      Buffer.from([0x01, user.length]), user,
      Buffer.from([pass.length]), pass,
    ]));
    res = await once(socket, 'data', timeout, 'SOCKS5 auth');
    if (res.length < 2 || res[1] !== 0x00) {
      socket.destroy();
      throw new Error('SOCKS5 username/password rejected');
    }
  }

  // CONNECT request. Send the domain form so the proxy resolves for us.
  const isIp = net.isIP(host);
  let atyp, addrBuf;
  if (isIp === 4) {
    atyp = 0x01;
    addrBuf = Buffer.from(host.split('.').map(Number));
  } else if (isIp === 6) {
    atyp = 0x04;
    addrBuf = Buffer.from(inet6ToBytes(host));
  } else {
    atyp = 0x03;
    const name = Buffer.from(host, 'latin1');
    addrBuf = Buffer.concat([Buffer.from([name.length]), name]);
  }
  socket.write(Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, atyp]),
    addrBuf,
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
  ]));

  res = await once(socket, 'data', timeout, 'SOCKS5 connect');
  if (res.length < 4 || res[0] !== 0x05) {
    socket.destroy();
    throw new Error('malformed SOCKS5 reply');
  }
  if (res[1] !== 0x00) {
    socket.destroy();
    const names = {
      0x01: 'general failure', 0x02: 'not allowed', 0x03: 'network unreachable',
      0x04: 'host unreachable', 0x05: 'connection refused', 0x06: 'TTL expired',
      0x07: 'command not supported', 0x08: 'address type not supported',
    };
    throw new Error(`SOCKS5 refused: ${names[res[1]] || 'code ' + res[1]}`);
  }
  socket.setTimeout(timeout * 4);
  return socket;
}

// Minimal IPv6 text → 16 bytes. Handles "::" expansion and embedded IPv4.
function inet6ToBytes(text) {
  let s = text;
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  // embedded IPv4 tail
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  let tail = [];
  if (v4) {
    tail = v4[1].split('.').map(Number);
    s = s.slice(0, v4.index);
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  let halves = s.split('::');
  const expand = (part) => (part === '' ? [] : part.split(':').map((h) => parseInt(h || '0', 16)));
  let words;
  if (halves.length === 2) {
    const a = expand(halves[0]);
    const b = expand(halves[1]);
    words = [...a, ...new Array(8 - a.length - b.length).fill(0), ...b];
  } else {
    words = expand(s);
    while (words.length < 8) words.push(0);
  }
  const out = [];
  for (const w of words.slice(0, 8)) {
    out.push((w >> 8) & 0xff, w & 0xff);
  }
  if (tail.length) {
    // replace the last 4 bytes with the embedded IPv4
    out.splice(out.length - 4, 4, ...tail);
    if (out.length > 16) out.splice(16);
  }
  return out.slice(0, 16);
}

// ── public: open a tunnel to host:port ───────────────────────────────────

/**
 * Open a raw socket to host:port, either direct or through the proxy.
 * `opts.lookup` (optional) is the validated DNS lookup for direct mode.
 * TLS is NOT applied here — the caller wraps when the target scheme is https.
 */
async function openTunnel(host, port, proxy, opts = {}) {
  const timeout = opts.timeout || CONNECT_TIMEOUT;
  if (!proxy) {
    return connectTcp({ host, port, lookup: opts.lookup }, timeout, `connect ${host}:${port}`);
  }
  switch (proxy.type) {
    case 'http':
    case 'https':
      return openHttpConnect(proxy, host, port, timeout);
    case 'socks4':
      return openSocks4(proxy, host, port, timeout);
    case 'socks5':
      return openSocks5(proxy, host, port, timeout);
    default:
      throw new Error(`unknown proxy type ${proxy.type}`);
  }
}

// ── public: fetch a URL (optionally through a proxy) ─────────────────────

function decompress(body, encoding) {
  if (!encoding) return body;
  const enc = encoding.toLowerCase().trim();
  try {
    if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(body);
    if (enc === 'deflate') return zlib.inflateSync(body);
    if (enc === 'br') return zlib.brotliDecompressSync(body);
  } catch {
    // corrupt upstream encoding — hand back the raw bytes
  }
  return body;
}

function makeAgent(kind, socket) {
  const Agent = kind === 'https' ? https.Agent : http.Agent;
  const agent = new Agent({ keepAlive: false });
  agent.createConnection = () => socket;
  return agent;
}

/**
 * fetchUrl(url, opts) → {status, headers, body, url}
 *   opts.proxy          parsed proxy (or null for direct)
 *   opts.method         'GET' | 'POST' | …
 *   opts.body           Buffer | string | null
 *   opts.headers        extra request headers
 *   opts.lookup         validated DNS lookup (direct mode)
 *   opts.validateUrl    async (urlString) => void — called before EVERY hop
 *   opts.maxRedirects   default 5
 *   opts.timeout        per-hop ms, default 20000
 *   opts.maxBody        bytes, default 64 MiB
 */
async function fetchUrl(urlString, opts = {}) {
  const timeout = opts.timeout || 20000;
  const maxRedirects = opts.maxRedirects == null ? 5 : opts.maxRedirects;
  const maxBody = opts.maxBody || 64 * 1024 * 1024;

  let current = urlString;
  let method = (opts.method || 'GET').toUpperCase();
  let body = opts.body ? (Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(String(opts.body))) : null;

  for (let hop = 0; ; hop++) {
    if (opts.validateUrl) await opts.validateUrl(current);

    const u = new URL(current);
    const isHttps = u.protocol === 'https:';
    const port = u.port ? Number(u.port) : (isHttps ? 443 : 80);

    const socket = await openTunnel(u.hostname, port, opts.proxy, {
      lookup: opts.lookup,
      timeout,
    });

    let finalSocket = socket;
    if (isHttps) {
      try {
        finalSocket = await wrapTls(socket, u.hostname, timeout);
      } catch (err) {
        socket.destroy();
        throw err;
      }
    }

    const headers = {
      'Host': u.host,
      'User-Agent': DEFAULT_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'close',
      ...(opts.headers || {}),
    };
    if (body) headers['Content-Length'] = String(body.length);
    if (opts.cookieHeader) headers['Cookie'] = opts.cookieHeader;
    if (opts.referer) headers['Referer'] = opts.referer;

    const result = await new Promise((resolve, reject) => {
      const req = (isHttps ? https : http).request({
        method,
        host: u.hostname,
        port,
        path: u.pathname + u.search,
        headers,
        agent: makeAgent(isHttps ? 'https' : 'http', finalSocket),
      }, (res) => {
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > maxBody) {
            res.destroy();
            reject(new Error(`response body over ${maxBody} bytes`));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }));
        res.on('error', reject);
      });
      req.setTimeout(timeout, () => {
        req.destroy(new Error(`request timed out after ${timeout}ms`));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    }).catch((err) => {
      finalSocket.destroy();
      throw err;
    });

    // decode content-encoding once, up front
    const decoded = decompress(result.body, result.headers['content-encoding']);
    result.body = decoded;

    const status = result.status;
    const location = result.headers.location;
    const isRedirect = [301, 302, 303, 307, 308].includes(status) && location;

    if (isRedirect && hop < maxRedirects) {
      const next = new URL(location, current).href;
      if (status === 303 || ((status === 301 || status === 302) && method === 'POST')) {
        method = 'GET';
        body = null;
      }
      current = next;
      continue;
    }

    return { ...result, url: current };
  }
}

module.exports = {
  DEFAULT_UA,
  parseProxy,
  openTunnel,
  fetchUrl,
  decompress,
};
