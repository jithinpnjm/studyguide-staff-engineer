---
title: "Real-World Examples"
sidebar_position: 7
---

# Cloud Platforms — Real-World Examples

These examples connect AWS/GCP/Azure service knowledge with SRE-style production reasoning: blast radius, failure domains, cost, access, recovery, and ownership.

---

## Example 1: Public S3 Bucket Exposure

### Scenario

A team uploads application exports to an S3 bucket. A security scan later reports that some objects are publicly readable.

### What Went Wrong

The team treated object storage like a normal internal filesystem. Bucket policy, object ACLs, and public access settings were not reviewed together.

### Strong Response

```text
1. Block public access at bucket/account level.
2. Identify exposed object paths.
3. Rotate any data that may be sensitive.
4. Review access logs or CloudTrail data events if enabled.
5. Replace public access with CloudFront signed URLs or controlled application access.
6. Add policy guardrails to prevent recurrence.
```

### Prevention

- Enable S3 Block Public Access by default.
- Use bucket policies intentionally.
- Avoid object ACLs unless required.
- Add automated checks in CI or cloud policy tools.
- Use separate buckets for public static assets and private exports.

---

## Example 2: NAT Gateway Becomes A Single-AZ Dependency

### Scenario

A cost optimization change reduces NAT Gateways from one per AZ to one shared NAT Gateway. Later, one AZ has a networking issue and private workloads in another AZ lose outbound access.

### Root Cause

The cheaper design introduced a hidden dependency on one AZ.

### SRE Lesson

Cost optimization must preserve the intended failure model. A single NAT Gateway can be acceptable for dev, but production may require one NAT Gateway per AZ.

### Better Production Design

```text
private subnet in AZ-a -> NAT Gateway in AZ-a
private subnet in AZ-b -> NAT Gateway in AZ-b
private subnet in AZ-c -> NAT Gateway in AZ-c
```

---

## Example 3: RDS Connection Storm From Lambda

### Scenario

A new Lambda consumer is connected directly to PostgreSQL. During a traffic spike, thousands of concurrent invocations open database connections and the database becomes unhealthy.

### What Went Wrong

The application scaled faster than the database connection budget.

### Mitigation

- Add RDS Proxy or connection pooling.
- Cap Lambda concurrency.
- Use SQS to smooth bursts.
- Move heavy work to a worker service if needed.

### Prevention

Design serverless systems with downstream limits in mind. Serverless compute can scale very quickly; databases often cannot.

---

## Example 4: Multi-AZ App But Single-AZ Database

### Scenario

The application runs across three AZs behind an ALB. The database runs in a single AZ. An AZ incident brings down the whole application.

### Root Cause

The stateless layer was highly available, but the stateful layer was not.

### Fix

Use Multi-AZ for production relational databases and test failover behavior.

### SRE Lesson

A system is only as resilient as the weakest critical dependency.

---

## Example 5: Over-Broad Cloud Role Used By CI

### Scenario

A CI pipeline role can modify networking, databases, compute, and IAM across the production account. A pipeline bug changes resources outside the intended application.

### What Went Wrong

The deployment identity had broad permissions and no clear environment boundary.

### Better Design

- Separate build identity from deployment identity.
- Scope deployment identity to one environment and application path.
- Require approvals for production changes.
- Audit all production changes.
- Use infrastructure modules with controlled inputs.

### SRE Lesson

Automation should be powerful enough to do the intended job and too limited to do unrelated damage.

---

## Example 6: CloudFront Cache Hides A Bad Origin Release

### Scenario

A new frontend release breaks some pages. Users behind CloudFront report inconsistent behavior because some objects are cached and some are fetched from origin.

### Investigation

Check:

- CloudFront cache behavior
- Object versioning strategy
- Invalidation history
- Origin response headers
- Browser cache headers

### Better Release Pattern

Use versioned asset filenames and immutable cache headers for static assets. Update only the HTML entry point to reference the new versioned assets.

---

## Example 7: DynamoDB Hot Partition

### Scenario

A DynamoDB table uses `status` as partition key. Most writes use `status=ACTIVE`, causing throttling even though total table capacity looks sufficient.

### Root Cause

The partition key has low cardinality and creates a hot partition.

### Better Design

Choose a high-cardinality partition key aligned with access patterns. Use GSIs carefully and avoid keys where most traffic lands on one value.

### SRE Lesson

