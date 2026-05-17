---
title: "Interview Questions"
sidebar_position: 4
---

# Kubernetes & Containers — Interview Questions

All Q&As organized by level, sourced from 70 PDF documents in the corpus.

---

## Beginner Level (Docker)

**Q1: What is Docker, and how does it differ from a virtual machine?**

Docker is a containerization platform that packages applications with their dependencies. Unlike VMs, it shares the host OS kernel, making it lightweight, faster to start, and more portable. VMs include a full guest OS and require a hypervisor, resulting in more overhead.

---

**Q2: What are the main components of Docker?**

- Docker Engine (daemon)
- Docker CLI (client)
- Docker Images (read-only blueprints)
- Docker Containers (running instances of images)
- Docker Registry (image storage, e.g., Docker Hub)
- Docker Networks and Volumes

---

**Q3: What is the difference between a Docker Image and a Container?**

- **Image** — Read-only template/blueprint. Does not run on its own.
- **Container** — A running (writable) instance of an image.

---

**Q4: What is a Dockerfile, and what are its key components?**

A Dockerfile is a script containing instructions to build a Docker image. Key instructions:
- `FROM` — base image
- `RUN` — commands executed at build time
- `CMD` / `ENTRYPOINT` — default command at runtime
- `COPY` / `ADD` — copy files into the image
- `EXPOSE` — document which port the app uses
- `ENV` — set environment variables
- `WORKDIR` — set working directory

---

**Q5: What is the difference between CMD and ENTRYPOINT?**

- `CMD` — defines the default command but **can be overridden** when you run `docker run myimage <override_command>`
- `ENTRYPOINT` — defines a fixed executable that **always runs**; arguments from CMD or `docker run` are appended to it

---

**Q6: What is the difference between COPY and ADD in a Dockerfile?**

- `COPY` — copies files/directories from host to container
- `ADD` — same as COPY, but also extracts `.tar` archives and supports downloading from remote URLs. Prefer `COPY` unless you need ADD's extra features.

---

**Q7: What happens when you run `docker run nginx`?**

1. Docker checks if the `nginx` image is available locally
2. If not, it pulls it from Docker Hub
3. Creates a new container from the image
4. Starts the container with the default command

---

**Q8: How do you reduce Docker image size?**

- Use Alpine or distroless base images
- Use multi-stage builds (only copy runtime artifacts to final image)
- Combine `RUN` commands with `&&` to minimize layers
- Use `.dockerignore` to exclude unnecessary files
- Remove build tools and temp files after installation

---

**Q9: What is a multi-stage build?**

It allows multiple `FROM` statements in a Dockerfile. Each stage can use a different base image. The final image only copies what it needs from previous stages, keeping it small.

```dockerfile
FROM golang:1.21 AS builder
RUN go build -o app .

FROM alpine:latest
COPY --from=builder /app/app /app
CMD ["/app"]
```

---

**Q10: How do you debug a failing Docker container?**

```bash
docker logs <container_id>              # View logs
docker inspect <container_id>           # Detailed config and state
docker exec -it <container_id> /bin/sh  # Shell inside container
docker stats <container_id>             # CPU/memory usage
docker events                           # Real-time event stream
```

---

## Beginner Level (Kubernetes)

**Q11: What is Kubernetes?**

Kubernetes (K8s) is an open-source container orchestration platform that automates deployment, scaling, and management of containerized applications. Originally developed by Google based on their internal system "Borg."

---

**Q12: What are the main components of Kubernetes architecture?**

**Control Plane (Master):**
- API Server — Frontend for the cluster; all communication goes through it
- etcd — Distributed key-value store for cluster state
- Scheduler — Assigns pods to nodes
- Controller Manager — Ensures desired state (e.g., right number of replicas)

**Worker Nodes:**
- Kubelet — Agent ensuring containers run as specified
- Kube-Proxy — Manages network rules for service routing
- Container Runtime — Runs containers (Docker, containerd)

---

**Q13: What is a Pod?**

A Pod is the smallest deployable unit in Kubernetes. It can contain one or more containers that share the same:
- Network namespace (same IP address and port space)
- Storage volumes
- Lifecycle

---

**Q14: What are Kubernetes Services? What are the types?**

Services provide stable network access to a group of Pods. Types:
- **ClusterIP** — Internal communication within the cluster (default)
- **NodePort** — Exposes service on each node's IP at a static port
- **LoadBalancer** — Provisions a cloud load balancer for external access
- **ExternalName** — Maps a service to an external DNS name

