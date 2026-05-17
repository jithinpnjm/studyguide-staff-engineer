---
title: "🌐 Networking & Service Mesh"
sidebar_position: 7
description: "Zero to hero study guide for Networking & Service Mesh — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Networking is the foundation of every DevOps environment. Latency, DNS failures, misconfigured firewall rules, and misrouted traffic cause incidents that are notoriously hard to diagnose without a deep understanding of networking fundamentals. Service meshes are the modern answer to securing and observing service-to-service communication without modifying application code.

Staff/Principal impact:
- Network architecture decisions (VPC design, subnet layout, CNI choice) are permanent and expensive to undo
- Service mesh adoption is a platform decision that affects every team's observability and security posture
- Understanding TCP/IP, DNS, and subnetting enables diagnosing incidents that appear to be application bugs

---

## Core Networking Concepts

### The OSI Model — Your Debugging Framework

The Open Systems Interconnection (OSI) model is a seven-layer conceptual framework that standardizes communication between different computing systems. In DevOps, use it as a systematic debugging ladder.

| Layer | Name | Examples | What to check |
|-------|------|----------|---------------|
| L7 | Application | HTTP, DNS, SMTP, FTP | HTTP status codes, DNS resolution, TLS handshake |
| L6 | Presentation | TLS/SSL, encoding | Certificate validity, cipher mismatch |
| L5 | Session | NetBIOS, RPC | Session timeouts |
| L4 | Transport | TCP, UDP | Port open, SYN/ACK, retransmits |
| L3 | Network | IP, ICMP, OSPF | Routing table, subnet mask, firewall rules |
| L2 | Data Link | Ethernet, ARP, MAC | ARP resolution, VLAN config |
| L1 | Physical | Cables, Wi-Fi | Link status, hardware failure |

OSI advantages for DevOps:
- Divides network communication into 7 layers that are easier to understand and troubleshoot independently
- Standardizes network communications — each layer has fixed functions and protocols
- Diagnosing network problems is easier because you can isolate which layer is failing

### Protocols: TCP, UDP, and IP

**TCP (Transmission Control Protocol)**
- Ensures reliable, ordered, and error-checked delivery of data
- Uses a connection-oriented approach — establishes a connection before data transmission (three-way handshake: SYN, SYN-ACK, ACK)
- Ideal for applications requiring accuracy: web browsing, file transfers, database queries
- TCP does not guarantee speed — it retransmits lost packets, which causes latency

**UDP (User Datagram Protocol)**
- A connectionless protocol that prioritizes speed over reliability
- Does not guarantee delivery or order — makes it useful for real-time applications: gaming, video streaming, VoIP
- Lower overhead than TCP; no handshake

**IP (Internet Protocol)**
- Handles addressing and routing of packets across networks
- Assigns unique IP addresses to devices
- Uses routing tables to direct traffic efficiently
- IP headers indicate destination IP address — NOT port numbers (ports live in L4 headers)

### Ports in DevOps

Ports are transport-layer (L4) communication endpoints — a 16-bit unsigned integer ranging from 0 to 65,535. Only TCP or UDP headers indicate which port a packet should go to. IP is unaware of ports.

**Why ports matter for DevOps engineers:**
- Security management: essential for firewall rules to allow or block network traffic
- Service communication: web servers, databases, and applications use specific ports
- Container networking: Docker containers communicate over assigned ports
- Load balancing: services on different instances require properly configured ports
- Troubleshooting: checking whether specific ports are open or blocked during debugging

**Commonly used ports in DevOps:**

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH (Secure Shell) |
| 80 | TCP | HTTP (Web Traffic) |
| 443 | TCP | HTTPS (Secure Web Traffic) |
| 3306 | TCP | MySQL Database |
| 5432 | TCP | PostgreSQL Database |
| 6379 | TCP | Redis Cache |
| 27017 | TCP | MongoDB |
| 9090 | TCP | Prometheus |
| 9100 | TCP | Node Exporter |
| 3000 | TCP | Grafana |
| 8080 | TCP | cAdvisor / App servers |
| 2379-2380 | TCP | etcd |
| 6443 | TCP | Kubernetes API Server |
| 10250 | TCP | Kubelet API |

