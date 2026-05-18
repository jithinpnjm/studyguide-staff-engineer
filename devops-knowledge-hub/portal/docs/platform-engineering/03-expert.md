---
title: "Expert"
sidebar_position: 3
---

# Platform Engineering — Expert

## Platform as a Product

The most important mindset shift in mature platform engineering: **the platform is a product, and internal developers are customers**.

This means applying product management discipline to platform work:

### Product Thinking Applied to Platforms

| Product Concept | Application to Platform Engineering |
|---|---|
| Customer discovery | Quarterly developer surveys, user research sessions, shadow sessions with engineers |
| Jobs to be done | "Deploy a new microservice", "Rotate a secret", "Debug a production incident" |
| Product backlog | Platform capabilities prioritized by developer impact, not technical interest |
| MVP | Thinnest viable platform — solve the most painful problem first |
| Roadmap | Published 6-12 month direction; teams can plan around it |
| OKRs | Objective: reduce time-to-first-deploy; KR: < 4 hours for 80% of services |
| Metrics / telemetry | DORA, platform SLO dashboards, support ticket volume, NPS |
| Deprecation policy | Old golden paths have a support window; teams get migration paths |

### Platform OKR Examples

```
Objective: Make new service onboarding self-service and fast

  KR1: 90% of new services deployed via golden path template (baseline: 40%)
  KR2: Median time-to-first-prod-deploy < 8 hours (baseline: 3 days)
  KR3: Platform team tickets for new service setup < 5/quarter (baseline: 30/quarter)

Objective: Improve platform reliability so teams can trust it

  KR1: Platform SLO composite score > 99.5% for all components
  KR2: Zero platform-caused P1 incidents per quarter (baseline: 2/quarter)
  KR3: Error budget for ArgoCD > 80% remaining at end of quarter
```

### Platform Roadmap

A platform roadmap communicates what is coming and helps teams plan. It must include:
- Near-term (0-3 months): committed, detailed work
- Mid-term (3-6 months): directional, subject to change
- Long-term (6-12 months): vision and strategic bets

Publish the roadmap. Teams that can't see what's coming either wait for the platform (creating a bottleneck) or build their own solutions (creating shadow IT).

---

## Thinnest Viable Platform

The **thinnest viable platform** principle: build only what teams need to self-serve, no more. Resist the urge to build a comprehensive platform before anyone needs it.

```
Thinnest viable platform progression:

Phase 1: Golden path for new service
  → Backstage template that creates repo + CI + k8s manifests
  → Manual namespace creation (not yet automated)
  → Shared observability stack (Prometheus + Grafana)

Phase 2: Self-service infrastructure
  → Automated namespace + RBAC provisioning
  → Terraform module registry for databases, queues, caches
  → Secret management via ESO

Phase 3: Fleet management and governance
  → ApplicationSets for platform services across clusters
  → Policy-as-code enforcement (Kyverno)
  → Chargeback/showback dashboards

Phase 4: Advanced capabilities
  → Service mesh with progressive delivery
  → ML platform, data platform golden paths
  → Multi-cluster, multi-region abstractions
```

The trap: platforms built in Phase 4 style before teams need it. The result is a complex platform that nobody uses and a platform team exhausted maintaining it.

---

## Platform Capability Models

Capability models help platform teams communicate maturity to leadership and prioritize investments.

### CNCF Maturity Model Adapted for IDPs

| Capability | Level 1: Provisional | Level 2: Managed | Level 3: Optimized |
|---|---|---|---|
| Service catalog | Manual registration | Semi-automated discovery | Automated with policy enforcement |
| New service onboarding | 3+ days with tickets | < 1 day with templates | < 4 hours fully automated |
| Secret management | Hardcoded or manual | Vault/ESO, manual rotation | Automated rotation, zero-downtime |
| CI/CD | Per-team pipelines | Shared pipeline templates | Managed pipeline-as-a-product |
| Observability | Per-team setup | Centralized stack, manual onboarding | Auto-instrumentation, golden signals out of box |
| Policy enforcement | Documentation only | Manual reviews | Automated admission control |
| Cost visibility | Monthly cloud bill | Per-team showback | Real-time chargeback |

