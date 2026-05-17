---
title: "Cloud Design Lab 3: AWS Crossover Rebuild"
sidebar_position: 3
---

# Cloud Design Lab 3: AWS Crossover Rebuild

## Scenario

Take the GCP-first public platform from Lab 1 and rebuild it for AWS-first operation. This is not a migration exercise — it is a redesign exercise. The goal is to understand where the architectures are genuinely equivalent, where the cloud-native differences force different decisions, and where copying a GCP mental model into AWS creates hidden risk.

Requirements:
- Route 53 for DNS (justify routing policy)
- CloudFront for CDN and edge (justify whether you use it, and where it sits relative to WAF)
- AWS WAF for DDoS and L7 protection
- ALB or NLB — justify which you use and where
- EKS or an alternative compute platform — justify your choice
- Private RDS database (PostgreSQL or MySQL)
- SQS or SNS for async messaging
- CloudWatch and centralized observability
- Security Groups and NACLs — explain the difference and when each matters

---

## Prerequisites

Before attempting this lab, review:
- AWS VPC: subnets (public vs private), route tables, internet gateways, NAT gateways
- Security Groups (stateful, instance-level) vs NACLs (stateless, subnet-level)
- Route 53: record types, routing policies (latency, geolocation, weighted, failover)
- CloudFront: distributions, origins, cache behaviors, WAF integration
- AWS WAF: Web ACLs, rule groups, managed rule sets, attachment to CloudFront or ALB
- ALB vs NLB: OSI layer, protocol support, target groups, health check behavior
- EKS: managed node groups, Fargate profiles, VPC CNI, IAM Roles for Service Accounts (IRSA)
- RDS: Multi-AZ deployment, read replicas, Secrets Manager integration, RDS Proxy
- SQS vs SNS: fan-out patterns, dead-letter queues, visibility timeout
- CloudWatch: metrics, Logs Insights, alarms, Container Insights for EKS

Estimated time: 90-120 minutes. If you have completed Lab 1, focus on the difference mapping tasks rather than starting from scratch.

---

## How to Think About This

The temptation in a crossover lab is to produce a GCP-to-AWS dictionary ("Cloud Armor = WAF, Cloud CDN = CloudFront, GKE = EKS") and call it done. That is not architecture — it is shortcut thinking. The two clouds have genuinely different defaults, different trust models, and different failure modes. Work through these questions.

**Step 1 — Identify what maps cleanly and what does not.**
Some services are genuinely equivalent in behavior and operational model. Others share a name category (both are "load balancers") but behave differently enough to change your design. Before drawing anything, write a mapping table that marks each GCP service as: "direct equivalent," "rough equivalent with important differences," or "no equivalent — must rethink."

**Step 2 — Understand the AWS networking model differences.**
GCP firewalls are instance-level and stateful, applied via tags or service accounts. AWS uses Security Groups (stateful, attached to ENIs/instances) and NACLs (stateless, subnet-level, evaluated in order). This is a fundamental difference. In GCP, you can block traffic from a single pod without changing subnet-level rules. In AWS, you need to combine SGs and NACLs carefully, and NACL rules are stateless — you must allow return traffic explicitly.

**Step 3 — Rethink the edge stack.**
In GCP, the edge is: Cloud DNS -> Cloud CDN -> Cloud Armor -> External HTTPS LB. In AWS, the equivalent is: Route 53 -> CloudFront -> WAF (attached to CloudFront) -> ALB. The difference is that CloudFront is a true CDN and regional-level edge, while the ALB is the regional L7 entrypoint. WAF can attach to either — but attaching it to CloudFront means rules fire at the global edge before requests reach your VPC. Attaching it to the ALB means rules fire inside your region. The right answer depends on where you want to absorb attack traffic.

**Step 4 — Understand what ALB vs NLB means operationally.**
ALB is an L7 load balancer that understands HTTP/HTTPS, routes by path and header, terminates TLS, and has rich health check options. NLB is an L4 load balancer that passes TCP/UDP connections through, preserves source IP, and can handle millions of connections per second. For an HTTP API, ALB is almost always the right choice. NLB matters when you need static IPs, ultra-low latency, or protocols that ALB does not support.

