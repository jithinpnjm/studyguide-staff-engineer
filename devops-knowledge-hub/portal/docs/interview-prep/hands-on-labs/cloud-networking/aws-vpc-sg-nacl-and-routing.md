---
title: "Cloud Networking Drill 3: AWS VPC, Security Groups, NACLs, And Routing"
sidebar_position: 3
---

# Cloud Networking Drill 3: AWS VPC, Security Groups, NACLs, And Routing

## Production Context

Your team runs a multi-tier application in AWS: a public ALB, app servers in private
subnets, and an RDS PostgreSQL in a database subnet. At 22:14 UTC a deploy script
modified security groups as part of a "least-privilege tightening" change. Within three
minutes, app servers could no longer reach the database. A separate incident the following
morning: database backup jobs started timing out from Lambda functions in a different
AZ. Both incidents involve the same VPC. Your job is to reason through the exact AWS
constructs involved and explain them as if in a technical interview.

---

## Prerequisites

- AWS account with a VPC, EC2 instances, or willingness to reason through paper scenarios
- `aws` CLI configured (optional — this drill can be done with reasoning + console)
- Familiarity with the AWS console for VPC, EC2, and RDS dashboards

---

## Beginner Section: AWS VPC Networking Fundamentals

### Step 1 — Understand the AWS VPC scope model

AWS VPC is regional. Unlike GCP, a single VPC does not span regions:

```
AWS Region: us-east-1
  VPC: 10.0.0.0/16
    AZ: us-east-1a
      Subnet: 10.0.1.0/24  (public)
      Subnet: 10.0.2.0/24  (private app)
      Subnet: 10.0.3.0/24  (private database)
    AZ: us-east-1b
      Subnet: 10.0.4.0/24  (public)
      Subnet: 10.0.5.0/24  (private app)
      Subnet: 10.0.6.0/24  (private database)
    AZ: us-east-1c
      Subnet: 10.0.7.0/24  (public)
      Subnet: 10.0.8.0/24  (private app)
      Subnet: 10.0.9.0/24  (private database)
```

Every subnet lives in exactly one AZ. For high availability, you replicate subnets
across at least two AZs (three is better). Route tables are associated per subnet —
this is a key difference from GCP where routes are VPC-wide.

### Step 2 — Understand the routing model (where most AWS confusion lives)

Every subnet has an associated route table. Routing decisions in AWS:

```bash
# View route tables in the VPC
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-0abc1234def56789" \
  --query 'RouteTables[*].{RTID:RouteTableId,SubnetAssoc:Associations[*].SubnetId,Routes:Routes}'
```

Expected output for the public subnet route table:

```json
[
  {
    "RTID": "rtb-0public1234",
    "SubnetAssoc": ["subnet-0abc1234"],
    "Routes": [
      {"DestinationCidrBlock": "10.0.0.0/16", "GatewayId": "local", "State": "active"},
      {"DestinationCidrBlock": "0.0.0.0/0",   "GatewayId": "igw-0xyz789", "State": "active"}
    ]
  }
]
```

Expected output for the private subnet route table:

```json
[
  {
    "RTID": "rtb-0private5678",
    "SubnetAssoc": ["subnet-0def5678", "subnet-0ghi9012"],
    "Routes": [
      {"DestinationCidrBlock": "10.0.0.0/16", "GatewayId": "local", "State": "active"},
      {"DestinationCidrBlock": "0.0.0.0/0",   "NatGatewayId": "nat-0mno3456", "State": "active"}
    ]
  }
]
```

What makes a subnet "public": having a route for `0.0.0.0/0` pointing to an **Internet
Gateway** (`igw-`). What makes a subnet "private": having `0.0.0.0/0` pointing to a
**NAT Gateway** (`nat-`) or having no default route at all.

The route table association is what determines whether instances in that subnet can
reach the internet. The subnet name ("public-subnet") is just a label — the route
table is what matters.

### Step 3 — Security Groups vs NACLs: the critical operational difference

This is the most commonly confused topic in AWS networking interviews:

| Property | Security Group (SG) | Network ACL (NACL) |
|----------|--------------------|--------------------|
| Applied to | ENI (elastic network interface) | Subnet |
| Statefulness | **Stateful** — return traffic automatic | **Stateless** — return traffic needs explicit rule |
| Rule evaluation | All rules evaluated, most permissive wins | Rules evaluated in order, first match wins |
| Default | Deny all inbound, allow all outbound | Allow all (default NACL) |
| Scope | Can span AZs | One NACL per subnet |

**Stateful vs stateless — the failure mode that caught the backup jobs:**

If you allow inbound traffic from Lambda (port 5432) in the RDS security group, the SG
automatically allows the response packets out. You do not need an explicit outbound rule
for responses.

