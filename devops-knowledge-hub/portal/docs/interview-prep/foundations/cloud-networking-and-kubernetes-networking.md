---
title: "Foundations: Cloud Networking And Kubernetes Networking Premium Teaching Guide"
sidebar_position: 11
---

# Foundations: Cloud Networking And Kubernetes Networking Premium Teaching Guide

Most production networking incidents happen at the boundary between cloud networking and Kubernetes networking.

Cloud providers own VPCs, subnets, routes, firewalls, NAT, and load balancers. Kubernetes owns Pod networking, Services, Ingress intent, and cluster traffic policy.

This guide teaches both layers as one operational system.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — VPCs, subnets, Services, Ingress, Pod IPs.
2. **Intermediate Layer** — AWS/EKS, GCP/GKE, NAT, DNS, health checks.
3. **Advanced Layer** — direct Pod routing, IP exhaustion, egress control, flow logs.
4. **Production SRE Layer** — 502s, blocked traffic, one-node failures.
5. **Interview Layer** — explain packet paths clearly across both layers.

---

# Memory Palace: Two Road Systems

| Layer | Analogy | Meaning |
|---|---|---|
| Cloud Network | City highways | VPC, subnets, routes, LB |
| Kubernetes Network | Building hallways | Pod-to-Pod and Service traffic |
| NAT | Toll gate | Outbound shared egress |
| Security Group | Gate guard | Stateful allow policy |
| NetworkPolicy | Internal room rules | Pod traffic control |
| Ingress | Reception desk | External HTTP routing |

---

# Beginner Layer: Two Networks, One Request

```text
Internet
 -> DNS
 -> Cloud Load Balancer
 -> VPC firewall / route
 -> Node or Pod target
 -> Service datapath
 -> Pod
```

Each hop can fail independently.

Senior habit:

> Always ask which layer owns the broken hop.

---

# Beginner Layer: Cloud Basics

## VPC

Private network boundary.

## Subnet

Smaller IP range, often AZ scoped.

## Route Table

Chooses next hop.

## NAT Gateway / Cloud NAT

Lets private workloads initiate outbound traffic.

## Load Balancer

Distributes inbound traffic.

---

# Beginner Layer: Kubernetes Basics

## Pod IP

Workload network identity.

## Service

Stable virtual access to changing Pods.

## Ingress

HTTP/HTTPS routing intent.

## CNI

Makes Pod networking real.

## NetworkPolicy

Controls Pod traffic rules.

---

# Intermediate Layer: AWS / EKS Thinking

Common pattern:

```text
public subnets  -> ALB / NAT
private subnets -> worker nodes
private data    -> DB/cache
```

Important truths:

- AWS VPC CNI often gives Pods VPC IPs
- Pod density can be limited by IP capacity
- ALB integrates through controllers
- security can exist at node or Pod level depending on design

---

# Intermediate Layer: GCP / GKE Thinking

Common pattern:

- global VPC
- regional subnets
- separate ranges for nodes, Pods, Services
- load balancers can target Pods directly via NEGs

Benefits of direct Pod targets:

- per-Pod health checks
- cleaner traffic path
- reduced NodePort indirection

---

# Intermediate Layer: Health Checks Must Agree

Bad pattern:

```text
LB health endpoint says OK
real user requests fail
```

Better alignment:

- startup probe: boot complete
- readiness: safe for traffic
- liveness: restart if stuck
- LB health path reflects meaningful readiness

---

# Intermediate Layer: DNS Across Layers

Possible DNS systems:

- CoreDNS inside cluster
- private cloud DNS zones
- public DNS
- upstream resolvers

If apps say “host not found,” determine which DNS layer failed.

---

# Advanced Layer: Pod IP Exhaustion

Common in cloud CNI models.

Symptoms:

- Pods Pending
- CNI errors
- nodes have CPU/memory free but no new Pods start

Fix options:

- more subnet space
- larger node types
- prefix delegation
- autoscaling
- alternate networking design

---

# Advanced Layer: Egress Design

```text
Pod -> CNI datapath -> route -> NAT or endpoint -> external API
```

Common failures:

- blocked DNS
- NetworkPolicy deny
- missing route
- NAT exhaustion
- firewall deny
- vendor allowlist mismatch

Stable egress IPs matter for partner integrations.

---

# Advanced Layer: Security Layers

A connection may require both:

1. Cloud firewall / SG allow
2. Kubernetes NetworkPolicy allow

If one denies, traffic fails.

---

# Advanced Layer: Evidence Sources

Use the right layer evidence.

| Layer | Evidence |
|---|---|
| Pod | curl, nslookup, ss |
| Cluster | kubectl describe, events, EndpointSlice |
| Node | ip route, tcpdump, conntrack |
| Cloud | flow logs, LB target health, route tables |

---

# Production SRE Layer: Real Incidents

## External Users Get 502

Check:

- LB target health
- Ingress rules
- Service endpoints
- readiness
- app logs

## Pods Cannot Reach Internet

Check:

- DNS
- NetworkPolicy
- NAT
- routes
- vendor allowlist

## Only One Node Broken

Check:

- CNI on that node
- node routing
- conntrack
- ENI/NIC state

## Pod IP Works, Service Fails

Check:

- Service selectors
- EndpointSlice
- kube-proxy/eBPF datapath

## LB Healthy, Users Still Fail

Often shallow health checks.

---

# Production SRE Layer: Troubleshooting Order

1. Scope impact.
2. Determine failing layer.
3. Test direct path vs abstracted path.
4. Inspect control-plane objects.
5. Inspect network evidence.
6. Mitigate safely.

---

# Interview Layer: Strong Answers

## VPC vs Kubernetes networking?

> VPC networking connects nodes and cloud resources. Kubernetes networking connects Pods and Services on top of that infrastructure.

## How does traffic reach a Pod?

> DNS resolves name, cloud LB receives traffic, routes through VPC policy to node or Pod target, Kubernetes datapath forwards to a ready Pod.

## Why can nodes have spare CPU but Pods stay Pending?

> Scheduling may be blocked by IP exhaustion, taints, storage, quotas, or affinity constraints.

## Why can LB be healthy while users fail?

> Health checks may be shallow and not validate real dependencies or user paths.

---

# Labs

## Beginner

1. Draw internet-to-Pod packet path.
2. Inspect Service and endpoints.
3. Test DNS inside Pod.

## Intermediate

1. Break Service selector and repair.
2. Block egress with NetworkPolicy.
3. Inspect target health.

## Advanced

1. Simulate Pod IP exhaustion.
2. Read flow logs.
3. Design private cluster CI path.
4. Compare node target vs Pod target models.

---

# Memory Review

- Why are there two networking layers?
- Why can Pod IP work while Service fails?
- Why do private clusters complicate CI/CD?
- Why do flow logs matter?
- Why should health checks be meaningful?

---

# Senior Summary

> I separate cloud networking from Kubernetes networking first. For incidents I trace DNS, load balancer, firewall, route, target health, Service endpoints, cluster datapath, and application readiness. I use logs and packet evidence from the owning layer instead of guessing.
