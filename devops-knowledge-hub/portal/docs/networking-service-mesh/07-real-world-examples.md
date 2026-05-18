---
title: "Real-World Examples"
sidebar_position: 7
---

# Networking — Real-World Examples

Eight real SRE networking incidents with full investigation steps, root cause analysis, and fix. Each scenario includes the exact commands run in sequence, what each output reveals, and what to do next.

---

## Scenario 1: DNS Resolution Failure Causing Service Outage

**Alert:** `error_rate > 10% for inference-api` at 14:23 UTC. Logs from inference-api pods show `dial tcp: lookup payment-svc.payments.svc.cluster.local: no such host`.

---

### Step 1 — Confirm the Failure From Inside a Pod

```bash
kubectl exec -it inference-api-7d4f9-abc -n production -- \
  nslookup payment-svc.payments.svc.cluster.local
```

Output:
```
Server:    10.96.0.10
Address:   10.96.0.10#53

** server can't find payment-svc.payments.svc.cluster.local: NXDOMAIN
```

`NXDOMAIN` (Non-Existent Domain) means the name does not exist in DNS — not a timeout, not a connectivity issue. The DNS server responded but said the name doesn't exist.

---

### Step 2 — Check the Pod's DNS Configuration

```bash
kubectl exec -it inference-api-7d4f9-abc -n production -- cat /etc/resolv.conf
```

Output:
```
nameserver 10.96.0.10
search production.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

`ndots:5` means any name with fewer than 5 dots is treated as relative and has search domains appended. `payment-svc.payments.svc.cluster.local` has 5 dots so it is treated as absolute — which is correct. The DNS server itself is returning NXDOMAIN.

---

### Step 3 — Check If the Service Exists

```bash
kubectl get svc payment-svc -n payments
```

Output:
```
Error from server (NotFound): services "payment-svc" not found
```

The service does not exist. Check what services are actually present:

```bash
kubectl get svc -n payments
```

Output:
```
NAME              TYPE        CLUSTER-IP     PORT(S)   AGE
payment-service   ClusterIP   10.96.84.21    8080/TCP  45d
```

Root cause found: the service is named `payment-service`, not `payment-svc`. A recent deployment changed the service name without updating the callers.

---

### Step 4 — Check CoreDNS Logs for Broader Issues

```bash
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50
```

If CoreDNS is healthy, you see clean responses. If you see errors like `SERVFAIL` or `i/o timeout` querying upstream, the upstream DNS resolver is broken — escalate to the platform team.

---

### Fix

Option A (fastest): Add a Service alias matching the old name.
```bash
kubectl create service clusterip payment-svc \
  --tcp=8080:8080 -n payments --dry-run=client -o yaml \
  | kubectl apply -f -
```

Option B (correct): Update the application configuration to use `payment-service`.

**Post-mortem action:** Add a deployment validation check that verifies all service names referenced in ConfigMaps/environment variables exist in the target namespace.

---

## Scenario 2: TLS Certificate Expiry Bringing Down HTTPS

**Alert:** `cert_expiry_days < 1` for `api.prod.example.com` at 03:15 UTC. Customer-facing HTTPS began returning `SSL_ERROR_RX_RECORD_TOO_LONG` for new TLS sessions at 03:19 UTC.

---

### Step 1 — Confirm the Expiry

```bash
echo | openssl s_client -connect api.prod.example.com:443 -servername api.prod.example.com \
  2>/dev/null | openssl x509 -noout -dates
