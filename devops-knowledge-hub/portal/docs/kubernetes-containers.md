---
title: "☸️ Kubernetes & Containers"
sidebar_position: 1
description: "Zero to hero study guide for Kubernetes & Containers — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Kubernetes (K8s) was created by Google based on their internal systems Borg and Omega — tools used to run thousands of Google services at scale. In 2014 Google open-sourced Kubernetes and donated it to the Cloud Native Computing Foundation (CNCF). It is now the de facto container orchestration standard across AWS (EKS), Azure (AKS), Google (GKE), and on-prem clusters.

As a Staff/Principal SRE you do not just use Kubernetes — you own the platform that every engineering team builds on. When the platform is wrong, you take down every team at once.

Why this matters in concrete business terms:
- **Deployment velocity** — rolling updates and automated rollbacks let teams ship without manual intervention
- **Reliability** — self-healing Pods, PodDisruptionBudgets, and topology spread constraints reduce 3am pages
- **Cost** — right-sizing resources and cluster autoscaling routinely delivers 20-60% savings
- **Security** — misconfigured RBAC and open network policies are lateral-movement playgrounds

---

## Core Concepts

### Containers vs Virtual Machines

Containers share the host OS kernel. VMs virtualise the hardware stack and include a full guest OS. This makes containers:
- Lighter (seconds to start vs minutes)
- More portable (same image runs on any host with Docker/containerd)
- Lower overhead (no hypervisor layer)

**Key Linux primitives behind containers:**
- `cgroups` — limit, account for, and isolate resource usage (CPU, memory, PIDs, I/O)
- `namespaces` — isolate PID, network, mount, UTS, IPC, user — each container gets its own view
- `overlayfs` — layered copy-on-write filesystem behind every image

### Docker Fundamentals

**Docker is a platform for building, shipping, and running containerised applications.**

Core components:
- **Docker Engine** — the core daemon that builds and runs containers
- **Docker Daemon** (`dockerd`) — background process accepting commands from the CLI
- **Docker CLI** — the `docker` command you type
- **Docker Images** — read-only templates (blueprints)
- **Docker Containers** — running instances of images (writable layer on top)
- **Docker Registry** — stores and distributes images (Docker Hub is public; ECR, GCR, Harbor are private)

Mental model: image is the recipe, container is the dish prepared from that recipe, Docker is the kitchen.

### Kubernetes Architecture

**Control Plane (Master) components:**
- **API Server** — the single entry point for all cluster communication; handles REST requests, writes to etcd
- **etcd** — distributed key-value store that holds all cluster state and configuration (the "database" of Kubernetes)
- **Scheduler** — assigns new Pods to nodes based on resource availability, taints, affinities
- **Controller Manager** — runs controllers that reconcile actual state to desired state (ReplicaSet controller, Deployment controller, Node controller, etc.)

**Worker Node components:**
- **Kubelet** — agent on every node; ensures containers run as defined in Pod specs; reports Pod status back to etcd
- **Kube-Proxy** — maintains network rules on each node; implements Service virtual IPs using iptables or IPVS
- **Container Runtime** — executes containers; modern clusters use containerd (not Docker directly); OCI runtimes include runc, gVisor, Kata

**Request flow:**
```
User/Admin → kubectl → API Server → etcd (stores desired state)
                                  → Scheduler (assigns Pod to Node)
                                  → Controller Manager (reconciles)
Worker Node: Kubelet ← API Server → pulls image → runs container
```

**Key insight — the reconciliation model:** Kubernetes is a distributed state machine. Every controller runs: observe actual state → compare to desired state → act to close the gap. This is why `kubectl apply` is safe to re-run and why Kubernetes is eventually consistent.

### Pods

The smallest deployable unit in Kubernetes. A Pod wraps one or more containers.

Key properties:
- All containers in a Pod share the **same network namespace** (same IP, same `localhost`)
- Containers in a Pod can share volumes via `volumes` + `volumeMounts`
- Pods are **ephemeral** — when they die they are gone; use controllers to manage lifecycle
- Each Pod gets a **unique IP** address within the cluster

**Pod lifecycle:** Pending → Running → Succeeded / Failed

Container states within Running: Waiting → Running → Terminated. `restartPolicy` controls behaviour on exit:
- `Always` — for Deployments (always restart)
- `OnFailure` — for Jobs
- `Never` — for one-shot containers

**Init containers** run sequentially before app containers start. Use cases: wait for a dependency, pre-populate a volume, run database migrations.

**Sidecar pattern** — helper container in the same Pod. Used for: service mesh proxies (Envoy/Linkerd), log shippers (Fluent Bit), secret rotators. Since Kubernetes 1.29, sidecars can be declared as `initContainers` with `restartPolicy: Always`.

### Workload Controllers

**Deployment** — stateless applications. Manages ReplicaSets. Supports rolling updates (`maxSurge`, `maxUnavailable`) and rollbacks.

```bash
kubectl create deployment my-app --image=nginx
kubectl scale deployment my-app --replicas=5
kubectl set image deployment/my-app my-container=nginx:latest
kubectl rollout status deployment my-app
kubectl rollout undo deployment my-app
kubectl rollout history deployment my-app
```

**StatefulSet** — stateful applications. Each Pod gets a stable ordinal identity (`pod-0`, `pod-1`), stable hostname (`pod-0.service.namespace.svc`), and a dedicated PVC. Pods start and stop in order. Use for: databases, Kafka, Elasticsearch, ZooKeeper.

**DaemonSet** — runs exactly one Pod per node (or per matching nodes). Use for: node-level monitoring (node-exporter), log collection (Fluent Bit), CNI plugins, storage agents.

**Job / CronJob** — Job runs to completion. CronJob schedules Jobs on a cron schedule. Key settings: `completions`, `parallelism`, `backoffLimit`, `activeDeadlineSeconds`. Set `concurrencyPolicy: Forbid` on CronJobs to prevent overlapping runs.

### Services and Networking

A Service provides a stable virtual IP (ClusterIP) that load-balances to matching Pods via label selector.

**Service types:**

| Type | Description |
|------|-------------|
| `ClusterIP` (default) | Internal cluster-only IP; not reachable from outside |
| `NodePort` | Exposes on every node at a static port (30000-32767); for dev/debug |
| `LoadBalancer` | Provisions a cloud LB; one LB per Service; prefer Ingress for prod |
| `ExternalName` | CNAME alias to an external DNS name |

