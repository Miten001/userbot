/* Shared UI data + helpers for the popup and the options page. */

/* Exit-country presets. When you pick one of these, the timezone, locale,
 * languages and geolocation are ALL set together, because setting only one
 * of them creates the mismatch that flags you in the first place. */
export const COUNTRIES = [
  { code: 'US', name: 'United States', tz: 'America/New_York', locale: 'en-US', languages: ['en-US', 'en'], lat: 40.7128, lon: -74.0060 },
  { code: 'US-W', name: 'United States (West)', tz: 'America/Los_Angeles', locale: 'en-US', languages: ['en-US', 'en'], lat: 34.0522, lon: -118.2437 },
  { code: 'CA', name: 'Canada', tz: 'America/Toronto', locale: 'en-CA', languages: ['en-CA', 'en'], lat: 43.6532, lon: -79.3832 },
  { code: 'GB', name: 'United Kingdom', tz: 'Europe/London', locale: 'en-GB', languages: ['en-GB', 'en'], lat: 51.5074, lon: -0.1278 },
  { code: 'IE', name: 'Ireland', tz: 'Europe/Dublin', locale: 'en-IE', languages: ['en-IE', 'en'], lat: 53.3498, lon: -6.2603 },
  { code: 'DE', name: 'Germany', tz: 'Europe/Berlin', locale: 'de-DE', languages: ['de-DE', 'de', 'en-US', 'en'], lat: 52.5200, lon: 13.4050 },
  { code: 'NL', name: 'Netherlands', tz: 'Europe/Amsterdam', locale: 'nl-NL', languages: ['nl-NL', 'nl', 'en-US', 'en'], lat: 52.3676, lon: 4.9041 },
  { code: 'FR', name: 'France', tz: 'Europe/Paris', locale: 'fr-FR', languages: ['fr-FR', 'fr', 'en-US', 'en'], lat: 48.8566, lon: 2.3522 },
  { code: 'ES', name: 'Spain', tz: 'Europe/Madrid', locale: 'es-ES', languages: ['es-ES', 'es', 'en-US', 'en'], lat: 40.4168, lon: -3.7038 },
  { code: 'IT', name: 'Italy', tz: 'Europe/Rome', locale: 'it-IT', languages: ['it-IT', 'it', 'en-US', 'en'], lat: 41.9028, lon: 12.4964 },
  { code: 'CH', name: 'Switzerland', tz: 'Europe/Zurich', locale: 'de-CH', languages: ['de-CH', 'de', 'en-US', 'en'], lat: 47.3769, lon: 8.5417 },
  { code: 'SE', name: 'Sweden', tz: 'Europe/Stockholm', locale: 'sv-SE', languages: ['sv-SE', 'sv', 'en-US', 'en'], lat: 59.3293, lon: 18.0686 },
  { code: 'NO', name: 'Norway', tz: 'Europe/Oslo', locale: 'nb-NO', languages: ['nb-NO', 'nb', 'en-US', 'en'], lat: 59.9139, lon: 10.7522 },
  { code: 'FI', name: 'Finland', tz: 'Europe/Helsinki', locale: 'fi-FI', languages: ['fi-FI', 'fi', 'en-US', 'en'], lat: 60.1699, lon: 24.9384 },
  { code: 'PL', name: 'Poland', tz: 'Europe/Warsaw', locale: 'pl-PL', languages: ['pl-PL', 'pl', 'en-US', 'en'], lat: 52.2297, lon: 21.0122 },
  { code: 'CZ', name: 'Czechia', tz: 'Europe/Prague', locale: 'cs-CZ', languages: ['cs-CZ', 'cs', 'en-US', 'en'], lat: 50.0755, lon: 14.4378 },
  { code: 'RO', name: 'Romania', tz: 'Europe/Bucharest', locale: 'ro-RO', languages: ['ro-RO', 'ro', 'en-US', 'en'], lat: 44.4268, lon: 26.1025 },
  { code: 'TR', name: 'Türkiye', tz: 'Europe/Istanbul', locale: 'tr-TR', languages: ['tr-TR', 'tr', 'en-US', 'en'], lat: 41.0082, lon: 28.9784 },
  { code: 'AE', name: 'United Arab Emirates', tz: 'Asia/Dubai', locale: 'en-AE', languages: ['en-AE', 'en', 'ar'], lat: 25.2048, lon: 55.2708 },
  { code: 'IN', name: 'India', tz: 'Asia/Kolkata', locale: 'en-IN', languages: ['en-IN', 'en', 'hi'], lat: 19.0760, lon: 72.8777 },
  { code: 'SG', name: 'Singapore', tz: 'Asia/Singapore', locale: 'en-SG', languages: ['en-SG', 'en'], lat: 1.3521, lon: 103.8198 },
  { code: 'MY', name: 'Malaysia', tz: 'Asia/Kuala_Lumpur', locale: 'en-MY', languages: ['en-MY', 'en', 'ms'], lat: 3.1390, lon: 101.6869 },
  { code: 'ID', name: 'Indonesia', tz: 'Asia/Jakarta', locale: 'id-ID', languages: ['id-ID', 'id', 'en'], lat: -6.2088, lon: 106.8456 },
  { code: 'PH', name: 'Philippines', tz: 'Asia/Manila', locale: 'en-PH', languages: ['en-PH', 'en', 'fil'], lat: 14.5995, lon: 120.9842 },
  { code: 'JP', name: 'Japan', tz: 'Asia/Tokyo', locale: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US', 'en'], lat: 35.6762, lon: 139.6503 },
  { code: 'KR', name: 'South Korea', tz: 'Asia/Seoul', locale: 'ko-KR', languages: ['ko-KR', 'ko', 'en-US', 'en'], lat: 37.5665, lon: 126.9780 },
  { code: 'HK', name: 'Hong Kong', tz: 'Asia/Hong_Kong', locale: 'en-HK', languages: ['en-HK', 'en', 'zh-Hant-HK'], lat: 22.3193, lon: 114.1694 },
  { code: 'AU', name: 'Australia', tz: 'Australia/Sydney', locale: 'en-AU', languages: ['en-AU', 'en'], lat: -33.8688, lon: 151.2093 },
  { code: 'NZ', name: 'New Zealand', tz: 'Pacific/Auckland', locale: 'en-NZ', languages: ['en-NZ', 'en'], lat: -36.8485, lon: 174.7633 },
  { code: 'BR', name: 'Brazil', tz: 'America/Sao_Paulo', locale: 'pt-BR', languages: ['pt-BR', 'pt', 'en-US', 'en'], lat: -23.5505, lon: -46.6333 },
  { code: 'MX', name: 'Mexico', tz: 'America/Mexico_City', locale: 'es-MX', languages: ['es-MX', 'es', 'en-US', 'en'], lat: 19.4326, lon: -99.1332 },
  { code: 'AR', name: 'Argentina', tz: 'America/Argentina/Buenos_Aires', locale: 'es-AR', languages: ['es-AR', 'es', 'en-US', 'en'], lat: -34.6037, lon: -58.3816 },
  { code: 'ZA', name: 'South Africa', tz: 'Africa/Johannesburg', locale: 'en-ZA', languages: ['en-ZA', 'en', 'af'], lat: -26.2041, lon: 28.0473 },
  { code: 'NG', name: 'Nigeria', tz: 'Africa/Lagos', locale: 'en-NG', languages: ['en-NG', 'en'], lat: 6.5244, lon: 3.3792 },
  { code: 'KE', name: 'Kenya', tz: 'Africa/Nairobi', locale: 'en-KE', languages: ['en-KE', 'en', 'sw'], lat: -1.2921, lon: 36.8219 },
  { code: 'EG', name: 'Egypt', tz: 'Africa/Cairo', locale: 'ar-EG', languages: ['ar-EG', 'ar', 'en'], lat: 30.0444, lon: 31.2357 },
  { code: 'IS', name: 'Iceland', tz: 'Atlantic/Reykjavik', locale: 'is-IS', languages: ['is-IS', 'is', 'en-US', 'en'], lat: 64.1466, lon: -21.9426 },
  { code: 'CH-X', name: 'Switzerland (French)', tz: 'Europe/Zurich', locale: 'fr-CH', languages: ['fr-CH', 'fr', 'en-US', 'en'], lat: 46.2044, lon: 6.1432 }
];

export const PROFILE_LABELS = {
  real: 'Don\'t mask — use my real device values',
  'win-chrome': 'Windows · Chrome',
  'mac-chrome': 'macOS · Chrome',
  'linux-chrome': 'Linux · Chrome',
  'android-chrome': 'Android · Chrome'
};

export const send = (msg) => new Promise((resolve) => {
  try { chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false })); }
  catch (e) { resolve({ ok: false, error: String(e) }); }
});

export const getConfig = async () => {
  const r = await send({ type: 'getConfig' });
  return r.config || {};
};

export const patch = async (p) => {
  const r = await send({ type: 'setConfig', patch: p });
  return r.config || {};
};

export function matchCountry(cfg, code) {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) return cfg;
  return Object.assign({}, cfg, {
    tzMode: 'custom',
    timezone: c.tz,
    localeMode: 'custom',
    locale: c.locale,
    languages: c.languages,
    geoMode: 'custom',
    lat: c.lat,
    lon: c.lon,
    accuracy: 25
  });
}

export const el = (id) => document.getElementById(id);
