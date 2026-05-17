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

---

## [SRE] Foundations: Kubernetes Networking Deep Dive Premium Teaching Guide

## Foundations: Kubernetes Networking Deep Dive Premium Teaching Guide

Kubernetes networking is where Linux networking, container networking, DNS, load balancing, policy, cloud networking, and service discovery meet.

If you can explain the packet path, you can debug the packet path.

This guide teaches Kubernetes networking from first principles to production-grade troubleshooting.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — Pod IPs, Services, DNS, Ingress.
2. **Intermediate Layer** — CNI, EndpointSlices, kube-proxy, NetworkPolicy.
3. **Advanced Layer** — eBPF, conntrack, overlays, native routing, MTU, SNAT.
4. **Production SRE Layer** — DNS failures, Service failures, ingress 502s, one-node bugs.
5. **Interview Layer** — explain traffic paths without vague “CNI issue” answers.

---

## Memory Palace: Kubernetes Is A City

| Concept | City Analogy | Meaning |
|---|---|---|
| Cluster | City | Whole platform network |
| Node | Building | Worker host |
| Pod | Apartment | Workload network namespace |
| Pod IP | Apartment address | Direct workload address |
| Service | Public phone number | Stable virtual access |
| EndpointSlice | Apartment directory | Ready backend list |
| CoreDNS | City directory desk | Name resolution |
| CNI | Road crew | Pod networking implementation |
| kube-proxy/eBPF | Traffic dispatcher | Service translation |
| Ingress | City gate | External HTTP entry |
| NetworkPolicy | Access rules | Traffic authorization |
| Conntrack | Visitor logbook | Kernel flow tracking |

---

## Beginner Layer: Kubernetes Networking Requirements

Kubernetes expects:

1. every Pod has its own IP
2. Pods can reach Pods across nodes
3. nodes can reach Pods
4. containers inside a Pod share localhost
5. Services provide stable access to changing Pods

The CNI plugin makes this real.

---

## Beginner Layer: Pod Networking

A Pod usually has its own Linux network namespace.

Containers in the same Pod share:

- IP address
- port space
- localhost
- network interfaces

This means two containers in the same Pod cannot bind the same port.

Useful commands:

```bash
kubectl get pods -o wide
kubectl exec -it POD -- ip addr
kubectl exec -it POD -- ip route
```

---

## Beginner Layer: Service And EndpointSlice

Pods are temporary. Services are stable.

A Service selects ready Pods using labels.

```bash
kubectl get svc
kubectl describe svc api
kubectl get endpointslice -l kubernetes.io/service-name=api -o yaml
```

A Service with no ready endpoints cannot send useful traffic.

Common causes:

- selector mismatch
- readiness probe failing
- Pods terminating
- wrong namespace

---

## Beginner Layer: DNS And CoreDNS

CoreDNS resolves Service names.

```text
api.default.svc.cluster.local -> Service ClusterIP
```

Commands:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system deploy/coredns
kubectl exec -it POD -- cat /etc/resolv.conf
kubectl exec -it POD -- nslookup kubernetes.default
```

Common DNS failures:

- CoreDNS down or overloaded
- NetworkPolicy blocks DNS
- upstream resolver broken
- bad search domains
- `ndots` causing query amplification

---

## Intermediate Layer: Same-Node Pod Traffic

Typical path:

```text
Pod A eth0 -> veth -> bridge/eBPF/datapath -> veth -> Pod B eth0
```

Failures may involve:

- app not listening
- veth missing
- CNI datapath broken
- policy drop
- local firewall state

---

## Intermediate Layer: Cross-Node Pod Traffic

Two major models:

| Model | Meaning | Tradeoff |
|---|---|---|
| Overlay | encapsulate Pod packets between nodes | easier setup, MTU overhead |
| Native routing | network routes Pod CIDRs directly | efficient, needs network support |

Overlay examples:

- VXLAN
- Geneve

Native/eBPF examples:

- Cilium native routing
- cloud VPC CNI models

---

## Intermediate Layer: CNI Responsibilities

CNI configures Pod networking.

Responsibilities:

- create Pod interface
- assign IP
- set routes
- configure datapath
- apply policy if supported

Popular CNIs:

- Calico
- Cilium
- Flannel
- AWS VPC CNI
- Azure CNI
- GKE Dataplane

Debug:

```bash
kubectl get pods -n kube-system
kubectl logs -n kube-system -l k8s-app=cilium
kubectl logs -n kube-system -l k8s-app=calico-node
```

---

## Intermediate Layer: Service Datapath

A ClusterIP is usually virtual.

Traffic to ClusterIP is translated to a backend Pod.

Implementations:

| Implementation | How it works |
|---|---|
| iptables | NAT rules created by kube-proxy |
| IPVS | kernel load balancing tables |
| eBPF | programmable kernel datapath |

Useful checks:

```bash
iptables-save | grep KUBE-SVC
iptables-save | grep KUBE-SEP
```

For Cilium:

```bash
cilium service list
cilium endpoint list
hubble observe --follow
```

---

## Intermediate Layer: Ingress Path

Common external path:

```text
Internet -> Cloud Load Balancer -> Ingress Controller -> Service -> EndpointSlice -> Pod
```

Debug:

```bash
kubectl get ingress -A
kubectl describe ingress NAME
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller
kubectl get svc
kubectl get endpointslice
```

Common failures:

- DNS points to wrong load balancer
- certificate or SNI mismatch
- host/path rule mismatch
- Service port wrong
- no ready endpoints
- NetworkPolicy blocks ingress controller

---

## Advanced Layer: NetworkPolicy

NetworkPolicy controls Pod traffic.

Default is often allow-all until policies select Pods.

Once a Pod is selected by ingress or egress policy, traffic in that direction must be explicitly allowed.

Common mistake:

> Egress default-deny without allowing DNS.

Remember DNS uses TCP and UDP 53.

---

## Advanced Layer: ndots Trap

Pods often use `ndots:5`.

Short external names may trigger multiple cluster-domain lookups before external resolution.

Symptoms:

- external calls slow
- high CoreDNS QPS
- DNS latency in p95/p99

Mitigations:

- use fully qualified names where appropriate
- tune `dnsConfig` carefully
- cache intentionally

---

## Advanced Layer: Conntrack

Linux conntrack tracks flows for NAT and firewall state.

If exhausted, new connections may fail while old ones continue.

Debug:

```bash
conntrack -S
sysctl net.netfilter.nf_conntrack_max
ss -s
```

Symptoms:

- intermittent new connection failures
- DNS timeouts
- Service access flaky under load

---

## Advanced Layer: MTU And Overlay Networking

Overlay networks add encapsulation overhead.

If MTU is wrong:

- small packets work
- large packets hang
- TLS appears flaky
- uploads fail mysteriously

Debug:

```bash
ping -M do -s 1472 TARGET
tracepath TARGET
```

---

## Advanced Layer: Pod To External Traffic

Pod egress may involve:

```text
Pod -> node datapath -> SNAT/NAT gateway -> firewall/security group -> external service
```

Common failures:

- egress NetworkPolicy
- cloud firewall/security group
- NAT port exhaustion
- DNS/upstream resolver
- external allowlist expects node or NAT IP

---

## Advanced Layer: Service Mesh Layer

Service mesh can affect:

- mTLS
- retries
- timeouts
- circuit breaking
- routing
- telemetry

Debug question:

> Is this Kubernetes networking, app networking, or mesh policy?

---

## Production SRE Layer: Troubleshooting By Symptom

### Pod Cannot Resolve DNS

```bash
kubectl exec POD -- cat /etc/resolv.conf
kubectl exec POD -- nslookup kubernetes.default
kubectl logs -n kube-system deploy/coredns
kubectl get networkpolicy -A
```

Likely causes:

- CoreDNS unavailable
- egress policy blocks DNS
- upstream resolver issue
- node-local DNS problem

### Pod Cannot Reach Service

```bash
kubectl get svc SERVICE
kubectl get endpointslice -l kubernetes.io/service-name=SERVICE
kubectl exec POD -- curl -v http://SERVICE:PORT
kubectl exec POD -- curl -v http://POD_IP:PORT
```

Interpretation:

- PodIP works but Service fails: Service/datapath problem
- both fail: backend app, policy, route, or listener problem

### Ingress Returns 502

Check:

```bash
kubectl describe ingress NAME
kubectl get svc SERVICE
kubectl get endpointslice -l kubernetes.io/service-name=SERVICE
kubectl logs -n INGRESS_NS deploy/CONTROLLER
```

Likely causes:

- no ready endpoints
- wrong targetPort
- app not listening
- health/readiness mismatch
- policy blocked ingress controller

### Only One Node Has Failures

Check:

```bash
kubectl get pods -o wide
kubectl describe node NODE
ip route
conntrack -S
journalctl -u kubelet -n 100
```

Likely causes:

- CNI agent broken
- conntrack issue
- node route issue
- kernel/network state drift

---

## Production SRE Layer: Packet-Path Debugging Method

1. Classify traffic type.
   - Pod to Pod
   - Pod to Service
   - external to Ingress
   - Pod to external
2. Test DNS separately.
3. Test backend Pod IP directly.
4. Test Service name and ClusterIP.
5. Inspect EndpointSlice.
6. Inspect policy.
7. Inspect node datapath.
8. Inspect cloud path if traffic leaves cluster.

Never say “CNI issue” until you prove where the path breaks.

---

## Real Incident Stories

### Service Has No Endpoints

Likely causes:

- label selector mismatch
- readiness failing
- wrong namespace

### DNS Fails Only In One Namespace

Likely cause:

- namespace NetworkPolicy blocks egress to CoreDNS

### New Connections Fail During Spike

Likely causes:

- conntrack exhaustion
- NAT exhaustion
- backend backlog saturation

### Ingress 502 After Deploy

Likely causes:

- readiness too shallow
- wrong targetPort
- app not listening
- backend policy blocked

---

## Command Interpretation Table

| Command | What it answers | Bad signs |
|---|---|---|
| `kubectl get pods -o wide` | Pod placement/IPs | failures scoped to one node |
| `kubectl get svc` | service definition | wrong ports/type |
| `kubectl get endpointslice` | ready backends | empty endpoints |
| `nslookup` from Pod | DNS path | timeout/SERVFAIL |
| `curl Service` vs `curl PodIP` | service vs backend path | Service fails, PodIP works |
| `hubble observe` | Cilium flow/drop visibility | policy/drop reasons |
| `conntrack -S` | kernel flow tracking | drops/insert_failed |
| `tcpdump` | packet truth | SYN no reply, resets |

---

## Labs

### Beginner

1. Create two Pods and curl Pod IP.
2. Create ClusterIP Service.
3. Resolve Service DNS.

### Intermediate

1. Break Service selector.
2. Break readiness probe.
3. Apply NetworkPolicy default deny.
4. Expose through Ingress.

### Advanced

1. Compare PodIP vs Service routing.
2. Inspect iptables or eBPF path.
3. Simulate DNS block.
4. Test MTU behavior.
5. Observe Cilium/Hubble drops.

---

## Interview Layer: Strong Answers

### What happens when a Pod curls a ClusterIP Service?

> DNS may resolve the Service name to ClusterIP. The node datapath then translates the virtual Service IP to one ready backend Pod from EndpointSlice, using iptables, IPVS, or eBPF depending on implementation.

### Why can Service exist but have no endpoints?

> The selector may not match Pods, Pods may not be Ready, or the Service may point at the wrong namespace/labels.

### Why can only new connections fail?

> Existing conntrack entries may continue while new entries fail due to conntrack/NAT/backlog exhaustion.

### How debug ingress 502?

> Trace DNS, load balancer, ingress rule, Service, EndpointSlice, readiness, targetPort, and backend app logs.

---

## Memory Review

- What does CoreDNS return for a ClusterIP Service?
- Why can a Running Pod be absent from EndpointSlice?
- What is overlay vs native routing?
- What does conntrack exhaustion look like?
- Why does MTU matter in overlay networking?

---

## Senior Summary

> I debug Kubernetes networking by classifying the traffic path first, then testing DNS, endpoint selection, Service translation, policy enforcement, node datapath, and cloud egress separately. I avoid vague CNI guesses and use packet-path evidence to isolate the failing layer.

---

## [SRE] Foundations: Kubernetes GPU, AI Platforms, And Operators Zero To Hero

## Foundations: Kubernetes GPU, AI Platforms, And Operators Zero To Hero

GPU workloads on Kubernetes are not just larger Pods. They introduce scarce hardware, expensive scheduling mistakes, model cold starts, distributed training coordination, driver/runtime dependencies, high-performance networking, storage pressure, and deeper observability needs.

This guide is designed as a complete path:

- Beginner: what GPUs are and why AI workloads need them
- Intermediate: GPU scheduling, device plugins, node labels, resource requests
- Advanced: NVIDIA GPU Operator, MIG, topology, NCCL, Kueue/Volcano, operators
- SRE Level: debug ImagePullBackOff, missing GPUs, OOM, bad nodes, slow training, inference latency
- Interview Level: explain GPU platform design and operational tradeoffs clearly

---

## Part 1: Why GPUs Matter For AI Platforms

GPUs accelerate parallel math. AI training and inference use large matrix and tensor operations that GPUs handle much faster than CPUs.

Common workloads:

| Workload | Pattern | SRE concern |
|---|---|---|
| Training | long-running batch jobs | scheduling, checkpoints, failures, throughput |
| Inference | online request serving | latency, warm capacity, model loading, autoscaling |
| Batch inference | offline processing | throughput, cost, queueing |
| Fine-tuning | smaller training jobs | quota, isolation, checkpointing |

GPU mistakes are expensive because idle GPUs cost money even when no useful work happens.

---

## Part 2: Memory Palace — GPU Cluster As A Specialist Hospital Wing

Think of a GPU cluster as a high-cost specialist wing in a hospital.

| GPU platform concept | Hospital analogy | Production meaning |
|---|---|---|
| GPU node | Specialist treatment room | expensive compute host |
| GPU | specialist machine | scarce accelerator |
| GPU memory | machine capacity | HBM/model/KV cache limit |
| Device plugin | equipment registrar | exposes GPUs to kubelet |
| GPU Operator | equipment operations team | installs drivers/runtime/exporters |
| MIG | partitioned machine rooms | hardware GPU slicing |
| Training job | long surgery | coordinated, long-running workload |
| Inference service | emergency response desk | low-latency request serving |
| Checkpoint | saved patient state | restart point for training |
| DCGM exporter | equipment monitor | GPU metrics |

---

## Part 3: Kubernetes Has No Native GPU Magic

Kubernetes sees GPUs as extended resources.

The NVIDIA device plugin advertises GPUs to kubelet.

```bash
kubectl describe node GPU_NODE | grep -A5 nvidia.com/gpu
kubectl get nodes -L nvidia.com/gpu.product
kubectl get pods -A -o wide
```

A Pod requests GPUs like this:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

Important:

- standard GPU resources are not fractional
- requests and limits are effectively the same for GPUs
- scheduler places Pods only on nodes with enough allocatable GPUs
- GPU allocation does not guarantee high utilization

---

## Part 4: Beginner GPU Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-test
spec:
  restartPolicy: Never
  containers:
    - name: cuda
      image: nvidia/cuda:12.2.0-base-ubuntu22.04
      command: ["nvidia-smi"]
      resources:
        limits:
          nvidia.com/gpu: 1
```

