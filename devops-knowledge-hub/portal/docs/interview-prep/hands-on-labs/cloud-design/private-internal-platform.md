---
title: "Cloud Design Lab 2: Private Internal Platform"
sidebar_position: 2
---

# Cloud Design Lab 2: Private Internal Platform

## Scenario

Design an internal developer platform for private services, internal dashboards, and event-driven workers. There is no public-facing product here — this is the platform that internal engineering teams use to build and run their own services.

Requirements:
- no public internet exposure for core services
- private DNS and internal service discovery
- internal load balancing only
- GKE and Cloud Run both available — justify where you use each
- Cloud SQL or equivalent relational store
- Pub/Sub or queue-based async processing
- strong identity and least privilege for both humans and workloads
- centralized observability
- safe multi-team platform guardrails without the platform team becoming a blocker

---

## Prerequisites

Before attempting this lab, review:
- GCP VPC fundamentals: private subnets, Cloud NAT, Private Google Access, Private Service Access
- Cloud DNS with private zones and internal DNS forwarding
- Internal load balancing (Internal HTTP(S) LB vs Internal TCP/UDP LB)
- GKE: private clusters (no public node IPs), node pool design, Workload Identity
- Cloud Run: private ingress (no public traffic), VPC connector or Direct VPC egress
- Cloud SQL private IP and IAM authentication
- Cloud IAP (Identity-Aware Proxy) for BeyondCorp-style internal access
- GCP IAM: service accounts, IAM conditions, resource hierarchy (org -> folder -> project)
- Cloud Monitoring and Cloud Logging

Estimated time: 90 minutes for a first attempt. Less if you have operated GKE private clusters before.

---

## How to Think About This

This lab looks simpler than Lab 1 because there is no public internet. It is not simpler. The access model is harder because you must define who can reach what, and how, without defaulting to "put it on the internet." Work through these questions before designing anything.

**Step 1 — Define what "no public exposure" actually means.**
It is easy to say "private." It is harder to enforce it. Where do engineer laptops connect from? What about CI/CD pipelines? Does "no public exposure" mean no external IPs on any resource, or does it mean no resources reachable from the internet without authentication? These are different requirements with different designs.

**Step 2 — Solve the human access problem first.**
Engineers need to reach internal dashboards, run kubectl commands, query databases during incidents, and view logs. If your platform is fully private, how do they do any of that safely? The answer shapes your entire identity model. Common patterns: Cloud IAP + Identity-Aware Proxy, a corporate VPN with tunnel to GCP, or a bastion host. Each has tradeoffs you should be able to articulate.

**Step 3 — Separate the control plane from the data plane.**
The control plane is how the platform is managed (GKE API server, CI/CD pipelines, IAM changes, deployment approvals). The data plane is the runtime traffic between services. These have very different access patterns, risk profiles, and audit requirements. Design them explicitly and separately.

**Step 4 — Define the identity model for workloads.**
In a private platform, workload-to-workload trust matters as much as human access. Which services can talk to which other services? What credential proves that a GKE pod is the legitimate order-processing service and not a compromised container that found a credential? Workload Identity + IAM bindings answer this — but only if you design the policy carefully.

**Step 5 — Decide where GKE vs Cloud Run fits.**
In a private platform you have both available. Long-running stateful workers, services needing cluster-level configuration, or platform-operator workloads belong in GKE. Stateless internal APIs and event-driven functions that run per-request work well in Cloud Run with private ingress. Be explicit about why you put each workload where.

**Step 6 — Design your egress strategy.**
Even a fully private platform needs outbound internet access for some things: pulling OS patches, calling external APIs, accessing external services. How do you allow that without creating open egress paths? Cloud NAT plus strict firewall rules is the common answer — but you should know its limits (it does not filter by destination by default).

**Step 7 — Define your blast radius per team boundary.**
If one team's workload is compromised, what does an attacker have access to? Shared VPCs, shared GKE clusters, and shared Cloud SQL instances all expand blast radius. Separate projects, workload-specific service accounts, and narrow IAM policies shrink it. The tradeoff is operational complexity for the platform team.

---

## Building Blocks Available

