// When deployed to GitHub Pages, the dev server proxy is unavailable.
// Fall back to a configurable backend URL stored in localStorage.
// Default: localhost:8765 (local development). User can change via Settings.
function getBase() {
  const stored = typeof window !== 'undefined' && localStorage.getItem('devopshub_backend_url');
  if (stored) return stored.replace(/\/$/, '') + '/api';
  // During local dev (Vite proxy active), use relative /api
  // On GitHub Pages, default to localhost:8765
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalDev ? '/api' : 'http://localhost:8765/api';
}

async function request(path, options = {}) {
  const BASE = getBase();
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  // ── Documents ──────────────────────────────────────────────────────────
  listDocuments: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    );
    return request(`/documents${qs.toString() ? `?${qs}` : ''}`);
  },

  getDocument: (id) => request(`/documents/${id}`),

  getStats: () => request('/stats'),

  updateReadStatus: (id, status) =>
    post(`/documents/${id}/status`, { read_status: status }),

  updateDomain: (id, domain) =>
    post(`/documents/${id}/domain`, { domain }),

  categorize: (id) =>
    request(`/documents/${id}/categorize`, { method: 'POST' }),

  extractConcepts: (id) =>
    request(`/documents/${id}/extract-concepts`, { method: 'POST' }),

  getConceptCard: (id) => request(`/documents/${id}/concept-card`),

  getSimilarDocs: (id) => request(`/documents/${id}/similar`),

  fileUrl: (id) => `${getBase()}/documents/${id}/file`,
  viewUrl: (id) => `${getBase()}/documents/${id}/view`,

  // ── Batch categorization ───────────────────────────────────────────────
  startBatchCategorize: (limit = 500) =>
    post('/categorize/batch', { limit, only_uncategorized: true }),

  streamBatchProgress: (onEvent, onDone, onError) => {
    const es = new EventSource('/api/categorize/progress');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data.done) {
        es.close();
        onDone && onDone(data);
      }
    };
    es.onerror = (err) => {
      es.close();
      onError && onError(err);
    };
    return es; // caller can call es.close() to cancel
  },

  // ── Search & Q&A ───────────────────────────────────────────────────────
  search: (query, domain = null, limit = 10) =>
    post('/search', { query, domain, limit }),

  ask: (question, opts = {}) =>
    post('/ask', { question, ...opts }),

  chat: (message, opts = {}) =>
    post('/chat', { message, ...opts }),

  // ── Study guides ───────────────────────────────────────────────────────
  generateStudyGuide: (domain) =>
    post('/study-guide/generate', { domain }),

  generateAllStudyGuides: () =>
    request('/study-guide/generate-all', { method: 'POST' }),

  getStudyGuide: (domain) => request(`/study-guide/${domain}`),

  patchStudyGuide: (domain, doc_id) =>
    post(`/study-guide/${domain}/patch`, { doc_id }),

  // ── Ingestion (Phase 6) ────────────────────────────────────────────────
  ingest: (source_type, source_data, options = {}) =>
    post('/ingest', { source_type, source_data, options }),

  ingestBulk: (items) =>
    post('/ingest/bulk', { items }),

  // ── Discovery (Phase 6) ────────────────────────────────────────────────
  discover: (query, mode = 'topic', reference_doc_id = null) =>
    post('/discover', { query, mode, reference_doc_id }),

  discoverDownload: (session_id, selected_urls) =>
    post('/discover/download', { session_id, selected_urls }),

  listDiscoverSessions: () => request('/discover/sessions'),

  // ── Admin ──────────────────────────────────────────────────────────────
  generatePortal: () =>
    request('/admin/generate-portal', { method: 'POST' }),

  getWatchEvents: () => request('/watch/events'),
};
