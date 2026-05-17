---
title: "Cheat Sheet"
sidebar_position: 6
---

# Kubernetes & Containers — Cheat Sheet

A condensed quick-reference. For deeper explanations see the Beginner → Expert chapters.

---

## Docker — One-Liners

### Images

```bash
docker pull nginx                          # pull
docker pull nginx:1.25                     # pull a specific tag
docker images                              # list local images
docker rmi nginx                           # remove an image
docker build -t myapp:latest .             # build from Dockerfile in CWD
docker tag myapp:latest myrepo/myapp:v1    # retag
docker push myrepo/myapp:v1                # push to registry
docker save -o myapp.tar myapp:latest      # export to tar
docker load -i myapp.tar                   # import from tar
docker inspect image myapp:latest          # full image metadata
docker image prune                         # remove dangling images
docker system prune -a                     # remove ALL unused images/containers/networks
```

### Containers

```bash
docker run nginx                                 # foreground
docker run -d nginx                              # detached
docker run -it ubuntu bash                       # interactive shell
docker run -d --name web -p 8080:80 nginx        # named, port-mapped
docker run --restart=always nginx                # auto-restart
docker run -e APP_ENV=production myapp           # env var
docker run --cpus=2 -m 512m nginx                # CPU/memory limits
docker run -v my-volume:/data myapp              # named volume
docker run -v /host/path:/container/path myapp   # bind mount

docker ps                          # running
docker ps -a                       # all
docker stop  <id>
docker start <id>
docker restart <id>
docker kill <id>                   # SIGKILL
docker rm <id>                     # remove stopped
docker rm -f <id>                  # force remove
docker exec -it <id> /bin/bash     # shell into running container
docker logs -f <id>                # follow logs
docker stats                       # live CPU/mem usage
docker inspect <id>                # full JSON metadata
docker cp <id>:/path/file ./       # copy out
```

### Networks & Volumes

```bash
docker network ls
docker network create my-net
docker network connect my-net my-container
docker network inspect my-net

docker volume ls
docker volume create my-vol
docker volume inspect my-vol
docker volume rm my-vol
```

### Compose

```bash
docker compose up -d
docker compose down
docker compose logs -f
docker compose ps
docker compose scale web=3
docker compose restart web
```

---

## kubectl — Daily Driver

### Context & cluster info

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context <name>
kubectl config set-context --current --namespace=<ns>

kubectl cluster-info
kubectl version --short
kubectl api-resources
kubectl explain pods.spec.containers
```

### Nodes

```bash
kubectl get nodes
kubectl get nodes -o wide
kubectl get nodes --show-labels
kubectl describe node <name>
kubectl top nodes
kubectl cordon   <node>                # mark unschedulable
kubectl uncordon <node>
kubectl drain    <node> --ignore-daemonsets --delete-emptydir-data
kubectl taint    nodes <node> key=value:NoSchedule
kubectl label    nodes <node> key=value
```

### Pods

```bash
kubectl get pods
kubectl get pods -A                                 # all namespaces
kubectl get pods -o wide                            # node + IP
kubectl get pods --field-selector spec.nodeName=node01
kubectl describe pod <name>
kubectl logs <name>
kubectl logs <name> -c <container>
kubectl logs <name> --previous                      # last crashed container
kubectl logs <name> -f --since=10m
kubectl logs -l app=myapp --tail=100                # by label
kubectl exec -it <name> -- /bin/sh
kubectl exec -it <name> -c <container> -- bash
kubectl delete pod <name>
kubectl delete pod <name> --force --grace-period=0  # stuck pod
kubectl port-forward pod/<name> 8080:80
```

### Deployments / ReplicaSets / DaemonSets / StatefulSets

```bash
kubectl get deploy
kubectl describe deploy <name>
kubectl create deployment my-app --image=nginx
kubectl apply -f deploy.yaml
kubectl scale deploy/my-app --replicas=5
kubectl autoscale deploy/my-app --cpu-percent=50 --min=2 --max=10
kubectl set image deploy/my-app nginx=nginx:1.27
kubectl rollout status deploy/my-app
kubectl rollout history deploy/my-app
kubectl rollout undo    deploy/my-app
kubectl rollout undo    deploy/my-app --to-revision=2
kubectl rollout restart deploy/my-app
kubectl get rs
kubectl get ds
kubectl get sts
```

### Services & Networking

```bash
kubectl get svc
kubectl get svc -A
kubectl describe svc <name>
kubectl get endpoints <svc>                # empty = selector/Pod mismatch
kubectl expose deploy/my-app --type=LoadBalancer --port=80
kubectl port-forward svc/my-svc 8080:80

