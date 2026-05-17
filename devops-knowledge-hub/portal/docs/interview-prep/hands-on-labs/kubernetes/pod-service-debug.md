---
title: "Kubernetes Lab 1: Pod Is Running But Service Does Not Work"
sidebar_position: 1
---

# Kubernetes Lab 1: Pod Is Running But Service Does Not Work

## Production Context

You are on-call for an ML inference platform. A user reports their model endpoint
`https://api.internal/model/sentiment` started returning connection errors at 14:23 UTC.
The Deployment shows three running pods. No recent deploys were triggered. Your job is to
find why traffic is not reaching the pods.

---

## Prerequisites

- A running Kubernetes cluster (kind, k3d, or real cluster)
- `kubectl` configured and pointing at the right context
- Permissions to read pods, services, endpoints, and endpointslices in the target namespace

---

## Environment Setup

Apply the broken scenario manifest, which ships a Deployment with a deliberate label
mismatch and a mismatched service port:

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
    matchLabels:
      app: sentiment-api
      version: v2
  template:
    metadata:
      labels:
        app: sentiment-api
        version: v2
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc
  namespace: sre-lab
spec:
  selector:
    app: sentiment-api
    # version label intentionally omitted — selector only matches app, but
    # pods have version: v2. Not the bug here, but close enough to demo.
    # The real bug: targetPort points to 80, pods listen on 8080.
  ports:
  - port: 80
    targetPort: 80      # BUG: pods listen on 8080, not 80
  type: ClusterIP
EOF
```

Wait 30 seconds for pods to attempt readiness, then begin the investigation.

---

## Beginner Section: Guided Walkthrough

Work through these steps in order. Read every field in the output — do not skip past
anything you do not recognise.

### Step 1 — Get a wide view of the namespace

```bash
kubectl get deploy,po,svc,endpoints -n sre-lab -o wide
```

Expected output:

```
NAME                            READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/sentiment-api   0/3     3            0           2m

NAME                               READY   STATUS    RESTARTS   AGE   IP            NODE
pod/sentiment-api-7d9f8b6c4-4xpk2  0/1     Running   0          2m    10.244.1.12   node-1
pod/sentiment-api-7d9f8b6c4-9rmnv  0/1     Running   0          2m    10.244.2.8    node-2
pod/sentiment-api-7d9f8b6c4-kw7ts  0/1     Running   0          2m    10.244.1.19   node-1

NAME                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/sentiment-svc   ClusterIP   10.96.144.221   <none>        80/TCP    2m

NAME                      ENDPOINTS   AGE
endpoints/sentiment-svc   <none>      2m
```

Key signals to notice:

- `READY 0/3` on the Deployment means zero pods passed readiness. Traffic cannot be served.
- `ENDPOINTS <none>` on the Service means the Service has no backing pods. Any request
  to the ClusterIP will be dropped.
- Pods are `Running` but `0/1` ready. The process is alive but Kubernetes does not
  consider it healthy enough to receive traffic.

### Step 2 — Inspect the Service selector

```bash
kubectl describe svc sentiment-svc -n sre-lab
```

Expected output:

```
Name:              sentiment-svc
Namespace:         sre-lab
Labels:            <none>
Selector:          app=sentiment-api
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.96.144.221
Port:              <unset>  80/TCP
TargetPort:        80/TCP
Endpoints:         <none>
Session Affinity:  None
Events:            <none>
```

Notice: `TargetPort: 80/TCP`. This is the port the Service forwards to on each pod.

### Step 3 — Check what port the pods actually expose

```bash
kubectl get pod -l app=sentiment-api -n sre-lab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].ports[0].containerPort}{"\n"}{end}'
```

Expected output:

```
sentiment-api-7d9f8b6c4-4xpk2   8080
sentiment-api-7d9f8b6c4-9rmnv   8080
sentiment-api-7d9f8b6c4-kw7ts   8080
```

The mismatch is now clear: pods listen on `8080`, service routes to `80`.

### Step 4 — Confirm readiness failures via pod description

```bash
kubectl describe pod sentiment-api-7d9f8b6c4-4xpk2 -n sre-lab
```

Expected output (trimmed to the relevant section):

```
Name:             sentiment-api-7d9f8b6c4-4xpk2
Namespace:        sre-lab
Status:           Running
IP:               10.244.1.12
Controlled By:    ReplicaSet/sentiment-api-7d9f8b6c4

Conditions:
  Type              Status
  Initialized       True
  Ready             False     <-- pod is NOT ready
  ContainersReady   False
  PodScheduled      True

Containers:
  api:
    Image:          nginx:1.25
    Port:           8080/TCP
    State:          Running
    Ready:          False
    Restart Count:  0
    Readiness:      http-get http://:8080/healthz delay=5s timeout=1s period=10s

Events:
  Type     Reason     Age                From               Message
  ----     ------     ----               ----               -------
  Normal   Scheduled  3m                 default-scheduler  Successfully assigned sre-lab/sentiment-api-7d9f8b6c4-4xpk2 to node-1
  Normal   Pulled     3m                 kubelet            Container image "nginx:1.25" already present on machine
  Normal   Created    3m                 kubelet            Created container api
  Normal   Started    3m                 kubelet            Started container api
  Warning  Unhealthy  2m (x12 over 3m)  kubelet            Readiness probe failed: dial tcp 10.244.1.12:8080: connect: connection refused