UDP commonly used ports:
- Port 53: DNS (translates domain names to IPs)
- Port 123: NTP (Network Time Protocol)
- Port 161: SNMP (network device monitoring)
- Port 500: IPsec (VPN encryption)

---

## IP Addressing and Subnetting

### IPv4 vs IPv6

**IPv4:** A 32-bit address written as four decimal numbers separated by dots. Example: `192.168.1.1`. Each number can be 0–255. About 4.3 billion total addresses — now exhausted.

**IPv6:** A 128-bit address written in eight groups of hexadecimal numbers. Example: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`. Provides a vastly larger address pool and includes built-in security features.

**Public vs Private IPs:**
- Public IPs: visible on the internet, assigned by ISPs
- Private IPs: used within local networks (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`). Hidden from internet using NAT (Network Address Translation)

### Subnetting and CIDR

Subnetting is the process of dividing a large IP network into multiple smaller subnetworks. It improves network efficiency, security, and performance by reducing broadcast domains and optimizing IP address allocation.

**Why subnet?**
- Efficient use of IP addresses: avoids wasting IPs in large networks
- Enhanced security: limits communication between devices by segmenting the network
- Optimized performance: reduces broadcast traffic, improving speed and reliability
- Simplified network management: enables logical separation for departments, VLANs, or cloud regions

**CIDR Notation** represents the number of network bits, e.g., `/24` means 24 bits for network, 8 bits for hosts.

| Subnet Mask | CIDR | Hosts per Subnet |
|-------------|------|-----------------|
| 255.255.255.0 | /24 | 254 |
| 255.255.255.128 | /25 | 126 |
| 255.255.255.192 | /26 | 62 |
| 255.255.255.224 | /27 | 30 |
| 255.255.255.240 | /28 | 14 |
| 255.255.255.248 | /29 | 6 |
| 255.255.255.252 | /30 | 2 |

Formula: `2^(host bits) - 2` (subtracting network address and broadcast address)

**Example 1: Dividing 192.168.1.0/24 into 4 subnets**

Step 1 — Determine required subnet bits: need 4 subnets, `2² = 4`, so borrow 2 bits. New mask = `/26` (24 + 2).

Step 2 — Subnet increment: `256 - 192 = 64`

| Subnet | Network Address | Broadcast | Valid Host Range |
|--------|----------------|-----------|-----------------|
| 1 | 192.168.1.0 | 192.168.1.63 | 192.168.1.1 – 192.168.1.62 |
| 2 | 192.168.1.64 | 192.168.1.127 | 192.168.1.65 – 192.168.1.126 |
| 3 | 192.168.1.128 | 192.168.1.191 | 192.168.1.129 – 192.168.1.190 |
| 4 | 192.168.1.192 | 192.168.1.255 | 192.168.1.193 – 192.168.1.254 |

**Example 2: 6 subnets from 10.0.0.0/24**

Step 1: `2³ = 8 >= 6`, borrow 3 bits. New mask = `/27`. Increment = `256 - 224 = 32`.

| Subnet | Network | Broadcast | Valid Host Range |
|--------|---------|-----------|-----------------|
| 1 | 10.0.0.0 | 10.0.0.31 | 10.0.0.1 – 10.0.0.30 |
| 2 | 10.0.0.32 | 10.0.0.63 | 10.0.0.33 – 10.0.0.62 |
| 3 | 10.0.0.64 | 10.0.0.95 | 10.0.0.65 – 10.0.0.94 |
| 4 | 10.0.0.96 | 10.0.0.127 | 10.0.0.97 – 10.0.0.126 |
| 5 | 10.0.0.128 | 10.0.0.159 | 10.0.0.129 – 10.0.0.158 |
| 6 | 10.0.0.160 | 10.0.0.191 | 10.0.0.161 – 10.0.0.190 |

---

## DNS — Domain Name System

### How DNS Works

DNS translates human-readable domain names (e.g., `example.com`) to IP addresses that machines use to route traffic. DNS runs on UDP/TCP port 53.

