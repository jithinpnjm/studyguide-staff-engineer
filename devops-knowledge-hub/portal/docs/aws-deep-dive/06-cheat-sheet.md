---
title: "Cheat Sheet"
sidebar_position: 6
---

# AWS Deep Dive — Cheat Sheet

Quick reference for AWS CLI commands, IAM patterns, VPC concepts, EKS operations, cost choices, and service limits. Bookmark this for on-call and interview prep.

---

## AWS CLI Quick Reference

### Configure

```bash
# Configure a named profile
aws configure --profile production
# Prompts: AWS Access Key ID, Secret, Region, Output format

# Use a profile for a single command
aws s3 ls --profile production

# Set region for a command
aws ec2 describe-instances --region eu-west-1

# Show current caller identity (confirm which role/user is active)
aws sts get-caller-identity

# Assume a role and export temporary credentials
CREDS=$(aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/prod-deploy \
  --role-session-name deploy-session \
  --query 'Credentials' --output json)

export AWS_ACCESS_KEY_ID=$(echo $CREDS | jq -r .AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $CREDS | jq -r .SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $CREDS | jq -r .SessionToken)
```

---

### S3

```bash
# List buckets
aws s3 ls

# List objects in a bucket (with size and date)
aws s3 ls s3://my-bucket --human-readable --summarize

# Copy file to S3
aws s3 cp local-file.txt s3://my-bucket/prefix/local-file.txt

# Copy from S3 to local
aws s3 cp s3://my-bucket/prefix/file.txt ./file.txt

# Sync a directory to S3 (uploads only changed/new files)
aws s3 sync ./local-dir/ s3://my-bucket/prefix/

# Recursive delete of a prefix
aws s3 rm s3://my-bucket/prefix/ --recursive

# Check bucket public access block settings
aws s3api get-public-access-block --bucket my-bucket

# Enable versioning
aws s3api put-bucket-versioning --bucket my-bucket \
  --versioning-configuration Status=Enabled

# List object versions (for recovery)
aws s3api list-object-versions --bucket my-bucket --prefix important-config.json

# Get a specific version of an object
aws s3api get-object \
  --bucket my-bucket --key important-config.json \
  --version-id xyzVersionId recovered.json
```

---

### EC2

```bash
# List running instances (name, ID, type, state, private IP)
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].[Tags[?Key==`Name`]|[0].Value,InstanceId,InstanceType,State.Name,PrivateIpAddress]' \
  --output table

# Describe a specific instance
aws ec2 describe-instances --instance-ids i-0123456789abcdef0

# Start/stop/terminate
aws ec2 start-instances --instance-ids i-0123456789abcdef0
aws ec2 stop-instances --instance-ids i-0123456789abcdef0
aws ec2 terminate-instances --instance-ids i-0123456789abcdef0

# Describe security groups for an instance
aws ec2 describe-instances --instance-ids i-0abc \
  --query 'Reservations[].Instances[].SecurityGroups'

# List all security groups (ID, name, description)
aws ec2 describe-security-groups \
  --query 'SecurityGroups[].[GroupId,GroupName,Description]' --output table

# Describe VPCs
aws ec2 describe-vpcs --query 'Vpcs[].[VpcId,CidrBlock,Tags[?Key==`Name`]|[0].Value]' --output table

# Describe subnets in a VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'Subnets[].[SubnetId,CidrBlock,AvailabilityZone,Tags[?Key==`Name`]|[0].Value]' \
  --output table
```

---

### EKS

```bash
# Update kubeconfig for a cluster
aws eks update-kubeconfig --name my-cluster --region us-east-1

# Update kubeconfig with a specific role
aws eks update-kubeconfig \
  --name my-cluster \
  --region us-east-1 \
  --role-arn arn:aws:iam::123456789012:role/eks-admin

# List clusters
aws eks list-clusters

# Describe cluster (version, endpoint, status)
aws eks describe-cluster --name my-cluster \
  --query 'cluster.[name,version,status,endpoint]'

# List node groups
aws eks list-nodegroups --cluster-name my-cluster

# Describe a node group
aws eks describe-nodegroup --cluster-name my-cluster --nodegroup-name managed-ng-1

# Scale a node group
aws eks update-nodegroup-config \
  --cluster-name my-cluster \
  --nodegroup-name managed-ng-1 \
  --scaling-config minSize=2,maxSize=10,desiredSize=4

# List add-ons
aws eks list-addons --cluster-name my-cluster

# Describe add-on
aws eks describe-addon --cluster-name my-cluster --addon-name coredns

# Update add-on to latest version
aws eks update-addon \
  --cluster-name my-cluster \
  --addon-name coredns \
  --resolve-conflicts OVERWRITE

# Upgrade cluster control plane
aws eks update-cluster-version \
  --name my-cluster \
  --kubernetes-version 1.30
```