But if you apply a NACL to the database subnet:
```
NACL Inbound rules:
100  ALLOW  TCP  0.0.0.0/0  5432
*    DENY   ALL

NACL Outbound rules:
100  ALLOW  TCP  0.0.0.0/0  443   (HTTPS only — missing ephemeral port range)
*    DENY   ALL
```

The Lambda function connects on port 5432. The response from RDS uses an **ephemeral
port** on the client side (range 1024-65535 or 32768-60999 depending on OS). The NACL
outbound rule only allows port 443. So the response packet is blocked by the NACL
outbound rule even though the SG would have allowed it.

### Step 4 — Diagnose the SG incident (app cannot reach database)

After the least-privilege tightening, the app-to-database connection broke. Check the
database security group:

```bash
aws ec2 describe-security-groups \
  --group-ids sg-0db1234 \
  --query 'SecurityGroups[*].IpPermissions'
```

Expected output showing the broken rule:

```json
[
  {
    "FromPort": 5432,
    "ToPort": 5432,
    "IpProtocol": "tcp",
    "IpRanges": [
      {
        "CidrIp": "10.0.2.0/24",
        "Description": "app subnet a"
      }
    ]
  }
]
```

The rule allows `10.0.2.0/24` (AZ-a app subnet) but the tightening script removed the
`10.0.5.0/24` (AZ-b app subnet) rule. App servers in AZ-b can no longer reach the
database. Fix:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.5.0/24 \
  --tag-specifications 'ResourceType=security-group-rule,Tags=[{Key=Description,Value="app subnet b - restored"}]'
```

Better long-term fix: reference the app security group ID instead of CIDRs:

```bash
# Rule: allow from any instance that has sg-0app5678 attached
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-0app5678
```

SG-to-SG references are more maintainable than CIDR rules because they do not break
when you add a new AZ or change your subnet CIDR allocation.

### Step 5 — Fix the NACL for Lambda backup jobs

Lambda functions use ephemeral source ports. The NACL outbound rule must allow the
ephemeral port range for responses to reach the Lambda:

```bash
aws ec2 create-network-acl-entry \
  --network-acl-id acl-0db9876 \
  --ingress \
  --rule-number 90 \
  --protocol tcp \
  --port-range From=5432,To=5432 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow

# Add the missing egress rule for ephemeral ports
aws ec2 create-network-acl-entry \
  --network-acl-id acl-0db9876 \
  --egress \
  --rule-number 90 \
  --protocol tcp \
  --port-range From=1024,To=65535 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow
```

### Step 6 — Internet-facing vs internal ALB

```bash
# Check whether an ALB is internet-facing or internal
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[*].{Name:LoadBalancerName,Scheme:Scheme,Subnets:AvailabilityZones[*].SubnetId}'
```

Expected output:

```json
[
  {
    "Name": "inference-api-alb",
    "Scheme": "internet-facing",
    "Subnets": ["subnet-0abc1234", "subnet-0def5678"]
  },
  {
    "Name": "internal-services-alb",
    "Scheme": "internal",
    "Subnets": ["subnet-0ghi9012", "subnet-0jkl3456"]
  }
]
```

`internet-facing` ALB: must be in public subnets (with IGW route), gets a public DNS
name that resolves to public IPs. Clients on the internet can reach it.

`internal` ALB: must be in private subnets, gets a DNS name that resolves to private
IPs within the VPC only. External clients cannot reach it without VPN or Direct Connect.

The subnets you assign to an ALB must have a route to an IGW (for internet-facing) or
NAT/nothing (for internal). If you accidentally put an internet-facing ALB in a private
subnet — it will still create, but health checks will fail because the ALB nodes cannot
receive internet traffic.

---

## Intermediate Section: Diagnose Without Full Hints

You receive this configuration diff from the deploy script that triggered the incident:

```diff
# security_group_rules.tf
resource "aws_security_group_rule" "db_from_app" {
-  type        = "ingress"
-  from_port   = 5432
-  to_port     = 5432
-  protocol    = "tcp"
-  source_security_group_id = aws_security_group.app.id
-  security_group_id = aws_security_group.db.id
+  type        = "ingress"
+  from_port   = 5432
+  to_port     = 5432
+  protocol    = "tcp"
+  cidr_blocks = ["10.0.2.0/24"]  # only AZ-a app subnet
+  security_group_id = aws_security_group.db.id
}
```

Questions without hints:

1. What is the exact failure mode this creates, and in which AZ does it manifest?
2. Why is the original (SG-to-SG reference) approach more correct than the CIDR approach?
3. Write the Terraform that correctly restores multi-AZ access without using CIDR blocks.
4. How would you use AWS CloudTrail to find which IAM principal applied this change
   and at what exact time?

---

## Advanced / Stretch

**Scenario A — VPC Flow Logs for incident forensics**

Enable VPC Flow Logs on the database subnet and parse the output:

```bash
aws ec2 create-flow-logs \
  --resource-type Subnet \
  --resource-ids subnet-0ghi9012 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/database-subnet \
  --deliver-logs-permission-arn arn:aws:iam::123456789:role/FlowLogsRole
