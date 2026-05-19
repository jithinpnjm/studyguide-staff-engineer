---
title: "Intermediate"
sidebar_position: 2
---

# Networking — Intermediate

This section covers TCP internals, TLS handshake details, HTTP/2, load balancing algorithms, reverse proxies, VPN, and cloud networking concepts including VPCs, security groups, and NACLs.

---

## TCP Flow Control and Connection Internals

### Flow Control and Congestion Control

TCP flow control prevents a fast sender from overwhelming a slow receiver. The receive window (`rwnd`) in the TCP header tells the sender how much buffer space is available. The sender cannot send more than `min(cwnd, rwnd)` bytes without waiting for an ACK.

**Congestion control (TCP slow start):** When a new connection opens, TCP starts with a small congestion window (cwnd) and doubles it each RTT until it detects packet loss. After loss, cwnd is halved. This is why TCP throughput ramps up slowly on new connections — a significant issue for short-lived connections like microservice API calls.

**SRE implications:**
- High retransmission counts (`ss --info`) indicate packet loss or congestion
- `SYN_RECV` backlog full → new connections get dropped silently (SYN flood or overload)
- `TIME_WAIT` pile-up on a high-traffic server → ephemeral port exhaustion

```bash
# Check TCP connection states
ss -s              # summary of all states
ss -tan state time-wait | wc -l   # count TIME_WAIT connections

# Check for retransmissions
ss --info | grep retrans

# Check SYN backlog
ss -ltn src :8080  # backlog column shows listen queue depth
```

### TCP Flags Decoded

| Flag | Meaning | SRE significance |
|------|---------|-----------------|
| SYN | Initiate connection | SYN with no SYN-ACK → firewall drop or unreachable host |
| SYN-ACK | Accept connection | Only appears if port is open and listening |
| ACK | Acknowledge receipt | Normal data flow |
| FIN | Graceful close | Appears at connection teardown |
| RST | Abrupt close | Port closed, firewall REJECT, or application crash |
| PSH | Push data now | Sender wants data delivered to application immediately |
| URG | Urgent data | Rare; used in legacy protocols |

### Conntrack — Connection Tracking

Linux tracks active TCP/UDP connections in a conntrack table (used by iptables for stateful filtering). If the table fills:
- New connections fail silently (kernel drops them)
- Existing connections continue working
- This pattern is a common source of mysterious "intermittent failure under load" incidents

```bash
# Check conntrack table usage vs max
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max

# Watch for conntrack full error
dmesg | grep "nf_conntrack: table full"

# Increase conntrack max (temporary)
sudo sysctl -w net.netfilter.nf_conntrack_max=131072
```

---

## TLS Handshake

TLS (Transport Layer Security) provides confidentiality, integrity, and authentication. HTTPS = HTTP over TLS. All modern services should use TLS 1.2 minimum; TLS 1.3 is preferred.

### TLS 1.2 Handshake

```
Client                          Server
  |                               |
  |--- ClientHello ─────────────>|  (TLS version, cipher suites, random nonce)
  |<── ServerHello ─────────────|  (chosen cipher, random nonce, certificate)
  |<── Certificate ─────────────|  (server's public key)
  |<── ServerHelloDone ─────────|
  |--- ClientKeyExchange ───────>|  (pre-master secret encrypted with server's pubkey)
  |--- ChangeCipherSpec ────────>|  (from now on, use the negotiated cipher)
  |--- Finished ────────────────>|
  |<── ChangeCipherSpec ─────────|
  |<── Finished ─────────────────|
  |=== Encrypted HTTP data flows =|
```

TLS 1.2 requires 2 round trips before data can flow. This adds latency vs plain TCP.

### TLS 1.3 Handshake

TLS 1.3 reduces this to 1 round trip (1-RTT). Resumed sessions can use 0-RTT (with replay attack caveats). It also removes weak cipher suites and mandates forward secrecy.

### Certificate Verification

