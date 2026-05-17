---
title: "Troubleshooting"
sidebar_position: 8
---

# Cloud Platforms — Troubleshooting

Cloud troubleshooting is layer-by-layer debugging. Do not jump directly into one service dashboard. First identify which layer is failing.

```text
DNS -> CDN/WAF -> load balancer -> compute -> service dependency -> database/storage
```

---

## Universal Cloud Triage

Ask:

1. What changed recently?
2. Is the issue regional, zonal, account-specific, or service-specific?
3. Is DNS resolving correctly?
4. Is traffic reaching the edge or load balancer?
5. Are targets healthy?
6. Are workloads running and ready?
7. Are dependencies reachable?
8. Did IAM, network policy, or configuration change?
9. Is this a capacity issue, permission issue, routing issue, or application issue?

---

## Layer Matrix

| Symptom | Likely layer | First checks |
|---|---|---|
| Domain does not resolve | DNS | Hosted zone, records, TTL |
| Some users see stale content | CDN | Cache behavior, invalidation, headers |
| 403 at edge | WAF/CDN | WAF rules, origin policy, auth headers |
| 502 from ALB | Load balancer/app | Target health, app port, logs |
| Private service cannot reach internet | Network | Route table, NAT, firewall, DNS |
| App cannot access cloud API | Identity | Role, policy, trust, service account |
| DB connections exhausted | Database/app | Connection count, pool, concurrency |
| Storage cost spike | Storage/logging | Lifecycle, retention, access pattern |

---

## DNS And Route 53

Useful checks:

```bash
dig example.com
dig example.com +trace
nslookup example.com
```

Look for:

- Wrong hosted zone
- Wrong record type
- Old TTL still active
- Health check failover not configured
- Alias target changed
- Split-horizon DNS confusion

SRE tip: DNS changes are not instant. TTL and resolver caching matter during rollback.

---

## CloudFront Or CDN Issues

Symptoms:

- Users see stale content.
- Only some regions are affected.
- Origin works but CDN returns an error.

Check:

- Cache behavior path pattern
- Origin configuration
- TLS certificate
- Cache-Control headers
- Invalidation history
- WAF rules

Safer static site pattern:

```text
versioned assets with long cache
HTML entry point with shorter cache
```

---

## Load Balancer Problems

For ALB/NLB issues, check:

```text
target group health
listener rules
security group rules
health check path
backend port
TLS certificate
```

Common ALB symptoms:

| Symptom | Likely cause |
|---|---|
| 502 | Target closed connection or wrong port |
| 503 | No healthy targets |
| 504 | Backend timeout |
| Target unhealthy | Health check path or app readiness issue |

If ALB health checks fail, do not only check whether the process is running. Check whether the exact health check path returns the expected status code.

---

## VPC And Connectivity Issues

Private workload cannot reach a dependency? Check:

```text
route table
security group
NACL
NAT gateway
VPC endpoint
DNS resolution
service endpoint policy
```

Useful commands from a test host:

```bash
curl -v https://example.com
nc -vz <host> <port>
nslookup <hostname>
traceroute <hostname>
```

Common causes:

- Private subnet missing NAT route
- Security group allows inbound but not correct source
- NACL missing return traffic
- DNS hostnames disabled
- VPC endpoint policy too narrow
- Overlapping CIDR in peering or VPN

---

## IAM Or Access Problems

Symptoms:

- Deployment suddenly cannot call cloud APIs.
- App works in staging but not production.
- One role or service account fails while others work.

Check:

```text
principal identity
attached policies
trust relationship
permission boundary
organization policy
resource policy
recent IAM changes
```

SRE tip: permission problems often appear as application errors. Always check the exact cloud API error in logs.

---

## EC2 Or VM Issues

Symptoms:

- Instance unreachable
- App process stopped
- Disk full
- CPU saturated
- Instance failed health check

Checks:

```bash
df -h
free -m
top
systemctl status nginx
journalctl -u nginx --since "1 hour ago"
```

Cloud-side checks:

```text
instance status checks
system status checks
security group
route table
NACL
EBS volume metrics
Auto Scaling activity
```

If the instance is cattle, replace it. If it is a pet, document why and remove that dependency later.

---

## RDS And Database Issues

Symptoms:

- Connection timeouts
- High CPU
- Connection count spike
- Slow queries
- Replica lag
- Storage full

Check:

```text
security group
subnet group
database endpoint
DB connections
CPU utilization
free storage
slow query log
replica lag
recent schema changes
```

Common fixes:

- Add or tune application connection pooling.
- Use RDS Proxy for bursty connection patterns.
- Add read replica for read-heavy workloads.
- Increase storage or enable storage autoscaling.
- Fix slow queries before scaling blindly.

---

## S3 Issues

Symptoms:

- Access denied
- Object not found
- Static site broken
- Replication lag
- Unexpected cost increase

Check:

```text
bucket policy
object key
public access block
KMS key policy
lifecycle policy
versioning
replication rule
CloudFront origin path
```

For static websites, distinguish these:

```text
S3 REST endpoint
S3 website endpoint
CloudFront distribution endpoint
custom domain
```

They behave differently.

---

## Lambda Issues

Symptoms:

- Timeout
- Memory exceeded
- Cold starts
- Throttling
- Downstream service overload

Check:

```text
timeout setting
memory setting
concurrency
CloudWatch logs
event source retry policy
DLQ or failure destination
VPC networking
```

If Lambda overloads a database, cap concurrency or introduce SQS/RDS Proxy.

---

## DynamoDB Issues

Symptoms:

- Throttling
- Slow query
- High cost
- Lambda trigger not firing

Check:

```text
partition key design
hot partitions
GSI usage
capacity mode
stream enabled
batch size
retry behavior
```

Avoid large table scans in production paths. Design from access patterns first.

---

## Cost Spike Troubleshooting

Start with:

```text
service breakdown
region breakdown
tag or account breakdown
usage type breakdown
daily trend
```

Common causes:

- NAT Gateway data processing
- Cross-region traffic
- Cross-AZ traffic
- High log volume
- Long log retention
- Idle databases
- Unattached disks
- Old snapshots
- No S3 lifecycle policy

Cost spike triage is operational triage. Treat it like any other production signal.

---

## Final Rule

Be specific when reporting a cloud incident:

```text
DNS failed.
CDN failed.
Load balancer had no healthy targets.
Private networking failed.
IAM denied the workload.
Database capacity was exhausted.
The application regressed.
```

Each statement points to a different owner, dashboard, and mitigation path.
