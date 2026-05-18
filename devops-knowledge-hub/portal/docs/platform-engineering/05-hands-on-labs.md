---
title: "Hands-On Labs"
sidebar_position: 5
---

# Platform Engineering — Hands-On Labs

These labs are design and implementation exercises. Each lab has a scenario, objectives, and worked solution. Work through each lab before reading the solution.

---

## Lab 1: Design an IDP for a Hypothetical Organization

### Scenario

You are the first platform engineer at **RetailCo**, a mid-sized e-commerce company with:
- 120 engineers across 12 product teams
- 80 microservices running on Kubernetes (EKS), deployed inconsistently across teams
- No shared observability stack — each team runs its own Prometheus
- Secret management via hardcoded environment variables in Deployment YAML (in Git)
- New service onboarding takes 3-5 days and requires tickets to 4 different teams
- 3 major incidents in the last quarter caused by teams bypassing security practices

You have a team of 3 engineers and a 6-month mandate.

### Objectives

1. Define your Phase 1 IDP (what do you build in 6 months?)
2. Design the golden path for "create a new microservice"
3. Identify which platform capabilities are table stakes vs nice-to-have
4. Define 3 platform SLOs

### Worked Solution

**Phase 1 Priorities (6 months)**

Apply the thinnest viable platform principle. The immediate pain points are:
- Security: hardcoded secrets in Git (critical risk)
- Speed: 3-5 day onboarding (highest developer frustration)
- Reliability: no shared observability (incident response is slow)

Phase 1 scope:
```
Month 1-2: Secret remediation (highest risk)
  → Deploy External Secrets Operator
  → Migrate all teams to ESO + AWS Secrets Manager
  → Add Kyverno policy blocking new secrets in Git

Month 2-3: Shared observability
  → Deploy kube-prometheus-stack (Prometheus + Grafana + AlertManager)
  → Golden signal dashboards per namespace
  → PagerDuty integration for P1/P2

Month 3-5: Service catalog + scaffolder
  → Deploy Backstage with catalog plugin
  → Backstage template for new microservice (creates repo, CI, namespace, RBAC)
  → All 80 existing services registered in catalog

Month 5-6: Stabilize and measure
  → Platform SLOs live
  → Developer NPS baseline survey
  → Onboarding time measured from 3-5 days to < 1 day
```

**Golden Path: Create New Microservice**

The Backstage scaffolder template provisions:
1. GitHub repo from skeleton (language: Python or Go)
2. GitHub Actions CI workflow (test, Trivy scan, build, push to ECR)
3. Kubernetes namespace with ResourceQuota, LimitRange, NetworkPolicy
4. RBAC: team members get `edit` role; CI service account gets deploy role
5. ArgoCD Application pointing to repo's `k8s/` directory
6. Backstage catalog entry registered
7. Grafana dashboard from golden-signal template
8. PagerDuty service linked to team's on-call schedule

Target: developer has a running service in staging within 4 hours of starting the template.

**Table Stakes vs Nice-to-Have**

| Table Stakes (Phase 1) | Nice-to-Have (Phase 2+) |
|---|---|
| Secret management (no secrets in Git) | Chargeback/showback dashboards |
| Shared observability | Service mesh (Istio) |
| New service golden path | Advanced progressive delivery (Argo Rollouts) |
| Policy enforcement (no root containers) | ML/data platform golden paths |
| Backstage software catalog | Backstage TechDocs integration |

**Platform SLOs**

```
SLO 1: ESO Secret Sync Reliability
  SLI: Fraction of secret refresh operations completing within 60s
  Target: 99.9%
  Alert: > 0.1% failure rate over 1 hour

SLO 2: ArgoCD Sync Success Rate
  SLI: Fraction of sync operations completing in Succeeded phase
  Target: 99.5%
  Alert: < 99.5% success rate over 30 minutes

SLO 3: Backstage Catalog Availability
  SLI: Fraction of Backstage catalog API requests returning 2xx
  Target: 99.9%
  Alert: < 99.9% over 5 minutes (fast burn: page; slow burn: ticket)
```

---

## Lab 2: Backstage Software Catalog Setup

### Scenario

Your organization has 15 services. Set up the Backstage catalog so that:
- All 15 services are registered with accurate ownership
- Each service shows its dependencies (databases, queues, other services)
- Services are grouped into systems and domains

### Objectives

1. Write `catalog-info.yaml` for the `checkout` system (3 services, 2 databases)
2. Define the `System` and `Domain` entities
3. Write a GitHub Actions workflow that validates catalog entries on PR

### Worked Solution

**Entity hierarchy for the checkout domain:**

