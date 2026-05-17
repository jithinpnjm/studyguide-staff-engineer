---
title: "Kubernetes and Cilium at Production Depth — Nebius Level"
sidebar_position: 2
---

# Kubernetes and Cilium at Production Depth — Nebius Level

> Nebius runs all managed Kubernetes with Cilium CNI by default. Every SRE candidate is expected to understand Kubernetes internals at control plane level and Cilium at the eBPF dataplane level — not just "kubectl apply" operational familiarity.

---

## Mental Model

Kubernetes is a distributed system with two distinct planes:

**Control plane:** Makes decisions — schedules pods, reconciles desired vs actual state, manages secrets, issues certificates.

**Data plane:** Executes decisions — runs containers, routes packets, enforces policy.

A fault in the control plane causes new work to fail but existing workloads continue. A fault in the data plane breaks running workloads. Understanding which plane is failing is the first step in every Kubernetes incident.

---

## Part 1: Control Plane Components Deep Dive

### kube-apiserver

The API server is the single point of truth and the only component that reads/writes etcd.

**What it does:**
- Validates and persists API objects
- Authenticates requests (certificates, OIDC, service account tokens)
- Authorizes requests (RBAC)
- Serves as the watch/event bus for all controllers

**What breaks and how you know:**
```bash
# API server latency (key SLI)
kubectl get --request-timeout=2s nodes

# API server logs
kubectl logs -n kube-system kube-apiserver-<node>

# Check audit log for permission errors
grep "RBAC DENY" /var/log/kubernetes/audit.log

# Verify API server certificate expiry
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates
kubeadm certs check-expiration
```

**Failure mode: API server is up but slow**
- Cause: etcd is slow (check etcd latency metrics)
- Cause: admission webhooks timing out (check webhook configs, pod logs)
- Cause: large number of watchers / list operations hitting etcd
- Mitigation: pagination for large list operations, cache results, reduce webhook overhead

### etcd

Distributed key-value store using the Raft consensus algorithm. Every API object is stored here.

**What it does:**
- Stores all Kubernetes state
- Implements Raft for consensus across 3 or 5 nodes
- Uses a WAL (Write-Ahead Log) for durability

**Key metrics and commands:**
```bash
# etcd health
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# etcd latency (critical SLI for Kubernetes health)
etcdctl endpoint status --write-out=table

# Compact and defrag (reduces disk usage)
etcdctl compact <revision>
etcdctl defrag

# Backup
etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db
etcdctl snapshot verify /backup/etcd-$(date +%Y%m%d).db
```

**What you must know about etcd:**
- Raft requires majority quorum. A 3-node cluster can tolerate 1 failure. 5-node cluster tolerates 2 failures.
- etcd leader election uses heartbeats. A long GC pause (Java, Go) or high I/O latency can trigger election timeout.
- etcd is NOT designed for large values. Kubernetes stores secrets and ConfigMaps here. Large configmaps → etcd performance problems.
- etcd revision is a global monotonically increasing counter. Every write increments it. High revision = lots of writes = needs compaction.

### kube-scheduler

Assigns pods to nodes. It does NOT start pods — it only sets `pod.spec.nodeName`.

**Scheduling algorithm:**
1. **Filtering:** Remove nodes that cannot run the pod (insufficient resources, taints, node affinity, volume topology)
2. **Scoring:** Rank remaining nodes (spreading, resource balance, node affinity preference)
3. **Binding:** Write the assignment to etcd via API server

**Why pods stay pending:**
```bash
# Describe the pod — Reason in Events section
kubectl describe pod <name> -n <namespace>

# Common reasons:
# "Insufficient cpu" / "Insufficient memory" → no node has enough resources
# "didn't match Pod's node affinity" → node selector / affinity mismatch
# "node(s) had taint X that the pod didn't tolerate" → taint/toleration mismatch
# "pod has unbound immediate PersistentVolumeClaims" → PVC not bound, wrong StorageClass
# "node(s) didn't have enough free storage" → ephemeral storage constraint

# Check what nodes actually have available
kubectl describe nodes | grep -A 5 "Allocated resources"
```

### kube-controller-manager

A single binary running multiple control loops (controllers). Each controller watches specific resources and reconciles desired vs actual state.

**Key controllers:**
- `ReplicaSet controller:` ensures correct pod count
- `Deployment controller:` manages rollout strategy
- `StatefulSet controller:` manages ordered pod creation/deletion
- `Node controller:` monitors node health, evicts pods from NotReady nodes (after 5 minutes by default)
- `EndpointSlice controller:` populates EndpointSlices when pods become ready
- `PersistentVolume controller:` binds PVCs to PVs