NoSQL performance problems are often data-model problems, not simply capacity problems.

---

## Example 8: Cross-Region Data Transfer Surprise

### Scenario

Monthly cost increases sharply. Investigation shows services in one region repeatedly reading data from another region.

### What Went Wrong

The architecture ignored data locality and cross-region transfer pricing.

### Fix

- Move dependent workloads closer to data.
- Cache frequently accessed data locally.
- Replicate intentionally when RPO/RTO requires it.
- Add cost dashboards by region and service.

---

## Example 9: Backup Exists But Restore Fails

### Scenario

A team proudly says RDS backups are enabled. During a restore test, the restored DB cannot serve the application because parameter groups, subnet groups, secrets, and app configuration are missing.

### Root Cause

Backup was configured, but restore workflow was not tested end-to-end.

### Better Practice

A recovery drill should validate:

- Backup restore
- Network reachability
- Credentials or workload identity
- Application connection strings
- Schema compatibility
- Monitoring and alerting on restored service

### SRE Lesson

A backup is a file. Recovery is a working system.

---

## Example 10: Cloud Cost Grows Faster Than Traffic

### Scenario

Traffic grows 20%, but cloud cost grows 80%.

### Likely Causes

- Excessive log volume or retention
- Cross-AZ or cross-region traffic
- Idle databases
- Overprovisioned compute
- Missing storage lifecycle policies
- NAT Gateway processing growth
- Unused load balancers

### Response

Create a service-level cost breakdown and assign owners. Cost without ownership becomes background radiation.

### SRE Lesson

Cost is an operational signal. Sudden cost change often reveals architecture behavior that was previously invisible.

---

## Case Study: Migrating A Monolith To AWS With Zero Downtime

### Scenario

A 500k-user e-commerce platform (monolith running on bare-metal VMs) migrated to AWS without downtime over 8 weeks.

### Strategy: Blue/Green With Weighted ALB Target Groups

```text
Week 1-2: Infrastructure setup
  - Create VPC with 3 AZs
  - Set up ALB with two target groups: tg-legacy (old), tg-new (AWS)
  - Begin DNS with 100% traffic to tg-legacy

Week 3-4: First traffic split
  - Deploy app on ECS Fargate (stateless)
  - RDS replica seeded from legacy DB export
  - Route 53 weighted record: 95% legacy / 5% AWS
  - Monitor error rate, p99 latency per target group

Week 5-6: Majority cut-over
  - Weighted record: 50% legacy / 50% AWS
  - RDS Proxy added for connection management
  - Session store migrated to ElastiCache (Redis)

Week 7: Final cut-over
  - Weighted record: 0% legacy / 100% AWS
  - Legacy remains in warm standby for 72 hours
  - DNS TTL reduced to 60 seconds before cut-over for fast rollback

Week 8: Decommission
  - Legacy removed after 72-hour soak period
```

Key technical decisions:
- ALB weighted target groups allow traffic split without DNS TTL delays
- RDS Proxy absorbed connection storms during ASG scaling events
- CloudWatch alarms monitored `TargetResponseTime` and `HTTPCode_Target_5XX_Count` per target group separately — easy rollback trigger

Rollback procedure: reduce weighted routing to 0% for new target group. DNS-free, takes effect within seconds.

---

## Case Study: AWS Cost Reduction Project

### Starting Point

Monthly AWS bill: $285,000. Traffic had grown 40% over 12 months but cost had grown 85%.

### Investigation (First 2 Weeks)

```bash
# Cost by service
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-05-01 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE | \
  jq '.ResultsByTime[0].Groups | sort_by(.Metrics.UnblendedCost.Amount | tonumber) | reverse | .[:5]'

# Top findings:
# EC2: $98,000 (34%)  <- instances oversized by 2x from initial load estimate
# RDS: $52,000 (18%)  <- 3 large Aurora clusters, one completely idle (dev migrated to cloud years ago)
# NAT Gateway: $41,000 (14%) <- ECR image pulls and CloudWatch logs going through NAT
# CloudWatch: $28,000 (10%) <- 400+ log groups with 30-day retention, high ingestion
# Unattached EBS: $11,000 (4%) <- 200+ volumes from stopped/terminated instances
```

### Remediation Actions And Results

