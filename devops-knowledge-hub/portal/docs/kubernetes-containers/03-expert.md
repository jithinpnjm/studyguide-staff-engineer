---
title: "Expert"
sidebar_position: 3
---

# Kubernetes & Containers — Expert

## Custom Controllers and Operators

### The Operator Pattern

A Kubernetes Operator extends the Kubernetes API with domain-specific knowledge. It uses **Custom Resource Definitions (CRDs)** to define new resource types and a **controller** to reconcile desired state with actual state.

**Use cases:**
- Managing complex stateful applications (databases, message brokers)
- Automating Day 2 operations (backups, upgrades, failover)
- Encoding operational expertise in software

### Custom Resource Definition (CRD)

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.mycompany.com
spec:
  group: mycompany.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                version:
                  type: string
                replicas:
                  type: integer
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
```

```yaml
# Custom resource instance
apiVersion: mycompany.com/v1
kind: Database
metadata:
  name: prod-db
spec:
  engine: postgres
  version: "15"
  replicas: 3
```

### Controller Reconcile Loop

```go
// Simplified Go reconciler (controller-runtime)
func (r *DatabaseReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    db := &myv1.Database{}
    if err := r.Get(ctx, req.NamespacedName, db); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // Ensure StatefulSet exists with correct config
    desired := r.buildStatefulSet(db)
    existing := &appsv1.StatefulSet{}
    if err := r.Get(ctx, types.NamespacedName{Name: db.Name, Namespace: db.Namespace}, existing); err != nil {
        if errors.IsNotFound(err) {
            return ctrl.Result{}, r.Create(ctx, desired)
        }
        return ctrl.Result{}, err
    }

    // Update if needed
    if !reflect.DeepEqual(existing.Spec, desired.Spec) {
        existing.Spec = desired.Spec
        return ctrl.Result{}, r.Update(ctx, existing)
    }

    return ctrl.Result{}, nil
}
```

**Operator frameworks:**
- `controller-runtime` + `kubebuilder` (Go)
- `operator-sdk` (Go, Ansible, Helm)
- Kopf (Python)
- Java Operator SDK

---

## Admission Webhooks

Admission webhooks intercept requests to the Kubernetes API before objects are persisted to etcd.

### Two Types

| Type | Mutating | Validating |
|---|---|---|
| Can modify objects | Yes | No |
| Can reject objects | Yes | Yes |
| Order of execution | Before validating | After mutating |

### Use Cases
- Inject sidecars automatically (Istio, Linkerd)
- Enforce naming conventions
- Set default resource limits
- Validate security policies (OPA/Gatekeeper, Kyverno)

```yaml
# MutatingWebhookConfiguration
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
  - name: sidecar.example.com
    admissionReviewVersions: ["v1"]
    clientConfig:
      service:
        name: sidecar-injector-svc
        namespace: kube-system
        path: /inject
      caBundle: <base64-CA-cert>
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
    sideEffects: None
```

---

## etcd Internals

etcd is the brain of a Kubernetes cluster — a distributed, consistent key-value store based on the **Raft consensus algorithm**.

### Key Concepts

- **Raft** — Leader election ensures only one node writes at a time; majority quorum required for writes
- **MVCC** — Multi-version concurrency control; etcd keeps historical versions of keys
- **Watch** — Kubernetes controllers use etcd watches to get notified of changes without polling
- **Compaction** — Old revisions must be compacted to reclaim space

### etcd Operations

```bash
# etcdctl commands (requires ETCDCTL_API=3)
export ETCDCTL_API=3

# Check cluster health
etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Backup etcd
etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Restore etcd
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-restore

# List all keys
etcdctl get "" --prefix --keys-only

