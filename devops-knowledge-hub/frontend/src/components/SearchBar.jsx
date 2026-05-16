import React, { useState, useCallback } from 'react';

export default function SearchBar({ value, onChange, sort, onSortChange }) {
  const [draft, setDraft] = useState(value);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onChange(draft);
    if (e.key === 'Escape') { setDraft(''); onChange(''); }
  };

  const handleClear = () => { setDraft(''); onChange(''); };

  return (
    <div style={styles.row}>
      <div style={styles.inputWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.input}
          placeholder="Search documents… (press Enter)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {draft && (
          <button style={styles.clearBtn} onClick={handleClear} title="Clear">
            ×
          </button>
        )}
      </div>
      <select
        style={styles.select}
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="domain">By domain</option>
      </select>
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  inputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '0 12px',
    gap: 8,
  },
  searchIcon: { fontSize: 14, color: '#888' },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    padding: '10px 0',
    background: 'transparent',
    color: '#1a1a2e',
  },
  clearBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#888',
    lineHeight: 1,
    padding: '0 2px',
  },
  select: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    background: '#fff',
    color: '#444',
    cursor: 'pointer',
    outline: 'none',
  },
};