---

## Multi-Tenancy Patterns

Platform teams must isolate workloads so one team's failures cannot affect another team's services.

### Namespace-per-Team Isolation

The baseline pattern for most organizations. Each team gets one or more namespaces with:

```yaml
# Namespace with team labels
apiVersion: v1
kind: Namespace
metadata:
  name: team-payments
  labels:
    team: payments
    environment: production
    cost-center: payments-engineering
---
# Default NetworkPolicy: deny all cross-namespace traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-cross-namespace
  namespace: team-payments
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: team-payments
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: team-payments
    - ports:      # Allow DNS
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
```

### Resource Quotas (Bulkhead Pattern)

Prevent one team's runaway workload from starving others:

```yaml
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
    services: "10"
    persistentvolumeclaims: "5"
    secrets: "20"
    configmaps: "20"
```

### LimitRanges (Defaults and Caps)

LimitRanges ensure every container has resource requests/limits, even if developers forget to set them:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: team-payments-limits
  namespace: team-payments
spec:
  limits:
    - type: Container
      default:           # applied if not set
        cpu: "500m"
        memory: "256Mi"
      defaultRequest:    # applied if not set
        cpu: "100m"
        memory: "128Mi"
      max:               # hard cap per container
        cpu: "4"
        memory: "4Gi"
      min:               # minimum allowed
        cpu: "50m"
        memory: "64Mi"
```

### Hard Multi-Tenancy (Compliance Scenarios)

For workloads requiring stronger isolation (PCI-DSS, HIPAA, untrusted tenants), namespace isolation is not sufficient. Options:

| Option | Isolation Level | Cost | Use When |
|---|---|---|---|
| Namespace per team | Soft (shared control plane) | Low | Default — most orgs |
| vCluster (virtual cluster) | Medium (dedicated k8s API) | Medium | Dev/staging multi-tenancy |
| Separate cluster per environment | Hard (dedicated nodes + control plane) | High | Production compliance workloads |
| Separate cluster per tenant | Full | Very high | SaaS with strict tenant isolation |

---

## Chargeback and Showback

Financial visibility creates accountability. Platform teams enable this by labeling resources and building dashboards.

### Showback (Visibility Without Billing)

Showback shows each team what they are consuming without directly charging them. This is the right starting point — it creates awareness without friction.

```yaml
# Kubernetes labels for cost attribution
metadata:
  labels:
    team: payments
    cost-center: "CC-1234"
    environment: production
    service: payment-processor
```

Tools: **Kubecost** and **OpenCost** aggregate Kubernetes resource usage and AWS/GCP/Azure spend by these labels, presenting per-team cost dashboards.

### Chargeback (Internal Billing)

Chargeback allocates actual costs to team budgets. This is appropriate for mature organizations where:
- Cost optimization is a priority
- Teams have budget authority
- Showback data has been stable for several quarters

Chargeback creates incentives to right-size workloads, request appropriate resources, and avoid waste.

---

## Platform Security: Namespace Isolation, Quotas, LimitRanges

Platform security is not an afterthought — it is built into the platform's golden paths and enforced by admission policies.

### Policy-as-Code with Kyverno

Kyverno policies enforce platform security standards on admission:

```yaml
# Require all containers to have resource limits
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: enforce
  rules:
    - name: check-container-limits
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "CPU and memory limits are required on all containers."
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    cpu: "?*"
                    memory: "?*"
---
# Prevent containers from running as root
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-root-containers
spec:
  validationFailureAction: enforce
  rules:
    - name: check-run-as-non-root
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "Containers must not run as root."
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
```

### OPA/Gatekeeper for Complex Policies

```rego
# Rego: only allow images from approved registries
package kubernetes.admission

