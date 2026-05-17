---
title: "Real-World Examples"
sidebar_position: 7
---

# Kubernetes & Containers — Real-World Examples

Patterns and case studies based on how production clusters are actually run — what works, what burns engineers, and what staff/principal engineers are expected to design.

---

## 1. Multi-Tenant Platform for 50 Engineering Teams

**Context:** A platform team supports ~50 product teams across two business units. Each team needs autonomy without endangering the cluster.

**Design:**
- **Namespace-per-team**, named `team-<id>-<env>` (e.g. `team-payments-prod`).
- **RBAC** scoped per namespace; teams get `edit` Role within their namespace, never cluster-wide.
- **NetworkPolicy default-deny** in every namespace, with explicit allow rules for cross-team APIs only.
- **ResourceQuota** per namespace capping CPU/memory/storage requests.
- **LimitRange** providing default requests/limits so a team forgetting to set them does not get scheduled with zero requests.
- **Separate node groups** per workload tier — general-purpose, compute-optimized, GPU, spot (with required tolerations). Stateful workloads pinned off spot nodes via `nodeAffinity`.
- **Kyverno** enforces label taxonomy (`app`, `team`, `env`, `version`, `tier`) on every Pod. Cost showback billing is keyed off these labels.
- **GitOps namespace provisioning** via ArgoCD `ApplicationSet`: a new team is added by opening a PR to a Git repo. The platform team approves; ArgoCD reconciles the namespace, RBAC, quotas, and policies.

**Why this is staff-level:** the design balances autonomy (teams move fast within their namespace), guardrails (quotas + policies prevent any team from breaking another), and operational sanity (everything provisioned through Git, no snowflakes).

---

## 2. Production-Grade Java Web App on EKS (Petshop Reference Architecture)

A real DevOps project pattern: deploy a Java Petshop application end-to-end with CI/CD, security scanning, and infrastructure provisioning.

**Toolchain:**
- **Compute:** AWS EC2 (Ubuntu 22.04, t2.large) for Jenkins controller; EKS for runtime.
- **CI:** Jenkins with JDK 17 + Maven, configured to run on port 8090 (port 8080 freed for app).
- **Code quality:** SonarQube on port 9000.
- **Security:** Trivy for image scanning + OWASP Dependency Check plugin for SCA.
- **Container:** Docker for build; published to Docker Hub or ECR.
- **Orchestration:** Kubernetes via `eksctl`-provisioned EKS cluster.
- **Config mgmt:** Ansible for VM bootstrap, with master/worker inventory.

**Pipeline stages:**
1. **Checkout** — `git clone github.com/Aj7Ay/jpetstore-6.git`.
2. **Build** — `mvn clean package`.
3. **SAST** — SonarQube scanner publishes results back via webhook.
4. **SCA** — OWASP Dependency Check fails the build on critical CVEs.
5. **Image build** — Docker multi-stage build, final stage `eclipse-temurin:17-jre-alpine`.
6. **Image scan** — `trivy image --severity HIGH,CRITICAL --exit-code 1`.
7. **Push** — to registry with both `:latest` and `:<git-sha>` tags.
8. **Deploy** — Ansible run targets the K8s master, applies updated manifests via `kubectl`.

**Why this matters:** every "DevOps interview project" gets you to here. The real lessons are at the seams: how Jenkins authenticates to the cluster (kubeconfig credential vs IRSA service account), how secrets are passed (Vault + External Secrets Operator, not Jenkins credentials), how rollbacks happen (`kubectl rollout undo`, not re-running the pipeline).

---

## 3. Blog Application on EKS with Full Observability Stack

**Architecture:**
- **EKS** managed cluster (1.30), 3 AZs, managed node group.
- **Application:** containerized Node.js blog with Postgres backend.
- **CI/CD:** Jenkins → Nexus (artifact storage) → SonarQube (quality gate) → Trivy (image scan) → ArgoCD (GitOps deploy).
- **Monitoring:** Prometheus + Grafana + Loki for logs.
- **Ingress:** AWS ALB Ingress Controller — one ALB for all HTTPS traffic via host-based routing.
- **Storage:** EBS-backed PVC for Postgres via `aws-ebs-csi-driver`.

**Critical wiring:**
- IRSA (IAM Roles for Service Accounts) gives the ALB controller and EBS CSI driver IAM permissions without long-lived secrets.
- ArgoCD watches a separate `infra` repo for cluster add-ons (cert-manager, external-dns, ALB controller) and a `apps` repo for application manifests.
- Prometheus scrapes `/metrics` from every Pod that has the `prometheus.io/scrape: "true"` annotation.
- Loki indexes by labels only (cheap); log content sits in object storage.

