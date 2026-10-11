import { COUNTRIES, PROFILE_LABELS, send, getConfig, patch, matchCountry, el } from './ui-shared.js';

const $ = el;
const FIELDS = [
  'enabled', 'profile',
  'proxyMode', 'proxyScheme', 'proxyHost', 'proxyPort', 'proxyBypass',
  'tzMode', 'timezone', 'localeMode', 'locale', 'languages',
  'geoMode', 'lat', 'lon', 'accuracy',
  'canvas', 'audio', 'webgl', 'mediaDevices', 'fonts', 'battery', 'permissions',
  'webrtc', 'disableQuic', 'blockIpv6'
];

let cfg = {};
let dirty = false;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

function fill() {
  FIELDS.forEach((k) => {
    const node = $(k);
    if (!node) return;
    if (node.type === 'checkbox') node.checked = !!cfg[k];
    else node.value = cfg[k] === undefined || cfg[k] === null ? '' : cfg[k];
  });

  const hit = COUNTRIES.find((c) =>
    cfg.tzMode === 'custom' && c.tz === cfg.timezone && c.locale === cfg.locale);
  $('country').value = hit ? hit.code : '';

  const manual = cfg.proxyMode === 'manual';
  ['proxyScheme', 'proxyHost', 'proxyPort', 'proxyBypass'].forEach((k) => { $(k).disabled = !manual; });
  $('timezone').disabled = cfg.tzMode !== 'custom';
  $('locale').disabled = cfg.localeMode !== 'custom';
  $('languages').disabled = cfg.localeMode !== 'custom';
  const geoCustom = cfg.geoMode === 'custom';
  ['lat', 'lon', 'accuracy'].forEach((k) => { $(k).disabled = !geoCustom; });
}

function collect() {
  const out = {};
  FIELDS.forEach((k) => {
    const node = $(k);
    if (!node) return;
    if (node.type === 'checkbox') out[k] = node.checked;
    else if (node.type === 'number') out[k] = node.value === '' ? 0 : Number(node.value);
    else out[k] = node.value;
  });
  if (Array.isArray(cfg.languages) && typeof out.languages === 'string') {
    out.languages = out.languages.split(',').map((s) => s.trim()).filter(Boolean);
  }
  out.lat = Number(out.lat) || 0;
  out.lon = Number(out.lon) || 0;
  return out;
}

async function init() {
  const cSel = $('country');
  COUNTRIES.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.code;
    o.textContent = c.name + ' · ' + c.tz;
    cSel.appendChild(o);
  });

  const pSel = $('profile');
  Object.entries(PROFILE_LABELS).forEach(([k, v]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v;
    pSel.appendChild(o);
  });

  cfg = await getConfig();
  fill();

  $('country').addEventListener('change', async (e) => {
    const next = e.target.value
      ? matchCountry(Object.assign({}, cfg, collect()), e.target.value)
      : Object.assign({}, cfg, collect(), { tzMode: 'real', localeMode: 'real', geoMode: 'real' });
    cfg = await patch(next);
    fill();
    dirty = false;
    toast(e.target.value ? 'Location matched' : 'Location reset');
  });

  $('proxyMode').addEventListener('change', () => { dirty = true; fill(); });
  $('tzMode').addEventListener('change', () => { dirty = true; fill(); });
  $('localeMode').addEventListener('change', () => { dirty = true; fill(); });
  $('geoMode').addEventListener('change', () => { dirty = true; fill(); });

  FIELDS.forEach((k) => {
    const node = $(k);
    if (!node) return;
    node.addEventListener('change', () => {
      if (['proxyMode', 'tzMode', 'localeMode', 'geoMode', 'country'].includes(k)) return;
      dirty = true;
    });
    node.addEventListener('input', () => { dirty = true; });
  });

  $('save').addEventListener('click', async () => {
    cfg = await patch(collect());
    dirty = false;
    fill();
    $('savedHint').style.opacity = '1';
    setTimeout(() => { $('savedHint').style.opacity = '0'; }, 1500);
    toast('Settings saved and applied');
  });

  $('newSalt').addEventListener('click', async () => {
    const r = await send({ type: 'newSalt' });
    if (r.ok) cfg = r.config;
    fill();
    toast('Fingerprint seed rotated');
  });

  $('reset').addEventListener('click', async () => {
    if (!confirm('Reset all GhostShell settings to defaults?')) return;
    const r = await send({ type: 'resetConfig' });
    if (r.ok) cfg = r.config;
    dirty = false;
    fill();
    toast('Reset to defaults');
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });
}

init();