---

**Q15: What is a ConfigMap? What is a Secret?**

- **ConfigMap** — Stores non-sensitive configuration data (env vars, config files) as key-value pairs
- **Secret** — Stores sensitive data (passwords, API keys, TLS certs) in base64-encoded form

Key difference: Secrets are base64-encoded (not encrypted by default; use encryption at rest for real security). ConfigMaps store plain text.

---

**Q16: How do you list all running pods?**

```bash
kubectl get pods                 # Current namespace
kubectl get pods -A              # All namespaces
kubectl get pods -n my-namespace # Specific namespace
kubectl get pods -o wide         # With node info
```

---

**Q17: How do you scale a Deployment?**

```bash
kubectl scale deployment my-app --replicas=5
# Or edit and apply the YAML
kubectl edit deployment my-app
```

---

**Q18: What is a ReplicaSet?**

A ReplicaSet ensures that a specified number of Pod replicas are running at all times. Deployments manage ReplicaSets — you typically don't create ReplicaSets directly.

---

## Intermediate Level (Docker)

**Q19: How do you connect two containers to each other?**

Use Docker networks. Create a custom bridge network and run both containers on it — they can then communicate by container name.

```bash
docker network create my-net
docker run -d --name db --network my-net postgres
docker run -d --name app --network my-net myapp
# "app" can reach "db" at hostname "db"
```

---

**Q20: How do you handle secrets securely in Docker?**

- Use Docker Secrets (in Swarm mode)
- Pass as environment variables from a secrets manager (Vault, AWS Secrets Manager)
- Mount secret files from the host (avoid baking secrets into images)
- Use `.env` files with `.dockerignore` to exclude from build context

---

**Q21: What is the difference between Bridge, Host, and Overlay networks?**

| Network | Description |
|---|---|
| Bridge | Default. Containers on same host communicate. Host port mapping needed for external access. |
| Host | Container shares the host's network stack directly. No port mapping needed. |
| Overlay | Multi-host networking for Docker Swarm. |
| None | No network access. |

---

**Q22: How do you ensure containers restart automatically on failure?**

```bash
docker run --restart=always nginx
docker run --restart=on-failure:3 myapp  # Retry up to 3 times
docker run --restart=unless-stopped nginx  # Restart unless manually stopped
```

---

**Q23: What is Docker layer caching and how does it affect builds?**

Each instruction in a Dockerfile creates a layer. Docker caches layers and reuses them on subsequent builds if the instruction and its context haven't changed.

**Best practice:** Put frequently changing instructions (like `COPY . .`) at the bottom of the Dockerfile so package install layers are cached.

---

## Intermediate Level (Kubernetes)

**Q24: What is a StatefulSet? When do you use it?**

A StatefulSet manages stateful applications where Pods need:
- Stable, unique network identifiers (pod-0, pod-1, ...)
- Stable persistent storage per Pod
- Ordered, graceful deployment and scaling

Use for: databases (MySQL, PostgreSQL, Cassandra), message queues (Kafka, RabbitMQ).

---

**Q25: What is the difference between HPA and VPA?**

- **HPA (Horizontal Pod Autoscaler)** — Scales the **number of pods** based on CPU/memory utilization
- **VPA (Vertical Pod Autoscaler)** — Adjusts the **resource requests/limits** of individual pods

HPA and VPA should not be used together on the same metric — they can conflict.

---

**Q26: How do you perform a rollback in Kubernetes?**

```bash
kubectl rollout undo deployment my-app
kubectl rollout undo deployment my-app --to-revision=2
kubectl rollout history deployment my-app
```

---

**Q27: What are Network Policies?**

Network Policies control Pod-to-Pod and Pod-to-external traffic using label selectors. They implement a whitelist model — once you create a NetworkPolicy targeting a Pod, all traffic not explicitly allowed is denied.

Requires a CNI that supports network policies (Calico, Cilium, Weave Net).

---

**Q28: What is RBAC in Kubernetes?**

Role-Based Access Control restricts cluster operations based on roles assigned to users or service accounts.

- **Role/ClusterRole** — Defines a set of permissions (verbs on resources)
- **RoleBinding/ClusterRoleBinding** — Assigns a role to a subject (user, group, serviceaccount)