**The reconciliation loop pattern (critical for understanding operators):**
```
Watch API server for relevant objects
For each object:
  1. Read desired state from object spec
  2. Observe actual state from world
  3. Calculate diff
  4. Take action to close the gap
  5. Update object status
  Loop
```

This is exactly how Kubernetes operators work. Soperator's controller watches `SlurmCluster` CRDs and reconciles the actual Slurm cluster state.

### kubelet

The agent running on every node. Responsible for container lifecycle.

```bash
# kubelet logs
journalctl -u kubelet -f
journalctl -u kubelet --since "10 minutes ago"

# kubelet configuration
cat /var/lib/kubelet/config.yaml

# kubelet status
systemctl status kubelet

# Node-level container state
crictl ps                          # list containers (containerd)
crictl inspect <container-id>      # container details
crictl logs <container-id>         # container logs

# Resource pressure flags
kubectl describe node <name> | grep -A 10 Conditions
# Look for: MemoryPressure, DiskPressure, PIDPressure
```

**How kubelet handles a pod:**
1. Watches API server for pods assigned to this node (`spec.nodeName == thisNode`)
2. Calls container runtime (containerd) via CRI gRPC
3. containerd pulls image, creates container namespaces, mounts volumes
4. Sets up pod networking by calling CNI plugin (Cilium)
5. Runs liveness/readiness probes
6. Reports status back to API server

---

## Part 2: Pod Networking — From Zero to Packet

### How a Pod Gets an IP (The CNI Chain)
When kubelet creates a pod, it calls the configured CNI plugin (Cilium at Nebius) with:
```json
{
  "command": "ADD",
  "containerID": "...",
  "netns": "/var/run/netns/<id>",
  "ifname": "eth0",
  "config": {...}
}
```

CNI plugin responsibilities (what Cilium does):
1. Create a veth pair: one end `eth0` in the pod namespace, one end in the node network namespace
2. Configure IP address and routes inside the pod namespace
3. Set up dataplane rules for the pod's IP (eBPF maps in Cilium's case)
4. Return IP address to kubelet

**Resulting topology:**
```
Pod network namespace                Node network namespace
┌─────────────────┐                  ┌────────────────────────┐
│  eth0 (10.1.2.3)│                  │  lxcXXXXXX (veth peer) │
│  (veth end)     │◄─── veth pair ──►│  eBPF program attached  │
│                 │                  │                         │
│  route: default │                  │  cilium_host            │
│  via 169.254.1.1│                  │  (gateway for pods)     │
└─────────────────┘                  └────────────────────────┘
```

### How Cilium Routes Packets (eBPF vs iptables)

**Traditional iptables approach:**
- kube-proxy watches Services and writes iptables rules
- Each packet to a Service VIP matches a DNAT rule (chosen probabilistically with `statistic --mode random`)
- This is O(n) — every packet must traverse every iptables rule before matching
- At 10,000+ services: measurable latency overhead

**Cilium's eBPF approach:**
- Cilium attaches eBPF programs to TC (Traffic Control) hooks on every veth interface
- Service endpoints are stored in eBPF hash maps — O(1) lookup
- DNAT is performed by the eBPF program, not by the kernel's netfilter
- No iptables rules for service routing — entire network policy in eBPF

**What this means operationally:**
```bash
# Cilium's eBPF maps
cilium map list                     # list all eBPF maps
cilium map get cilium_lb4_services  # Service VIP → backend list
cilium map get cilium_ipcache       # IP → identity mapping
cilium map get cilium_policy        # policy rules

# Pod connectivity debugging
cilium endpoint list               # all pods managed by Cilium
cilium endpoint get <endpoint-id>  # policy, health, labels

# Flow monitoring (Hubble)
hubble observe --namespace default --follow
hubble observe --pod web-server --type drop    # dropped packets only
hubble observe --from-pod frontend --to-pod backend

# Check if a pod can reach another
cilium connectivity test            # full connectivity test suite
```

### Services: How EndpointSlices Work

A Service is a virtual IP (ClusterIP). No packet is ever delivered to the ClusterIP — it is always translated to a backend Pod IP before delivery.

**The chain:**
1. Application resolves `my-service.default.svc.cluster.local` via CoreDNS
2. CoreDNS returns the Service's ClusterIP (e.g., `10.96.0.100`)
3. Application sends packet to `10.96.0.100:8080`
4. Cilium eBPF program intercepts the packet at TC hook
5. Cilium looks up the Service in its eBPF map, selects a ready endpoint
6. Cilium DNAT: destination IP changed from `10.96.0.100` to `10.1.2.5` (a backend Pod IP)
7. Packet routed normally to the Pod

