---
title: "EC2 Basics"
sidebar_position: 3
---

# EC2 Basics

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

EC2 is the familiar VM model in AWS. The reason it still matters is control. When you need OS-level tuning, custom agents, legacy software, special networking, GPUs, or predictable long-running compute, EC2 is still a core primitive.

An EC2 instance is not just "a server." It is a bundle of choices: AMI, instance type, subnet, security group, IAM instance profile, EBS root volume, user data, placement, monitoring, and purchasing model. Every choice has operational consequences. The AMI decides boot contents and patch level. The instance type decides CPU, memory, network, EBS bandwidth, and sometimes local storage. The subnet decides AZ and routing. The security group decides allowed network paths. The IAM role decides AWS API power from inside the instance.

User data is often misunderstood. It is bootstrapping, not a complete deployment platform. If production depends on a 400-line user data script that downloads packages from the internet, clones a repo, builds code, and starts services without failure reporting, autoscaling becomes fragile. A better model is baked AMIs or container images plus small startup config.

Failure modes:

- instance launches but application never starts
- app starts but target group health check fails
- instance has no IAM role or wrong role
- user data fails because private subnet lacks NAT or VPC endpoints
- instance type is wrong for bottleneck
- burstable instance runs out of CPU credits

Debugging method:

```text
Check instance status checks, system logs, cloud-init/user-data logs, systemd service
status, listening ports, security group paths, IAM role, and target health reason codes.
```

AWS docs:

- EC2 instance types: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html