**Step 5 — Understand IAM and workload identity on AWS.**
GCP Workload Identity binds a Kubernetes service account to a GCP service account, and GCP resources check IAM policies. AWS uses IRSA (IAM Roles for Service Accounts) for EKS: the pod assumes an IAM role via a projected token. The concepts are similar, but the implementation differs. IRSA requires OIDC federation configuration in the EKS cluster. Static IAM user credentials in environment variables are the AWS equivalent of static service account keys — equally dangerous.

**Step 6 — Think about what cloud-specific behavior is worth keeping.**
Some design decisions should stay cloud-native rather than being forced to look like the other cloud. RDS Multi-AZ behavior, CloudFront cache behavior configuration, and EKS managed node group update behavior are all worth understanding on their own terms rather than through a GCP lens.

---

## Building Blocks Available

| Component | What it does | GCP Equivalent | Key Difference |
|---|---|---|---|
| Route 53 | Authoritative DNS; supports latency routing, geolocation, weighted, failover policies | Cloud DNS | Route 53 has richer routing policies (latency-based, failover with health checks) |
| CloudFront | Global CDN; terminates TLS at edge PoPs; can attach WAF; caches static and dynamic content | Cloud CDN | CloudFront is a full distribution product; GCP CDN is more tightly coupled to LB |
| AWS WAF | Web ACL with rule groups; attaches to CloudFront, ALB, or API Gateway; managed rule sets available | Cloud Armor | AWS WAF is separate from the LB; Cloud Armor is integrated into LB config |
| ALB (Application Load Balancer) | L7 load balancer; HTTP/HTTPS routing; path and header rules; sticky sessions; WAF integration | External HTTPS LB | ALB is regional; GCP external HTTPS LB is global anycast |
| NLB (Network Load Balancer) | L4 load balancer; TCP/UDP; preserves source IP; static IPs; high connection volume | No direct equivalent | Use when static IP or non-HTTP protocols are required |
| EKS (Elastic Kubernetes Service) | Managed Kubernetes; managed or self-managed node groups; Fargate profiles for serverless pods | GKE | GKE has more opinionated defaults; EKS requires more VPC/IAM configuration |
| ECS (Elastic Container Service) | AWS-native container orchestration; Fargate for serverless; simpler than EKS for stateless workloads | Cloud Run | ECS is more operationally involved than Cloud Run; Fargate reduces node management |
| RDS (Multi-AZ) | Managed relational DB; Multi-AZ = synchronous standby in second AZ with automatic failover | Cloud SQL | RDS Multi-AZ failover takes 1-2 minutes; Cloud SQL similar |
| RDS Proxy | Connection pooler managed by AWS; reduces connection surge to RDS; IAM auth support | Cloud SQL Auth Proxy | Both solve connection pooling; RDS Proxy is more fully managed |
| SQS | Managed queue; at-least-once or exactly-once delivery; dead-letter queue support | Pub/Sub (pull subscriptions) | SQS is point-to-point; SNS is fan-out; Pub/Sub combines both |
| SNS | Managed pub-sub fan-out; delivers to SQS, Lambda, HTTP endpoints | Pub/Sub (push subscriptions) | For fan-out patterns, use SNS -> SQS rather than SQS alone |
| Security Groups | Stateful firewall attached to ENI/instance; allow rules only; evaluated against all attached SGs | GCP firewall rules (instance-level) | AWS SGs are ENI-attached; GCP rules are tag/SA-based |
| NACLs | Stateless firewall at subnet level; allow and deny rules; numbered priority; both inbound and outbound | GCP firewall rules (subnet-level) | NACLs are stateless — return traffic must be explicitly allowed |
| IAM Roles for Service Accounts (IRSA) | EKS pods assume IAM roles via OIDC projected tokens; eliminates static credentials | GKE Workload Identity | IRSA requires OIDC federation setup; conceptually similar |
| AWS Secrets Manager | Managed secrets storage; automatic rotation; IAM-controlled | Secret Manager | Both are functionally equivalent; rotation support is strong in both |
| CloudWatch | Metrics, logs, alarms, Container Insights, dashboards | Cloud Monitoring + Cloud Logging | CloudWatch Logs Insights is a query layer; fewer built-in SLO features than GCP |
| AWS X-Ray | Distributed tracing; auto-instruments some SDKs | Cloud Trace | X-Ray has good Lambda integration; Cloud Trace has better GKE auto-instrumentation |
| VPC (AWS) | Private network; public and private subnets; controlled by route tables | VPC (GCP) | AWS VPC is regional; GCP VPC is global; AWS subnets are AZ-bound |

