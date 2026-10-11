/*!
 * GhostShell Shield — background service worker.
 *
 * Responsibilities:
 *   1. Seed and maintain the config in chrome.storage.local.
 *   2. Push the proxy into Chrome at the browser level (chrome.proxy).
 *   3. Force the WebRTC IP-handling policy so UDP cannot escape the tunnel.
 *   4. Align the Accept-Language request header with the chosen locale —
 *      a navigator.language of "de-DE" behind an Accept-Language of
 *      "en-US,en" is a contradiction sites score heavily.
 */

const DEFAULTS = {
  enabled: true,
  profile: 'real',
  sessionSalt: '',

  proxyMode: 'system',      // system | none | manual
  proxyScheme: 'socks5',    // http | https | socks4 | socks5
  proxyHost: '',
  proxyPort: 0,
  proxyBypass: 'localhost;127.0.0.1;[::1]',

  tzMode: 'real',
  timezone: 'UTC',
  localeMode: 'real',
  locale: 'en-US',
  languages: ['en-US', 'en'],
  geoMode: 'real',
  lat: 0,
  lon: 0,
  accuracy: 25,

  canvas: 'noise',
  audio: 'noise',
  webgl: 'spoof',
  webrtc: 'protect',
  mediaDevices: 'generic',
  fonts: 'curated',
  battery: 'spoof',
  hardware: 'profile',
  screen: 'profile',
  permissions: 'normalise',

  blockIpv6: true,
  disableQuic: true
};

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
async function getConfig() {
  const res = await chrome.storage.local.get('config');
  return Object.assign({}, DEFAULTS, res.config || {});
}

async function setConfig(patch) {
  const cur = await getConfig();
  const next = Object.assign({}, cur, patch);
  await chrome.storage.local.set({ config: next });
  await applyAll(next);
  return next;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.config) {
    applyAll(Object.assign({}, DEFAULTS, changes.config.newValue || {}));
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await getConfig();
  if (!cur.sessionSalt) {
    cur.sessionSalt = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    await chrome.storage.local.set({ config: cur });
  }
  await applyAll(cur);
});

chrome.runtime.onStartup.addListener(async () => {
  await applyAll(await getConfig());
});

/* ------------------------------------------------------------------ *
 * Proxy
 * ------------------------------------------------------------------ */
async function applyProxy(cfg) {
  if (!chrome.proxy) return;

  if (cfg.proxyMode === 'system') {
    await chrome.proxy.settings.set({ value: 'system', scope: 'regular' });
    return;
  }
  if (cfg.proxyMode === 'none') {
    await chrome.proxy.settings.set({ value: 'direct', scope: 'regular' });
    return;
  }

  const host = (cfg.proxyHost || '').trim();
  const port = parseInt(cfg.proxyPort, 10);
  if (!host || !port) {
    await chrome.proxy.settings.set({ value: 'system', scope: 'regular' });
    return;
  }

  // NOTE: Chrome's proxy API intentionally does not carry credentials
  // (that is a deliberate anti-abuse decision upstream). Chrome will show
  // its own auth dialog the first time an authenticated proxy is used —
  // see docs/PROXY-AUTH.md.
  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: { scheme: cfg.proxyScheme || 'socks5', host, port },
      bypassList: (cfg.proxyBypass || '').split(';').map((s) => s.trim()).filter(Boolean)
    }
  };
  await chrome.proxy.settings.set({ value: config, scope: 'regular' });
}

/* ------------------------------------------------------------------ *
 * Privacy knobs
 * ------------------------------------------------------------------ */
async function applyPrivacy(cfg) {
  if (!chrome.privacy) return;
  try {
    if (chrome.privacy.network && chrome.privacy.network.webRTCIPHandling) {
      // disable_non_proxied_udp is the whole ballgame: without it Chrome
      // happily gathers STUN candidates straight out of the physical NIC,
      // publishing your real public IP to any page that runs WebRTC.
      const value = cfg.webrtc === 'off' ? 'default' : 'disable_non_proxied_udp';
      const cur = await chrome.privacy.network.webRTCIPHandling.get({});
      if (cur.value !== value) {
        await chrome.privacy.network.webRTCIPHandling.set({ value });
      }
    }
  } catch (e) { /* enterprise-managed policy: nothing we can do */ }
}

/* ------------------------------------------------------------------ *
 * Header alignment (declarativeNetRequest)
 * ------------------------------------------------------------------ */
const RULE_IDS = { ACCEPT_LANGUAGE: 1, GPC: 2, DNT: 3 };

async function applyHeaders(cfg) {
  if (!chrome.declarativeNetRequest) return;

  const rules = [];

  if (cfg.localeMode === 'custom' && Array.isArray(cfg.languages) && cfg.languages.length) {
    // Chrome builds the q-values itself; we supply the ordered list.
    const value = cfg.languages.join(', ');
    rules.push({
      id: RULE_IDS.ACCEPT_LANGUAGE,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'accept-language', operation: 'set', value }]
      },
      condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'fetch', 'other'] }
    });
  }

  const remove = [];
  if (cfg.blockIpv6) remove.push(RULE_IDS.GPC);
  remove.push(RULE_IDS.DNT);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_IDS.ACCEPT_LANGUAGE, RULE_IDS.GPC, RULE_IDS.DNT],
      addRules: rules
    });
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ *
 * Fan-out
 * ------------------------------------------------------------------ */
let lastApplied = '';
async function applyAll(cfg) {
  const key = JSON.stringify(cfg);
  if (key === lastApplied) return;
  lastApplied = key;

  await Promise.all([
    applyProxy(cfg).catch(() => {}),
    applyPrivacy(cfg).catch(() => {}),
    applyHeaders(cfg).catch(() => {})
  ]);
  updateBadge(cfg);
}

function updateBadge(cfg) {
  if (!chrome.action) return;
  let text = 'ON';
  let color = '#0ca8a8';
  if (!cfg.enabled) { text = 'OFF'; color = '#8a8f98'; }
  else if (cfg.profile !== 'real') { text = 'MASK'; color = '#7c5cff'; }
  else if (cfg.proxyMode === 'manual') { text = 'PXY'; color = '#f59e0b'; }
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * Messages from the popup / options page
 * ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  (async () => {
    try {
      if (msg.type === 'getConfig') return respond({ ok: true, config: await getConfig() });
      if (msg.type === 'setConfig') return respond({ ok: true, config: await setConfig(msg.patch || {}) });
      if (msg.type === 'resetConfig') {
        const fresh = Object.assign({}, DEFAULTS, { sessionSalt: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) });
        await chrome.storage.local.set({ config: fresh });
        lastApplied = '';
        await applyAll(fresh);
        return respond({ ok: true, config: fresh });
      }
      if (msg.type === 'newSalt') {
        return respond({ ok: true, config: await setConfig({
          sessionSalt: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)
        }) });
      }
      return respond({ ok: false, error: 'unknown message' });
    } catch (err) {
      return respond({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  })();
  return true; // keep the channel open for the async response
});

applyAll(await getConfig());
