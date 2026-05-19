---
title: "Intermediate"
sidebar_position: 2
---

# Kubernetes & Containers — Intermediate

## StatefulSets

StatefulSets manage stateful applications (databases, queues) where each Pod needs a stable identity and persistent storage. Unlike Deployments, Pods in a StatefulSet are created in order and each gets a sticky hostname.

**When to use StatefulSet vs Deployment:**

| Feature | Deployment | StatefulSet |
|---|---|---|
| Pod identity | Random names | Ordered, stable names (pod-0, pod-1) |
| Storage | Shared or ephemeral | Per-Pod persistent storage |
| Use case | Stateless apps (APIs, frontends) | Stateful apps (MySQL, Kafka, Cassandra) |
| Scaling | Any order | Sequential (scale up: 0→1→2, down: 2→1→0) |

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: "mysql"
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: password
          ports:
            - containerPort: 3306
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: mysql-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

---

## Persistent Volumes (PV) and Persistent Volume Claims (PVC)

### How it works

1. **StorageClass** — Defines the type and provisioner of storage
2. **PersistentVolume (PV)** — The actual storage resource provisioned in the cluster
3. **PersistentVolumeClaim (PVC)** — A request for storage from a PV (the user-facing object)

Pods reference PVCs, not PVs directly.

```yaml
# PersistentVolume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  hostPath:
    path: /data/my-pv
---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
---
# Using PVC in a Pod
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - mountPath: /data
          name: storage
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: my-pvc
```

**Access Modes:**
- `ReadWriteOnce` (RWO) — Mounted read-write by a single node
- `ReadOnlyMany` (ROX) — Mounted read-only by many nodes
- `ReadWriteMany` (RWX) — Mounted read-write by many nodes

---

## Horizontal Pod Autoscaler (HPA) and Vertical Pod Autoscaler (VPA)

### HPA — Scales the number of pods

HPA adjusts the replica count based on CPU/memory utilization or custom metrics.

```bash
# Enable HPA
kubectl autoscale deployment my-app --cpu-percent=50 --min=2 --max=10
kubectl get hpa
kubectl describe hpa my-app
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

> Prerequisite: metrics-server must be installed in the cluster.

### VPA — Scales pod resource requests/limits

VPA adjusts the CPU and memory requests/limits of running pods rather than changing the replica count. Requires installing the VPA controller.

---

## RBAC (Role-Based Access Control)

RBAC controls who can do what in a Kubernetes cluster.

**Key objects:**
- **Role** — Set of permissions within a namespace
- **ClusterRole** — Set of permissions cluster-wide
- **RoleBinding** — Binds a Role to a user/group/serviceaccount in a namespace
- **ClusterRoleBinding** — Binds a ClusterRole cluster-wide

```yaml
# Role: allow getting/listing pods in the "dev" namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
# RoleBinding: bind the role to user "jane"
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: dev
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl auth can-i get pods --as=jane -n dev
kubectl auth can-i delete pods --as=system:serviceaccount:default:default
kubectl get roles -n dev
kubectl get rolebindings -n dev
```

---

## Network Policies

Network Policies control ingress (incoming) and egress (outgoing) traffic between Pods using label selectors.

```yaml
# Deny all ingress traffic to pods with label app=backend,
# except from pods with label app=frontend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

> Note: Network Policies require a CNI plugin that supports them (Calico, Cilium, Weave Net). The default Flannel plugin does NOT enforce network policies.

---

## Helm — Kubernetes Package Manager

Helm is the standard package manager for Kubernetes. A **Chart** is a collection of templated K8s manifests.

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add a chart repository
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search and install
helm search repo nginx
helm install my-nginx bitnami/nginx

# Install with custom values
helm install my-app ./my-chart -f values-prod.yaml

# List installed releases
helm list

# Upgrade a release
helm upgrade my-app bitnami/nginx --set replicaCount=3

# Rollback
helm rollback my-app 1

# Uninstall
helm uninstall my-app

# Inspect chart values
helm show values bitnami/nginx

# Template rendering (dry run)
helm template my-app ./my-chart
```

### Helm Chart Structure

```
my-chart/
  Chart.yaml           # Chart metadata
  values.yaml          # Default configuration values
  templates/
    deployment.yaml    # Templated manifests
    service.yaml
    ingress.yaml
    _helpers.tpl       # Template helpers