---

**Q29: What are Probes in Kubernetes?**

- **Liveness Probe** — If it fails, Kubernetes restarts the container
- **Readiness Probe** — If it fails, Kubernetes removes the Pod from Service endpoints (no traffic sent)
- **Startup Probe** — For slow-starting apps; disables liveness/readiness until startup completes

---

**Q30: How does Kubernetes handle rolling updates?**

Rolling updates replace old Pods gradually with new ones. Controlled by:
- `maxSurge` — How many extra pods can exist during update
- `maxUnavailable` — How many pods can be unavailable during update

```bash
kubectl set image deployment/my-app container=nginx:1.25
kubectl rollout status deployment/my-app
```

---

**Q31: What is etcd in Kubernetes?**

etcd is a distributed, highly-available key-value store that Kubernetes uses as its backing store for all cluster data — Pod definitions, node status, Secrets, ConfigMaps, RBAC rules, etc.

Key properties: consistent (uses Raft consensus), watches (allows controllers to get notified on changes), MVCC.

---

**Q32: What is the role of kube-proxy?**

kube-proxy runs on every node and maintains network rules (iptables or IPVS rules) that implement Kubernetes Services — routing traffic from Service virtual IPs to the actual Pod IPs.

---

**Q33: What is a DaemonSet?**

A DaemonSet ensures that a copy of a Pod runs on every node (or a subset of nodes). Common uses: log collectors (Fluentd), monitoring agents (node-exporter), network plugins.

---

**Q34: What is a PodDisruptionBudget (PDB)?**

A PDB specifies the minimum number of Pods that must remain available during voluntary disruptions (node drains, rolling updates). It prevents too many pods from being disrupted simultaneously.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
spec:
  minAvailable: 2        # Or use maxUnavailable: 1
  selector:
    matchLabels:
      app: my-app
```

---

## Advanced Level

**Q35: How do you debug a pod that is stuck in Pending state?**

```bash
kubectl describe pod <pod-name>   # Look at Events section
kubectl get events --sort-by=.metadata.creationTimestamp
```

Common causes:
- Insufficient CPU/memory on nodes
- Node affinity/taints preventing scheduling
- PVC not bound (storage issue)
- Image pull secrets missing

---

**Q36: How do you debug a pod in CrashLoopBackOff?**

```bash
kubectl logs <pod-name>                     # Current container logs
kubectl logs <pod-name> --previous          # Logs from previous (crashed) container
kubectl describe pod <pod-name>             # Check exit codes and events
kubectl exec -it <pod-name> -- /bin/sh     # Shell (if container is running)
```

Common causes: application crash, OOMKilled (out of memory), misconfigured environment variables, failed liveness probe.

---

**Q37: What is Kubernetes Federation?**

Kubernetes Federation (now KubeFed) allows managing multiple Kubernetes clusters as a single entity. Used for:
- Multi-region deployments
- High availability across data centers
- Hybrid cloud setups

---

**Q38: What is an Admission Controller?**

Admission controllers intercept API requests before objects are persisted to etcd. They can:
- **Mutate** objects (MutatingAdmissionWebhook)
- **Validate** objects (ValidatingAdmissionWebhook)
- Apply defaults (DefaultStorageClass, LimitRanger)

Examples: OPA/Gatekeeper, Kyverno, Pod Security Admission.

---

**Q39: What is a Kubernetes CRD?**

A Custom Resource Definition (CRD) extends the Kubernetes API with new resource types. Once a CRD is created, you can create instances of that resource and manage them with kubectl just like built-in resources.

---

**Q40: What is Kubernetes Canary Deployment?**

A canary deployment sends a small percentage of traffic to a new version to test it before full rollout. In Kubernetes, this can be done by:
- Running two Deployments (v1 and v2) with different replica counts
- Using a service mesh (Istio VirtualService with traffic weights)
- Using Argo Rollouts for progressive delivery

---

**Q41: What is the Cluster Autoscaler vs HPA vs VPA?**

| Tool | What it scales |
|---|---|
| HPA | Number of pods in a Deployment |
| VPA | CPU/memory requests/limits of pods |
| Cluster Autoscaler | Number of nodes in the cluster |

These work together: HPA and VPA ensure pods get right resources; CA ensures there are enough nodes to schedule those pods.

---

**Q42: How does Kubernetes implement service discovery?**

Kubernetes provides DNS-based service discovery via **CoreDNS**. Every Service gets a DNS name:
- `<service-name>.<namespace>.svc.cluster.local`
- Pods can reach services by short name within the same namespace

```bash
# From inside a pod:
curl http://my-service              # Same namespace
curl http://my-service.prod         # Different namespace
curl http://my-service.prod.svc.cluster.local  # Full FQDN
```

---

**Q43: How do you do maintenance on a Kubernetes node?**

```bash
# 1. Mark node as unschedulable
kubectl cordon node-1