**DNS resolution steps:**
1. Client queries local resolver (or OS cache)
2. Resolver queries root nameserver (`.`)
3. Root refers to TLD nameserver (`.com`)
4. TLD refers to authoritative nameserver
5. Authoritative nameserver returns the answer record

### DNS Record Types

| Record | Purpose | Example |
|--------|---------|---------|
| A | Maps hostname to IPv4 | `api.example.com -> 1.2.3.4` |
| AAAA | Maps hostname to IPv6 | `api.example.com -> 2001:db8::1` |
| CNAME | Alias to another hostname | `www -> api.example.com` |
| MX | Mail exchange server | `mail.example.com priority 10` |
| TXT | Arbitrary text (SPF, DKIM, verification) | `v=spf1 include:...` |
| NS | Authoritative nameserver for a zone | `ns1.example.com` |
| PTR | Reverse DNS — IP to hostname | Used in email anti-spam |
| SRV | Service discovery with port and weight | `_http._tcp.example.com` |

### DNS Providers (DevOps context)

- **AWS Route 53**: integrates with ELB, supports health-check-based failover, weighted routing, latency-based routing, and geolocation routing
- **Cloudflare**: global CDN + DNS, DDoS protection, sub-millisecond TTL changes
- **Google Cloud DNS**: managed authoritative DNS with 100% uptime SLA

### DNS Load Balancing and Failover

DNS load balancing distributes traffic by returning different IP addresses per query (round-robin). Route 53 weighted routing:
- Weight 70 → primary region
- Weight 30 → secondary region
- Health check integration: automatic failover when endpoint unhealthy

---

## Network Infrastructure

### Load Balancing

Load balancing distributes incoming traffic across multiple servers to ensure no single server is overwhelmed, improving availability and reliability.

**L4 vs L7 Load Balancers:**

| Type | Operates at | Sees | Use case |
|------|------------|------|---------|
| L4 | Transport (TCP/UDP) | IP + port only | Fast routing, no HTTP awareness |
| L7 | Application (HTTP) | URL, headers, cookies | Path-based routing, canary deploys |

**Load Balancing Algorithms:**
- **Round Robin**: requests distributed sequentially across servers
- **Least Connections**: new request sent to server with fewest active connections
- **IP Hash**: client IP determines which server handles the request (session persistence)
- **Weighted Round Robin**: servers assigned a weight; higher-weight servers get more traffic

**HAProxy configuration example:**
```
frontend http_front
   bind *:80
   default_backend http_back

backend http_back
   balance roundrobin
   server server1 192.168.1.10:80 check
   server server2 192.168.1.11:80 check
   server server3 192.168.1.12:80 check
```

**AWS ALB (Application Load Balancer):** L7 load balancer supporting path-based routing, host-based routing, and weighted target groups for canary deployments.

### Reverse Proxy

A reverse proxy sits in front of backend servers and forwards client requests. It hides backend topology from clients and enables features like SSL termination, caching, and rate limiting.

**NGINX as a reverse proxy:**
```nginx
upstream backend {
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**NGINX SSL termination:**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://backend;
    }
}
```