```

---

## Multi-Container Pods

Multiple containers in the same Pod share the same network (localhost) and can share volumes.

### Sidecar Pattern

A helper container runs alongside the main container. Common use cases: log shippers, proxies, config refreshers.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  containers:
    - name: main-app
      image: myapp:latest
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
    - name: log-shipper
      image: fluentbit:latest
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
          readOnly: true
  volumes:
    - name: logs
      emptyDir: {}
```

### Init Container Pattern

Init containers run to completion before the main container starts. Used for initialization tasks (DB migrations, config setup).

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
spec:
  initContainers:
    - name: wait-for-db
      image: busybox
      command: ['sh', '-c', 'until nc -z db-service 5432; do sleep 2; done']
  containers:
    - name: app
      image: myapp:latest
```

---

## DaemonSets

A DaemonSet ensures one Pod runs on every node. Used for node-level agents: log collectors, monitoring agents, network plugins.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      containers:
        - name: node-exporter
          image: prom/node-exporter:latest
          ports:
            - containerPort: 9100
```

---

## Jobs and CronJobs

### Job — Run a task to completion

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: myapp:latest
          command: ["python", "manage.py", "migrate"]
      restartPolicy: OnFailure
  backoffLimit: 3
```

### CronJob — Schedule recurring tasks

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-job
spec:
  schedule: "0 2 * * *"   # Every day at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: backup-tool:latest
              command: ["./backup.sh"]
          restartPolicy: OnFailure
```

---

## Resource Quotas and Limits

### Resource Limits per Pod

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "1"
```

### ResourceQuota per Namespace

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    pods: "10"
    services: "5"
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
```

---

## Rolling Updates and Rollbacks

Kubernetes rolling updates replace pods gradually without downtime.

```bash
# Update image
kubectl set image deployment/my-app my-container=nginx:1.25

# Watch rollout progress
kubectl rollout status deployment my-app

# View rollout history
kubectl rollout history deployment my-app

# Rollback to previous version
kubectl rollout undo deployment my-app

# Rollback to specific revision
kubectl rollout undo deployment my-app --to-revision=2
```

### Deployment Strategy configuration

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max pods above desired count during update
      maxUnavailable: 0  # Max pods that can be unavailable during update
```

---

## Liveness and Readiness Probes

### Liveness Probe

Kubernetes restarts the container if this probe fails.

### Readiness Probe

Kubernetes removes the Pod from Service endpoints if this probe fails (stops sending traffic).

```yaml
containers:
  - name: app
    image: myapp:latest
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
```

---

## Taints and Tolerations

**Taints** mark nodes to repel pods. **Tolerations** allow pods to be scheduled on tainted nodes.

```bash
# Add a taint to a node
kubectl taint nodes worker-1 dedicated=gpu:NoSchedule

# Remove a taint
kubectl taint nodes worker-1 dedicated=gpu:NoSchedule-
```

```yaml
# Pod tolerating the taint
spec:
  tolerations:
    - key: "dedicated"
      operator: "Equal"
      value: "gpu"
      effect: "NoSchedule"
```

**Taint effects:**
- `NoSchedule` — New pods won't be scheduled unless they tolerate
- `PreferNoSchedule` — Soft version of NoSchedule
- `NoExecute` — Evicts existing pods that don't tolerate

---

## Node Affinity

Fine-grained control over which nodes a pod should land on, based on node labels.

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: kubernetes.io/arch
                operator: In
                values:
                  - amd64
```

---

## Docker Compose (Multi-Container)

```yaml
# docker-compose.yaml
version: "3.8"
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    depends_on:
      - app
    networks:
      - app-network

  app:
    build: .
    environment:
      - DB_HOST=db
      - DB_PORT=5432
    depends_on:
      - db
    networks:
      - app-network

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - app-network

volumes:
  db-data:

networks:
  app-network:
    driver: bridge
```

```bash
docker-compose up -d           # Start in detached mode
docker-compose down            # Stop and remove containers
docker-compose ps              # List running services
docker-compose logs -f app     # Follow logs for a service
docker-compose scale app=3     # Scale a service
docker-compose exec app bash   # Shell into a service container
```

---

## Startup Probe — The Missing Third Probe