# Get a specific Kubernetes object from etcd
etcdctl get /registry/pods/default/my-pod
```

### etcd Sizing Guidelines

| Cluster Size | etcd Nodes | Min Memory |
|---|---|---|
| Small (<10 nodes) | 3 | 2 GB |
| Medium (<100 nodes) | 3-5 | 8 GB |
| Large (>100 nodes) | 5 | 16 GB |

- Always use odd numbers (3, 5, 7) for quorum
- Keep etcd latency under 10ms
- Use SSD storage for etcd

---

## Cluster Autoscaler

The Cluster Autoscaler (CA) automatically adjusts the number of worker nodes in a cluster when:
- Pods fail to schedule due to insufficient resources (scale up)
- Nodes are underutilized and pods can be rescheduled elsewhere (scale down)

### How it Works

1. CA watches for `Unschedulable` pod events
2. Simulates what would happen if a new node of each type were added
3. Picks the best node group and triggers the cloud provider API to add a node
4. For scale-down: checks nodes with utilization < 50% that could be emptied

```yaml
# Cluster Autoscaler Deployment (AWS EKS example)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  template:
    spec:
      containers:
        - image: registry.k8s.io/autoscaling/cluster-autoscaler:v1.28.0
          name: cluster-autoscaler
          command:
            - ./cluster-autoscaler
            - --v=4
            - --stderrthreshold=info
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/my-cluster
```

**CA Expanders (node group selection strategy):**
- `random` — Random group
- `most-pods` — Group that can schedule the most pending pods
- `least-waste` — Group with least wasted CPU/memory after scale-up
- `price` — Cheapest option (cloud provider dependent)

---

## Multi-Tenancy Patterns

### Namespace-Based Isolation

Basic isolation using namespaces + RBAC + ResourceQuotas + NetworkPolicies.

**Limitations:** Not true isolation — nodes are shared, noisy neighbor problems possible.

### Virtual Clusters (vcluster)

vcluster creates lightweight virtual Kubernetes clusters inside a namespace. Each tenant gets their own API server, etcd, and scheduler running as pods.

```bash
# Install vcluster
helm repo add loft-sh https://charts.loft.sh
helm install my-vcluster loft-sh/vcluster -n tenant-a --create-namespace

# Connect to virtual cluster
vcluster connect my-vcluster -n tenant-a
```

### Hard Multi-Tenancy

Separate physical clusters per tenant. Maximum isolation but highest operational overhead. Used in regulated industries (finance, healthcare).

---

## eBPF in Kubernetes

**eBPF (extended Berkeley Packet Filter)** allows running sandboxed programs in the Linux kernel without modifying kernel source code. Used by modern CNI plugins and security tools.

### Use Cases

- **Networking** — Cilium uses eBPF to replace kube-proxy entirely with faster packet processing
- **Observability** — Pixie, Tetragon capture syscalls and network flows without sidecars
- **Security** — Falco, Tetragon enforce security policies at the kernel level

### Cilium (eBPF-based CNI)

```bash
# Install Cilium
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium --namespace kube-system \
  --set kubeProxyReplacement=strict \
  --set k8sServiceHost=<API_SERVER_IP> \
  --set k8sServicePort=6443

# Check Cilium status
cilium status
cilium connectivity test
```

**Benefits over traditional kube-proxy:**
- No iptables rules (scales better for large clusters)
- Network observability via Hubble
- L7 load balancing and network policy

---

## Performance Tuning

### API Server Tuning

```yaml
# kube-apiserver flags
--max-requests-inflight=800          # Max concurrent non-mutating requests
--max-mutating-requests-inflight=400 # Max concurrent mutating requests
--watch-cache-sizes=pods#1000        # Size of watch cache per resource
--enable-admission-plugins=...       # Only enable needed admission plugins
```

### etcd Tuning

```yaml
# etcd flags
--quota-backend-bytes=8589934592     # 8 GB database size quota
--auto-compaction-mode=periodic
--auto-compaction-retention=1h       # Compact every hour
--heartbeat-interval=100             # ms
--election-timeout=1000              # ms
```

### Kubelet Tuning

```yaml
# kubelet config
evictionHard:
  memory.available: "500Mi"
  nodefs.available: "10%"
  imagefs.available: "15%"
kubeReserved:
  cpu: "200m"
  memory: "500Mi"
systemReserved:
  cpu: "200m"
  memory: "500Mi"
```

### Pod-Level Performance

```yaml
# Priority Classes
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
---
spec:
  priorityClassName: high-priority
  # Quality of Service classes:
  # Guaranteed: requests == limits (best for latency-sensitive)
  # Burstable: requests < limits
  # BestEffort: no requests/limits set (first to be evicted)
  resources:
    requests:
      cpu: "1"
      memory: "1Gi"
    limits:
      cpu: "1"
      memory: "1Gi"
```

---

## Advanced Docker: Multi-Stage Builds

Multi-stage builds drastically reduce final image size by separating build-time dependencies from runtime.

```dockerfile
# Stage 1: Build
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o myapp .

# Stage 2: Runtime (minimal image)
FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=builder /app/myapp .
USER nonroot:nonroot
ENTRYPOINT ["/app/myapp"]
```

**Results:** A Go binary that would be 800MB in a full image becomes <20MB using distroless.

---

## Service Mesh (Istio/Linkerd)

A service mesh provides observability, traffic management, and security between services without code changes.

### Key Features

| Feature | Description |
|---|---|
| mTLS | Automatic mutual TLS between services |
| Traffic splitting | Canary deployments, A/B testing |
| Retries/timeouts | Configured at mesh level, not in app code |
| Observability | Distributed tracing, metrics, access logs |
| Circuit breaking | Prevent cascade failures |

### Istio Traffic Management

```yaml
# VirtualService: 90% traffic to v1, 10% to v2 (canary)
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: my-app
spec:
  hosts:
    - my-app
  http:
    - match:
        - headers:
            x-user-group:
              exact: "beta"
      route:
        - destination:
            host: my-app
            subset: v2
    - route:
        - destination:
            host: my-app
            subset: v1
          weight: 90
        - destination:
            host: my-app
            subset: v2
          weight: 10
