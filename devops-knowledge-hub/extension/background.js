'use strict';

const API_BASE = 'http://localhost:8765';
const SESSION_KEY = 'hubDocUrls';   // chrome.storage.session store
const MAX_LOG = 50;

// ── Strategy 1: webRequest URL monitoring ────────────────────────────────
// Observe requests going to LinkedIn doc/media endpoints.
// We can't read response bodies here, but we CAN capture the request URLs
// themselves — ambry and media CDN URLs are self-contained download links.

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;

    // Ambry download links are usable as-is
    if (url.includes('/ambry/')) {
      _storeUrl(url, null);
    }

    // media.licdn.com document CDN links
    if (url.includes('media.licdn.com/dms/document')) {
      _storeUrl(url, null);
    }

    // Extract doc URN from voyager URL path
    const urnMatch = url.match(/\/documents?\/(urn%3Ali[^?&/]+|urn:li[^?&/]+)/i);
    if (urnMatch) {
      try {
        const urn = decodeURIComponent(urnMatch[1]);
        _storeUrl(url, urn);
      } catch (_) {}
    }
  },
  {
    urls: [
      '*://*.linkedin.com/voyager/api/documents*',
      '*://*.linkedin.com/ambry/*',
      '*://media.licdn.com/dms/document/*',
    ],
  }
  // Note: no 'blocking' in MV3 — observe only
);

async function _storeUrl(url, urn) {
  try {
    const session = await chrome.storage.session.get(SESSION_KEY);
    const map = session[SESSION_KEY] || {};
    const base = url.split('?')[0];
    map[base] = url; // store full URL (with query params) keyed by base
    if (urn) map[urn] = url;
    await chrome.storage.session.set({ [SESSION_KEY]: map });
  } catch (_) {}
}

// ── Message dispatcher ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    // Interceptor in page context found document URLs in API responses
    case 'STORE_INTERCEPTED':
      _handleStoreIntercepted(msg.payload).catch(() => {});
      return false; // sync, no response needed

    // Content script wants to download + upload a document by URL
    case 'SAVE_DOCUMENT':
      _handleSaveDocument(msg.payload)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ status: 'error', message: e.message }));
      return true;

    // Content script wants a screenshot of the current tab
    case 'CAPTURE_TAB':
      chrome.tabs.captureVisibleTab(
        sender.tab ? sender.tab.windowId : undefined,
        { format: 'jpeg', quality: 88 },
        (dataUrl) => {
          if (chrome.runtime.lastError) sendResponse(null);
          else sendResponse(dataUrl);
        }
      );
      return true;

    // Popup "Save from URL" — open the post in a background tab, let
    // the interceptor capture the document URL, then auto-save and close.
    case 'SAVE_FROM_URL':
      _handleSaveFromUrl(msg.payload.postUrl)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ status: 'error', message: e.message }));
      return true;

    // Popup "Save current post" button
    case 'SAVE_ACTIVE_TAB_POST':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url?.includes('linkedin.com')) {
          sendResponse({ found: false, reason: 'not on LinkedIn' });
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: 'FIND_AND_SAVE_CURRENT_POST' },
          (res) => {
            if (chrome.runtime.lastError) sendResponse({ found: false, reason: 'content script not ready' });
            else sendResponse(res || { found: false });
          }
        );
      });
      return true;

    // Content script logs a completed operation for the popup to display
    case 'LOG_OPERATION':
      _logOperation(msg.payload).catch(() => {});
      return false;
  }
});

// ── Strategy 1 storage (from page-context interceptor) ───────────────────

async function _handleStoreIntercepted({ urns = [], downloadUrls = [], sourceUrl } = {}) {
  if (!downloadUrls.length && !urns.length) return;

  const session = await chrome.storage.session.get(SESSION_KEY);
  const map = session[SESSION_KEY] || {};

  const bestUrl = downloadUrls[0]; // prefer first — most likely ambry or direct CDN
  if (bestUrl) {
    for (const urn of urns) map[urn] = bestUrl;
    for (const url of downloadUrls) map[url.split('?')[0]] = url;
  }

  await chrome.storage.session.set({ [SESSION_KEY]: map });
}

// ── Save from pasted URL ─────────────────────────────────────────────────

async function _handleSaveFromUrl(postUrl) {
  // Open the post in a new foreground tab so LinkedIn renders it fully
  // and our interceptor can capture the document API response.
  const tab = await chrome.tabs.create({ url: postUrl, active: true });

  // Wait for the tab to finish loading
  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // Safety timeout: resolve after 15 s regardless
    setTimeout(resolve, 15000);
  });

  // Give LinkedIn's JS time to make voyager API calls so the interceptor
  // can capture the document download URL into session storage.
  await new Promise((r) => setTimeout(r, 3500));

  // Ask the content script running on that tab to find and save the doc
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'AUTO_SAVE_DOCUMENT' }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });
  } catch (e) {
    result = { status: 'error', message: e.message };
  }

  // Close the tab we opened
  chrome.tabs.remove(tab.id).catch(() => {});

  if (result?.status === 'saved' || result?.status === 'duplicate') {
    await _logOperation({
      status: result.status,
      title: result.title || 'Document from URL',
      strategy: 'url-paste',
      timestamp: new Date().toISOString(),
      id: result.id,
    });
  }

  return result;
}

// ── Download + upload pipeline ────────────────────────────────────────────

async function _handleSaveDocument({ url, metadata }) {
  let blob, filename;

  try {
    const resp = await fetch(url, {
      credentials: 'include',
      headers: { Accept: '*/*' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
    blob = await resp.blob();
    filename = _extractFilename(resp.headers.get('content-disposition'), url, blob.type);
  } catch (e) {
    return { status: 'error', message: `Download failed: ${e.message}` };
  }

  return _uploadToBackend(blob, filename, metadata);
}

async function _uploadToBackend(blob, filename, metadata) {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('metadata', JSON.stringify(metadata || {}));

  try {
    const r = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      body: form,
    });
    if (!r.ok) throw new Error(`API returned ${r.status}`);
    const result = await r.json();
    await _logOperation({
      status: result.status,
      title: metadata?.title || filename,
      strategy: metadata?._strategy || 'direct',
      timestamp: new Date().toISOString(),
      id: result.id,
    });
    return result;
  } catch (e) {
    return { status: 'error', message: `Backend error: ${e.message}` };
  }
}

function _extractFilename(disposition, url, mimeType) {
  if (disposition) {
    const m = disposition.match(/filename\*?=["']?([^"';\n]+)/i);
    if (m) return decodeURIComponent(m[1].replace(/^UTF-8''/i, ''));
  }
  try {
    const parts = new URL(url).pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) return decodeURIComponent(last);
  } catch (_) {}
  const ext = {
    'application/pdf': 'document.pdf',
    'application/vnd.ms-powerpoint': 'presentation.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation.pptx',
  };
  return ext[mimeType] || 'document.bin';
}

// ── Operation log (for popup display) ────────────────────────────────────

async function _logOperation(entry) {
  const { operationLog = [] } = await chrome.storage.local.get('operationLog');
  operationLog.unshift(entry);
  if (operationLog.length > MAX_LOG) operationLog.length = MAX_LOG;
  await chrome.storage.local.set({ operationLog });
}
