---
title: "Hands-On Labs"
sidebar_position: 5
---

# AWS Hands-On Labs — Practical Engineering Exercises

These labs progress from foundational networking to multi-region platform design. Labs 3 and 4 are adapted from the SRE-Challenges cloud design lab series. Work through each lab by reasoning about the design before touching the CLI.

---

## Lab 1: VPC and EC2 Fundamentals (Beginner)

**Goal**: Build a VPC from scratch with public and private subnets, launch EC2 in a private subnet behind an ALB, and access AWS services without static keys.

**Time estimate**: 60–90 minutes

### Setup

```bash
# Set your region
export AWS_REGION=us-east-1

# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --query 'Vpc.VpcId' --output text)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create public subnets
PUB_A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 \
  --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PUB_B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 \
  --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Create private subnets
PRIV_A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 \
  --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PRIV_B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.12.0/24 \
  --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Create and attach Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Create public route table with IGW route
PUB_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PUB_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_A
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_B

# Create NAT Gateway
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_GW=$(aws ec2 create-nat-gateway --subnet-id $PUB_A \
  --allocation-id $EIP_ALLOC --query 'NatGateway.NatGatewayId' --output text)

# Wait for NAT Gateway to be available
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW

# Create private route table with NAT Gateway route
PRIV_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIV_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW
aws ec2 associate-route-table --route-table-id $PRIV_RT --subnet-id $PRIV_A
aws ec2 associate-route-table --route-table-id $PRIV_RT --subnet-id $PRIV_B
```

### Exercise Questions

After building the VPC, answer these before proceeding:

1. If an EC2 instance in `PRIV_A` wants to call the S3 API, what is the traffic path? How does this change if you add an S3 Gateway Endpoint?
2. What happens to instances in `PRIV_A` if the NAT Gateway in `PUB_A` becomes unavailable?
3. Create a second NAT Gateway in `PUB_B` and update routing so each private subnet uses its AZ-local NAT. Why does this improve resilience AND potentially increase cost?

---

## Lab 2: S3 Versioning, Lifecycle, and IAM (Beginner–Intermediate)

**Goal**: Practice S3 access controls, versioning, and lifecycle policies.

**Time estimate**: 45 minutes

### S3 Versioning and Recovery

```bash
# Create bucket with versioning
BUCKET_NAME="sre-lab-$(date +%s)"
aws s3api create-bucket --bucket $BUCKET_NAME --region us-east-1
aws s3api put-bucket-versioning --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Upload an object, overwrite it, then recover the original
echo "version 1" | aws s3 cp - s3://$BUCKET_NAME/config.txt
echo "version 2" | aws s3 cp - s3://$BUCKET_NAME/config.txt

# List all versions
aws s3api list-object-versions --bucket $BUCKET_NAME --prefix config.txt

# Delete the object (creates delete marker)
aws s3 rm s3://$BUCKET_NAME/config.txt

# Recover by listing versions and getting specific version ID
VERSION_ID=$(aws s3api list-object-versions --bucket $BUCKET_NAME \
  --prefix config.txt --query 'Versions[0].VersionId' --output text)
aws s3api get-object --bucket $BUCKET_NAME --key config.txt \
  --version-id $VERSION_ID recovered-config.txt

cat recovered-config.txt  # Should show "version 1"
```

### Lifecycle Policy

```bash
# Add lifecycle rule: transition to IA after 30 days, Glacier after 90, expire at 365
aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET_NAME \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "log-archival",
      "Status": "Enabled",
      "Filter": {"Prefix": "logs/"},
      "Transitions": [
        {"Days": 30, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"}
      ],
      "Expiration": {"Days": 365},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
    }]
  }'
```

### IAM Bucket Policy Exercise

Write a bucket policy that:
1. Allows only your specific IAM role ARN to write objects
2. Requires SSE-KMS encryption on all uploads
3. Denies reads from outside a specific VPC endpoint

---

## Lab 3: AWS Crossover Rebuild (Intermediate)

**Scenario**: Rebuild a public production platform on AWS. This lab is based on Lab 3 from the SRE-Challenges cloud design series. Work through the design questions before building anything.

**Time estimate**: 90–120 minutes

### How to Think About This

