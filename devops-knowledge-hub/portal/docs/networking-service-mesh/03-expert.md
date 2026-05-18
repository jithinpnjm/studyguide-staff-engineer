---
title: "Expert"
sidebar_position: 3
---

# Networking — Expert

Advanced topics: BGP, eBPF networking, CNI internals, service mesh architecture, mTLS, traffic shaping, circuit breaking, iptables/ipvs, VXLAN/Geneve overlays, Envoy xDS, and L4/L7 load balancing tradeoffs.

---

## BGP — Border Gateway Protocol

BGP is the routing protocol that holds the internet together. It is a path-vector protocol that exchanges reachability information between autonomous systems (AS). Each AS is assigned a unique 16-bit or 32-bit ASN by IANA.

**iBGP vs eBGP:**
- **eBGP (external):** Between different autonomous systems. Internet-level routing. Peers at physical network boundaries.
- **iBGP (internal):** Within the same autonomous system. Full mesh or route reflectors.

**BGP in Kubernetes/cloud context:**
- **Calico** uses BGP to advertise pod CIDRs to physical network infrastructure — no overlay tunnel required, native L3 routing.
- **MetalLB** uses BGP to advertise LoadBalancer service IPs to upstream routers in bare-metal environments.
- **Cloud providers** use BGP for Direct Connect (AWS) / Interconnect (GCP) — on-prem routers exchange routes with cloud VPC routers.

```bash
# Calico BGP peering status
calicoctl node status

# MetalLB speaker logs (BGP sessions)
kubectl logs -n metallb-system -l component=speaker

# BGP route inspection (requires gobgp or birdc)
gobgp global rib
```

**BGP failure modes for SRE:**
- BGP session drops → route withdrawals → traffic blackhole (immediate)
- Route leak → traffic routed through wrong AS → latency spike or intercept
- ECMP imbalance in multi-path BGP → some paths overloaded

---

## eBPF Networking

eBPF (extended Berkeley Packet Filter) allows running sandboxed programs in the Linux kernel without modifying kernel source or loading kernel modules. In networking, eBPF programs attach to network interfaces and process packets at kernel speed, bypassing traditional network stacks.

**Why eBPF for networking:**
- Processes packets in kernel space — no context switch to userspace
- Bypasses iptables rule chains entirely (significant for thousands of Service endpoints)
- Enables L7-aware policies (filter by HTTP method or path, not just port)
- Per-connection observability with minimal overhead (Cilium Hubble)

**Cilium with eBPF:**

```bash
# Check Cilium is using eBPF (not iptables fallback)
kubectl exec -n kube-system cilium-xxxxx -- cilium status | grep "KubeProxyReplacement"

# Inspect eBPF maps for a service
kubectl exec -n kube-system cilium-xxxxx -- cilium service list

# Trace policy decisions
kubectl exec -n kube-system cilium-xxxxx -- cilium policy trace \
  --src-k8s-pod production/order-service \
  --dst-k8s-pod payments/payment-processor \
  --dport 8080

# Monitor dropped packets
kubectl exec -n kube-system cilium-xxxxx -- cilium monitor --type drop

# Hubble: observe flows
hubble observe --namespace production --verdict DROPPED
```

**eBPF vs iptables performance:** For clusters with 1000+ Services, iptables requires O(n) rule traversal per packet. eBPF uses hash maps — O(1) lookup regardless of rule count.

---

## CNI — Container Network Interface Deep Dive

CNI is the standard interface for Kubernetes networking plugins. When a pod is created, kubelet calls the CNI plugin binary to configure the pod's network namespace.

### CNI Responsibilities

1. Create a virtual network interface (veth pair) for the pod
2. Assign an IP address from the pod CIDR
3. Set up routing so the pod can reach other pods and the internet
4. Configure network policies (filtering)

### CNI Plugins Compared

