---
title: "Cheat Sheet"
sidebar_position: 6
---

# Platform Engineering — Cheat Sheet

## Platform Team Terminology

| Term | Definition |
|---|---|
| IDP | Internal Developer Platform — the self-service layer built for internal developers |
| Golden path | Opinionated, pre-built, supported route for a common developer task |
| Paved road | Synonym for golden path; emphasizes teams can go "off-road" (at their own cost) |
| Guardrail | Automated policy that prevents dangerous deviations (Kyverno, Gatekeeper) |
| Thinnest viable platform | Minimum set of capabilities that meaningfully reduce cognitive load |
| Cognitive load | Mental effort developers spend on infrastructure instead of product features |
| Golden cage | Anti-pattern: golden paths so rigid they trap teams |
| Shadow IT | Teams building their own infra outside the platform due to platform limitations |
| Platform bottleneck | Anti-pattern: platform team is a queue; teams wait for platform work |
| X-as-a-Service | Interaction mode: platform exposes stable API; teams self-serve |
| Error budget | Allowed unreliability within an SLO window (e.g., 0.1% of 30 days = 43 min) |
| Showback | Cost visibility per team without internal billing |
| Chargeback | Internal billing that allocates cloud costs to team budgets |
| Day-0 capability | Creating something new (new service, new project) |
| Day-1 capability | Adding to something existing (new database, new queue) |
| Day-2 capability | Ongoing operations (scaling, patching, rotation, incident response) |

---

## DORA Metrics Reference

Four metrics that predict software delivery performance and organizational success:

| Metric | What It Measures | Elite | High | Medium | Low |
|---|---|---|---|---|---|
| Deployment frequency | How often code ships to production | Multiple/day | 1/week | 1/month | < 1/month |
| Lead time for changes | Commit to production time | < 1 hour | 1 day | 1 week | > 1 month |
| Change failure rate | % of deploys causing incidents | < 5% | < 10% | < 15% | > 15% |
| MTTR | Time to restore service after incident | < 1 hour | < 1 day | < 1 week | > 1 week |

**How platform teams influence DORA:**
- Deployment frequency: scaffolder templates + ArgoCD auto-sync remove manual steps
- Lead time: golden-path CI pipelines eliminate configuration time; automated deployment removes approval queues
- Change failure rate: Trivy scanning + OPA policies catch regressions; canary deployments reduce blast radius
- MTTR: shared observability + runbooks in catalog + ArgoCD one-click rollback

---

## SPACE Framework Quick Reference

| Dimension | Description | Example Measure |
|---|---|---|
| Satisfaction | Developer happiness with their work and tools | Developer NPS, survey scores |
| Performance | Quality and impact of what developers produce | Reliability of shipped features, code review velocity |
| Activity | Volume of developer actions | PRs merged, deployments triggered |
| Communication | How developers collaborate and share knowledge | Code review latency, documentation coverage |
| Efficiency | Flow and absence of interruptions | Time in deep work, context switches |

SPACE is not a dashboard — it is a multi-dimensional framework. No single metric represents developer productivity.

---

## Backstage Entity Types

| Kind | What It Represents | Example |
|---|---|---|
| `Component` | A deployable unit (service, library, website, job) | `payment-service` |
| `API` | An interface exposed by a component | `payment-api` (OpenAPI, gRPC) |
| `Resource` | Infrastructure a component depends on | `payments-db` (RDS, Redis) |
| `System` | Group of components serving a cohesive purpose | `checkout` system |
| `Domain` | Business area grouping related systems | `commerce` domain |
| `Group` | A team or org unit | `payments-team` |
| `User` | An individual engineer | `alice@myorg.com` |
| `Template` | Scaffolder template (creates entities from forms) | `python-microservice` |
| `Location` | Pointer to one or more catalog entities in a repo | `all-services` location |

**Backstage catalog-info.yaml required fields:**

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component              # required
metadata:
  name: my-service           # required — must be unique per namespace
  description: "..."         # strongly recommended
  annotations: {}            # connect to Grafana, PagerDuty, GitHub
spec:
  type: service              # required (service, library, website, etc.)
  lifecycle: production      # required (experimental, production, deprecated)
  owner: group:my-team       # required
  system: my-system          # recommended