**Cost lever:** ALB is shared, so 50 microservices cost one ALB, not fifty. Karpenter (not Cluster Autoscaler) picks instance types per workload — spot bias for stateless, on-demand for stateful, GPU for ML inference.

---

## 4. Zero-Downtime Cluster Upgrade Playbook

**Goal:** Move an EKS cluster from 1.30 → 1.31 without dropping user traffic or losing data.

**Pre-flight (1–2 weeks before):**
1. Run `pluto detect-helm` and `pluto detect-files` across all manifests for **deprecated APIs** between target versions.
2. Audit every workload for a **PodDisruptionBudget** — without one, node drains will silently take the deployment offline.
3. Validate **admission webhooks** (Kyverno, OPA, ALB controller, etc.) against the target Kubernetes version — webhook authors lag behind upstream.
4. Take a fresh **etcd snapshot** (EKS handles this transparently, but verify backup retention).
5. Document the **rollback plan** in writing — if step N fails, what is the recovery action?

**Execution:**

```bash
# 1. Control plane first — never skip minor versions
eksctl upgrade cluster --name prod --region eu-west-1 --version 1.31 --approve

# 2. Verify control plane health before touching nodes
kubectl get componentstatuses
kubectl get nodes
kubectl get --raw='/readyz?verbose'

# 3. Upgrade managed node groups one at a time
eksctl upgrade nodegroup --cluster=prod --name=ng-1 --kubernetes-version=1.31

# 4. Watch as kube-proxy / kubelet roll across nodes
kubectl get nodes -w
```

**Per-node-drain sequence** (Cluster Autoscaler-managed nodes):

```bash
kubectl cordon <node>
kubectl drain  <node> --ignore-daemonsets --delete-emptydir-data --timeout=10m
# … node is replaced by an upgraded one …
kubectl uncordon <new-node>     # usually not needed; autoscaler removes drained node
```

**Validation gate after every node group:** run the smoke-test suite against the cluster; if SLOs degrade, halt the upgrade and investigate before continuing.

---

## 5. Cascading-OOMKill Incident

**Symptom:** Multiple Pods restarting across a node; new Pods scheduled there immediately get evicted.

**Investigation:**

```bash
kubectl top nodes
kubectl top pods -A --sort-by=memory | head -20
kubectl get events -A --field-selector reason=Evicted
kubectl describe node <hot-node> | grep -A5 'Allocated resources\|Conditions'
```

**Root cause** (typical): a memory-leaking workload with no limits set crept above the node's allocatable. The kubelet's eviction manager triggered when memory pressure hit `evictionHard.memory.available<200Mi`. BestEffort Pods on the node got evicted first, but the leaking Pod was Burstable so it stayed — repeating the cycle.

**Fix at the cluster level:**
- Add a `LimitRange` with default memory limits in every namespace.
- Enforce a Kyverno policy that requires `resources.requests` and `resources.limits` on every container.
- Run VPA in `recommendation` mode for 2–4 weeks to baseline actual usage; then bump requests to p95 actual, limits to ~1.2× p95.
- Monitor `container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.8` and page on sustained breach.

**Fix at the Pod level:** rebuild the workload with a heap dump on OOM, profile, fix the leak.

---

## 6. DNS Outage Caused by `ndots:5`

**Symptom:** Intermittent `connection refused` errors when Pods talk to internal Services. Resolves itself, then comes back.

**Investigation:** CoreDNS Pods are at 100% CPU. Query logs show requests for `my-svc.namespace.svc.cluster.local.cluster.local` — clearly junk.

**Root cause:** Default `ndots:5` in `/etc/resolv.conf` means any hostname with fewer than 5 dots is tried with every search domain appended first. A single `my-svc.namespace.svc.cluster.local` lookup becomes 5 lookups. At thousands of QPS, CoreDNS chokes.

**Fix:**

```yaml
# At Pod spec level — override ndots
dnsConfig:
  options:
  - name: ndots
    value: "2"
```

**Better fix at the cluster level:**
- Scale CoreDNS to 2+ replicas with an HPA tied to CPU.
- Install **NodeLocal DNSCache** as a DaemonSet — caches DNS on every node, eliminates the cross-node hop and the bursty load on CoreDNS.
- Audit which workloads issue external DNS queries (`*.amazonaws.com`, `*.googleapis.com`) and ensure their `ndots` is set to 1 so the search-domain prepending stops.

---

## 7. Image Pull Throttling from Docker Hub

