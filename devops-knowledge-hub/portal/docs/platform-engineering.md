---
title: "🛠️ Platform Engineering"
sidebar_position: 11
description: "Zero to hero study guide for Platform Engineering — concepts, tools, architecture, production operations, and interview prep."
---

## What Is Platform Engineering?

Platform engineering builds **Internal Developer Platforms (IDPs)** — the paved roads that product teams walk to ship software without becoming infrastructure experts. The goal: reduce cognitive load, eliminate toil, and enforce golden paths for security, reliability, and compliance.

**Core loop**: developers self-serve → platform team builds capabilities → feedback improves the platform.

---

## Microservice Design Patterns

Microservices decompose applications into small, independently deployable services. Designing and implementing microservices requires specific patterns to handle the complexity of distributed systems. The following patterns come directly from SRE and platform engineering practice.

### Gateway Pattern

Use an API Gateway to handle client requests and route them to the appropriate microservices. This centralizes authentication, load balancing, and routing logic.

```yaml
# Example: nginx ingress as API gateway
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/auth-url: "https://auth.internal/validate"
spec:
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

**What the Gateway Pattern provides:**
- Centralized authentication and authorization
- Load balancing across service replicas
- Rate limiting and throttling
- TLS termination
- Request routing and path rewriting

### Service Registry Pattern

Implement a service registry to automatically locate and register microservices. This helps in dynamic discovery and communication between services.

In Kubernetes, the service registry is built-in via kube-dns and `Service` objects:

```yaml
# Kubernetes Service — acts as the service registry entry
apiVersion: v1
kind: Service
metadata:
  name: payment-service
  namespace: production
spec:
  selector:
    app: payment
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

Services discover each other by DNS name: `payment-service.production.svc.cluster.local`

For external service registries: **Consul** provides health checking + dynamic registration + multi-datacenter support.

### Circuit Breaker Pattern

Prevent cascading failures by using a circuit breaker that can temporarily stop requests to a failing service and provide fallback mechanisms.

**Three states:**
- **Closed** — requests flow normally; failures are counted
- **Open** — requests are blocked immediately; fallback is returned
- **Half-Open** — a probe request is sent; if it succeeds, circuit closes; if it fails, circuit stays open

```python
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"

    def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "HALF_OPEN"
            else:
                raise Exception("Circuit breaker OPEN — request blocked")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
```

In Kubernetes service meshes (Istio, Linkerd), circuit breaking is configured declaratively:

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
```

### Saga Pattern

Manage long-lived transactions across multiple microservices by breaking them down into a sequence of smaller, local transactions. Each step has a compensating transaction to undo it if a later step fails.

**Two implementations:**
- **Choreography** — each service publishes events and listens for events from other services
- **Orchestration** — a central coordinator (saga orchestrator) tells each service what to do

```
Order Service → publishes OrderCreated
  Payment Service → charges card → publishes PaymentProcessed
    Inventory Service → reserves stock → publishes StockReserved
      Fulfillment Service → ships order → publishes OrderFulfilled

# On failure at any step, compensating transactions run in reverse:
Fulfillment fails → Inventory releases stock → Payment issues refund → Order marked failed
```

### CQRS Pattern (Command Query Responsibility Segregation)

Separate the read and write responsibilities of a system, allowing for optimized performance and scalability.

- **Command side** — handles writes; updates the database; publishes events to Kafka
- **Query side** — builds read-optimized projections from events; serves queries from a read store

```
Client writes → Command Service → Database + Kafka event
Kafka event → Projection Builder → Read Store (Elasticsearch, Redis, etc.)
Client reads → Query Service → Read Store
```

This allows you to scale reads and writes independently and optimize each side for its workload.

### Bulkhead Pattern

Isolate failures within separate sections to prevent them from affecting the entire system. Named after the watertight compartments in a ship's hull.

**In practice:**
- Separate thread pools per downstream service (so a slow payment API doesn't block auth API calls)
- Separate connection pools per database (so a slow reporting query doesn't starve OLTP queries)
- Separate Kubernetes namespaces with resource quotas (so one team's runaway pod doesn't starve others)

```yaml
# Kubernetes ResourceQuota — bulkhead at namespace level
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-payments-quota
  namespace: team-payments
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "50"
```

### Sidecar Pattern

Attach a separate microservice (sidecar container) to handle specific tasks like monitoring, logging, or authentication. The sidecar runs alongside the main container in the same pod, sharing the same network and storage.

**Common sidecar use cases:**
- **Service mesh proxy** (Envoy/Istio) — handles mTLS, circuit breaking, retries, observability
- **Log shipping** (Fluent Bit) — collects and forwards container logs
- **Secret injection** (Vault agent) — fetches secrets and writes them to a shared volume
- **Metrics collection** (OpenTelemetry collector) — aggregates traces and metrics

```yaml
# Example: Vault agent sidecar for secret injection
spec:
  containers:
  - name: payment-service
    image: payment:latest
    volumeMounts:
    - name: secrets
      mountPath: /vault/secrets
  - name: vault-agent
    image: hashicorp/vault:latest
    args: ["agent", "-config=/vault/config/agent.hcl"]
    volumeMounts:
    - name: secrets
      mountPath: /vault/secrets
    - name: vault-config
      mountPath: /vault/config
