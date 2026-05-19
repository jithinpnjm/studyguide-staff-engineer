import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const ALL_DOMAINS = [
  'kubernetes-containers', 'cicd-gitops', 'observability', 'cloud-platforms',
  'infrastructure-as-code', 'security-devsecops', 'networking-service-mesh',
  'sre-practices', 'linux-systems', 'databases-storage', 'platform-engineering',
  'ai-mlops', 'agentic-genai', 'llmops',
  'scripting-python', 'scripting-bash-shell', 'scripting-go',
  'automation-tooling', 'general-devops',
];

const DOMAIN_LABELS = {
  'kubernetes-containers': 'Kubernetes & Containers', 'cicd-gitops': 'CI/CD & GitOps',
  'observability': 'Observability', 'cloud-platforms': 'Cloud Platforms',
  'infrastructure-as-code': 'Infrastructure as Code', 'security-devsecops': 'Security & DevSecOps',
  'networking-service-mesh': 'Networking & Service Mesh', 'sre-practices': 'SRE Practices',
  'linux-systems': 'Linux & Systems', 'databases-storage': 'Databases & Storage',
  'platform-engineering': 'Platform Engineering', 'ai-mlops': 'AI/MLOps',
  'agentic-genai': 'Agentic & GenAI', 'llmops': 'LLMOps',
  'scripting-python': 'Python Scripting', 'scripting-bash-shell': 'Bash & Shell',
  'scripting-go': 'Go for DevOps', 'automation-tooling': 'Automation & Tooling',
  'general-devops': 'General DevOps',
};

const TABS = ['Categorize', 'Concept Cards', 'Study Guides', 'Portal', 'Add Content'];

export default function Admin() {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  const refreshStats = () => api.getStats().then(setStats).catch(() => {});

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Admin</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href="https://jithinpnjm.github.io/studyguide-staff-engineer/"
            style={{ ...styles.backLink, color: '#6d28d9', fontWeight: 700 }}
          >
            ↗ DevOps Hub
          </a>
          <a href="#/library" style={styles.backLink}>← Back to Library</a>
        </div>
      </div>

      {stats && (
        <div style={styles.statsBanner}>
          <Stat label="Total docs" value={stats.total_documents} />
          <Stat label="Uncategorized" value={stats.uncategorized} color="#e65100" />
          <Stat label="Concept cards" value={stats.with_concept_cards} />
          <Stat label="Study guides" value={stats.study_guides_generated} />
          <Stat label="Unread" value={stats.unread_count} />
        </div>
      )}

      <div style={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === i ? styles.tabActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === 0 && <CategorizeTab stats={stats} onDone={refreshStats} />}
        {tab === 1 && <ConceptCardsTab stats={stats} onDone={refreshStats} />}
        {tab === 2 && <StudyGuidesTab stats={stats} onDone={refreshStats} />}
        {tab === 3 && <PortalTab onDone={refreshStats} />}
        {tab === 4 && <AddContentTab />}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statValue, color: color || '#1a1a2e' }}>{value ?? '—'}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Tab 1: Categorize ────────────────────────────────────────────────────────