Example ClusterIP Service YAML:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9376
```

Example NodePort Service YAML:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app: my-backend
  ports:
  - port: 80
    targetPort: 9376
    nodePort: 30007
```

Access externally: `http://<NodeIP>:30007`

**Headless Service** (`clusterIP: None`) — no VIP; DNS returns individual Pod IPs directly. Required by StatefulSets for per-Pod DNS (`pod-0.service.ns.svc.cluster.local`).

**kube-proxy** implements Service VIPs using iptables or IPVS on every node. IPVS mode scales better for clusters with 1000+ Services.

**How services are discovered internally:**
Services resolve by DNS name: `<service-name>.<namespace>.svc.cluster.local`
Cross-namespace access: `backend.production.svc.cluster.local`

**Ingress** — L7 HTTP/HTTPS routing rules. An Ingress Controller (nginx, Traefik, AWS ALB, HAProxy) reads Ingress Resources and implements the routing. One controller handles all traffic — much cheaper than one LB per Service.

Ingress requires two components:
1. **Ingress Controller** — the actual component processing traffic (not built-in, must be installed separately)
2. **Ingress Resource** — the YAML object defining routing rules (hostnames, paths)

Popular Ingress Controllers:
- NGINX Ingress Controller — most widely used
- Traefik — lightweight, good for dynamic configs
- AWS ALB Ingress Controller — integrates directly with AWS Application Load Balancer
- HAProxy — high-performance, enterprise-grade

**Gateway API** — the successor to Ingress. More expressive, role-oriented (GatewayClass, Gateway, HTTPRoute), supports TCP/UDP/gRPC natively. Prefer it for new clusters.

### Storage

- **PersistentVolume (PV)** — a piece of storage provisioned by an admin in the cluster
- **PersistentVolumeClaim (PVC)** — a workload's request for storage; Kubernetes binds PVCs to PVs
- **StorageClass** — defines how storage is dynamically provisioned; `volumeBindingMode: WaitForFirstConsumer` delays provisioning until a Pod is scheduled (critical for topology-aware block storage like EBS)

Volume types:
- `emptyDir` — ephemeral, tied to the Pod's lifecycle; gone when Pod is deleted
- `hostPath` — mounts a node's filesystem directory into the container; avoid in production (node coupling)
- `PersistentVolume (PV)` — durable storage independent of Pod lifecycle
- `ConfigMap` / `Secret` — mount configuration or secrets as files

Access modes: `ReadWriteOnce` (one node), `ReadOnlyMany` (many nodes read), `ReadWriteMany` (many nodes write). Most cloud block storage (EBS, Azure Disk) is RWO only.

Example PV and PVC:
```yaml
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
  hostPath:
    path: "/mnt/data"
---
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
```

**CSI (Container Storage Interface)** — the plugin standard. Cloud providers ship CSI drivers (`aws-ebs-csi-driver`, `gcp-compute-persistent-disk-csi-driver`).

### Namespaces and Resource Quotas

Namespaces divide a cluster into logical sections — typically one per team or environment. They provide isolation boundaries for RBAC, NetworkPolicies, and ResourceQuotas.

**Resource Quota** controls resource usage at the namespace level:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
spec:
  hard:
    pods: "10"              # Maximum 10 Pods
    services: "5"           # Maximum 5 Services
    deployments: "10"       # Maximum 10 Deployments
    secrets: "15"           # Maximum 15 Secrets
    requests.cpu: "2"       # Max 2 CPU requests
    requests.memory: "4Gi"  # Max 4GB RAM requests
    limits.cpu: "4"         # Max 4 CPU limit
    limits.memory: "8Gi"    # Max 8GB RAM limit
    requests.storage: "100Gi"
```

Two types: **Computing Quota** (CPU, memory) and **Object Quota** (Pod count, Service count, etc).

### ConfigMaps and Secrets

**ConfigMaps** store non-sensitive configuration as key-value pairs. Decouple config from container images.

**Secrets** store sensitive data (passwords, tokens, keys). Base64-encoded by default — NOT encrypted. Enable `EncryptionConfiguration` for etcd encryption at rest. Better approach: External Secrets Operator pulling from AWS Secrets Manager / HashiCorp Vault.

Critical difference in updates:
- Secrets mounted as **volumes** update automatically when the Secret changes (with a short delay)
- Secrets as **environment variables** do NOT update without a Pod restart

```bash
kubectl create secret generic my-secret --from-literal=password=SuperSecret
```

### Scheduling

The scheduler assigns Pods to Nodes in two phases:
1. **Filtering** — removes nodes that don't satisfy requirements (resource requests, nodeSelectors, taints/tolerations, affinity rules)
2. **Scoring** — ranks remaining nodes (spread preference, image caching, etc.)

**Resource requests vs limits:**
- `requests` — what the scheduler reserves; Pod is only scheduled on a node with sufficient allocatable
- `limits` — the cgroup boundary; CPU limit = throttling; memory limit = OOMKill

Always set both. CPU throttling from limits can be worse than no limit for latency-sensitive apps.

**QoS classes:**
- `Guaranteed` — requests == limits for all containers; never evicted first
- `Burstable` — requests < limits; evicted before Guaranteed
- `BestEffort` — no requests/limits; evicted first

**Taints and Tolerations** — taints on nodes repel Pods without matching tolerations. Use for: dedicated GPU nodes, spot nodes, system-only workloads.

```bash
# Add a taint to a node
kubectl taint nodes <node-name> key=value:NoSchedule

# Remove a taint
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

**Topology Spread Constraints** — spread Pods across zones/nodes:
```yaml
topologySpreadConstraints:
- maxSkew: 1
  topologyKey: topology.kubernetes.io/zone
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels:
      app: myapp
```

**Pod Priority and Preemption** — define PriorityClasses to ensure critical workloads get scheduled even if it means evicting lower-priority Pods. Priority range: -2,147,483,648 to 1,000,000,000.

---

## Architecture Deep Dive

### Control Plane vs Data Plane

The control plane (API server, etcd, scheduler, controller-manager) decides WHAT should happen. The data plane (kubelet, container runtime, kube-proxy) makes it happen. A control plane outage freezes scheduling but running Pods continue running.

### etcd — The Cluster Brain

etcd is a distributed key-value store built on the Raft consensus algorithm. It holds all cluster state: Pod specs, Service definitions, Secrets, ConfigMaps, node status.

- 3-node etcd cluster: losing 2 nodes loses quorum; losing 1 = degraded but functional
- etcd requires fast disk I/O (target <10ms latency); never co-locate with high-I/O workloads
- Back up etcd daily: `etcdctl snapshot save snapshot.db`
- Restore: `etcdctl snapshot restore snapshot.db`

