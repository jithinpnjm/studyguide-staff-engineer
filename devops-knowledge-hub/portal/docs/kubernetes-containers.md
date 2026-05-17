---
title: "☸️ Kubernetes & Containers"
sidebar_position: 1
description: "Zero to hero study guide for Kubernetes & Containers — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Kubernetes is the operating system of the cloud-native world. Every production workload at scale runs on it or next to it. As a Staff/Principal SRE you don't just use Kubernetes — you own the platform that everyone else builds on. When you get it wrong, you take down every team at once.

Business outcomes that depend on deep K8s expertise:
- **Deployment velocity** — teams ship 10x faster when the platform handles rollouts, rollbacks, and traffic management automatically
- **Reliability** — self-healing workloads, Pod disruption budgets, and topology spread constraints mean fewer 3am pages
- **Cost** — right-sizing resources and cluster autoscaling is often the largest infrastructure cost lever (20-60% savings routinely)
- **Security posture** — a misconfigured cluster is a lateral movement paradise; RBAC, network policies, and admission controllers are your blast radius controls

What breaks without this expertise: runaway costs from over-provisioned nodes, cascading failures from missing resource limits, security breaches from open RBAC, and engineering toil from deployments that require manual intervention.

---

## 📋 Prerequisites & Mental Models

**Linux kernel fundamentals** — containers ARE Linux:
- `cgroups v2`: hierarchical resource accounting and limits (CPU, memory, PIDs, I/O)
- `namespaces`: isolation for PID, network, mount, UTS, IPC, user — each container gets its own view
- `overlayfs`: layered copy-on-write filesystems behind every container image

**The reconciliation loop model** — Kubernetes is a distributed state machine. Every controller runs a loop: observe actual state → compare to desired state → act to close the gap. This is not an event bus, it is a continuous reconciler. Understanding this explains why Kubernetes is eventually consistent, why idempotency matters everywhere, and why `kubectl apply` is safe to re-run.

**Immutable infrastructure** — you never patch a running container. You build a new image, deploy it, the old one goes away. Configuration lives in ConfigMaps/Secrets or environment variables, never baked into running containers.

**Control plane / data plane split** — the control plane (API server, etcd, scheduler, controller-manager) decides WHAT should happen. The data plane (kubelet, container runtime, kube-proxy) makes it happen. A control plane outage freezes scheduling but running Pods keep running.

**Everything is an API object** — Nodes, Pods, Services, Deployments are all JSON/YAML objects stored in etcd and watched by controllers. Custom Resources extend this model to your own domain objects.

---

## 🔷 Core Concepts

### Container Images & Runtimes

An image is an immutable, layered filesystem snapshot. Each `RUN`, `COPY`, `ADD` in a Dockerfile adds a layer. Layers are content-addressed (SHA256). Two images sharing a base layer share that layer on disk and in registry storage.

**Production image practices:**
- Multi-stage builds: compile in a full SDK image, copy only the binary into `scratch` or `distroless`. Eliminates shell, package manager, and build tools from the runtime attack surface.
- Pin exact digests in production: `image@sha256:abc...` not `image:latest`. Tags are mutable.
- Use `distroless` (Google) or `chainguard` base images — no shell, minimal packages, dramatically smaller CVE surface.
- Never run as root — set `USER 1000` in Dockerfile and `runAsNonRoot: true` in the pod spec.

**Container runtimes:** containerd (default in modern K8s) manages the container lifecycle. The OCI runtime (runc, gVisor, Kata) actually creates the container. runc is standard; gVisor (runsc) adds a user-space kernel for stronger isolation; Kata uses VMs per Pod for the strongest isolation.

### Pods

The atomic scheduling unit. Key properties:
- All containers in a Pod share the same network namespace (same IP, same `localhost`)
- Containers in a Pod can share volumes via `volumes` + `volumeMounts`
- Pods are ephemeral — when they die, they are gone; use controllers to manage them
- A Pod's IP is only routable within the cluster (unless using host networking)

**Pod lifecycle:** Pending → Running → Succeeded/Failed. Within Running, containers cycle through: Waiting → Running → Terminated. `restartPolicy` controls what happens on container exit: Always (Deployments), OnFailure (Jobs), Never.

**Init containers** run sequentially before app containers start. Use for: waiting for a dependency, pre-populating a volume, running migrations.

**Sidecar pattern** (now a proper `initContainer` type with `restartPolicy: Always` in K8s 1.29+): helper container in the same Pod. Used for: service mesh proxies (Envoy), log shippers (Fluent Bit), secret rotators.

### Workload Controllers

**Deployment** — for stateless apps. Manages ReplicaSets. Rolling update strategy: creates new ReplicaSet, scales it up while scaling old one down. `maxSurge` and `maxUnavailable` control the rate. Rollback: `kubectl rollout undo deployment/myapp`.

