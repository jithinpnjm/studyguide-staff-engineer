---
title: "Kubernetes Lab 2: Readiness, Startup, And Rollout Safety"
sidebar_position: 2
---

# Kubernetes Lab 2: Readiness, Startup, And Rollout Safety

## Production Context

You are deploying version 1.9.0 of a Python API service. The Deployment update was
triggered at 09:15 UTC. By 09:18, SLO dashboards show a spike in 5xx errors. The rollout
is still in progress — three new pods are up, two old pods are still terminating. On-call
pages you. Your job is to understand why the new pods are receiving traffic before they
are ready, and to harden the rollout strategy.

---

## Prerequisites

- A running Kubernetes cluster
- `kubectl` configured
- Namespace `sre-lab` exists (from Lab 1, or `kubectl create namespace sre-lab`)

---

## Environment Setup

Apply the unsafe manifest first. This simulates the production state at incident time:

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
      maxUnavailable: 2       # too aggressive: 2 old pods can vanish at once
      maxSurge: 2             # 2 new pods can start at once
  selector:
    matchLabels:
      app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: "1.9.0"
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 2    # too short: app takes 25s to warm up
          periodSeconds: 5
          failureThreshold: 1       # single failure marks pod not ready
---
apiVersion: v1
kind: Service
metadata:
  name: python-api-svc
  namespace: sre-lab
spec:
  selector:
    app: python-api
  ports:
  - port: 80
    targetPort: 8080
EOF
```

Watch the rollout:

```bash
kubectl rollout status deploy/python-api -n sre-lab --timeout=120s
```

---

## Beginner Section: Guided Walkthrough

### Step 1 — Observe the rollout in progress

```bash
kubectl get pod -n sre-lab -l app=python-api -w
```

Expected output during rollout:

```
NAME                          READY   STATUS              RESTARTS   AGE
python-api-6c7f8d9b4-2kxpq    1/1     Running             0          4m
python-api-6c7f8d9b4-7rnvt    1/1     Running             0          4m
python-api-6c7f8d9b4-m3hq8    1/1     Running             0          4m
python-api-6c7f8d9b4-p9wlz    1/1     Running             0          4m
python-api-79d4c6f5b-4xbkr    0/1     ContainerCreating   0          3s
python-api-79d4c6f5b-8nvmt    0/1     ContainerCreating   0          3s
python-api-6c7f8d9b4-2kxpq    1/1     Terminating         0          4m
python-api-6c7f8d9b4-7rnvt    1/1     Terminating         0          4m
python-api-79d4c6f5b-4xbkr    0/1     Running             0          8s
python-api-79d4c6f5b-8nvmt    0/1     Running             0          8s
python-api-79d4c6f5b-4xbkr    1/1     Running             0          12s   <-- declared Ready at 12s
python-api-79d4c6f5b-8nvmt    1/1     Running             0          14s
```

The new pods are declared Ready at 12-14 seconds. But the app needs 25 seconds to warm
its model cache. Between second 12 and second 25, these pods are in the Service endpoint
list and receiving live traffic while they cannot serve it correctly.

### Step 2 — Describe a pod to see probe configuration and events

```bash
kubectl describe pod python-api-79d4c6f5b-4xbkr -n sre-lab
```

Expected output (relevant sections):

```
Name:             python-api-79d4c6f5b-4xbkr
Namespace:        sre-lab
Status:           Running

Containers:
  api:
    Image:          nginx:1.25
    Port:           8080/TCP
    State:          Running
      Started:      Wed, 09 Apr 2026 09:15:47 +0000
    Ready:          True
    Readiness:      http-get http://:8080/ready delay=2s timeout=1s period=5s #success=1 #failure=1

Conditions:
  Type              Status
  Initialized       True
  Ready             True      <-- pod thinks it is ready
  ContainersReady   True

Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  30s   default-scheduler  Successfully assigned sre-lab/python-api-79d4c6f5b-4xbkr to node-2
  Normal  Pulled     29s   kubelet            Container image "nginx:1.25" already present
  Normal  Created    29s   kubelet            Created container api
  Normal  Started    28s   kubelet            Started container api
```

What to notice: `#failure=1` means a single failed probe immediately marks the pod
not-ready. But here the probe *passed* on its first attempt at 2 seconds — because the
HTTP server started quickly even though the application logic was still loading. The
readiness probe measures "can the process accept a TCP connection" not "is the application
fully initialised."

### Step 3 — Check rollout strategy

```bash
kubectl get deploy python-api -n sre-lab -o jsonpath='{.spec.strategy}' | python3 -m json.tool
```

Expected output:

```json
{
    "rollingUpdate": {
        "maxSurge": 2,
        "maxUnavailable": 2
    },
    "type": "RollingUpdate"
}
```

With `maxUnavailable: 2` and 4 replicas, Kubernetes allows removing 2 old pods before
the new pods are confirmed ready. This means capacity can drop to 2 pods (50%) at the
worst moment — exactly when the new pods are falsely marking themselves ready.

### Step 4 — Check current rollout history

```bash
kubectl rollout history deploy/python-api -n sre-lab
```

Expected output:

```
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

```bash
kubectl rollout history deploy/python-api -n sre-lab --revision=2
```

```
deployment.apps/python-api with revision #2
Pod Template:
  Labels:       app=python-api
                pod-template-hash=79d4c6f5b
                version=1.9.0
  Containers:
   api:
    Image:      nginx:1.25
    Port:       8080/TCP
    Readiness:  http-get http://:8080/ready delay=2s timeout=1s period=5s #success=1 #failure=1