When the client receives the server certificate, it checks:
1. **Hostname match:** CN or SAN must match the domain being connected to
2. **Expiry:** Certificate must not be past its `notAfter` date
3. **Chain of trust:** Certificate must chain to a trusted CA in the client's trust store

**Common TLS errors:**
- `certificate has expired` — cert rotation failed; alert at 30/14/7 days before expiry
- `hostname mismatch` — cert is for `api.example.com`, connecting to `backend.internal`
- `CERTIFICATE_VERIFY_FAILED` — missing intermediate cert, self-signed, wrong root CA
- `SSL_ERROR_RX_RECORD_TOO_LONG` — TLS port is actually serving plain HTTP

```bash
# Inspect TLS certificate details
openssl s_client -connect api.example.com:443 -servername api.example.com

# Check cert expiry date
echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Alert if cert expires within 30 days
EXPIRY=$(echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY" +%s)
NOW=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW) / 86400 ))
[ $DAYS_LEFT -lt 30 ] && echo "ALERT: cert expires in $DAYS_LEFT days"
```

### mTLS — Mutual TLS

Standard TLS: only the server presents a certificate (client verifies server). mTLS: both sides present certificates (server also verifies client). mTLS enforces service identity — only services with a valid certificate from the same CA can communicate. This is the foundation of zero-trust service mesh security.

---

## HTTP/2

HTTP/1.1 allows one request at a time per connection. Browsers work around this by opening 6-8 parallel connections per domain, which is wasteful.

**HTTP/2 key features:**
- **Multiplexing:** Multiple requests and responses over a single TCP connection via streams. No head-of-line blocking at HTTP layer.
- **Binary framing:** Requests and responses are binary-encoded (more efficient to parse than HTTP/1.1 text).
- **Header compression (HPACK):** Repeated headers (like `Authorization`, `Accept`) are compressed.
- **Server push:** Server can proactively send resources before the client asks.

**HTTP/3:** Built on QUIC (UDP-based). Solves TCP head-of-line blocking at the transport layer (a slow TCP stream cannot block other streams). Primarily between clients and CDN edges; backend services typically use HTTP/1.1 or HTTP/2.

**SRE relevance for microservices:** If services make thousands of short requests per second, HTTP/2 multiplexing reduces TCP connection overhead significantly. Subsequent requests in the same TLS session show `time_appconnect=0.000s` in curl timing — the TLS setup is amortized.

---

## Load Balancing Algorithms

Load balancers distribute traffic across backend servers to prevent overload and improve availability.

### L4 vs L7 Load Balancers

| Type | Layer | Sees | Use case |
|------|-------|------|---------|
| L4 | Transport (TCP/UDP) | IP + port only | Fast routing, low overhead, no HTTP awareness |
| L7 | Application (HTTP) | URL, headers, cookies, body | Path-based routing, canary deploys, auth, rate limiting |

### Algorithms

**Round Robin:** Requests distributed sequentially across servers. Simple; ignores server load. Best for uniform request sizes and homogeneous backends.

**Least Connections:** New request sent to the server with the fewest active connections. Better for variable-length requests (one long request should not monopolize a server while others are idle). Preferred for long-lived connections, gRPC, and WebSockets.

**IP Hash / Sticky Sessions:** Client IP determines which server handles the request. Same client always goes to same server — enables session persistence. Breaks if a server goes down (all its sessions lose affinity). Problematic if many users share a NAT IP.

**Weighted Round Robin:** Servers assigned a weight; higher-weight servers get proportionally more traffic. Useful during blue-green deployments or when backends have different capacities.

**Random Two:** Pick two backends randomly, route to the one with fewer connections (power of two choices). Avoids the coordination overhead of global least-connections tracking.

```
# HAProxy configuration example
frontend http_front
   bind *:80
   default_backend http_back

backend http_back
   balance leastconn
   server server1 192.168.1.10:80 weight=3 check maxfail=3 fall 3 rise 2
   server server2 192.168.1.11:80 weight=3 check maxfail=3 fall 3 rise 2
   server server3 192.168.1.12:80 weight=1 backup check
```