```
Domain: commerce
  System: checkout
    Component: cart-service (type: service)
    Component: order-service (type: service)
    Component: payment-service (type: service)
    Resource: orders-db (type: database)
    Resource: payments-db (type: database)
    API: checkout-api (type: openapi)
```

**catalog-info.yaml files:**

```yaml
# payment-service/catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: "Processes payments and manages transaction lifecycle"
  tags: [payments, critical-path]
  annotations:
    github.com/project-slug: myorg/payment-service
    grafana/dashboard-url: https://grafana.myorg.com/d/payment-service
    pagerduty.com/integration-key: abc123
    backstage.io/techdocs-ref: dir:.
spec:
  type: service
  lifecycle: production
  owner: group:payments-team
  system: checkout
  dependsOn:
    - resource:default/payments-db
    - component:default/fraud-detection-service
  providesApis:
    - payment-api
---
# Systems and Domains
apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: checkout
  description: "End-to-end checkout flow for purchasing"
spec:
  owner: group:checkout-team
  domain: commerce
---
apiVersion: backstage.io/v1alpha1
kind: Domain
metadata:
  name: commerce
  description: "All commerce-related systems"
spec:
  owner: group:engineering-leadership
---
# Database resource
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: payments-db
  description: "PostgreSQL database for payment transactions"
  annotations:
    aws.amazon.com/rds-instance-id: payments-db-prod
spec:
  type: database
  owner: group:payments-team
  system: checkout
```

**GitHub Actions catalog validation:**

```yaml
# .github/workflows/catalog-validate.yml
name: Validate Backstage Catalog

on:
  pull_request:
    paths:
      - '**/catalog-info.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install backstage-cli
        run: npm install -g @backstage/cli

      - name: Validate catalog entities
        run: |
          find . -name "catalog-info.yaml" | while read file; do
            echo "Validating: $file"
            backstage-cli catalog-import --dryRun "$file"
          done

      - name: Check required annotations
        run: |
          python3 scripts/check-catalog-annotations.py
          # Checks: owner is set, grafana URL is present, pagerduty key is present
```

---

## Lab 3: Write a Platform SLO

### Scenario

Your platform team operates a Backstage scaffolder. In the last month, 12 out of 240 template runs failed (5% failure rate). Teams are losing trust in the scaffolder. Define and implement a proper SLO.

### Objectives

1. Define the SLI precisely
2. Set a target with business justification
3. Write Prometheus alerting rules (multi-window burn rate)
4. Define what happens when the error budget is exhausted

### Worked Solution

**SLI Definition:**

```
What: Backstage scaffolder template runs
Good event: Template run completes with status=completed
Total events: All template runs triggered

SLI = completed_runs / total_runs (over rolling 30-day window)

Current state: 228/240 = 95.0% (very poor — below any reasonable SLO)
```

**SLO Target and Justification:**

```
Target: 99% success rate (rolling 30 days)
Justification:
  - Scaffolder is used for new service creation (high impact, infrequent)
  - A 1% failure rate = ~2-3 failed runs per month at current volume
  - Each failed run requires developer investigation (30-60 min lost)
  - 99% is achievable once root causes are fixed; 99.9% after stabilization

Error budget: 1% of 30 days = 7.2 hours of allowed downtime equivalent
             At current volume: ~2.4 failed runs per month allowed
```

**Prometheus Recording Rules and Alerts:**

```yaml
groups:
  - name: platform.scaffolder.slo
    rules:
      # SLI recording rules
      - record: platform:scaffolder_success_rate:5m
        expr: |
          sum(rate(scaffolder_task_count{status="completed"}[5m]))
          /
          sum(rate(scaffolder_task_count[5m]))

      - record: platform:scaffolder_success_rate:1h
        expr: |
          sum(rate(scaffolder_task_count{status="completed"}[1h]))
          /
          sum(rate(scaffolder_task_count[1h]))

      - record: platform:scaffolder_success_rate:6h
        expr: |
          sum(rate(scaffolder_task_count{status="completed"}[6h]))
          /
          sum(rate(scaffolder_task_count[6h]))

      # Fast burn alert (14x consumption rate — budget gone in ~2 days)
      - alert: ScaffolderFastBudgetBurn
        expr: |
          platform:scaffolder_success_rate:1h < (1 - 14 * (1 - 0.99))
          and
          platform:scaffolder_success_rate:5m < (1 - 14 * (1 - 0.99))
        for: 2m
        labels:
          severity: page
          team: platform
        annotations:
          summary: "Scaffolder error budget burning fast — current success rate {{ $value | humanizePercentage }}"
          runbook: "https://wiki/runbooks/scaffolder-failure"

      # Slow burn alert (3x consumption rate — budget gone in ~10 days)
      - alert: ScaffolderSlowBudgetBurn
        expr: |
          platform:scaffolder_success_rate:6h < (1 - 3 * (1 - 0.99))
        for: 60m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Scaffolder error budget burning slowly — investigate"
          runbook: "https://wiki/runbooks/scaffolder-failure"
```

