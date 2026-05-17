---
title: "Hands-On Labs"
sidebar_position: 5
---

# Kubernetes & Containers — Hands-On Labs

Each lab below is a self-contained walkthrough you can run end-to-end. They progress from bootstrapping a cluster from scratch up to production EKS deployments.

---

## Lab 1: Bootstrap a Kubernetes Cluster from Scratch (kubeadm)

**Goal:** Stand up a 3-node cluster (1 control plane + 2 workers) on Ubuntu 22.04.

**Prerequisites:** 3 VMs each with ≥4 GB RAM, 30 GB disk, network connectivity.

### Step 1 — Disable swap on ALL nodes
Kubelet refuses to start if swap is enabled.

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### Step 2 — Enable IP forwarding on ALL nodes

```bash
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
```

### Step 3 — Install containerd on ALL nodes

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo systemctl enable --now containerd
```

### Step 4 — Install kubeadm, kubelet, kubectl on ALL nodes

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl
sudo apt-get install -y kubeadm kubelet kubectl
sudo apt-mark hold kubeadm kubelet kubectl
```

### Step 5 — Initialize the control plane (MASTER ONLY)

```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

Copy the `kubeadm join …` line printed at the end — workers need it.

### Step 6 — Configure kubectl (MASTER ONLY)

```bash
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

### Step 7 — Install Flannel CNI (MASTER ONLY)

```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

Wait until `kubectl get pods -n kube-system` shows `kube-flannel-*` Running.

### Step 8 — Join workers (run on EACH WORKER)

```bash
sudo kubeadm join <MASTER-IP>:6443 \
  --token <TOKEN> \
  --discovery-token-ca-cert-hash sha256:<HASH>
```

### Step 9 — Verify

```bash
kubectl get nodes
kubectl cluster-info
kubectl get pods -A
```

All nodes should report `Ready`.

---

## Lab 2: Deploy a Multi-Tier Application

**Goal:** Deploy an nginx web tier with probes, resource limits, and a LoadBalancer.

```bash
kubectl create namespace myapp
```

```yaml
# web-app.yaml
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
```

```bash
kubectl apply -f web-app.yaml
kubectl expose deployment web-app --type=LoadBalancer --port=80 -n myapp
kubectl scale deployment web-app --replicas=5 -n myapp

# Verify
kubectl get all -n myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
```

---

## Lab 3: Ingress with Path-Based Routing

**Goal:** Route `/frontend` and `/backend` from a single hostname through one NGINX Ingress Controller.

```bash
# Install the controller (kind / generic baremetal)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

```yaml
# ingress.yaml
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

```bash
kubectl apply -f ingress.yaml
kubectl get ingress -n myapp
```

Test:

```bash
curl -H "Host: myapp.example.com" http://<INGRESS-IP>/frontend
curl -H "Host: myapp.example.com" http://<INGRESS-IP>/backend
```

---

## Lab 4: ResourceQuota + LimitRange for a Team Namespace

**Goal:** Cap a team's namespace so a single tenant cannot starve the cluster, and give every Pod sane defaults.

```yaml
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

```bash
kubectl create ns team-a
kubectl apply -f quota.yaml
kubectl describe quota team-quota -n team-a
kubectl describe limitrange default-limits -n team-a
```

Try to over-allocate — Pods will be rejected at admission time.

---

## Lab 5: Provision an EKS Cluster with eksctl

**Goal:** Production-style EKS bootstrap with OIDC, managed node groups, and an upgrade path.

```bash
# Create EKS control plane only (no nodegroup yet)
eksctl create cluster --name=EKS-1 \
  --region=eu-west-1 \
  --zones=eu-west-1a,eu-west-1b \
  --version=1.30 \
  --without-nodegroup

# Associate IAM OIDC provider (required for IRSA — service accounts assuming IAM roles)
eksctl utils associate-iam-oidc-provider \
  --region eu-west-1 \
  --cluster EKS-1 \
  --approve

# Create a managed node group
eksctl create nodegroup --cluster=EKS-1 \
  --region=eu-west-1 \
  --name=node2 \
  --node-type=t3.medium \
  --nodes=2 \
  --nodes-min=1 \
  --nodes-max=4 \
  --node-volume-size=20 \
  --ssh-access \
  --ssh-public-key=ireland \
  --managed \
  --asg-access \
  --external-dns-access \
  --full-ecr-access \
  --alb-ingress-access

# Confirm
kubectl get nodes
eksctl get cluster --region eu-west-1

# Upgrade to next minor version (control plane first, then node groups)
eksctl upgrade cluster --name EKS-1 --region eu-west-1 --version 1.31 --approve
```

