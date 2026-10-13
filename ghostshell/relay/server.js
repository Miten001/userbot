#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────
//  GhostShell relay — in-site browser backend
//
//    node server.js [--port=8787] [--open] [--dev-allow-private] [--help]
//
//  Zero dependencies (Node 18+). Binds to 127.0.0.1 ONLY — never 0.0.0.0 —
//  and double-checks the peer address on every connection.
//
//  What it does:
//    /view        fetch a page (direct or through the proxy pool), rewrite
//                 every URL, strip CSP + active content, hand back HTML
//    /view/raw    same transport, passthrough for subresources (CSS rewritten)
//    /api/ping    liveness probe for the in-site browser UI
//    /api/proxy   pool: list / add / test / score / select / clear
//    /api/identity  new identity: drop the cookie jar, rotate the proxy
//
//  SSRF guard: every fetch target — including redirect hops and form
//  POSTs — is resolved and checked against loopback/private/link-local/
//  metadata ranges before a socket is opened, and again at DNS time
//  (custom lookup) so a rebinding answer cannot slip through.
//
//  `--dev-allow-private` disables the address guard for LOCAL TESTING ONLY
//  (e.g. pointing the viewer at a test server on 127.0.0.1). Never use it
//  to browse the internet through the relay.
// ─────────────────────────────────────────────────────────────────────────

const http = require('http');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const net = require('net');

const { parseProxy, fetchUrl } = require('./lib/net');
const { rewriteHtml, rewriteCss } = require('./lib/rewrite');
const pool = require('./lib/pool');

const NAME = 'ghostshell-relay';
const VERSION = '1.2.0';
const HOST = '127.0.0.1';
const SITE_DIR = path.resolve(__dirname, '..', 'site');

const MAX_API_BODY = 1024 * 1024;        // 1 MiB
const MAX_VIEW_BODY = 8 * 1024 * 1024;   // HTML rewrite cap
const MAX_RAW_BODY = 64 * 1024 * 1024;   // passthrough cap

// ── CLI ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let port = Number(process.env.GHOSTSHELL_RELAY_PORT) || 8787;
let devAllowPrivate = false;
let openWhenReady = false;

for (const a of args) {
  if (a === '--help' || a === '-h') {
    console.log(`GhostShell relay ${VERSION}

  Usage: node server.js [options]

    --port=8787            listen port (default 8787, or \$GHOSTSHELL_RELAY_PORT)
    --open                 open the in-site browser once the relay is up
    --dev-allow-private    TESTING ONLY: allow private/loopback fetch targets
                           (link-local & metadata ranges stay blocked)
    --help                 this text

  Binds to 127.0.0.1. The in-site browser lives at http://127.0.0.1:8787/browser.html`);
    process.exit(0);
  } else if (a.startsWith('--port=')) {
    port = Number(a.slice('--port='.length));
  } else if (a === '--dev-allow-private') {
    devAllowPrivate = true;
  } else if (a === '--open') {
    openWhenReady = true;
  } else {
    console.error(`relay: unknown option ${a} (try --help)`);
    process.exit(2);
  }
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`relay: bad port`);
  process.exit(2);
}

// ── SSRF guard ───────────────────────────────────────────────────────────

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inCidr4(ip, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8],       // "this network"
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local (cloud metadata lives here)
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // documentation
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24],  // documentation
  ['224.0.0.0', 4],     // multicast + reserved
  ['240.0.0.0', 4],     // reserved + broadcast
];

function isBlockedIp(ip) {
  if (!ip) return true;
  const v = net.isIP(ip);
  if (v === 4) {
    return BLOCKED_V4.some(([base, bits]) => inCidr4(ip, base, bits));
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    if (s.startsWith('fc') || s.startsWith('fd')) return true;          // ULA fc00::/7
    if (/^fe[89ab]/.test(s)) return true;                               // link-local fe80::/10
    if (s.startsWith('ff')) return true;                                // multicast
    if (s.startsWith('2001:db8:')) return true;                         // documentation
    if (s.startsWith('::ffff:')) {                                      // IPv4-mapped
      const v4 = s.slice(7);
      return isBlockedIp(v4);
    }
    return false;
  }
  return true; // not an IP → caller should not have asked
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'metadata.google.internal']);
function isBlockedHostname(hostname) {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  return false;
}