```

The readiness probe hits `:8080/healthz`. nginx by default serves on port 80, not 8080,
so the probe fails. Because the probe fails, pods are never marked Ready. Because pods
are never Ready, the Endpoints object has no addresses. Because Endpoints is empty, the
Service forwards to nothing.

### Step 5 — Check the EndpointSlice for more detail

```bash
kubectl get endpointslices -n sre-lab -o wide
```

Expected output:

```
NAME                    ADDRESSTYPE   PORTS   ENDPOINTS   AGE
sentiment-svc-x4bqr     IPv4          80      <none>      4m
```

`ENDPOINTS <none>` confirms the same finding from a different object. In newer clusters
EndpointSlices replace the older Endpoints object as the source of truth for kube-proxy
and Cilium.

### Step 6 — Understand the fix options

There are two valid fixes depending on intent:

**Option A** — Change the Service `targetPort` to match what pods actually expose:

```bash
kubectl patch svc sentiment-svc -n sre-lab \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/ports/0/targetPort","value":8080}]'
```

**Option B** — If you own the Deployment, change the container to listen on port 80 and
update the readiness probe accordingly.

After Option A, watch endpoints populate:

```bash
kubectl get endpoints sentiment-svc -n sre-lab -w
```

```
NAME            ENDPOINTS                                                  AGE
sentiment-svc   <none>                                                     5m
sentiment-svc   10.244.1.12:8080,10.244.2.8:8080,10.244.1.19:8080         5m12s
```

---

## Intermediate Section: Diagnose Without Full Hints

Apply this variant manifest. It has a different fault — find it:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: sentiment-svc-v2
  namespace: sre-lab
spec:
  selector:
    app: sentiment-api
    tier: backend        # no pod has this label
  ports:
  - port: 80
    targetPort: 8080
EOF
```

Run the same investigation sequence. Answer:

1. What does `kubectl describe svc sentiment-svc-v2` show that is different from
   the working service?
2. Why are endpoints still empty even though targetPort is now correct?
3. What exact command tells you which labels the pods actually carry?
4. What is the minimal change that fixes this service without touching the Deployment?

---

## Advanced / Stretch

**Scenario A — Readiness gate blocks rollout**

Add a readiness gate to the Deployment spec:

```yaml
readinessGates:
- conditionType: "custom.io/traffic-enabled"
```

Notice that pods get stuck at `Ready: False` even when the HTTP probe passes. Explain why,
and write the `kubectl patch` command that injects the missing condition.

**Scenario B — EndpointSlice topology**

With a real multi-node cluster, use `kubectl get endpointslices -o yaml` to find the
`topology` hints field. Explain how `service.kubernetes.io/topology-mode: auto`
changes which endpoints a node-local kube-proxy uses.

**Scenario C — Headless service**

Change `clusterIP: None`. Observe how `nslookup sentiment-svc.sre-lab.svc.cluster.local`
response changes. Explain when you would choose headless and how a client must behave
differently.

---

## Sample Diagnosis Note

```
Incident: sentiment-api service returning no endpoints since 14:23 UTC

Root cause: Service targetPort set to 80; pods listen on 8080.
Kubernetes never added pod IPs to the Endpoints object because the pods were also
failing their readiness probe (probe hits :8080/healthz which nginx does not serve
on port 8080 by default — it serves on 80).

Evidence:
  kubectl get endpoints sentiment-svc -n sre-lab  →  ENDPOINTS <none>
  kubectl describe pod ...                         →  Readiness probe failed: dial tcp ...:8080: connection refused
  kubectl get svc -o yaml                          →  targetPort: 80

Fix applied 14:41 UTC: patched targetPort from 80 to 8080.
Endpoints populated within 12 seconds. Traffic restored at 14:41:14 UTC.

Prevention: Add CI check that asserts Service targetPort matches containerPort in the
same Deployment manifest. Use kube-linter rule "service-port-match".
```

---

## Common Mistakes

- **Checking pod logs before checking endpoints.** Logs can look clean while the
  pod is not ready. Check endpoints first when a Service is broken.
- **Assuming Running means Ready.** A pod can be `Running` (process started) and
  `0/1 Ready` (failed readiness probe) at the same time. These are different conditions.
- **Fixing the wrong object.** If you own neither the Service nor the Deployment
  spec, escalate rather than patching one side to match a broken other side.
- **Missing EndpointSlices in newer clusters.** In Kubernetes 1.21+ kube-proxy
  reads EndpointSlices, not Endpoints. Both should agree but check the slice if the
  classic Endpoints command looks wrong.

---

## What To Study Next

- Kubernetes Service types: ClusterIP, NodePort, LoadBalancer, Headless
- EndpointSlice topology-aware routing (`service.kubernetes.io/topology-mode`)
- kube-proxy modes: iptables vs IPVS vs eBPF (Cilium)
- Readiness gates and external admission controllers
- `kubectl port-forward` as a bypass to isolate Service vs pod fault
