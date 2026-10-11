/*!
 * GhostShell Shield — MAIN world injection.
 *
 * Runs at document_start, BEFORE any page script, in the page's own JS realm.
 * Everything here is designed to be internally consistent: the timezone,
 * locale, geolocation, screen size, GPU string and UA all come from the same
 * "profile", because a mismatch between them is the single loudest
 * "this user is lying about where they are" signal a site can read.
 *
 * Prototype wrappers read from `state` at call time, so when a better config
 * arrives from the background worker a few ms later it just re-applies.
 */
(() => {
  'use strict';

  if (window.__ghostshell__) return;
  const GS = Object.defineProperty(window, '__ghostshell__', {
    value: { version: '1.0.0' },
    enumerable: false,
    configurable: false,
    writable: false
  }).__ghostshell__;

  /* ------------------------------------------------------------------ *
   * Deterministic PRNG
   * ------------------------------------------------------------------ *
   * Why deterministic and not `Math.random()`: a real browser returns the
   * *same* canvas/audio bytes every time a site reads them. If we return
   * different bytes on each read, a site that reads twice instantly knows
   * something is tampering. So: one seed per (origin, session), stable for
   * the whole session, different per site. You look like a distinct real
   * user to every site, and like the *same* real user on repeat visits.
   * ------------------------------------------------------------------ */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(seedStr) {
    return mulberry32(xmur3(seedStr)());
  }

  const ORIGIN = (() => {
    try { return location.origin || location.protocol + '//' + location.host; } catch (e) { return 'null'; }
  })();

  /* ------------------------------------------------------------------ *
   * State + defaults
   * ------------------------------------------------------------------ */
  const DEFAULTS = {
    enabled: true,
    profile: 'real',          // real | win-chrome | mac-chrome | linux-chrome | android-chrome
    sessionSalt: 'default',

    tzMode: 'real',           // real | custom | match-proxy
    timezone: 'UTC',

    localeMode: 'real',       // real | custom
    locale: 'en-US',
    languages: ['en-US', 'en'],

    geoMode: 'real',          // real | off | custom | match-proxy
    lat: 0,
    lon: 0,
    accuracy: 25,

    canvas: 'noise',          // noise | off
    audio: 'noise',           // noise | off
    webgl: 'spoof',           // spoof | real
    webrtc: 'protect',        // protect | block | off
    mediaDevices: 'generic',  // generic | real | hide
    fonts: 'curated',         // curated | real | off
    battery: 'spoof',         // spoof | real
    hardware: 'profile',      // profile | real
    screen: 'profile',        // profile | real
    permissions: 'normalise'  // normalise | real
  };

  const state = Object.assign({}, DEFAULTS);
  let installed = false;

  /* ------------------------------------------------------------------ *
   * Profiles — every value must agree with every other value
   * ------------------------------------------------------------------ */
  const CHROME_MAJOR = (() => {
    const m = /Chrome\/(\d+)/.exec(navigator.userAgent);
    return m ? m[1] : '131';
  })();

  const PROFILES = {
    'win-chrome': {
      platform: 'Win32',
      vendor: 'Google Inc.',
      oscpu: undefined,
      uaPlatform: '"Windows"',
      uaBrands: [
        { brand: 'Chromium', version: CHROME_MAJOR },
        { brand: 'Google Chrome', version: CHROME_MAJOR },
        { brand: 'Not?A_Brand', version: '99' }
      ],
      uaFull: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24, dpr: 1 },
      cpu: 8,
      memory: 8,
      touch: 0,
      mobile: false,
      webgl: {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        maxTex: 16384
      }
    },
    'mac-chrome': {
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      oscpu: undefined,
      uaPlatform: '"macOS"',
      uaBrands: [
        { brand: 'Chromium', version: CHROME_MAJOR },
        { brand: 'Google Chrome', version: CHROME_MAJOR },
        { brand: 'Not?A_Brand', version: '99' }
      ],
      uaFull: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
      screen: { width: 1728, height: 1117, availWidth: 1728, availHeight: 1080, colorDepth: 24, pixelDepth: 24, dpr: 2 },
      cpu: 8,
      memory: 8,
      touch: 0,
      mobile: false,
      webgl: {
        vendor: 'Google Inc. (Apple)',
        renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
        maxTex: 16384
      }
    },
    'linux-chrome': {
      platform: 'Linux x86_64',
      vendor: 'Google Inc.',
      oscpu: 'Linux x86_64',
      uaPlatform: '"Linux"',
      uaBrands: [
        { brand: 'Chromium', version: CHROME_MAJOR },
        { brand: 'Google Chrome', version: CHROME_MAJOR },
        { brand: 'Not?A_Brand', version: '99' }
      ],
      uaFull: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24, dpr: 1 },
      cpu: 8,
      memory: 8,
      touch: 0,
      mobile: false,
      webgl: {
        vendor: 'Google Inc. (Mesa)',
        renderer: 'ANGLE (Mesa, llvmpipe (LLVM 15.0.7, 256 bits), OpenGL 4.5)',
        maxTex: 16384
      }
    },
    'android-chrome': {
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      oscpu: undefined,
      uaPlatform: '"Android"',
      uaBrands: [
        { brand: 'Chromium', version: CHROME_MAJOR },
        { brand: 'Google Chrome', version: CHROME_MAJOR },
        { brand: 'Not?A_Brand', version: '99' }
      ],
      uaFull: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`,
      screen: { width: 412, height: 915, availWidth: 412, availHeight: 915, colorDepth: 24, pixelDepth: 24, dpr: 2.625 },
      cpu: 8,
      memory: 4,
      touch: 5,
      mobile: true,
      webgl: {
        vendor: 'Google Inc. (ARM)',
        renderer: 'ANGLE (ARM, Mali-G715, OpenGL ES 3.2)',
        maxTex: 8192
      }
    }
  };

  const activeProfile = () => (state.profile === 'real' ? null : PROFILES[state.profile] || null);
  const tzTarget = () => (state.tzMode === 'real' ? null : state.timezone);
  const localeTarget = () => (state.localeMode === 'real' ? null : state.locale);

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  const orig = Object.create(null);
  function keep(name, obj, prop) {
    const key = name + '.' + prop;
    if (!(key in orig)) {
      try { orig[key] = obj[prop]; } catch (e) { orig[key] = undefined; }
    }
    return orig[key];
  }

  function redefine(obj, prop, value, enumerable) {
    try {
      const d = Object.getOwnPropertyDescriptor(obj, prop);
      Object.defineProperty(obj, prop, {
        get: () => value,
        set: () => {},
        configurable: true,
        enumerable: enumerable !== undefined ? enumerable : d ? d.enumerable : true
      });
      return true;
    } catch (e) { return false; }
  }

  function redefineFn(obj, prop, fn, enumerable) {
    try {
      Object.defineProperty(obj, prop, {
        get: fn,
        set: () => {},
        configurable: true,
        enumerable: enumerable !== undefined ? enumerable : true
      });
      return true;
    } catch (e) { return false; }
  }

  /* ================================================================== *
   * 1. Remove automation / remote-control traces
   * ================================================================== */
  function scrubAutomation() {
    // Puppeteer, Playwright, Selenium and the DevTools protocol all leave a
    // marker on window. `navigator.webdriver` is the documented one and is
    // the first thing any bot-score looks at.
    const NAV = window.navigator;
    try {
      const nproto = window.Navigator && window.Navigator.prototype;
      if (nproto && Object.getOwnPropertyDescriptor(nproto, 'webdriver')) {
        Object.defineProperty(nproto, 'webdriver', {
          get: () => false, configurable: true, enumerable: true
        });
      } else {
        redefine(NAV, 'webdriver', false);
      }
    } catch (e) {}

    const patterns = [
      /^cdc_/, /__playwright/, /__puppeteer/, /__nightmare/, /__selenium/,
      /domAutomation/, /callPhantom/, /_phantom/, /webdriver/i,
      /^__webdriver/, /fxdriver/, /__$webdriver/
    ];
    try {
      for (const k of Object.getOwnPropertyNames(window)) {
        if (patterns.some((p) => p.test(k))) {
          try { delete window[k]; } catch (e) {
            try { Object.defineProperty(window, k, { value: undefined, configurable: true }); } catch (e2) {}
          }
        }
      }
    } catch (e) {}

    // Headless Chrome ships without a usable `chrome` object.
    if (!window.chrome) {
      try {
        Object.defineProperty(window, 'chrome', {
          value: { runtime: {}, app: { isInstalled: false } },
          configurable: true, writable: true, enumerable: true
        });
      } catch (e) {}
    }
  }

  /* ================================================================== *
   * 2. Navigator surface
   * ================================================================== */
  function buildPluginArray(list) {
    const arr = [];
    list.forEach(([name, filename, description, mimes], i) => {
      const p = Object.create(Plugin.prototype);
      try {
        Object.defineProperties(p, {
          name: { value: name, enumerable: true },
          filename: { value: filename, enumerable: true },
          description: { value: description, enumerable: true },
          length: { value: mimes.length, enumerable: true }
        });
        mimes.forEach(([type, suffixes, desc], j) => {
          const m = Object.create(MimeType.prototype);
          Object.defineProperties(m, {
            type: { value: type, enumerable: true },
            suffixes: { value: suffixes, enumerable: true },
            description: { value: desc, enumerable: true },
            enabledPlugin: { value: p, enumerable: true }
          });
          Object.defineProperty(p, j, { value: m, enumerable: true });
          Object.defineProperty(m, 'name', { value: type, enumerable: true });
        });
      } catch (e) {}
      arr.push(p);
    });
    try { Object.setPrototypeOf(arr, PluginArray.prototype); } catch (e) {}
    try {
      Object.defineProperties(arr, {
        length: { value: arr.length },
        item: { value: (i) => arr[i] || null },
        namedItem: { value: (n) => arr.find((p) => p && p.name === n) || null },
        refresh: { value: () => {} }
      });
    } catch (e) {}
    return arr;
  }

  const PLUGIN_LIST = [
    ['PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format',
      [['application/pdf', 'pdf', 'Portable Document Format'], ['text/pdf', 'pdf', 'Portable Document Format']]],
    ['Chrome PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format',
      [['application/pdf', 'pdf', 'Portable Document Format'], ['text/pdf', 'pdf', 'Portable Document Format']]],
    ['Chromium PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format',
      [['application/pdf', 'pdf', 'Portable Document Format'], ['text/pdf', 'pdf', 'Portable Document Format']]],
    ['Microsoft Edge PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format',
      [['application/pdf', 'pdf', 'Portable Document Format'], ['text/pdf', 'pdf', 'Portable Document Format']]],
    ['WebKit built-in PDF', 'internal-pdf-viewer', 'Portable Document Format',
      [['application/pdf', 'pdf', 'Portable Document Format'], ['text/pdf', 'pdf', 'Portable Document Format']]]
  ];

  let pluginArr = null;
  const getPlugins = () => {
    if (!pluginArr) pluginArr = buildPluginArray(PLUGIN_LIST);
    return pluginArr;
  };

  let mimeArr = null;
  const getMimeTypes = () => {
    if (!mimeArr) {
      const out = [];
      const seen = new Set();
      getPlugins().forEach((p) => {
        for (let i = 0; i < p.length; i++) {
          const m = p[i];
          if (m && !seen.has(m.type)) { seen.add(m.type); out.push(m); }
        }
      });
      try { Object.setPrototypeOf(out, MimeTypeArray.prototype); } catch (e) {}
      try {
        Object.defineProperties(out, {
          length: { value: out.length },
          item: { value: (i) => out[i] || null },
          namedItem: { value: (n) => out.find((m) => m && m.type === n) || null }
        });
      } catch (e) {}
      mimeArr = out;
    }
    return mimeArr;
  };

  function patchNavigator() {
    const P = window.Navigator && window.Navigator.prototype;
    if (!P) return;
    const prof = activeProfile();

    // --- core identity ------------------------------------------------
    if (prof) {
      redefineFn(P, 'userAgent', () => prof.uaFull);
      redefineFn(P, 'appVersion', () => prof.uaFull.replace(/^Mozilla\//, '5.0 (').length
        ? prof.uaFull.slice(8) : prof.uaFull);
      redefineFn(P, 'platform', () => prof.platform);
      if (prof.oscpu) redefineFn(P, 'oscpu', () => prof.oscpu);
      redefineFn(P, 'vendor', () => prof.vendor);
      redefineFn(P, 'maxTouchPoints', () => prof.touch);
    }

    // --- locale -------------------------------------------------------
    const loc = localeTarget();
    if (loc) {
      redefineFn(P, 'language', () => state.locale);
      redefineFn(P, 'languages', () => Object.freeze(state.languages.slice()));
    }

    // --- hardware -----------------------------------------------------
    if (prof && state.hardware === 'profile') {
      redefineFn(P, 'hardwareConcurrency', () => prof.cpu);
      redefineFn(P, 'deviceMemory', () => prof.memory);
    }

    // --- plugins (empty MIME list = almost certainly a bot) -----------
    if (state.profile === 'real' || prof) {
      redefineFn(P, 'plugins', () => getPlugins());
      redefineFn(P, 'mimeTypes', () => getMimeTypes());
      redefineFn(P, 'pdfViewerEnabled', () => true);
    }

    // --- userAgentData + client hints ---------------------------------
    if (prof) {
      const uaData = {
        brands: prof.uaBrands,
        mobile: prof.mobile,
        platform: prof.uaPlatform.replace(/"/g, ''),
        architecture: prof.mobile ? 'arm' : 'x86',
        bitness: prof.mobile ? '' : '64',
        getHighEntropyValues: (hints) => {
          const asked = new Set(hints || []);
          const out = {
            brands: prof.uaBrands,
            mobile: prof.mobile,
            platform: prof.uaPlatform.replace(/"/g, '')
          };
          if (asked.has('architecture')) out.architecture = prof.mobile ? 'arm' : 'x86';
          if (asked.has('bitness')) out.bitness = prof.mobile ? '32' : '64';
          if (asked.has('model')) out.model = prof.mobile ? 'Pixel 8' : '';
          if (asked.has('platformVersion')) out.platformVersion = prof.platform === 'MacIntel' ? '14.1.0' : (prof.mobile ? '14.0.0' : '15.0.0');
          if (asked.has('uaFullVersion')) out.uaFullVersion = CHROME_MAJOR + '.0.0.0';
          if (asked.has('fullVersionList')) {
            out.fullVersionList = prof.uaBrands.map((b, i) => ({ brand: b.brand, version: i === 2 ? '99' : CHROME_MAJOR + '.0.0.0' }));
          }
          return Promise.resolve(out);
        },
        toJSON: () => ({
          brands: prof.uaBrands, mobile: prof.mobile, platform: prof.uaPlatform.replace(/"/g, '')
        })
      };
      redefineFn(P, 'userAgentData', () => uaData);
    }

    // --- connection: a 10 Gbps/rtt 0 link is a datacentre tell --------
    try {
      const CP = window.NetworkInformation && window.NetworkInformation.prototype;
      if (CP) {
        const rnd = rngFor(ORIGIN + '|net|' + state.sessionSalt);
        const downlink = 4 + Math.floor(rnd() * 7);          // 4–10 Mbps
        const rtt = 40 + Math.floor(rnd() * 60);             // 40–100 ms
        redefineFn(CP, 'downlink', () => downlink);
        redefineFn(CP, 'rtt', () => rtt);
        redefineFn(CP, 'effectiveType', () => (downlink > 6 ? '4g' : '3g'));
        redefineFn(CP, 'saveData', () => false);
      }
    } catch (e) {}

    // --- misc ---------------------------------------------------------
    redefineFn(P, 'cookieEnabled', () => true);
  }

  /* ================================================================== *
   * 3. Screen + window geometry
   * ================================================================== *
   * Classic tell: a "Windows/Chrome 1920x1080" UA reporting a 800x600
   * screen, or `outerWidth === 0` (headless). All four numbers have to
   * agree with each other and with the profile.
   * ================================================================== */
  function patchScreen() {
    const prof = activeProfile();
    const SP = window.Screen && window.Screen.prototype;
    if (!SP) return;

    const target = state.screen === 'profile' && prof ? prof.screen : null;
    if (target) {
      redefineFn(SP, 'width', () => target.width);
      redefineFn(SP, 'height', () => target.height);
      redefineFn(SP, 'availWidth', () => target.availWidth);
      redefineFn(SP, 'availHeight', () => target.availHeight);
      redefineFn(SP, 'colorDepth', () => target.colorDepth);
      redefineFn(SP, 'pixelDepth', () => target.pixelDepth);
      try {
        const OP = window.ScreenOrientation && window.ScreenOrientation.prototype;
        if (OP) {
          redefineFn(OP, 'type', () => (target.height >= target.width ? 'portrait-primary' : 'landscape-primary'));
          redefineFn(OP, 'angle', () => 0);
        }
      } catch (e) {}
      redefineFn(window, 'devicePixelRatio', () => target.dpr);
    }

    // Headless / broken geometry repair — always applied.
    const w = window;
    if (!w.outerWidth || !w.outerHeight) {
      redefineFn(w, 'outerWidth', () => w.innerWidth || 1280);
      redefineFn(w, 'outerHeight', () => (w.innerHeight || 720) + 87);
    }
    if (w.screenX === undefined || w.screenY === undefined) {
      redefineFn(w, 'screenX', () => 0);
      redefineFn(w, 'screenY', () => 0);
    }
  }

  /* ================================================================== *
   * 4. Timezone + locale
   * ================================================================== *
   * This is the #1 "you're on a VPN" tell that a browser CAN fix.
   * Your IP says Frankfurt but Intl says Asia/Kolkata -> instant flag.
   * ================================================================== */
  const OrigDTF = Intl.DateTimeFormat;

  function tzOffsetMinutes(tz, date) {
    // Primary path: ICU's longOffset -> "GMT+05:30"
    try {
      const parts = new OrigDTF('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(date);
      const p = parts.find((x) => x.type === 'timeZoneName');
      const m = /GMT([+-])(\d{2}):(\d{2})/.exec(p ? p.value : '');
      if (m) return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    } catch (e) {}

    // Fallback: compare wall-clock fields in the zone against UTC.
    try {
      const fmt = new OrigDTF('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const p = {};
      fmt.formatToParts(date).forEach((x) => { p[x.type] = x.value; });
      const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
      return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    } catch (e) { return 0; }
  }

  function tzDisplayName(tz, date) {
    for (const style of ['long', 'longGeneric', 'shortGeneric']) {
      try {
        const p = new OrigDTF('en-US', { timeZone: tz, timeZoneName: style }).formatToParts(date);
        const f = p.find((x) => x.type === 'timeZoneName');
        if (f && f.value && !/^GMT/.test(f.value)) return f.value;
      } catch (e) {}
    }
    return tz;
  }

  function gmtString(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const a = Math.abs(minutes);
    const hh = String(Math.floor(a / 60)).padStart(2, '0');
    const mm = String(a % 60).padStart(2, '0');
    return `GMT${sign}${hh}${mm}`;
  }

  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function installTimezonePatches() {
    const DP = Date.prototype;

    // Date.prototype.getTimezoneOffset -> minutes to ADD to local to get UTC
    const origGetTZO = DP.getTimezoneOffset;
    DP.getTimezoneOffset = function () {
      const tz = tzTarget();
      if (!tz) return origGetTZO.call(this);
      return -tzOffsetMinutes(tz, this);
    };

    // Date.prototype.toString -> "Mon Oct 11 2026 10:30:00 GMT+0530 (India Standard Time)"
    const origToString = DP.toString;
    DP.toString = function () {
      const tz = tzTarget();
      if (!tz) return origToString.call(this);
      try {
        const p = {};
        new OrigDTF('en-US', {
          timeZone: tz, hour12: false,
          weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).formatToParts(this).forEach((x) => { p[x.type] = x.value; });
        const off = tzOffsetMinutes(tz, this);
        return `${p.weekday} ${p.month} ${p.day} ${p.year} ${p.hour}:${p.minute}:${p.second} ${gmtString(off)} (${tzDisplayName(tz, this)})`;
      } catch (e) { return origToString.call(this); }
    };

    // toLocaleString family: default the zone, keep explicit overrides
    function wrapLocaleFn(name) {
      const o = DP[name];
      DP[name] = function (locale, options) {
        const tz = tzTarget();
        if (!tz) return o.apply(this, arguments);
        let loc = locale, opts = options;
        if (typeof loc === 'object' && loc !== null && opts === undefined) { opts = loc; loc = undefined; }
        opts = Object.assign({}, opts || {});
        if (!opts.timeZone) opts.timeZone = tz;
        if (localeTarget() && loc === undefined) loc = state.locale;
        return o.call(this, loc, opts);
      };
    }
    ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(wrapLocaleFn);

    // Intl.DateTimeFormat: constructor + resolvedOptions
    function PatchedDTF(locale, options) {
      const opts = Object.assign({}, options || {});
      const tz = tzTarget();
      if (tz && !opts.timeZone) opts.timeZone = tz;
      if (localeTarget() && locale === undefined) locale = state.locale;
      return new OrigDTF(locale, opts);
    }
    try {
      PatchedDTF.prototype = OrigDTF.prototype;
      PatchedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
      Object.defineProperty(PatchedDTF, 'name', { value: 'DateTimeFormat', configurable: true });
      Object.defineProperty(PatchedDTF, 'length', { value: OrigDTF.length, configurable: true });
      Object.defineProperty(Intl, 'DateTimeFormat', { value: PatchedDTF, writable: true, configurable: true });
    } catch (e) {}

    const origResolved = OrigDTF.prototype.resolvedOptions;
    OrigDTF.prototype.resolvedOptions = function () {
      const o = origResolved.call(this);
      const tz = tzTarget();
      if (tz) o.timeZone = tz;
      const loc = localeTarget();
      if (loc && !this.__gsExplicitLocale) o.locale = loc;
      return o;
    };

    // Intl.NumberFormat / RelativeTimeFormat / Collator locale default
    ['NumberFormat', 'RelativeTimeFormat', 'Collator', 'PluralRules', 'ListFormat', 'Segmenter'].forEach((k) => {
      const O = Intl[k];
      if (!O || O.__gsPatched) return;
      const Wrapped = function (locale, options) {
        const loc = localeTarget() && locale === undefined ? state.locale : locale;
        return new O(loc, options);
      };
      try {
        Wrapped.prototype = O.prototype;
        if (O.supportedLocalesOf) Wrapped.supportedLocalesOf = O.supportedLocalesOf.bind(O);
        Object.defineProperty(Wrapped, 'name', { value: k, configurable: true });
        Object.defineProperty(Intl, k, { value: Wrapped, writable: true, configurable: true });
        O.__gsPatched = true;
      } catch (e) {}
    });
  }

  /* ================================================================== *
   * 5. Canvas / WebGL / audio — deterministic per-origin noise
   * ================================================================== */
  const FP_CANVAS_MAX_AREA = 96 * 1024;   // fingerprint canvases are tiny
  const FP_AUDIO_MAX_LEN = 1 << 20;

  function noiseBytes(data) {
    const rnd = rngFor(ORIGIN + '|canvas|' + state.sessionSalt + '|' + data.length);
    const n = Math.min(96, Math.max(8, data.length >> 6));
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rnd() * (data.length / 4)) * 4;
      const delta = rnd() < 0.5 ? 1 : 255; // ±1 with wraparound
      data[idx + 2] = (data[idx + 2] + delta) & 0xff; // blue channel: invisible
    }
  }

  function installCanvasPatches() {
    const CP = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    const HP = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
    if (!CP || !HP) return;

    const origGetImageData = CP.getImageData;
    const origPutImageData = CP.putImageData;

    function isFpSized(canvas) {
      const w = canvas.width || 0, h = canvas.height || 0;
      return w > 0 && h > 0 && w * h <= FP_CANVAS_MAX_AREA;
    }

    // Noise the real pixels once, so every later read agrees.
    function noisify(canvas) {
      if (canvas.__gsNoised) return;
      canvas.__gsNoised = true;
      if (!isFpSized(canvas)) return;
      let ctx = null;
      try { ctx = canvas.getContext('2d'); } catch (e) {}
      if (!ctx) return;
      try {
        const img = origGetImageData.call(ctx, 0, 0, canvas.width, canvas.height);
        noiseBytes(img.data);
        origPutImageData.call(ctx, img, 0, 0);
      } catch (e) {}
    }

    CP.getImageData = function () {
      if (state.canvas === 'noise' && this.canvas) noisify(this.canvas);
      return origGetImageData.apply(this, arguments);
    };

    const origToDataURL = HP.toDataURL;
    HP.toDataURL = function () {
      if (state.canvas === 'noise') { try { noisify(this); } catch (e) {} }
      return origToDataURL.apply(this, arguments);
    };

    const origToBlob = HP.toBlob;
    HP.toBlob = function () {
      if (state.canvas === 'noise') { try { noisify(this); } catch (e) {} }
      return origToBlob.apply(this, arguments);
    };

    if (window.OffscreenCanvas && OffscreenCanvas.prototype.convertToBlob) {
      const o = OffscreenCanvas.prototype.convertToBlob;
      OffscreenCanvas.prototype.convertToBlob = function () {
        if (state.canvas === 'noise') {
          try {
            if (!this.__gsNoised) {
              this.__gsNoised = true;
              if (isFpSized(this)) {
                const ctx = this.getContext('2d');
                if (ctx) {
                  const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                  noiseBytes(img.data);
                  origPutImageData.call(ctx, img, 0, 0);
                }
              }
            }
          } catch (e) {}
        }
        return o.apply(this, arguments);
      };
    }

    // WebGL read-back
    ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach((name) => {
      const C = window[name];
      if (!C) return;
      const o = C.prototype.readPixels;
      if (!o) return;
      C.prototype.readPixels = function (x, y, w, h, fmt, type, dst) {
        const r = o.apply(this, arguments);
        if (state.canvas === 'noise' && dst && dst.length && dst.length <= (1 << 22)) {
          try { noiseBytes(dst); } catch (e) {}
        }
        return r;
      };
    });
  }

  function installWebGLPatches() {
    ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach((name) => {
      const C = window[name];
      if (!C) return;
      const PP = C.prototype;
      const oGetParameter = PP.getParameter;
      const oGetShaderPrecisionFormat = PP.getShaderPrecisionFormat;

      const DEBUG_VENDOR = 0x9245;
      const DEBUG_RENDERER = 0x9246;

      PP.getParameter = function (pname) {
        const prof = activeProfile();
        if (state.webgl === 'spoof' && prof) {
          const g = prof.webgl;
          switch (pname) {
            case DEBUG_VENDOR: return g.vendor;
            case DEBUG_RENDERER: return g.renderer;
            case 0x1f00: return 'WebKit';                       // VENDOR
            case 0x1f01: return 'WebKit WebGL';                 // RENDERER
            case 0x1f02: return name === 'WebGL2RenderingContext'
              ? 'WebGL 2.0 (OpenGL ES 3.0 Chromium)' : 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
            case 0x8b8c: return name === 'WebGL2RenderingContext'
              ? 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)' : 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
            case 0x0d33: return g.maxTex;                       // MAX_TEXTURE_SIZE
            case 0x84e8: return g.maxTex;                       // MAX_RENDERBUFFER_SIZE
            case 0x0d3a: return new Int32Array([g.maxTex, g.maxTex]); // MAX_VIEWPORT_DIMS
            case 0x8869: return 16;                             // MAX_VERTEX_ATTRIBS
            case 0x8dfb: return 1024;                           // MAX_VERTEX_UNIFORM_VECTORS
            case 0x851c: return g.maxTex;                       // MAX_CUBE_MAP_TEXTURE_SIZE
            case 0x8872: return 32;                             // MAX_TEXTURE_IMAGE_UNITS
            case 0x8b4d: return 32;                             // MAX_COMBINED_TEXTURE_IMAGE_UNITS
            case 0x0d32: case 0x84e8: return g.maxTex;
            default: break;
          }
        }
        return oGetParameter.apply(this, arguments);
      };

      PP.getShaderPrecisionFormat = function () {
        const prof = activeProfile();
        if (state.webgl === 'spoof' && prof) {
          return { rangeMin: 127, rangeMax: 127, precision: 23 };
        }
        return oGetShaderPrecisionFormat.apply(this, arguments);
      };

      const oGetExtension = PP.getExtension;
      PP.getExtension = function (ext) {
        const prof = activeProfile();
        if (state.webgl === 'spoof' && prof && ext === 'WEBGL_debug_renderer_info') {
          return { UNMASKED_VENDOR_WEBGL: DEBUG_VENDOR, UNMASKED_RENDERER_WEBGL: DEBUG_RENDERER };
        }
        return oGetExtension.apply(this, arguments);
      };

      const oGetSupported = PP.getSupportedExtensions;
      PP.getSupportedExtensions = function () {
        const list = oGetSupported.apply(this, arguments);
        if (state.webgl !== 'spoof' || !activeProfile()) return list;
        // Datacentre/GPU-specific extensions are a fingerprint; keep only the
        // set that ships on every Chrome build for this class of GPU.
        const banned = /^WEBGL_(debug|compressed_tex|multi_draw|draw_buffers_indexed|polygon_mode)|^EXT_(texture_filter|disjoint|color_buffer_float|float_blend|sRGB_write)|^KHR_parallel_shader_compile$/i;
        try { return list.filter((e) => !banned.test(e)); } catch (e) { return list; }
      };
    });
  }

  function installAudioPatches() {
    if (!window.AudioBuffer) return;
    const AB = AudioBuffer.prototype;
    const oGetChannelData = AB.getChannelData;

    function noiseFloat(arr, channel) {
      if (arr.__gsNoised) return arr;
      try { Object.defineProperty(arr, '__gsNoised', { value: true }); } catch (e) {}
      const rnd = rngFor(ORIGIN + '|audio|' + state.sessionSalt + '|' + channel);
      // 1e-7 is ~140 dB below full scale: changes every hash, inaudible.
      for (let i = 0; i < arr.length; i += 97) {
        arr[i] = arr[i] + (rnd() - 0.5) * 2e-7;
      }
      return arr;
    }

    AB.getChannelData = function (channel) {
      const arr = oGetChannelData.call(this, channel);
      if (state.audio === 'noise' && arr && arr.length && arr.length <= FP_AUDIO_MAX_LEN) {
        try { noiseFloat(arr, channel); } catch (e) {}
      }
      return arr;
    };

    if (window.AnalyserNode) {
      const AP = AnalyserNode.prototype;
      const oByte = AP.getByteFrequencyData;
      const oFloat = AP.getFloatFrequencyData;
      AP.getByteFrequencyData = function (arr) {
        const r = oByte.apply(this, arguments);
        if (state.audio === 'noise' && arr && arr.length) {
          const rnd = rngFor(ORIGIN + '|analyser|' + state.sessionSalt);
          for (let i = 0; i < arr.length; i += 31) {
            arr[i] = Math.max(0, Math.min(255, arr[i] + (rnd() < 0.5 ? 1 : -1)));
          }
        }
        return r;
      };
      AP.getFloatFrequencyData = function (arr) {
        const r = oFloat.apply(this, arguments);
        if (state.audio === 'noise' && arr && arr.length) {
          const rnd = rngFor(ORIGIN + '|analyserf|' + state.sessionSalt);
          for (let i = 0; i < arr.length; i += 31) arr[i] += (rnd() - 0.5) * 1e-6;
        }
        return r;
      };
    }
  }

  /* ================================================================== *
   * 6. WebRTC — the classic "real IP behind the proxy" leak
   * ================================================================== *
   * Two layers:
   *   launcher: --force-webrtc-ip-handling-policy=disable_non_proxied_udp
   *   here:     strip host/srflx candidates that expose non-tunnel IPs
   * ================================================================== */
  const PRIVATE_V4 = [/^10\./, /^192\.168\./, /^169\.254\./, /^127\./, /^0\./, /^172\.(1[6-9]|2\d|3[01])\./];
  const PRIVATE_V6 = [/^fc/i, /^fd/i, /^fe80/i, /^::1$/, /^::$/];

  function candidateRevealsLocal(cand) {
    if (!cand || !cand.candidate) return false;
    const s = String(cand.candidate);
    if (/\.local\b/i.test(s)) return false;         // mDNS-obfuscated: safe
    const m = /(?:^|\s)(?:a?candidate:.*?\s)?(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{6,})\s/i.exec(s);
    const ipMatch = m ? m[1] : (s.match(/(\d{1,3}(?:\.\d{1,3}){3})/) || [])[1];
    const v6 = s.match(/([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}/);
    if (ipMatch && PRIVATE_V4.some((r) => r.test(ipMatch))) return true;
    if (v6 && PRIVATE_V6.some((r) => r.test(v6[0]))) return true;
    return false;
  }

  function installWebRTCPatches() {
    const Names = ['RTCPeerConnection', 'webkitRTCPeerConnection'];
    Names.forEach((nm) => {
      const Orig = window[nm];
      if (!Orig || Orig.__gsPatched) return;

      if (state.webrtc === 'block') {
        const Stub = function () {
          throw new DOMException('WebRTC is disabled by GhostShell Shield', 'NotSupportedError');
        };
        Stub.__gsPatched = true;
        try {
          Object.defineProperty(window, nm, { value: Stub, writable: true, configurable: true });
          if (window.RTCPeerConnection === undefined || nm === 'RTCPeerConnection') {
            // keep the prototype surface so `instanceof` checks don't explode
            try { Stub.prototype = Orig.prototype; } catch (e) {}
          }
        } catch (e) {}
        return;
      }

      if (state.webrtc !== 'protect') return;

      function Patched(...args) {
        const pc = new Orig(...args);
        try {
          // Intercept the onicecandidate property
          let userHandler = null;
          let internalHandler = null;
          const wrapHandler = (fn) => function (ev) {
            if (ev && candidateRevealsLocal(ev.candidate)) return;
            return fn ? fn.call(this, ev) : undefined;
          };
          Object.defineProperty(pc, 'onicecandidate', {
            configurable: true,
            get: () => internalHandler,
            set: (fn) => { userHandler = fn; internalHandler = wrapHandler(fn); try { Orig.prototype.__lookupSetter__.call(pc, 'onicecandidate'); } catch (e) {} pc.addEventListener('icecandidate', internalHandler); }
          });

          const oAdd = pc.addEventListener.bind(pc);
          pc.addEventListener = function (type, fn, opts) {
            if (type === 'icecandidate' && typeof fn === 'function' && fn !== internalHandler) {
              return oAdd(type, wrapHandler(fn), opts);
            }
            return oAdd(type, fn, opts);
          };
        } catch (e) {}
        return pc;
      }
      Patched.prototype = Orig.prototype;
      Patched.__gsPatched = true;
      Patched.generateCertificate = Orig.generateCertificate ? Orig.generateCertificate.bind(Orig) : undefined;
      try {
        Object.defineProperty(window, nm, { value: Patched, writable: true, configurable: true });
      } catch (e) {}
    });
  }

  /* ================================================================== *
   * 7. Media devices, battery, permissions, fonts, geolocation
   * ================================================================== */
  function installMediaDevicesPatches() {
    if (!navigator.mediaDevices) return;
    const MD = navigator.mediaDevices;
    const oEnum = MD.enumerateDevices ? MD.enumerateDevices.bind(MD) : null;

    const generic = () => {
      const rnd = rngFor(ORIGIN + '|devices|' + state.sessionSalt);
      const id = (n) => {
        let s = '';
        for (let i = 0; i < 32; i++) s += '0123456789abcdef'[Math.floor(rnd() * 16)];
        return s.slice(0, n || 32);
      };
      // Deliberately: mic + speakers, no camera. The single most common
      // desktop profile, so it is boring rather than suspicious.
      const mk = (kind, label, group) => ({
        deviceId: id(), kind, label, groupId: group,
        toJSON: () => ({ deviceId: id(), kind, label, groupId: group })
      });
      const g = id(8);
      return Promise.resolve([
        mk('audioinput', 'Default - Microphone', g),
        mk('audiooutput', 'Default - Speakers', g)
      ]);
    };

    MD.enumerateDevices = function () {
      if (state.mediaDevices === 'generic') return generic();
      if (state.mediaDevices === 'hide') return Promise.resolve([]);
      return oEnum ? oEnum() : Promise.resolve([]);
    };
  }

  function installBatteryPatches() {
    if (state.battery !== 'spoof') return;
    const proto = {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      onchargingchange: null,
      onlevelchange: null
    };
    try {
      Object.defineProperty(Navigator.prototype, 'getBattery', {
        value: () => Promise.resolve(Object.assign({}, proto)),
        configurable: true, writable: true
      });
    } catch (e) {}
    if (window.BatteryManager) {
      const BP = BatteryManager.prototype;
      ['charging', 'chargingTime', 'dischargingTime', 'level'].forEach((k) => redefineFn(BP, k, () => proto[k]));
    }
  }

  function installPermissionPatches() {
    if (state.permissions !== 'normalise') return;
    if (!navigator.permissions || !navigator.permissions.query) return;
    const oQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function (desc) {
      // Headless/CLI Chrome answers 'denied' for notifications, which no
      // real desktop Chrome ever reports as the default.
      if (desc && desc.name === 'notifications') return Promise.resolve({ state: 'prompt', onchange: null });
      return oQuery(desc);
    };
  }

  const CURATED_FONTS = new Set([
    'arial', 'arial black', 'arial narrow', 'calibri', 'cambria', 'candara',
    'comic sans ms', 'consolas', 'constantia', 'corbel', 'courier new',
    'georgia', 'helvetica', 'impact', 'lucida console', 'lucida sans unicode',
    'microsoft sans serif', 'palatino linotype', 'segoe ui', 'tahoma',
    'times new roman', 'trebuchet ms', 'verdana', 'webdings', 'wingdings',
    'monospace', 'sans-serif', 'serif', 'cursive', 'fantasy', 'system-ui'
  ]);

  function installFontPatches() {
    if (state.fonts !== 'curated') return;
    if (!document.fonts || !document.fonts.check) return;
    const oCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = function (font, text) {
      try {
        const primary = String(font).split(',')[0].trim().toLowerCase().replace(/^["']|["']$/g, '');
        const base = primary.replace(/\s+(bold|italic|light|medium|regular|\d+px|\d+pt|small|large|x-large|xx-large)$/g, '').trim();
        if (CURATED_FONTS.has(base) || CURATED_FONTS.has(primary)) return true;
        return false;
      } catch (e) { return oCheck(font, text); }
    };
  }

  function installGeolocationPatches() {
    if (!navigator.geolocation) return;
    const GL = navigator.geolocation;

    const coords = () => {
      const rnd = rngFor(ORIGIN + '|geo|' + state.sessionSalt);
      // ~150 m of stable jitter: a real GPS/Wi-Fi fix is never exact and
      // never *identical* across sites, but it also never teleports.
      const jitterLat = (rnd() - 0.5) * 0.0027;
      const jitterLon = (rnd() - 0.5) * 0.0027;
      return {
        latitude: state.lat + jitterLat,
        longitude: state.lon + jitterLon,
        altitude: null,
        accuracy: state.accuracy,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      };
    };

    if (state.geoMode === 'off') {
      const deny = (cb) => {
        const err = { code: 1, PERMISSION_DENIED: 1, message: 'User denied Geolocation' };
        if (cb) setTimeout(() => cb(err), 10);
      };
      GL.getCurrentPosition = (ok, err) => deny(err);
      GL.watchPosition = (ok, err) => { deny(err); return 1; };
      GL.clearWatch = () => {};
      return;
    }

    if (state.geoMode === 'custom' || state.geoMode === 'match-proxy') {
      GL.getCurrentPosition = function (ok, err, opts) {
        if (!ok) return;
        setTimeout(() => ok({
          coords: coords(),
          timestamp: Date.now(),
          toJSON: function () { return { coords: this.coords, timestamp: this.timestamp }; }
        }), 10);
        return undefined;
      };
      GL.watchPosition = function (ok, err, opts) {
        if (ok) {
          setTimeout(() => ok({
            coords: coords(), timestamp: Date.now(),
            toJSON: function () { return { coords: this.coords, timestamp: this.timestamp }; }
          }), 10);
        }
        return 1;
      };
      GL.clearWatch = () => {};
    }
  }

  /* ================================================================== *
   * Apply / re-apply
   * ================================================================== */
  function installOnce() {
    if (installed) return;
    installed = true;
    scrubAutomation();
    installTimezonePatches();
    installCanvasPatches();
    installWebGLPatches();
    installAudioPatches();
    installMediaDevicesPatches();
    installBatteryPatches();
    installPermissionPatches();
    installFontPatches();
    installGeolocationPatches();
  }

  function applyConfig(cfg) {
    if (!cfg || cfg.enabled === false) { state.enabled = false; return; }
    Object.assign(state, cfg);
    state.enabled = true;
    installOnce();
    installWebRTCPatches();
    try { patchNavigator(); } catch (e) {}
    try { patchScreen(); } catch (e) {}
    try { installGeolocationPatches(); } catch (e) {}
  }

  /* Defaults are applied immediately so that pages are never able to read
   * an unpatched value, even if the background worker is slow. */
  applyConfig(Object.assign({}, DEFAULTS, { sessionSalt: ORIGIN + '|boot' }));

  /* Ask the isolated-world content script for the real config. */
  window.addEventListener('message', (ev) => {
    if (!ev || ev.source !== window) return;
    const d = ev.data;
    if (d && d.__ghostshell && d.type === 'config') {
      applyConfig(d.config);
    }
  }, false);

  try {
    window.postMessage({ __ghostshell: true, type: 'ready' }, '*');
  } catch (e) {}

  GS.state = state;
  GS.applyConfig = applyConfig;
})();
