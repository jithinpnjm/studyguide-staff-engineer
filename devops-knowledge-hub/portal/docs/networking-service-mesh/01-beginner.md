---
title: "Beginner"
sidebar_position: 1
---

# Networking Fundamentals — Beginner

Networking is how every system talks. Every web request, database query, SSH login, Kubernetes service call, and API integration depends on networking. When networking is unclear, production incidents feel random. When it is understood, outages become traceable systems.

---

## The OSI Model — Your Debugging Framework

The Open Systems Interconnection (OSI) model is a seven-layer conceptual framework that standardizes communication between computing systems. In SRE and DevOps, use it as a systematic debugging ladder — isolate which layer is failing before touching anything.

| Layer | Name | Examples | What to check in production |
|-------|------|----------|-----------------------------|
| L7 | Application | HTTP, DNS, SMTP | HTTP status codes, DNS resolution, TLS handshake |
| L6 | Presentation | TLS/SSL, encoding | Certificate validity, cipher mismatch |
| L5 | Session | NetBIOS, RPC | Session timeouts, connection state |
| L4 | Transport | TCP, UDP | Port open, SYN/ACK, retransmits |
| L3 | Network | IP, ICMP, OSPF | Routing table, subnet mask, firewall rules |
| L2 | Data Link | Ethernet, ARP, MAC | ARP resolution, VLAN config |
| L1 | Physical | Cables, Wi-Fi | Link status, hardware failure |

**Why the OSI model matters for SRE:** When an incident occurs, the layers give you a structured search space. A connection timeout (TCP SYN with no SYN-ACK) is an L3/L4 issue — do not look at L7 application logs first. A 502 from NGINX is an L7 issue — do not waste time on routing tables.

---

## Memory Palace: Networking as an Airport

| Networking Concept | Analogy | Real Meaning |
|---|---|---|
| IP Address | Street address / gate | Device location on a network |
| Port | Office room number | Specific application on a host |
| Packet | Envelope / luggage | Unit of data |
| Router | Traffic junction | Chooses the next hop |
| DNS | Directory desk | Name to IP lookup |
| TCP | Signed courier | Reliable delivery with acknowledgment |
| UDP | Postcard | Fast but no delivery guarantee |
| Firewall | Security checkpoint | Allow or deny traffic |
| Load Balancer | Dispatcher desk | Spread traffic across servers |
| NAT | Shared receptionist | Many private users share one public identity |
| TLS | Sealed armored envelope | Encrypted communication |

---

## Protocols: TCP, UDP, and IP

### TCP — Transmission Control Protocol

TCP ensures reliable, ordered, error-checked delivery. It is connection-oriented, meaning it establishes a connection before data transmission via a three-way handshake.

**Three-way handshake:**
```
Client → SYN         (I want to connect)
Server → SYN-ACK     (OK, and I want to connect back)
Client → ACK         (Confirmed)
```

After the handshake, data flows. TCP guarantees:
- Ordered delivery: packets arrive in the correct sequence
- Retransmission: lost packets are resent
- Error checking: checksums on every segment
- Connection tracking: both sides maintain state

**Where TCP is used:** HTTP/HTTPS, SSH, database connections, file transfers. Use TCP when accuracy matters more than speed.

**SRE observation:** High `SYN_SENT` counts in `ss` output indicate the server is unreachable or its port is blocked. Multiple `CLOSE_WAIT` entries indicate the application is not closing connections cleanly.

### UDP — User Datagram Protocol

UDP sends without connection setup. No handshake, no acknowledgment, no ordering guarantee. What you get: lower overhead and lower latency.

**Where UDP is used:** DNS queries, NTP, SNMP, video streaming, VoIP, online gaming, telemetry pipelines.

**SRE relevance:** DNS uses UDP by default (port 53). Understanding this explains why DNS failures are fast (no TCP retry overhead) but can be invisible (a dropped UDP packet looks like a slow resolver).

### IP — Internet Protocol

IP handles addressing and routing. Every packet has a source IP and a destination IP. Routers use routing tables to forward packets hop by hop toward the destination. IP itself does not know about ports — ports are a TCP/UDP concern at L4.

---

## IP Addressing

### IPv4

A 32-bit address written as four decimal octets: `192.168.1.1`. Each octet ranges 0–255. Approximately 4.3 billion total addresses — effectively exhausted.

