---
title: "Beginner"
sidebar_position: 1
---

# Kubernetes & Containers — Beginner

## What is Kubernetes?

Kubernetes (K8s) is an open-source container orchestration platform that automates the deployment, scaling, and management of containerized applications. Originally developed by Google as an internal system called **Borg**, it was released as open source in 2014 and donated to the Cloud Native Computing Foundation (CNCF).

### Why Kubernetes?

| Benefit | Description |
|---|---|
| Efficient Resource Usage | Optimizes hardware and cloud costs |
| Environment Consistency | Dev, test, and production parity |
| Scalability | Auto-scales workloads up or down |
| Self-Healing | Replaces failed containers automatically |
| Security & Compliance | RBAC and Secrets management built in |

---

## Core Kubernetes Architecture

### Control Plane (Master Node)

- **API Server** — Entry point for all cluster communication; handles REST requests
- **etcd** — Distributed key-value store holding all cluster state and config
- **Scheduler** — Assigns new pods to nodes based on available resources
- **Controller Manager** — Ensures the actual cluster state matches the desired state

### Worker Nodes

- **Kubelet** — Agent on each node; ensures containers run as specified in Pod specs
- **Kube-Proxy** — Maintains network rules on each node for service routing
- **Container Runtime** — Runs containers (containerd, CRI-O, or Docker)

---

## Core Kubernetes Objects

### Pod

The smallest deployable unit in Kubernetes. A Pod can hold one or more containers that share the same network namespace and storage.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: nginx
      image: nginx:latest
      ports:
        - containerPort: 80
```

```bash
kubectl apply -f pod.yaml
kubectl get pods
kubectl describe pod my-pod
kubectl delete pod my-pod
```

### Deployment

Manages a set of identical Pod replicas. Handles rolling updates and rollbacks automatically.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:latest
          ports:
            - containerPort: 80
```

```bash
kubectl create deployment my-app --image=nginx
kubectl get deployments
kubectl scale deployment my-app --replicas=5
kubectl rollout status deployment my-app
kubectl rollout undo deployment my-app
```

### Service

Provides a stable network endpoint to expose Pods. Types:

| Type | Access | Use Case |
|---|---|---|
| ClusterIP | Internal only | Microservice communication |
| NodePort | External via node port (30000-32767) | Dev/debug access |
| LoadBalancer | External via cloud LB | Public-facing production apps |
| ExternalName | Maps to external DNS | Proxy to external services |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: ClusterIP
```

```bash
kubectl expose deployment my-app --type=LoadBalancer --port=80
kubectl get svc
kubectl describe svc my-service
```

**Important:** `port` is what callers use; `targetPort` is where the container actually listens. Wrong `targetPort` creates silent traffic failures.

### ConfigMap

Stores non-sensitive configuration data as key-value pairs.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: production
  LOG_LEVEL: info
  DB_HOST: postgres.default.svc.cluster.local
```

```bash
kubectl create configmap app-config --from-literal=APP_ENV=production
kubectl get configmap app-config -o yaml
```

### Secret

Stores sensitive data (passwords, tokens, keys) as base64-encoded values.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
data:
  password: U3VwZXJTZWNyZXQ=   # base64 encoded
