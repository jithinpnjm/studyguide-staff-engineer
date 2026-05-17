---
title: "Cloud Networking Drill 4: Kubernetes And Cloud Networking Path"
sidebar_position: 99
---

# Cloud Networking Drill 4: Kubernetes And Cloud Networking Path

## Production Context

An internet client sends a request to `https://api.example.com/v1/infer`. The request
traverses: DNS resolution, a global load balancer, a WAF, a GKE or EKS cluster, a
Kubernetes Service, kube-proxy or eBPF routing, and lands on a pod. At each transition
there is a failure mode. Your job is to be able to explain every hop — what component
is responsible, what Kubernetes object is involved, and what a failure at each layer
looks like — as if answering a staff-level SRE interview question.

---

## Prerequisites

- No cloud account required for most of this drill
- For the hands-on exercises: a running GKE or EKS cluster, or a local kind/k3d cluster
- Tools: `kubectl`, `curl`, `dig`, `tcpdump` (inside a debug pod)

---

## Beginner Section: Mapping Every Hop End-To-End

### Step 1 — The full request path (GKE example)

```
[Internet client]
      |
      | DNS lookup: api.example.com
      v
[Cloud DNS / Route 53]           ← Returns Anycast IP (GCP) or ALB CNAME (AWS)
      |
      | HTTPS to Anycast IP
      v
[Global HTTPS LB / ALB]          ← Terminates TLS, runs WAF rules
      |
      | HTTP (unencrypted inside Google/AWS backbone, or re-encrypted)
      v
[NodePort or NEG backend]        ← Traffic enters the cluster node
      |
      | iptables / eBPF (kube-proxy or Cilium)
      v
[Service ClusterIP]              ← Virtual IP with no backing process; iptables/BPF rule
      |
      | Load-balanced to one of N endpoints
      v
[Pod IP: 10.244.3.7:8080]        ← Final destination
      |
      v
[Container process on port 8080]
```

Each arrow is a potential failure domain. Most incidents involve exactly one layer.

### Step 2 — DNS: what the cloud resolves and what the cluster resolves

**External DNS (before the cluster):**
```bash
dig api.example.com
```

Expected output pointing to a cloud LB:

```
;; ANSWER SECTION:
api.example.com.  300  IN  CNAME  k8s-infer-api-abcdef123-1234567890.us-east-1.elb.amazonaws.com.
k8s-infer-api-abcdef123-1234567890.us-east-1.elb.amazonaws.com.  60  IN  A  52.44.123.45
k8s-infer-api-abcdef123-1234567890.us-east-1.elb.amazonaws.com.  60  IN  A  52.44.67.89
```

Two A records means two ALB nodes in different AZs. A client picks one; connections are
sticky to that IP until DNS TTL expires or the connection drops.

**Internal cluster DNS (from inside a pod):**
```bash
kubectl run debug --image=nicolaka/netshoot --rm -it -- bash
# Inside the pod:
nslookup inference-api.default.svc.cluster.local
```

Expected output:

```
Server:         10.96.0.10
Address:        10.96.0.10#53

Name:   inference-api.default.svc.cluster.local
Address: 10.96.144.221
```

`10.96.0.10` is the CoreDNS ClusterIP. `10.96.144.221` is the inference-api Service
ClusterIP — a virtual IP that exists only in iptables/eBPF rules on every node. There
is no process listening on this IP.

The DNS name format: `<service>.<namespace>.svc.<cluster-domain>`. Pods in the same
namespace can use just `inference-api`. Cross-namespace requires the full form.

### Step 3 — How traffic enters the cluster

There are three patterns for getting external traffic into a Kubernetes cluster:

**Pattern A — NodePort (simple, not for production):**

Cloud LB forwards to a port (e.g. 32000) on any node IP. Every node listens on that
port via kube-proxy iptables rules and forwards to the right pod, even if the pod is
on a different node.

Drawback: source IP is NATed (pod sees node IP, not client IP). An extra hop occurs when
the target pod is not on the receiving node.

**Pattern B — LoadBalancer Service (L4, common for non-HTTP):**

```bash
kubectl get svc inference-api -o wide
```

Expected output:

```
NAME            TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)        AGE
inference-api   LoadBalancer   10.96.144.221   34.107.199.88   8080:31204/TCP  2d
```

Cloud creates a Network Load Balancer (AWS NLB or GCP passthrough LB) pointing to
node NodePorts. Works for TCP/UDP, but no L7 features (no path routing, no TLS
termination in the LB).

**Pattern C — Ingress + NEG (L7, production-grade):**

```bash
kubectl get ingress -n production
```

Expected output:

```
NAME              CLASS   HOSTS                   ADDRESS          PORTS   AGE
inference-ingress nginx   api.example.com         34.107.199.88    80,443  5d
```

An Ingress controller (NGINX, GKE Ingress, AWS Load Balancer Controller) watches
Ingress objects and configures the cloud LB or in-cluster reverse proxy. With GKE
native Ingress and NEGs, traffic goes from the cloud LB directly to pod IPs — no
NodePort hop.