kubectl get ingress
kubectl describe ingress <name>

kubectl get networkpolicy -A
```

### Config, Secrets, Storage

```bash
kubectl get cm
kubectl create cm app-config --from-literal=APP_ENV=prod
kubectl create cm app-config --from-file=./config.json

kubectl get secrets
kubectl create secret generic db-pass --from-literal=password=changeme
kubectl create secret docker-registry regcred \
  --docker-server=<reg> --docker-username=<u> --docker-password=<p>

kubectl get pvc
kubectl get pv
kubectl describe pvc <name>
```

### Events, Debugging, Auth

```bash
kubectl get events --sort-by=.lastTimestamp
kubectl get events -A --sort-by=.lastTimestamp | tail -30
kubectl top pods
kubectl top pods -A --sort-by=memory
kubectl top pods -A --sort-by=cpu

kubectl auth whoami
kubectl auth can-i get pods
kubectl auth can-i get pods --as=jane -n production
kubectl auth can-i --list --as=system:serviceaccount:default:my-sa

kubectl diff -f manifest.yaml
kubectl apply --dry-run=server -f manifest.yaml
kubectl get pod <name> -o yaml | yq '.spec.containers[].image'
```

### "I just want to…" recipes

```bash
# Run a throwaway shell in the cluster
kubectl run tmp --rm -it --image=busybox -- sh

# Copy files in/out of a pod
kubectl cp ./local.txt my-pod:/tmp/local.txt
kubectl cp my-pod:/var/log/app.log ./app.log

# JSONPath to extract a single field
kubectl get pod my-pod -o jsonpath='{.status.podIP}'
kubectl get deploy my-app -o jsonpath='{.spec.replicas}'

# Force-recreate a pod (without editing the manifest)
kubectl rollout restart deploy/my-app

# Get YAML you can re-apply
kubectl get deploy my-app -o yaml > my-app.yaml
```

---

## Helm Quick Reference

```bash
helm version
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo postgres
helm search hub  postgres

helm install my-db bitnami/postgresql -n data --create-namespace
helm install my-app ./my-chart -f values-prod.yaml
helm upgrade --install my-app ./my-chart -f values-prod.yaml
helm list -A
helm history my-app
helm rollback my-app 1
helm uninstall my-app
helm template ./my-chart -f values.yaml > rendered.yaml
helm lint ./my-chart
helm get values my-app
helm get manifest my-app
```

---

## YAML Snippets You Will Paste Constantly

### Pod with probes + resources

```yaml
spec:
  containers:
  - name: app
    image: my-app:1.0
    resources:
      requests: { cpu: 100m, memory: 128Mi }
      limits:   { cpu: 500m, memory: 256Mi }
    readinessProbe:
      httpGet: { path: /ready, port: 8080 }
      periodSeconds: 5
    livenessProbe:
      httpGet: { path: /healthz, port: 8080 }
      initialDelaySeconds: 30
      periodSeconds: 10
```

### Rolling update strategy

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  minReadySeconds: 30
  progressDeadlineSeconds: 300
```

