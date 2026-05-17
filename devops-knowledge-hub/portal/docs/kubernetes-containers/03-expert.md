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