---

## Reverse Proxies

A reverse proxy sits in front of backend servers, forwarding client requests. It hides backend topology, enables SSL termination, caching, rate limiting, and health checking.

### NGINX as a Reverse Proxy

```nginx
upstream api_backend {
    least_conn;
    keepalive 32;   # persistent connections to backends

    server backend1:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend2:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend3:8080 weight=1 backup;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/api.example.com.pem;
    ssl_certificate_key /etc/ssl/api.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";        # enable keepalive to backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

**Key NGINX timeout semantics:**
- `proxy_connect_timeout`: time to establish connection to upstream
- `proxy_read_timeout`: time to wait for upstream to send next byte (resets on each response byte)
- `proxy_send_timeout`: time to wait for upstream to accept next byte of request

**Timeout cascade rule:** Client timeout must be shorter than NGINX proxy timeout, which must be shorter than backend application timeout. Inversion causes confusing partial failures.

### NGINX Rate Limiting

```nginx
http {
    # Define rate limit zone (key=IP, 10MB zone, 10 requests/second max)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $http_authorization zone=user_limit:10m rate=100r/m;

    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;
        }
    }
}
```

NGINX rate limiting uses a leaky bucket algorithm. `burst=20` allows up to 20 extra requests to queue. `nodelay` processes queued requests immediately rather than spreading them over time. Without `burst`, every excess request gets 429 immediately.

### Common Failure Modes

**Connection pool exhaustion:** Too many concurrent requests, not enough keepalive connections. Symptom: 502s with "no live upstreams" in error log despite backends being healthy. Fix: increase `keepalive` in upstream block, scale backends.

**X-Forwarded-For missing:** Application needs client IP but receives proxy IP. Fix: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`. Application reads the last non-trusted IP in the header.

**Large body rejected:** Default `client_max_body_size` in NGINX is 1MB. File uploads return 413. Fix: increase for relevant locations.

---

## VPN — Virtual Private Network

VPNs create encrypted tunnels between networks or between a client and a network.

**Site-to-Site VPN:** Connects on-prem data centers to cloud VPCs. Bidirectional traffic over an encrypted IPsec tunnel. Useful for hybrid cloud architectures.

**Client VPN:** Secure remote access for engineers. Engineers connect to the VPN and can then reach private subnet resources.

**IPsec:** The standard protocol for VPN encryption. Runs on UDP port 500. Uses IKE (Internet Key Exchange) for negotiating session keys.

**Split tunneling:** Only private IP ranges go through the VPN tunnel; internet traffic goes direct from the client. Reduces VPN server load but requires careful route management to avoid traffic leaks.

---

## VPC — Virtual Private Cloud

A VPC is a logically isolated private network within a cloud provider. You control the IP ranges, subnets, routing, and security policies.

### VPC Design Principles

- Use `/16` for the VPC CIDR — leaves room for many subnets
- Separate subnets for: public (internet-facing), private (app tier), isolated (databases)
- Never put databases in public subnets
- Route tables control which subnets can reach the internet
- Public subnets have a route to an Internet Gateway (IGW)
- Private subnets route egress through a NAT Gateway; no inbound from internet

```
Internet
    ↓ (HTTPS)
Internet Gateway (IGW)
    ↓
Public Subnet (10.0.1.0/24) — ALB, NAT Gateway
    ↓
Private Subnet (10.0.2.0/24) — App tier (EC2, EKS nodes)
    ↓
Isolated Subnet (10.0.3.0/24) — RDS, ElastiCache (no internet route)
```

### Two Network Layers in Cloud: Cloud vs Kubernetes

A critical mental model for SRE:

