---
title: "Cloud Networking Drill 1: Public, Private, And Internal Boundaries"
sidebar_position: 99
---

# Cloud Networking Drill 1: Public, Private, And Internal Boundaries

## Production Context

You are designing the network architecture for an ML platform that will serve external
customers. The platform has: a public inference API, an internal admin dashboard, a
PostgreSQL database that stores model weights and job metadata, and a fleet of GPU
batch workers. Security has flagged that a previous version of the platform accidentally
exposed an admin endpoint to the internet. Your job is to design explicit boundaries,
explain exactly what is public versus private, and articulate how every access pattern
works without creating a new exposure.

---

## Prerequisites

No cluster or cloud account required. This drill is paper-based with CLI examples where
relevant. The goal is to be able to explain this architecture verbally and in diagrams
during a technical interview.

---

## Beginner Section: Establishing the Boundary Model

### Step 1 — Understand the two axes of network boundary

Every cloud network decision sits on two axes:

**Axis 1 — Reachability:** Can the resource be addressed from the internet?

- **Public:** Has a public IP or is behind a public load balancer. Internet clients can
  initiate connections to it.
- **Private:** No public IP. Can only be reached from within the VPC or connected
  networks (VPN, peering, Direct Connect).

**Axis 2 — Traffic direction:** Does this resource initiate outbound or accept inbound?

- **Ingress-facing:** Accepts connections from outside its trust zone (API gateway, LB)
- **Egress-only:** Initiates connections out but should never accept inbound from
  lower-trust networks (batch workers phoning home to an API)

Most security mistakes conflate these two axes. A private subnet still needs egress
for package updates. A public subnet should usually not run a database.

### Step 2 — Map each service component to the right zone

For the ML platform, draw this mental model:

```
Internet
   |
   |  HTTPS 443
   v
[Public Load Balancer / WAF]          ← Zone: Public edge, no persistent state
   |
   | Private IP only
   v
[Inference API pods]                  ← Zone: Private application subnet
[Admin UI pods]                       ← Zone: Private admin subnet (SEPARATE from API)
   |
   | Private IP only
   v
[PostgreSQL (RDS or self-managed)]    ← Zone: Private data subnet
   |
   | No inbound from internet
[GPU Worker fleet]                    ← Zone: Private compute subnet, egress-only
```

Why admin UI is in a separate subnet from the inference API:

- Inference API must scale to handle customer traffic — it may need wider inbound rules
- Admin UI should only be reachable from corporate VPN or specific IP ranges
- If both live in the same subnet, a misconfigured load balancer rule could accidentally
  expose admin routes to the customer-facing LB

### Step 3 — Define what "private" means operationally

Private does not mean inaccessible. It means initiation must come from a trusted network.
Private resources still need:

- **Egress to the internet** (package updates, cloud API calls, S3/GCS bucket access)
  → handled by NAT Gateway (AWS) or Cloud NAT (GCP)
- **Egress to other private subnets** (workers reading from database)
  → handled by subnet routing within the VPC, controlled by security groups or firewall rules
- **Management access** (SSH or Kubectl exec into private nodes)
  → handled by a bastion host or Session Manager, never by opening SSH to 0.0.0.0/0

### Step 4 — Explain the admin access pattern safely

There are three safe patterns for admin access to private resources:

**Pattern A — Bastion host:**
```
Engineer laptop → VPN → Bastion (public or VPN-accessible, hardened) → private resources
```
- Bastion has a public IP OR is accessible only via VPN
- Bastion allows SSH from a specific corporate IP range, not 0.0.0.0/0
- Bastion has no access to production data itself — it is a jump point only
- All sessions are logged (audit requirement)

**Pattern B — AWS Session Manager / GCP IAP (Identity-Aware Proxy):**
```
Engineer → Cloud console or CLI (authenticated) → IAM-gated tunnel → private instance
```
- No public IP on the target instance required
- All access goes through cloud IAM — no SSH key management
- Sessions recorded automatically
- This is the preferred pattern in modern cloud architectures

**Pattern C — VPN with split tunneling:**
```
Engineer → VPN tunnel → private subnet directly
```
- Full VPN: all traffic goes through corporate network
- Split tunnel: only private IP ranges go through VPN, internet goes direct
- Split tunnel is lower latency but requires careful route management to avoid leaks

### Step 5 — Control egress from private workloads

Private workloads need outbound internet access for:
- Pulling container images from Docker Hub / public registries
- Calling external APIs (Stripe, Twilio, etc.)
- Reaching cloud-managed services (S3, Pub/Sub, CloudSQL via public endpoint)

Egress control options:

```
Private subnet → NAT Gateway → Internet
                    ↑
           Static Egress IP (allowlist this IP at 3rd-party services)

Private subnet → VPC Endpoint (AWS) / Private Service Connect (GCP) → Cloud service
               (traffic never leaves the cloud provider's backbone)
```

