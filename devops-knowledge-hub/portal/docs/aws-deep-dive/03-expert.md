---
title: "Expert"
sidebar_position: 3
---

# AWS Expert — Platform Engineering and Advanced Architecture

This file covers the advanced AWS knowledge required for staff engineers and senior SREs: advanced networking, multi-account architecture, EKS deep dive, advanced IAM, cost optimization at scale, and disaster recovery strategy. These topics appear at the design and incident command level.

---

## Advanced Networking — Transit Gateway, PrivateLink, Direct Connect

### Transit Gateway

Transit Gateway is a cloud router that connects many VPCs and on-premises networks without full-mesh VPC peering. It is essential at enterprise scale.

Without Transit Gateway:
```text
VPC-A <-> VPC-B
VPC-A <-> VPC-C
VPC-B <-> VPC-C
... N*(N-1)/2 peering connections for N VPCs
```

With Transit Gateway:
```text
VPC-A -> TGW
VPC-B -> TGW
VPC-C -> TGW
VPN/Direct Connect -> TGW
(hub-and-spoke routing — linear complexity)
```

SRE operational concerns with Transit Gateway:
- Route tables on TGW control which attachments can reach which
- Bandwidth scales automatically — no single-point bottleneck for most workloads
- TGW supports multi-account and multi-Region via peering
- Egress routing through TGW: traffic from spoke VPC -> TGW -> inspection VPC (for centralized firewall)

Design decision: use VPC peering for simple two-VPC connectivity. Use Transit Gateway when you have three or more VPCs, or when you need centralized networking policies.

### AWS PrivateLink

PrivateLink creates private connectivity between a service producer (your internal service) and service consumers, without traffic traversing the internet or VPC peering.

How it works:
```text
Consumer VPC
  -> Interface VPC Endpoint (ENI in consumer subnet)
  -> PrivateLink internal network
  -> NLB in producer VPC
  -> Service
```

Use PrivateLink when:
- You want to expose a service to other VPCs/accounts without full peering
- SaaS vendors provide their service through PrivateLink endpoints
- You need multi-tenant service isolation (each consumer has their own endpoint)
- Compliance requires traffic to stay on private networks

PrivateLink supports cross-account and cross-Region (with some constraints). It is the mechanism behind most AWS managed service Interface Endpoints.

### Direct Connect

Dedicated network connectivity from on-premises to AWS. Properties:
- Consistent latency (unlike VPN over internet)
- Higher bandwidth at lower per-GB cost than VPN for large volumes
- Required for latency-sensitive hybrid workloads

Important: Direct Connect is NOT encrypted at the link layer by default. Use MACsec or run a VPN over the Direct Connect link for encryption.

Direct Connect gateway pattern:
```text
On-premises data center
  -> Direct Connect location
  -> Direct Connect gateway
  -> Multiple VPCs across regions
```

High availability for Direct Connect: deploy two connections at two different Direct Connect locations, or use a Site-to-Site VPN as backup. A single Direct Connect connection is still a single physical failure domain.

### VPC Flow Logs

VPC Flow Logs record metadata about IP traffic. They do not capture packet payloads.

Use them for:
- Security group/NACL troubleshooting
- Unexpected egress detection
- NAT cost investigation
- Incident traffic timeline reconstruction

Flow log fields (extended format):
```text
account-id vpc-id subnet-id instance-id
srcaddr dstaddr srcport dstport protocol
packets bytes start end action log-status
```

Query in CloudWatch Logs Insights or Athena over S3.

---

## EKS Deep Dive

### VPC CNI and IP Management

The AWS VPC CNI plugin assigns VPC IPs directly to pods. Each pod gets an IP address from the subnet — visible in the VPC route table.

IP capacity limits:
- Each EC2 instance type has a maximum number of ENIs
- Each ENI supports a maximum number of IP addresses
- Total pod capacity = (max ENIs per instance - 1) * IPs per ENI

For example, `m5.xlarge` supports 4 ENIs × 15 IPs = 58 pod IPs maximum. This affects subnet sizing.