```

```bash
kubectl create secret generic my-secret --from-literal=password=SuperSecret
kubectl get secret my-secret -o yaml
```

---

### Desired State And Reconciliation

Kubernetes is best understood as a **desired-state control system**. You declare what should exist, and Kubernetes continuously tries to make reality match.

```text
Desired state -> control loops -> actual running workloads
```

If the desired replica count is 3 and the actual count is 2, a controller creates another Pod. This loop runs for every controller: Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, and custom operators.

Practical implications:

- `kubectl apply` writes desired state, it does not run a one-shot script.
- A workload that "disappears" usually means a controller decided to delete it (rollout, scale, eviction).
- Drift between Git and the cluster is the GitOps problem — solved by Argo CD / Flux re-reconciling.

---

## Memory Palace: Kubernetes Is A City

Use this analogy when stuck on what a component does. When something breaks, ask: is the problem in government, building, roads, apartments, storage, or the public phone system?

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

---

## Pods Are Ephemeral — Treat Them As Replaceable

A Pod is the smallest deployable unit. Usually one application container, sometimes helper sidecars. Pods are not pets:

- they can die
- they can be recreated
- they can move to another node
- their IP can change

Never depend on a specific Pod IP or Pod name from outside. Use a Service for stable access. State that needs to survive a Pod restart must live in a PersistentVolume, external database, or object store.

Containers in the same Pod share:

- IP address
- port space
- localhost
- network interfaces
- mounted volumes (if mounted into both)

This means two containers in the same Pod **cannot bind the same port**.

---

## Ingress (City Gate) — Where External HTTP Enters

```text
Internet -> Cloud Load Balancer -> Ingress Controller -> Service -> Pod
```

Ingress commonly handles:

- hostnames (multiple sites on one IP)
- paths (`/api` vs `/static`)
- TLS termination
- routing to Services

You need an Ingress Controller running (NGINX, Traefik, AWS ALB controller, GCP GCE controller, etc.) for an `Ingress` object to do anything. The object on its own is just configuration.

### Ingress Rule Types

- **Path-based routing** — `example.com/api` goes to the API service, `example.com/static` goes to the static file service
- **Host-based routing** — `api.example.com` goes to one service, `app.example.com` goes to another
- **SSL termination** — Ingress manages TLS certs and forwards plain HTTP to backend services

---

## Deployment Hierarchy

```text
Deployment -> ReplicaSet -> Pods
```

A Deployment manages ReplicaSets. Each rollout creates a new ReplicaSet; the old one is scaled down. This is why `kubectl rollout undo` works: the previous ReplicaSet is still around.

A Deployment gives you:

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

## Service Discovery And Endpoints

A Service selects Pods using **labels**. If the Service's selector does not match Pod labels, the Service has no useful backend — traffic is dropped.

The mechanism:

1. Service `selector: { app: api }` is defined.
2. Pods with label `app: api` and `Ready: True` are added to the Service's `EndpointSlice`.
3. `kube-proxy` (or eBPF/Cilium) translates ClusterIP traffic to one of those endpoints.

```bash
kubectl get svc
kubectl describe svc api
kubectl get endpointslice -l kubernetes.io/service-name=api
```

Common outage: **Service exists but has no endpoints**. Causes:

- selector mismatch (typo, wrong namespace label)
- Pods not Ready (readiness probe failing)
- Pods terminating

---

## kubectl Essentials — What Each Verb Actually Answers

| Command | What it answers |
|---|---|
| `kubectl get` | What objects exist right now |
| `kubectl describe` | Details + recent Events |
| `kubectl logs` | What the app printed |
| `kubectl logs --previous` | What the app printed before the last crash |
| `kubectl exec` | Shell into a running container |
| `kubectl get events` | What the cluster tried to do |

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

A senior reflex: when in doubt, run `kubectl describe` and read the Events section before opening logs. Events tell you what Kubernetes itself observed.

---

## The Linux Connection (Why Linux Knowledge Matters)

Kubernetes desired state becomes Linux reality on each node.

| Kubernetes | Linux underneath |
|---|---|
| Pod | namespaces (pid, net, mnt, uts, ipc) |
| requests/limits | cgroups |
| Service | iptables / IPVS / eBPF |
| volume | mounts / filesystems |
| container | process |
| node pressure | CPU / memory / disk pressure |

Weak Linux knowledge limits Kubernetes troubleshooting. When `kubectl describe` shows no clear cause, the answer is often in `journalctl -u kubelet`, `dmesg`, `iptables-save`, `conntrack`, or `df`.

---

## Container Lifecycle Thinking

```text
build -> push -> pull -> run -> observe -> stop -> remove
```

Reliability depends on every stage, not only `docker run` / `kubectl apply`. Common production failures map to lifecycle stages:

- **build**: secrets leaked into image layers, wrong base image arch
- **push**: registry auth, rate limits
- **pull**: ImagePullBackOff, missing imagePullSecrets
- **run**: PID 1 signal handling, missing config
- **observe**: no logs / no metrics, can't tell what's wrong
- **stop**: SIGTERM ignored, slow shutdown, hanging child processes

A container's writable layer is **ephemeral**. Never treat it as durable production storage — use volumes.

### Container Lifecycle States

A container moves through distinct states:

| State | Meaning |
|---|---|
| Created | Container created but not yet started |
| Running | Container is actively executing processes |
| Paused | Container processes are suspended (SIGSTOP) |
| Stopped | Container processes terminated |
| Deleted | Container removed from the system |

---

## Namespaces

Namespaces divide a cluster into logical sections for different teams or environments.

```bash
kubectl get namespaces
kubectl create namespace staging
kubectl get pods -n staging
kubectl config set-context --current --namespace=staging
```

**Why not use `default`?** The default namespace gets crowded. In a shared cluster, every team's resources mix together — making RBAC, quotas, and network policy all harder to manage. Always use named namespaces in production.

---

## Docker Basics

### What is Docker?

Docker is a platform for building, shipping, and running applications in **containers** — lightweight, portable, isolated environments that package an application together with its dependencies.

**Key analogy:**
- Docker image = recipe (blueprint)
- Docker container = the running dish (instance)
- Docker = the kitchen (runtime)

A container is not a VM. It is a Linux process isolated with namespaces and limited with cgroups. Containers share the host kernel.

### Docker vs Virtual Machines

| Feature | Docker | Virtual Machine |
|---|---|---|
| OS | Shares host kernel | Full guest OS per VM |
| Startup time | Seconds | Minutes |
| Size | MBs | GBs |
| Isolation | Process-level (namespaces + cgroups) | Hardware-level (hypervisor) |
| Performance | Near-native | Overhead from hypervisor |

### Docker Architecture

- **Docker Engine** — Core daemon that builds and runs containers
- **Docker CLI** — Command-line interface for issuing commands
- **Docker Daemon** — Background process that manages images, containers, networks
- **Docker Registry** — Storage for images (Docker Hub is the public default)
- **Docker Images** — Read-only templates used to create containers
- **Docker Containers** — Running instances of images

### Basic Docker Commands

```bash
# Version and info
docker version
docker info