**Symptom:** Across the cluster, Pods stuck in `ImagePullBackOff`. Pulling the same image manually with `docker pull` says `429 Too Many Requests`.

**Root cause:** Docker Hub rate limit (100 pulls / 6h per anonymous IP, 200 for free authenticated). At cluster scale, a single node group share one NAT IP — easy to exceed.

**Fix:**
- Run a **pull-through cache** (Harbor or ECR Public mirror).
- Update every workload's image reference to use the mirror: `harbor.internal/library/nginx` instead of `docker.io/library/nginx`.
- Configure containerd's `registry mirrors` so the rewrite is transparent.
- Authenticate to Docker Hub via cluster-scoped `imagePullSecret` if a mirror is not yet available (raises the limit to 200/6h).

---

## 8. StatefulSet Scale-Down Lost Data (Postgres Replicas)

**Symptom:** During a planned scale-down (`replicas: 3 → 1`), the Postgres operator marked `postgres-2` and `postgres-1` for deletion. Their PVCs were *also* deleted by a cleanup CronJob, taking their data with them.

**Root cause:** A "PVC orphan reaper" CronJob was deleting any PVC that was not currently bound. StatefulSet scale-down detaches PVCs but does not remove them — that is intentional, the operator wants those to come back when you scale up. The CronJob blew through that intent.

**Fixes:**
- Remove the reaper, or scope it to ignore PVCs labelled `app.kubernetes.io/managed-by=statefulset`.
- Restore from backup. (Always have a backup. Postgres → pgBackRest or Velero with a CSI snapshot class.)
- Add a runbook step: before scaling down a StatefulSet, snapshot the PVC.

---

## 9. Spot Instance Mass-Eviction

**Symptom:** Five workers (all spot) reclaimed by AWS within a 90-second window. Service availability dropped to 60% for ~3 minutes until replacements came online.

**Mitigation:**
- **Topology spread constraints** with `maxSkew: 1` across nodes so a multi-node loss does not concentrate impact on one workload.
- **PodDisruptionBudgets** are *not* honoured during spot reclamation (AWS does not coordinate with the API server).
- Run a **node-termination-handler** (`aws-node-termination-handler` DaemonSet) — it watches the EC2 instance metadata for the 2-minute interruption notice and triggers `kubectl drain` early.
- Mix node groups: a baseline of on-demand sized for p50 traffic, spot for the burst.
- For latency-critical paths, refuse spot — use a `nodeAffinity` that pins the workload off `karpenter.sh/capacity-type: spot`.

---

## 10. Helm Release Stuck in `pending-upgrade`

**Symptom:** `helm upgrade` was Ctrl-C'd mid-flight. The next `helm upgrade` fails with `another operation (install/upgrade/rollback) is in progress`.

**Resolution:**

```bash
# Inspect what Helm thinks is happening
helm history my-app -n my-ns

# Force rollback to the last successful revision
helm rollback my-app <last-good-rev> -n my-ns

# If history is empty / Helm refuses, edit the release status secret directly
kubectl get secret -n my-ns -l owner=helm,name=my-app
kubectl patch secret sh.helm.release.v1.my-app.v3 -n my-ns \
  --type=json -p='[{"op":"replace","path":"/data/status","value":"<base64 of failed>"}]'
```

**Prevention:** wrap deploys in CI with a timeout (`helm upgrade --timeout 10m --atomic`). `--atomic` auto-rolls back on failure and clears the stuck state.

---

## 11. Single Cluster vs Multi-Cluster: Choosing the Boundary

**Single cluster, multi-tenant** — cheaper, simpler, easier upgrades, one place to monitor. Bad when:
- Compliance (PCI, HIPAA, FedRAMP) requires hard isolation.
- A noisy team can DoS the API server.
- A bad CRD or admission webhook can take down all tenants.

**Multi-cluster** — independent failure domains, per-team or per-region clusters. Bad when:
- Operating one cluster is already painful — multi-cluster is exponential overhead unless you automate ruthlessly.
- Cross-cluster service discovery is needed (mesh federation is operationally heavy).

**Staff engineer rule:** one cluster per environment minimum (dev/staging/prod). Separate clusters per regulated workload or per region. Use **Cluster API** + GitOps so cluster creation is itself reproducible.

---

## 12. Image Supply Chain Security Pipeline

End-to-end pipeline that earns a SLSA Level 3 attestation:

```
Developer pushes commit
   → CI builds image with kaniko / buildx
       → Trivy scan: fail on CRITICAL CVEs
           → SBOM generated (Syft, CycloneDX format)
               → Image signed with Cosign (Sigstore keyless via OIDC)
                   → Push to registry
                       → ArgoCD reconciles Helm release
                           → Kyverno admission policy verifies Cosign signature
                               → If verification fails, Pod is rejected at admission
```