The startup probe protects slow-starting containers from being killed by an over-eager liveness probe. Once the startup probe succeeds, Kubernetes hands off to liveness/readiness.

| Probe | Question | Failure action |
|---|---|---|
| `startupProbe` | Has the app finished booting? | Restarts container if never succeeds |
| `readinessProbe` | Can this Pod receive traffic? | Removes from Service endpoints (no restart) |
| `livenessProbe` | Is the app stuck and should restart? | Restarts container |

Common production bug: `initialDelaySeconds: 30` on readinessProbe for an app that warms in 25 seconds — the pod becomes Ready after the first check at 30s without ever validating warm-up. A `startupProbe` polls aggressively until ready, then hands off to the cheaper readiness schedule.

```yaml
containers:
- name: api
  image: my-api:1.0
  startupProbe:
    httpGet: { path: /ready, port: 8080 }
    failureThreshold: 30
    periodSeconds: 2          # 30 * 2s = 60s max startup window
  readinessProbe:
    httpGet: { path: /ready, port: 8080 }
    periodSeconds: 10
    failureThreshold: 3       # require 3 failures before removing from endpoints
  livenessProbe:
    httpGet: { path: /healthz, port: 8080 }
    initialDelaySeconds: 30
    periodSeconds: 20
    failureThreshold: 3
```

### Bad Probe Patterns That Cause Outages

- **Liveness probe checking a dependency** (DB, cache). When the dependency is down, every pod restarts in a storm.
- **Liveness timeout shorter than the app's P99 under load**. Pods get restart-killed during traffic spikes, deepening the problem (death spiral).
- **Readiness probe is too shallow** — passes a `/` endpoint while the real handler is broken. Traffic flows to pods that 500.
- **Missing readiness probe entirely** — pods are added to the Service the moment the container starts, before the app can serve.

---

## Quality of Service (QoS) Classes

The QoS class is **derived** from the requests/limits relationship and controls eviction order under node pressure.

| Class | Condition | Eviction priority |
|---|---|---|
| `Guaranteed` | `requests == limits` for every CPU and memory request | Evicted last |
| `Burstable` | `requests < limits`, or only some resources set | Evicted second |
| `BestEffort` | No requests and no limits at all | Evicted first |

```bash
kubectl get pod <name> -o jsonpath='{.status.qosClass}'
```

Use `Guaranteed` for latency-sensitive or critical workloads (inference servers, control-plane components). Use `Burstable` for general workloads. Avoid `BestEffort` in shared clusters — those pods are the first thing the kubelet evicts under memory pressure.

To make a pod `Guaranteed`:

```yaml
resources:
  requests: { memory: "1500Mi", cpu: "250m" }
  limits:   { memory: "1500Mi", cpu: "250m" }
```

---

## Requests vs Limits — What Each One Actually Controls

| Field | Used by | Effect |
|---|---|---|
| `requests` | Scheduler | Reserves capacity for placement; HPA uses for utilization math |
| `limits` | Runtime (cgroups) | Hard cap at runtime; enforced by kernel |

Runtime behavior:

- **CPU limit exceeded** → CFS throttling (latency spike, not killed). Visible as `container_cpu_cfs_throttled_seconds_total`.
- **Memory limit exceeded** → OOMKill (`exit 137`). The kernel kills the process.
- **No requests** → scheduler can pack the node beyond useful capacity; HPA breaks (cannot compute %).
- **Requests too high** → node looks full while pods barely use anything (the "noisy reservation" trap).

The scheduler uses **requests**, not actual usage. A node showing 43% real memory but 96% requested memory is full from a scheduling perspective.

### OOM Score Adjustment

When the kernel's OOM killer must pick a process to terminate, it uses an **OOM score** (higher = more likely to be killed). Kubernetes sets this automatically based on QoS:

| QoS Class | Kernel oom_score_adj | Result |
|-----------|---------------------|--------|
| `Guaranteed` | -998 | Very unlikely to be killed |
| `Burstable` | Proportional (0–999) | Depends on memory usage |
| `BestEffort` | 1000 | Killed first |

You can override this per-container with `oomScoreAdj` (range: -1000 to 1000):