**Traefik as a reverse proxy** (Kubernetes-native, dynamic config via annotations):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 80
```

### CDN (Content Delivery Network)

A CDN distributes static content (images, JS, CSS) across geographically distributed edge nodes, reducing latency by serving content from the closest node to the user.

**Benefits:**
- Reduced latency: content served from edge, not origin
- DDoS mitigation: traffic absorbed at edge before reaching origin
- Reduced origin load: cache hits never reach the backend

**Popular providers:** Cloudflare, AWS CloudFront, Akamai

**Caching strategies:**
- `Cache-Control: max-age=86400` — cache for 24 hours
- `Cache-Control: no-store` — never cache (for auth endpoints)
- Cache invalidation via CDN APIs on new deployments

---

## Cloud Networking

### Virtual Private Cloud (VPC)

A VPC is a logically isolated network in a cloud provider. Within a VPC you define subnets, route tables, internet gateways, and security groups.

**VPC design principles:**
- Use separate subnets for public (internet-facing), private (app tier), and isolated (database) layers
- Never put databases in public subnets
- Use CIDR blocks that leave room for growth: `/16` for VPC, `/24` for subnets
- Route tables control which subnets can reach the internet (via Internet Gateway) or only internal resources (via NAT Gateway)

**Security Groups vs Network ACLs:**
- Security Groups: stateful, instance-level, allow-only rules
- Network ACLs: stateless, subnet-level, allow and deny rules

---

## Container and Kubernetes Networking

### Docker Networking

Docker containers communicate over assigned ports. Modes:
- **bridge** (default): containers on same host share a virtual bridge; external access via port mapping
- **host**: container shares host network namespace — no isolation but no NAT overhead
- **overlay**: multi-host networking used by Docker Swarm
- **none**: no networking

Port mapping example: `-p 8080:80` maps host port 8080 to container port 80.

### Kubernetes Networking

Kubernetes networking follows these requirements:
- All pods can communicate with all other pods without NAT
- All nodes can communicate with all pods without NAT
- The IP a pod sees itself as is the same IP others use to reach it

**CNI plugins** implement these requirements: Flannel (simple, VXLAN), Calico (L3 routing + network policy), Cilium (eBPF-based, L7 policy).

**Services and DNS:**
- ClusterIP: stable virtual IP inside cluster, kube-proxy routes traffic to pod IPs
- NodePort: exposes service on each node's IP at a static port
- LoadBalancer: provisions cloud load balancer
- ExternalName: CNAME alias for external service

Kubernetes CoreDNS resolves service names: `my-service.my-namespace.svc.cluster.local`

### Kubernetes Network Policies

Network Policies restrict pod-to-pod traffic. Without a NetworkPolicy, all traffic is allowed. With at least one policy selecting a pod, only explicitly allowed traffic passes.

**Default deny all ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

**Allow only from specific namespace:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-monitoring
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 8080
```

**Debugging NetworkPolicy issues:**
```bash
# List policies in namespace
kubectl get networkpolicy -n <namespace>

# Describe policy to see pod selector and rules
kubectl describe networkpolicy <policy-name> -n <namespace>

# Check if pod is affected by a policy
kubectl get pod <pod-name> -o yaml | grep -i label -A 5
```

---

## Service Mesh

### What is a Service Mesh?

A service mesh is a dedicated infrastructure layer for managing service-to-service communication in a microservices architecture. It handles:
- **Traffic management**: routing, load balancing, retries, circuit breaking
- **Security**: mutual TLS (mTLS) between services, certificate management
- **Observability**: distributed tracing, metrics, access logs — without application code changes

A service mesh typically uses sidecar proxies (one per pod) that intercept all inbound and outbound traffic.

**Benefits:**
- Transparent mTLS: encrypt all east-west traffic without changing application code
- Fine-grained traffic control: canary deployments, A/B testing, traffic mirroring
- Unified observability: consistent metrics and traces across all services
- Resilience: automatic retries, timeouts, circuit breakers at the infrastructure level

### Istio Architecture

Istio is the most widely adopted service mesh. Its architecture has two planes:

**Data Plane:** Envoy sidecar proxies injected into every pod. Envoy handles all inbound and outbound traffic, collecting telemetry.

**Control Plane (Istiod):** Single binary that includes:
- **Pilot**: manages service discovery and pushes routing configuration to Envoy sidecars
- **Citadel**: certificate authority for mTLS — issues and rotates X.509 certificates
- **Galley**: configuration validation and distribution

**Istio installation (Helm):**
```bash
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

# Install Istio base CRDs
helm install istio-base istio/base -n istio-system --create-namespace

# Install Istiod control plane
helm install istiod istio/istiod -n istio-system --wait

# Enable sidecar injection for a namespace
kubectl label namespace production istio-injection=enabled
```

**Verify Istio is running:**
```bash
kubectl get pods -n istio-system
kubectl get svc -n istio-system
istioctl analyze
```

### Istio Traffic Management

