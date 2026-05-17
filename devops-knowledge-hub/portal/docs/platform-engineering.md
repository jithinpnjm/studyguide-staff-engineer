---
title: "🛠️ Platform Engineering"
sidebar_position: 11
description: "Zero to hero study guide for Platform Engineering — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## What Is Platform Engineering?

Platform engineering builds **Internal Developer Platforms (IDPs)** — the paved roads that product teams walk to ship software without becoming infrastructure experts. The goal: reduce cognitive load, eliminate toil, and enforce golden paths for security, reliability, and compliance.

**Core loop**: developers self-serve → platform team builds capabilities → feedback improves the platform.

---

## Internal Developer Platform (IDP) Fundamentals

### What an IDP Provides
| Capability | Example Tools |
|---|---|
| Service catalog | Backstage, Port, Cortex |
| Self-service provisioning | Backstage scaffolder, Terraform modules |
| GitOps delivery | ArgoCD, Flux |
| Secret management | Vault, External Secrets Operator |
| Observability stack | Prometheus, Grafana, Loki, Tempo |
| Policy enforcement | OPA/Gatekeeper, Kyverno |
| Cost visibility | OpenCost, Kubecost |

### Backstage
Open-source CNCF project from Spotify.

```yaml
# catalog-info.yaml — every service registers itself
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  annotations:
    github.com/project-slug: myorg/payment-service
    prometheus.io/rule: payment_errors_total
spec:
  type: service
  lifecycle: production
  owner: payments-team
  system: checkout
  dependsOn:
    - resource:default/payments-db
```

**Backstage plugins to know**:
- `catalog` — service registry, dependency graph
- `scaffolder` — golden-path templates (creates repo + CI + k8s manifests)
- `techdocs` — docs-as-code rendered from markdown
- `kubernetes` — live pod status inline with service card
- `cost-insights` — AWS/GCP spend per team

### Software Templates (Scaffolder)
```yaml
# template.yaml snippet
steps:
  - id: fetch-base
    name: Fetch Base Template
    action: fetch:template
    input:
      url: ./skeleton
      values:
        name: ${{ parameters.name }}
        owner: ${{ parameters.owner }}

  - id: publish
    name: Publish to GitHub
    action: publish:github
    input:
      repoUrl: github.com?repo=${{ parameters.name }}&owner=myorg

  - id: register
    name: Register in Catalog
    action: catalog:register
    input:
      repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
      catalogInfoPath: /catalog-info.yaml
```

---

## Platform Team Topology

### Team Topologies Model
- **Stream-aligned teams**: product teams shipping features
- **Platform team**: provides self-service capabilities (enabling team)
- **Complicated subsystem teams**: specialized (e.g., ML infra, security)
- **Enabling teams**: temporary help to level-up stream teams

Platform teams measure success by **developer experience (DX)** metrics:
- Time to deploy a new service from scratch (target: < 1 day)
- DORA metrics across the org (deployment frequency, lead time, MTTR, change failure rate)
- Onboarding time to first PR in production

### Golden Paths vs Guardrails
- **Golden path**: opinionated, pre-built, self-service route that just works
- **Guardrail**: policy that prevents deviation from safe practices (OPA, Kyverno)

Don't use guardrails to block; use them to guide. Make the right thing the easy thing.

---

## GitOps at Scale

### ArgoCD at Scale
```yaml
# ApplicationSet — generates one ArgoCD app per cluster/env
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: platform-services
spec:
  generators:
    - matrix:
        generators:
          - clusters: {}
          - list:
              elements:
                - app: nginx-ingress
                - app: cert-manager
                - app: external-secrets
  template:
    metadata:
      name: "{{app}}-{{name}}"
    spec:
      project: platform
      source:
        repoURL: https://github.com/myorg/platform-gitops
        targetRevision: HEAD
        path: "apps/{{app}}/overlays/{{metadata.labels.env}}"
      destination:
        server: "{{server}}"
        namespace: "{{app}}"
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### Flux Multi-Tenancy
```yaml
# Tenant namespace isolation
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: tenant-a-apps
  namespace: flux-system