```

---

## GitOps with Argo CD

GitOps uses Git as the single source of truth for infrastructure and application state. Argo CD continuously reconciles the cluster state with what's in Git.

```bash
# Install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Create an Application
argocd app create my-app \
  --repo https://github.com/myorg/my-app \
  --path k8s/ \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace production \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

---

## Kubernetes Security Hardening

### Required Ports Reference

Knowing which ports are required helps when configuring firewalls, security groups, and network policies.

**Control Plane node ports:**

| Protocol | Direction | Port Range | Purpose |
|----------|-----------|------------|---------|
| TCP | Inbound | 6443 | Kubernetes API server |
| TCP | Inbound | 2379–2380 | etcd server client API (API server → etcd; etcd peer) |
| TCP | Inbound | 10250 | kubelet API (API server → kubelet) |
| TCP | Inbound | 10251 | kube-scheduler (localhost only in kubeadm setups) |
| TCP | Inbound | 10252 | kube-controller-manager (localhost only) |
| TCP | Inbound | 10255 | kubelet read-only API (deprecated; disable it) |

**Worker node ports:**

| Protocol | Direction | Port Range | Purpose |
|----------|-----------|------------|---------|
| TCP | Inbound | 10250 | kubelet API |
| TCP | Inbound | 10255 | kubelet read-only API (deprecated) |
| TCP | Inbound | 30000–32767 | NodePort Services |

**Network policy implication:** etcd (2379-2380) should only be reachable from the API server IP. Exposing etcd publicly is a critical vulnerability — an attacker with etcd write access owns the entire cluster.

### Pod Security Standards (PSS)

Replaces deprecated PodSecurityPolicy. Applied at namespace level.

```yaml
# Enforce restricted security standard
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

### Secure Pod Spec

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

### Image Security

```bash
# Scan images with Trivy
trivy image myapp:latest

# Sign images with Cosign
cosign sign --key cosign.key myregistry/myapp:latest
cosign verify --key cosign.pub myregistry/myapp:latest
```

---

## Kubernetes Networking — Packet Path Deep Dive

Kubernetes networking is where Linux networking, container networking, DNS, load balancing, policy, cloud networking, and service discovery meet. If you can explain the packet path, you can debug the packet path.

### Same-Node Pod-to-Pod Traffic

```text
Pod A eth0 -> veth pair -> bridge/eBPF datapath -> veth pair -> Pod B eth0
```

Failure points: app not listening on the bound interface, veth missing, CNI datapath broken, NetworkPolicy drop, local conntrack state.

### Cross-Node Pod-to-Pod Traffic — Overlay vs Native Routing

| Model | Mechanism | Tradeoff |
|---|---|---|
| Overlay (VXLAN, Geneve) | Encapsulate Pod packets in UDP between nodes | Easier setup, MTU overhead (~50 bytes for VXLAN), CPU encap cost |
| Native routing | Network fabric routes Pod CIDRs directly | More efficient, requires BGP or cloud route programming |
| eBPF native (Cilium) | Programmable kernel datapath, optional overlay | Best performance, deepest observability |

Overlay examples: Flannel VXLAN, Calico VXLAN, Cilium VXLAN.

Native examples: Calico BGP, Cilium native routing, AWS VPC CNI (Pod IPs in VPC subnet), Azure CNI.

### External Client → Pod Packet Path

```text
Internet -> Cloud Load Balancer -> Node (NodePort or LB target) -> kube-proxy/eBPF DNAT
        -> CNI delivers to veth -> Pod netns -> container process