| Component | What it does |
|---|---|
| Private GKE Cluster | GKE cluster where nodes have no public IPs; API server can be private or limited-public |
| Cloud Run (private ingress) | Cloud Run service where only internal traffic can invoke it; no external URL served |
| Internal HTTP(S) LB | L7 load balancer with internal IP only; routes traffic between services inside the VPC |
| Internal TCP/UDP LB | L4 internal load balancer; useful for services that need non-HTTP protocols |
| Cloud DNS (private zones) | Internal-only DNS zones visible only inside your VPC; service discovery for internal names |
| Cloud IAP | Identity-Aware Proxy; enforces user identity before proxying to internal apps; enables zero-trust access without a VPN |
| Cloud NAT | Outbound-only internet access for resources without public IPs; no inbound allowed |
| VPC Service Controls | Perimeter-based access control to prevent data exfiltration from GCP managed services |
| Private Service Access | Private connectivity to Google managed services (Cloud SQL, Memorystore) without public IPs |
| Cloud SQL (private IP) | Managed database reachable only via internal IP; workloads use Cloud SQL Auth Proxy |
| Workload Identity | Binds Kubernetes service account to GCP IAM service account; workloads get GCP credentials without static keys |
| Cloud SQL Auth Proxy | Sidecar that handles IAM-authenticated, encrypted Cloud SQL connections from pods |
| Shared VPC | One VPC network shared across multiple GCP projects; centralizes network policy |
| Cloud Armor (internal) | Can be attached to Internal HTTP(S) LB to apply WAF rules for internal traffic if needed |
| Cloud Monitoring | Metrics, alerting, SLOs; platform teams can create shared dashboards per team |
| Cloud Audit Logs | Logs who did what to GCP resources; required for compliance; includes data access logs |
| Secret Manager | Centralized secrets storage; IAM-controlled; audit-logged; no secrets in environment variables |
| Binary Authorization | Deploy-time policy enforcement; works for internal delivery pipelines too |

---

## Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Expand every section.

### Assumptions I Would Clarify First

- "Private" means no external IPs on application resources and no routes from the public internet to internal services
- Engineers access internal dashboards from corporate laptops via IAP or VPN
- Multiple teams share the platform; each team has its own namespace in GKE and its own Cloud Run service identity
- The platform team provides shared infrastructure (GKE cluster, Cloud SQL, Pub/Sub) but teams manage their own application configs
- Egress to the internet is allowed for patching and approved external APIs, but is controlled via Cloud NAT

### Internal Access Model for Humans

```
Engineer laptop (corporate network or BeyondCorp endpoint)
  -> Cloud IAP (validates Google identity, device policy if configured)
  -> Internal HTTPS LB (internal IP only)
  -> GKE Ingress / internal dashboard service
  -> Application
```

For kubectl access:
```
Engineer
  -> gcloud container clusters get-credentials (GCP IAM authenticated)
  -> GKE control plane (private API server endpoint, only reachable via authorized networks or via IAP tunnel)
```

### Internal Request Path for Service-to-Service Traffic

```
Service A (GKE pod or Cloud Run)
  -> Cloud DNS private zone resolves internal service name
  -> Internal HTTP(S) LB (internal IP)
  -> Service B (GKE pod or Cloud Run)
```

### Workload Identity and Database Access

```
GKE Pod (runs as K8s service account: team-a/order-processor)
  -> Workload Identity binding maps to GCP SA: order-processor@project.iam.gserviceaccount.com
  -> GCP SA has Cloud SQL Client role
  -> Cloud SQL Auth Proxy sidecar uses GCP SA identity
  -> Connects to Cloud SQL via private IP, IAM-authenticated, encrypted
```

### What I Have Not Designed Yet (expand these)

- Exact project structure (one project per team vs shared project)
- VPC Service Controls perimeter configuration
- Pub/Sub IAM policy per topic
- Blast radius analysis if the GKE node pool is compromised
- Incident response runbook for loss of access to internal IAP

---

## Tasks

Complete all of the following. Justify each design choice — "because it's best practice" is not a justification.

1. **Private network and service boundaries** — Define your VPC topology. Do you use a Shared VPC or separate VPCs per team? How do services in different projects communicate? Where do you use Private Service Access?

2. **Internal traffic path** — Trace a request from an engineer's laptop to an internal dashboard. Trace a service-to-service request. Trace a database query from an application pod. Describe the DNS, auth, and network path for each.

3. **Identity model for humans and workloads** — How do engineers authenticate to internal services? How do workloads prove identity to each other and to managed services (Cloud SQL, Pub/Sub)? What happens to static service account keys?

4. **Where you use GKE, Cloud Run, or VMs** — For a long-running stateful worker, a stateless internal API, an event-driven transformer, and a periodic batch job: which platform do you use for each and why?

