---
title: "Troubleshooting"
sidebar_position: 8
---

# Networking — Troubleshooting

Systematic runbooks for the most common networking failures. Each runbook starts with symptoms and failure signatures, then walks through diagnostic commands in order, and ends with fixes and verification steps.

---

## Runbook 1: Connection Refused vs Connection Timeout

Understanding this distinction is the first step in every network failure investigation. The two failure modes look similar to users but point to completely different root causes.

### Failure Signatures

| Symptom | Error message | What it means |
|---------|--------------|---------------|
| **Timeout** | `connection timed out`, `i/o timeout`, `context deadline exceeded` | SYN packets sent, no SYN-ACK returned — packets are being dropped |
| **Refused** | `connection refused`, `connect ECONNREFUSED` | SYN sent, RST received — destination is reachable but nothing is listening |
| **No route** | `network is unreachable`, `no route to host` | Routing table has no path to destination |
| **DNS failure** | `no such host`, `NXDOMAIN`, `dial tcp: lookup` | DNS lookup failed before TCP even started |

### Step 1 — Get the Exact Error

```bash
curl -v --connect-timeout 10 http://target-service:8080/health
```

Read the first error line carefully:
- `Failed to connect ... Connection timed out` → Timeout (DROP or routing black hole)
- `Failed to connect ... Connection refused` → Refused (no listener or REJECT rule)
- `Could not resolve host` → DNS failure (look up, not TCP)
- `Network unreachable` → No local route

### Step 2 — Test TCP Directly (Skip DNS)

```bash
# Test if TCP port is reachable (immediate result — no application layer)
nc -vz 10.96.84.21 8080

# Timeout means DROP. Refused means no listener. Instant success means port is open.
```

### Step 3 — For Timeout: Packet Capture to Confirm DROP

```bash
# On the source host — do SYN packets leave?
sudo tcpdump -ni eth0 host 10.96.84.21 and port 8080

# On the destination host — do SYN packets arrive?
sudo tcpdump -ni any host 10.1.0.5 and port 8080
```

If SYN leaves source but does not arrive at destination: routing or firewall DROP in transit.
If SYN arrives at destination but no SYN-ACK is sent back: iptables DROP on destination node, or service not listening.

### Step 4 — For Refused: Check if a Process Is Listening

```bash
# On the destination host
ss -lntp | grep 8080

# If nothing is listening, the service is down or on a different port
# Check what port the application actually uses
ss -lntp | grep <process-name>
```

### Step 5 — Check Routing Table

```bash
ip route get 10.96.84.21
# Expected: show which interface and gateway handles this destination
# If "no route to host" → routing table is missing an entry
```

### Decision Tree

```
Error received?
  ├── DNS error  → Go to Runbook 2 (DNS failures)
  ├── No route   → Check ip route, VPC route tables
  ├── Refused    → Process not listening on that port (ss -lntp on destination)
  └── Timeout    → Packet capture to find where SYN is lost → check iptables/NetworkPolicy/security groups
```

---

## Runbook 2: DNS Resolution Failures

DNS failures cause `no such host` errors before TCP even starts. They look like network failures but require completely different tools to diagnose.

### Step 1 — Reproduce the DNS Failure

```bash
# From the affected pod or host
nslookup payment-svc.payments.svc.cluster.local
dig payment-svc.payments.svc.cluster.local
```

Key responses:
- `NXDOMAIN` — name does not exist in DNS (service may not exist, or wrong name)
- `SERVFAIL` — DNS server encountered an error resolving the query (CoreDNS problem)
- `connection timed out` — DNS server unreachable (CoreDNS pod down, or UDP 53 blocked)

### Step 2 — Check Pod DNS Configuration

```bash
kubectl exec -it <pod-name> -n <namespace> -- cat /etc/resolv.conf
```