Mitigation strategies:
- **Prefix delegation**: assign /28 blocks to ENIs instead of individual IPs (32× more IPs)
- **IPv6**: pods get IPv6 addresses from a /128 space (no capacity concern)
- **Custom networking**: assign pods to different subnets than nodes

### Karpenter vs Cluster Autoscaler

| Feature | Cluster Autoscaler | Karpenter |
|---|---|---|
| Node selection | Uses pre-defined ASG node groups | Directly creates EC2 instances |
| Speed | Slower — limited by ASG launch behavior | Faster — direct EC2 launch |
| Bin-packing | Limited | Optimized, selects cheapest fit |
| Spot handling | Node group per spot type | Fleet selection with fallback |
| Node consolidation | Limited | Active consolidation (removes underutilized nodes) |

Use Karpenter for new clusters. It reduces cost significantly through aggressive bin-packing and spot instance management.

### EKS Upgrades

Kubernetes releases new minor versions approximately every 4 months. AWS EKS typically supports N-3 versions and provides standard support for 14 months.

Upgrade order:
1. Control plane first (via console or CLI: `aws eks update-cluster-version`)
2. Add-ons second (CoreDNS, VPC CNI, kube-proxy)
3. Node groups last (rolling replacement)

SRE concerns during upgrades:
- Test workloads against new API version deprecations
- Ensure PodDisruptionBudgets are set so rolling node replacement does not cause downtime
- Watch for CoreDNS restart causing brief DNS failures if not configured with `minAvailable: 1`
- Validate add-on compatibility matrix before upgrading

### EKS Access Control

EKS access control has two layers:
1. **Kubernetes RBAC**: ClusterRoles and RoleBindings control what a principal can do inside the cluster
2. **aws-auth ConfigMap** (legacy) or **EKS Access Entries** (recommended): maps IAM principals to Kubernetes groups

Common mistake: adding an IAM role to `aws-auth` but not granting it Kubernetes RBAC permissions. The IAM assume-role succeeds but `kubectl` commands return forbidden errors.

---

## Multi-Account Architecture

### AWS Organizations and OUs

An AWS account is not a folder — it is an isolated security, billing, and quota domain. Production systems require multiple accounts.

Recommended structure:
```text
AWS Organization (Management Account)
├── Security OU
│   ├── Security Tooling Account (GuardDuty master, SecurityHub)
│   └── Log Archive Account (CloudTrail, Config, VPC Flow Logs)
├── Infrastructure OU
│   ├── Shared Network Account (Transit Gateway, DNS)
│   └── Shared Services Account (CI/CD, monitoring)
├── Workload Prod OU
│   ├── Production Account A
│   └── Production Account B
└── Workload Dev OU
    ├── Development Account A
    └── Staging Account A
```

Why multiple accounts matter:
- Production mistakes do not damage experiments
- Billing and cost allocation are clearer per team/product
- Service quotas are separated (no noisy neighbor on EC2 limits)
- IAM policies are simpler to reason about
- CloudTrail and security logs can be centralized in an immutable archive account
- SCPs enforce guardrails at the OU level

### Service Control Policies (SCPs)

SCPs are organization-level guardrails. They define the maximum permissions an account can use — they do not grant permissions by themselves.

Effective permission formula:
```text
Effective permission =
  identity policy
  + resource policy
  + session policy
  + permissions boundary
  WITHIN SCP limits
  (explicit deny always wins)
```

Common SCP guardrails:
```json
// Deny disabling CloudTrail
{ "Effect": "Deny", "Action": "cloudtrail:StopLogging", "Resource": "*" }

// Deny launching resources outside approved regions
{ "Effect": "Deny", "Action": "*", "Resource": "*",
  "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["us-east-1", "eu-west-1"] } } }

// Deny public S3 buckets
{ "Effect": "Deny", "Action": "s3:PutBucketPublicAccessBlock", "Resource": "*",
  "Condition": { "Bool": { "s3:PublicAccessBlockConfiguration/BlockPublicAcls": "false" } } }
```

Production failure mode: a team deploys a valid IAM policy but still gets `AccessDenied`. The policy may be correct inside the account, but an SCP at the OU level denies the action. Junior debugging stops at the role policy. Senior debugging evaluates the full permission chain.

