import { COUNTRIES, PROFILE_LABELS, send, getConfig, patch, matchCountry, el } from './ui-shared.js';

const $ = el;
let cfg = {};

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

function render() {
  $('ver').textContent = 'v' + (chrome.runtime.getManifest().version || '1.0.0');
  $('enabled').checked = !!cfg.enabled;

  $('pillEnabled').textContent = cfg.enabled ? 'shield on' : 'shield off';
  $('pillEnabled').className = 'pill ' + (cfg.enabled ? 'on' : '');

  const pm = cfg.proxyMode;
  $('pillProxy').textContent = pm === 'manual' ? 'browser proxy' : pm === 'none' ? 'no proxy' : 'system VPN';
  $('pillProxy').className = 'pill ' + (pm === 'system' ? 'good' : pm === 'none' ? 'warn' : 'on');

  $('pillTz').textContent = 'tz: ' + (cfg.tzMode === 'real' ? 'real' : cfg.timezone);
  $('pillTz').className = 'pill ' + (cfg.tzMode !== 'real' ? 'on' : '');

  $('pillGeo').textContent = 'gps: ' + (cfg.geoMode === 'real' ? 'real' : cfg.geoMode === 'off' ? 'blocked' : 'spoofed');
  $('pillGeo').className = 'pill ' + (cfg.geoMode === 'real' ? '' : 'on');

  $('profile').value = cfg.profile || 'real';
  $('webrtc').value = cfg.webrtc || 'protect';
  $('webrtcDesc').textContent =
    cfg.webrtc === 'block' ? 'WebRTC disabled entirely'
    : cfg.webrtc === 'off' ? 'Untouched — may reveal your real IP'
    : 'Strip local IP candidates';

  // best-effort reverse lookup of the country that is currently applied
  const hit = COUNTRIES.find((c) =>
    cfg.tzMode === 'custom' && c.tz === cfg.timezone && c.locale === cfg.locale);
  $('country').value = hit ? hit.code : '';

  const n = $('note');
  if (!cfg.enabled) {
    n.className = 'note warn';
    n.innerHTML = '<b>Shield off.</b> Only automation traces are cleaned up.';
  } else if (cfg.proxyMode === 'manual') {
    n.className = 'note';
    n.innerHTML = '<b>Browser-level proxy.</b> Relaunch Chrome with <code>ghostshell --proxy</code> for full UDP/DNS protection — a browser proxy alone does not tunnel UDP.';
  } else if (cfg.profile === 'real' && cfg.tzMode === 'real') {
    n.className = 'note';
    n.innerHTML = '<b>Leak-protection mode.</b> WebRTC, DNS and GPS leaks are closed and your real device values are kept consistent.';
  } else {
    n.className = 'note';
    n.innerHTML = '<b>Masking on.</b> Remember: masking the browser cannot change what the server sees — a flagged datacentre IP is still a flagged IP.';
  }
}

async function init() {
  const countrySel = $('country');
  COUNTRIES.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.code;
    o.textContent = c.name + ' · ' + c.tz;
    countrySel.appendChild(o);
  });

  const profSel = $('profile');
  Object.entries(PROFILE_LABELS).forEach(([k, v]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v;
    profSel.appendChild(o);
  });

  cfg = await getConfig();
  render();

  $('enabled').addEventListener('change', async (e) => {
    cfg = await patch({ enabled: e.target.checked });
    render();
    toast(e.target.checked ? 'Shield enabled' : 'Shield disabled');
  });

  $('profile').addEventListener('change', async (e) => {
    cfg = await patch({ profile: e.target.value });
    render();
    toast('Profile updated — reload tabs');
  });

  $('webrtc').addEventListener('change', async (e) => {
    cfg = await patch({ webrtc: e.target.value });
    render();
    toast('WebRTC: ' + e.target.value);
  });

  $('country').addEventListener('change', async (e) => {
    if (!e.target.value) {
      cfg = await patch({ tzMode: 'real', localeMode: 'real', geoMode: 'real' });
    } else {
      cfg = await patch(matchCountry(cfg, e.target.value));
    }
    render();
    toast(e.target.value ? 'Location matched' : 'Location reset');
  });

  $('newSalt').addEventListener('click', async () => {
    const r = await send({ type: 'newSalt' });
    if (r.ok) cfg = r.config;
    render();
    toast('New fingerprint seed');
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

init();
