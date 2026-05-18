---
title: "Hands-On Labs"
sidebar_position: 5
---

# Networking — Hands-On Labs

Three networking labs and two cloud-networking drills with full commands, expected outputs, and diagnosis frameworks. These labs are designed to build the skills needed to debug production incidents under pressure.

---

## Lab 1: HTTP, HTTPS, DNS, and Request Flow

**Production context:** A user reports that `https://api.prod.example.com/v1/predict` started feeling slow at around 11:05 UTC. The API server team says their latency metrics are normal. SLO dashboards show p99 latency jumped from 120ms to 4.2s. Your job is to find which phase of the request is slow.

**Prerequisites:** `curl`, `dig`, `openssl`, `traceroute`, network access.

---

### Step 1 — Break the Request Into Phases With curl Timing

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

| Field | What it measures |
|-------|-----------------|
| `time_namelookup` | DNS resolution only |
| `time_connect` | DNS + TCP 3-way handshake |
| `time_appconnect` | DNS + TCP + TLS handshake |
| `time_starttransfer` | Everything until first response byte (TTFB) |
| `time_total` | Full request-response including body transfer |

**Derived values that matter:**
```
TCP connect time  = time_connect    - time_namelookup   = 0.028 - 0.011 = 0.017s
TLS overhead      = time_appconnect - time_connect      = 0.065 - 0.028 = 0.037s
Server think time = time_starttransfer - time_appconnect = 0.088 - 0.065 = 0.023s
```

If `time_namelookup` accounts for the entire delay → DNS problem.  
If `time_connect - time_namelookup` is high → TCP/routing problem.  
If `time_appconnect - time_connect` is high → TLS problem.  
If `time_starttransfer - time_appconnect` is high → server processing problem.

---

### Step 2 — Simulate a Slow DNS Scenario

```bash
# Query a non-responsive DNS server (timeout scenario)
time dig @192.0.2.1 www.google.com 2>&1
```

Expected output (after resolver gives up):
```
; <<>> DiG 9.18.12 <<>> @192.0.2.1 www.google.com
;; connection timed out; no servers could be reached

real    0m5.003s
```

When DNS fails, `time_namelookup` equals `time_total`. All downstream phases never run. This is the fingerprint of a DNS outage.

---

### Step 3 — Simulate High TCP Connect Time (Routing Issue)

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

`time_namelookup` is near zero (IP literal, no DNS). `time_connect` consumed the entire 5-second timeout. TCP SYN was sent but no SYN-ACK returned. Pattern: routing problem or firewall DROP.

---

### Step 4 — Inspect the TLS Handshake in Detail

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com \
  -tls1_3 2>&1 | grep -E "Protocol|Cipher|Verify|depth"
```

Expected output:
```
depth=2 C=US, O=Google Trust Services LLC, CN=GTS Root R1
verify return:1
depth=1 C=US, O=Google Trust Services LLC, CN=GTS CA 1C3
verify return:1
depth=0 CN=api.example.com
verify return:1
---
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
```

What to check:
- Certificate chain depth (3 is normal for CA-signed cert; 4+ may indicate extra cross-cert adding latency)
- `verify return` — anything other than `1` means the certificate chain is broken
- Protocol version — TLS 1.2 adds one round trip vs TLS 1.3

---

### Step 5 — Trace the Network Path

```bash
traceroute -n api.example.com

# Use TCP trace (more representative for HTTPS — some firewalls block ICMP)
traceroute -T -p 443 api.example.com
```

Expected output:
```
traceroute to api.example.com (142.250.80.36), 30 hops max
 1  192.168.1.1    1.2 ms   1.1 ms   1.0 ms
 2  10.0.0.1       5.3 ms   5.1 ms   5.2 ms
 3  203.0.113.1    8.4 ms   8.6 ms   8.3 ms
 4  142.250.80.36  11.2 ms  11.0 ms  11.1 ms
```

Stable RTT increase hop-by-hop is normal. A sudden large RTT jump between two hops suggests congestion. Stars (`* * *`) mean that router does not respond to ICMP TTL-exceeded — this is NOT necessarily packet loss for TCP traffic.

---

### Step 6 — Use dig to Inspect the DNS Chain

```bash
dig api.example.com +trace
```

`+trace` forces dig to walk the full delegation chain from root to authoritative. Use this when you suspect a cached wrong answer, misconfigured delegation, or authority returning wrong TTL.

---

### Step 7 — Certificate Expiry Pre-Mortem

```bash
echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null \
  | openssl x509 -noout -dates

