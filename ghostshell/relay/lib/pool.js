'use strict';
// ─────────────────────────────────────────────────────────────────────────
//  GhostShell relay — proxy pool
//
//  parse   one proxy per line:  type://[user:pass@]host:port  (or host:port)
//  test    run a real request through the proxy and time it
//  score   0–100: reliability (Laplace-smoothed) × speed × freshness
//  select  pick one: best (jittered among the top), rotate, or random
//
//  The pool persists to ~/.ghostshell/proxy-pool.json so a restart does not
//  throw away everything the tests learned. Pure data + node:fs — no deps.
// ─────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseProxy } = require('./net');

const POOL_FILE = path.join(
  process.env.GHOSTSHELL_HOME || path.join(os.homedir(), '.ghostshell'),
  'proxy-pool.json'
);

const DEFAULT_TEST_URL = 'http://ip-api.com/json/?fields=status,message,query,isp,org,as,proxy,hosting';
const STALE_MS = 15 * 60 * 1000;     // a test older than this counts as "unknown"
const FAIL_PENALTY_MS = 60 * 1000;   // a failure this recent halves the score

// ── parse ────────────────────────────────────────────────────────────────

/** Parse a block of text into pool entries. Throws on the first bad line. */
function parse(text) {
  const entries = [];
  const seen = new Set();
  for (const lineRaw of String(text).split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue;
    const proxy = parseProxy(line);
    if (!proxy) continue; // "direct" / empty — not pool material
    const key = `${proxy.type}://${proxy.user ? proxy.user + '@' : ''}${proxy.host}:${proxy.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(freshEntry(proxy));
  }
  return entries;
}

function freshEntry(proxy) {
  return {
    id: makeId(proxy),
    raw: proxy.raw,
    type: proxy.type,
    host: proxy.host,
    port: proxy.port,
    user: proxy.user || '',
    pass: proxy.pass || '',
    wins: 0,
    fails: 0,
    avgMs: 0,
    lastMs: 0,
    lastOk: null,
    lastCheck: 0,
    exitIp: null,
    isp: null,
    hosting: null,
    error: null,
    addedAt: Date.now(),
  };
}

function makeId(proxy) {
  return Buffer.from(`${proxy.type}|${proxy.host}|${proxy.port}|${proxy.user || ''}`)
    .toString('base64url')
    .replace(/=/g, '')
    .slice(0, 22);
}

// ── score ────────────────────────────────────────────────────────────────

/**
 * 0–100. Reliability dominates; speed breaks ties; stale or freshly-failed
 * entries are pushed down hard so `select` prefers evidence over optimism.
 */
function score(entry) {
  const n = entry.wins + entry.fails;
  const reliability = (entry.wins + 1) / (n + 2);            // Laplace
  const speed = 1 / (1 + (entry.avgMs || 3000) / 3000);      // 0ms→1.0, 3s→0.5
  let value = 100 * (0.65 * reliability + 0.35 * speed);

  const now = Date.now();
  if (!entry.lastCheck || now - entry.lastCheck > STALE_MS) value *= 0.6;
  else if (entry.lastOk === false && now - entry.lastCheck < FAIL_PENALTY_MS) value *= 0.35;

  // ip-api tells us when an exit looks like a datacenter or an open proxy —
  // residential-looking exits score better for the same speed and success.
  if (entry.hosting === false && entry.isp) value *= 1.05;

  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

// ── select ───────────────────────────────────────────────────────────────

/**
 * mode 'best'    → weighted pick among the three highest-scored entries
 * mode 'rotate'  → round-robin over the sorted list (state kept by caller)
 * mode 'random'  → uniform over entries that are not failing right now
 * Never returns an entry in `exclude` (Set of ids).
 */
function select(entries, opts = {}) {
  const pool = entries.filter((e) => !opts.exclude || !opts.exclude.has(e.id));
  if (pool.length === 0) return null;

  const mode = opts.mode || 'best';
  const ranked = [...pool].sort((a, b) => score(b) - score(a));

  if (mode === 'random') {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (mode === 'rotate') {
    const idx = (opts.cursor == null ? 0 : opts.cursor) % ranked.length;
    return ranked[idx];
  }
  // 'best' — top three, weighted by score, so a single stale winner does not
  // monopolise traffic while a nearly-as-good entry sits idle.
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const weights = top.map((e) => Math.max(score(e), 1));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}

// ── test ─────────────────────────────────────────────────────────────────

function parseTestBody(body) {
  const text = body.toString('utf8').trim();
  try {
    const j = JSON.parse(text);
    return {
      exitIp: j.query || j.ip || null,
      isp: j.isp || j.org || null,
      hosting: typeof j.hosting === 'boolean' ? j.hosting : null,
      isProxy: typeof j.proxy === 'boolean' ? j.proxy : null,
    };
  } catch {
    const first = text.split(/\s/)[0];
    return { exitIp: first.length > 0 && first.length <= 45 ? first : null, isp: null, hosting: null, isProxy: null };
  }
}

/**
 * Run one live request through `entry` and fold the result into its stats.
 * `fetchFn(url, {proxy})` is injected (relay/lib/net.fetchUrl) so this file
 * stays free of transport code.
 */
async function testEntry(entry, fetchFn, opts = {}) {
  const testUrl = opts.testUrl || process.env.GHOSTSHELL_TEST_URL || DEFAULT_TEST_URL;
  const timeout = opts.timeout || 12000;
  const started = Date.now();

  try {
    const res = await fetchFn(testUrl, {
      proxy: parseProxy(entry.raw),
      timeout,
      maxRedirects: 3,
      maxBody: 64 * 1024,
      validateUrl: opts.validateUrl,
    });
    const ms = Date.now() - started;

    if (res.status >= 400) throw new Error(`test URL returned HTTP ${res.status}`);
    const info = parseTestBody(res.body);

    entry.wins++;
    entry.lastOk = true;
    entry.lastMs = ms;
    entry.avgMs = entry.avgMs ? Math.round(entry.avgMs * 0.6 + ms * 0.4) : ms;
    entry.lastCheck = Date.now();
    entry.exitIp = info.exitIp;
    entry.isp = info.isp;
    entry.hosting = info.hosting;
    entry.error = null;
    return { ok: true, ms, exitIp: info.exitIp, score: score(entry) };
  } catch (err) {
    const ms = Date.now() - started;
    entry.fails++;
    entry.lastOk = false;
    entry.lastMs = ms;
    entry.lastCheck = Date.now();
    entry.error = String(err && err.message ? err.message : err);
    return { ok: false, ms, error: entry.error, score: score(entry) };
  }
}

/** Test many entries with a small concurrency cap. Mutates entries. */
async function testAll(entries, fetchFn, opts = {}) {
  const concurrency = opts.concurrency || 6;
  const queue = [...entries];
  const results = [];
  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      results.push({ id: entry.id, raw: entry.raw, ...(await testEntry(entry, fetchFn, opts)) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return results;
}

// ── persistence ──────────────────────────────────────────────────────────

function load(file = POOL_FILE) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) return [];
    // drop entries whose credentials/host no longer parse
    return data.filter((e) => {
      try {
        return !!parseProxy(e.raw);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function save(entries, file = POOL_FILE) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(entries, null, 2) + '\n');
    return true;
  } catch {
    return false; // read-only home, etc. — the pool just won't persist.
  }
}

module.exports = {
  POOL_FILE,
  DEFAULT_TEST_URL,
  parse,
  parseTestBody,
  score,
  select,
  testEntry,
  testAll,
  load,
  save,
};
