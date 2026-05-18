---
title: "More Solutions Architecture And Other Services"
sidebar_position: 26
---

# More Solutions Architecture And Other Services

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF's later architecture sections connect services into patterns: Lambda/SNS/SQS fanout, S3 events, EventBridge API call reactions, API Gateway service integrations, caching, IP blocking, HPC, HA EC2, CloudFormation, SES, Pinpoint, Systems Manager, Cost Explorer, Outposts, Batch, AppFlow, Amplify, and schedulers.

For interviews, explain patterns:

- Fanout: SNS to multiple SQS queues isolates consumers.
- S3 event processing: object upload triggers async workflow.
- API Gateway service integration: API calls AWS service without custom compute.
- IP blocking: WAF for HTTP, NACL/Network Firewall for network boundaries, SG for resource access.
- HPC: placement groups, high-network instances, FSx for Lustre, Batch.
- Systems Manager: operational access without opening SSH.
- CloudFormation: repeatable infrastructure with change sets and drift awareness.
- Cost Explorer/Anomaly Detection: cost as an operational signal.

---

## Key Architecture Patterns

### Fanout Pattern

```text
Event producer (S3, API, application)
  -> SNS Topic
    -> SQS Queue A (Team A consumer, own DLQ, own retry policy)
    -> SQS Queue B (Team B consumer, independent failure)
    -> Lambda C (immediate processing)
    -> EventBridge (for routing to other systems)
```

Each consumer is isolated. Team A's consumer crashing does not delay Team B's processing.

### S3 Event-Driven Processing

```text
User uploads file to S3
  -> SQS (buffer between S3 event and Lambda — prevents lost events on throttle)
    -> Lambda or ECS worker
      -> Process file (resize, scan, extract)
      -> Store result in S3 / DynamoDB
      -> Notify via SNS/EventBridge
```

Use SQS between S3 event and Lambda to avoid lost events. Lambda throttling can cause missed events if called directly without a buffer queue.

### IP Blocking: Layered Defense

| Layer | Service | Controls |
|---|---|---|
| Edge (internet entry) | CloudFront + WAF | HTTP rules, IP sets, rate limiting, geo-blocking |
| Network boundary | NACL | Subnet-level stateless IP block/allow |
| Application boundary | Security Group | Instance/task-level allow rules (allow only, no deny) |
| Network inspection | AWS Network Firewall | Stateful DPI, domain filtering, egress control |

## Systems Manager: Operations Without SSH

| SSM Feature | Purpose |
|---|---|
| Session Manager | Shell access to EC2/ECS without SSH port; sessions logged to CloudWatch/S3 |
| Run Command | Execute commands across instances by tag; no SSH needed |
| Patch Manager | Automated OS patching with maintenance windows |
| Parameter Store | Config and secrets storage |
| Automation | Multi-step operational workflows |
| Fleet Manager | View and manage EC2 instances from console |

```bash
# Start a session (no SSH key needed, no port 22 needed)
aws ssm start-session --target i-0abcdef1234567890

# Run a command across instances by tag
aws ssm send-command \
  --targets "Key=tag:Environment,Values=production" \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["systemctl status my-app"]}' \
  --output text
```

**Prefer Session Manager over bastion SSH:** no public IP needed, no key management, full session audit logging, access controlled by IAM.

## Cost Engineering Signals

Cost spikes are operational signals. Common causes and fixes:

```text
NAT Gateway data processing spike:
  -> Private workloads pulling from S3/ECR through NAT
  -> Fix: add VPC Gateway endpoint (S3/DynamoDB free) and interface endpoints

CloudWatch Logs ingestion growing:
  -> DEBUG logging in production
  -> Fix: set log level to WARN/ERROR; add log group retention policies

Idle EC2/RDS/ELB:
  -> Resources provisioned but not serving traffic
  -> Fix: Compute Optimizer right-sizing; tag-based cost ownership

Old EBS snapshots and S3 versions never expiring:
  -> Fix: lifecycle policies on S3 buckets; EBS snapshot lifecycle manager
```

**Cost tools:** Cost Explorer (historical analysis), Budgets (threshold alerts), Cost Anomaly Detection (ML-based spike detection), Compute Optimizer (right-sizing recommendations), Trusted Advisor (idle resources).

## CloudFormation Best Practices

```bash
# Preview changes before applying (change set)
aws cloudformation create-change-set \
  --stack-name my-stack \
  --template-body file://template.yaml \
  --change-set-name my-changes

aws cloudformation describe-change-set \
  --stack-name my-stack \
  --change-set-name my-changes

# Apply the change set
aws cloudformation execute-change-set \
  --stack-name my-stack \
  --change-set-name my-changes

# Detect drift (resources changed outside CloudFormation)
aws cloudformation detect-stack-drift --stack-name my-stack
```

## Interview Q&A

**Q: How would you block a malicious IP address hitting your AWS application?**
A: Layer the response: 1) Add the IP to a WAF IP set blocking rule (immediate, HTTP-level, works on CloudFront or ALB). 2) Add a NACL deny rule for the CIDR at the subnet level (stateless, blocks all protocols). 3) For persistent network-level filtering with domain blocking and logging, consider Network Firewall. WAF is fastest for web layer; NACL for network layer; Security Groups cannot add deny rules.

**Q: Why is Session Manager better than a bastion host?**
A: Bastion hosts require a public IP, open port 22, SSH key management, and patching of the bastion itself. Session Manager requires no open ports, no public IP on the target, no SSH keys, and sessions are logged to CloudWatch Logs for audit. Access is controlled by IAM. It eliminates an attack surface while improving auditability.

**Q: What does a CloudFormation change set protect against?**
A: Change sets show exactly which resources will be created, modified (with or without replacement), or deleted before you apply. This prevents surprises from template updates that accidentally replace or delete critical resources like databases or load balancers. Always create and review a change set before executing an update to a production stack.
