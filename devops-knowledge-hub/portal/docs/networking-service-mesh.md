---
title: "🌐 Networking & Service Mesh"
sidebar_position: 7
description: "Zero to hero study guide for Networking & Service Mesh — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Networking is the invisible glue holding distributed systems together. Latency, packet loss, DNS failures, and misconfigured firewall rules cause incidents that are notoriously hard to diagnose without deep networking knowledge. Service meshes are the modern answer to securing and observing service-to-service communication without modifying application code.

Staff/Principal impact:
- Network architecture decisions (VPC design, CNI choice) are permanent and expensive to undo
- Service mesh adoption is a platform decision that affects every team's observability and security
- Understanding TCP/IP enables diagnosing incidents that appear to be application bugs

---

## 📋 Prerequisites & Mental Models

**The OSI model is a debugging framework** — when something is broken, layer by layer investigation tells you where:
- L1 (Physical): is the cable connected?
- L2 (Data Link): ARP working, MAC resolution?
- L3 (Network): IP routing, subnets, firewall rules?
- L4 (Transport): TCP connection established? Port open?
- L7 (Application): HTTP status, DNS resolution, TLS handshake?

**TCP is not reliable, it's resilient** — TCP provides ordered, error-checked delivery via acknowledgment and retransmission. But TCP doesn't know why packets are lost (congestion, lossy link, firewall). High retransmit rates indicate a problem even if data eventually arrives.

**DNS is the name service, not a directory** — every network interaction starts with DNS. DNS failures or latency cascade into application failures. Understand the resolution chain.

---

## 🔷 Core Concepts

### TCP/IP Fundamentals