### Control Tower

AWS Control Tower sets up and governs a multi-account landing zone. It automates:
- AWS Organizations and OU structure
- CloudTrail organization trail
- Centralized log archive account
- Security tooling account
- Preventive guardrails (SCPs)
- Detective guardrails (Config Rules via AWS Config Aggregator)
- Account Factory for creating new accounts

Use Control Tower for new organizations. For existing organizations, evaluate whether Control Tower enrollment fits your existing structure.

---

## Advanced IAM

### Permission Boundaries

A permission boundary is an IAM policy attached to a role or user that sets the maximum permissions that identity can have — even if their identity policy allows more.

Use case: you want to allow developers to create IAM roles for their applications, but you do not want those roles to be able to do anything the developer cannot do themselves. The permission boundary constrains delegated role creation.

```json
// Permission boundary for developer-created roles
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject", "s3:PutObject",
    "dynamodb:Query", "dynamodb:PutItem",
    "logs:CreateLogGroup", "logs:PutLogEvents"
  ],
  "Resource": "*"
}
```

Even if the developer grants the role `s3:*`, the boundary limits it to `s3:GetObject` and `s3:PutObject`.

### Session Policies

When assuming a role, you can pass an inline session policy that further restricts permissions for that session. This is useful for:
- Granting least-privilege temporary credentials (e.g., a CI job that can only write to a specific S3 prefix)
- STS `AssumeRoleWithWebIdentity` for short-lived access tokens

### IAM Condition Keys

Condition keys allow fine-grained access control based on request context:

| Condition Key | Example Use |
|---|---|
| `aws:PrincipalOrgID` | Allow only principals from your AWS Organization |
| `aws:SourceVpce` | Require access through a specific VPC endpoint |
| `aws:RequestedRegion` | Restrict actions to specific regions |
| `aws:MultiFactorAuthPresent` | Require MFA for sensitive actions |
| `s3:x-amz-server-side-encryption` | Require specific encryption method |
| `iam:PassedToService` | Control which services a role can be passed to |

### IAM Access Analyzer

IAM Access Analyzer identifies resources that are accessible from outside your AWS account or organization. Run continuously to detect:
- Public S3 buckets
- Cross-account IAM role access
- KMS key access from other accounts
- Lambda function URL public access

Configure Access Analyzer at the organization level so it monitors all accounts.

---

## Cost Optimization Patterns

Cost is a reliability signal. Sudden cost spikes often indicate runaway systems.

### Compute Cost Optimization

| Strategy | Typical Savings |
|---|---|
| Savings Plans (1-year) | ~30–40% off On-Demand |
| Savings Plans (3-year) | ~50–60% off On-Demand |
| Spot instances for stateless workloads | ~60–90% off On-Demand |
| Karpenter with Spot | Automatic fallback, bin-packing |
| Right-sizing via Compute Optimizer | 20–40% for oversized instances |

### Data Transfer Cost Optimization

Hidden cost traps:
- **NAT Gateway data processing**: $0.045/GB for all traffic flowing through NAT
- **Cross-AZ data transfer**: $0.01/GB per direction — significant at scale
- **Internet egress**: $0.09/GB first 10TB (decreases with volume)

Mitigations:
- Gateway VPC Endpoints for S3 and DynamoDB (free — no NAT processing charge)
- Interface VPC Endpoints for other AWS services (hourly + data charge, but often cheaper than NAT)
- Place compute in the same AZ as the data it primarily reads
- Use S3 Transfer Acceleration only when clients are globally distributed

### Storage Cost Optimization

- EBS: use `gp3` (decouples size from IOPS/throughput, cheaper than `gp2` for many workloads)
- Delete unattached EBS volumes and old snapshots
- S3 lifecycle rules to transition to Intelligent-Tiering, Standard-IA, or Glacier
- CloudWatch Logs: set retention policies (1 year for most, 90 days for debug logs)
- Terminate unused Elastic IPs ($0.005/hr each when unattached)

### RDS Cost Optimization

- Use Aurora Serverless v2 for dev/staging environments (scales to zero)
- Reserved Instances for production RDS (1-year saves ~30–40%)
- Right-size RDS with CloudWatch metrics + Performance Insights
- Enable storage autoscaling to avoid manual storage upgrades
- Delete unused read replicas

