---
title: "VPC Deep Topic"
sidebar_position: 24
---

# VPC Deep Topic

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF VPC section is long because networking is where many AWS interviews become real. You must understand CIDR, subnets, route tables, IGW, NAT, NACLs, security groups, peering, endpoints, flow logs, VPN, Direct Connect, Transit Gateway, IPv6, network cost, and Network Firewall.

The deepest mental model:

```text
Security group = stateful firewall attached to ENI/resource
NACL = stateless subnet boundary rules
Route table = next-hop decision
IGW = internet path for public subnets
NAT Gateway = outbound IPv4 translation for private subnets
VPC endpoint = private path to AWS service
Transit Gateway = cloud router for many networks
```

Junior engineers memorize definitions. Senior engineers trace packets.

---

## VPC Layout: Standard 3-Tier Design

```text
VPC: 10.0.0.0/16

  Public subnets (one per AZ):
    10.0.1.0/24 (AZ-A) — ALB, NAT Gateway
    10.0.2.0/24 (AZ-B) — ALB, NAT Gateway

  Private app subnets:
    10.0.11.0/24 (AZ-A) — EC2, ECS, EKS nodes
    10.0.12.0/24 (AZ-B) — EC2, ECS, EKS nodes

  Private data subnets:
    10.0.21.0/24 (AZ-A) — RDS, ElastiCache
    10.0.22.0/24 (AZ-B) — RDS, ElastiCache
```

**A subnet is public because its route table has a route to an Internet Gateway.** The absence of that route is what makes a subnet private.

## Route Tables

| Route | Next Hop | Subnet Type |
|---|---|---|
| `0.0.0.0/0` | Internet Gateway | Public subnet (outbound internet) |
| `0.0.0.0/0` | NAT Gateway | Private subnet (outbound internet for patches/APIs) |
| `pl-xxxxxxxx` (S3 prefix list) | Gateway VPC Endpoint | Private subnet (S3 without NAT) |
| `10.0.0.0/16` | local | All subnets (VPC-internal traffic always local) |

## Security Group vs NACL

| Property | Security Group | NACL |
|---|---|---|
| Level | Resource (ENI) | Subnet boundary |
| Stateful | Yes — return traffic automatically allowed | No — both directions must be explicitly allowed |
| Rules | Allow only | Allow and Deny |
| Rule evaluation | All rules evaluated | Rules evaluated in order by number |
| Best for | Primary access control per resource | Coarse subnet guardrail, blocking known-bad CIDRs |

**Classic 3-tier security group pattern:**
```text
ALB SG:    inbound 443 from 0.0.0.0/0
App SG:    inbound app-port from ALB SG (reference SG, not CIDR)
DB SG:     inbound 5432/3306 from App SG
```

## VPC Endpoints: NAT Cost Reduction and Security

| Type | Services | Use Case |
|---|---|---|
| Gateway endpoint | S3, DynamoDB | Free; route table entry; private path within VPC |
| Interface endpoint (PrivateLink) | Most AWS APIs (SSM, ECR, Secrets Manager, etc.) | Paid per hour + data; private DNS; no internet needed |

**Why this matters for SRE:** Private workloads pulling large container images from ECR or sending logs to CloudWatch through NAT Gateway pay per GB of data processed. Gateway endpoints for S3 and interface endpoints for ECR and CloudWatch Logs eliminate that cost and improve security posture.

## VPC Flow Logs

Flow logs capture IP traffic metadata (not payload) at the ENI, subnet, or VPC level.

```text
version srcaddr dstaddr srcport dstport protocol packets bytes action
2       10.0.1.5  10.0.11.10  54321  443  6  10  5000  ACCEPT
2       10.0.1.5  10.0.11.10  54321  22   6   2   120   REJECT
```

Use flow logs for:
- Security group / NACL troubleshooting (REJECT vs ACCEPT)
- Detecting unexpected egress (private IP calling internet IP)
- NAT cost investigation (find top talkers)
- Incident timeline reconstruction

