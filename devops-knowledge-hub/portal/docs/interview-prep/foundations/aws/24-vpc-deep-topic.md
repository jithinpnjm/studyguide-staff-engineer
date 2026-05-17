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
