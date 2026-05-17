---
title: "Foundations: Kubernetes Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 2
---

# Foundations: Kubernetes Premium Teaching Guide For SRE And Platform Engineers

Kubernetes is a platform for running containers reliably at scale.

It schedules workloads, heals failures, manages service discovery, supports rolling updates, controls resources, and provides a standard operating model across infrastructure.

Many engineers memorize YAML without understanding the system. This guide teaches Kubernetes from first principles to production mastery.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — understand cluster building blocks.
2. **Intermediate Layer** — deploy apps, expose traffic, debug pods.
3. **Advanced Layer** — scheduler, control plane, CNI, storage, autoscaling.
4. **Production SRE Layer** — real incident handling.
5. **Interview Layer** — explain Kubernetes like a senior engineer.

---

# Memory Palace: Kubernetes Is A City

| Kubernetes Concept | City Analogy | Real Meaning |
|---|---|---|
| Cluster | Entire city | Whole Kubernetes environment |
| Control Plane | City government | Makes decisions |
| Node | Building | Worker machine |
| Pod | Apartment | Smallest runnable unit |
| Container | Resident | Running application |
| Deployment | Housing manager | Maintains desired replicas |
| ReplicaSet | Apartment counter | Ensures pod count |
| Service | Public phone number | Stable access point |
| Ingress | City gate | External HTTP access |
| Namespace | District | Logical separation |
| ConfigMap | Notice board | Non-secret config |
| Secret | Vault | Sensitive config |
| PVC | Reserved warehouse space | Persistent storage |
| Scheduler | Housing allocator | Chooses node |
| kubelet | Building supervisor | Runs pods on node |
| CNI | Roads | Pod networking |
| HPA | Demand planner | Auto scales workloads |

When Kubernetes has problems, ask: is the issue in government, building, roads, apartments, storage, or public phone system?

---

# Beginner Layer: What Kubernetes Actually Solves

Without Kubernetes, teams manually start containers, restart failures, scale traffic spikes, update versions, and connect services.

Kubernetes automates:

- scheduling
- self-healing
- scaling
- service discovery
- rolling deployments
- config management

It is best understood as a desired-state control system. You declare what should exist. Kubernetes continuously tries to make reality match.

```text
Desired state -> control loops -> actual running workloads
```

---

# Beginner Layer: Core Architecture

```text
kubectl
  -> API Server
      -> etcd
      -> Scheduler
      -> Controller Manager
  -> Worker Nodes
      -> kubelet
      -> container runtime
      -> Pods
```

## API Server

The front door. Every `kubectl` request and controller action goes through it.

## etcd

The cluster database. It stores Kubernetes objects and desired state.

## Scheduler

Chooses which node should run a Pod.

## Controller Manager

Runs reconciliation loops. If desired replicas are 3 and actual replicas are 2, a controller creates another Pod.

## kubelet

The agent on each node. It ensures assigned Pods are running.

## Container Runtime

Actually starts containers. Common runtimes include containerd and CRI-O.

---

# Beginner Layer: Pod Explained

A Pod is the smallest deployable unit.

Usually it contains one application container and sometimes helper sidecars.

Pods are ephemeral:

- they can die
- they can be recreated
- they can move to another node
- their IP can change

Never treat Pods like pets. Treat them like replaceable apartments in the city.

Useful commands:

```bash
kubectl get pods -A
kubectl describe pod POD -n NAMESPACE
kubectl logs POD -n NAMESPACE
kubectl exec -it POD -n NAMESPACE -- sh
```

---

# Beginner Layer: Deployment Explained

Use Deployments for stateless apps.

A Deployment manages ReplicaSets, and ReplicaSets manage Pods.

```text
Deployment -> ReplicaSet -> Pods
```

Deployment gives you:

- desired replica count
- rolling updates
- rollback
- failed Pod replacement

```bash
kubectl get deploy
kubectl rollout status deploy/web
kubectl rollout history deploy/web
kubectl rollout undo deploy/web
```

---

# Beginner Layer: Service Explained

Pods change IPs. A Service gives stable access.