/**
 * Ranges that are NEVER fetchable — not even with --dev-allow-private.
 * Cloud metadata lives on the link-local range; a dev flag must not become a
 * metadata-stealing flag.
 */
function isNeverAllowedIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    return inCidr4(ip, '169.254.0.0', 16)   // link-local / cloud metadata
        || inCidr4(ip, '224.0.0.0', 4)      // multicast + reserved
        || inCidr4(ip, '240.0.0.0', 4);
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    return /^fe[89ab]/.test(s)              // fe80::/10 link-local
        || s.startsWith('ff')               // multicast
        || (s.startsWith('::ffff:') && isNeverAllowedIp(s.slice(7)));
  }
  return true;
}

class GuardError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
    this.guard = true;
  }
}

/** Validate a fetch TARGET before any socket opens. Throws GuardError. */
async function validateTarget(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new GuardError('not a URL', 400);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new GuardError(`protocol ${u.protocol} not allowed`, 400);
  }
  if (u.username || u.password) {
    throw new GuardError('credentials in URLs are not allowed', 400);
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(host)) {
    throw new GuardError(`host "${u.hostname}" is not a public destination`, 403);
  }
  if (devAllowPrivate) {
    // Testing escape hatch: loopback/private targets allowed, but
    // link-local / metadata ranges stay closed even here.
    if (net.isIP(host) && isNeverAllowedIp(host)) {
      throw new GuardError(`address ${host} is never fetchable (link-local/metadata)`, 403);
    }
    return u;
  }

  const literal = net.isIP(host);
  if (literal) {
    if (isBlockedIp(host)) {
      throw new GuardError(`address ${host} is not a public destination`, 403);
    }
    return u;
  }
  let addrs;
  try {
    addrs = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    throw new GuardError(`DNS failed for ${u.hostname}: ${err.code || err.message}`, 502);
  }
  if (addrs.length === 0) throw new GuardError(`DNS returned nothing for ${u.hostname}`, 502);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new GuardError(`host ${u.hostname} resolves to ${a.address}, which is not a public destination`, 403);
    }
  }
  return u;
}