Reply path reverses the same hops; conntrack un-NATs the reply.
```

When eBPF/Cilium is in the path, kube-proxy may be absent and XDP can handle early-path packet processing. iptables rules are replaced by eBPF programs in the TC ingress/egress hooks.

### Where MTU Issues Hide

Overlay adds encapsulation overhead. If the underlying network has MTU 1500 and the overlay adds 50 bytes, the pod MTU should be 1450. If not:

- small packets work
- large packets hang silently (no clear error)
- TLS handshake intermittently fails
- uploads succeed in dev, fail in prod

```bash
ping -M do -s 1472 <target>        # don't-fragment with 1472 bytes payload = 1500 MTU
tracepath <target>
ip link show eth0                  # check MTU
```

### Conntrack — The Stateful NAT Table

Linux conntrack tracks flows for NAT and firewall state. kube-proxy iptables mode relies on conntrack for reverse-NAT of the reply path.

```bash
conntrack -S                       # statistics including drops, insert_failed
sysctl net.netfilter.nf_conntrack_max
sysctl net.netfilter.nf_conntrack_buckets
ss -s                              # socket summary
```

Symptoms of conntrack exhaustion:

- **new** connections fail while existing ones continue
- DNS timeouts under load
- intermittent 503s during traffic spikes

Fix: raise `nf_conntrack_max` and `nf_conntrack_buckets`, add a node-level DaemonSet that alerts when conntrack usage exceeds 70%.

### Cilium And Hubble

Cilium replaces kube-proxy entirely with eBPF. Inspect:

```bash
cilium status
cilium service list                # Services and backends
cilium endpoint list               # Pods and their identities
cilium connectivity test
hubble observe --follow            # Live flow visibility
hubble observe --verdict DROPPED --type policy-verdict
```

Hubble surfaces drop reasons by NetworkPolicy name, identity, and direction — the kind of detail that takes hours to extract from iptables.

---

## NetworkPolicy — Default Behavior, Pitfalls, And DNS

NetworkPolicy is **allow-list** but only **after** a Pod is selected by a policy. Once a Pod is selected by an Ingress or Egress policy, traffic in that direction must be explicitly allowed.

A common production bug: applying an egress default-deny without allowing DNS. The pod cannot resolve any name and every external call hangs at name resolution. DNS uses **both TCP and UDP port 53**.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - { protocol: UDP, port: 53 }
    - { protocol: TCP, port: 53 }
```

NetworkPolicy requires a CNI that **enforces** it. Flannel does not. Calico, Cilium, and Weave Net do.

---

## GPU Platform — Operator, MIG, MPS, Time-Slicing

### NVIDIA GPU Operator

The GPU Operator automates GPU node setup. It manages:

- NVIDIA drivers (DaemonSet)
- container toolkit
- device plugin (advertises `nvidia.com/gpu` to kubelet)
- DCGM exporter (Prometheus metrics)
- MIG manager
- node feature discovery (labels nodes with `nvidia.com/gpu.product`, GPU count, driver version)
- validator jobs (verify each layer is healthy)

```bash
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl logs -n gpu-operator deploy/gpu-operator
kubectl logs -n gpu-operator ds/nvidia-dcgm-exporter
```

A GPU node can be `Ready: True` but **unusable** if the device plugin failed. Treat GPU node readiness as stricter than ordinary node readiness — probe `nvidia.com/gpu` allocatable on the node before scheduling expensive jobs.

### MIG — Multi-Instance GPU

MIG partitions supported GPUs (A100, H100) into hardware-isolated slices. Resources may appear as:

```text
nvidia.com/mig-1g.10gb
nvidia.com/mig-2g.20gb
nvidia.com/mig-3g.40gb
```

Useful when inference workloads do not need a full GPU and teams need hardware isolation. Tradeoff: more scheduling complexity, not all training workloads tolerate it.

### MPS (Multi-Process Service)

NVIDIA MPS allows multiple processes to share a GPU's compute context with finer-grained interleaving than time-slicing. No hardware partition — software multiplexing. Use for batch inference with multiple smaller models.

### Time-Slicing

The device plugin can advertise the same physical GPU multiple times (`replicas: 4` per GPU). Pods get a time slice of the GPU. Useful for development environments; **not** appropriate for production-latency-sensitive inference.

### Topology — NVLink, NVSwitch, PCIe, RDMA

GPU placement affects training throughput dramatically:

1. same GPU memory (no transfer)
2. NVLink / NVSwitch (intra-node, high bandwidth)
3. PCIe within the same host
4. InfiniBand / RDMA across nodes
5. plain Ethernet across nodes (slowest)

```bash
nvidia-smi topo -m
```

Distributed training (PyTorch DDP, Horovod, NCCL) collapses to the slowest link. Place workers on nodes connected by RDMA when possible. Node affinity + topology spread can express these preferences.

### NCCL And Distributed Training Signals

Distributed training uses NCCL for collective operations (all-reduce, all-gather). Important signals:

- all-reduce latency
- network throughput per worker
- straggler workers (one slow worker slows the whole step)
- RDMA error counters
- packet drops

```bash
nvidia-smi
ibstat
ibv_devinfo
ethtool -S <interface> | grep -E 'errors|dropped'
```

---

## Gang Scheduling — Kueue And Volcano

Default Kubernetes scheduler places pods independently. For multi-worker training, partial starts waste GPU time: if 4 workers are needed and only 2 schedule, those 2 GPUs sit idle waiting for peers.

Gang schedulers (Kueue, Volcano) enforce **all-or-nothing** admission:

- the job waits until all required resources are available
- then all workers start together

Concepts:

