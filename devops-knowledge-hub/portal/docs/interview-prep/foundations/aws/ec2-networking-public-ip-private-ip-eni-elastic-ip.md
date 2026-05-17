---
title: "EC2 Networking: Public IP, Private IP, ENI, Elastic IP"
sidebar_position: 5
---

# EC2 Networking: Public IP, Private IP, ENI, Elastic IP

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The slide deck spends time on public/private IPs and ENIs because AWS networking is attached to elastic network interfaces. An ENI is the network identity of a workload. Security groups attach to ENIs. Private IPs live on ENIs. Many managed services create ENIs in your VPC, including Lambda in VPC, RDS, ECS tasks in `awsvpc` mode, and EKS pods with VPC CNI behavior.

Public IPs are reachable from the internet only when routing and security allow it. Private IPs are used inside the VPC and connected networks. Elastic IPs are static public IPv4 addresses, but they are often a smell if used to preserve a fragile pet server. Prefer load balancers, DNS, and autoscaling for resilient services.

Failure mode: replacing an instance changes its public IP, breaking clients that hardcoded it. Senior design avoids this by using DNS and load balancers.