**VirtualService** — defines how traffic is routed to a service. Enables canary deployments, retries, and fault injection:
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
```

**DestinationRule** — defines subsets (versions) and load balancing policy:
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
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

**Circuit Breaker via DestinationRule:**
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: my-app-cb
spec:
  host: my-app
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
```

**Retry policy via VirtualService:**
```yaml
http:
  - route:
      - destination:
          host: my-app
    retries:
      attempts: 3
      perTryTimeout: 2s
      retryOn: gateway-error,connect-failure,retriable-4xx
```

### Istio mTLS

mTLS ensures that all service-to-service communication is encrypted and mutually authenticated. Both parties present certificates issued by Istiod's built-in CA.

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

**Namespace-level permissive mode (during migration):**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: legacy
spec:
  mtls:
    mode: PERMISSIVE
```

**Authorization Policy — restrict which services can call each other:**
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-payments
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

### Istio Gateway (Ingress)

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: my-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: my-tls-secret
      hosts:
        - "*.example.com"
```

### Linkerd

Linkerd is a lightweight CNCF service mesh focused on simplicity. It uses Rust-based micro-proxies (linkerd2-proxy) that have a smaller resource footprint than Envoy. Key differences from Istio:

- Simpler configuration — fewer CRDs, less complexity
- Automatic mTLS without additional PeerAuthentication resources
- Lower resource overhead (better for resource-constrained clusters)
- Less feature-rich: no fault injection, limited traffic management compared to Istio

**Linkerd install:**
```bash
curl -sL run.linkerd.io/install | sh
linkerd check --pre
linkerd install | kubectl apply -f -
linkerd check
```

**Inject Linkerd proxy into a deployment:**
```bash
kubectl get deploy my-app -o yaml | linkerd inject - | kubectl apply -f -
```

### Service Mesh Best Practices

- Start with observability enabled before enabling mTLS — understand existing traffic patterns first
- Use PERMISSIVE mTLS mode during migration, then switch to STRICT
- Define NetworkPolicies to allow sidecar proxy ports (15001, 15006, 15008 for Istio)
- Monitor sidecar resource usage — Envoy adds CPU and memory overhead per pod
- Use Kiali (Istio UI) to visualize service topology and traffic flow
- Set appropriate retry budgets — unlimited retries can cause cascading failures

---

## Network Security

### Encryption in Transit

- TLS 1.2 and TLS 1.3 are the widely used secure versions. TLS 1.0 and 1.1 are deprecated.
- TLS provides: data encryption (prevents MITM), authentication (client communicates with intended server), data integrity (prevents tampering)
- DevOps tooling: `openssl s_client -connect host:443` to inspect TLS handshake

### VPN (Virtual Private Network)

VPNs create encrypted tunnels between networks. Common use cases:
- Connecting on-prem data centers to cloud VPCs (Site-to-Site VPN)
- Secure remote access for engineers (Client VPN)
- IPsec (port 500 UDP) is the standard protocol for VPN encryption

### Zero Trust Architecture

Zero Trust replaces implicit network trust with continuous verification:
- Never trust, always verify — authenticate and authorize every request regardless of network location
- Micro-segmentation: use NetworkPolicies and mTLS to enforce east-west traffic controls
- All traffic encrypted — no plaintext on internal networks
- Least privilege access at every layer: IAM, RBAC, NetworkPolicy, mTLS AuthorizationPolicy

---

## Network Monitoring and Troubleshooting

### Essential Networking Tools

```bash
# Check if a port is open
nc -zv hostname 443
telnet hostname 443

# DNS resolution
dig api.example.com
nslookup api.example.com
dig +trace api.example.com   # full DNS resolution chain

# Trace packet path
traceroute hostname
mtr hostname                  # continuous traceroute

# Check active connections and listening ports
ss -tlnp
netstat -tlnp

# Packet capture
tcpdump -i eth0 port 80 -w capture.pcap
tcpdump -i any host 10.0.0.1 and port 8080

# HTTP connectivity test
curl -v https://api.example.com
curl -o /dev/null -w "%{http_code} %{time_total}\n" https://example.com

# TLS inspection
openssl s_client -connect api.example.com:443

# Check Kubernetes service DNS inside pod
kubectl exec -it <pod> -- nslookup my-service.default.svc.cluster.local
kubectl exec -it <pod> -- curl http://my-service:8080/health
```