Check:

```bash
kubectl logs gpu-test
kubectl describe pod gpu-test
```

If `nvidia-smi` fails, think driver/runtime/device-plugin path.

---

## Part 5: GPU Platform Stack

Typical stack:

```text
GPU hardware
NVIDIA driver
container runtime integration
NVIDIA device plugin
kubelet extended resources
scheduler placement
Pod uses GPU
DCGM exporter exposes metrics
```

Failure at any layer can make GPUs unavailable.

---

## Part 6: NVIDIA GPU Operator

The GPU Operator automates GPU node setup.

It can manage:

- NVIDIA drivers
- container toolkit
- device plugin
- DCGM exporter
- MIG manager
- node feature discovery
- validator jobs

Check operator components:

```bash
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl logs -n gpu-operator deploy/gpu-operator
```

Useful question:

> Are GPUs missing because hardware is missing, driver failed, device plugin failed, or kubelet did not advertise allocatable resources?

---

## Part 7: Node Labels, Taints, And Scheduling

GPU nodes should be labeled.

```bash
kubectl get nodes --show-labels | grep nvidia
```

Common labels:

- `nvidia.com/gpu.product`
- `nvidia.com/gpu.count`
- `nvidia.com/cuda.driver.major`
- `feature.node.kubernetes.io/pci-10de.present`

Schedule to a specific GPU type:

```yaml
nodeSelector:
  nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
```

Use taints to protect GPU nodes:

```bash
kubectl taint nodes gpu-node dedicated=gpu:NoSchedule
```

Then workloads need toleration:

```yaml
tolerations:
  - key: dedicated
    operator: Equal
    value: gpu
    effect: NoSchedule
```

---

## Part 8: MIG — Multi-Instance GPU

MIG partitions supported GPUs into hardware-isolated slices.

Useful when:

- inference workloads do not need a full GPU
- teams need isolation
- you want better utilization

Example resources may appear as:

```text
nvidia.com/mig-1g.10gb
nvidia.com/mig-2g.20gb
```

Tradeoffs:

- better utilization
- stronger isolation than software sharing
- more scheduling complexity
- not ideal for every training workload

---

## Part 9: Training Workloads

Training characteristics:

- long-running
- expensive
- needs checkpoints
- may require many GPUs at once
- network-heavy for distributed training

Distributed training often uses:

- PyTorch DDP
- MPI
- NCCL
- Ray
- Kubeflow Training Operator

Important:

> Partial allocation can waste huge GPU capacity.

If a 4-worker training job needs 8 GPUs per worker, starting only 3 workers is usually useless.

---

## Part 10: Gang Scheduling And Queues

Use Kueue or Volcano for all-or-nothing scheduling.

Without gang scheduling:

- some workers start
- missing workers block progress
- allocated GPUs sit idle

With gang scheduling:

- job waits until all required resources are available
- then starts together

Concepts:

- queue
- quota
- cohort/fair sharing
- admission
- workload priority

---

## Part 11: Topology Matters

GPU placement affects performance.

Fastest to slowest:

1. same GPU memory
2. NVLink/NVSwitch
3. PCIe same host
4. InfiniBand/RDMA cross-node
5. Ethernet cross-node

For training, poor topology can reduce throughput dramatically.

Check topology:

```bash
nvidia-smi topo -m
```

Kubernetes scheduling should consider:

- GPU type
- node locality
- NUMA
- topology spread
- high-speed network availability

---

## Part 12: NCCL, RDMA, And Distributed Training Networking

Distributed training frequently uses NCCL for collective communication.

Important signals:

- all-reduce latency
- network throughput
- RDMA errors
- packet drops
- straggler workers

Debug ideas:

```bash
kubectl logs JOB_POD
nvidia-smi
ibstat
ibv_devinfo
ethtool -S INTERFACE
```

If one worker is slow, the whole training step can slow down.

---

## Part 13: Inference Workloads

Inference characteristics:

- latency-sensitive
- model-load cold starts
- GPU memory bound
- request batching matters
- warm replicas matter

Common servers:

- NVIDIA Triton
- vLLM
- TorchServe
- TensorRT-LLM

Model cold starts can take minutes for large models.

Production rule:

> Do not scale critical inference to zero unless cold-start latency is acceptable.

---

## Part 14: GPU Memory And KV Cache

For LLM inference, GPU memory holds:

- model weights
- KV cache
- activations
- framework/runtime overhead

Large context windows increase KV cache pressure.

Symptoms:

- OOM during inference
- lower batch capacity
- latency spikes
- model server restarts

Mitigations:

- quantization
- tensor parallelism
- smaller context limits
- batching controls
- more GPUs or MIG strategy

---

## Part 15: Observability For GPU Platforms

Use DCGM exporter for NVIDIA GPU metrics.

Important metrics:

- GPU utilization
- memory used/free
- temperature
- power draw
- ECC errors
- XID errors
- throttling
- PCIe/NVLink throughput
- queue wait time
- training throughput
- inference latency
- model load time

Commands:

```bash
nvidia-smi
nvidia-smi dmon
kubectl logs -n gpu-operator ds/nvidia-dcgm-exporter
```

Watch for:

- low GPU utilization with high queue depth
- memory near full
- XID errors
- GPU temperature/power throttling
- high allocation with poor actual utilization

---

## Part 16: Common GPU Failure Modes

### GPU Not Visible On Node

Check:

```bash
lspci | grep -i nvidia
nvidia-smi
kubectl describe node NODE | grep nvidia.com/gpu
```

Likely causes:

- driver not loaded
- hardware issue
- operator failed
- device plugin failed

### Pod Pending

Likely causes:

- insufficient GPUs
- wrong GPU nodeSelector
- missing toleration
- quota/queue admission

### Pod Starts But CUDA Fails

Likely causes:

- image CUDA version incompatible
- runtime not injecting devices
- driver/toolkit mismatch

### Training Slow

Likely causes:

- poor GPU topology
- slow network/all-reduce
- data pipeline bottleneck
- storage throughput bottleneck
- CPU preprocessing bottleneck

### Inference Latency High

Likely causes:

- cold model loads
- GPU memory pressure
- batch size too high/low
- queue buildup
- model server saturation

---

## Part 17: Operators For AI Platforms

An Operator is a Kubernetes controller that manages a complex system using custom resources.

Operator loop:

```text
Watch desired state -> observe actual state -> reconcile difference -> update status
```

Use operators when lifecycle needs domain knowledge.

Examples:

- GPU Operator
- Kubeflow Training Operator
- KServe
- Ray Operator / KubeRay
- Spark Operator
- custom Slurm/Soperator-style controllers

Good operators are:

- idempotent
- status-rich
- safe during retries
- not in the critical data path
- observable

---

## Part 18: Storage And Data For AI Workloads

Training needs fast access to datasets and checkpoint storage.

Options:

- object storage for datasets/checkpoints
- distributed filesystems
- local NVMe cache
- prefetch sidecars/init containers

SRE concerns:

- storage throughput bottlenecks
- checkpoint frequency
- restore time
- data locality
- failed checkpoint corruption

---

## Part 19: Security And Multi-Tenancy

GPU clusters are often shared by teams.

Controls:

- namespaces
- quotas
- node taints
- RBAC
- NetworkPolicy
- image scanning
- private registries
- workload identity
- admission policies

Multi-tenancy question:

> Is Kubernetes namespace isolation enough for this threat model?

For hostile or strong tenant isolation, consider stronger sandboxing or separate clusters.

---

## Part 20: Cost And Capacity Management

GPU platform SREs must think about utilization and fairness.

Track:

- allocated GPUs
- used GPUs
- idle allocated GPUs
- queue wait time
- job success/failure rate
- cost per team/project

Bad pattern:

> 80% allocated GPUs but only 20% actual utilization.

This means scheduling/accounting looks fine, but business value is poor.

---

## Part 21: Real Incident Stories

### GPUs Missing After Node Upgrade

Likely causes:

- driver mismatch
- operator DaemonSet failed
- device plugin not registered

### Expensive Training Job Idle For Hours

Likely cause:

- no gang scheduling; partial workers started

### Inference Outage After Scale Down

Likely cause:

- scaled to zero; large model cold start too slow

### Random Training Failures On One Node

Likely causes:

- bad GPU hardware
- XID errors
- ECC issues
- thermal throttling

---

## Part 22: Command Interpretation Table

| Command | What it answers | Bad signs |
|---|---|---|
| `nvidia-smi` | driver/GPU visibility | no devices, errors |
| `nvidia-smi topo -m` | GPU topology | unexpected slow links |
| `kubectl describe node` | allocatable GPUs | no `nvidia.com/gpu` |
| `kubectl describe pod` | scheduling reason | insufficient GPU, taints |
| GPU Operator pods | platform health | CrashLoop/validator fail |
| DCGM metrics | GPU health/utilization | XID/ECC/temp/throttle |
| Kueue/Volcano status | queue/admission | job waiting/partial issues |

---

## Part 23: Labs

### Beginner

- run `nvidia-smi` in a GPU Pod
- inspect GPU node allocatable resources
- schedule Pod to GPU node

### Intermediate

- taint GPU nodes and add tolerations
- request specific GPU product with nodeSelector
- deploy DCGM exporter and view metrics

### Advanced

- simulate Pending due to insufficient GPUs
- test MIG resource scheduling
- create queued training job
- debug CUDA image/driver mismatch
- analyze low GPU utilization

---

## Part 24: Interview Questions

- Why are GPU workloads different from normal web services?
- How does Kubernetes know a node has GPUs?
- What does the NVIDIA device plugin do?
- What does the GPU Operator manage?
- Why is gang scheduling important?
- What is MIG and when would you use it?
- How would you debug a GPU Pod stuck Pending?
- Why is inference cold start a production problem?
- How do you monitor GPU health?