Expected for a Kubernetes pod:
```
nameserver 10.96.0.10       ← CoreDNS ClusterIP
search production.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

`ndots:5` is important: names with fewer than 5 dots get the search domain appended. `payment-svc` (1 dot) becomes `payment-svc.production.svc.cluster.local`, then `payment-svc.svc.cluster.local`, etc.

If the nameserver IP is wrong or the search domains are missing, pod DNS won't work.

### Step 3 — Query CoreDNS Directly

```bash
# From within the pod, query CoreDNS directly
dig @10.96.0.10 payment-svc.payments.svc.cluster.local

# Also try the full FQDN explicitly (with trailing dot — forces absolute lookup)
dig @10.96.0.10 payment-svc.payments.svc.cluster.local.
```

### Step 4 — Check CoreDNS Health

```bash
# Is CoreDNS running?
kubectl get pods -n kube-system -l k8s-app=kube-dns

# CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# CoreDNS ConfigMap (Corefile)
kubectl get configmap coredns -n kube-system -o yaml
```

Common CoreDNS Corefile problems:
- `forward` directive pointing to a broken upstream resolver
- `health` plugin misconfigured (pod starts but probe fails)
- Wrong cluster domain (should be `cluster.local`)

### Step 5 — Verify the Service Exists

```bash
# Does the service exist at all?
kubectl get svc payment-svc -n payments

# What services are actually in that namespace?
kubectl get svc -n payments

# Check if DNS resolves the service ClusterIP correctly
kubectl get svc payment-svc -n payments -o jsonpath='{.spec.clusterIP}'
dig @10.96.0.10 payment-svc.payments.svc.cluster.local +short
# Both should return the same IP
```

### Step 6 — Test External DNS From the Pod

```bash
# Can the pod resolve public names?
kubectl exec -it <pod> -- dig @8.8.8.8 google.com +short

# If this works but cluster names fail → CoreDNS problem
# If this also fails → network policy blocking UDP 53 to external resolvers
```

### Common Fixes

| Root cause | Fix |
|-----------|-----|
| Service does not exist | Create the service or fix the name in the app config |
| Wrong namespace in the DNS name | Use FQDN: `svc.namespace.svc.cluster.local` |
| CoreDNS pod OOMKilled | Increase CoreDNS memory limit in its Deployment |
| Upstream resolver unreachable | Fix `forward` directive in CoreDNS ConfigMap |
| ndots causing wrong search order | Add a trailing dot to force absolute lookup, or reduce ndots |

---

## Runbook 3: TLS Handshake Failures

TLS failures occur after TCP is established. The connection succeeds at L4, but the application-layer TLS negotiation fails. Users see certificate errors, connection resets, or protocol errors.

### Step 1 — Get the Exact TLS Error

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com 2>&1 | tail -20
```

Common error messages:

| Error | Meaning |
|-------|---------|
| `verify error:num=10:certificate has expired` | Certificate past its expiry date |
| `verify error:num=18:self signed certificate` | Self-signed cert, not trusted by client CA store |
| `verify error:num=19:self signed certificate in chain` | Intermediate cert is self-signed |
| `verify error:num=20:unable to get local issuer certificate` | Missing intermediate cert in chain |
| `SSL alert number 40` | Handshake failure — often cipher suite mismatch |
| `SSL alert number 42` | Bad certificate |
| `SSL alert number 48` | Unknown CA |
| `wrong version number` | Connecting to a non-TLS port with TLS |
| `TLSV1_ALERT_PROTOCOL_VERSION` | Client requires newer TLS version than server offers |

### Step 2 — Check Certificate Validity

```bash
# Check dates
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -dates

# Check Common Name and SANs
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName

# Verify the cert chain
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl verify
```

### Step 3 — Test With a Specific TLS Version

```bash
openssl s_client -connect api.example.com:443 -tls1_3    # TLS 1.3
openssl s_client -connect api.example.com:443 -tls1_2    # TLS 1.2
openssl s_client -connect api.example.com:443 -tls1_1    # TLS 1.1 (likely rejected)
```

