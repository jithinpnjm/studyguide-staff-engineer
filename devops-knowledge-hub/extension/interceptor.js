/**
 * interceptor.js — runs in the PAGE's JS context (not the content script sandbox).
 * Injected via a <script> tag by content.js.
 *
 * Overrides fetch + XHR to watch LinkedIn's voyager API responses for
 * document download URLs and URNs, then posts them to the content script
 * via window.postMessage.
 */
(function () {
  'use strict';

  const MSG_TYPE = 'LI_HUB_INTERCEPTED';

  const WATCHED_PATTERNS = [
    /voyager\/api\/(documents|feed|updates|document)/i,
    /media\.licdn\.com\/dms\/document/i,
    /linkedin\.com\/ambry/i,
  ];

  function isWatched(url) {
    return WATCHED_PATTERNS.some((p) => p.test(url));
  }

  // ── Data extraction ──────────────────────────────────────────────────────

  function extractFromJsonString(str, sourceUrl) {
    const result = { urns: [], downloadUrls: [], sourceUrl };

    // Document / activity URNs
    const urnRx = /urn:li:(?:document|digitalmediaAsset|linkedInDocument):[0-9A-Za-z_\-:]+/g;
    const urnMatches = str.match(urnRx);
    if (urnMatches) result.urns = [...new Set(urnMatches)];

    // Ambry download links (may be JSON-escaped with \/ or \\u002F)
    const clean = (u) =>
      u.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\"/g, '');

    const ambryRx = /https?:\\?\/\\?\/(?:www\.)?linkedin\.com\\?\/ambry\\?\/\?[^"',\s\\]{10,}/g;
    const ambryHits = str.match(ambryRx);
    if (ambryHits) result.downloadUrls.push(...ambryHits.map(clean));

    // media.licdn.com document CDN links
    const mediaRx = /https?:\\?\/\\?\/media\.licdn\.com\\?\/dms\\?\/document[^"',\s\\]{10,}/g;
    const mediaHits = str.match(mediaRx);
    if (mediaHits) result.downloadUrls.push(...mediaHits.map(clean));

    // Deduplicate
    result.downloadUrls = [...new Set(result.downloadUrls)];

    if (!result.urns.length && !result.downloadUrls.length) return null;
    return result;
  }

  function broadcast(payload) {
    window.postMessage({ type: MSG_TYPE, payload }, '*');
  }

  function tryParse(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function handleResponseText(text, url) {
    if (!text || !text.includes('licdn') && !text.includes('urn:li:document')) return;
    const extracted = extractFromJsonString(text, url);
    if (extracted) broadcast(extracted);
  }

  // ── fetch override ───────────────────────────────────────────────────────

  const _fetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const req = args[0];
    const url =
      typeof req === 'string'
        ? req
        : req instanceof Request
        ? req.url
        : String(req);

    const response = await _fetch(...args);

    if (isWatched(url)) {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('json') || ct.includes('text')) {
        response
          .clone()
          .text()
          .then((t) => handleResponseText(t, url))
          .catch(() => {});
      }
    }

    return response;
  };

  // ── XHR override ─────────────────────────────────────────────────────────

  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__hubUrl = typeof url === 'string' ? url : String(url);
    return _xhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const url = this.__hubUrl || '';
    if (isWatched(url)) {
      this.addEventListener('load', function () {
        const ct = this.getResponseHeader('content-type') || '';
        if (ct.includes('json') || ct.includes('text')) {
          handleResponseText(this.responseText, url);
        }
      });
    }
    return _xhrSend.apply(this, arguments);
  };
})();
