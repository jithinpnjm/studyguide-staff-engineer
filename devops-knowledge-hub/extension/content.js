(function () {
  'use strict';

  const API_BASE = 'http://localhost:8765';
  const BTN_ATTR = 'data-hub-btn';
  const SESSION_KEY = 'hubDocUrls';

  // ── Inject page-context interceptor ─────────────────────────────────────
  // Runs in the page's JS context so it can override native fetch/XHR.
  (function injectInterceptor() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('interceptor.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  })();

  // Relay interceptor messages to background for storage
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'LI_HUB_INTERCEPTED') return;
    chrome.runtime.sendMessage({ type: 'STORE_INTERCEPTED', payload: e.data.payload });
  });

  // ── Document post detection ──────────────────────────────────────────────

  const DOC_SIGNALS = [
    '.feed-shared-document',
    '.feed-shared-document-container',
    '.document-s-container',
    '[data-urn*="document"]',
    '.feed-shared-carousel',
    '.linkedin-document-viewer',
    '[class*="document-viewer"]',
  ];

  function hasDocumentSignal(post) {
    if (DOC_SIGNALS.some((s) => post.querySelector(s))) return true;
    // LinkedIn sometimes renders a "X pages" badge without a dedicated class
    const text = post.textContent || '';
    return /\b\d+\s+pages?\b/i.test(text) && post.querySelector('[class*="document"], [class*="carousel"]');
  }

  function getPostUrn(post) {
    const self = post.getAttribute('data-urn') || '';
    if (self.includes('activity') || self.includes('ugcPost')) return self;
    const inner = post.querySelector('[data-urn*="activity"], [data-urn*="ugcPost"]');
    return inner ? inner.getAttribute('data-urn') : '';
  }

  // ── Metadata extraction ──────────────────────────────────────────────────

  function extractMeta(post) {
    // Title: try dedicated doc title first, then first line of post text
    const title =
      _getText(post, '.feed-shared-document__title') ||
      _getText(post, '.document-s-container__title') ||
      _getText(post, '.update-components-document__title') ||
      _getText(post, '[class*="documentTitle"]') ||
      _getFirstLine(post) ||
      'Untitled Document';

    const author =
      _getText(post, '.update-components-actor__name') ||
      _getText(post, '.feed-shared-actor__name') ||
      _getText(post, '[class*="actorName"]') ||
      '';

    const postText = _getText(post, '.feed-shared-text, .update-components-text, .feed-shared-update__description');

    // Page count ("12 pages" badge)
    const pgEl = post.querySelector(
      '.document-s-container__page-count, [class*="pageCount"], [class*="page-count"]'
    );
    const pageCount = pgEl ? parseInt(pgEl.textContent) || null : _extractPageCount(post.textContent);

    return {
      title: title.trim().slice(0, 200),
      author: author.trim(),
      linkedin_post_url: _getPermalink(post),
      source_url: window.location.href,
      post_text: postText.slice(0, 500),
      page_count: pageCount,
    };
  }

  function _getText(el, selectors) {
    for (const sel of selectors.split(',').map((s) => s.trim())) {
      const found = el.querySelector(sel);
      if (found?.textContent?.trim()) return found.textContent.trim();
    }
    return '';
  }

  function _getFirstLine(post) {
    const el = post.querySelector('.feed-shared-text, .update-components-text, .feed-shared-update__description');
    if (!el) return '';
    return (el.textContent || '').trim().split('\n')[0].trim().slice(0, 150);
  }

  function _getPermalink(post) {
    const a = post.querySelector(
      'a[href*="/posts/"], a[href*="/feed/update/"], time a[href]'
    );
    return a?.href || window.location.href;
  }

  function _extractPageCount(text) {
    const m = text.match(/\b(\d+)\s+pages?\b/i);
    return m ? parseInt(m[1]) : null;
  }

  // ── Button UI ────────────────────────────────────────────────────────────

  const STATES = {
    idle:    { label: '💾 Save to Hub', color: '#0a66c2', bg: '#fff',     border: '1px solid #0a66c2', disabled: false },
    fetch:   { label: '⏳ Fetching…',   color: '#555',    bg: '#f3f3f3',  border: '1px solid #ccc',    disabled: true  },
    capture: { label: '📸 Capturing…',  color: '#555',    bg: '#f3f3f3',  border: '1px solid #ccc',    disabled: true  },
    saved:   { label: '✓ Saved',        color: '#fff',    bg: '#057642',  border: '1px solid #057642', disabled: true  },
    dup:     { label: 'Already saved',  color: '#555',    bg: '#f0f0f0',  border: '1px solid #ccc',    disabled: true  },
    fail:    { label: '✗ Failed',        color: '#fff',    bg: '#cc1016',  border: '1px solid #b0000c', disabled: false },
  };

  function createButtonUI() {
    const wrap = document.createElement('div');
    wrap.setAttribute(BTN_ATTR, 'true');
    wrap.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 6px 16px 8px;
      gap: 3px;
    `;

    const btn = document.createElement('button');
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border-radius: 16px;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
      outline: none;
    `;

    const sub = document.createElement('span');
    sub.style.cssText = `
      font-size: 11px;
      color: #777;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding-left: 4px;
      height: 14px;
    `;

    wrap.appendChild(btn);
    wrap.appendChild(sub);
    _applyState(btn, 'idle');
    return { wrap, btn, sub };
  }

  function _applyState(btn, stateKey) {
    const s = STATES[stateKey] || STATES.idle;
    btn.textContent = s.label;
    btn.style.color = s.color;
    btn.style.background = s.bg;
    btn.style.border = s.border;
    btn.disabled = s.disabled;
    btn.style.opacity = s.disabled ? '0.85' : '1';
    btn.style.cursor = s.disabled ? 'default' : 'pointer';
  }

  // ── Save orchestration ───────────────────────────────────────────────────

  async function runSave(post, btn, sub) {
    const meta = extractMeta(post);
    const postUrn = getPostUrn(post);

    // ── Strategy 1: pre-intercepted URL ─────────────────────────────
    _applyState(btn, 'fetch');
    sub.textContent = 'checking intercepted data…';

    const interceptedUrl = await _getInterceptedUrl(postUrn, post);
    if (interceptedUrl) {
      sub.textContent = 'via direct link';
      meta._strategy = 'direct-link';
      const result = await _sendToBackground({
        type: 'SAVE_DOCUMENT',
        payload: { url: interceptedUrl, metadata: meta },
      });
      _handleResult(btn, sub, result, 'via direct link');
      return;
    }

    // ── Strategy 2: expand viewer, find download button ──────────────
    sub.textContent = 'trying viewer download…';
    const viewerUrl = await _tryViewerDownload(post);
    if (viewerUrl) {
      sub.textContent = 'via viewer link';
      meta._strategy = 'viewer-link';
      const result = await _sendToBackground({
        type: 'SAVE_DOCUMENT',
        payload: { url: viewerUrl, metadata: meta },
      });
      _handleResult(btn, sub, result, 'via viewer link');
      return;
    }

    // ── Strategy 3: capture visible pages as images ──────────────────
    _applyState(btn, 'capture');
    const pageCount = meta.page_count || 10;
    sub.textContent = `capturing ${Math.min(pageCount, 20)} pages…`;

    meta._strategy = 'page-capture';
    const captureResult = await _capturePages(post, meta, pageCount);
    if (captureResult) {
      _handleResult(btn, sub, captureResult, 'via page capture');
    } else {
      _applyState(btn, 'fail');
      sub.textContent = 'no document URL found';
      setTimeout(() => { _applyState(btn, 'idle'); sub.textContent = ''; }, 5000);
    }
  }

  // Strategy 1 helper
  async function _getInterceptedUrl(postUrn, post) {
    try {
      const session = await chrome.storage.session.get(SESSION_KEY);
      const map = session[SESSION_KEY] || {};

      if (postUrn && map[postUrn]) return map[postUrn];

      // Check any document-URN data attribute inside the post
      const docEl = post.querySelector(
        '[data-urn*="document"], [data-urn*="digitalmediaAsset"], [data-urn*="linkedInDocument"]'
      );
      if (docEl) {
        const urn = docEl.getAttribute('data-urn');
        if (urn && map[urn]) return map[urn];
      }

      // Check all stored URLs for any LinkedIn document pattern
      for (const [, url] of Object.entries(map)) {
        if (url.includes('/ambry/') || url.includes('/dms/document/')) return url;
      }
    } catch (_) {}
    return null;
  }

  // Strategy 2 helper
  async function _tryViewerDownload(post) {
    // Click the expand/fullscreen button to open the full viewer modal
    const expandSel = [
      'button[aria-label*="full screen"]',
      'button[aria-label*="fullscreen"]',
      'button[aria-label*="Fullscreen"]',
      'button[aria-label*="expand"]',
      'button[aria-label*="Expand"]',
      '.document-s-container__fullscreen-btn',
      '[class*="fullscreen-btn"]',
      '[class*="expand-btn"]',
    ].join(', ');

    const expandBtn = post.querySelector(expandSel);
    if (expandBtn) {
      expandBtn.click();
      await _sleep(600);
    }

    // Search for a download link — check both inside the post and globally
    // (the modal may be rendered outside the post container)
    const downloadSel = [
      'a[href*="/ambry/"]',
      'a[href*="media.licdn.com/dms/document"]',
      'a[href*=".pdf"][download]',
      'a[download][href*="linkedin"]',
      '[data-test-document-download]',
      'button[aria-label*="Download"]',
      'a[aria-label*="Download"]',
    ].join(', ');

    for (const scope of [post, document]) {
      const el = scope.querySelector(downloadSel);
      if (el) {
        const href = el.href || el.getAttribute('href') || '';
        if (href && (href.includes('ambry') || href.includes('licdn') || href.includes('.pdf'))) {
          return href;
        }
      }
    }

    return null;
  }

  // Strategy 3 helper
  async function _capturePages(post, meta, pageCount) {
    const maxPages = Math.min(pageCount || 10, 20);

    // Scroll the document into center view so it's fully visible
    post.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await _sleep(600);

    const images = [];
    let page = 0;

    while (page < maxPages) {
      const dataUrl = await _sendToBackground({ type: 'CAPTURE_TAB' });
      if (dataUrl) images.push(dataUrl);

      page++;
      if (page >= maxPages) break;

      // Click "next page" arrow
      const nextSel = [
        'button[aria-label*="next slide"]',
        'button[aria-label*="Next slide"]',
        'button[aria-label*="next page"]',
        'button[aria-label*="Next page"]',
        'button[aria-label*="Next"]',
        '.document-s-container__nav-btn--next',
        '[class*="carousel-next"]',
        '[class*="CarouselNext"]',
        '[class*="nextBtn"]',
      ].join(', ');

      const nextBtn =
        post.querySelector(nextSel) || document.querySelector(nextSel);

      if (!nextBtn || nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true') break;
      nextBtn.click();
      await _sleep(800);
    }

    if (!images.length) return null;

    try {
      const resp = await fetch(`${API_BASE}/api/documents/upload-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, metadata: meta }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      await _sendToBackground({
        type: 'LOG_OPERATION',
        payload: { ...result, strategy: 'page-capture', title: meta.title || 'Captured doc', timestamp: new Date().toISOString() },
      });
      return result;
    } catch (_) {
      return null;
    }
  }

  function _handleResult(btn, sub, result, strategy) {
    if (!result || result.status === 'error') {
      _applyState(btn, 'fail');
      sub.textContent = result?.message?.slice(0, 60) || strategy;
      setTimeout(() => { _applyState(btn, 'idle'); sub.textContent = ''; }, 5000);
      return;
    }
    if (result.status === 'duplicate') {
      _applyState(btn, 'dup');
      sub.textContent = 'already in your library';
    } else {
      _applyState(btn, 'saved');
      sub.textContent = strategy;
    }
  }

  // ── DOM injection ────────────────────────────────────────────────────────

  function processPost(post) {
    if (!hasDocumentSignal(post)) return;
    if (post.querySelector(`[${BTN_ATTR}]`)) return; // already injected

    const { wrap, btn, sub } = createButtonUI();

    // Place button just above the social actions bar (Like / Comment / Repost)
    const actionsBar = post.querySelector(
      '.feed-shared-social-actions, .feed-shared-social-action-bar, ' +
      '.social-actions-bar, [class*="socialActionBar"], [class*="social-action"]'
    );
    const docContainer = post.querySelector('.document-s-container, .feed-shared-document');

    if (actionsBar) {
      actionsBar.parentNode.insertBefore(wrap, actionsBar);
    } else if (docContainer) {
      docContainer.parentNode.insertBefore(wrap, docContainer.nextSibling);
    } else {
      post.appendChild(wrap);
    }

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await runSave(post, btn, sub);
      } catch (err) {
        _applyState(btn, 'fail');
        sub.textContent = err.message?.slice(0, 60) || 'unexpected error';
        setTimeout(() => { _applyState(btn, 'idle'); sub.textContent = ''; }, 5000);
      }
    });
  }

  // ── Find any document post on the current page ───────────────────────────

  function _findDocumentPost() {
    // Feed posts
    const feedPosts = Array.from(
      document.querySelectorAll('.feed-shared-update-v2, .occludable-update, .main-feed-activity-card')
    );
    const feedMatch = feedPosts.find(hasDocumentSignal);
    if (feedMatch) return feedMatch;

    // Single-post / permalink page — the whole main article is the post
    const article = document.querySelector('main article, .scaffold-layout__main article, [data-urn]');
    if (article && hasDocumentSignal(article)) return article;

    // Last resort: body itself has a document somewhere
    if (hasDocumentSignal(document.body)) return document.body;

    return null;
  }

  // ── Handle messages from background / popup ───────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    // ── Triggered by popup "Save Current Post" button ──
    if (msg.type === 'FIND_AND_SAVE_CURRENT_POST') {
      const posts = Array.from(
        document.querySelectorAll('.feed-shared-update-v2, .occludable-update')
      );
      const visible = posts.find((p) => {
        if (!hasDocumentSignal(p)) return false;
        const rect = p.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight + 200;
      }) || posts.find((p) => hasDocumentSignal(p));

      if (!visible) { sendResponse({ found: false }); return true; }

      const { wrap, btn, sub } = createButtonUI();
      visible.appendChild(wrap);
      runSave(visible, btn, sub).finally(() => setTimeout(() => wrap.remove(), 6000));
      sendResponse({ found: true });
      return true;
    }

    // ── Triggered by background after opening a pasted URL in a tab ──
    if (msg.type === 'AUTO_SAVE_DOCUMENT') {
      (async () => {
        // Give the page a moment to settle if the MutationObserver hasn't fired yet
        await _sleep(800);

        const post = _findDocumentPost();
        if (!post) {
          sendResponse({ status: 'error', message: 'No document post found on this page' });
          return;
        }

        const meta = extractMeta(post);
        const postUrn = getPostUrn(post);

        // Strategy 1 — check intercepted session storage (most likely to succeed
        // because the page just loaded and made voyager API calls)
        const interceptedUrl = await _getInterceptedUrl(postUrn, post);
        if (interceptedUrl) {
          const result = await _sendToBackground({
            type: 'SAVE_DOCUMENT',
            payload: { url: interceptedUrl, metadata: { ...meta, _strategy: 'direct-link' } },
          });
          sendResponse({ ...result, title: meta.title });
          return;
        }

        // Strategy 2 — look for a download link in the expanded viewer
        const viewerUrl = await _tryViewerDownload(post);
        if (viewerUrl) {
          const result = await _sendToBackground({
            type: 'SAVE_DOCUMENT',
            payload: { url: viewerUrl, metadata: { ...meta, _strategy: 'viewer-link' } },
          });
          sendResponse({ ...result, title: meta.title });
          return;
        }

        sendResponse({ status: 'error', message: 'Could not find a download URL. Try scrolling the document in the tab before saving.' });
      })();
      return true; // keep channel open for async response
    }
  });

  // ── MutationObserver ─────────────────────────────────────────────────────

  function scanAll() {
    document.querySelectorAll('.feed-shared-update-v2, .occludable-update').forEach(processPost);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.('.feed-shared-update-v2, .occludable-update')) {
          processPost(node);
        } else {
          node.querySelectorAll?.('.feed-shared-update-v2, .occludable-update').forEach(processPost);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scanAll();

  // ── Utilities ────────────────────────────────────────────────────────────

  function _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function _sendToBackground(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });
  }
})();
