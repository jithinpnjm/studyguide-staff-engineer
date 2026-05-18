---
title: "Intermediate"
sidebar_position: 2
---

# Platform Engineering — Intermediate

## Platform Team Topologies

The **Team Topologies** model (Skelton & Pais) provides the most widely used framework for thinking about platform team structure.

### The Four Team Types

| Type | Role | Example |
|---|---|---|
| Stream-aligned | Delivers user-facing features aligned to a business domain | Payments team, Search team |
| Platform | Provides self-service infrastructure and tooling to other teams | Platform/Infrastructure team |
| Complicated subsystem | Owns highly specialized technical capability | ML infra team, Security team |
| Enabling | Temporary coaching — helps stream teams adopt new practices | Cloud migration enablement team |

A platform team's primary goal is to reduce the **cognitive load** of stream-aligned teams by providing self-service capabilities they can consume without understanding the underlying complexity.

### Interaction Modes

| Mode | When to Use | Example |
|---|---|---|
| X-as-a-Service | Platform provides a stable API; stream teams consume | Backstage scaffolder, Terraform modules |
| Collaboration | Two teams work closely together (temporary) | Platform + payments team designing a new golden path |
| Facilitating | Platform coaches a stream team to become self-sufficient | Teaching a team to write their own Helm charts |

Platform teams should default to X-as-a-Service. Heavy collaboration is expensive and doesn't scale.

### Platform Team Sizing

A useful heuristic: one platform engineer for every 10-15 product engineers. Too small and the platform becomes a bottleneck. Too large and the platform overbuilds and loses touch with developer needs.

The platform team must include product management and developer advocacy, not just engineers. Without this, platforms get built for platform engineers, not developers.

---

## Self-Service Infrastructure

Self-service means developers can provision what they need without raising a ticket. The implementation layers:

### Backstage Scaffolder Templates

The scaffolder is the primary self-service entry point for day-0 tasks (new service, new project):

```yaml
steps:
  - id: fetch-base
    name: Fetch Base Template
    action: fetch:template
    input:
      url: ./skeleton
      values:
        name: ${{ parameters.name }}
        owner: ${{ parameters.owner }}
        database: ${{ parameters.database }}

  - id: create-namespace
    name: Create Kubernetes Namespace
    action: kubernetes:create-namespace
    input:
      name: ${{ parameters.name }}
      cluster: production

  - id: publish
    name: Publish to GitHub
    action: publish:github
    input:
      repoUrl: github.com?repo=${{ parameters.name }}&owner=myorg
      defaultBranch: main

  - id: trigger-tf
    name: Provision Infrastructure
    action: http:backstage:request
    input:
      method: POST
      path: /api/proxy/terraform/workspaces
      body:
        workspace: ${{ parameters.name }}
        module: base-service

  - id: register
    name: Register in Catalog
    action: catalog:register
    input:
      repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
      catalogInfoPath: /catalog-info.yaml
```

### Terraform Module Registry

For day-1 infrastructure (adding a database, a queue, a cache), expose curated Terraform modules:

```hcl
# Developers call the golden-path module — they don't write raw Terraform
module "service_database" {
  source  = "git::https://github.com/myorg/terraform-modules//rds-postgres?ref=v2.3.0"

  service_name = "payment-service"
  environment  = "production"
  # Defaults: Multi-AZ=true, encryption=true, backup_retention=7d, deletion_protection=true
  # Teams override only what they legitimately need different
}
```

Versioned module registry ensures all services benefit from security patches without per-service Terraform work.

---

## Backstage Software Catalog Deep Dive

### Entity Types

| Kind | What It Represents | Example |
|---|---|---|
| `Component` | A deployable unit (service, library, website) | `payment-service` |
| `API` | An interface exposed by a component | `payment-api` (OpenAPI spec) |
| `Resource` | Infrastructure a component depends on | `payments-db` (RDS) |
| `System` | A collection of components that serve a purpose | `checkout` system |
| `Domain` | A business area grouping systems | `commerce` domain |
| `Group` | A team or organizational unit | `payments-team` |
| `User` | An individual | `alice@myorg.com` |

Well-maintained catalogs expose dependency graphs: you can see which teams consume which APIs, which databases back which services, and who to page for any given component.

### Catalog Annotations

Annotations connect catalog entries to external systems:

```yaml
metadata:
  annotations:
    # Source control
    github.com/project-slug: myorg/payment-service

    # CI/CD
    github.com/actions-workflow: deploy.yml

    # Observability
    grafana/dashboard-url: https://grafana.myorg.com/d/payment-service
    prometheus.io/rule: payment_errors_total

    # Alerting
    pagerduty.com/integration-key: abc123
    opsgenie.com/component-selector: payment-service

    # Documentation
    backstage.io/techdocs-ref: dir:.

    # Cost
    backstage.io/cost-insights-product: payment-service
```

This creates a single pane of glass: from the Backstage catalog page for `payment-service`, engineers can navigate directly to the Grafana dashboard, recent CI runs, PagerDuty incidents, and runbooks.

---

## API Gateway Patterns

API gateways are a critical platform-level concern — they centralize cross-cutting concerns that would otherwise be duplicated in every service.

