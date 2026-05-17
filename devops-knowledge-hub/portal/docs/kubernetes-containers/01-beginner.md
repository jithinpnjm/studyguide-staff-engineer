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
- **Container Runtime** — Runs containers (Docker, containerd, CRI-O)

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
| NodePort | External via node port | Dev/debug access |
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

## Namespaces

Namespaces divide a cluster into logical sections for different teams or environments.

```bash
kubectl get namespaces
kubectl create namespace staging
kubectl get pods -n staging
kubectl config set-context --current --namespace=staging
```

---

## Docker Basics

### What is Docker?

Docker is a platform for building, shipping, and running applications in **containers** — lightweight, portable, isolated environments that package an application together with its dependencies.

**Key analogy:**
- Docker image = recipe (blueprint)
- Docker container = the running dish (instance)
- Docker = the kitchen (runtime)

### Docker vs Virtual Machines

| Feature | Docker | Virtual Machine |
|---|---|---|
| OS | Shares host kernel | Full guest OS per VM |
| Startup time | Seconds | Minutes |
| Size | MBs | GBs |
| Isolation | Process-level | Hardware-level |
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
docker ps                                # List running containers
docker ps -a                             # List all containers
docker stop my-nginx                     # Stop container
docker start my-nginx                    # Start stopped container
docker restart my-nginx                  # Restart container
docker rm my-nginx                       # Remove container
docker exec -it my-nginx bash            # Shell into running container
docker logs my-nginx                     # View container logs
docker inspect my-nginx                  # Detailed container info
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
| `ENTRYPOINT` | Fixed executable at runtime (cannot be overridden) |
| `EXPOSE` | Document which port the container listens on |
| `ENV` | Set environment variables |
| `ARG` | Build-time variables (not available at runtime) |
| `LABEL` | Add metadata to image |

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

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
- **Bridge** — Default; containers communicate on the same host
- **Host** — Container shares host network directly
- **Overlay** — Multi-host communication (Docker Swarm)
- **None** — No networking

### Docker Volumes

```bash
docker volume create my-volume           # Create volume
docker volume ls                         # List volumes
docker volume inspect my-volume          # Inspect volume
docker volume rm my-volume               # Remove volume
docker run -v my-volume:/data nginx      # Mount volume
docker run -v /host/path:/container/path nginx  # Bind mount
```

**Volumes vs Bind Mounts:**
- **Volumes** — Managed by Docker, stored in `/var/lib/docker/volumes`
- **Bind Mounts** — Maps a specific host path directly into the container

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