- **Queue** — admission ordering for one team or workload class
- **Quota** — total resources a queue can consume
- **Cohort / fair sharing** — borrow capacity between queues when idle
- **Workload priority** — high-priority jobs jump the queue

```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata: { name: training-pool }
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: [cpu, memory, "nvidia.com/gpu"]
    flavors:
    - name: gpu-h100
      resources:
      - { name: cpu, nominalQuota: 96 }
      - { name: memory, nominalQuota: 1024Gi }
      - { name: "nvidia.com/gpu", nominalQuota: 8 }
```

Without gang scheduling, expensive training jobs can spin partial workers for hours, burning GPU budget with zero progress.

---

## GPU Observability — DCGM Metrics

DCGM (Data Center GPU Manager) exporter publishes per-GPU metrics. Watch for:

- GPU utilization (compute, memory copy)
- memory used/free
- temperature
- power draw and throttling
- ECC errors
- **XID errors** (GPU fault codes — many are unrecoverable hardware faults)
- PCIe / NVLink throughput
- queue wait time (platform-level)
- training step throughput (workload-level)
- model load time (inference-level)

Bad signals: low utilization + high queue depth (scheduling/topology problem), memory near full (KV cache pressure or batch too large), XID errors (replace the GPU/node).

A common cost trap: **80% allocated GPUs but 20% actual utilization** — scheduling looks fine, business value is poor. Right-size requests, use MIG for inference, adopt queueing for training.

---

## Operators — Reconciliation Pattern

An Operator is a Kubernetes controller that encodes domain-specific operational logic via a Custom Resource.

```text
Watch desired state (CR) -> observe actual state -> reconcile difference -> update status
```

A reconciler is called whenever the watched resource changes (or on a periodic resync). Properties of a good Operator:

- **idempotent** — running reconcile twice produces the same result
- **status-rich** — surface conditions, lastReconcileTime, observed generation
- **safe during retries** — partial progress must be safe to repeat
- **not in the critical data path** — reconciliation lag should never break user traffic
- **observable** — emits metrics for reconcile duration, error rate, queue depth

### Kubebuilder / Operator SDK

Two common scaffolding tools both built on `controller-runtime`:

| Tool | Owner | Language |
|---|---|---|
| `kubebuilder` | Kubernetes SIG API Machinery | Go |
| `operator-sdk` | Red Hat / Operator Framework | Go, Ansible, Helm |
| `kopf` | Independent | Python |
| Java Operator SDK | Red Hat | Java |

```bash
# kubebuilder scaffold
kubebuilder init --domain example.com --repo example.com/widget
kubebuilder create api --group apps --version v1 --kind Widget
```

### CRD Versioning

CRDs evolve. Use multiple `versions:` entries with **conversion webhooks** to translate between them. Mark one as `storage: true`. Deprecate old versions before removing them.

```yaml
spec:
  versions:
  - name: v1beta1
    served: true
    storage: false
  - name: v1
    served: true
    storage: true
  conversion:
    strategy: Webhook
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig:
        service:
          name: convert-svc
          namespace: my-op
```

### Operator Risk Classification

Not all operators carry the same blast radius. A practical taxonomy:

| Risk class | Examples | Impact when broken |
|---|---|---|
| Low | Only manages its own CRDs, no cluster RBAC | The CR it manages stops reconciling |
| Medium | ClusterRoleBinding, cluster-wide controllers | Affects multiple namespaces |
| High | Mutating webhook on Pods, certificate manager with mutating webhook | Can break every workload's admission |

Audit:

```bash
kubectl get clusterrolebindings -o wide | grep -v system
kubectl get mutatingwebhookconfigurations
kubectl get validatingwebhookconfigurations
```

Operators that mutate Pods at admission are the highest risk — a bug there can stop the entire cluster from accepting new workloads.

---

## Admission Webhooks — failurePolicy And The Outage Trap

Admission webhooks intercept API requests. The `failurePolicy` choice has large operational consequences:

| failurePolicy | Behavior when webhook is unreachable |
|---|---|
| `Fail` | Reject the request (safer for security-critical policies) |
| `Ignore` | Allow the request (preserves availability) |

If a Kyverno or OPA validating webhook with `failurePolicy: Fail` becomes unavailable, the API server **rejects all writes** that match its rules. Deployments, scaling, self-healing — all blocked. The cluster appears frozen.

Safe patterns:

- `failurePolicy: Ignore` for non-critical policies (labeling, hints).
- `failurePolicy: Fail` only for security-critical policies, with the webhook scoped narrowly (`namespaceSelector`, `objectSelector`).
- Run the webhook with high replica count, PDB, and on dedicated control-plane-adjacent nodes.
- Exclude `kube-system` from webhook rules to avoid self-bootstrap deadlock.
- Stage policies: `Audit` mode first, `Enforce` on new namespaces, `Enforce` broadly only after burn-in.

