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

---

## Key Configuration Choices

| Option | Why It Matters |
|---|---|
| AMI | Base image, OS version, pre-installed packages, patch level |
| Instance type | CPU, memory, network bandwidth, EBS throughput profile |
| User data | Bootstrap script run once at first launch |
| Security group | Stateful allow rules for inbound/outbound traffic |
| IAM instance profile | AWS API permissions from inside the instance |
| EBS volumes | Persistent block storage, survives stop/start |
| Placement group | Network latency control, hardware spread, or fault isolation |
| Key pair | SSH access credential (prefer Session Manager instead) |

## Instance Families: Decision Guide

| Family | Use Case | Examples |
|---|---|---|
| General purpose (T, M) | balanced workloads, web servers | t3.medium, m6i.xlarge |
| Compute optimized (C) | CPU-heavy: batch, media encoding, HPC | c6i.4xlarge |
| Memory optimized (R, X) | in-memory DBs, caches, analytics | r6i.8xlarge, x2iedn |
| Storage optimized (I, D, H) | high local IOPS, Hadoop, data warehousing | i4i.4xlarge |
| Accelerated (P, G, Inf) | GPU: ML training, inference, graphics | p4d.24xlarge |

**T-series instances are burstable.** CPU credits accumulate at idle and are spent at burst. Sustained CPU above baseline exhausts credits and causes performance throttle. Do not use T-series for sustained CPU workloads in production.

## User Data: Correct vs Fragile Patterns

Good user data:
```bash
#!/bin/bash
# Install agent
yum install -y amazon-ssm-agent
systemctl enable --now amazon-ssm-agent
# Pull config from SSM Parameter Store
aws ssm get-parameter --name /app/config --with-decryption --query Parameter.Value > /etc/app/config.json
```

Fragile user data (avoid):
```bash
#!/bin/bash
# Don't do this in production
git clone https://github.com/org/repo /app     # network dependency at launch
cd /app && pip install -r requirements.txt     # slow, fragile, no error handling
python app.py &                                # no supervision, errors hidden
```

Prefer baked AMIs (pre-installed software) plus small startup config fetched from SSM/S3.

## CLI: Common Operations

```bash
# Launch an instance
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.medium \
  --subnet-id subnet-12345678 \
  --security-group-ids sg-12345678 \
  --iam-instance-profile Name=my-instance-profile \
  --user-data file://bootstrap.sh

# Describe running instances with filter
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[*].Instances[*].{ID:InstanceId,Type:InstanceType,AZ:Placement.AvailabilityZone}"

# Get system log (useful for bootstrap debugging)
aws ec2 get-console-output --instance-id i-0abcdef1234567890

# Connect via Session Manager (no SSH key needed)
aws ssm start-session --target i-0abcdef1234567890
```

## Common Failure Modes and Fixes

| Failure | Root Cause | Debugging Step |
|---|---|---|
| Instance launches, app never starts | User data failed silently | Check `/var/log/cloud-init-output.log` |
| Target group health check fails | App not listening on expected port | Check `ss -tlnp`, app logs, SG rules |
| `AccessDenied` calling AWS APIs | Missing or wrong IAM instance profile | `curl http://169.254.169.254/latest/meta-data/iam/security-credentials/` |
| User data fails in private subnet | No NAT Gateway or VPC endpoint for required packages | Add NAT GW or use baked AMI |
| CPU throttle on T-series instance | CPU credits exhausted | Switch to non-burstable type (m/c series) |
| Instance never passes status checks | Hardware/hypervisor issue | Stop and start (migrates to new host) |

## Interview Q&A

**Q: What is the difference between stopping and terminating an EC2 instance?**
A: Stop saves the EBS root volume and instance state — you can start it again later and pay only for EBS storage. Terminate permanently deletes the instance and, by default, the root EBS volume (unless delete-on-termination is disabled). Instance store data is always lost on stop or terminate.

**Q: What happens to instance store data when an instance is stopped?**
A: Instance store is physically attached ephemeral storage. The data is lost on stop, terminate, or hardware failure. Never use instance store as the only copy of important data. It is useful for caches, temp files, and replicated systems.

**Q: When would you choose EC2 over Lambda or ECS?**
A: EC2 when you need OS-level control (custom kernel modules, specific agents), software that requires long-running processes, specialized hardware (GPU, high local IOPS), predictable steady-state workloads with licensing constraints, or when debugging requires root access. For event-driven or containerized workloads, Lambda or ECS/Fargate usually require less operational overhead.