### What an API Gateway Provides

- **Authentication/Authorization** — validate JWTs, call an auth service
- **Rate limiting** — protect backend services from abuse
- **TLS termination** — centralized certificate management
- **Request routing** — path-based or header-based routing to services
- **Load balancing** — distribute requests across service replicas
- **Observability** — centralized access logs, latency metrics per route

### Kubernetes Ingress as Gateway

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://auth.internal/validate"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-ID,X-User-Email"
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts: [api.example.com]
      secretName: api-tls-cert
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /payments
            pathType: Prefix
            backend:
              service:
                name: payment-service
                port:
                  number: 8080
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 8080
```

### Service Mesh as Internal Gateway (Istio)

For east-west traffic (service-to-service), a service mesh provides gateway-level controls without an actual gateway:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: payment-service
spec:
  hosts:
    - payment-service
  http:
    - retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
      timeout: 10s
      route:
        - destination:
            host: payment-service
            port:
              number: 8080
```

Circuit breaking and outlier detection as platform defaults:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: payment-circuit-breaker
spec:
  host: payment-service
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 60s
      maxEjectionPercent: 50
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
```

---

## Platform Metrics: DORA and SPACE

### DORA Metrics (DevOps Research and Assessment)

The four DORA metrics measure software delivery performance. Platform teams are responsible for improving these org-wide:

| Metric | What It Measures | Elite | High | Medium | Low |
|---|---|---|---|---|---|
| Deployment frequency | How often code reaches production | Multiple/day | Weekly | Monthly | < Monthly |
| Lead time for changes | Commit to production time | < 1 hour | 1 day | 1 week | > 1 month |
| Change failure rate | % of deploys causing incidents | < 5% | < 10% | < 15% | > 15% |
| MTTR | Time to restore after incident | < 1 hour | < 1 day | < 1 week | > 1 week |

Collecting DORA metrics requires:

```python
# Emit deployment events as Prometheus metrics
from prometheus_client import Counter, Histogram
import time

deploy_counter = Counter(
    'deployments_total',
    'Total production deployments',
    ['service', 'team', 'status']  # status: success | failure
)

lead_time_histogram = Histogram(
    'deployment_lead_time_seconds',
    'Time from commit to production deploy',
    ['service', 'team'],
    buckets=[300, 900, 1800, 3600, 7200, 86400]  # 5m, 15m, 30m, 1h, 2h, 1d
)

# Emit on deployment completion
deploy_counter.labels(service='payment', team='payments', status='success').inc()
lead_time_histogram.labels(service='payment', team='payments').observe(
    time.time() - commit_timestamp
)
```

### SPACE Framework

SPACE (Satisfaction, Performance, Activity, Communication, Efficiency) is a broader developer productivity framework:

| Dimension | What to Measure | Platform Influence |
|---|---|---|
| Satisfaction | Developer NPS, survey scores | Better DX = higher satisfaction |
| Performance | Code quality, reliability of what ships | Golden paths with built-in quality gates |
| Activity | PRs merged, builds triggered | Remove blockers to activity |
| Communication | Code review latency, knowledge sharing | Catalog and TechDocs reduce interruptions |
| Efficiency | Flow state time, context switching | Reduce tickets and manual steps |

---

## GitOps at Scale with ArgoCD ApplicationSets

For large organizations running many clusters, ArgoCD ApplicationSets automate application deployment across the fleet:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: platform-services
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          - clusters: {}       # all registered clusters
          - list:
              elements:
                - app: nginx-ingress
                - app: cert-manager
                - app: external-secrets
                - app: kube-prometheus-stack
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
        syncOptions:
          - CreateNamespace=true
```

This deploys `nginx-ingress`, `cert-manager`, `external-secrets`, and the observability stack to every cluster automatically. Adding a new cluster to the fleet means adding it to ArgoCD — everything else is handled.

---

## Platform SLOs

Platform teams must define SLOs for the platform itself. If the platform is unreliable, every team that depends on it is affected.

```yaml
# Example platform SLOs
groups:
  - name: platform.slos
    rules:
      - alert: ArgoCDSyncFailureHigh
        expr: |
          (
            sum(rate(argocd_app_sync_total{phase="Failed"}[1h]))
            /
            sum(rate(argocd_app_sync_total[1h]))
          ) > 0.005
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "ArgoCD sync failure rate > 0.5% — breaching SLO"
          runbook: "https://wiki/runbooks/argocd-sync-failure"
```

| Platform SLO | Target |
|---|---|
| ArgoCD sync success rate | > 99.5% |
| Secret sync latency (ESO p99) | < 30 seconds |
| Backstage catalog API availability | > 99.9% |
| Scaffolder template success rate | > 98% |
| Cluster API availability | > 99.95% |
| Build pipeline availability | > 99.5% |

---

## Summary

Intermediate platform engineering requires:

1. Applying Team Topologies to structure how the platform team interacts with product teams
2. Building self-service via Backstage scaffolder and Terraform module registries
3. Maintaining a rich software catalog with consistent annotations
4. Deploying API gateway and service mesh patterns as platform defaults
5. Measuring success with DORA metrics collected systematically
6. Running the platform to an SLO — the platform is a product, not infrastructure