## NAT Gateway: Cost and HA Pattern

**Per-AZ NAT Gateway** is best practice:
```text
AZ-A public subnet: NAT Gateway-A
AZ-B public subnet: NAT Gateway-B

Private subnet AZ-A route: 0.0.0.0/0 -> NAT GW-A
Private subnet AZ-B route: 0.0.0.0/0 -> NAT GW-B
```

If you use a single NAT Gateway in one AZ and route all private subnets through it:
1. Cross-AZ data transfer charges accumulate
2. If that AZ fails, all private subnets lose internet

## Advanced Connectivity

| Service | Use Case |
|---|---|
| VPC Peering | Direct traffic between two VPCs; no transitive routing |
| Transit Gateway | Hub-and-spoke for many VPCs; supports transitive routing |
| Site-to-Site VPN | IPSec tunnels over internet to on-premises |
| Direct Connect | Dedicated private connection to AWS; consistent latency |
| PrivateLink | Expose a service in one VPC to consumers in other VPCs without peering |

**VPC Peering is not transitive.** If VPC-A peers with VPC-B and VPC-B peers with VPC-C, VPC-A cannot reach VPC-C through VPC-B. Transit Gateway solves this.

## CLI: Useful Debugging Commands

```bash
# List route tables for a VPC
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=vpc-12345678" \
  --query "RouteTables[*].{ID:RouteTableId,Routes:Routes}"

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-12345678 \
  --query "SecurityGroups[*].IpPermissions"

# Enable VPC Flow Logs to CloudWatch Logs
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-12345678 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /vpc/flow-logs \
  --deliver-logs-permission-arn arn:aws:iam::123456789012:role/flow-logs-role

# Check VPC endpoints
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=vpc-12345678"

# Describe NAT Gateways
aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=vpc-12345678"
```

## Failure Mode Playbook

| Failure | Debugging Checklist |
|---|---|
| Service unreachable from internet | DNS answer -> ALB listener -> SG allows 443 from 0.0.0.0/0 -> target health |
| App can't reach internet (private subnet) | Route table has `0.0.0.0/0` -> NAT GW -> NAT GW is in public subnet -> NAT GW public subnet has IGW route |
| App can't reach S3 (private subnet) | Gateway VPC endpoint exists for S3 -> route table has prefix list entry -> endpoint policy allows access |
| Cross-account PrivateLink not connecting | Interface endpoint service must be in same Region; check SG on endpoint, check endpoint policy |
| One AZ fails, entire app down | NAT GW is in the failed AZ; all private subnets routed through it; fix: per-AZ NAT GW |

## Interview Q&A

**Q: How do you trace why traffic from a Lambda in a private subnet can't reach an S3 bucket?**
A: Check: 1) does the Lambda's VPC have a gateway endpoint for S3? If not, traffic goes through NAT. 2) Does the route table for the Lambda's subnet include the S3 prefix list pointing to the gateway endpoint? 3) Does the endpoint policy allow the Lambda role's access? 4) Does the S3 bucket policy allow the VPC endpoint? Use CloudTrail to confirm whether the S3 API call reached S3 at all.

**Q: What is the difference between a Security Group and a NACL?**
A: Security groups are stateful (return traffic is automatically allowed), apply at the resource/ENI level, and only support allow rules. NACLs are stateless (both directions must be explicitly allowed including ephemeral ports), apply at the subnet boundary, and support both allow and deny. Use SGs as your primary control; NACLs as coarse subnet guardrails.

**Q: Why is a single NAT Gateway an availability risk?**
A: NAT Gateways are zonal. If you use one NAT Gateway in AZ-A and route all private subnets through it, an AZ-A failure takes away internet access for private instances in all AZs. Best practice is one NAT Gateway per AZ with per-AZ routing in private subnet route tables.