**StatefulSet** — for stateful apps. Gives each Pod a stable identity (ordinal index), stable hostname (`pod-0.service.namespace.svc`), and stable storage (PVC per Pod). Pods start/stop in order. Use for: databases, Kafka, Elasticsearch, ZooKeeper.

**DaemonSet** — runs exactly one Pod per node (or matching nodes). Use for: node-level monitoring (node-exporter), log collection (Fluent Bit), CNI plugins, storage agents.

**Job / CronJob** — Job runs to completion. CronJob schedules Jobs. Key settings: `completions`, `parallelism`, `backoffLimit`, `activeDeadlineSeconds`. CronJob: `concurrencyPolicy: Forbid` prevents overlapping runs.

### Services & Networking

**Service** — stable virtual IP (ClusterIP) that load-balances to matching Pods via label selector. Types:
- `ClusterIP` (default) — only reachable within cluster
- `NodePort` — exposes on every node at a static port (30000-32767); avoid in production
- `LoadBalancer` — provisions a cloud LB; one LB per Service gets expensive; prefer Ingress
- `ExternalName` — CNAME alias to external DNS

**Headless Service** (`clusterIP: None`) — no VIP; DNS returns individual Pod IPs. Required by StatefulSets for stable per-Pod DNS.

**kube-proxy** implements Service VIPs using iptables or IPVS on every node. IPVS mode scales better for clusters with 1000+ Services (hash table vs linear scan).

**Ingress** — L7 HTTP/HTTPS routing rules. Ingress controller (nginx, Traefik, ALB) implements them. One controller handles all Ingress objects — much cheaper than one LB per Service.

**Gateway API** — the successor to Ingress. More expressive, role-oriented (GatewayClass, Gateway, HTTPRoute), supports TCP/UDP/gRPC natively. Prefer it for new clusters.

### Storage

- **PersistentVolume (PV)** — a piece of storage in the cluster
- **PersistentVolumeClaim (PVC)** — a workload's request for storage; Kubernetes binds PVCs to PVs
- **StorageClass** — defines how storage is dynamically provisioned; `volumeBindingMode: WaitForFirstConsumer` delays provisioning until a Pod is scheduled (critical for topology-aware block storage like EBS)

**Access modes:** `ReadWriteOnce` (one node), `ReadOnlyMany` (many nodes read), `ReadWriteMany` (many nodes write). Most cloud block storage is RWO only.

**CSI (Container Storage Interface)** — the plugin standard. Cloud providers ship CSI drivers (aws-ebs-csi-driver, gcp-compute-persistent-disk-csi-driver).

### ConfigMaps & Secrets

ConfigMaps for non-sensitive configuration. Secrets are base64-encoded (not encrypted by default) — enable `EncryptionConfiguration` for etcd encryption at rest. Better: use **External Secrets Operator** to pull from AWS Secrets Manager / HashiCorp Vault and sync to K8s Secrets automatically.

Secrets mounted as volumes update when the Secret changes (with a short delay). Secrets as env vars do NOT update without a Pod restart.

### Scheduling Deep Dive

The scheduler assigns Pods to Nodes in two phases:
1. **Filtering**: removes nodes that don't meet requirements (resource requests, nodeSelectors, taints/tolerations, affinity rules)
2. **Scoring**: ranks remaining nodes (prefer spread, prefer nodes with image cached, etc.)

**Resource requests vs limits:**
- `requests`: what the scheduler reserves. Pod is only scheduled on a node with sufficient allocatable.
- `limits`: the cgroup boundary. CPU limit = throttling. Memory limit = OOMKill.
- Always set both. CPU throttling from limits can be worse than no limit for latency-sensitive apps.

**QoS classes:**
- `Guaranteed`: requests == limits for all containers. Never evicted first.
- `Burstable`: requests < limits. Evicted before Guaranteed.
- `BestEffort`: no requests/limits. Evicted first.

**Topology Spread Constraints** — the modern way to spread Pods across zones/nodes:

```yaml
topologySpreadConstraints:
- maxSkew: 1
  topologyKey: topology.kubernetes.io/zone
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels:
      app: myapp
```

**Taints & Tolerations** — taints on nodes repel Pods without matching tolerations. Use for dedicated GPU nodes, spot nodes, system workloads.

---

## 🛠️ Tools & Ecosystem

### kubectl — Key Patterns
```bash
kubectl exec -it pod -- /bin/sh                        # debug running container
kubectl logs -f --previous                             # logs from crashed container
kubectl top pods --sort-by=memory                      # resource usage
kubectl get events --sort-by=.lastTimestamp            # what just happened
kubectl apply --dry-run=server                         # validate without applying
kubectl diff -f manifest.yaml                          # see what would change
kubectl auth can-i --list --as=system:serviceaccount:ns:sa  # RBAC audit
```

