import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOMAIN_COLORS } from './Sidebar';
import { api } from '../api';

const FILE_TYPE_COLORS = {
  pdf: '#cc1016', pptx: '#d04423', ppt: '#d04423',
  docx: '#2b579a', doc: '#2b579a',
  xlsx: '#217346', xls: '#217346',
  md: '#0a66c2',
};

const LEVEL_COLORS = {
  beginner: '#2e7d32', intermediate: '#1565c0',
  advanced: '#e65100', 'staff-level': '#6a1b9a',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocCard({ doc, onUpdate }) {
  const navigate = useNavigate();
  const [localDoc, setLocalDoc] = useState(doc);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [working, setWorking] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { setLocalDoc(doc); }, [doc]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const domainColor = DOMAIN_COLORS[localDoc.domain] || '#9e9e9e';
  const typeColor = FILE_TYPE_COLORS[localDoc.file_type] || '#555';
  const levelColor = LEVEL_COLORS[localDoc.concept_level] || '#888';

  async function handleCategorize(e) {
    e.stopPropagation();
    setMenuOpen(false);
    setWorking(true);
    try {
      const updated = await api.categorize(localDoc.id);
      setLocalDoc(updated);
      onUpdate && onUpdate(updated);
    } catch {}
    setWorking(false);
  }

  async function handleToggleRead(e) {
    e.stopPropagation();
    setMenuOpen(false);
    const newStatus = localDoc.read_status === 'read' ? 'unread' : 'read';
    try {
      const updated = await api.updateReadStatus(localDoc.id, newStatus);
      setLocalDoc(updated);
      onUpdate && onUpdate(updated);
    } catch {}
  }

  function handleOpen(e) {
    e.stopPropagation();
    setMenuOpen(false);
    navigate(`/documents/${localDoc.id}`);
  }

  function handleMenuToggle(e) {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  return (
    <div
      style={{ ...styles.card, ...(localDoc.read_status === 'read' ? styles.cardRead : {}) }}
      onClick={() => navigate(`/documents/${localDoc.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 3-dot menu trigger */}
      {(hovered || menuOpen) && (
        <div style={styles.menuWrap} ref={menuRef}>
          <button
            style={styles.menuBtn}
            onClick={handleMenuToggle}
            title="More actions"
          >
            {working ? '⏳' : '⋮'}
          </button>
          {menuOpen && (
            <div style={styles.dropdown}>
              <button style={styles.dropItem} onClick={handleOpen}>
                Open
              </button>
              <button style={styles.dropItem} onClick={handleCategorize}>
                ✨ Categorize with AI
              </button>
              <button style={styles.dropItem} onClick={handleToggleRead}>
                {localDoc.read_status === 'read' ? 'Mark as unread' : 'Mark as read'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unread indicator */}
      {localDoc.read_status === 'unread' && !hovered && !menuOpen && (
        <div style={styles.unreadDot} />
      )}

      <div style={styles.header}>
        <span style={{ ...styles.typeBadge, background: typeColor }}>
          {localDoc.file_type?.toUpperCase() || 'DOC'}
        </span>
        <span style={{ ...styles.domainPill, background: domainColor + '18', color: domainColor }}>
          {localDoc.domain || 'uncategorized'}
        </span>
        {localDoc.concept_level && localDoc.concept_level !== 'intermediate' && (
          <span style={{ ...styles.levelPill, color: levelColor, borderColor: levelColor + '44' }}>
            {localDoc.concept_level}
          </span>
        )}
      </div>

      <h3 style={styles.title} title={localDoc.title}>
        {localDoc.title || localDoc.filename || 'Untitled Document'}
      </h3>

      {localDoc.author && <div style={styles.author}>by {localDoc.author}</div>}

      {localDoc.summary && <p style={styles.summary}>{localDoc.summary}</p>}

      {localDoc.tags?.length > 0 && (
        <div style={styles.tags}>
          {localDoc.tags.slice(0, 4).map((t) => (
            <span key={t} style={styles.tag}>{t}</span>
          ))}
        </div>
      )}

      <div style={styles.footer}>
        <span style={styles.date}>{formatDate(localDoc.saved_at)}</span>
        {localDoc.file_size > 0 && (
          <span style={styles.size}>{formatSize(localDoc.file_size)}</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    position: 'relative', background: '#fff', borderRadius: 10,
    padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e8e8e8', cursor: 'pointer',
    transition: 'box-shadow 0.15s', display: 'flex',
    flexDirection: 'column', gap: 8, overflow: 'visible',
  },
  cardRead: { opacity: 0.72 },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: '50%', background: '#0a66c2',
  },
  menuWrap: { position: 'absolute', top: 10, right: 10, zIndex: 10 },
  menuBtn: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0',
    background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: '1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#555', fontWeight: 700,
  },
  dropdown: {
    position: 'absolute', top: 32, right: 0, background: '#fff',
    border: '1px solid #e8e8e8', borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180,
    overflow: 'hidden', zIndex: 100,
  },
  dropItem: {
    display: 'block', width: '100%', padding: '10px 14px',
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 13, textAlign: 'left', color: '#1a1a2e',
    transition: 'background 0.1s',
  },
  header: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingRight: 24 },
  typeBadge: {
    fontSize: 10, fontWeight: 700, color: '#fff',
    borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em',
  },
  domainPill: {
    fontSize: 11, fontWeight: 600, borderRadius: 12, padding: '3px 8px',
    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  levelPill: {
    fontSize: 10, fontWeight: 600, borderRadius: 10,
    padding: '2px 7px', border: '1px solid',
  },
  title: {
    fontSize: 14, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden', margin: 0,
  },
  author: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  summary: {
    fontSize: 12, color: '#555', lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
    overflow: 'hidden', margin: 0,
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tag: {
    fontSize: 10, background: '#f0f0f0', color: '#444',
    borderRadius: 4, padding: '2px 6px', fontWeight: 500,
  },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  date: { fontSize: 11, color: '#999' },
  size: { fontSize: 11, color: '#bbb' },
};
