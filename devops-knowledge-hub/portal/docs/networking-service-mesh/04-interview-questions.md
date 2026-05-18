---
title: "Interview Questions"
sidebar_position: 4
---

# Networking & Service Mesh — Interview Questions

20+ Q&A covering TCP vs UDP, DNS, mTLS, east-west traffic, service mesh tradeoffs, and cloud networking paths. Answers are written at staff/principal engineer level.

---

## Foundation Questions

**Q1: What is the difference between TCP and UDP? When would you choose each?**

TCP is a connection-oriented, reliable protocol. It establishes a three-way handshake (SYN → SYN-ACK → ACK) before transmitting data, guarantees ordered delivery, retransmits lost packets, and tracks connection state. This reliability comes at a cost: handshake latency, retransmission overhead, and per-connection state in the kernel.

UDP is connectionless and fire-and-forget. There is no handshake, no acknowledgment, no retransmission, and no ordering. This makes UDP lower latency but unreliable.

Choose TCP for anything where data integrity matters: HTTP, HTTPS, SSH, database connections, file transfers. Choose UDP for real-time applications where a stale retransmitted packet is worse than a missing one: DNS queries, VoIP, video streaming, online gaming, telemetry pipelines. DNS uses UDP by default but falls back to TCP for large responses.

---

**Q2: Walk me through the full DNS resolution chain for `api.example.com`.**

1. Client application calls the OS resolver (glibc, etc.)
2. OS checks its local DNS cache — if a valid record exists (TTL > 0), return it immediately
3. OS sends a query to the configured stub resolver (usually 127.0.0.53 on modern Linux with systemd-resolved, or an IP in `/etc/resolv.conf`)
4. Stub resolver forwards to a recursive resolver (corporate DNS, or 8.8.8.8, or 1.1.1.1)
5. Recursive resolver checks its cache. On a miss, it begins iterative resolution:
   - Queries a root nameserver (`.`) — responds with TLD servers for `.com`
   - Queries a TLD nameserver (`a.gtld-servers.net`) — responds with authoritative nameservers for `example.com`
   - Queries the authoritative nameserver (`ns1.example.com`) — returns the A record `api.example.com → 1.2.3.4`
6. Recursive resolver caches the answer (respecting the TTL) and returns it to the client
7. Client connects to `1.2.3.4`

Key insight: DNS success alone does not prove website health. DNS only proves name resolution. TCP, TLS, routing, and application health can all still fail.

```bash
dig api.example.com +trace    # shows the full delegation chain
```

---

**Q3: What is the TCP three-way handshake? Why does it matter for SRE?**

SYN → SYN-ACK → ACK. The client sends SYN (I want to connect). The server responds SYN-ACK (OK, also I want to connect to you). The client confirms with ACK.

SRE implications:
- Each step has a timeout. If SYN-ACK never arrives, the client retransmits SYN with exponential backoff (1s, 3s, 7s, 15s...). This is why a firewall DROP causes a very slow failure (timeout) while a REJECT causes an immediate failure (RST received).
- High `SYN_SENT` counts in `ss` output: server unreachable or port blocked
- High `SYN_RECV` counts: server received SYN but did not complete handshake — could indicate SYN flood DDoS or backlog exhaustion
- Firewall silently dropping SYN packets is the most common cause of "connection timed out" vs "connection refused" (REJECT or no listener)

---

**Q4: What is the difference between "connection timed out" and "connection refused"?**

**Connection timed out:** The SYN packet was sent, but no response arrived within the timeout. The host is either unreachable (routing problem) or a firewall is silently DROPping the packet. You will see the client retransmitting SYN with exponential backoff before giving up. TCP `tcpdump` shows repeated `[S]` flags with no `[S.]`.

**Connection refused:** The host received the SYN and replied with RST immediately. This means: the host is reachable AND the port has no listening process (or a REJECT firewall rule). Fast failure — the RST arrives almost instantly.

Diagnostic shortcut: if the failure is fast (< 1 second), it is likely REJECT or no listener. If the failure is slow (several seconds or at the connect-timeout), it is likely DROP or routing black hole.

---

**Q5: How does mTLS work, and why is it important in a microservices architecture?**

Standard TLS: only the server presents a certificate. The client verifies the server's identity, but the server does not verify the client. This provides confidentiality and server authentication but not client authentication.