Never skip minor versions. Validate API deprecations with `pluto detect-helm` or `pluto detect-files` first.

---

## Lab 6: Pod Pinning with Taints and Tolerations

**Goal:** Schedule a Pod onto the control-plane node by removing its default taint, then schedule a resource-constrained Pod via direct `nodeName`.

```bash
kubectl create ns limit
```

```yaml
# resource-checker.yaml
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
```

```bash
kubectl apply -f resource-checker.yaml
```

Now remove the control-plane taint so we can target it directly:

```bash
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

```yaml
# pod-on-controlplane.yaml
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
```

```bash
kubectl apply -f pod-on-controlplane.yaml
kubectl get pod pod1 -o wide
```

When done, restore the taint so workloads stay off the control plane:

```bash
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane=:NoSchedule
```

---

## Lab 7: Rolling Update with Zero Downtime

**Goal:** Configure a Deployment so traffic never drops during image updates.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zerodown-app
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  minReadySeconds: 30
  progressDeadlineSeconds: 300
  selector:
    matchLabels:
      app: zerodown-app
  template:
    metadata:
      labels:
        app: zerodown-app
    spec:
      containers:
      - name: app
        image: nginx:1.25
        readinessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
        lifecycle:
          preStop:
            exec:
              command: ["sh", "-c", "sleep 10"]   # drain time
```

```bash
kubectl apply -f zerodown.yaml
kubectl set image deployment/zerodown-app app=nginx:1.27
kubectl rollout status deployment/zerodown-app
kubectl rollout history deployment/zerodown-app
kubectl rollout undo deployment/zerodown-app          # rollback
```

`maxUnavailable: 0` guarantees no Pod is taken down before a replacement is Ready. `preStop` + `terminationGracePeriodSeconds` gives in-flight connections time to drain.

---

## Lab 8: HPA + Stress Test

**Goal:** Auto-scale a deployment under CPU load and watch HPA react.

```bash
# Ensure metrics-server is installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Deployment + Service
kubectl create deployment php-apache --image=registry.k8s.io/hpa-example
kubectl set resources deployment php-apache --requests=cpu=200m --limits=cpu=500m
kubectl expose deployment php-apache --port=80

# Create HPA
kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=10

# Generate load
kubectl run -it --rm load-generator --image=busybox /bin/sh
# inside:
while true; do wget -q -O- http://php-apache; done

# In another terminal
watch kubectl get hpa,deploy
```

You will see replicas climb as CPU rises. Stop the load and HPA scales back down (default 5-minute stabilization window).

---

## Lab 9: PersistentVolume + StatefulSet (Postgres)

**Goal:** Run a single-replica Postgres with a dynamically provisioned PVC.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
  - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16
        env:
        - name: POSTGRES_PASSWORD
          value: changeme
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 5Gi
```

```bash
kubectl apply -f postgres-statefulset.yaml
kubectl get sts,pvc,pv
kubectl exec -it postgres-0 -- psql -U postgres -c "SELECT version();"
```

Delete the StatefulSet (`kubectl delete sts postgres`) — the PVC and PV remain, which is intentional. Recreate the StatefulSet and the same data is reattached.

---

## Lab 10: NetworkPolicy Default-Deny

**Goal:** Lock down a namespace so only explicitly allowed Pods can communicate.

```yaml
# 1. Deny everything
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: secure-ns
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# 2. Allow frontend → backend on port 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: secure-ns
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
---
# 3. Allow DNS egress (required for nearly every workload)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: secure-ns
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

Requires Cilium or Calico — Flannel does not enforce NetworkPolicy.

```bash
kubectl apply -f netpol.yaml
# Try a forbidden connection:
kubectl run tester --rm -it -n secure-ns --image=busybox -- wget -O- backend:8080
# It will hang until timeout — proving the policy works.
```

---

## Lab 11: Helm Chart for an Internal Service

**Goal:** Package an internal app as a Helm chart and install it.