### HPA v2

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 70 }
```

### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: my-pdb }
spec:
  minAvailable: 2          # or maxUnavailable: 1 — never both
  selector:
    matchLabels: { app: my-app }
```

### NetworkPolicy default-deny

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-all }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

### Topology spread (HA across zones)

```yaml
topologySpreadConstraints:
- maxSkew: 1
  topologyKey: topology.kubernetes.io/zone
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels: { app: my-app }
```

### Pod Security Standard (namespace label)

```yaml
labels:
  pod-security.kubernetes.io/enforce: restricted
  pod-security.kubernetes.io/warn:    restricted
```

### Secure container spec (PSS-restricted compliant)

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
```

---

## Dockerfile Quick Reference

```dockerfile
FROM ubuntu:22.04                         # base image (must be first instruction)
LABEL maintainer="you@example.com"
WORKDIR /app                              # cwd for following instructions
COPY package*.json ./                     # copy from host
ADD app.tar.gz /app/                      # like COPY but auto-extracts archives / supports URLs
RUN apt-get update && apt-get install -y curl  # build-time command
ENV NODE_ENV=production                   # runtime env var
ARG BUILD_VERSION                         # build-time only var
EXPOSE 8080                               # documentation only
USER 1000                                 # run as non-root
HEALTHCHECK --interval=30s CMD curl -f http://localhost:8080/ || exit 1
ENTRYPOINT ["node"]                       # fixed executable
CMD ["server.js"]                         # default args (overridable)
```

Multi-stage build:

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o /out/app

FROM gcr.io/distroless/base-debian12
COPY --from=builder /out/app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

---

## Common Exit Codes

| Exit | Meaning | Action |
|------|---------|--------|
| `0`  | Clean exit | — |
| `1`  | App error | `kubectl logs` |
| `137` | OOMKilled (128 + SIGKILL) | Raise memory limit / fix leak |
| `139` | Segfault (128 + SIGSEGV) | Bad binary or library mismatch |
| `143` | SIGTERM not handled in time | Increase `terminationGracePeriodSeconds` |
| `255` | Container failed to start | `kubectl describe pod`, image/command issue |

---

## Useful aliases

```bash
alias k=kubectl
alias kgp='kubectl get pods'
alias kgpa='kubectl get pods -A'
alias kga='kubectl get all'
alias kctx='kubectl config use-context'
alias kns='kubectl config set-context --current --namespace'
source <(kubectl completion bash)        # tab completion
complete -F __start_kubectl k
```

---

## Node-Level Diagnostics (`crictl` and Linux)

`docker` does not exist on production Kubernetes nodes. Use `crictl` (CRI client) instead.

```bash
crictl ps                          # running containers
crictl ps -a                       # all containers
crictl images
crictl logs <id>
crictl logs --tail=200 <id>
crictl inspect <id>
crictl exec -it <id> sh
crictl pull <image>
crictl stats                       # cpu/memory per container

# Kubelet on-node
journalctl -u kubelet -n 200 --no-pager
journalctl -u kubelet -f
journalctl -u containerd -n 200 --no-pager

# Node resource pressure
cat /proc/meminfo | head -5
df -h /var/lib/containerd
free -m
top -bn1 | head -20
```

---

## Linux Networking Toolkit (When kubectl Is Not Enough)

```bash
# Service translation rules (iptables mode)
iptables-save | grep KUBE-SVC
iptables-save | grep KUBE-SEP
iptables -L KUBE-SERVICES -n -v

# Conntrack
conntrack -S                                # stats: insert_failed, drops
conntrack -L | wc -l
sysctl net.netfilter.nf_conntrack_max
sysctl net.netfilter.nf_conntrack_buckets

# Socket state
ss -s                                       # global summary
ss -tlnp                                    # listening TCP
ss -i                                       # info: retransmits per socket

# Physical layer
ip -s link                                  # interface drops/errors
ethtool -S eth0 | grep -E 'errors|dropped'
ip route
ip neigh