# Shell one-liner: alert if cert expires within 30 days
EXPIRY=$(echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -enddate | cut -d= -f2)
DAYS=$((( $(date -d "$EXPIRY" +%s) - $(date +%s) ) / 86400))
echo "Certificate expires in $DAYS days"
[ "$DAYS" -lt 30 ] && echo "WARNING: renew soon"
```

---

### Sample Diagnosis Note — Lab 1

```
Incident: api.prod.example.com p99 latency 4.2s (baseline 120ms) from 11:05 UTC

Investigation:
  curl -w timing from ops workstation:
    dns=0.009s  connect=0.029s  tls=3.841s  ttfb=3.851s  total=3.853s

  tls phase = 3.841s. DNS and TCP connect both normal.

  openssl s_client -connect api.prod.example.com:443:
    Chain: 4 certificates (expected 3). Extra intermediate cert in chain.
    4.1 KB cert payload vs normal 2.8 KB.

Root cause: Certificate rotation at 11:03 UTC included an extra cross-cert from
the old CA chain. Clients downloading the oversized chain on each new TLS session
added ~3.7s to handshake time.

Fix: Re-issued certificate without extra intermediate. Deployed at 11:38 UTC.
p99 returned to 115ms within 2 minutes as connection pools re-established.
```

---

### Lab 1 Common Mistakes

- **Treating total latency as server latency.** `time_starttransfer - time_appconnect` is the only field that isolates server processing time.
- **Ignoring DNS TTL.** A cached DNS response can mask a DNS change for minutes.
- **Forgetting that `traceroute` uses ICMP by default.** Use `-T -p 443` for HTTPS representative results.
- **Treating `* * *` as packet loss.** The path beyond may be fine.

---

## Lab 2: SSH Latency Drill

**Production context:** SSH to `bastion.prod.example.com` takes 18–22 seconds before the shell prompt appears. TCP is reachable — `ping` returns immediately. Your job is to place the delay in the exact SSH phase.

**Prerequisites:** SSH client, `dig`, `ss`, `tcpdump`.

---

### Step 1 — Time the Full SSH Connection

```bash
time ssh -o ConnectTimeout=10 user@bastion.prod.example.com true
```

The `true` command means SSH connects, authenticates, runs `true` (exits immediately), and disconnects. This measures total connection time with no shell startup bias. If this is slow, the delay is before the shell. If this is fast but interactive shell is slow, the delay is in shell startup (`.bashrc`, NFS home dir mounts).

---

### Step 2 — Use ssh -vvv to Locate the Phase

```bash
ssh -vvv -o ConnectTimeout=10 user@bastion.prod.example.com true 2>&1 | head -80
```

Read the debug output to find where the time is spent:
```
debug1: Connection established.                      # TCP connect: immediate
...
debug1: SSH2_MSG_SERVICE_REQUEST sent
debug3: receive packet: type 6                       # GAP STARTS HERE (~18 seconds)
debug1: SSH2_MSG_SERVICE_ACCEPT received             # GAP ENDS HERE
```

The gap between `SSH2_MSG_SERVICE_REQUEST sent` and `SSH2_MSG_SERVICE_ACCEPT received` is typically caused by: reverse DNS lookup, GSSAPI negotiation timeout, PAM stack delay.

---

### Step 3 — Check Reverse DNS

```bash
dig -x $(curl -s ifconfig.me) +short
```

Expected when PTR is missing:
```
;; connection timed out; no servers could be reached
```

If PTR lookup times out, sshd waits for DNS resolution before proceeding. Fix: add PTR record, or set `UseDNS no` in `/etc/ssh/sshd_config` on the server.

---

### Step 4 — Check GSSAPI Negotiation

```bash
time ssh -o GSSAPIAuthentication=no user@bastion.prod.example.com true
```

If this is fast, GSSAPI is the culprit. Add to `~/.ssh/config`:
```
Host bastion.prod.example.com
    GSSAPIAuthentication no
```

---

### Step 5 — Inspect the SSH Server From the Server Side

```bash
# On the server — check connection states
ss -tanp | grep :22