---

## Part 25: Senior Answer Shape

> I treat GPU platforms as scarce-resource scheduling systems layered on Kubernetes. The device plugin advertises GPUs, the scheduler places Pods based on extended resources and constraints, and the GPU Operator manages drivers, runtime integration, device plugins, MIG, and metrics. For training I care about gang scheduling, topology, checkpointing, and utilization. For inference I care about warm capacity, model load time, GPU memory/KV cache, batching, and latency SLOs. During incidents I separate hardware, driver, runtime, scheduling, application, and data-path failures.

---

## Recall Prompts

- Why are GPUs exposed as extended resources?
- Why is partial scheduling bad for distributed training?
- What does MIG solve?
- Why can GPU allocation look high while utilization is low?
- What layers can cause `nvidia-smi` to fail inside a Pod?

---

## [SRE] Foundations: Docker And Container Runtime Premium Teaching Guide

## Foundations: Docker And Container Runtime Premium Teaching Guide

Containers power modern platforms: Kubernetes, CI runners, batch jobs, developer environments, and many AI workloads.

A container is not a tiny VM. It is usually a Linux process tree isolated with namespaces, limited with cgroups, and started from an image filesystem.

This guide teaches containers from first principles to production-grade runtime operations.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — images, containers, Docker basics.
2. **Intermediate Layer** — Dockerfiles, networking, volumes, registries.
3. **Advanced Layer** — namespaces, cgroups, overlayfs, PID 1, runtimes.
4. **Production SRE Layer** — pull failures, OOM, disk pressure, crash loops.
5. **Interview Layer** — explain containers from Linux internals upward.

---

## Memory Palace: Apartment Building

| Concept | Analogy | Meaning |
|---|---|---|
| Host | Building | Linux machine |
| Image | Blueprint + furniture set | Packaged filesystem |
| Container | Apartment in use | Running isolated process |
| Namespace | Apartment walls | Visibility isolation |
| cgroup | Utility meter | Resource limits |
| Runtime | Building manager | Starts and supervises |
| Registry | Warehouse | Image storage |
| Volume | Storage locker | Persistent data |

---

## Beginner Layer: What A Container Really Is

```text
Image + writable layer + namespaces + cgroups + process = container
```

Important truths:

- containers share the host kernel
- startup is usually faster than VMs
- isolation is strong but different from hardware virtualization
- deleting a container does not delete its image automatically

---

## Beginner Layer: Core Docker Commands

```bash
docker pull nginx:1.25
docker run --name web -p 8080:80 nginx:1.25
docker ps
docker logs web
docker exec -it web sh
docker stop web
docker rm web
```

Distinction:

- image = package
- container = running instance

---

## Beginner Layer: Lifecycle Thinking

```text
build -> push -> pull -> run -> observe -> stop -> remove
```

In production, reliability depends on every stage, not only `docker run`.

---

## Intermediate Layer: Images And Layers

Each Dockerfile instruction often creates a layer.

Good cache order:

1. base image
2. OS deps
3. language deps
4. application code

Why?

Frequent code changes should not invalidate expensive dependency layers.

---

## Intermediate Layer: Better Dockerfiles

Use:

- small trusted base images
- pinned versions
- multi-stage builds
- non-root users
- explicit entrypoints
- `.dockerignore`

Avoid:

- giant build contexts
- secrets in image layers
- unnecessary packages

---

## Intermediate Layer: Multi-Stage Builds

Builder stage compiles. Runtime stage stays small.

Benefits:

- faster pulls
- smaller attack surface
- fewer CVEs
- cleaner runtime image

---

## Intermediate Layer: Volumes And Persistence

Container writable layers are ephemeral.

Use volumes for:

- databases in dev/test
- caches needing persistence
- shared data paths
- backups/export targets

Rule:

> Never treat a container layer as durable production storage.

---

## Intermediate Layer: Networking Basics

Common path:

```text
container eth0 -> veth -> bridge -> host NAT -> network
```

Port publish:

```bash
docker run -p 8080:80 nginx
```

Means host port 8080 forwards to container port 80.

---

## Intermediate Layer: Registries

Use registries for image distribution.

Production habits:

- immutable tags
- digest pinning
- vulnerability scanning
- retention cleanup
- signed images when possible

Avoid production use of mutable `latest`.

---

## Advanced Layer: PID 1 Problem

The container entry process becomes PID 1.

PID 1 must:

- receive signals
- terminate gracefully
- reap zombie child processes

Bad signal handling causes stuck shutdowns and slow rollouts.

Use exec form commands and init wrappers when needed.

---

## Advanced Layer: Namespaces

| Namespace | Isolates |
|---|---|
| PID | processes |
| NET | interfaces/routes/ports |
| MNT | mounts |
| UTS | hostname |
| IPC | shared IPC |
| USER | UID/GID mapping |

Namespaces change what the process can see.

---

## Advanced Layer: cgroups

cgroups control resources.

```bash
docker run --memory=512m --cpus=1.5 app
```

Behavior:

- memory exceeded -> kill/OOM
- CPU exceeded -> throttling
- no limits -> noisy neighbors possible

Kubernetes requests/limits rely on these primitives underneath.

---

## Advanced Layer: Overlay Filesystems

Images are stacked read-only layers plus writable container layer.

Implications:

- image layers reused efficiently
- many small layers can help caching
- logs written inside container consume node disk
- deleting runtime files does not shrink image history

---

## Advanced Layer: Runtime Stack

Modern Kubernetes path:

```text
kubelet -> CRI -> containerd -> runc -> Linux kernel
```

On nodes, `crictl` is often more useful than Docker CLI.

---

## Production SRE Layer: Real Incidents

### ImagePullBackOff

Check:

- wrong tag
- registry auth
- network reachability
- rate limits
- architecture mismatch

### CrashLoopBackOff

Check:

- startup logs
- command/entrypoint
- missing env or secret
- dependency unavailable

### OOMKilled

Check:

- memory limits too low
- leak
- spike load
- heap tuning

### Node Disk Full

Common causes:

- container logs
- old images
- writable layers
- build cache

### Slow Shutdown During Deploy

Likely:

- PID 1 not handling SIGTERM
- grace period too short
- hanging child processes

---

## Production SRE Layer: Troubleshooting Flow

### Container Won’t Start

Check:

- image exists
- command valid
- port conflict
- missing config
- permissions

### App Running But Unreachable

Check:

- listening port
- bind address
- publish mapping
- firewall/network policy

### Resource Starvation

Check:

- limits
- host contention
- cgroup stats
- throttling

---

## Kubernetes Connection

| Container World | Kubernetes World |
|---|---|
| docker run | Pod spec |
| -p publish | Service / Ingress |
| volume mount | volume / PVC |
| restart manually | controller reconciliation |
| memory/cpu flags | requests / limits |

Kubernetes adds orchestration, not magic. Linux primitives still matter.

---

## Interview Layer: Strong Answers

### Why are containers not VMs?

> Containers share the host kernel and isolate processes with kernel primitives instead of virtualizing full hardware.

### Why use multi-stage builds?

> They separate build tooling from runtime image, reducing size and attack surface.

### What happens when memory limit is exceeded?

> The kernel may OOM kill the containerized process.

### Why can shutdowns be slow?

> PID 1 may mishandle signals or child processes may not exit cleanly.

---

## Labs

### Beginner

1. Run nginx.
2. Publish a port.
3. Inspect logs.
4. Exec into container.

### Intermediate

1. Build a Dockerfile.
2. Use a volume.
3. Push to registry.
4. Compare image sizes.

### Advanced

1. Multi-stage build.
2. Run as non-root.
3. Simulate OOM.
4. Inspect namespaces.
5. Debug with crictl on a node.

---

## Memory Review

- Why is an image not a container?
- Why is PID 1 special?
- Why avoid `latest`?
- Why can logs fill node disks?
- Why does Kubernetes still require Linux knowledge?

---

## Senior Summary

> I treat containers as Linux processes packaged with images and controlled by kernel isolation primitives. In production I separate image issues, startup issues, runtime resource limits, networking problems, and node-level storage/runtime failures before taking action.

---

## [SRE] Foundations: YAML And Kubernetes Manifest Design Premium Teaching Guide

## Foundations: YAML And Kubernetes Manifest Design Premium Teaching Guide

YAML is the configuration language most Kubernetes engineers touch every day, but production-quality manifest design is much more than indentation.

A manifest is an operational contract. It tells Kubernetes what to run, how to run it, how to expose it, how to secure it, how to update it, and how to recover when things go wrong.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — YAML syntax and Kubernetes object structure.
2. **Intermediate Layer** — Deployments, Services, ConfigMaps, Secrets, probes, resources.
3. **Advanced Layer** — scheduling, securityContext, NetworkPolicy, PDBs, HPA, Kustomize.
4. **Production SRE Layer** — outage prevention and manifest review.
5. **Interview Layer** — explain safe manifest design clearly.

---

## Memory Palace: Restaurant Order System

| Concept | Analogy | Meaning |
|---|---|---|
| YAML | Order form | Structured config |
| apiVersion/kind | Cuisine + dish type | Kubernetes object identity |
| metadata | Order label | Name, namespace, labels |
| spec | Customer request | Desired state |
| status | Kitchen update | Observed state |
| labels | Table tags | Object grouping |
| selector | Waiter filter | Which objects to target |
| probes | Food quality checks | Health behavior |
| resources | Kitchen allocation | CPU/memory reservation |

---

## Beginner Layer: YAML Basics

YAML uses indentation to express structure.

```yaml
name: checkout
replicas: 3
enabled: true
ports:
  - 80
  - 443
labels:
  app: checkout
  team: payments
```

Spaces matter. Tabs are dangerous.

Quote risky values:

```yaml
version: "1.10"
value: "true"
port: "080"
```

---

## Beginner Layer: Kubernetes Object Anatomy

Most objects look like this:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 3
```

| Field | Meaning |
|---|---|
| apiVersion | API group/version |
| kind | object type |
| metadata | name, namespace, labels, annotations |
| spec | desired state |
| status | observed state |

You write `spec`. Controllers write `status`.

---

## Beginner Layer: Labels And Selectors

Labels connect objects.

A Service finds Pods through selectors.

```yaml
selector:
  app: checkout
```

Common outage:

> Service exists but has no endpoints because selector does not match Pod labels.

---

## Intermediate Layer: Production Deployment Shape

A production Deployment should usually define:

- stable labels
- immutable image tag or digest
- readiness probe
- resource requests
- safe rollout strategy
- security context

Key rule:

> A Deployment should describe behavior during rollout and failure, not only what image to run.

---

## Intermediate Layer: Service Design

```yaml
ports:
  - name: http
    port: 80
    targetPort: 8080