```

A VPC Flow Log record looks like:

```
2 123456789012 eni-0abc1234 10.0.5.22 10.0.3.15 49823 5432 6 18 2340 1712678234 1712678294 ACCEPT OK
```

Decode: account, ENI, source IP, dest IP, source port, dest port, protocol (6=TCP),
packets, bytes, start, end, action (ACCEPT/REJECT), log-status.

A `REJECT` record for a connection you expected to be accepted means either a SG or
NACL blocked it. Write the CloudWatch Insights query that counts REJECT records grouped
by source IP and destination port for the last 1 hour.

**Scenario B — NAT Gateway and Egress costs**

Your cost report shows $450/month on NAT Gateway data processing charges. Explain the
per-GB pricing model. Write the strategy to reduce costs using: S3 Gateway Endpoints
(free, replace S3 traffic through NAT), Interface Endpoints for other services, and
routing optimization to keep intra-region traffic off NAT.

**Scenario C — Transit Gateway for multi-VPC connectivity**

Design a hub-and-spoke model using Transit Gateway where:
- Shared-services VPC contains DNS, monitoring, and bastion hosts
- Each team VPC peers through the TGW to shared-services
- Team VPCs are isolated from each other (no east-west between teams)

Explain the route table attachments required, and why you need separate TGW route
tables for the shared-services spoke versus the team spokes to enforce isolation.

---

## Sample Architecture Explanation (Interview-Ready)

```
AWS multi-tier architecture for ML inference:

Routing:
  Public subnets (ALB, NAT GWs): route 0.0.0.0/0 → Internet Gateway
  Private app subnets: route 0.0.0.0/0 → NAT Gateway (per AZ for HA)
  Private database subnets: no default route (database initiates no outbound)

Security Groups (stateful, allow-only):
  ALB SG:      inbound 443 from 0.0.0.0/0; outbound to app SG on 8080
  App SG:      inbound 8080 from ALB SG only; outbound 5432 to DB SG; outbound 443 for egress
  DB SG:       inbound 5432 from App SG only; outbound 443 for AWS API calls

NACLs:
  Public subnets:   allow inbound 443/80, ephemeral ports 1024-65535; matching egress
  Private subnets:  allow inbound from VPC CIDR; allow outbound to VPC CIDR and internet
  Database subnets: allow inbound 5432 from app CIDR; outbound ephemeral 1024-65535 to app CIDR

Key decisions:
  - SG rules reference other SG IDs, not CIDRs → survives subnet changes
  - NAT Gateway per AZ → AZ failure doesn't break egress in surviving AZs
  - Database subnet has no IGW route → even a misconfigured SG cannot expose it publicly
  - S3 and DynamoDB accessed via Gateway Endpoints → no NAT charges

Incident pattern: changing SG rules from SG-to-SG references to CIDR rules is a common
"tightening" mistake that silently breaks multi-AZ traffic when only one AZ's CIDR is
included.
```

---

## Common Mistakes

- **Confusing SG and NACL statefulness.** SG is stateful (return traffic automatic).
  NACL is stateless (you must explicitly allow ephemeral ports for return traffic).
  Getting this wrong causes intermittent failures that look like packet loss.
- **Using CIDR rules in SGs instead of SG references.** CIDR rules break when you add
  an AZ or change subnet allocation. SG-to-SG references are resilient to topology changes.
- **NAT Gateway in one AZ.** If the NAT Gateway AZ fails, all private instances in other
  AZs lose internet access. Deploy one NAT Gateway per AZ with separate route tables.
- **Not checking route table associations after subnet changes.** A new subnet not
  associated with the correct route table gets the main route table (often the public one),
  potentially making it a public subnet accidentally.
- **Thinking NACL rule order doesn't matter.** Unlike SGs, NACLs stop at the first
  match. Rule 100 ALLOW followed by rule 110 DENY does not apply both — rule 100 wins.

---

## What To Study Next

- AWS VPC CIDR design: secondary CIDRs, IPv6 dual-stack
- Security Group referencing: same-region SG references, cross-account SG references
- NACL rule numbering conventions and how to leave gaps for future rules
- AWS PrivateLink vs VPC Peering vs Transit Gateway: when to use each
- VPC Flow Logs + CloudWatch Insights for network forensics
- AWS Network Firewall for deep packet inspection beyond SG/NACL capabilities
