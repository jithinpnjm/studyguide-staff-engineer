---
title: "Cheat Sheet"
sidebar_position: 6
---

# Networking — Cheat Sheet

Quick reference tables and commands for daily SRE networking work. All commands assume Linux unless noted.

---

## curl — HTTP Debugging

### Common Flags

| Flag | What it does |
|------|-------------|
| `-v` | Verbose: show request/response headers and TLS details |
| `-s` | Silent: suppress progress meter (use with `-v` or `-w`) |
| `-k` | Insecure: skip TLS certificate verification |
| `-H "Header: value"` | Add a request header |
| `-X POST` | Override HTTP method |
| `-d '{"key":"val"}'` | Request body (implies POST) |
| `-o /dev/null` | Discard response body |
| `-L` | Follow redirects |
| `-I` | HEAD request only (response headers, no body) |
| `--connect-timeout 5` | Fail TCP connect after 5 seconds |
| `--max-time 30` | Fail entire request after 30 seconds |
| `--resolve host:port:ip` | Override DNS for this request |
| `-x http://proxy:8080` | Route through an HTTP proxy |
| `--cacert /path/to/ca.pem` | Trust a specific CA certificate |
| `--cert /path/to/client.pem` | Client certificate for mTLS |

### Request Timing — `-w` Variables

```bash
curl -w "\ndns=%{time_namelookup}s\nconnect=%{time_connect}s\ntls=%{time_appconnect}s\nttfb=%{time_starttransfer}s\ntotal=%{time_total}s\n" \
     -o /dev/null -s https://api.example.com/health
```

| Variable | What it measures |
|----------|-----------------|
| `time_namelookup` | DNS resolution only |
| `time_connect` | DNS + TCP 3-way handshake |
| `time_appconnect` | DNS + TCP + TLS handshake |
| `time_pretransfer` | Everything until first byte sent |
| `time_starttransfer` | Everything until first byte received (TTFB) |
| `time_total` | Full request including body |
| `http_code` | Final HTTP status code |
| `size_download` | Response body size in bytes |

**Derived diagnostics:**
```
TCP time  = time_connect    - time_namelookup
TLS time  = time_appconnect - time_connect
Server    = time_starttransfer - time_appconnect
Transfer  = time_total - time_starttransfer
```

### Override DNS for Testing

```bash
# Force api.example.com:443 to resolve to 1.2.3.4 (test a new IP before DNS propagation)
curl -v --resolve api.example.com:443:1.2.3.4 https://api.example.com/health

# Use a specific proxy
curl -x http://squid.internal:3128 https://api.example.com/health

# Test with a custom CA bundle
curl --cacert /etc/ssl/my-corp-ca.pem https://internal.example.com/api
```

---

## dig / nslookup — DNS Lookups

### dig Record Types

```bash
dig api.example.com              # A record (IPv4)
dig api.example.com AAAA         # IPv6 address
dig api.example.com CNAME        # Canonical name (alias)
dig example.com MX               # Mail exchange servers
dig example.com TXT              # Text records (SPF, DKIM, domain verification)
dig example.com NS               # Authoritative name servers
dig example.com SOA              # Start of authority (zone serial, TTL defaults)
dig -x 1.2.3.4                   # Reverse DNS (PTR lookup)
```

### dig Options

```bash
dig api.example.com +short       # IP only, no decorators
dig api.example.com +trace       # Walk delegation from root to authoritative
dig @8.8.8.8 api.example.com     # Query a specific resolver (Google DNS)
dig @1.1.1.1 api.example.com     # Query Cloudflare resolver
dig api.example.com +nocmd +noall +answer   # Clean output: answer section only
dig api.example.com +tcp         # Force TCP instead of UDP (test for UDP filtering)
dig api.example.com +dnssec      # Show DNSSEC records
```

### nslookup Quick Reference

```bash
nslookup api.example.com          # Default resolver lookup
nslookup api.example.com 8.8.8.8  # Use a specific resolver
nslookup -type=MX example.com     # Query specific record type
nslookup -type=TXT example.com    # TXT records
```

### Reading dig Output

```
api.example.com.    300   IN    A     10.1.2.3
                    ↑TTL  ↑class ↑type ↑value

;; Query time: 12 msec         ← resolver response time
;; SERVER: 10.0.0.53#53        ← which resolver answered
;; WHEN: Sat May 17 11:00:00   ← timestamp
```

---

## netstat / ss — Connection and Socket Inspection

### ss (preferred, faster than netstat)