```

Output:
```
notBefore=Mar 17 00:00:00 2025 GMT
notAfter=May 17 03:00:00 2026 GMT    ← expired (or: shows yesterday's date)
```

```bash
# Check the cert in Kubernetes secret
kubectl get secret api-tls-secret -n production -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -dates
```

---

### Step 2 — Check cert-manager Certificate Resource

```bash
kubectl get certificate api-tls-cert -n production
```

Output:
```
NAME           READY   SECRET           AGE
api-tls-cert   False   api-tls-secret   180d
```

`READY=False` means cert-manager failed to renew. Get details:

```bash
kubectl describe certificate api-tls-cert -n production
```

Look for events like:
```
Warning  ErrObtainCertificate  cert-manager  Failed to obtain certificate: 
  ACME: urn:ietf:params:acme:error:dns — No valid combination of challenges...
```

This means the ACME DNS-01 or HTTP-01 challenge failed.

---

### Step 3 — Debug the ACME Challenge

```bash
# Check CertificateRequest status
kubectl get certificaterequest -n production
kubectl describe certificaterequest api-tls-cert-xxxxxx -n production

# Check ACME challenge resources
kubectl get challenge -n production
kubectl describe challenge api-tls-cert-challenge -n production
```

Common causes:
- HTTP-01: Ingress path `/.well-known/acme-challenge/` is blocked by WAF or not routed
- DNS-01: Route 53 API credentials expired or IAM policy is missing `route53:ChangeResourceRecordSets`

---

### Step 4 — Emergency Fix (Immediate)

If cert-manager renewal is failing and you need to buy time:

```bash
# Force a manual cert renewal attempt
kubectl annotate certificate api-tls-cert \
  cert-manager.io/issuer-name=letsencrypt-prod \
  -n production --overwrite

# Or delete the certificate to force re-creation
kubectl delete certificaterequest -n production api-tls-cert-xxxxxxx
```

If DNS-01 challenge is stuck, check Route 53 TXT record manually:

```bash
dig _acme-challenge.api.prod.example.com TXT
```

Expected: a TXT record with the ACME token. If missing, the cert-manager webhook for Route 53 is not working — check the `cert-manager` pod logs.

---

### Prevention

```yaml
# cert-manager monitors and auto-renews 30 days before expiry — ensure this is configured
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: api-tls-cert
spec:
  renewBefore: 720h   # 30 days
  dnsNames:
    - api.prod.example.com
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
```

Add an external alert: `certExpirySoon < 14 days` in Prometheus. cert-manager exposes `certmanager_certificate_expiration_timestamp_seconds`.

---

## Scenario 3: Service Mesh mTLS Breaking After Cert Rotation

**Alert:** Spike in `5xx` errors on all east-west traffic at 09:47 UTC. Envoy logs show `PEER_CERTIFICATE_NOT_FOUND` and `TLS_HANDSHAKE_FAILED`.

This typically happens after Istio CA cert rotation or after upgrading istiod.

---

### Step 1 — Check Proxy Sync Status

```bash
istioctl proxy-status
```

Output showing stale proxies:
```
NAME                        CDS    LDS    EDS    RDS    ISTIOD         VERSION
order-svc-7d4f-abc          SYNCED SYNCED SYNCED SYNCED istiod-main    1.18.2
payment-svc-9b2c-def        STALE  STALE  STALE  STALE  istiod-main    1.17.5
```

`STALE` means the Envoy sidecar in `payment-svc` is not receiving config updates from the control plane. It may be holding a stale certificate.

---

### Step 2 — Inspect the TLS Certificates in the Envoy Proxy

```bash
istioctl proxy-config secret payment-svc-9b2c-def.production
```

Output:
```
RESOURCE NAME          TYPE           STATUS    VALID CERT    SERIAL NUMBER   NOT AFTER
default                Cert Chain     ACTIVE    true          abc123          2026-05-16T09:00:00Z
```

Check `NOT AFTER` — if it's in the past, the cert expired and istiod failed to push a new one.

---

### Step 3 — Force Proxy Reconnection

```bash
# Restart the pod to force the sidecar to reconnect to istiod and get fresh certs
kubectl rollout restart deployment/payment-svc -n production

# Watch the rollout
kubectl rollout status deployment/payment-svc -n production
```

If the pod comes up healthy and `proxy-status` shows `SYNCED`, cert rotation is the confirmed root cause.

---

### Step 4 — Check Istiod Health

```bash
kubectl get pods -n istio-system
kubectl logs -n istio-system -l app=istiod --tail=100 | grep -i "cert\|error\|fail"
```

If istiod is crashing or restarting, the CA may be unavailable. The root CA secret:

```bash
kubectl get secret istio-ca-secret -n istio-system
```

---

### Step 5 — Validate PeerAuthentication Policy

```bash
kubectl get peerauthentication -A
kubectl describe peerauthentication default -n istio-system
```

If `STRICT` mode is set globally but some pods haven't gotten new certs yet, they will fail. Temporarily switch to `PERMISSIVE` while the cert rotation completes:

```bash
kubectl patch peerauthentication default -n istio-system \
  --type=json -p='[{"op":"replace","path":"/spec/mtls/mode","value":"PERMISSIVE"}]'
```

Revert to `STRICT` once all proxies show `SYNCED`.

---

## Scenario 4: VPC Routing Misconfiguration Blocking Cross-AZ Traffic

**Alert:** Intermittent `500` errors on `checkout-service` in `us-east-1b` only. `checkout-service` in `us-east-1a` is healthy. Cross-AZ calls from `1b` to `payment-service` in `1a` are timing out.

---

### Step 1 — Confirm Which Availability Zone Is Affected

```bash
# Get node AZ labels for checkout pods
kubectl get pods -l app=checkout-service -o wide
# Shows: pod on node ip-10-0-2-45 (us-east-1b) is failing

# Get the node
kubectl get node ip-10-0-2-45.ec2.internal \
  --show-labels | grep topology.kubernetes.io/zone
```

---

### Step 2 — Test Connectivity From the Affected AZ

```bash
kubectl exec -it checkout-svc-b-pod-xyz -n production -- \
  curl -v --connect-timeout 5 http://payment-svc.payments.svc.cluster.local:8080/health
```

Timeout (not refused) — the TCP SYN is being dropped. Now check from a pod in `us-east-1a`:

```bash
kubectl exec -it checkout-svc-a-pod-xyz -n production -- \
  curl -v --connect-timeout 5 http://payment-svc.payments.svc.cluster.local:8080/health
```

Instant `200 OK` — confirms the issue is path-specific to `us-east-1b`.

---

### Step 3 — Check AWS VPC Route Tables

In the AWS Console or via CLI:

```bash
# Find the route table for the us-east-1b private subnet
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=subnet-0b-xxxxxxxx" \
  --query 'RouteTables[*].Routes'
```

Look for a missing or misconfigured route. A common mistake: a route for `10.0.0.0/16` pointing to `local` (correct) was accidentally deleted and replaced with a route to a NAT gateway — cross-AZ internal traffic gets sent to NAT, which only handles egress.

---

### Step 4 — Check Security Groups and NACLs

```bash
# Security group for payment-service nodes — is it allowing ingress from checkout nodes?
aws ec2 describe-security-groups --group-ids sg-payment-xxxxx \
  --query 'SecurityGroups[*].IpPermissions'

# Network ACL for us-east-1b subnet
aws ec2 describe-network-acls \
  --filters "Name=association.subnet-id,Values=subnet-0b-xxxxxxxx"
```

NACLs are stateless — you need both an inbound rule allowing the traffic AND an outbound rule allowing the response. A common mistake: inbound traffic allowed, but outbound rule for ephemeral ports (1024–65535) is missing.

---

### Fix

Restore the missing VPC route:
```bash
aws ec2 create-route \
  --route-table-id rtb-0b-xxxxxxxx \
  --destination-cidr-block 10.0.0.0/16 \
  --gateway-id local
```

**Post-mortem:** Add Infrastructure as Code (Terraform) state locking and change detection alerts. Any manual VPC route change should trigger an alert.

---

## Scenario 5: TCP TIME_WAIT Exhaustion Causing Connection Failures

**Alert:** `rate(http_requests_total{status="5xx"}[1m]) > 50` at high traffic time (11:30 UTC). Application logs show `connect: cannot assign requested address`. This is a client-side error — the connecting service is running out of local ports.

---

### Step 1 — Confirm Ephemeral Port Exhaustion

```bash
# On the source node (where the failing service is running)
ss -s
```

Output:
```
Total: 128472 (kernel 128850)
TCP:   128000 (estab 1200, closed 0, orphaned 0, timewait 126800)
```

`timewait 126800` — almost all sockets are in TIME_WAIT. The ephemeral port range is exhausted.

---

### Step 2 — Check the Ephemeral Port Range

```bash
cat /proc/sys/net/ipv4/ip_local_port_range
```

Output:
```
32768   60999
```

This gives ~28,000 available ports. With 126,800 TIME_WAIT sockets, connections to new destinations are failing because there are no free source port numbers.

---

### Step 3 — Root Cause Analysis

Why so many TIME_WAIT sockets? The service is making HTTP/1.0 requests (no keepalive) or closing connections after each request. Each closed connection enters TIME_WAIT for 60 seconds. At high RPS:

```
RPS × 60 seconds = TIME_WAIT sockets
500 RPS × 60s = 30,000 TIME_WAIT sockets
```

At 2,000 RPS this exceeds the ephemeral port range.

---

### Step 4 — Tuning

```bash
# Allow reuse of TIME_WAIT sockets for outgoing connections (safe to enable)
sysctl -w net.ipv4.tcp_tw_reuse=1

# Expand the ephemeral port range
sysctl -w net.ipv4.ip_local_port_range="1024 65535"

# Reduce TIME_WAIT timeout (use with caution — may cause issues with slow networks)
sysctl -w net.ipv4.tcp_fin_timeout=30

# Make permanent
cat >> /etc/sysctl.conf <<EOF
net.ipv4.tcp_tw_reuse=1
net.ipv4.ip_local_port_range=1024 65535
net.ipv4.tcp_fin_timeout=30
EOF
sysctl -p
```

**Real fix (architectural):** Enable HTTP keepalive in the service's HTTP client. A persistent connection reuses the same socket across many requests, eliminating TIME_WAIT per request. For internal services, use HTTP/2 (multiplexing over one connection).

---

## Scenario 6: Kubernetes Service Not Routing to Pods

**Alert:** `probe_http_status_code != 200` for `analytics-api`. Direct `curl` to the pod IP works; `curl` to the ClusterIP times out.

---

### Step 1 — Check the Service and Its Endpoints

```bash
kubectl describe svc analytics-api -n production
```

Output:
```
Name:         analytics-api
Selector:     app=analytics,tier=api
Port:         http  8080/TCP
Endpoints:    <none>
```

`Endpoints: <none>` is the problem. The Service has no pods selected.

---

### Step 2 — Find the Selector Mismatch

```bash
# What pods are running?
kubectl get pods -n production -l app=analytics --show-labels
```

Output:
```
NAME                          LABELS
analytics-api-7d4f-abc        app=analytics,component=api
```

The pod has `component=api` but the Service selector expects `tier=api`. A recent deployment changed the label name.

---

### Step 3 — Verify the Fix

```bash
# Option A: Fix the Service selector
kubectl patch svc analytics-api -n production \
  --type=json \
  -p='[{"op":"replace","path":"/spec/selector/tier","value":null},
       {"op":"add","path":"/spec/selector/component","value":"api"}]'

