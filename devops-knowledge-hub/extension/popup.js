'use strict';

const API_BASE = 'http://localhost:8765';
const FRONTEND = 'http://localhost:3000';

// ── Element refs ──────────────────────────────────────────────────────────
const $dot        = document.getElementById('statusDot');
const $label      = document.getElementById('statusLabel');
const $sub        = document.getElementById('statusSub');
const $total      = document.getElementById('statTotal');
const $today      = document.getElementById('statToday');
const $recentList = document.getElementById('recentList');
const $saveBtn    = document.getElementById('saveCurrentBtn');
const $saveNote   = document.getElementById('saveNote');
const $openBtn    = document.getElementById('openAppBtn');
const $dbgToggle  = document.getElementById('debugToggle');
const $dbgArrow   = document.getElementById('debugArrow');
const $dbgPanel   = document.getElementById('debugPanel');

// ── Open frontend ─────────────────────────────────────────────────────────
$openBtn.addEventListener('click', () => chrome.tabs.create({ url: FRONTEND }));

// ── Backend health + stats ────────────────────────────────────────────────
async function checkBackend() {
  try {
    const resp = await fetch(`${API_BASE}/api/stats`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!resp.ok) throw new Error('not ok');
    const stats = await resp.json();

    $dot.className = 'dot green';
    $label.textContent = 'Backend connected';
    $sub.textContent = 'http://localhost:8765';
    $total.textContent = stats.total_documents ?? '0';
    $today.textContent = stats.recent_count ?? '0';
  } catch {
    $dot.className = 'dot red';
    $label.textContent = 'Backend offline';
    $sub.textContent = 'Run: cd backend && python main.py';
    $total.textContent = '—';
    $today.textContent = '—';
  }
}

// ── Recent saves ──────────────────────────────────────────────────────────
async function loadRecentLog() {
  const { operationLog = [] } = await chrome.storage.local.get('operationLog');
  if (!operationLog.length) return;

  $recentList.innerHTML = '';
  operationLog.slice(0, 8).forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const title = document.createElement('span');
    title.className = 'recent-title';
    title.textContent = entry.title || 'Untitled';
    title.title = entry.title || 'Untitled';

    const badge = document.createElement('span');
    const s = entry.status;
    badge.className =
      'recent-badge' +
      (s === 'duplicate' ? ' dup' : s === 'error' ? ' error' : entry.strategy === 'page-capture' ? ' capture' : '');
    badge.textContent =
      s === 'duplicate' ? 'duplicate' :
      s === 'error'     ? 'error' :
      entry.strategy === 'page-capture' ? 'captured' : 'saved';

    li.appendChild(title);
    li.appendChild(badge);
    $recentList.appendChild(li);
  });
}

// ── Save from pasted URL ──────────────────────────────────────────────────

const $urlInput  = document.getElementById('urlInput');
const $urlBtn    = document.getElementById('urlSaveBtn');
const $urlStatus = document.getElementById('urlStatus');

function _setUrlStatus(msg, cls) {
  $urlStatus.textContent = msg;
  $urlStatus.className = 'url-status' + (cls ? ' ' + cls : '');
}

async function _saveFromUrl() {
  const url = $urlInput.value.trim();
  if (!url) { _setUrlStatus('Paste a LinkedIn post URL first.', 'err'); return; }
  if (!url.includes('linkedin.com')) { _setUrlStatus('Must be a linkedin.com URL.', 'err'); return; }

  $urlBtn.disabled = true;
  $urlBtn.textContent = '…';
  _setUrlStatus('Opening post — this takes a few seconds…');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_FROM_URL', payload: { postUrl: url } });

    if (!result) {
      _setUrlStatus('No response from extension.', 'err');
    } else if (result.status === 'saved') {
      _setUrlStatus('✓ Saved to your library!', 'ok');
      $urlInput.value = '';
      // Refresh stats
      checkBackend();
      loadRecentLog();
    } else if (result.status === 'duplicate') {
      _setUrlStatus('Already in your library.', 'dup');
    } else {
      _setUrlStatus((result.message || 'Could not download document.'), 'err');
    }
  } catch (e) {
    _setUrlStatus(e.message, 'err');
  } finally {
    $urlBtn.disabled = false;
    $urlBtn.textContent = 'Save';
  }
}

