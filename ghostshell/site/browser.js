/* GhostShell in-site browser — search, embedded viewer, proxy manager.
 *
 * Two transport modes, picked automatically on boot:
 *
 *   relay mode  the local relay (127.0.0.1:8787) answers → pages are fetched,
 *               rewritten and proxied by it: SOCKS/HTTP egress, cookie jar,
 *               SSRF guard. This is the real thing and it gets used whenever
 *               it is available.
 *
 *   web mode    no relay (e.g. the static GitHub Pages deployment) → the page
 *               does the same job on its own. Documents are fetched through a
 *               pool of CORS gateways, rewritten in the browser (scripts and
 *               handlers stripped, every URL re-pointed at the chosen
 *               gateway) and rendered into the sandboxed iframe via srcdoc.
 *               The pool lives in localStorage, is tested live against
 *               ipwho.is / ipapi.co / ip-api.com for exit IP, country, ISP and
 *               proxy/hosting flags, and rotates on every search when
 *               #chkRotateSearch is on.
 *
 * The “relay not running” overlay is never shown: web mode is a working
 * browser. The local relay is optional — it only adds SOCKS/residential
 * egress, cookie isolation and the SSRF guard.
 */
(function () {
  'use strict';

  // Probe the page's own origin first in ping(); if that isn't the relay and
  // we aren't already on a loopback HTTP origin, fall back to 127.0.0.1:8787.
  var isLoopback = location.protocol === 'http:' &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
  var RELAY = isLoopback ? location.origin : 'http://127.0.0.1:8787';

  var SEARCH = 'https://lite.duckduckgo.com/lite/?q=';

  var MODE = 'web';                 // 'relay' | 'web'
  var RELAY_SANDBOX = 'allow-forms allow-same-origin';
  // srcdoc + no allow-same-origin ⇒ opaque origin: injected scripts cannot
  // touch the parent, and the page's own scripts are stripped anyway.
  var WEB_SANDBOX = 'allow-scripts allow-forms allow-popups';
  // Direct (unproxied) iframe fallback: cross-origin content, so keeping
  // allow-same-origin grants it nothing over the parent.
  var DIRECT_SANDBOX = 'allow-scripts allow-forms allow-popups allow-same-origin';

  var BASE_COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'IN', name: 'India' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'FR', name: 'France' },
    { code: 'CA', name: 'Canada' },
    { code: 'SG', name: 'Singapore' },
    { code: 'JP', name: 'Japan' },
    { code: 'AU', name: 'Australia' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SE', name: 'Sweden' },
    { code: 'BR', name: 'Brazil' },
    { code: 'AE', name: 'UAE' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var viewer = $('viewer');
  var relayUp = false;
  var lastPoolData = null;

  // ── history (toolbar-level navigations) ────────────────────────────────
  var hist = [];
  var hIndex = -1;

  // active egress selection, shared by both modes
  var sel = {
    id: 'auto',                    // 'auto' | 'direct' | <entry id>
    raw: null,
    country: null,
    ip: null,
  };
  var directFallback = false;      // this one page loaded unproxied

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function setPill(state, text) {
    var pill = $('relayPill');
    pill.className = 'pill ' + state;
    pill.textContent = text;
  }

  // ── country helpers ───────────────────────────────────────────────────

  function getSelectedCountry() {
    var el = $('countrySelect') || $('panelCountrySelect');
    return (el && el.value) ? el.value.toUpperCase() : 'ALL';
  }

  function setSelectedCountry(code) {
    var cc = (code || 'ALL').toUpperCase();
    var c1 = $('countrySelect');
    var c2 = $('panelCountrySelect');
    ensureCountryOption(cc);
    if (c1) c1.value = cc;
    if (c2) c2.value = cc;
  }

  function ensureCountryOption(code) {
    if (!code || code === 'ALL') return;
    var cc = String(code).toUpperCase();
    ['countrySelect', 'panelCountrySelect'].forEach(function (id) {
      var selEl = $(id);
      if (!selEl) return;
      for (var i = 0; i < selEl.options.length; i++) {
        if (selEl.options[i].value.toUpperCase() === cc) return;
      }
      var opt = document.createElement('option');
      opt.value = cc;
      opt.textContent = cc + ' · Pool';
      selEl.appendChild(opt);
    });
  }

  function syncCountryOptionsFromPool(data) {
    if (!data) return;
    var current = getSelectedCountry();
    var poolCodes = [];
    if (Array.isArray(data.countries)) {
      poolCodes = data.countries;
    } else if (Array.isArray(data.proxies)) {
      data.proxies.forEach(function (p) {
        if (p.countryCode) poolCodes.push(p.countryCode);
      });
    }
    poolCodes.forEach(function (c) { ensureCountryOption(c); });
    setSelectedCountry(current);
  }

  // ── relay API ─────────────────────────────────────────────────────────

  function api(path, opts) {
    return fetch(RELAY + path, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function probe(base) {
    return fetch(base + '/api/ping').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || !data.ok || !data.version) throw new Error('not a relay');
      RELAY = base;
      return data;
    });
  }

  function ping() {
    return probe(location.origin).catch(function (err) {
      if (isLoopback) throw err;
      return probe('http://127.0.0.1:8787');
    }).then(function (data) {
      enterRelayMode(data);
      return data;
    }).catch(function () {
      enterWebMode();
      return null;
    });
  }

  // ── mode switching ────────────────────────────────────────────────────

  function enterRelayMode(data) {
    var wasWeb = MODE !== 'relay';
    relayUp = true;
    MODE = 'relay';
    setPill('online', 'relay: online · v' + data.version);
    $('stRelay').textContent = 'online · v' + data.version;
    $('stIdentity').textContent = '#' + data.identity;
    $('relayDown').classList.remove('show');
    viewer.style.display = '';
    $('btnReload').disabled = false;
    if ($('webNote')) $('webNote').style.display = 'none';
    if (data.activeProxy && data.activeProxy !== 'direct') {
      sel.raw = data.activeProxy;
      sel.id = 'auto';
    }
    updateEgress();
    if (wasWeb) {
      // web-mode gateway ids mean nothing to the relay's pool
      sel.id = 'auto';
      sel.raw = null;
      sel.country = null;
      sel.ip = null;
      loadProxies();
      if (hIndex >= 0) navigate(hist[hIndex].target, false);
      else if ($('addr').value) { var t = targetFor($('addr').value); if (t) navigate(t); }
      toast('local relay connected · using it for egress');
    }
  }

  var webLoaded = false;

  function enterWebMode() {
    relayUp = false;
    MODE = 'web';
    setPill('web', 'relay: web mode');
    $('stRelay').textContent = 'web mode (built-in)';
    $('relayDown').classList.remove('show');   // never block the browser
    viewer.style.display = '';
    $('btnReload').disabled = false;
    if ($('webNote')) $('webNote').style.display = '';
    if (!webLoaded) {
      webLoaded = true;
      webLoad();
      if ($('stIdentity').textContent === '—' || $('stIdentity').textContent === '') {
        $('stIdentity').textContent = '#' + WEB.identity;
      }
      webRender();
    }
    updateEgress();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  WEB MODE — the relay-free path
  // ═══════════════════════════════════════════════════════════════════════

  var WEB = {
    KEY: 'ghostshell.webPool.v1',
    ACTIVE_KEY: 'ghostshell.webActive.v1',
    identity: 1,
    pool: [],
    lastId: null,
    testing: false,
    // Live-tested on boot. ipwho.is / ipapi.co give exit IP + country + ISP;
    // ip-api.com (the same source the relay uses) carries the proxy/hosting
    // flags. Order = preference.
    testEndpoints: [
      'https://ipwho.is/',
      'https://ipapi.co/json/',
      'http://ip-api.com/json/?fields=status,message,country,countryCode,query,isp,org,as,proxy,hosting',
    ],
    // Built-in defaults so web mode works with zero setup. The public list in
    // proxy-sources.json (same directory) is merged in on top of these.
    defaults: [
      { name: 'AllOrigins raw',   raw: 'https://api.allorigins.win/raw?url={url}' },
      { name: 'AllOrigins get',   raw: 'https://api.allorigins.win/get?url={url}', json: 'contents' },
      { name: 'CodeTabs',         raw: 'https://api.codetabs.com/v1/proxy?quest={url}' },
      { name: 'Corsfix',          raw: 'https://proxy.corsfix.com/?{rawurl}' },
      { name: 'cors.workers.dev', raw: 'https://test.cors.workers.dev/?{rawurl}' },
      { name: 'cors.lol',         raw: 'https://api.cors.lol/?url={url}' },
      { name: 'cors.eu.org',      raw: 'https://cors.eu.org/{rawurl}' },
      { name: 'thingproxy',       raw: 'https://thingproxy.freeboard.io/fetch/{rawurl}' },
      { name: 'Whatever Origin',  raw: 'https://www.whateverorigin.org/get?url={url}', json: 'contents' },
      { name: 'corsproxy.io',     raw: 'https://corsproxy.io/?url={url}' },
      { name: 'Jina Reader',      raw: 'https://r.jina.ai/{rawurl}', text: true },
    ],
    // Every gateway is a datacenter by nature, so `hosting` is recorded but
    // does not decide cleanliness here. What makes an exit “detected” is
    // being flagged as an anonymous proxy / VPN / Tor exit — exactly what
    // “new non-detected IP on every search” promises to avoid.
    staleMs: 15 * 60 * 1000,
    failMs: 60 * 1000,
  };

  // ── web pool: parsing ─────────────────────────────────────────────────

  function webId(raw) {
    var h = 5381;
    var s = String(raw);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'w' + h.toString(36);
  }

  /** Split a pasted line into a spec plus an optional #US / [DE] hint. */
  function webSplitHint(line) {
    var s = String(line).trim();
    var cc = null;
    var m = /^(.*?)\s*#\s*([a-zA-Z]{2})\b.*$/.exec(s);
    if (m && m[1].trim() !== '') { s = m[1].trim(); cc = m[2].toUpperCase(); }
    var b = /\[([a-zA-Z]{2})\]/.exec(s);
    if (b) {
      if (!cc) cc = b[1].toUpperCase();
      s = s.replace(/\[[a-zA-Z]{2}\]/g, '').trim();
    }
    return { spec: s, countryCode: cc };
  }

  /**
   * Classify one line:
   *   gateway   a URL template containing {url} / {rawurl} — usable right here
   *   http / socks5 / socks4 / https
   *             a real proxy — stored and shown, but only the local relay can
   *             dial it from a browser, so it is flagged "needs relay".
   */
  function webMakeEntry(line) {
    var parts = webSplitHint(line);
    var spec = parts.spec;
    if (!spec) return null;
    var e = {
      id: webId(spec),
      raw: spec,
      name: null,
      type: 'gateway',
      json: null,
      text: false,
      countryCode: parts.countryCode || null,
      country: null,
      isp: null,
      exitIp: null,
      hosting: null,
      isProxy: null,
      vpn: null,
      tor: null,
      wins: 0,
      fails: 0,
      avgMs: 0,
      lastMs: 0,
      lastOk: null,
      lastCheck: 0,
      error: null,
      addedAt: Date.now(),
    };
    if (/\{(raw)?url\}/.test(spec)) {
      e.type = 'gateway';
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(spec)) return null;
      return e;
    }
    var pm = /^(socks5|socks4|socks|https?):\/\//i.exec(spec);
    var type = pm ? pm[1].toLowerCase() : 'http';
    if (type === 'socks') type = 'socks5';
    var body = pm ? spec.slice(pm[0].length) : spec;
    var hp = /^([^@\/]+@)?([^:\/]+):(\d+)\/?$/.exec(body);
    if (!hp) return null;
    e.type = type;
    e.host = hp[2];
    e.port = Number(hp[3]);
    e.raw = type + '://' + (hp[1] ? hp[1] : '') + e.host + ':' + e.port;
    e.id = webId(e.raw);
    e.error = 'needs the local relay (browsers cannot dial ' + type + ' directly)';
    return e;
  }

  function webAddText(text, opts) {
    opts = opts || {};
    var added = 0;
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '#' || line.indexOf('//') === 0) continue;
      var e = null;
      try { e = webMakeEntry(line); } catch (err) { e = null; }
      if (!e) continue;
      if (opts.json != null) e.json = opts.json;
      if (opts.text != null) e.text = Boolean(opts.text);
      var existing = webById(e.id);
      if (existing) {
        if (e.countryCode && !existing.countryCode) existing.countryCode = e.countryCode;
        continue;
      }
      WEB.pool.push(e);
      added++;
    }
    webSave();
    return added;
  }

  function webById(id) {
    for (var i = 0; i < WEB.pool.length; i++) if (WEB.pool[i].id === id) return WEB.pool[i];
    return null;
  }

  // ── web pool: persistence ─────────────────────────────────────────────

  function webSave() {
    try {
      localStorage.setItem(WEB.KEY, JSON.stringify(WEB.pool));
      localStorage.setItem(WEB.ACTIVE_KEY, JSON.stringify({
        active: sel.id,
        lastId: WEB.lastId,
        identity: WEB.identity,
      }));
    } catch (e) { /* private mode — pool stays in memory */ }
  }

  function webLoad() {
    var raw = null;
    try { raw = localStorage.getItem(WEB.KEY); } catch (e) { raw = null; }
    var arr = null;
    if (raw) {
      try { arr = JSON.parse(raw); } catch (e) { arr = null; }
    }
    if (Array.isArray(arr) && arr.length) {
      WEB.pool = arr.map(webHydrate).filter(Boolean);
    } else {
      WEB.pool = WEB.defaults.map(function (d) {
        var e = webMakeEntry(d.raw) || {};
        e.name = d.name || null;
        e.json = d.json || null;
        e.text = Boolean(d.text);
        if (d.countryCode) e.countryCode = d.countryCode;
        e.error = null;
        return e;
      });
      webSave();
    }
    try {
      var st = JSON.parse(localStorage.getItem(WEB.ACTIVE_KEY) || '{}');
      if (st.identity) WEB.identity = st.identity;
      if (st.lastId) WEB.lastId = st.lastId;
      if (st.active) sel.id = st.active;
    } catch (e) { /* ignore */ }
    if (sel.id && sel.id !== 'auto' && sel.id !== 'direct') {
      var e2 = webById(sel.id);
      if (e2) { sel.raw = e2.raw; sel.country = e2.countryCode; sel.ip = e2.exitIp; }
      else sel.id = 'auto';
    }
  }

  function webHydrate(e) {
    if (!e || !e.raw) return null;
    var fresh = webMakeEntry(e.raw);
    if (!fresh) return null;
    Object.keys(fresh).forEach(function (k) {
      if (e[k] === undefined || e[k] === null) return;
      fresh[k] = e[k];
    });
    fresh.id = webId(e.raw);
    return fresh;
  }

  // ── web pool: scoring / selection ─────────────────────────────────────

  function webIsDetected(e) {
    return Boolean(e && (e.isProxy === true || e.vpn === true || e.tor === true));
  }

  function webIsClean(e) {
    return Boolean(e && e.type === 'gateway' && !webIsDetected(e) && e.lastOk !== false);
  }

  function webScore(e) {
    var n = e.wins + e.fails;
    var reliability = (e.wins + 1) / (n + 2);              // Laplace
    var speed = 1 / (1 + (e.avgMs || 3000) / 3000);        // 0ms→1.0, 3s→0.5
    var v = 100 * (0.65 * reliability + 0.35 * speed);
    var now = Date.now();
    if (!e.lastCheck || now - e.lastCheck > WEB.staleMs) v *= 0.6;
    else if (e.lastOk === false && now - e.lastCheck < WEB.failMs) v *= 0.35;
    if (webIsDetected(e)) v *= 0.4;
    return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  }

  function webCandidates(opts) {
    var cc = (!opts.country || String(opts.country).toUpperCase() === 'ALL')
      ? null
      : String(opts.country).toUpperCase();
    var cleanOnly = opts.cleanOnly !== false;
    var exclude = opts.exclude || [];
    var out = WEB.pool.filter(function (e) {
      if (e.type !== 'gateway') return false;
      if (exclude.indexOf(e.id) !== -1) return false;
      if (cc && (e.countryCode || '').toUpperCase() !== cc) return false;
      if (opts.avoidLast && WEB.lastId && e.id === WEB.lastId) return false;
      if (cleanOnly && !webIsClean(e)) return false;
      return true;
    });
    if (!out.length) {
      // Relax: allow the one we just used, and entries that simply have not
      // been tested yet (lastOk === null) — but never a known failure.
      out = WEB.pool.filter(function (e) {
        if (e.type !== 'gateway') return false;
        if (exclude.indexOf(e.id) !== -1) return false;
        if (cc && (e.countryCode || '').toUpperCase() !== cc) return false;
        return e.lastOk !== false;
      });
    }
    if (!out.length && !cleanOnly) {
      out = WEB.pool.filter(function (e) {
        return e.type === 'gateway' && exclude.indexOf(e.id) === -1;
      });
    }
    return out;
  }

  function webPick(opts) {
    opts = opts || {};
    if (opts.country == null) opts.country = getSelectedCountry();
    var pool = webCandidates(opts);
    if (!pool.length) return null;
    if (opts.mode === 'best') {
      var ranked = pool.slice().sort(function (a, b) { return webScore(b) - webScore(a); });
      var top = ranked.slice(0, Math.min(3, ranked.length));
      var weights = top.map(function (e) { return Math.max(webScore(e), 1); });
      var r = Math.random() * weights.reduce(function (a, b) { return a + b; }, 0);
      for (var i = 0; i < top.length; i++) {
        r -= weights[i];
        if (r <= 0) return top[i];
      }
      return top[0];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Best remaining gateway that has not been tried yet for this navigation —
   * used for the fallback chain, where a "dead" gateway is worth one more
   * shot (public CORS proxies rate-limit and recover) but a known good one
   * should still be tried first.
   */
  function webAnyExcept(tried, country) {
    var cc = (country && String(country).toUpperCase() !== 'ALL')
      ? String(country).toUpperCase() : null;
    var pool = WEB.pool.filter(function (e) {
      if (e.type !== 'gateway') return false;
      if (tried.indexOf(e.id) !== -1) return false;
      if (cc && (e.countryCode || '').toUpperCase() !== cc) return false;
      return true;
    });
    if (!pool.length) return null;
    pool.sort(function (a, b) {
      var sa = webScore(a) + (a.lastOk === false ? -1000 : 0);
      var sb = webScore(b) + (b.lastOk === false ? -1000 : 0);
      return sb - sa;
    });
    return pool[0];
  }

  function webActiveEntry() {
    if (sel.id === 'direct') return null;
    if (sel.id && sel.id !== 'auto') {
      var e = webById(sel.id);
      if (e && e.type === 'gateway') return e;
    }
    return webPick({ mode: 'best', cleanOnly: true });
  }

  // ── web transport ─────────────────────────────────────────────────────

  function webGatewayUrl(entry, target) {
    var t = entry.raw;
    if (t.indexOf('{rawurl}') !== -1) return t.split('{rawurl}').join(target);
    if (t.indexOf('{url}') !== -1) return t.split('{url}').join(encodeURIComponent(target));
    return t + encodeURIComponent(target);
  }

  function webFetch(entry, target, timeout) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeout || 20000);
    }
    var done = function (v) { if (timer) clearTimeout(timer); return v; };
    return fetch(webGatewayUrl(entry, target), {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined,
      headers: { Accept: '*/*' },
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = text;
        if (entry.json) {
          try {
            var j = JSON.parse(text);
            var val = String(entry.json).split('.').reduce(function (o, k) {
              return (o == null) ? undefined : o[k];
            }, j);
            body = (typeof val === 'string') ? val : JSON.stringify(val == null ? {} : val);
          } catch (err) { body = ''; }
        }
        return {
          ok: res.ok,
          status: res.status,
          contentType: (res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''),
          text: body || '',
          target: target,
        };
      });
    }).then(done, function (err) { done(); throw err; });
  }

  // ── web pool: live testing (ipwho.is / ipapi.co / ip-api.com) ─────────

  function parseIpInfo(text) {
    var j = null;
    try { j = JSON.parse(String(text).trim()); } catch (e) { j = null; }
    if (j && typeof j === 'object') {
      if (j.success === false) return null;
      var sec = j.security || {};
      var conn = j.connection || {};
      var out = {
        exitIp: j.ip || j.query || null,
        country: j.country || j.country_name || null,
        countryCode: ((j.country_code || j.countryCode || '') + '').toUpperCase() || null,
        isp: conn.isp || conn.org || j.org || j.isp || j.as || null,
        hosting: typeof sec.hosting === 'boolean' ? sec.hosting
          : (typeof j.hosting === 'boolean' ? j.hosting : null),
        isProxy: typeof sec.proxy === 'boolean' ? sec.proxy
          : (typeof j.proxy === 'boolean' ? j.proxy : null),
        vpn: typeof sec.vpn === 'boolean' ? sec.vpn : null,
        tor: typeof sec.tor === 'boolean' ? sec.tor : null,
      };
      if (sec.anonymous === true) out.isProxy = true;
      if (out.exitIp) return out;
      return null;
    }
    var m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(String(text));
    return m ? { exitIp: m[1] } : null;
  }

  function webProbe(entry, url, timeout) {
    return webFetch(entry, url, timeout || 10000).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var info = parseIpInfo(res.text);
      if (!info || !info.exitIp) throw new Error('no IP in test response');
      return info;
    });
  }

  function webTestOne(entry) {
    if (entry.type !== 'gateway') {
      entry.error = entry.error || 'needs the local relay';
      return Promise.resolve(null);
    }
    var started = Date.now();
    var eps = WEB.testEndpoints;
    return webProbe(entry, eps[0])
      .catch(function () { return webProbe(entry, eps[1]); })
      .catch(function () { return webProbe(entry, eps[2]); })
      .then(function (info) {
        var ms = Date.now() - started;
        entry.wins++;
        entry.lastOk = true;
        entry.lastMs = ms;
        entry.avgMs = entry.avgMs ? Math.round(entry.avgMs * 0.6 + ms * 0.4) : ms;
        entry.lastCheck = Date.now();
        entry.exitIp = info.exitIp;
        if (info.isp) entry.isp = info.isp;
        if (info.country) entry.country = info.country;
        if (info.countryCode) entry.countryCode = info.countryCode;
        if (info.hosting != null) entry.hosting = info.hosting;
        if (info.isProxy != null) entry.isProxy = info.isProxy;
        if (info.vpn != null) entry.vpn = info.vpn;
        if (info.tor != null) entry.tor = info.tor;
        entry.error = null;
        return entry;
      })
      .then(function (e) {
        // ipwho.is / ipapi.co do not expose proxy & hosting flags on the free
        // tier — ip-api.com does, and it is the same source the relay uses.
        if (e.hosting != null && e.isProxy != null) return e;
        return webProbe(e, eps[2], 8000).then(function (extra) {
          if (extra.hosting != null) e.hosting = extra.hosting;
          if (extra.isProxy != null) e.isProxy = extra.isProxy;
          if (extra.isp) e.isp = extra.isp;
          return e;
        }).catch(function () { return e; });
      })
      .catch(function (err) {
        entry.fails++;
        entry.lastOk = false;
        entry.lastMs = Date.now() - started;
        entry.lastCheck = Date.now();
        entry.error = String((err && err.message) || err || 'test failed');
        return entry;
      });
  }

  function webTestAll(limit) {
    if (WEB.testing) return Promise.resolve(null);
    WEB.testing = true;
    var targets = WEB.pool.filter(function (e) { return e.type === 'gateway'; });
    if (limit) targets = targets.slice(0, limit);
    var queue = targets.slice();
    var concurrency = 3;
    function worker() {
      if (!queue.length) return Promise.resolve();
      return webTestOne(queue.shift()).then(worker);
    }
    var workers = [];
    for (var i = 0; i < Math.min(concurrency, targets.length); i++) workers.push(worker());
    return Promise.all(workers).then(function () {
      WEB.testing = false;
      webSave();
      webRender();
      updateEgress();
      return null;
    });
  }

  // ── web rewriting ─────────────────────────────────────────────────────

  var WEB_STRIP_ATTR = /^(integrity|nonce|crossorigin|formaction|srcdoc|ping|autofocus)$/i;

  var WEB_URL_ATTRS = {
    a: ['href'], area: ['href'], link: ['href'],
    img: ['src', 'srcset', 'longdesc'], source: ['src', 'srcset'],
    video: ['src', 'poster'], audio: ['src'], track: ['src'],
    input: ['src'], iframe: ['src'], frame: ['src'], embed: ['src'],
    object: ['data'], form: ['action'],
    body: ['background'], table: ['background'], td: ['background'], th: ['background'],
    blockquote: ['cite'], q: ['cite'], del: ['cite'], ins: ['cite'],
    use: ['href', 'xlink:href'], image: ['href', 'xlink:href'],
  };

  function webAbs(ref, base) {
    if (ref == null) return null;
    var raw = String(ref).trim();
    if (raw === '' || raw.charAt(0) === '#') return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) return null;
    try {
      var u = new URL(raw, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.href;
    } catch (e) { return null; }
  }

  function webUnescapeAttr(v) {
    return String(v)
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(Number(d)); })
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function webEscapeAttr(v) {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function webSrcset(value, base, entry) {
    return String(value).split(/,\s+/).map(function (cand) {
      var t = cand.trim();
      var sp = t.search(/\s/);
      var urlPart = sp === -1 ? t : t.slice(0, sp);
      var desc = sp === -1 ? '' : t.slice(sp);
      var abs = webAbs(webUnescapeAttr(urlPart), base);
      return abs ? webGatewayUrl(entry, abs) + desc : t;
    }).join(', ');
  }

  function webCssUrls(css, base, entry) {
    return String(css).replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, function (m, q, ref) {
      var abs = webAbs(webUnescapeAttr(ref), base);
      return abs ? 'url(' + q + webGatewayUrl(entry, abs) + q + ')' : m;
    }).replace(/@import\s+(['"])([^'"]+)\1/gi, function (m, q, ref) {
      var abs = webAbs(webUnescapeAttr(ref), base);
      return abs ? '@import ' + q + webGatewayUrl(entry, abs) + q : m;
    });
  }

  var ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))|([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?=[\s\/>]|$)/g;
  var TAG_RE = /<([a-zA-Z][-a-zA-Z0-9_:.]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

  function webRewriteAttrs(tag, attrs, base, entry, stats) {
    var lc = tag.toLowerCase();
    var urlAttrs = WEB_URL_ATTRS[lc] || [];
    var isDoc = (lc === 'a' || lc === 'area');
    var out = '';
    var m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(attrs)) !== null) {
      var name = m[1] || m[6];
      if (!name) continue;
      var value = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : null));
      var nameLc = name.toLowerCase();

      if (/^on/.test(nameLc)) { stats.handlers++; continue; }
      if (WEB_STRIP_ATTR.test(nameLc)) continue;
      if (nameLc === 'target' && (isDoc || lc === 'form')) continue;

      if (urlAttrs.indexOf(nameLc) !== -1 && value !== null) {
        if (nameLc === 'srcset' || nameLc === 'imagesrcset') {
          out += ' ' + name + '="' + webEscapeAttr(webSrcset(value, base, entry)) + '"';
          stats.urls++;
          continue;
        }
        var abs = webAbs(webUnescapeAttr(value), base);
        if (!abs) {
          // fragments, mailto:, data: — keep them, except the dangerous ones
          if (/^\s*(javascript|vbscript)\s*:/i.test(webUnescapeAttr(value))) continue;
          out += ' ' + name + '="' + value.replace(/"/g, '&quot;') + '"';
          continue;
        }
        if (isDoc) {
          // Links stay absolute; the injected bridge posts them to the parent
          // which re-fetches through the gateway and re-renders.
          out += ' data-gs-href="' + webEscapeAttr(abs) + '" href="' + webEscapeAttr(abs) + '"';
          stats.urls++;
          continue;
        }
        if (lc === 'form' && nameLc === 'action') {
          out += ' data-gs-action="' + webEscapeAttr(abs) + '" action="' +
                 webEscapeAttr(webGatewayUrl(entry, abs)) + '"';
          stats.urls++;
          continue;
        }
        out += ' ' + name + '="' + webEscapeAttr(webGatewayUrl(entry, abs)) + '"';
        stats.urls++;
        continue;
      }

      if (value === null) out += ' ' + name;
      else out += ' ' + name + '="' + value.replace(/"/g, '&quot;') + '"';
    }
    return out;
  }

  function webRewrite(html, base, entry) {
    var stats = { scripts: 0, handlers: 0, urls: 0 };
    html = String(html == null ? '' : html);

    // 1. active content out — a rendered page must not be able to run code,
    //    and it must not beacon behind the chosen egress either.
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, function () { stats.scripts++; return ''; });
    html = html.replace(/<\/?script\b[^>]*>/gi, function () { stats.scripts++; return ''; });
    html = html.replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, '');
    html = html.replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');

    // 2. attributes: strip handlers, absolutise + re-point every URL
    html = html.replace(TAG_RE, function (m, tag, attrs) {
      // <base> must go: we inject our own, and a page-supplied one would
      // re-base every URL we just absolutised.
      if (/^(script|noscript|template|base)$/i.test(tag)) return '';
      var rewritten = webRewriteAttrs(tag, attrs, base, entry, stats);
      return '<' + tag + rewritten + '>';
    });

    // 3. inline <style> / style="" url() references
    html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, function (m, open, css, close) {
      return open + webCssUrls(css, base, entry) + close;
    });
    html = html.replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, function (m, quoted, dq, sq) {
      var css = dq !== undefined ? dq : sq;
      return ' style="' + webCssUrls(css, base, entry).replace(/"/g, '&quot;') + '"';
    });

    // 4. our own head: base, stats, egress, referrer policy
    var labels = webEgressLabel(entry);
    var head =
      '<base href="' + webEscapeAttr(base) + '">' +
      '<meta name="referrer" content="no-referrer">' +
      '<meta name="gs-stats" content="scripts=' + stats.scripts + ';handlers=' + stats.handlers + ';urls=' + stats.urls + '">' +
      '<meta name="gs-egress" content="' + webEscapeAttr(labels.content) + '"' +
      ' data-proxy-id="' + webEscapeAttr(entry ? entry.id : 'direct') + '"' +
      ' data-proxy-raw="' + webEscapeAttr(entry ? entry.raw : 'direct') + '"' +
      ' data-country="' + webEscapeAttr(entry && entry.countryCode ? entry.countryCode : '') + '"' +
      ' data-ip="' + webEscapeAttr(entry && entry.exitIp ? entry.exitIp : '') + '">';

    if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, function (m) { return m + head; });
    else if (/<html\b[^>]*>/i.test(html)) html = html.replace(/<html\b[^>]*>/i, function (m) { return m + '<head>' + head + '</head>'; });
    else html = head + html;

    if (!/<\/head>/i.test(html) && /<body/i.test(html)) html = html.replace(/<body/i, '</head><body');

    // 5. click / submit bridge back to the parent frame
    html = html.replace(/<\/body\s*>/i, function () { return webBridge(base) + '</body>'; });
    if (!/<\/body\s*>/i.test(html)) html += webBridge(base);

    return { html: html, stats: stats };
  }

  /** Injected into every rewritten document: turns clicks into parent navigations. */
  function webBridge(base) {
    var b = 'var B=' + JSON.stringify(String(base)) + ';';
    return '<script>' + b +
      '(function(){' +
      'var send=function(d){try{parent.postMessage(d,"*")}catch(e){}};' +
      'var abs=function(h){try{return new URL(h,B).href}catch(e){return h}};' +
      'var ok=function(h){return h&&h.charAt(0)!=="#"&&!/^(mailto|tel|javascript|data|about):/i.test(h)};' +
      'document.addEventListener("click",function(e){' +
      'if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;' +
      'var n=e.target;while(n&&n!==document&&n.nodeName!=="A"&&n.nodeName!=="AREA")n=n.parentNode;' +
      'if(!n||n===document)return;' +
      'var h=n.getAttribute("data-gs-href")||n.getAttribute("href")||"";' +
      'if(!ok(h))return;e.preventDefault();send({__gsNav:abs(h)})},true);' +
      'document.addEventListener("submit",function(e){' +
      'var f=e.target;if(!f||f.nodeName!=="FORM")return;e.preventDefault();' +
      'var a=f.getAttribute("data-gs-action")||f.getAttribute("action")||"";' +
      'if(!ok(a))return;' +
      'var m=(f.getAttribute("method")||"get").toLowerCase(),q=[];' +
      'for(var i=0;i<f.elements.length;i++){var el=f.elements[i];' +
      'if(!el.name||el.disabled)continue;' +
      'if((el.type==="checkbox"||el.type==="radio")&&!el.checked)continue;' +
      'q.push(encodeURIComponent(el.name)+"="+encodeURIComponent(el.value));}' +
      'send({__gsForm:{action:abs(a),method:m,query:q.join("&")}})},true);' +
      '})();' +
      '</scr' + 'ipt>';
  }

  function webEgressLabel(entry) {
    if (!entry) return { content: 'direct' };
    var label = entry.name ? entry.name + ' (' + shortHost(entry.raw) + ')' : entry.raw;
    if (entry.countryCode) label += ' [' + entry.countryCode + ']';
    if (entry.exitIp) label += ' (' + entry.exitIp + ')';
    return { content: label };
  }

  function shortHost(raw) {
    var m = /^(?:[a-z]+:\/\/)?([^/?#]+)/i.exec(String(raw));
    return m ? m[1] : String(raw);
  }

  // ── web rendering helpers ─────────────────────────────────────────────

  function webShell(body, title) {
    return '<!doctype html><meta charset="utf-8"><title>' + escapeHtml(title || '') + '</title>' +
      '<style>' +
      'body{font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#12151c;' +
      'background:#fff;margin:0;padding:26px 30px;max-width:820px}' +
      'a{color:#0a6c74}pre{white-space:pre-wrap;word-break:break-word;font:12.5px/1.5 ui-monospace,monospace;' +
      'background:#f4f6f8;padding:14px;border-radius:10px;color:#1d2530}' +
      'code{font:12.5px ui-monospace,monospace}.box{border:1px solid #dfe3e8;border-radius:12px;padding:18px 20px}' +
      'h1{font-size:20px;margin:0 0 10px}h2{font-size:15px;margin:22px 0 8px}' +
      '.muted{color:#5b6472;font-size:13px}' +
      '</style>' + body;
  }

  function webTextDoc(text, target) {
    var body = String(text)
      .replace(/^(Title|URL Source|Published Time|Warning|Markdown Content):.*$/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\r/g, '');
    body = escapeHtml(body.trim())
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (m, label, href) {
        return '<a href="' + href + '" data-gs-href="' + href + '">' + label + '</a>';
      })
      .replace(/(https?:\/\/[^\s<]+)/g, function (m, href) {
        return '<a href="' + href + '" data-gs-href="' + href + '">' + href + '</a>';
      })
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return webShell(
      '<div class="box"><h1>Reader view</h1>' +
      '<p class="muted">' + escapeHtml(shortHost(target)) + ' — text extracted by the gateway (scripts and layout removed).</p>' +
      '<p>' + body + '</p></div>' + webBridge(target),
      target
    );
  }

  function webBinaryDoc(target, contentType) {
    if (/^image\//i.test(contentType)) {
      return webShell(
        '<div class="box"><h1>Image</h1><p class="muted">' + escapeHtml(target) + '</p>' +
        '<p><img src="' + webEscapeAttr(target) + '" style="max-width:100%;height:auto"></p></div>' +
        webBridge(target),
        target
      );
    }
    return webShell(
      '<div class="box"><h1>Cannot render this response</h1>' +
      '<p class="muted">' + escapeHtml(contentType || 'unknown type') + '</p>' +
      '<p><a href="' + webEscapeAttr(target) + '" target="_blank" rel="noopener">Open in a new tab ↗</a></p></div>' +
      webBridge(target),
      target
    );
  }

  function webErrorDoc(target, reason) {
    return webShell(
      '<div class="box"><h1>This page did not load</h1>' +
      '<p class="muted">' + escapeHtml(target) + '</p>' +
      '<p>' + escapeHtml(reason || 'every gateway in the pool refused the request') + '</p>' +
      '<p class="muted">Public CORS gateways rate-limit and go down. Hit <b>Test all</b> in the proxy ' +
      'panel to re-score the pool, add your own gateway URL (any HTTPS URL containing ' +
      '<code>{url}</code>), or start the local relay for a private exit.</p>' +
      '<p><a href="' + webEscapeAttr(target) + '" target="_blank" rel="noopener">Open in a new tab ↗</a></p></div>' +
      webBridge(target),
      'cannot load'
    );
  }

  // ── web navigation ────────────────────────────────────────────────────

  function setSandbox(value) {
    if (viewer.getAttribute('sandbox') !== value) viewer.setAttribute('sandbox', value);
  }

  function webSetSrc(html) {
    viewer.removeAttribute('src');
    viewer.srcdoc = html;
  }

  function webSetUrl(url) {
    viewer.removeAttribute('srcdoc');
    viewer.src = url;
  }

  var MAX_SRCDOC = 4 * 1024 * 1024;

  function webRenderDoc(target, entry, tried) {
    tried = tried || [];
    if (!entry) entry = webAnyExcept(tried);
    if (!entry) {
      setSandbox(WEB_SANDBOX);
      webSetSrc(webErrorDoc(target, 'No usable gateway in the pool. Add one, or pick a different country filter.'));
      toast('no gateway available — add one in the proxy panel');
      return Promise.resolve(null);
    }

    var started = Date.now();
    return webFetch(entry, target, 20000).then(function (res) {
      // A gateway that answers with an error page (rate limit, bad key, WAF
      // challenge) is a failed gateway — fall through to the next one.
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!res.text) throw new Error('empty response');
      var ms = Date.now() - started;
      entry.wins++;
      entry.lastOk = true;
      entry.lastMs = ms;
      entry.avgMs = entry.avgMs ? Math.round(entry.avgMs * 0.6 + ms * 0.4) : ms;
      entry.lastCheck = Date.now();
      WEB.lastId = entry.id;
      directFallback = false;
      sel.id = entry.id;
      sel.raw = entry.raw;
      sel.country = entry.countryCode || null;
      sel.ip = entry.exitIp || null;
      webSave();

      var ct = res.contentType || '';
      var body = res.text || '';
      var isHtml = /text\/html|application\/xhtml/i.test(ct) || /^\s*(<!doctype html|<html)/i.test(body);

      setSandbox(WEB_SANDBOX);
      if (isHtml && body.length > MAX_SRCDOC) {
        webSetSrc(webErrorDoc(target, 'page too large to rewrite safely (' + Math.round(body.length / 1048576) + ' MB)'));
      } else if (isHtml) {
        var rewritten = webRewrite(body, target, entry);
        webSetSrc(rewritten.html);
        $('stBlocked').textContent = rewritten.stats.scripts + ' scripts, ' +
          rewritten.stats.handlers + ' handlers';
      } else if (entry.text || /^text\/(plain|markdown)/i.test(ct)) {
        webSetSrc(webTextDoc(body, target));
        $('stBlocked').textContent = 'text response';
      } else {
        webSetSrc(webBinaryDoc(target, ct));
        $('stBlocked').textContent = escapeHtml(ct || 'binary');
      }

      $('addr').value = target;
      if (hIndex >= 0) hist[hIndex].target = target;
      updateEgress();
      if ($('proxyPanel') && $('proxyPanel').classList.contains('open')) webRender();
      return entry;
    }).catch(function (err) {
      entry.fails++;
      entry.lastOk = false;
      entry.lastMs = Date.now() - started;
      entry.lastCheck = Date.now();
      entry.error = String((err && err.message) || err || 'fetch failed');
      webSave();
      tried.push(entry.id);
      if (tried.length < 4) {
        var next = webAnyExcept(tried);
        if (next) return webRenderDoc(target, next, tried);
      }
      // Last resort: let the browser load it itself (own IP, own cookies).
      // The selection is left alone on purpose — the pool may well answer the
      // next request, and "direct" should only stick when asked for.
      toast('gateways unavailable — loading direct (no proxy)');
      directFallback = true;
      setSandbox(DIRECT_SANDBOX);
      webSetUrl(target);
      updateEgress();
      return null;
    });
  }

  function navigateWeb(target, isNewVisit) {
    var rotateChk = $('chkRotateSearch');
    var rotateWanted = isNewVisit && rotateChk && rotateChk.checked && sel.id !== 'direct';

    if (isNewVisit) {
      hist = hist.slice(0, hIndex + 1);
      hist.push({ target: target });
      hIndex = hist.length - 1;
    }

    directFallback = false;
    $('addr').value = target;
    $('btnBack').disabled = hIndex <= 0;
    $('btnFwd').disabled = hIndex >= hist.length - 1;
    $('btnReload').disabled = false;

    if (sel.id === 'direct') {
      setSandbox(DIRECT_SANDBOX);
      webSetUrl(target);
      updateEgress();
      return Promise.resolve(null);
    }

    var entry = null;
    if (rotateWanted) {
      entry = webPick({ mode: 'random', cleanOnly: true, avoidLast: true });
      if (entry) toast('rotated → ' + shortHost(entry.raw) + (entry.countryCode ? ' [' + entry.countryCode + ']' : ''));
    } else {
      entry = webActiveEntry();
    }
    updateEgress();
    return webRenderDoc(target, entry, []);
  }

  // ── web pool rendering ────────────────────────────────────────────────

  function webNormalize() {
    return WEB.pool.map(function (e) {
      return {
        id: e.id,
        raw: e.raw,
        name: e.name,
        type: e.type,
        score: webScore(e),
        lastMs: e.lastMs,
        lastOk: e.lastOk,
        exitIp: e.exitIp,
        isp: e.isp,
        country: e.country,
        countryCode: e.countryCode,
        hosting: e.hosting,
        isProxy: e.isProxy,
        detected: webIsDetected(e),
        clean: webIsClean(e),
        error: e.error,
        note: e.type !== 'gateway' ? 'needs relay' : null,
      };
    });
  }

  function webRender() {
    var proxies = webNormalize();
    var countries = [];
    proxies.forEach(function (p) {
      if (p.countryCode && countries.indexOf(p.countryCode) === -1) countries.push(p.countryCode);
    });
    renderProxies({
      proxies: proxies,
      active: sel.id,
      country: getSelectedCountry(),
      countries: countries,
    });
  }

  function webSelect(id) {
    var e = webById(id);
    if (!e) { toast('no such entry'); return Promise.resolve(null); }
    if (e.type !== 'gateway') { toast('socks/http proxies need the local relay'); return Promise.resolve(null); }
    sel.id = e.id;
    sel.raw = e.raw;
    sel.country = e.countryCode || null;
    sel.ip = e.exitIp || null;
    WEB.lastId = e.id;
    directFallback = false;
    webSave();
    webRender();
    updateEgress();
    return Promise.resolve(e);
  }

  // ── public gateway list ───────────────────────────────────────────────

  function webFetchList() {
    toast('fetching public gateway list…');
    return webPublicList().then(function (added) {
      webSave();
      webRender();
      toast(added ? ('public list: ' + added + ' new gateway' + (added === 1 ? '' : 's'))
                  : 'public list: nothing new');
      if (added) webTestAll();
    }).catch(function (e) { toast('gateway list unavailable: ' + e.message); });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  navigation (mode dispatch)
  // ═══════════════════════════════════════════════════════════════════════

  function looksLikeUrl(text) {
    if (/^https?:\/\//i.test(text)) return true;
    if (/\s/.test(text)) return false;
    // host.tld or host.tld/path — but not "search words.with.dots"
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?([/?#].*)?$/i.test(text);
  }

  function targetFor(input) {
    var text = input.trim();
    if (text === '') return null;
    if (looksLikeUrl(text)) {
      if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
      return text;
    }
    return SEARCH + encodeURIComponent(text);
  }

  function viewUrl(target, p, opts) {
    opts = opts || {};
    var country = getSelectedCountry();
    var url = RELAY + '/view?u=' + encodeURIComponent(target) +
              '&p=' + encodeURIComponent(p || 'auto');
    if (country && country !== 'ALL') {
      url += '&c=' + encodeURIComponent(country);
    }
    if (opts.rotate != null) {
      url += '&rotate=' + (opts.rotate ? '1' : '0');
    }
    if (opts.nonce) {
      url += '&_t=' + opts.nonce;
    }
    return url;
  }

  function navigateRelay(target, isNewVisit) {
    var rotateChk = $('chkRotateSearch');
    var rotateOnSearch = rotateChk ? rotateChk.checked : true;
    var shouldRotate = isNewVisit && rotateOnSearch && sel.id !== 'direct';
    var p = shouldRotate ? 'random' : (sel.id || 'auto');
    var url = viewUrl(target, p, {
      rotate: shouldRotate ? 1 : 0,
      nonce: isNewVisit ? Date.now() : null,
    });
    if (isNewVisit) {
      hist = hist.slice(0, hIndex + 1);
      hist.push({ target: target, url: url });
      hIndex = hist.length - 1;
    }
    setSandbox(RELAY_SANDBOX);
    webSetUrl(url);
    $('addr').value = target;
    $('btnBack').disabled = hIndex <= 0;
    $('btnFwd').disabled = hIndex >= hist.length - 1;
    $('btnReload').disabled = false;
    updateEgress();
    return Promise.resolve(null);
  }

  // Web mode has no SSRF guard of its own — the relay is what makes poking at
  // loopback safe — so refuse loopback targets instead of handing them to a
  // third-party gateway.
  function isLocalTarget(target) {
    try {
      var h = new URL(target).hostname.toLowerCase().replace(/^\[|\]$/g, '');
      return h === 'localhost' || h === '::1' || /^127(\.\d{1,3}){3}$/.test(h);
    } catch (e) { return false; }
  }

  function navigate(target, push) {
    var isNewVisit = push !== false;
    if (MODE === 'web' && isLocalTarget(target)) {
      toast('web mode cannot open loopback addresses (start the relay for that)');
      return Promise.resolve(null);
    }
    if (MODE === 'relay') return navigateRelay(target, isNewVisit);
    return navigateWeb(target, isNewVisit);
  }

  function updateEgress() {
    if (MODE === 'relay') {
      if (sel.id === 'direct') { $('stEgress').textContent = 'direct'; return; }
      if ((sel.id === 'auto' || !sel.id) && !sel.raw) {
        var cc = getSelectedCountry();
        $('stEgress').textContent = 'auto (clean' + (cc !== 'ALL' ? ' · ' + cc : '') + ')';
        return;
      }
      var label = mask(sel.raw || sel.id);
      if (sel.country) label += ' [' + sel.country + ']';
      if (sel.ip) label += ' (' + sel.ip + ')';
      $('stEgress').textContent = label;
      return;
    }
    if (sel.id === 'direct') { $('stEgress').textContent = 'direct (no proxy)'; return; }
    if (directFallback) { $('stEgress').textContent = 'direct — gateway pool failed'; return; }
    var e = (sel.id && sel.id !== 'auto') ? webById(sel.id) : webActiveEntry();
    if (!e) {
      var cc2 = getSelectedCountry();
      $('stEgress').textContent = 'web' + (cc2 !== 'ALL' ? ' · ' + cc2 : '');
      return;
    }
    var l = e.name ? e.name : shortHost(e.raw);
    if (e.countryCode) l += ' [' + e.countryCode + ']';
    if (e.exitIp) l += ' (' + e.exitIp + ')';
    $('stEgress').textContent = l;
  }

  // Read the real URL + rewrite stats + egress proxy back out of the viewer
  // once a page loads (relay mode only — web mode documents are opaque-origin).
  viewer.addEventListener('load', function () {
    if (MODE !== 'relay') return;
    try {
      var loc = viewer.contentWindow.location;
      if (loc.href === 'about:blank') return;
      var u = new URL(loc.href).searchParams.get('u');
      if (u) {
        $('addr').value = u;
        if (hIndex >= 0) hist[hIndex].target = u;
      }
    } catch (e) { /* cross-origin — keep the last known URL */ }
    try {
      var doc = viewer.contentDocument;
      if (!doc) return;
      var meta = doc.querySelector('meta[name="gs-stats"]');
      if (meta) {
        var s = meta.getAttribute('content') || '';
        var m = /scripts=(\d+).*handlers=(\d+)/.exec(s);
        $('stBlocked').textContent = m ? (m[1] + ' scripts, ' + m[2] + ' handlers') : s;
      }
      var egressMeta = doc.querySelector('meta[name="gs-egress"]');
      if (egressMeta) {
        var egContent = egressMeta.getAttribute('content') || '';
        var pid = egressMeta.getAttribute('data-proxy-id') || '';
        var pcc = egressMeta.getAttribute('data-country') || '';
        var pip = egressMeta.getAttribute('data-ip') || '';
        if (pid && pid !== 'direct') {
          sel.id = pid;
          sel.country = pcc || null;
          sel.ip = pip || null;
        }
        if (egContent) $('stEgress').textContent = mask(egContent);
        if ($('proxyPanel') && $('proxyPanel').classList.contains('open')) loadProxies();
      }
    } catch (e) { /* ignore */ }
  });

  // Web-mode documents cannot reach us through the DOM, so they postMessage.
  window.addEventListener('message', function (ev) {
    if (!ev || !ev.data) return;
    try { if (ev.source !== viewer.contentWindow) return; } catch (e) { return; }
    var d = ev.data;
    if (typeof d.__gsNav === 'string') {
      navigate(d.__gsNav);
      return;
    }
    if (d.__gsForm && typeof d.__gsForm.action === 'string') {
      var f = d.__gsForm;
      var url = f.action + (f.action.indexOf('?') === -1 ? '?' : '&') + (f.query || '');
      if (f.method === 'post') toast('POST form — web mode submits it as GET (POST needs the relay)');
      navigate(url);
    }
  });

  $('addrForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = targetFor($('addr').value);
    if (t) navigate(t);
    else toast('type a URL or a search');
  });
  $('btnGo').addEventListener('click', function () {
    var t = targetFor($('addr').value);
    if (t) navigate(t);
    else toast('type a URL or a search');
  });
  $('btnBack').addEventListener('click', function () {
    if (hIndex > 0) { hIndex--; navigate(hist[hIndex].target, false); }
  });
  $('btnFwd').addEventListener('click', function () {
    if (hIndex < hist.length - 1) { hIndex++; navigate(hist[hIndex].target, false); }
  });
  $('btnReload').addEventListener('click', function () {
    if (hIndex >= 0) navigate(hist[hIndex].target, false);
    else if ($('addr').value) { var t = targetFor($('addr').value); if (t) navigate(t); }
  });

  // ── random non-detected proxy & country filter ────────────────────────

  function selectRandomClean() {
    if (MODE === 'relay') {
      var country = getSelectedCountry();
      return api('/api/proxy/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'random', cleanOnly: true, country: country }),
      }).then(function (data) {
        applyRelaySelection(data, 'clean proxy');
        loadProxies();
        if (hIndex >= 0) navigate(hist[hIndex].target, false);
      }).catch(function (e) { toast(e.message); });
    }
    var entry = webPick({ mode: 'random', cleanOnly: true, avoidLast: true });
    if (!entry) {
      toast('no clean gateway' + (getSelectedCountry() !== 'ALL' ? ' for ' + getSelectedCountry() : '') + ' · run Test all');
      return Promise.resolve(null);
    }
    webSelect(entry.id);
    var label = entry.name ? entry.name : shortHost(entry.raw);
    if (entry.countryCode) label += ' [' + entry.countryCode + ']';
    if (entry.exitIp) label += ' (' + entry.exitIp + ')';
    toast('clean gateway → ' + label);
    if (hIndex >= 0) navigate(hist[hIndex].target, false);
    return Promise.resolve(entry);
  }

  function applyRelaySelection(data, what) {
    sel.id = data.active || 'direct';
    sel.raw = (data.proxy && data.proxy !== 'direct') ? data.proxy : null;
    sel.country = data.countryCode || null;
    sel.ip = data.exitIp || null;
    updateEgress();
    if (!data.active || data.proxy === 'direct') {
      toast('no ' + what + ' available' + (getSelectedCountry() !== 'ALL' ? ' for ' + getSelectedCountry() : '') + ' · browsing direct');
    } else {
      var label = mask(data.proxy);
      if (data.countryCode) label += ' [' + data.countryCode + ']';
      if (data.exitIp) label += ' (' + data.exitIp + ')';
      toast(what + ' → ' + label);
    }
  }

  if ($('btnRandom')) $('btnRandom').addEventListener('click', selectRandomClean);
  if ($('btnRandomClean')) $('btnRandomClean').addEventListener('click', selectRandomClean);

  function onCountryChange(ev) {
    var val = ev.target.value || 'ALL';
    setSelectedCountry(val);
    if (lastPoolData) renderProxies(lastPoolData);
    updateEgress();

    if (MODE === 'relay') {
      if (sel.id === 'direct') return;
      api('/api/proxy/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'random', cleanOnly: true, country: val }),
      }).then(function (data) {
        if (data.active && data.proxy !== 'direct') {
          sel.id = data.active;
          sel.raw = data.proxy;
          sel.country = data.countryCode || null;
          sel.ip = data.exitIp || null;
          updateEgress();
          toast('country ' + val + ' → ' + mask(data.proxy));
        } else {
          toast('country filter: ' + val);
        }
        loadProxies();
      }).catch(function () {});
      return;
    }

    var cc = val.toUpperCase();
    if (cc === 'ALL') { toast('country filter: ALL'); webRender(); return; }
    var entry = webPick({ mode: 'best', cleanOnly: true, country: cc, avoidLast: true });
    if (entry) {
      webSelect(entry.id);
      toast('country ' + cc + ' → ' + (entry.name || shortHost(entry.raw)));
      if (hIndex >= 0) navigate(hist[hIndex].target, false);
    } else {
      webRender();
      toast('no ' + cc + ' gateway yet · Test all to detect exit countries');
    }
  }

  if ($('countrySelect')) $('countrySelect').addEventListener('change', onCountryChange);
  if ($('panelCountrySelect')) $('panelCountrySelect').addEventListener('change', onCountryChange);

  // ── identity ──────────────────────────────────────────────────────────

  $('btnIdentity').addEventListener('click', function () {
    if (MODE === 'relay') {
      var country = getSelectedCountry();
      api('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: country }),
      }).then(function (data) {
        $('stIdentity').textContent = '#' + data.identity;
        sel.id = data.active || 'direct';
        sel.raw = (data.proxy && data.proxy !== 'direct') ? data.proxy : null;
        sel.country = data.countryCode || null;
        sel.ip = data.exitIp || null;
        updateEgress();
        toast('new identity · cookies dropped · egress: ' + mask(data.proxy || 'direct'));
        loadProxies();
        if (hIndex >= 0) navigate(hist[hIndex].target, false);
      }).catch(function (e) { toast('identity reset failed: ' + e.message); });
      return;
    }
    WEB.identity++;
    $('stIdentity').textContent = '#' + WEB.identity;
    var entry = webPick({ mode: 'random', cleanOnly: true, avoidLast: true });
    if (entry) {
      webSelect(entry.id);
      toast('new identity #' + WEB.identity + ' · egress: ' + (entry.name || shortHost(entry.raw)));
      if (hIndex >= 0) navigate(hist[hIndex].target, false);
    } else {
      toast('new identity #' + WEB.identity + ' · gateway pool empty');
    }
  });

  // ── proxy manager ─────────────────────────────────────────────────────

  function renderProxies(data) {
    lastPoolData = data;
    syncCountryOptionsFromPool(data);

    var list = $('proxyList');
    var allProxies = (data && data.proxies) || [];
    var countryFilter = getSelectedCountry();
    var proxies = countryFilter === 'ALL'
      ? allProxies
      : allProxies.filter(function (p) {
          return (p.countryCode || '').toUpperCase() === countryFilter;
        });

    var cleanCount = allProxies.filter(function (p) {
      return p.clean !== false && !p.detected && p.lastOk !== false;
    }).length;
    $('poolCount').textContent = allProxies.length
      ? ('· ' + allProxies.length + ' (' + cleanCount + ' clean)')
      : '';

    if (allProxies.length === 0) {
      list.innerHTML = '<p style="color:var(--dim);font-size:12.5px">' +
        'No gateways yet. Hit <b>Defaults</b>, or paste one per line — either a gateway URL ' +
        'containing <code>{url}</code>, or a <code>socks5://</code>/<code>http://</code> proxy ' +
        '(those need the local relay).</p>';
      return;
    }
    if (proxies.length === 0) {
      list.innerHTML = '<p style="color:var(--dim);font-size:12.5px">' +
        'No entries matching country <b>' + escapeHtml(countryFilter) + '</b>. ' +
        'Run "Test all" to detect exit countries, or switch Country to ALL.</p>';
      return;
    }

    list.innerHTML = '';
    proxies.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'proxy-row' + (data.active === p.id ? ' active' : '');

      var score = Math.round(p.score);
      var status = p.lastOk == null ? '' : (p.lastOk ? 'ok' : 'bad');
      var isDetected = Boolean(p.detected);
      var isClean = !isDetected && p.lastOk !== false;
      var cc = (p.countryCode || '').toUpperCase();

      var countryBadge = '<span class="pbadge country">' + escapeHtml(cc || 'ANY') + '</span>';
      var detectBadge = isDetected
        ? '<span class="pbadge detected">detected</span>'
        : (p.lastOk === false
            ? '<span class="pbadge detected">failed</span>'
            : '<span class="pbadge clean">clean</span>');
      var typeBadge = p.note
        ? '<span class="pbadge relay">' + escapeHtml(p.note) + '</span>'
        : '';

      var bits = [];
      if (p.lastMs) bits.push(p.lastMs + 'ms');
      if (p.exitIp) bits.push(p.exitIp);
      if (p.country) bits.push(p.country);
      if (p.isp) bits.push(p.isp);
      if (p.hosting === true) bits.push('datacenter');
      if (p.isProxy === true) bits.push('flagged-proxy');
      if (p.error) bits.push('ERR: ' + p.error.slice(0, 60));

      var title = p.name ? escapeHtml(p.name) + ' · ' : '';
      row.innerHTML =
        '<div class="raw">' +
          '<span class="dot ' + status + '"></span>' +
          '<span>' + escapeHtml(title + mask(p.raw)) + '</span>' +
          countryBadge +
          detectBadge +
          typeBadge +
        '</div>' +
        '<div class="meta">' + escapeHtml(bits.join(' · ') || (isClean ? 'clean · untested' : 'untested')) + ' · score ' + score + '</div>' +
        '<div class="scorebar"><i style="width:' + score + '%"></i></div>' +
        '<div class="row-actions">' +
        '<button data-act="use">Use</button>' +
        '<button data-act="test">Test</button>' +
        '<button data-act="rm">Remove</button>' +
        '</div>';

      row.querySelector('[data-act=use]').addEventListener('click', function () {
        if (MODE === 'relay') {
          api('/api/proxy/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id }),
          }).then(function () {
            sel.id = p.id;
            sel.raw = p.raw;
            sel.country = p.countryCode || null;
            sel.ip = p.exitIp || null;
            updateEgress();
            toast('egress → ' + mask(p.raw));
            loadProxies();
          }).catch(function (e) { toast(e.message); });
        } else {
          webSelect(p.id).then(function (e) {
            if (e) toast('egress → ' + (e.name || shortHost(e.raw)));
          });
        }
      });

      row.querySelector('[data-act=test]').addEventListener('click', function (ev) {
        var btn = ev.target;
        btn.disabled = true;
        btn.textContent = '…';
        var done = function () { btn.disabled = false; btn.textContent = 'Test'; };
        if (MODE === 'relay') {
          api('/api/proxy/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id }),
          }).then(function () { loadProxies(); toast('tested ' + mask(p.raw)); })
            .catch(function (e) { toast(e.message); })
            .then(done);
          return;
        }
        var entry = webById(p.id);
        if (!entry) { done(); return; }
        webTestOne(entry).then(function (e2) {
          webSave();
          webRender();
          updateEgress();
          if (e2 && e2.lastOk) toast('tested ' + shortHost(e2.raw) + ' · ' + e2.lastMs + 'ms · ' +
            (e2.countryCode || '??') + (e2.isp ? ' · ' + e2.isp : ''));
          else toast('test failed: ' + (e2 && e2.error ? e2.error : 'unknown'));
        }).then(done, done);
      });

      row.querySelector('[data-act=rm]').addEventListener('click', function () {
        if (MODE === 'relay') {
          api('/api/proxy?id=' + encodeURIComponent(p.id), { method: 'DELETE' })
            .then(function () { loadProxies(); toast('removed'); })
            .catch(function (e) { toast(e.message); });
          return;
        }
        WEB.pool = WEB.pool.filter(function (e) { return e.id !== p.id; });
        if (sel.id === p.id) { sel.id = 'auto'; sel.raw = null; sel.country = null; sel.ip = null; }
        if (WEB.lastId === p.id) WEB.lastId = null;
        webSave();
        webRender();
        updateEgress();
        toast('removed');
      });

      list.appendChild(row);
    });
  }

  // keep credentials out of sight in the list
  function mask(raw) {
    return String(raw).replace(/\/\/([^@/]+)@/, '//•••@');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadProxies() {
    if (MODE === 'web') { webRender(); return Promise.resolve(null); }
    return api('/api/proxy').then(renderProxies).catch(function () {});
  }

  $('btnProxies').addEventListener('click', function () {
    var panel = $('proxyPanel');
    panel.classList.toggle('open');
    $('btnProxies').classList.toggle('active', panel.classList.contains('open'));
    if (panel.classList.contains('open')) loadProxies();
  });

  $('btnAdd').addEventListener('click', function () {
    var text = $('proxyInput').value;
    if (!text.trim()) { toast('paste some gateways or proxies first'); return; }
    if (MODE === 'web') {
      var n = webAddText(text);
      $('proxyInput').value = '';
      toast(n ? ('added ' + n + ' · pool ' + WEB.pool.length) : 'nothing new (bad or duplicate lines)');
      webRender();
      webTestAll();
      return;
    }
    api('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    }).then(function (data) {
      $('proxyInput').value = '';
      toast('added ' + data.added + ' · pool ' + data.total);
      loadProxies();
    }).catch(function (e) { toast('add failed: ' + e.message); });
  });

  $('btnTestAll').addEventListener('click', function () {
    if (MODE === 'web') {
      toast('testing the pool…');
      webTestAll().then(function () { toast('pool tested'); });
      return;
    }
    toast('testing the pool…');
    api('/api/proxy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function () { loadProxies(); toast('pool tested'); })
      .catch(function (e) { toast('test failed: ' + e.message); });
  });

  $('btnSelectBest').addEventListener('click', function () {
    if (MODE === 'web') {
      var e = webPick({ mode: 'best', cleanOnly: true });
      if (!e) { toast('no clean gateway — run Test all'); return; }
      webSelect(e.id);
      toast('best clean egress → ' + (e.name || shortHost(e.raw)));
      if (hIndex >= 0) navigate(hist[hIndex].target, false);
      return;
    }
    var country = getSelectedCountry();
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'best', cleanOnly: true, country: country }),
    }).then(function (data) {
      applyRelaySelection(data, 'best clean egress');
      loadProxies();
    }).catch(function (err) { toast(err.message); });
  });

  $('btnDirect').addEventListener('click', function () {
    if (MODE === 'web') {
      sel.id = 'direct';
      sel.raw = null;
      sel.country = null;
      sel.ip = null;
      directFallback = false;
      webSave();
      webRender();
      updateEgress();
      toast('browsing direct — pages load with your own IP until you pick a gateway');
      return;
    }
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'direct' }),
    }).then(function () {
      sel.id = 'direct';
      sel.raw = null;
      sel.country = null;
      sel.ip = null;
      updateEgress();
      toast('browsing direct (no proxy)');
      loadProxies();
    }).catch(function (e) { toast(e.message); });
  });

  $('btnClear').addEventListener('click', function () {
    if (MODE === 'web') {
      WEB.pool = [];
      sel.id = 'auto';
      sel.raw = null;
      sel.country = null;
      sel.ip = null;
      WEB.lastId = null;
      webSave();
      webRender();
      updateEgress();
      toast('pool cleared — hit Defaults to refill');
      return;
    }
    api('/api/proxy', { method: 'DELETE' }).then(function () {
      sel.id = 'auto';
      sel.raw = null;
      sel.country = null;
      sel.ip = null;
      updateEgress();
      loadProxies();
      toast('pool cleared');
    }).catch(function (e) { toast(e.message); });
  });

  if ($('btnDefaults')) {
    $('btnDefaults').addEventListener('click', function () {
      if (MODE !== 'web') { toast('defaults are a web-mode thing — the relay uses your own pool'); return; }
      var added = 0;
      WEB.defaults.forEach(function (d) {
        var e = webMakeEntry(d.raw);
        if (!e || webById(e.id)) return;
        e.name = d.name || null;
        e.json = d.json || null;
        e.text = Boolean(d.text);
        e.error = null;
        WEB.pool.push(e);
        added++;
      });
      webSave();
      webRender();
      toast(added ? ('restored ' + added + ' default gateway' + (added === 1 ? '' : 's')) : 'defaults already present');
      if (added) webTestAll();
    });
  }

  if ($('btnFetchList')) {
    $('btnFetchList').addEventListener('click', webFetchList);
  }

  function toggleRelayInfo() {
    var box = $('relayDown');
    var intro = $('relayIntro');
    if (!box.classList.contains('show') && intro) {
      intro.innerHTML = MODE === 'relay'
        ? 'The local relay is running, so pages are fetched through it: your own ' +
          '<code>socks5://</code> / <code>http://</code> pool, a real cookie jar and the ' +
          'SSRF guard. Start it on another machine — or again after a restart — with:'
        : 'This page is already browsing in <b>web mode</b>: pages are fetched through the ' +
          'gateway pool in the proxy manager, rewritten here in the browser and rendered ' +
          'in the frame behind this panel. Nothing is broken and nothing is waiting on you.';
    }
    box.classList.toggle('show');
  }

  if ($('btnRelayInfo')) $('btnRelayInfo').addEventListener('click', toggleRelayInfo);
  if ($('relayPill')) $('relayPill').addEventListener('click', toggleRelayInfo);
  if ($('btnCloseRelayDown')) {
    $('btnCloseRelayDown').addEventListener('click', function () {
      $('relayDown').classList.remove('show');
    });
  }

  $('btnRetry').addEventListener('click', function () {
    if (MODE === 'relay') { toast('relay online'); return; }
    toast('looking for a local relay…');
    ping().then(function (data) {
      if (data) toast('relay online · v' + data.version);
      else toast('no local relay found — web mode is active (relay is optional)');
    });
  });

  // ── boot ──────────────────────────────────────────────────────────────
  ping().then(function (data) {
    if (data) {
      if (data.country) setSelectedCountry(data.country);
      loadProxies();
      if (data.activeProxy && data.activeProxy !== 'direct') {
        sel.raw = data.activeProxy;
        updateEgress();
      }
      return;
    }
    // web mode: merge the public list, then score the pool in the background
    // so country / ISP / detection data shows up without the user asking.
    var t = targetFor($('addr').value);
    if (t) navigate(t);
    else webSetSrc(webHomeDoc());
    webFetchListSilently().then(function () { webTestAll(10); });
  });

  function webFetchListSilently() {
    return webPublicList().then(function (added) {
      if (added) { webSave(); webRender(); }
    }).catch(function () { /* offline or not deployed alongside — defaults stay */ });
  }

  function webPublicList() {
    return fetch('proxy-sources.json', { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        var list = (data && data.gateways) || [];
        var added = 0;
        list.forEach(function (g) {
          if (!g || !g.raw) return;
          var e = webMakeEntry(g.raw);
          if (!e || webById(e.id)) return;
          e.name = g.name || e.name;
          if (g.json != null) e.json = g.json;
          if (g.text != null) e.text = Boolean(g.text);
          e.error = null;
          WEB.pool.push(e);
          added++;
        });
        if (Array.isArray(data && data.testEndpoints) && data.testEndpoints.length) {
          WEB.testEndpoints = data.testEndpoints;
        }
        return added;
      });
  }

  function webHomeDoc() {
    return webShell(
      '<div class="box">' +
      '<h1>GhostShell web mode</h1>' +
      '<p class="muted">Search above, or paste a URL. Pages are fetched through the gateway pool on ' +
      'the right, rewritten here in the browser (scripts stripped, every request re-pointed at the ' +
      'chosen gateway) and rendered in this frame.</p>' +
      '<h2>What works without the relay</h2>' +
      '<p class="muted">Search and navigation, the proxy manager, live gateway tests ' +
      '(ipwho.is / ipapi.co for exit IP, country and ISP; ip-api.com for proxy &amp; hosting flags), ' +
      'the country filter, <b>Random clean</b> and <b>New non-detected IP on every search</b>.</p>' +
      '<h2>What the local relay adds</h2>' +
      '<p class="muted">SOCKS5 / HTTP(S) proxy egress with your own residential or datacenter pool, ' +
      'a real cookie jar with one-click new identities, and the SSRF guard. Start it with ' +
      '<code>./tools/relay.sh --open</code> and this page switches to it automatically.</p>' +
      '</div>' + webBridge(location.href),
      'GhostShell web mode'
    );
  }

  // quiet liveness poll so the pill picks up a relay started mid-session
  setInterval(function () {
    if (MODE === 'relay') ping();
    else {
      probe('http://127.0.0.1:8787').then(function (d) { enterRelayMode(d); },
        function () { /* still web mode — fine */ });
    }
  }, 30000);
})();