**IP addressing:**
- IPv4: 32-bit, dotted-decimal notation. Classes and CIDR replaced classful addressing.
- CIDR notation: `192.168.1.0/24` — the `/24` means 24 bits are the network, 8 bits are hosts → 254 usable hosts
- Private ranges (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16

**Subnetting in practice:**
- `/16` = 65,534 hosts (large VPC block)
- `/24` = 254 hosts (common subnet)
- `/28` = 14 hosts (small subnet for load balancers)
- `/32` = 1 host (single IP, used in security group rules)

**TCP three-way handshake:**
```
Client → SYN → Server
Client ← SYN-ACK ← Server
Client → ACK → Server
[Connection established]
```

**TCP connection states in production:**
- `ESTABLISHED`: active connection
- `TIME_WAIT`: connection closed, waiting 2×MSL (60s default) before reuse
- `CLOSE_WAIT`: remote side closed, local side hasn't yet — usually indicates an application bug
- `SYN_RECV`: SYN received, SYN-ACK sent, waiting for ACK — SYN flood indicator

**Key TCP tuning parameters:**
```bash
net.core.somaxconn = 65535          # listen backlog
net.ipv4.tcp_max_syn_backlog = 65535  # SYN queue size
net.ipv4.tcp_tw_reuse = 1           # reuse TIME_WAIT sockets
net.ipv4.tcp_keepalive_time = 60    # send keepalive after 60s idle
net.ipv4.tcp_keepalive_intvl = 10   # retry every 10s
net.ipv4.tcp_keepalive_probes = 6   # kill after 6 failed probes
```

### DNS

**Resolution chain:**
1. Local cache (browser, OS)
2. `/etc/hosts` (static overrides)
3. OS resolver cache
4. Recursive resolver (8.8.8.8, or VPC DNS at .2 address)
5. Root nameservers → TLD nameservers → authoritative nameservers

**DNS record types:**
- `A` — hostname → IPv4
- `AAAA` — hostname → IPv6
- `CNAME` — hostname → hostname (cannot be at zone apex)
- `MX` — mail exchange
- `TXT` — text (SPF, DKIM, domain verification)
- `SRV` — service discovery (port + priority + weight)
- `PTR` — reverse DNS (IP → hostname)

**TTL matters** — low TTL (60s) enables fast failover but increases DNS query load. High TTL (300s+) reduces load but slows failover. For critical records behind load balancers: 60s TTL.

**Kubernetes DNS (CoreDNS):**
Full FQDN: `service.namespace.svc.cluster.local`
Short names resolve based on search domains. The `ndots:5` default causes 5 lookups before falling back to the absolute name (major latency source at scale). Set `ndots: 2` for most workloads.

**CoreDNS configuration:**
```
.:53 {
    errors
    health
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
    }
    prometheus :9153
    forward . /etc/resolv.conf {
        max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

### Load Balancing

**L4 (Transport Layer):**
- TCP/UDP load balancing based on IP + port
- Does not inspect HTTP headers
- Stateless → fastest, lowest overhead
- NAT or DSR (Direct Server Return) mode
- Tools: AWS NLB, HAProxy in TCP mode

**L7 (Application Layer):**
- HTTP/HTTPS aware — routes by host, path, headers, cookies
- Can do SSL termination, HTTP/2 → HTTP/1.1 translation
- Adds latency (~1ms) for HTTP inspection
- Enables advanced routing: canary by header, blue-green by path
- Tools: AWS ALB, nginx, HAProxy, Envoy, Traefik

**Load balancing algorithms:**
- Round Robin: simple, equal distribution
- Least Connections: sends to server with fewest active connections (better for long-lived connections)
- IP Hash: consistent routing of same client to same server (session affinity)
- Random with Two Choices (Power of Two): pick 2 servers randomly, send to the less loaded one — near-optimal with low overhead
- Least Request: Envoy's default — tracks in-flight requests per upstream

**Health checks:** L4 = TCP connect; L7 = HTTP GET /health, checks response code and optionally body. Always implement a meaningful health endpoint — not just "TCP port is open."

### Proxies

**Forward proxy** — sits between client and internet. Client knows about the proxy. Use for: content filtering, corporate outbound control, caching.

**Reverse proxy** — sits in front of servers, client doesn't know about backend servers. Use for: load balancing, SSL termination, caching, auth, rate limiting. This is the pattern for nginx, Envoy, ALB.

**Transparent proxy** — intercepts traffic without client configuration. Used by service meshes (Envoy iptables interception), corporate firewalls.

### Container Networking

**Docker networking:**
- `bridge` (default): creates a Linux bridge, containers get private IPs, NAT to host network
- `host`: container shares host network namespace (no isolation, max performance)
- `overlay`: multi-host networking, used by Docker Swarm
- `macvlan`: container gets MAC and IP on physical network (L2 attachment)

**Kubernetes CNI (Container Network Interface):**
CNI plugins provide Pod networking. All CNI plugins must satisfy:
- Every Pod gets a unique IP
- Pods on the same node can communicate without NAT
- Pods on different nodes can communicate without NAT
- Pods can communicate with services via ClusterIP

**Common CNIs:**
| CNI | Key Feature | Use Case |
|-----|-------------|----------|
| Flannel | Simple, VXLAN overlay | Basic clusters, learning |
| Calico | NetworkPolicy enforcement, BGP routing | Production, security |
| Cilium | eBPF-based, L7 policies, Hubble observability | Advanced networking + observability |
| Weave | Simple mesh, encryption | Multi-cloud |

**Cilium with eBPF:** replaces iptables for routing and load balancing. eBPF programs run in kernel space, no network stack traversal. 3-5x less CPU for networking at high request rates. Native support for NetworkPolicies at L3/L4/L7.

### Service Mesh

A service mesh is an infrastructure layer that handles service-to-service communication — mTLS, load balancing, circuit breaking, retries, observability — without requiring application code changes.

**Sidecar model (Istio classic, Linkerd):**
- Envoy (Istio) or Linkerd-proxy injected into every Pod
- All traffic goes through proxy: intercepted by iptables `REDIRECT` rules
- Control plane pushes configuration to proxies (xDS protocol in Istio)
- Overhead: ~50-100ms p99 added latency, ~50MB RAM per proxy

**Ambient mesh (Istio 1.21+):**
- No sidecar injection
- ztunnel per node: handles mTLS and L4 policies for all pods on that node
- Waypoint proxy per service: handles L7 policies (only for services that need it)
- Overhead: ~5MB RAM per node (ztunnel), much less than per-pod sidecars

**Linkerd:**
- Simpler than Istio, lighter (Rust-based proxy)
- Opinionated: no traffic management features beyond retries/timeouts
- Excellent observability out of the box
- Choose Linkerd for mTLS + observability without complexity; Istio for traffic management features

**mTLS (mutual TLS):** both client and server present certificates, both verify each other. Provides:
- Encryption in transit
- Identity verification (this is the actual service, not an impostor)
- Works transparently — Istio handles certificate rotation via its CA

**Traffic management features (Istio VirtualService):**
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
spec:
  hosts: [myservice]
  http:
  - match:
    - headers: {x-canary: {exact: "true"}}
    route:
    - destination: {host: myservice, subset: v2}
  - route:
    - destination: {host: myservice, subset: v1}
      weight: 95
    - destination: {host: myservice, subset: v2}
      weight: 5
    retries:
      attempts: 3
      retryOn: gateway-error,connect-failure,retriable-4xx
    timeout: 10s
```

---

## 🛠️ Tools & Ecosystem

```bash
# Debugging
tcpdump -i eth0 -n 'port 80'    # capture HTTP traffic
tshark -r file.pcap             # analyze pcap file
dig @8.8.8.8 hostname A         # DNS query to specific server
nmap -p 1-1000 host             # port scan
mtr hostname                    # traceroute + ping combined
curl -v --http2 url             # test with verbose output + HTTP/2
openssl s_client -connect host:443 -servername host  # TLS inspection
ss -o state established '( sport = :443 )'           # connections on port 443

# Kubernetes networking
kubectl exec -it pod -- curl -v http://other-service  # test service connectivity
kubectl exec -it pod -- nslookup kubernetes.default    # DNS test
kubectl get networkpolicy -A                           # list all NetworkPolicies
cilium connectivity test                               # Cilium network validation
```

---

## 🏗️ Architecture Patterns

### VPC Design for Production

```
VPC: 10.0.0.0/16 (65,534 IPs)

Public subnets (one per AZ):
  10.0.0.0/24   us-east-1a  → Internet Gateway → internet
  10.0.1.0/24   us-east-1b
  10.0.2.0/24   us-east-1c
  Hosts: Load balancers, NAT Gateways

Private subnets (application layer):
  10.0.10.0/24  us-east-1a  → NAT Gateway → internet
  10.0.11.0/24  us-east-1b
  10.0.12.0/24  us-east-1c
  Hosts: EC2, EKS nodes, Lambda

Database subnets (no internet access):
  10.0.20.0/28  us-east-1a  → no internet route
  10.0.21.0/28  us-east-1b
  10.0.22.0/28  us-east-1c
  Hosts: RDS, ElastiCache
```

**Rules:**
- Database subnets have no route to internet (or NAT Gateway)
- Application subnets reach internet via NAT Gateway for egress (software updates)
- Public subnets only for resources that must have public IPs (ALBs, NAT Gateways)

### East-West Traffic Security

In Kubernetes, all Pods can talk to all Pods by default. Lock it down:

```yaml
# Default deny all in a namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: production
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# Allow specific service access
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
spec:
  podSelector:
    matchLabels: {app: api}
  ingress:
  - from:
    - podSelector:
        matchLabels: {app: frontend}
    ports:
    - protocol: TCP
      port: 8080
```

---

## ⚙️ Production Operations

### Diagnosing Latency

Latency investigation ladder:
1. Is it DNS? `dig +stats hostname` — check query time
2. Is it TCP? `curl -w "%{time_connect}" url` — connection time
3. Is it TLS? `curl -w "%{time_appconnect}" url` — TLS handshake time
4. Is it TTFB? `curl -w "%{time_starttransfer}" url` — time to first byte
5. Is it retransmit? `netstat -s | grep retransmit` — packet loss causing retransmit

### Connection Pool Management

Database connections are expensive. At scale:
- Pool connections per application instance (pgBouncer for Postgres, ProxySQL for MySQL)
- RDS max_connections = RAM(MB)/12.5 approximately — plan for this
- Monitor: active connections vs pool size vs wait queue
- Connection leak pattern: `CLOSE_WAIT` accumulation on the DB side

---

## 📊 Observability & Debugging

### Istio/Linkerd Metrics (Golden Signals)

```promql
# Request rate per service
sum(rate(istio_requests_total[1m])) by (destination_service)

# Error rate
sum(rate(istio_requests_total{response_code=~"5.."}[5m])) by (destination_service)
/ sum(rate(istio_requests_total[5m])) by (destination_service)

# p99 latency
histogram_quantile(0.99, sum(rate(istio_request_duration_milliseconds_bucket[5m])) by (le, destination_service))

# Linkerd success rate
sum(rate(response_total{classification="success"}[1m])) by (dst_service)
/ sum(rate(response_total[1m])) by (dst_service)
```

---

## 🔐 Security Considerations

**mTLS everywhere in production** — service mesh provides this transparently. Without mTLS, any process on the internal network can impersonate a service.

**NetworkPolicy as east-west firewall** — default deny, explicit allow. Test policies: `kubectl exec` + `curl` between pods to verify.

**TLS certificate management** — cert-manager automates Let's Encrypt and internal CA certificate issuance and renewal. Never manually manage TLS certs in production.

**DNS security:** DNSSEC prevents response spoofing. On AWS: Route 53 supports DNSSEC for public zones.

---

## 🎓 Staff/Principal Engineer Perspective

**Service mesh adoption is a platform decision** — don't let individual teams adopt different meshes. The platform team standardizes one mesh, provides the config, and ensures all services get onboarded. Half-adopted meshes miss the security and observability benefits.

**eBPF is the future of Kubernetes networking** — Cilium with eBPF provides better performance, richer observability (Hubble), and L7 network policies without sidecars. If starting a new cluster, default to Cilium.

**Understand your blast radius for network changes** — changing a Security Group affects all instances that use it. Changing a VPC route table affects all subnets. NetworkPolicies are namespace-scoped. Test in staging with production-like traffic before applying.

---

## 💥 Failure Modes & Incident Patterns

**DNS NXDOMAIN spike** — sudden increase in DNS failures. Cause: mis-configured service names, namespace changes, CoreDNS restart. Debugging: `kubectl logs -n kube-system -l k8s-app=kube-dns`.

**Connection pool exhaustion** — all DB connections taken, new requests queue and timeout. Symptom: application timeouts despite DB being healthy. Fix: pgBouncer, reduce connection per app instance, scale horizontally.

**Asymmetric routing** — packet goes one path, response comes back a different path through a stateful firewall that drops it. Symptom: one-way connectivity, SYN succeeds but no data flows. Fix: symmetric routing design.

**mTLS certificate expiry** — service mesh certificates expire and services stop communicating. Symptom: sudden 503s on all inter-service calls. Prevention: monitor certificate expiry, cert-manager auto-renewal.

---

## 💼 Interview Prep

**"A service has intermittent timeouts — how do you debug?"**
Layer-by-layer: DNS latency? TCP retransmits? TLS overhead? Application TTFB? Check `tcpdump` during incident, look at p99 not p50 (timeouts hide in tails), check service mesh metrics for the specific service pair.

**"Explain how a Kubernetes service request gets routed"**
DNS lookup (CoreDNS) → ClusterIP VIP → iptables DNAT rule (kube-proxy) or eBPF program (Cilium) → selected Pod IP via CNI routing.

---

## 📚 Key Takeaways

1. **DNS is always the first suspect** — measure DNS latency before assuming application is slow
2. **TCP TIME_WAIT is normal** — it prevents data corruption; don't try to eliminate it, tune `tw_reuse`
3. **NetworkPolicy default-deny is your east-west firewall** — the default allow-all is a lateral movement vulnerability
4. **mTLS via service mesh** — encryption + identity verification without code changes
5. **CNI choice determines what networking features are available** — Cilium opens capabilities that Flannel cannot
6. **L4 vs L7 load balancing trade-offs** — L4 is faster, L7 is smarter; use both appropriately
7. **Understand the search domain penalty** — ndots:5 is 5 DNS lookups for every hostname at scale
8. **Connection pools are not optional at scale** — direct DB connections in each app instance do not scale
9. **VPC CIDR blocks are permanent** — plan for 5 years of growth; exhaustion is painful to fix
10. **Service mesh is a platform decision** — standardize one, onboard all services, partial adoption misses the value



---