```bash
helm create my-app
tree my-app/
# my-app/
# ├── Chart.yaml
# ├── values.yaml
# ├── templates/
# │   ├── deployment.yaml
# │   ├── service.yaml
# │   └── ingress.yaml
```

```bash
# Render locally without applying
helm template ./my-app

# Install
helm install my-app ./my-app --namespace apps --create-namespace

# Upgrade with new values
helm upgrade my-app ./my-app -f production-values.yaml

# Rollback
helm history my-app
helm rollback my-app 1

# Uninstall
helm uninstall my-app -n apps
```

---

## Lab 12: GitOps with ArgoCD (Sync from a Git Repo)

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Port-forward the UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

Create an Application that watches a Git repo:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  destination:
    namespace: my-app
    server: https://kubernetes.default.svc
  project: default
  source:
    repoURL: https://github.com/your-org/k8s-manifests
    targetRevision: main
    path: my-app/overlays/production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```bash
kubectl apply -f argocd-app.yaml
argocd app sync my-app
argocd app get my-app
```

Now any commit to `main` reconciles the cluster — manual `kubectl apply` is no longer needed.

---

## Lab 13: Debug A Pod That Is Running But Its Service Returns No Traffic

**Goal:** Diagnose a Service with no endpoints — the canonical "everything looks fine but nothing works" production scenario.

**Production context:** An ML inference endpoint started returning connection errors. Three pods are Running. No recent deploys. Find why traffic is not reaching the pods.

**Setup the broken scenario:**

```bash
kubectl create namespace sre-lab || true

cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentiment-api
  namespace: sre-lab
spec:
  replicas: 3
  selector:
    matchLabels: { app: sentiment-api, version: v2 }
  template:
    metadata:
      labels: { app: sentiment-api, version: v2 }
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports: [{ containerPort: 8080 }]
        readinessProbe:
          httpGet: { path: /healthz, port: 8080 }
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc
  namespace: sre-lab
spec:
  selector: { app: sentiment-api }
  ports:
  - { port: 80, targetPort: 80 }   # BUG: pods listen on 8080
  type: ClusterIP
EOF
```

### Step 1 — Wide view

```bash
kubectl get deploy,po,svc,endpoints -n sre-lab -o wide
```

Two signals to spot immediately:

- `READY 0/3` on the Deployment — zero pods pass readiness.
- `ENDPOINTS <none>` on the Service — no backends.

### Step 2 — Inspect the Service vs Pod ports

```bash
kubectl describe svc sentiment-svc -n sre-lab
kubectl get pod -l app=sentiment-api -n sre-lab \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].ports[0].containerPort}{"\n"}{end}'
```

`TargetPort: 80` on the Service, `containerPort: 8080` on the Pod. Mismatch confirmed.

### Step 3 — Confirm readiness failure

```bash
kubectl describe pod <pod-name> -n sre-lab
```

Look for: `Readiness probe failed: dial tcp <ip>:8080: connect: connection refused` — nginx serves on 80 by default, the probe hits 8080.

### Step 4 — Check EndpointSlice (newer clusters)

```bash
kubectl get endpointslices -n sre-lab -o wide
```

`ENDPOINTS <none>` confirms the same finding from a different object.

### Step 5 — Fix

```bash
kubectl patch svc sentiment-svc -n sre-lab \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/ports/0/targetPort","value":8080}]'

kubectl get endpoints sentiment-svc -n sre-lab -w
```

Endpoints populate within seconds.

### Stretch — selector mismatch

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc-v2
  namespace: sre-lab
spec:
  selector: { app: sentiment-api, tier: backend }    # no pod has tier=backend
  ports:
  - { port: 80, targetPort: 8080 }
