import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { DOMAIN_COLORS } from '../components/Sidebar';

const ALL_DOMAINS = [
  'kubernetes-containers', 'cicd-gitops', 'observability', 'cloud-platforms',
  'infrastructure-as-code', 'security-devsecops', 'networking-service-mesh',
  'sre-practices', 'linux-systems', 'databases-storage', 'platform-engineering',
  'ai-mlops', 'agentic-genai', 'llmops',
  'scripting-python', 'scripting-bash-shell', 'scripting-go',
  'automation-tooling', 'general-devops', 'uncategorized',
];

const LEVEL_COLORS = {
  beginner: '#2e7d32', intermediate: '#1565c0',
  advanced: '#e65100', 'staff-level': '#6a1b9a',
};

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Document() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [conceptCard, setConceptCard] = useState(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    api.getDocument(id)
      .then((d) => {
        setDoc(d);
        setSelectedDomain(d.domain || 'uncategorized');
        if (d.read_status === 'unread') {
          setTimeout(() => handleMarkRead(d, 'read'), 2000);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    api.getConceptCard(id).then(setConceptCard).catch(() => {});
  }, [id]);

  const handleMarkRead = async (docObj, status) => {
    const target = docObj || doc;
    if (!target) return;
    setMarkingRead(true);
    try {
      const updated = await api.updateReadStatus(target.id, status);
      setDoc(updated);
    } catch {}
    setMarkingRead(false);
  };

  const handleSaveDomain = async () => {
    if (!selectedDomain || selectedDomain === doc.domain) return;
    setSavingDomain(true);
    try {
      const updated = await api.updateDomain(doc.id, selectedDomain);
      setDoc(updated);
    } catch {}
    setSavingDomain(false);
  };

  const handleCategorize = async () => {
    setCategorizing(true);
    try {
      const updated = await api.categorize(doc.id);
      setDoc(updated);
      setSelectedDomain(updated.domain);
    } catch {}
    setCategorizing(false);
  };

  const handleExtractConcepts = async () => {
    setExtracting(true);
    try {
      const card = await api.extractConcepts(doc.id);
      setConceptCard(card);
    } catch {}
    setExtracting(false);
  };

  if (loading) return <div style={styles.center}>Loading…</div>;
  if (error) return <div style={styles.center}>Error: {error}</div>;
  if (!doc) return <div style={styles.center}>Document not found.</div>;

  const domainColor = DOMAIN_COLORS[doc.domain] || '#9e9e9e';
  const viewUrl = api.viewUrl(doc.id);
  const fileUrl = api.fileUrl(doc.id);
  const isPdf = doc.file_type === 'pdf';
  const isViewable = ['pdf', 'pptx', 'ppt', 'docx', 'doc', 'md', 'txt'].includes(doc.file_type);

  return (
    <div style={styles.layout}>
      {/* Left: viewer pane */}
      <div style={styles.viewerPane}>
        {/* Top toolbar */}
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={() => navigate('/library')}>
            ← Library
          </button>
          <div style={styles.toolbarTitle} title={doc.title}>
            {doc.title || doc.filename}
          </div>
          <div style={styles.toolbarActions}>
            <button
              style={styles.toolbarBtn}
              disabled={markingRead}
              onClick={() => handleMarkRead(null, doc.read_status === 'read' ? 'unread' : 'read')}
            >
              {doc.read_status === 'read' ? '○ Mark unread' : '✓ Mark read'}
            </button>
            <button
              style={{ ...styles.toolbarBtn, ...styles.toolbarBtnAI }}
              disabled={categorizing}
              onClick={handleCategorize}
            >
              {categorizing ? '⏳' : '✨ AI Categorize'}
            </button>
            {conceptCard ? (
              <button
                style={{ ...styles.toolbarBtn, ...styles.toolbarBtnCard }}
                onClick={() => setShowCard((v) => !v)}
              >
                {showCard ? '📄 Full Doc' : '🃏 Concept Card'}
              </button>
            ) : (
              <button
                style={styles.toolbarBtn}
                disabled={extracting}
                onClick={handleExtractConcepts}
              >
                {extracting ? '⏳' : '🃏 Extract Concepts'}
              </button>
            )}
            <a href={fileUrl} download={doc.filename} style={styles.downloadBtn}>
              ↓ Download
            </a>
          </div>
        </div>

        {/* Content viewer */}
        <div style={styles.viewer}>
          {showCard && conceptCard ? (
            <iframe
              src={api.viewUrl(conceptCard.id)}
              style={styles.iframe}
              title="Concept Card"
            />
          ) : isViewable ? (
            <iframe
              src={viewUrl}
              style={styles.iframe}
              title={doc.title || doc.filename}
            />
          ) : (
            <div style={styles.noPreview}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <p style={{ fontSize: 14, color: '#ddd' }}>
                Preview not available for <strong>{doc.file_type?.toUpperCase()}</strong> files.
              </p>
              <a href={fileUrl} download={doc.filename} style={styles.dlBtn}>
                Download file
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Right: metadata panel */}
      <aside style={styles.metaPane}>
        <div style={styles.metaHeader}>
          <span style={{ ...styles.typeBadge, background: '#cc1016' }}>
            {doc.file_type?.toUpperCase() || 'DOC'}
          </span>
          {doc.concept_level && (
            <span style={{
              ...styles.levelBadge,
              color: LEVEL_COLORS[doc.concept_level] || '#888',
              borderColor: (LEVEL_COLORS[doc.concept_level] || '#888') + '44',
            }}>
              {doc.concept_level}
            </span>
          )}
        </div>

        {/* Domain selector */}
        <div style={styles.domainRow}>
          <select
            style={{ ...styles.domainSelect, borderColor: domainColor, color: domainColor }}
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
          >
            {ALL_DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {selectedDomain !== doc.domain && (
            <button style={styles.saveDomainBtn} disabled={savingDomain} onClick={handleSaveDomain}>
              {savingDomain ? '…' : 'Save'}
            </button>
          )}
        </div>

        <h1 style={styles.docTitle}>{doc.title || doc.filename}</h1>

        {doc.author && (
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Author</span>
            <span style={styles.metaValue}>{doc.author}</span>
          </div>
        )}
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Saved</span>
          <span style={styles.metaValue}>{formatDate(doc.saved_at)}</span>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Size</span>
          <span style={styles.metaValue}>{formatSize(doc.file_size)}</span>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Status</span>
          <span style={{
            ...styles.statusBadge,
            background: doc.read_status === 'read' ? '#e8f5e9' : '#e8f0fe',
            color: doc.read_status === 'read' ? '#2e7d32' : '#0a66c2',
          }}>
            {doc.read_status === 'read' ? '✓ Read' : '● Unread'}
          </span>
        </div>

        {doc.summary && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Summary</div>
            <p style={styles.sectionText}>{doc.summary}</p>
          </div>
        )}

        {doc.key_topics?.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Key Topics</div>
            <div style={styles.tags}>
              {doc.key_topics.map((t) => (
                <span key={t} style={{ ...styles.tag, background: '#f0f4ff', color: '#1565c0' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {doc.tags?.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Tags</div>
            <div style={styles.tags}>
              {doc.tags.map((t) => (
                <span key={t} style={styles.tag}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {conceptCard && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Concept Card</div>
            <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
              AI-generated concept card available.
            </p>
          </div>
        )}

        {doc.linkedin_post_url && (
          <a href={doc.linkedin_post_url} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
            View LinkedIn post →
          </a>
        )}
        {doc.source_url && doc.source_url !== doc.linkedin_post_url && (
          <a href={doc.source_url} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
            Source URL →
          </a>
        )}
      </aside>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', height: '100vh', background: '#f8f9fa' },
  viewerPane: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', background: '#1a1a2e',
    borderBottom: '1px solid #2d2d4e', flexShrink: 0,
  },
  backBtn: {
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 13, color: '#aaa', fontWeight: 600, padding: '6px 0',
    flexShrink: 0, whiteSpace: 'nowrap',
  },
  toolbarTitle: {
    flex: 1, fontSize: 13, color: '#e0e0e0', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    padding: '0 8px',
  },
  toolbarActions: { display: 'flex', gap: 6, flexShrink: 0 },
  toolbarBtn: {
    padding: '5px 10px', fontSize: 12, fontWeight: 500,
    background: '#2d2d4e', color: '#ccc', border: '1px solid #404060',
    borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  toolbarBtnAI: { background: '#3b1f6e', color: '#d8b4fe', borderColor: '#6d28d9' },
  toolbarBtnCard: { background: '#1a3a2e', color: '#6ee7b7', borderColor: '#065f46' },
  downloadBtn: {
    padding: '5px 10px', fontSize: 12, fontWeight: 600,
    background: '#0a66c2', color: '#fff', borderRadius: 6,
    textDecoration: 'none', whiteSpace: 'nowrap',
  },
  viewer: {
    flex: 1, background: '#525659',
    display: 'flex', alignItems: 'stretch', overflow: 'hidden',
  },
  iframe: { width: '100%', height: '100%', border: 'none' },
  noPreview: { textAlign: 'center', padding: 40, color: '#ccc', margin: 'auto' },
  dlBtn: {
    display: 'inline-block', marginTop: 16, padding: '10px 20px',
    background: '#0a66c2', color: '#fff', borderRadius: 6,
    textDecoration: 'none', fontSize: 14, fontWeight: 600,
  },
  metaPane: {
    width: 300, minWidth: 300, background: '#fff',
    borderLeft: '1px solid #e8e8e8', padding: '20px 18px',
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
  },
  metaHeader: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  typeBadge: {
    fontSize: 10, fontWeight: 700, color: '#fff',
    borderRadius: 4, padding: '2px 6px',
  },
  levelBadge: {
    fontSize: 11, fontWeight: 600, borderRadius: 10,
    padding: '2px 8px', border: '1px solid',
  },
  domainRow: { display: 'flex', alignItems: 'center', gap: 6 },
  domainSelect: {
    flex: 1, fontSize: 12, fontWeight: 600, padding: '5px 8px',
    borderRadius: 8, border: '1.5px solid', background: '#fff',
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
  },
  saveDomainBtn: {
    padding: '5px 10px', fontSize: 12, fontWeight: 700,
    background: '#0a66c2', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', flexShrink: 0,
  },
  docTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0, lineHeight: 1.4 },
  metaRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 8, fontSize: 13,
  },
  metaLabel: { color: '#888', fontWeight: 500, flexShrink: 0 },
  metaValue: { color: '#1a1a2e', textAlign: 'right', wordBreak: 'break-word' },
  statusBadge: { fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '3px 10px' },
  section: { borderTop: '1px solid #f0f0f0', paddingTop: 12 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#888', marginBottom: 6,
  },
  sectionText: { fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tag: { fontSize: 11, background: '#f0f0f0', color: '#444', borderRadius: 4, padding: '2px 6px' },
  sourceLink: { display: 'block', fontSize: 12, color: '#0a66c2', textDecoration: 'none', fontWeight: 500 },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', fontSize: 14, color: '#888',
  },
};