**Key controls:**
- Kyverno `verifyImages` policy with a list of trusted Cosign identities.
- Block `:latest` tags in production namespaces (`require-image-tag` policy).
- Build provenance (SLSA) attached as a Cosign attestation; auditable later.

---

## 13. Cost Reduction Patterns That Actually Move the Needle

In rough order of impact:

1. **Right-size requests** — most teams over-request by 2–3× p95. Run VPA in `recommendation` mode, push requests down. Often cuts 30–40% off the bill alone.
2. **Karpenter or Cluster Autoscaler with bin-packing** — choose instance types per workload, scale down at night, batch jobs onto spot.
3. **Compress the ingress layer** — one ALB per cluster (not per service) saves $20/month × N services.
4. **Eliminate idle namespaces** — automated reaper that deletes namespaces with zero traffic for 30 days (with notification first).
5. **Move stateful workloads to managed services** — RDS, ElastiCache, MSK if not already. The K8s-self-hosted tax (operator licensing, backups, upgrades) is rarely worth it.
6. **Use ARM/Graviton nodes** — 20–40% cheaper on AWS, same performance for most JVM/Go workloads.
7. **Switch CoreDNS to NodeLocal DNSCache** — eliminates a class of "extra DNS Pods to handle scale" growth.

---

## 14. Design Question Cheat Answers (staff/principal interview)

**"Design a Kubernetes platform for 50 teams"**
Namespace-per-team, RBAC scoped per namespace, NetworkPolicy default-deny, ResourceQuotas, LimitRanges, multiple node groups by tier, Kyverno for label/policy enforcement, GitOps-driven namespace provisioning, cost showback via labels, separate clusters per environment.

**"Zero-downtime upgrade"**
PDB audit, API deprecation check with `pluto`, webhook compatibility, control plane first (never skip minor), node groups one at a time with drain + validation gates, document rollback plan before starting.

**"How does a request flow from outside the cluster to a Pod?"**
External LB / ALB → Ingress Controller (terminates TLS) → Service ClusterIP → kube-proxy iptables/IPVS rules on the node → CNI routes to Pod IP → containerd → process. With eBPF/Cilium, the kube-proxy step is bypassed.

**"StatefulSet or Deployment?"**
StatefulSet only when you need stable identity (Pod hostname for peer discovery), ordered rolling updates, or per-Pod PVCs. Otherwise Deployment — it is simpler, faster to roll, easier to rollback, and PVC cleanup is automatic.

**"Node runs out of memory — what happens?"**
kubelet evicts Pods by QoS class: BestEffort first, Burstable ordered by memory usage, then Guaranteed. Linux OOM killer can also kill processes. Container memory `limit` triggers OOMKill (exit 137) before node-level eviction. `PriorityClass` affects eviction ordering — higher priority Pods are evicted later.

**"Multi-cluster — when?"**
Compliance boundaries (PCI, HIPAA, FedRAMP), independent failure domains for blast radius, per-region for latency. Avoid otherwise — multi-cluster overhead is steep unless you have Cluster API + GitOps automating it.

**"Secrets — how do you handle them?"**
Never raw in Git. Three viable patterns: External Secrets Operator → AWS Secrets Manager / Vault / GCP SM; Sealed Secrets (encrypted in Git, decrypted in cluster); CSI Secrets Store Driver (mounts secrets directly from Vault). At minimum: encrypt etcd at rest, RBAC restricts `get secrets`, audit logging on every Secret read.

---

## 15. GPU/AI Platform For A Multi-Workload Tenant

**Context:** A company builds an AI compute platform on Kubernetes serving four workload classes simultaneously: general stateless services, scheduled CPU batch, distributed GPU training, GPU and CPU inference. Cost control and tenant isolation are non-negotiable.

**Workload separation principle:** training is long-running and interruptible; inference is latency-sensitive and availability-critical. Mixing them on shared node pools creates scheduling interference and makes cost accounting impossible.

**Node pool layout:**

| Pool | Hardware | Taint | Autoscaling |
|---|---|---|---|
| general-cpu | mixed | none | cluster-autoscaler |
| batch-cpu | spot | `workload=batch:NoSchedule` | aggressive scale-down |
| gpu-training | H100 nodes, RDMA | `workload=gpu-training:NoSchedule` | manual + Karpenter |
| gpu-inference | A10G nodes | `workload=gpu-inference:NoSchedule` | HPA-driven on latency |