---

## Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Use it as a starting point, not a final answer.

### GCP to AWS Service Mapping (Starter)

| GCP Service | AWS Equivalent | Parity Level |
|---|---|---|
| Cloud DNS | Route 53 | Rough equivalent — Route 53 has richer routing policies |
| Cloud CDN | CloudFront | Rough equivalent — CloudFront is a full distribution product |
| Cloud Armor | AWS WAF | Rough equivalent — WAF attachment point differs |
| External HTTPS LB | ALB | Rough equivalent — GCP LB is global; ALB is regional |
| GKE | EKS | Rough equivalent — IAM/networking setup differs significantly |
| Cloud Run | ECS Fargate | Rough equivalent — more operational overhead on AWS side |
| Cloud SQL (HA) | RDS Multi-AZ | Direct equivalent for HA behavior |
| Pub/Sub | SNS + SQS | Partial — need SNS for fan-out, SQS for queuing |
| Workload Identity | IRSA | Conceptual equivalent — different implementation |
| Cloud Monitoring | CloudWatch | Rough equivalent — SLO tooling less mature in CloudWatch |
| Secret Manager | AWS Secrets Manager | Direct equivalent |

### Request Path (AWS Version)

```
User
  -> Route 53 (latency-based routing to nearest region)
  -> CloudFront (CDN; cache hit: return immediately; cache miss: continue)
  -> AWS WAF (Web ACL attached to CloudFront; fires at edge)
  -> ALB (in private subnet with public-facing listener; TLS termination)
  -> EKS pods (in private subnets across 3 AZs)
  -> RDS Proxy (connection pooling)
  -> RDS Multi-AZ (primary in one AZ; standby in another)
  -> SQS (async work published by API pods)
  -> ECS Fargate workers or Lambda (consume from SQS)
```

### What I Have Not Designed Yet (expand these)

- NACL rules for the public and private subnets and why stateless matters
- IRSA setup for EKS pods that need to write to SQS or read from Secrets Manager
- Difference in ALB health check behavior vs GCP HTTPS LB health checks
- CloudFront cache behavior configuration per path pattern
- Route 53 health checks and failover routing for regional DR

---

## Tasks

Complete all of the following. For each task, explain both what you decided AND how it differs from the GCP version.

1. **GCP to AWS mapping** — Produce a complete mapping table. For each service, mark it as direct equivalent, rough equivalent, or no equivalent. Explain the important differences in the "rough equivalent" cases.

2. **What maps directly** — Identify at least three services or concepts that translate without significant behavioral difference. Explain why.

3. **What does not map directly** — Identify at least four places where copying GCP design habits into AWS creates a wrong or risky design. Be specific about what breaks.

4. **VPC, SG, and NACL design** — Design your VPC structure: how many VPCs, how many subnets (public vs private), which AZs, and what CIDR ranges. Then explain your Security Group rules for each tier (edge, app, data). Explain whether NACLs add value here or just add noise.

5. **Load balancer and edge behavior changes** — How does the edge stack differ from GCP? Where does WAF fire? What is the relationship between CloudFront, WAF, and ALB? What changes in how health checks work?

6. **What remains architecturally identical** — Identify at least three things that are the same design decision regardless of cloud: stateless vs stateful split, private database placement, async decoupling rationale, etc.

