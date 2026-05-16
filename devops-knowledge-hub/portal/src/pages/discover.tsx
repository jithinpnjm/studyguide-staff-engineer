import React, {useState} from 'react';
import Layout from '@theme/Layout';
import AIChatWidget from '@site/src/components/AIChatWidget';

const API = 'http://localhost:8765';

interface DiscoveredItem {
  url: string;
  title: string;
  why_relevant?: string;
  snippet?: string;
  content_type?: string;
  estimated_depth?: string;
  already_covered?: boolean;
  recommend?: boolean;
}

interface Session {
  session_id: string;
  query: string;
  results: DiscoveredItem[];
  message?: string;
}

export default function Discover() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadLog, setDownloadLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  const discover = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSession(null);
    setSelected(new Set());
    setDownloadLog([]);
    setError('');
    try {
      const res = await fetch(`${API}/api/discover`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query, mode: 'search', limit: 10}),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSession(data);
        if (data.results.length === 0 && data.message) {
          setError(data.message);
        }
      }
    } catch {
      setError('Failed to reach backend. Is it running on localhost:8765?');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const download = async () => {
    if (!session || selected.size === 0) return;
    setDownloading(true);
    setDownloadLog([]);
    try {
      const res = await fetch(`${API}/api/discover/download`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: session.session_id, selected_urls: Array.from(selected)}),
      });
      const data = await res.json();
      const log: string[] = [];
      for (const r of data.results || []) {
        log.push(`${r.status === 'added' ? '✓' : r.status === 'duplicate' ? '⊘' : '✗'} ${r.title || r.url}`);
      }
      setDownloadLog(log);
    } catch {
      setDownloadLog(['Error: failed to download.']);
    } finally {
      setDownloading(false);
    }
  };

  const selectAll = () => {
    if (!session) return;
    const eligible = session.results.filter(r => !r.already_covered).map(r => r.url);
    setSelected(new Set(eligible));
  };

  return (
    <Layout title="Discover Topics" description="Find and import new DevOps resources">
      <main style={{maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem'}}>
        <h1 style={{fontSize: '1.8rem', marginBottom: 4}}>Discover Topics</h1>
        <p style={{opacity: 0.6, marginBottom: '1.5rem'}}>
          Search the web for DevOps resources and import them directly into your knowledge base.
        </p>

        <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem'}}>
          <input
            style={{
              flex: 1,
              background: 'var(--ifm-background-surface-color, #1e293b)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '10px 16px',
              color: 'inherit',
              fontSize: '1rem',
              outline: 'none',
            }}
            placeholder="e.g. Kubernetes HPA autoscaling deep dive"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && discover()}
          />
          <button
            onClick={discover}
            disabled={loading || !query.trim()}
            style={{
              background: 'var(--ifm-color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Searching…' : 'Discover'}
          </button>
        </div>

        {error && (
          <div style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.9rem'}}>
            {error}
          </div>
        )}

        {session && session.results.length > 0 && (
          <>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem'}}>
              <span style={{fontSize: '0.85rem', opacity: 0.6}}>
                {session.results.length} results for "{session.query}"
              </span>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button
                  onClick={selectAll}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6,
                    padding: '4px 12px',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontSize: '0.8rem',
                  }}
                >
                  Select New
                </button>
                <button
                  onClick={download}
                  disabled={selected.size === 0 || downloading}
                  style={{
                    background: selected.size > 0 ? 'var(--ifm-color-primary)' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 12px',
                    cursor: selected.size > 0 && !downloading ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    opacity: selected.size === 0 || downloading ? 0.5 : 1,
                  }}
                >
                  {downloading ? 'Importing…' : `Import Selected (${selected.size})`}
                </button>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem'}}>
              {session.results.map(item => (
                <div
                  key={item.url}
                  onClick={() => !item.already_covered && toggle(item.url)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.9rem 1rem',
                    background: 'var(--ifm-background-surface-color, #1e293b)',
                    border: `1px solid ${selected.has(item.url) ? 'var(--ifm-color-primary)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8,
                    cursor: item.already_covered ? 'default' : 'pointer',
                    opacity: item.already_covered ? 0.55 : 1,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.url)}
                    onChange={() => !item.already_covered && toggle(item.url)}
                    disabled={item.already_covered}
                    style={{marginTop: 2, flexShrink: 0}}
                  />
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontWeight: 600, fontSize: '0.9rem', marginBottom: 2}}>
                      {item.title || item.url}
                      {item.already_covered && (
                        <span style={{marginLeft: 8, fontSize: '0.75rem', color: '#10b981', fontWeight: 400}}>
                          already imported
                        </span>
                      )}
                      {item.content_type && (
                        <span style={{marginLeft: 8, fontSize: '0.72rem', opacity: 0.5, fontWeight: 400}}>
                          {item.content_type}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize: '0.8rem', opacity: 0.6, marginBottom: 4}}>
                      {item.why_relevant || item.snippet}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{fontSize: '0.75rem', opacity: 0.35, wordBreak: 'break-all'}}
                    >
                      {item.url}
                    </a>
                  </div>
                  {item.estimated_depth && (
                    <div style={{fontSize: '0.72rem', opacity: 0.45, flexShrink: 0, textAlign: 'right'}}>
                      {item.estimated_depth}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {downloadLog.length > 0 && (
          <div style={{
            background: 'var(--ifm-background-surface-color, #1e293b)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
          }}>
            <div style={{opacity: 0.5, marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
              Import Results
            </div>
            {downloadLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </main>
      <AIChatWidget />
    </Layout>
  );
}
