import React, {useEffect, useState} from 'react';

const API = 'http://localhost:8765';

interface Doc {
  id: number;
  title: string;
  domain: string;
  similarity_score?: number;
}

interface Props {
  docId: number;
}

export default function RelatedDocs({docId}: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    if (!docId) return;
    fetch(`${API}/api/documents/${docId}/similar`)
      .then(r => r.json())
      .then(data => setDocs(data.similar || []))
      .catch(() => {});
  }, [docId]);

  if (!docs.length) return null;

  return (
    <div className="related-docs">
      <h4>Related Documents</h4>
      {docs.map(d => (
        <a
          key={d.id}
          href={`${API}/api/documents/${d.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {d.title}
          {d.similarity_score && (
            <span style={{opacity: 0.5, fontSize: '0.75rem', marginLeft: 6}}>
              {Math.round(d.similarity_score * 100)}% match
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