# 2. Evict all pods from the node
kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data

# 3. Perform maintenance (OS update, hardware)

# 4. Mark node schedulable again
kubectl uncordon node-1
```

---

**Q44: What are Taints and Tolerations?**

**Taints** — Applied to nodes to repel pods. Three effects:
- `NoSchedule` — Pods won't be scheduled (unless they tolerate)
- `PreferNoSchedule` — Soft version
- `NoExecute` — Evicts existing pods too

**Tolerations** — Applied to pods to allow scheduling on tainted nodes.

---

**Q45: What is Helm and why is it used?**

Helm is the Kubernetes package manager. A Helm **Chart** is a collection of templated Kubernetes manifests. Benefits:
- Package complex applications as reusable charts
- Manage values/configurations per environment
- Rollback to previous releases
- Dependency management between charts

---

**Q46: What is the init container and when to use it?**

Init containers run to completion before the main containers start. Use cases:
- Wait for a dependency to be ready (e.g., wait for DB)
- Pre-populate a shared volume with data
- Run database migrations before the app starts
- Register with an external service

Init containers don't survive restarts; if an init container fails, Kubernetes retries.

---

**Q47: How does Kubernetes handle Secrets securely?**

By default, Secrets are base64-encoded but **not encrypted** in etcd. To properly secure them:
- Enable **encryption at rest** for etcd
- Use **RBAC** to restrict access to Secrets
- Use **external secret stores** (HashiCorp Vault, AWS Secrets Manager) with the Secrets Store CSI Driver or External Secrets Operator
- Avoid mounting all secrets when only specific ones are needed

---

**Q48: What is the difference between Kubernetes Services and Ingress?**

| Feature | Service | Ingress |
|---|---|---|
| Layer | L4 (TCP/UDP) | L7 (HTTP/HTTPS) |
| Routing | By port | By host/path rules |
| SSL termination | No | Yes |
| External IP | One per LoadBalancer | One IP for all services |
| Cost | One LB per service | One LB for all |

---

**Q49: How do you control resource usage of a Pod?**

Use `resources.requests` (minimum needed for scheduling) and `resources.limits` (maximum allowed):

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "1"
```

Exceeding memory limit: Pod is OOMKilled. Exceeding CPU limit: CPU is throttled (not killed).

---

**Q50: What are Kubernetes Labels and Annotations?**

- **Labels** — Key-value metadata used for selection and grouping. Services, deployments, and network policies use labels to identify pods.
- **Annotations** — Key-value metadata for storing non-identifying information (build version, contact, documentation URLs). Not used for selection.

---

## Staff-Level Mock Interview Questions (SRE Depth)

These are diagnostic-structure questions. The interviewer is testing how you reason under uncertainty. Name commands. Explain what each result would mean. Do not jump to a conclusion without evidence.

---

**Q51: A service is timing out only from some nodes in a cluster. Walk me through your first ten minutes.**

Strong answer:

1. Establish scope. `kubectl get pods -o wide` to map affected pods to nodes. Is the pattern node-local, namespace-local, AZ-local, or service-local?
2. Was there a recent rollout? `kubectl rollout history deploy/...`
3. From an affected node, `curl -v <service-ip>:<port>` directly — bypass DNS.
4. `ss -s` for socket exhaustion. `iptables -L KUBE-SERVICES -n -v` to validate proxy rules. `journalctl -u kube-proxy --since '10m ago'`.
5. If retransmits show up in `ss -i`, drop down to the physical layer: `ethtool -S eth0`, MTU mismatch, BGP peer state.
6. Separate DNS resolution failures from TCP connect failures from HTTP-level errors — different tests, different evidence.

Red flag: "I would check the logs and see if there are errors" with no commands and no failure-domain reasoning.

---

**Q52: Explain how a packet reaches a Pod from a client outside the cluster.**