### Multi-Cluster vs Multi-Tenant

**Multi-tenant single cluster:** isolate via namespaces + RBAC + NetworkPolicies + ResourceQuotas. Cheaper, simpler. Risk: noisy neighbor, shared blast radius.

**Multi-cluster:** hard isolation, independent failure domains, compliance boundaries. Manage with Cluster API, ArgoCD ApplicationSets, or Flux multi-tenancy.

Staff engineer rule: one cluster per environment minimum (dev/staging/prod). Separate clusters per regulated workload or business unit when compliance requires.

### K8s vs Docker Swarm

| Feature | Kubernetes | Docker Swarm |
|---------|-----------|--------------|
| Setup complexity | Complex, more powerful | Simple, fast |
| Container runtime | Any (Docker, containerd, runc) | Docker only |
| GUI | Available (Dashboard) | Not built-in |
| Autoscaling | Built-in (HPA, VPA, Karpenter) | Not available |
| Monitoring | Built-in integrations | 3rd party only |
| Rolling updates | Controlled with scheduling guarantees | Progressive |
| Production adoption | Industry standard | Limited |

---

## Docker Commands Reference

### Image Management

```bash
# Version and info
docker --version
docker version
docker info

# Pull, list, remove images
docker pull nginx
docker pull nginx:latest
docker images
docker image ls
docker rmi <image-id>
docker rmi nginx:latest

# Build an image from Dockerfile
docker build -t myapp:latest .
docker build -t myrepo/myapp:v1 .

# Tag an image
docker tag myapp:latest myrepo/myapp:v1

# Push to registry
docker push myrepo/myapp:v1

# Save and load images (for air-gapped transfers)
docker save -o myapp.tar myapp:latest
docker load -i myapp.tar

# Inspect image details
docker inspect image myapp:v1

# Remove unused images
docker image prune
docker system prune -a   # removes all stopped containers, networks, dangling images
```

### Container Lifecycle

```bash
# Run containers
docker run nginx                              # run in foreground
docker run -d nginx                           # detached (background)
docker run -it ubuntu bash                    # interactive with terminal
docker run -d --name my-nginx -p 8080:80 nginx  # named, port-mapped
docker run --restart=always nginx             # auto-restart on failure
docker run -e APP_ENV=production myapp        # environment variable
docker run --cpus=2 -m 512m nginx             # CPU and memory limits
docker run -v my-volume:/data myapp           # mount a volume

# List containers
docker ps                   # running only
docker ps -a                # all including stopped

# Manage containers
docker stop <container-id>
docker start <container-id>
docker restart <container-id>
docker rm <container-id>    # delete stopped container
docker kill <container-id>  # force stop

# Execute commands inside a running container
docker exec -it <container-id> /bin/bash
docker exec -it <container-id> /bin/sh

# Logs
docker logs <container-id>
docker logs -f <container-id>      # follow in real-time

# Inspect container metadata
docker inspect <container-id>
docker inspect <container-id> | grep "IPAddress"

# Container stats (real-time resource usage)
docker stats

# Pause/unpause
docker pause <container-id>
docker unpause <container-id>

# Copy files from/to container
docker cp <container-id>:/path/to/file ./local-file
```

### Networking

```bash
docker network ls
docker network create my-network
docker network rm my-network
docker network connect my-network my-container
docker network disconnect my-network my-container
docker network inspect my-network

# Bind to specific network at run time
docker run -d --network=my-network --name my-app my-image

# Expose port: host:container
docker run -p 8080:80 nginx
```

**Network modes:**
- `bridge` (default) — container-to-container communication on same host
- `host` — container shares host network directly (no isolation, better performance)
- `overlay` — multi-host communication in Docker Swarm / Kubernetes
- `none` — no network access

### Volumes (Persistent Storage)

```bash
docker volume create my-volume
docker volume ls
docker volume inspect my-volume
docker volume rm my-volume

# Mount volume at run time
docker run -d -v my-volume:/data myapp

# Bind mount (maps a host directory)
docker run -d -v /host/path:/container/path myapp

# Export/import container filesystem
docker export <container-id> > my-container.tar
docker import my-container.tar my-new-image
```

**Volumes vs Bind Mounts:**
- Volumes: managed by Docker, stored in `/var/lib/docker/volumes/`; preferred for persistent data
- Bind Mounts: maps a host path directly; useful for development (live code reload)

### Dockerfile Reference

All key Dockerfile instructions:

```dockerfile
FROM ubuntu:20.04                              # base image (required first line)
LABEL maintainer="you@example.com"            # metadata
WORKDIR /usr/src/app                          # set working directory
COPY index.html /usr/share/nginx/html/        # copy files from host to image
ADD app.tar.gz /usr/src/app/                  # like COPY but extracts archives and supports URLs
RUN apt-get update && apt-get install -y nginx # run commands at build time
ENV APP_ENV=production                         # set environment variable
ARG BUILD_VERSION                              # build-time variable (not in final image)
EXPOSE 80                                      # document which port the app uses
CMD ["nginx", "-g", "daemon off;"]            # default command at container start
ENTRYPOINT ["/bin/bash", "-c"]                # fixed executable; CMD becomes its arguments
USER 1000                                     # run as non-root user
VOLUME ["/data"]                              # declare a mount point
HEALTHCHECK --interval=30s CMD curl -f http://localhost/ || exit 1
```