### IPv6

A 128-bit address written in eight hexadecimal groups: `2001:0db8:85a3::8a2e:0370:7334`. Vastly larger address space with built-in security features.

### Public vs Private IPs

**Public IPs** are visible on the internet and assigned by ISPs. **Private IPs** are used within local networks and are hidden from the internet using NAT.

Private IP ranges:
```
10.0.0.0/8         — Class A private
172.16.0.0/12      — Class B private
192.168.0.0/16     — Class C private
```

---

## Subnetting and CIDR

Subnetting divides a large IP network into smaller subnetworks (subnets). It improves security, reduces broadcast domains, and optimizes IP allocation.

**CIDR notation:** The `/24` in `192.168.1.0/24` means 24 bits are the network prefix; the remaining 8 bits identify hosts. Formula: `2^(host bits) - 2` usable host addresses (subtract network and broadcast addresses).

| CIDR | Subnet Mask | Usable Hosts |
|------|-------------|--------------|
| /24 | 255.255.255.0 | 254 |
| /25 | 255.255.255.128 | 126 |
| /26 | 255.255.255.192 | 62 |
| /27 | 255.255.255.224 | 30 |
| /28 | 255.255.255.240 | 14 |
| /29 | 255.255.255.248 | 6 |
| /30 | 255.255.255.252 | 2 |

**Example: Divide 192.168.1.0/24 into 4 subnets**

Need 4 subnets → borrow 2 bits (2² = 4) → new mask is /26. Increment = 256 - 192 = 64.

| Subnet | Network Address | Broadcast | Valid Hosts |
|--------|----------------|-----------|-------------|
| 1 | 192.168.1.0 | 192.168.1.63 | .1 – .62 |
| 2 | 192.168.1.64 | 192.168.1.127 | .65 – .126 |
| 3 | 192.168.1.128 | 192.168.1.191 | .129 – .190 |
| 4 | 192.168.1.192 | 192.168.1.255 | .193 – .254 |

**How many /24 subnets fit in 10.0.0.0/8?**
Total host bits = 32 - 8 = 24. Subnet bits needed = 24 - 8 = 16. Answer: 2^16 = 65,536 subnets.

---

## Ports

Ports are transport-layer (L4) communication endpoints — 16-bit unsigned integers (0–65,535). A port identifies which application on a host should receive a packet. IP is unaware of ports; only TCP and UDP headers contain them.

**Commonly used ports in DevOps/SRE:**

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 53 | UDP/TCP | DNS |
| 80 | TCP | HTTP |
| 123 | UDP | NTP |
| 443 | TCP | HTTPS |
| 2379-2380 | TCP | etcd |
| 3306 | TCP | MySQL |
| 5432 | TCP | PostgreSQL |
| 6379 | TCP | Redis |
| 6443 | TCP | Kubernetes API Server |
| 9090 | TCP | Prometheus |
| 10250 | TCP | Kubelet API |

---

## DNS — Domain Name System

DNS translates human-readable names like `api.example.com` into IP addresses machines use to route traffic. DNS runs on UDP port 53 (TCP for large responses and zone transfers).

### DNS Resolution Chain

```
Browser / Application
  ↓
OS cache (check first)
  ↓
Stub resolver (reads /etc/resolv.conf)
  ↓
Recursive resolver (ISP, 8.8.8.8, 1.1.1.1)
  ↓
Root nameserver (.) — knows TLD servers
  ↓
TLD nameserver (.com) — knows authoritative servers for domains
  ↓
Authoritative nameserver for example.com
  ↓
Returns A/AAAA record → IP address
```

**SRE insight:** DNS success alone does not prove website health. DNS only proves name resolution. TCP, TLS, routing, and application health can all still fail independently.

### DNS Record Types

| Record | Purpose | Example |
|--------|---------|---------|
| A | Maps hostname to IPv4 | `api.example.com → 1.2.3.4` |
| AAAA | Maps hostname to IPv6 | `api.example.com → 2001:db8::1` |
| CNAME | Alias to another hostname | `www → api.example.com` |
| MX | Mail exchange server | `mail.example.com priority 10` |
| TXT | Arbitrary text (SPF, DKIM) | `v=spf1 include:...` |
| NS | Authoritative nameserver for zone | `ns1.example.com` |
| PTR | Reverse DNS — IP to hostname | Used in email anti-spam, SSH reverse lookup |
| SRV | Service discovery with port and weight | `_http._tcp.example.com` |