/** DNS lookup used at connect time — closes the rebinding TOCTOU window. */
function safeLookup(hostname, options, callback) {
  if (devAllowPrivate) return dns.lookup(hostname, options, callback);
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addrs) => {
    if (err) return callback(err);
    const list = Array.isArray(addrs) ? addrs : [{ address: addrs, family: options && options.family }];
    for (const a of list) {
      if (isBlockedIp(a.address)) {
        return callback(new GuardError(`DNS for ${hostname} resolved to ${a.address} at connect time`, 403));
      }
    }
    if (options && options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

// ── cookie jar (one identity) ────────────────────────────────────────────

let identity = 1;
const jar = new Map(); // host → Map(name → {value, secure, expires})

function absorbSetCookies(url, headers) {
  const u = new URL(url);
  const list = headers['set-cookie'];
  if (!list) return;
  for (const raw of Array.isArray(list) ? list : [list]) {
    const [pair] = String(raw).split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name === '') continue;
    let secure = /;\s*secure\b/i.test(raw);
    let expires = 0;
    const m = /;\s*max-age=(\d+)/i.exec(raw);
    if (m) expires = Date.now() + Number(m[1]) * 1000;
    if (!jar.has(u.hostname)) jar.set(u.hostname, new Map());
    jar.get(u.hostname).set(name, { value, secure, expires });
  }
}

function cookieHeaderFor(url) {
  const u = new URL(url);
  const store = jar.get(u.hostname);
  if (!store) return null;
  const parts = [];
  for (const [name, c] of store) {
    if (c.expires && c.expires < Date.now()) { store.delete(name); continue; }
    if (c.secure && u.protocol !== 'https:') continue;
    parts.push(`${name}=${c.value}`);
  }
  return parts.length ? parts.join('; ') : null;
}

// ── proxy pool state ─────────────────────────────────────────────────────

let proxyPool = pool.load();
let activeProxyId = null;
let activeCountry = 'ALL';
let lastUsedProxyId = null;
let lastUsedIp = null;
let rotateCursor = 0;

function normalizeCountry(c) {
  if (!c) return 'ALL';
  const s = String(c).trim().toUpperCase();
  return s === '' || s === '*' ? 'ALL' : s;
}

function recordUsedProxy(entry) {
  if (!entry) return;
  activeProxyId = entry.id;
  lastUsedProxyId = entry.id;
  lastUsedIp = entry.exitIp || entry.host || null;
}

/**
 * Pick a clean (non-detected) proxy matching `country`, avoiding the last
 * used proxy ID and exit IP whenever another clean proxy is available.
 */
function pickCleanProxy(opts = {}) {
  const mode = opts.mode || 'random';
  const cleanOnly = opts.cleanOnly !== undefined ? Boolean(opts.cleanOnly) : true;
  const cc = normalizeCountry(opts.country || activeCountry);
  const countryFilter = cc !== 'ALL' ? cc : null;
  const avoidLast = opts.avoidLast !== false;

  let next = pool.select(proxyPool, {
    mode,
    cleanOnly,
    country: countryFilter,
    cursor: rotateCursor++,
    exclude: avoidLast && lastUsedProxyId ? new Set([lastUsedProxyId]) : undefined,
    excludeIp: avoidLast && lastUsedIp ? new Set([lastUsedIp]) : undefined,
  });

  // If the pool only has one clean proxy for the requested country, allow it
  // rather than dropping the user to an unproxied direct connection.
  if (!next && avoidLast) {
    next = pool.select(proxyPool, {
      mode,
      cleanOnly,
      country: countryFilter,
      cursor: rotateCursor++,
    });
  }

  if (next) recordUsedProxy(next);
  return next;
}

function newIdentity(country) {
  identity++;
  jar.clear();
  if (country) activeCountry = normalizeCountry(country);
  const next = pickCleanProxy({ mode: 'random', cleanOnly: true, country: activeCountry, avoidLast: true });
  if (!next) activeProxyId = null;
  return {
    identity,
    active: next ? next.id : null,
    proxy: next ? next.raw : 'direct',
    exitIp: next ? (next.exitIp || next.host) : null,
    countryCode: next ? next.countryCode : null,
    country: activeCountry,
  };
}

function activeProxyEntry(pParam, navOpts = {}) {
  if (navOpts.country) {
    activeCountry = normalizeCountry(navOpts.country);
  }
  if (pParam === 'direct') return null;
  // Subresources and explicitly-pinned proxy IDs pass p=<entry.id>
  if (pParam && pParam !== 'auto' && pParam !== 'random') {
    const pinned = proxyPool.find((e) => e.id === pParam) || null;
    if (pinned) {
      lastUsedProxyId = pinned.id;
      lastUsedIp = pinned.exitIp || pinned.host || null;
    }
    return pinned;
  }
  if (activeProxyId === 'direct' && pParam !== 'random' && !navOpts.rotate) {
    return null;
  }
  if (proxyPool.length === 0) return null;

  // On a new search / site navigation (/view with rotate or p=random/auto),
  // pick a fresh non-detected proxy excluding lastUsedProxyId & lastUsedIp.
  const shouldRotate =
    navOpts.rotate === true ||
    pParam === 'random' ||
    (navOpts.isNavigation && navOpts.rotate !== false && pParam === 'auto');

  if (shouldRotate) {
    return pickCleanProxy({
      mode: 'random',
      cleanOnly: true,
      country: navOpts.country || activeCountry,
      avoidLast: true,
    });
  }

  if (activeProxyId && activeProxyId !== 'direct') {
    const e = proxyPool.find((x) => x.id === activeProxyId);
    if (e && pool.isClean(e)) {
      const cc = normalizeCountry(navOpts.country || activeCountry);
      if (cc === 'ALL' || (e.countryCode || '').toUpperCase() === cc) {
        return e;
      }
    }
  }

  return pickCleanProxy({
    mode: 'random',
    cleanOnly: true,
    country: navOpts.country || activeCountry,
    avoidLast: true,
  });
}

function serializeEntry(e) {
  return {
    id: e.id,
    raw: e.raw,
    type: e.type,
    host: e.host,
    port: e.port,
    auth: Boolean(e.user),
    score: pool.score(e),
    wins: e.wins,
    fails: e.fails,
    avgMs: e.avgMs,
    lastMs: e.lastMs,
    lastOk: e.lastOk,
    lastCheck: e.lastCheck,
    exitIp: e.exitIp,
    isp: e.isp,
    country: e.country || null,
    countryCode: e.countryCode || null,
    hosting: e.hosting,
    isProxy: e.isProxy != null ? e.isProxy : null,
    detected: pool.isDetected(e),
    clean: pool.isClean(e),
    error: e.error,
  };
}

function persistPool() {
  pool.save(proxyPool);
}

// ── header hygiene ───────────────────────────────────────────────────────

const STRIP_RESPONSE_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'frame-options',
  'strict-transport-security',
  'clear-site-data',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'x-content-type-options',
  'permissions-policy',
  'set-cookie',             // consumed into the relay's cookie jar
  'content-encoding',       // we decoded it
  'content-length',         // we recomputed it
  'transfer-encoding',
  'connection',
  'keep-alive',
  'alt-svc',                // QUIC advertisement — the launcher hates QUIC
]);

function cleanResponseHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

// ── small HTTP helpers ───────────────────────────────────────────────────

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'X-GhostShell-Relay': `${NAME}/${VERSION}`,
  });
  res.end(html);
}

function errorPage(res, status, message, detail) {
  sendHtml(res, status, `<!doctype html><meta charset="utf-8"><title>relay error</title>
<link rel="stylesheet" href="/styles.css">
<body style="display:grid;place-items:center;min-height:100vh;text-align:center;font-family:system-ui">
<div style="max-width:520px">
  <h1 style="font-size:22px">${status}</h1>
  <p style="color:#99a2b6">${escapeHtml(message)}</p>
  ${detail ? `<pre style="color:#6b7486;font-size:12px;white-space:pre-wrap">${escapeHtml(detail)}</pre>` : ''}
  <p style="color:#6b7486;font-size:12px">GhostShell relay · <a href="/browser.html">back to the browser</a></p>
</div></body>`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limit) {
        req.destroy();
        reject(new GuardError(`request body over ${limit} bytes`, 413));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseFormBody(buf) {
  const params = new URLSearchParams(buf.toString('utf8'));
  const obj = {};
  for (const [k, v] of params) obj[k] = v;
  return obj;
}

// ── static site (ghostshell/site) ────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(SITE_DIR, rel);
  if (!file.startsWith(SITE_DIR + path.sep) && file !== SITE_DIR) {
    return errorPage(res, 403, 'path traversal blocked');
  }
  fs.readFile(file, (err, data) => {
    if (err) return errorPage(res, 404, 'not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// ── the fetch+rewrite viewer ─────────────────────────────────────────────

function contentWantsRewrite(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return 'html';
  if (ct.includes('text/css')) return 'css';
  return null;
}

async function handleFetch(req, res, rawTarget, pParam, method, formBody, navOpts = {}) {
  await validateTarget(rawTarget); // SSRF — also covers the first hop

  const entry = activeProxyEntry(pParam, navOpts);
  const proxy = entry ? parseProxy(entry.raw) : null;

  let body = null;
  const headers = {};
  if (formBody) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(formBody)) {
      if (k !== '_target') params.append(k, v);
    }
    body = Buffer.from(params.toString());
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  let result;
  try {
    result = await fetchUrl(rawTarget, {
      proxy,
      method: method || (formBody ? 'POST' : 'GET'),
      body,
      headers,
      timeout: 20000,
      maxRedirects: 5,
      maxBody: MAX_RAW_BODY,
      lookup: safeLookup,
      validateUrl: validateTarget,   // every redirect hop re-validated
      cookieHeader: cookieHeaderFor(rawTarget),
    });
  } catch (err) {
    if (err && err.guard) throw err;
    return errorPage(res, 502, 'fetch failed', String(err && err.message ? err.message : err));
  }

  absorbSetCookies(result.url, result.headers);
  const clean = cleanResponseHeaders(result.headers);
  clean['X-GhostShell-Via'] = entry ? entry.raw : 'direct';
  if (entry && entry.countryCode) clean['X-GhostShell-Country'] = entry.countryCode;
  if (entry && (entry.exitIp || entry.host)) clean['X-GhostShell-Exit-IP'] = entry.exitIp || entry.host;

  // Bind all rewritten subresources of this document to the exact proxy ID
  // chosen for this page so the whole page loads through one consistent exit IP.
  const subresourceProxyParam = entry ? entry.id : (pParam === 'direct' ? 'direct' : 'auto');
  const kind = contentWantsRewrite(result.headers['content-type']);

  if (kind === 'html') {
    if (result.body.length > MAX_VIEW_BODY) {
      return errorPage(res, 502, 'page too large to rewrite safely');
    }
    let { html, stats } = rewriteHtml(result.body.toString('utf8'), result.url, {
      proxyParam: subresourceProxyParam,
    });
    const egressLabel = entry
      ? `${entry.raw}${entry.countryCode ? ' [' + entry.countryCode + ']' : ''}${entry.exitIp ? ' (' + entry.exitIp + ')' : ''}`
      : 'direct';
    const egressMeta =
      `<meta name="gs-egress" content="${escapeHtml(egressLabel)}"` +
      ` data-proxy-id="${escapeHtml(entry ? entry.id : 'direct')}"` +
      ` data-proxy-raw="${escapeHtml(entry ? entry.raw : 'direct')}"` +
      ` data-country="${escapeHtml(entry && entry.countryCode ? entry.countryCode : '')}"` +
      ` data-ip="${escapeHtml(entry ? (entry.exitIp || entry.host || '') : '')}">`;
    if (html.includes('<meta name="gs-stats"')) {
      html = html.replace('<meta name="gs-stats"', egressMeta + '<meta name="gs-stats"');
    } else {
      html = egressMeta + html;
    }
    clean['Content-Type'] = 'text/html; charset=utf-8';
    clean['Content-Length'] = Buffer.byteLength(html);
    clean['X-GhostShell-Stats'] =
      `scripts=${stats.scripts};handlers=${stats.handlers};urls=${stats.urls};bases=${stats.bases}`;
    res.writeHead(result.status, clean);
    return res.end(html);
  }

  if (kind === 'css') {
    const css = rewriteCss(result.body.toString('utf8'), result.url, {
      proxyParam: subresourceProxyParam,
    });
    clean['Content-Type'] = 'text/css; charset=utf-8';
    clean['Content-Length'] = Buffer.byteLength(css);
    res.writeHead(result.status, clean);
    return res.end(css);
  }

  clean['Content-Length'] = result.body.length;
  res.writeHead(result.status, clean);
  res.end(result.body);
}

// ── router ───────────────────────────────────────────────────────────────

async function route(req, res) {
  const u = new URL(req.url, `http://${HOST}:${port}`);
  const pathname = u.pathname;

  // ---- API ----
  if (pathname === '/api/ping') {
    return sendJson(res, 200, {
      ok: true,
      name: NAME,
      version: VERSION,
      identity,
      poolSize: proxyPool.length,
      cleanCount: proxyPool.filter(pool.isClean).length,
      country: activeCountry,
      activeProxy: (() => {
        if (activeProxyId === 'direct') return 'direct';
        const e = activeProxyId ? proxyPool.find((x) => x.id === activeProxyId) : null;
        return e ? e.raw : 'direct';
      })(),
    });
  }

  if (pathname === '/api/proxy') {
    if (req.method === 'GET') {
      const countries = Array.from(
        new Set(proxyPool.map((e) => (e.countryCode || '').toUpperCase()).filter(Boolean))
      ).sort();
      return sendJson(res, 200, {
        proxies: proxyPool.map(serializeEntry),
        active: activeProxyId,
        country: activeCountry,
        countries,
        testUrl: process.env.GHOSTSHELL_TEST_URL || pool.DEFAULT_TEST_URL,
      });
    }
    if (req.method === 'POST') {
      const bodyBuf = await readBody(req, MAX_API_BODY);
      let text = '';
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('application/json')) {
        try {
          text = String(JSON.parse(bodyBuf.toString('utf8')).text || '');
        } catch {
          return sendJson(res, 400, { error: 'bad JSON body' });
        }
      } else {
        text = bodyBuf.toString('utf8');
      }
      let added;
      try {
        added = pool.parse(text);
      } catch (err) {
        return sendJson(res, 400, { error: String(err.message || err) });
      }
      const byRaw = new Map(proxyPool.map((e) => [e.raw.toLowerCase(), e]));
      let count = 0;
      for (const e of added) {
        const existing = byRaw.get(e.raw.toLowerCase());
        if (existing) {
          if (e.countryCode && !existing.countryCode) existing.countryCode = e.countryCode;
          continue;
        }
        byRaw.set(e.raw.toLowerCase(), e);
        proxyPool.push(e);
        count++;
      }
      persistPool();
      return sendJson(res, 200, { added: count, total: proxyPool.length });
    }
    if (req.method === 'DELETE') {
      const id = u.searchParams.get('id');
      if (id) {
        const before = proxyPool.length;
        proxyPool = proxyPool.filter((e) => e.id !== id);
        if (activeProxyId === id) activeProxyId = null;
        if (lastUsedProxyId === id) lastUsedProxyId = null;
        persistPool();
        return sendJson(res, 200, { removed: before - proxyPool.length, total: proxyPool.length });
      }
      proxyPool = [];
      activeProxyId = null;
      lastUsedProxyId = null;
      lastUsedIp = null;
      persistPool();
      return sendJson(res, 200, { removed: 0, total: 0 });
    }
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  if (pathname === '/api/proxy/test' && req.method === 'POST') {
    const bodyBuf = await readBody(req, MAX_API_BODY);
    let id = null;
    let testUrl = null;
    if (bodyBuf.length) {
      try {
        const j = JSON.parse(bodyBuf.toString('utf8'));
        id = j.id || null;
        testUrl = j.testUrl || null;
      } catch {
        return sendJson(res, 400, { error: 'bad JSON body' });
      }
    }
    const targets = id ? proxyPool.filter((e) => e.id === id) : proxyPool;
    if (targets.length === 0) return sendJson(res, 404, { error: 'no matching proxies' });
    const results = await pool.testAll(targets, fetchUrl, {
      testUrl,
      validateUrl: validateTarget,
      timeout: 12000,
      concurrency: 6,
    });
    persistPool();
    return sendJson(res, 200, {
      results,
      proxies: proxyPool.map(serializeEntry),
    });
  }

  if (pathname === '/api/proxy/select' && req.method === 'POST') {
    const bodyBuf = await readBody(req, MAX_API_BODY);
    let id = null;
    let mode = 'best';
    let cleanOnly;
    let country = null;
    try {
      const j = JSON.parse(bodyBuf.toString('utf8') || '{}');
      id = j.id || null;
      mode = j.mode || 'best';
      cleanOnly = j.cleanOnly;
      country = j.country || null;
    } catch {
      return sendJson(res, 400, { error: 'bad JSON body' });
    }
    if (country != null) {
      activeCountry = normalizeCountry(country);
    }
    if (id === 'direct') {
      activeProxyId = 'direct';
      return sendJson(res, 200, { active: 'direct', proxy: 'direct', country: activeCountry });
    }
    if (id) {
      const e = proxyPool.find((x) => x.id === id);
      if (!e) return sendJson(res, 404, { error: 'no such proxy' });
      recordUsedProxy(e);
      return sendJson(res, 200, {
        active: e.id,
        proxy: e.raw,
        exitIp: e.exitIp || e.host || null,
        countryCode: e.countryCode || null,
        detected: pool.isDetected(e),
        clean: pool.isClean(e),
        country: activeCountry,
      });
    }
    const wantClean = cleanOnly !== undefined ? Boolean(cleanOnly) : true;
    const next = pickCleanProxy({
      mode,
      cleanOnly: wantClean,
      country: activeCountry,
      avoidLast: true,
    });
    activeProxyId = next ? next.id : null;
    return sendJson(res, 200, {
      active: next ? next.id : null,
      proxy: next ? next.raw : 'direct',
      exitIp: next ? (next.exitIp || next.host) : null,
      countryCode: next ? next.countryCode : null,
      detected: next ? pool.isDetected(next) : false,
      clean: next ? pool.isClean(next) : true,
      country: activeCountry,
    });
  }

  if (pathname === '/api/identity' && req.method === 'POST') {
    let country = null;
    const bodyBuf = await readBody(req, MAX_API_BODY);
    if (bodyBuf.length) {
      try {
        const j = JSON.parse(bodyBuf.toString('utf8'));
        country = j.country || null;
      } catch { /* ignore */ }
    }
    const info = newIdentity(country);
    return sendJson(res, 200, { ok: true, ...info });
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'unknown API route' });
  }

  // ---- viewer ----
  if (pathname === '/view' || pathname === '/view/raw') {
    let rawTarget = u.searchParams.get('u');
    const pParam = u.searchParams.get('p') || 'auto';
    const countryParam = u.searchParams.get('c') || u.searchParams.get('country') || null;
    const rotateParam = u.searchParams.get('rotate');
    const isNavigation = pathname === '/view';
    const navOpts = {
      isNavigation,
      country: countryParam,
      rotate: rotateParam === '1' ? true : rotateParam === '0' ? false : undefined,
    };

    if (!rawTarget && req.method === 'POST') {
      const bodyBuf = await readBody(req, MAX_API_BODY);
      const form = parseFormBody(bodyBuf);
      rawTarget = form._target;
      if (!rawTarget) return errorPage(res, 400, 'form submission without _target');
      try {
        return await handleFetch(req, res, rawTarget, pParam, 'POST', form, navOpts);
      } catch (err) {
        return err.guard
          ? errorPage(res, err.status, 'blocked by SSRF guard', err.message)
          : errorPage(res, 500, 'relay error', String(err.message || err));
      }
    }

    if (!rawTarget) return errorPage(res, 400, 'missing ?u= target URL');
    if (!/^https?:\/\//i.test(rawTarget)) {
      return errorPage(res, 400, 'only http(s) targets are fetchable');
    }
    try {
      return await handleFetch(req, res, rawTarget, pParam, req.method, null, navOpts);
    } catch (err) {
      return err.guard
        ? errorPage(res, err.status, 'blocked by SSRF guard', err.message)
        : errorPage(res, 500, 'relay error', String(err.message || err));
    }
  }

  // ---- static site ----
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }
  return errorPage(res, 405, 'method not allowed');
}

// ── server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (!res.headersSent) {
      errorPage(res, 500, 'relay error', String(err && err.message ? err.message : err));
    } else {
      res.end();
    }
  });
});

