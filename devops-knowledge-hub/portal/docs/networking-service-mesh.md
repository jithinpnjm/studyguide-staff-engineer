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

## 📁 Source Documents

> 16 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Networking] 1738955510720](http://localhost:8765/api/documents/33d80aff-b17b-495d-9396-1fe2254e9923/view) | GIF | beginner |
| [[Networking] 1739452806105](http://localhost:8765/api/documents/0a3f8d11-c6e8-4ba9-8028-2468793ffedb/view) | PDF | intermediate |
| [[Networking] 1739673064982](http://localhost:8765/api/documents/d1ce8ada-060b-4933-9c3d-a4c1199ed76e/view) | PDF | intermediate |
| [[Networking] 1740977831021](http://localhost:8765/api/documents/407de76a-63db-4631-9478-67f2a4aedc3e/view) | PDF | intermediate |
| [[Networking] 1741058781601](http://localhost:8765/api/documents/767ff50d-7255-43ee-abfd-1c495882c2c1/view) | GIF | intermediate |
| [[Networking] 1741181628357](http://localhost:8765/api/documents/d5771dce-c34f-450a-bf37-4f792cddb071/view) | GIF | beginner |
| [[Networking] 1741621496189](http://localhost:8765/api/documents/c4f10060-ec9b-4ef1-998a-7b94863c2ab9/view) | PDF | beginner |
| [[Networking] 1741812166393](http://localhost:8765/api/documents/8e182cf1-c776-48d5-bed5-24f0269d8352/view) | PDF | intermediate |
| [[Networking] 1741952549699](http://localhost:8765/api/documents/42bc85cc-96ba-4518-b0d1-e258088b5845/view) | PDF | intermediate |
| [[Networking] 1742142781707](http://localhost:8765/api/documents/988093a7-b44b-43fd-a07d-f38b4215de43/view) | GIF | intermediate |
| [[Networking] 1742451526995](http://localhost:8765/api/documents/12b69ffa-21ed-416e-bb5e-0022e51b8d1e/view) | PDF | intermediate |
| [[Networking] 1742703649267](http://localhost:8765/api/documents/6cacfd3e-3a09-4e61-8a7d-ff745ee56f14/view) | PDF | intermediate |
| [[Networking] 1742917401613](http://localhost:8765/api/documents/ac724d76-b8d2-420e-9c50-2d894f78ae84/view) | PDF | intermediate |
| [[Networking] 1743956653585](http://localhost:8765/api/documents/a0935b00-b313-439d-9d6d-ef8398d99c96/view) | GIF | beginner |
| [[Networking and Load Balancing] 1741300806823](http://localhost:8765/api/documents/81a85cfd-c6c6-445e-9e94-98220616247a/view) | PDF | intermediate |
| [[Forward proxy VS Reverse proxy] 1741925310987](http://localhost:8765/api/documents/42969fe7-cb97-4a7b-8662-b6a7878e1794/view) | JPG | intermediate |


<AIChatWidget domain="networking-service-mesh" title="Ask AI about Networking & Service Mesh" />

---

## [SRE] Foundations: Networking Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Networking Premium Teaching Guide For SRE And Platform Engineers

Networking is how systems talk.

Every web request, database query, SSH login, Kubernetes service call, API integration, CDN fetch, and cloud control-plane action depends on networking.

When networking feels unclear, production incidents feel random. When networking is understood, outages become traceable systems.

This guide teaches networking from zero to advanced level for SRE, DevOps, Platform, and Cloud Engineers.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — understand packets, IPs, ports, DNS, TCP.
2. **Intermediate Layer** — routing, NAT, firewalls, TLS, HTTP flow.
3. **Advanced Layer** — MTU, conntrack, retries, load balancers, latency.
4. **Production SRE Layer** — debug real incidents quickly.
5. **Interview Layer** — explain packet paths clearly like a senior engineer.

---

## Memory Palace: Networking Is An Airport + Highway System

| Networking Concept | Analogy | Real Meaning |
|---|---|---|
| IP Address | Street address / gate | Device location |
| Port | Office room number | Specific application |
| Packet | Envelope / luggage | Unit of data |
| Router | Traffic junction | Chooses next hop |
| DNS | Directory desk | Name → IP lookup |
| TCP | Signed courier | Reliable delivery |
| UDP | Postcard | Fast but no guarantee |
| Firewall | Security checkpoint | Allow/deny traffic |
| Load Balancer | Dispatcher desk | Spread traffic |
| NAT | Shared receptionist | Many private users share one public identity |
| TLS | Sealed armored envelope | Encrypted communication |

Whenever traffic fails, ask: did it fail at the directory desk, checkpoint, road, dispatcher, room number, or application itself?

---

## Beginner Layer: What A Network Actually Is

A network is devices exchanging data through agreed rules (protocols).

Examples:

- Your laptop → website
- Pod → database
- CI runner → GitHub
- API service → payment provider

All of these send data in small chunks called **packets**.

---

## Beginner Layer: IP Address Explained

An IP address identifies a host on a network.

Examples:

```text
192.168.1.10
10.0.4.23
172.31.18.90
8.8.8.8
```

### Private IP Ranges

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

Used internally.

### Public IP

Reachable on the internet.

---

## Beginner Layer: Ports Explained

One machine can run many services. Ports separate them.

| Port | Typical Use |
|---|---|
| 22 | SSH |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |

Example:

```text
10.0.0.5:443
```

Means host `10.0.0.5`, service HTTPS.

---

## Beginner Layer: DNS Explained

Humans prefer names like `api.company.com`. Machines need IPs.

DNS converts names to IPs.

```bash
dig api.company.com
nslookup api.company.com
```

---

## Beginner Layer: Packet Journey

```text
Browser
-> DNS lookup
-> TCP connect
-> TLS handshake
-> HTTP request
-> Server response
```

One click crosses multiple systems.

---

## Intermediate Layer: TCP Handshake

```text
Client -> SYN
Server -> SYN-ACK
Client -> ACK
```

Then data flows.

Reliable means:

- ordered
- retransmitted if lost
- connection state tracked

Use TCP for web, DBs, SSH.

---

## Intermediate Layer: UDP

UDP sends without connection setup.

Use for:

- DNS (often)
- streaming
- telemetry

Fast, but no guarantee.

---

## Intermediate Layer: Routing

Hosts need to know where packets go.

```bash
ip route
```

Example:

```text
default via 10.0.0.1
10.0.0.0/24 dev eth0
```

Meaning:

- local subnet stays local
- unknown traffic goes to gateway

---

## Intermediate Layer: NAT

Many private hosts share one public IP.

```text
10.0.0.5 -> NAT Gateway -> 34.x.x.x
10.0.0.6 -> NAT Gateway -> 34.x.x.x
```

Useful for conserving public IPs.

---

## Intermediate Layer: Firewalls

Firewalls allow or block traffic.

Examples:

- Security Groups
- NACLs
- iptables
- nftables

Timeout often means drop. Refused often means host reached but no listener.

---

## Intermediate Layer: HTTP vs HTTPS

HTTP = plain text.

HTTPS = HTTP inside TLS.

```text
TCP -> TLS -> HTTP
```

Provides confidentiality, integrity, identity.

---

## Intermediate Layer: Useful Commands

```bash
ping host
traceroute host
tracepath host
curl -v https://site.com
dig site.com
ss -lntp
ss -tanp
tcpdump -i any port 443
```

---

## Advanced Layer: Latency Thinking

Latency can come from:

- DNS lookup
- TCP handshake
- TLS handshake
- server processing
- DB calls
- response transfer

Use:

```bash
curl -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' -o /dev/null -s https://example.com
```

---

## Advanced Layer: MTU

Maximum packet size. Often 1500.

Mismatch can cause:

- large uploads fail
- VPN weirdness
- intermittent slowness

---

## Advanced Layer: Retransmissions

If packets are lost, TCP retries. This increases latency.

Causes:

- congestion
- bad link
- overloaded host
- policy issues

---

## Advanced Layer: Conntrack

Linux tracks active connections.

If table fills:

- new connections fail
- old ones continue

Very common under spikes.

---

## Advanced Layer: Load Balancers

### L4

TCP/UDP.

### L7

Understands HTTP paths, headers, TLS.

Examples:

- ALB
- NGINX
- Envoy

---

## Production SRE Layer: Troubleshooting Flow

### Step 1 DNS

```bash
dig host
```

### Step 2 Reachability

```bash
ping IP
traceroute IP
```

### Step 3 Port Open?

```bash
nc -vz host 443
```

### Step 4 Protocol

```bash
curl -v https://host
openssl s_client -connect host:443
```

### Step 5 Local State

```bash
ss -tanp
ip route
```

---

## Real Incident Stories

### Website Down

Check:

```bash
dig site.com
curl -v https://site.com
```

Possible causes:

- DNS outage
- LB unhealthy
- TLS expired
- backend 500s

### SSH Timeout

```bash
nc -vz host 22
```

Possible causes:

- route
n- firewall
- sshd dead

### Old Connections Work, New Fail

Likely:

- conntrack exhaustion
- SYN backlog full
- ephemeral ports exhausted

---

## Kubernetes Networking Layer

```text
Pod IP
Service ClusterIP
Ingress
CNI
NetworkPolicy
```

Traffic path:

```text
Internet -> Cloud LB -> Node/Pod -> Service -> Pod
```

---

## Interview Layer: Strong Answers

### How does request reach a website?

> DNS resolves the hostname. Client opens TCP, negotiates TLS, sends HTTP request, traffic may pass through LB/CDN, backend responds.

### Timeout vs Refused?

> Timeout usually means drop/unreachable. Refused means host reachable but no listener.

### Why DNS success not enough?

> DNS only proves name resolution. TCP, TLS, routing, and app health can still fail.

---

## Labs

### Beginner

- run `dig google.com`
- run `curl -v https://google.com`
- inspect `ip route`

### Intermediate

- run local web server
- inspect with `ss -lntp`

### Advanced

- packet capture with tcpdump
- simulate firewall block
- inspect conntrack usage

---

## Recall Prompts

- What is IP vs port?
- Why use NAT?
- Why can old connections work while new fail?
- Why does DNS success not prove website health?

---

## Senior Summary

> Networking problems become easier when broken into layers: DNS, routing, transport, TLS, and application behavior. I debug from the lowest uncertain layer upward using evidence, not assumptions.

---

## [SRE] Foundations: Cloud Networking And Kubernetes Networking Premium Teaching Guide

## Foundations: Cloud Networking And Kubernetes Networking Premium Teaching Guide

Most production networking incidents happen at the boundary between cloud networking and Kubernetes networking.

Cloud providers own VPCs, subnets, routes, firewalls, NAT, and load balancers. Kubernetes owns Pod networking, Services, Ingress intent, and cluster traffic policy.

This guide teaches both layers as one operational system.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — VPCs, subnets, Services, Ingress, Pod IPs.
2. **Intermediate Layer** — AWS/EKS, GCP/GKE, NAT, DNS, health checks.
3. **Advanced Layer** — direct Pod routing, IP exhaustion, egress control, flow logs.
4. **Production SRE Layer** — 502s, blocked traffic, one-node failures.
5. **Interview Layer** — explain packet paths clearly across both layers.

---

## Memory Palace: Two Road Systems

| Layer | Analogy | Meaning |
|---|---|---|
| Cloud Network | City highways | VPC, subnets, routes, LB |
| Kubernetes Network | Building hallways | Pod-to-Pod and Service traffic |
| NAT | Toll gate | Outbound shared egress |
| Security Group | Gate guard | Stateful allow policy |
| NetworkPolicy | Internal room rules | Pod traffic control |
| Ingress | Reception desk | External HTTP routing |

---

## Beginner Layer: Two Networks, One Request

```text
Internet
 -> DNS
 -> Cloud Load Balancer
 -> VPC firewall / route
 -> Node or Pod target
 -> Service datapath
 -> Pod
```

Each hop can fail independently.

Senior habit:

> Always ask which layer owns the broken hop.

---

## Beginner Layer: Cloud Basics

### VPC

Private network boundary.

### Subnet

Smaller IP range, often AZ scoped.

### Route Table

Chooses next hop.

### NAT Gateway / Cloud NAT

Lets private workloads initiate outbound traffic.

### Load Balancer

Distributes inbound traffic.

---

## Beginner Layer: Kubernetes Basics

### Pod IP

Workload network identity.

### Service

Stable virtual access to changing Pods.

### Ingress

HTTP/HTTPS routing intent.

### CNI

Makes Pod networking real.

### NetworkPolicy

Controls Pod traffic rules.

---

## Intermediate Layer: AWS / EKS Thinking

Common pattern:

```text
public subnets  -> ALB / NAT
private subnets -> worker nodes
private data    -> DB/cache
```

Important truths:

- AWS VPC CNI often gives Pods VPC IPs
- Pod density can be limited by IP capacity
- ALB integrates through controllers
- security can exist at node or Pod level depending on design

---

## Intermediate Layer: GCP / GKE Thinking

Common pattern:

- global VPC
- regional subnets
- separate ranges for nodes, Pods, Services
- load balancers can target Pods directly via NEGs

Benefits of direct Pod targets:

- per-Pod health checks
- cleaner traffic path
- reduced NodePort indirection

---

## Intermediate Layer: Health Checks Must Agree

Bad pattern:

```text
LB health endpoint says OK
real user requests fail
```

Better alignment:

- startup probe: boot complete
- readiness: safe for traffic
- liveness: restart if stuck
- LB health path reflects meaningful readiness

---

## Intermediate Layer: DNS Across Layers

Possible DNS systems:

- CoreDNS inside cluster
- private cloud DNS zones
- public DNS
- upstream resolvers

If apps say “host not found,” determine which DNS layer failed.

---

## Advanced Layer: Pod IP Exhaustion

Common in cloud CNI models.

Symptoms:

- Pods Pending
- CNI errors
- nodes have CPU/memory free but no new Pods start

Fix options:

- more subnet space
- larger node types
- prefix delegation
- autoscaling
- alternate networking design

---

## Advanced Layer: Egress Design

```text
Pod -> CNI datapath -> route -> NAT or endpoint -> external API
```

Common failures:

- blocked DNS
- NetworkPolicy deny
- missing route
- NAT exhaustion
- firewall deny
- vendor allowlist mismatch

Stable egress IPs matter for partner integrations.

---

## Advanced Layer: Security Layers

A connection may require both:

1. Cloud firewall / SG allow
2. Kubernetes NetworkPolicy allow

If one denies, traffic fails.

---

## Advanced Layer: Evidence Sources

Use the right layer evidence.

| Layer | Evidence |
|---|---|
| Pod | curl, nslookup, ss |
| Cluster | kubectl describe, events, EndpointSlice |
| Node | ip route, tcpdump, conntrack |
| Cloud | flow logs, LB target health, route tables |

---

## Production SRE Layer: Real Incidents

### External Users Get 502

Check:

- LB target health
- Ingress rules
- Service endpoints
- readiness
- app logs

### Pods Cannot Reach Internet

Check:

- DNS
- NetworkPolicy
- NAT
- routes
- vendor allowlist

### Only One Node Broken

Check:

- CNI on that node
- node routing
- conntrack
- ENI/NIC state

### Pod IP Works, Service Fails

Check:

- Service selectors
- EndpointSlice
- kube-proxy/eBPF datapath

### LB Healthy, Users Still Fail

Often shallow health checks.

---

## Production SRE Layer: Troubleshooting Order

1. Scope impact.
2. Determine failing layer.
3. Test direct path vs abstracted path.
4. Inspect control-plane objects.
5. Inspect network evidence.
6. Mitigate safely.

---

## Interview Layer: Strong Answers

### VPC vs Kubernetes networking?

> VPC networking connects nodes and cloud resources. Kubernetes networking connects Pods and Services on top of that infrastructure.

### How does traffic reach a Pod?

> DNS resolves name, cloud LB receives traffic, routes through VPC policy to node or Pod target, Kubernetes datapath forwards to a ready Pod.

### Why can nodes have spare CPU but Pods stay Pending?

> Scheduling may be blocked by IP exhaustion, taints, storage, quotas, or affinity constraints.

### Why can LB be healthy while users fail?

> Health checks may be shallow and not validate real dependencies or user paths.

---

## Labs

### Beginner

1. Draw internet-to-Pod packet path.
2. Inspect Service and endpoints.
3. Test DNS inside Pod.

### Intermediate

1. Break Service selector and repair.
2. Block egress with NetworkPolicy.
3. Inspect target health.

### Advanced

1. Simulate Pod IP exhaustion.
2. Read flow logs.
3. Design private cluster CI path.
4. Compare node target vs Pod target models.

---

## Memory Review

- Why are there two networking layers?
- Why can Pod IP work while Service fails?
- Why do private clusters complicate CI/CD?
- Why do flow logs matter?
- Why should health checks be meaningful?

---

## Senior Summary

> I separate cloud networking from Kubernetes networking first. For incidents I trace DNS, load balancer, firewall, route, target health, Service endpoints, cluster datapath, and application readiness. I use logs and packet evidence from the owning layer instead of guessing.

---

## [SRE] HTTP, APIs, and Reverse Proxy Paths

## HTTP, APIs, and Reverse Proxy Paths

### What It Is and Why It Matters

HTTP is the protocol of the modern web and APIs. Understanding HTTP deeply — not just GET/POST, but connection lifecycle, TLS handshake, headers, caching semantics, and status codes — is fundamental to debugging any web-facing service.

Reverse proxies sit in front of application servers. They handle TLS termination, load balancing, rate limiting, authentication, request routing, and observability. NGINX, Envoy, HAProxy, and Traefik are the most common in production environments. Kubernetes Ingress controllers are typically just managed configurations of these.

Understanding how a request flows from a user's browser through DNS, load balancers, TLS termination, reverse proxy, and into an application — and where it can fail at each step — is the core mental model for diagnosing production HTTP problems.

---

### Mental Model: The Request Path

```
User browser
    → DNS lookup (A/AAAA record → IP)
    → TCP connection (3-way handshake)
    → TLS handshake (ClientHello → ServerHello → certificate → key exchange)
    → HTTP request (GET /api/checkout HTTP/1.1)
    → Load balancer (L4: TCP; or L7: HTTP)
    → Reverse proxy / Ingress (NGINX, Envoy)
        → TLS termination (if not already done)
        → Request routing (path/header match → upstream)
        → Health check (is upstream healthy?)
        → Connection pool → backend pod
    → Application (processes request)
    → Response travels the same path back
```

Each hop is a potential failure point. When debugging HTTP issues, walk this path and check each layer.

---

### HTTP Fundamentals

#### Request Structure

```
GET /api/v1/users/123 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Accept: application/json
Content-Type: application/json
Connection: keep-alive
```

Key headers:
- `Host`: identifies which virtual host on the server (mandatory in HTTP/1.1)
- `Authorization`: bearer token, basic auth, etc.
- `Content-Type`: format of the request body
- `Accept`: formats the client can handle
- `Connection: keep-alive`: reuse TCP connection (HTTP/1.1 default)

#### Response Status Codes

| Range | Meaning | Key codes |
|-------|---------|-----------|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

**502 vs 503 vs 504:**
- 502 Bad Gateway: proxy received an invalid response from the upstream (upstream crashed or returned garbage)
- 503 Service Unavailable: no healthy upstream available (all backends down, or upstream explicitly returned 503)
- 504 Gateway Timeout: proxy waited for upstream to respond, timed out

#### HTTP/1.1 vs HTTP/2 vs HTTP/3

**HTTP/1.1:** One request per connection at a time. Workaround: multiple connections (browsers open 6-8 per domain). Head-of-line blocking: a slow request blocks all subsequent requests on that connection.

**HTTP/2:** Multiplexing — multiple requests over one TCP connection via streams. Binary framing (not text). Header compression (HPACK). Server push (server sends resources before client asks). Still has TCP head-of-line blocking at the transport layer.

**HTTP/3:** Built on QUIC (UDP-based). Solves TCP head-of-line blocking. Better performance on lossy networks. Stream-level multiplexing without transport-layer blocking.

In practice: most backend-to-backend traffic is HTTP/1.1 or HTTP/2. HTTP/3 is primarily between clients and CDN edges.

#### TLS Handshake

```
Client                          Server
  |                               |
  |--- ClientHello ─────────────>|  (TLS version, cipher suites, random)
  |<── ServerHello ─────────────|  (chosen cipher suite, random, certificate)
  |<── Certificate ─────────────|  (server's public key)
  |<── ServerHelloDone ─────────|
  |--- ClientKeyExchange ───────>|  (pre-master secret, encrypted with server's public key)
  |--- ChangeCipherSpec ────────>|
  |--- Finished ────────────────>|
  |<── ChangeCipherSpec ─────────|
  |<── Finished ─────────────────|
  |                               |
  |=== Encrypted application data =|
```

TLS 1.3 simplifies this to 1-RTT (or even 0-RTT for resumed sessions).

Certificate verification:
1. Client checks the certificate's Common Name (CN) or Subject Alternative Names (SANs) match the hostname
2. Client checks the certificate hasn't expired
3. Client verifies the certificate chain up to a trusted CA in its trust store

Common TLS errors:
- `SSL_ERROR_RX_RECORD_TOO_LONG`: TLS port is actually serving HTTP (usually misconfigured backend)
- `certificate has expired`: self-explanatory; check cert expiry in CI
- `hostname mismatch`: cert is for `api.example.com`, request is to `backend.internal`
- `CERTIFICATE_VERIFY_FAILED`: cert chain can't be verified (missing intermediate, self-signed, wrong root CA)

---

### REST API Design Principles

#### Resource-Oriented Design

Good REST APIs treat resources as nouns, not actions:

```
# Good — resources as nouns
GET    /users/123          → get user
POST   /users              → create user
PUT    /users/123          → replace user
PATCH  /users/123          → partial update
DELETE /users/123          → delete user

# Bad — actions as verbs
POST /getUserById
POST /createNewUser
POST /deleteUser
```

HTTP verbs carry semantic meaning:
- `GET`: safe (no side effects), idempotent (multiple identical requests = same result)
- `PUT`: idempotent (same request multiple times = same result)
- `POST`: not idempotent (creating a resource each call)
- `DELETE`: idempotent
- `PATCH`: not necessarily idempotent (depends on operation)

#### Idempotency Keys

For non-idempotent operations (POST), use idempotency keys to prevent duplicate operations (network retry that reached the server):

```
POST /payments
Idempotency-Key: 4b2d9e8f-a1b2-4c3d-8e9f-1a2b3c4d5e6f

{
  "amount": 100,
  "currency": "USD"
}
```

Server checks if it has seen this key — if yes, returns the cached response. If no, processes and stores the result with the key.

#### Versioning

Common approaches:
```
# URL path versioning (most common, very explicit)
GET /v1/users/123
GET /v2/users/123

# Header versioning (cleaner URLs, harder to test in browser)
GET /users/123
API-Version: 2024-01-01

# Content negotiation
Accept: application/vnd.company.users.v2+json
```

#### Pagination

```
# Offset-based (simple, but inefficient at large offsets)
GET /users?offset=100&limit=20

# Cursor-based (efficient, consistent with concurrent writes)
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
# cursor is opaque token, usually base64-encoded {id: 100}

# Response
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_more": true
  }
}
```

---

### NGINX Deep Dive

#### Core Configuration Structure

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;          # one worker per CPU core
worker_rlimit_nofile 65535;     # max open files per worker

events {
    worker_connections 4096;    # connections per worker
    use epoll;                  # Linux: use epoll for event handling
    multi_accept on;            # accept multiple connections per event
}

http {
    # Connection settings
    keepalive_timeout 65;
    keepalive_requests 1000;
    client_max_body_size 10m;
    client_body_timeout 12;
    client_header_timeout 12;

    # Logging
    log_format json_combined escape=json
        '{'
          '"time":"$time_iso8601",'
          '"remote_addr":"$remote_addr",'
          '"method":"$request_method",'
          '"uri":"$request_uri",'
          '"status":"$status",'
          '"body_bytes":"$body_bytes_sent",'
          '"request_time":"$request_time",'
          '"upstream_addr":"$upstream_addr",'
          '"upstream_response_time":"$upstream_response_time"'
        '}';

    access_log /var/log/nginx/access.log json_combined;

    include /etc/nginx/conf.d/*.conf;
}
```

#### Virtual Host and Upstream

```nginx
# /etc/nginx/conf.d/api.conf

upstream api_backend {
    least_conn;                  # route to backend with fewest active connections
    keepalive 32;                # keep 32 persistent connections to backend

    server backend1:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend2:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend3:8080 weight=1 backup;    # only used if others are all down
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/api.example.com.pem;
    ssl_certificate_key /etc/ssl/api.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";         # enable keepalive to backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 8 8k;
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

#### Rate Limiting

```nginx
http {
    # Define rate limit zone: key=IP, zone name, zone size, rate
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $http_authorization zone=auth_limit:10m rate=100r/m;

    server {
        location /api/ {
            # Allow burst of 20 requests, then strictly enforce 10r/s
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;

            # Also limit by auth token (per-user rate limiting)
            limit_req zone=auth_limit burst=10;
        }
    }
}
```

#### Caching

```nginx
http {
    proxy_cache_path /var/cache/nginx levels=1:2
                     keys_zone=api_cache:10m
                     max_size=1g
                     inactive=60m;

    server {
        location /api/products/ {
            proxy_cache api_cache;
            proxy_cache_valid 200 5m;         # cache 200 responses for 5 minutes
            proxy_cache_valid 404 1m;
            proxy_cache_use_stale error timeout; # serve stale on backend error
            proxy_cache_key "$scheme$request_method$host$request_uri";
            add_header X-Cache-Status $upstream_cache_status;
        }
    }
}
```

---

### Envoy and Service Mesh

#### Why Envoy

Envoy is the data-plane proxy used in service mesh architectures (Istio, Linkerd). Unlike NGINX which uses a static configuration file, Envoy's configuration is dynamic — it can be updated via xDS APIs without restart.

Key Envoy concepts:
- **Listeners**: accept incoming connections (like NGINX `server {}`)
- **Routes**: match requests to clusters (like NGINX `location {}`)
- **Clusters**: groups of upstream endpoints (like NGINX `upstream {}`)
- **Filters**: pluggable processing chain (rate limiting, auth, metrics, tracing)

#### Service Mesh Pattern

In Istio, each pod has an Envoy sidecar injected automatically:

```
Client Pod
    → Envoy sidecar (outbound)
        → mTLS (mutual TLS between services)
        → Circuit breaker
        → Retry policy
        → Distributed tracing
        → Metrics
    → Envoy sidecar (inbound) of server pod
    → Server Pod application
```

The application doesn't need to implement retry, TLS, or tracing — Envoy handles it transparently.

#### Traffic Management with Istio

```yaml
# VirtualService: routing rules
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: checkout
spec:
  hosts:
    - checkout
  http:
    - match:
        - headers:
            x-user-segment:
              exact: beta-users
      route:
        - destination:
            host: checkout
            subset: v2
          weight: 100
    - route:
        - destination:
            host: checkout
            subset: v1
          weight: 90
        - destination:
            host: checkout
            subset: v2
          weight: 10

---
# DestinationRule: upstream policies
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: checkout
spec:
  host: checkout
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutiveGatewayErrors: 5
      interval: 10s
      baseEjectionTime: 30s    # eject bad hosts for 30 seconds
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

---

### Debugging HTTP Issues

#### Full Request Trace with curl

```bash
# Full timing breakdown
curl -w "@curl-format.txt" -o /dev/null -s https://api.example.com/health

# curl-format.txt:
# time_namelookup:  %{time_namelookup}s\n
# time_connect:     %{time_connect}s\n
# time_appconnect:  %{time_appconnect}s\n   (TLS)
# time_redirect:    %{time_redirect}s\n
# time_pretransfer: %{time_pretransfer}s\n
# time_starttransfer: %{time_starttransfer}s\n
# time_total:       %{time_total}s\n

# Check TLS certificate
curl -v --head https://api.example.com 2>&1 | grep -A 5 "SSL certificate"

# Test with specific headers
curl -H "Authorization: Bearer token123" \
     -H "Accept: application/json" \
     https://api.example.com/users/123

# Follow redirects, show all headers
curl -vL https://api.example.com/old-path

# Send POST with JSON body
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"name": "Alice", "email": "alice@example.com"}' \
     https://api.example.com/users
```

#### Reading NGINX Access Logs

```bash
# Last 100 requests
tail -100 /var/log/nginx/access.log

# Only 5xx errors
grep '" 5' /var/log/nginx/access.log | tail -50

# Requests taking more than 1 second (if using json log format)
cat /var/log/nginx/access.log | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        r = json.loads(line)
        if float(r.get('request_time', 0)) > 1.0:
            print(r)
    except:
        pass
"

# Top 10 slowest requests
jq -r '.request_time + \" \" + .uri' /var/log/nginx/access.log | \
  sort -n -r | head -10

# Error rate by minute
grep '" 5' /var/log/nginx/access.log | \
  awk '{print $4}' | cut -c2-17 | sort | uniq -c
```

#### Diagnosing 502s

502 Bad Gateway means NGINX got a bad response from the upstream:

```bash
# Check if upstream is healthy
curl http://backend-pod:8080/health

# Check NGINX error log for upstream errors
tail -50 /var/log/nginx/error.log
# Look for: "no live upstreams", "connect() failed", "recv() failed"

# Check if upstream pods are running
kubectl get pods -n production
kubectl describe pod <backend-pod>

# Check if backend is returning 4xx/5xx that NGINX is proxying as 502
# (Some proxy configs treat upstream errors as 502)
kubectl logs <backend-pod> | tail -50

# Check connection pool
# If you see "no live upstreams while connecting to upstream"
# Check fail_timeout and max_fails settings
```

#### Diagnosing 504s

504 Gateway Timeout means the upstream didn't respond in time:

```bash
# Check proxy_read_timeout in NGINX config
grep -r proxy_read_timeout /etc/nginx/

# Check application response time
kubectl top pods -n production  # is backend pod CPU-saturated?

# Trace slow request in application logs
kubectl logs <backend-pod> | grep "request_id=<id>"

# Check database — is the slow response caused by a slow query?
# Look for database logs showing long-running queries
```

---

### Common Failure Modes

**Connection pool exhaustion:** Too many concurrent requests, not enough connections in the upstream pool. Symptom: 502s with "no live upstreams" in NGINX error log despite backends being healthy. Fix: increase `keepalive` in upstream block, increase backend application's max connections, or scale out backends.

**Timeout misconfiguration cascade:** NGINX `proxy_read_timeout` is 60s. Client timeout is 30s. The client gives up after 30s, but NGINX keeps the connection to the backend for another 30s. Fix: always set client timeout shorter than proxy timeout, which should be shorter than application timeout.

**X-Forwarded-For not set:** Application needs client IP but receives proxy IP. Fix: set `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`. Application must use the last IP in X-Forwarded-For (or X-Real-IP) to get the actual client IP.

**TLS certificate expiry:** Certificate expires → HTTPS fails → service is down. Fix: automate certificate renewal (cert-manager in Kubernetes, Let's Encrypt, ACM on AWS). Alert at 30, 14, and 7 days before expiry.

**Large request body rejected:** Default `client_max_body_size` in NGINX is 1MB. File upload returns 413. Fix: increase `client_max_body_size` for relevant locations.

---

### Key Questions and Answers

**Q: What is the difference between a 502 and a 503 and a 504?**

502 (Bad Gateway): the proxy received an invalid or empty response from the upstream. Usually means the upstream process crashed, is starting up, or is returning garbage. 503 (Service Unavailable): no healthy upstream is available (all backends failed health checks, or the upstream explicitly returned 503 for overload shedding). 504 (Gateway Timeout): the proxy waited too long for the upstream to respond. Usually means the upstream is alive but slow — database query running long, external API latency, CPU saturation.

**Q: How does NGINX choose which upstream to route to?**

By default, round-robin: each new request goes to the next backend in sequence. Alternative load balancing methods: `least_conn` (send to backend with fewest active connections — better for variable-length requests), `ip_hash` (same client IP always goes to same backend — session stickiness), `random two` (pick 2 backends randomly, choose the one with fewer connections). For long-lived connections (WebSockets, gRPC), `least_conn` or `ip_hash` is preferred over round-robin.

**Q: How do you debug a slow HTTP endpoint?**

Walk the request path: (1) DNS lookup time (resolve manually with `dig`); (2) TCP + TLS time (`curl -w` timing); (3) NGINX processing time (check `$upstream_response_time` vs `$request_time` in logs — difference is NGINX overhead); (4) Backend processing time (application logs, traces); (5) Database query time (slow query logs, application traces). The difference between total request time and upstream response time tells you if NGINX is the bottleneck. The difference between upstream response time and database query time tells you if application code is the bottleneck.

**Q: How does rate limiting work in NGINX and when would you use it?**

NGINX rate limiting uses a leaky bucket algorithm. The `limit_req_zone` defines a shared memory zone keyed by some identifier (usually client IP or auth token), with a maximum fill rate. `limit_req` enforces the limit with an optional burst allowance. Without `burst`, any excess request gets 429 immediately. With `burst=20`, up to 20 extra requests can be queued. Use rate limiting to protect against: API abuse, DDoS amplification, upstream overload from a single client. Rate limiting by auth token (per-user) is fairer than by IP (doesn't penalize users behind NAT).

---

### Points to Remember

- HTTP request path: DNS → TCP → TLS → load balancer → proxy → application
- 502: bad response from upstream; 503: no upstream available; 504: upstream timed out
- TLS 1.3 is 1-RTT; always pin TLS minimum version to 1.2
- REST: resources as nouns, HTTP verbs carry semantic meaning (GET=safe+idempotent, POST=not idempotent)
- Idempotency keys prevent duplicate POST operations on client retry
- NGINX: `upstream {}` for backends, `location {}` for routing, `proxy_pass` to forward
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` to pass client IP
- `keepalive` in upstream block enables persistent connections (reduces TCP overhead)
- Rate limiting: `limit_req_zone` defines the zone, `limit_req` enforces it, 429 on exceed
- Envoy + service mesh: sidecar proxy provides mTLS, retry, circuit breaking transparently
- TLS cert expiry monitoring: alert at 30, 14, 7 days before expiry

### What to Study Next

- [Networking Fundamentals](./networking-fundamentals) — TCP/IP layer below HTTP
- [Cloud Networking and Kubernetes Networking](./cloud-networking-and-kubernetes-networking) — how HTTP flows through cloud and K8s
- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — measuring HTTP latency and errors

---

## [SRE] Networking Lab 1: HTTP, HTTPS, DNS, And Request Flow

## Networking Lab 1: HTTP, HTTPS, DNS, And Request Flow

### Production Context

A user reports that `https://api.prod.example.com/v1/predict` started feeling slow at
around 11:05 UTC. The API server team says their latency metrics are normal. SLO
dashboards show p99 latency jumped from 120ms to 4.2s. Your job is to find which phase
of the request is slow, separate the client-observable delay from the server-observable
delay, and produce a diagnosis the on-call engineer can act on.

---

### Prerequisites

- A Linux or macOS workstation with network access
- Tools: `curl`, `dig`, `openssl`, `traceroute` (or `tracepath`), `ss`
- For packet capture: `tcpdump` with sufficient permissions

---

### Environment Setup

No cluster required. You will run commands against a real public endpoint for timing
exercises. For the broken scenario exercises, use a local Nginx or netcat server to
simulate specific failure modes.

Simulated "slow DNS" environment:

```bash
# Temporarily override DNS for testing. This forces queries to a slow/wrong resolver.
# Do NOT run in production. This is local testing only.
sudo bash -c 'echo "nameserver 192.0.2.1" > /etc/resolv.conf.test'
# Use: dig @192.0.2.1 api.prod.example.com  to simulate timeout
```

---

### Beginner Section: Guided Walkthrough

#### Step 1 — Break the request into phases with curl timing

The `-w` flag in curl accepts timing variables. This is the most important diagnostic
command for HTTP latency triage.

```bash
curl -w "\ndns=%{time_namelookup}s\nconnect=%{time_connect}s\ntls=%{time_appconnect}s\nttfb=%{time_starttransfer}s\ntotal=%{time_total}s\n" \
     -o /dev/null -s https://www.google.com
```

Expected output for a healthy connection:

```
dns=0.011s
connect=0.028s
tls=0.065s
ttfb=0.088s
total=0.089s
```

What each field measures:

| Field | What it measures | What it includes |
|-------|-----------------|-----------------|
| `time_namelookup` | DNS resolution only | Resolver RTT + cache miss time |
| `time_connect` | DNS + TCP 3-way handshake | All of DNS plus SYN/SYN-ACK/ACK |
| `time_appconnect` | DNS + TCP + TLS handshake | Everything until first encrypted byte ready |
| `time_starttransfer` | DNS + TCP + TLS + server processing | Time to first response byte (TTFB) |
| `time_total` | Full request-response cycle | Everything including response body transfer |

Derived values that matter:

```
TCP connect time  = time_connect    - time_namelookup   = 0.028 - 0.011 = 0.017s
TLS overhead      = time_appconnect - time_connect      = 0.065 - 0.028 = 0.037s
Server think time = time_starttransfer - time_appconnect = 0.088 - 0.065 = 0.023s
```

#### Step 2 — Simulate a slow DNS scenario

```bash
# Query a non-responsive DNS server (timeout scenario)
time dig @192.0.2.1 www.google.com 2>&1
```

Expected output after the resolver gives up:

```
; <<>> DiG 9.18.12 <<>> @192.0.2.1 www.google.com
; (1 server found)
;; connection timed out; no servers could be reached

real    0m5.003s
user    0m0.001s
sys     0m0.002s
```

Now run curl against the same failing resolver:

```bash
curl -w "dns=%{time_namelookup}s\ntotal=%{time_total}s\n" \
     -o /dev/null -s --dns-servers 192.0.2.1 https://www.google.com 2>&1
```

Expected output:

```
curl: (6) Could not resolve host: www.google.com
dns=5.002s
total=5.002s
```

When DNS fails, `time_namelookup` accounts for the entire delay and equals
`time_total`. All downstream phases (connect, tls, ttfb) never run.

#### Step 3 — Simulate high TCP connect time (routing issue)

Use a blackholed IP to simulate a route that drops SYN packets:

```bash
curl -w "dns=%{time_namelookup}s\nconnect=%{time_connect}s\ntotal=%{time_total}s\n" \
     -o /dev/null -s --connect-timeout 5 http://10.255.255.1:80
```

Expected output:

```
dns=0.000s
connect=5.001s
total=5.001s
```

`time_namelookup` is near zero (IP literal, no DNS needed). `time_connect` consumed all
5 seconds before hitting the timeout. The TCP SYN was sent but no SYN-ACK returned.
This pattern means: routing problem or firewall silently dropping packets.

#### Step 4 — Inspect the TLS handshake in detail

```bash
openssl s_client -connect www.google.com:443 -servername www.google.com \
  -tls1_3 2>&1 | grep -E "Protocol|Cipher|Verify|depth"
```

Expected output:

```
depth=2 C=US, O=Google Trust Services LLC, CN=GTS Root R1
verify return:1
depth=1 C=US, O=Google Trust Services LLC, CN=GTS CA 1C3
verify return:1
depth=0 CN=www.google.com
verify return:1
---
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
```

What to check here: Certificate chain depth (3 is normal for a CA-signed cert). Protocol
version (TLS 1.2 adds one more round trip than TLS 1.3, which does 1-RTT or 0-RTT).
Cipher suite (AES-256-GCM is standard). If `verify return` shows anything other than
`1`, the certificate chain is broken.

#### Step 5 — Trace the network path

```bash
traceroute -n www.google.com
```

Expected output:

```
traceroute to www.google.com (142.250.80.36), 30 hops max, 60 byte packets
 1  192.168.1.1    1.2 ms   1.1 ms   1.0 ms
 2  10.0.0.1       5.3 ms   5.1 ms   5.2 ms
 3  203.0.113.1    8.4 ms   8.6 ms   8.3 ms
 4  72.14.209.81   9.1 ms   9.2 ms   9.0 ms
 5  142.250.80.36  11.2 ms  11.0 ms  11.1 ms
```

Stable RTT increase hop-by-hop is normal. A sudden large RTT jump between two hops
suggests congestion at that transit point. Stars (`* * *`) mean that router does not
respond to ICMP TTL-exceeded messages — this is not necessarily packet loss for TCP.

#### Step 6 — Use dig to inspect DNS chain

```bash
dig www.google.com +trace
```

Expected output (abbreviated):

```
; <<>> DiG 9.18.12 <<>> www.google.com +trace
.                       518400  IN  NS  a.root-servers.net.
;; Received 239 bytes from 127.0.0.53#53 in 0 ms

com.                    172800  IN  NS  a.gtld-servers.net.
;; Received 1175 bytes from 198.41.0.4#53 in 14 ms

google.com.             172800  IN  NS  ns1.google.com.
;; Received 292 bytes from 192.5.6.30#53 in 9 ms

www.google.com.         300     IN  A   142.250.80.36
;; Received 55 bytes from 216.239.32.10#53 in 6 ms
```

`+trace` forces dig to walk the full delegation chain from root to authoritative. This
is the correct tool when you suspect a cached wrong answer, a misconfigured delegation,
or an authority returning the wrong TTL.

---

### Intermediate Section: Diagnose Without Full Hints

You are given only this curl output from a production health check:

```
dns=0.009s
connect=0.031s
tls=2.847s
ttfb=2.854s
total=2.864s
```

Answer without hints:

1. Which phase is anomalous? What is the normal range for that phase?
2. List three root causes that specifically inflate TLS time without affecting
   DNS or TCP connect time.
3. How would you determine whether the TLS slowness is client-side or server-side?
4. Write the exact `openssl s_client` command you would run next and explain what
   output you are looking for.

---

### Advanced / Stretch

**Scenario A — HTTP/2 multiplexing effect**

Compare sequential curl requests versus one persistent connection:

```bash
# Sequential (new connection each time)
for i in {1..5}; do
  curl -w "connect=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s\n" \
       -o /dev/null -s https://www.google.com
done

# HTTP/2 with keep-alive
curl -w "connect=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s\n" \
     -o /dev/null -s --http2 https://www.google.com
```

Explain why subsequent requests in the same TLS session show `tls=0.000s`.
Explain the multiplexing implication for a microservices environment where services
make thousands of short requests per second.

**Scenario B — Certificate expiry pre-mortem**

```bash
echo | openssl s_client -connect www.google.com:443 -servername www.google.com 2>/dev/null \
  | openssl x509 -noout -dates
```

Write a shell one-liner that exits non-zero if the cert expires within 30 days. Explain
why certificate expiry causes `time_appconnect` to spike (client spends time downloading
OCSP stapling responses or querying CRL).

**Scenario C — DNS TTL and caching behaviour**

Run `dig www.google.com` three times in rapid succession. Observe how the TTL value
decrements each time. Explain what happens when TTL reaches zero while the service has
an active connection. Explain how this affects a Kubernetes Service's internal DNS TTL
(default 30s for ClusterIP records) and what this means during a rolling restart.

---

### Sample Diagnosis Note

```
Incident: api.prod.example.com p99 latency 4.2s (baseline 120ms) from 11:05 UTC

Investigation:
  curl -w timing from ops workstation:
    dns=0.009s  connect=0.029s  tls=3.841s  ttfb=3.851s  total=3.853s

  tls phase = 3.841s. All other phases normal. TCP connect at 29ms confirms routing
  is healthy. DNS at 9ms confirms resolver is healthy.

  openssl s_client -connect api.prod.example.com:443:
    Chain: 4 certificates (expected 3). Extra intermediate cert in chain.
    TLS: server is sending unnecessary full certificate chain on each new connection.
    Observed 4.1 KB cert payload vs normal 2.8 KB.

Root cause: Certificate rotation at 11:03 UTC accidentally included an extra cross-cert
from the old CA chain. Clients downloading the oversized chain on each new TLS session
added ~3.7s to handshake time under our network conditions.

Fix: Re-issued certificate without extra intermediate. Deployed at 11:38 UTC. p99 
returned to 115ms within 2 minutes as connection pools re-established with new chain.
```

---

### Common Mistakes

- **Treating total latency as server latency.** `time_starttransfer` minus
  `time_appconnect` is the only field that isolates server processing time. Total
  latency includes DNS, TCP, and TLS which are all client/network concerns.
- **Ignoring DNS TTL.** Cached DNS responses can mask a DNS change for minutes. Always
  check TTL remaining on a suspicious record.
- **Forgetting that `traceroute` uses ICMP by default.** Some firewalls drop ICMP
  but pass TCP. Use `traceroute -T -p 443` to trace on TCP/443 which is more
  representative for HTTPS endpoints.
- **Treating `* * *` as packet loss.** Routers that do not decrement TTL or respond
  to ICMP time-exceeded are common; the path beyond them may be fine.

---

### What To Study Next

- HTTP/2 and HTTP/3 (QUIC) handshake differences and latency implications
- TLS 1.3 0-RTT: how it works and the replay attack trade-off
- DNS resolution chain: stub resolver, recursive resolver, authoritative
- OCSP stapling and why it matters for TLS performance
- MTU path discovery and how fragmentation adds latency in cloud environments

---

## [SRE] Networking Lab 2: SSH Latency Drill

## Networking Lab 2: SSH Latency Drill

### Production Context

An ops engineer reports that SSH to `bastion.prod.example.com` takes 18–22 seconds
before the shell prompt appears. Interactive sessions feel sluggish once connected. The
host is reachable over TCP — `ping` and `curl http://bastion.prod.example.com:8080/health`
return immediately. A junior engineer says "the server must be overloaded." Your job
is to place the delay in the exact phase of SSH login without accepting vague explanations.

---

### Prerequisites

- SSH client with verbose flag support
- `dig`, `ss`, `tcpdump` available
- A test SSH target (use localhost or a VM; the lab is designed to be runnable with
  `ssh localhost` if you have SSH server running)
- Optional: Wireshark or `tcpdump` for packet capture

---

### Environment Setup

To simulate a slow-auth scenario locally using PAM delay:

```bash
# Add PAM delay to simulate auth latency (Linux only, needs sudo)
# This adds 3 seconds to every PAM auth interaction
sudo bash -c 'echo "auth optional pam_faildelay.so delay=3000000" >> /etc/pam.d/sshd'

# To simulate reverse-DNS delay, add a fake hostname entry:
sudo bash -c 'echo "192.168.1.100  slow.bastion.test" >> /etc/hosts'
# Then in sshd_config ensure UseDNS yes
```

To restore after the lab:

```bash
sudo sed -i '/pam_faildelay/d' /etc/pam.d/sshd
```

---

### Beginner Section: Guided Walkthrough

#### Step 1 — Time the full SSH connection to locate the delay

```bash
time ssh -o ConnectTimeout=10 user@bastion.prod.example.com true
```

Expected output when delay is in auth:

```
real    0m19.412s
user    0m0.031s
sys     0m0.011s
```

The `true` command means SSH connects, authenticates, runs `true` (exit 0 immediately),
and disconnects. This measures total connection time with no shell startup bias. If this
is fast but interactive shell feels slow, the delay is in shell startup (`.bashrc`,
`.profile`, NFS home dir mounts). If this is slow, the delay is before the shell.

#### Step 2 — Use ssh -vvv to locate the phase

```bash
ssh -vvv -o ConnectTimeout=10 user@bastion.prod.example.com true 2>&1 | head -60
```

Expected output showing delay at auth phase:

```
OpenSSH_9.2, LibreSSL 3.3.6
debug1: Reading configuration data /etc/ssh/ssh_config
debug1: Connecting to bastion.prod.example.com [10.10.4.22] port 22.
debug1: Connection established.                      <-- TCP connect: immediate
debug1: identity file /home/user/.ssh/id_ed25519 type 3
debug1: Local version string SSH-2.0-OpenSSH_9.2
debug1: Remote protocol version 2.0, remote software version OpenSSH_8.9p1
debug3: kex alg list
debug1: kex: algorithm: curve25519-sha256           <-- key exchange: <100ms
debug1: kex: host key algorithm: ssh-ed25519
debug3: send packet: type 30
debug3: receive packet: type 31
debug1: SSH2_MSG_KEX_ECDH_REPLY received
debug1: Server host key: ssh-ed25519 SHA256:abc123...
debug1: Host 'bastion.prod.example.com' is known
debug3: send packet: type 21
debug1: SSH2_MSG_NEWKEYS sent
debug3: receive packet: type 21
debug1: SSH2_MSG_NEWKEYS received
debug1: rekey out after 134217728 blocks
debug1: SSH2_MSG_SERVICE_REQUEST sent
debug3: receive packet: type 6                      <-- here: pause begins (~18 seconds)
debug1: SSH2_MSG_SERVICE_ACCEPT received            <-- here: auth accepted
debug1: Authentications that can continue: publickey,gssapi-with-mic,password
debug3: start over, passed a different list of user auth methods
debug1: Next authentication method: publickey
debug3: send packet: type 50
debug3: receive packet: type 51
debug1: Authentications that can continue: publickey,gssapi-with-mic,password
debug1: Trying private key: /home/user/.ssh/id_ed25519
debug3: sign_and_send_pubkey: RSA SHA256
debug3: send packet: type 50
debug3: receive packet: type 52                     <-- auth success: immediate after
debug1: Authentication succeeded (publickey).
debug1: channel 0: new [client-session]
debug1: Entering interactive session.
```

The debug output tells you precisely where the delay is:

- `Connection established` to first key exchange: `< 50ms` — TCP is fast, routing is fine
- Key exchange to `SSH2_MSG_SERVICE_ACCEPT`: this is where the 18-second gap lives
- After service accept: auth and shell start fast

This gap between `SSH2_MSG_SERVICE_REQUEST sent` and `SSH2_MSG_SERVICE_ACCEPT received`
on the server side is typically caused by: reverse DNS lookup, GSSAPI negotiation timeout,
PAM stack delay, or failed access control check that eventually times out.

#### Step 3 — Check reverse DNS

Many SSH servers perform a reverse DNS lookup on the client IP before proceeding. A
slow or broken PTR record adds the DNS timeout (typically 5–15 seconds) to every login.

```bash
# Find your client IP as seen by the server
dig -x $(curl -s ifconfig.me) +short
```

Expected output when PTR is missing:

```
;; connection timed out; no servers could be reached
```

Expected output when PTR is present:

```
client-123.isp.example.com.
```

If PTR lookup times out, the server's sshd waits for DNS resolution before proceeding.
The fix is either to add a PTR record, or to set `UseDNS no` in `/etc/ssh/sshd_config`
on the server. `UseDNS no` is now the default in modern OpenSSH, but many hardened
server images re-enable it.

#### Step 4 — Check GSSAPI negotiation

GSSAPI (Kerberos) is attempted before publickey by default if enabled on the server.
A broken Kerberos KDC causes a timeout on every login attempt.

```bash
# Disable GSSAPI on the client to bypass the timeout
ssh -o GSSAPIAuthentication=no user@bastion.prod.example.com true
time ssh -o GSSAPIAuthentication=no user@bastion.prod.example.com true
```

If this is fast, GSSAPI is the culprit. Permanent client-side fix:

```
# ~/.ssh/config
Host bastion.prod.example.com
    GSSAPIAuthentication no
```

#### Step 5 — Inspect the SSH server from the server side

On the bastion host itself, check active SSH sessions and auth log:

```bash
# On the server
ss -tanp | grep :22
```

Expected output:

```
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN   0       128     0.0.0.0:22          0.0.0.0:*          users:(("sshd",pid=1234,fd=3))
ESTAB    0       0       10.10.4.22:22       10.10.1.55:49812   users:(("sshd",pid=8821,fd=4))
ESTAB    0       0       10.10.4.22:22       10.10.1.55:49818   users:(("sshd",pid=8824,fd=4))
```

Multiple `ESTAB` connections from the same source is normal for persistent sessions.
`SYN_RECV` would indicate a half-open connection flood. `CLOSE_WAIT` would indicate
sessions not being cleaned up.

```bash
# On the server — tail auth log during a connection attempt
sudo tail -f /var/log/auth.log
```

Expected output showing reverse DNS delay:

```
Apr  9 11:23:41 bastion sshd[8821]: Connection from 10.10.1.55 port 49812
Apr  9 11:23:41 bastion sshd[8821]: reverse mapping checking getaddrinfo for ... [10.10.1.55] -- wait
Apr  9 11:23:59 bastion sshd[8821]: reverse mapping failed -- using IP address
Apr  9 11:23:59 bastion sshd[8821]: Accepted publickey for user from 10.10.1.55
```

The 18-second gap (11:23:41 to 11:23:59) is the reverse DNS lookup timing out.

#### Step 6 — Packet capture to confirm TCP handshake is fast

```bash
# On client or intermediate host
sudo tcpdump -i any -n port 22 -c 20
```

Expected output for a healthy TCP connection followed by slow auth:

```
11:23:41.002145 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [S], seq 1234567, win 64240
11:23:41.018223 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [S.], seq 8765432, ack 1234568, win 65535
11:23:41.018301 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [.], ack 1, win 502
11:23:41.019420 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [P.], seq 1:22, ack 1, win 501, length 21
11:23:41.019501 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [P.], seq 1:22, ack 22, win 501, length 21
...
11:23:59.118204 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [P.], seq 44:280, ack 180, win 501, length 236
```

The `[S]` → `[S.]` → `[.]` sequence is the 3-way handshake. It completes in 16ms
(11:23:41.002 to 11:23:41.018). The next meaningful exchange is at 11:23:59 — 18 seconds
later. The TCP layer was never the problem. The gap lives entirely within the SSH
application layer.

TCP flag decode reference:

| Flag | Meaning |
|------|---------|
| `[S]` | SYN — initiating connection |
| `[S.]` | SYN-ACK — server accepting |
| `[.]` | ACK — handshake complete |
| `[P.]` | PSH+ACK — data payload |
| `[F.]` | FIN+ACK — graceful close |
| `[R]` | RST — abrupt close |

---

### Intermediate Section: Diagnose Without Full Hints

You receive this `ssh -vvv` excerpt from a user's ticket:

```
debug1: Connecting to jump.prod.corp [10.20.0.5] port 22.
debug1: Connection established.
debug3: send packet: type 20
debug3: receive packet: type 20
debug1: kex: algorithm: curve25519-sha256
debug3: send packet: type 30
debug3: receive packet: type 31
debug1: SSH2_MSG_KEX_ECDH_REPLY received
debug1: SSH2_MSG_NEWKEYS sent
debug3: receive packet: type 21
debug1: SSH2_MSG_NEWKEYS received
debug2: service_accept: ssh-userauth
debug1: SSH2_MSG_SERVICE_ACCEPT received
debug1: Authentications that can continue: publickey,keyboard-interactive
debug1: Next authentication method: publickey
debug3: send packet: type 50
debug3: receive packet: type 60    <-- waited 14 seconds here
debug1: Server accepts key: /home/jithin/.ssh/id_ed25519 ED25519
debug3: sign_and_send_pubkey
debug3: send packet: type 50
debug3: receive packet: type 51    <-- failure
debug1: Authentications that can continue: keyboard-interactive
debug1: Next authentication method: keyboard-interactive
```

Questions without hints:

1. In which SSH phase does the 14-second gap occur?
2. What is `type 60` in the SSH protocol? What does the server's slow response here suggest?
3. Why does it fall back to `keyboard-interactive`? What does this indicate about the
   key?
4. Write the `authorized_keys` check you would run on the server and the permission check
   that commonly causes key auth to silently fail.

---

### Advanced / Stretch

**Scenario A — Shell startup latency**

Even after a fast auth, the time to first prompt can be slow. Create a slow `.bashrc`:

```bash
echo "sleep 3" >> ~/.bashrc
```

Run `ssh localhost true` versus `ssh localhost bash -c true`. Explain why `true` is fast
but an interactive login is slow. Identify the exact sshd option and `.bashrc` pattern
that causes this, and write the fix.

**Scenario B — MaxSessions and connection multiplexing**

SSH multiplexing (ControlMaster) reuses one TCP connection for multiple SSH sessions:

```
# ~/.ssh/config
Host bastion.prod.example.com
    ControlMaster auto
    ControlPath ~/.ssh/cm-%r@%h:%p
    ControlPersist 5m
```

Explain how this eliminates the DNS + TCP + TLS overhead for subsequent sessions.
Explain the failure mode when the control socket becomes stale and how to recover.

**Scenario C — SSH through a bastion with ProxyJump**

```bash
ssh -J bastion.prod.example.com user@internal.host
```

Map the TCP connections this creates: how many TCP handshakes, how many SSH negotiations.
Explain what `ssh -vvv` output would look like if the jump host can reach the final host
but the final host refuses the key.

---

### Sample Diagnosis Note

```
Incident: SSH to bastion.prod.example.com taking 18-22s, reported by 6 engineers

Investigation timeline:
  11:30 UTC — time ssh user@bastion true: 19.4s
  11:31 UTC — ssh -vvv: 18s gap between SSH2_MSG_SERVICE_REQUEST and SERVICE_ACCEPT
  11:32 UTC — ssh -o GSSAPIAuthentication=no: still 18s (GSSAPI not the cause)
  11:33 UTC — dig -x <client-IP>: connection timed out (PTR lookup failing)
  11:34 UTC — confirmed sshd_config has UseDNS yes

Root cause: sshd was performing reverse DNS lookup on each client IP. Our DNS resolver
for the 10.10.1.0/24 range was silently timing out PTR queries after the zone SOA record
was misconfigured during a maintenance window at 11:00 UTC. Each lookup timed out after
~18 seconds before sshd fell back to using the IP address.

Fix: set UseDNS no in /etc/ssh/sshd_config on bastion.prod.example.com; sshd reload
at 11:42 UTC. SSH logins returned to <2s immediately.

Permanent fix: restore PTR records for 10.10.1.0/24 zone. Scheduled for 13:00 UTC.
```

---

### Common Mistakes

- **Assuming TCP slow means network is slow.** TCP connect for SSH is typically under
  50ms. Auth latency is almost always application-layer, not TCP.
- **Not testing with `ssh ... true`.** Testing by opening an interactive shell includes
  shell startup time, which can mask where the real delay is.
- **Forgetting GSSAPI as a cause.** GSSAPI is tried before publickey on many enterprise
  setups. It is the most common cause of 10-30 second SSH delays in AD-joined environments.
- **Reading `ss` output without context.** `ESTAB` state just means the connection is
  up. Check the age of connections with `ss -tan --info` to spot stuck states.
- **Patching the client config without fixing the server.** Setting `GSSAPIAuthentication no`
  in `~/.ssh/config` fixes your logins but not everyone else's. Root-cause the server.

---

### What To Study Next

- SSH protocol internals: key exchange (KEX), user authentication, channel protocol
- PAM (Pluggable Authentication Modules) stack and how it affects SSH auth latency
- `sshd_config` performance settings: `UseDNS`, `GSSAPIAuthentication`, `MaxStartups`
- SSH multiplexing and ProxyJump for operations at scale
- TCP half-open connections and `MaxStartups` DDoS protection in sshd
- `authorized_keys` permission requirements (why mode 644 on the file breaks key auth)

---

## [SRE] Networking Lab 3: Routing, Filtering, And Packet Capture

## Networking Lab 3: Routing, Filtering, And Packet Capture

### Production Context

An alert fires at 16:12 UTC: the `payment-processor` service is unreachable from the
`order-service` pod, but the same `payment-processor` endpoint is reachable from a
developer's laptop via VPN. The services are in the same Kubernetes cluster, in
different namespaces. Infrastructure was changed at 15:58 UTC — a new NetworkPolicy
and a node firewall rule were applied. You need to determine whether this is a routing
problem, a filtering problem, or both, and pinpoint exactly which rule is responsible.

---

### Prerequisites

- Linux host or a running Kubernetes cluster
- Tools: `ip`, `ss`, `curl`, `traceroute`, `tcpdump`, `iptables` (or `nft`)
- For Kubernetes: `kubectl exec` access to pods in affected namespaces

---

### Environment Setup

For the host-level firewall scenario, simulate a DROP rule blocking a specific source:

```bash
# Create a test server on port 9090
python3 -m http.server 9090 &
SERVER_PID=$!

# Allow traffic from loopback (working path)
# Block traffic from 10.10.2.0/24 (broken path)
sudo iptables -I INPUT -s 10.10.2.0/24 -p tcp --dport 9090 -j DROP

# Verify working path (loopback)
curl -s http://127.0.0.1:9090 | head -1

# Verify broken path (use a secondary IP in the blocked range if available)
# cleanup:
# sudo iptables -D INPUT -s 10.10.2.0/24 -p tcp --dport 9090 -j DROP
# kill $SERVER_PID
```

---

### Beginner Section: Guided Walkthrough

#### Step 1 — Understand the three failure signatures before running any commands

Before touching any tool, you need to know what you are looking for. Different network
failures produce different symptoms:

| Failure type | Client symptom | Time to fail | What packet capture shows |
|-------------|---------------|-------------|--------------------------|
| No route | `Network unreachable` (ICMP) | Immediate | ICMP destination unreachable from nearest router |
| Firewall DROP | Connection times out | Full timeout (15-120s) | SYN packets sent, no SYN-ACK ever arrives |
| Firewall REJECT | `Connection refused` (TCP RST) | Immediate | SYN sent, RST received |
| Service not listening | `Connection refused` | Immediate | SYN sent, RST from destination |
| DNS failure | Could not resolve | DNS timeout (~5s) | DNS query sent, no response |

The most important distinction for this incident: **timeout vs refused**. A timeout
almost always means a DROP rule or routing black hole. A refused means something is
listening but rejecting, or a REJECT rule.

#### Step 2 — Run curl with verbose output and note the failure mode

From the broken source (order-service pod or a host in the blocked range):

```bash
curl -v --connect-timeout 5 http://payment-processor.payments.svc.cluster.local:8080/health
```

Expected output for a DROP scenario:

```
*   Trying 10.96.88.14:8080...
* connect to 10.96.88.14 port 8080 failed: Connection timed out
* Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 5003 ms: Connection timed out
* Closing connection 0
curl: (28) Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 5003 ms: Connection timed out
```

Expected output for a REJECT scenario:

```
*   Trying 10.96.88.14:8080...
* connect to 10.96.88.14 port 8080 failed: Connection refused
* Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 1 ms: Connection refused
curl: (7) Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 1 ms: Connection refused
```

This is `Connection timed out` — consistent with a DROP rule, not REJECT.

#### Step 3 — Check routing tables

On the source host or pod:

```bash
ip route show
```

Expected output:

```
default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.55 metric 100
10.96.0.0/12 via 10.0.0.1 dev eth0 proto kernel   # Kubernetes service CIDR
10.244.0.0/16 via 10.0.0.1 dev eth0 proto kernel  # Kubernetes pod CIDR
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.55
```

If the route to the destination's CIDR is absent, traffic takes the default route and
may miss the network entirely. But here the route to `10.96.0.0/12` (Service CIDR) is
present, so routing is not the issue. Move to filtering.

```bash
ip route get 10.96.88.14
```

Expected output:

```
10.96.88.14 via 10.0.0.1 dev eth0 src 192.168.1.55 uid 1000
    cache
```

`ip route get` shows exactly which route applies to a single destination. It confirms
the packet will use `eth0` via the Kubernetes service gateway.

#### Step 4 — Use tcpdump to see what the wire shows

Run tcpdump on the source side while repeating the failing curl:

```bash
# Terminal 1 — capture
sudo tcpdump -i any -n 'host 10.96.88.14 and port 8080' -c 20

# Terminal 2 — trigger
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

Expected output when packets are being dropped:

```
16:14:02.114822 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
16:14:03.122410 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
16:14:05.130891 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
```

Three SYN packets sent (`Flags [S]`), no SYN-ACK (`Flags [S.]`) ever returned. TCP
is retransmitting the SYN (first at 0s, then 1s, then 3s — standard exponential backoff).
This pattern is definitive: packets are being dropped somewhere between source and
destination.

Expected output for a healthy connection:

```
16:14:02.114822 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240
16:14:02.115190 IP 10.96.88.14.8080 > 10.10.2.5.49201: Flags [S.], seq 2917364821, ack 3842917646, win 65535
16:14:02.115230 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [.], ack 1, win 502
16:14:02.115310 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [P.], seq 1:80, ack 1, win 502, length 79
16:14:02.116050 IP 10.96.88.14.8080 > 10.10.2.5.49201: Flags [.], ack 80, win 501
```

#### Step 5 — Inspect iptables rules to find the DROP

```bash
sudo iptables -L INPUT -n -v --line-numbers
```

Expected output:

```
Chain INPUT (policy ACCEPT 0 packets, 0 bytes)
num  pkts bytes target     prot opt in     out     source            destination
1       3   180 DROP       tcp  --  *      *       10.10.2.0/24      0.0.0.0/0      tcp dpt:9090
2      12   720 ACCEPT     tcp  --  *      *       0.0.0.0/0         0.0.0.0/0      tcp dpt:9090
3    1204  82K  ACCEPT     all  --  lo     *       0.0.0.0/0         0.0.0.0/0
```

Rule 1 matches source `10.10.2.0/24` and drops it. Rule 2 would accept everything else.
The `pkts: 3` counter confirms this rule matched the three SYN retransmissions from the
failing curl. Line numbers allow targeted deletion:

```bash
sudo iptables -D INPUT 1
```

Verify fix immediately:

```bash
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

#### Step 6 — Check ss for connection state on the destination

On the destination (payment-processor) host:

```bash
ss -tanp | grep 8080
```

Expected output when nothing is reaching the service (all dropped before destination):

```
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN   0       128     0.0.0.0:8080        0.0.0.0:*          users:(("payment-proc",pid=4412,fd=8))
```

Only a `LISTEN` entry — no `SYN_RECV` or `ESTAB` from the failing client. This confirms
the packets never reached the application. If you saw `SYN_RECV` entries, that would mean
the server received the SYN but the ACK back is being dropped (asymmetric filtering).

#### Step 7 — For Kubernetes: inspect NetworkPolicy

```bash
kubectl get networkpolicy -n payments -o yaml
```

Expected output of a policy with a namespace selector bug:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-processor-allow
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: payment-processor
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: orders     # BUG: namespace labels are not set by default
```

```bash
# Check if the orders namespace has the expected label
kubectl get namespace orders --show-labels
```

Expected output showing the label is missing:

```
NAME     STATUS   AGE   LABELS
orders   Active   3d    kubernetes.io/metadata.name=orders
```

The NetworkPolicy requires label `name=orders` on the namespace, but the namespace only
has the auto-set label `kubernetes.io/metadata.name=orders`. Fix:

```bash
kubectl label namespace orders name=orders
```

---

### Intermediate Section: Diagnose Without Full Hints

You are given these two tcpdump captures from opposite ends of the same connection:

**Source side (order-service pod, 10.244.1.8):**
```
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]   (retransmit +1s)
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]   (retransmit +3s)
```

**Destination side (payment-processor pod, 10.244.3.12) — no output from this command.**

Questions without hints:

1. What does it mean that the source sees SYN packets but the destination sees nothing?
2. At which layer (CNI, node iptables, NetworkPolicy) is the drop most likely occurring?
3. Write the exact sequence of kubectl and iptables commands you would run on the
   destination node to find the specific DROP rule.
4. How does asymmetric routing change this picture? (What would tcpdump on destination
   show if the problem were asymmetric?)

---

### Advanced / Stretch

**Scenario A — NAT and asymmetric routing**

In a cloud environment, traffic from a pod goes through SNAT before leaving the node.
The return traffic arrives with the original destination IP, not the pod IP. Sketch the
iptables MASQUERADE flow. Explain why `tcpdump` on the pod sees the original IPs but
`tcpdump` on the physical interface sees the NATed IPs. Explain how this makes firewall
debugging misleading if you do not know which interface to capture on.

**Scenario B — eBPF (Cilium) policy tracing**

With Cilium as the CNI, iptables rules may not show the blocking policy. Use:

```bash
cilium monitor --type drop
kubectl exec -n kube-system -it $(kubectl get pod -n kube-system -l k8s-app=cilium -o name | head -1) \
  -- cilium policy trace --src-identity <source-endpoint> --dst-identity <dest-endpoint> --dport 8080
```

Explain what `cilium monitor --type drop` output looks like, and why host-level
iptables `-L` shows nothing despite packets being dropped.

**Scenario C — conntrack table exhaustion**

On a high-traffic node, the conntrack table can fill up, causing new connections to fail
with a "table full" kernel message:

```bash
# Check conntrack table usage
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
```

Explain the symptom (intermittent, affects new connections only, existing sessions work)
and the kernel log entry you would look for with `dmesg | grep conntrack`.

---

### Sample Diagnosis Note

```
Incident: payment-processor unreachable from order-service 16:12–16:31 UTC

Observable symptoms:
  - curl from order-service pod: Connection timed out (not refused)
  - curl from developer laptop via VPN: immediate HTTP 200
  - ip route on order-service pod: route to 10.96.0.0/12 present, routing not broken

Investigation:
  tcpdump on order-service pod: three SYN retransmits, no SYN-ACK
  tcpdump on payment-processor node: no packets arriving from 10.244.1.0/24
  → Packets dropped between source node and destination node

  Checked iptables on payment-processor node (node-3):
    iptables -L INPUT -n -v
    → Rule 1: DROP tcp src 10.244.0.0/14 dpt:8080  (pkts: 9, added 15:58 UTC)

Root cause: automation script applied a node-level iptables DROP rule targeting the
entire pod CIDR (10.244.0.0/14) on port 8080 as part of a "security hardening" change.
The intent was to block external access on 8080, but the rule accidentally covered
internal pod-to-pod traffic because pod IPs fall within 10.244.0.0/14.

Fix: removed rule at 16:31 UTC. Replaced with a more specific rule targeting only
external (non-pod) source IPs on 8080.
```

---

### Common Mistakes

- **Using `ping` to diagnose TCP application failures.** ICMP and TCP use different
  paths through firewalls. A host that responds to ping may still DROP TCP on specific
  ports.
- **Only checking iptables on one end.** Firewall rules exist on source, transit, and
  destination. Capture on both ends to localise where packets disappear.
- **Confusing REJECT with DROP.** REJECT sends back an error immediately (RST or ICMP
  unreachable). DROP silently discards. A fast failure is REJECT or "not listening".
  A timeout is DROP or routing black hole.
- **Forgetting cloud security groups are stateful.** In AWS/GCP, security groups track
  connection state. If you allow inbound on port 8080, the reply is automatically
  allowed. NACLs are stateless and require explicit rules for return traffic.
- **Not checking NetworkPolicy labels.** Kubernetes NetworkPolicy uses label selectors.
  A single missing or wrong label makes an entire allow rule ineffective — and the
  default-deny behaviour means all traffic from that namespace is silently dropped.

---

### What To Study Next

- Netfilter/iptables table and chain order: PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING
- conntrack and stateful firewall tracking in Linux
- Kubernetes NetworkPolicy: ingress/egress, namespaceSelector, podSelector
- Cilium eBPF policy model: identities, endpoint policies, hubble observability
- Cloud security groups vs NACLs: stateful vs stateless, evaluation order
- Asymmetric routing and why it breaks stateful firewalls

---

## [SRE] Cloud Networking Drill 1: Public, Private, And Internal Boundaries

## Cloud Networking Drill 1: Public, Private, And Internal Boundaries

### Production Context

You are designing the network architecture for an ML platform that will serve external
customers. The platform has: a public inference API, an internal admin dashboard, a
PostgreSQL database that stores model weights and job metadata, and a fleet of GPU
batch workers. Security has flagged that a previous version of the platform accidentally
exposed an admin endpoint to the internet. Your job is to design explicit boundaries,
explain exactly what is public versus private, and articulate how every access pattern
works without creating a new exposure.

---

### Prerequisites

No cluster or cloud account required. This drill is paper-based with CLI examples where
relevant. The goal is to be able to explain this architecture verbally and in diagrams
during a technical interview.

---

### Beginner Section: Establishing the Boundary Model

#### Step 1 — Understand the two axes of network boundary

Every cloud network decision sits on two axes:

**Axis 1 — Reachability:** Can the resource be addressed from the internet?

- **Public:** Has a public IP or is behind a public load balancer. Internet clients can
  initiate connections to it.
- **Private:** No public IP. Can only be reached from within the VPC or connected
  networks (VPN, peering, Direct Connect).

**Axis 2 — Traffic direction:** Does this resource initiate outbound or accept inbound?

- **Ingress-facing:** Accepts connections from outside its trust zone (API gateway, LB)
- **Egress-only:** Initiates connections out but should never accept inbound from
  lower-trust networks (batch workers phoning home to an API)

Most security mistakes conflate these two axes. A private subnet still needs egress
for package updates. A public subnet should usually not run a database.

#### Step 2 — Map each service component to the right zone

For the ML platform, draw this mental model:

```
Internet
   |
   |  HTTPS 443
   v
[Public Load Balancer / WAF]          ← Zone: Public edge, no persistent state
   |
   | Private IP only
   v
[Inference API pods]                  ← Zone: Private application subnet
[Admin UI pods]                       ← Zone: Private admin subnet (SEPARATE from API)
   |
   | Private IP only
   v
[PostgreSQL (RDS or self-managed)]    ← Zone: Private data subnet
   |
   | No inbound from internet
[GPU Worker fleet]                    ← Zone: Private compute subnet, egress-only
```

Why admin UI is in a separate subnet from the inference API:

- Inference API must scale to handle customer traffic — it may need wider inbound rules
- Admin UI should only be reachable from corporate VPN or specific IP ranges
- If both live in the same subnet, a misconfigured load balancer rule could accidentally
  expose admin routes to the customer-facing LB

#### Step 3 — Define what "private" means operationally

Private does not mean inaccessible. It means initiation must come from a trusted network.
Private resources still need:

- **Egress to the internet** (package updates, cloud API calls, S3/GCS bucket access)
  → handled by NAT Gateway (AWS) or Cloud NAT (GCP)
- **Egress to other private subnets** (workers reading from database)
  → handled by subnet routing within the VPC, controlled by security groups or firewall rules
- **Management access** (SSH or Kubectl exec into private nodes)
  → handled by a bastion host or Session Manager, never by opening SSH to 0.0.0.0/0

#### Step 4 — Explain the admin access pattern safely

There are three safe patterns for admin access to private resources:

**Pattern A — Bastion host:**
```
Engineer laptop → VPN → Bastion (public or VPN-accessible, hardened) → private resources
```
- Bastion has a public IP OR is accessible only via VPN
- Bastion allows SSH from a specific corporate IP range, not 0.0.0.0/0
- Bastion has no access to production data itself — it is a jump point only
- All sessions are logged (audit requirement)

**Pattern B — AWS Session Manager / GCP IAP (Identity-Aware Proxy):**
```
Engineer → Cloud console or CLI (authenticated) → IAM-gated tunnel → private instance
```
- No public IP on the target instance required
- All access goes through cloud IAM — no SSH key management
- Sessions recorded automatically
- This is the preferred pattern in modern cloud architectures

**Pattern C — VPN with split tunneling:**
```
Engineer → VPN tunnel → private subnet directly
```
- Full VPN: all traffic goes through corporate network
- Split tunnel: only private IP ranges go through VPN, internet goes direct
- Split tunnel is lower latency but requires careful route management to avoid leaks

#### Step 5 — Control egress from private workloads

Private workloads need outbound internet access for:
- Pulling container images from Docker Hub / public registries
- Calling external APIs (Stripe, Twilio, etc.)
- Reaching cloud-managed services (S3, Pub/Sub, CloudSQL via public endpoint)

Egress control options:

```
Private subnet → NAT Gateway → Internet
                    ↑
           Static Egress IP (allowlist this IP at 3rd-party services)

Private subnet → VPC Endpoint (AWS) / Private Service Connect (GCP) → Cloud service
               (traffic never leaves the cloud provider's backbone)
```

A VPC Endpoint or Private Service Connect connection is preferred for cloud-native
services because: no NAT required, no internet exposure, lower latency, and you can
attach IAM/VPC-SC policies at the endpoint.

---

### Intermediate Section: Architecture Review

You are reviewing a pull request that adds the following infrastructure:

```yaml
# Proposed Terraform (simplified)
resource "aws_security_group_rule" "admin_inbound" {
  type        = "ingress"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]   # open to internet
  security_group_id = aws_security_group.admin_ui.id
  description = "Allow HTTPS to admin UI"
}

resource "aws_lb_listener" "admin" {
  load_balancer_arn = aws_lb.public_alb.arn   # same ALB as inference API
  port              = 8443
  protocol          = "HTTPS"
  # ... routes to admin UI target group
}
```

Questions without hints:

1. What exposure does this configuration create?
2. Why is sharing the same ALB for inference API and admin UI dangerous, even if they
   are on different ports?
3. Write the corrected Terraform that restricts admin access to a corporate IP range
   and uses a separate internal load balancer.
4. What log source would you check to audit who accessed the admin UI in the last 30 days?

---

### Advanced / Stretch

**Scenario A — Data exfiltration via egress**

An attacker compromises a batch worker pod. The pod has outbound internet access via
NAT Gateway. Explain what data exfiltration looks like in this scenario. What controls
would limit the blast radius: egress firewall rules, DNS filtering, VPC Flow Logs,
GuardDuty anomaly detection?

**Scenario B — PrivateLink / Private Service Connect for customer connectivity**

A large enterprise customer wants to call your inference API without their traffic ever
traversing the public internet. Explain how AWS PrivateLink or GCP Private Service
Connect works, what the customer must configure in their own VPC, and what constraints
this places on your load balancer type (NLB required for PrivateLink, not ALB).

**Scenario C — Shared VPC and multi-team governance**

Your organisation runs multiple teams in the same GCP project or AWS account. Design
a Shared VPC (GCP) or a Transit Gateway (AWS) architecture that lets teams share a
central egress path and DNS resolver while keeping each team's workloads isolated in
separate subnets or accounts.

---

### Sample Architecture Explanation (Interview-Ready)

```
For the ML inference platform, I would establish three network zones:

Zone 1 — Public edge:
  A Cloud Load Balancer (GCP HTTPS LB or AWS ALB) is the only resource with a public IP.
  It terminates TLS and passes traffic to the application tier. A WAF sits in front for
  OWASP filtering. The load balancer health-checks backend pods and drains connections
  during deploys.

Zone 2 — Private application tier (two separate subnets):
  a) Inference API subnet: receives traffic from the external LB only. Pods need egress
     to call the database and to pull model artifacts from GCS/S3.
  b) Admin UI subnet: receives traffic from an internal-only load balancer, accessible
     only from the corporate VPN IP range. Completely separate from the customer path.

Zone 3 — Private data and compute tier:
  PostgreSQL runs in a dedicated subnet with no inbound except from Zone 2.
  GPU workers are in a compute subnet. They read from GCS/S3 via a VPC endpoint, write
  results to the database, and have no inbound access from anywhere.

Egress:
  All private subnets route outbound internet traffic through Cloud NAT or a NAT Gateway
  with a static IP. That static IP is whitelisted at any external dependencies.
  Cloud-native service access (GCS, Pub/Sub, BigQuery) goes through VPC endpoints,
  bypassing NAT entirely.

Admin access:
  Engineers use IAP (GCP) or Session Manager (AWS) for shell access to any private instance.
  No bastion host with a public IP is needed. All sessions are recorded in Cloud Audit Logs.
```

---

### Common Mistakes

- **"Private subnet" with `0.0.0.0/0` in the security group.** A private subnet only
  prevents direct internet routing. A security group rule allowing all inbound still
  exposes the resource to anything that can reach it (other VPC resources, VPN users,
  peered networks). Both routing and filtering must be correct.
- **Admin and customer traffic on the same load balancer.** Even on different ports,
  a single WAF bypass, ALB misconfig, or CORS misconfiguration can expose admin routes
  to internet clients.
- **Forgetting egress controls.** Organisations spend heavily on ingress controls and
  ignore egress. Outbound DNS, HTTP, and HTTPS from every private workload should be
  scoped to what that workload actually needs.
- **Using public endpoints for cloud-native services (S3, GCS) when VPC endpoints are
  available.** Traffic to a public S3 endpoint from a private subnet goes through NAT,
  incurring NAT Gateway data processing costs and adding potential exposure. VPC
  endpoints are almost always cheaper and safer.

---

### What To Study Next

- VPC design: subnet sizing, CIDR planning, multi-AZ layout
- AWS Transit Gateway vs VPC Peering: when each is appropriate
- GCP Shared VPC vs VPC Peering: service project model
- AWS PrivateLink and GCP Private Service Connect: customer connectivity
- Zero-trust network models: no implicit trust based on subnet membership
- VPC Flow Logs and cloud-native network observability

---

## [SRE] Cloud Networking Drill 2: GCP VPC And Load Balancing Design

## Cloud Networking Drill 2: GCP VPC And Load Balancing Design

### Production Context

Your team is migrating an ML inference service to GCP. The service receives public HTTPS
traffic from global clients, backs onto a GKE cluster, and talks to a Cloud SQL
PostgreSQL database. During the migration, a post-deploy health check passed but real
users in South-East Asia reported 40% packet loss. The US team saw nothing wrong.
Your architecture review needs to explain why, and how to prevent it.

---

### Prerequisites

- A GCP account (free tier is sufficient for CLI exercises)
- `gcloud` CLI installed and authenticated
- Basic familiarity with the GCP console
- For the GKE sections: a running GKE cluster or knowledge of GKE networking

---

### Beginner Section: GCP VPC Model And Request Path

#### Step 1 — Understand GCP VPC as a global, flat network

GCP VPC is fundamentally different from AWS VPC:

| Dimension | GCP VPC | AWS VPC |
|-----------|---------|---------|
| Scope | Global (single VPC spans all regions) | Regional (one VPC per region) |
| Subnets | Regional (subnet lives in one region) | Availability-zone-specific |
| Routing | Routes are global by default | Routes are per-route-table, per-subnet |
| Peering | VPC peering is not transitive | VPC peering is not transitive either |

This means a single GCP VPC can have subnets in `us-central1`, `europe-west4`, and
`asia-northeast1` simultaneously. A VM in `us-central1` can reach a VM in
`asia-northeast1` using private IPs over Google's backbone — without VPN or peering.

```bash
# List VPCs in your project
gcloud compute networks list

# List subnets (note: regional, even though the VPC is global)
gcloud compute networks subnets list --network=default

# Expected output:
# NAME          REGION           NETWORK  RANGE          STACK_TYPE
# default       us-central1      default  10.128.0.0/20  IPV4_ONLY
# default       europe-west1     default  10.132.0.0/20  IPV4_ONLY
# default       asia-east1       default  10.140.0.0/20  IPV4_ONLY
```

The subnet ranges are different per region. A VM in `us-central1` gets an IP from
`10.128.0.0/20`. This matters for firewall rules: if you write a rule targeting a
specific subnet CIDR, it is region-specific even though the VPC is global.

#### Step 2 — Map the full request path for a public HTTPS service

```
Internet client
      |
      | DNS: api.example.com → 34.107.xxx.xxx (Anycast, global)
      v
[Cloud Armor WAF]           ← DDoS protection, OWASP rules, geo-blocking
      |
      v
[Global HTTPS Load Balancer]  ← Terminates TLS, routes to regional backend
      |
      | (Google Front End → regional forwarding)
      v
[Backend Service]           ← Health-checked pool of instance groups or NEGs
      |
      v
[GKE Pods via NEG]          ← Traffic goes directly to pod IPs (not NodePort)
      |
      v
[Cloud SQL (private IP)]    ← Connected via Private IP, no public endpoint
```

Key GCP-specific components:

**Anycast IP**: The Global HTTPS LB's IP is an Anycast address advertised from
multiple Google PoPs worldwide. A client in Singapore connects to the nearest Google
PoP, which then routes traffic over Google's private backbone to the nearest healthy
backend. This is why a US-only backend deployment causes 40% packet loss in SEA —
the LB accepts the connection in Singapore but has no backend to serve it there.

**Network Endpoint Group (NEG)**: A NEG is a collection of backend endpoints.
For GKE, a "zonal NEG" maps to individual pod IPs directly, bypassing kube-proxy
entirely. This improves latency and enables precise health checking at the pod level.

#### Step 3 — Inspect the backend health check (where the incident lives)

```bash
# List backend services
gcloud compute backend-services list --global

# Describe one backend service to see its health
gcloud compute backend-services get-health inference-api-backend --global
```

Expected output for a healthy backend:

```
---
backend: https://www.googleapis.com/compute/v1/.../instanceGroups/gke-cluster-pool-us-c1
status:
  healthStatus:
  - healthState: HEALTHY
    instance: https://.../instances/gke-node-001
    ipAddress: 10.128.0.12
    port: 80
```

Expected output during the incident (SEA region missing):

```
---
backend: https://.../instanceGroups/gke-cluster-pool-us-c1
status:
  healthStatus:
  - healthState: HEALTHY
    instance: ...
    ipAddress: 10.128.0.12

# No asia-southeast1 backend listed at all — it was never added to the backend service
```

The backend service was only configured with a `us-central1` NEG. The Global LB
accepted connections from Singapore (nearest PoP) but had no healthy backend in that
region. 40% of requests failed because the LB sometimes chose the only backend
(us-central1) — successful — and sometimes tried to find a closer backend — failed.
The actual split depended on LB routing algorithm behaviour with no regional backend.

#### Step 4 — Understand internal versus external load balancing

GCP offers multiple load balancer types. Choosing the wrong one is a common design error:

| LB Type | Scope | Use case |
|---------|-------|---------|
| Global HTTPS LB | Global, external | Public HTTPS with Anycast, CDN, Cloud Armor |
| Regional HTTPS LB | Regional, external | Regional public HTTPS, lower cost |
| Internal HTTPS LB (L7) | Regional, internal | East-west microservice traffic within VPC |
| Internal TCP/UDP LB (L4) | Regional, internal | Internal stateful TCP, private endpoints |
| Network LB (pass-through) | Regional, external | High-performance TCP/UDP, preserve source IP |

For the ML platform:
- External inference API → Global HTTPS LB (with Cloud Armor)
- Service mesh internal traffic → Internal HTTPS LB or Istio
- Database connection → Cloud SQL Private IP (no LB needed; direct private connectivity)

#### Step 5 — Cloud NAT and private egress

Private GKE nodes (recommended) have no public IPs. They need Cloud NAT for outbound
internet access (pulling images from Docker Hub, reaching external APIs):

```bash
# Create a Cloud Router (required by Cloud NAT)
gcloud compute routers create ml-router \
  --network=ml-vpc \
  --region=us-central1

# Create Cloud NAT on that router
gcloud compute routers nats create ml-nat \
  --router=ml-router \
  --region=us-central1 \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges
```

Cloud NAT is regional — you need one per region where you have private nodes.
A GKE cluster spanning `us-central1` and `asia-southeast1` needs two Cloud NAT
configurations if both regions have private nodes.

For GCP-native services (GCS, Pub/Sub, BigQuery), use Private Google Access instead
of Cloud NAT — traffic goes through Google's backbone, not the internet:

```bash
# Enable Private Google Access on a subnet
gcloud compute networks subnets update ml-subnet \
  --region=us-central1 \
  --enable-private-ip-google-access
```

#### Step 6 — Firewall rules: GCP's stateful model

GCP firewall rules are attached to the VPC (not to subnets or instances), and use
target tags or service accounts to identify which VMs they apply to:

```bash
# List firewall rules on the VPC
gcloud compute firewall-rules list --filter="network:ml-vpc"

# Example output:
# NAME                          NETWORK  DIRECTION  PRIORITY  ALLOW
# allow-internal                ml-vpc   INGRESS    1000      all:0.0.0.0/0 → tag:internal
# allow-health-check            ml-vpc   INGRESS    1000      tcp:8080 → tag:gke-node (from 130.211.0.0/22,35.191.0.0/16)
# deny-all-ingress              ml-vpc   INGRESS    65534     all:0.0.0.0/0 → all
```

Health check rule: `130.211.0.0/22` and `35.191.0.0/16` are Google's health-checker
source ranges. Without this rule, the Global HTTPS LB health checks fail and all
backends are marked unhealthy — even when pods are running correctly.

---

### Intermediate Section: Design Review Without Hints

You are given this GKE cluster creation command:

```bash
gcloud container clusters create ml-inference \
  --zone=us-central1-a \
  --num-nodes=3 \
  --enable-ip-alias \
  --no-enable-master-authorized-networks
```

Questions without hints:

1. What is `--enable-ip-alias` and why is it required for NEG-based load balancing?
2. What exposure does `--no-enable-master-authorized-networks` create, and what is the
   more secure default?
3. The cluster is created in a single zone (`us-central1-a`). What happens if that zone
   has an outage? What command creates a regionally redundant cluster?
4. How would you enable Workload Identity (GKE's IAM-for-pods) and why is it better
   than mounting service account keys?

---

### Advanced / Stretch

**Scenario A — Global LB latency routing vs load balancing**

The Global HTTPS LB routes to the backend with the lowest latency by default. If you
have backends in `us-central1` and `asia-southeast1`, and the `asia-southeast1` backend
becomes unhealthy, traffic fails over to `us-central1`. Explain: what does the client
in Singapore experience during failover? How long does it take? What GCP metric would
you alert on to detect cross-region spillover before users notice?

**Scenario B — GKE Private Cluster and master authorised networks**

With a private GKE cluster:
- Nodes have no public IPs
- The control plane endpoint can be made private-only

Draw the access path for:
  a) A developer running `kubectl apply` from their laptop
  b) A CI/CD pipeline (Cloud Build) running `kubectl apply`
  c) A GKE node calling the Kubernetes API (kubelet → API server)

For each, explain what network path is used and what IAM or network control gates it.

**Scenario C — Cloud SQL with private IP and connection pooling**

Cloud SQL with private IP does not use standard DNS routing — it uses a private service
access peering connection. Explain:
- What `gcloud services vpc-peerings connect` does
- Why you cannot connect to Cloud SQL via its private IP from a peered VPC (peering
  is not transitive, and private service access uses a separate peering)
- How Cloud SQL Auth Proxy solves the connection and credential management problem

---

### Sample Architecture Explanation (Interview-Ready)

```
GCP HTTPS request path for the ML inference platform:

1. DNS: api.example.com resolves to a Google Anycast IP. Client in Singapore hits
   the nearest Google PoP (Changi or equivalent).

2. Global HTTPS Load Balancer: terminates TLS. Cloud Armor filters for OWASP top-10
   and rate limits per IP. The LB selects the closest healthy backend service.

3. Backend Service with Zonal NEGs: NEGs are registered per region. For a global
   deployment, we register NEGs in us-central1, europe-west4, and asia-southeast1.
   Traffic from Singapore goes to the asia-southeast1 NEG, reaching GKE pods directly
   by pod IP, bypassing kube-proxy.

4. GKE pods: running in a private cluster (no public IPs). Pods call Cloud SQL via
   private IP within the same VPC. Pods call GCS via Private Google Access (no NAT
   needed). For external APIs (if any), traffic exits via Cloud NAT in each region.

5. Failure path: if a regional backend is unhealthy (0 healthy NEG endpoints), the
   Global LB spills over to the next-closest healthy region. We alert on the metric
   loadbalancing.googleapis.com/https/backend_latency with a threshold that catches
   cross-region routing before users see significant degradation.

The mistake in the original incident: only a us-central1 NEG was added to the backend
service. The LB accepted connections globally but had no local backend outside the US.
Fix: added asia-southeast1 and europe-west4 NEGs to the backend service.
```

---

### Common Mistakes

- **Deploying to a single zone.** GCP zones within a region are independent failure
  domains. A regional GKE cluster with nodes in all three zones of a region survives
  a single zone outage.
- **Not adding health check firewall rules.** The Global LB uses specific source IPs
  for health checks. Forgetting those firewall rules marks all backends unhealthy and
  causes total outage even when pods are running.
- **Treating Cloud NAT as a replacement for Private Google Access.** Cloud NAT sends
  traffic to the internet. Private Google Access routes to Google APIs internally.
  Use Private Google Access for GCS, Pub/Sub, and other Google services.
- **Expecting VPC peering to be transitive.** GCP peering (like AWS peering) is not
  transitive. VPC A peered to VPC B and VPC B peered to VPC C does not let A reach C.
  Use Shared VPC or a hub-and-spoke model if you need that connectivity.

---

### What To Study Next

- GCP Global vs Regional HTTPS Load Balancers: when to use each
- Network Endpoint Groups: zonal NEG vs serverless NEG vs internet NEG
- Cloud Armor: WAF rules, adaptive protection, rate limiting
- GKE networking: VPC-native clusters, Dataplane V2 (eBPF), NetworkPolicy
- Private Service Connect: exposing services across VPCs without peering
- VPC Flow Logs and Firewall Rules Logging for network observability

---

## [SRE] Cloud Networking Drill 3: AWS VPC, Security Groups, NACLs, And Routing

## Cloud Networking Drill 3: AWS VPC, Security Groups, NACLs, And Routing

### Production Context

Your team runs a multi-tier application in AWS: a public ALB, app servers in private
subnets, and an RDS PostgreSQL in a database subnet. At 22:14 UTC a deploy script
modified security groups as part of a "least-privilege tightening" change. Within three
minutes, app servers could no longer reach the database. A separate incident the following
morning: database backup jobs started timing out from Lambda functions in a different
AZ. Both incidents involve the same VPC. Your job is to reason through the exact AWS
constructs involved and explain them as if in a technical interview.

---

### Prerequisites

- AWS account with a VPC, EC2 instances, or willingness to reason through paper scenarios
- `aws` CLI configured (optional — this drill can be done with reasoning + console)
- Familiarity with the AWS console for VPC, EC2, and RDS dashboards

---

### Beginner Section: AWS VPC Networking Fundamentals

#### Step 1 — Understand the AWS VPC scope model

AWS VPC is regional. Unlike GCP, a single VPC does not span regions:

```
AWS Region: us-east-1
  VPC: 10.0.0.0/16
    AZ: us-east-1a
      Subnet: 10.0.1.0/24  (public)
      Subnet: 10.0.2.0/24  (private app)
      Subnet: 10.0.3.0/24  (private database)
    AZ: us-east-1b
      Subnet: 10.0.4.0/24  (public)
      Subnet: 10.0.5.0/24  (private app)
      Subnet: 10.0.6.0/24  (private database)
    AZ: us-east-1c
      Subnet: 10.0.7.0/24  (public)
      Subnet: 10.0.8.0/24  (private app)
      Subnet: 10.0.9.0/24  (private database)
```

Every subnet lives in exactly one AZ. For high availability, you replicate subnets
across at least two AZs (three is better). Route tables are associated per subnet —
this is a key difference from GCP where routes are VPC-wide.

#### Step 2 — Understand the routing model (where most AWS confusion lives)

Every subnet has an associated route table. Routing decisions in AWS:

```bash
# View route tables in the VPC
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-0abc1234def56789" \
  --query 'RouteTables[*].{RTID:RouteTableId,SubnetAssoc:Associations[*].SubnetId,Routes:Routes}'
```

Expected output for the public subnet route table:

```json
[
  {
    "RTID": "rtb-0public1234",
    "SubnetAssoc": ["subnet-0abc1234"],
    "Routes": [
      {"DestinationCidrBlock": "10.0.0.0/16", "GatewayId": "local", "State": "active"},
      {"DestinationCidrBlock": "0.0.0.0/0",   "GatewayId": "igw-0xyz789", "State": "active"}
    ]
  }
]
```

Expected output for the private subnet route table:

```json
[
  {
    "RTID": "rtb-0private5678",
    "SubnetAssoc": ["subnet-0def5678", "subnet-0ghi9012"],
    "Routes": [
      {"DestinationCidrBlock": "10.0.0.0/16", "GatewayId": "local", "State": "active"},
      {"DestinationCidrBlock": "0.0.0.0/0",   "NatGatewayId": "nat-0mno3456", "State": "active"}
    ]
  }
]
```

What makes a subnet "public": having a route for `0.0.0.0/0` pointing to an **Internet
Gateway** (`igw-`). What makes a subnet "private": having `0.0.0.0/0` pointing to a
**NAT Gateway** (`nat-`) or having no default route at all.

The route table association is what determines whether instances in that subnet can
reach the internet. The subnet name ("public-subnet") is just a label — the route
table is what matters.

#### Step 3 — Security Groups vs NACLs: the critical operational difference

This is the most commonly confused topic in AWS networking interviews:

| Property | Security Group (SG) | Network ACL (NACL) |
|----------|--------------------|--------------------|
| Applied to | ENI (elastic network interface) | Subnet |
| Statefulness | **Stateful** — return traffic automatic | **Stateless** — return traffic needs explicit rule |
| Rule evaluation | All rules evaluated, most permissive wins | Rules evaluated in order, first match wins |
| Default | Deny all inbound, allow all outbound | Allow all (default NACL) |
| Scope | Can span AZs | One NACL per subnet |

**Stateful vs stateless — the failure mode that caught the backup jobs:**

If you allow inbound traffic from Lambda (port 5432) in the RDS security group, the SG
automatically allows the response packets out. You do not need an explicit outbound rule
for responses.

But if you apply a NACL to the database subnet:
```
NACL Inbound rules:
100  ALLOW  TCP  0.0.0.0/0  5432
*    DENY   ALL

NACL Outbound rules:
100  ALLOW  TCP  0.0.0.0/0  443   (HTTPS only — missing ephemeral port range)
*    DENY   ALL
```

The Lambda function connects on port 5432. The response from RDS uses an **ephemeral
port** on the client side (range 1024-65535 or 32768-60999 depending on OS). The NACL
outbound rule only allows port 443. So the response packet is blocked by the NACL
outbound rule even though the SG would have allowed it.

#### Step 4 — Diagnose the SG incident (app cannot reach database)

After the least-privilege tightening, the app-to-database connection broke. Check the
database security group:

```bash
aws ec2 describe-security-groups \
  --group-ids sg-0db1234 \
  --query 'SecurityGroups[*].IpPermissions'
```

Expected output showing the broken rule:

```json
[
  {
    "FromPort": 5432,
    "ToPort": 5432,
    "IpProtocol": "tcp",
    "IpRanges": [
      {
        "CidrIp": "10.0.2.0/24",
        "Description": "app subnet a"
      }
    ]
  }
]
```

The rule allows `10.0.2.0/24` (AZ-a app subnet) but the tightening script removed the
`10.0.5.0/24` (AZ-b app subnet) rule. App servers in AZ-b can no longer reach the
database. Fix:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.5.0/24 \
  --tag-specifications 'ResourceType=security-group-rule,Tags=[{Key=Description,Value="app subnet b - restored"}]'
```

Better long-term fix: reference the app security group ID instead of CIDRs:

```bash
# Rule: allow from any instance that has sg-0app5678 attached
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-0app5678
```

SG-to-SG references are more maintainable than CIDR rules because they do not break
when you add a new AZ or change your subnet CIDR allocation.

#### Step 5 — Fix the NACL for Lambda backup jobs

Lambda functions use ephemeral source ports. The NACL outbound rule must allow the
ephemeral port range for responses to reach the Lambda:

```bash
aws ec2 create-network-acl-entry \
  --network-acl-id acl-0db9876 \
  --ingress \
  --rule-number 90 \
  --protocol tcp \
  --port-range From=5432,To=5432 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow

# Add the missing egress rule for ephemeral ports
aws ec2 create-network-acl-entry \
  --network-acl-id acl-0db9876 \
  --egress \
  --rule-number 90 \
  --protocol tcp \
  --port-range From=1024,To=65535 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow
```

#### Step 6 — Internet-facing vs internal ALB

```bash
# Check whether an ALB is internet-facing or internal
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[*].{Name:LoadBalancerName,Scheme:Scheme,Subnets:AvailabilityZones[*].SubnetId}'
```

Expected output:

```json
[
  {
    "Name": "inference-api-alb",
    "Scheme": "internet-facing",
    "Subnets": ["subnet-0abc1234", "subnet-0def5678"]
  },
  {
    "Name": "internal-services-alb",
    "Scheme": "internal",
    "Subnets": ["subnet-0ghi9012", "subnet-0jkl3456"]
  }
]
```

`internet-facing` ALB: must be in public subnets (with IGW route), gets a public DNS
name that resolves to public IPs. Clients on the internet can reach it.

`internal` ALB: must be in private subnets, gets a DNS name that resolves to private
IPs within the VPC only. External clients cannot reach it without VPN or Direct Connect.

The subnets you assign to an ALB must have a route to an IGW (for internet-facing) or
NAT/nothing (for internal). If you accidentally put an internet-facing ALB in a private
subnet — it will still create, but health checks will fail because the ALB nodes cannot
receive internet traffic.

---

### Intermediate Section: Diagnose Without Full Hints

You receive this configuration diff from the deploy script that triggered the incident:

```diff
# security_group_rules.tf
resource "aws_security_group_rule" "db_from_app" {
-  type        = "ingress"
-  from_port   = 5432
-  to_port     = 5432
-  protocol    = "tcp"
-  source_security_group_id = aws_security_group.app.id
-  security_group_id = aws_security_group.db.id
+  type        = "ingress"
+  from_port   = 5432
+  to_port     = 5432
+  protocol    = "tcp"
+  cidr_blocks = ["10.0.2.0/24"]  # only AZ-a app subnet
+  security_group_id = aws_security_group.db.id
}
```

Questions without hints:

1. What is the exact failure mode this creates, and in which AZ does it manifest?
2. Why is the original (SG-to-SG reference) approach more correct than the CIDR approach?
3. Write the Terraform that correctly restores multi-AZ access without using CIDR blocks.
4. How would you use AWS CloudTrail to find which IAM principal applied this change
   and at what exact time?

---

### Advanced / Stretch

**Scenario A — VPC Flow Logs for incident forensics**

Enable VPC Flow Logs on the database subnet and parse the output:

```bash
aws ec2 create-flow-logs \
  --resource-type Subnet \
  --resource-ids subnet-0ghi9012 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/database-subnet \
  --deliver-logs-permission-arn arn:aws:iam::123456789:role/FlowLogsRole
```

A VPC Flow Log record looks like:

```
2 123456789012 eni-0abc1234 10.0.5.22 10.0.3.15 49823 5432 6 18 2340 1712678234 1712678294 ACCEPT OK
```

Decode: account, ENI, source IP, dest IP, source port, dest port, protocol (6=TCP),
packets, bytes, start, end, action (ACCEPT/REJECT), log-status.

A `REJECT` record for a connection you expected to be accepted means either a SG or
NACL blocked it. Write the CloudWatch Insights query that counts REJECT records grouped
by source IP and destination port for the last 1 hour.

**Scenario B — NAT Gateway and Egress costs**

Your cost report shows $450/month on NAT Gateway data processing charges. Explain the
per-GB pricing model. Write the strategy to reduce costs using: S3 Gateway Endpoints
(free, replace S3 traffic through NAT), Interface Endpoints for other services, and
routing optimization to keep intra-region traffic off NAT.

**Scenario C — Transit Gateway for multi-VPC connectivity**

Design a hub-and-spoke model using Transit Gateway where:
- Shared-services VPC contains DNS, monitoring, and bastion hosts
- Each team VPC peers through the TGW to shared-services
- Team VPCs are isolated from each other (no east-west between teams)

Explain the route table attachments required, and why you need separate TGW route
tables for the shared-services spoke versus the team spokes to enforce isolation.

---

### Sample Architecture Explanation (Interview-Ready)

```
AWS multi-tier architecture for ML inference:

Routing:
  Public subnets (ALB, NAT GWs): route 0.0.0.0/0 → Internet Gateway
  Private app subnets: route 0.0.0.0/0 → NAT Gateway (per AZ for HA)
  Private database subnets: no default route (database initiates no outbound)

Security Groups (stateful, allow-only):
  ALB SG:      inbound 443 from 0.0.0.0/0; outbound to app SG on 8080
  App SG:      inbound 8080 from ALB SG only; outbound 5432 to DB SG; outbound 443 for egress
  DB SG:       inbound 5432 from App SG only; outbound 443 for AWS API calls

NACLs:
  Public subnets:   allow inbound 443/80, ephemeral ports 1024-65535; matching egress
  Private subnets:  allow inbound from VPC CIDR; allow outbound to VPC CIDR and internet
  Database subnets: allow inbound 5432 from app CIDR; outbound ephemeral 1024-65535 to app CIDR

Key decisions:
  - SG rules reference other SG IDs, not CIDRs → survives subnet changes
  - NAT Gateway per AZ → AZ failure doesn't break egress in surviving AZs
  - Database subnet has no IGW route → even a misconfigured SG cannot expose it publicly
  - S3 and DynamoDB accessed via Gateway Endpoints → no NAT charges

Incident pattern: changing SG rules from SG-to-SG references to CIDR rules is a common
"tightening" mistake that silently breaks multi-AZ traffic when only one AZ's CIDR is
included.
```

---

### Common Mistakes

- **Confusing SG and NACL statefulness.** SG is stateful (return traffic automatic).
  NACL is stateless (you must explicitly allow ephemeral ports for return traffic).
  Getting this wrong causes intermittent failures that look like packet loss.
- **Using CIDR rules in SGs instead of SG references.** CIDR rules break when you add
  an AZ or change subnet allocation. SG-to-SG references are resilient to topology changes.
- **NAT Gateway in one AZ.** If the NAT Gateway AZ fails, all private instances in other
  AZs lose internet access. Deploy one NAT Gateway per AZ with separate route tables.
- **Not checking route table associations after subnet changes.** A new subnet not
  associated with the correct route table gets the main route table (often the public one),
  potentially making it a public subnet accidentally.
- **Thinking NACL rule order doesn't matter.** Unlike SGs, NACLs stop at the first
  match. Rule 100 ALLOW followed by rule 110 DENY does not apply both — rule 100 wins.

---

### What To Study Next

- AWS VPC CIDR design: secondary CIDRs, IPv6 dual-stack
- Security Group referencing: same-region SG references, cross-account SG references
- NACL rule numbering conventions and how to leave gaps for future rules
- AWS PrivateLink vs VPC Peering vs Transit Gateway: when to use each
- VPC Flow Logs + CloudWatch Insights for network forensics
- AWS Network Firewall for deep packet inspection beyond SG/NACL capabilities

---

## [SRE] Cloud Networking Drill 4: Kubernetes And Cloud Networking Path

## Cloud Networking Drill 4: Kubernetes And Cloud Networking Path

### Production Context

An internet client sends a request to `https://api.example.com/v1/infer`. The request
traverses: DNS resolution, a global load balancer, a WAF, a GKE or EKS cluster, a
Kubernetes Service, kube-proxy or eBPF routing, and lands on a pod. At each transition
there is a failure mode. Your job is to be able to explain every hop — what component
is responsible, what Kubernetes object is involved, and what a failure at each layer
looks like — as if answering a staff-level SRE interview question.

---

### Prerequisites

- No cloud account required for most of this drill
- For the hands-on exercises: a running GKE or EKS cluster, or a local kind/k3d cluster
- Tools: `kubectl`, `curl`, `dig`, `tcpdump` (inside a debug pod)

---

### Beginner Section: Mapping Every Hop End-To-End

#### Step 1 — The full request path (GKE example)

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

#### Step 2 — DNS: what the cloud resolves and what the cluster resolves

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

#### Step 3 — How traffic enters the cluster

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

#### Step 4 — How Service and Endpoints choose the pod

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

#### Step 5 — Node-local dataplane behaviour

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

#### Step 6 — The "cloud health looks good but users fail" failure pattern

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

### Intermediate Section: Diagnose Without Full Hints

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

### Advanced / Stretch

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

### Sample Architecture Explanation (Interview-Ready)

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

### Common Mistakes

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

### What To Study Next

- Kubernetes Service types and their cloud integrations (NodePort, LoadBalancer, Ingress)
- NEG vs NodePort traffic path: latency and source IP implications
- Cilium Hubble for network flow observability in production
- Connection draining and graceful pod termination for zero-downtime deploys
- Kubernetes EndpointSlice topology hints for latency-aware routing
- ExternalDNS: automating DNS record management from Kubernetes Service/Ingress objects
