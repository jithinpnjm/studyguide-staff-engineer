---
title: "Cloud Networking And VPC Design Drills"
sidebar_position: 0
---

# Cloud Networking And VPC Design Drills

These drills cover the networking layer of cloud design interviews — the part where product-level architecture ends and the actual routing, security policy, and packet behavior begin. Cloud networking is where most senior design answers go shallow.

## Why This Track Matters Operationally

Understanding VPC design, routing, security groups, NACLs, and load balancer tiers is not optional at the senior SRE level. Production incidents regularly trace back to network misconfigurations: a route that was not advertised, a security group that blocks health checks, a NAT gateway that saturates under load. These drills build the vocabulary and reasoning you need to answer confidently and correctly.

## Prerequisites

- Know what a VPC is and how subnets, CIDR ranges, and route tables work
- Understand security groups versus NACLs in AWS — stateful versus stateless
- Know the difference between an L4 (TCP/UDP) and L7 (HTTP/HTTPS) load balancer
- Familiar with the basics of BGP-style route preference in cloud networks (more specific wins)
- Completed or read through the Networking labs track

Foundation reading: [../../foundations/01-networking-fundamentals.md](../../foundations/01-networking-fundamentals.md), [../../foundations/07-system-design-cloud-architecture.md](../../foundations/07-system-design-cloud-architecture.md)

## Drills

1. [drill-01-public-private-network-boundaries.md](drill-01-public-private-network-boundaries.md) — Design and explain public versus private subnet boundaries. What makes a subnet "public"? What does a NAT gateway actually do? When should a service be in a private subnet with no public IP?
2. [drill-02-gcp-vpc-and-load-balancing.md](drill-02-gcp-vpc-and-load-balancing.md) — Reason through GCP VPC networking: global VPC, firewall rules, Cloud Load Balancing tiers, and Private Google Access. Design the routing for a backend service that must not be publicly reachable.
3. [drill-03-aws-vpc-sg-nacl-and-routing.md](drill-03-aws-vpc-sg-nacl-and-routing.md) — Work through AWS VPC design: security group versus NACL behavior, routing tables, VPC peering, and PrivateLink. Diagnose a case where traffic is blocked and identify which layer is responsible.
4. [drill-04-kubernetes-cloud-networking-path.md](drill-04-kubernetes-cloud-networking-path.md) — Trace the full network path from an external client through a cloud load balancer into a Kubernetes cluster, through kube-proxy or CNI, and to a pod. Identify what can fail at each hop.

## Learning Progression

**Beginner:** you can describe the components in a VPC at a high level. You know that security groups are stateful. You know what a public subnet is.

**Intermediate:** you can design a multi-tier VPC correctly — which services go in public subnets, which in private, and why. You can explain what happens when a security group rule is missing. You can trace why a health check from a load balancer is failing.

**Advanced:** you reason about network path latency and bottlenecks (NAT gateway saturation, shared bandwidth). You can explain VPC peering limitations (no transitive routing). You understand what PrivateLink solves that VPC peering does not. You trace a Kubernetes service networking path through kube-proxy or eBPF-based CNI rules.

## How To Use These Drills

1. Draw the network topology on paper before writing any answer — each drill has a design component.
2. Trace the traffic path explicitly: source, routing decision at each hop, security check at each hop, destination.
3. Identify what is blocked and which layer is responsible before proposing a fix.
4. For GCP and AWS drills, explain the behavioral difference between the two — not just the different product names.
5. Review your answer as if you are the interviewer: can you defend every routing and security decision?

## Tools You Need

- GCP Connectivity Tests for cloud path reasoning: https://cloud.google.com/network-intelligence-center/docs/connectivity-tests/concepts/overview
- GCP free trial: https://cloud.google.com/free
- AWS VPC console or AWS free tier for hands-on drill verification
- A drawing tool for network diagrams (required — these drills are not text-only exercises)

Helpful references:
- VPC overview (GCP): https://cloud.google.com/vpc/docs/overview
- Cloud Load Balancing overview: https://cloud.google.com/load-balancing/docs/load-balancing-overview
- Cloud Armor: https://cloud.google.com/armor/docs/cloud-armor-overview
- AWS VPC security: https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Security.html
- AWS NACLs: https://docs.aws.amazon.com/AmazonVPC/latest/UserGuide/VPC_ACLs.html
- ALB overview: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
- NLB overview: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html

## Success Criteria

After completing all four drills you should be able to:

- design a correct multi-tier VPC (public, private, data tiers) for GCP or AWS without prompting
- explain to an interviewer why VPC peering is not transitive and what the operational implication is
- trace a load balancer health check failure to the specific security group or firewall rule blocking it
- describe the full network path from a client browser to a pod in a Kubernetes cluster, naming each forwarding decision
- explain the behavioral difference between a GCP global load balancer and an AWS ALB in a multi-region failure scenario