// Belt and braces: even though we bind to 127.0.0.1, refuse non-loopback peers.
server.on('connection', (socket) => {
  const ip = socket.remoteAddress;
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!loopback) {
    console.warn(`relay: refused non-loopback connection from ${ip}`);
    socket.destroy();
  }
});

server.listen(port, HOST, () => {
  const banner = [
    `GhostShell relay ${VERSION} · ${HOST}:${port}`,
    `  in-site browser   http://${HOST}:${port}/browser.html`,
    `  pool              ${proxyPool.length} proxies · ~/.ghostshell/proxy-pool.json`,
    devAllowPrivate ? '  !! --dev-allow-private is ON (loopback/private targets allowed — testing only)' : null,
  ].filter(Boolean).join('\n');
  console.log(banner);

  if (openWhenReady) {
    const url = `http://${HOST}:${port}/browser.html`;
    const { spawn } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'cmd'
      : 'xdg-open';
    const argv = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const fallback = () => console.log(`  (open it manually: ${url})`);
    try {
      // A missing opener (e.g. no xdg-open on a headless Linux box) is
      // reported asynchronously as an 'error' event, not thrown, so the
      // handler is required or Node crashes the whole relay.
      const child = spawn(cmd, argv, { detached: true, stdio: 'ignore' });
      child.on('error', fallback);
      child.unref();
    } catch {
      fallback();
    }
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\nrelay: shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