If `-tls1_3` fails but `-tls1_2` succeeds: the server supports only TLS 1.2 (may be a configuration issue or an old server). If both fail: cipher suite mismatch or certificate issue.

### Step 4 — SNI Mismatch

SNI (Server Name Indication) tells the server which certificate to present. If the client sends the wrong SNI, the server may present the wrong certificate.

```bash
# Default SNI from the hostname
openssl s_client -connect 10.0.0.5:443 -servername api.example.com

# Without SNI (for servers that don't support SNI)
openssl s_client -connect api.example.com:443 -noservername
```

### Step 5 — Test Cipher Suite Compatibility

```bash
# List ciphers available on the server
nmap --script ssl-enum-ciphers -p 443 api.example.com

# Or with openssl
openssl ciphers -v 'HIGH:!aNULL:!MD5' | awk '{print $1}' | while read cipher; do
  result=$(echo | openssl s_client -cipher $cipher -connect api.example.com:443 2>&1)
  if echo "$result" | grep -q "Cipher is"; then echo "$cipher: OK"; fi
done
```

### Step 6 — Kubernetes/Istio TLS Debug

```bash
# Check if the Kubernetes secret has the correct cert
kubectl get secret api-tls -n production -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -dates

# For Istio mTLS: check the cert being used by the Envoy proxy
istioctl proxy-config secret <pod>.<namespace>

# Verify mTLS policy
istioctl authn tls-check <pod>.<namespace> <destination-service>
```

---

## Runbook 4: Packet Loss and Intermittent Connectivity

Intermittent failures are harder than complete failures because they don't always reproduce on demand. The goal is to collect evidence during the failure, not after.

### Step 1 — Confirm Packet Loss With Continuous ping

```bash
# ping with timestamps — run during the incident
ping -D -i 0.2 10.1.2.3   # -D: timestamps, -i: 0.2s interval

# count packets lost
ping -c 100 10.1.2.3 | tail -5
# Output: 5 packets transmitted, 100 received, 5% packet loss
```

### Step 2 — Use mtr for Per-Hop Loss

```bash
mtr -n --report --report-cycles 100 10.1.2.3
```

Output shows per-hop packet loss. If loss appears at hop 5 and all subsequent hops, the problem is at hop 5. If loss appears at hop 5 but the final destination shows 0% loss, hop 5 just doesn't respond to ICMP (this is normal for some routers).

```
Host                Loss%  Snt  Last  Avg  Best  Wrst  StDev
1. 10.0.0.1         0.0%   100   0.5  0.5   0.4   0.7   0.1
2. 10.0.1.1         0.0%   100   1.2  1.3   1.1   2.1   0.2
3. 203.0.113.1     12.0%   100  18.4 19.1  17.2  45.2   4.1  ← loss starts here
4. 10.1.2.3        12.0%   100  19.2 20.0  18.0  48.1   4.2
```

### Step 3 — Check Kernel Drop Statistics

```bash
# Show network error counters (check for increasing values)
netstat -s | grep -E "segments retransmitted|failed connection attempts|resets received"

# Detailed NIC statistics
ethtool -S eth0 | grep -E "drop|error|miss"

# Dropped packets in kernel
cat /proc/net/dev | grep eth0
# Fields: rx_bytes rx_packets rx_errs rx_drop rx_fifo rx_frame
# Non-zero rx_drop means kernel is dropping packets (buffer overflow)
```

### Step 4 — Capture During the Failure

```bash
# Start a background capture — will record packets during the loss window
sudo tcpdump -i any -w /tmp/incident.pcap host 10.1.2.3 &
TCPDUMP_PID=$!

# Run the load that triggers drops
<run your test>

# Stop capture
kill $TCPDUMP_PID

# Analyze — look for retransmissions
tcpdump -r /tmp/incident.pcap | grep -E "Flags \[S\]" | wc -l   # SYN count
tcpdump -r /tmp/incident.pcap | grep -E "Flags \[S\.\]" | wc -l  # SYN-ACK count
# If SYN >> SYN-ACK → many connection attempts failing
```

