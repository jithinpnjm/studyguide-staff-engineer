---
title: "Interview Questions"
sidebar_position: 4
---

# Cloud Platforms — Interview Questions

Strong cloud interview answers do not only name services. They explain tradeoffs, failure domains, cost, reliability, and operational ownership.

---

## Beginner Questions

### What is the shared responsibility model?

The provider runs the cloud infrastructure. The customer configures and operates what they build on it: identities, data, application code, network exposure, runtime configuration, and workload policies.

### What is the difference between IaaS, PaaS, and SaaS?

IaaS gives virtual infrastructure such as VMs and networks. PaaS manages more of the runtime platform. SaaS provides a complete managed application or service. More managed means less operational burden but also less low-level control.

### What is IAM?

IAM is the control system for who or what can call cloud APIs. It normally includes principals, roles, policies, groups, service accounts, and higher-level organization guardrails.

### Why avoid daily use of the root or owner account?

It has too much power and too much blast radius. Use it only for account-level tasks. Daily work should use SSO, role assumption, and least privilege.

---

## AWS Service Questions

### IAM user vs IAM role?

A user is a long-lived identity. A role is assumed for a session and is preferred for workloads, automation, and cross-account access.

### What components are needed to build a VPC?

Subnets, route tables, Internet Gateway, NAT Gateway, endpoints, security groups, NACLs, peering, VPN or Transit Gateway depending on connectivity needs.

### Security Group vs NACL?

A Security Group is stateful and applies close to a workload. A NACL is stateless and applies at subnet level. Security Groups are normally the main workload traffic control.

### Public subnet vs private subnet?

A public subnet has a route to an Internet Gateway. A private subnet does not accept direct inbound internet traffic and usually uses NAT or private endpoints for outbound dependencies.

### What is Auto Scaling?

Automatic capacity adjustment based on demand. Scale-out adds capacity. Scale-in removes capacity. Elasticity is the automatic part of scaling.

### On-demand vs reserved vs spot?

On-demand is flexible. Reserved or Savings Plans fit stable baseline usage. Spot is cheaper but interruptible and fits restartable or stateless jobs.

---

## Storage And Database Questions

### What is S3 used for?

Object storage for static content, backups, logs, data lakes, build artifacts, and archives. It is not a normal filesystem.

### What does S3 versioning help with?

It helps recover from accidental overwrite or delete. It is a recovery feature, not a complete backup strategy by itself.

### RDS Multi-AZ vs read replica?

Multi-AZ is primarily for availability and failover. Read replicas are primarily for read scaling and reporting workloads.

### What is RDS Proxy?

A managed proxy that pools and reuses database connections. It is useful for bursty applications, Lambda workloads, and systems with connection exhaustion.

### When choose DynamoDB?

Choose it for key-value or document workloads with known access patterns, high scale, and low-latency reads and writes. Avoid it when the data model needs relational joins and ad-hoc querying.

---

## Architecture Questions

### Design a highly available three-tier application in AWS.

A strong answer includes Route 53, optional CloudFront/WAF, ALB across public subnets, compute in private subnets, RDS or Aurora in database subnets, Multi-AZ, Auto Scaling, IAM roles, logs, metrics, alarms, and backup strategy.

### How would you design a secure and scalable API?

Use API Gateway or ALB depending on protocol needs. Add authentication, throttling, structured logging, metrics, tracing, least-privilege backend permissions, and WAF if the API is internet-facing.

### How do you design disaster recovery?

Start with RTO and RPO. Then choose backup/restore, pilot light, warm standby, or active-active. Test failover. Data replication, DNS routing, secrets, and runbooks must all work.

---

## Cost Questions

### How do you reduce cloud cost?

Right-size compute, buy commitments for stable baseline, use Spot for tolerant workloads, use storage lifecycle policies, stop unused resources, reduce unnecessary data transfer, and require tagging.

### What are common hidden costs?

NAT data processing, cross-AZ transfer, cross-region traffic, idle databases, unattached disks, old snapshots, high-volume logs, long retention, and load balancer hours.

### How do you balance cost and reliability?

Do not remove redundancy blindly. Understand the failure mode. One NAT Gateway is cheaper than one per AZ, but it creates a dependency that may not match production reliability goals.

---

## Staff-Level Questions

### How would you create cloud standards for many teams?

Build golden paths: account/project structure, network baseline, IAM model, service templates, observability, cost tags, and deployment patterns. Allow deviations only with clear ownership.

### Managed service or self-managed?

Compare operational burden, reliability target, team expertise, customization, cost, portability, compliance, and incident ownership. Managed services reduce toil but may reduce low-level control.

### What signals show cloud architecture is unhealthy?

Manual changes are common, cloud cost grows faster than traffic, production and staging differ heavily, logs are missing during incidents, roles are too broad, databases are too exposed, or backups are never restored in tests.

---

## Pressure Follow-Ups

### Where is the blast radius?

Identify the affected account/project, region, VPC, subnet, role, database, service, and users.

### What is the rollback story?

For infrastructure, revert Terraform or module versions. For applications, use the previous artifact. For databases, use compatible schema changes or tested restore paths.

### What would you centralize?

Account vending, network baselines, audit logging, IAM guardrails, cost allocation, observability standards, and secure templates.

### What would you delegate?

Application-specific scaling, service-level alerts, feature architecture, and non-production experimentation inside platform guardrails.