# Or edit directly
kubectl edit svc analytics-api -n production
```

After fixing:
```bash
kubectl get endpoints analytics-api -n production
# Expected: ENDPOINTS: 10.244.2.7:8080,10.244.3.12:8080
```

---

### Step 4 — Check for NetworkPolicy Blocking

If endpoints are correct but traffic still fails:

```bash
kubectl get networkpolicy -n production -o yaml | grep -A 20 analytics
```

Check if there is a NetworkPolicy that restricts which namespaces or pods can reach `analytics-api`. A missing `namespaceSelector` is a common issue — the monitoring namespace can't reach production services.

```bash
# Test with policy-assistant (if installed)
kubectl-np-policy-assistant --from pods/monitoring/prometheus --to svc/production/analytics-api
```

---

## Scenario 7: Load Balancer Returning 502/504

**Alert:** ALB target group `inference-api-tg` has 3 of 5 targets `unhealthy` at 16:00 UTC. Users see `502 Bad Gateway`.

---

### Step 1 — Check ALB Target Group Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/inference-api-tg/abc

# Output shows:
# TargetHealthDescription.TargetHealth.State: unhealthy
# TargetHealthDescription.TargetHealth.Reason: Target.ResponseCodeMismatch
# TargetHealthDescription.TargetHealth.Description: Health checks failed with these codes: [503]
```