### Step 5 — MTU Issues (Common With VPNs and Overlays)

If large transfers fail but small ones work, MTU is the likely culprit.

```bash
# Test with different packet sizes
ping -M do -s 1400 10.1.2.3   # -M do: don't fragment, -s: payload size
ping -M do -s 1450 10.1.2.3   # If 1400 works but 1450 fails → MTU ~1428 (1450 + 28 headers)

# Check interface MTU
ip link show eth0   # Look for "mtu 1500"

# For VXLAN/Geneve overlays: effective MTU = physical MTU - overlay overhead
# VXLAN overhead: 50 bytes. Physical MTU 1500 → pod MTU should be 1450.
```

---

## Runbook 5: Service Mesh Sidecar Injection Not Working

Pods aren't getting the Envoy sidecar (`istio-proxy`) container injected. mTLS and observability features are missing for affected pods.

### Step 1 — Check If the Pod Has the Sidecar

```bash
kubectl get pod <pod-name> -n production -o jsonpath='{.spec.containers[*].name}'
# Expected: my-app istio-proxy
# Problem: only my-app (no istio-proxy)
```

### Step 2 — Check the Namespace Label

```bash
kubectl get namespace production --show-labels
```

Expected label: `istio-injection=enabled`

If missing:
```bash
kubectl label namespace production istio-injection=enabled
# Then restart existing pods to get the sidecar injected
kubectl rollout restart deployment -n production
```

### Step 3 — Check for Explicit Opt-Out Annotations

The pod spec may have an annotation that explicitly disables injection:

```bash
kubectl get pod <pod-name> -n production -o jsonpath='{.metadata.annotations}'
# Look for: sidecar.istio.io/inject: "false"
```

Remove the annotation or set it to `"true"`:

```bash
kubectl patch deployment my-app -n production \
  --type=json \
  -p='[{"op":"remove","path":"/spec/template/metadata/annotations/sidecar.istio.io~1inject"}]'
```

### Step 4 — Check the Mutating Webhook

Sidecar injection works via a Kubernetes MutatingWebhookConfiguration. If the webhook is not running, injection silently does nothing.

```bash
# Check the webhook configuration exists
kubectl get mutatingwebhookconfiguration istio-sidecar-injector

# Check the istio-sidecar-injector service
kubectl get svc -n istio-system | grep sidecar-injector

# Check if the webhook is reachable
kubectl get pods -n istio-system | grep istiod
kubectl logs -n istio-system -l app=istiod | grep -i webhook
```

### Step 5 — Run the Istio Diagnostics Tool

```bash
istioctl analyze -n production

# Common output:
# Warning: Namespace "production" has auto-injection disabled
# Warning: Pod "my-app-xxx" lacks the Istio sidecar
```

---

## Runbook 6: Network Policy Blocking Unexpected Traffic

A NetworkPolicy was applied and now some legitimate traffic is blocked. NetworkPolicies are additive — if any policy selects a pod, only traffic explicitly allowed by that policy (or other policies selecting the same pod) is permitted. All other traffic is denied.

### Step 1 — Find All Policies That Apply to the Affected Pod

```bash
# Get the labels of the affected pod
kubectl get pod payment-svc-abc -n payments --show-labels

# Find policies that select this pod (by matching selector)
kubectl get networkpolicy -n payments -o yaml | grep -A 10 podSelector
```

### Step 2 — Read the Policy Carefully

```bash
kubectl describe networkpolicy allow-checkout-to-payments -n payments
```

Common mistakes in NetworkPolicy:
- `namespaceSelector` matches on a label the namespace doesn't have
- `podSelector` uses a label key that was renamed in a deployment
- Ingress is allowed but the egress response path is blocked
- Missing protocol (`tcp`) when the default covers all protocols but you intended only TCP

### Step 3 — Check Namespace Labels

