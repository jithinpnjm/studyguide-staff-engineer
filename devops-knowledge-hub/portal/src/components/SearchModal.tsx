import React, {useState, useEffect, useRef} from 'react';
import {useHistory} from '@docusaurus/router';

const API = 'http://localhost:8765';

interface Result {
  id: number;
  title: string;
  summary: string;
  domain: string;
  file_path: string;
}

interface Props {
  onClose: () => void;
}

export default function SearchModal({onClose}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useHistory();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/search`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({query, limit: 8}),
        });
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const go = (doc: Result) => {
    onClose();
    const slug = doc.file_path
      ? doc.file_path.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
      : String(doc.id);
    history.push(`/docs/${doc.domain}/${slug}`);
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-modal-input"
          placeholder="Search your knowledge base…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="search-results">
          {loading && (
            <div style={{padding: '1rem', opacity: 0.5, fontSize: '0.85rem'}}>Searching…</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div style={{padding: '1rem', opacity: 0.5, fontSize: '0.85rem'}}>No results found.</div>
          )}
          {results.map(r => (
            <div key={r.id} className="search-result-item" onClick={() => go(r)}>
              <div className="search-result-title">{r.title}</div>
              <div className="search-result-snippet">{r.summary}</div>
              {r.domain && (
                <span className="domain-badge" style={{marginTop: 4}}>
                  {r.domain}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