**GPU isolation in depth:**

- Dedicated node pools with taints.
- Tolerations only on approved workloads (Kyverno verifies the toleration is paired with the right tenant label).
- `ResourceQuota` with `requests.nvidia.com/gpu: "0"` in every non-GPU namespace.
- Admission policy rejecting any pod requesting `nvidia.com/gpu` from an unapproved namespace.
- GPU node readiness is **stricter** than ordinary readiness: a node is "GPU-Ready" only when the device plugin advertises `nvidia.com/gpu` allocatable and validator jobs pass. A node can be `Ready: True` but unusable.

**Training reliability — addressing the partial-start problem:**

- Kueue manages a `ClusterQueue` per team with H100 quota.
- Jobs submitted with `kueue.x-k8s.io/queue-name: team-ml` stay Suspended until all required workers can land together.
- Checkpointing to S3 every 30 minutes via a sidecar; on node loss, the next admission resumes from the last checkpoint.
- Spot reclamation does **not** respect PDBs; the platform explicitly accepts this and pairs it with frequent checkpoints.

**Inference reliability:**

- KServe `InferenceService` for protocol standardization (predict / explain / metadata).
- Generative inference (LLMs) has long request duration, streaming, and tight concurrency limits — pinned to A10G/H100 with vLLM batching.
- Predictive inference (classic models) is dense, often CPU-friendly — runs on general-cpu with HPA on queue depth.
- Critical models maintain `minReplicas >= 2` — never scale to zero (cold start is 30s-3min for large LLMs).

**Observability split:**

- **Platform-level:** node health, scheduler delay, queue backlog, GPU allocatable tracking, device plugin health, cluster events.
- **Workload-level:** DCGM GPU util, GPU memory util, training step throughput, data loader stalls, inference queue depth, per-model latency, inference error rate.

**Cost governance:**

- Cost showback by team via mandatory `team`, `app`, `env`, `tier` labels (Kyverno-enforced).
- GPU budget visibility per team.
- Approval flow for jobs requesting > 8 GPUs.
- Quarterly review of idle allocated GPU hours per team.

**Critical principle:** product-serving inference and exploratory training do not deserve the same scheduling policy. Treat them as separate platforms even if they share infrastructure.

---

## 16. The 11-Operator Audit

**Context:** A platform team has accumulated 11 operators over two years (Prometheus, cert-manager, External Secrets, ArgoCD, Kyverno, Karpenter, GPU operator, Kubeflow Trainer, KServe, Istio, Velero). A new staff engineer is asked to audit.

**Risk classification:**

| Operator | Risk class | Why |
|---|---|---|
| Prometheus operator | Low | Only manages its own CRDs |
| External Secrets | Low | Reconciles Secret objects, no admission webhook |
| cert-manager | High | Mutating webhook on Pods (`/inject-ca-from`) |
| Kyverno | High | Validating + mutating webhooks on every API write |
| ArgoCD | Medium | Cluster-wide RBAC, no admission webhook |
| Karpenter | Medium | Mutates nodes directly |
| GPU operator | High | Patches kubelet config + DaemonSets on every GPU node |
| Kubeflow Trainer | Low | Manages its own CRDs |
| KServe | Medium | Mutating webhook for InferenceService injection |
| Istio | High | Mutating webhook for sidecar injection |
| Velero | Low | Custom resources only |

**Findings reported to leadership:**

1. **Three rarely-used operators** (Velero is dormant because no restore drills have run; one analytics operator deployed two years ago has no current consumer; one legacy operator has been superseded). Decision: remove the two unused ones; keep Velero but enforce quarterly drills.
2. **cert-manager + Kyverno + Istio** webhook chain is the cluster's single biggest risk. A bad upgrade of any of these can block all Pod admission. Mitigations applied: each runs with PDB `minAvailable: 2`, dedicated node anti-affinity, `failurePolicy: Ignore` for non-security policies, narrow `objectSelector` to exclude `kube-system`.
3. **Operator health was invisible** beyond "is the pod Running." Added per-operator metrics: `reconcile_duration_seconds`, `reconcile_errors_total`, `webhook_response_seconds`. Alerts on reconcile lag (CR has not been reconciled in > 5 min).

**Policy rollout protocol established:**

1. **Audit mode** for 2 weeks per new policy.
2. **Enforce on new namespaces only** for 2 weeks.
3. **Enforce broadly** after sign-off from a Platform Council.

