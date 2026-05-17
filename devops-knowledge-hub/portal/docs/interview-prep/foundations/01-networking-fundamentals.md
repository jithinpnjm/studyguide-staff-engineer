---
title: "Foundations: Networking Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 1
---

# Foundations: Networking Premium Teaching Guide For SRE And Platform Engineers

Networking is how systems talk.

Every web request, database query, SSH login, Kubernetes service call, API integration, CDN fetch, and cloud control-plane action depends on networking.

When networking feels unclear, production incidents feel random. When networking is understood, outages become traceable systems.

This guide teaches networking from zero to advanced level for SRE, DevOps, Platform, and Cloud Engineers.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — understand packets, IPs, ports, DNS, TCP.
2. **Intermediate Layer** — routing, NAT, firewalls, TLS, HTTP flow.
3. **Advanced Layer** — MTU, conntrack, retries, load balancers, latency.
4. **Production SRE Layer** — debug real incidents quickly.
5. **Interview Layer** — explain packet paths clearly like a senior engineer.

---

# Memory Palace: Networking Is An Airport + Highway System

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

# Beginner Layer: What A Network Actually Is

A network is devices exchanging data through agreed rules (protocols).

Examples:

- Your laptop → website
- Pod → database
- CI runner → GitHub
- API service → payment provider

All of these send data in small chunks called **packets**.

---

# Beginner Layer: IP Address Explained

An IP address identifies a host on a network.

Examples:

```text
192.168.1.10
10.0.4.23
172.31.18.90
8.8.8.8
```

## Private IP Ranges

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

Used internally.

## Public IP

Reachable on the internet.

---

# Beginner Layer: Ports Explained

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

# Beginner Layer: DNS Explained

Humans prefer names like `api.company.com`. Machines need IPs.

DNS converts names to IPs.

```bash
dig api.company.com
nslookup api.company.com
```

---

# Beginner Layer: Packet Journey

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

# Intermediate Layer: TCP Handshake

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

# Intermediate Layer: UDP

UDP sends without connection setup.

Use for:

- DNS (often)
- streaming
- telemetry

Fast, but no guarantee.

---

# Intermediate Layer: Routing

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

# Intermediate Layer: NAT

Many private hosts share one public IP.

```text
10.0.0.5 -> NAT Gateway -> 34.x.x.x
10.0.0.6 -> NAT Gateway -> 34.x.x.x
```

Useful for conserving public IPs.

---

# Intermediate Layer: Firewalls

Firewalls allow or block traffic.

Examples:

- Security Groups
- NACLs
- iptables
- nftables

Timeout often means drop. Refused often means host reached but no listener.

---

# Intermediate Layer: HTTP vs HTTPS

HTTP = plain text.

HTTPS = HTTP inside TLS.

```text
TCP -> TLS -> HTTP
```

Provides confidentiality, integrity, identity.

---

# Intermediate Layer: Useful Commands

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

# Advanced Layer: Latency Thinking

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

# Advanced Layer: MTU

Maximum packet size. Often 1500.

Mismatch can cause:

- large uploads fail
- VPN weirdness
- intermittent slowness

---

# Advanced Layer: Retransmissions

If packets are lost, TCP retries. This increases latency.

Causes:

- congestion
- bad link
- overloaded host
- policy issues

---

# Advanced Layer: Conntrack

Linux tracks active connections.

If table fills:

- new connections fail
- old ones continue

Very common under spikes.

---

# Advanced Layer: Load Balancers

## L4

TCP/UDP.

## L7

Understands HTTP paths, headers, TLS.

Examples:

- ALB
- NGINX
- Envoy

---

# Production SRE Layer: Troubleshooting Flow

## Step 1 DNS

```bash
dig host
```

## Step 2 Reachability

```bash
ping IP
traceroute IP
```

## Step 3 Port Open?

```bash
nc -vz host 443
```

## Step 4 Protocol

```bash
curl -v https://host
openssl s_client -connect host:443
```

## Step 5 Local State

```bash
ss -tanp
ip route
```

---

# Real Incident Stories

## Website Down

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

## SSH Timeout

```bash
nc -vz host 22
```

Possible causes:

- route
n- firewall
- sshd dead

## Old Connections Work, New Fail

Likely:

- conntrack exhaustion
- SYN backlog full
- ephemeral ports exhausted

---

# Kubernetes Networking Layer

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

# Interview Layer: Strong Answers

## How does request reach a website?

> DNS resolves the hostname. Client opens TCP, negotiates TLS, sends HTTP request, traffic may pass through LB/CDN, backend responds.

## Timeout vs Refused?

> Timeout usually means drop/unreachable. Refused means host reachable but no listener.

## Why DNS success not enough?

> DNS only proves name resolution. TCP, TLS, routing, and app health can still fail.

---

# Labs

## Beginner

- run `dig google.com`
- run `curl -v https://google.com`
- inspect `ip route`

## Intermediate

- run local web server
- inspect with `ss -lntp`

## Advanced

- packet capture with tcpdump
- simulate firewall block
- inspect conntrack usage

---

# Recall Prompts

- What is IP vs port?
- Why use NAT?
- Why can old connections work while new fail?
- Why does DNS success not prove website health?

---

# Senior Summary

> Networking problems become easier when broken into layers: DNS, routing, transport, TLS, and application behavior. I debug from the lowest uncertain layer upward using evidence, not assumptions.
