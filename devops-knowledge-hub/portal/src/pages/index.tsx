import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import AIChatWidget from '@site/src/components/AIChatWidget';

const API = 'http://localhost:8765';

const DOMAIN_LABELS: Record<string, string> = {
  'kubernetes-containers': 'Kubernetes & Containers',
  'cicd-gitops': 'CI/CD & GitOps',
  'observability': 'Observability',
  'cloud-platforms': 'Cloud Platforms',
  'infrastructure-as-code': 'Infrastructure as Code',
  'security-devsecops': 'Security & DevSecOps',
  'networking-service-mesh': 'Networking & Service Mesh',
  'sre-practices': 'SRE Practices',
  'linux-systems': 'Linux & Systems',
  'databases-storage': 'Databases & Storage',
  'platform-engineering': 'Platform Engineering',
  'ai-mlops': 'AI & MLOps',
  'agentic-genai': 'Agentic & GenAI',
  'llmops': 'LLMOps',
  'scripting-python': 'Scripting: Python',
  'scripting-bash-shell': 'Scripting: Bash/Shell',
  'scripting-go': 'Scripting: Go',
  'automation-tooling': 'Automation & Tooling',
  'general-devops': 'General DevOps',
};

const DOMAIN_COLORS: Record<string, string> = {
  'kubernetes-containers': '#326ce5',
  'cicd-gitops': '#f97316',
  'observability': '#8b5cf6',
  'cloud-platforms': '#0ea5e9',
  'infrastructure-as-code': '#10b981',
  'security-devsecops': '#ef4444',
  'networking-service-mesh': '#06b6d4',
  'sre-practices': '#f59e0b',
  'linux-systems': '#64748b',
  'databases-storage': '#6366f1',
  'platform-engineering': '#ec4899',
  'ai-mlops': '#14b8a6',
  'agentic-genai': '#a855f7',
  'llmops': '#7c3aed',
  'scripting-python': '#3b82f6',
  'scripting-bash-shell': '#22c55e',
  'scripting-go': '#00add8',
  'automation-tooling': '#84cc16',
  'general-devops': '#6b7280',
};

interface Stats {
  total_documents: number;
  domains: Record<string, number>;
  study_guides_generated: number;
  with_concept_cards: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  const domains = stats?.domains
    ? Object.entries(stats.domains)
        .filter(([d]) => d !== 'uncategorized')
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Layout title="DevOps Knowledge Hub" description="Your personal SRE & DevOps study portal">
      <main style={{padding: '2rem 0', maxWidth: 1100, margin: '0 auto'}}>
        <div style={{padding: '0 1.5rem'}}>
          <h1 style={{fontSize: '2rem', marginBottom: 4}}>DevOps Knowledge Hub</h1>
          <p style={{opacity: 0.6, marginBottom: '2rem'}}>
            Your personal SRE &amp; DevOps study portal — all local, AI-powered.
          </p>

          {error && (
            <div style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
              Backend not reachable at localhost:8765. Start it with{' '}
              <code>cd backend &amp;&amp; python main.py</code>
            </div>
          )}

          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.total_documents}</div>
                <div className="stat-label">Documents</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{domains.length}</div>
                <div className="stat-label">Domains</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.study_guides_generated ?? 0}</div>
                <div className="stat-label">Study Guides</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.with_concept_cards ?? 0}</div>
                <div className="stat-label">Concept Cards</div>
              </div>
            </div>
          )}

          <div style={{display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', flexWrap: 'wrap'}}>
            <Link className="button button--primary" to="/docs/intro">
              Browse Knowledge Base
            </Link>
            <Link className="button button--secondary" to="/discover">
              Discover Topics
            </Link>
            <a className="button button--secondary" href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
              Admin UI
            </a>
          </div>

          <h2 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>Knowledge Domains</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem'}}>
            {domains.map(([domain, count]) => (
              <Link
                key={domain}
                to="/docs/intro"
                style={{
                  display: 'block',
                  padding: '0.9rem 1.1rem',
                  background: 'var(--ifm-background-surface-color, #1e293b)',
                  border: `1px solid ${DOMAIN_COLORS[domain] || '#3b82f6'}33`,
                  borderLeft: `3px solid ${DOMAIN_COLORS[domain] || '#3b82f6'}`,
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${DOMAIN_COLORS[domain] || '#3b82f6'}22`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{fontWeight: 600, fontSize: '0.9rem', marginBottom: 4}}>
                  {DOMAIN_LABELS[domain] || domain}
                </div>
                <div style={{fontSize: '0.8rem', opacity: 0.55}}>
                  {count} {count === 1 ? 'document' : 'documents'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <AIChatWidget />
    </Layout>
  );
}