| CNI | Dataplane | Overlay | Network Policy | L7 Policy | Performance |
|-----|-----------|---------|---------------|-----------|-------------|
| Flannel | iptables | VXLAN | No (needs Calico) | No | Low overhead, simple |
| Calico | iptables/eBPF | Optional (BGP preferred) | Yes | No | High; BGP avoids overlay |
| Cilium | eBPF | Optional (Geneve) | Yes | Yes (HTTP/gRPC) | Highest; bypasses iptables |
| AWS VPC CNI | iptables | None (native VPC IPs) | With Calico | No | Low latency; IP exhaustion risk |
| Weave | iptables | Encrypted VXLAN | Yes | No | Moderate |

### AWS VPC CNI — IP Exhaustion

AWS VPC CNI assigns real VPC IP addresses to pods via secondary ENI addresses. This means pods are first-class VPC citizens — no overlay, lower latency. The downside: pod density is limited by ENI IP capacity.

```
Node with 2 ENIs × 10 IPs each = 20 pod IPs max
(minus one for the node itself = 19 pods per node)
```

Symptoms of IP exhaustion:
- Pods stuck in `Pending` despite CPU/memory availability
- CNI error logs: `failed to assign an IP address to container`
- Nodes have capacity but cannot schedule new pods

Fixes:
- Use larger instance types (more ENI attachments allowed)
- Enable prefix delegation (assign /28 prefixes instead of individual IPs)
- Switch to IPv6 (near-unlimited pod IPs)

### VXLAN and Geneve Overlays

**VXLAN (Virtual Extensible LAN):** Encapsulates L2 Ethernet frames in UDP packets. Allows pods on different nodes to communicate as if on the same L2 segment. 50-byte header overhead per packet. Standard port: UDP 4789.

**Geneve:** More flexible than VXLAN — extensible metadata headers. Used by Cilium and OVS (Open vSwitch). Same UDP transport but better future-proofing.

**Overhead impact:** On a 1500-byte MTU network, VXLAN encapsulation reduces effective payload size. Large data transfers (model weights, large files) are affected. Ensure outer MTU is set appropriately or use jumbo frames (9000 bytes) where supported.

---

## iptables and ipvs

### iptables — Netfilter Rule Processing

iptables is Linux's packet filtering framework. Rules are organized in tables and chains:

**Tables:** `raw`, `mangle`, `nat`, `filter`, `security`  
**Chains:** `PREROUTING`, `INPUT`, `FORWARD`, `OUTPUT`, `POSTROUTING`

**Packet flow through chains:**
```
Incoming packet → PREROUTING → route decision
  → INPUT (if for local process)
  → FORWARD (if routing to another host)
Outgoing packet → OUTPUT → POSTROUTING → NIC
```

**kube-proxy iptables mode:** For each Kubernetes Service, kube-proxy creates iptables chains that DNAT packets destined for the ClusterIP to one of the pod endpoints using random probability weighting.

```bash
# View kube-proxy rules for a service (run on a node)
iptables-save | grep KUBE-SERVICES | grep <service-name>
iptables-save | grep "KUBE-SVC-" | head -30

# Count total iptables rules (performance indicator)
iptables-save | wc -l

# Show NAT table rules
iptables -t nat -L -n -v --line-numbers
```

**iptables performance degradation:** At 1000+ Services with multiple endpoints each, iptables rule count becomes very large. Every packet must traverse the rule chain. This is why Cilium (eBPF) and kube-proxy IPVS mode are preferred at scale.

### ipvs Mode

kube-proxy can use Linux IPVS (IP Virtual Server) instead of iptables. IPVS uses kernel-level hash tables for load balancing — O(1) lookup time regardless of service count.

```bash
# Check if kube-proxy is in ipvs mode
kubectl get configmap -n kube-system kube-proxy -o yaml | grep mode

# List IPVS virtual servers (run on a node)
ipvsadm -L -n

# Check IPVS stats
ipvsadm -L --stats
```

---

## Service Mesh Architecture — Istio and Linkerd

### What a Service Mesh Solves

Without a service mesh, each microservice must implement: TLS to encrypt traffic, retries to handle transient failures, circuit breaking to prevent cascade failures, metrics and distributed tracing for observability. This logic is duplicated across every service in every language.