```text
Client -> Cloud LB -> Node NodePort/target -> kube-proxy (iptables/IPVS) DNAT
       -> kernel conntrack records translation -> CNI veth -> Pod netns -> process
Reply path reverses; conntrack un-NATs.
```

With Cilium eBPF: kube-proxy may be absent; eBPF programs in TC ingress/egress hooks handle DNAT; XDP can drop or load-balance at the earliest possible point.

For overlay CNI (Flannel VXLAN): the packet is encapsulated in UDP between nodes, adding ~50 bytes. If pod MTU is not lowered below physical MTU, large packets silently fragment or drop.

---

**Q53: A Pod is Ready, but requests still fail. Give me five causes and how you would disprove each one.**

| Cause | Disproof |
|---|---|
| Probe passes a shallow path but real handler is broken | `kubectl exec <pod> -- curl localhost:<port>/<real-path>` |
| Service selector does not match pod labels | `kubectl get endpoints <svc>` — if pod IP is absent, selector mismatch |
| kube-proxy iptables lag after pod replacement | Compare pod IP in `iptables -L KUBE-SEP-* -n` vs current pod IP |
| NetworkPolicy block | `kubectl get netpol -A` in both source and destination namespaces |
| App bound to 127.0.0.1 not 0.0.0.0 | `kubectl exec <pod> -- ss -tlnp` confirms bind address |

---

**Q54: Why can memory pressure hurt latency before any OOM kill occurs?**

The most impactful mechanism is **direct reclaim**. When a cgroup is near its memory limit, any new allocation triggers synchronous page reclaim in the calling thread's context — that allocation now takes milliseconds instead of nanoseconds. P99 spikes without any OOM event.

Supporting mechanisms:

- **kswapd** competes for CPU asynchronously.
- **Dirty page writeback throttling** when `dirty_ratio` is hit blocks writes in the app's path.
- **Swap activity** even at small volumes causes microsecond-to-millisecond stalls.
- **THP compaction** scans and pauses can introduce milliseconds of stall.

Confirm with `sar -B`, `cat /proc/vmstat | grep pgmajfault`, `memory.stat` in the cgroup.

---

**Q55: What does the kubelet do that matters operationally during a bad rollout?**

- Runs **readiness probes** — removes failing pods from the EndpointSlice (no restart).
- Runs **liveness probes** — restarts containers that fail.
- Garbage-collects dead containers and images — during crash loops this consumes ephemeral storage and can trigger `DiskPressure`.
- Reports NodeConditions (MemoryPressure, DiskPressure, PIDPressure).
- Enforces cgroup limits — OOM-kills containers exceeding memory limits.
- During eviction, follows priority classes and QoS order.
- Emits Events surfaced in `kubectl describe pod` — usually the first signal to on-call.

---

**Q56: A DNS issue is suspected, but application teams insist "the network is down." How do you arbitrate with evidence?**

Run two tests in parallel from an affected pod:

1. `curl -v http://<pod-ip>:<port>/` — bypasses DNS. If this succeeds, the network is up.
2. `dig @<coredns-ip> <svc>.<ns>.svc.cluster.local` — if NXDOMAIN or timeout, CoreDNS is the failure.

Then check CoreDNS health: `kubectl top pod -n kube-system -l k8s-app=kube-dns`, restart history, upstream resolution.

Present the result as a timeline: "TCP to pod IP succeeds at 15:31; DNS lookup of the same service times out at 15:32; CoreDNS pod was at 98% CPU limit. Network is fine, DNS resolver is the bottleneck."

---

**Q57: You see retransmits, elevated tail latency, and partial rack impact. What layers do you test first and why?**

Rack-partial pattern implies **physical**. Start at L1/L2:

1. `ethtool -S <iface>` on nodes in the affected rack — `tx_errors`, `rx_missed_errors`, `rx_crc_errors`.
2. `ip -s link` for drops.
3. Compare error counts across nodes — asymmetric counts mean a single bad NIC.
4. Check ToR switch port flapping (network team syslog / SNMP).
5. Only after ruling out physical: conntrack overflow (`conntrack -S`), kernel ring buffer drops (`dmesg | grep -i drop`), ECMP routing asymmetry.

Distinguish TCP retransmits (visible to app, jittery latency) from ethernet-level retransmits (L2, invisible to app, indicate physical degradation).

---

**Q58: What are requests, limits, and QoS really buying you in a multi-tenant platform?**