**Why "pod is running but service is broken":**
- Pod is running but readiness probe is failing → Pod IP is NOT in EndpointSlice → Cilium has no endpoint to route to
- NetworkPolicy blocking traffic → Cilium drops the packet (check Hubble)
- Wrong port in Service spec → DNAT maps to wrong port
- Service selector doesn't match pod labels → no endpoints

```bash
# Check EndpointSlice
kubectl get endpointslice -l kubernetes.io/service-name=my-service -o yaml
# Look at "endpoints" — are any listed? Is "ready: true"?

# Check if service selector matches pods
kubectl get svc my-service -o jsonpath='{.spec.selector}'
kubectl get pods -l <matching-labels>
```

---

## Part 3: GPU Scheduling in Kubernetes

### The Device Plugin Model
Kubernetes has no built-in GPU concept. GPUs are exposed as extended resources via the Device Plugin framework.

**How it works:**
1. NVIDIA device plugin runs as DaemonSet on every GPU node
2. Plugin registers resource type `nvidia.com/gpu` with kubelet
3. Plugin discovers GPUs on the node (via NVML)
4. kubelet advertises `nvidia.com/gpu: 8` (for an 8-GPU node) in Node capacity
5. When a pod requests `nvidia.com/gpu: 1`, scheduler assigns pod to a GPU node
6. Plugin allocates a specific GPU to the container (sets device files, drivers)

**Requesting GPUs in pods:**
```yaml
resources:
  limits:
    nvidia.com/gpu: 1          # request exactly 1 GPU
    nvidia.com/gpu: 4          # request 4 GPUs (they come from the same node by default)
  # Note: GPU resources are NOT overcommittable (unlike CPU/memory)
```

**Node Feature Discovery (NFD):**
NFD scans nodes and labels them with hardware features:
```bash
kubectl get nodes -o json | jq '.items[].metadata.labels | to_entries | 
  map(select(.key | contains("nvidia")))' | head -30

# Common labels:
# nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
# nvidia.com/gpu.count: "8"
# nvidia.com/cuda.driver.major: "535"
# feature.node.kubernetes.io/cpu-cpuid.AVX512: "true"
```

### Topology-Aware GPU Scheduling (Critical for Distributed Training)

For multi-GPU training jobs, performance depends critically on GPU placement:
- GPUs in the same NVLink domain communicate at 600 GB/s (NVLink 3.0)
- GPUs in different NUMA nodes communicate through PCIe + CPU at 64 GB/s
- GPUs on different nodes communicate via InfiniBand at 200–800 Gbps

**Kubernetes topology manager:**
```yaml
# kubelet configuration
topologyManagerPolicy: best-effort   # or: none, restricted, single-numa-node
topologyManagerScope: pod            # allocate resources from same NUMA node for entire pod
```

**Gang scheduling with Kueue:**
Distributed training requires ALL workers to start simultaneously (gang scheduling). If worker 3 of 8 fails to schedule, the other 7 workers sit idle wasting GPU hours.

```yaml
# Kueue ClusterQueue for GPU batch jobs
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: gpu-cluster-queue
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: ["cpu", "memory", "nvidia.com/gpu"]
    flavors:
    - name: h100-nodes
      resources:
      - name: nvidia.com/gpu
        nominalQuota: 64    # 8 nodes × 8 GPUs
```

---

## Part 4: Kubernetes Operators — The Pattern That Powers Nebius's Soperator

### What Is an Operator?
An operator is a Kubernetes controller that encodes operational knowledge about a specific application. It watches custom resources (CRDs) and reconciles the actual state to match the desired state.

**Why operators exist:**
Kubernetes built-in controllers handle generic workloads well. But complex stateful systems — databases, distributed training clusters, Slurm schedulers — have domain-specific lifecycle requirements:
- How do you roll a database upgrade with zero data loss?
- How do you handle a training job failure at worker 3 without losing the checkpoint?
- How do you drain and replace a Slurm node without losing jobs?

An operator answers these questions in code.

### The Reconcile Loop
```go
// Every operator implements this interface
func (r *MyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch the custom resource
    var myResource myv1.MyResource
    if err := r.Get(ctx, req.NamespacedName, &myResource); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 2. Observe actual state
    // ... query actual system state ...
    
    // 3. Calculate diff and reconcile
    if actualState != myResource.Spec.DesiredState {
        // take action
    }
    
    // 4. Update status
    myResource.Status.State = "Ready"
    r.Status().Update(ctx, &myResource)
    
    // 5. Requeue after N seconds to catch drift
    return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}
```

