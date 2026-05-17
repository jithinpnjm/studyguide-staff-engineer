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