| Action | Before | After | Saving |
|---|---|---|---|
| EC2 right-sizing (Compute Optimizer) | m5.4xlarge x 40 | m6i.2xlarge x 40 | $28,000/mo |
| EC2 Compute Savings Plan (1yr) | All On-Demand | 60% covered by plan | $18,000/mo |
| ECS Spot for batch workers | On-Demand ECS | 70% Spot mix | $8,000/mo |
| Delete idle Aurora cluster | 3 clusters | 2 clusters | $18,000/mo |
| VPC endpoints for ECR, S3, CloudWatch | NAT path | Private path | $31,000/mo |
| CloudWatch log retention: 30d -> 7d | 30 days | 7 days + S3 export | $16,000/mo |
| Delete unattached EBS volumes | 200 volumes | 0 | $11,000/mo |
| S3 lifecycle policies added | No lifecycle | 30d/90d/Glacier | $4,000/mo |
| **Total** | **$285,000/mo** | **$151,000/mo** | **$134,000/mo (47% reduction)** |

Key lesson: the biggest single saving ($31,000/mo) came from VPC endpoints for ECR and CloudWatch — private subnets were pulling container images and sending logs through NAT Gateway. Adding gateway endpoints for S3 and interface endpoints for ECR and CloudWatch Logs eliminated this cost with zero reliability impact.

---

## Case Study: Multi-Region Failover Drill

### Target

Production system: Route 53 failover routing, RDS primary in us-east-1, read replica promoted in eu-west-1 for DR.

Stated RTO: 15 minutes. Stated RPO: 5 minutes.

### What Happened During Drill

```text
14:00: Drill initiated. us-east-1 primary RDS stopped (simulating failure).
14:02: CloudWatch alarm fires: RDS connection failures detected.
14:04: On-call engineer acknowledged.
14:06: Engineer begins promoting eu-west-1 read replica.
         -> Found: runbook had not been updated since last Aurora upgrade.
         -> Promotion command syntax had changed in AWS CLI.
         -> Engineer had to look up correct command.
14:12: Read replica promotion completed (6 minutes; target was 2 minutes).
14:15: App config updated to point at eu-west-1 endpoint.
         -> Found: app config was hardcoded in 3 ECS task definitions, not in Secrets Manager.
         -> Had to redeploy 3 task definitions manually.
14:24: Traffic fully routed to eu-west-1.
         -> Actual RTO: 24 minutes (vs 15-minute target).
14:28: Route 53 health check configuration found to be pointing at wrong endpoint.
         -> Automatic failover would NOT have triggered correctly without manual intervention.
```

### What The Drill Proved

1. Actual RTO was 24 minutes, not 15 — a 60% miss
2. Automatic Route 53 failover would have failed (wrong health check target)
3. Hardcoded RDS endpoints in task definitions created friction
4. Runbook was stale — not tested since major Aurora version upgrade

### Remediations

- Database endpoints moved to Secrets Manager with automatic rotation
- ECS task definitions use `{{resolve:secretsmanager}}` for DB endpoint
- Route 53 health check validated against RDS proxy endpoint, not instance endpoint
- DR drill scheduled quarterly with automatic runbook validation script

Lesson: "We have DR" and "DR works in a timed drill" are two very different statements.

---

## Case Study: Security Hub Finding to SCP Enforcement Chain

### Trigger

AWS Security Hub finding: `S3.1 — S3 Block Public Access setting should be enabled`.

Finding appeared for 12 buckets across 3 production accounts. One of the buckets was actively serving sensitive data publicly (an engineer had turned off Block Public Access to "quickly share a file" and never re-enabled it).

### Response Chain

```text
Step 1: Incident declared (Severity: High)
  - Identify exposed bucket and data
  - Immediately enable Block Public Access on all 12 buckets
  - Review CloudTrail: who disabled Block Public Access and when

Step 2: Scope
  aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=EventName,AttributeValue=PutBucketPublicAccessBlock

  Found: 4 different engineers across 3 accounts had disabled it in the last 90 days.

Step 3: Short-term fix
  - Enable AWS Config rule: s3-bucket-public-access-prohibited
  - Config rule set to auto-remediate via Lambda function

Step 4: Medium-term enforcement
  - Deploy SCP to deny s3:PutBucketPublicAccessBlock if value is False
  - Applied to all production and staging OUs

Step 5: Validation
  - Test: attempt to disable Block Public Access in staging -> SCP denies action
  - Confirm: Config rule shows all buckets compliant

Step 6: Permanent control
  - Security Hub findings reviewed weekly by security engineering
  - SCP prevents future violations without human intervention
  - Post-incident review: added IAM condition requiring MFA for S3 ACL changes
```