```

`port` is what callers use.

`targetPort` is where the container listens.

Wrong `targetPort` creates confusing traffic failures.

---

## Intermediate Layer: ConfigMaps And Secrets

ConfigMap = non-sensitive config.

Secret = sensitive value container, but not automatically safe unless RBAC and encryption are configured.

Production guidance:

- separate config from code
- do not log secrets
- restrict RBAC
- prefer external secret managers where appropriate

---

## Intermediate Layer: Probes

| Probe | Question |
|---|---|
| startupProbe | Has app finished booting? |
| readinessProbe | Can app receive traffic? |
| livenessProbe | Should app restart? |

Bad pattern:

> Liveness probe checks database health and causes restart storms during DB outage.

Use readiness for dependency readiness. Use liveness for stuck process detection.

---

## Intermediate Layer: Requests And Limits

Requests affect scheduling.

Limits affect runtime enforcement.

Important behavior:

- CPU limit can throttle
- memory limit can OOMKill
- missing requests cause bad scheduling
- HPA needs requests for utilization math

---

## Advanced Layer: Security Context

Production workloads should minimize privilege.

Good defaults:

- run as non-root
- no privilege escalation
- drop Linux capabilities
- read-only root filesystem where practical
- seccomp RuntimeDefault

Security context is part of reliability because compromised workloads become incidents.

---

## Advanced Layer: Scheduling Controls

Use placement intentionally:

- nodeSelector for simple placement
- taints/tolerations for dedicated nodes
- affinity for co-location
- anti-affinity for spreading
- topology spread for zone resilience

Bad placement can turn one-node failure into full service outage.

---

## Advanced Layer: PodDisruptionBudget

PDB protects replicated workloads during voluntary disruption such as node drains.

Without PDBs, maintenance can evict too many replicas at once.

Use with enough replicas. A PDB cannot protect a single replica from downtime.

---

## Advanced Layer: HPA

HorizontalPodAutoscaler needs:

- metrics
- resource requests
- reasonable min/max replicas
- workload that can scale horizontally

Autoscaling bad metrics creates bad automation.

---

## Advanced Layer: NetworkPolicy

NetworkPolicy controls Pod traffic.

Important:

- default allow unless policies select Pods
- egress deny often breaks DNS unless allowed
- policy requires CNI support

Use policy to encode trust boundaries.

---

## Advanced Layer: Kustomize

Use Kustomize for environment overlays.

```text
base/
overlays/dev/
overlays/prod/
```

Avoid copy-pasting entire manifests per environment. Copy-paste creates silent drift.

---

## Production SRE Layer: Manifest Review Checklist

Before approving, check:

- selector matches labels
- image tag/digest is safe
- readiness probe exists
- liveness is not dangerous
- requests/limits make sense
- rollout strategy preserves availability
- securityContext is hardened
- PDB exists for critical replicated services
- configs and secrets are separated
- NetworkPolicy matches trust model

---

## Production SRE Layer: Real Incidents

### Service Has No Endpoints

Likely:

- selector mismatch
- Pods not ready

Check:

```bash
kubectl describe svc api
kubectl get pods --show-labels
kubectl get endpointslice
```

### Rollout Hangs

Likely:

- readiness failing
- image pull error
- insufficient capacity
- bad maxUnavailable/maxSurge

### Restart Storm

Likely:

- liveness too aggressive
- dependency check in liveness
- slow startup without startupProbe

### Node Drain Caused Outage

Likely:

- no PDB
- too few replicas
- replicas concentrated on one node/AZ

---

## Production SRE Layer: Validation Tools

Use:

```bash
kubectl apply --dry-run=server -f file.yaml
kubectl diff -f file.yaml
kubectl explain deployment.spec.template.spec.containers
kubeconform manifest.yaml
kube-score score manifest.yaml
conftest test manifest.yaml
```

Validation catches syntax. Review catches operational risk.

---

## Interview Layer: Strong Answers

### Why are manifests operational contracts?

> They define not only what to run, but how the workload behaves during scheduling, rollout, failure, security enforcement, and recovery.

### Readiness vs liveness?

> Readiness controls traffic eligibility. Liveness controls restart behavior.

### Why avoid `latest`?

> It is mutable and breaks reproducibility and rollback certainty.

### What should every production Deployment include?

> Stable selectors, safe image reference, probes, resource requests, rollout strategy, security context, and appropriate disruption controls.

---

## Labs

### Beginner

1. Write Pod, Service, Deployment manifests.
2. Break YAML indentation and fix it.
3. Inspect object status.

### Intermediate

1. Break Service selector and debug endpoints.
2. Add ConfigMap and Secret.
3. Add readiness/startup/liveness probes.

### Advanced

1. Add securityContext hardening.
2. Add PDB.
3. Add HPA.
4. Add NetworkPolicy with DNS allowance.
5. Create Kustomize dev/prod overlays.

---

## Memory Review

- Why can a Service exist with no endpoints?
- Why does HPA need requests?
- Why should liveness not check DB health?
- What does a PDB protect against?
- Why is copy-pasted YAML risky?

---

## Senior Summary

> I review Kubernetes manifests as operational contracts. I check selector correctness, rollout safety, probes, resources, security posture, disruption tolerance, and environment drift. A manifest is production-ready only when it describes how the workload behaves during failure, rollout, and recovery.

---

## [SRE] Kubernetes Lab 1: Pod Is Running But Service Does Not Work

## Kubernetes Lab 1: Pod Is Running But Service Does Not Work

### Production Context

You are on-call for an ML inference platform. A user reports their model endpoint
`https://api.internal/model/sentiment` started returning connection errors at 14:23 UTC.
The Deployment shows three running pods. No recent deploys were triggered. Your job is to
find why traffic is not reaching the pods.

---

### Prerequisites

- A running Kubernetes cluster (kind, k3d, or real cluster)
- `kubectl` configured and pointing at the right context
- Permissions to read pods, services, endpoints, and endpointslices in the target namespace

---

### Environment Setup

Apply the broken scenario manifest, which ships a Deployment with a deliberate label
mismatch and a mismatched service port:

```bash
kubectl create namespace sre-lab || true

cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentiment-api
  namespace: sre-lab
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sentiment-api
      version: v2
  template:
    metadata:
      labels:
        app: sentiment-api
        version: v2
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc
  namespace: sre-lab
spec:
  selector:
    app: sentiment-api
    # version label intentionally omitted — selector only matches app, but
    # pods have version: v2. Not the bug here, but close enough to demo.
    # The real bug: targetPort points to 80, pods listen on 8080.
  ports:
  - port: 80
    targetPort: 80      # BUG: pods listen on 8080, not 80
  type: ClusterIP
EOF
```

Wait 30 seconds for pods to attempt readiness, then begin the investigation.

---

### Beginner Section: Guided Walkthrough

Work through these steps in order. Read every field in the output — do not skip past
anything you do not recognise.

#### Step 1 — Get a wide view of the namespace

```bash
kubectl get deploy,po,svc,endpoints -n sre-lab -o wide
```

Expected output:

```
NAME                            READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/sentiment-api   0/3     3            0           2m

NAME                               READY   STATUS    RESTARTS   AGE   IP            NODE
pod/sentiment-api-7d9f8b6c4-4xpk2  0/1     Running   0          2m    10.244.1.12   node-1
pod/sentiment-api-7d9f8b6c4-9rmnv  0/1     Running   0          2m    10.244.2.8    node-2
pod/sentiment-api-7d9f8b6c4-kw7ts  0/1     Running   0          2m    10.244.1.19   node-1

NAME                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/sentiment-svc   ClusterIP   10.96.144.221   <none>        80/TCP    2m

NAME                      ENDPOINTS   AGE
endpoints/sentiment-svc   <none>      2m
```

Key signals to notice:

- `READY 0/3` on the Deployment means zero pods passed readiness. Traffic cannot be served.
- `ENDPOINTS <none>` on the Service means the Service has no backing pods. Any request
  to the ClusterIP will be dropped.
- Pods are `Running` but `0/1` ready. The process is alive but Kubernetes does not
  consider it healthy enough to receive traffic.

#### Step 2 — Inspect the Service selector

```bash
kubectl describe svc sentiment-svc -n sre-lab
```

Expected output:

```
Name:              sentiment-svc
Namespace:         sre-lab
Labels:            <none>
Selector:          app=sentiment-api
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.96.144.221
Port:              <unset>  80/TCP
TargetPort:        80/TCP
Endpoints:         <none>
Session Affinity:  None
Events:            <none>
```

Notice: `TargetPort: 80/TCP`. This is the port the Service forwards to on each pod.

#### Step 3 — Check what port the pods actually expose

```bash
kubectl get pod -l app=sentiment-api -n sre-lab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].ports[0].containerPort}{"\n"}{end}'
```

Expected output:

```
sentiment-api-7d9f8b6c4-4xpk2   8080
sentiment-api-7d9f8b6c4-9rmnv   8080
sentiment-api-7d9f8b6c4-kw7ts   8080
```

The mismatch is now clear: pods listen on `8080`, service routes to `80`.

#### Step 4 — Confirm readiness failures via pod description

```bash
kubectl describe pod sentiment-api-7d9f8b6c4-4xpk2 -n sre-lab
```

Expected output (trimmed to the relevant section):

```
Name:             sentiment-api-7d9f8b6c4-4xpk2
Namespace:        sre-lab
Status:           Running
IP:               10.244.1.12
Controlled By:    ReplicaSet/sentiment-api-7d9f8b6c4

Conditions:
  Type              Status
  Initialized       True
  Ready             False     <-- pod is NOT ready
  ContainersReady   False
  PodScheduled      True

Containers:
  api:
    Image:          nginx:1.25
    Port:           8080/TCP
    State:          Running
    Ready:          False
    Restart Count:  0
    Readiness:      http-get http://:8080/healthz delay=5s timeout=1s period=10s

Events:
  Type     Reason     Age                From               Message
  ----     ------     ----               ----               -------
  Normal   Scheduled  3m                 default-scheduler  Successfully assigned sre-lab/sentiment-api-7d9f8b6c4-4xpk2 to node-1
  Normal   Pulled     3m                 kubelet            Container image "nginx:1.25" already present on machine
  Normal   Created    3m                 kubelet            Created container api
  Normal   Started    3m                 kubelet            Started container api
  Warning  Unhealthy  2m (x12 over 3m)  kubelet            Readiness probe failed: dial tcp 10.244.1.12:8080: connect: connection refused
```

The readiness probe hits `:8080/healthz`. nginx by default serves on port 80, not 8080,
so the probe fails. Because the probe fails, pods are never marked Ready. Because pods
are never Ready, the Endpoints object has no addresses. Because Endpoints is empty, the
Service forwards to nothing.

#### Step 5 — Check the EndpointSlice for more detail

```bash
kubectl get endpointslices -n sre-lab -o wide
```

Expected output:

```
NAME                    ADDRESSTYPE   PORTS   ENDPOINTS   AGE
sentiment-svc-x4bqr     IPv4          80      <none>      4m
```

`ENDPOINTS <none>` confirms the same finding from a different object. In newer clusters
EndpointSlices replace the older Endpoints object as the source of truth for kube-proxy
and Cilium.

#### Step 6 — Understand the fix options

There are two valid fixes depending on intent:

**Option A** — Change the Service `targetPort` to match what pods actually expose:

```bash
kubectl patch svc sentiment-svc -n sre-lab \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/ports/0/targetPort","value":8080}]'
```

**Option B** — If you own the Deployment, change the container to listen on port 80 and
update the readiness probe accordingly.

After Option A, watch endpoints populate:

```bash
kubectl get endpoints sentiment-svc -n sre-lab -w
```

```
NAME            ENDPOINTS                                                  AGE
sentiment-svc   <none>                                                     5m
sentiment-svc   10.244.1.12:8080,10.244.2.8:8080,10.244.1.19:8080         5m12s
```

---

### Intermediate Section: Diagnose Without Full Hints

Apply this variant manifest. It has a different fault — find it:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc-v2
  namespace: sre-lab
spec:
  selector:
    app: sentiment-api
    tier: backend        # no pod has this label
  ports:
  - port: 80
    targetPort: 8080
EOF
```

Run the same investigation sequence. Answer:

1. What does `kubectl describe svc sentiment-svc-v2` show that is different from
   the working service?
2. Why are endpoints still empty even though targetPort is now correct?
3. What exact command tells you which labels the pods actually carry?
4. What is the minimal change that fixes this service without touching the Deployment?

---

### Advanced / Stretch

**Scenario A — Readiness gate blocks rollout**

Add a readiness gate to the Deployment spec:

```yaml
readinessGates:
- conditionType: "custom.io/traffic-enabled"
```

Notice that pods get stuck at `Ready: False` even when the HTTP probe passes. Explain why,
and write the `kubectl patch` command that injects the missing condition.

**Scenario B — EndpointSlice topology**

With a real multi-node cluster, use `kubectl get endpointslices -o yaml` to find the
`topology` hints field. Explain how `service.kubernetes.io/topology-mode: auto`
changes which endpoints a node-local kube-proxy uses.

**Scenario C — Headless service**

Change `clusterIP: None`. Observe how `nslookup sentiment-svc.sre-lab.svc.cluster.local`
response changes. Explain when you would choose headless and how a client must behave
differently.

---

### Sample Diagnosis Note

```
Incident: sentiment-api service returning no endpoints since 14:23 UTC

Root cause: Service targetPort set to 80; pods listen on 8080.
Kubernetes never added pod IPs to the Endpoints object because the pods were also
failing their readiness probe (probe hits :8080/healthz which nginx does not serve
on port 8080 by default — it serves on 80).

Evidence:
  kubectl get endpoints sentiment-svc -n sre-lab  →  ENDPOINTS <none>
  kubectl describe pod ...                         →  Readiness probe failed: dial tcp ...:8080: connection refused
  kubectl get svc -o yaml                          →  targetPort: 80

Fix applied 14:41 UTC: patched targetPort from 80 to 8080.
Endpoints populated within 12 seconds. Traffic restored at 14:41:14 UTC.