A service mesh moves all of this into sidecar proxies running alongside each application container. The application sends unencrypted traffic to `localhost`; the sidecar handles everything else.

### Istio Architecture

**Data Plane:** Envoy sidecar proxies injected into every pod. Envoy intercepts all inbound and outbound traffic — the application is unaware.

**Control Plane (Istiod):** Single binary containing:
- **Pilot:** Service discovery and routing config pushed to Envoy via xDS APIs
- **Citadel:** Certificate authority for mTLS — issues and rotates X.509 certificates automatically
- **Galley:** Configuration validation and distribution

```
Pod with Istio:
  ┌─────────────────────────────────┐
  │  Application container          │
  │  (listens on localhost:8080)    │
  │                                 │
  │  Envoy sidecar (istio-proxy)    │
  │  - intercepts :15001 (outbound) │
  │  - intercepts :15006 (inbound)  │
  │  - terminates/initiates mTLS   │
  │  - applies retry/circuit break  │
  │  - emits metrics + traces       │
  └─────────────────────────────────┘
```

**Traffic interception:** iptables rules added to the pod's network namespace redirect all TCP traffic to Envoy's ports. The application binds to `:8080`; Envoy listens on `:15006` for inbound and `:15001` for outbound.

```bash
# Install Istio
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm install istio-base istio/base -n istio-system --create-namespace
helm install istiod istio/istiod -n istio-system --wait

# Enable sidecar injection for a namespace
kubectl label namespace production istio-injection=enabled

# Verify injection
kubectl get pod -n production -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.containers[*].name}{"\n"}{end}'

# Check Istio health
istioctl proxy-status
istioctl analyze
```

### Envoy xDS — Dynamic Configuration

Unlike NGINX which reads a static config file, Envoy pulls configuration dynamically from a control plane over gRPC. xDS is the API family:

| xDS API | What it configures |
|---------|-------------------|
| LDS (Listener Discovery Service) | Listeners — what ports Envoy accepts traffic on |
| RDS (Route Discovery Service) | Routes — how to match requests to clusters |
| CDS (Cluster Discovery Service) | Clusters — groups of upstream endpoints |
| EDS (Endpoint Discovery Service) | Endpoints — actual pod IPs and ports |
| SDS (Secret Discovery Service) | TLS certificates for mTLS |

When a new pod starts or stops, Istiod pushes updated EDS entries to all Envoy sidecars in the cluster — without any Envoy restart.

```bash
# Inspect Envoy config from inside the sidecar
istioctl proxy-config listener <pod>.<namespace>
istioctl proxy-config route <pod>.<namespace>
istioctl proxy-config cluster <pod>.<namespace>
istioctl proxy-config endpoint <pod>.<namespace>

# Check if Envoy is in sync with Istiod
istioctl proxy-status
```

### mTLS — Mutual TLS in Istio

Istiod's built-in CA issues X.509 certificates to every pod's Envoy sidecar. Certificates are mounted via SDS (Secret Discovery Service) and rotated before expiry. When Service A calls Service B:

1. Envoy in A initiates a TLS connection presenting its certificate (SPIFFE URI: `spiffe://cluster.local/ns/production/sa/checkout-service`)
2. Envoy in B validates A's certificate against Istiod CA
3. Both sidecars have established mutual identity — neither application knows TLS happened

**Enable strict mTLS cluster-wide:**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

**Namespace permissive mode (migration phase):**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: legacy
spec:
  mtls:
    mode: PERMISSIVE   # accepts both mTLS and plain HTTP
```

**Authorization Policy — restrict service-to-service calls:**
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-checkout-to-payments
  namespace: production
spec:
  selector:
    matchLabels:
      app: payment-service
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/production/sa/checkout-service
      to:
        - operation:
            methods: ["POST"]
            paths: ["/v1/charge"]
```

---

## Traffic Shaping and Circuit Breaking

### VirtualService — Routing Rules

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: my-app
spec:
  hosts:
    - my-app
  http:
    - match:
        - headers:
            x-user-group:
              exact: beta
      route:
        - destination:
            host: my-app
            subset: v2
    - route:
        - destination:
            host: my-app
            subset: v1
          weight: 90
        - destination:
            host: my-app
            subset: v2
          weight: 10
    retries:
      attempts: 3
      perTryTimeout: 2s
      retryOn: gateway-error,connect-failure,retriable-4xx
    timeout: 10s