**Incident before this audit:** a Kyverno policy in `Enforce + Fail` mode was deployed to prevent pods without resource limits. The Kyverno pod restarted during a Karpenter scale-up event; every node-bootstrap pod from Karpenter was rejected; the cluster lost autoscaling capability for 18 minutes. Post-incident: `failurePolicy: Ignore` for that policy plus an annotation marker that exempts Karpenter-owned bootstrap pods.

---

## 17. Service Mesh Adoption Decision

**Context:** The team wants to adopt Istio. The pitch is "mTLS, observability, traffic management." The staff engineer pushes back for evidence.

**Decision framework documented:**

| Need | Existing solution | Mesh adds |
|---|---|---|
| Pod-to-pod mTLS | Cilium with mutual auth | Stronger identity via SPIFFE |
| L7 observability | Cilium Hubble L7 | Per-route metrics, distributed tracing integration |
| Canary deployment | Argo Rollouts | Mesh-level weighted routing across hostnames |
| Circuit breaking | Application-level (resilience4j, hystrix) | Mesh-level, language-agnostic |
| Per-workload AuthN/AuthZ | NetworkPolicy + app code | `AuthorizationPolicy` (JWT validation, etc.) |

**Outcome:** the team did **not** adopt Istio. The actual pain was visibility, which Cilium Hubble solved. Distributed tracing was added via OpenTelemetry SDK in apps, not the mesh.

**What would have changed the decision:**