```yaml
webhooks:
- name: validate.kyverno.svc
  failurePolicy: Ignore       # or Fail — choose deliberately
  timeoutSeconds: 5
  namespaceSelector:
    matchExpressions:
    - { key: kubernetes.io/metadata.name, operator: NotIn, values: [kube-system] }
```

---

## Service Mesh — Istio Architecture

A service mesh adds mTLS, retries, timeouts, circuit breaking, traffic policy, and L7 observability without code changes — at the cost of operational complexity and sidecar overhead.

### Sidecar Mode

```text
App container <-> Envoy sidecar (in same pod) <-> network
```

- Every pod gains an **Envoy** proxy.
- A mutating webhook injects the sidecar on pod creation (label `istio-injection=enabled` on the namespace).
- **istiod** is the control plane: distributes configuration (xDS protocol) and certificates (SPIFFE-based identities) to sidecars.
- mTLS happens between the sidecars; the app speaks plaintext to localhost.

Overhead per pod:

- ~30–80ms additional startup latency (sidecar must be ready)
- ~50–150MB sidecar memory
- one extra container in every probe/eviction calculation
- mTLS certificate rotation events

### Ambient Mode (Istio 1.18+)

No per-pod sidecars. Instead:

- a **node-level proxy** (`ztunnel`) handles L4 mTLS and identity
- an optional **waypoint proxy** per service handles L7 policy

Tradeoffs: lower per-pod overhead, simpler upgrades, but less granular per-workload policy than sidecars.

### Traffic Management Primitives

| Resource | Purpose |
|---|---|
| `VirtualService` | Route rules (host, path, headers, weights) |
| `DestinationRule` | Subsets, load balancing, connection pools, circuit breakers |
| `Gateway` | Mesh ingress/egress configuration |
| `PeerAuthentication` | mTLS strictness (STRICT, PERMISSIVE, DISABLE) |
| `AuthorizationPolicy` | L7 access rules |

A `DestinationRule` referring to a non-existent subset is a classic outage: the `VirtualService` routes traffic to "v2" and there is no `v2` — the mesh returns 503 for every request. Validate with `istioctl analyze` before applying.

### When To Adopt A Mesh — And When Not

Adopt when you have a **specific unmet need**:

- mandatory mTLS for compliance
- L7 traffic splitting for progressive delivery (canary, blue-green)
- circuit-breaking that the app cannot implement consistently
- mesh-level observability (golden signals per route)

Defer when:

- problems can be solved with NetworkPolicy + Ingress
- the team cannot own istiod operations
- per-pod sidecar overhead breaks tight latency SLOs

Cilium can deliver mTLS, L7 policy, and observability without sidecars in some scenarios — evaluate it alongside Istio ambient before defaulting to sidecars.

---

## etcd — Backup, Restore, And Where It Fits In DR

etcd holds Kubernetes object state. It does **not** hold:

- container images (registry)
- PV data (the storage backend)
- application database state
- node-level state outside Kubernetes

### Backup

```bash
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%s).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

Minimum production cadence: every 30 minutes for active clusters, with retention long enough to cover any plausible recovery window.

### Restore

```bash
etcdctl snapshot restore /backup/etcd.db \
  --data-dir=/var/lib/etcd-restore