### Kubernetes Networking Troubleshooting

```bash
# Check pod IP and node
kubectl get pod <pod-name> -o wide

# Check service endpoints (are pods registered?)
kubectl get endpoints <service-name>

# Describe service to see selector
kubectl describe svc <service-name>

# Check if DNS works from inside a pod
kubectl run debug --image=busybox --rm -it -- nslookup kubernetes.default

# Check Istio sidecar injection
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].name}'

# Istio proxy status
istioctl proxy-status
istioctl proxy-config cluster <pod-name>.<namespace>

# Check NetworkPolicy effect
kubectl describe networkpolicy -n <namespace>
```

---

## Network Automation and IaC

### Infrastructure as Code for Networking

Network configurations managed as code enable reproducibility and auditability.

**Terraform VPC example:**
```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "production-vpc"
  }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "private-${count.index}"
  }
}

resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  map_public_ip_on_launch = true

  tags = {
    Name = "public-${count.index}"
  }
}
```

### CI/CD for Network Configuration

- Validate Terraform network configs with `terraform validate` and `terraform plan` before applying
- Scan network IaC with `tfsec` for open security groups, unencrypted resources, overly permissive rules
- Use GitOps workflows (Flux, ArgoCD) to manage Kubernetes NetworkPolicy manifests
- Test connectivity in staging before production with automated curl/nc health checks

---

## Software-Defined Networking (SDN)

SDN separates the control plane (deciding where traffic goes) from the data plane (forwarding packets), enabling programmatic network control.

**In Kubernetes context:** kube-proxy, CNI plugins, and service meshes are all SDN implementations. They dynamically program iptables rules or eBPF maps based on cluster state rather than requiring manual switch/router configuration.

**eBPF-based networking (Cilium):** Uses Linux kernel's eBPF to implement networking at the kernel level — bypasses iptables overhead, enables L7-aware NetworkPolicies (filter by HTTP path or method), and provides per-connection observability.

---

## Interview Preparation

**Common interview questions:**

1. **Explain what happens when you type `curl https://api.example.com` in a pod running in Kubernetes.**
   - DNS resolution via CoreDNS → Service IP returned → kube-proxy routes to pod IP → TCP connection (SYN/SYN-ACK/ACK) → TLS handshake → HTTP request/response. If Istio is installed, Envoy sidecar intercepts both sides.

2. **A pod cannot reach another pod in the same namespace. How do you diagnose?**
   - Check `kubectl get networkpolicy` for any deny policies
   - Verify pod IPs with `kubectl get pod -o wide`
   - Check service endpoints: `kubectl get endpoints`
   - Run connectivity test: `kubectl exec pod-a -- nc -zv pod-b-ip 8080`
   - Check if sidecar mTLS is blocking: `istioctl proxy-config listener pod-name`

3. **What is the difference between a VirtualService and a DestinationRule in Istio?**
   - VirtualService: defines routing rules (how traffic is routed — weights, header matching, retries)
   - DestinationRule: defines destination configuration (subsets, load balancing algorithm, circuit breaker settings)

4. **How do you calculate the number of subnets from 10.0.0.0/8 each with /24 prefix?**
   - Total host bits: 32 - 8 = 24. Subnet bits needed: 24 - 8 = 16. Number of /24 subnets: `2^16 = 65,536`.

5. **What DNS record do you use for a CNAME chain, and what is the risk?**
   - CNAME points to another hostname. Risk: CNAME at apex domain (`@`) is prohibited by RFC — use ALIAS or ANAME records instead. Long CNAME chains add DNS resolution latency.

6. **Explain TCP three-way handshake and why it matters for DevOps.**
   - SYN (client) → SYN-ACK (server) → ACK (client). Each step has a timeout. High `SYN_SENT` counts indicate the server is unreachable or its port is blocked. Incomplete handshakes waste connections and are a vector for SYN flood DDoS attacks.