```yaml
spec:
  containers:
  - name: app
    resources:
      requests: { memory: "256Mi" }
      limits: { memory: "512Mi" }
    securityContext:
      oomScoreAdj: -500   # less likely to be killed vs other Burstable containers
```

Lower values mean less likely to be killed. Setting `-1000` makes the process immune to OOM kill (use with caution — if it leaks, nothing saves the node).

**Detect OOMKill:**

```bash
kubectl get pod <name> -o jsonpath="{.status.containerStatuses[*].state.terminated.reason}"
# Returns "OOMKilled" if the container was killed by the kernel OOM killer

kubectl get pod <name> -o jsonpath="{.status.containerStatuses[*].lastState.terminated.reason}"
# For the previous container run
```

---

## PriorityClass And Preemption

`PriorityClass` ranks pods. Higher-priority pods can **preempt** (evict) lower-priority ones if the cluster cannot otherwise schedule them.

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: inference-critical
value: 100000
globalDefault: false
description: "For latency-sensitive inference pods"
```

```yaml
# Pod that requests preemption rights
spec:
  priorityClassName: inference-critical
```

Use cases:

- Inference traffic preempts long-running training jobs.
- Control-plane add-ons (CNI, CoreDNS) keep priority over user workloads.
- Critical batch can preempt best-effort batch.

Kubernetes ships two defaults: `system-cluster-critical` and `system-node-critical`. Do not bind those to application workloads.

---

## Topology Spread Constraints

Distribute replicas across zones, nodes, or other topology keys for failure isolation.

```yaml
topologySpreadConstraints:
- maxSkew: 1
  topologyKey: topology.kubernetes.io/zone
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels: { app: my-app }
```

`maxSkew: 1` means no zone can have more than one extra replica compared to the least-loaded zone. `whenUnsatisfiable: DoNotSchedule` is strict; `ScheduleAnyway` is best-effort.

Without spread constraints, a Deployment with 10 replicas can end up entirely on one zone — a single AZ failure becomes an outage.

---

## Pod Disruption Budgets (PDB)

A PDB protects replicated workloads from voluntary disruption (node drain, cluster upgrade, autoscaler scale-down).

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb }
spec:
  minAvailable: 2        # or maxUnavailable: 1 — never both
  selector:
    matchLabels: { app: api }
```

Important rules:

- A PDB cannot protect a single replica from downtime.
- PDB does **not** protect against involuntary disruption (node hardware failure, spot reclamation).
- `kubectl drain` respects PDB; if draining would violate it, drain blocks until pods elsewhere catch up.

---

## CNI Overview And kube-proxy Modes

Every Kubernetes node has a **CNI plugin** that configures pod networking. The CNI:

- creates the pod's network interface (`veth` pair)
- assigns the pod an IP from the cluster CIDR
- sets routes
- configures the datapath (overlay vs native routing)
- enforces NetworkPolicy if supported

Popular CNIs:

| CNI | Datapath | Notable |
|---|---|---|
| Flannel | VXLAN overlay | Simple, no NetworkPolicy |
| Calico | BGP or VXLAN | NetworkPolicy via iptables/eBPF |
| Cilium | eBPF | Replaces kube-proxy, Hubble observability |
| AWS VPC CNI | Native ENIs | Pod IP from VPC subnet |
| Azure CNI | Native | Similar to AWS |
| GKE Dataplane v2 | eBPF | Google-managed Cilium |

### kube-proxy Implementations

| Mode | How it works | Tradeoffs |
|---|---|---|
| `iptables` | NAT rules created per Service | Default, scales poorly at >10k services |
| `IPVS` | Kernel load-balancing tables | Better at large scale, more load-balancing algorithms |
| `eBPF` (Cilium) | Programmable kernel datapath | No iptables/IPVS, best scale, requires Cilium |

```bash
# Inspect kube-proxy mode
kubectl -n kube-system get pods -l k8s-app=kube-proxy
kubectl -n kube-system logs <kube-proxy-pod> | grep -i mode

# Inspect iptables service translation
iptables-save | grep KUBE-SVC
iptables-save | grep KUBE-SEP

# Cilium inspection
cilium service list
cilium endpoint list
hubble observe --follow
```

---

## EndpointSlices

In Kubernetes 1.21+ `EndpointSlice` replaces the older `Endpoints` object as the source of truth for kube-proxy and Cilium. A single Service can have multiple slices when it has more than 100 endpoints.