### Step 4 — How Service and Endpoints choose the pod

```bash
kubectl get endpoints inference-api -n production
```

Expected output:

```
NAME            ENDPOINTS                                                  AGE
inference-api   10.244.1.8:8080,10.244.2.14:8080,10.244.3.7:8080          5d
```

The Endpoints object lists pod IPs and ports for all pods that:
1. Match the Service's `selector` labels
2. Pass their `readinessProbe`

When kube-proxy processes a packet destined for the ClusterIP (`10.96.144.221:8080`),
it picks one of these three endpoints via round-robin (iptables) or consistent hashing
(IPVS). In Cilium, the selection uses eBPF maps instead of iptables.

```bash
# See the iptables rules kube-proxy creates for this service
# Run on a node (not a pod)
iptables-save | grep inference-api
```

Expected output (abbreviated):

```
-A KUBE-SERVICES -d 10.96.144.221/32 -p tcp --dport 8080 -j KUBE-SVC-XYZABC123
-A KUBE-SVC-XYZABC123 -m statistic --mode random --probability 0.33333 -j KUBE-SEP-POD1
-A KUBE-SVC-XYZABC123 -m statistic --mode random --probability 0.50000 -j KUBE-SEP-POD2
-A KUBE-SVC-XYZABC123 -j KUBE-SEP-POD3
-A KUBE-SEP-POD1 -p tcp -j DNAT --to-destination 10.244.1.8:8080
-A KUBE-SEP-POD2 -p tcp -j DNAT --to-destination 10.244.2.14:8080
-A KUBE-SEP-POD3 -p tcp -j DNAT --to-destination 10.244.3.7:8080
```

The ClusterIP is a "virtual IP" — it is only represented as DNAT rules. No process
listens on `10.96.144.221`. This is important for debugging: `curl 10.96.144.221:8080`
from inside a pod works; `curl 10.96.144.221:8080` from outside the cluster fails,
because those iptables rules only exist on cluster nodes.

### Step 5 — Node-local dataplane behaviour

When a packet arrives at a node for a pod that lives on a different node, the traffic
is forwarded over the cluster network:

**Flannel (VXLAN):** Encapsulates pod packets in UDP. Pod traffic tunnels over the
underlying network. The overlay has overhead (50-byte VXLAN header per packet).

**AWS VPC CNI:** Pod IPs are real VPC IPs (from secondary ENI addresses). No tunnel
needed. The underlying VPC routes directly to the pod IP. Lower latency, but consumes
more VPC IP addresses.

**Cilium (eBPF):** Bypasses iptables entirely. eBPF programs attached to network
interfaces do the DNAT and routing at the kernel level. Better performance than
iptables for large services (thousands of endpoints), native NetworkPolicy with
identity-based matching, built-in observability (Hubble).

```bash
# Check which CNI is running
kubectl get pods -n kube-system | grep -E "cilium|flannel|aws-node|calico"
```

### Step 6 — The "cloud health looks good but users fail" failure pattern

This is a classic interview question. Set up the exact scenario:

```bash
# Create a service with a pod that is Running but not passing readiness
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shallow-health
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shallow-health
  template:
    metadata:
      labels:
        app: shallow-health
    spec:
      containers:
      - name: app
        image: nginx:1.25
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /ping         # shallow health endpoint — always 200
            port: 8080
          # No check of actual application readiness (model loaded, DB connected)
EOF
```

Cloud LB health check: hits `/ping` on port 8080 → `200 OK` → backend marked healthy.
User request: hits `/v1/infer` → app returns `503 Service Unavailable` because the
model is still loading.

The cloud LB health check passes. The cloud console shows "All backends healthy."
Users see errors. The health check is too shallow to detect the real application state.

```bash
# Observe the gap:
kubectl describe pod -l app=shallow-health | grep -A 5 "Readiness"
# Shows: http-get /ping → 200 OK → Ready: True

# But from inside the pod:
kubectl exec -it $(kubectl get pod -l app=shallow-health -o name | head -1) -- \
  curl -s http://localhost:8080/v1/infer
# Returns: 503 {"error": "model not loaded"}
```

Fix: add a deep health check that validates actual application state:

```yaml
readinessProbe:
  httpGet:
    path: /readyz    # endpoint that checks model loaded, DB connected, cache warm
    port: 8080
  initialDelaySeconds: 0
  periodSeconds: 10
  failureThreshold: 3
```

---

## Intermediate Section: Diagnose Without Full Hints

You observe:
- `kubectl get pods` shows all 3 replicas `Running` and `1/1 Ready`
- `kubectl get endpoints inference-api` shows 3 endpoints
- Cloud LB shows "All backends healthy"
- 5% of requests return 502 Bad Gateway from the LB

Questions without hints:

1. If pods are Ready and LB health checks pass, what causes intermittent 502s?
2. What is the graceful termination gap, and how does a pod being terminated during
   a rolling restart cause the LB to send traffic to it after the connection is refused?
3. Write the `preStop` hook and `terminationGracePeriodSeconds` values that solve this.
4. How does `minReadySeconds` in the Deployment spec complement probe configuration?

---

## Advanced / Stretch

**Scenario A — Session affinity and long-lived connections**

A user's WebSocket connection drops every few minutes during rolling restarts. Explain:
- How a LoadBalancer Service with `sessionAffinity: ClientIP` works
- Why sessionAffinity does not help for WebSocket connections through a cloud ALB
  (ALB's own connection draining is the right tool)
- What connection draining (`deregistrationDelay` on AWS, `connectionDrainTimeout` on GCP)
  does, and why setting it to 0 causes abrupt connection drops

**Scenario B — Cilium NetworkPolicy and identity-based routing**

With Cilium, policies are based on endpoint identity (pod labels + namespace), not IP
addresses. Explain:

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: allow-inference-ingress
spec:
  endpointSelector:
    matchLabels:
      app: inference-api
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: api-gateway
```

Why this is stronger than an IP-based NetworkPolicy (pod IPs are ephemeral and change
on every restart). What `cilium endpoint list` shows during a policy evaluation failure.
How `hubble observe --namespace production --verdict DROPPED` surfaces the blocked flows.

**Scenario C — Dual-stack and IPv6 services**

A Kubernetes service is created with:

```yaml
ipFamilyPolicy: RequireDualStack
ipFamilies: [IPv4, IPv6]
```

Explain: what two ClusterIPs are assigned, how CoreDNS serves both A and AAAA records,
and what breaks when a pod's host network node does not have IPv6 enabled.

---

## Sample Architecture Explanation (Interview-Ready)

```
End-to-end path: internet client → Kubernetes pod (GKE + Global HTTPS LB)

1. DNS: api.example.com → Anycast IP (34.107.x.x) from Cloud DNS. 300s TTL.
   Failure mode: stale cached DNS during LB IP change → clients hit old LB.

2. Global HTTPS LB (Google Front End):
   - Terminates TLS (certificate in Google Certificate Manager)
   - Runs Cloud Armor WAF rules
   - Routes to nearest healthy NEG backend
   Failure mode: no healthy NEG endpoints (readiness probe failing) → LB returns 502.

3. NEG (Network Endpoint Group, zonal):
   - Contains pod IPs directly (not node IPs)
   - LB health checks probe each pod independently on /readyz
   - Pods failing health check are removed from NEG within ~10s
   Failure mode: pod is Running and in Service endpoints, but NEG health check probes
   a different path that always 200s — classic shallow health check problem.

4. Kubernetes Service (ClusterIP):
   - Not in the request path when using NEG — the LB routes to pod IPs directly
   - Still used for cluster-internal east-west traffic
   Failure mode: Service selector mismatch → endpoints empty → internal clients get no response.

5. Pod:
   - Receives connection on containerPort 8080
   - terminationGracePeriodSeconds must exceed LB deregistration delay
   Failure mode: pod starts terminating, sends TCP RST → LB connection is abruptly closed
   → LB returns 502 to client. Fix: preStop sleep + graceful shutdown in app.

Key insight: "cloud health looks good but users fail" almost always means the health
check is too shallow. The LB probes /ping (always 200) while the real error is in
/v1/infer (503 model not loaded). Fix: make /readyz fail until the application is
truly ready to serve traffic.
```

---

## Common Mistakes

- **Treating ClusterIP as a real IP.** The ClusterIP has no process behind it. It is
  a virtual IP that exists only as DNAT rules in iptables or eBPF maps. Trying to
  debug it with `netstat` or `ss` on the node finds nothing.
- **Forgetting that NEG and kube-proxy are separate systems.** With GKE NEG, the cloud
  LB routes directly to pod IPs without going through kube-proxy DNAT. `kubectl get
  endpoints` still shows the right pods, but the traffic path is completely different.
- **Not accounting for LB deregistration delay during pod termination.** When a pod
  receives SIGTERM, it starts shutting down. But the cloud LB may continue sending
  traffic for 20-30 seconds until it deregisters the backend. Without a preStop sleep,
  the pod closes its socket and the LB returns 502 for all in-flight requests.
- **Health checking the wrong endpoint.** `/ping` and `/healthz` are commonly always-200.
  The readiness probe should check whether the application can actually serve its
  primary function (model loaded, downstream dependencies reachable).

---

## What To Study Next

- Kubernetes Service types and their cloud integrations (NodePort, LoadBalancer, Ingress)
- NEG vs NodePort traffic path: latency and source IP implications
- Cilium Hubble for network flow observability in production
- Connection draining and graceful pod termination for zero-downtime deploys
- Kubernetes EndpointSlice topology hints for latency-aware routing
- ExternalDNS: automating DNS record management from Kubernetes Service/Ingress objects