- Mandatory regulatory mTLS with audit trail (would have required Istio's `PeerAuthentication`).
- A weekly canary requirement that Argo Rollouts could not express (would have required Istio `VirtualService` weights).
- Cross-cluster east-west traffic with strong identity (Istio multicluster).

**Honest accounting of cost avoided:**

- ~50-150MB sidecar memory × 500 pods = 25-75GB cluster RAM saved.
- ~30-80ms pod startup latency avoided.
- istiod control plane operations (cert rotation, xDS configuration distribution) not on the team's plate.

---

## 18. DR Drill That Revealed False Confidence

**Context:** Platform team claimed "DR-ready" with daily etcd backups + Velero schedules. Quarterly drill exposes the gap.

**Drill scenario:** Simulate full control-plane loss in the staging cluster. Goal: 1-hour RTO.

**Timeline of the drill:**

- 00:00 — control plane stopped.
- 00:08 — new control plane provisioned via Cluster API.
- 00:15 — etcd restored from snapshot. API server up.
- 00:25 — kubelets reconnect, nodes go `Ready`. But pods don't run.
- 00:30 — discovered: image pull secrets pointed at a registry IP that changed since the snapshot. ImagePullBackOff cluster-wide.
- 00:50 — secrets updated, pods schedule.
- 01:10 — most pods running. But Postgres replicas show "incompatible WAL" errors. Last app data was 6 hours stale because Velero PV snapshots had been failing silently for 3 days.
- 03:45 — pgBackRest restore from off-cluster object storage completes. App data current to ~5 min before failure.
- **Actual RTO: 3h 45m. Stated SLA: 1h.**

**Findings:**

1. etcd backup tested in isolation does not validate recovery — secrets, image refs, certs, and PV bindings can all break.
2. Velero "Backup Completed" status does not mean PV snapshots succeeded — PV snapshot failures were logged but un-alerted.
3. Application-level backup (pgBackRest) is independent of cluster backup and must be tested as part of the drill.
4. Cert expiry was a hidden risk: the etcd snapshot held kubelet client certs that had 30 days left; if the disaster happened on day 35, the restore would have failed at the TLS handshake.

**Changes after the drill:**

- Renegotiated SLA: 1h for stateless, 4h for stateful — written down honestly.
- Velero PV snapshot success rate is a primary alert (was a low-priority warning).
- Cert expiry monitor added; rotate before backup retention window expires.
- Drill cadence increased from annually to quarterly with rotating scenarios.
- DR runbook split into three documents: etcd recovery, cluster rebuild, application data restore.

---

## 19. Probe Death-Spiral During Peak Load

**Context:** A payments API service goes hard down at 14:23 UTC during peak traffic. Error rate climbs from 0.1% to 80% in 4 minutes.

**Investigation:**

- `kubectl get pods` shows pods restarting in a wave.
- `kubectl describe pod` reveals `Liveness probe failed: HTTP probe failed with statuscode: 504` repeatedly.
- The liveness probe was `timeoutSeconds: 1, failureThreshold: 2`.

**Mechanism reconstructed:**

1. Traffic spike pushed app P99 from 200ms to 800ms.
2. Two 1-second liveness probes timed out back-to-back. Kubelet restarted the container.
3. The restart removed the pod from the EndpointSlice. Remaining pods got proportionally more traffic.
4. Their latency rose further. They failed probes faster.
5. Within 3 minutes, most pods had been restarted during peak. Connection pools were drained. Caches were cold.
6. Death spiral — every restart made the next restart more likely.

**Recovery:** scaled the deployment from 8 to 24 replicas, restarted enough capacity to absorb traffic, then reduced after the cache warmed.

**Fix:**

```yaml
livenessProbe:
  httpGet: { path: /livez, port: 8080 }
  initialDelaySeconds: 30
  periodSeconds: 20
  timeoutSeconds: 5          # was 1 — now generous
  failureThreshold: 5        # was 2 — sustained failure required
```

**Plus** a `/livez` endpoint that **only** checks the process is responsive, not downstream dependencies. Database health is checked separately by a circuit breaker in the app code, not by the probe.

**Prevention:**

- CI lint rule (kube-score) flags liveness probes with `timeoutSeconds < 3` or `failureThreshold < 3`.
- Probe latency itself is monitored — `kubelet_probe_duration_seconds` from the kubelet metrics endpoint.
- Standardized `/livez` endpoint pattern across services.

---

## 20. Conntrack Exhaustion During A Load Test

**Context:** Pre-launch load test on a new API. At 14k concurrent connections, ~5% of new connections start timing out with no clear error. Existing connections remain stable.

**Investigation:**

```bash
tcpdump -i any -nn 'tcp[tcpflags] & tcp-syn != 0' | head -20
# SYN packets arrive at the node but no SYN-ACK
conntrack -S
# insert_failed: 12345
sysctl net.netfilter.nf_conntrack_max
# 65536 — default
```

**Root cause:** kube-proxy iptables mode relies on conntrack for reverse-NAT. The default `nf_conntrack_max` of 65536 was exceeded under load (200+ pods per node times average connections per pod). New connection tracking entries could not be inserted; SYN packets were silently dropped while established flows continued via existing entries.

**Cross-layer nature of the bug:**

- **Linux:** kernel parameter `nf_conntrack_max`.
- **Kubernetes:** Service implementation chose iptables mode (the historical default for many clusters).
- **Networking:** the inserted-failed counter is the silent signal that there is no application-layer error.

**Fix:**

```bash
# On every node, via a tuning DaemonSet or kubelet startup script
sysctl -w net.netfilter.nf_conntrack_max=524288
sysctl -w net.netfilter.nf_conntrack_buckets=131072
```

Plus a node-level DaemonSet that scrapes `/proc/sys/net/netfilter/nf_conntrack_count` and alerts at > 70% utilization.

**Long-term:** migrated to Cilium kube-proxy replacement. eBPF datapath bypasses conntrack for Service-mediated traffic entirely, so the problem cannot recur.

---

## 21. MTU Mishap After Migrating CNIs

**Context:** Migrated from a native-routing CNI to a VXLAN-overlay CNI. Most apps work. But one app's TLS uploads to a partner API hang at random — file uploads of < 1MB succeed, > 1MB hang.

**Investigation:**

- DNS works.
- Curl to a small endpoint works.
- `curl -T big.bin https://partner/upload` hangs.
- `ping -M do -s 1472 partner.example.com` — works (means MTU 1500 reachable).
- `ping -M do -s 1422 partner.example.com` from inside the pod — fails. Pod MTU was wrong.

**Root cause:** VXLAN encapsulation adds ~50 bytes. The new CNI was configured with MTU 1500 inside the pod, identical to the physical MTU. Large packets fragmented and were dropped silently at the encapsulation boundary because the DF (don't-fragment) bit was set by the TLS implementation.

**Fix:**

```yaml
# Reconfigure CNI pod MTU below physical MTU
veth_mtu = 1450    # 1500 - 50 (VXLAN overhead)
```

Plus a verification test in the CNI rollout playbook: a pod must successfully send a 1400-byte UDP packet with DF set to an external endpoint before the rollout proceeds.

**Lesson:** overlay CNI migrations need explicit MTU verification. Small workloads work; TLS uploads, JDBC, and any protocol that does not handle PMTU discovery gracefully break first.

---

## 22. Expensive Training Job Idle For 8 Hours

**Context:** A 4-worker distributed training job was submitted at 22:00 UTC. By 06:00 the job has accomplished 4% of its objective. Cost dashboard shows $480 of GPU charges for negligible progress.

**Investigation:**

- `kubectl get pods` — only 2 of 4 workers Running. The other 2 are Pending.
- The 2 Running workers are stuck waiting at the NCCL `all_gather` barrier for the missing peers.
- 2 GPUs are allocated and burning money for hours, doing nothing.

**Root cause:** plain `Job`-based training submission with no gang scheduling. The scheduler placed 2 workers when GPUs were available, then could not place the other 2 because a different lower-priority training job had taken the remaining slots.

**Fix at submission level:** introduced **Kueue** with all-or-nothing admission. Jobs now stay Suspended in the queue until all 4 GPUs can be allocated simultaneously.

**Fix at platform level:** PriorityClass scheme published — exploratory training, scheduled training, urgent training. Higher priorities preempt lower ones; preemption notifies the lower-priority job to checkpoint and exit cleanly within 5 minutes.

**Cost-tracking change:** dashboard now shows "GPU hours allocated but utilization < 10%" as a primary metric. The platform team reviews this weekly.

---

## 23. Inference Outage After Scale-To-Zero

**Context:** A cost-optimization sprint enabled scale-to-zero on a generative inference model. Two days later: a customer demo at 10:00 UTC. First request returns at 10:02:34 UTC — model cold-start was 2m 34s. Demo failed.

**Mechanism:**

- HPA min replicas was set to 0 with `behavior.scaleDown.stabilizationWindowSeconds: 60`.
- After an hour of no traffic, all pods were scaled away.
- The next request triggered a pod creation:
  - 5s scheduling
  - 20s image pull (large CUDA + model artifacts)
  - 1m 30s model weights load into GPU memory
  - 30s warm-up to stable latency
- Total cold-start: ~2m 25s.

**Fixes:**

1. **Minimum 2 warm replicas** for every customer-facing model. Reverted scale-to-zero for production inference.
2. **Pre-warm path:** synthetic heartbeat request from a CronJob every 5 minutes during business hours. Even if traffic drops, replicas are not idle long enough for the operator to scale them down.
3. **Model preload as init container:** the model artifact is staged into a `local-volume` cache on the GPU node by an init container. New pods on the same node skip the 20s image pull and 30s of the load.
4. **KServe `predictor.minReplicas: 2`** as the platform default; tenants who want scale-to-zero must opt in and acknowledge the cold-start SLO impact.

**Cost reality check:** scale-to-zero saved ~$120/month on this service. The customer demo failure cost a deal. Cost optimization must respect availability SLOs.

---

## 24. Partial-Rack Latency From A Bad NIC

**Context:** P99 latency on the API gateway spikes from 80ms to 1.2s. Pattern: only requests routed to nodes in one of three racks are affected.

**Investigation flow (correct order):**

1. `kubectl get pods -o wide` — map affected pods to nodes; nodes in rack 2 are slow, racks 1 and 3 are fine.
2. From a node in rack 2: `ethtool -S eth0 | grep -E 'errors|dropped'` — `rx_crc_errors` is 1247, neighbors have 0.
3. `ip -s link show eth0` — 0.4% drop rate, neighbors at 0.001%.
4. ToR switch port flapping confirmed via network team's syslog.

**Mistake we did NOT make:** starting from `kubectl logs` and the app side. The "partial rack" clue meant physical layer first.

**Fix:**

- Cordon and drain the 8 nodes in rack 2.
- Network team replaced the ToR switch port (a transceiver was failing).
- Uncordoned. Latency returned to 80ms within 10 minutes.

**Long-term:** node-level alert on `rx_crc_errors` growth rate. The metric existed but had no alert.

---

## 25. Sidecar Memory Overhead Crossed The Threshold

**Context:** After adopting Istio sidecar mode, the cluster's general-cpu node pool started running out of memory. Pods were getting OOMKilled at random — but not the application containers, the **sidecar** containers (exit code 137 on `istio-proxy`).

**Mechanism:**

- Each sidecar's memory request was set to 128Mi (the chart default) but workloads pushed peak usage to 200Mi during traffic spikes.
- Sidecars are part of the pod's QoS calculation. Setting `requests=limits` on the app but not the sidecar made the pod `Burstable`.
- Under node memory pressure, the sidecar (Burstable) was the first to be evicted/OOMKilled. App stayed up but lost its network identity.

**Fixes:**

1. Sidecar requests and limits updated to 256Mi each, making them part of a `Guaranteed`-class pod.
2. Cluster-wide ResourceQuota updated to account for the sidecar overhead (~25% capacity reserved for sidecars).
3. For low-traffic-budget pods, migrated to **Istio ambient mode** — no sidecar, node-level `ztunnel` handles L4 mTLS without per-pod memory cost.

**Lesson:** sidecars are not "free." When you adopt a mesh, recompute capacity. Latency-sensitive services may pay the cost gladly; high-density background workers should consider ambient mode or no mesh at all.