$urlBtn.addEventListener('click', _saveFromUrl);
$urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') _saveFromUrl(); });

// ── Save current post button ──────────────────────────────────────────────
$saveBtn.addEventListener('click', async () => {
  $saveBtn.disabled = true;
  $saveBtn.textContent = '⏳ Finding document…';
  $saveNote.textContent = '';

  // First check we're on LinkedIn
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('linkedin.com')) {
    $saveBtn.textContent = '✗ Not on LinkedIn';
    $saveBtn.className = 'save-btn fail';
    $saveNote.textContent = 'Switch to a LinkedIn tab first.';
    _resetSaveBtn(3000);
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'SAVE_ACTIVE_TAB_POST' });

    if (resp?.found) {
      $saveBtn.textContent = '✓ Save triggered';
      $saveBtn.className = 'save-btn success';
      $saveNote.textContent = 'Check the feed for button status.';
      _resetSaveBtn(3000);
    } else {
      $saveBtn.textContent = '✗ No document found';
      $saveBtn.className = 'save-btn fail';
      $saveNote.textContent = resp?.reason || 'Scroll to a document post first.';
      _resetSaveBtn(4000);
    }
  } catch (e) {
    $saveBtn.textContent = '✗ Error';
    $saveBtn.className = 'save-btn fail';
    $saveNote.textContent = e.message;
    _resetSaveBtn(4000);
  }
});

function _resetSaveBtn(delay) {
  setTimeout(() => {
    $saveBtn.disabled = false;
    $saveBtn.textContent = '💾 Save Current Post';
    $saveBtn.className = 'save-btn';
    $saveNote.textContent = 'Saves the first document post visible on the active LinkedIn tab';
  }, delay);
}

// ── Debug panel ───────────────────────────────────────────────────────────
let debugOpen = false;

$dbgToggle.addEventListener('click', async () => {
  debugOpen = !debugOpen;
  $dbgPanel.style.display = debugOpen ? 'block' : 'none';
  $dbgArrow.textContent = debugOpen ? '▲' : '▼';
  if (debugOpen) await renderDebug();
});

async function renderDebug() {
  const { operationLog = [] } = await chrome.storage.local.get('operationLog');
  const last = operationLog[0];

  // Session storage snapshot (intercepted URLs)
  let sessionSnap = {};
  try {
    const s = await chrome.storage.session.get('hubDocUrls');
    sessionSnap = s.hubDocUrls || {};
  } catch (_) {}
  const urlCount = Object.keys(sessionSnap).length;

  if (!last && !urlCount) {
    $dbgPanel.innerHTML = '<span class="v">No operations yet.</span>';
    return;
  }

  const lines = [];

  if (last) {
    lines.push(`<span class="s">── Last operation ──</span>`);
    lines.push(`<span class="k">status  </span><span class="v">${last.status}</span>`);
    lines.push(`<span class="k">strategy</span><span class="v">${last.strategy || 'N/A'}</span>`);
    lines.push(`<span class="k">title   </span><span class="v">${(last.title || '').slice(0, 40)}</span>`);
    lines.push(`<span class="k">time    </span><span class="v">${last.timestamp ? new Date(last.timestamp).toLocaleTimeString() : 'N/A'}</span>`);
    if (last.message) lines.push(`<span class="k">error   </span><span class="e">${last.message.slice(0, 60)}</span>`);
    if (last.id) lines.push(`<span class="k">doc id  </span><span class="v">${last.id.slice(0, 24)}…</span>`);
  }

  lines.push(`<span class="s">── Interceptor cache ──</span>`);
  lines.push(`<span class="k">cached URLs </span><span class="v">${urlCount}</span>`);
  if (urlCount > 0) {
    const sample = Object.values(sessionSnap)[0];
    lines.push(`<span class="k">sample URL  </span><span class="v">${sample.slice(0, 55)}…</span>`);
  }

  $dbgPanel.innerHTML = lines.join('\n');
}

// ── Init ──────────────────────────────────────────────────────────────────
checkBackend();
loadRecentLog();