# Then point etcd at the new data-dir, restart, and reconfigure the cluster.
```

A restore is **only the first step**. Even after etcd is healthy:

- the new etcd may have stale leases (controllers acquire fresh ones)
- pods may need to re-reconcile their CRDs
- in-flight rollouts at the time of backup will be in indeterminate state
- secrets may need to be rotated if the backup contained compromised values

### Verify Before You Need It

Run periodic restore drills into a sandbox cluster. "We take backups" is not equivalent to "we can recover."

---

## Disaster Recovery — Three Separate Problems

Most "DR plans" conflate three problems that have different solutions:

| Problem | Mechanism | Tooling |
|---|---|---|
| etcd recovery | Restore from snapshot | `etcdctl snapshot restore` |
| Cluster rebuild | Reprovision control plane + nodes | Cluster API, eksctl, GKE, AKS |
| Application data recovery | Restore app-specific stateful data | Velero, pgBackRest, Litestream, application-native backups |

**Velero** snapshots Kubernetes object state and PV contents. It does **not** capture:

- in-memory application state
- WAL not yet flushed to disk
- application invariants that span multiple objects (consistency)

Stateful applications need application-aware backups in addition to Velero. Postgres needs pgBackRest or pg_dump with a stable transaction snapshot. Kafka needs broker-level replication or MirrorMaker. ElasticSearch needs snapshot API.

### RTO And RPO Per Workload Class

A real DR plan defines separate RTO/RPO per class:

| Workload class | RTO target | RPO target |
|---|---|---|
| Control plane | 60 min | 30 min (etcd snapshot cadence) |
| Stateless services | 30 min (re-deploy from Git) | 0 (no app state) |
| Stateful (databases) | depends on data size | application-specific (often <5 min via WAL shipping) |

"DR-ready" requires:

- written runbook
- tested restore drill at agreed cadence (quarterly minimum)
- separate plans for etcd, cluster, and app data
- a clear answer to "passive recovery" (can you recover?) vs "active failover" (can you switch traffic?)

Multi-cluster does **not** solve DR unless there is active data replication or you accept data loss on failover.

---

## Multi-Cluster Patterns

| Pattern | Use |
|---|---|
| Federation (KubeFed) | Manage many clusters as one (rarely used in 2026 — deprecated for most cases) |
| Cluster API (CAPI) | Declaratively provision clusters from a management cluster |
| GitOps fanout | Argo CD ApplicationSet, Flux multi-cluster — one Git repo, N clusters |
| Service mesh federation | Istio multicluster, Linkerd multicluster — east-west across clusters |
| Karmada / OCM (Open Cluster Management) | Workload distribution across clusters |

A staff-engineer rule: one cluster per environment minimum (dev/staging/prod). Add per-region clusters for latency or compliance. Use Cluster API + GitOps so cluster creation itself is reproducible.

---

## Container Runtime Internals — Namespaces, cgroups, overlayfs

A container = image filesystem + writable layer + Linux namespaces + cgroups + a process.

### Linux Namespaces

| Namespace | Isolates |
|---|---|
| PID | processes (containers see only their own PIDs) |
| NET | interfaces, routes, ports |
| MNT | mount points |
| UTS | hostname, domain |
| IPC | shared memory, semaphores |
| USER | UID/GID mapping (for rootless containers) |
| CGROUP | cgroup hierarchy visibility |

### cgroups (v2 is the standard now)

cgroups enforce resource limits at the kernel level. Kubernetes requests/limits map directly:

| Kubernetes | cgroup v2 |
|---|---|
| `cpu.requests` | `cpu.weight` (proportional share) |
| `cpu.limits` | `cpu.max` (hard cap via CFS bandwidth) |
| `memory.limits` | `memory.max` (OOM kill at the boundary) |
| `memory.requests` | informational + reclaim hints |

```bash
# On a node, find the cgroup of a running container
crictl inspect <id> | jq '.info.runtimeSpec.linux.cgroupsPath'

# Inspect memory pressure for a cgroup
cat /sys/fs/cgroup/<path>/memory.pressure
cat /sys/fs/cgroup/<path>/memory.current
cat /sys/fs/cgroup/<path>/memory.max
```

### overlayfs

Container images are stacked read-only layers + one writable container layer.

```text
+-------------------+ <- writable container layer (deleted on container removal)
+-------------------+ <- app code layer
+-------------------+ <- dep install layer
+-------------------+ <- OS deps layer
+-------------------+ <- base image layer
```

Implications:

- Image layers are reused across containers from the same base — disk efficient.
- Logs written **inside** the container consume the writable layer; under crash loops this fills `/var/lib/containerd` and triggers `DiskPressure`.
- Deleting a file in the writable layer does not shrink the image's history; the underlying layer still contains it.
- Cache order in Dockerfiles matters because each instruction creates a layer.

### OCI Spec And runc

The Open Container Initiative (OCI) defines:

- **image-spec** — what an image is on disk (manifest, layers, config)
- **runtime-spec** — what a container is at runtime (rootfs, mounts, namespaces, cgroups)

`runc` is the reference OCI runtime — it takes an OCI bundle and starts a container. containerd does pulling/snapshotting and calls runc to actually create namespaces and exec the process.

Alternative runtimes:

- **gVisor** — user-space kernel for stronger isolation
- **Kata Containers** — lightweight VM per container for hardware isolation
- **Firecracker** — micro-VMs (AWS Lambda, Fargate)

---

## Why Memory Pressure Hurts Latency Before OOM

When a cgroup approaches its memory limit, the kernel runs **direct reclaim synchronously in the application thread's call path**. The next allocation that would have taken nanoseconds now takes milliseconds.

Mechanisms layered on top of OOM:

- **kswapd** — async page reclaim, competes with the app for CPU
- **Direct reclaim** — synchronous, in the app's allocation path
- **Dirty page writeback throttling** — when `dirty_ratio` is hit, writes block inside the app
- **Swap activity** — even small swap causes microsecond-to-millisecond stalls on hot-page refault
- **THP (Transparent Hugepages) compaction** — pause to create 2MB pages

Symptoms: P99 latency spikes without any OOM event. Investigate with:

```bash
sar -B 1
cat /proc/vmstat | grep -E 'pgmajfault|pgsteal|allocstall'
cat /sys/fs/cgroup/<path>/memory.stat
```

---

## Cluster API — Declarative Cluster Lifecycle

Cluster API (CAPI) lets you declare clusters as Kubernetes objects in a "management cluster":

```yaml
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: prod-eu-west-1
spec:
  infrastructureRef:
    kind: AWSCluster
    name: prod-eu-west-1
  controlPlaneRef:
    kind: KubeadmControlPlane
    name: prod-eu-west-1-cp