Prevention: Add CI check that asserts Service targetPort matches containerPort in the
same Deployment manifest. Use kube-linter rule "service-port-match".
```

---

### Common Mistakes

- **Checking pod logs before checking endpoints.** Logs can look clean while the
  pod is not ready. Check endpoints first when a Service is broken.
- **Assuming Running means Ready.** A pod can be `Running` (process started) and
  `0/1 Ready` (failed readiness probe) at the same time. These are different conditions.
- **Fixing the wrong object.** If you own neither the Service nor the Deployment
  spec, escalate rather than patching one side to match a broken other side.
- **Missing EndpointSlices in newer clusters.** In Kubernetes 1.21+ kube-proxy
  reads EndpointSlices, not Endpoints. Both should agree but check the slice if the
  classic Endpoints command looks wrong.

---

### What To Study Next

- Kubernetes Service types: ClusterIP, NodePort, LoadBalancer, Headless
- EndpointSlice topology-aware routing (`service.kubernetes.io/topology-mode`)
- kube-proxy modes: iptables vs IPVS vs eBPF (Cilium)
- Readiness gates and external admission controllers
- `kubectl port-forward` as a bypass to isolate Service vs pod fault

---

## [SRE] Kubernetes Lab 2: Readiness, Startup, And Rollout Safety

## Kubernetes Lab 2: Readiness, Startup, And Rollout Safety

### Production Context

You are deploying version 1.9.0 of a Python API service. The Deployment update was
triggered at 09:15 UTC. By 09:18, SLO dashboards show a spike in 5xx errors. The rollout
is still in progress — three new pods are up, two old pods are still terminating. On-call
pages you. Your job is to understand why the new pods are receiving traffic before they
are ready, and to harden the rollout strategy.

---

### Prerequisites

- A running Kubernetes cluster
- `kubectl` configured
- Namespace `sre-lab` exists (from Lab 1, or `kubectl create namespace sre-lab`)

---

### Environment Setup

Apply the unsafe manifest first. This simulates the production state at incident time:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api
  namespace: sre-lab
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 2       # too aggressive: 2 old pods can vanish at once
      maxSurge: 2             # 2 new pods can start at once
  selector:
    matchLabels:
      app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: "1.9.0"
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 2    # too short: app takes 25s to warm up
          periodSeconds: 5
          failureThreshold: 1       # single failure marks pod not ready
---
apiVersion: v1
kind: Service
metadata:
  name: python-api-svc
  namespace: sre-lab
spec:
  selector:
    app: python-api
  ports:
  - port: 80
    targetPort: 8080
EOF
```

Watch the rollout:

```bash
kubectl rollout status deploy/python-api -n sre-lab --timeout=120s
```

---

### Beginner Section: Guided Walkthrough

#### Step 1 — Observe the rollout in progress

```bash
kubectl get pod -n sre-lab -l app=python-api -w
```

Expected output during rollout:

```
NAME                          READY   STATUS              RESTARTS   AGE
python-api-6c7f8d9b4-2kxpq    1/1     Running             0          4m
python-api-6c7f8d9b4-7rnvt    1/1     Running             0          4m
python-api-6c7f8d9b4-m3hq8    1/1     Running             0          4m
python-api-6c7f8d9b4-p9wlz    1/1     Running             0          4m
python-api-79d4c6f5b-4xbkr    0/1     ContainerCreating   0          3s
python-api-79d4c6f5b-8nvmt    0/1     ContainerCreating   0          3s
python-api-6c7f8d9b4-2kxpq    1/1     Terminating         0          4m
python-api-6c7f8d9b4-7rnvt    1/1     Terminating         0          4m
python-api-79d4c6f5b-4xbkr    0/1     Running             0          8s
python-api-79d4c6f5b-8nvmt    0/1     Running             0          8s
python-api-79d4c6f5b-4xbkr    1/1     Running             0          12s   <-- declared Ready at 12s
python-api-79d4c6f5b-8nvmt    1/1     Running             0          14s
```

The new pods are declared Ready at 12-14 seconds. But the app needs 25 seconds to warm
its model cache. Between second 12 and second 25, these pods are in the Service endpoint
list and receiving live traffic while they cannot serve it correctly.

#### Step 2 — Describe a pod to see probe configuration and events

```bash
kubectl describe pod python-api-79d4c6f5b-4xbkr -n sre-lab
```

Expected output (relevant sections):

```
Name:             python-api-79d4c6f5b-4xbkr
Namespace:        sre-lab
Status:           Running

Containers:
  api:
    Image:          nginx:1.25
    Port:           8080/TCP
    State:          Running
      Started:      Wed, 09 Apr 2026 09:15:47 +0000
    Ready:          True
    Readiness:      http-get http://:8080/ready delay=2s timeout=1s period=5s #success=1 #failure=1

Conditions:
  Type              Status
  Initialized       True
  Ready             True      <-- pod thinks it is ready
  ContainersReady   True

Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  30s   default-scheduler  Successfully assigned sre-lab/python-api-79d4c6f5b-4xbkr to node-2
  Normal  Pulled     29s   kubelet            Container image "nginx:1.25" already present
  Normal  Created    29s   kubelet            Created container api
  Normal  Started    28s   kubelet            Started container api
```

What to notice: `#failure=1` means a single failed probe immediately marks the pod
not-ready. But here the probe *passed* on its first attempt at 2 seconds — because the
HTTP server started quickly even though the application logic was still loading. The
readiness probe measures "can the process accept a TCP connection" not "is the application
fully initialised."

#### Step 3 — Check rollout strategy

```bash
kubectl get deploy python-api -n sre-lab -o jsonpath='{.spec.strategy}' | python3 -m json.tool
```

Expected output:

```json
{
    "rollingUpdate": {
        "maxSurge": 2,
        "maxUnavailable": 2
    },
    "type": "RollingUpdate"
}
```

With `maxUnavailable: 2` and 4 replicas, Kubernetes allows removing 2 old pods before
the new pods are confirmed ready. This means capacity can drop to 2 pods (50%) at the
worst moment — exactly when the new pods are falsely marking themselves ready.

#### Step 4 — Check current rollout history

```bash
kubectl rollout history deploy/python-api -n sre-lab
```

Expected output:

```
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

```bash
kubectl rollout history deploy/python-api -n sre-lab --revision=2
```

```
deployment.apps/python-api with revision #2
Pod Template:
  Labels:       app=python-api
                pod-template-hash=79d4c6f5b
                version=1.9.0
  Containers:
   api:
    Image:      nginx:1.25
    Port:       8080/TCP
    Readiness:  http-get http://:8080/ready delay=2s timeout=1s period=5s #success=1 #failure=1
```

#### Step 5 — Roll back and apply the safer manifest

Roll back to stabilise:

```bash
kubectl rollout undo deploy/python-api -n sre-lab
kubectl rollout status deploy/python-api -n sre-lab
```

Now apply the hardened version:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api
  namespace: sre-lab
  annotations:
    kubernetes.io/change-cause: "v1.9.1 hardened probes and rollout strategy"
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0     # never reduce capacity below 4 during rollout
      maxSurge: 1           # add one pod at a time
  selector:
    matchLabels:
      app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: "1.9.1"
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        startupProbe:
          httpGet:
            path: /ready
            port: 8080
          failureThreshold: 30    # 30 * 2s = 60s max startup window
          periodSeconds: 2
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 0  # startup probe guards the initial window
          periodSeconds: 10
          failureThreshold: 3     # three failures required before removing from endpoints
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 20
          failureThreshold: 3
EOF
```

#### Step 6 — Understand the probe interaction

The three probes serve different purposes:

| Probe | Purpose | Failure action |
|-------|---------|----------------|
| `startupProbe` | Protects slow-starting containers from liveness kills | Restarts container if never succeeds |
| `readinessProbe` | Controls whether pod is in Service endpoints | Removes from endpoints (no restart) |
| `livenessProbe` | Detects hung/deadlocked process | Restarts container |

A common mistake is to set `initialDelaySeconds: 30` on readinessProbe for a slow app.
This works but means the pod waits 30s before any readiness check, then immediately
becomes ready if the first check passes. A startupProbe is more precise — it polls
aggressively until the app is ready, then hands off to the cheaper readiness schedule.

---

### Intermediate Section: Diagnose Without Full Hints

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-rollout
  namespace: sre-lab
spec:
  replicas: 3
  strategy:
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: broken-rollout
  template:
    metadata:
      labels:
        app: broken-rollout
    spec:
      containers:
      - name: app
        image: nginx:1.25
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 2
        # readinessProbe is missing entirely
EOF
```

Questions to answer without hints:

1. What does `kubectl rollout status` show? Does the rollout complete?
2. What happens to the pods over time without a readiness probe?
3. What can go wrong if liveness fires before the app is ready?
4. What does the absence of `readinessProbe` mean for traffic safety?

---

### Advanced / Stretch

**Scenario A — PodDisruptionBudget interaction**

Create a PDB alongside the Deployment:

```bash
kubectl apply -f - <<'EOF'
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: python-api-pdb
  namespace: sre-lab
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: python-api
EOF
```

Now attempt `kubectl rollout restart deploy/python-api -n sre-lab` with `maxUnavailable: 0`
and `minAvailable: 3` against 4 replicas. Does it proceed? Explain why or why not, and
what operator action unblocks it.

**Scenario B — OOMKilled restart loop during rollout**

Simulate by setting a memory limit far below the app's need:

```bash
kubectl set resources deploy/python-api -n sre-lab \
  --limits=memory=5Mi
```

Describe the pod after a restart. The `State` section will show:

```
Last State:  Terminated
  Reason:    OOMKilled
  Exit Code: 137
```

Exit code 137 means the container was killed by signal 9 (SIGKILL) — the kernel OOM
killer, not the application itself. Explain how you distinguish OOMKill from an application
crash (exit code 1 or non-zero application code).

---

### Sample Diagnosis Note

```
Incident: python-api 5xx spike 09:15–09:22 UTC during v1.9.0 rollout

Root cause: readinessProbe initialDelaySeconds (2s) was shorter than application warm-up
time (25s). New pods passed the readiness check and joined Service endpoints while the
application was still loading its model cache. Requests served during the 13-second gap
returned 503 from the app layer.

Compounding factor: maxUnavailable: 2 removed two old (healthy) pods before new pods
were confirmed stable. At peak, only 2 of 4 pods were actually serving correctly.

Evidence:
  kubectl rollout history --revision=2    →  delay=2s, failure=1
  kubectl get endpoints python-api-svc    →  showed 4 endpoints during impact window
  Application logs                        →  "cache not ready, rejecting request" for 13s

Fix: rolled back at 09:22. Applied v1.9.1 with startupProbe (30 * 2s window),
readinessProbe failureThreshold: 3, maxUnavailable: 0, maxSurge: 1.

Prevention: encode startupProbe requirements in Helm chart defaults; gate deploys on
rollout status check in CI pipeline before marking deployment complete.
```

---

### Common Mistakes

- **Confusing liveness and readiness.** Liveness restarts; readiness removes from
  endpoints. Misconfiguring them swapped causes either traffic errors (liveness doing
  readiness job) or zombie pods (readiness doing nothing).
- **Setting initialDelaySeconds too high.** Hiding startup delay with a large
  initialDelay means the pod is invisible to load for a long time. startupProbe is
  more correct.
- **maxUnavailable: 0 does not mean zero risk.** It prevents capacity reduction, but
  if new pods declare themselves ready falsely, traffic error rate still rises.
- **Missing change-cause annotation.** Without it, `rollout history` is useless for
  audit. Always annotate deploys.

---

### What To Study Next

- Kubernetes rollout strategies: RollingUpdate vs Recreate
- PodDisruptionBudgets and their interaction with HPA
- Container exit codes: 0, 1, 137, 143 — what each means
- `kubectl rollout pause` / `kubectl rollout resume` for canary gates
- Argo Rollouts and progressive delivery for more advanced traffic control

---

## [SRE] Kubernetes Lab 3: Node Pressure And Scheduling Reasoning

## Kubernetes Lab 3: Node Pressure And Scheduling Reasoning

### Production Context

Your platform runs GPU training jobs alongside long-running inference services. Overnight,
the ops team added three new batch preprocessing pods. By 07:45 UTC three inference pods
are `Pending`, the node monitoring dashboard shows one node at 94% memory utilisation,
and a training pod was evicted. You need to understand why scheduling failed, why eviction
happened, and how to prevent it.

---

### Prerequisites

- A running Kubernetes cluster (kind or k3d with at least 2 nodes works)
- `kubectl` and `kubectl top` (metrics-server installed)
- Namespace `sre-lab` exists

---

### Environment Setup

Create a "memory pressure" scenario with a greedy pod and several small pods that cannot
schedule:

```bash
# Simulate a noisy neighbour that requests most node memory
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: batch-noisy
  namespace: sre-lab
  labels:
    role: batch