---

### IAM

```bash
# Get caller identity (role/user in use)
aws sts get-caller-identity

# List roles matching a prefix
aws iam list-roles --query 'Roles[?starts_with(RoleName,`prod-`)].RoleName'

# Get role details including trust policy
aws iam get-role --role-name my-role

# List attached policies on a role
aws iam list-attached-role-policies --role-name my-role

# List inline policies on a role
aws iam list-role-policies --role-name my-role

# Get inline policy document
aws iam get-role-policy --role-name my-role --policy-name my-inline-policy

# Simulate policy evaluation (does this role allow this action?)
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-role \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::my-bucket/prefix/*

# Create an access key for a user
aws iam create-access-key --user-name ci-user

# Rotate: deactivate old key, activate new key
aws iam update-access-key --access-key-id AKIAOLD --status Inactive --user-name ci-user
aws iam delete-access-key --access-key-id AKIAOLD --user-name ci-user
```

---

### RDS

```bash
# List DB instances
aws rds describe-db-instances \
  --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,Engine,DBInstanceStatus,MultiAZ]' \
  --output table

# Check RDS events (failovers, restores, maintenance)
aws rds describe-events \
  --source-identifier my-db-instance \
  --source-type db-instance \
  --duration 60

# Describe parameter group
aws rds describe-db-parameters \
  --db-parameter-group-name default.postgres15 \
  --query 'Parameters[?ParameterName==`max_connections`]'

# Create a snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-db \
  --db-snapshot-identifier my-db-snapshot-$(date +%Y%m%d)

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier my-db-restored \
  --db-snapshot-identifier my-db-snapshot-20240101

# Describe RDS Proxy
aws rds describe-db-proxies --db-proxy-name my-rds-proxy
```

---

### Lambda

```bash
# List functions
aws lambda list-functions --query 'Functions[].[FunctionName,Runtime,LastModified]' --output table

# Invoke a function synchronously
aws lambda invoke \
  --function-name my-function \
  --payload '{"key":"value"}' \
  --cli-binary-format raw-in-base64-out \
  output.json
cat output.json

# Invoke asynchronously
aws lambda invoke \
  --function-name my-function \
  --invocation-type Event \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /dev/null

# Get function configuration (timeout, memory, concurrency)
aws lambda get-function-configuration --function-name my-function

# Update function memory and timeout
aws lambda update-function-configuration \
  --function-name my-function \
  --memory-size 512 \
  --timeout 30

# Put reserved concurrency
aws lambda put-function-concurrency \
  --function-name my-function \
  --reserved-concurrent-executions 50

# Get provisioned concurrency
aws lambda list-provisioned-concurrency-configs --function-name my-function
```

---

### CloudWatch

```bash
# List alarms in ALARM state
aws cloudwatch describe-alarms --state-value ALARM \
  --query 'MetricAlarms[].[AlarmName,StateReason]' --output table

# Get metric statistics for ALB 5xx
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/1234567890abcdef \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Get Lambda error count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=my-function \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Logs Insights query (find errors in last 30 min)
aws logs start-query \
  --log-group-name /aws/lambda/my-function \
  --start-time $(date -d '30 minutes ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'

# Get query results
aws logs get-query-results --query-id <query-id-from-above>

# Tail a log group (last 5 min)
aws logs tail /aws/lambda/my-function --since 5m --follow
```

---

## IAM Policy Structure Quick Reference

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnSpecificBucket",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/my-app-role"
      },
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalOrgID": "o-exampleorgid"
        }
      }
    },
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

**IAM policy key concepts:**

| Field | Purpose | Notes |
|---|---|---|
| `Version` | Policy language version | Always use `"2012-10-17"` |
| `Sid` | Statement ID | Optional but useful for readability |
| `Effect` | `Allow` or `Deny` | Explicit `Deny` always wins |
| `Principal` | Who this applies to | In resource policies (S3, KMS, trust policies). Omit in identity policies. |
| `Action` | API operations | e.g. `s3:GetObject`, `ec2:*`, `"*"` |
| `Resource` | Target ARN | Use `"*"` only when no specific ARN is possible |
| `Condition` | Extra conditions | MFA, source IP, org, region, VPC endpoint, tag |