# Tail auth log during a connection attempt
sudo tail -f /var/log/auth.log
```

Expected output showing reverse DNS delay:
```
Apr  9 11:23:41 bastion sshd[8821]: Connection from 10.10.1.55 port 49812
Apr  9 11:23:41 bastion sshd[8821]: reverse mapping checking getaddrinfo... -- wait
Apr  9 11:23:59 bastion sshd[8821]: reverse mapping failed -- using IP address
Apr  9 11:23:59 bastion sshd[8821]: Accepted publickey for user from 10.10.1.55
```

The 18-second gap (11:23:41 to 11:23:59) is the reverse DNS lookup timing out.

---

### Step 6 — Packet Capture to Confirm TCP Handshake Is Fast

```bash
sudo tcpdump -i any -n port 22 -c 20
```

Expected: TCP handshake completes in < 20ms. Then silence for 18 seconds. Then application-layer SSH traffic resumes. This confirms TCP is fine; the delay is entirely within the SSH application layer.

**TCP flag decode reference:**

| Flag | Meaning |
|------|---------|
| `[S]` | SYN — initiating connection |
| `[S.]` | SYN-ACK — server accepting |
| `[.]` | ACK — handshake complete |
| `[P.]` | PSH+ACK — data payload |
| `[F.]` | FIN+ACK — graceful close |
| `[R]` | RST — abrupt close |

---

### Sample Diagnosis Note — Lab 2

```
Incident: SSH to bastion.prod.example.com taking 18-22s, reported by 6 engineers

Investigation:
  11:30 UTC — time ssh user@bastion true: 19.4s
  11:31 UTC — ssh -vvv: 18s gap between SERVICE_REQUEST and SERVICE_ACCEPT
  11:32 UTC — ssh -o GSSAPIAuthentication=no: still 18s (GSSAPI not the cause)
  11:33 UTC — dig -x <client-IP>: connection timed out (PTR lookup failing)
  11:34 UTC — confirmed sshd_config has UseDNS yes

Root cause: sshd performing reverse DNS lookup on each client IP. DNS resolver for
the 10.10.1.0/24 range was timing out PTR queries (zone SOA misconfigured at 11:00 UTC).

Fix: set UseDNS no in /etc/ssh/sshd_config on bastion; sshd reload at 11:42 UTC.
SSH logins returned to <2s immediately.
```

---

## Lab 3: Routing, Filtering, and Packet Capture

**Production context:** `payment-processor` service is unreachable from `order-service` pod, but reachable from a developer laptop via VPN. Services are in the same cluster, different namespaces. Infrastructure changed at 15:58 UTC — a new NetworkPolicy and node firewall rule were applied.

---

### Step 1 — Understand Failure Signatures Before Running Commands

| Failure type | Symptom | Time to fail | Packet capture shows |
|-------------|---------|-------------|----------------------|
| No route | `Network unreachable` (ICMP) | Immediate | ICMP destination unreachable |
| Firewall DROP | Connection times out | Full timeout (15-120s) | SYN sent, no SYN-ACK ever |
| Firewall REJECT | `Connection refused` (RST) | Immediate | SYN sent, RST received |
| Service not listening | `Connection refused` | Immediate | SYN sent, RST from destination |
| DNS failure | Could not resolve | DNS timeout (~5s) | DNS query sent, no response |

**Most important distinction:** Timeout = DROP or routing black hole. Refused = REJECT or no listener.

---

### Step 2 — Run curl With Verbose Output to Identify Failure Mode

```bash
curl -v --connect-timeout 5 \
  http://payment-processor.payments.svc.cluster.local:8080/health
```

DROP scenario output:
```
*   Trying 10.96.88.14:8080...
* connect to 10.96.88.14 port 8080 failed: Connection timed out
curl: (28) Failed to connect ... Connection timed out
```

Connection timed out = DROP rule. Move to packet capture.

---

### Step 3 — Check Routing Tables

```bash
# On source pod or host
ip route show

# Check which route applies to a specific destination
ip route get 10.96.88.14
```

If route to Service CIDR (`10.96.0.0/12`) is present, routing is not the issue. Move to filtering.

---

### Step 4 — Use tcpdump to See What the Wire Shows

```bash
# Terminal 1: capture
sudo tcpdump -i any -n 'host 10.96.88.14 and port 8080' -c 20

# Terminal 2: trigger the failure
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