---

## What a Beginner Answer Looks Like

- Produces a mapping table but treats all equivalents as direct (does not flag important differences)
- Knows ALB is the right choice for HTTP APIs
- Understands that RDS should be in a private subnet
- May not distinguish between Security Groups and NACLs
- Likely missing: IRSA setup, NACL statelessness implications, WAF attachment point strategy, CloudFront vs direct-to-ALB tradeoffs

## What an Intermediate Answer Looks Like

- Mapping table correctly flags rough equivalents and explains key differences
- Explains Security Group rules per tier (specific ports, source SG references rather than CIDR ranges where possible)
- Understands that NACLs are stateless and explains why that matters for inbound + outbound rules
- Can explain where to attach WAF (CloudFront vs ALB) and when each is appropriate
- Uses IRSA for EKS workload identity, not IAM user credentials
- Explains RDS Proxy and why it matters for EKS-to-RDS connectivity
- Missing: detailed failure mode analysis, Route 53 failover routing mechanics, CloudFront origin group for DR

## What a Strong Answer Looks Like

- Opens with clear architectural principles that do not change between clouds and explicitly contrasts them with cloud-specific decisions
- NACL analysis: explains the stateless/stateful distinction with a concrete example (e.g., ephemeral port range for return traffic)
- WAF placement: explains that CloudFront + WAF absorbs attack traffic before it enters the VPC; ALB + WAF is cheaper for smaller deployments or non-cacheable APIs; names the tradeoff
- Points out that GCP's global anycast LB has no direct AWS equivalent — ALB is regional, so Route 53 with latency routing is necessary for global performance
- Addresses the SNS+SQS fan-out pattern and why Pub/Sub's combined model is simpler
- EKS networking: explains VPC CNI vs other CNIs and what it means for pod IP addresses consuming VPC CIDR space
- Calls out at least one place where direct cloud portability would silently degrade reliability or security
- Includes a "traps for GCP engineers moving to AWS" section

---

## Interviewer Pressure Questions

- Where are Security Groups enough and where do NACLs add real value? Give a concrete example.
- What if you copied GCP firewall habits into AWS — specifically the habit of trusting tag-based rules — and did not understand SG source references?
- ALB health checks are green but user requests are failing. What could cause this in AWS that would not in GCP?
- Where does WAF fire in your design? What gets through before WAF evaluates it?
- GCP's HTTPS load balancer is global anycast. ALB is regional. How does your AWS design handle global users with comparable latency?
- You use SNS + SQS for fan-out. GCP uses Pub/Sub. What does a GCP engineer need to unlearn when they switch to SNS + SQS?
- What is the VPC CNI behavior for EKS and why does it affect your subnet CIDR sizing more than GKE does?
- Route 53 failover routing relies on health checks. What is the blast radius if your health check endpoint is slow but not failed?

---

## Deliverable Guidance

Your final answer should contain:

**Mapping table** with three columns:
- GCP service
- AWS equivalent
- Parity level + most important behavioral difference

**Architecture sketch** showing:
- Route 53 -> CloudFront -> WAF -> ALB -> EKS pods -> RDS
- Public vs private subnet boundaries
- SQS consumers (workers or Lambda)
- AZ distribution for EKS node groups and RDS

**Risk list for naive cloud portability** — at least five specific risks with this format:
```
Risk: [specific thing that breaks]
Why it breaks: [the difference between GCP and AWS that causes it]
How to avoid it: [specific design change]
```

---

## What to Study Next

After completing this lab:
- Lab 4: multi-region control plane across GCP and AWS — this builds on both Lab 1 and Lab 3
- Deep dives: EKS VPC CNI and pod IP address management, CloudFront origin groups for failover, Route 53 resolver and DNS forwarding for hybrid setups, RDS Proxy configuration for EKS connection management
- Certification prep: AWS Solutions Architect Associate networking module covers SG vs NACL in depth
- Compare: deploy the same simple app to both GCP (Cloud Run) and AWS (ECS Fargate) and trace the IAM and networking differences yourself