mTLS (mutual TLS): both parties present X.509 certificates during the TLS handshake. The client verifies the server's cert; the server verifies the client's cert. Both parties must have a certificate issued by the same trusted CA (or a CA that the other side trusts).

In a service mesh like Istio, Istiod acts as the CA. Each pod's Envoy sidecar is issued a SPIFFE-format certificate (`spiffe://cluster.local/ns/production/sa/checkout-service`). When the checkout service calls the payment service, both Envoys present their certificates. The payment service's Envoy can check that the caller is the checkout service, not an arbitrary process inside the cluster.

Why it matters: without mTLS, any compromised pod inside the cluster can impersonate any service. With mTLS + AuthorizationPolicy, even a compromised pod is cryptographically locked out of services it should not call.

---

**Q6: What happens when you type `curl https://api.example.com` in a pod running in Kubernetes with Istio installed?**

1. **DNS:** Pod's resolver queries CoreDNS. CoreDNS looks up `api.example.com` — if it matches a Kubernetes Service, returns its ClusterIP. Otherwise, forwards to the upstream DNS configured for the cluster.

2. **Envoy intercepts outbound traffic:** The pod's iptables rules (set up by the Istio init container) redirect all outbound TCP to Envoy's port 15001. The application does not know Envoy exists.

3. **Envoy looks up the route:** Based on the destination host/port, Envoy finds a matching cluster from its xDS-provided configuration.

4. **mTLS:** Envoy initiates a mTLS connection to the destination service's Envoy. It presents its own certificate (issued by Istiod) and validates the destination's certificate.

5. **Traffic reaches the destination pod's Envoy** on port 15006 (inbound intercept). Envoy validates the caller's identity, applies any AuthorizationPolicy, then forwards to the local application port.

6. **HTTP request/response** travels over the established mTLS connection.

7. **Telemetry:** Both Envoys emit metrics (request count, latency, error rate) to Prometheus and traces to Jaeger/Zipkin.

---

## Cloud and Kubernetes Questions

**Q7: Explain the full path a request takes from the internet to a pod in an EKS cluster.**

```
Internet client
  → DNS lookup: api.example.com → ALB CNAME → ALB IP
  → TCP connect to ALB IP:443
  → TLS handshake with ALB (cert from ACM)
  → ALB applies routing rules (host/path match)
  → ALB health-checks backend: NodePort or target group (pod IP via target group mode)
  → ALB forwards to pod IP:8080 (in target group mode) or node:NodePort
  → If NodePort: node receives packet, kube-proxy DNAT to pod IP
  → Pod's application container
```

Failure at each layer:
- **DNS:** `nslookup api.example.com` fails — check Route 53
- **ALB health check failing:** backend pods not ready or health endpoint wrong
- **NodePort:** kube-proxy not running, iptables corrupted, or security group blocking
- **Pod:** pod crashing, readiness probe failing, application error

---

**Q8: Why can a pod IP work while the Service fails?**

When you `curl` a pod IP directly, you bypass kube-proxy DNAT and Kubernetes service machinery entirely. The packet goes directly to the pod.

When you `curl` the Service ClusterIP:
1. kube-proxy iptables rules DNAT the ClusterIP to a pod endpoint
2. kube-proxy must have up-to-date endpoint information from the API server
3. The Service's selector must match the pod's labels
4. The pod must pass its readiness probe to be in the Endpoints list

Common causes of "pod IP works, Service fails":
- Label selector mismatch (Service selects `app=my-app`, pod has `app=myapp`)
- Pod not ready (failing readiness probe → removed from Endpoints)
- kube-proxy not running on that node (iptables rules missing)
- Wrong targetPort in Service spec

```bash
kubectl get endpoints my-service    # are pod IPs listed?
kubectl describe svc my-service     # check selector
kubectl get pod -l app=my-app -o wide   # check labels
```

---

**Q9: What is the difference between a Security Group and a Network ACL in AWS?**

| | Security Group | Network ACL |
|---|---|---|
| State | Stateful — return traffic automatically allowed | Stateless — must explicitly allow return traffic both ways |
| Scope | Instance (ENI) level | Subnet level |
| Rules | Allow only | Allow and deny |
| Evaluation | All rules; most permissive wins | Rules in order by number; first match wins |

