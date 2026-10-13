/* GhostShell in-site browser — search, embedded viewer, proxy manager.
 *
 * Talks ONLY to the local relay (127.0.0.1:8787). On the static Pages
 * deployment the fetch fails by design and the page shows "relay not
 * running" — expected behaviour, not a bug: the viewer must never be able
 * to fetch anything except through the relay the user is running.
 */
(function () {
  'use strict';

  // Probe the page's own origin first in ping(); if that isn't the relay and
  // we aren't already on a loopback HTTP origin, fall back to 127.0.0.1:8787.
  // On https Pages both probes fail and we land in "relay not running" as intended.
  var isLoopback = location.protocol === 'http:' &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
  var RELAY = isLoopback ? location.origin : 'http://127.0.0.1:8787';

  var SEARCH = 'https://lite.duckduckgo.com/lite/?q=';

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

  // ── history (toolbar-level navigations; the iframe is same-origin
  //    once the relay is up, so we can also read its real location) ──
  var history = [];
  var hIndex = -1;

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
      var sel = $(id);
      if (!sel) return;
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toUpperCase() === cc) return;
      }
      var opt = document.createElement('option');
      opt.value = cc;
      opt.textContent = cc + ' · Pool';
      sel.appendChild(opt);
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
      relayUp = true;
      setPill('online', 'relay: online · v' + data.version);
      $('stRelay').textContent = 'online · v' + data.version;
      $('stIdentity').textContent = '#' + data.identity;
      if (!$('stEgress').textContent || $('stEgress').textContent === 'auto') {
        $('stEgress').textContent = mask(data.activeProxy || 'direct');
      }
      $('relayDown').classList.remove('show');
      viewer.style.display = '';
      $('btnReload').disabled = false;
      return data;
    }).catch(function () {
      relayUp = false;
      setPill('offline', 'relay: not running');
      $('stRelay').textContent = 'not running';
      $('relayDown').classList.add('show');
      viewer.style.display = 'none';
      $('btnReload').disabled = true;
      return null;
    });
  }

  // ── navigation ────────────────────────────────────────────────────────

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

  function navigate(target, push) {
    if (!relayUp) { toast('relay not running — start tools/relay.sh first'); return; }
    var isNewVisit = push !== false;
    var rotateChk = $('chkRotateSearch');
    var rotateOnSearch = rotateChk ? rotateChk.checked : true;
    var shouldRotate = isNewVisit && rotateOnSearch && window._selectedProxy !== 'direct';
    var p = shouldRotate ? 'random' : (window._selectedProxy || 'auto');
    var url = viewUrl(target, p, {
      rotate: shouldRotate ? 1 : 0,
      nonce: isNewVisit ? Date.now() : null,
    });
    if (isNewVisit) {
      history = history.slice(0, hIndex + 1);
      history.push({ target: target, url: url });
      hIndex = history.length - 1;
    }
    viewer.src = url;
    $('addr').value = target;
    $('btnBack').disabled = hIndex <= 0;
    $('btnFwd').disabled = hIndex >= history.length - 1;
    $('btnReload').disabled = false;
    updateEgress();
  }

  function updateEgress() {
    var sel = window._selectedProxy || 'auto';
    if (sel === 'direct') {
      $('stEgress').textContent = 'direct';
      return;
    }
    if (sel === 'auto' && !window._selectedProxyRaw) {
      var cc = getSelectedCountry();
      $('stEgress').textContent = 'auto (clean' + (cc !== 'ALL' ? ' · ' + cc : '') + ')';
      return;
    }
    var label = mask(window._selectedProxyRaw || sel);
    if (window._selectedProxyCountry) label += ' [' + window._selectedProxyCountry + ']';
    if (window._selectedProxyIp) label += ' (' + window._selectedProxyIp + ')';
    $('stEgress').textContent = label;
  }

  // Read the real URL + rewrite stats + egress proxy back out of the viewer
  // once a page loads. Safe: the relay serves /view from our origin and strips
  // scripts, and the iframe stays sandboxed without popups.
  viewer.addEventListener('load', function () {
    if (!relayUp) return;
    try {
      var loc = viewer.contentWindow.location;
      if (loc.href === 'about:blank') return;
      var u = new URL(loc.href).searchParams.get('u');
      if (u) {
        $('addr').value = u;
        if (hIndex >= 0) history[hIndex].target = u;
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
        var praw = egressMeta.getAttribute('data-proxy-raw') || '';
        var pcc = egressMeta.getAttribute('data-country') || '';
        var pip = egressMeta.getAttribute('data-ip') || '';
        if (pid && pid !== 'direct') {
          window._selectedProxy = pid;
          window._selectedProxyRaw = praw || egContent;
          window._selectedProxyCountry = pcc || null;
          window._selectedProxyIp = pip || null;
        }
        if (egContent) {
          $('stEgress').textContent = mask(egContent);
        }
        if ($('proxyPanel') && $('proxyPanel').classList.contains('open')) {
          loadProxies();
        }
      }
    } catch (e) { /* ignore */ }
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
    if (hIndex > 0) { hIndex--; navigate(history[hIndex].target, false); }
  });
  $('btnFwd').addEventListener('click', function () {
    if (hIndex < history.length - 1) { hIndex++; navigate(history[hIndex].target, false); }
  });
  $('btnReload').addEventListener('click', function () {
    if (hIndex >= 0) navigate(history[hIndex].target, false);
    else if ($('addr').value) { var t = targetFor($('addr').value); if (t) navigate(t); }
  });

  // ── random non-detected proxy & country filter ────────────────────────

  function selectRandomClean() {
    if (!relayUp) { toast('relay not running'); return; }
    var country = getSelectedCountry();
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'random', cleanOnly: true, country: country }),
    }).then(function (data) {
      window._selectedProxy = data.active || 'direct';
      window._selectedProxyRaw = data.proxy && data.proxy !== 'direct' ? data.proxy : null;
      window._selectedProxyCountry = data.countryCode || null;
      window._selectedProxyIp = data.exitIp || null;
      updateEgress();
      if (!data.active || data.proxy === 'direct') {
        toast('no clean proxy available' + (country !== 'ALL' ? ' for ' + country : '') + ' · browsing direct');
      } else {
        var label = mask(data.proxy);
        if (data.countryCode) label += ' [' + data.countryCode + ']';
        if (data.exitIp) label += ' (' + data.exitIp + ')';
        toast('clean proxy → ' + label);
      }
      loadProxies();
      if (hIndex >= 0) navigate(history[hIndex].target, false);
    }).catch(function (e) { toast(e.message); });
  }

  if ($('btnRandom')) {
    $('btnRandom').addEventListener('click', selectRandomClean);
  }
  if ($('btnRandomClean')) {
    $('btnRandomClean').addEventListener('click', selectRandomClean);
  }

  function onCountryChange(ev) {
    var val = ev.target.value || 'ALL';
    setSelectedCountry(val);
    if (lastPoolData) renderProxies(lastPoolData);
    updateEgress();
    if (!relayUp) return;
    if (window._selectedProxy === 'direct') return;
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'random', cleanOnly: true, country: val }),
    }).then(function (data) {
      if (data.active && data.proxy !== 'direct') {
        window._selectedProxy = data.active;
        window._selectedProxyRaw = data.proxy;
        window._selectedProxyCountry = data.countryCode || null;
        window._selectedProxyIp = data.exitIp || null;
        updateEgress();
        toast('country ' + val + ' → ' + mask(data.proxy));
      } else {
        toast('country filter: ' + val);
      }
      loadProxies();
    }).catch(function () {});
  }

  if ($('countrySelect')) {
    $('countrySelect').addEventListener('change', onCountryChange);
  }
  if ($('panelCountrySelect')) {
    $('panelCountrySelect').addEventListener('change', onCountryChange);
  }

  // ── identity ──────────────────────────────────────────────────────────

  $('btnIdentity').addEventListener('click', function () {
    if (!relayUp) { toast('relay not running'); return; }
    var country = getSelectedCountry();
    api('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: country }),
    }).then(function (data) {
      $('stIdentity').textContent = '#' + data.identity;
      window._selectedProxy = data.active || 'direct';
      window._selectedProxyRaw = data.proxy && data.proxy !== 'direct' ? data.proxy : null;
      window._selectedProxyCountry = data.countryCode || null;
      window._selectedProxyIp = data.exitIp || null;
      updateEgress();
      toast('new identity · cookies dropped · egress: ' + mask(data.proxy || 'direct'));
      loadProxies();
      if (hIndex >= 0) navigate(history[hIndex].target, false);
    }).catch(function (e) { toast('identity reset failed: ' + e.message); });
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
      return p.clean !== false && !(p.hosting === true || p.isProxy === true) && p.lastOk !== false;
    }).length;
    $('poolCount').textContent = allProxies.length
      ? ('· ' + allProxies.length + ' (' + cleanCount + ' clean)')
      : '';

    if (allProxies.length === 0) {
      list.innerHTML = '<p style="color:var(--dim);font-size:12.5px">' +
        'No proxies yet. Paste some above, or browse direct — the relay works without a pool.</p>';
      return;
    }
    if (proxies.length === 0) {
      list.innerHTML = '<p style="color:var(--dim);font-size:12.5px">' +
        'No proxies matching country <b>' + escapeHtml(countryFilter) + '</b>. ' +
        'Run "Test all" to detect exit countries, or switch Country to ALL.</p>';
      return;
    }

    list.innerHTML = '';
    proxies.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'proxy-row' + (data.active === p.id ? ' active' : '');

      var score = Math.round(p.score);
      var status = p.lastOk == null ? '' : (p.lastOk ? 'ok' : 'bad');
      var isDetected = Boolean(p.detected || p.hosting === true || p.isProxy === true);
      var isClean = !isDetected && p.lastOk !== false;
      var cc = (p.countryCode || '').toUpperCase();

      var countryBadge = '<span class="pbadge country">' + escapeHtml(cc || 'ANY') + '</span>';
      var detectBadge = isDetected
        ? '<span class="pbadge detected">detected</span>'
        : (p.lastOk === false
            ? '<span class="pbadge detected">failed</span>'
            : '<span class="pbadge clean">clean</span>');

      var bits = [];
      if (p.lastMs) bits.push(p.lastMs + 'ms');
      if (p.exitIp) bits.push(p.exitIp);
      if (p.country) bits.push(p.country);
      if (p.isp) bits.push(p.isp);
      if (p.error) bits.push('ERR: ' + p.error.slice(0, 60));
      if (p.hosting === true) bits.push('datacenter');
      if (p.isProxy === true) bits.push('flagged-proxy');

      row.innerHTML =
        '<div class="raw">' +
          '<span class="dot ' + status + '"></span>' +
          '<span>' + escapeHtml(mask(p.raw)) + '</span>' +
          countryBadge +
          detectBadge +
        '</div>' +
        '<div class="meta">' + escapeHtml(bits.join(' · ') || (isClean ? 'clean · untested' : 'untested')) + ' · score ' + score + '</div>' +
        '<div class="scorebar"><i style="width:' + score + '%"></i></div>' +
        '<div class="row-actions">' +
        '<button data-act="use">Use</button>' +
        '<button data-act="test">Test</button>' +
        '<button data-act="rm">Remove</button>' +
        '</div>';
      row.querySelector('[data-act=use]').addEventListener('click', function () {
        api('/api/proxy/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id }),
        }).then(function () {
          window._selectedProxy = p.id;
          window._selectedProxyRaw = p.raw;
          window._selectedProxyCountry = p.countryCode || null;
          window._selectedProxyIp = p.exitIp || null;
          updateEgress();
          toast('egress → ' + mask(p.raw));
          loadProxies();
        }).catch(function (e) { toast(e.message); });
      });
      row.querySelector('[data-act=test]').addEventListener('click', function (ev) {
        ev.target.disabled = true;
        ev.target.textContent = '…';
        api('/api/proxy/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id }),
        }).then(function () { loadProxies(); toast('tested ' + mask(p.raw)); })
          .catch(function (e) { toast(e.message); })
          .then(function () { ev.target.disabled = false; ev.target.textContent = 'Test'; });
      });
      row.querySelector('[data-act=rm]').addEventListener('click', function () {
        api('/api/proxy?id=' + encodeURIComponent(p.id), { method: 'DELETE' })
          .then(function () { loadProxies(); toast('removed'); })
          .catch(function (e) { toast(e.message); });
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
    return api('/api/proxy').then(renderProxies).catch(function () {});
  }

  $('btnProxies').addEventListener('click', function () {
    var panel = $('proxyPanel');
    panel.classList.toggle('open');
    $('btnProxies').classList.toggle('active', panel.classList.contains('open'));
    if (panel.classList.contains('open')) loadProxies();
  });

  $('btnAdd').addEventListener('click', function () {
    if (!relayUp) { toast('relay not running'); return; }
    var text = $('proxyInput').value;
    if (!text.trim()) { toast('paste some proxies first'); return; }
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
    if (!relayUp) { toast('relay not running'); return; }
    toast('testing the pool…');
    api('/api/proxy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function () { loadProxies(); toast('pool tested'); })
      .catch(function (e) { toast('test failed: ' + e.message); });
  });

  $('btnSelectBest').addEventListener('click', function () {
    if (!relayUp) { toast('relay not running'); return; }
    var country = getSelectedCountry();
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'best', cleanOnly: true, country: country }),
    }).then(function (data) {
      window._selectedProxy = data.active || 'direct';
      window._selectedProxyRaw = data.proxy && data.proxy !== 'direct' ? data.proxy : null;
      window._selectedProxyCountry = data.countryCode || null;
      window._selectedProxyIp = data.exitIp || null;
      updateEgress();
      toast('best clean egress → ' + mask(data.proxy || 'direct'));
      loadProxies();
    }).catch(function (e) { toast(e.message); });
  });

  $('btnDirect').addEventListener('click', function () {
    if (!relayUp) { toast('relay not running'); return; }
    api('/api/proxy/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'direct' }),
    }).then(function () {
      window._selectedProxy = 'direct';
      window._selectedProxyRaw = null;
      window._selectedProxyCountry = null;
      window._selectedProxyIp = null;
      updateEgress();
      toast('browsing direct (no proxy)');
      loadProxies();
    }).catch(function (e) { toast(e.message); });
  });

  $('btnClear').addEventListener('click', function () {
    if (!relayUp) { toast('relay not running'); return; }
    api('/api/proxy', { method: 'DELETE' }).then(function () {
      window._selectedProxy = 'auto';
      window._selectedProxyRaw = null;
      window._selectedProxyCountry = null;
      window._selectedProxyIp = null;
      updateEgress();
      loadProxies();
      toast('pool cleared');
    }).catch(function (e) { toast(e.message); });
  });

  $('btnRetry').addEventListener('click', function () {
    ping().then(function (data) {
      if (data) toast('relay online');
      else toast('still not running — ./tools/relay.sh');
    });
  });

  // ── boot ──────────────────────────────────────────────────────────────
  ping().then(function (data) {
    if (data) {
      if (data.country) setSelectedCountry(data.country);
      loadProxies();
      if (data.activeProxy && data.activeProxy !== 'direct') {
        window._selectedProxyRaw = data.activeProxy;
        updateEgress();
      }
    }
  });

  // quiet liveness poll so the pill tracks a relay that dies mid-session
  setInterval(ping, 30000);
})();