### What Happens When the Operator is Down?
A crucial question. The operator is not in the critical path for running workloads — it only manages changes.
- If the operator pod crashes: existing resources keep running, but no new changes are applied, no self-healing happens
- This is why operators need high availability (leader election with multiple replicas)
- This is why operators must be idempotent — on restart, re-running reconcile on all objects should produce the same result

### Soperator Architecture (Nebius's Real-World Example)
```
┌──────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                       │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Login Pod   │  │ Controller   │  │ Worker Pods  │   │
│  │  (SSH LB)    │  │   Pod        │  │ (StatefulSet)│   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │           │
│         └─────────────────┼──────────────────┘           │
│                           │ Shared PV (RWX)               │
│                      "Jail" mount                         │
│                     (pivot_root + ns)                     │
└──────────────────────────────────────────────────────────┘
         ▲
         │ CRD: SlurmCluster
         │
  ┌──────┴──────┐
  │  Soperator  │ ← watches SlurmCluster CRD
  │  Controller │   reconciles actual Slurm cluster state
  └─────────────┘
```

**The "jail" mechanism:**
- All Slurm nodes share a PersistentVolume (ReadWriteMany NFS or WEKA)
- Each node uses Linux `pivot_root` to set its root to the shared PV path
- Combined with PID/mount/network namespaces, this creates an isolated execution environment
- Workers can see each other's filesystems (for MPI/NCCL) while being isolated at the OS level

---

## Part 5: Kubernetes Failure Modes and Debugging

### Scenario: Pod is Pending
```bash
# Step 1: Describe the pod
kubectl describe pod <name> -n <ns> | grep -A 20 Events:

# What each message means:
"0/10 nodes are available: 10 Insufficient nvidia.com/gpu"
# → All GPU quota is consumed

"0/10 nodes are available: 10 node(s) had taint NoSchedule"
# → GPU nodes are tainted; your pod needs matching toleration

"0/10 nodes are available: topology mismatch"
# → Topology-aware placement couldn't find a valid node

"pod has unbound immediate PersistentVolumeClaims"
# → PVC not bound; check StorageClass, PV availability, CSI driver
kubectl get pvc -n <ns>
kubectl get pv
kubectl logs -n kube-system <csi-driver-pod>
```

### Scenario: Pod in CrashLoopBackOff
```bash
# Get previous container logs (after crash)
kubectl logs <pod> --previous

# Describe pod for exit code
kubectl describe pod <pod> | grep -A 5 "Last State"
# Exit code 1: application error
# Exit code 137: OOMKilled (SIGKILL from kernel OOM killer)
# Exit code 139: Segfault (SIGSEGV)

# Check OOM killer
kubectl describe pod <pod> | grep OOMKilled
# Also check node dmesg via kubectl debug
```

### Scenario: Service Unreachable
```bash
# 1. Verify endpoints exist and are ready
kubectl get endpoints <svc>
kubectl get endpointslice -l kubernetes.io/service-name=<svc>

# 2. Test DNS resolution inside a pod
kubectl exec -it debug-pod -- nslookup my-service.default.svc.cluster.local
kubectl exec -it debug-pod -- cat /etc/resolv.conf

# 3. Test direct pod IP (bypass service)
kubectl exec -it debug-pod -- curl http://<pod-ip>:<port>

# 4. Check NetworkPolicy
kubectl get networkpolicy -n <ns>
# Can use Hubble to see drops:
hubble observe --type drop --namespace default

# 5. CoreDNS health
kubectl logs -n kube-system deploy/coredns
kubectl get svc -n kube-system kube-dns
```

### Scenario: Node NotReady
```bash
# 1. Check node conditions
kubectl describe node <name> | grep -A 10 Conditions

# 2. SSH to node, check kubelet
systemctl status kubelet
journalctl -u kubelet --since "5 minutes ago"

# 3. Check container runtime
systemctl status containerd
crictl info

# 4. Disk and memory pressure
df -h
free -h
cat /proc/pressure/memory

# 5. Cilium agent health
kubectl exec -n kube-system ds/cilium -- cilium status
```

---

## Part 6: Cilium Deep Dive — eBPF Network Dataplane

### Why Cilium Uses Identity-Based Policy
Traditional firewalls use IP addresses for policy. In Kubernetes, pod IPs are ephemeral — they change on every restart. Cilium uses **security identity** — a hash of the pod's labels — instead of IPs.

```
pod labels: {app: frontend, version: v2}
→ identity: 12345 (hash of labels)
→ policy: allow identity 12345 to reach identity 67890 (backend) on port 8080
```

When a pod is replaced, the new pod gets the same labels → same identity → same policy. No policy update needed.