Both must allow traffic for it to pass. A security group with open port 443 but a NACL blocking port 443 → blocked. A NACL allowing 443 but security group not allowing it → also blocked.

**Critical mistake:** When adding a NACL allow rule for TCP 443 inbound, you must also add an outbound allow rule for ephemeral ports (1024-65535) — return traffic uses a random ephemeral port, and NACLs are stateless.

---

**Q10: What is east-west traffic and why does a service mesh help with it?**

East-west traffic is service-to-service communication within a cluster — as opposed to north-south (traffic entering or leaving the cluster from the internet).

In a microservices architecture, east-west traffic is often the majority of all network traffic. Service A calls Service B which calls Service C and Service D. Without a service mesh, each service must implement its own: TLS (for encryption), retry logic, circuit breakers, timeout handling, and metrics. This logic is duplicated in every service in every programming language.

A service mesh moves all of this to sidecar proxies. The application code is clean; the sidecar handles mTLS, retries, circuit breaking, and telemetry transparently.

---

**Q11: What are the tradeoffs of using a service mesh?**

**Benefits:**
- mTLS for all east-west traffic without application code changes
- Uniform observability: consistent metrics, traces, and access logs across all services
- Traffic management: canary deployments, A/B testing, traffic mirroring, fault injection
- Resilience patterns: retries, timeouts, circuit breakers at the infrastructure level

**Costs:**
- Resource overhead: each Envoy sidecar uses CPU and memory (typically 100-200MB per pod for Envoy)
- Added latency: double Envoy hop for every service-to-service call (usually < 1ms but non-zero)
- Operational complexity: new CRDs (VirtualService, DestinationRule, PeerAuthentication), new failure modes
- Debug complexity: packet inspection is harder when traffic is mTLS-encrypted; need `istioctl` tooling

**When NOT to use a service mesh:**
- Small clusters with 5-10 services — operational overhead outweighs benefit
- Resource-constrained environments (embedded, IoT) — Envoy per pod is too expensive
- Applications that already implement all required resilience patterns themselves

---

**Q12: What is a VirtualService and a DestinationRule in Istio? How do they differ?**

**VirtualService** defines how traffic is routed to a service. It controls routing logic: weight-based splitting (90/10 canary), header-based routing (beta users → v2), retries, timeouts, and fault injection. Think of it as "how do I route requests."

**DestinationRule** defines the configuration for how to reach a specific destination. It defines subsets (pod label groups = versions), load balancing algorithm, connection pool limits, and circuit breaker (outlier detection) settings. Think of it as "once I decide to route there, how do I connect."

They work together: VirtualService says "route 10% to subset v2," DestinationRule defines what "subset v2" means (pods with label `version: v2`) and how to load balance across them.

---

**Q13: How does kube-proxy implement Service load balancing?**

kube-proxy watches Kubernetes Services and Endpoints objects. For each Service, it creates iptables DNAT rules that redirect traffic from the ClusterIP to one of the pod endpoints.

Example for a Service with 3 pods:
```
ClusterIP 10.96.1.1:8080 → KUBE-SVC chain
  → 33.3% probability → DNAT to 10.244.1.8:8080
  → 50% probability (of remainder) → DNAT to 10.244.2.14:8080
  → remaining → DNAT to 10.244.3.7:8080
```

In iptables mode: O(n) rule traversal per packet. Performance degrades at scale (1000+ Services).  
In IPVS mode: kernel hash tables, O(1) lookup. Better at scale.  
With Cilium eBPF: eBPF maps, O(1) lookup, bypasses iptables entirely.

---

## Advanced Questions

**Q14: Why can nodes have spare CPU but pods stay Pending?**