| Type | Use |
|---|---|
| ClusterIP | Internal access |
| NodePort | Expose through every node on a port |
| LoadBalancer | Cloud load balancer integration |
| Headless | Direct pod discovery |

A Service selects Pods using labels. If selectors do not match labels, the Service has no useful backend.

```bash
kubectl get svc
kubectl describe svc api
kubectl get endpointslice
```

---

# Beginner Layer: Ingress Explained

Ingress routes HTTP and HTTPS traffic into the cluster.

```text
Internet -> Load Balancer -> Ingress Controller -> Service -> Pod
```

Ingress commonly handles:

- hostnames
- paths
- TLS
- routing to Services

---

# Intermediate Layer: kubectl Essentials

Learn what each command answers.

```bash
kubectl get pods
kubectl get deploy
kubectl get svc
kubectl get nodes
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod POD
kubectl logs POD --previous
kubectl exec -it POD -- sh
```

`get` shows state. `describe` shows details and events. `logs` shows app output. `events` show what the cluster tried to do.

---

# Intermediate Layer: ConfigMaps, Secrets, And Namespaces

## ConfigMap

Stores non-sensitive configuration.

## Secret

Stores sensitive values, but must still be protected with RBAC, encryption at rest, and careful logging.

## Namespace

A logical district for resources.

Use namespaces for environment, ownership, access boundaries, quotas, and operational clarity.

---

# Intermediate Layer: Requests And Limits

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1"
    memory: "1Gi"
