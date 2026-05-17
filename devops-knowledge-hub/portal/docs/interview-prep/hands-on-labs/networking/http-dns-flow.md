---
title: "Networking Lab 1: HTTP, HTTPS, DNS, And Request Flow"
sidebar_position: 1
---

# Networking Lab 1: HTTP, HTTPS, DNS, And Request Flow

## Production Context

A user reports that `https://api.prod.example.com/v1/predict` started feeling slow at
around 11:05 UTC. The API server team says their latency metrics are normal. SLO
dashboards show p99 latency jumped from 120ms to 4.2s. Your job is to find which phase
of the request is slow, separate the client-observable delay from the server-observable
delay, and produce a diagnosis the on-call engineer can act on.

---

## Prerequisites

- A Linux or macOS workstation with network access
- Tools: `curl`, `dig`, `openssl`, `traceroute` (or `tracepath`), `ss`
- For packet capture: `tcpdump` with sufficient permissions

---

## Environment Setup

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

## Beginner Section: Guided Walkthrough

### Step 1 — Break the request into phases with curl timing

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

### Step 2 — Simulate a slow DNS scenario

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

### Step 3 — Simulate high TCP connect time (routing issue)

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

### Step 4 — Inspect the TLS handshake in detail

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

### Step 5 — Trace the network path

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

### Step 6 — Use dig to inspect DNS chain

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

## Intermediate Section: Diagnose Without Full Hints

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

## Advanced / Stretch

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

## Sample Diagnosis Note

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

## Common Mistakes

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

## What To Study Next

- HTTP/2 and HTTP/3 (QUIC) handshake differences and latency implications
- TLS 1.3 0-RTT: how it works and the replay attack trade-off
- DNS resolution chain: stub resolver, recursive resolver, authoritative
- OCSP stapling and why it matters for TLS performance
- MTU path discovery and how fragmentation adds latency in cloud environments