```bash
ss -lntp        # Listening TCP ports with process names
ss -lnup        # Listening UDP ports
ss -tanp        # All TCP sockets with process names
ss -s           # Summary: total sockets by state
ss -tnp         # TCP sockets with process, excluding listening
ss -tnp state established   # Only ESTABLISHED connections
ss -tnp state time-wait     # Only TIME_WAIT connections
ss -tnp dst :8080           # Connections to port 8080

# Filter by destination
ss -tnp dst 10.0.0.1:5432   # Connections to a specific host:port

# Count connections by state
ss -tn | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
```

### netstat (legacy — still widely available)

```bash
netstat -tlnp      # Listening TCP with PID
netstat -s         # Per-protocol statistics (retransmits, resets, errors)
netstat -an | grep :80 | wc -l   # Count connections to port 80
netstat -rn        # Routing table
```

---

## tcpdump — Packet Capture

### Basic Captures

```bash
tcpdump -i eth0                   # Capture on eth0
tcpdump -i any                    # Capture on all interfaces
tcpdump -n                        # No DNS resolution (show IPs)
tcpdump -nn                       # No DNS, no port name resolution
tcpdump -v                        # Verbose (more packet detail)
tcpdump -c 100                    # Stop after 100 packets
```

### Write and Read pcap Files

```bash
# Capture to file for offline analysis
tcpdump -i any -w /tmp/capture.pcap

# Capture with rotation (10MB files, keep 5)
tcpdump -i any -w /tmp/cap.pcap -C 10 -W 5

# Read a pcap file
tcpdump -r /tmp/capture.pcap

# Read with Wireshark (GUI)
wireshark /tmp/capture.pcap
```

### Common Filters

```bash
tcpdump -ni any port 443                        # All traffic on port 443
tcpdump -ni any host 10.1.2.3                   # Traffic to/from IP
tcpdump -ni any host 10.1.2.3 and port 8080    # Host AND port
tcpdump -ni any 'tcp[tcpflags] & tcp-syn != 0' # SYN packets only (new connections)
tcpdump -ni any 'tcp[tcpflags] & tcp-rst != 0' # RST packets (abrupt close)
tcpdump -ni any net 10.0.0.0/8                 # Traffic within CIDR
tcpdump -ni any not port 22                    # Exclude SSH
tcpdump -ni any src 10.1.2.3                   # From specific source
tcpdump -ni any dst port 53                    # DNS queries
```

### Reading TCP Flags in Output

```
IP 10.1.0.5.49201 > 10.2.0.10.8080: Flags [S],  seq 123456, win 64240
IP 10.2.0.10.8080 > 10.1.0.5.49201: Flags [S.], seq 654321, ack 123457
IP 10.1.0.5.49201 > 10.2.0.10.8080: Flags [.],  ack 654322
```

| Flag | Meaning |
|------|---------|
| `[S]` | SYN — initiating connection |
| `[S.]` | SYN-ACK — server accepting |
| `[.]` | ACK — acknowledgement only |
| `[P.]` | PSH+ACK — data payload |
| `[F.]` | FIN+ACK — graceful close initiated |
| `[R]` | RST — connection reset (abrupt close) |
| `[R.]` | RST+ACK |

**DROP fingerprint:** SYN sent, then same SYN retransmitted at 1s, 3s, 7s — no SYN-ACK ever. Means packet is being dropped by a firewall rule.

**REJECT fingerprint:** SYN sent, RST received immediately. Means the destination is reachable but refused the connection (no listener or explicit REJECT rule).

---

## ip / route — Routing and Interfaces

```bash
# Interfaces and addresses
ip addr show                      # All interfaces and IPs
ip addr show eth0                 # Specific interface
ip link show                      # Interface state (UP/DOWN, MTU)
ip link set eth0 up               # Bring interface up
ip link set eth0 mtu 9000         # Set MTU (jumbo frames)

# Routing table
ip route show                     # Full routing table
ip route get 10.1.2.3             # Which route applies to a specific destination
ip route add 10.2.0.0/16 via 10.0.0.1 dev eth0    # Add a route
ip route del 10.2.0.0/16          # Remove a route

# ARP / neighbor table
ip neigh show                     # ARP cache
ip neigh flush dev eth0           # Clear ARP cache on interface

# Network namespaces (used by containers and pods)
ip netns list                     # List network namespaces
ip netns exec <ns> ip addr        # Run ip addr inside a namespace
```

---

## iptables — Firewall Rules

### Listing Rules

```bash
iptables -L -n -v --line-numbers          # filter table (default)
iptables -t nat -L -n -v --line-numbers   # NAT table
iptables -t mangle -L -n -v              # mangle table
iptables-save                            # Dump all rules (importable format)
```

### Adding Rules