# Images
docker pull nginx                        # Pull from registry
docker images                            # List local images
docker build -t myapp:latest .           # Build from Dockerfile
docker rmi nginx                         # Remove image
docker tag myapp:latest myrepo/myapp:v1  # Tag image

# Containers
docker run nginx                         # Create and start container
docker run -d nginx                      # Run in detached mode
docker run -it ubuntu bash               # Run interactively
docker run -p 8080:80 nginx              # Map host port to container port
docker run --name my-nginx -d nginx      # Named container
docker run -e APP_ENV=production myapp   # Pass environment variable
docker run --cpus=2 -m 512m nginx        # CPU/memory limits
docker run --restart=always nginx        # Auto-restart on failure
docker ps                                # List running containers
docker ps -a                             # List all containers
docker stop my-nginx                     # Stop container
docker start my-nginx                    # Start stopped container
docker restart my-nginx                  # Restart container
docker rm my-nginx                       # Remove container
docker exec -it my-nginx bash            # Shell into running container
docker logs my-nginx                     # View container logs
docker logs -f my-nginx                  # Follow logs
docker inspect my-nginx                  # Detailed container info
docker stats                             # Live CPU/memory per container
docker cp my-nginx:/path/file ./         # Copy file out of container
```

### Dockerfile Instructions

| Instruction | Purpose |
|---|---|
| `FROM` | Base image (every Dockerfile starts with this) |
| `WORKDIR` | Set working directory for subsequent commands |
| `COPY` | Copy files from host to container |
| `ADD` | Like COPY; also extracts archives and supports URLs |
| `RUN` | Execute commands at build time |
| `CMD` | Default command at runtime (can be overridden) |
| `ENTRYPOINT` | Fixed executable at runtime (cannot be overridden easily) |
| `EXPOSE` | Document which port the container listens on |
| `ENV` | Set environment variables (persist at runtime) |
| `ARG` | Build-time variables (not available at runtime) |
| `LABEL` | Add metadata to image |
| `HEALTHCHECK` | Define a command to check container health |

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**CMD vs ENTRYPOINT:**
- `CMD` can be overridden when running the container (`docker run myapp custom-command`)
- `ENTRYPOINT` always executes; `CMD` becomes default arguments to it

### Docker Networking

```bash
docker network ls                                    # List networks
docker network create my-network                     # Create network
docker network connect my-network my-container       # Connect container
docker network disconnect my-network my-container    # Disconnect
docker network inspect my-network                    # Inspect network
docker network rm my-network                         # Remove network
```

**Network types:**
- **Bridge** — Default; containers on same host communicate via a virtual bridge
- **Host** — Container shares host network stack directly (no port mapping needed)
- **Overlay** — Multi-host communication (Docker Swarm / Kubernetes)
- **Macvlan** — Container gets a MAC address and appears as a physical device on the network
- **None** — No networking (fully isolated container)

### Docker Volumes

```bash
docker volume create my-volume           # Create volume
docker volume ls                         # List volumes
docker volume inspect my-volume          # Inspect volume
docker volume rm my-volume               # Remove volume
docker run -v my-volume:/data nginx      # Mount named volume
docker run -v /host/path:/container/path nginx  # Bind mount
```

**Volumes vs Bind Mounts:**

| Feature | Named Volume | Bind Mount |
|---|---|---|
| Managed by | Docker (`/var/lib/docker/volumes`) | Host filesystem path |
| Portability | High — works on any Docker host | Low — depends on host path existing |
| Use case | Databases, persistent app state | Config injection, code sharing in dev |
| Backup | Via `docker run --volumes-from` | Copy the host directory |

---

## Basic kubectl Commands

```bash
# Cluster info
kubectl cluster-info
kubectl get nodes
kubectl get nodes -o wide

# Pods
kubectl get pods
kubectl get pods -A                  # All namespaces
kubectl get pods -o wide             # With node info
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- /bin/sh
kubectl delete pod <pod-name>

# Deployments
kubectl get deployments
kubectl describe deployment <name>
kubectl apply -f deployment.yaml
kubectl delete deployment <name>

# Services
kubectl get svc
kubectl describe svc <name>

# Namespaces
kubectl get ns
kubectl create ns <name>
kubectl delete ns <name>

# Get YAML
kubectl get pod <name> -o yaml
kubectl get deployment <name> -o json
```
