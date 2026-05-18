---
title: "EC2 Networking: Public IP, Private IP, ENI, Elastic IP"
sidebar_position: 5
---

# EC2 Networking: Public IP, Private IP, ENI, Elastic IP

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The slide deck spends time on public/private IPs and ENIs because AWS networking is attached to elastic network interfaces. An ENI is the network identity of a workload. Security groups attach to ENIs. Private IPs live on ENIs. Many managed services create ENIs in your VPC, including Lambda in VPC, RDS, ECS tasks in `awsvpc` mode, and EKS pods with VPC CNI behavior.

Public IPs are reachable from the internet only when routing and security allow it. Private IPs are used inside the VPC and connected networks. Elastic IPs are static public IPv4 addresses, but they are often a smell if used to preserve a fragile pet server. Prefer load balancers, DNS, and autoscaling for resilient services.

Failure mode: replacing an instance changes its public IP, breaking clients that hardcoded it. Senior design avoids this by using DNS and load balancers.

---

## IP Types Comparison

| Type | Persistence | Reachable From | Notes |
|---|---|---|---|
| Private IP | Persists while instance exists | Within VPC and connected networks | Always assigned; used for internal communication |
| Public IP (auto-assigned) | Lost on stop/start | Internet (if subnet and SG allow) | Changes on every start — do not hardcode |
| Elastic IP | Stays until released | Internet | Static public IPv4; costs money when not attached |
| IPv6 | Assigned per ENI | Internet (no NAT needed) | Global unicast; security group controls inbound |

## Elastic Network Interface (ENI)

An ENI is the virtual network card. Security groups attach to ENIs, not to instances directly. Key properties:

- Primary ENI created with the instance; secondary ENIs can be attached
- Each ENI has: primary private IP, optional secondary private IPs, optional public IP, optional Elastic IP, security groups, MAC address
- Fargate tasks, Lambda in VPC, RDS, EKS pods, and load balancers all create ENIs in your VPC subnets
- **IP address exhaustion** occurs when a subnet runs out of available IPs (ENIs consume IPs, not just instances)

```text
ENI use cases:
  - Dual-homed instances (ENI in two subnets for traffic separation)
  - Move ENI between instances (preserves private IP and SG, enables failover)
  - Network appliances (firewall, packet inspection) via multiple ENIs
  - EKS VPC CNI (each pod gets its own ENI IP)
```

## Elastic IP: When to Use (and When Not To)

| Good Use | Better Alternative |
|---|---|
| NAT instance (legacy) | NAT Gateway |
| Fixed IP needed for firewall allowlist | Elastic IP on NLB (NLB supports static Elastic IPs) |
| Rapid failover by remapping EIP to new instance | Route 53 health-checked DNS failover or ALB |
| Bastion/jump host | Session Manager (no public IP needed) |

**Elastic IPs cost money when not attached to a running instance.** They are also limited per account per Region (default 5). An Elastic IP on a healthy NLB is a valid pattern for partner firewall allowlisting.

## CLI: IP and ENI Operations

```bash
# Allocate an Elastic IP
aws ec2 allocate-address --domain vpc

# Associate Elastic IP with an instance
aws ec2 associate-address \
  --instance-id i-0abcdef1234567890 \
  --allocation-id eipalloc-12345678

# Describe ENIs in a subnet
aws ec2 describe-network-interfaces \
  --filters "Name=subnet-id,Values=subnet-12345678" \
  --query "NetworkInterfaces[*].{ID:NetworkInterfaceId,IP:PrivateIpAddress,Status:Status,Description:Description}"

# Find which resource owns an ENI (useful for diagnosing IP usage)
aws ec2 describe-network-interfaces \
  --filters "Name=private-ip-address,Values=10.0.11.45" \
  --query "NetworkInterfaces[*].{ID:NetworkInterfaceId,Desc:Description,Owner:Attachment.InstanceId}"

# Release an unattached Elastic IP (stops billing)
aws ec2 release-address --allocation-id eipalloc-12345678
```

## Common Failure Modes

| Failure | Root Cause | Fix |
|---|---|---|
| App stops working after instance restart | Clients hardcoded auto-assigned public IP | Use DNS/load balancer in front of instances; never expose instance IP directly |
| Fargate tasks/EKS pods fail to start | Subnet IP exhaustion (ENIs consumed all IPs) | Increase subnet CIDR; use secondary CIDRs; reduce IP pre-allocation if using EKS |
| EIP cost unexpected | Elastic IP allocated but not attached | Audit unattached EIPs; release unused ones |
| Connection refused after failover | NLB not updated; DNS cached old EIP | Route 53 with short TTL + health checks; or EIP remap automation |

## Interview Q&A

**Q: What is the difference between a public IP and an Elastic IP?**
A: A public IP auto-assigned to an instance is ephemeral — it changes when the instance is stopped and started. An Elastic IP is a static public IPv4 address that persists until you explicitly release it. You can remap an EIP to a different instance for manual failover, but this is slower than DNS or load balancer-based failover and should not be your primary HA mechanism.

**Q: Why might an EKS or ECS cluster run out of IP addresses in a subnet?**
A: EKS with VPC CNI assigns each pod a real VPC IP. Each node pre-allocates a pool of IPs. If subnet CIDRs are too small (e.g., /24 with 251 usable IPs) and the cluster grows, IP exhaustion occurs. ECS Fargate in `awsvpc` mode also gives each task its own ENI and IP. Plan subnet sizes based on max expected workload IPs, not just instance count.