```bash
kubectl get endpointslice -l kubernetes.io/service-name=my-svc -o yaml
```

Topology-aware routing (`service.kubernetes.io/topology-mode: auto`) instructs kube-proxy to prefer same-zone endpoints, reducing cross-AZ traffic cost.

---

## CoreDNS Basics

CoreDNS resolves Service names. Every Service is reachable at:

```text
<svc>.<ns>.svc.cluster.local -> Service ClusterIP -> Pod
```

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system deploy/coredns
kubectl exec -it <pod> -- cat /etc/resolv.conf
kubectl exec -it <pod> -- nslookup kubernetes.default
```

Common DNS failures:

- CoreDNS at CPU limit
- NetworkPolicy blocks UDP/TCP 53 to `kube-dns`
- `ndots: 5` causes external name lookups to amplify into multiple cluster-domain queries
- Upstream resolver (the node's `/etc/resolv.conf`) is unreachable

Mitigations: scale CoreDNS with an HPA, install **NodeLocal DNSCache** as a DaemonSet, lower `ndots` in pod `dnsConfig`.

---

## Kustomize — Environment Overlays

Avoid copy-pasted YAML per environment. Kustomize uses a `base/` plus `overlays/<env>/` structure.

```text
manifests/
  base/
    deployment.yaml
    service.yaml
    kustomization.yaml
  overlays/
    dev/
      kustomization.yaml
      patch-replicas.yaml
    prod/
      kustomization.yaml
      patch-replicas.yaml
```

```yaml
# overlays/prod/kustomization.yaml
resources:
- ../../base
patches:
- path: patch-replicas.yaml
images:
- name: my-app
  newTag: v1.9.1
namespace: production
```

```bash
kubectl apply -k overlays/prod
kustomize build overlays/prod | kubectl diff -f -
```

Copy-pasted YAML per environment creates silent drift. Treat the base as the contract and overlays as environment-specific deltas only.

---

## Security Context Essentials

Production workloads should minimize privilege. Defaults to set on every container:

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
        drop: ["ALL"]
```

A compromised privileged workload becomes a node-level compromise; security context is part of reliability, not just security.

---

## Manifest Review Checklist

Before approving any manifest, check:

- selector matches Pod labels
- image tag/digest is immutable (no `:latest`)
- readiness probe exists and tests the real serving path
- liveness probe does not check a dependency
- requests AND limits are set
- rollout strategy (`maxUnavailable`, `maxSurge`) preserves capacity
- securityContext is hardened (non-root, no privilege escalation, capabilities dropped)
- PDB exists for critical replicated services
- ConfigMap and Secret are separated from the image
- NetworkPolicy matches the trust model
- `kubernetes.io/change-cause` annotation is set for rollout audit

```bash
kubectl apply --dry-run=server -f file.yaml
kubectl diff -f file.yaml
kubeconform manifest.yaml
kube-score score manifest.yaml
conftest test manifest.yaml
```

Validation catches syntax. Review catches operational risk.

---

## Container Runtime Stack (CRI → containerd → runc)

Modern Kubernetes nodes do not run Docker. The path is:

```text
kubelet -> CRI -> containerd (or CRI-O) -> runc -> Linux kernel
```

- **CRI** (Container Runtime Interface) is the gRPC contract kubelet speaks.
- **containerd** is the daemon that pulls images, manages snapshots, and supervises containers.
- **runc** is the OCI-compliant low-level binary that actually creates the namespaces and starts the process.

On a node, `crictl` is more useful than the Docker CLI:

```bash
crictl ps                  # list containers
crictl images              # list images on this node
crictl logs <id>           # container logs
crictl inspect <id>        # full spec
crictl exec -it <id> sh    # shell in
crictl pull <image>        # pull image
```

`docker` does not exist on production nodes — `crictl` is what you reach for during node-level debugging.

---

## Dockerfile Best Practices

- Use **small trusted base images** (`alpine`, `distroless`, language-specific slim).
- **Pin versions** in `FROM` and in package installs.
- Use **multi-stage builds** to keep build tooling out of the runtime image.
- Run as **non-root** (`USER 1000`).
- Use **explicit entrypoints** with the exec form `["..."]`, never shell form.
- Add a `.dockerignore`.
- Avoid baking **secrets** into layers (they remain forever, even if deleted in a later layer).