spec:
  containers:
  - name: worker
    image: nginx:1.25
    resources:
      requests:
        memory: "3Gi"
        cpu: "500m"
      limits:
        memory: "4Gi"
        cpu: "2000m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inference-api
  namespace: sre-lab
spec:
  replicas: 3
  selector:
    matchLabels:
      app: inference-api
  template:
    metadata:
      labels:
        app: inference-api
    spec:
      containers:
      - name: server
        image: nginx:1.25
        resources:
          requests:
            memory: "1500Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "500m"
EOF
```

Wait 30 seconds, then begin investigation.

---

### Beginner Section: Guided Walkthrough

#### Step 1 — Find which pods are Pending

```bash
kubectl get pods -n sre-lab -o wide
```

Expected output:

```
NAME                             READY   STATUS    RESTARTS   AGE   IP             NODE
batch-noisy                      1/1     Running   0          45s   10.244.1.5     node-1
inference-api-5f8b9c6d4-2jxpq    0/1     Pending   0          45s   <none>         <none>
inference-api-5f8b9c6d4-7rnvt    1/1     Running   0          45s   10.244.2.11    node-2
inference-api-5f8b9c6d4-m4kzp    0/1     Pending   0          45s   <none>         <none>
```

Two inference pods are `Pending` with no IP and no node assigned. This means the
scheduler could not find a node that satisfies their requirements.

#### Step 2 — Describe a Pending pod to read the scheduler message

```bash
kubectl describe pod inference-api-5f8b9c6d4-2jxpq -n sre-lab
```

Expected output (relevant section):

```
Name:             inference-api-5f8b9c6d4-2jxpq
Namespace:        sre-lab
Status:           Pending

Events:
  Type     Reason            Age                From               Message
  ----     ------            ----               ----               -------
  Warning  FailedScheduling  42s (x3 over 45s)  default-scheduler  0/2 nodes are available:
           1 Insufficient memory, 1 node(s) had untolerated taint {node.kubernetes.io/not-ready: }.
           preemption: 0/2 nodes are eligible for preemption by the pod.
```

Decode this message field by field:

- `0/2 nodes are available` — the scheduler checked all 2 nodes and rejected both
- `1 Insufficient memory` — one node (node-1) cannot fit 1500Mi more memory
- `1 node(s) had untolerated taint` — one node has a taint the pod does not tolerate
  (may vary in your environment)
- `preemption: 0/2 nodes are eligible` — no lower-priority pods exist that could be
  evicted to make room (preemption did not help)

#### Step 3 — Check node resource allocation

```bash
kubectl describe node node-1 | grep -A 10 "Allocated resources"
```

Expected output:

```
Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests      Limits
  --------           --------      ------
  cpu                1750m (43%)   4500m (112%)
  memory             4044Mi (96%)  6Mi (0%)
  ephemeral-storage  0 (0%)        0 (0%)
  hugepages-1Gi      0 (0%)        0 (0%)
  hugepages-2Mi      0 (0%)        0 (0%)
```

Key points:

- Memory requests total 96% of the node's allocatable capacity. The remaining 4% is
  less than 1500Mi, so `inference-api` pods cannot fit.
- CPU limits exceed 100% — this is normal (limits are allowed to overcommit). Requests
  are the gating factor for scheduling, not limits.
- The scheduler uses **requests** to decide placement. It never looks at actual usage.

#### Step 4 — Compare requests vs actual usage

```bash
kubectl top node
```

Expected output:

```
NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
node-1   312m         7%     1843Mi          43%
node-2   108m         2%     712Mi           17%
```

```bash
kubectl top pod -n sre-lab
```

Expected output:

```
NAME                             CPU(cores)   MEMORY(bytes)
batch-noisy                      18m          142Mi
inference-api-5f8b9c6d4-7rnvt    9m           88Mi
```

This exposes the overcommit trap: the `batch-noisy` pod *requested* 3Gi but is only
*using* 142Mi. The gap between request (3Gi) and actual usage (142Mi) is 2.9Gi — enough
to fit two inference pods — but the scheduler cannot see usage, only requests. The node
is logically full based on requests even though it is physically half-empty.

#### Step 5 — Check recent cluster events for evictions

```bash
kubectl get events -n sre-lab --sort-by='.lastTimestamp' | grep -E "Evict|OOMKill|Pressure"
```

Expected output (if memory pressure was reached):

```
LAST SEEN   TYPE      REASON      OBJECT                    MESSAGE
8m          Warning   Evicted     pod/batch-noisy-old       The node was low on resource: memory.
                                  Threshold quantity: 100Mi, available: 82Mi.
7m          Warning   OOMKilling  pod/inference-api-...     Memory limit reached, killed process
```

And on the node itself:

```bash
kubectl describe node node-1 | grep -A 5 "Conditions:"
```

```
Conditions:
  Type                 Status  Message
  ----                 ------  -------
  MemoryPressure       True    kubelet has insufficient memory available
  DiskPressure         False   kubelet has no disk pressure
  PIDPressure          False   kubelet has sufficient PID available
  Ready                True    kubelet is posting ready status
```

`MemoryPressure: True` means kubelet is actively considering eviction. Pods in `BestEffort`
QoS (no requests or limits) are evicted first, then `Burstable`, then `Guaranteed`.

#### Step 6 — Understand QoS classes

```bash
kubectl get pod batch-noisy -n sre-lab -o jsonpath='{.status.qosClass}'
```

```
Burstable
```

```bash
kubectl get pod inference-api-5f8b9c6d4-7rnvt -n sre-lab -o jsonpath='{.status.qosClass}'
```

```
Burstable
```

QoS class rules:

| Class | Condition | Eviction priority |
|-------|-----------|-------------------|
| `Guaranteed` | requests == limits for all resources | Evicted last |
| `Burstable` | requests < limits, or only some resources set | Evicted second |
| `BestEffort` | no requests or limits at all | Evicted first |

To make the inference pods `Guaranteed` (never evicted before batch):

```yaml
resources:
  requests:
    memory: "1500Mi"
    cpu: "250m"
  limits:
    memory: "1500Mi"   # limits == requests for both resources
    cpu: "250m"
```

#### Step 7 — Fix the scheduling problem

Option A — Right-size the batch job's requests to match actual usage:

```bash
kubectl patch pod batch-noisy -n sre-lab --type='json' \
  -p='[{"op":"replace","path":"/spec/containers/0/resources/requests/memory","value":"256Mi"}]'
```

(Pods are immutable after creation; in practice you delete and recreate with corrected
requests, or adjust the parent Deployment/Job spec.)

Option B — Use a LimitRange to enforce request floors per namespace, preventing pods
from setting requests that far exceed what they use.

Option C — Use a ResourceQuota per team namespace to cap total requests.

---

### Intermediate Section: Diagnose Without Full Hints

Apply this pod:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pending
  namespace: sre-lab
spec:
  containers:
  - name: trainer
    image: nginx:1.25
    resources:
      requests:
        nvidia.com/gpu: "1"
      limits:
        nvidia.com/gpu: "1"
EOF
```

Questions without hints:

1. What does `kubectl describe pod gpu-pending` say about why it is Pending?
2. If your cluster has no GPU nodes, what two approaches unblock this?
3. How would you add a node taint and pod toleration to ensure GPU workloads only land
   on GPU nodes?
4. What is the difference between a taint `NoSchedule` and `NoExecute`?

---

### Advanced / Stretch

**Scenario A — Priority classes and preemption**

Create a high-priority PriorityClass and assign it to a new pod on a full node:

```bash
kubectl apply -f - <<'EOF'
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: inference-critical
value: 100000
globalDefault: false
description: "For latency-sensitive inference pods"
EOF
```

Set `priorityClassName: inference-critical` on a pod that cannot schedule due to
memory. Observe whether it preempts a lower-priority pod. Write the events you observe
and explain the preemption sequence.

**Scenario B — Node affinity vs nodeSelector**

Add `nodeSelector: disk: ssd` to a pod. No nodes have this label. Compare the error
message to a resource-insufficient error. Then use `nodeAffinity` with
`requiredDuringSchedulingIgnoredDuringExecution` and `preferredDuringSchedulingIgnoredDuringExecution`
and explain the operational difference.

**Scenario C — Kubelet eviction thresholds**

Read `/var/lib/kubelet/config.yaml` on a node (or check the kubelet flags) to find
`evictionHard` and `evictionSoft` thresholds. Explain the difference between hard
eviction (immediate, no grace period) and soft eviction (waits for evictionSoftGracePeriod).
Explain what `memory.available < 100Mi` means relative to what `kubectl top node` shows.

---

### Sample Diagnosis Note

```
Incident: 3 inference-api pods Pending since 07:45 UTC; batch-noisy evicted at 07:52 UTC

Root cause (scheduling): batch-noisy declared memory requests of 3Gi. Its actual usage
was 142Mi. This over-reservation consumed 96% of node-1 allocatable memory. The
scheduler, which uses requests not actual usage, correctly determined node-1 had
insufficient memory for inference-api pods requesting 1500Mi each.

Root cause (eviction): node-1 reached MemoryPressure condition after batch-noisy's
working set grew beyond its request but within its 4Gi limit. Kubelet evicted
batch-noisy-old (BestEffort QoS) first. When pressure continued, a Burstable pod was
also evicted.

Evidence:
  kubectl describe pod inference-api-...   →  0/2 nodes available: 1 Insufficient memory
  kubectl top node                         →  node-1 43% actual memory, 96% requested
  kubectl describe node node-1             →  MemoryPressure: True
  kubectl get events                       →  Evicted pod/batch-noisy-old

Fix applied 08:10: reduced batch-noisy memory request to 512Mi based on observed p99 usage.
inference-api pods scheduled within 20 seconds.

Prevention: enforce requests-to-usage ratio via VPA recommendations; set LimitRange
minimums to prevent trivially small requests; use Guaranteed QoS for inference-critical pods.
```

---

### Common Mistakes

- **Reading limits instead of requests for scheduling reasoning.** The scheduler uses
  requests to determine fit. Limits are irrelevant at placement time.
- **Assuming a Running pod with high memory usage would be evicted before a Pending
  pod gets scheduled.** Eviction and scheduling are separate subsystems. Scheduling
  failure persists until a node has enough free requested capacity.
- **Not checking `kubectl describe node` Allocated resources.** `kubectl top node`
  shows actual usage. The scheduling decision uses the Allocated resources table, not
  top.
- **Conflating OOMKilled and eviction.** OOMKilled means the kernel killed the container
  process because it exceeded its cgroup memory limit. Eviction is kubelet proactively
  removing a pod before the node runs out of memory. Different triggers, different
  recovery paths.

---

### What To Study Next

- Kubernetes resource model: requests, limits, allocatable capacity
- QoS classes: Guaranteed, Burstable, BestEffort
- Kubelet eviction signals: memory.available, nodefs.available, imagefs.available
- VPA (Vertical Pod Autoscaler) for automatic request right-sizing
- LimitRange and ResourceQuota for namespace-level governance
- PriorityClass and preemption for mixed workload platforms
- Node taints and tolerations for hardware-specific scheduling (GPU, RDMA, NVMe)

---

## [SRE] Kubernetes Lab 4: GPU And AI Platform Architecture Review

## Kubernetes Lab 4: GPU And AI Platform Architecture Review

### Scenario

A company is building an AI compute platform on Kubernetes. It must support four distinct workload classes:

- general stateless product services (web APIs, microservices)
- scheduled CPU-heavy batch jobs (data pipelines, preprocessing)
- distributed GPU training jobs (multi-node, long-running, expensive)
- GPU-based and CPU-based model inference (latency-sensitive, availability-critical)

The platform must enforce cost control, prevent resource interference between workload classes, and support multiple tenant teams without any single team being able to monopolize scarce GPU capacity.

### Prerequisites

Before attempting this lab, you should be comfortable with:

- Kubernetes node pools, taints, tolerations, and node affinity
- ResourceQuota and LimitRange objects
- PriorityClass and preemption behavior
- Kubernetes Job and CronJob behavior
- GPU device plugin basics (how Kubernetes sees GPU resources)
- Basic familiarity with what Kubeflow Trainer, KServe, and Kueue are for

Foundation reading: [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)

### Time Estimate

60-90 minutes for a written design. 20-30 minutes additional for pressure questions.

---

### How To Think About This

Before writing anything, break the problem into layers. An interviewer who sees structured decomposition is much more confident you can operate this platform, not just describe it.