| Layer | Analogy | Meaning |
|---|---|---|
| Cloud Network | City highways | VPC, subnets, routes, load balancers |
| Kubernetes Network | Building hallways | Pod-to-Pod and Service traffic |
| NAT | Toll gate | Outbound shared egress |
| Security Group | Gate guard | Stateful allow policy |
| NetworkPolicy | Internal room rules | Pod traffic control |
| Ingress | Reception desk | External HTTP routing |

When a connection fails, determine which layer owns the broken hop before running commands.

---

## Security Groups vs Network ACLs

**Security Groups** are the primary defense mechanism in cloud networking.

| Property | Security Groups | Network ACLs |
|----------|----------------|--------------|
| State | Stateful — reply traffic is automatically allowed | Stateless — must explicitly allow return traffic |
| Scope | Instance-level (attached to ENI/VM) | Subnet-level |
| Rules | Allow only (no explicit deny) | Allow and deny |
| Evaluation | All rules evaluated; most permissive wins | Rules evaluated in order; first match wins |

**SRE checklist for connectivity failures:**
1. Check security group on the destination instance — is the required port allowed?
2. Check security group on the source instance — is outbound allowed?
3. Check NACLs on both subnets — remember NACLs are stateless (return traffic needs an explicit rule)
4. Check route tables — does the route to the destination exist?

```bash
# AWS CLI: check security group rules
aws ec2 describe-security-groups --group-ids sg-12345678

# AWS CLI: check instance security groups
aws ec2 describe-instances --instance-ids i-12345678 \
  --query 'Reservations[].Instances[].SecurityGroups'

# Check NACL for a subnet
aws ec2 describe-network-acls --filters "Name=association.subnet-id,Values=subnet-12345678"
```

---

## CDN — Content Delivery Network

A CDN distributes static content (images, JS, CSS, videos) across geographically distributed edge nodes, reducing latency by serving content from the closest node to the user.

**Benefits:**
- Reduced latency: content served from edge PoP, not origin data center
- DDoS mitigation: traffic absorbed at edge before reaching origin
- Reduced origin load: cache hits never reach the backend
- Improved availability: origin can be down and cached content still serves

**Cache-Control headers:**
```
Cache-Control: max-age=86400          # cache for 24 hours
Cache-Control: no-store               # never cache (use for auth endpoints)
Cache-Control: s-maxage=3600         # CDN-specific TTL (overrides max-age for CDN)
Cache-Control: stale-while-revalidate=60  # serve stale while fetching fresh
```

**CDN invalidation:** On new deployments, invalidate CDN cache for changed assets:
```bash
# AWS CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"

# Cloudflare cache purge
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"purge_everything":true}'
```

---

## DNS Load Balancing and Failover

DNS load balancing distributes traffic by returning different IP addresses per query (round-robin). AWS Route 53 supports advanced routing policies:

- **Weighted routing:** Weight 70 → primary region, weight 30 → secondary region
- **Latency-based routing:** Route to the region with lowest measured latency to the client
- **Geolocation routing:** Route based on client geography (EU traffic to EU, US traffic to US)
- **Failover routing:** Active-passive; primary fails health check → secondary activates
- **Health-check integration:** Automatic failover when endpoint health check fails

**SRE note:** DNS TTL limits how fast failover propagates. A TTL of 60 seconds means up to 60 seconds of traffic to a failed endpoint before all clients switch. Set low TTLs (30-60s) for critical failover scenarios.

---

## Kubernetes Service Types — Deep Comparison

| Type | When to Use | What Happens |
|---|---|---|
| **ClusterIP** | Internal service-to-service | Virtual IP, only reachable within cluster |
| **NodePort** | Testing, bare-metal LB | Exposes port on every node (30000–32767) |
| **LoadBalancer** | Production external access | Provisions cloud LB (NLB/ALB/GLB) |
| **ExternalName** | Alias to external hostname | CNAME returned by CoreDNS — no proxy |
| **Headless** | StatefulSets, DNS-based discovery | No ClusterIP; DNS returns Pod IPs directly |