EOF
```

Investigate why endpoints stay empty even though the targetPort is now correct. Use `kubectl get pods --show-labels` to confirm no pod carries `tier=backend`.

### Common mistakes

- Reading pod logs before checking endpoints — logs can look clean while the pod is not Ready.
- Assuming Running means Ready — they are separate conditions.
- Missing EndpointSlices in newer clusters: kube-proxy reads slices, not the legacy Endpoints object.

---

## Lab 14: Diagnose A Rollout That Promotes Pods Before They Are Actually Ready

**Goal:** Identify a misconfigured readiness probe that lets a pod join the Service while still warming up.

**Setup the unsafe deployment:**

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api
  namespace: sre-lab
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 2   # too aggressive
      maxSurge: 2
  selector: { matchLabels: { app: python-api } }
  template:
    metadata: { labels: { app: python-api, version: "1.9.0" } }
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports: [{ containerPort: 8080 }]
        readinessProbe:
          httpGet: { path: /ready, port: 8080 }
          initialDelaySeconds: 2     # too short: app warms in 25s
          periodSeconds: 5
          failureThreshold: 1         # single failure marks pod not ready
---
apiVersion: v1
kind: Service
metadata: { name: python-api-svc, namespace: sre-lab }
spec:
  selector: { app: python-api }
  ports: [{ port: 80, targetPort: 8080 }]
EOF
```

### Step 1 — Watch the rollout

```bash
kubectl get pod -n sre-lab -l app=python-api -w
```

Pods declare Ready at 12-14 seconds. Application warm-up is 25s. The 13-second gap is when traffic hits unwarmed pods.

### Step 2 — Inspect probe config

```bash
kubectl describe pod <python-api-pod> -n sre-lab
kubectl get deploy python-api -n sre-lab -o jsonpath='{.spec.strategy}' | python3 -m json.tool
```

`#failure=1` and `delay=2s` is the bad combination. `maxUnavailable: 2` with 4 replicas means capacity can drop to 2 (50%) during rollout.

### Step 3 — Apply hardened version with startupProbe

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api
  namespace: sre-lab
  annotations:
    kubernetes.io/change-cause: "v1.9.1 hardened probes and rollout strategy"
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector: { matchLabels: { app: python-api } }
  template:
    metadata: { labels: { app: python-api, version: "1.9.1" } }
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports: [{ containerPort: 8080 }]
        startupProbe:
          httpGet: { path: /ready, port: 8080 }
          failureThreshold: 30
          periodSeconds: 2          # 60s max startup window
        readinessProbe:
          httpGet: { path: /ready, port: 8080 }
          periodSeconds: 10
          failureThreshold: 3
        livenessProbe:
          httpGet: { path: /healthz, port: 8080 }
          initialDelaySeconds: 30
          periodSeconds: 20
          failureThreshold: 3
EOF
```

### Step 4 — Add a PDB and observe rollout interaction

```bash
kubectl apply -f - <<'EOF'
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: python-api-pdb, namespace: sre-lab }
spec:
  minAvailable: 3
  selector: { matchLabels: { app: python-api } }
EOF

kubectl rollout restart deploy/python-api -n sre-lab
```

With `maxUnavailable: 0` and `minAvailable: 3` on 4 replicas, the rollout is allowed but only one pod can be replaced at a time.

### Step 5 — Simulate OOMKilled during rollout

```bash
kubectl set resources deploy/python-api -n sre-lab --limits=memory=5Mi
kubectl describe pod -n sre-lab -l app=python-api | grep -A 3 "Last State"
```

`Last State: Terminated, Reason: OOMKilled, Exit Code: 137` — exit 137 is kernel SIGKILL via the OOM killer, distinct from `exit 1` application crash.

### Common mistakes

- Confusing liveness (restarts) and readiness (removes from endpoints).
- Hiding slow startup with high `initialDelaySeconds` instead of using `startupProbe`.
- Believing `maxUnavailable: 0` is sufficient — false readiness still produces error traffic.
- Forgetting the `kubernetes.io/change-cause` annotation, which makes `rollout history` useless for audit.

---

## Lab 15: Diagnose Node Pressure And Scheduling Failures

**Goal:** Understand why pods are Pending due to over-reserved memory and how QoS classes affect eviction.

**Setup:**

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: batch-noisy
  namespace: sre-lab
spec:
  containers:
  - name: worker
    image: nginx:1.25
    resources:
      requests: { memory: "3Gi", cpu: "500m" }      # over-reserved
      limits:   { memory: "4Gi", cpu: "2000m" }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: inference-api, namespace: sre-lab }
spec:
  replicas: 3
  selector: { matchLabels: { app: inference-api } }
  template:
    metadata: { labels: { app: inference-api } }
    spec:
      containers:
      - name: server
        image: nginx:1.25
        resources:
          requests: { memory: "1500Mi", cpu: "250m" }
          limits:   { memory: "2Gi",    cpu: "500m" }
EOF
```