```bash
# Does the source namespace have the label the policy expects?
kubectl get namespace orders --show-labels

# If the policy expects: name=orders
# But the namespace only has: kubernetes.io/metadata.name=orders
# Then the namespaceSelector won't match

# Fix: add the label the policy expects
kubectl label namespace orders name=orders
```

### Step 4 — Use Policy Debugging Tools

```bash
# cilium-cli (if using Cilium as CNI)
cilium policy trace --src-k8s-pod orders/order-svc-abc \
                   --dst-k8s-pod payments/payment-svc-abc \
                   --dport 8080

# Hubble (Cilium's observability layer)
hubble observe --namespace payments --verdict DROPPED --last 50

# For non-Cilium CNI: use a debug pod to test connectivity step by step
kubectl run debug --image=nicolaka/netshoot -n orders --rm -it -- \
  curl -v http://payment-svc.payments.svc.cluster.local:8080/health
```

### Step 5 — Temporarily Disable the Policy (Test)

```bash
# Save the policy first
kubectl get networkpolicy allow-checkout-to-payments -n payments -o yaml > policy-backup.yaml

# Delete temporarily to confirm policy is the cause
kubectl delete networkpolicy allow-checkout-to-payments -n payments

# Test if traffic flows
curl -v http://payment-svc.payments.svc.cluster.local:8080/health

# Restore
kubectl apply -f policy-backup.yaml
```

---

## Runbook 7: High Network Latency

Service response times are elevated but error rates are low. The root cause could be network path latency, application-level processing, or kernel buffer saturation.

### Step 1 — Baseline the Network Path With Ping

```bash
# Sustained ping to the destination — watch for jitter
ping -i 0.2 -c 200 10.1.2.3

# Statistics at end:
# rtt min/avg/max/mdev = 0.4/0.6/12.4/1.2 ms
# High mdev (variance) means jitter — likely congestion or poor link
```

### Step 2 — Use mtr to Find the High-Latency Hop

```bash
mtr -n --report 10.1.2.3
```

A single hop showing 10× higher latency than its neighbor indicates congestion or a problematic network device at that hop.

### Step 3 — Check for Retransmissions (Sign of Congestion)

```bash
# TCP retransmissions add RTT to each segment
netstat -s | grep retransmit
# Should be very low (< 0.1% of segments). High value means packet loss → retransmits → latency.

# Watch for increasing retransmit count
watch -n 5 "netstat -s | grep -i retransmit"
```

### Step 4 — Check NIC Settings and Offloads

```bash
# Check interface speed and duplex
ethtool eth0 | grep -E "Speed|Duplex|Link"
# Half duplex causes collisions and retransmits on busy links

# Check offload settings (GRO, TSO, etc.)
ethtool -k eth0 | grep -E "generic-receive-offload|tcp-segmentation-offload"
```

### Step 5 — Check TCP Send/Receive Buffer Sizes

```bash
# Current buffer sizes
sysctl net.core.rmem_max net.core.wmem_max net.ipv4.tcp_rmem net.ipv4.tcp_wmem

# If buffers are too small for high-bandwidth, high-latency paths (e.g., cross-region):
# bandwidth-delay product = bandwidth × RTT
# 1 Gbps × 100ms = 12.5 MB buffer needed
# Default TCP buffers are ~87KB — too small for cross-region high-throughput

# Increase buffers
sysctl -w net.core.rmem_max=134217728    # 128MB
sysctl -w net.core.wmem_max=134217728
```

### Step 6 — Check for CPU Softirq Saturation

```bash
# Is a single CPU core handling all NIC interrupts?
mpstat -P ALL 1 5 | grep softirq

# Or use sar
sar -I ALL 1 5

# For NIC interrupt spreading (RSS — Receive Side Scaling)
cat /proc/interrupts | grep eth0
```

If one CPU is handling 100% softirq, it can't keep up with the packet rate. Solution: enable RSS (multiple RX queues) and IRQ affinity spread across cores.

---

## Runbook 8: Load Balancer Health Check Failures