A VPC Endpoint or Private Service Connect connection is preferred for cloud-native
services because: no NAT required, no internet exposure, lower latency, and you can
attach IAM/VPC-SC policies at the endpoint.

---

## Intermediate Section: Architecture Review

You are reviewing a pull request that adds the following infrastructure:

```yaml
# Proposed Terraform (simplified)
resource "aws_security_group_rule" "admin_inbound" {
  type        = "ingress"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]   # open to internet
  security_group_id = aws_security_group.admin_ui.id
  description = "Allow HTTPS to admin UI"
}

resource "aws_lb_listener" "admin" {
  load_balancer_arn = aws_lb.public_alb.arn   # same ALB as inference API
  port              = 8443
  protocol          = "HTTPS"
  # ... routes to admin UI target group
}
```

Questions without hints:

1. What exposure does this configuration create?
2. Why is sharing the same ALB for inference API and admin UI dangerous, even if they
   are on different ports?
3. Write the corrected Terraform that restricts admin access to a corporate IP range
   and uses a separate internal load balancer.
4. What log source would you check to audit who accessed the admin UI in the last 30 days?

---

## Advanced / Stretch

**Scenario A — Data exfiltration via egress**

An attacker compromises a batch worker pod. The pod has outbound internet access via
NAT Gateway. Explain what data exfiltration looks like in this scenario. What controls
would limit the blast radius: egress firewall rules, DNS filtering, VPC Flow Logs,
GuardDuty anomaly detection?

**Scenario B — PrivateLink / Private Service Connect for customer connectivity**

A large enterprise customer wants to call your inference API without their traffic ever
traversing the public internet. Explain how AWS PrivateLink or GCP Private Service
Connect works, what the customer must configure in their own VPC, and what constraints
this places on your load balancer type (NLB required for PrivateLink, not ALB).

**Scenario C — Shared VPC and multi-team governance**

Your organisation runs multiple teams in the same GCP project or AWS account. Design
a Shared VPC (GCP) or a Transit Gateway (AWS) architecture that lets teams share a
central egress path and DNS resolver while keeping each team's workloads isolated in
separate subnets or accounts.

---

## Sample Architecture Explanation (Interview-Ready)

```
For the ML inference platform, I would establish three network zones:

Zone 1 — Public edge:
  A Cloud Load Balancer (GCP HTTPS LB or AWS ALB) is the only resource with a public IP.
  It terminates TLS and passes traffic to the application tier. A WAF sits in front for
  OWASP filtering. The load balancer health-checks backend pods and drains connections
  during deploys.

Zone 2 — Private application tier (two separate subnets):
  a) Inference API subnet: receives traffic from the external LB only. Pods need egress
     to call the database and to pull model artifacts from GCS/S3.
  b) Admin UI subnet: receives traffic from an internal-only load balancer, accessible
     only from the corporate VPN IP range. Completely separate from the customer path.

Zone 3 — Private data and compute tier:
  PostgreSQL runs in a dedicated subnet with no inbound except from Zone 2.
  GPU workers are in a compute subnet. They read from GCS/S3 via a VPC endpoint, write
  results to the database, and have no inbound access from anywhere.

Egress:
  All private subnets route outbound internet traffic through Cloud NAT or a NAT Gateway
  with a static IP. That static IP is whitelisted at any external dependencies.
  Cloud-native service access (GCS, Pub/Sub, BigQuery) goes through VPC endpoints,
  bypassing NAT entirely.

Admin access:
  Engineers use IAP (GCP) or Session Manager (AWS) for shell access to any private instance.
  No bastion host with a public IP is needed. All sessions are recorded in Cloud Audit Logs.
```

---

## Common Mistakes

- **"Private subnet" with `0.0.0.0/0` in the security group.** A private subnet only
  prevents direct internet routing. A security group rule allowing all inbound still
  exposes the resource to anything that can reach it (other VPC resources, VPN users,
  peered networks). Both routing and filtering must be correct.
- **Admin and customer traffic on the same load balancer.** Even on different ports,
  a single WAF bypass, ALB misconfig, or CORS misconfiguration can expose admin routes
  to internet clients.
- **Forgetting egress controls.** Organisations spend heavily on ingress controls and
  ignore egress. Outbound DNS, HTTP, and HTTPS from every private workload should be
  scoped to what that workload actually needs.
- **Using public endpoints for cloud-native services (S3, GCS) when VPC endpoints are
  available.** Traffic to a public S3 endpoint from a private subnet goes through NAT,
  incurring NAT Gateway data processing costs and adding potential exposure. VPC
  endpoints are almost always cheaper and safer.

---

## What To Study Next

- VPC design: subnet sizing, CIDR planning, multi-AZ layout
- AWS Transit Gateway vs VPC Peering: when each is appropriate
- GCP Shared VPC vs VPC Peering: service project model
- AWS PrivateLink and GCP Private Service Connect: customer connectivity
- Zero-trust network models: no implicit trust based on subnet membership
- VPC Flow Logs and cloud-native network observability