**Layer 1: Workload classification**
Ask: what are the distinct workload types and what do they each need from the scheduler, network, storage, and cost model?

**Layer 2: Isolation**
Ask: how do I prevent training jobs from consuming inference capacity, and general services from landing on GPU nodes?

**Layer 3: Scheduling and admission**
Ask: how do I control who gets GPU resources, in what order, and at what cost?

**Layer 4: Training platform specifics**
Ask: what happens if a distributed training job half-starts? How does the platform handle preemption and node loss?

**Layer 5: Inference platform specifics**
Ask: what does warm capacity mean here? What is the difference between predictive and generative inference?

**Layer 6: Observability**
Ask: what does a GPU sitting idle look like in metrics? What tells me a training job is making no progress?

**Layer 7: Cost and governance**
Ask: who can approve very large training runs? How do I show teams their GPU spend?

---

### Building Blocks

These are the tools and concepts relevant to this design. You do not need to use all of them — the decision about which to include and why is part of the answer.

| Component | What it does |
|---|---|
| Node pools | Separate groups of nodes with distinct hardware, taints, and scaling policies |
| Taints and tolerations | Repel general workloads from GPU nodes by default |
| Node affinity | Attract GPU workloads to nodes with specific hardware labels |
| ResourceQuota | Limit how much CPU, memory, or GPU a namespace can consume |
| PriorityClass | Allow inference traffic to preempt lower-priority training jobs |
| Kueue | Queue-based admission for batch and GPU jobs — prevents partial starts |
| Kubeflow Trainer | Higher-level controller for distributed multi-worker training jobs |
| KServe | Standardized model serving platform with inference protocol support |
| NVIDIA device plugin | Exposes GPU resources to Kubernetes as schedulable units |
| Horizontal Pod Autoscaler | Scale inference replicas based on load |
| Checkpoint storage (PVC / object store) | Persists training state for resume after failure |
| OPA / Kyverno | Admission policies to block unqualified GPU requests |

---

### Beginner Starter Skeleton

This gives you approximately 30% of a complete answer. Use it to get started, then extend it.

**Workload classes I would separate:**

- stateless product services — CPU node pools, no GPU access
- batch jobs — lower-priority CPU node pools, scheduled or queued
- GPU training — dedicated GPU node pools with taints, queued admission
- GPU inference — separate GPU node pools or dedicated GPU nodes, higher priority

**Why I separate these:**

Training jobs are long-running and interruptible. Inference services are latency-sensitive and need predictable capacity. Mixing them on shared node pools creates scheduling interference and makes cost accounting impossible.

**GPU isolation starting point:**

```yaml
# GPU node pool taint — applied at node pool creation or via kubectl taint
kubectl taint nodes <gpu-node> workload=gpu-training:NoSchedule

# GPU workload toleration — only GPU pods carry this
tolerations:
  - key: "workload"
    operator: "Equal"
    value: "gpu-training"
    effect: "NoSchedule"
```

**Quota to block unintended GPU consumption:**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: no-gpu
  namespace: general-services
spec:
  hard:
    requests.nvidia.com/gpu: "0"
```

Now extend this skeleton by working through the tasks below.

---

### Tasks

Complete these in order. Write your answer as a design document, not a list of commands.

**Task 1: Node pool strategy**

Describe the node pool layout for this platform. Specify at minimum:
- what node pools exist and what hardware they use
- what taints each GPU pool carries
- what autoscaling policy each pool uses and why

**Task 2: GPU isolation strategy**

Explain how you prevent a general service team from accidentally consuming GPU capacity. Cover taints, tolerations, quota, and any admission policy layer you would add.

**Task 3: Training platform design**

Explain how the platform supports multi-worker distributed training. Address:
- the partial-start problem and how you prevent it
- what happens when a training node is lost mid-job
- whether you use plain Jobs, Kubeflow Trainer, or something else — and why
- how checkpointing fits into the reliability model

**Task 4: Inference platform design**

Explain how the platform supports GPU model inference. Address:
- how inference capacity stays warm
- how you handle generative inference (long request duration, streaming, concurrency)
- how you handle predictive inference (batch-able, often CPU-friendly)
- whether KServe is appropriate and what it gives you

**Task 5: Scheduling and quota design**

Describe how you allocate GPU capacity across multiple tenant teams. Include:
- how you use ResourceQuota and PriorityClass together
- how Kueue fits in if demand exceeds supply
- how you prevent one team from monopolizing resources

**Task 6: Observability for GPU workloads**

List the signals you would instrument. Separate platform-level signals from workload-level signals. What tells you a training job is stalled versus making progress?

**Task 7: Failure handling**

Describe your failure model for:
- a training node going down at hour 3 of a 6-hour job
- an inference pod OOMing under traffic spike
- the GPU device plugin crashing on a node

**Task 8: Tooling decision**

State which controllers you would adopt (Trainer, KServe, Kueue, plain Kubernetes) and which you would defer. Give a reason for each choice. Explain what operational cost each controller adds.

---

### What A Beginner Answer Looks Like

A beginner answer describes GPU node isolation using taints and tolerations and ResourceQuota. It separates training from inference at the node pool level. It identifies checkpointing as important. It reaches for Kubeflow and KServe by name but does not explain the tradeoffs. It does not address the partial-start problem, does not distinguish generative from predictive inference, and does not reason about cost governance or tenant fairness.

### What An Intermediate Answer Looks Like

An intermediate answer correctly separates all four workload classes. It adds Kueue or an equivalent for queued GPU admission and explains the partial-start problem explicitly. It distinguishes generative inference needs from predictive inference needs. It addresses checkpointing as part of job reliability, not just ML convenience. It describes observability at both platform level and workload level. It explains Kubeflow Trainer as a tradeoff — reduced scheduling complexity in exchange for operator overhead. It may still miss cost governance and team budget visibility.

### What A Strong Answer Looks Like

A strong answer includes everything in the intermediate answer and adds:
- explicit cost governance: GPU budget visibility per team, quota guardrails, approval flow for very large jobs
- a clear principle that inference and training do not share scheduling policy
- distinction between driver readiness and node readiness — a GPU node can be "Ready" but unusable if the device plugin is in a bad state
- deliberate minimalism on tooling adoption: a clear reason why you are not adopting all four controllers at once
- separate SLOs for inference latency, training throughput, and platform control services
- discussion of data locality and input pipeline throughput as first-class training concerns, not afterthoughts

---

### Interviewer Pressure Questions

These are questions a strong interviewer will ask after your initial answer. Prepare a response for each.

1. You said you would use dedicated GPU node pools for training and inference. What if inference demand is low and training demand is high — do you allow overflow?
2. Your quota prevents general teams from getting GPUs. But what if a critical team needs a temporary GPU allocation outside their quota?
3. Kueue manages fair queuing. But what if a training job has been waiting for 6 hours and a higher-priority inference job keeps preempting the available nodes?
4. How do you validate that a GPU node is actually healthy before you schedule a training job onto it? The node can be Ready without the device plugin being functional.
5. A training job ran for 18 hours and produced no checkpoint. The node was preempted. What do you do with this information operationally?
6. You chose KServe. What does it cost your team to adopt it? Who owns it when it breaks?

---

### Deliverable Guidance

Your answer should include:

- a written description of the node pool layout (can be a table)
- a description of the isolation strategy with at least one concrete YAML or kubectl example
- a written explanation of how you would handle training job failures
- a list of observability signals separated by layer (platform vs workload)
- a tooling decision with justification for each choice

Do not submit bullet lists without explanation. An interviewer wants to see reasoning, not enumeration.

---

### What To Study Next

- [lab-05-operators-mesh-and-dr-review.md](lab-05-operators-mesh-and-dr-review.md) — operators, admission policy, and DR design
- [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md) — GPU platform depth
- [../../foundations/09-observability-slos-and-incident-response.md](../../foundations/09-observability-slos-and-incident-response.md) — SLO design for platform services
- Kueue documentation: https://kueue.sigs.k8s.io/docs/tasks/
- Kubeflow Trainer overview: https://www.kubeflow.org/docs/components/trainer/overview/
- KServe admin overview: https://kserve.github.io/website/docs/admin-guide/overview
- NVIDIA device plugin: https://nvidia.github.io/k8s-device-plugin/

---

## [SRE] Kubernetes Lab 5: Operators, Mesh, Policy, And Disaster Recovery Review

## Kubernetes Lab 5: Operators, Mesh, Policy, And Disaster Recovery Review

### Scenario

A platform team has been running Kubernetes for two years. They have accumulated 11 operators, enforce admission policy using Kyverno, are debating whether to add Istio, and claim the cluster is "DR-ready." A new staff engineer joins and is asked to review the platform.

Your job is to review it critically and produce a written assessment.

### Prerequisites

Before attempting this lab, you should be comfortable with:

- What a Kubernetes controller and operator are, and how they interact with the API server
- Kubernetes admission webhooks — what validating and mutating webhooks do
- etcd as the cluster state store — backup, restore, and quorum behavior
- What a service mesh does and how sidecar injection works
- Concepts of multi-cluster failover versus in-cluster redundancy

Foundation reading: [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md), [../../foundations/02-linux-kubernetes-foundations.md](../../foundations/02-linux-kubernetes-foundations.md)

### Time Estimate

60-90 minutes for a written design review. 20-30 minutes additional for pressure questions.

---

### How To Think About This

Before writing anything, decompose the platform into its risk layers. Most interview answers for this scenario are too abstract — "operators add complexity" without saying what kind, or "DR requires multi-cluster" without explaining what multi-cluster actually solves.

**Layer 1: Operator risk taxonomy**
Ask: what can a broken operator do to the cluster? What is the failure blast radius of each category of operator?

**Layer 2: Admission policy as reliability surface**
Ask: a Kyverno policy that blocks a deployment is an outage. How do you design policy so it helps rather than causes incidents?

**Layer 3: Service mesh decision**
Ask: what specific problem are you solving with a mesh? What overhead does it add? Are there paths where it actively makes things worse?

**Layer 4: etcd, cluster, and application recovery are three different things**
Ask: most "DR plans" conflate these. Can you restore etcd without losing a specific stateful application? Can you fail over an application without rebuilding the cluster?

**Layer 5: What DR-ready actually means**
Ask: is the DR plan documented? Has it been tested? How long is the RTO? Do the SLAs match the stated recovery target?

---

### Building Blocks

These are the tools and concepts relevant to this design. You do not need to use all of them.

| Component | What it does |
|---|---|
| Kubernetes controller | Reconciliation loop that watches resources and drives toward desired state |
| Operator | A controller that encodes domain-specific operational logic for a custom resource |
| Validating admission webhook | Allows or denies API requests before they are persisted |
| Mutating admission webhook | Modifies API requests before they are persisted |
| Kyverno | Policy engine for Kubernetes — enforce, audit, or mutate resource definitions |
| OPA/Gatekeeper | Alternative policy engine using Rego for more complex policy logic |
| Istio (sidecar mode) | Service mesh with per-pod sidecar proxies; adds mTLS, traffic control, telemetry |
| Istio (ambient mode) | Service mesh without per-pod sidecars; uses node-level proxies |
| Cilium | eBPF-based CNI that can provide mesh-like capabilities without sidecars |
| etcd | The key-value store that holds all Kubernetes cluster state |
| Velero | Kubernetes backup tool — snapshots object state and persistent volumes |
| Cluster API | Declarative cluster lifecycle management — useful for DR and recreation |
| PodDisruptionBudget | Guarantees minimum pod availability during voluntary disruptions |
| ValidatingWebhookConfiguration | Kubernetes object that registers an admission webhook |

---

### Beginner Starter Skeleton

This gives you approximately 30% of a complete answer. Use it to get started, then extend it.

**Operator risk starting point:**

Not all operators carry the same risk. A useful starting taxonomy:

- operators that only manage their own CRDs and don't touch core Kubernetes objects — low blast radius
- operators with mutating webhooks or cluster-level RBAC — higher blast radius
- operators that patch Pods or Nodes directly — highest blast radius; a bug here can affect every workload

**Admission policy failure mode to address first:**

A failing webhook is not the same as a rejecting webhook. If a Kyverno policy is set to `Fail` mode and the Kyverno pods are unavailable, the API server will reject all requests that need to pass that webhook — including deployments, scaling, and self-healing.

```yaml
# Webhook timeout and failure policy example
webhooks:
  - name: validate.kyverno.svc
    failurePolicy: Ignore   # or Fail — this choice has large operational consequences
    timeoutSeconds: 10