- **Requests** determine scheduling. The scheduler will not place a pod unless the sum of requests fits the node's allocatable.
- **Limits** are enforced at runtime by cgroups: CFS throttling for CPU, OOMKill for memory.
- **QoS class** (Guaranteed, Burstable, BestEffort) determines eviction order under node pressure and OOM score.

In multi-tenancy:

- Guaranteed QoS for critical control-plane / inference workloads survives node memory pressure that evicts BestEffort first.
- A single workload with no limits can cause noisy-neighbor CPU or memory issues even with requests set.
- Add `LimitRange` (defaults), `ResourceQuota` (caps), and `PriorityClass` (eviction order) to make multi-tenancy operationally safe.

---

**Q59: A probe configuration caused cascading failure during peak load. Explain the mechanism.**

Death-spiral mechanism:

1. Liveness probe has `timeoutSeconds: 1`, `failureThreshold: 2`.
2. Under peak load, app P99 is 800ms — two 1-second probe timeouts in a row trigger restart.
3. Kubelet starts restarting pods serially.
4. Each restart removes a pod from the EndpointSlice — remaining pods handle proportionally more traffic.
5. Their latency rises further. They fail probes faster.
6. Within minutes, most pods have been restarted during peak, connection pools are drained, caches are cold.

Mitigation: generous probe timeouts, `failureThreshold: 3+`, `startupProbe` for slow boot, liveness probes that test only the process's liveness (not dependencies).

---

**Q60: Give me a production issue where Linux, networking, and Kubernetes all interacted.**

Structured-story format: context, symptoms, hypothesis chain, diagnosis, fix, prevention.

Example: Intermittent 503s in one region. Pods healthy, endpoints populated, logs clean. `tcpdump` on the affected node showed SYN packets arriving with no SYN-ACK reply. `sysctl net.netfilter.nf_conntrack_max` was at the default 65536; the cluster had scaled to 200+ pods per node during a load test, so the conntrack table was full. New connections silently dropped while established flows continued.

Cross-layer: Linux kernel parameter (conntrack), triggered by a Kubernetes scaling event, on a network path that only used conntrack because kube-proxy was in iptables mode.

Fix: raise `nf_conntrack_max` and `nf_conntrack_buckets`, deploy a DaemonSet that monitors conntrack fill rate and alerts before saturation. Long-term: move to Cilium kube-proxy replacement so conntrack is bypassed for Service traffic.

---

## Platform Engineering Questions

**Q61: How do you isolate GPU capacity from accidental consumption by general workloads?**

Layered controls:

1. Dedicated GPU node pools.
2. Taints on GPU nodes (`dedicated=gpu:NoSchedule`).
3. Tolerations only on approved GPU workloads.
4. Node labels (`nvidia.com/gpu.product`) + node affinity for accelerator-specific placement.
5. `ResourceQuota` per non-GPU namespace setting `requests.nvidia.com/gpu: "0"`.
6. Admission policy (Kyverno / OPA) rejecting GPU requests from non-approved namespaces.

Goal: make accidental GPU consumption difficult by default.

---

**Q62: What is the "partial start" problem in distributed training and how do you prevent it?**

If a 4-worker training job needs 4 GPUs and only 2 schedule, those 2 GPUs sit idle waiting for peers. The job burns expensive GPU hours with zero progress.

Prevention: gang scheduling via Kueue or Volcano. The job waits in a queue until all required resources are available, then admits as a whole. Even if the underlying scheduler is still the default one, the queueing controller prevents partial admission.

---

**Q63: Your platform runs 11 operators. Categorize them by risk.**

| Risk class | Examples | Failure impact |
|---|---|---|
| Low | Manages only its own CRDs, no cluster RBAC | The CR it manages stops reconciling; rest of cluster unaffected |
| Medium | Cluster-wide controllers, ClusterRoleBinding | Affects multiple namespaces but does not block admission |
| High | Mutating webhook on Pods, certificate manager with mutating webhook | Can block all pod admission cluster-wide |

Detection: probe CRD reconciliation lag (operator-emitted metric) and webhook response time. A "broken" operator with no metric coverage is invisible until users complain.

---

**Q64: Kyverno policy is `failurePolicy: Fail`. Kyverno pod crashes. What happens?**

