---
title: "Cloud Design Labs"
sidebar_position: 0
---

# Cloud Design Labs

These are architecture review exercises, not command labs. You sketch the design, write the reasoning, and have it reviewed. They simulate the whiteboard and verbal design rounds of senior SRE and platform engineer interviews at companies running GCP, AWS, or multi-cloud platforms.

## Why This Track Matters Operationally

Cloud architecture questions at the senior level are not "name the service." They are: "design a platform that handles X with these constraints, and explain what breaks if Y fails." The ability to reason about failure domains, traffic paths, stateful versus stateless boundaries, and cost tradeoffs under pressure is what separates senior candidates. These labs practice exactly that reasoning.

## Prerequisites

- Comfortable with the GCP and AWS core service vocabulary: load balancers, VPC, DNS, object storage, managed databases, CDN, WAF
- Understand the difference between L4 and L7 load balancing
- Know what an availability zone is and why it matters for failure domain design
- Familiar with basic IAM concepts: service accounts, roles, policies

Foundation reading: [../../foundations/07-system-design-cloud-architecture.md](../../foundations/07-system-design-cloud-architecture.md), [../../foundations/14-aws-cloud-services-and-platform-design.md](../../foundations/14-aws-cloud-services-and-platform-design.md)

## Labs

1. [lab-01-gcp-public-platform.md](lab-01-gcp-public-platform.md) — Design a public-facing GCP platform: global load balancing, CDN, WAF, backend services, managed database, and observability. Reference answer: [reference-answer-gcp-public-platform.md](reference-answer-gcp-public-platform.md).
2. [lab-02-private-internal-platform.md](lab-02-private-internal-platform.md) — Design a private internal platform with no public ingress: VPC peering, internal load balancing, private service connectivity, and secret management.
3. [lab-03-aws-crossover-rebuild.md](lab-03-aws-crossover-rebuild.md) — Take a GCP platform design and map it to AWS equivalents. Identify where the services differ in behavior, not just in name.
4. [lab-04-low-latency-multi-region-control-plane.md](lab-04-low-latency-multi-region-control-plane.md) — Design a control plane that must operate with low latency across multiple regions. Address active-active versus active-passive, consistency tradeoffs, and failure domain isolation.

## Learning Progression

**Beginner:** you can name the relevant services and sketch a basic architecture diagram. You identify the main components but miss failure domains and stateful boundaries.

**Intermediate:** you separate stateless and stateful components explicitly. You identify what happens when one AZ or region fails. You explain why you chose a specific load balancer tier. You reason about latency and cost tradeoffs.

**Advanced:** you address security posture, blast radius of each failure domain, rollout strategy, observability for each tier, and the cost model. You can contrast GCP and AWS behavior at the service level, not just the product name level. You are explicit about what your design does NOT do and why.

## How To Use These Labs

1. Write requirements and constraints first — state what you are optimizing for and what you are not.
2. Sketch the architecture: traffic path from client through to data layer.
3. Identify stateful components and describe their backup, replication, and recovery behavior.
4. Identify failure domains: what fails if one zone goes down, one region goes down, one dependency is unavailable.
5. Write the observability, security, and rollout controls section — do not skip it.
6. Review your answer against the rubric and note gaps.
7. For lab 1, compare your answer to the reference answer after completing your own.

## Tools You Need

- A drawing tool for sketching (paper, Excalidraw, or any whiteboard equivalent)
- GCP free trial for hands-on verification: https://cloud.google.com/free
- AWS free tier for AWS labs: https://aws.amazon.com/free/

Helpful references:
- GCP Architecture Framework: https://cloud.google.com/architecture/framework
- Cloud Load Balancing overview: https://cloud.google.com/load-balancing/docs/load-balancing-overview
- Cloud CDN: https://cloud.google.com/cdn/docs/overview
- Cloud Armor: https://cloud.google.com/armor/docs/cloud-armor-overview
- VPC overview (GCP): https://cloud.google.com/vpc/docs/overview
- Cloud SQL: https://cloud.google.com/sql/docs/introduction
- Pub/Sub: https://cloud.google.com/pubsub/docs
- AWS Reliability pillar: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html
- AWS WAF: https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html
- ALB overview: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html

## Success Criteria

After completing all four labs you should be able to:

- sketch a complete GCP public-facing platform architecture with all major tiers in under 15 minutes
- explain what changes in the design when you move the platform to AWS, and where behavior differs
- describe the failure domain for each tier in your design and what the recovery action is
- design a multi-region control plane and honestly state the consistency tradeoff you are making
- answer the follow-up question "what breaks first?" for any design you present
