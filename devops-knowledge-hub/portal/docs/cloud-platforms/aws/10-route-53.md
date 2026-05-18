---
title: "Route 53"
sidebar_position: 10
---

# Route 53

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Route 53 exists because DNS is the first dependency in most user journeys. It maps human names to infrastructure endpoints and can apply routing logic. The PDF covers records, hosted zones, TTL, CNAME vs Alias, routing policies, health checks, resolvers, and hybrid DNS.

The operational lesson is that DNS is cached and indirect. A low TTL can help changes propagate faster, but recursive resolvers and client behavior still matter. DNS failover is useful, but it is not instantaneous and should not be confused with load balancer health checking.

Routing policies should be explained by intent:

- Simple: one normal answer.
- Weighted: controlled traffic split or canary.
- Latency: send users to lower-latency Region.
- Failover: active-passive DR.
- Geolocation/geoproximity: location-aware routing.
- Multivalue: return multiple healthy records.
- IP-based: route based on source CIDR.

Failure modes:

- wrong hosted zone updated
- CNAME used at zone apex where Alias is needed
- TTL delays recovery
- health check checks the wrong thing
- private hosted zone associated with wrong VPC
- hybrid DNS resolver rules missing

AWS docs:

- Route 53 routing policies: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html

---

## Record Types Reference

| Record | Purpose | AWS Notes |
|---|---|---|
| A | Map name to IPv4 address | Use Alias A for AWS resources (ALB, CloudFront, S3 website) |
| AAAA | Map name to IPv6 address | Use Alias AAAA for IPv6-capable AWS resources |
| CNAME | Map name to another name | Cannot be used at zone apex (root domain) |
| Alias | AWS extension: maps to AWS resource DNS | Free queries; works at apex; health-check aware |
| MX | Mail server | Standard email routing |
| TXT | Text records | SPF, DKIM, domain verification |
| NS | Name server | Do not change without understanding delegation |

**Alias vs CNAME:** Use Alias for AWS resources (ALB, CloudFront, API Gateway, S3 website). Alias records are free, work at the zone apex, and update automatically when the AWS resource's IP changes. CNAME cannot be at the root domain (`example.com`) — it must be on a subdomain.

## Routing Policies: Decision Table

| Policy | Use Case | Health Check Support |
|---|---|---|
| Simple | Single answer; no routing logic needed | No |
| Weighted | Traffic split; canary deploy; A/B testing | Optional |
| Latency | Route to lowest-latency AWS Region for the user | Yes |
| Failover | Active-passive DR between primary and standby | Required |
| Geolocation | Route by country/continent (compliance, localization) | Yes |
| Geoproximity | Location + bias adjustment | Yes |
| Multi-value answer | Return up to 8 healthy records randomly | Yes |
| IP-based | Route by source CIDR (ISP routing, known IPs) | No |

## Health Checks

Route 53 health checks can monitor HTTP/HTTPS endpoints, TCP, and other Route 53 records (calculated health checks).

```text
Health check types:
  Endpoint check: HTTP/HTTPS GET to target URL; expects 2xx/3xx response
  Calculated: combine multiple checks with AND/OR logic
  CloudWatch alarm: use existing metric alarm as DR signal
```

**Important operational limits:**
- Health check polling interval: 30 seconds (standard) or 10 seconds (fast, higher cost)
- DNS failover is limited by TTL: even with a healthy standby, clients may cache the bad answer for TTL seconds
- Global health checkers: Route 53 sends health probes from multiple AWS Regions — firewall rules must not block AWS health checker IPs

## CLI: Common DNS Operations

```bash
# Create a hosted zone
aws route53 create-hosted-zone \
  --name example.com \
  --caller-reference $(date +%s)

# List hosted zones
aws route53 list-hosted-zones

# Create/update a record (A record example)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "my-alb-123456.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Check health check status
aws route53 get-health-check-status --health-check-id abc12345-1234-1234-1234-abcdef123456

# Test DNS resolution (from your machine)
dig api.example.com +short
nslookup api.example.com
```

## Hybrid DNS: Private Hosted Zones

```text
Private hosted zone:
  - Resolvable only within associated VPCs
  - Associate with VPC in same account or cross-account
  - Use for: internal service discovery, VPC-internal endpoints

Resolver endpoints (hybrid):
  Inbound endpoint:  on-premises DNS can resolve Route 53 private zones
  Outbound endpoint: VPC resources can resolve on-premises DNS names via forwarding rules
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| CNAME at zone apex fails | Root domain (`example.com`) cannot use CNAME | Use Alias record instead |
| TTL delays failover | Long TTL on active-passive failover record | Reduce TTL before maintenance windows; health check TTL is always 60s |
| Private zone not resolving in VPC | VPC not associated with private hosted zone | Associate VPC with hosted zone |
| Health check failing but service is healthy | AWS health checker IPs blocked by WAF/firewall | Allowlist Route 53 health checker IP ranges |
| Weighted routing not splitting traffic as expected | One record has weight 0 or health check failing | Check individual record weights and health check status |

## Interview Q&A

**Q: What is the difference between a CNAME and an Alias record?**
A: CNAME maps one DNS name to another DNS name and cannot be used at the zone apex. An Alias is an AWS Route 53 extension that maps a name directly to an AWS resource (ALB, CloudFront, S3 website, API Gateway). Alias records work at the zone apex, have no additional query cost, automatically reflect IP changes of the target resource, and can optionally evaluate target health.

**Q: How does Route 53 DNS failover work and what are its limitations?**
A: Route 53 failover routing has a primary and secondary record. Health checks monitor the primary. When the primary health check fails, Route 53 returns the secondary record. Limitations: DNS clients cache the previous answer for up to TTL seconds, meaning failover is not instant. Clients that ignore TTL or use stale DNS continue hitting the failed endpoint until the cache expires or is cleared.

**Q: How would you route users to the lowest-latency Region?**
A: Use latency routing policy. Create records in each Region with the same DNS name but set `Region` to the target Region. Route 53 measures latency from the user's resolver to each AWS Region and returns the record for the lowest-latency Region. Health checks should be attached so a degraded Region is removed from routing automatically.
