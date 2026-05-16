import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Settings() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    api.getStats()
      .then((s) => { setStats(s); setBackendOk(true); })
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <div style={styles.layout}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/library')}>
          ← Back to Library
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>

      <div style={styles.content}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Backend Status</h2>
          <div style={styles.statusRow}>
            <div
              style={{
                ...styles.statusDot,
                background: backendOk === null ? '#ccc' : backendOk ? '#057642' : '#cc1016',
              }}
            />
            <span style={styles.statusLabel}>
              {backendOk === null
                ? 'Checking…'
                : backendOk
                ? 'Connected to http://localhost:8765'
                : 'Offline — start backend with: python main.py'}
            </span>
          </div>
        </section>

        {stats && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Storage Statistics</h2>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.tdLabel}>Total documents</td>
                  <td style={styles.tdValue}>{stats.total_documents}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Unread</td>
                  <td style={styles.tdValue}>{stats.unread_count}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Saved today</td>
                  <td style={styles.tdValue}>{stats.recent_count}</td>
                </tr>
              </tbody>
            </table>
            <h3 style={styles.subTitle}>By Domain</h3>
            <table style={styles.table}>
              <tbody>
                {Object.entries(stats.domains).map(([domain, count]) => (
                  <tr key={domain}>
                    <td style={styles.tdLabel}>{domain}</td>
                    <td style={styles.tdValue}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Storage Location</h2>
          <p style={styles.desc}>
            Documents are stored locally at:
          </p>
          <code style={styles.codePath}>~/devops-knowledge-hub/documents/</code>
          <p style={{ ...styles.desc, marginTop: 8 }}>
            Database at: <code>~/devops-knowledge-hub/metadata.db</code>
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Chrome Extension</h2>
          <ol style={styles.ol}>
            <li>Open <code>chrome://extensions</code></li>
            <li>Enable Developer mode (top right toggle)</li>
            <li>Click "Load unpacked"</li>
            <li>Select the <code>extension/</code> folder from this project</li>
          </ol>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>API Endpoints</h2>
          <div style={styles.endpoints}>
            {[
              ['POST', '/api/documents/upload', 'Upload a document'],
              ['GET', '/api/documents', 'List all documents'],
              ['GET', '/api/documents/{id}', 'Get document metadata'],
              ['GET', '/api/documents/{id}/file', 'Serve document file'],
              ['PATCH', '/api/documents/{id}/status', 'Update read status'],
              ['GET', '/api/stats', 'Get statistics'],
            ].map(([method, path, desc]) => (
              <div key={path} style={styles.endpoint}>
                <span style={{ ...styles.method, background: method === 'GET' ? '#e8f0fe' : method === 'POST' ? '#e8f5e9' : '#fff3e0', color: method === 'GET' ? '#0a66c2' : method === 'POST' ? '#2e7d32' : '#e65100' }}>
                  {method}
                </span>
                <code style={styles.path}>{path}</code>
                <span style={styles.endpointDesc}>{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  layout: { background: '#f8f9fa', minHeight: '100vh' },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  backBtn: {
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 13, color: '#0a66c2', fontWeight: 600,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 },
  content: { maxWidth: 700, margin: '0 auto', padding: '32px' },
  section: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e8e8e8',
    padding: '20px 24px',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: '0 0 14px' },
  subTitle: { fontSize: 13, fontWeight: 600, color: '#555', margin: '14px 0 8px' },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: '50%' },
  statusLabel: { fontSize: 13, color: '#444' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tdLabel: { fontSize: 13, color: '#666', padding: '5px 0', width: '60%' },
  tdValue: { fontSize: 13, color: '#1a1a2e', fontWeight: 600, textAlign: 'right' },
  desc: { fontSize: 13, color: '#555', marginBottom: 8 },
  codePath: {
    display: 'block',
    fontSize: 13,
    background: '#f4f4f4',
    padding: '8px 12px',
    borderRadius: 6,
    fontFamily: 'monospace',
  },
  ol: { fontSize: 13, color: '#444', lineHeight: 2.2, paddingLeft: 20, margin: 0 },
  endpoints: { display: 'flex', flexDirection: 'column', gap: 8 },
  endpoint: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
  },
  method: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0,
  },
  path: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    minWidth: 220,
  },
  endpointDesc: { fontSize: 12, color: '#888' },
};