spec:
  serviceAccountName: tenant-a  # scoped RBAC
  sourceRef:
    kind: GitRepository
    name: tenant-a-repo
  path: ./apps
  prune: true
  interval: 5m
```

---

## Secret Management

### External Secrets Operator (ESO)
Syncs secrets from Vault/AWS SSM/GCP Secret Manager into Kubernetes secrets.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: db-credentials   # k8s Secret created
    creationPolicy: Owner
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: secret/data/myapp/db
        property: password
```

```yaml
# ClusterSecretStore pointing to Vault
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.internal:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
```

### HashiCorp Vault
**Auth methods**:
- `kubernetes` — pod SA token validated by Vault
- `aws` — EC2/ECS instance identity
- `approle` — for CI pipelines

```bash
# Vault agent sidecar injection
vault.hashicorp.com/agent-inject: "true"
vault.hashicorp.com/role: "myapp"
vault.hashicorp.com/agent-inject-secret-db: "secret/data/myapp/db"
vault.hashicorp.com/agent-inject-template-db: |
  {{- with secret "secret/data/myapp/db" -}}
  export DB_PASSWORD="{{ .Data.data.password }}"
  {{- end }}
```

**Secret rotation**: Vault dynamic secrets for databases — Vault creates a short-lived DB user per request, auto-revokes after TTL.

---

## Policy as Code

### OPA / Gatekeeper
```rego
# Require resource limits on all containers
package kubernetes.admission

deny[msg] {
  input.request.kind.kind == "Pod"
  container := input.request.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v must have memory limits", [container.name])
}
```

```yaml
# ConstraintTemplate — wraps the Rego policy
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: requireresourcelimits
spec:
  crd:
    spec:
      names:
        kind: RequireResourceLimits
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package requireresourcelimits
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits
          msg := sprintf("Container %v missing resource limits", [container.name])
        }
```

### Kyverno
Kubernetes-native; no Rego needed.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-labels
spec:
  validationFailureAction: enforce
  rules:
    - name: check-team-label
      match:
        any:
          - resources:
              kinds: [Deployment]
      validate:
        message: "Deployments must have label 'team'"
        pattern:
          metadata:
            labels:
              team: "?*"
```

**Kyverno vs Gatekeeper**:
- Kyverno: simpler YAML-based, easier for platform teams; less expressive
- Gatekeeper + OPA: Rego is powerful but has steeper learning curve

---

## Developer Self-Service

### Service Provisioning Flow
```
Developer triggers Backstage scaffolder
  → Creates GitHub repo with template code
  → Adds CI workflow (GitHub Actions)
  → Creates Terraform module call (VPC, DB if needed)
  → Registers ArgoCD Application for GitOps deploy
  → Registers in Backstage catalog
  → Adds PagerDuty service + Grafana dashboard