**Error Budget Policy:**

```
When scaffolder error budget is exhausted (< 0% remaining):
  1. Freeze all scaffolder feature work
  2. Incident postmortem within 48 hours
  3. Root cause analysis: what categories of failures are occurring?
     → Authentication failures? → Fix SSO integration
     → GitHub API rate limits? → Add retry logic + backoff
     → Terraform errors? → Improve error handling in template steps
  4. Fix and release reliability improvements
  5. Resume feature work once budget > 20% recovered
  6. Communicate status to all developer-facing channels
```

---

## Lab 4: Design a Golden Path for a New Service

### Scenario

Your org is adopting a standard for new Python microservices. Design the complete golden path, including: repository structure, CI pipeline, Kubernetes manifests, and observability.

### Objectives

1. Define what the skeleton repository contains
2. Write the CI pipeline stages
3. Write production-ready Kubernetes manifests
4. Define the observability baseline

### Worked Solution

**Repository skeleton structure:**

```
service-skeleton/
├── src/
│   ├── main.py           # FastAPI application with /health and /ready
│   ├── config.py         # Pydantic settings from environment
│   └── metrics.py        # Prometheus client setup
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile            # Multi-stage build, non-root user
├── pyproject.toml        # Dependencies, test config
├── .github/
│   └── workflows/
│       ├── ci.yml        # Test, scan, build, push
│       └── deploy.yml    # GitOps manifest update
├── k8s/
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── hpa.yaml
│   │   ├── pdb.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── staging/
│       └── production/
├── catalog-info.yaml     # Backstage registration
└── docs/
    └── index.md          # TechDocs
```

**CI Pipeline (GitHub Actions):**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: pytest tests/unit/ --cov=src --cov-fail-under=80
      - run: ruff check src/ tests/

  security-scan:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          exit-code: 1
          severity: CRITICAL,HIGH

  build:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - name: Build and push image
        run: |
          IMAGE_TAG="${{ github.sha }}"
          docker build -t $ECR_REGISTRY/$SERVICE_NAME:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$SERVICE_NAME:$IMAGE_TAG
      - name: Trivy image scan (post-build)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.ECR_REGISTRY }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          exit-code: 1
          severity: CRITICAL
      - name: Sign image
        run: cosign sign --key awskms:///alias/cosign-key $IMAGE_REF
      - name: Update GitOps manifest
        run: |
          yq -i ".spec.template.spec.containers[0].image = \"$IMAGE_REF\"" \
            k8s/overlays/staging/kustomization.yaml
          git commit -am "ci: update $SERVICE_NAME to ${{ github.sha }}"
          git push
```

**Production Kubernetes Manifest:**

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ service_name }}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: {{ service_name }}
  template:
    metadata:
      labels:
        app: {{ service_name }}
        team: {{ team }}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: {{ service_name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      terminationGracePeriodSeconds: 60
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: {{ service_name }}
      containers:
        - name: app
          image: "placeholder:latest"
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 15
            failureThreshold: 3
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ service_name }}
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: {{ service_name }}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ service_name }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ service_name }}
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

**Observability Baseline:**

Every service from the golden path gets these out of the box:
- Grafana dashboard with: request rate, error rate, p50/p95/p99 latency, active pod count, CPU/memory usage
- PrometheusRule with error budget burn alerts (fast burn pages, slow burn tickets)
- PagerDuty service with sensible escalation policy
- Log forwarding via Fluent Bit (configured at the cluster level, not per-service)

Services emit golden signals by default because the skeleton includes a `metrics.py` module:

```python
# src/metrics.py — included in every golden-path service
from prometheus_client import Counter, Histogram
import time, functools

REQUEST_COUNT = Counter(
    'http_requests_total', 'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)
REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds', 'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1.0, 2.5, 5.0]
)

def track_request(method: str, endpoint: str):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            status = "500"
            try:
                result = await func(*args, **kwargs)
                status = str(result.status_code)
                return result
            finally:
                REQUEST_COUNT.labels(method, endpoint, status).inc()
                REQUEST_LATENCY.labels(method, endpoint).observe(time.time() - start)
        return wrapper
    return decorator
```