Layer cache order from most stable to most frequently changing:

1. base image
2. OS deps
3. language deps (`go mod download`, `pip install`, `npm ci`)
4. application code

If you `COPY . .` at the top, every code change invalidates the dependency install layer and the build is slow forever.

---

## Multi-Arch Builds With buildx

To run the same image on `amd64` and `arm64` (cheaper Graviton nodes), build a multi-arch manifest:

```bash
docker buildx create --use --name multiarch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myrepo/myapp:1.0 \
  --push .
```

A common production bug is `exec format error` — pulling an `amd64` image onto an `arm64` node. Multi-arch images solve this.

BuildKit (the engine behind `buildx`) also offers parallel build stages, build secrets (`--secret`), and cache mounts (`--cache-from`, `--cache-to`).

---

## PID 1 And Graceful Shutdown

A container's entry process becomes **PID 1**. It must:

- receive signals (SIGTERM, SIGINT)
- terminate gracefully
- reap zombie child processes

Bad PID 1 handling causes:

- slow rollouts (pods take the full `terminationGracePeriodSeconds`)
- `exit 143` (SIGTERM not handled in time, kubelet escalates to SIGKILL)
- zombie processes accumulating

Fix patterns:

- Use **exec form** in Dockerfiles (`CMD ["node", "server.js"]`, never `CMD node server.js` which spawns a shell that doesn't forward signals).
- Use a tiny init wrapper for languages that don't reap children well (`tini`, `dumb-init`).
- Implement SIGTERM handlers in the app: stop accepting traffic, drain in-flight requests, then exit.
- Set a `preStop` lifecycle hook with a small sleep so Service endpoints are updated before the app exits:

```yaml
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 10"]
```

---

## GPU Device Plugin Basics

Kubernetes has no native GPU magic. The NVIDIA device plugin advertises GPUs to kubelet as an extended resource.

```bash
kubectl describe node <gpu-node> | grep -A5 nvidia.com/gpu
kubectl get nodes -L nvidia.com/gpu.product
```

A Pod requests GPUs:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

Notes:

- Standard GPU resources are **not fractional** (one of MIG or time-slicing is needed for sharing).
- `requests` and `limits` are effectively the same for GPUs.
- The scheduler places the Pod only on nodes with enough allocatable GPUs.
- GPU allocation does **not** guarantee high utilization — you can have 80% allocated and 20% used at the same time.

Schedule to a specific GPU type:

```yaml
nodeSelector:
  nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
```

Taint GPU nodes so non-GPU workloads stay away:

```bash
kubectl taint nodes gpu-node dedicated=gpu:NoSchedule
```

GPU workloads then add a matching toleration.

---

## kubelet's Active Role During Rollouts

kubelet is not passive — it actively shapes runtime behavior. During a bad rollout it is simultaneously:

- running readiness probes (and removing failing pods from the EndpointSlice)
- running liveness probes (and restarting containers that fail)
- garbage-collecting dead containers and images (can fill ephemeral storage during crash loops)
- emitting NodeConditions (MemoryPressure, DiskPressure, PIDPressure)
- enforcing cgroup limits (OOMKill when memory limit exceeded)
- evicting pods by QoS order under node pressure

When debugging a rollout, `kubectl describe pod` surfaces kubelet's view via Events. Then `journalctl -u kubelet -n 200` on the node is the deeper layer.

---

## ndots And External DNS Amplification

Pods get `/etc/resolv.conf` with `ndots: 5` by default. Any hostname with fewer than 5 dots is tried with **every search domain prepended first**:

```text
api.example.com
  -> api.example.com.default.svc.cluster.local   (try 1)
  -> api.example.com.svc.cluster.local           (try 2)
  -> api.example.com.cluster.local               (try 3)
  -> api.example.com                             (try 4 — finally external)
```

For workloads making many external calls (`*.amazonaws.com`, etc.), this 3-5x amplifies DNS load. Override at Pod level:

```yaml
spec:
  dnsConfig:
    options:
    - { name: ndots, value: "2" }
```

Or set the FQDN with a trailing dot in code: `api.example.com.` — that bypasses search-domain prepending entirely.