### Step 1 — Find Pending pods and read scheduler reasoning

```bash
kubectl get pods -n sre-lab -o wide
kubectl describe pod <pending-pod> -n sre-lab
```

Events will show: `0/N nodes are available: M Insufficient memory, K node(s) had untolerated taint`.

### Step 2 — Compare requests vs actual usage

```bash
kubectl describe node <node> | grep -A 10 "Allocated resources"
kubectl top node
kubectl top pod -n sre-lab
```

`batch-noisy` requested 3Gi but uses 142Mi — the scheduler sees the node as full (96% requested), but it is physically 43% used. The scheduler never looks at actual usage.

### Step 3 — Check QoS class and eviction priority

```bash
kubectl get pod batch-noisy -n sre-lab -o jsonpath='{.status.qosClass}'
kubectl describe node <node> | grep -A 5 "Conditions:"
```

`MemoryPressure: True` means kubelet is considering eviction. Order: BestEffort → Burstable → Guaranteed.

### Step 4 — Make inference-critical pods Guaranteed

```yaml
resources:
  requests: { memory: "1500Mi", cpu: "250m" }
  limits:   { memory: "1500Mi", cpu: "250m" }   # equal to requests = Guaranteed
```

### Step 5 — Add a PriorityClass and observe preemption

```bash
kubectl apply -f - <<'EOF'
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: inference-critical }
value: 100000
globalDefault: false
description: "Latency-sensitive inference"
EOF
```

Set `priorityClassName: inference-critical` on an inference pod that cannot schedule. Watch events — the scheduler preempts a lower-priority pod to make room.

### Stretch — GPU Pending pod

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata: { name: gpu-pending, namespace: sre-lab }
spec:
  containers:
  - name: trainer
    image: nginx:1.25
    resources:
      requests: { nvidia.com/gpu: "1" }
      limits:   { nvidia.com/gpu: "1" }
EOF
```

If no GPU nodes exist: events show `0/N nodes available: N Insufficient nvidia.com/gpu`. Fix by adding a GPU node, or change the workload to not require a GPU, or use MIG/time-slicing to share an existing GPU.

### Common mistakes

- Reading limits instead of requests for scheduling reasoning.
- Conflating OOMKill (kernel kills container for exceeding cgroup limit) with kubelet eviction (proactive removal under node pressure).
- Believing `kubectl top` is what the scheduler uses — it does not. The scheduler reads Allocated resources from `kubectl describe node`.

---

## Lab 16: GPU & AI Platform Architecture Review (Design Lab)

**Goal:** Produce a written design for a Kubernetes platform supporting general services, batch jobs, GPU training, and GPU inference with cost control and multi-tenant isolation.

This is a 60-90 minute design exercise. Treat it as a whiteboard interview question.

### Required Outputs

1. **Node pool layout** — table of pools, hardware, taints, autoscaling.
2. **GPU isolation strategy** — taints/tolerations + ResourceQuota + admission policy.
3. **Training platform design** — addressing partial-start, node loss, checkpointing.
4. **Inference platform design** — warm capacity, generative vs predictive.
5. **Scheduling and quota** — ResourceQuota, PriorityClass, Kueue.
6. **Observability signals** — platform vs workload.
7. **Failure handling** — training node loss at hour 3, inference OOM, device plugin crash.
8. **Tooling decision** — which controllers (Kubeflow Trainer, KServe, Kueue) to adopt and which to defer.

### Worked Skeleton

**Node pools:**

| Pool | Hardware | Taints | Autoscaling |
|---|---|---|---|
| general-cpu | m5.large | none | cluster-autoscaler |
| batch-cpu | c6i.xlarge spot | `workload=batch:NoSchedule` | aggressive scale-down |
| gpu-training | p4d.24xlarge | `workload=gpu-training:NoSchedule` | manual or Karpenter |
| gpu-inference | g5.2xlarge | `workload=gpu-inference:NoSchedule` | HPA-driven |

**GPU isolation:**

```yaml
# GPU node taint
kubectl taint nodes <gpu-node> workload=gpu-training:NoSchedule

# Pod toleration
tolerations:
- key: workload
  operator: Equal
  value: gpu-training
  effect: NoSchedule