### NetworkPolicy: What Blocks What
```yaml
# This policy allows only pods with label "app: backend" to receive traffic on port 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
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
    - port: 8080
# Default deny: all other ingress traffic to backend pods is dropped
```

**What gets blocked silently:**
- Prometheus scraping (its pods don't have the right labels)
- Health check probes from kubelet (uses node IP, not pod identity)
- Distributed tracing sidecars (need explicit egress policy)
- External DNS lookups (need egress to port 53)

**Debugging with Hubble:**
```bash
# Enable Hubble if not already
cilium hubble enable

# Real-time flow observation
hubble observe --follow

# See all drops for a specific pod
hubble observe --from-pod <namespace>/<pod> --type drop

# L7 visibility (HTTP)
hubble observe --follow --protocol http
# Shows: [source] → [destination] http GET /api/v1/foo 200 1ms

# Export flows for analysis
hubble observe -o json > flows.json
```

---

## Part 7: Nebius-Level Interview Questions + Strong Answers

### Q: "Walk me through what happens when I run kubectl apply -f pod.yaml"

"The YAML is sent to the API server as a POST or PATCH request. The API server:
1. Authenticates the request (checks my certificate or token)
2. Authorizes it (RBAC: can I create pods in this namespace?)
3. Runs mutating admission webhooks — these can modify the pod spec (e.g., inject sidecars, set default requests)
4. Validates the result against the schema
5. Runs validating admission webhooks — these can reject the pod if policy is violated
6. Persists to etcd and returns 201 Created

Now the scheduler watches the API server for pods with no `spec.nodeName`. It sees the new pod, runs the scheduling algorithm (filter → score → bind), and writes `spec.nodeName` back to the pod object in etcd.

The kubelet on the target node watches for pods assigned to it. It sees the pod, calls containerd via CRI to create the container. containerd calls the image registry to pull if needed, sets up the container filesystem, creates namespaces, and starts the process. Kubelet calls Cilium CNI to set up networking. Cilium creates the veth pair, assigns an IP, and programs eBPF maps for service routing and network policy.

Kubelet begins running readiness probes. Once the probe passes, kubelet sets `conditions.ready = true` on the pod. The EndpointSlice controller adds this pod's IP to the EndpointSlice for any matching Services. Now the pod receives traffic."

---

### Q: "A service has 3 replicas but one pod is receiving 80% of traffic. What happened?"

"This is a connection-stickiness problem. The most common cause is that the load balancer (or Cilium's eBPF service selection) is correctly distributing new connections, but one client (or a pool client) is holding long-lived connections to one pod.

HTTP/2 over persistent connections is the most frequent culprit. A single HTTP/2 connection can multiplex hundreds of requests. If the client uses one persistent HTTP/2 connection, all its requests go to one pod.

Diagnosis:
1. Check request rates per pod with `kubectl top pods` or Prometheus query `rate(http_requests_total[1m])` by pod label
2. Check active connection count per pod endpoint
3. Use Hubble to count flows per source-destination pair

Solutions:
- At the load balancer level: use connection draining, force reconnects periodically
- At the application level: limit max requests per connection (gRPC MaxConnectionAgeGrace)
- At the Kubernetes level: use `sessionAffinity: None` (should be default)
- For gRPC specifically: use client-side load balancing (headless service + DNS-based) or a mesh like Istio that does L7 load balancing per request"

---

## Points to Remember

- API server → etcd → all other components watch the API server. Nothing talks directly to etcd except the API server.
- Scheduler only writes `spec.nodeName`. It does not start containers.
- kubelet reads from API server, calls CRI (containerd), calls CNI (Cilium).
- Cilium uses eBPF hash maps for O(1) service lookup vs iptables O(n) chain traversal.
- NetworkPolicy is default-allow if no policy exists. A policy on a pod makes everything else default-deny.
- GPU requests use `nvidia.com/gpu` extended resource — NOT overcommittable like CPU.
- Operators reconcile CRDs. They are not in the critical path for running workloads.
- etcd needs majority quorum. 3-node cluster tolerates 1 failure.
- Soperator uses `pivot_root` + Linux namespaces to create "jails" on shared PVs.
- Pod identity in Cilium is based on labels, not IPs — survives pod restarts without policy updates.

## What to Study Next

- [03-gpu-ai-infrastructure.md](/docs/nebius/gpu-ai-infrastructure) — GPU hardware and distributed training operations
- [04-system-design.md](/docs/nebius/system-design) — Design a fault-tolerant GPU cluster
- [01-linux-deep-dive.md](/docs/nebius/linux-deep-dive) — The Linux primitives that Kubernetes is built on