```

### DestinationRule — Circuit Breaker

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: my-app
spec:
  host: my-app
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutiveGatewayErrors: 5
      interval: 10s
      baseEjectionTime: 30s    # eject unhealthy host for 30s
      maxEjectionPercent: 100
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

**Circuit breaker states:**
- **Closed:** Traffic flows normally. Errors are counted.
- **Open:** Error threshold crossed. All requests fail fast (no attempt to reach backend). Prevents cascade failures.
- **Half-open:** After ejection period, a probe request is sent. If it succeeds, circuit closes.

**Retry budget caution:** Unlimited retries at high load can cascade. If Service A retries 3x and Service B retries 3x, one failing request becomes 9 upstream attempts. Always set `perTryTimeout` smaller than the overall request timeout.

---

## Linkerd vs Istio

**Linkerd** is a lightweight CNCF service mesh using Rust-based micro-proxies (linkerd2-proxy). Key differences:

| Feature | Istio (Envoy) | Linkerd (linkerd2-proxy) |
|---------|---------------|--------------------------|
| Proxy language | C++ (Envoy) | Rust |
| Resource overhead | Higher (100-200MB per proxy) | Lower (10-20MB per proxy) |
| Config complexity | High (many CRDs) | Low (few CRDs) |
| mTLS | Manual PeerAuthentication | Automatic on injection |
| Fault injection | Yes | No |
| Traffic management | Rich (VirtualService, DR) | Basic (TrafficSplit) |
| L7 observability | Yes | Yes |

```bash
# Linkerd install
curl -sL run.linkerd.io/install | sh
linkerd check --pre
linkerd install | kubectl apply -f -
linkerd check

# Inject Linkerd proxy into a deployment
kubectl get deploy my-app -o yaml | linkerd inject - | kubectl apply -f -

# Linkerd dashboard
linkerd dashboard
```

---

## L4 vs L7 Load Balancing — Deep Tradeoffs

| Concern | L4 (TCP) | L7 (HTTP) |
|---------|----------|-----------|
| Visibility | Source IP, port, protocol | URL, headers, cookies, body |
| TLS | Pass-through or terminate | Terminate (can inspect content) |
| Routing granularity | Per-connection | Per-request |
| Overhead | Very low | Higher (HTTP parsing) |
| Stickiness | Connection-based | Cookie or header-based |
| Use for WebSocket | Natural (long-lived TCP) | More complex (upgrade required) |
| Use for gRPC | Works but blind | L7 proxy understands gRPC streams |
| Health check | TCP port open? | HTTP endpoint returns 200? |
| Examples | NLB, HAProxy TCP mode | ALB, NGINX, Envoy, Traefik |

**When L4 is better:** Raw throughput, TCP passthrough (e.g. database connections), very low latency requirements, TLS passthrough to maintain end-to-end encryption.

**When L7 is better:** Path-based routing, header-based canary routing, rate limiting per user, authentication at the edge, WebSocket / gRPC protocol awareness, content caching.

---

## East-West vs North-South Traffic

**North-South traffic:** Traffic entering or leaving the cluster from the internet. Handled by Ingress controllers, cloud load balancers, and API gateways.

**East-West traffic:** Traffic between services within the cluster. This is where service meshes add the most value — mTLS, circuit breaking, and retries for service-to-service calls.

**Service mesh tradeoff:** mTLS for east-west adds latency (TLS handshake, certificate operations). Modern Envoy implementations re-use TLS sessions so the per-request overhead is minimal after warmup. The security benefit — zero-trust between services — outweighs the small CPU cost at reasonable scale.

**Zero-trust network principle:** No implicit trust based on network location. A pod inside the cluster is not trusted just because it is inside the cluster. Every service-to-service call must be authenticated (mTLS) and authorized (AuthorizationPolicy). This eliminates the blast radius of a compromised pod.