```

---

## Team Topologies Patterns

| Pattern | Description | When to Use |
|---|---|---|
| Stream-aligned team | Full-stack team owning a product domain end-to-end | Default for product teams |
| Platform team | Provides self-service to stream teams | When stream teams share common infrastructure needs |
| Complicated subsystem team | Owns deep specialist capability | ML infra, security, cryptography |
| Enabling team | Temporary coaching to level-up stream teams | During large technical transitions |

**Interaction Modes:**

| Mode | Description | Platform Team Use |
|---|---|---|
| X-as-a-Service | Consumer uses capability without coordination | Default — Backstage, Terraform modules |
| Collaboration | Two teams work closely together | New golden path design |
| Facilitating | Platform coaches stream team | Migration to new observability stack |

**Cognitive load types (Matthew Skelton):**

| Type | Description | Platform Reduces? |
|---|---|---|
| Intrinsic | Inherent complexity of the domain being built | No — domain knowledge |
| Extraneous | Unnecessary complexity from tools/environment | Yes — this is the platform's job |
| Germane | Learning that creates useful long-term knowledge | Sometimes — curated by platform |

---

## Platform SLO Quick Reference

**Standard platform SLO targets:**

| Component | SLI | Target |
|---|---|---|
| ArgoCD | Sync success rate | > 99.5% |
| Backstage catalog API | Availability (2xx responses) | > 99.9% |
| Backstage scaffolder | Template run success rate | > 98% |
| External Secrets Operator | Secret refresh latency p99 | < 30 seconds |
| Cluster API | Availability | > 99.95% |
| CI pipeline | Build success rate (given passing tests) | > 99% |

**Multi-window burn rate alert thresholds (for 99.9% SLO):**

| Alert | Burn rate | Window | Time to exhaustion |
|---|---|---|---|
| Page (fast burn) | 14x | 1 hour | ~2 days |
| Ticket (slow burn) | 3x | 6 hours | ~10 days |

---

## Kubernetes Multi-Tenancy Controls

| Control | What It Does | Resource |
|---|---|---|
| Namespace | Logical isolation unit | `kind: Namespace` |
| ResourceQuota | Caps total resource consumption per namespace | `kind: ResourceQuota` |
| LimitRange | Sets default + max per container | `kind: LimitRange` |
| NetworkPolicy | Controls pod-to-pod and namespace-to-namespace traffic | `kind: NetworkPolicy` |
| RBAC | Controls who can do what within a namespace | `RoleBinding`, `ClusterRoleBinding` |
| PodDisruptionBudget | Minimum available pods during disruptions | `kind: PodDisruptionBudget` |
| Kyverno/Gatekeeper | Admission control (reject non-compliant resources) | `ClusterPolicy`, `ConstraintTemplate` |

---

## GitOps Quick Reference

| Concept | ArgoCD | Flux |
|---|---|---|
| App definition | `Application` CRD | `HelmRelease`, `Kustomization` CRDs |
| Fleet management | `ApplicationSet` (matrix, list, cluster generators) | `Kustomization` with cluster targeting |
| Auto-sync | `syncPolicy.automated` | `interval` on reconciler |
| Self-healing | `selfHeal: true` | Automatic (always reconciles) |
| Manual sync trigger | `argocd app sync <name>` | `flux reconcile ks <name>` |
| Rollback | Revert commit in GitOps repo | Revert commit in GitOps repo |
| Multi-cluster | Registered clusters via kubeconfig | Kubeconfig secret per cluster |

---

## Microservice Platform Patterns

| Pattern | Problem Solved | Implementation |
|---|---|---|
| API Gateway | Centralize auth, rate limiting, TLS | NGINX Ingress, Kong, AWS ALB |
| Circuit Breaker | Prevent cascading failures | Istio DestinationRule, Resilience4j |
| Bulkhead | Isolate failure domains | Separate thread pools, ResourceQuotas |
| Sidecar | Cross-cutting concerns without code change | Envoy (Istio), Fluent Bit, Vault agent |
| Saga | Distributed transactions | Choreography (events) or orchestration (coordinator) |
| CQRS | Separate read/write scaling | Command side → events → read projections |
| Service registry | Dynamic service discovery | Kubernetes DNS + Service objects |

---

## Secret Management Quick Reference

| Tool | Where Secrets Live | How Pods Get Them | Rotation |
|---|---|---|---|
| External Secrets Operator | AWS Secrets Manager, Vault, GCP SM | Kubernetes Secret (synced) | ESO refreshInterval |
| Vault Agent Injector | HashiCorp Vault | File in shared volume (sidecar) | Vault lease renewal |
| Sealed Secrets | Git (encrypted) | Kubernetes Secret (decrypted in cluster) | Manual re-sealing |
| CSI Secrets Store | AWS Secrets Manager, Vault | File mount (no k8s Secret) | Auto-rotated by provider |

**Zero-downtime rotation rule:** Use file-mounted secrets, not environment variable secrets. Kubelet updates file mounts automatically; environment variables require pod restart.

---

## Common kubectl Commands for Platform Debugging

```bash
# Check resource quota consumption
kubectl describe resourcequota -n team-payments

# Check limit range
kubectl describe limitrange -n team-payments

# Check network policies
kubectl get networkpolicies -n team-payments -o yaml

# Check RBAC for a user
kubectl auth can-i create pods --as=alice --namespace=team-payments

# Check ArgoCD app status
argocd app get payment-service
argocd app sync payment-service
argocd app history payment-service

# Check ESO secret sync status
kubectl get externalsecret -n team-payments
kubectl describe externalsecret db-credentials -n team-payments

# Check Kyverno policy violations
kubectl get policyreport -n team-payments

# Check pod security context
kubectl get pod -n team-payments -o jsonpath='{.items[*].spec.securityContext}'
```