**Common condition keys:**

| Condition Key | Use |
|---|---|
| `aws:PrincipalOrgID` | Restrict to IAM principals inside your AWS Organization |
| `aws:SourceVpce` | Require access through a specific VPC endpoint |
| `aws:RequestedRegion` | Restrict actions to approved regions |
| `aws:MultiFactorAuthPresent` | Require MFA for sensitive operations |
| `s3:x-amz-server-side-encryption` | Require specific encryption algorithm |
| `iam:PassedToService` | Control which services a role can be passed to |
| `aws:ResourceTag/<key>` | Enforce tag-based access control |

**Effective permission formula:**
```text
Effective permission =
  identity policy
  AND resource policy (if applicable)
  AND session policy (if STS AssumeRole with session policy)
  AND permissions boundary (if set on role/user)
  WITHIN SCP limits (organization guardrails)
  WHERE explicit Deny always overrides Allow
```

---

## VPC Quick Reference

### Subnet Types

| Subnet Type | Route Table Contains | Use Case |
|---|---|---|
| Public | `0.0.0.0/0 -> Internet Gateway` | ALB, NAT Gateway, bastion |
| Private (with NAT) | `0.0.0.0/0 -> NAT Gateway` | App servers, EKS nodes, ECS tasks |
| Private (isolated) | No default route | RDS, ElastiCache, internal services |
| Private (with endpoint) | `pl-xxxxx -> Gateway Endpoint` | S3/DynamoDB via VPC endpoint |

### Route Table Patterns

```text
Public subnet route table:
  10.0.0.0/16  local
  0.0.0.0/0    igw-xxxxxxxx (Internet Gateway)

Private app subnet route table:
  10.0.0.0/16  local
  0.0.0.0/0    nat-xxxxxxxx (NAT Gateway — in public subnet, same AZ)
  pl-xxxxxxxx  vpce-xxxxxxxx (S3 Gateway Endpoint — free, no NAT charge)

Private data subnet route table:
  10.0.0.0/16  local
  (no default route — no internet access at all)
```

### Security Group vs NACL

| Feature | Security Group | NACL |
|---|---|---|
| Scope | Resource-level (ENI) | Subnet-level |
| State | Stateful — response traffic allowed automatically | Stateless — must explicitly allow return traffic |
| Rules | Allow only | Allow and Deny |
| Evaluation | All rules evaluated | Rules evaluated in order by number (lowest first) |
| Return traffic | Automatically allowed | Must allow ephemeral ports 1024–65535 explicitly |
| Default behavior | Deny all inbound, allow all outbound | Allow all by default |
| Best use | Primary traffic control | Coarse subnet guardrails |

**Security group design pattern (three-tier):**
```text
SG: alb-sg
  Inbound:  443 from 0.0.0.0/0
  Outbound: app-port to app-sg

SG: app-sg
  Inbound:  app-port from alb-sg
  Outbound: 5432 to db-sg
  Outbound: 443 to 0.0.0.0/0 (or VPC endpoint SG)

SG: db-sg
  Inbound:  5432 from app-sg
  Outbound: (none required)
```

---

## EKS Quick Reference

```bash
# Update kubeconfig for a cluster
aws eks update-kubeconfig --name my-cluster --region us-east-1

# Check cluster version
aws eks describe-cluster --name my-cluster --query 'cluster.version'

# Scale a managed node group
aws eks update-nodegroup-config \
  --cluster-name my-cluster \
  --nodegroup-name my-node-group \
  --scaling-config minSize=1,maxSize=10,desiredSize=3

# List add-ons and their versions
aws eks list-addons --cluster-name my-cluster
aws eks describe-addon --cluster-name my-cluster --addon-name vpc-cni

# Update add-on
aws eks update-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni \
  --addon-version v1.18.1-eksbuild.1 \
  --resolve-conflicts OVERWRITE

# Check aws-auth ConfigMap (legacy node IAM mapping)
kubectl describe configmap aws-auth -n kube-system

# Check EKS access entries (new method — preferred)
aws eks list-access-entries --cluster-name my-cluster
aws eks describe-access-entry --cluster-name my-cluster \
  --principal-arn arn:aws:iam::123456789012:role/my-node-role

# Check node group health
aws eks describe-nodegroup --cluster-name my-cluster --nodegroup-name my-ng \
  --query 'nodegroup.health'

# Force node group rolling update
aws eks update-nodegroup-version \
  --cluster-name my-cluster \
  --nodegroup-name my-ng \
  --force
```

