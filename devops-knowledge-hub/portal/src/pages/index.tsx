import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const DOMAINS = [
  { key: 'kubernetes-containers',  label: 'Kubernetes & Containers',    color: '#326ce5', doc: 'kubernetes-containers/beginner' },
  { key: 'cicd-gitops',            label: 'CI/CD & GitOps',             color: '#f97316', doc: 'cicd-gitops/beginner' },
  { key: 'cloud-platforms',        label: 'Cloud Platforms',            color: '#0ea5e9', doc: 'cloud-platforms/beginner' },
  { key: 'infrastructure-as-code', label: 'Infrastructure as Code',     color: '#10b981', doc: 'infrastructure-as-code/beginner' },
  { key: 'linux-systems',          label: 'Linux & Systems',            color: '#64748b', doc: 'linux-systems/beginner' },
  { key: 'networking-service-mesh',label: 'Networking & Service Mesh',  color: '#06b6d4', doc: 'networking-service-mesh/beginner' },
  { key: 'observability',          label: 'Observability',              color: '#8b5cf6', doc: 'observability/beginner' },
  { key: 'security-devsecops',     label: 'Security & DevSecOps',       color: '#ef4444', doc: 'security-devsecops/beginner' },
  { key: 'databases-storage',      label: 'Databases & Storage',        color: '#6366f1', doc: 'databases-storage/beginner' },
  { key: 'platform-engineering',   label: 'Platform Engineering',       color: '#ec4899', doc: 'platform-engineering/beginner' },
  { key: 'general-devops',         label: 'General DevOps',             color: '#6b7280', doc: 'general-devops/beginner' },
  { key: 'scripting-python',       label: 'Python for DevOps',          color: '#3b82f6', doc: 'scripting-python/beginner' },
  { key: 'scripting-bash-shell',   label: 'Bash & Shell Scripting',     color: '#22c55e', doc: 'scripting-bash-shell/beginner' },
  { key: 'aws-deep-dive',          label: 'AWS Deep Dive',              color: '#f59e0b', doc: 'aws-deep-dive/beginner' },
  { key: 'aiops',                  label: 'AIOps',                      color: '#14b8a6', doc: 'aiops/beginner' },
  { key: 'mlops',                  label: 'MLOps',                      color: '#f43f5e', doc: 'mlops/beginner' },
  { key: 'interview-prep',         label: 'SRE Interview Prep',         color: '#a855f7', doc: 'interview-prep' },
];

export default function Home() {
  return (
    <Layout title="DevOps Knowledge Hub" description="SRE & DevOps study portal">
      <main style={{ padding: '2rem 0', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: '0 1.5rem' }}>

          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>DevOps Knowledge Hub</h1>
          <p style={{ opacity: 0.6, marginBottom: '2rem' }}>
            Zero-to-hero study guides, SRE deep dives, hands-on labs, and interview prep — all in one place.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            <Link className="button button--primary" to="/docs/intro">
              Browse Knowledge Base
            </Link>
            <Link className="button button--secondary" to="/docs/interview-prep">
              Interview Prep
            </Link>
            <Link className="button button--secondary" to="/docs/aws-deep-dive/beginner">
              AWS Deep Dive
            </Link>
          </div>

          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Knowledge Domains</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0.75rem',
          }}>
            {DOMAINS.map(({ key, label, color, doc }) => (
              <Link
                key={key}
                to={`/docs/${doc}`}
                style={{
                  display: 'block',
                  padding: '0.9rem 1.1rem',
                  background: 'var(--ifm-background-surface-color, #1e293b)',
                  border: `1px solid ${color}33`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}22`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