Cloud load balancers (ALB, NLB) are marking backend targets as unhealthy. This removes them from the load-balancing pool, potentially causing 502/503 errors or overloading remaining targets.

### Step 1 — Check Target Group Health in AWS

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456:targetgroup/my-tg/abc \
  --query 'TargetHealthDescriptions[*].{IP:Target.Id,Port:Target.Port,State:TargetHealth.State,Reason:TargetHealth.Reason,Description:TargetHealth.Description}'
```

Key `Reason` codes:

| Reason | Meaning |
|--------|---------|
| `Target.ResponseCodeMismatch` | Target returned wrong HTTP status code (not 200 by default) |
| `Target.Timeout` | Target didn't respond within the health check timeout |
| `Target.FailedHealthChecks` | X consecutive checks failed |
| `Elb.InternalError` | ALB itself has an issue (rare) |

### Step 2 — Manually Replicate the Health Check

```bash
# Find the health check configuration
aws elbv2 describe-target-groups \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --query 'TargetGroups[0].{Path:HealthCheckPath,Port:HealthCheckPort,Protocol:HealthCheckProtocol,Timeout:HealthCheckTimeoutSeconds,Interval:HealthCheckIntervalSeconds,Codes:Matcher.HttpCode}'

# Replicate the health check from within the VPC
curl -v http://<target-ip>:<health-check-port><health-check-path>
```

If the health check path returns a non-200 code (or a 200 but the matcher expects 200-299), the target will be marked unhealthy.

### Step 3 — Check Health Check Timing Configuration

```bash
aws elbv2 describe-target-groups \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --query 'TargetGroups[0].{Timeout:HealthCheckTimeoutSeconds,Interval:HealthCheckIntervalSeconds,Threshold:HealthyThresholdCount,UnhealthyThreshold:UnhealthyThresholdCount}'
```

Common misconfiguration: timeout (10s) equals interval (10s). If the backend takes 9.9 seconds to respond, the response barely makes it through but the next check is already starting. Set timeout to 60-70% of interval.

### Step 4 — Check for Startup Delays

If targets fail immediately after deployment, the application may not be ready to serve health checks yet.

```bash
# Check Kubernetes pod readiness probe
kubectl describe pod <pod-name> | grep -A 10 "Readiness"

# If using deregistration delay + preStop hook pattern:
kubectl get pod <pod-name> -o yaml | grep -A 10 lifecycle
```

For Kubernetes pods behind an ALB:
1. ALB deregistration delay default: 300 seconds (reduce to 30-60s for fast deployments)
2. `terminationGracePeriodSeconds` must be > deregistration delay + app shutdown time
3. `preStop` sleep must be > deregistration delay to allow existing connections to drain

### Step 5 — Check NLB vs ALB Health Check Behavior

NLB health checks behave differently from ALB:

```bash
# NLB TCP health checks test TCP connectivity only — not HTTP
# If your app is temporarily slow to establish connections, NLB will mark it unhealthy

# NLB health check interval minimum: 10 seconds (ALB: 5 seconds)
# NLB marks unhealthy after 3 consecutive failures = 30 seconds to go unhealthy

# For NLB HTTP health checks, ensure the health check port matches a Kubernetes NodePort
kubectl get svc my-service -o jsonpath='{.spec.ports[*].nodePort}'
```

### Step 6 — Check Application Logs During Health Check Window

```bash
# Stream logs and watch for health check requests
kubectl logs -f deployment/my-app -n production | grep -E "GET /health|readyz|ping"

# If health check hits are missing → ALB can't reach the pods (security group issue)
# If health check hits show errors → application is returning wrong status
```

Common causes for health check failures during deployments:
- Readiness probe passes but deep health check fails (model not loaded, DB not connected)
- Security group rule for health check port was not updated when port changed
- Health check timeout too short for a slow initialization path
- ALB security group not whitelisted in the target's security group for health check port

---

## HTTP/API Debugging — curl Timing Breakdown

Use `curl -w` to get per-phase timing and pinpoint exactly where latency is introduced:

```bash
# Create timing format file
cat > /tmp/curl-format.txt << 'EOF'
time_namelookup:    %{time_namelookup}s
time_connect:       %{time_connect}s
time_appconnect:    %{time_appconnect}s  (TLS handshake)
time_redirect:      %{time_redirect}s
time_pretransfer:   %{time_pretransfer}s
time_starttransfer: %{time_starttransfer}s  (TTFB)
time_total:         %{time_total}s
http_code:          %{http_code}
EOF