---

## Cost Optimization Quick Reference

### Purchasing Option Comparison

| Purchase Option | Best For | Cost vs On-Demand | Commitment |
|---|---|---|---|
| On-Demand | Unpredictable, short-lived, baseline critical | 1× (baseline) | None |
| Savings Plan (Compute, 1yr) | Flexible steady-state workloads | ~30–40% savings | 1-year spend commitment |
| Savings Plan (Compute, 3yr) | Long-term predictable workloads | ~50–60% savings | 3-year spend commitment |
| Reserved Instance (1yr) | Specific RDS, ElastiCache, Redshift | ~30–40% savings | 1-year instance commitment |
| Reserved Instance (3yr) | Same as above, longer commitment | ~50–60% savings | 3-year instance commitment |
| Spot (EC2) | Stateless, fault-tolerant, batch | ~60–90% savings | Can be interrupted with 2-min notice |
| Dedicated Hosts | Bring-Your-Own-License, strict compliance | Often 2–4× more | Host commitment |

**Quick cost tips:**

- Use `gp3` EBS instead of `gp2` — same performance with independent IOPS/throughput at lower cost
- Add S3 and DynamoDB Gateway VPC Endpoints (free — eliminates NAT processing charges for those services)
- Set CloudWatch Logs retention policies — default is "Never expire" which accumulates cost
- Delete unattached EBS volumes, release unattached Elastic IPs, and remove orphaned load balancers
- Use Karpenter with Spot instance fallback for EKS nodes
- Apply S3 lifecycle rules to transition logs to Standard-IA (30d) then Glacier (90d+)
- Right-size RDS with Performance Insights — 40% of RDS instances are commonly overprovisioned

---

## CloudWatch Key Metrics Per Service

| Service | Metric | Namespace | What It Tells You |
|---|---|---|---|
| ALB | `TargetResponseTime` | `AWS/ApplicationELB` | Latency to backend |
| ALB | `HTTPCode_ELB_5XX_Count` | `AWS/ApplicationELB` | LB-generated errors (504 = timeout, 502 = bad gateway) |
| ALB | `HTTPCode_Target_5XX_Count` | `AWS/ApplicationELB` | App-generated errors (5xx from your code) |
| ALB | `HealthyHostCount` | `AWS/ApplicationELB` | Targets passing health checks |
| EC2 | `CPUUtilization` | `AWS/EC2` | CPU usage |
| EC2 | `StatusCheckFailed` | `AWS/EC2` | Hardware/OS failure |
| RDS | `DatabaseConnections` | `AWS/RDS` | Active connections (alert near max_connections) |
| RDS | `CPUUtilization` | `AWS/RDS` | DB CPU — not always root cause |
| RDS | `FreeStorageSpace` | `AWS/RDS` | Alert below 10% |
| RDS | `ReplicaLag` | `AWS/RDS` | Read replica lag in seconds |
| Lambda | `Errors` | `AWS/Lambda` | Function errors |
| Lambda | `Throttles` | `AWS/Lambda` | Concurrency limit hit |
| Lambda | `Duration` | `AWS/Lambda` | Execution time (watch vs timeout setting) |
| Lambda | `ConcurrentExecutions` | `AWS/Lambda` | Current concurrency usage |
| SQS | `ApproximateAgeOfOldestMessage` | `AWS/SQS` | Processing delay — most useful SQS metric |
| SQS | `ApproximateNumberOfMessagesVisible` | `AWS/SQS` | Queue depth |
| EKS | `cluster_failed_node_count` | `ContainerInsights` | Nodes in failed state |
| NAT GW | `BytesOutToInternet` | `AWS/NATGateway` | Data processing charge indicator |

**Useful CloudWatch Logs Insights queries:**

```
# Lambda: find all ERROR lines in last 30 minutes
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50

# ALB access logs: top 10 slowest requests
fields @timestamp, request_processing_time, target_processing_time, response_processing_time, elb_status_code, request_url
| filter target_processing_time > 1.0
| sort target_processing_time desc
| limit 10

# CloudTrail: who called DeleteBucket recently
fields @timestamp, userIdentity.arn, awsRegion, requestParameters.bucketName
| filter eventName = "DeleteBucket"
| sort @timestamp desc
| limit 20
```

---

## Common AWS Service Limits