DROP pattern (SYN retransmits with no SYN-ACK):
```
16:14:02.114822 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240
16:14:03.122410 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240
16:14:05.130891 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240
```

Three SYN retransmits (0s, 1s, 3s — exponential backoff), no SYN-ACK. This pattern is definitive: packets are being dropped.

---

### Step 5 — Inspect iptables to Find the DROP

```bash
sudo iptables -L INPUT -n -v --line-numbers
```

Expected output:
```
Chain INPUT (policy ACCEPT)
num  pkts bytes target prot opt source            destination
1       3   180 DROP   tcp  --  10.10.2.0/24      0.0.0.0/0     tcp dpt:9090
2      12   720 ACCEPT tcp  --  0.0.0.0/0         0.0.0.0/0     tcp dpt:9090
```

The `pkts: 3` counter confirms this rule matched the three SYN retransmissions. Remove the rule:

```bash
sudo iptables -D INPUT 1

# Verify fix
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

---

### Step 6 — Check Connection State on Destination

```bash
ss -tanp | grep 8080
```

Only `LISTEN` entries — no `SYN_RECV` or `ESTAB` from the failing client confirms packets never reached the application. If you saw `SYN_RECV`, the server received SYN but ACK back is being dropped (asymmetric filtering).

---

### Step 7 — For Kubernetes: Inspect NetworkPolicy

```bash
kubectl get networkpolicy -n payments -o yaml
```

Common bug — namespace label mismatch:
```yaml
ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: orders     # BUG: namespace may not have this label
```

```bash
# Check if namespace has the required label
kubectl get namespace orders --show-labels

# Fix: add the label
kubectl label namespace orders name=orders
```

---

### Sample Diagnosis Note — Lab 3

```
Incident: payment-processor unreachable from order-service 16:12–16:31 UTC

Symptoms:
  - curl from order-service pod: Connection timed out (not refused)
  - curl from developer laptop via VPN: immediate HTTP 200
  - ip route: route to 10.96.0.0/12 present, routing not broken

Investigation:
  tcpdump on order-service pod: three SYN retransmits, no SYN-ACK
  tcpdump on payment-processor node: no packets arriving from 10.244.1.0/24

  iptables on payment-processor node (node-3):
    iptables -L INPUT -n -v
    Rule 1: DROP tcp src 10.244.0.0/14 dpt:8080 (pkts: 9, added 15:58 UTC)

Root cause: automation script applied a node-level iptables DROP rule targeting the
entire pod CIDR (10.244.0.0/14) on port 8080. Intent was to block external access,
but rule accidentally covered internal pod-to-pod traffic.

Fix: removed rule at 16:31 UTC. Replaced with specific rule for external IPs only.
```

---

## Cloud Networking Drill 1: Public, Private, and Internal Boundaries

**Context:** Design a network architecture for an ML platform with public inference API, internal admin dashboard, PostgreSQL database, and GPU batch workers.

### Network Zone Model

```
Internet
    ↓ (HTTPS 443)
[Public Load Balancer / WAF]       ← Public edge, no persistent state
    ↓ (private IP only)
[Inference API pods]               ← Private application subnet
[Admin UI pods]                    ← Private admin subnet (SEPARATE from API)
    ↓ (private IP only)
[PostgreSQL (RDS)]                 ← Private data subnet
[GPU Workers]                      ← Private compute, egress-only
```

**Why separate subnets for inference API and admin:**
- Inference API needs wider inbound rules for customer traffic
- Admin UI should only be reachable from corporate VPN or specific IP ranges
- Shared subnet: one misconfigured LB rule could expose admin to internet

### Safe Admin Access Patterns

**Pattern A — AWS Session Manager / GCP IAP:**
```
Engineer → Cloud console (authenticated) → IAM-gated tunnel → private instance
```
No public IP on the target. All access through cloud IAM. Sessions recorded automatically. Preferred in modern architectures.

**Pattern B — Bastion host:**
```
Engineer laptop → VPN → Bastion (hardened) → private resources
```
Bastion allows SSH from specific corporate IP range only, never `0.0.0.0/0`.

**Pattern C — VPN:**
```
Engineer → VPN tunnel → private subnet directly
```
Full VPN routes all traffic through corporate network. Split tunnel routes only private IPs through VPN.

### Egress Control

```
Private subnet → NAT Gateway → Internet
                     ↑ Static Egress IP (allowlist at 3rd-party services)