# MTU testing (don't-fragment, payload 1472 == 1500 MTU)
ping -M do -s 1472 <target>
tracepath <target>

# Live packet capture
tcpdump -i any -nn -w /tmp/capture.pcap host <target>
tcpdump -i any -nn 'tcp[tcpflags] & (tcp-syn|tcp-rst) != 0'

# Test from inside the cluster
kubectl run netshoot --rm -it --image=nicolaka/netshoot -- bash
# then: dig, mtr, traceroute, tcpdump, curl, openssl s_client
```

---

## Cilium / Hubble Quick Reference

```bash
cilium status
cilium service list
cilium endpoint list
cilium policy get
cilium connectivity test

hubble status
hubble observe --follow
hubble observe --verdict DROPPED --type policy-verdict
hubble observe --from-namespace prod --to-namespace prod
hubble observe --protocol dns --type l7
```

---

## DNS Debugging

```bash
# Inside a pod
kubectl exec -it <pod> -- cat /etc/resolv.conf
kubectl exec -it <pod> -- nslookup kubernetes.default
kubectl exec -it <pod> -- dig +short <svc>.<ns>.svc.cluster.local
kubectl exec -it <pod> -- dig @<coredns-ip> <svc>.<ns>.svc.cluster.local

# CoreDNS health
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl top pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200

# Override ndots in a pod spec
spec:
  dnsConfig:
    options:
    - { name: ndots, value: "2" }
```

---

## GPU Inspection And Scheduling

```bash
# On a GPU node
nvidia-smi
nvidia-smi dmon                            # live device monitor
nvidia-smi topo -m                         # GPU interconnect topology
nvidia-smi -q -d ECC                       # ECC errors

# Kubernetes view
kubectl describe node <gpu-node> | grep -A 5 nvidia.com/gpu
kubectl get nodes -L nvidia.com/gpu.product
kubectl get nodes -L nvidia.com/gpu.count

# GPU operator
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl logs -n gpu-operator ds/nvidia-dcgm-exporter
kubectl logs -n gpu-operator deploy/gpu-operator-validator
```

GPU pod request:

```yaml
spec:
  nodeSelector:
    nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
  tolerations:
  - { key: dedicated, operator: Equal, value: gpu, effect: NoSchedule }
  containers:
  - name: cuda
    image: nvidia/cuda:12.2.0-base-ubuntu22.04
    resources:
      limits:
        nvidia.com/gpu: 1
```

MIG resources may appear as: `nvidia.com/mig-1g.10gb`, `nvidia.com/mig-2g.20gb`, `nvidia.com/mig-3g.40gb`.

Block GPU usage from a namespace:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata: { name: no-gpu, namespace: general-services }
spec:
  hard: { requests.nvidia.com/gpu: "0" }
```

---

## Kueue Snippet (Gang Scheduling)

```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata: { name: training-pool }
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: [cpu, memory, "nvidia.com/gpu"]
    flavors:
    - name: gpu-h100
      resources:
      - { name: cpu,             nominalQuota: 96 }
      - { name: memory,          nominalQuota: 1024Gi }
      - { name: "nvidia.com/gpu", nominalQuota: 8 }
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata: { name: team-ml, namespace: team-ml }
spec:
  clusterQueue: training-pool
```

Submit a training Job and annotate it `kueue.x-k8s.io/queue-name: team-ml`. The Job stays Suspended until quota is available, then admits as a whole.

---

## Probes — The Three Together

```yaml
containers:
- name: api
  image: my-api:1.0
  startupProbe:                    # protects slow boot
    httpGet: { path: /ready, port: 8080 }
    failureThreshold: 30
    periodSeconds: 2                # 60s max window
  readinessProbe:                  # controls Service membership
    httpGet: { path: /ready, port: 8080 }
    periodSeconds: 10
    failureThreshold: 3
  livenessProbe:                   # restarts truly hung process
    httpGet: { path: /healthz, port: 8080 }
    initialDelaySeconds: 30
    periodSeconds: 20
    failureThreshold: 3
```