| Service | Limit | Default | Notes |
|---|---|---|---|
| EC2 | Running On-Demand vCPUs (Standard) | 32 vCPUs | Per region; request increase before you hit it |
| EC2 | Elastic IPs per region | 5 | Increases available; release unattached ones |
| VPC | VPCs per region | 5 | Increases available |
| VPC | Subnets per VPC | 200 | Rarely hit |
| VPC | Security groups per ENI | 5 | EKS pods can hit this with complex networking |
| Lambda | Concurrent executions per region | 1,000 | Shared across all functions; set reserved concurrency |
| Lambda | Function timeout | 15 min | Hard limit |
| Lambda | Deployment package size (direct upload) | 50 MB zipped | Use layers or S3 for larger packages |
| S3 | Buckets per account | 100 | Soft limit; increases available |
| S3 | Object size | 5 TB | Use multipart upload for >100 MB |
| IAM | Roles per account | 5,000 | Rarely hit |
| IAM | Policies attached per role | 10 | Managed + inline combined |
| IAM | Managed policies per account | 1,500 | — |
| EKS | Clusters per region | 100 | Soft limit |
| RDS | DB instances per region | 40 | Increases available |
| CloudWatch | Metrics per alarm | 1 (simple) or 10 (expression) | Use metric math for composite signals |
| CloudWatch | PutMetricData requests/sec | 1,000 | Batch where possible |

**SRE rule:** request quota increases proactively — before you hit them. Monitor quota usage with CloudWatch Service Quotas metrics and alert at 70% utilization for critical services.

---

## Well-Architected Framework Quick Summary

| Pillar | Core Questions | Key Practices |
|---|---|---|
| Operational Excellence | Can we deploy, observe, and improve safely? | IaC, runbooks, automated deployments, review architecture regularly |
| Security | Who can access what, and how do we detect violations? | Least privilege IAM, GuardDuty, CloudTrail, encryption at rest and in transit |
| Reliability | Does it recover when things fail? | Multi-AZ, retries, circuit breakers, DR testing, health checks |
| Performance Efficiency | Are we using the right tools at the right size? | Right-sizing, caching, choosing appropriate database for access patterns |
| Cost Optimization | Are we paying for what we actually use? | Tagging, Savings Plans, Spot, idle resource cleanup, anomaly detection |
| Sustainability | Are we minimizing environmental footprint? | Graviton instances, Spot for batch, rightsizing, consolidation |

**Well-Architected Review checklist for any production system:**

```text
Reliability:
  - What is the blast radius if one AZ fails?
  - Have we tested AZ loss in the last 90 days?
  - How do we restore data if corrupted?
  - What is the RTO and RPO target vs actual?

Security:
  - Which IAM principal can delete production data?
  - Are all API calls logged in CloudTrail?
  - Is GuardDuty and Config enabled?
  - Are secrets rotated automatically?

Cost:
  - What is the monthly cost driver?
  - Are there idle or oversized resources?
  - Are lifecycle policies set on S3 and CloudWatch Logs?

Operations:
  - What alarms page humans when users are impacted?
  - Is there a tested runbook for the most likely incidents?
  - What is the rollback plan for a bad deployment?
```

---

## AWS Region and AZ Naming Conventions

```text
Region format:  <geography>-<direction>-<number>
Examples:
  us-east-1        — US East (N. Virginia)
  us-east-2        — US East (Ohio)
  us-west-1        — US West (N. California)
  us-west-2        — US West (Oregon)
  eu-west-1        — Europe (Ireland)
  eu-central-1     — Europe (Frankfurt)
  ap-southeast-1   — Asia Pacific (Singapore)
  ap-northeast-1   — Asia Pacific (Tokyo)
  sa-east-1        — South America (São Paulo)

AZ format:   <region><letter>
Examples:
  us-east-1a
  us-east-1b
  us-east-1c
  eu-west-1a
  eu-west-1b

Note: the AZ letter is account-specific. us-east-1a in your account
may map to a different physical data center than us-east-1a in another
account. Use AZ ID (e.g., use1-az1) for cross-account coordination.

Global services (region-agnostic):
  IAM, Route 53 (public hosted zones), CloudFront, WAF (on CloudFront)

Regional services:
  VPC, ALB, NLB, EKS, ECS, Lambda, RDS, DynamoDB (table endpoint),
  SQS, SNS, ECR, Secrets Manager

Zonal services (scoped to a single AZ):
  EC2 instance, EBS volume, Subnet, NAT Gateway, ElastiCache shard
```