# Run with timing
curl -w "@/tmp/curl-format.txt" -o /dev/null -s https://api.example.com/health
```

**Reading the output:**

| Phase | High value means... |
|---|---|
| `time_namelookup` high | DNS slow or missing cache — check CoreDNS, ndots |
| `time_connect` high | TCP SYN not reaching server — routing, firewall, or pod not listening |
| `time_appconnect` high | TLS slow — certificate chain or cipher negotiation |
| `time_starttransfer` (TTFB) high | Application processing slow — check app, DB, cache |
| `time_total` high, others low | Large response body or connection reuse issue |

```bash
# Quick checks for common errors
curl -v --head https://api.example.com 2>&1 | grep -E "SSL|certificate|expire"
curl -vL https://api.example.com/old-path    # trace redirects
curl -X POST -H "Content-Type: application/json" \
     -d '{"key": "value"}' https://api.example.com/endpoint
```

### NGINX Log Analysis

```bash
# Only 5xx errors
grep '" 5' /var/log/nginx/access.log | tail -50

# Slowest requests (requires JSON log format)
jq -r '.request_time + " " + .uri' /var/log/nginx/access.log | sort -n -r | head -10

# Error rate by minute
grep '" 5' /var/log/nginx/access.log | awk '{print $4}' | cut -c2-17 | sort | uniq -c

# NGINX error log — upstream failure patterns
grep -E "no live upstreams|connect\(\) failed|recv\(\) failed|upstream timed out" \
     /var/log/nginx/error.log | tail -30
```

**Common NGINX error patterns:**
- `no live upstreams while connecting to upstream` → all backends in the upstream block are down or `max_fails` hit; increase `max_fails` or fix health checks
- `upstream timed out (110: Connection timed out)` → `proxy_read_timeout` exceeded; scale backend or increase timeout
- `connect() failed (111: Connection refused)` → backend pod not listening on the expected port; check `targetPort` matches container port
- `X-Forwarded-For` missing → add `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` to NGINX config

---

## Systematic Packet-Path Debugging Method

Never say "CNI issue" until you prove where the path breaks. Work through these layers in order:

```text
1. Classify traffic type
   - Pod to Pod (same node)
   - Pod to Pod (cross-node)
   - Pod to Service (ClusterIP)
   - External to Ingress
   - Pod to External

2. Test DNS separately
   kubectl exec POD -- nslookup kubernetes.default
   kubectl exec POD -- cat /etc/resolv.conf

3. Test backend Pod IP directly
   kubectl exec POD -- curl -v http://POD_IP:PORT

4. Test Service name and ClusterIP
   kubectl exec POD -- curl -v http://SERVICE:PORT

5. Inspect EndpointSlice
   kubectl get endpointslice -l kubernetes.io/service-name=SERVICE

6. Inspect NetworkPolicy
   kubectl get networkpolicy -A

7. Inspect node datapath
   iptables-save | grep KUBE-SVC-<hash>
   conntrack -S
   ip route

8. Inspect cloud path if traffic leaves cluster
   (security groups, VPC routes, NAT gateway, firewall)