---

## DR Strategies — RTO and RPO

DR is about recovering from serious failures. HA is about staying available through common failures.

| Term | Meaning |
|---|---|
| RPO | Recovery Point Objective — maximum acceptable data loss |
| RTO | Recovery Time Objective — maximum acceptable downtime |

Example:
```text
RPO 5 minutes = can lose up to 5 minutes of data
RTO 30 minutes = service must be restored within 30 minutes
```

### DR Strategy Comparison

| Strategy | RTO | RPO | Cost | Complexity |
|---|---|---|---|---|
| Backup and Restore | Hours | Hours/Days | Lowest | Low |
| Pilot Light | 10–30 min | Minutes | Low | Medium |
| Warm Standby | Minutes | Seconds–Minutes | Medium | Medium |
| Multi-Region Active-Active | Near-zero | Near-zero | High | High |

**Backup and Restore**: take regular backups, restore from scratch on failure. Only valid if the business can accept hours of downtime.

**Pilot Light**: core infrastructure runs at minimal scale in the DR region. On failover, scale up the pilot light. Good for: critical systems with moderate RTO/RPO.

**Warm Standby**: scaled-down version of production runs continuously in DR region. On failover, scale up and switch traffic. Faster RTO than pilot light.

**Multi-Region Active-Active**: production runs in multiple regions simultaneously. Route 53 distributes traffic. All regions handle writes (requires distributed consistency design). Used by top-tier SLAs.

### The Backup Verification Rule

A backup that has never been restored is only a hope. A DR design that has never been exercised is a diagram, not a capability.

Operationalize this:
- Scheduled restore tests (monthly minimum for production)
- Runbook that documents exact steps and expected timings
- Chaos Game Days for failover scenarios

---

## Well-Architected Framework Pillars

The AWS Well-Architected Framework has six pillars:

| Pillar | SRE Translation |
|---|---|
| Operational Excellence | Deploy, observe, respond, improve. Use IaC, automate runbooks, measure operations. |
| Security | Least privilege, detection, encryption, isolation. Enable GuardDuty, Config, and CloudTrail. |
| Reliability | Design for failure. Multi-AZ, retries, circuit breakers, chaos testing. |
| Performance Efficiency | Use resources efficiently. Right-size, cache, use appropriate DB for access patterns. |
| Cost Optimization | Avoid waste. Tag everything, use Savings Plans, eliminate idle resources. |
| Sustainability | Minimize environmental impact through efficient design. Graviton, Spot, rightsizing. |

Well-Architected Review questions for every production system:
- What is the blast radius if one AZ fails?
- How do we restore data if corrupted?
- What alarms page humans when users are impacted?
- Which IAM principal can delete production data?
- What is the monthly cost driver and is it expected?
- What is the rollback plan for a bad deployment?
- Have we tested AZ loss in the last 90 days?

---

## Service Quotas and Limits

Service quotas are per-account, per-Region limits. Hitting them silently causes failures.

| Service | Common Limits |
|---|---|
| EC2 | vCPU per instance family, EIPs per region |
| VPC | VPCs per region (default 5), subnets per VPC, SGs per ENI |
| Lambda | Concurrent executions (default 1000), reserved concurrency |
| EKS | Clusters per region, nodes per cluster |
| RDS | DB instances per region, option groups |
| IAM | Roles per account (default 5000), policies per role |

SRE practices:
- Request quota increases proactively before they are needed
- Monitor quota usage with CloudWatch Service Quotas metrics
- Set alarms at 70% of quota for critical services
- Use AWS Organizations with delegated quota requests

---

## Expert Summary

At the expert level, you can design systems that survive account-level outages, enforce organization-wide security guardrails, and optimize cost without sacrificing reliability. The mental model is:

```text
Every design decision maps to:
  - which failure domain absorbs this failure?
  - what is the trust boundary?
  - what is the cost of this path?
  - how do we know something went wrong?
  - how do we fix it at 3am?
```

Staff engineers own the answers to these questions before writing a single line of infrastructure code.