---

## Case Study: GCP To AWS Crossover (From Lab 3)

### What Maps Cleanly

- Cloud SQL Multi-AZ = RDS Multi-AZ (both synchronous standby, automatic failover)
- Pub/Sub = SNS + SQS (SNS for fanout, SQS for per-consumer queue with DLQ)
- Secret Manager = AWS Secrets Manager (both support rotation; similar pricing)
- Cloud Build = CodeBuild (both pipeline-as-code with container builds)

### What Does Not Map Cleanly

| GCP Concept | AWS Reality | Risk If Ignored |
|---|---|---|
| GCP VPC is global (one VPC, many regions) | AWS VPC is regional | "Same VPC" across regions is impossible in AWS; need TGW or peering |
| GCP firewall rules are tag/SA-based | AWS uses ENI-attached Security Groups | GCP tag habits lead to confusing SG models in AWS |
| External HTTPS LB is global anycast | ALB is regional | Need Route 53 latency routing + ALB per region for global users |
| Workload Identity: GKE metadata server | IRSA: OIDC projected token | Different setup, same principle; trust policy condition is easy to misconfigure |
| Pub/Sub: one service for queue + fanout | SNS (fanout) + SQS (queue) separate | GCP engineers forget to add SNS in front of SQS for fan-out patterns |

### The One Dangerous Assumption

GCP engineers often assume VPC is global and configure one VPC/subnet for multi-region services. In AWS, you have a separate VPC per region. Resources in us-east-1 and eu-west-1 cannot communicate by default — they need VPC peering, Transit Gateway, or explicit networking setup.

---

## Staff-Level Design: Low-Latency Multi-Region Control Plane (From Lab 4)

### Problem

Internal configuration service used by compute workloads on both GCP and AWS. Requirements: p99 < 10ms read latency from within either cloud, correctness over throughput, fail-closed for security policy reads.

### Why 10ms Forces Local Caches

```text
Cross-cloud network round-trip (us-east-1 to us-central1): ~25ms
A single cross-cloud read already exceeds the 10ms p99 budget.
Every request must be served from a local cache or local read replica.
```

### Architecture

```text
Write path (low frequency):
  Operator -> Control-plane API (GCP primary, us-central1)
    -> Cloud Spanner (globally consistent write)
    -> Async bridge -> DynamoDB Global Tables (us-east-1)
    -> Push invalidation to Redis/ElastiCache in each region

Read path (GCP workload, high frequency):
  EKS/GKE pod -> local ElastiCache/Memorystore (cache hit: ~0.5ms)
    -> cache miss: local read replica (Spanner regional read or DynamoDB local)
    -> Cross-cloud only for write synchronization, not reads

Read path (AWS workload):
  EKS pod -> local ElastiCache (cache hit: ~0.5ms)
    -> cache miss: DynamoDB local read (~5ms, consistent from local region)
```

### Latency Budget

| Consumer | Request type | Total p99 |
|---|---|---|
| GCP pod, cache hit | Memorystore read | ~0.5ms |
| GCP pod, cache miss | Spanner read (regional) | ~7ms |
| AWS pod, cache hit | ElastiCache read | ~0.5ms |
| AWS pod, cache miss | DynamoDB local read | ~5ms |
| Any pod, cross-cloud (only writes) | Cross-cloud path | ~30ms (not on read hot path) |

### Failure Handling

| Failure | Behavior | Rationale |
|---|---|---|
| Single AZ in GCP | Automatic AZ failover; reads continue from other AZs | Spanner handles this natively |
| GCP primary region unavailable | Serve from local Redis cache (stale by up to 60s) or fail-closed | Stale policy is acceptable for config; fail-closed for security policy |
| Inter-cloud network partition | AWS reads from DynamoDB (last synced data); GCP reads from Spanner | Partitions are independent; neither side blocks |
| Spanner write path unavailable | Queue writes; fail-closed for security policy reads | Correctness prioritized over availability for security |

### Rollout Blast Radius Warning

A bad control-plane deploy affects ALL consumers simultaneously even with canary traffic routing — because consumers keep reading from the control plane after the deploy. Staged rollout must include:
1. Schema-level backwards compatibility verification
2. Region-by-region deploy with 15-minute soak per region
3. Automatic rollback trigger: any consumer reporting p99 > 15ms after deploy