function CategorizeTab({ stats, onDone }) {
  const [progress, setProgress] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const esRef = useRef(null);

  const start = async () => {
    setRunning(true);
    setLog([]);
    setProgress(null);
    try {
      await api.startBatchCategorize(1000);
    } catch (e) {
      setLog((l) => [...l, `Error: ${e.message}`]);
      setRunning(false);
      return;
    }

    esRef.current = api.streamBatchProgress(
      (data) => {
        setProgress(data);
        if (data.current_title) {
          setLog((l) => [
            `✓ ${data.current_title} → ${data.current_domain || '?'}`,
            ...l.slice(0, 49),
          ]);
        }
      },
      () => { setRunning(false); onDone(); },
      () => { setRunning(false); },
    );
  };

  const cancel = () => {
    esRef.current?.close();
    setRunning(false);
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div style={styles.tabBody}>
      <h2 style={styles.sectionTitle}>Batch AI Categorization</h2>
      <p style={styles.desc}>
        Runs Gemini on all uncategorized documents. Free tier: ~4s/doc.
        315 docs ≈ 25 min. Leave this running and check back.
      </p>

      <div style={styles.row}>
        <button style={running ? styles.btnDanger : styles.btnPrimary} onClick={running ? cancel : start}>
          {running ? '⏹ Stop' : '▶ Categorize all uncategorized'}
        </button>
        {progress && (
          <span style={styles.progressText}>
            {progress.processed} / {progress.total}
            {progress.failed > 0 && ` (${progress.failed} failed)`}
          </span>
        )}
      </div>

      {progress && progress.total > 0 && (
        <div style={styles.progressWrap}>
          <div style={{ ...styles.progressBar, width: `${pct}%` }} />
          <span style={styles.progressPct}>{pct}%</span>
        </div>
      )}

      {progress?.current_title && (
        <div style={styles.currentDoc}>
          Processing: <strong>{progress.current_title}</strong>
          {progress.current_domain && <> → {progress.current_domain}</>}
        </div>
      )}

      {log.length > 0 && (
        <div style={styles.logBox}>
          {log.map((line, i) => <div key={i} style={styles.logLine}>{line}</div>)}
        </div>
      )}

      {stats?.domains && (
        <div style={{ marginTop: 24 }}>
          <h3 style={styles.sectionSubtitle}>Current distribution</h3>
          <div style={styles.domainGrid}>
            {Object.entries(stats.domains)
              .sort((a, b) => b[1] - a[1])
              .map(([d, count]) => (
                <div key={d} style={styles.domainRow}>
                  <span style={styles.domainName}>{DOMAIN_LABELS[d] || d}</span>
                  <span style={styles.domainCount}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Concept Cards ─────────────────────────────────────────────────────
function ConceptCardsTab({ stats, onDone }) {
  const [docs, setDocs] = useState([]);
  const [extracting, setExtracting] = useState({});
  const [extractingAll, setExtractingAll] = useState(false);

  useEffect(() => {
    api.listDocuments({ limit: 200 }).then((all) => {
      setDocs(all.filter((d) => d.doc_type !== 'concept_card' && d.domain !== 'uncategorized'));
    });
  }, []);

  const extract = async (id) => {
    setExtracting((e) => ({ ...e, [id]: true }));
    try {
      await api.extractConcepts(id);
      setDocs((d) => d.filter((x) => x.id !== id));
      onDone();
    } catch {}
    setExtracting((e) => ({ ...e, [id]: false }));
  };

  const extractAll = async () => {
    setExtractingAll(true);
    for (const doc of docs.slice(0, 50)) {
      await extract(doc.id);
      await new Promise((r) => setTimeout(r, 5000));
    }
    setExtractingAll(false);
  };

  return (
    <div style={styles.tabBody}>
      <h2 style={styles.sectionTitle}>Concept Card Generator</h2>
      <p style={styles.desc}>
        Generates a staff-engineer concept card for each document — strips installation noise,
        keeps only architecture, failure modes, trade-offs, and interview prep.
      </p>
      <div style={styles.row}>
        <button style={styles.btnPrimary} onClick={extractAll} disabled={extractingAll}>
          {extractingAll ? '⏳ Extracting…' : `▶ Extract all (${docs.length} docs, ~5s each)`}
        </button>
        <span style={styles.progressText}>{stats?.with_concept_cards || 0} cards generated</span>
      </div>
      <div style={styles.docList}>
        {docs.slice(0, 30).map((doc) => (
          <div key={doc.id} style={styles.docListItem}>
            <div style={styles.docListTitle}>{doc.title || doc.filename}</div>
            <span style={styles.docListDomain}>{doc.domain}</span>
            <button
              style={styles.btnSmall}
              onClick={() => extract(doc.id)}
              disabled={!!extracting[doc.id]}
            >
              {extracting[doc.id] ? '⏳' : 'Extract'}
            </button>
          </div>
        ))}
        {docs.length === 0 && <p style={{ color: '#888' }}>All categorized docs have concept cards!</p>}
      </div>
    </div>
  );
}

// ── Tab 3: Study Guides ──────────────────────────────────────────────────────
function StudyGuidesTab({ stats, onDone }) {
  const [generating, setGenerating] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [results, setResults] = useState({});
  const domains = stats?.domains
    ? Object.entries(stats.domains)
        .filter(([d]) => d !== 'uncategorized')
        .sort((a, b) => b[1] - a[1])
    : [];

  const generate = async (domain) => {
    setGenerating((g) => ({ ...g, [domain]: true }));
    try {
      const res = await api.generateStudyGuide(domain);
      setResults((r) => ({ ...r, [domain]: res }));
      onDone();
    } catch (e) {
      setResults((r) => ({ ...r, [domain]: { error: e.message } }));
    }
    setGenerating((g) => ({ ...g, [domain]: false }));
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    try {
      await api.generateAllStudyGuides();
      onDone();
    } catch {}
    setGeneratingAll(false);
  };

  return (
    <div style={styles.tabBody}>
      <h2 style={styles.sectionTitle}>Study Guide Generator</h2>
      <p style={styles.desc}>
        Uses Gemini Pro to synthesize domain-level study guides.
        Each guide covers: core concepts, mental models, trade-offs,
        production failures, scale considerations, and 8-10 staff-level interview questions.
      </p>
      <div style={styles.row}>
        <button style={styles.btnPrimary} onClick={generateAll} disabled={generatingAll}>
          {generatingAll ? '⏳ Generating all…' : '▶ Generate all guides (≥3 docs)'}
        </button>
        <span style={styles.progressText}>{stats?.study_guides_generated || 0} generated</span>
      </div>
      <div style={styles.guideGrid}>
        {domains.map(([domain, count]) => (
          <div key={domain} style={styles.guideCard}>
            <div style={styles.guideCardTitle}>{DOMAIN_LABELS[domain] || domain}</div>
            <div style={styles.guideCardCount}>{count} docs</div>
            {results[domain]?.error && (
              <div style={styles.errorMsg}>{results[domain].error}</div>
            )}
            {results[domain]?.word_count && (
              <div style={styles.successMsg}>{results[domain].word_count} words generated</div>
            )}
            <button
              style={styles.btnSmall}
              onClick={() => generate(domain)}
              disabled={!!generating[domain] || count < 1}
            >
              {generating[domain] ? '⏳' : 'Generate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 4: Portal Sync ───────────────────────────────────────────────────────
function PortalTab({ onDone }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const sync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await api.generatePortal();
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e.message });
    }
    setSyncing(false);
  };

  return (
    <div style={styles.tabBody}>
      <h2 style={styles.sectionTitle}>Docusaurus Portal Sync</h2>
      <p style={styles.desc}>
        Regenerates MDX content pages from the SQLite database.
        Run this after categorization or study guide generation to update the portal.
        Requires the <code>portal/</code> directory to exist (run setup first).
      </p>
      <div style={styles.infoBox}>
        <strong>First time setup:</strong>
        <pre style={styles.codeBlock}>
          {`cd portal
npm install
npm start`}
        </pre>
        <strong>After categorization:</strong>
        <pre style={styles.codeBlock}>python backend/generate_portal.py</pre>
      </div>
      <button style={styles.btnPrimary} onClick={sync} disabled={syncing}>
        {syncing ? '⏳ Syncing…' : '🔄 Regenerate Docusaurus content'}
      </button>
      {result && (
        <div style={result.success ? styles.successBox : styles.errorBox}>
          {result.success ? (
            <pre style={{ margin: 0, fontSize: 12 }}>{result.output}</pre>
          ) : (
            <>
              <strong>Failed:</strong>
              <pre style={{ margin: '4px 0 0', fontSize: 12 }}>{result.error}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Add Content (Phase 6) ─────────────────────────────────────────────
function AddContentTab() {
  const [subTab, setSubTab] = useState(0);
  return (
    <div style={styles.tabBody}>
      <h2 style={styles.sectionTitle}>Add New Content</h2>
      <div style={styles.subTabs}>
        {['Drop File', 'Paste URL', 'Discover Topic', 'Watch Folder'].map((t, i) => (
          <button
            key={t}
            style={{ ...styles.subTab, ...(subTab === i ? styles.subTabActive : {}) }}
            onClick={() => setSubTab(i)}
          >
            {t}
          </button>
        ))}
      </div>
      {subTab === 0 && <DropFileSection />}
      {subTab === 1 && <PasteURLSection />}
      {subTab === 2 && <DiscoverSection />}
      {subTab === 3 && <WatchFolderSection />}
    </div>
  );
}

function DropFileSection() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    // Save file to a temp path isn't possible in browser — use the upload endpoint instead
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify({ ingest_source: 'local_file' }));
    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setResult({ ...data, filename: file.name });
    } catch (e) {
      setResult({ status: 'error', message: e.message });
    }
    setLoading(false);
  };

  return (
    <div>
      <div
        style={{ ...styles.dropZone, ...(dragging ? styles.dropZoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop a file here or click to browse</div>
        <div style={{ fontSize: 12, color: '#888' }}>PDF, PPTX, DOCX, MD, TXT</div>
        <input ref={inputRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.pptx,.ppt,.docx,.doc,.md,.txt" onChange={handleDrop} />
      </div>
      {loading && <div style={styles.infoMsg}>Processing and categorizing…</div>}
      {result && <IngestResultCard result={result} />}
    </div>
  );
}

function PasteURLSection() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const ingest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.ingest('url', url.trim());
      setResult(res);
    } catch (e) {
      setResult({ status: 'error', message: e.message });
    }
    setLoading(false);
  };

  return (
    <div>
      <p style={styles.desc}>
        Paste any URL — PDF, web page, GitHub repo, or YouTube video.
        Content is downloaded, categorized, and deduplicated automatically.
      </p>
      <div style={styles.row}>
        <input
          style={styles.urlInput}
          placeholder="https://example.com/guide.pdf"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ingest()}
        />
        <button style={styles.btnPrimary} onClick={ingest} disabled={loading || !url.trim()}>
          {loading ? '⏳' : 'Ingest'}
        </button>
      </div>
      {result && <IngestResultCard result={result} />}
    </div>
  );
}

function DiscoverSection() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [dlResults, setDlResults] = useState([]);

  const discover = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSession(null);
    setSelected([]);
    setDlResults([]);
    try {
      const res = await api.discover(query.trim());
      setSession(res);
    } catch (e) {
      setSession({ error: e.message });
    }
    setLoading(false);
  };

  const toggleSelect = (url) => {
    setSelected((s) => s.includes(url) ? s.filter((u) => u !== url) : [...s, url]);
  };

  const download = async () => {
    if (!session?.session_id || selected.length === 0) return;
    setDownloading(true);
    try {
      const res = await api.discoverDownload(session.session_id, selected);
      setDlResults(res.results || []);
    } catch {}
    setDownloading(false);
  };

  const EXAMPLES = ['Keycloak OAuth OIDC SRE', 'eBPF observability production', 'MLOps Kubeflow staff engineer', 'Cilium network policy deep dive'];

  return (
    <div>
      <p style={styles.desc}>
        Search the internet for SRE/DevOps content at staff-engineer depth.
        Requires GOOGLE_API_KEY+GOOGLE_CSE_ID or SERPAPI_KEY in .env.
      </p>
      <div style={styles.row}>
        <input
          style={styles.urlInput}
          placeholder="Prometheus cardinality at scale"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && discover()}
        />
        <button style={styles.btnPrimary} onClick={discover} disabled={loading || !query.trim()}>
          {loading ? '⏳' : '🔍 Search'}
        </button>
      </div>
      <div style={styles.examples}>
        {EXAMPLES.map((ex) => (
          <button key={ex} style={styles.exampleChip} onClick={() => setQuery(ex)}>{ex}</button>
        ))}
      </div>

      {session?.error && <div style={styles.errorBox}>{session.error}</div>}

      {session?.results?.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
            <strong>{session.results.length} results for "{session.query}"</strong>
            {selected.length > 0 && (
              <button style={styles.btnPrimary} onClick={download} disabled={downloading}>
                {downloading ? '⏳ Downloading…' : `↓ Download ${selected.length} selected`}
              </button>
            )}
          </div>
          {session.results.map((r) => (
            <div key={r.url} style={{ ...styles.discoverCard, ...(selected.includes(r.url) ? styles.discoverCardSelected : {}) }}>
              <input
                type="checkbox"
                checked={selected.includes(r.url)}
                onChange={() => toggleSelect(r.url)}
                style={{ marginRight: 10, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={styles.discoverTitle}>{r.title}</div>
                <div style={styles.discoverWhy}>{r.why_relevant}</div>
                <div style={styles.discoverMeta}>
                  <span style={styles.badge}>{r.content_type}</span>
                  <span style={styles.badge}>{r.estimated_depth}</span>
                  {r.already_covered && (
                    <span style={{ ...styles.badge, background: '#fff3cd', color: '#856404' }}>
                      Already covered: {r.similar_to?.title}
                    </span>
                  )}
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0a66c2' }}>
                  {r.url.slice(0, 80)}…
                </a>
              </div>
            </div>
          ))}
        </>
      )}

      {dlResults.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Download results:</strong>
          {dlResults.map((r, i) => <IngestResultCard key={i} result={r} />)}
        </div>
      )}
    </div>
  );
}

function WatchFolderSection() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.getWatchEvents().then(setEvents).catch(() => {});
  }, []);

  return (
    <div>
      <p style={styles.desc}>
        Drop files into <code>~/Downloads/devops-hub/</code> and they are automatically
        ingested, categorized, and deduplicated. Set <code>WATCH_DIR</code> in .env to change the folder.
      </p>
      <div style={styles.infoBox}>
        <strong>Enable:</strong>
        <pre style={styles.codeBlock}>
          {`# Add to backend/.env:
WATCH_DIR=~/Downloads/devops-hub

# Install watchdog:
pip install watchdog`}
        </pre>
      </div>
      <h3 style={styles.sectionSubtitle}>Recent auto-ingested files</h3>
      {events.length === 0 ? (
        <p style={{ color: '#888' }}>No files auto-ingested yet.</p>
      ) : (
        <div style={styles.docList}>
          {events.map((e) => (
            <div key={e.id} style={styles.docListItem}>
              <span style={styles.docListTitle}>{e.filepath.split('/').pop()}</span>
              <span style={{
                ...styles.badge,
                background: e.status === 'error' ? '#fde8e8' : '#e8f5e9',
                color: e.status === 'error' ? '#c62828' : '#2e7d32',
              }}>{e.status}</span>
              <span style={{ fontSize: 11, color: '#888' }}>
                {new Date(e.processed_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IngestResultCard({ result }) {
  const colors = {
    saved: { bg: '#e8f5e9', color: '#2e7d32' },
    unique: { bg: '#e8f5e9', color: '#2e7d32' },
    overlapping: { bg: '#fff3e0', color: '#e65100' },
    extends: { bg: '#e3f2fd', color: '#1565c0' },
    duplicate: { bg: '#fce4ec', color: '#c62828' },
    error: { bg: '#fde8e8', color: '#c62828' },
  };
  const c = colors[result.status] || colors.saved;
  return (
    <div style={{ ...styles.resultCard, background: c.bg, borderColor: c.color + '44' }}>
      <strong style={{ color: c.color }}>{result.status?.toUpperCase()}</strong>
      {result.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{result.title}</div>}
      {result.domain && <div style={{ fontSize: 12, color: '#555' }}>Domain: {result.domain}</div>}
      {result.action_taken && <div style={{ fontSize: 12 }}>{result.action_taken}</div>}
      {result.message && <div style={{ fontSize: 12, color: '#666' }}>{result.message}</div>}
      {result.dedup_decision?.similar_docs?.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Similar to: {result.dedup_decision.similar_docs[0]?.title}
          {result.dedup_decision.similar_docs[0]?.unique_in_new && (
            <div style={{ color: '#555' }}>
              New topics: {result.dedup_decision.similar_docs[0].unique_in_new}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: 0 },
  backLink: { fontSize: 13, color: '#0a66c2', textDecoration: 'none' },
  statsBanner: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statBox: {
    flex: '1 1 120px', background: '#fff', border: '1px solid #e8e8e8',
    borderRadius: 10, padding: '14px 16px', textAlign: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 700 },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8e8e8', paddingBottom: 0 },
  tab: {
    padding: '8px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 14, color: '#555', borderRadius: '8px 8px 0 0',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#0a66c2', borderBottom: '2px solid #0a66c2', fontWeight: 600 },
  content: { minHeight: 400 },
  tabBody: {},
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' },
  sectionSubtitle: { fontSize: 15, fontWeight: 600, color: '#1a1a2e', margin: '20px 0 8px' },
  desc: { fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 16px' },
  row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  btnPrimary: {
    padding: '9px 18px', background: '#0a66c2', color: '#fff',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    flexShrink: 0,
  },
  btnDanger: {
    padding: '9px 18px', background: '#d00000', color: '#fff',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnSmall: {
    padding: '5px 12px', background: '#f0f0f0', color: '#333',
    border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  progressText: { fontSize: 13, color: '#555' },
  progressWrap: {
    height: 12, background: '#e8e8e8', borderRadius: 6, overflow: 'hidden',
    position: 'relative', marginBottom: 12,
  },
  progressBar: { height: '100%', background: '#0a66c2', transition: 'width 0.5s', borderRadius: 6 },
  progressPct: { position: 'absolute', right: 6, top: -1, fontSize: 10, color: '#555' },
  currentDoc: { fontSize: 13, color: '#555', marginBottom: 8, padding: '6px 10px', background: '#f0f4ff', borderRadius: 6 },
  logBox: {
    background: '#1a1a2e', borderRadius: 8, padding: '12px', maxHeight: 240,
    overflowY: 'auto', marginTop: 12,
  },
  logLine: { fontSize: 12, color: '#6ee7b7', fontFamily: 'monospace', marginBottom: 2 },
  domainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 },
  domainRow: {
    display: 'flex', justifyContent: 'space-between', padding: '6px 10px',
    background: '#f8f9fa', borderRadius: 6, fontSize: 13,
  },
  domainName: { color: '#444', flex: 1 },
  domainCount: { fontWeight: 700, color: '#0a66c2' },
  docList: { display: 'flex', flexDirection: 'column', gap: 6 },
  docListItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #e8e8e8',
  },
  docListTitle: { flex: 1, fontSize: 13, color: '#1a1a2e', fontWeight: 500 },
  docListDomain: { fontSize: 11, color: '#888', flexShrink: 0 },
  guideGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 16 },
  guideCard: {
    background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 10,
    padding: '14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  guideCardTitle: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
  guideCardCount: { fontSize: 12, color: '#888' },
  infoBox: {
    background: '#f0f4ff', border: '1px solid #c7d7f5', borderRadius: 8,
    padding: '14px 16px', marginBottom: 16, fontSize: 13,
  },
  codeBlock: {
    background: '#1a1a2e', color: '#6ee7b7', borderRadius: 6,
    padding: '8px 12px', fontSize: 12, margin: '8px 0 0', fontFamily: 'monospace',
  },
  successBox: {
    background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8,
    padding: '12px', marginTop: 12, fontSize: 13, color: '#2e7d32',
  },
  errorBox: {
    background: '#fde8e8', border: '1px solid #ef9a9a', borderRadius: 8,
    padding: '12px', marginTop: 12, fontSize: 13, color: '#c62828',
  },
  errorMsg: { fontSize: 12, color: '#c62828' },
  successMsg: { fontSize: 12, color: '#2e7d32' },
  dropZone: {
    border: '2px dashed #c0c0c0', borderRadius: 12,
    padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
    color: '#666', marginBottom: 16, transition: 'border-color 0.2s, background 0.2s',
  },
  dropZoneActive: { borderColor: '#0a66c2', background: '#f0f4ff' },
  urlInput: {
    flex: 1, padding: '9px 12px', border: '1px solid #ddd',
    borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  },
  examples: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  exampleChip: {
    padding: '4px 12px', background: '#f0f4ff', color: '#0a66c2',
    border: '1px solid #c7d7f5', borderRadius: 20, cursor: 'pointer', fontSize: 12,
  },
  discoverCard: {
    display: 'flex', alignItems: 'flex-start', padding: '12px',
    border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 8,
    background: '#fff', cursor: 'pointer',
  },
  discoverCardSelected: { background: '#f0f4ff', borderColor: '#0a66c2' },
  discoverTitle: { fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 },
  discoverWhy: { fontSize: 12, color: '#555', marginBottom: 6 },
  discoverMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  badge: {
    fontSize: 11, padding: '2px 8px', borderRadius: 10,
    background: '#f0f0f0', color: '#555', fontWeight: 500,
  },
  resultCard: {
    padding: '12px 14px', borderRadius: 8, border: '1px solid',
    marginTop: 12, fontSize: 13,
  },
  infoMsg: { padding: '10px 14px', background: '#f0f4ff', borderRadius: 8, fontSize: 13, color: '#1565c0', marginBottom: 12 },
  subTabs: { display: 'flex', gap: 4, marginBottom: 20 },
  subTab: {
    padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 20,
    background: 'none', cursor: 'pointer', fontSize: 13, color: '#555',
  },
  subTabActive: { background: '#0a66c2', color: '#fff', borderColor: '#0a66c2' },
};