Do not start by listing AWS services. Start with these questions in order:

**Step 1 — Identify what is public and what is private.**
Only the edge should be public. Which IP addresses should be reachable from the internet? The answer should be very short: the CloudFront distribution endpoint. Everything else should be private.

**Step 2 — Trace the full request path from user browser to database.**
Write this as a numbered list before drawing anything:
```
User browser
  1. DNS resolves api.example.com via Route 53 (latency routing)
  2. CloudFront CDN — cache hit returns immediately; cache miss continues
  3. AWS WAF Web ACL evaluates request at the CloudFront edge
  4. ALB in private subnet with public-facing listener — TLS termination
  5. EKS pods in private app subnets across 3 AZs
  6. RDS Proxy — connection pooling
  7. RDS Multi-AZ PostgreSQL in private data subnets
  8. SQS queue for async side effects
  9. ECS Fargate workers consuming from SQS
```

**Step 3 — Classify stateless vs stateful.**

| Component | Classification | HA Mechanism |
|---|---|---|
| CloudFront | Stateless (edge cache) | AWS-managed multi-edge |
| ALB | Stateless | AWS-managed multi-AZ |
| EKS pods | Stateless | Multi-AZ node groups, pod replicas |
| RDS Multi-AZ | Stateful | Synchronous standby + auto-failover |
| SQS | Stateful (durable queue) | AWS-managed multi-AZ |
| ECS workers | Stateless | Service maintains desired count |

**Step 4 — Design your VPC.**

```text
VPC: 10.0.0.0/16

Public subnets (ALB, NAT GW):
  10.0.1.0/24 (us-east-1a)
  10.0.2.0/24 (us-east-1b)
  10.0.3.0/24 (us-east-1c)

Private app subnets (EKS nodes):
  10.0.11.0/24 (us-east-1a)
  10.0.12.0/24 (us-east-1b)
  10.0.13.0/24 (us-east-1c)

Private data subnets (RDS, ElastiCache):
  10.0.21.0/24 (us-east-1a)
  10.0.22.0/24 (us-east-1b)
  10.0.23.0/24 (us-east-1c)

Note: EKS with VPC CNI will allocate pod IPs from app subnets.
A /24 gives 251 addresses. For large EKS clusters, use /22 (1019 IPs).
```

### Security Group Design

Design security groups for each tier:

```text
SG: alb-sg
  Inbound: 443 from 0.0.0.0/0
  Outbound: 8080 (or app port) to app-sg

SG: app-sg (EKS nodes/pods)
  Inbound: 8080 from alb-sg
  Inbound: 443 from self (inter-pod communication)
  Outbound: 5432 to db-sg
  Outbound: 443 to 0.0.0.0/0 (or VPC endpoint SG for AWS APIs)

SG: db-sg (RDS)
  Inbound: 5432 from app-sg
  Outbound: none needed (RDS initiates no outbound connections)
```

### VPC Endpoints to Add

To eliminate NAT costs for AWS API calls:
- `com.amazonaws.region.ecr.api` — ECR image manifest pulls
- `com.amazonaws.region.ecr.dkr` — ECR image layer pulls
- `com.amazonaws.region.s3` — S3 (gateway endpoint — free)
- `com.amazonaws.region.secretsmanager` — Secrets Manager
- `com.amazonaws.region.sts` — IRSA token exchange
- `com.amazonaws.region.logs` — CloudWatch Logs

### Comparison: GCP vs AWS Choices

Key differences when rebuilding from GCP to AWS:

| Design Point | GCP | AWS | Difference |
|---|---|---|---|
| Load balancer scope | Global anycast LB | ALB is regional | AWS needs Route 53 latency routing for global users |
| WAF placement | Cloud Armor integrated with LB | WAF attached to CloudFront OR ALB | Attaching to CloudFront = edge absorption; ALB = regional |
| Messaging fan-out | Pub/Sub (queue + fanout combined) | SNS -> SQS per consumer | AWS needs both services for fan-out patterns |
| Workload identity | Workload Identity (tag-based) | IRSA (OIDC projected token) | Similar concept, different implementation |
| Firewall rules | Tag-based instance-level | SG (ENI-based) + NACL (subnet-level) | NACLs are stateless — must allow return traffic explicitly |
| Subnet scope | GCP subnets are regional | AWS subnets are zonal (AZ-bound) | Multi-AZ requires multiple subnets in AWS |