Key distinctions:
- `RUN` executes at **build time** (creates image layers)
- `CMD` executes at **runtime** (container start) and can be overridden with `docker run <cmd>`
- `ENTRYPOINT` executes at runtime and **cannot be easily overridden**; `CMD` becomes its arguments
- `COPY` copies files; `ADD` also extracts archives and fetches remote URLs (prefer `COPY` when you don't need those features)

### Multi-Stage Builds

Multi-stage builds keep final images small by separating build and runtime stages:

```dockerfile
# Stage 1: Build
FROM golang:1.20 AS builder
WORKDIR /app
COPY main.go .
RUN go build -o main .

# Stage 2: Runtime (minimal image)
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

Benefits: smaller final image (no compiler, no build tools), smaller attack surface, separate build and runtime environments.

### Docker Compose

```yaml
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    networks:
      - app-network
    volumes:
      - ./html:/usr/share/nginx/html
  db:
    image: postgres:14
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
```

```bash
docker compose up -d       # start in detached mode
docker compose down        # stop and remove containers
docker compose logs -f     # follow logs
docker compose ps          # list services
docker compose scale web=3 # scale service
```

---

## Kubernetes Interview Q&A

### Beginner Level

**Q1: What is Kubernetes?**
Kubernetes (K8s) is an open-source container orchestration platform that automates deployment, scaling, and management of containerised applications. Originally developed at Google from their Borg system, it was open-sourced in 2014 and donated to the CNCF.

**Q2: What are the main components of Kubernetes architecture?**
- Master Node (Control Plane): API Server, Controller Manager, Scheduler, etcd
- Worker Nodes: Kubelet, Kube-Proxy, Container Runtime (containerd)

**Q3: What is a Pod in Kubernetes?**
A Pod is the smallest deployable unit in Kubernetes. It can contain one or more containers that share the same network namespace, storage volumes, and lifecycle.

**Q4: How do you create and manage a Deployment?**
```bash
kubectl create deployment my-app --image=nginx
kubectl get deployments
kubectl describe deployment my-app
kubectl scale deployment my-app --replicas=5
kubectl set image deployment/my-app my-container=nginx:latest
kubectl rollout undo deployment my-app
kubectl delete deployment my-app
```

**Q5: What are Kubernetes Services and their types?**
Services provide stable network endpoints for Pods. Types: ClusterIP (internal only), NodePort (external via node port 30000-32767), LoadBalancer (cloud LB), ExternalName (DNS alias).

**Q6: How do you list and inspect running pods?**
```bash
kubectl get pods                        # current namespace
kubectl get pods -A                     # all namespaces
kubectl get pods -o wide                # with node details
kubectl describe pod <pod-name>         # events and details
kubectl logs <pod-name>                 # logs
kubectl logs <pod-name> -c <container>  # specific container logs
kubectl exec -it <pod-name> -- /bin/sh  # shell access
```

**Q7: What is a ConfigMap?**
A ConfigMap stores non-sensitive configuration data as key-value pairs, decoupling configuration from container images.

**Q8: What is a ReplicaSet?**
A ReplicaSet ensures a specified number of Pod replicas are running at all times. Deployments manage ReplicaSets for you — you rarely create ReplicaSets directly.

**Q9: How do you expose a deployment externally?**
```bash
kubectl expose deployment my-app --type=LoadBalancer --port=80
kubectl expose deployment my-app --type=NodePort --port=80
```

**Q10: How do you create a Kubernetes Secret?**
```bash
kubectl create secret generic my-secret --from-literal=password=SuperSecret
```

**Q11: What is a Namespace?**
A Namespace is a logical partition within a cluster. It provides scope for names, RBAC, NetworkPolicies, and ResourceQuotas. Used to isolate teams, environments, or projects.

**Q12: What are Labels and Annotations?**
Labels are key-value pairs attached to objects for selecting and organising them (used by Services, ReplicaSets, etc.). Annotations are metadata for tools and operators — not used for selection.

---

### Intermediate Level

**Q13: What is the difference between Deployment and StatefulSet?**

| Feature | Deployment | StatefulSet |
|---------|-----------|-------------|
| Application type | Stateless | Stateful |
| Pod identity | Random names | Ordered stable names (pod-0, pod-1) |
| Storage | Shared PVC or none | Dedicated PVC per Pod |
| Startup/stop order | Parallel | Sequential |
| Use cases | Web servers, APIs | Databases, Kafka, Elasticsearch |

**Q14: How does Kubernetes handle rolling updates?**
Kubernetes creates a new ReplicaSet, scales it up while scaling the old one down. `maxSurge` controls extra Pods during update; `maxUnavailable` controls how many can be down. Set `maxUnavailable: 0` for zero-downtime deployments.

```bash
kubectl set image deployment/my-app my-container=nginx:latest
kubectl rollout status deployment my-app
kubectl rollout history deployment my-app
kubectl rollout undo deployment my-app
```

**Q15: What is the difference between HPA and VPA?**
- **HPA (Horizontal Pod Autoscaler)** — scales the number of Pod replicas based on CPU, memory, or custom metrics
- **VPA (Vertical Pod Autoscaler)** — adjusts resource requests/limits of running Pods

Enable HPA:
```bash
kubectl autoscale deployment my-app --cpu-percent=50 --min=2 --max=10
```

HPA YAML:
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
        averageUtilization: 70
```

**Q16: What is a PersistentVolume (PV) and PersistentVolumeClaim (PVC)?**
- PV: a piece of storage provisioned in the cluster (by admin or dynamically via StorageClass)
- PVC: a workload's request for storage; Kubernetes binds PVCs to PVs

**Q17: What are Network Policies?**
NetworkPolicies control how Pods communicate within the cluster. They require a CNI that enforces them (Cilium, Calico — not Flannel).

Allow only frontend to reach backend on port 8080:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
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

**Q18: What is RBAC in Kubernetes?**
Role-Based Access Control restricts what users and service accounts can do. Key objects:
- `Role` — permissions within a namespace
- `ClusterRole` — permissions cluster-wide
- `RoleBinding` — binds a Role to a user/group/service account in a namespace
- `ClusterRoleBinding` — binds a ClusterRole cluster-wide

```bash
kubectl auth can-i get pods -n production
kubectl auth can-i get pods --as=jane --v=10
kubectl auth can-i delete pods --as=system:serviceaccount:default:default
kubectl auth whoami
```

**Q19: What is the role of kube-proxy?**
kube-proxy runs on every node and maintains network rules using iptables or IPVS. It implements Service virtual IPs — when a request hits the Service ClusterIP, kube-proxy routes it to a healthy Pod.

**Q20: What is Ingress and how does it differ from a Service?**
A Service exposes Pods at the network level. Ingress manages external HTTP/HTTPS access to Services, with host-based and path-based routing rules. One Ingress Controller replaces many individual LoadBalancer Services, reducing cost.

**Q21: What is a DaemonSet and when do you use it?**
A DaemonSet ensures exactly one Pod runs on each node (or matching subset). Used for: node-level monitoring (node-exporter), log collection (Fluent Bit), CNI plugin agents.

**Q22: What is the difference between a Job and a CronJob?**
- `Job` — runs one or more Pods to completion (batch processing, migrations)
- `CronJob` — schedules Jobs on a cron schedule (`concurrencyPolicy: Forbid` prevents overlapping runs)

```bash
kubectl get jobs
kubectl logs job/my-job
```

**Q23: How does Kubernetes service discovery work?**
CoreDNS resolves Service names within the cluster. Every Service gets a DNS name: `<service>.<namespace>.svc.cluster.local`. Pods can use the short form `<service>` if they are in the same namespace.

**Q24: What is Helm?**
Helm is the package manager for Kubernetes. A Helm Chart packages all Kubernetes resources (Deployments, Services, ConfigMaps) into a reusable, version-controlled unit.

```bash
helm install my-app ./my-chart
helm upgrade my-app ./my-chart
helm rollback my-app 1
helm uninstall my-app
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-db bitnami/postgresql
helm template ./my-chart    # render locally without deploying
```

Helm Chart structure:
```
my-helm-chart/
├── charts/          # subcharts
├── templates/       # Kubernetes manifests with templating
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── values.yaml      # default configuration values
└── Chart.yaml       # metadata about the chart
```

**Q25: What are Taints and Tolerations?**
Taints on nodes repel Pods that do not have a matching Toleration. Use to: dedicate GPU nodes to GPU workloads, keep system Pods on control-plane nodes, isolate spot instances.

```bash
kubectl taint nodes gpu-node gpu=true:NoSchedule
```

Toleration in Pod spec:
```yaml
tolerations:
- key: "gpu"
  operator: "Equal"
  value: "true"
  effect: "NoSchedule"
```

**Q26: What is a PodDisruptionBudget (PDB)?**
A PDB limits how many Pods of a deployment can be voluntarily disrupted (during node drains, upgrades). Without PDBs, node drains can take down your entire deployment silently.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 2   # or maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
```

Never set `minAvailable` equal to `replicas` — you will block all node drains.

**Q27: What is a Kubernetes Operator?**
An Operator = Custom Resource Definition (CRD) + Controller. The controller watches CRD instances and reconciles. Used to encode operational knowledge (failover logic, backup schedules, scaling decisions) into Kubernetes itself. Write operators when humans have a runbook for operating a system — encode that runbook in a controller.

**Q28: What is Kubernetes Federation?**
Federation (now largely replaced by multi-cluster tools like ArgoCD ApplicationSets or Cluster API) allows managing multiple Kubernetes clusters from a single control point, synchronising resources across clusters.

---

### Advanced Level

**Q29: How do you debug a Pod in CrashLoopBackOff?**
```bash
kubectl get pods                          # see status
kubectl logs <pod-name> --previous        # logs from crashed container
kubectl describe pod <pod-name>           # events and error messages
kubectl exec -it <pod-name> -- /bin/sh    # interactive shell
```

Exit code meanings:
- `137` = OOMKilled (128 + SIGKILL)
- `139` = segfault (128 + SIGSEGV)
- `1` = application crash

Temporary workaround to inspect without crashing:
```yaml
command: ["sleep", "3600"]
```

**Q30: How do you troubleshoot a Pod stuck in Pending?**
```bash
kubectl describe pod <pod-name>         # check Events section
kubectl describe node                   # check allocatable resources
kubectl get nodes --show-labels         # check node labels vs pod nodeSelector
```

Common causes: insufficient resources on nodes, taint/affinity mismatch, imagePullSecret missing.

**Q31: How do you troubleshoot a Service that is not routing traffic?**
```bash
kubectl get endpoints <svc-name>        # if empty: no ready Pods match the selector
kubectl get svc <service-name>          # verify type and port
kubectl describe networkpolicy          # check if NetworkPolicy is blocking
kubectl port-forward pod/<pod-name> 8080:80  # bypass Service for debugging
kubectl run tmp --image=busybox --rm -it -- wget -O- svc-name  # test from inside cluster
```

**Q32: How does memory management work and how do you prevent OOMKills?**
OOMKill (Out of Memory Kill) occurs when a container exceeds its memory limit. The Linux kernel's OOM Killer terminates the process. Kubernetes marks the Pod as `OOMKilled` with exit code 137.

Causes:
- Memory limits set too low
- Sudden traffic spikes
- Noisy neighbour pods consuming node memory
- Memory leaks accumulating over time
- Node-level memory exhaustion

Prevention:
- Set memory requests based on p95 actual usage (measure with VPA recommendations)
- Set memory limits at 1.2-1.5x typical usage
- Use `Guaranteed` QoS class for critical workloads (requests == limits)
- Monitor: `container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.8`
- Use LimitRange defaults per namespace as a backstop

```bash
kubectl top nodes                       # node memory usage
kubectl top pods -A --sort-by=memory    # pods consuming most memory
```

**Q33: What is the Kubernetes Cluster Autoscaler and how does it work?**
The Cluster Autoscaler adds nodes when Pods are pending due to insufficient resources and removes nodes when they are underutilised. Karpenter (AWS) is a faster alternative — it provisions nodes directly and chooses optimal instance types per workload in seconds.

**Q34: How do you perform a Kubernetes cluster upgrade with zero downtime?**
1. Check API deprecations with `pluto`
2. Audit PodDisruptionBudgets across all workloads
3. Verify admission webhook compatibility
4. Upgrade control plane first (never skip minor versions)
5. Upgrade node groups one at a time using rolling strategy
6. Drain nodes: `kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data`
7. Validate with automated test suite
8. Document rollback plan before starting

EKS example:
```bash
eksctl create cluster --name=EKS-1 --region=eu-west-1 --version=1.30 --without-nodegroup
eksctl utils associate-iam-oidc-provider --region eu-west-1 --cluster EKS-1 --approve
eksctl create nodegroup --cluster=EKS-1 --region=eu-west-1 --name=node2 --node-type=t2.medium --nodes=2
# Upgrade:
eks upgrade cluster --name EKS-1 --region eu-west-1 --version 1.31 --approve
```

**Q35: What is a Kubernetes Admission Controller?**
Admission controllers intercept API requests before objects are persisted to etcd. They validate and/or mutate objects. Examples: PodSecurity (enforce PSS), ResourceQuota enforcement, Kyverno policies, OPA/Gatekeeper.

**Q36: What is a CRD (Custom Resource Definition)?**
A CRD extends the Kubernetes API with your own resource types. Combined with a controller, it forms an Operator. Example: `kind: Kafka` managed by the Strimzi Operator.

**Q37: How does Kubernetes implement canary deployments?**
Options:
- Argo Rollouts `Canary` strategy — automated with metric analysis gate
- Flagger — works with Nginx/Istio
- Manual: two Deployments + weighted Ingress annotations
- Service mesh traffic splitting (Istio, Linkerd)

```bash
kubectl scale deployment my-app --replicas=5
```

**Q38: What is a Kubernetes Kubeconfig?**
The kubeconfig file (`~/.kube/config`) stores cluster connection details, credentials, and context definitions. Multiple contexts allow switching between clusters.

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context k8s-c1-H
kubectl config get-contexts -o name > /root/filesystem/tmp
```

**Q39: What happens when a node runs out of memory?**
kubelet evicts Pods by QoS class: BestEffort first, then Burstable (by memory usage), then Guaranteed. The Linux OOM killer can kill any process on the node. Container memory limit triggers OOMKill before node eviction. PriorityClass affects eviction ordering.

**Q40: How do you deploy a Pod on a specific node?**
```yaml
# Using nodeName (direct assignment):
spec:
  nodeName: node01

# Using nodeSelector (by label):
spec:
  nodeSelector:
    disktype: ssd

# Using node affinity (more expressive):
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disktype
            operator: In
            values: [ssd]
```

---

## Production Operations & Troubleshooting

### Critical kubectl Commands

```bash
# Cluster and node management
kubectl cluster-info
kubectl get nodes
kubectl get nodes -o wide
kubectl get nodes --show-labels
kubectl describe node <node-name>
kubectl top nodes
kubectl cordon <node-name>         # mark unschedulable
kubectl uncordon <node-name>       # mark schedulable
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl taint nodes <node-name> key=value:NoSchedule
kubectl label nodes <node-name> key=value
kubectl delete node <node-name>

# Pod operations
kubectl get pods
kubectl get pods -A
kubectl get pods -o wide
kubectl get pods --field-selector spec.nodeName=node01   # pods on specific node
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container-name>
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> -f                               # follow real-time
kubectl logs -n uat -l app=uat-app                       # logs by label
kubectl logs <pod-name> --timestamps
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec -n uat nginx -- ls
kubectl delete pod <pod-name>
kubectl delete pod --force --grace-period=0 <pod-name>   # force delete
kubectl get pod <pod-name> -o yaml

# Deployment management
kubectl get deployments
kubectl describe deployment <name>
kubectl apply -f deployment.yaml
kubectl create deployment <name> --image=<image>
kubectl rollout status deployment <name>
kubectl rollout history deployment <name>
kubectl rollout undo deployment <name>
kubectl get rs                                           # ReplicaSets
kubectl scale deployment <name> --replicas=3
kubectl delete deployment <name>

# Services and networking
kubectl get svc
kubectl get svc -A
kubectl describe svc <service-name>
kubectl get endpoints
kubectl expose deployment <name> --type=NodePort --port=80
kubectl port-forward svc/<svc-name> 8080:80
kubectl port-forward pod/<pod-name> 8080:80
kubectl proxy

# Ingress
kubectl get ingress
kubectl describe ingress <ingress-name>
kubectl delete ingress <ingress-name>

# ConfigMaps and Secrets
kubectl get configmap
kubectl describe configmap <name>
kubectl get secrets

# Resource inspection
kubectl get all -A                                      # everything in all namespaces
kubectl get -n uat deployments.apps uat-deployment -o yaml
kubectl get -n uat deployments.apps uat-deployment -o=jsonpath='{.spec.replicas}'
kubectl top pods -n uat
kubectl top pods -A --sort-by=memory

# Events and debugging
kubectl get events --sort-by=.lastTimestamp
kubectl events -n uat
kubectl auth whoami
kubectl auth can-i get pods -n uat
kubectl auth can-i --list --as=system:serviceaccount:ns:sa

# Dry run and diff
kubectl apply --dry-run=server -f manifest.yaml
kubectl diff -f manifest.yaml

# Context management
kubectl config get-contexts
kubectl config current-context
kubectl config use-context <context-name>

# Explain any resource
kubectl explain pods
kubectl explain deployments.spec
```

### Health Probes

```yaml
livenessProbe:            # restart container if fails
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:           # remove from Service endpoints if fails
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 5

startupProbe:             # for slow-starting apps; disables liveness until passes
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
```

Critical rules:
- Never make liveness probes check external dependencies — you will cause cascading restarts during downstream outages
- Readiness probe failure removes the Pod from Service endpoints before it receives traffic
- Use startupProbe for apps that take longer than 30s to start (prevents premature liveness failures)

### Rolling Update Tuning

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1           # extra Pods during update
    maxUnavailable: 0     # zero-downtime guarantee
minReadySeconds: 30       # ensure stability before proceeding
progressDeadlineSeconds: 300  # fail fast if rollout stalls
```

### Debugging Runbook

**Scenario 1: Pod Keeps Crashing (CrashLoopBackOff)**
```bash
kubectl get pods
kubectl logs <pod-name> --previous        # logs from crashed container
kubectl describe pod <pod-name>           # look at Events section
kubectl exec -it <pod-name> -- /bin/sh    # inspect if not crashing yet
```
Fix based on exit code: 137 = OOMKilled (increase memory limit), 1 = app crash (check config), 139 = segfault (bad binary).

**Scenario 2: High Traffic — Pods Failing**
```bash
kubectl scale deployment <name> --replicas=5
kubectl autoscale deployment <name> --min=2 --max=10 --cpu-percent=80
kubectl top nodes
```

**Scenario 3: Service Not Reachable**
```bash
kubectl get svc <service-name>                        # check type and ports
kubectl get endpoints <svc-name>                      # if empty: selector mismatch
kubectl describe networkpolicy                         # check NetworkPolicy
kubectl port-forward svc/<svc-name> 8080:80           # bypass for debugging
```

**Scenario 4: Persistent Volume Not Mounting**
```bash
kubectl get pvc
kubectl describe pvc <pvc-name>
kubectl describe pod <pod-name>    # look for mount-related errors
```
Check: PVC status must be Bound, StorageClass must be supported, access mode must match.

**Scenario 5: Node Unavailable**
```bash
kubectl get nodes
kubectl describe node <node-name>
# Investigate kubelet logs on the node
kubectl drain <node-name> --ignore-daemonsets --delete-local-data
```

**Scenario 6: Pod Not Getting Scheduled**
```bash
kubectl describe pod <pod-name>    # check Events — which filter eliminated which node
kubectl describe node              # check allocatable resources
kubectl get nodes --show-labels    # check labels vs nodeSelector
```

Common causes: insufficient CPU/memory, taint/affinity mismatch, image pull failure, PVC not bound.

### Common Kubernetes Errors Reference

| Error | Likely Cause | First Step |
|-------|-------------|------------|
| `CrashLoopBackOff` | App crashing on start | `kubectl logs --previous` |
| `ImagePullBackOff` | Can't pull image | Check registry access, imagePullSecrets, image name |
| `Pending` pod | No node can schedule | `kubectl describe pod` → Events |
| `OOMKilled` (exit 137) | Memory limit exceeded | Increase memory limit or fix memory leak |
| `Node NotReady` | Node has issues | `kubectl describe node`, check kubelet |
| `Evicted` pods | Node resource pressure | `kubectl top nodes`, check disk/memory |
| `Service not resolving DNS` | CoreDNS issues | Check CoreDNS pods, scale CoreDNS |
| `RBAC permission denied` | Missing Role/RoleBinding | `kubectl auth can-i` to diagnose |
| `PVC Pending` | StorageClass not found | `kubectl describe pvc`, check StorageClass |
| `Ingress 404` | No matching rules or backend down | `kubectl describe ingress`, check Service selector |
| `Ingress 502` | Backend returning errors | Check Pod logs and readinessProbe |
| `HPA not scaling` | Metrics server missing | Check metrics-server deployment |
| `context deadline exceeded` | API server unreachable or slow | Check control plane health |

### PromQL Monitoring Queries

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

---

## Hands-On Labs and Project Walkthroughs

### Lab 1: Bootstrap a Kubernetes Cluster from Scratch

Requirements: Ubuntu 22.04 LTS, 4GB RAM, 30GB storage (1 master + 2 worker nodes)

```bash
# Step 1: On ALL nodes — disable swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Step 2: Enable IP forwarding on ALL nodes
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# Step 3: Install containerd on ALL nodes
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Step 4: Install kubeadm, kubelet, kubectl on ALL nodes
sudo apt install -y kubeadm kubelet kubectl

# Step 5: Initialize control plane (MASTER ONLY)
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# Step 6: Configure kubectl (MASTER ONLY)
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Step 7: Install Flannel CNI (MASTER ONLY)
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# Step 8: Join worker nodes (run the kubeadm join command printed by kubeadm init)
# Example:
# kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>

# Step 9: Verify cluster
kubectl get nodes
kubectl cluster-info
```

### Lab 2: Deploy a Multi-Tier Application

```bash
# Create a namespace
kubectl create namespace myapp

# Deploy the application
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
EOF

# Expose the deployment
kubectl expose deployment web-app --type=LoadBalancer --port=80 -n myapp

# Scale it
kubectl scale deployment web-app --replicas=5 -n myapp

# Check status
kubectl get all -n myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
```

### Lab 3: Set Up Ingress with Path-Based Routing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: myapp
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /frontend
        pathType: Prefix
        backend:
          service:
            name: frontend-svc
            port:
              number: 80
      - path: /backend
        pathType: Prefix
        backend:
          service:
            name: backend-svc
            port:
              number: 8080
```

### Lab 4: Configure Resource Quotas and LimitRanges

```yaml
# ResourceQuota for a team namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
---
# LimitRange for default Pod resources
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-a
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
```

### Lab 5: EKS Cluster Setup and Application Deployment

```bash
# Create EKS cluster without nodegroup
eksctl create cluster --name=EKS-1 \
  --region=eu-west-1 \
  --zones=eu-west-1a,eu-west-1b \
  --version=1.30 \
  --without-nodegroup

# Associate IAM OIDC provider
eksctl utils associate-iam-oidc-provider \
  --region eu-west-1 \
  --cluster EKS-1 \
  --approve

# Create managed nodegroup
eksctl create nodegroup --cluster=EKS-1 \
  --region=eu-west-1 \
  --name=node2 \
  --node-type=t2.medium \
  --nodes=2 \
  --nodes-min=1 \
  --nodes-max=2 \
  --node-volume-size=20 \
  --ssh-access \
  --ssh-public-key=ireland \
  --managed \
  --asg-access \
  --external-dns-access \
  --full-ecr-access \
  --alb-ingress-access

# Upgrade EKS cluster version
eksctl upgrade cluster --name EKS-1 --region eu-west-1 --version 1.31 --approve
```

### Lab 6: Scenario — Pod on Specific Node with Taints

```bash
# Create namespace and pod
kubectl create ns limit

# Deploy resource-constrained pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  namespace: limit
  labels:
    run: resource-checker
  name: resource-checker
spec:
  containers:
  - image: httpd:alpine
    name: my-container
    resources:
      requests:
        memory: "30Mi"
        cpu: "30m"
      limits:
        memory: "30Mi"
        cpu: "300m"
  dnsPolicy: ClusterFirst
  restartPolicy: Always
EOF

# Deploy pod on a specific node, removing taint first
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: pod1
  name: pod1
spec:
  nodeName: controlplane
  containers:
  - image: httpd:2.4.41-alpine
    name: pod1-container
  dnsPolicy: ClusterFirst
  restartPolicy: Always
EOF
```

---

## Staff/Principal Level Patterns

### Platform Design Principles

**Node group strategy:** multiple node groups — general-purpose, compute-optimized, GPU, and spot/preemptible (with tolerations). Never put stateful workloads on spot nodes.

**Label taxonomy:** enforce `app`, `team`, `env`, `version`, `tier` labels on all workloads via Kyverno. This powers cost allocation, alerting routing, and network policies at scale.

**API server access:** never expose to the public internet. Use VPN, bastion, or SSO-integrated proxy (Teleport, Boundary) for kubectl access.

**Ingress strategy:** one ingress controller per cluster for external traffic; internal traffic via Gateway API or service mesh. Avoid proliferating load balancers.

### Security Hardening

**RBAC principles:**
- Never bind `cluster-admin` to application service accounts
- Create a ServiceAccount per workload, not per namespace
- Audit quarterly: `kubectl auth can-i --list --as=system:serviceaccount:ns:sa`
- Remove unused ClusterRoleBindings: inspect with `kubectl get clusterrolebinding -o json | jq`

**Pod Security Standards** at namespace level:
```yaml
labels:
  pod-security.kubernetes.io/enforce: restricted
  pod-security.kubernetes.io/warn: restricted
```

**Network Policies — default deny:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```
Then whitelist only needed traffic. Requires Cilium or Calico (not Flannel).

**Secrets management (never store raw Secrets in Git):**
1. External Secrets Operator — pull from AWS Secrets Manager / GCP Secret Manager / Vault
2. Sealed Secrets (Bitnami) — encrypt in Git, decrypt in cluster
3. CSI Secrets Store Driver — mount secrets directly from Vault as volumes

**Supply chain security:**
- Sign images with Cosign (Sigstore)
- Scan images in CI with Trivy or Grype
- Enforce signed images via Kyverno policy
- Generate SBOMs (CycloneDX/SPDX)
- SLSA framework for build provenance

**Policy enforcement with Kyverno:**
- Require specific labels on all Pods
- Block `latest` image tags
- Enforce read-only root filesystem
- Verify Cosign image signatures

### Autoscaling Stack

- **HPA** — scales Pod replicas on CPU/memory or custom metrics
- **VPA** — right-sizes resource requests based on actual usage (use in recommendation mode first, not auto mode)
- **KEDA** — event-driven autoscaling on Kafka lag, SQS depth, Prometheus metrics, cron schedules
- **Cluster Autoscaler** — adds/removes nodes based on pending Pods
- **Karpenter** (AWS) — provisions nodes directly, chooses optimal instance type per workload, seconds faster than Cluster Autoscaler

### GitOps Directory Structure

```
clusters/
  production/
    apps/           # Helm releases or Kustomize overlays per team
    infrastructure/ # cluster-level add-ons (cert-manager, external-dns, etc.)
  staging/
    ...
```

ArgoCD + Kustomize for in-house apps; Helm for third-party software. Both ArgoCD and Flux provide audit trails and drift detection.

### Capacity Planning

1. Measure actual usage via VPA recommendations over 2-4 weeks
2. Set requests at p95 usage, limits at 1.5-2x requests for CPU, 1.2x for memory
3. Target 60-70% average cluster utilisation (headroom for spikes and autoscaling delay)
4. Use bin-packing simulation before adding nodes — often reshuffling fills gaps

### Failure Mode Playbook

**etcd quorum loss:**
- Signal: API server returns 500s, all mutations fail, cluster frozen
- Recovery: `etcdctl snapshot restore`
- Prevention: dedicated etcd nodes, monitor disk I/O (<10ms), daily snapshots

**Cascading OOMKill:**
- Signal: multiple Pods restarting, node memory pressure, eviction notices
- Debug: `kubectl top nodes && kubectl top pods -A --sort-by=memory`
- Prevention: LimitRange defaults, ResourceQuota caps, VPA recommendations

**DNS resolution failure:**
- Signal: intermittent "connection refused" on Service names
- Root cause: CoreDNS overloaded; `ndots:5` causing 5 DNS lookups per hostname
- Fix: scale CoreDNS to 2+ replicas + HPA; set `ndots: 2`; NodeLocal DNSCache

**Node NotReady cascade:**
- Signal: node goes NotReady, Pods become Unknown, evicted, cluster short on capacity
- Prevention: overprovisioner DaemonSet holding spare capacity; Karpenter tuned to add nodes early
- Response: `kubectl cordon <node>`, drain, investigate with `kubectl describe node`

**Image pull backoff at scale:**
- Causes: Docker Hub rate limiting (100 pulls/6h per IP), registry down, expired credentials
- Prevention: pull-through cache (Harbor, ECR Public mirroring), cluster-scoped imagePullSecrets

### Design Questions — Staff Level Answers

**"Design a multi-tenant Kubernetes platform for 50 engineering teams"**
Namespace-per-team, RBAC per team, NetworkPolicies default-deny, ResourceQuotas, LimitRanges, separate node groups per tier, Kyverno for policy enforcement, GitOps-based namespace provisioning with ArgoCD ApplicationSets, cost showback via label-based billing.

**"How do you handle a Kubernetes cluster upgrade with zero downtime?"**
PDB audit first, API deprecation check with `pluto`, webhook compatibility review, canary upgrade of one non-critical node group, validate with automated test suite, document rollback plan before starting.

**"Explain Kubernetes networking from a Service hit to Pod response"**
DNS (CoreDNS) resolves Service name → ClusterIP VIP → iptables/IPVS on node (kube-proxy) routes to Pod IP → CNI (Flannel/Calico) routes across nodes → eBPF bypass with Cilium (no iptables, better performance and observability).

**"When StatefulSet vs Deployment?"**
StatefulSet when you need: stable Pod hostname for peer discovery, ordered rolling updates, per-Pod PVCs. Not just "for databases" — understand the operational implications (slower upgrades, riskier rollbacks, manual PVC cleanup on scale-down).

**"What happens when a node runs out of memory?"**
kubelet evicts Pods by QoS class: BestEffort first, then Burstable (ordered by memory usage), then Guaranteed. Linux OOM killer can kill any process. Container memory limit triggers OOMKill before node eviction. PriorityClass affects eviction ordering.

---

## Key Takeaways

1. **Set resource requests on everything** — the scheduler is blind without them; missing requests cause random evictions
2. **Memory limits = OOMKill boundary** — set at 1.2x typical; CPU limits = throttling (sometimes better unset for latency-sensitive apps)
3. **Readiness probes protect users** — a not-ready Pod is removed from Service endpoints before traffic hits it
4. **Liveness probes must only check the app itself** — external dependency checks cascade into cluster-wide restarts during downstream incidents
5. **PodDisruptionBudgets are mandatory** — without them, node drains silently take down your entire deployment
6. **Network Policies default-deny** — "allow all" is a lateral movement playground; enforce default-deny per namespace from day one
7. **RBAC: least privilege always** — audit quarterly, remove unused bindings, never cluster-admin for app service accounts
8. **GitOps everything** — if it is not in Git it will drift; manual kubectl applies are the enemy of reproducibility
9. **etcd is your most critical dependency** — back it up, monitor disk latency, never co-locate with high-I/O workloads
10. **Topology spread constraints > pod anti-affinity at scale** — required anti-affinity fails when replicas exceed node count
11. **CNI choice determines capabilities** — Cilium with eBPF unlocks NetworkPolicies, observability, and performance that Flannel cannot
12. **VPA for right-sizing, HPA for scaling, Karpenter for node provisioning** — each addresses a different timescale of elasticity
13. **Namespace-per-team is the standard isolation boundary** — gives RBAC, NetworkPolicy, and ResourceQuota scopes cleanly
14. **Image scanning in CI is non-negotiable** — do not wait until admission time; fail builds on critical CVEs
15. **Multi-stage Docker builds are production standard** — compile in a full SDK image, copy only the binary into a minimal runtime image
16. **Never store Secrets in Git** — use External Secrets Operator, Sealed Secrets, or CSI Secrets Store
17. **Always test upgrades in staging first** — never skip minor Kubernetes versions; check API deprecations with `pluto` before upgrading

---