The targets are reachable (TCP works) but returning `503` on the health check path.

---

### Step 2 — Check What the Health Check Path Returns

```bash
# Run health check from within the VPC (on an EC2 instance or pod on same node)
curl -v http://10.0.2.45:8080/health
```

Output:
```
HTTP/1.1 503 Service Unavailable
{"status":"not_ready","reason":"model_loading"}
```

The application is returning `503` because the ML model hasn't finished loading. The ALB is marking the instance unhealthy and draining it from the pool.

---

### Step 3 — Diagnose Timeout vs Bad Response

If the target health shows `Target.Timeout` instead of `ResponseCodeMismatch`:

```bash
# The ALB health check is timing out — check that the health check timeout
# is less than the health check interval, and that the application responds
# within the timeout window
aws elbv2 describe-target-groups \
  --target-group-arns arn:aws:elasticloadbalancing:...
# Check: HealthCheckTimeoutSeconds vs HealthCheckIntervalSeconds
# Check: HealthCheckProtocol, HealthCheckPath, Matcher.HttpCode
```

---

### Step 4 — Fix: Keepalive Mismatch (504 Pattern)

A classic 504 cause: ALB sends a request on a keepalive connection. The backend has closed the connection server-side (keepalive timeout expired). The ALB doesn't know and sends a request on the dead connection — the backend sends a TCP RST, the ALB returns 504.