```bash
# Allow inbound TCP on port 8080
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Drop traffic from a specific IP
iptables -A INPUT -s 1.2.3.4 -j DROP

# Allow established/related connections (stateful — required for normal operation)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Log and drop (for debugging — writes to syslog)
iptables -A INPUT -p tcp --dport 8080 -j LOG --log-prefix "DROPPED: "
iptables -A INPUT -p tcp --dport 8080 -j DROP
```

### NAT Rules

```bash
# SNAT (masquerade — outbound NAT, dynamic source IP)
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# DNAT (port forward — inbound)
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 10.0.0.5:8080

# Delete a specific rule by line number
iptables -D INPUT 3
```

### kube-proxy iptables Inspection

```bash
# Find Service DNAT rules
iptables-save | grep KUBE-SERVICES | grep <service-name>

# Trace all rules for a service
iptables -t nat -L KUBE-SERVICES -n -v | grep <ClusterIP>

# Count total rules (performance indicator — >10k rules means consider IPVS or eBPF)
iptables-save | wc -l
```

---

## kubectl — Networking Commands

```bash
# Port forward a pod or service to localhost
kubectl port-forward pod/my-pod 8080:8080
kubectl port-forward svc/my-service 8080:80

# Execute curl inside a pod to test connectivity
kubectl exec -it my-pod -- curl -v http://other-service:8080/health

# Run a debug pod with network tools
kubectl run debug --image=nicolaka/netshoot --rm -it --restart=Never -- bash

# Describe a Service (check ClusterIP, selector, ports)
kubectl describe svc my-service

# Check endpoints (which pods are currently in the load-balancing pool)
kubectl get endpoints my-service
kubectl describe endpoints my-service

# Check NetworkPolicy affecting a namespace
kubectl get networkpolicy -n production -o yaml
kubectl describe networkpolicy <policy-name> -n production

# Check if a namespace has the right labels for NetworkPolicy selectors
kubectl get namespace production --show-labels

# Get pod IP and node
kubectl get pod my-pod -o wide

# Trace DNS inside a pod
kubectl exec -it my-pod -- cat /etc/resolv.conf
kubectl exec -it my-pod -- nslookup kubernetes.default
kubectl exec -it my-pod -- dig my-service.production.svc.cluster.local
```

---

## Envoy / Istio — Service Mesh Commands

```bash
# Check all proxies are in sync with the control plane
istioctl proxy-status

# Analyze cluster for misconfigurations and warnings
istioctl analyze
istioctl analyze --all-namespaces

# Inspect Envoy config for a specific pod
istioctl proxy-config listener <pod>.<namespace>     # Listeners (ports Envoy accepts)
istioctl proxy-config route <pod>.<namespace>        # Route rules
istioctl proxy-config cluster <pod>.<namespace>      # Upstream clusters
istioctl proxy-config endpoint <pod>.<namespace>     # Pod endpoints per cluster
istioctl proxy-config secret <pod>.<namespace>       # TLS certificates (SDS)

# Check if mTLS is enforced
istioctl authn tls-check <pod>.<namespace>

# Check policy and route for a specific destination
istioctl proxy-config route <pod>.<namespace> --name my-service

# Kiali dashboard (if deployed)
istioctl dashboard kiali

# Envoy admin API (from inside the pod or port-forward)
kubectl port-forward pod/my-pod 15000:15000
curl http://localhost:15000/stats          # All Envoy metrics
curl http://localhost:15000/clusters       # Cluster health status
curl http://localhost:15000/config_dump   # Full running config (large output)
```

---

## OpenSSL — TLS Certificate Inspection

```bash
# Connect and inspect TLS handshake
openssl s_client -connect api.example.com:443 -servername api.example.com

# Show only the certificate
echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -text

# Show certificate dates
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -dates

# Show SANs (Subject Alternative Names)
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName

# Check certificate file directly
openssl x509 -in /etc/ssl/cert.pem -noout -text
openssl x509 -in /etc/ssl/cert.pem -noout -dates
openssl x509 -in /etc/ssl/cert.pem -noout -subject -issuer

# Test a specific TLS version
openssl s_client -connect api.example.com:443 -tls1_3
openssl s_client -connect api.example.com:443 -tls1_2

# Verify the certificate chain
openssl verify -CAfile /etc/ssl/ca-bundle.crt /etc/ssl/server.pem

# Generate a quick self-signed cert (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/key.pem -out /tmp/cert.pem \
  -subj "/CN=localhost"

# Days until cert expires (usable in monitoring scripts)
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -enddate \
  | cut -d= -f2 \
  | xargs -I{} date -d {} +%s \
  | xargs -I{} expr \( {} - $(date +%s) \) / 86400
```

---

## HTTP Status Codes — Reference