### Helm
Package manager for Kubernetes. Charts = reusable, parameterized K8s manifests.
- `helm upgrade --install` — idempotent deploy
- `helm rollback` — revert to previous release
- `helm template` — render locally without deploying

When NOT to use Helm: when you're already using ArgoCD + Kustomize (often cleaner for in-house apps), when chart complexity exceeds its value.

### Kustomize
Built into kubectl. Patch-based templating — no templating language, just structured overlays. Base + overlays pattern: common config in `base/`, environment-specific patches in `overlays/prod/`.

### ArgoCD / Flux
GitOps operators — sync desired state from Git to cluster. ArgoCD has a rich UI and ApplicationSets for multi-cluster. Flux is more CLI/API-driven and fits Helm-heavy setups well. Both provide audit trail and drift detection.

### Operators & controller-runtime
Operator = Custom Resource + Controller. The controller watches CRD instances and reconciles. Built with controller-runtime (Go). Write operators when you need to encode operational knowledge (failover logic, backup schedules) into Kubernetes itself.

### Autoscaling Stack
- **HPA** — scales Pod replicas on CPU/memory or custom metrics
- **VPA** — right-sizes resource requests based on actual usage (use in recommendation mode first)
- **KEDA** — event-driven autoscaling on Kafka lag, SQS depth, Prometheus metrics, etc.
- **Cluster Autoscaler** — adds/removes nodes based on pending Pods
- **Karpenter** (AWS) — provisions nodes directly, chooses optimal instance type per workload, seconds faster than Cluster Autoscaler

### Observability Stack
- Prometheus + Alertmanager (metrics + alerting)
- Grafana (dashboards)
- Loki (log aggregation without indexing all fields)
- Tempo / Jaeger (distributed tracing)
- kube-state-metrics (K8s object metrics — replica counts, pod states)
- node-exporter (node OS metrics)

---

## 🏗️ Architecture Patterns

### Multi-Tenant Cluster vs Multi-Cluster

**Multi-tenant single cluster:** isolate via namespaces + RBAC + NetworkPolicies + ResourceQuotas. Cheaper, simpler. Risk: noisy neighbor, shared blast radius.

**Multi-cluster:** hard isolation, independent failure domains, compliance boundary. Manage with Cluster API, ArgoCD ApplicationSets, or Flux multi-tenancy. Complexity: cross-cluster service discovery, federated monitoring.

Staff engineer rule: one cluster per environment (dev/staging/prod) minimum. Separate clusters per regulated workload or BU when compliance requires.

### Blue/Green Deployment

Two identical production environments. Traffic switches from Blue (current) to Green (new) atomically. Rollback = switch back. Requires double resources during transition. Implement in K8s: two Deployments + Service selector change, or Argo Rollouts `BlueGreen` strategy.

### Canary Deployment

Route a small percentage of traffic to the new version, gradually increase if metrics hold. Tools: **Argo Rollouts** (automated canary with metric analysis gate), **Flagger** (works with Nginx/Istio), manual with weighted Ingress annotations.

### GitOps Directory Structure

```
clusters/
  production/
    apps/           # Helm releases or Kustomize overlays per team
    infrastructure/ # cluster-level add-ons (cert-manager, external-dns, etc.)
  staging/
    ...
```

### Service Mesh Patterns

**Sidecar mesh** (Istio classic, Linkerd): Envoy/Linkerd-proxy injected into every Pod. Provides mTLS, traffic management, observability transparently.

**Ambient mesh** (Istio 1.21+): ztunnel per node + waypoint proxies per service — no sidecar overhead, ~1/10th the resource cost.

When to use a mesh: when you need mTLS between services without code changes, per-service traffic policies (circuit breaking, retries, timeouts), or L7 observability without app instrumentation.

---

## ⚙️ Production Operations & Day-2

### Cluster Upgrades

Never skip minor versions. Upgrade path: control plane first, then node groups rolling. Key risks:
- API deprecations — check with `pluto` before upgrading
- Admission webhook compatibility — webhooks for old API versions break
- PodDisruptionBudget conflicts block draining

Test upgrades in staging first. Drain nodes with `kubectl drain --ignore-daemonsets --delete-emptydir-data`.

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 2   # or maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
```

Never set `minAvailable` equal to `replicas` — you'll block all voluntary drains.

### Health Probes

```yaml
livenessProbe:    # restart container if fails
  httpGet: {path: /healthz, port: 8080}
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:   # remove from Service endpoints if fails
  httpGet: {path: /ready, port: 8080}
  periodSeconds: 5