### ExternalTrafficPolicy

`externalTrafficPolicy` controls how external traffic is routed to pods and whether the source IP is preserved.

```yaml
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local   # or Cluster (default)
```

| Mode | Behavior | Source IP Preserved? | Risk |
|---|---|---|---|
| `Cluster` (default) | Routes to any ready pod across nodes via kube-proxy | No (SNAT applied) | Extra hop, IP lost |
| `Local` | Routes only to pods on the receiving node | Yes | Uneven load if pods not on all nodes |

**When to use `Local`:** When your app needs the real client IP (audit logging, geo-IP, rate limiting by IP). Ensure pods are spread across all nodes (DaemonSet or `topologySpreadConstraints`) to avoid traffic black-holing on empty nodes.

### Headless Services

A headless Service has `clusterIP: None`. CoreDNS returns A records for each ready Pod IP instead of a single virtual ClusterIP.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: cassandra
spec:
  clusterIP: None           # headless
  selector:
    app: cassandra
  ports:
    - port: 9042
```

Use cases:
- **StatefulSets** — Pods get stable DNS names (`cassandra-0.cassandra.default.svc.cluster.local`)
- **DNS-based client-side load balancing** — client resolves DNS and chooses a backend itself
- **Service discovery without kube-proxy** — direct pod-to-pod for databases that need stable identity

### Topology-Aware Routing (Traffic Hints)

Topology hints tell kube-proxy or Cilium to prefer backends in the same zone as the traffic origin, reducing cross-zone data transfer costs and latency.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
  annotations:
    service.kubernetes.io/topology-mode: "Auto"
spec:
  selector:
    app: api
```

- Kubernetes allocates hints via the EndpointSlice controller based on node zone labels
- `Auto` mode: kube-proxy routes to local-zone endpoints first; falls back to any zone if insufficient local endpoints
- Check hints: `kubectl get endpointslice -l kubernetes.io/service-name=api -o yaml | grep hints`

---

## Kubernetes DNS Deep Dive

### ndots:5 — The Hidden Latency Source

Every pod's `/etc/resolv.conf` defaults to `ndots:5`. A name with fewer than 5 dots triggers search-domain expansion before trying the name as-is. For a pod resolving `api.stripe.com`:

```text
Try: api.stripe.com.default.svc.cluster.local  → NXDOMAIN
Try: api.stripe.com.svc.cluster.local          → NXDOMAIN
Try: api.stripe.com.cluster.local              → NXDOMAIN
Try: api.stripe.com.                           → ANSWER (success)
```

That's 3 failed CoreDNS queries before reaching the external resolver. At scale (100K requests/sec), this triples CoreDNS load.

**Mitigations:**
```yaml
# Option 1: Use trailing dot (FQDN) in code
# curl("https://api.stripe.com./v1/charges")  # dot forces absolute lookup

# Option 2: Tune per-pod dnsConfig
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "1"    # only names with 0 dots get search-domain expansion
      - name: single-request-reopen   # prevents race condition on concurrent A/AAAA

# Option 3: Node-local DNS cache (NodeLocal DNSCache daemonset)
# Caches responses locally, eliminates cluster-wide CoreDNS lookup for repeated names
```

### CoreDNS Tuning

```yaml
# CoreDNS configmap tuning for high-traffic clusters
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
        }
        hosts /etc/coredns/NodeHosts {
            ttl 60
            reload 15s
            fallthrough
        }
        prometheus :9153
        cache 30           # cache positive results for 30s (default: 0)
        forward . 8.8.8.8 8.8.4.4 {
            max_concurrent 1000
        }
        loop
        reload
        loadbalance
    }
```

Key tuning knobs:
- `cache 30` — reduces upstream queries by caching successful lookups 30s
- `max_concurrent 1000` — limits parallel upstream forwarder connections (prevent overload)
- `autopath @kubernetes` — reduces search-domain queries by pre-resolving them in CoreDNS (aggressive but effective)
