import React from 'react';
import { useNavigate } from 'react-router-dom';

const DOMAINS = [
  { key: '', label: 'All Documents' },
  { key: 'uncategorized', label: 'Uncategorized' },
  { key: 'kubernetes-containers', label: 'Kubernetes & Containers' },
  { key: 'cicd-gitops', label: 'CI/CD & GitOps' },
  { key: 'observability', label: 'Observability' },
  { key: 'cloud-platforms', label: 'Cloud Platforms' },
  { key: 'infrastructure-as-code', label: 'Infrastructure as Code' },
  { key: 'security-devsecops', label: 'Security & DevSecOps' },
  { key: 'networking-service-mesh', label: 'Networking & Service Mesh' },
  { key: 'sre-practices', label: 'SRE Practices' },
  { key: 'linux-systems', label: 'Linux & Systems' },
  { key: 'databases-storage', label: 'Databases & Storage' },
  { key: 'platform-engineering', label: 'Platform Engineering' },
  { key: 'ai-mlops', label: 'AI / MLOps' },
  { key: 'agentic-genai', label: 'Agentic & GenAI' },
  { key: 'llmops', label: 'LLMOps' },
  { key: 'scripting-python', label: 'Python Scripting' },
  { key: 'scripting-bash-shell', label: 'Bash & Shell' },
  { key: 'scripting-go', label: 'Go for DevOps' },
  { key: 'automation-tooling', label: 'Automation & Tooling' },
  { key: 'general-devops', label: 'General DevOps' },
];

export const DOMAIN_COLORS = {
  'kubernetes-containers':   '#326ce5',
  'cicd-gitops':             '#f05032',
  'observability':           '#e6522c',
  'cloud-platforms':         '#ff9900',
  'infrastructure-as-code':  '#7b42bc',
  'security-devsecops':      '#d00000',
  'networking-service-mesh': '#00adef',
  'sre-practices':           '#00897b',
  'linux-systems':           '#333333',
  'databases-storage':       '#2e7d32',
  'platform-engineering':    '#1565c0',
  'ai-mlops':                '#7c3aed',
  'agentic-genai':           '#6d28d9',
  'llmops':                  '#5b21b6',
  'scripting-python':        '#1d4ed8',
  'scripting-bash-shell':    '#065f46',
  'scripting-go':            '#0284c7',
  'automation-tooling':      '#92400e',
  'general-devops':          '#546e7a',
  'uncategorized':           '#9e9e9e',
};

export default function Sidebar({ domain, onDomainChange, domainCounts = {} }) {
  const navigate = useNavigate();

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <span style={styles.brandIcon}>📚</span>
        <div>
          <div style={styles.brandName}>DevOps Hub</div>
          <div style={styles.brandSub}>Knowledge Repository</div>
        </div>
      </div>

      <nav style={styles.nav}>
        <div style={styles.navLabel}>Library</div>
        {DOMAINS.map((d) => {
          const count = d.key === '' ? domainCounts._total : domainCounts[d.key];
          const active = domain === d.key;
          return (
            <button
              key={d.key}
              style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
              onClick={() => onDomainChange(d.key)}
            >
              {d.key && (
                <span style={{ ...styles.dot, background: DOMAIN_COLORS[d.key] || '#888' }} />
              )}
              <span style={styles.navItemLabel}>{d.label}</span>
              {count != null && count > 0 && (
                <span style={styles.badge}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <button style={styles.footerBtn} onClick={() => navigate('/admin')}>
          ⚙ Admin
        </button>
        <button style={{ ...styles.footerBtn, marginTop: 6 }} onClick={() => navigate('/settings')}>
          Settings
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 240, minWidth: 240, background: '#fff',
    borderRight: '1px solid #e8e8e8', display: 'flex',
    flexDirection: 'column', height: '100vh',
    position: 'sticky', top: 0, overflowY: 'auto',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 16px 16px', borderBottom: '1px solid #f0f0f0',
  },
  brandIcon: { fontSize: 24 },
  brandName: { fontSize: 14, fontWeight: 700, color: '#0a66c2' },
  brandSub: { fontSize: 11, color: '#888' },
  nav: { flex: 1, padding: '12px 8px', overflowY: 'auto' },
  navLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#999', padding: '4px 8px 8px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '6px 8px', borderRadius: 6, border: 'none',
    background: 'none', cursor: 'pointer', fontSize: 12,
    color: '#444', textAlign: 'left', transition: 'background 0.1s',
  },
  navItemActive: { background: '#e8f0fe', color: '#0a66c2', fontWeight: 600 },
  navItemLabel: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  badge: {
    fontSize: 10, background: '#f0f0f0', color: '#555',
    borderRadius: 10, padding: '1px 6px', fontWeight: 600,
  },
  footer: { padding: '12px 16px', borderTop: '1px solid #f0f0f0' },
  footerBtn: {
    width: '100%', padding: '8px', border: '1px solid #e0e0e0',
    borderRadius: 6, background: 'none', cursor: 'pointer',
    fontSize: 13, color: '#555', display: 'block',
  },
};