startupProbe:     # for slow-starting apps; disables liveness until passes
  httpGet: {path: /healthz, port: 8080}
  failureThreshold: 30
  periodSeconds: 10
```

Critical: never make liveness probes check external dependencies — you'll cause cascading restarts during downstream outages.

### Rolling Update Tuning

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # extra Pods during update
    maxUnavailable: 0  # zero-downtime guarantee
minReadySeconds: 30    # ensure stability before proceeding
progressDeadlineSeconds: 300  # fail fast if rollout stalls
```

---

## 📊 Observability & Debugging

### Critical PromQL Queries

```promql
# CrashLoopBackOff / restarts
increase(kube_pod_container_status_restarts_total[1h]) > 5

# Deployment replicas unavailable
kube_deployment_status_replicas_unavailable > 0

# CPU throttling (>25% is a problem)
rate(container_cpu_cfs_throttled_seconds_total[5m])
  / rate(container_cpu_cfs_periods_total[5m]) > 0.25

# Memory approaching OOMKill territory
container_memory_working_set_bytes
  / container_spec_memory_limit_bytes > 0.8

# PVC almost full
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
```

### Debugging Runbook

**Pod Pending:**
1. `kubectl describe pod <pod>` → Events section
2. Insufficient resources? → `kubectl describe node`
3. Taint/affinity mismatch? → check node labels vs pod spec
4. Image pull? → check imagePullSecrets and registry access

**CrashLoopBackOff:**
1. `kubectl logs <pod> --previous` — logs from crashed container
2. Exit code 137 = OOMKilled, 139 = segfault, 1 = app crash
3. Temporarily: `command: ["sleep", "3600"]` to inspect without crash

**Service not routing:**
1. `kubectl get endpoints <svc>` — if empty, no ready Pods match the selector
2. Test: `kubectl run tmp --image=busybox --rm -it -- wget -O- svc-name`
3. NetworkPolicy blocking? — check with `kubectl describe networkpolicy`

**DNS latency:**
- `ndots:5` (default) causes 5 DNS lookups per hostname — set `dnsConfig: {options: [{name: ndots, value: "2"}]}` in pod spec
- Scale coredns, add NodeLocal DNSCache for high-traffic clusters

---

## 🔐 Security Considerations

### RBAC Hardening

- Never bind `cluster-admin` to application service accounts
- Create a ServiceAccount per workload, not per namespace
- Audit quarterly: `kubectl auth can-i --list --as=system:serviceaccount:ns:sa`
- Remove unused ClusterRoleBindings: `kubectl get clusterrolebinding -o json | jq` to find bindings to deleted subjects

### Pod Security Standards

Enforce at namespace level:
```yaml
labels:
  pod-security.kubernetes.io/enforce: restricted
  pod-security.kubernetes.io/warn: restricted
```

For advanced policies use **Kyverno** (YAML-based, easier) or **OPA/Gatekeeper** (Rego, more powerful). Use Kyverno to:
- Require specific labels on all Pods
- Block `latest` image tags
- Enforce read-only root filesystem
- Verify Cosign image signatures

### Network Policies — Default Deny