5. **Private database connectivity** — Describe exactly how an application pod connects to Cloud SQL. Does it use the Auth Proxy? Does it use native IAM auth? What is the connection pool size and why? What happens if Cloud SQL has a failover?

6. **Platform protection and shared component safety** — The GKE cluster is shared. What stops Team A from accessing Team B's secrets or database? What stops a compromised pod from exfiltrating data to the internet?

7. **Mandatory vs optional guardrails** — List at least four things the platform team enforces by policy (mandatory) and at least three things teams can configure themselves (optional). Explain the line.

8. **Incident response path** — An on-call engineer gets paged at 2am that an internal service is down. Walk through: how they authenticate, what tools they use, what access they have, and what could go wrong with the access model during an incident.

---

## What a Beginner Answer Looks Like

- Understands that the core services should not have public IPs
- Knows GKE supports private clusters
- Mentions service accounts for workload access
- Can describe a basic internal load balancer path
- May not distinguish between human and workload identity
- Likely missing: IAP, VPC Service Controls, project-level isolation, blast radius thinking
- May assume "private VPC = secure" without thinking about lateral movement

## What an Intermediate Answer Looks Like

- Explicit human access via Cloud IAP or VPN, not just "use a bastion"
- Workload Identity is the answer for pod-to-Cloud SQL auth, and explains why static keys are banned
- Understands GKE private cluster and what "private API server" means operationally
- Can distinguish between Shared VPC and per-team VPCs and articulate when each is appropriate
- Addresses egress: Cloud NAT is present, but may not think through what happens without destination filtering
- Mentions namespaces, RBAC, and network policies for GKE multi-tenancy
- Missing: blast radius quantification, VPC Service Controls, detailed incident access path

## What a Strong Answer Looks Like

- Opens by separating control plane from data plane identity and access requirements
- Explicit blast radius analysis: if Team A's pod is compromised, what can it reach?
- Addresses the tension between platform team control and team autonomy — guardrails that do not require approval tickets
- IAP + BeyondCorp context: why device trust matters, not just user identity
- VPC Service Controls: prevents a compromised workload from exfiltrating Cloud SQL data out of the perimeter even with valid credentials
- Egress with destination filtering via an egress firewall or proxy (Cloud NAT alone is not enough for security-sensitive environments)
- Incident access model: what if IAP is down? What is the break-glass procedure? How is emergency access audited?
- Guardrails described as policy-as-code (OPA/Gatekeeper for GKE, org policy constraints for GCP), not manual enforcement

---

## Interviewer Pressure Questions

- How do engineers reach internal dashboards safely from home? What if your IAP is down?
- What is your egress strategy? Can a compromised pod call any IP on the internet?
- What is your blast radius if one team's workload is compromised? Can it reach another team's Cloud SQL?
- You use a shared GKE cluster. Team A's pod has a memory exploit. What does it have access to on the node?
- How do you avoid the platform team becoming a blocking team? What can a service team do without filing a ticket?
- An engineer needs database read access for an incident at 2am. How do they get it, and is that access audited?
- What is different between a Shared VPC and peered VPCs? Which would you use here and why?
- How does Cloud Run with private ingress get invoked? What network path does the request take?

---

## Deliverable Guidance

Your final answer should contain:

**Architecture diagram** covering:
- Human access path (laptop -> IAP -> internal LB -> app)
- Service-to-service path (DNS resolution, internal LB, target service)
- Data access path (pod -> Workload Identity -> Cloud SQL Auth Proxy -> Cloud SQL private IP)
- Egress path (pod -> Cloud NAT -> internet)
- Mark clearly which resources have external IPs (answer: almost none)

**Control-plane and data-plane explanation** covering:
- Control plane: GKE API server access, CI/CD pipeline identity, IAM change management
- Data plane: service-to-service runtime traffic, DB queries, Pub/Sub publish/consume

**Security boundary explanation** covering:
- What defines a security boundary in your design (project? VPC? namespace? IAM policy?)
- What the blast radius is for a compromised pod
- How you detect and respond to a workload calling unexpected destinations

---

## What to Study Next

After completing this lab:
- Lab 1: the public-facing counterpart — compare how the access model changes when users are external
- Lab 3: same concepts but on AWS — how does IAM Roles for Service Accounts compare to Workload Identity?
- Deep dives: VPC Service Controls perimeter design, GKE network policy (Cilium vs Calico), Cloud IAP context-aware access, OPA/Gatekeeper for platform guardrails
- Incident management: break-glass access patterns and how to audit emergency credential use