# Block GPU usage from general namespaces
apiVersion: v1
kind: ResourceQuota
metadata: { name: no-gpu, namespace: general-services }
spec:
  hard:
    requests.nvidia.com/gpu: "0"
```

**Training partial-start prevention:** Kueue ClusterQueue with all-or-nothing admission. Job waits in queue until 4 workers can land together.

**Inference warm capacity:** never scale critical models to zero; minimum 2 replicas; KServe with `InferenceService` for standard protocol; HPA on per-model latency or queue depth, not just CPU.

**Failure handling — training node loss at hour 3 of a 6-hour job:** checkpoint every 30 minutes to object storage; on node loss, Kueue re-admits the job which resumes from last checkpoint; PDB does not apply to spot reclamation, so plan for it explicitly.

**Tooling decision rule of thumb:**

| Tool | When to adopt |
|---|---|
| Kueue | GPU supply scarce, fair queued admission matters |
| Kubeflow Trainer | Multi-worker training is a repeated product need |
| KServe | Teams need shared model-serving patterns and governance |
| Plain Kubernetes | Simple isolated jobs, or pilot phase |

Avoid adopting all four operators simultaneously. Each adds operational weight and a new failure mode.

### Pressure Questions To Prepare

- Allow training-to-inference overflow when inference demand is low?
- How to handle an emergency cross-quota GPU allocation request?
- How to validate a GPU node is healthy beyond `Ready: True`?
- A training job ran 18 hours, no checkpoint, was preempted — what now?

---

## Lab 17: Operators, Mesh, Policy, And DR Design Review

**Goal:** Critically review a platform with 11 operators, Kyverno admission policy, debate about adopting Istio, and a "DR-ready" claim. Produce a written assessment.

This is a 60-90 minute design review exercise.

### Required Outputs

1. **Operator risk classification** — table of risk classes with detection method.
2. **Admission policy strategy** — `Enforce` vs `Audit`, `failurePolicy: Fail` vs `Ignore`, rollout stages.
3. **Service mesh decision** — adopt sidecar, adopt ambient, defer, or use Cilium.
4. **etcd backup/restore** — frequency, restore procedure, what is NOT in etcd.
5. **Stateful workload recovery** — Velero limits, app-aware backups.
6. **DR-readiness checklist** — at least six concrete criteria beyond "we have backups".

### Operator Risk Worked Example

| Risk class | Examples | Failure surface | Detection |
|---|---|---|---|
| Low | Prometheus operator (own CRDs) | Metrics scraping breaks | Stale `up{}` metric |
| Medium | cert-manager | Certificate rotation stops | Cert expiry alert |
| High | cert-manager with mutating webhook | All pod creates may fail admission | Webhook latency + admission rejection metric |

### Admission Policy Stages

1. **Audit mode** — log violations, do not block. Run for 2 weeks to baseline noise.
2. **Enforce on new namespaces** — turn on for fresh workloads first.
3. **Enforce broadly** — only after baseline is clean.
4. Keep `failurePolicy: Ignore` unless the policy must block on availability of the webhook.

### Mesh Decision Framework

| Need | Resolution |
|---|---|
| mTLS between services | Cilium or Istio (ambient is fine for L4) |
| Per-route traffic splitting | Istio sidecar or ambient + waypoint |
| Circuit breaking the app cannot do | Istio sidecar |
| L7 observability per route | Istio sidecar or Cilium with L7 visibility |
| None of the above is a current pain | Defer; cost of istiod operations is not free |

### DR-Readiness Checklist

- Written runbook with named owners.
- Quarterly restore drills (etcd + Velero + app-specific).
- Separate plans for etcd, cluster, app data.
- RTO and RPO defined per workload class.
- Cert expiry monitoring (a restored old etcd may have expired certs).
- Multi-region replication strategy if SLA needs active failover.
- Documented "what is NOT covered" — caches, in-memory state, queue depth.

### Pressure Questions To Prepare

- Safely upgrade cert-manager (mutating webhook) without downtime.
- Security exposure of `failurePolicy: Ignore` if Kyverno crashes during a deploy.
- A `DestinationRule` routed all traffic to a non-existent subset — what failed and how to prevent.
- etcd restored but cluster still broken — three most likely causes.
- 4-hour restore but 1-hour SLA — what do you do?
- Three rarely-used operators among the 11 — keep, remove, or document?