### Exercise: Identify AWS-Specific Risks

For each GCP habit, describe what breaks in AWS:

1. **Trusting tag-based firewall rules**: GCP firewall rules use instance tags; AWS Security Groups are attached to ENIs and do not use tags for source/destination matching
2. **Assuming the LB is global**: GCP External HTTPS LB is global anycast; AWS ALB is regional. Traffic from Asia hitting a `us-east-1` ALB has no geographic optimization without CloudFront or Route 53 latency routing
3. **Single subnet for all pods**: GCP subnets span regions; AWS subnets are AZ-bound. A single subnet cannot span AZs — EKS needs a subnet per AZ
4. **NACLs as stateful firewall**: NACLs are stateless — if you allow inbound TCP on port 443, you must also allow outbound ephemeral ports 1024–65535 for return traffic

---

## Lab 4: Multi-Region Control Plane Design (Expert)

**Scenario**: Design a low-latency internal control plane used by workloads across both GCP and AWS. This is an internal infrastructure service — not customer-facing. Correctness and latency matter more than architectural symmetry.

**Time estimate**: 120–150 minutes

### Start Here — Not With Services

This lab requires distributed systems reasoning. Answer these questions in order:

**Q1: What does this control plane do?**
Define exactly: what data it stores, who reads it, how often, what happens if a read returns stale data.

**Q2: What is your latency budget?**
```
Target: p99 < 10ms read latency from either cloud

Budget breakdown for AWS us-east-1 workload:
  Cache hit:
    Pod -> ElastiCache (same AZ): ~0.5ms
    Total: ~0.5ms [acceptable]

  Cache miss:
    Pod -> control plane service: ~2ms
    Service -> DynamoDB local read: ~3ms
    Total: ~5ms [acceptable]

  Cross-cloud write (NOT on hot path):
    us-east-1 -> us-central1 (GCP): ~25ms
    [Only for write propagation — async]
```

**Q3: What is the stateful core?**
Name it explicitly before designing anything else.

Recommended: DynamoDB Global Tables as the AWS-side storage + Cloud Spanner on GCP side, with an async replication bridge. ElastiCache Redis as the hot read cache on the AWS side.

### Data Flow Design

```text
WRITE PATH (operator changes a policy):
  Operator -> Control Plane API (GCP primary)
           -> Cloud Spanner (authoritative write)
           -> Async replication bridge
           -> DynamoDB Global Tables (AWS replica)
           -> Cache invalidation signal to ElastiCache (AWS)

READ PATH from GCP workload:
  GCP workload -> Cloud Memorystore (Redis cache)
  Cache hit: return immediately (~0.5ms)
  Cache miss: -> Spanner read replica -> update cache -> return

READ PATH from AWS workload:
  AWS workload -> ElastiCache (Redis cache)
  Cache hit: return immediately (~0.5ms)
  Cache miss: -> DynamoDB local read -> update cache -> return
```

### Failure Mode Table

| Failure | Behavior | Recovery |
|---|---|---|
| Single AZ in GCP primary | Fail to other AZ automatically | Spanner multi-zone handles this |
| GCP primary region unavailable | AWS reads continue from DynamoDB (stale up to replication lag) | Operator promotes a GCP secondary |
| Inter-cloud network partition | AWS reads from DynamoDB, GCP reads from Spanner — no cross-cloud sync | Serve stale data; alert on replication lag |
| Control plane DB write path unavailable | **Fail closed** for security policies (reject writes); serve cached data for reads | Alert, restore write path |

### Cache Invalidation Strategy

TTL-only is not enough for security-critical data. Use push-based invalidation:

```text
Policy update -> write to Spanner/DynamoDB
              -> publish change event to SNS (AWS) or Pub/Sub (GCP)
              -> subscribers (control plane service per region) receive event
              -> delete specific cache key from ElastiCache/Memorystore
              -> next read fetches fresh data from DB and re-populates cache
```