```

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

Open-source CNCF project from Spotify. Each service registers itself via a `catalog-info.yaml`:

```yaml
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

**Backstage plugins to know:**
- `catalog` — service registry, dependency graph
- `scaffolder` — golden-path templates (creates repo + CI + k8s manifests)
- `techdocs` — docs-as-code rendered from markdown
- `kubernetes` — live pod status inline with service card
- `cost-insights` — AWS/GCP spend per team

### Software Templates (Scaffolder)

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

- **Stream-aligned teams** — product teams shipping features
- **Platform team** — provides self-service capabilities (enabling team)
- **Complicated subsystem teams** — specialized (e.g., ML infra, security)
- **Enabling teams** — temporary help to level-up stream teams

Platform teams measure success by **developer experience (DX)** metrics:
- Time to deploy a new service from scratch (target: < 1 day)
- DORA metrics across the org
- Onboarding time to first PR in production

### Golden Paths vs Guardrails

- **Golden path** — opinionated, pre-built, self-service route that just works
- **Guardrail** — policy that prevents deviation from safe practices (OPA, Kyverno)

Don't use guardrails to block; use them to guide. Make the right thing the easy thing.

---

## GitOps at Scale

### ArgoCD with ApplicationSets

```yaml
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

---

## Secret Management

### External Secrets Operator (ESO)

Syncs secrets from Vault/AWS SSM/GCP Secret Manager into Kubernetes secrets:

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
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: secret/data/myapp/db
        property: password
```

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

### Kyverno

Kubernetes-native; no Rego needed:

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

---

## Developer Self-Service Flow

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

## Developer Experience Metrics (DORA)

| Metric | Definition | Elite Target |
|---|---|---|
| Deployment frequency | How often deploys to prod | Multiple per day |
| Lead time for changes | Commit → production | < 1 hour |
| Change failure rate | % deploys causing incident | < 5% |
| MTTR | Time to restore service | < 1 hour |

```python
# Emit deployment event as Prometheus metric
from prometheus_client import Counter
deploy_counter = Counter(
    'deployments_total',
    'Total production deployments',
    ['service', 'team', 'status']
)
deploy_counter.labels(service='payment', team='payments', status='success').inc()
```

---

## Namespace-per-Team with Network Isolation

```yaml
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

## Interview Prep

**"What is an Internal Developer Platform?"**
A self-service layer that abstracts infrastructure complexity from product teams — providing provisioning, secrets, delivery, observability, and policy through a unified interface (e.g., Backstage). The platform team is a product team whose customer is internal developers.

**"What is the Gateway Pattern?"**
An API Gateway handles client requests and routes them to appropriate microservices. It centralizes authentication, load balancing, rate limiting, and routing logic — keeping these cross-cutting concerns out of individual services.

**"What is the Circuit Breaker Pattern?"**
A stability pattern that prevents cascading failures. When a downstream service fails repeatedly, the circuit "opens" and requests are blocked immediately with a fallback, giving the failing service time to recover. After a timeout, it enters half-open state to probe recovery.

**"What is the Saga Pattern?"**
A pattern for managing distributed transactions across multiple microservices. Each step in a saga has a compensating transaction to undo it on failure. Implemented via choreography (event-driven) or orchestration (central coordinator).

**"What is the Sidecar Pattern?"**
Attaching a separate container to a pod to handle cross-cutting concerns like logging, metrics collection, secret injection, or service mesh proxying — without changing the main application.

**"How do you prevent teams from diverging to unsupported patterns?"**
Golden paths make the recommended approach the easiest one. Policy-as-code (Kyverno/Gatekeeper) enforces non-negotiables (security, resource limits). Anything off golden-path requires manual approval, creating natural friction without blocking.

**"How do you measure platform success?"**
DORA metrics across the org (improve over time), developer NPS surveys, time-to-first-deploy for new services, support ticket volume trending down, platform SLO dashboards.

**"How do you handle multi-tenancy in Kubernetes?"**
Namespace-per-team + RBAC + NetworkPolicies + ResourceQuotas + LimitRanges + admission policies (Kyverno/Gatekeeper). For hard isolation (compliance), use separate clusters or virtual clusters (vCluster).

**"What's the difference between Flux and ArgoCD?"**
ArgoCD has a richer UI and is easier to onboard; Flux is more GitOps-pure and composable. Both support multi-tenancy and multi-cluster. ArgoCD's ApplicationSets are powerful for fleet management.

---
