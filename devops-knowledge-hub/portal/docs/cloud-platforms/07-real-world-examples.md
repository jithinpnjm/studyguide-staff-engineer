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

## Staff-Level Summary

Cloud incidents usually cross service boundaries. A database outage may start as a Lambda concurrency issue. A networking incident may appear as an application timeout. A cost spike may reveal poor data locality. Strong SREs debug cloud systems layer by layer and always ask: what changed, what is the blast radius, and which boundary failed?