For non-critical config: TTL of 60 seconds is acceptable.
For security policies: push invalidation with TTL of 10 seconds as a safety net.

### Rollout Safety

Control plane rollouts have higher blast radius than stateless service rollouts. A bad deploy affects all consumers simultaneously — not just the traffic routed to the canary.

Staged rollout:
1. Deploy to one AZ in the primary region. Monitor for 15 minutes.
2. Deploy to remaining AZs in primary region. Monitor for 30 minutes.
3. Deploy to secondary region. Monitor for 30 minutes.
4. Deploy to AWS control plane replica. Monitor for 30 minutes.

Automatic rollback triggers:
- p99 read latency exceeds 20ms (2× baseline)
- Error rate exceeds 0.1%
- Cache hit rate drops below 80% (indicates cache invalidation is broken)
- Replication lag exceeds 30 seconds

### AWS CLI: DynamoDB Global Tables Setup

```bash
# Create the table in primary region
aws dynamodb create-table \
  --table-name control-plane-policies \
  --attribute-definitions AttributeName=policy_id,AttributeType=S \
  --key-schema AttributeName=policy_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Enable DynamoDB Streams (required for Global Tables)
aws dynamodb update-table \
  --table-name control-plane-policies \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1

# Add eu-west-1 as a replica
aws dynamodb create-global-table \
  --global-table-name control-plane-policies \
  --replication-group RegionName=us-east-1 RegionName=eu-west-1

# Check replication status
aws dynamodb describe-global-table --global-table-name control-plane-policies
```

### Exercise: Complete the Design

Write answers to these questions:
1. A security policy is updated. How long until every AWS workload in us-east-1 sees the change? How long until eu-west-1 sees it? How do you know?
2. A control plane bug causes all consumers to receive incorrect policy for 90 seconds before rollback. Write the incident timeline.
3. An AWS workload needs to authenticate to the GCP-hosted control plane API. How does it prove its identity? What does the control plane verify?

---

## Lab 5: Production Incident Simulation (Advanced)

**Goal**: Practice incident diagnosis using AWS CLI and CloudWatch without UI access (simulates on-call conditions).

**Time estimate**: 45–60 minutes per scenario

### Scenario A: ALB 502 Storm

Simulate by deploying an application that randomly returns invalid HTTP responses.

```bash
# Get ALB metrics for the last 30 minutes
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=<your-alb-name> \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <your-target-group-arn>

# Check if 5xx is coming from ELB or target
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=TargetGroup,Value=<tg-name> \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Sum
```

### Scenario B: IAM AccessDenied in ECS

```bash
# Find denied API calls in CloudTrail
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRole \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 20 \
  --query 'Events[?ErrorCode!=`null`].{Time:EventTime,User:Username,Error:ErrorCode,Name:EventName}'

# Check what the ECS task role actually has
aws iam list-attached-role-policies --role-name <your-task-role>
aws iam get-role-policy --role-name <your-task-role> --policy-name <inline-policy>

# Simulate the IAM policy evaluation
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-task-role \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::my-bucket/data/*
```

### Scenario C: RDS Connection Exhaustion

```bash
# Check current connection count
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=<your-db-id> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Maximum

# Check max_connections parameter
aws rds describe-db-parameters \
  --db-parameter-group-name <your-pg-name> \
  --query 'Parameters[?ParameterName==`max_connections`]'

# Check RDS events (failover, storage, etc)
aws rds describe-events \
  --source-identifier <your-db-id> \
  --source-type db-instance \
  --duration 60
```

---

## Lab Summary and Next Steps

| Lab | Key Skills |
|---|---|
| Lab 1 | VPC networking, subnets, routing, NAT, security groups |
| Lab 2 | S3 versioning, lifecycle, IAM policy design |
| Lab 3 | AWS crossover design, multi-tier architecture, GCP comparison |
| Lab 4 | Multi-region, distributed systems, control plane design |
| Lab 5 | Incident diagnosis with AWS CLI |

**What to study next**:
- EKS VPC CNI and pod IP management
- CloudFront origin groups for multi-region failover
- Route 53 ARC (Application Recovery Controller) for sophisticated failover
- RDS Proxy configuration for connection management
- AWS Fault Injection Simulator (FIS) for chaos testing