```

**Service mesh decision starting point:**

A service mesh gives you mTLS, traffic observability, and fine-grained routing control. The cost is operational complexity, sidecar injection risk, and increased blast radius for any mesh control plane failure. You should only adopt it when you have a specific unmet need that cannot be addressed with existing tooling.

**DR separation starting point:**

DR for this cluster requires three separate answers:
- etcd backup and restore
- cluster rebuild (control plane)
- application-level recovery (stateful data, not just object definitions)

These are not the same problem. Conflating them is how teams claim DR-readiness without actually having it.

---

### Tasks

Complete these in order. Write your answer as a design review document.

**Task 1: Operator risk model**

The platform runs 11 operators. Categorize them by risk class using the taxonomy from the skeleton. For each risk category:
- describe what a failure in that category looks like at runtime
- describe what Kubernetes behavior changes when that operator is unhealthy
- describe how you would detect a failure quickly

Address specifically: can a broken operator prevent healthy pods from being scheduled or from passing admission?

**Task 2: Admission policy strategy**

The platform uses Kyverno. Audit the design:
- which policies should be in `Enforce` mode and which should be in `Audit` mode?
- what is your policy for `failurePolicy: Fail` versus `failurePolicy: Ignore`?
- how do you safely roll out a new policy without risking an outage?
- what happens to existing workloads when Kyverno itself is restarted or upgraded?

Describe at least one concrete scenario where a well-intentioned policy caused an incident and how you would prevent it.

**Task 3: Service mesh decision framework**

The team wants to add Istio. Write a decision framework:
- what specific requirements would justify adopting a service mesh?
- what overhead does Istio sidecar mode add to every pod startup, restart, and upgrade?
- under what circumstances would you recommend ambient mode or Cilium instead?
- what does the mesh control plane failure look like, and how do you design for it?

State whether you would recommend adopting Istio in this scenario given what you know, and explain why.

**Task 4: etcd backup and restore**

Describe your etcd backup strategy:
- what is the minimum backup frequency for a production cluster?
- what does a restore procedure look like at a high level?
- what data is NOT in etcd that you still need to recover a functional cluster?
- how do you verify that a backup is actually restorable before you need it?

**Task 5: Stateful workload recovery**

The cluster runs stateful workloads. Describe:
- the difference between recovering the Kubernetes object definitions and recovering the actual data
- how Velero fits into the picture and where it falls short
- what a recovery playbook for a specific stateful application would contain that a generic etcd restore does not

**Task 6: What DR-ready actually requires**

The team says the cluster is "DR-ready." Write a checklist of what that claim would actually require to be true. Include:
- documentation and test frequency requirements
- RTO and RPO defined for each workload class
- separation between cluster-level and application-level recovery
- the difference between passive DR (can you recover?) and active DR (can you fail over?)

Be specific about what common "DR-ready" claims are actually false confidence.

---

### What A Beginner Answer Looks Like

A beginner answer identifies that operators add complexity and that admission policies can block deployments. It mentions etcd backups. It says a service mesh gives you mTLS and observability. It may recommend Istio without a clear requirement. It does not distinguish etcd recovery from application data recovery. It does not address `failurePolicy` behavior or webhook availability as a reliability concern. It does not define what RTO and RPO would look like for different workload classes.

### What An Intermediate Answer Looks Like

An intermediate answer categorizes operator risk by blast radius and identifies mutating webhooks as particularly dangerous. It explains the `failurePolicy: Fail` trap clearly. It distinguishes service mesh adoption requirements from nice-to-have features. It correctly separates etcd backup from application data backup. It recognizes that Velero snapshots object definitions and PV data but does not capture in-memory application state. It may still be vague about DR testing cadence and RTO/RPO definitions.

### What A Strong Answer Looks Like

A strong answer includes everything in the intermediate answer and adds:
- a specific operator health monitoring strategy — not just "watch logs," but probing CRD reconciliation lag and webhook response time as platform signals
- concrete policy rollout stages: audit mode first, enforce on new namespaces, enforce broadly only after validation
- an honest assessment of mesh overhead per pod: startup latency, sidecar memory budget, certificate rotation events
- a distinction between ambient mode mesh (no sidecar, node-proxy) and sidecar mode mesh, and when ambient is preferable
- a DR test protocol that includes actual restore drills, not just "we have backups"
- separate RTO and RPO statements for the control plane, for stateless services, and for stateful applications
- recognition that multi-cluster does not solve DR unless you have active-active data replication or accept data loss on failover

---

### Interviewer Pressure Questions

These are questions a strong interviewer will ask after your initial answer. Prepare a response for each.

1. You said operators with mutating webhooks are high risk. One of the 11 operators is a certificate manager with a mutating webhook. How do you safely upgrade it without downtime?
2. You recommended `failurePolicy: Ignore` for non-critical policies. What is the security exposure if the Kyverno pod crashes during a deployment event?
3. The team adopted Istio. An engineer pushed a DestinationRule that routed all traffic for a service to a non-existent subset. The service went down. How did this happen and how do you prevent it?
4. You described etcd backup and restore. etcd is restored successfully, but the cluster is still not functional. What are the three most likely causes?
5. A DR drill reveals the restore procedure takes 4 hours but the SLA says 1 hour RTO. What do you do?
6. The platform has 11 operators. Three of them are rarely used. What do you do with them?

---

### Deliverable Guidance

Your answer should include:

- a written operator risk classification (can be a table with each category, blast radius, and detection method)
- a written policy governance section covering failurePolicy, rollout stages, and a concrete incident example
- a service mesh recommendation with explicit reasoning — adopt, defer, or use alternative
- a separation of recovery concerns: etcd, cluster, application data (these must be treated as three different problems)
- a DR-readiness checklist with at least six concrete criteria beyond "we have backups"

Avoid hand-wavy phrases like "multi-cluster solves this" or "we would add monitoring." Every recommendation should have a reason and a failure mode.

---

### What To Study Next

- [lab-04-gpu-ml-ai-platform-review.md](lab-04-gpu-ml-ai-platform-review.md) — if you have not done it, GPU platform design
- [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md) — operators and admission depth
- [../../foundations/09-observability-slos-and-incident-response.md](../../foundations/09-observability-slos-and-incident-response.md) — SLO design and incident management
- Kubernetes operator pattern: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
- Kubernetes policies: https://kubernetes.io/docs/concepts/policy
- Operating etcd clusters: https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/
- Istio architecture: https://istio.io/latest/docs/ops/deployment/architecture/
- Istio ambient overview: https://istio.io/latest/docs/ambient/overview/

---

## [SRE] Reference Answer: GPU And AI Kubernetes Platform

## Reference Answer: GPU And AI Kubernetes Platform

Use this as a quality bar for [lab-04-gpu-ml-ai-platform-review.md](lab-04-gpu-ml-ai-platform-review.md).

### 1. Requirements And Assumptions

I would first separate the workload classes because the platform requirements are not the same:

- normal stateless product services
- CPU-heavy batch jobs
- distributed GPU training jobs
- GPU or CPU inference services

Key assumptions:

- GPU nodes are expensive and must be tightly controlled
- some training jobs are multi-node and partially scheduled startup is wasteful
- inference may need lower latency and stronger availability than training
- observability must cover both Kubernetes behavior and accelerator utilization
- platform guardrails must prevent general workloads from consuming scarce GPU capacity

### 2. Cluster And Node Pool Strategy

I would not mix everything on homogeneous node pools.

I would use at least:

- general-purpose CPU node pools for product services
- batch-oriented CPU node pools for lower-priority jobs
- dedicated GPU node pools for training
- possibly separate GPU node pools for inference if latency and scaling behavior differ enough

Reasons:

- cost isolation
- scheduling clarity
- easier quota and taint strategy
- easier incident containment
- different autoscaling and maintenance policies

### 3. GPU Isolation Strategy

I would isolate GPU capacity using:

- dedicated GPU node pools
- taints on GPU nodes
- tolerations only for approved GPU workloads
- node labels and affinity for model-specific or accelerator-specific placement
- namespace-level quota or admission policy to restrict who can request GPUs

I would also explicitly control:

- allowed GPU resource requests
- maximum parallel jobs by team or tenant
- workload priority for expensive training versus business-critical inference

The goal is to make accidental GPU consumption difficult by default.

### 4. Drivers, Device Plugins, And Node Preparation

At the node layer, the platform needs:

- correct GPU drivers
- vendor device plugin
- node labeling for hardware characteristics
- validation that nodes are actually healthy before admitting expensive work

Operationally, I would treat GPU node readiness as stricter than ordinary node readiness, because a node can be "up" but still be unusable for the intended workload if drivers or plugin state are wrong.

### 5. Training Versus Inference Platform Design

#### Training

Training platform priorities:

- coordinated startup across workers
- fast east-west networking
- checkpointing
- data locality and input pipeline throughput
- restart and resume behavior
- queueing of scarce GPU resources

I would strongly consider a scheduling layer such as Kueue or an equivalent queueing mechanism for expensive jobs, especially if demand exceeds GPU supply.

For distributed jobs, I would likely use Kubeflow Trainer or a similar higher-level controller if the organization is serious about repeated training workflows, because plain Jobs are usually too primitive for long-term platform ergonomics.

#### Inference

Inference platform priorities:

- startup latency
- warm capacity
- batching strategy
- queueing and concurrency control
- model memory fit
- predictable routing and autoscaling

For inference, I would evaluate KServe if teams need standardized model serving workflows, inference protocol consistency, and traffic management features.

I would treat predictive inference and generative inference differently:

- classic predictive models may be dense and CPU-friendly
- generative inference often needs stronger GPU isolation, longer request duration, streaming support, and tighter concurrency control

### 6. Scheduling And Admission Strategy

For general multi-tenancy, I would combine:

- taints and tolerations
- node affinity
- resource quota
- priority classes
- admission policy

For distributed training, I would explicitly address the "partial start" problem. If four workers are needed and only two start, the platform can burn GPU time without useful progress.

That is why gang-like or coordinated scheduling behavior matters. Even if Kubernetes does not natively provide all of it, the platform should enforce queueing or orchestration logic that prevents expensive half-starts.

### 7. Storage And Data Movement

AI workloads fail in boring ways if data movement is ignored.

I would explicitly design:

- where training data lives
- how workers read it
- whether data locality matters
- where checkpoints live
- how resume works after node or job failure

Checkpointing is part of reliability, not just ML convenience.

Without it, preemption, node failure, or control-plane events can waste hours or days of training time.

### 8. Observability

I would require both platform and workload observability.

Platform-level:

- node health
- pod scheduling delay
- queue backlog for GPU jobs
- GPU capacity and allocatable tracking
- cluster events
- device plugin health

Workload-level:

- GPU utilization
- memory utilization on accelerators
- training step throughput
- data loader stalls
- inference queue depth
- per-model latency
- error and timeout rate

For incident response, I would want dashboards separating:

- scheduler or queue pressure
- node or device health
- training throughput
- inference latency

### 9. Failure Handling

#### Training Failures

For training, I would favor:

- checkpointing
- queued restart behavior
- explicit retry policy only when it makes economic sense
- clear handling for node interruption or preemption

#### Inference Failures

For inference, I would favor:

- strict concurrency limits
- warm capacity for critical models
- fallback behavior if a GPU model backend becomes saturated
- clear separation between availability policy and cost optimization

### 10. Tooling Choices

My rough decision model:

- plain Kubernetes for simple isolated jobs
- Kubeflow Trainer when multi-worker training becomes a repeated product need
- Kueue when GPU supply is scarce and fair, queued admission matters
- KServe when teams need shared model-serving patterns and governance

I would avoid adopting all of them just because they exist. Each controller adds operational weight and new failure modes.

### 11. Cost And Platform Governance

This platform can become financially unsafe if governance is weak.

So I would add:

- GPU budget visibility by team
- quota and admission guardrails
- idle capacity review
- stronger approval or queue policy for very large training jobs
- separate SLOs for inference and platform control services

Critical principle:

- product-serving inference and exploratory training do not deserve the same scheduling policy

### 12. What I Would Keep Simple

I would avoid:

- one giant cluster policy pretending all workload classes are the same
- uncontrolled self-service GPU scheduling
- adding mesh to every training path by default
- adopting too many operators before operational ownership is clear

I would keep the initial platform opinionated:

- clear workload classes
- dedicated GPU pools
- one queueing strategy for scarce GPUs
- one preferred training controller path
- one preferred inference platform path

That usually gives better reliability and cost control than a highly flexible but weakly governed platform.
