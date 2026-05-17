---
title: "Kubernetes Lab 3: Node Pressure And Scheduling Reasoning"
sidebar_position: 99
---

# Kubernetes Lab 3: Node Pressure And Scheduling Reasoning

## Production Context

Your platform runs GPU training jobs alongside long-running inference services. Overnight,
the ops team added three new batch preprocessing pods. By 07:45 UTC three inference pods
are `Pending`, the node monitoring dashboard shows one node at 94% memory utilisation,
and a training pod was evicted. You need to understand why scheduling failed, why eviction
happened, and how to prevent it.

---

## Prerequisites

- A running Kubernetes cluster (kind or k3d with at least 2 nodes works)
- `kubectl` and `kubectl top` (metrics-server installed)
- Namespace `sre-lab` exists

---

## Environment Setup

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

## Beginner Section: Guided Walkthrough

### Step 1 — Find which pods are Pending

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

### Step 2 — Describe a Pending pod to read the scheduler message

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

### Step 3 — Check node resource allocation

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

### Step 4 — Compare requests vs actual usage

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

### Step 5 — Check recent cluster events for evictions

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

### Step 6 — Understand QoS classes

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

### Step 7 — Fix the scheduling problem

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

## Intermediate Section: Diagnose Without Full Hints

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

## Advanced / Stretch

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

## Sample Diagnosis Note

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

## Common Mistakes

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

## What To Study Next

- Kubernetes resource model: requests, limits, allocatable capacity
- QoS classes: Guaranteed, Burstable, BestEffort
- Kubelet eviction signals: memory.available, nodefs.available, imagefs.available
- VPA (Vertical Pod Autoscaler) for automatic request right-sizing
- LimitRange and ResourceQuota for namespace-level governance
- PriorityClass and preemption for mixed workload platforms
- Node taints and tolerations for hardware-specific scheduling (GPU, RDMA, NVMe)
