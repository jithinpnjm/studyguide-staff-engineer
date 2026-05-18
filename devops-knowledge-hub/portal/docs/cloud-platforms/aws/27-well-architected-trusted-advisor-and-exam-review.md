---
title: "Well-Architected, Trusted Advisor, And Exam Review"
sidebar_position: 27
---

# Well-Architected, Trusted Advisor, And Exam Review

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF ends with Well-Architected and review advice. For senior interviews, Well-Architected is not a checklist to recite. It is a way to reason about tradeoffs.

Use the six pillars as review questions:

- Operational Excellence: can we deploy, observe, and respond safely?
- Security: who can do what, how is data protected, how do we detect abuse?
- Reliability: what fails, how do we recover, what is tested?
- Performance Efficiency: are resources matched to workload needs?
- Cost Optimization: are we paying for idle, inefficient, or accidental usage?
- Sustainability: are we using resources efficiently over time?

Senior closing answer:

```text
For any AWS design, I explain the request path, trust boundaries, failure domains,
data durability, observability signals, scaling controls, cost drivers, and recovery
plan. That is stronger than naming services from a diagram.
```

---

## Well-Architected Six Pillars: SRE Translation

| Pillar | Core SRE Question | Key Practices |
|---|---|---|
| Operational Excellence | Can we deploy, observe, and respond safely? | IaC, runbooks, alarms on user impact, blameless post-mortems |
| Security | Who can do what? How is data protected? | Least-privilege IAM, encryption at rest/transit, GuardDuty, audit trails |
| Reliability | What fails? How do we recover? Is it tested? | Multi-AZ, Multi-Region DR, tested backups, AZ evacuation drills |
| Performance Efficiency | Are resources matched to workload? | Right-size instances, correct scaling metrics, caching, profiling |
| Cost Optimization | Are we paying for waste? | Tag-based ownership, Savings Plans, lifecycle policies, Compute Optimizer |
| Sustainability | Are we efficient over time? | Reduce waste, use managed services, rightsize, prefer serverless where appropriate |

## Design Review Questions (Use These in Every Review)

```text
Identity and access:
  - Which IAM principal can delete production data?
  - Which role is used at runtime? Is it least-privilege?
  - Are there long-lived access keys anywhere?

Network and blast radius:
  - What is the blast radius if this component fails?
  - What fails if one AZ goes down?
  - Can private subnets reach the internet? Should they?

Data durability and recovery:
  - How is data backed up? How often?
  - Has the backup ever been restored? What is actual RTO?
  - What is RPO if the primary database fails right now?

Observability:
  - Which metrics would page humans during a user-facing outage?
  - Which log would explain the cause?
  - How do we know when a deployment goes wrong?

Cost:
  - What are the top 3 cost drivers?
  - Is there idle or over-provisioned capacity?
  - What would happen to cost if traffic 10x'd?

Deployment safety:
  - What is the rollback plan?
  - Can we deploy without downtime?
  - Does a bad deploy affect all users or a canary subset?
```

## Trusted Advisor: Key Checks

Trusted Advisor provides automated best-practice checks across cost, security, performance, and fault tolerance.

| Category | Important Checks |
|---|---|
| Security | MFA on root account, public S3 buckets, exposed access keys, open SG ports (0.0.0.0/0 on 22/3389) |
| Fault Tolerance | RDS Multi-AZ, EC2 in single AZ, EBS snapshots |
| Cost Optimization | Idle EC2, unattached EIPs, underutilized RDS, unused Elastic Load Balancers |
| Performance | CloudFront cache hit ratio, EBS throughput bottlenecks |
| Service Limits | Approaching limits for EC2, VPC, IAM, ELB |

Business/Enterprise Support required for full Trusted Advisor checks. Developer Support gives only security and service limits.

## SRE Incident Playbooks (Summary)

### AccessDenied After Deployment
```bash
aws sts get-caller-identity          # confirm runtime principal
aws cloudtrail lookup-events \       # find the exact denied API call
  --lookup-attributes AttributeKey=EventName,AttributeValue=<ApiName>
# Then check: identity policy, resource policy, KMS policy, SCP, permissions boundary, conditions
```

### Service Unreachable
```text
1. DNS resolves to correct IP/endpoint
2. Client can reach load balancer (security group, port)
3. ALB listener and rule match
4. Target group has healthy targets (check reason code)
5. App security group allows from ALB SG
6. NACL allows request and return (ephemeral ports)
7. Route table has correct next hop
8. App listening on expected port
9. App logs show requests arriving
```

### One AZ Failure
```text
Check: ALB enabled AZs, ASG subnet distribution, target health per AZ,
       RDS/Aurora failover state, NAT Gateway per AZ, EBS attachment AZ
Fix:   per-AZ NAT GW, DB Multi-AZ, ASG across AZs, remove zonal hardcoding
```

### NAT Cost Spike
```text
Check: VPC Flow Logs for top talkers, private workloads pulling from S3/ECR through NAT
Fix:   Gateway VPC endpoint for S3/DynamoDB, interface endpoints for ECR/SSM/CloudWatch Logs
```

## Interview Q&A

**Q: Walk me through the Well-Architected Framework pillars and give an example for each.**
A: Operational Excellence: use IaC (CloudFormation/Terraform), alarm on 5xx error rates not just CPU, have runbooks that link from alarms. Security: all workloads use IAM roles not access keys, data encrypted at rest with KMS, GuardDuty enabled in all accounts, CloudTrail sending to a centralized log archive. Reliability: app deployed across 3 AZs behind ALB, RDS Multi-AZ, DR tested quarterly. Performance Efficiency: right-size instances using CloudWatch metrics and Compute Optimizer, not guessing. Cost Optimization: Savings Plans for baseline, lifecycle policies on S3 and EBS snapshots, tag-based cost allocation per team. Sustainability: prefer serverless/Fargate over always-on EC2 for bursty workloads.

**Q: How would you use Trusted Advisor in a production environment?**
A: Enable Business or Enterprise Support for full checks. Schedule weekly Trusted Advisor reports via AWS Health or Lambda automation. Alert on security findings (public S3 buckets, exposed access keys, open 22/3389) immediately via SNS. Track cost optimization findings monthly for rightsizing review. Monitor service limits to prevent capacity surprises.

**Q: How do you explain AWS architecture at a senior level in an interview?**
A: Explain the request path end-to-end (DNS -> CDN -> LB -> app -> DB/cache/queue). Explain the trust boundaries (who can call what). Identify failure domains (what fails if one AZ goes down). Describe data durability (backups, Multi-AZ, replication). Name the scaling mechanism (ASG + ALB target tracking). Identify cost drivers (NAT, cross-AZ, CloudWatch Logs). Describe the rollback plan. This is stronger than reciting a list of services.