**CNAME at apex domain risk:** CNAME at the zone apex (`@`) is prohibited by RFC. Use ALIAS or ANAME records instead. Long CNAME chains add DNS resolution latency with each lookup.

### DNS TTL and Caching

TTL (Time to Live) is the number of seconds a DNS record can be cached. Lower TTL means faster propagation of changes but more resolver load. During incident response, low TTL allows faster failover. During normal operations, higher TTL reduces resolver queries.

**SRE scenario:** You update a DNS record but users still see the old IP. Check `dig` TTL output — the cached answer may be valid for another 300 seconds.

### Common DNS Commands

```bash
# Basic lookup
dig api.example.com

# Full resolution chain from root
dig api.example.com +trace

# Specific record type
dig api.example.com MX
dig api.example.com TXT

# Query specific nameserver
dig @8.8.8.8 api.example.com

# Reverse DNS (PTR lookup)
dig -x 1.2.3.4

# nslookup equivalent
nslookup api.example.com
nslookup api.example.com 8.8.8.8
```

---

## HTTP and HTTPS Basics

HTTP (HyperText Transfer Protocol) is the application-layer protocol for web communication. HTTPS is HTTP transported inside TLS — adding confidentiality, integrity, and authentication.

```
HTTP:   TCP connection → HTTP request → HTTP response
HTTPS:  TCP connection → TLS handshake → HTTP request → HTTP response
```

### The Packet Journey for a Web Request

```
Browser
  ↓ DNS lookup (A record → IP)
  ↓ TCP connect (3-way handshake)
  ↓ TLS handshake (ClientHello → ServerHello → cert → key exchange)
  ↓ HTTP GET /path HTTP/1.1
  ↓ Load balancer / reverse proxy
  ↓ Backend application
  ↑ HTTP response
  ↑ Travels same path back
```

Every step is a potential failure point. When debugging HTTP latency, isolate which phase is slow using `curl -w` timing variables (see the hands-on labs section).

### HTTP Response Status Codes

| Range | Meaning | Key codes |
|-------|---------|-----------|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Permanent, 302 Temporary, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Error, 502 Bad Gateway, 503 Unavailable, 504 Gateway Timeout |

**Critical distinctions:**
- **502** — proxy got an invalid response from upstream (upstream crashed or returning garbage)
- **503** — no healthy upstream available (all backends down or overloaded)
- **504** — proxy waited for upstream to respond and timed out (upstream alive but slow)

---

## NAT — Network Address Translation

NAT allows multiple private hosts to share a single public IP. A NAT gateway (on a router or cloud service) rewrites packet source IPs before forwarding to the internet and tracks the mapping to route return traffic back.

```
10.0.0.5 → NAT Gateway → 34.x.x.x (public IP)
10.0.0.6 → NAT Gateway → 34.x.x.x (same public IP, different port mapping)
```

**DevOps relevance:**
- Cloud VPCs use NAT Gateways for private subnet egress
- A static NAT IP is required to allowlist your services at third-party APIs
- NAT table exhaustion causes new connections to fail while existing sessions work

---

## First Commands to Run When Investigating a Network Issue

```bash
# Step 1: DNS — does the name resolve?
dig api.example.com

# Step 2: Reachability — can we ping the IP?
ping 1.2.3.4
traceroute api.example.com

# Step 3: Port open? — is the service listening?
nc -vz api.example.com 443
telnet api.example.com 443

# Step 4: Protocol — is HTTP working?
curl -v https://api.example.com

# Step 5: Local state — what connections exist?
ss -tlnp          # listening ports
ss -tanp          # all TCP connections with process info
ip route          # routing table
```

**SRE mental model:** Work from the lowest uncertain layer upward using evidence, not assumptions.

| Symptom | Likely layer | First command |
|---------|-------------|---------------|
| "Could not resolve host" | DNS (L7) | `dig hostname` |
| Connection timed out | Routing or firewall (L3/L4) | `traceroute`, `nc -vz` |
| Connection refused | Service not listening (L4/L7) | `ss -tlnp`, `curl -v` |
| TLS error | TLS (L6/L7) | `openssl s_client -connect host:443` |
| HTTP 5xx | Application (L7) | Application logs, `kubectl logs` |
