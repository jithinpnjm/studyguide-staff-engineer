import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import DocCard from '../components/DocCard';
import SearchBar from '../components/SearchBar';
import { api } from '../api';

export default function Library() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [domain, setDomain] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 100 };
      if (domain) params.domain = domain;
      if (search) params.search = search;
      let docs = await api.listDocuments(params);

      if (sort === 'oldest') {
        docs = [...docs].sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at));
      } else if (sort === 'domain') {
        docs = [...docs].sort((a, b) => a.domain.localeCompare(b.domain));
      }

      setDocuments(docs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [domain, search, sort]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await api.getStats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, [fetchDocuments, fetchStats]);

  const domainCounts = stats
    ? { ...stats.domains, _total: stats.total_documents }
    : {};

  return (
    <div style={styles.layout}>
      <Sidebar domain={domain} onDomainChange={setDomain} domainCounts={domainCounts} />

      <main style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>Document Library</h1>
            <p style={styles.pageSubtitle}>
              {stats
                ? `${stats.total_documents} documents · ${stats.unread_count} unread`
                : 'Loading…'}
            </p>
          </div>
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          sort={sort}
          onSortChange={setSort}
        />

        {error && (
          <div style={styles.errorBanner}>
            <strong>Backend unreachable.</strong> Make sure the backend is running:
            <br />
            <code>cd backend && python main.py</code>
          </div>
        )}

        {!error && !loading && documents.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <h2 style={styles.emptyTitle}>No documents yet</h2>
            <p style={styles.emptyText}>
              Install the Chrome extension, browse LinkedIn, and click{' '}
              <strong>Save to Hub</strong> on any document post.
            </p>
            <ol style={styles.emptySteps}>
              <li>Open Chrome → <code>chrome://extensions</code></li>
              <li>Enable Developer mode → Load unpacked</li>
              <li>Select the <code>extension/</code> folder</li>
              <li>Browse LinkedIn feed and save documents</li>
            </ol>
          </div>
        )}

        {loading && <div style={styles.loading}>Loading documents…</div>}

        <div style={styles.grid}>
          {documents.map((doc) => (
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f8f9fa',
  },
  main: {
    flex: 1,
    padding: '28px 32px',
    overflowY: 'auto',
    maxWidth: 1100,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  errorBanner: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: 8,
    padding: '14px 18px',
    fontSize: 13,
    color: '#664d03',
    marginBottom: 20,
    lineHeight: 1.8,
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 40px',
    maxWidth: 480,
    margin: '0 auto',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' },
  emptyText: { fontSize: 14, color: '#666', lineHeight: 1.6 },
  emptySteps: {
    textAlign: 'left',
    marginTop: 20,
    fontSize: 13,
    color: '#555',
    lineHeight: 2,
    paddingLeft: 20,
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    color: '#888',
    fontSize: 14,
  },
};