Developer has running service in staging in < 30 min
```

### Namespace-per-Team with Network Isolation
```yaml
# NetworkPolicy: isolate team namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-cross-namespace
  namespace: team-payments
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: team-payments
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
```

---

## Cost Management

### OpenCost / Kubecost
Tag every workload with team/environment labels — Kubecost breaks down spend per label.

```yaml
# Force cost labels via admission webhook (Kyverno)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-cost-labels
spec:
  rules:
    - name: add-team
      match:
        any:
          - resources:
              kinds: [Pod]
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              cost-center: "{{request.object.metadata.namespace}}"
```

**Key metrics**:
```promql
# CPU cost per namespace (Kubecost exposes these)
sum by (namespace) (
  container_cpu_usage_seconds_total * on(node) group_left()
  node_cpu_hourly_cost
)
```

---

## Platform SLOs

Platform teams own reliability of the platform itself:

| SLO | Target |
|---|---|
| ArgoCD sync success rate | > 99.5% |
| Secret sync latency (ESO) | < 30s p99 |
| Backstage catalog API availability | > 99.9% |
| Template scaffolding success rate | > 98% |
| Cluster API availability | > 99.95% |

```yaml
# Alerting on platform SLO breach
groups:
  - name: platform.slos
    rules:
      - alert: ArgoCDSyncFailureHigh
        expr: |
          (
            sum(rate(argocd_app_sync_total{phase="Failed"}[1h])) /
            sum(rate(argocd_app_sync_total[1h]))
          ) > 0.005
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "ArgoCD sync failure rate > 0.5%"
```

---

## Cluster Management at Scale

### Cluster API (CAPI)
Declarative Kubernetes cluster lifecycle management.

```yaml
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: staging-us-east-1
spec:
  clusterNetwork:
    pods:
      cidrBlocks: ["10.244.0.0/16"]
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta2
    kind: AWSCluster
    name: staging-us-east-1
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: staging-us-east-1-cp
```

### Multi-cluster Observability
- **Thanos** or **Cortex**: federate Prometheus across clusters
- **Grafana**: single pane with cluster variable
- **OpenTelemetry Collector** gateway per cluster → central storage

---

## Developer Experience Metrics (DORA)

| Metric | Definition | Elite Target |
|---|---|---|
| Deployment frequency | How often deploys to prod | Multiple per day |
| Lead time for changes | Commit → production | < 1 hour |
| Change failure rate | % deploys causing incident | < 5% |
| MTTR | Time to restore service | < 1 hour |

**Tracking**: use LinearB, Sleuth, or custom Prometheus metrics from your CI/CD system.

```python
# Example: emit deployment event as Prometheus metric
from prometheus_client import Counter
deploy_counter = Counter(
    'deployments_total',
    'Total production deployments',
    ['service', 'team', 'status']
)
deploy_counter.labels(service='payment', team='payments', status='success').inc()
```

---

## Incident Management Integration

Platform teams wire the platform to incident workflows:
- **PagerDuty / Opsgenie**: auto-create incident from AlertManager
- **Slack**: post deployment notifications, SLO burn rate alerts
- **Runbooks**: linked from Alertmanager annotations → Confluence/Notion

```yaml
# AlertManager receiver: Slack + PagerDuty
receivers:
  - name: platform-critical
    slack_configs:
      - channel: '#platform-incidents'
        title: "{{ .GroupLabels.alertname }}"
        text: "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
    pagerduty_configs:
      - service_key: <routing_key>
        description: "{{ .GroupLabels.alertname }}"
```

---

## Interview Prep

**"What is an Internal Developer Platform?"**
A self-service layer that abstracts infrastructure complexity from product teams — providing provisioning, secrets, delivery, observability, and policy through a unified interface (e.g., Backstage). The platform team is a product team whose customer is internal developers.

**"How do you prevent teams from diverging to unsupported patterns?"**
Golden paths make the recommended approach the easiest one. Policy-as-code (Kyverno/Gatekeeper) enforces non-negotiables (security, resource limits). Anything off golden-path requires manual approval, creating natural friction without blocking.

**"How do you measure platform success?"**
DORA metrics across the org (improve over time), developer NPS surveys, time-to-first-deploy for new services, support ticket volume trending down, platform SLO dashboards.

**"How do you handle multi-tenancy in Kubernetes?"**
Namespace-per-team + RBAC + NetworkPolicies + ResourceQuotas + LimitRanges + admission policies (Kyverno/Gatekeeper). For hard isolation (compliance), use separate clusters or virtual clusters (vCluster).

**"What's the difference between Flux and ArgoCD?"**
ArgoCD has a richer UI and is easier to onboard; Flux is more GitOps-pure and composable. Both support multi-tenancy and multi-cluster. ArgoCD's ApplicationSets are powerful for fleet management. At scale, both can work — pick based on team familiarity.



---

## 📁 Source Documents

> 4 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Kubernetes] 1742196202713](http://localhost:8765/api/documents/722d913d-639b-4e45-bd6d-e5f4c6f5361e/view) | PDF | intermediate |
| [[API] 1742028132688](http://localhost:8765/api/documents/d1050d21-56e7-42bb-bd22-e776e6f044ce/view) | PDF | intermediate |
| [[API] 1742962502873](http://localhost:8765/api/documents/5b800db6-b865-4f36-8b0c-f08af53776f4/view) | JPEG | intermediate |
| [[API] 1743785587532](http://localhost:8765/api/documents/9c7cdfd3-17ab-47f1-a524-164b7cb50885/view) | GIF | intermediate |


<AIChatWidget domain="platform-engineering" title="Ask AI about Platform Engineering" />