```

**Key split test:** If `curl POD_IP` works but `curl SERVICE` fails → Service/datapath problem (check EndpointSlice, iptables, IPVS). If both fail → backend problem (check app, policy, route, listener).

---

## Kubernetes Networking — Command Interpretation Table

| Command | What It Answers | Bad Signs |
|---|---|---|
| `kubectl get pods -o wide` | Pod placement and IPs | Failures scoped to one node |
| `kubectl get svc` | Service definition (port/type) | Wrong ports, unexpected ClusterIP |
| `kubectl get endpointslice` | Ready backends list | Empty endpoints (selector mismatch or unready pods) |
| `kubectl describe svc SERVICE` | Selector, ports, endpoints summary | "No endpoints" in Events |
| `nslookup kubernetes.default` from Pod | DNS path working | Timeout or SERVFAIL |
| `curl SERVICE` vs `curl POD_IP` | Service path vs backend path | Service fails, PodIP works = datapath bug |
| `iptables-save \| grep KUBE-SVC` | iptables Service rules exist | Empty output = kube-proxy not syncing |
| `hubble observe --verdict DROPPED` | Cilium policy drop visibility | Policy/drop reasons shown |
| `conntrack -S` | Kernel flow tracking state | `insert_failed` count rising = conntrack exhaustion |
| `tcpdump` | Packet truth | SYN with no SYN-ACK = packet dropped |
| `ip route` | Node routing table | Missing pod CIDR route = CNI broken |

---

## Real Incident Patterns — Networking Root Causes

### Service Has No Endpoints (Selector Mismatch)

```bash
# Check what the Service selector expects
kubectl get svc api -o jsonpath='{.spec.selector}'
# Output: {"app":"api","version":"v2"}

# Check what labels your pods actually have
kubectl get pods -l app=api --show-labels
# If pods have version=v1 but Service expects version=v2 → no endpoints

# Fix: correct the label on the deployment or remove the version selector
kubectl label pods -l app=api version=v2 --overwrite
```

### DNS Fails Only In One Namespace

Cause: egress NetworkPolicy in that namespace blocks DNS (UDP/TCP port 53 to CoreDNS).

```bash
# Confirm DNS fails in the namespace
kubectl exec -n NAMESPACE POD -- nslookup kubernetes.default

# Check NetworkPolicy for the namespace
kubectl get networkpolicy -n NAMESPACE

# Look for egress policies that don't explicitly allow DNS
kubectl get networkpolicy -n NAMESPACE -o yaml | grep -A 10 "egress"

# Fix: add egress rule allowing DNS
```

```yaml
# Allow egress to CoreDNS
- egress:
  - ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
```

### New Connections Fail During Traffic Spike

Cause: conntrack table exhaustion. Old established connections continue; new connection attempts fail silently.

```bash
# Check conntrack usage
cat /proc/sys/net/netfilter/nf_conntrack_count    # current
cat /proc/sys/net/netfilter/nf_conntrack_max      # limit

# Check for insertion failures (the key metric)
conntrack -S | grep insert_failed

# Check dmesg for table full messages
dmesg | grep "nf_conntrack: table full"

# Temporary fix (survive the incident)
sysctl -w net.netfilter.nf_conntrack_max=524288

# Permanent fix: add to /etc/sysctl.d/99-conntrack.conf
# net.netfilter.nf_conntrack_max = 524288
# net.netfilter.nf_conntrack_tcp_timeout_established = 600  (reduce from 432000)
```

### Ingress Returns 502 After Deployment

Systematic check order (fastest to slowest):

```bash
# 1. Are there ready endpoints?
kubectl get endpointslice -l kubernetes.io/service-name=SERVICE

# 2. Is the targetPort correct?
kubectl get svc SERVICE -o jsonpath='{.spec.ports[*].targetPort}'

# 3. Is the app actually listening on that port?
kubectl exec POD -- ss -tlnp | grep PORT

# 4. Check ingress controller logs for upstream errors
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller | grep -E "upstream|error" | tail -30

# 5. Does the NetworkPolicy allow ingress controller → pod?
kubectl get networkpolicy -n NAMESPACE
```

Most common cause: readiness probe passes before the app is truly ready to serve (e.g., cache not warmed, DB connection pool not established). Increase `initialDelaySeconds` or add a deeper `/readyz` endpoint.
