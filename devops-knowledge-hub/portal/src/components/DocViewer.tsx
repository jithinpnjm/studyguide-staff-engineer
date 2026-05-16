import React, {useState} from 'react';

const API_BASE = 'http://localhost:8765';

interface Props {
  docId: number | string;
  title?: string;
  fileType?: string;
  apiBase?: string;
}

export default function DocViewer({docId, title, apiBase}: Props) {
  const [show, setShow] = useState(false);
  const base = apiBase || API_BASE;
  const viewUrl = `${base}/api/documents/${docId}/view`;

  if (!docId) return null;

  return (
    <div style={{margin: '1rem 0'}}>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          background: 'var(--ifm-color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 16px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
      >
        {show ? '▲ Hide Viewer' : '▶ Open in Viewer'}
      </button>
      {show && (
        <div className="pdf-viewer-container" style={{marginTop: '0.75rem'}}>
          <iframe src={viewUrl} title={title || `Document ${docId}`} />
        </div>
      )}
    </div>
  );
}