```yaml
# Deny all ingress and egress in a namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

Then whitelist only needed traffic. Requires a CNI that enforces NetworkPolicies (Cilium, Calico — not Flannel).

### Secrets Management

Never store raw Secrets in Git. Prefer:
1. **External Secrets Operator** — pull from AWS SM / GCP Secret Manager / Vault, create K8s Secrets
2. **Sealed Secrets** (Bitnami) — encrypt in Git, decrypt in cluster
3. **CSI Secrets Store Driver** — mount secrets directly from Vault as volumes

### Supply Chain Security

- Sign images with **Cosign** (Sigstore)
- Scan images in CI with **Trivy** or **Grype**
- Enforce signed images via Kyverno policy
- Generate and attest **SBOMs** (CycloneDX/SPDX)
- Use **SLSA framework** for build provenance

---

## 🎓 Staff/Principal Engineer Perspective

### Platform Design Decisions

**Node group strategy:** multiple node groups — general-purpose, compute-optimized, GPU, and spot/preemptible (with tolerations). Never put stateful workloads on spot.

**Label taxonomy:** enforce `app`, `team`, `env`, `version`, `tier` labels on all workloads via Kyverno. This powers cost allocation, alerting routing, and network policies at scale.

**API server access:** never expose to the public internet. Use VPN, bastion, or SSO-integrated proxy (Teleport, Boundary) for kubectl access.

**Ingress strategy:** one ingress controller per cluster for external traffic; internal traffic via Gateway API or service mesh. Avoid proliferating load balancers.

### Capacity Planning

1. Measure actual usage via VPA recommendations over 2-4 weeks
2. Set requests at p95 usage, limits at 1.5-2x requests for CPU, 1.2x for memory
3. Target 60-70% average cluster utilization (headroom for spikes and autoscaling delay)
4. Use bin-packing simulation before adding nodes — often reshuffling fills gaps

### When to Write an Operator

Write an operator when: the operational logic (failover, backup, restore, scaling decisions) is complex enough that a human runbook exists for it. If humans are following a checklist to operate it, encode that checklist in a controller. Do not write operators for simple configuration — use Helm/Kustomize.

---

## 💥 Failure Modes & Incident Patterns

### etcd Quorum Loss

**Signal:** API server returns 500s, all mutations fail, cluster frozen
**Root cause:** 3-node etcd — losing 2 nodes loses quorum; losing 1 node = degraded but functional
**Recovery:** restore from etcd backup (`etcdctl snapshot restore`)
**Prevention:** dedicated etcd nodes, monitor disk I/O latency (<10ms target), daily snapshots via Velero or etcdctl cron

### Cascading OOMKill

**Signal:** multiple Pods restarting, node memory pressure events, eviction notices
**Root cause:** one workload with no memory limit consuming all node memory, triggering eviction of everything else
**Debug:** `kubectl top nodes && kubectl top pods -A --sort-by=memory`
**Prevention:** LimitRange defaults per namespace, ResourceQuota caps, VPA recommendations

### DNS Resolution Failure

**Signal:** intermittent "connection refused" on service names, works sometimes
**Root cause:** coredns overloaded or crashing; ndots:5 causing 5x DNS queries per lookup
**Fix:** scale coredns to 2+ replicas + HPA; set `ndots: 2`; NodeLocal DNSCache

### Node NotReady Cascade

**Signal:** node goes NotReady, Pods become Unknown, evicted, cluster short on capacity
**Risk:** if remaining nodes lack capacity, Pods stay Pending
**Prevention:** overprovisioner DaemonSet holding spare capacity; Karpenter tuned to add nodes ahead of need
**Response:** cordon bad node, drain manually, investigate with `kubectl describe node`

### Image Pull Backoff at Scale

**Signal:** mass deployment where all Pods fail ImagePullBackOff simultaneously
**Causes:** rate limiting (Docker Hub 100 pulls/6h per IP), registry down, expired credentials
**Prevention:** use pull-through cache (Harbor, ECR Public mirroring), cluster-scoped imagePullSecrets

---

## 💼 Interview & Design Review Prep

**"Design a multi-tenant Kubernetes platform for 50 engineering teams"**
Namespace-per-team, RBAC per team, NetworkPolicies default-deny, ResourceQuotas, LimitRanges, separate node groups per tier, Kyverno for policy enforcement, GitOps-based namespace provisioning with ApplicationSets, cost showback via label-based billing.

**"How do you handle a Kubernetes cluster upgrade with zero downtime?"**
PDB audit first, API deprecation check with `pluto`, webhook compatibility review, canary upgrade of one non-critical node group, validate with automated test suite, roll forward or rollback plan documented.

**"Explain Kubernetes networking from a Service hit to Pod response"**
DNS (coredns) → ClusterIP VIP → iptables/IPVS on node (kube-proxy) → CNI routes to Pod IP → eBPF bypass with Cilium (no iptables).

**"When StatefulSet vs Deployment?"**
StatefulSet when you need: stable Pod hostname (for peer discovery), ordered rolling updates, per-Pod PVCs. Not just "for databases" — understand the operational implications (slower upgrades, riskier rollbacks).

**"What happens when a node runs out of memory?"**
kubelet starts evicting Pods by QoS class (BestEffort first, then Burstable, then Guaranteed). Linux OOM killer can kill any process. Container memory limit triggers OOMKill before node eviction. PriorityClass affects eviction order.

---

## 📚 Key Takeaways

1. **Set resource requests on everything** — the scheduler is blind without them; omitting them causes random evictions
2. **Memory limits = OOMKill boundary** — set conservatively (1.2x typical); CPU limits = throttling (sometimes better unset for latency-sensitive apps)
3. **Readiness probes protect users** — a not-ready Pod is removed from Service endpoints before it receives traffic
4. **Liveness probes must only check the app itself** — external dependency checks cascade into cluster-wide restarts during downstream incidents
5. **PodDisruptionBudgets are mandatory** — without them, node drains take down your entire deployment silently
6. **Network Policies default-deny** — "allow all" is a lateral movement playground; enforce default-deny per namespace
7. **RBAC: least privilege always** — audit quarterly, remove unused bindings, never cluster-admin for app service accounts
8. **GitOps everything** — if it's not in Git, it will drift; manual kubectl applies are the enemy of reproducibility
9. **etcd is your most critical dependency** — back it up, monitor disk latency, never co-locate with workloads
10. **Topology spread constraints > pod anti-affinity at scale** — anti-affinity with `required` fails when replicas exceed nodes
11. **CNI choice determines capabilities** — Cilium with eBPF unlocks NetworkPolicies, observability, and performance that Flannel cannot
12. **VPA for right-sizing, HPA for scaling, Karpenter for node provisioning** — each addresses a different timescale of elasticity
13. **Namespace-per-team is the standard isolation boundary** — gives RBAC, NetworkPolicy, and ResourceQuota scopes cleanly
14. **Image scanning in CI is non-negotiable** — don't wait until admission time; fail builds on critical CVEs
15. **Understand the scheduler's two-phase decision** — filtering then scoring; debugging pending Pods = tracing which filter eliminated which nodes



---

## 📁 Source Documents

> 78 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[YAML] 1741101150289](http://localhost:8765/api/documents/0763345b-9cc6-4695-bb31-8a413b7d3eb7/view) | JPG | beginner |
| [[YAML] 1742640870928](http://localhost:8765/api/documents/0c24e94f-d567-470c-ae8d-4214256dfc28/view) | PDF | intermediate |
| [[Kubernetes] 1741095747287](http://localhost:8765/api/documents/84162503-8633-4273-ab6d-a83bdf4baf45/view) | PDF | intermediate |
| [[Kubernetes] 1741102889434](http://localhost:8765/api/documents/ec247096-f938-4937-9c44-0ff541a66aeb/view) | PDF | intermediate |
| [[Kubernetes] 1741149594589](http://localhost:8765/api/documents/e10780cf-f33c-48cc-8ee4-c3a00705087c/view) | PDF | intermediate |
| [[Kubernetes] 1741167692293](http://localhost:8765/api/documents/3f7fcd3f-a14d-419b-80d1-291bf19cdd1d/view) | PDF | intermediate |
| [[Kubernetes] 1741239475857](http://localhost:8765/api/documents/63365acd-21b9-4c42-a505-7aa7d92a34ce/view) | PDF | beginner |
| [[Kubernetes] 1741258263177](http://localhost:8765/api/documents/8ea643f9-1929-44b1-9741-72c0e878d8c3/view) | PDF | intermediate |
| [[Kubernetes] 1741325461216](http://localhost:8765/api/documents/6a3ba03c-723b-44cc-a3d0-443b3e56ab8e/view) | GIF | intermediate |
| [[Kubernetes] 1741330786433 (1)](http://localhost:8765/api/documents/9dd0956d-b452-455a-b28b-3f4f0e86bbb6/view) | PDF | intermediate |
| [[Kubernetes] 1741353697270](http://localhost:8765/api/documents/af71e8c3-ee2f-4133-950e-344a825f8240/view) | PDF | intermediate |
| [[Kubernetes] 1741708512856](http://localhost:8765/api/documents/29060f69-20da-4194-a250-8bd5c005392b/view) | PDF | intermediate |
| [[Kubernetes] 1741887252314](http://localhost:8765/api/documents/1c58f142-c2f0-4ffe-a775-be37aeec6fb2/view) | PDF | intermediate |
| [[Kubernetes] 1741953012538](http://localhost:8765/api/documents/de22ee50-ab6a-4e01-bb0f-481acdde5a34/view) | PDF | intermediate |
| [[Kubernetes] 1742254319349 (1)](http://localhost:8765/api/documents/72ef62ee-fe99-45de-bd2b-bfcfcc016293/view) | PDF | intermediate |
| [[Kubernetes] 1742269496281](http://localhost:8765/api/documents/0d9cdabe-b78c-4ab9-84f4-da69a3359205/view) | PDF | intermediate |
| [[Kubernetes] 1742281567529](http://localhost:8765/api/documents/bb1b71ef-49fb-47d9-bf8c-1ddc74d266b1/view) | GIF | intermediate |
| [[Kubernetes] 1742324778660](http://localhost:8765/api/documents/6302cdd5-0ce9-4dcd-ab0e-3f7a5a1943af/view) | PDF | intermediate |
| [[Kubernetes] 1742533220544](http://localhost:8765/api/documents/de5755bc-9e04-4f0f-96d6-2ac3f83b3b67/view) | PDF | intermediate |
| [[Kubernetes] 1742571885389](http://localhost:8765/api/documents/8413e65f-cc1e-4822-be57-d46cf4de012b/view) | PDF | intermediate |
| [[Kubernetes] 1742747384780](http://localhost:8765/api/documents/ce7aab5d-66d2-452d-9713-608cf4439a9e/view) | PDF | intermediate |
| [[Kubernetes] 1742823322343](http://localhost:8765/api/documents/40040743-798d-4514-973c-873217926bb4/view) | PDF | beginner |
| [[Kubernetes] 1742921538384](http://localhost:8765/api/documents/8f942cd3-771b-4a9f-8736-6684d326aa20/view) | PDF | intermediate |
| [[Kubernetes] 1742923258007](http://localhost:8765/api/documents/b34e284d-4155-42de-bab8-164bfa11e767/view) | PDF | intermediate |
| [[Kubernetes] 1743072352580](http://localhost:8765/api/documents/68ac8f4c-e828-4f58-99a1-27db114eec3b/view) | PDF | intermediate |
| [[Kubernetes] 1743280088003](http://localhost:8765/api/documents/f3891df5-7bcc-47b5-9007-b100d1d9fd3b/view) | PDF | intermediate |
| [[Kubernetes] 1743355090197](http://localhost:8765/api/documents/415a9a5c-8d7b-4e28-ba08-8aa87179e00d/view) | PDF | intermediate |
| [[Kubernetes] 1743361267384](http://localhost:8765/api/documents/35cab6d2-697e-4562-87bd-8e6866ad5720/view) | PDF | intermediate |
| [[Kubernetes] 1743628693724](http://localhost:8765/api/documents/920537c9-40e1-4dd9-84c8-47de9b07ffc4/view) | PDF | intermediate |
| [[Kubernetes] 1744261492287](http://localhost:8765/api/documents/3ba1a1f6-c0d1-415b-a6eb-3ac5b16d81ab/view) | PDF | beginner |
| [[Kubernetes] 1745837840384](http://localhost:8765/api/documents/ab435bb0-dec0-4dd4-ac99-7cf70ad875bf/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1736795283771](http://localhost:8765/api/documents/f3f00b94-6e86-4300-a6b5-ebcaa2e961d7/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1736880592922](http://localhost:8765/api/documents/3feded2c-144a-47e6-9d5e-177251c58173/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1741147505221](http://localhost:8765/api/documents/8db7a727-cd65-4a18-a4e4-e160629be880/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1741686395974](http://localhost:8765/api/documents/669fcffa-8e9a-4ba3-86a4-b9db767e6fd5/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1741969009002](http://localhost:8765/api/documents/dd4af774-f259-4c63-ba36-26cdb7bad3bd/view) | PDF | intermediate |
| [[Interview Ouestions > Docker] 1742205608551](http://localhost:8765/api/documents/2d7f4760-478e-4ee8-bbe2-18fcdc70e077/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1739541540049](http://localhost:8765/api/documents/4b204b02-2d98-4097-8c36-dccb99b04626/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1740405967614](http://localhost:8765/api/documents/6c8ca612-f4e7-4be2-afc0-434973f50008/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1740921962667](http://localhost:8765/api/documents/db011d72-a6ab-4954-9d3b-35ae8a2a25d0/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1742750338289](http://localhost:8765/api/documents/b67b95c6-b271-4329-8a24-3ecef3990b7b/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1743042332296](http://localhost:8765/api/documents/dd86e906-6312-4746-9393-c38d997f28dd/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1743441083484](http://localhost:8765/api/documents/5a8c83db-a855-4c1a-849e-a9af1dd72a37/view) | PDF | intermediate |
| [[Interview Ouestions > Kubernetes] 1744891698326](http://localhost:8765/api/documents/cb5623d0-1287-40c9-9ebc-cd8c5bc5b19d/view) | PDF | intermediate |
| [[Kubernetes] 1717503585809](http://localhost:8765/api/documents/a6cec7b3-430e-4ad7-9498-7ed90c3be49f/view) | PDF | intermediate |
| [[Kubernetes] 1719557894638](http://localhost:8765/api/documents/36efe1b3-5660-4783-b33c-1049f232d142/view) | PDF | intermediate |
| [[Kubernetes] 1736433021890](http://localhost:8765/api/documents/d34d112a-e429-4aa0-9994-a297dfd986e0/view) | PDF | intermediate |
| [[Kubernetes] 1736856953612](http://localhost:8765/api/documents/b4f0122d-2565-4fff-b2db-b61b0e0d9309/view) | PDF | intermediate |
| [[Kubernetes] 1736866945236](http://localhost:8765/api/documents/9ce823b6-31bc-47a7-be8b-99df802656d6/view) | PDF | intermediate |
| [[Kubernetes] 1737326035262](http://localhost:8765/api/documents/c4d03bb2-721e-481e-bbf9-c1f11c9f3a03/view) | GIF | intermediate |
| [[Kubernetes] 1738159144258](http://localhost:8765/api/documents/c55b1b0a-d218-4e59-a09a-fae8d7fca19f/view) | PDF | intermediate |
| [[Kubernetes] 1738245419180](http://localhost:8765/api/documents/0d1a8323-2223-4c9b-bc12-00251575f143/view) | PDF | intermediate |
| [[Kubernetes] 1738591066510](http://localhost:8765/api/documents/84bb0b81-fd42-41f0-b385-0d4b5fbfe065/view) | PDF | intermediate |
| [[Kubernetes] 1739379391215](http://localhost:8765/api/documents/b380a7a8-6b88-4680-aad0-efba4050aa66/view) | GIF | intermediate |
| [[Kubernetes] 1739530210618](http://localhost:8765/api/documents/5ebf22e6-ad53-4fc8-80fd-01aead1c3946/view) | PDF | intermediate |
| [[Kubernetes] 1739963028519](http://localhost:8765/api/documents/16a17431-c9ba-4e64-bd90-d3fe63a4c3c9/view) | PDF | intermediate |
| [[Kubernetes] 1740492056444](http://localhost:8765/api/documents/30e6bfcc-3d23-4a2a-bd9a-2472bb05c216/view) | GIF | intermediate |
| [[Kubernetes] 1740742219518](http://localhost:8765/api/documents/ea3509fb-feda-4b42-9c98-8c642fb7d92c/view) | PDF | intermediate |
| [[Kubernetes] 1740824736005](http://localhost:8765/api/documents/5215fa34-a9f9-406e-b7bf-355536c6798f/view) | PDF | intermediate |
| [[Kubernetes] 1740979480286](http://localhost:8765/api/documents/f6d2539d-b49f-48f9-b607-79d6abdc7480/view) | PDF | intermediate |
| [[Kubernetes] 1741073678992](http://localhost:8765/api/documents/a0112233-176f-4152-8a80-fd284b42faf2/view) | GIF | intermediate |
| [[Docker] 1736927454677](http://localhost:8765/api/documents/69fbdde1-f9cc-4df0-b10a-caf21b220288/view) | PDF | intermediate |
| [[Docker] 1736939131729](http://localhost:8765/api/documents/0557ae71-e08e-4c64-83a1-e2cde513e12a/view) | PDF | intermediate |
| [[Docker] 1737554157298](http://localhost:8765/api/documents/59051f3f-113b-45dd-8335-2a426d853838/view) | PDF | intermediate |
| [[Docker] 1738677163164](http://localhost:8765/api/documents/f06b248f-078f-4dca-8c17-d022cf085976/view) | PDF | intermediate |
| [[Docker] 1738938227300](http://localhost:8765/api/documents/ecca5553-f780-48f8-8444-c03cce24e8c3/view) | PDF | intermediate |
| [[Docker] 1739261920814](http://localhost:8765/api/documents/194a1c3a-563b-472b-94f9-340a26751659/view) | PDF | intermediate |
| [[Docker] 1740751168249](http://localhost:8765/api/documents/cbee64db-1ae1-4b8d-8c94-1cc519d6a6eb/view) | PDF | intermediate |
| [[Docker] 1740979437189](http://localhost:8765/api/documents/f8e37b78-96ef-4156-991b-f18690829e4f/view) | JPG | intermediate |
| [[Docker] 1741000667405](http://localhost:8765/api/documents/63917ba3-c41b-421c-a257-eff9c7329c77/view) | PDF | intermediate |
| [[Docker] 1741214436567](http://localhost:8765/api/documents/46d3b90f-83d6-4725-82d3-6bee8c9e6b90/view) | PDF | intermediate |
| [[Docker] 1741973139563](http://localhost:8765/api/documents/e9f01cdc-20b1-4978-9bc5-b1510beb1549/view) | PDF | intermediate |
| [[Docker] 1742446814220](http://localhost:8765/api/documents/591075bb-4dd2-46cb-946e-61ede9cfb201/view) | PDF | intermediate |
| [[Docker] 1742487600744](http://localhost:8765/api/documents/e000b4c7-e0b5-4817-b295-04a236cc6093/view) | PDF | intermediate |
| [[Docker] 1742500180459](http://localhost:8765/api/documents/5ced4a7b-b79c-4815-b872-cbf341bdb98d/view) | PDF | intermediate |
| [[Docker] 1742712971087](http://localhost:8765/api/documents/2ceea25d-8174-43b4-ad3f-e3499ab50133/view) | PDF | intermediate |
| [[Docker] 1743138004963](http://localhost:8765/api/documents/96653fb8-2177-454b-b4a5-ba1b9e4b5ed8/view) | PDF | intermediate |
| [[Docker] 1743707910064](http://localhost:8765/api/documents/87a33c7b-5e45-4e5e-bbf4-c354ce15d7df/view) | PDF | intermediate |


<AIChatWidget domain="kubernetes-containers" title="Ask AI about Kubernetes & Containers" />