deny[msg] {
  input.request.kind.kind == "Pod"
  container := input.request.object.spec.containers[_]
  not startswith(container.image, "123456789.dkr.ecr.us-east-1.amazonaws.com/")
  not startswith(container.image, "ghcr.io/myorg/")
  msg := sprintf("Image %v is not from an approved registry", [container.image])
}
```

---

## Event-Driven Platform Automation

Mature platforms automate operational tasks in response to events rather than on a schedule.

### Kubernetes Event-Driven Patterns

```yaml
# Kyverno: automatically add network policies when namespace is created
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-networkpolicy
spec:
  rules:
    - name: add-default-deny
      match:
        any:
          - resources:
              kinds: [Namespace]
              selector:
                matchLabels:
                  team: "?*"   # only team namespaces
      generate:
        kind: NetworkPolicy
        name: default-deny-cross-namespace
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes: [Ingress, Egress]
```

### Platform Automation with Kubernetes Operators

Custom operators respond to CRDs (Custom Resource Definitions) to automate complex provisioning:

```yaml
# A CRD that triggers automated team environment provisioning
apiVersion: platform.myorg.com/v1alpha1
kind: TeamEnvironment
metadata:
  name: payments-production
spec:
  team: payments
  environment: production
  resources:
    cpu: "8"
    memory: "16Gi"
  databases:
    - name: payments-db
      engine: postgres
      size: db.r5.large
  networking:
    allowedEgress: [payments-api.external.com]
```

An operator watches for `TeamEnvironment` resources and creates the namespace, RBAC, ResourceQuota, LimitRange, NetworkPolicy, and triggers the Terraform database module — all automatically.

---

## SLOs for Platform Teams

Platform SLOs are commitments to internal customers. They should be defined collaboratively with the teams that depend on the platform.

### Defining Platform SLIs

SLIs for a platform measure what developers experience, not internal health:

```
SLI: "What fraction of Backstage scaffolder runs complete successfully?"
  → Good event: template run exits with status=success
  → Bad event: template run exits with status=error or times out

SLI: "What fraction of ArgoCD sync operations complete within 5 minutes?"
  → Good event: app reaches Synced state within 5 minutes of trigger
  → Bad event: sync exceeds 5 minutes or fails

SLI: "What fraction of secret refresh operations complete within 30 seconds?"
  → Measured by ESO reconcile duration histogram
```

### Platform SLO Dashboard

```yaml
# Prometheus recording rules for platform SLOs
groups:
  - name: platform.slis
    rules:
      - record: platform:argocd_sync_success_rate:5m
        expr: |
          sum(rate(argocd_app_sync_total{phase="Succeeded"}[5m]))
          /
          sum(rate(argocd_app_sync_total[5m]))

      - record: platform:scaffolder_success_rate:1d
        expr: |
          sum(rate(scaffolder_task_count{status="completed"}[1d]))
          /
          sum(rate(scaffolder_task_count[1d]))

      - alert: PlatformSLOAtRisk
        expr: platform:argocd_sync_success_rate:5m < 0.995
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "ArgoCD sync success rate below 99.5% SLO"
          runbook: "https://wiki/runbooks/argocd-sync-slo"
```

### Error Budget Process for Platform Teams

When a platform SLO burns through its error budget:
1. Freeze non-reliability platform work
2. Conduct blameless postmortem on the budget burn
3. Identify systemic causes (not just the immediate incident)
4. Publish reliability improvements to affected teams
5. Resume feature work only after budget is restored

This is the same SRE error budget process, applied to the internal platform.

---

## Summary

Expert-level platform engineering requires:

1. **Product thinking** — OKRs, roadmaps, customer discovery, deprecation policies
2. **Thinnest viable platform** — build for current needs, not theoretical future scale
3. **Multi-tenancy discipline** — namespace isolation, ResourceQuotas, LimitRanges, hard isolation for compliance
4. **Financial visibility** — showback before chargeback, labeled resources
5. **Policy as code** — Kyverno and OPA enforcing security standards on every admission
6. **Event-driven automation** — operators and generate policies removing operational toil
7. **Platform SLOs** — commitments to internal customers, error budget process applied to platform reliability
