---
title: "Expert"
sidebar_position: 3
---

# Cloud Platforms — Expert

Expert cloud engineering is about designing for failure, policy, multi-account boundaries, migration safety, cost control, and operability. At this level, cloud services are not isolated products. They are contracts between teams, platforms, and production systems.

---

## Staff-Level Cloud Design Questions

Before choosing services, clarify:

1. What is the availability target?
2. What is the failure domain: AZ, region, account, cluster, service, dependency?
3. What data cannot be lost?
4. What is the recovery time objective?
5. What is the recovery point objective?
6. Who owns operations after launch?
7. What is the cost ceiling?
8. What security or compliance constraints exist?

Cloud architecture without these constraints is just a service list.

---

## Multi-Account And Landing Zone Design

A production landing zone separates concerns.

```text
organization
  -> security account
  -> logging account
  -> shared-network account
  -> dev workload account
  -> staging workload account
  -> production workload account
```

Why this matters:

- Compromise in dev should not reach production.
- Billing should be attributable.
- Audit logs should be protected from workload admins.
- Network routing should be centrally governed.
- Organization policies should prevent unsafe patterns.

AWS mechanisms:

- AWS Organizations
- Service Control Policies
- IAM Identity Center
- CloudTrail organization trails
- Control Tower landing zone
- AWS Config aggregators

GCP equivalents:

- Organization node
- Folders
- Projects
- IAM conditions
- Organization policies
- Shared VPC
- Cloud Audit Logs

Azure equivalents:

- Management groups
- Subscriptions
- Resource groups
- Azure Policy
- Entra ID
- Activity Logs

---

## Blast Radius Design

A cloud design should answer: what breaks when this component fails?

| Boundary | Example | Why it matters |
|---|---|---|
| Account/project | prod vs dev | Limits credential and policy blast radius |
| Region | eu-central-1 vs us-east-1 | Limits regional outage impact |
| AZ | subnet placement | Handles datacenter-level failure |
| VPC | network segmentation | Controls lateral movement |
| IAM role | workload identity | Limits API damage |
| KMS key | encryption boundary | Limits data access impact |

Staff-level answer: choose boundaries based on business impact, not arbitrary symmetry.

---

## Multi-AZ vs Multi-Region

### Multi-AZ

Multi-AZ is the default for production systems. It handles one Availability Zone failing without requiring global traffic movement.

Use for:

- Normal production web apps
- Regional databases
- Load-balanced services
- EKS/ECS clusters

### Multi-Region

Multi-region is a business continuity design, not a default checkbox. It adds complexity in data replication, deployment coordination, DNS routing, failover testing, and consistency.

Use when:

- Regional outage is unacceptable
- Compliance requires geographic resilience
- Global latency matters
- RTO/RPO justify the complexity

### Active-Active vs Active-Passive

| Pattern | Pros | Cons |
|---|---|---|
| Active-passive | Simpler, cheaper | Failover path must be tested |
| Active-active | Lower latency, higher resilience | Data consistency and routing complexity |

---

## Data Resilience

Data determines whether rollback and failover are real.

For relational systems:

- Use Multi-AZ for regional high availability.
- Use read replicas for read scale, not primary HA by default.
- Use point-in-time restore for operator mistakes.
- Test backups by restoring them.
- Use expand-contract migrations for application rollback.

For object storage:

- Enable versioning for critical buckets.
- Use lifecycle policies intentionally.
- Use cross-region replication only when RPO needs it.
- Protect buckets with block-public-access and least privilege policies.

For globally replicated databases:

- Understand write-region constraints.
- Understand eventual consistency windows.
- Practice regional promotion.

---

## Cloud Network Architecture

Expert network design focuses on routing intent and isolation.

Patterns:

```text
hub-and-spoke with Transit Gateway
shared VPC for centralized networking
private service endpoints for managed APIs
separate ingress and egress inspection paths
```

Key questions:

- Which workloads need internet egress?
- Which services must be private-only?
- Where are inspection, NAT, and firewall controls placed?
- How do teams request new connectivity?
- How is flow logging retained and queried?

Common mistakes:

- One giant flat VPC
- Shared security groups across unrelated apps
- Overlapping CIDR ranges
- No flow logs
- Public access for operational convenience

---

## Identity Architecture For Workloads

Workloads should receive identity from the platform rather than carrying static secrets.

Patterns:

- IAM roles for EC2 instance profiles
- IRSA for EKS service accounts
- GCP Workload Identity
- Azure Managed Identity
- OIDC federation from CI/CD systems

Benefits:

- No long-lived cloud keys in code
- Better audit trail
- Easier rotation
- Least privilege per workload
- Reduced blast radius

Expert design separates identities by service, environment, and function. A metrics exporter should not use the same role as a production deployer.

---

## Cost Architecture

Cost optimization is not “turn things off later.” It is architecture.

| Cost lever | Example |
|---|---|
| Right-sizing | Resize EC2 and database instances by utilization |
| Commitment discounts | Savings Plans for stable baseline |
| Elasticity | Auto Scaling and serverless for variable load |
| Storage lifecycle | S3 IA/Glacier policies |
| Spot usage | Batch and stateless workers |
| Data transfer awareness | Avoid unnecessary cross-AZ and cross-region traffic |
| Observability retention | Route high-volume logs carefully |

Staff-level framing: cost efficiency must not silently reduce reliability. For example, one NAT Gateway is cheaper than three, but it creates an AZ dependency.

---

## Security Baseline

Minimum production baseline:

- MFA or SSO for humans
- Root/admin identity locked down
- No public buckets
- Central audit logging
- Flow logs for key VPCs
- GuardDuty or equivalent threat detection
- Config or policy monitoring
- Encryption at rest and in transit
- Patch automation for VM fleets
- Least privilege for workloads

Strong teams define this as platform default, not team-by-team memory.

---

## Platform Golden Paths

A cloud platform should provide opinionated defaults.

Examples:

- Standard VPC module
- Standard EKS/GKE/AKS cluster module
- Standard RDS module with backups and monitoring
- Standard service template with logging, metrics, alerts
- Standard CI/CD and GitOps promotion path
- Standard tagging and cost allocation

Golden paths reduce cognitive load. Escape hatches should exist, but teams that deviate own the extra operational burden.

---

## Cloud Failure Modes

### Regional Service Degradation

Response:

- Confirm provider health and local symptoms.
- Identify affected services and dependencies.
- Use prepared failover path if RTO requires it.
- Avoid improvised cross-region recovery under pressure.

### IAM Policy Misconfiguration

Symptoms:

- Deployments fail suddenly.
- Apps cannot access cloud APIs.
- Only one environment affected.

Check recent IAM, organization policy, role trust, and service account changes.

### NAT Or Egress Failure

Symptoms:

- Private workloads cannot reach external APIs.
- Package installs fail.
- Webhooks fail.

Check route tables, NAT health, firewall rules, DNS, and VPC endpoints.

### Database Connection Storm

Symptoms:

- DB CPU and connection count spike.
- App errors increase.
- Lambda or autoscaling events correlate.

Mitigation can include connection pooling, RDS Proxy, rate limiting, or scaling read paths.

---

## Expert Takeaways

1. Cloud design is blast-radius design.
2. Multi-account/project structure is a security and reliability boundary.
3. Multi-region is expensive operational complexity and must be justified.
4. Workload identity is safer than static keys.
5. Cost controls must preserve reliability intent.
6. Golden paths make secure defaults easy.
7. Data recovery must be tested, not assumed.
8. Architecture is incomplete without observability and rollback paths.