The API server rejects every API request matching the webhook's rules until Kyverno recovers. Deployments fail, scaling fails, self-healing fails. The cluster appears frozen even though kube-apiserver, etcd, and kubelet are all healthy.

Mitigations:

- Run Kyverno with high replica count and PDB.
- Use `failurePolicy: Ignore` for non-critical policies.
- Use `failurePolicy: Fail` only with narrow `namespaceSelector` / `objectSelector` so kube-system and recovery namespaces are exempt.
- Set short `timeoutSeconds` so a hung webhook fails fast.

---

**Q65: When would you recommend Istio sidecar mode vs ambient mode vs not adopting a mesh?**

| Choice | When |
|---|---|
| No mesh | Problems solvable with NetworkPolicy + Ingress; team cannot own istiod |
| Cilium (no sidecars) | Want mTLS and L4/L7 policy with one CNI, no sidecar overhead |
| Istio ambient | Want mesh feature set with less per-pod overhead than sidecars; granular per-workload policy is not required |
| Istio sidecar | Need fine-grained per-workload policy, mature traffic management, L7 routing |

Cost of sidecars: 30-80ms additional startup per pod, 50-150MB sidecar memory, certificate rotation events, increased blast radius of mesh control plane.

---

**Q66: etcd is restored successfully but the cluster is still not functional. What are the three most likely causes?**

1. **Certificates expired** — Kubernetes uses certs for kubelet → API server and API server → etcd. Restoring an old snapshot can revive expired certs that are no longer accepted.
2. **Object state references missing resources** — Pods reference Nodes that no longer exist (scaled-down node group), PVCs reference PVs in another region, Secrets reference ServiceAccounts that have been deleted.
3. **Controllers stuck on stale leases** — Lease objects from the previous etcd cluster mismatch the current leader. Controllers like kube-controller-manager wait until leases time out and are reacquired.

Recovery: restart the control plane components after etcd restore; rotate certificates if needed; manually clean up stale resources.

---

**Q67: A DR drill reveals the restore procedure takes 4 hours but the SLA says 1 hour RTO. What do you do?**

Three honest options:

1. **Renegotiate the SLA** with the business based on real measurements.
2. **Reduce the RTO** by precomputing recovery (warm-standby cluster, replicated etcd to a secondary region, active-passive cluster API).
3. **Reduce the scope** of what RTO covers — control-plane recovery in 30 min, app data in 4 hours, and document this honestly.

Do not declare 1-hour RTO and continue running 4-hour drills. False confidence is worse than honest measurement.

---

**Q68: What does "DR-ready" actually require beyond "we have backups"?**

- Written runbook with named owners.
- Tested restore drills (quarterly minimum).
- Separate plans for etcd, cluster, and app data — these are three different problems.
- RTO and RPO defined per workload class (control plane, stateless, stateful).
- Distinction between passive DR (can you recover?) and active DR (can you fail over traffic?).
- Recognition that multi-cluster does not solve DR without active data replication.
- Validation that the recovered cluster is actually functional, not just etcd healthy.

---

**Q69: How do you debug a GPU pod stuck in Pending?**

1. `kubectl describe pod <gpu-pod>` — scheduler events tell you exactly why no node fits.
2. `kubectl get nodes -L nvidia.com/gpu.product --show-labels` — are there GPU nodes? Do their labels match the pod's `nodeSelector`?
3. `kubectl describe node <gpu-node> | grep -A5 nvidia.com/gpu` — does kubelet advertise GPUs? If not, the device plugin failed.
4. `kubectl get pods -n gpu-operator` — is the GPU operator healthy? Validator pods passing?
5. Check tolerations on the pod and taints on the GPU node — taint without matching toleration repels the pod.
6. Check `ResourceQuota` in the pod's namespace — does it allow GPU requests?

---

**Q70: Why is inference cold start a production problem?**

Large language models take seconds-to-minutes to load weights into GPU memory. If inference scales to zero:

- the next request triggers a model load
- during the load (often 30s to 3min), requests time out or queue
- HPA can scale up quickly, but the new pod also has to cold-start
- caller SLOs are blown

Mitigations:

- **Warm capacity** — never scale critical inference to zero; maintain a minimum replica count.
- **Model preload** — load weights in an init container before readiness.
- **Faster model formats** — quantization, TensorRT-LLM, vLLM with FlashAttention.
- **MIG / model multiplexing** — fit more models per GPU so warm capacity is cheaper.