```

Use CAPI for:

- DR (recreate a cluster from Git after disaster)
- Multi-cluster fleets (one repo, N clusters)
- Reproducible cluster builds

CAPI providers exist for AWS, GCP, Azure, vSphere, OpenStack, Equinix Metal, and others.

---

## Container Runtime Internals

### What A Container Actually Is

```text
Image + writable layer + namespaces + cgroups + process = container
```

Containers share the host kernel. Isolation is provided by Linux kernel primitives, not hardware virtualization.

### Linux Namespaces — What Each Isolates

| Namespace | Isolates |
|---|---|
| PID | Process ID visibility — container PID 1 is not host PID 1 |
| NET | Network interfaces, routes, ports |
| MNT | Mount points and filesystem visibility |
| UTS | Hostname and domain name |
| IPC | Shared memory, semaphores, message queues |
| USER | UID/GID mapping — container root may not be host root |

Namespaces change what the process can **see**. cgroups control what it can **consume**.

### cgroups — Resource Enforcement

```bash
docker run --memory=512m --cpus=1.5 app
# kubernetes equivalent: resources.limits.memory / resources.limits.cpu
```

Behavior:
- Memory limit exceeded → kernel OOM kills the containerized process (exit code 137)
- CPU limit exceeded → CPU throttling, not kill
- No limits set → noisy neighbor risk on shared nodes

Check throttling on a node:

```bash
cat /sys/fs/cgroup/cpu/<pod_cgroup>/cpu.stat  # throttled_time
```

### PID 1 Problem

The container entrypoint becomes PID 1. PID 1 must:
- Handle `SIGTERM` and shut down gracefully
- Reap zombie child processes (orphaned children of subprocesses)

Common failures:
- Shell-form `CMD` wraps in `/bin/sh -c` — the shell catches signals but may not forward to the app
- App exits but leaves children running, keeping the container alive

Fix: use exec-form `CMD ["app", "arg"]`, or add a lightweight init (`tini`) that handles signal forwarding and zombie reaping.

### Overlay Filesystems

Image layers are read-only. A thin writable layer is added per container.

Implication: logs, temp files, and writes inside the container consume **node disk**, not the image. Monitor node disk usage separately from image sizes.

```bash
du -sh /var/lib/containerd   # containerd image/layer storage
crictl images                # cached images on node
```

### Runtime Stack (Kubernetes)

```text
kubelet -> CRI (Container Runtime Interface) -> containerd -> runc -> Linux kernel
```

- `kubelet` speaks CRI to the container runtime
- `containerd` handles image pulling, snapshotting, sandbox setup
- `runc` creates the namespaces and cgroup and execs the process
- `crictl` is the debug CLI for this stack — use it on nodes instead of Docker CLI

```bash
crictl ps -a              # all containers including exited
crictl logs CONTAINER_ID  # container stdout/stderr
crictl inspect POD_ID     # sandbox and container details
crictl images             # local image cache
```

### Container → Kubernetes Mapping

| Container World | Kubernetes World |
|---|---|
| `docker run` | Pod spec |
| `-p` port publish | Service / Ingress |
| Volume mount | `volume` / `PVC` |
| Manual restart | Controller reconciliation |
| `--memory`/`--cpus` | `resources.requests` / `resources.limits` |
| `docker logs` | `kubectl logs` / `crictl logs` |

Kubernetes adds orchestration on top of Linux container primitives. Understanding the Linux layer explains why node disk pressure evicts pods, why OOMKilled means a cgroup limit was exceeded, and why PID 1 behavior affects rolling restarts.

### Production Incident Patterns

| Symptom | Root Cause | Fix |
|---|---|---|
| `ImagePullBackOff` | Wrong tag, registry auth, rate limit, arch mismatch | Check registry, credentials, tag existence |
| `CrashLoopBackOff` | App crashes on start: bad config, missing secret, dependency down | `kubectl logs --previous`, fix the startup error |
| `OOMKilled` (exit 137) | Container memory limit too low, or memory leak | Raise limit or fix leak; check `dmesg` for OOM message |
| Slow pod shutdown | PID 1 mishandles SIGTERM, grace period too short | Use exec-form CMD, add tini, increase `terminationGracePeriodSeconds` |
| Node disk full | Container logs, old images, writable layers | `crictl rmi --prune`, rotate container logs, clean `/var/lib/containerd` |