```

### Step 5 — Roll back and apply the safer manifest

Roll back to stabilise:

```bash
kubectl rollout undo deploy/python-api -n sre-lab
kubectl rollout status deploy/python-api -n sre-lab
```

Now apply the hardened version:

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
      maxUnavailable: 0     # never reduce capacity below 4 during rollout
      maxSurge: 1           # add one pod at a time
  selector:
    matchLabels:
      app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: "1.9.1"
    spec:
      containers:
      - name: api
        image: nginx:1.25
        ports:
        - containerPort: 8080
        startupProbe:
          httpGet:
            path: /ready
            port: 8080
          failureThreshold: 30    # 30 * 2s = 60s max startup window
          periodSeconds: 2
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 0  # startup probe guards the initial window
          periodSeconds: 10
          failureThreshold: 3     # three failures required before removing from endpoints
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 20
          failureThreshold: 3
EOF
```

### Step 6 — Understand the probe interaction

The three probes serve different purposes:

| Probe | Purpose | Failure action |
|-------|---------|----------------|
| `startupProbe` | Protects slow-starting containers from liveness kills | Restarts container if never succeeds |
| `readinessProbe` | Controls whether pod is in Service endpoints | Removes from endpoints (no restart) |
| `livenessProbe` | Detects hung/deadlocked process | Restarts container |

A common mistake is to set `initialDelaySeconds: 30` on readinessProbe for a slow app.
This works but means the pod waits 30s before any readiness check, then immediately
becomes ready if the first check passes. A startupProbe is more precise — it polls
aggressively until the app is ready, then hands off to the cheaper readiness schedule.

---

## Intermediate Section: Diagnose Without Full Hints

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-rollout
  namespace: sre-lab
spec:
  replicas: 3
  strategy:
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: broken-rollout
  template:
    metadata:
      labels:
        app: broken-rollout
    spec:
      containers:
      - name: app
        image: nginx:1.25
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 2
        # readinessProbe is missing entirely
EOF
```

Questions to answer without hints:

1. What does `kubectl rollout status` show? Does the rollout complete?
2. What happens to the pods over time without a readiness probe?
3. What can go wrong if liveness fires before the app is ready?
4. What does the absence of `readinessProbe` mean for traffic safety?

---

## Advanced / Stretch

**Scenario A — PodDisruptionBudget interaction**

Create a PDB alongside the Deployment:

```bash
kubectl apply -f - <<'EOF'
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: python-api-pdb
  namespace: sre-lab
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: python-api
EOF
```

Now attempt `kubectl rollout restart deploy/python-api -n sre-lab` with `maxUnavailable: 0`
and `minAvailable: 3` against 4 replicas. Does it proceed? Explain why or why not, and
what operator action unblocks it.

**Scenario B — OOMKilled restart loop during rollout**

Simulate by setting a memory limit far below the app's need:

```bash
kubectl set resources deploy/python-api -n sre-lab \
  --limits=memory=5Mi
```

Describe the pod after a restart. The `State` section will show:

```
Last State:  Terminated
  Reason:    OOMKilled
  Exit Code: 137
```

Exit code 137 means the container was killed by signal 9 (SIGKILL) — the kernel OOM
killer, not the application itself. Explain how you distinguish OOMKill from an application
crash (exit code 1 or non-zero application code).

---

## Sample Diagnosis Note

```
Incident: python-api 5xx spike 09:15–09:22 UTC during v1.9.0 rollout

Root cause: readinessProbe initialDelaySeconds (2s) was shorter than application warm-up
time (25s). New pods passed the readiness check and joined Service endpoints while the
application was still loading its model cache. Requests served during the 13-second gap
returned 503 from the app layer.

Compounding factor: maxUnavailable: 2 removed two old (healthy) pods before new pods
were confirmed stable. At peak, only 2 of 4 pods were actually serving correctly.

Evidence:
  kubectl rollout history --revision=2    →  delay=2s, failure=1
  kubectl get endpoints python-api-svc    →  showed 4 endpoints during impact window
  Application logs                        →  "cache not ready, rejecting request" for 13s

Fix: rolled back at 09:22. Applied v1.9.1 with startupProbe (30 * 2s window),
readinessProbe failureThreshold: 3, maxUnavailable: 0, maxSurge: 1.

Prevention: encode startupProbe requirements in Helm chart defaults; gate deploys on
rollout status check in CI pipeline before marking deployment complete.
```

---

## Common Mistakes

- **Confusing liveness and readiness.** Liveness restarts; readiness removes from
  endpoints. Misconfiguring them swapped causes either traffic errors (liveness doing
  readiness job) or zombie pods (readiness doing nothing).
- **Setting initialDelaySeconds too high.** Hiding startup delay with a large
  initialDelay means the pod is invisible to load for a long time. startupProbe is
  more correct.
- **maxUnavailable: 0 does not mean zero risk.** It prevents capacity reduction, but
  if new pods declare themselves ready falsely, traffic error rate still rises.
- **Missing change-cause annotation.** Without it, `rollout history` is useless for
  audit. Always annotate deploys.

---

## What To Study Next

- Kubernetes rollout strategies: RollingUpdate vs Recreate
- PodDisruptionBudgets and their interaction with HPA
- Container exit codes: 0, 1, 137, 143 — what each means
- `kubectl rollout pause` / `kubectl rollout resume` for canary gates
- Argo Rollouts and progressive delivery for more advanced traffic control