| Code | Name | When you see it |
|------|------|----------------|
| 200 | OK | Request succeeded |
| 201 | Created | POST succeeded, resource created |
| 204 | No Content | Success, no response body (DELETE) |
| 301 | Moved Permanently | URL permanently changed |
| 302 | Found | Temporary redirect |
| 304 | Not Modified | Cached response is still valid |
| 400 | Bad Request | Malformed request (invalid JSON, missing required field) |
| 401 | Unauthorized | Missing or invalid authentication credentials |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 408 | Request Timeout | Client took too long to send request |
| 409 | Conflict | Resource state conflict (duplicate create, optimistic lock) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception in application |
| 502 | Bad Gateway | Proxy received invalid response from upstream |
| 503 | Service Unavailable | No healthy upstream; overload shedding |
| 504 | Gateway Timeout | Proxy timed out waiting for upstream response |

**502 vs 503 vs 504 at a glance:**
- **502** — upstream responded with garbage or crashed mid-response
- **503** — no upstream available (all backends failed health checks, or upstream returned 503)
- **504** — upstream is alive but slow; timed out

---

## DNS Record Types — Reference

| Type | Purpose | Example value |
|------|---------|--------------|
| A | IPv4 address | `1.2.3.4` |
| AAAA | IPv6 address | `2001:db8::1` |
| CNAME | Alias to another name | `myapp.example.com → lb.cloud.com` |
| MX | Mail exchange (with priority) | `10 mail.example.com` |
| TXT | Arbitrary text (SPF, DKIM, verification) | `"v=spf1 include:..."` |
| NS | Authoritative name servers for zone | `ns1.example.com` |
| SOA | Zone authority info (serial, TTL defaults) | Start of Authority |
| PTR | Reverse DNS (IP → name) | `10.1.0.5 → host.example.com` |
| SRV | Service location (host + port) | `_grpc._tcp 10 0 9090 backend.svc` |
| CAA | Allowed certificate authorities | `0 issue "letsencrypt.org"` |

**TTL gotcha:** A cached DNS record survives until TTL expires. During incidents, set TTL to 60 seconds before planned changes. After rollback, restore to a higher TTL (300–3600 seconds).

---

## TCP Connection States — Reference

| State | Meaning | Common in |
|-------|---------|----------|
| LISTEN | Socket waiting for incoming connections | Server — normal |
| SYN_SENT | Client sent SYN, waiting for SYN-ACK | Client connecting |
| SYN_RECV | Server received SYN, sent SYN-ACK | Server — transient |
| ESTABLISHED | Connection active, data flows | Normal traffic |
| FIN_WAIT_1 | Local side sent FIN (closing) | Normal close |
| FIN_WAIT_2 | Local side got ACK for FIN, waiting for remote FIN | Normal close |
| TIME_WAIT | Both FINs exchanged; waiting 2×MSL before reuse | After close — normal |
| CLOSE_WAIT | Remote sent FIN; local app hasn't closed yet | App not reading — bug |
| LAST_ACK | Local sent FIN after CLOSE_WAIT, waiting for final ACK | Normal close |
| CLOSED | Connection fully terminated | — |

**High TIME_WAIT count:** Normal for high-throughput HTTP servers. Each closed short-lived connection enters TIME_WAIT for 60 seconds. Tune with `net.ipv4.tcp_tw_reuse=1` to allow reuse for outgoing connections.

**High CLOSE_WAIT count:** Application is not calling `close()` on the socket after the client disconnected. Indicates a bug in the application — common in connection pool implementations that don't handle connection draining.

---

## Kernel Network Parameters — Quick Reference

```bash
# View current value
sysctl net.ipv4.tcp_tw_reuse
sysctl net.core.somaxconn

# Set temporarily (resets on reboot)
sysctl -w net.ipv4.tcp_tw_reuse=1

# Set permanently
echo 'net.ipv4.tcp_tw_reuse=1' >> /etc/sysctl.conf
sysctl -p
```

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `net.ipv4.tcp_tw_reuse` | 0 | Allow reuse of TIME_WAIT sockets for new connections |
| `net.ipv4.ip_local_port_range` | 32768–60999 | Ephemeral port range for outgoing connections |
| `net.core.somaxconn` | 128 | Max listen backlog (increase for high-traffic servers) |
| `net.ipv4.tcp_fin_timeout` | 60 | Time to wait in FIN_WAIT_2 before forcing CLOSE |
| `net.ipv4.tcp_keepalive_time` | 7200 | Idle time before TCP keepalive probes start |
| `net.ipv4.tcp_max_syn_backlog` | 128 | Max half-open connections (SYN flood protection) |
| `net.netfilter.nf_conntrack_max` | 65536 | Max tracked connections (increase under load) |