```

## Requests

Used by the scheduler. They say: reserve this much capacity for placement.

## Limits

Used at runtime. They say: do not let the container exceed this boundary.

Important behavior:

- CPU limit usually throttles
- memory limit can OOMKill
- missing requests cause poor scheduling
- requests too low create noisy-neighbor risk

---

# Intermediate Layer: Probes

| Probe | Question | Result |
|---|---|---|
| Startup | Has the app finished booting? | protects slow startup |
| Readiness | Can this Pod receive traffic? | controls Service endpoints |
| Liveness | Is the app stuck and should restart? | restarts container |

Bad probes cause outages. Do not use liveness to check a database dependency. If the DB is down, restarting every app instance creates a storm.

---

# Advanced Layer: Scheduler Deep Dive

The scheduler places Pods on nodes.

It considers:

- CPU and memory requests
- taints and tolerations
- node selectors
- affinity and anti-affinity
- topology spread
- volume constraints
- quotas and policy

A Pending Pod is usually not an app bug. It means the scheduler cannot place it.

```bash
kubectl describe pod POD
kubectl describe node NODE
kubectl get events -A --sort-by=.lastTimestamp
```

---

# Advanced Layer: Taints, Tolerations, Affinity

## Taints

Keep normal Pods away from special nodes.

Examples:

- GPU nodes
- database nodes
- infra-only nodes

## Tolerations

Allow a Pod to tolerate a taint.

## Anti-Affinity

Spread replicas across nodes or zones for availability.

Senior habit: placement is part of reliability design, not only capacity management.

---

# Advanced Layer: Kubernetes Networking

Each Pod gets an IP. Services provide stable virtual access. The CNI plugin makes Pod networking real.

```text
Client -> Service IP -> kube-proxy/eBPF -> Pod IP
```

Important pieces:

- CNI plugin
- CoreDNS
- Service
- EndpointSlice
- Ingress controller
- NetworkPolicy

If direct Pod IP works but Service fails, focus on Service, EndpointSlice, kube-proxy/eBPF, or policy.

---

# Advanced Layer: Storage

Persistent workloads need storage beyond Pod lifetime.

```text
PVC requests storage
PV provides storage
Pod mounts volume
```

Concepts:

- Volume
- PersistentVolume
- PersistentVolumeClaim
- StorageClass
- CSI driver

Storage problems often appear as Pods stuck in Pending or ContainerCreating.

---

# Advanced Layer: StatefulSet

Use StatefulSet for workloads needing stable identity and storage.

Examples:

- PostgreSQL
- Kafka
- Elasticsearch

StatefulSet provides:

- stable Pod names
- ordered rollout
- stable volume identity

Stateful workloads require deeper failure planning than stateless Deployments.

---

# Advanced Layer: Autoscaling

## HPA

Scales Pod replicas using CPU, memory, or custom metrics.

## Cluster Autoscaler / Karpenter

Adds or removes nodes based on pending workloads and capacity needs.

Autoscaling only works well when requests, metrics, and startup behavior are sane.

---

# Production SRE Layer: Incident Framework

When Kubernetes breaks, first classify the failure.

Ask:

1. Is user traffic broken?
2. Are Pods running?
3. Are Pods ready?
4. Does Service have endpoints?
5. Is the failure scoped to one node, namespace, deployment, AZ, or cluster?
6. Did a rollout or config change happen?

Core commands:

```bash
kubectl get pods -A
kubectl get nodes
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod POD
kubectl logs POD --previous
kubectl get svc,endpointslice -n NAMESPACE
```

---

# Production Incident Walkthroughs

## CrashLoopBackOff

Likely causes:

- bad config
- missing secret
- app exits immediately
- dependency unavailable
- bad command or args

Check:

```bash
kubectl describe pod POD
kubectl logs POD --previous
```

## Pending Pods

Likely causes:

- insufficient CPU/memory
- taints not tolerated
- PVC unavailable
- impossible affinity
- quota exhausted

Check scheduler events in `kubectl describe pod`.

## Service Has No Traffic

Likely causes:

- selector mismatch
- readiness failing
- no endpoints
- wrong targetPort
- NetworkPolicy

Check:

```bash
kubectl describe svc SERVICE
kubectl get pods --show-labels
kubectl get endpointslice
```

## Node NotReady

Likely causes:

- kubelet issue
- disk pressure
- memory pressure
- CNI failure
- cloud node/network issue

Check:

```bash
kubectl describe node NODE
journalctl -u kubelet -n 200
```

---

# Kubernetes + Linux Connection

Kubernetes desired state becomes Linux reality.

| Kubernetes | Linux underneath |
|---|---|
| Pod | namespaces |
| requests/limits | cgroups |
| Service | iptables/IPVS/eBPF |
| volume | mounts/filesystems |
| container | process |
| node pressure | CPU/memory/disk pressure |

Weak Linux knowledge limits Kubernetes troubleshooting.

---

# Interview Layer: Strong Answers

## Why use Kubernetes?

> Kubernetes standardizes deployment, scaling, self-healing, service discovery, resource control, and rollout management for containerized workloads.

## Pod vs Deployment?

> A Pod is the runtime unit. A Deployment manages replicas and rolling updates for stateless workloads.

## Why can a Pod be Running but not healthy?

> Running means the container process exists. It does not prove readiness, dependency health, correct listener behavior, or application correctness.

## How would you debug a production outage?

> I would start from user impact, then inspect Pods, readiness, Services, EndpointSlices, events, nodes, rollout history, and dependencies. I separate control-plane state, node execution, service routing, and application behavior before changing anything.

---

# Labs

## Beginner

1. Deploy nginx.
2. Scale replicas.
3. Expose with ClusterIP.
4. Inspect Pods, Services, and logs.

## Intermediate

1. Perform rolling update and rollback.
2. Create ConfigMap and Secret.
3. Break readiness and observe endpoint removal.
4. Create ImagePullBackOff intentionally.

## Advanced

1. Add taints and tolerations.
2. Create HPA.
3. Apply NetworkPolicy default deny.
4. Create PVC and StatefulSet.
5. Inspect node-level kubelet/runtime logs.

---

# Memory Review

## Beginner Recall

- Why does Kubernetes exist?
- What is a Pod?
- Why does a Service exist?

## Intermediate Recall

- Request vs limit?
- Readiness vs liveness?
- Why use namespaces?

## Advanced Recall

- What does the scheduler consider?
- What does CNI do?
- Why can a Service have no endpoints?

## Production Recall

- How do you debug CrashLoopBackOff?
- How do you debug Pending?
- How do you separate app, Service, node, and control-plane failures?