---

## Production Incident: NAT Gateway Port Exhaustion

### Scenario

A high-traffic platform with hundreds of pods in private subnets started seeing intermittent connection failures to external APIs at peak load. The errors looked like TCP connection timeouts.

### Root Cause: SNAT Port Exhaustion

NAT Gateway performs Source Network Address Translation (SNAT). For each outbound connection, it allocates a port on its public IP. A single NAT Gateway has a limit of ~55,000 simultaneous connections to the same destination IP and port combination.

```text
Symptom: connection timeout to external-api.com:443 from ~30% of pods at 14:00 UTC
Evidence: VPC Flow Logs showing REJECT for established sessions to the same dest IP
Cause: 400 pods each maintaining ~150 long-lived connections to the same API endpoint
  = 60,000 connections to one (dest-ip:port) -> exceeds NAT GW port limit
```

### Diagnosis Commands

```bash
# Check VPC Flow Logs for REJECT on established connections
# In CloudWatch Logs Insights:
# fields srcAddr, dstAddr, dstPort, action
# | filter action = "REJECT" and dstPort = 443
# | stats count(*) as blocked by dstAddr
# | sort blocked desc

# Check NAT Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/NatGateway \
  --metric-name ErrorPortAllocation \
  --dimensions Name=NatGatewayId,Value=nat-0abc123 \
  --start-time 2026-05-17T13:00:00Z \
  --end-time 2026-05-17T15:00:00Z \
  --period 60 \
  --statistics Sum
```

### Fixes

1. Immediate: reduce persistent connection pool size in pods (80 -> 20 connections per pod)
2. Medium-term: deploy a second NAT Gateway and split pod subnets between them (doubles the port capacity)
3. Long-term: use VPC endpoints where available; for external APIs, use an HTTP proxy tier (pods connect to proxy, proxy multiplexes connections with smarter pooling)

---

## Production Incident: IAM Permission Boundary Blocked Deployments

### Scenario

A platform team added IAM permission boundaries to all deployment roles to enforce least privilege. Deployments worked in staging but failed in production with `AccessDenied`.

### Investigation

```bash
# Identify the failing API call
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=UpdateFunctionCode \
  --query 'Events[*].{Time:EventTime,Error:CloudTrailEvent}' \
  --max-results 5 | \
  jq '.[0].Error | fromjson | .errorCode, .errorMessage'

# Output:
# "AccessDenied"
# "User: arn:aws:sts::123:assumed-role/deployer-role/session
#  is not authorized to perform: lambda:UpdateFunctionCode
#  with an explicit deny in a permissions boundary"

# Check the permission boundary on the deployer role
aws iam get-role --role-name deployer-role | \
  jq '.Role.PermissionsBoundary'
```

### Root Cause

The permission boundary attached to `deployer-role` was created from the staging policy, which allowed Lambda actions only in `eu-central-1`. The production deployment was in `us-east-1`. The permission boundary had a region condition that blocked cross-region Lambda updates.

```json
{
  "Effect": "Allow",
  "Action": "lambda:*",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "aws:RequestedRegion": "eu-central-1"
    }
  }
}
```

### Fix

Update the permission boundary to include all approved deployment regions:

```json
{
  "StringEquals": {
    "aws:RequestedRegion": ["eu-central-1", "us-east-1"]
  }
}
```

### Lesson

Permission boundaries are evaluated in addition to identity policies. An identity policy allowing an action does not help if the permission boundary does not also allow it. Always test IAM changes in an environment that mirrors production's region and account structure.

The correct debugging method: `aws iam simulate-principal-policy` will not show permission boundary denials directly; you must use CloudTrail error context which includes `explicit deny in a permissions boundary`.

---

## Staff-Level Summary

Cloud incidents usually cross service boundaries. A database outage may start as a Lambda concurrency issue. A networking incident may appear as an application timeout. A cost spike may reveal poor data locality. Strong SREs debug cloud systems layer by layer and always ask: what changed, what is the blast radius, and which boundary failed?

The three questions that catch most cloud issues:
1. Did IAM change? (CloudTrail for who changed what)
2. Did networking change? (Security group, route table, NACL, endpoint policy)
3. Did the application change? (Deploy markers in CloudWatch, pod restarts in EKS)

Every design decision is a failure domain decision. Choose boundaries based on business impact, not arbitrary symmetry.