Scheduling may be blocked by:
- **IP exhaustion:** No more pod IPs available (common with AWS VPC CNI — limited by ENI capacity per node)
- **Taints and tolerations:** Node has a taint the pod does not tolerate
- **Node affinity/anti-affinity:** Pod requires a label on the node that does not exist
- **Resource limits:** Pod requests more CPU/memory than any single node can provide
- **PodDisruptionBudget:** Scaling operations blocked by PDB constraints
- **Storage:** PersistentVolumeClaim not bound (volume not available in the node's AZ)
- **Quota:** Namespace resource quota exceeded

`kubectl describe pod <pending-pod>` shows the exact scheduling failure reason in the Events section.

---

**Q15: Explain Pod IP exhaustion in AWS EKS. How do you diagnose and fix it?**

AWS VPC CNI assigns real VPC IP addresses to pods using secondary IPs on ENIs. Each node type has a maximum number of ENIs and maximum IPs per ENI. For example, `m5.large` supports 3 ENIs × 10 IPs each = 30 pod IPs minus 1 for the node itself = 29 pods max.

**Symptoms:**
- New pods stuck in `Pending` despite node CPU/memory available
- CNI plugin logs: `failed to assign an IP address to container`
- `kubectl describe node` shows: `Allocatable.pods: 29` and all 29 are used

**Diagnostics:**
```bash
# Check pod capacity per node
kubectl describe node <node-name> | grep -A 5 "Allocatable"
kubectl describe node <node-name> | grep -A 5 "Non-terminated Pods"

# AWS ENI metadata
curl http://169.254.169.254/latest/meta-data/network/interfaces/macs/
```

**Fixes:**
- Use larger instance types (more ENIs allowed)
- Enable ENI prefix delegation: assign /28 prefixes (16 IPs) instead of individual IPs per ENI slot
- Enable IPv6 (effectively unlimited pod IPs)
- Reduce pod density with cluster autoscaler

---

**Q16: How does DNS work inside a Kubernetes cluster?**

CoreDNS runs as a Deployment in the `kube-system` namespace and is accessible as a ClusterIP service (typically `10.96.0.10`). Every pod's `/etc/resolv.conf` points to CoreDNS.

When a pod queries `my-service.my-namespace.svc.cluster.local`:
1. Pod sends DNS query to CoreDNS ClusterIP
2. CoreDNS looks up the Service in its in-memory cache of the Kubernetes API
3. Returns the Service's ClusterIP

Search domains in `/etc/resolv.conf`:
```
search my-namespace.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
```

This means a pod can use just `my-service` (short name) instead of the FQDN — the resolver appends search domains until it gets a match.

**DNS TTL for Services:** CoreDNS returns ClusterIP records with a TTL of 30 seconds. During a rolling restart, pods may briefly cache the old ClusterIP (which still routes correctly since ClusterIPs are stable). Endpoint IPs (pod IPs) change but are handled by kube-proxy, not DNS.

---

**Q17: What is the difference between VXLAN and native routing CNI modes?**

**VXLAN (overlay):** Pod packets are encapsulated in UDP, tunneled between nodes, and decapsulated at the destination node. Works on any underlying network that supports UDP. Overhead: ~50 bytes per packet header. Any node can reach any pod IP because VXLAN creates a virtual flat network on top of the physical network.

**Native routing (Calico BGP, AWS VPC CNI):** Pod IPs are real routable IPs. No encapsulation. The underlying network must know how to route to each pod CIDR — either via BGP advertisement (Calico) or via the cloud's native routing (AWS VPC CNI using VPC route tables).

**Tradeoffs:**

| | VXLAN overlay | Native routing |
|---|---|---|
| Network requirements | Any UDP network | BGP support or cloud-native routing |
| Overhead | 50-byte per packet | Zero |
| Latency | Slightly higher | Lower |
| MTU sensitivity | Must reduce pod MTU to accommodate encap | No change needed |
| Observability | Harder (outer packet hides pod IPs) | Direct visibility |

---

**Q18: How do you debug intermittent 502 errors from a Kubernetes Service?**

Intermittent 502s during normal operation often indicate a pod termination timing issue:

1. Pod receives SIGTERM (kubectl delete, rolling restart)
2. Pod starts shutting down — closes connections
3. Cloud LB or kube-proxy still has the pod registered as a healthy endpoint
4. LB sends new requests to the terminating pod → immediate RST or empty response → 502

Diagnosis:
```bash
# Check pod termination events
kubectl get events --sort-by='.lastTimestamp' -n production

# Check if 502s correlate with rolling restarts
kubectl rollout history deploy/my-app

# Check preStop hook and terminationGracePeriodSeconds
kubectl get deploy my-app -o yaml | grep -A 10 lifecycle
```

Fix:
```yaml
spec:
  containers:
  - lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # wait for LB to deregister
  terminationGracePeriodSeconds: 60  # must exceed LB deregistration delay
```

Other causes of intermittent 502:
- Shallow health check (LB marks pod healthy, but application returns errors)
- Connection pool exhaustion on the proxy
- Upstream application crash loop (pod crashes, ErrImagePull, OOMKilled)

---

**Q19: What is a circuit breaker in service mesh context? Explain the states.**

A circuit breaker is a pattern that prevents cascade failures. When a downstream service is failing, a circuit breaker stops sending requests to it rather than letting every upstream caller wait for timeouts.

**States:**
- **Closed (normal):** Requests flow to the backend. Errors are counted.
- **Open (tripped):** Error threshold exceeded. All requests fail fast without attempting the backend. Callers get an immediate error (503 or configured response) instead of waiting for timeout.
- **Half-open (probe):** After the ejection period, one request is allowed through. If it succeeds, the circuit closes. If it fails, it opens again for another period.

In Istio, the circuit breaker is configured via `outlierDetection` in `DestinationRule`:
- `consecutiveGatewayErrors: 5` — eject after 5 consecutive 5xx errors
- `interval: 10s` — evaluation window
- `baseEjectionTime: 30s` — minimum ejection duration (doubles each time, up to maxEjectionTime)
- `maxEjectionPercent: 50` — prevent ejecting all pods (would make things worse)

---

**Q20: An engineer says "the load balancer is healthy." Users are still seeing errors. How do you investigate?**

"Load balancer is healthy" usually means the health check endpoint returned 200. This is a shallow signal.

Investigation path:
1. Check what endpoint the health check probes — is it `/ping` (always 200) or `/readyz` (reflects actual application state)?
2. Test the actual user-facing path directly from a pod or curl:
   ```bash
   curl -v https://api.example.com/v1/actual-user-endpoint
   ```
3. Check pod readiness vs LB health check alignment — a pod can be `Ready` (passes readiness probe) but still return errors for specific endpoints
4. Check application logs for the specific error pattern
5. Check if the issue is intermittent (correlates with rolling restarts → preStop issue) or persistent (application bug)
6. Use `curl -w` timing to check which phase is slow (DNS, TCP, TLS, or server processing)

The "LB healthy, users fail" pattern almost always means the health check is testing a trivial endpoint while the real user path has a different dependency (database down, model not loaded, cache miss causing 503).

---

**Q21: How does a Network Load Balancer differ from an Application Load Balancer?**

| | NLB (L4) | ALB (L7) |
|---|---|---|
| Operates at | TCP/UDP layer | HTTP/HTTPS layer |
| Sees | IP + port | URL, headers, body |
| TLS | Pass-through or terminate | Terminate |
| Routing granularity | Per-connection | Per-request |
| Latency | Ultra-low (single digit ms) | Slightly higher (HTTP parsing) |
| Health checks | TCP or HTTP | HTTP with status code match |
| Use cases | gRPC, TCP databases, WebSocket, PrivateLink | HTTP APIs, microservices, path-based routing |
| Source IP preservation | Yes (client IP preserved to backend) | Requires X-Forwarded-For header |

**AWS PrivateLink requires NLB** — ALB is not supported as a PrivateLink endpoint service. If a customer wants to access your API privately, you must put an NLB in front even if you use ALB for your own routing.

---

**Q22: How do you design VPC network architecture for a multi-tier application?**

Three-tier model with clear network boundaries:

```
Zone 1 — Public edge:
  - Only the cloud LB has a public IP (ALB on AWS, Global HTTPS LB on GCP)
  - WAF sits in front for OWASP filtering
  - No application servers in the public subnet

Zone 2 — Private application tier:
  - App pods in private subnets (no public IP)
  - Egress via NAT Gateway for external API calls
  - Separate subnets for customer-facing vs internal admin paths
  - Admin access only via IAP (GCP) or Session Manager (AWS) — not SSH from 0.0.0.0/0

Zone 3 — Private data tier:
  - RDS, ElastiCache in isolated subnets
  - No route to internet (no NAT Gateway route)
  - Access only from Zone 2 application subnets via Security Group allow rules
  - VPC endpoints for cloud-native services (S3, GCS) — traffic never leaves backbone
```

Critical mistakes to avoid:
- Admin and customer traffic on the same load balancer (different ports is not enough)
- Databases in public subnets
- Security group `0.0.0.0/0` inbound on anything except the public LB port 443
- Forgetting egress controls — outbound DNS, HTTP, and HTTPS from every private workload should be scoped