Private subnet → VPC Endpoint (AWS) / Private Service Connect (GCP) → Cloud service
               (traffic never leaves cloud provider backbone)
```

VPC Endpoints are preferred for cloud-native services (S3, GCS, BigQuery): no NAT, no internet exposure, lower latency, supports IAM policies.

### Terraform: Restrict Admin Access

```hcl
# WRONG: Admin UI exposed to internet
resource "aws_security_group_rule" "admin_inbound_bad" {
  cidr_blocks = ["0.0.0.0/0"]  # dangerous
}

# CORRECT: Admin UI restricted to corporate VPN
resource "aws_security_group_rule" "admin_inbound" {
  type        = "ingress"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["10.0.0.0/8"]   # corporate VPN range only
  security_group_id = aws_security_group.admin_ui.id
}

# CORRECT: Separate internal-only load balancer for admin
resource "aws_lb" "admin_internal" {
  internal           = true
  load_balancer_type = "application"
  subnets            = var.private_subnet_ids
}
```

---

## Cloud Networking Drill 4: Kubernetes and Cloud Networking Path

**Context:** Trace a request from the internet to a pod in GKE/EKS and understand every failure domain.

### Full Request Path

```
[Internet client]
      ↓ DNS: api.example.com → Cloud DNS / Route 53 → ALB CNAME or Anycast IP
      ↓ HTTPS to Anycast IP
[Global HTTPS LB / ALB]          ← Terminates TLS, runs WAF rules
      ↓ HTTP (inside backbone, or re-encrypted)
[NodePort or NEG backend]        ← Traffic enters the cluster node
      ↓ iptables / eBPF (kube-proxy or Cilium)
[Service ClusterIP]              ← Virtual IP — no process listens here
      ↓ Load-balanced to one of N endpoints
[Pod IP: 10.244.3.7:8080]        ← Final destination
      ↓
[Container process on port 8080]
```

### How kube-proxy DNAT Works

```bash
# See iptables rules kube-proxy creates (run on a node)
iptables-save | grep KUBE-SERVICES | grep inference-api

# Expected output:
# -A KUBE-SERVICES -d 10.96.144.221/32 -p tcp --dport 8080 -j KUBE-SVC-XYZABC123
# -A KUBE-SVC-XYZABC123 -m statistic --mode random --probability 0.33333 -j KUBE-SEP-POD1
# -A KUBE-SVC-XYZABC123 -m statistic --mode random --probability 0.50000 -j KUBE-SEP-POD2
# -A KUBE-SVC-XYZABC123 -j KUBE-SEP-POD3
```

The ClusterIP is a virtual IP — it exists only as DNAT rules. `curl 10.96.144.221:8080` works from inside a pod but fails from outside the cluster.

### The Shallow Health Check Failure Pattern

```bash
# Cloud LB health checks /ping (always 200)
# Real user hits /v1/infer (503 — model not loaded)

# Observe the gap:
kubectl describe pod -l app=inference-api | grep -A 5 "Readiness"
# Shows: http-get /ping → 200 OK → Ready: True

kubectl exec -it $(kubectl get pod -l app=inference-api -o name | head -1) -- \
  curl -s http://localhost:8080/v1/infer
# Returns: 503 {"error": "model not loaded"}
```

Fix: use a deep readiness probe:
```yaml
readinessProbe:
  httpGet:
    path: /readyz    # checks model loaded, DB connected, cache warm
    port: 8080
  initialDelaySeconds: 0
  periodSeconds: 10
  failureThreshold: 3
```

### Pod Termination 502 Fix

```yaml
spec:
  containers:
  - lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
  terminationGracePeriodSeconds: 60  # must exceed LB deregistration delay (default 30s on AWS)
```

### Check Which CNI Is Running

```bash
kubectl get pods -n kube-system | grep -E "cilium|flannel|aws-node|calico"

# For Cilium: check eBPF mode
kubectl exec -n kube-system cilium-xxxxx -- cilium status | grep KubeProxyReplacement

# For Cilium: trace a policy decision
kubectl exec -n kube-system cilium-xxxxx -- cilium policy trace \
  --src-k8s-pod production/order-service \
  --dst-k8s-pod payments/payment-processor \
  --dport 8080
```