Fix in application:
```
# Set backend keepalive timeout > ALB idle timeout (default 60s)
# Application server keepalive should be 75-120 seconds
# ALB idle timeout should be 60 seconds (or configure both to match)
```

For Kubernetes pods behind an ALB, set `terminationGracePeriodSeconds` to exceed the ALB deregistration delay:

```yaml
spec:
  terminationGracePeriodSeconds: 90   # ALB deregistration delay is 30s by default
  containers:
  - lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 35"]  # Outlast deregistration delay
```

---

## Scenario 8: Envoy Sidecar Causing Request Latency Increase

**Alert:** p99 latency for `recommendations-svc` jumps from 45ms to 3.2s at 14:00 UTC. The application team says no code was deployed. Service mesh was upgraded to Istio 1.19 at 13:50 UTC.

---

### Step 1 — Isolate: Is the Latency in Envoy or the Application?

```bash
# Check Envoy proxy stats for the service
kubectl port-forward pod/recommendations-svc-7d9f-abc 15000:15000 -n production &
curl -s http://localhost:15000/stats | grep "outlier_detection\|circuit_breaker\|upstream_rq_timeout"
```

Key metrics to look for:
```
cluster.recommendations_svc.outlier_detection.ejections_active: 3
cluster.recommendations_svc.circuit_breakers.default.remaining_cx: 0
cluster.recommendations_svc.upstream_rq_pending_overflow: 847
```

`circuit_breakers.remaining_cx: 0` means all connections are used up — new requests are queuing (or being dropped).

---

### Step 2 — Inspect the DestinationRule Circuit Breaker Config

```bash
istioctl proxy-config cluster recommendations-svc-7d9f-abc.production \
  --fqdn recommendations-svc.production.svc.cluster.local -o json \
  | jq '.circuitBreakers'
```

If the Istio upgrade applied a more restrictive default DestinationRule, `maxConnections` may have dropped from `unlimited` to `1024`.

Check the actual DestinationRule:

```bash
kubectl get destinationrule recommendations-svc -n production -o yaml
```

---

### Step 3 — Check Outlier Detection Ejections

```bash
istioctl proxy-config endpoint recommendations-svc-7d9f-abc.production
```

Output:
```
ENDPOINT         STATUS      OUTLIER CHECK  CLUSTER
10.244.1.10:8080 HEALTHY     OK             recommendations-svc
10.244.2.14:8080 HEALTHY     EJECTED        recommendations-svc
10.244.3.9:8080  HEALTHY     EJECTED        recommendations-svc
```

Two of three pods are ejected by outlier detection. Only one pod is receiving all traffic — it is now overloaded, causing latency. The ejected pods are actually healthy (Kubernetes probe shows Ready) but Envoy has marked them as outliers based on error rates.

---

### Step 4 — Tune Outlier Detection

The Istio upgrade set `consecutiveGatewayErrors: 1` as a new default — one error ejects the pod for 30 seconds. At p99, a single slow response was triggering ejection.

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: recommendations-svc
  namespace: production
spec:
  host: recommendations-svc
  trafficPolicy:
    outlierDetection:
      consecutiveGatewayErrors: 5    # Increased from 1 to 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50         # Never eject more than half the pool
    connectionPool:
      http:
        http2MaxRequests: 1000
        maxRequestsPerConnection: 0  # 0 = unlimited (no per-connection request cap)
```

```bash
kubectl apply -f destinationrule-recommendations.yaml
```

After applying, verify ejected pods return to the pool within 30 seconds:

```bash
watch istioctl proxy-config endpoint recommendations-svc-7d9f-abc.production
```

---

### Step 5 — Verify Fix With Latency Metrics

```bash
# If Prometheus is available
kubectl port-forward svc/prometheus 9090:9090 -n monitoring &
# Query: histogram_quantile(0.99, rate(istio_request_duration_milliseconds_bucket{destination_service_name="recommendations-svc"}[5m]))
```

p99 should return to baseline within 1-2 minutes after the outlier detection config update.
