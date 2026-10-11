'use strict';
// ─────────────────────────────────────────────────────────────────────────
//  GhostShell relay — HTML / CSS rewriting for the fetch+rewrite viewer
//
//  Goals, in order of importance:
//    1. every URL resolves against the page's FINAL URL (after redirects)
//    2. <base> is deleted so nothing can re-base our work
//    3. rewritten URLs point back at the relay (/view for documents,
//       /view/raw for subresources) and carry the active proxy choice
//    4. srcset, CSS url()/@import and meta-refresh are covered, not just href
//    5. CSP (meta tag) is stripped — the server strips the headers
//
//  Active content is neutralised while we are at it: <script> elements,
//  on* handlers and javascript: URLs cannot survive a rewrite that is meant
//  to hide the user's traffic. A page with no JS is also a page that cannot
//  leak through WebRTC, fetch beacons or font probing behind the relay's back.
// ─────────────────────────────────────────────────────────────────────────

const { URL } = require('url');

// ── small helpers ────────────────────────────────────────────────────────

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// HTML attribute values come entity-encoded; URLs need their raw form.
function unescapeAttr(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Resolve `href` against `base`. Returns the absolute http(s) URL, or null
 * when the value must be left alone (fragments, data:, mailto:, tel:, …) —
 * except javascript:, which is actively neutralised by the callers.
 */
function absolutise(href, base) {
  if (href == null) return null;
  const raw = String(href).trim();
  if (raw === '') return null;
  if (raw.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    return null; // data:, mailto:, tel:, about:, javascript:, …
  }
  try {
    const abs = new URL(raw, base);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
    return abs.href;
  } catch {
    return null;
  }
}

function isDangerousScheme(value) {
  return /^\s*(javascript|vbscript)\s*:/i.test(String(value));
}

// ── relay URL formats ────────────────────────────────────────────────────

// kind: 'view' (document) | 'raw' (subresource)
function relayUrl(abs, kind, opts) {
  const prefix = kind === 'view' ? '/view' : '/view/raw';
  let out = `${prefix}?u=${encodeURIComponent(abs)}`;
  if (opts && opts.proxyParam) out += `&p=${encodeURIComponent(opts.proxyParam)}`;
  return out;
}

// ── CSS rewriting ────────────────────────────────────────────────────────

function rewriteCss(css, base, opts) {
  if (!css) return css;
  let out = String(css);

  // @import "x.css";  @import url(x.css);  — the url() case is handled below
  out = out.replace(
    /@import\s+(?!url\()(['"])([^'")]+)\1/gi,
    (m, q, target) => {
      const abs = absolutise(unescapeAttr(target), base);
      return abs ? `@import ${q}${relayUrl(abs, 'raw', opts)}${q}` : m;
    }
  );

  // url(...) — quoted or bare
  out = out.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (m, q, target) => {
      const t = unescapeAttr(target).trim();
      if (t === '' || t.startsWith('data:') || t.startsWith('#')) return m;
      if (isDangerousScheme(t)) return 'url(#)';
      const abs = absolutise(t, base);
      return abs ? `url(${q}${relayUrl(abs, 'raw', opts)}${q})` : m;
    }
  );

  return out;
}

// ── meta refresh ─────────────────────────────────────────────────────────

function rewriteMetaRefreshContent(content, base, opts) {
  const m = /^([^;]*;\s*url\s*=\s*)(['"]?)([^'"]+)\2(.*)$/i.exec(String(content));
  if (!m) return null;
  const target = unescapeAttr(m[3]).trim();
  if (isDangerousScheme(target)) return '0';
  const abs = absolutise(target, base);
  if (!abs) return null;
  return `${m[1]}${m[2]}${relayUrl(abs, 'view', opts)}${m[2]}${m[4] || ''}`;
}

// ── HTML rewriting ───────────────────────────────────────────────────────

// attributes we delete outright: per-button form targets break the relay's
// POST /view handshake, and srcdoc can smuggle a whole document in an attr.
const STRIP_ATTRS = new Set(['integrity', 'nonce', 'crossorigin', 'formaction', 'srcdoc']);

// attributes whose values are space-separated URL lists (HTML spec: ping)
const URL_LIST_ATTRS = new Set(['ping']);

// per-tag attribute rewrites:  attr → 'view' | 'raw' | 'keep'
const TAG_ATTRS = {
  a:        { href: 'view' },
  area:     { href: 'view' },
  link:     { href: 'raw' },
  img:      { src: 'raw', srcset: 'raw', longdesc: 'view', usemap: 'keep' },
  source:   { src: 'raw', srcset: 'raw' },
  video:    { src: 'raw', poster: 'raw' },
  audio:    { src: 'raw' },
  track:    { src: 'raw' },
  input:    { src: 'raw' },
  iframe:   { src: 'view' },
  frame:    { src: 'view' },
  embed:    { src: 'raw' },
  object:   { data: 'raw', codebase: 'keep' },
  form:     { action: 'view' },
  q:        { cite: 'view' },
  blockquote: { cite: 'view' },
  ins:      { cite: 'view' },
  del:      { cite: 'view' },
  body:     { background: 'raw' },
  table:    { background: 'raw' },
  td:       { background: 'raw' },
  th:       { background: 'raw' },
  meta:     { content: 'keep' },
  use:      { href: 'raw', 'xlink:href': 'raw' },
  image:    { href: 'raw', 'xlink:href': 'raw' },
};

function rewriteSrcset(value, base, opts) {
  // "url1 1x, url2 2x" — URLs may contain commas (rare, but data: URIs do),
  // so split on commas that are followed by whitespace or end.
  const candidates = String(value).split(/,\s+/);
  return candidates.map((candidate) => {
    const trimmed = candidate.trim();
    const sp = trimmed.search(/\s/);
    const urlPart = sp === -1 ? trimmed : trimmed.slice(0, sp);
    const desc = sp === -1 ? '' : trimmed.slice(sp);
    if (isDangerousScheme(urlPart)) return '#';
    const abs = absolutise(unescapeAttr(urlPart), base);
    return abs ? relayUrl(abs, 'raw', opts) + desc : trimmed;
  }).join(', ');
}

function processTag(tagName, rawAttrs, base, opts, stats) {
  const map = TAG_ATTRS[tagName] || {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))|([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?=[\s>\/]|$)/g;

  let out = '';
  let lastIndex = 0;
  let hiddenTarget = null;
  let m;

  while ((m = attrRe.exec(rawAttrs)) !== null) {
    out += rawAttrs.slice(lastIndex, m.index);
    lastIndex = attrRe.lastIndex;

    const name = (m[1] || m[6]).toLowerCase();
    const hasValue = m[1] != null;
    const rawValue = hasValue ? (m[2].startsWith('"') ? m[3] : m[2].startsWith("'") ? m[4] : m[5]) : '';
    const value = unescapeAttr(rawValue);

    // ── strip list: content we delete outright ──
    if (STRIP_ATTRS.has(name)) {
      stats.stripped++;
      continue;
    }
    if (/^on/i.test(name)) {          // onclick, onload, onerror, …
      stats.handlers++;
      continue;
    }
    if (isDangerousScheme(value)) {
      if (name === 'href' || name === 'action') {
        out += `${name}="#"`;
        stats.urls++;
      }
      continue;
    }

    // ── style attribute → CSS rewrite ──
    if (name === 'style') {
      const css = rewriteCss(value, base, opts);
      out += `style="${escapeAttr(css)}"`;
      continue;
    }

    // ── srcset ──
    if (name === 'srcset' || name === 'imagesrcset') {
      out += `${name}="${escapeAttr(rewriteSrcset(value, base, opts))}"`;
      stats.urls++;
      continue;
    }

    // ── URL lists (ping) ──
    if (URL_LIST_ATTRS.has(name)) {
      const parts = value.split(/\s+/).map((p) => {
        const abs = absolutise(p, base);
        return abs ? relayUrl(abs, 'raw', opts) : p;
      });
      out += `${name}="${escapeAttr(parts.join(' '))}"`;
      stats.urls++;
      continue;
    }

    // ── plain URL attributes ──
    const kind = map[name];
    if (kind === 'view' || kind === 'raw') {
      // <form action> is captured for the POST handshake and dropped here
      if (tagName === 'form' && name === 'action') {
        hiddenTarget = absolutise(value, base);
        stats.urls++;
        continue;
      }
      const abs = absolutise(value, base);
      if (abs) {
        out += `${name}="${escapeAttr(relayUrl(abs, kind, opts))}"`;
        stats.urls++;
      } else if (value.trim() !== '') {
        out += `${name}="${escapeAttr(rawValue)}"`; // #frag, data:, mailto: …
      } else {
        out += name;
      }
      continue;
    }

    // ── everything else verbatim (source text kept as-is — it is already
    //    entity-encoded; only bare quotes need protecting) ──
    out += hasValue ? `${m[1]}="${rawValue.replace(/"/g, '&quot;')}"` : name;
  }
  out += rawAttrs.slice(lastIndex);

  // Forms become POSTs through /view with an explicit hidden target. A form
  // with no action submits to the current document — use the page URL.
  // The hidden input goes AFTER the opening tag, never inside it.
  let hidden = '';
  if (tagName === 'form') {
    out = out.replace(/\s+method\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    out = out.replace(/\s+enctype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const target = hiddenTarget || base;
    if (/^https?:/i.test(target)) {
      out += ' action="/view" method="post" enctype="application/x-www-form-urlencoded"';
      hidden = `<input type="hidden" name="_target" value="${escapeAttr(target)}">`;
      stats.forms++;
    }
  }

  return '<' + tagName + out + '>' + hidden;
}

/**
 * rewriteHtml(html, base, opts) → {html, stats}
 *   base  — the page's final URL (after redirects)
 *   opts  — {proxyParam}
 */
function rewriteHtml(html, base, opts = {}) {
  const stats = { scripts: 0, handlers: 0, urls: 0, stripped: 0, forms: 0, bases: 0 };
  let out = String(html);

  // 1. <base …> — the whole point of deleting it is that we already resolved
  //    everything; if one reappears mid-document the browser would re-base.
  out = out.replace(/<base\b[^>]*>/gi, () => { stats.bases++; return ''; });

  // 2. scripts (and anything they contain) go away entirely
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, () => { stats.scripts++; return ''; });
  out = out.replace(/<script\b[^>]*\/>/gi, () => { stats.scripts++; return ''; });

  // 3. CSP meta tag — the server strips the real headers
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, () => {
    stats.stripped++;
    return '';
  });

  // 4. meta refresh
  out = out.replace(/<meta\b[^>]*>/gi, (tag) => {
    const httpEquiv = /http-equiv\s*=\s*["']?refresh["']?/i.test(tag);
    if (!httpEquiv) return tag;
    return tag.replace(/content\s*=\s*("([^"]*)"|'([^']*)')/i, (cm, q, dq, sq) => {
      const original = dq != null ? dq : sq;
      const rewritten = rewriteMetaRefreshContent(original, base, opts);
      if (rewritten == null) return cm;
      stats.urls++;
      return `content="${escapeAttr(rewritten)}"`;
    });
  });

  // 5. <style> blocks
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (m, open, css, close) => {
    return open + rewriteCss(css, base, opts) + close;
  });

  // 6. every tag: rewrite its attributes in context
  out = out.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (whole, name, rawAttrs) => {
    const tag = name.toLowerCase();
    if (tag === 'script' || tag === 'base') return whole; // already handled
    return processTag(tag, rawAttrs, base, opts, stats);
  });

  // 7. xhtml-style self-closing leftovers with handlers were covered by 6;
  //    add a machine-readable stat line the in-site viewer can read.
  const meta = `<meta name="gs-stats" content="scripts=${stats.scripts};handlers=${stats.handlers};` +
               `urls=${stats.urls};bases=${stats.bases};forms=${stats.forms}">`;
  if (/<head\b[^>]*>/i.test(out)) {
    out = out.replace(/<head\b[^>]*>/i, (h) => h + meta);
  } else {
    out = meta + out;
  }

  return { html: out, stats };
}

module.exports = {
  absolutise,
  relayUrl,
  rewriteCss,
  rewriteHtml,
  rewriteMetaRefreshContent,
  escapeAttr,
  unescapeAttr,
};