---

## Guaranteed QoS Snippet

```yaml
resources:
  requests: { memory: "1500Mi", cpu: "250m" }
  limits:   { memory: "1500Mi", cpu: "250m" }   # requests == limits
```

```bash
kubectl get pod <name> -o jsonpath='{.status.qosClass}'
```

---

## PriorityClass + Preemption

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: inference-critical }
value: 100000
globalDefault: false
description: "Latency-sensitive inference pods"
```

```yaml
# Pod that requests preemption rights
spec:
  priorityClassName: inference-critical
```

---

## Kustomize Quick Reference

```bash
kubectl apply -k overlays/prod
kustomize build overlays/prod
kustomize build overlays/prod | kubectl diff -f -
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
configMapGenerator:
- name: app-config
  literals: [APP_ENV=production]
```

---

## etcd Backup / Restore

```bash
# Backup (run on control-plane node)
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%s).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-XXXX.db --write-out=table

# Restore (creates new data-dir; reconfigure etcd to point at it)
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-XXXX.db \
  --data-dir=/var/lib/etcd-restore
```

---

## Velero Backup Snippets

```bash
# Install (CLI)
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket my-velero-bucket \
  --backup-location-config region=eu-west-1 \
  --secret-file ./credentials-velero

# Backup a namespace including PV snapshots
velero backup create prod-snap --include-namespaces production --snapshot-volumes

# Schedule daily
velero schedule create daily-prod --schedule="@daily" --include-namespaces production

# Restore
velero restore create --from-backup prod-snap

# Inspect
velero backup describe prod-snap --details
velero backup logs prod-snap
```

---

## Istio Operations

```bash
# Install / upgrade
istioctl install --set profile=demo
istioctl install --set profile=ambient        # ambient mode

# Validate configuration
istioctl analyze
istioctl analyze -n production

# Inspect mesh
istioctl proxy-status                          # all sidecars sync state
istioctl proxy-config cluster <pod>.<ns>       # Envoy cluster config
istioctl proxy-config listeners <pod>.<ns>
istioctl proxy-config routes <pod>.<ns>
istioctl proxy-config endpoints <pod>.<ns>

# Sidecar injection
kubectl label namespace prod istio-injection=enabled
```

---

## Admission Webhook Inspection

```bash
kubectl get mutatingwebhookconfigurations
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations <name> -o yaml | grep -E 'failurePolicy|timeoutSeconds'

# CRDs
kubectl get crd
kubectl get crd <name> -o jsonpath='{.spec.versions[*].name}'
```

---

## Multi-Arch Image Build (buildx)

```bash
docker buildx create --use --name multiarch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myrepo/myapp:1.0 \
  --push .

docker manifest inspect myrepo/myapp:1.0     # confirm arches in manifest
```

---

## Common Pitfalls Cheat Sheet

| Symptom | Likely cause |
|---|---|
| Service exists, no endpoints | Selector mismatch or readiness failing |
| Endpoints exist, traffic still fails | targetPort wrong, app on 127.0.0.1, or NetworkPolicy block |
| Pod Ready but 503s | Shallow readiness probe; real handler broken |
| Rollout completes, error rate spikes | readinessProbe initialDelay shorter than warm-up |
| DNS slow/intermittent under load | CoreDNS at CPU limit or `ndots:5` amplification |
| New connections fail, old ones work | conntrack table full |
| GPU pod Pending | Insufficient `nvidia.com/gpu`, missing toleration, or device plugin failed |
| GPU node Ready, pod fails CUDA | Driver/runtime mismatch or device plugin broken |
| `kubectl` hangs | etcd disk latency or slow admission webhook |
| Mass eviction across cluster | Operator with mutating webhook in `Fail` mode is unreachable |
