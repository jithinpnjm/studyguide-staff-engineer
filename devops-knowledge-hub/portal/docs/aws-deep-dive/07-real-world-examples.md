---
title: "Real-World Examples"
sidebar_position: 7
---

# AWS Deep Dive — Real-World Examples

Eight AWS SRE scenarios with root cause analysis, investigation steps, and prevention. These are composite examples based on real incident patterns.

---

## Scenario 1: S3 Bucket Public Access Misconfiguration

**Context:** A developer creates an S3 bucket for sharing marketing assets. They disable Block Public Access to allow a static website configuration. A week later, a security scanner flags the bucket as exposing internal configuration files that were uploaded to the wrong prefix.

**Impact:** Internal configuration data (service endpoints, partial API keys) publicly accessible for approximately seven days.

**Detection:**

```bash
# AWS Config rule fires: s3-bucket-public-read-prohibited
# AWS IAM Access Analyzer also generates a finding:
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:accessanalyzer:us-east-1:123456789012:analyzer/my-analyzer \
  --filter '{"resourceType":{"eq":["AWS::S3::Bucket"]}}'

# Manual check: get public access block settings
aws s3api get-public-access-block --bucket my-marketing-bucket

# Check bucket ACL
aws s3api get-bucket-acl --bucket my-marketing-bucket

# Check bucket policy for public statements
aws s3api get-bucket-policy --bucket my-marketing-bucket | jq '.Policy | fromjson'
```

**IAM policy audit for the bucket:**

```bash
# Who has access to this bucket via IAM policies?
aws iam get-account-authorization-details \
  --filter LocalManagedPolicy AWSManagedPolicy \
  --query 'Policies[].PolicyVersionList[].Document.Statement[]
    | [?Resource != null]
    | [?contains(Resource, "my-marketing-bucket")]'

# Use Access Analyzer for authoritative external access review
aws accessanalyzer get-finding \
  --analyzer-arn arn:aws:accessanalyzer:us-east-1:123456789012:analyzer/my-analyzer \
  --id <finding-id>
```

**Immediate remediation:**

```bash
# Re-enable Block Public Access immediately
aws s3api put-public-access-block \
  --bucket my-marketing-bucket \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Remove public bucket policy if present
aws s3api delete-bucket-policy --bucket my-marketing-bucket

# Audit what files were in the exposed prefix
aws s3api list-objects-v2 --bucket my-marketing-bucket --prefix internal/ \
  --query 'Contents[].[Key,LastModified,Size]' --output table

# Check S3 server access logs or CloudTrail data events for access during exposure window
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=my-marketing-bucket \
  --start-time 2024-01-01T00:00:00Z --end-time 2024-01-08T00:00:00Z
```

**Prevention:**

```json
// SCP guardrail — prevent disabling Block Public Access
{
  "Effect": "Deny",
  "Action": "s3:PutBucketPublicAccessBlock",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "s3:PublicAccessBlockConfiguration/BlockPublicAcls": "true",
      "s3:PublicAccessBlockConfiguration/IgnorePublicAcls": "true",
      "s3:PublicAccessBlockConfiguration/BlockPublicPolicy": "true",
      "s3:PublicAccessBlockConfiguration/RestrictPublicBuckets": "true"
    }
  }
}
```

Enable AWS Config rule `s3-bucket-public-read-prohibited` and `s3-account-level-public-access-blocks-periodic` with auto-remediation via SSM Automation.

---

## Scenario 2: IAM Privilege Escalation via Assume-Role Chain

**Context:** A CI/CD service role (`ci-deploy-role`) has `iam:PassRole` and `ec2:RunInstances`. A developer notices that by launching an EC2 instance with a more privileged role attached, they can obtain credentials with permissions they do not hold directly.

**The escalation chain:**

```text
ci-deploy-role
  -> iam:PassRole (no resource constraint)
  -> ec2:RunInstances
  -> EC2 instance launched with admin-role attached
  -> curl http://169.254.169.254/latest/meta-data/iam/security-credentials/admin-role
  -> admin-level credentials obtained
```

**Detection via CloudTrail analysis:**

```bash
# Look for RunInstances calls from the CI role
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=RunInstances \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?contains(CloudTrailEvent, `ci-deploy-role`)].[EventTime,Username,CloudTrailEvent]'

# Look for unusual AssumeRole chains
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRole \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[].[EventTime,Username,CloudTrailEvent]'

# Identify who has iam:PassRole without resource constraints
aws iam get-account-authorization-details | jq '
  .Policies[].PolicyVersionList[]?.Document.Statement[]
  | select(.Action == "iam:PassRole" or (.Action | type == "array" and contains(["iam:PassRole"])))
  | select(.Resource == "*")
'
```

**Least-privilege fix:**

```json
// Before (dangerous): iam:PassRole on all resources
{
  "Effect": "Allow",
  "Action": ["iam:PassRole", "ec2:RunInstances"],
  "Resource": "*"
}

// After (safe): PassRole only to specific roles, RunInstances only to specific instance profiles
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::123456789012:role/ec2-app-role-*",
  "Condition": {
    "StringEquals": {"iam:PassedToService": "ec2.amazonaws.com"}
  }
},
{
  "Effect": "Allow",
  "Action": "ec2:RunInstances",
  "Resource": "*",
  "Condition": {
    "ArnLike": {
      "ec2:InstanceProfile": "arn:aws:iam::123456789012:instance-profile/ec2-app-profile-*"
    }
  }
}
```

**Detective controls:**

- Enable IAM Access Analyzer at the organization level
- Alert on CloudTrail events: `RunInstances` from non-approved roles, `GetCredentials` from EC2 metadata combined with unusual caller identities
- Quarterly IAM permission reviews using `aws iam generate-service-last-accessed-details`

---

## Scenario 3: EC2 Spot Interruption Handling

**Context:** A data processing pipeline runs on Spot instances inside an ASG. A Spot capacity interruption occurs during peak batch processing, causing 30 instances to be terminated simultaneously. Jobs in progress are lost and must be reprocessed.

**What happens without handling:**

```text
T+0:   Spot interruption notice delivered (2-minute warning)
T+2m:  Instances terminated by AWS
T+2m:  In-flight jobs lost — no checkpoint, no graceful shutdown
T+5m:  ASG launches new On-Demand instances (fallback capacity)
T+15m: New instances ready; all jobs must restart from beginning
```

**Interruption notice detection:**

```bash
# From inside the instance — poll EC2 metadata (every 5 seconds)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

while true; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/spot/termination-time)
  if [ "$RESPONSE" = "200" ]; then
    echo "Spot interruption notice received — beginning graceful shutdown"
    # Signal the worker to checkpoint and stop accepting new work
    kill -SIGTERM $(pgrep -f my-worker)
    break
  fi
  sleep 5
done
```

**ASG lifecycle hook for graceful shutdown:**

```bash
# Create a lifecycle hook for instance termination
aws autoscaling put-lifecycle-hook \
  --auto-scaling-group-name my-batch-asg \
  --lifecycle-hook-name spot-termination-hook \
  --lifecycle-transition autoscaling:EC2_INSTANCE_TERMINATING \
  --default-result ABANDON \
  --heartbeat-timeout 120  # 120s to complete graceful shutdown

# The instance script signals completion when done
aws autoscaling complete-lifecycle-action \
  --auto-scaling-group-name my-batch-asg \
  --lifecycle-hook-name spot-termination-hook \
  --lifecycle-action-result CONTINUE \
  --instance-id $(curl -s http://169.254.169.254/latest/meta-data/instance-id)
```

**ASG mixed instances policy with fallback:**

```json
{
  "MixedInstancesPolicy": {
    "InstancesDistribution": {
      "OnDemandPercentageAboveBaseCapacity": 20,
      "SpotAllocationStrategy": "capacity-optimized",
      "SpotInstancePools": 4
    },
    "LaunchTemplate": {
      "LaunchTemplateSpecification": {
        "LaunchTemplateName": "batch-worker-template",
        "Version": "$Latest"
      },
      "Overrides": [
        {"InstanceType": "c5.xlarge"},
        {"InstanceType": "c5a.xlarge"},
        {"InstanceType": "c5n.xlarge"},
        {"InstanceType": "m5.xlarge"}
      ]
    }
  }
}
```

**Prevention:** use `capacity-optimized` allocation strategy (AWS picks pools with most available capacity — lower interruption rate), maintain 20% On-Demand baseline, and use SQS-backed job queues so interrupted jobs are re-queued automatically via visibility timeout expiry.

---

## Scenario 4: RDS Connection Pool Exhaustion

**Context:** An application has hundreds of Lambda functions connecting directly to RDS PostgreSQL. During peak load, connection count exceeds `max_connections`, causing `FATAL: remaining connection slots are reserved` errors. The database becomes unreachable for all functions.

**Investigation:**

```bash
# Check current connection count metric
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=my-postgres-db \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Maximum

# Check max_connections parameter
aws rds describe-db-parameters \
  --db-parameter-group-name my-pg-param-group \
  --query 'Parameters[?ParameterName==`max_connections`]'

# Check RDS events during the incident window
aws rds describe-events \
  --source-identifier my-postgres-db \
  --source-type db-instance \
  --duration 120

# If Performance Insights is enabled — connect to RDS PI console or use API
aws pi get-resource-metrics \
  --service-type RDS \
  --identifier db-XXXXXXXXXXXX \
  --metric-queries '[{"Metric":"db.Connections.avg"}]' \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period-in-seconds 60
```

**Short-term mitigation:**

```bash
# Kill idle connections (requires psql access or RDS query editor)
# SELECT pg_terminate_backend(pid) FROM pg_stat_activity
#   WHERE state = 'idle' AND query_start < now() - interval '10 minutes';

# Reduce Lambda concurrency temporarily to reduce connection pressure
aws lambda put-function-concurrency \
  --function-name my-api-function \
  --reserved-concurrent-executions 50
```

**RDS Proxy configuration (permanent fix):**

```bash
# Create RDS Proxy
aws rds create-db-proxy \
  --db-proxy-name my-postgres-proxy \
  --engine-family POSTGRESQL \
  --auth '[{"AuthScheme":"SECRETS","SecretArn":"arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-creds","IAMAuth":"DISABLED"}]' \
  --role-arn arn:aws:iam::123456789012:role/rds-proxy-role \
  --vpc-subnet-ids subnet-aaa subnet-bbb \
  --vpc-security-group-ids sg-proxy

# Register target (RDS instance)
aws rds register-db-proxy-targets \
  --db-proxy-name my-postgres-proxy \
  --db-instance-identifiers my-postgres-db

# Update Lambda to connect via proxy endpoint (not RDS endpoint directly)
# RDS Proxy pools and multiplexes connections — Lambda sees its own connection
# while proxy maintains a smaller pool to the DB
```

**`max_connections` tuning reference for PostgreSQL:**

```text
Default formula: LEAST({DBInstanceClassMemory/9531392}, 5000)

For db.r6g.large (16 GiB RAM): ~1700 connections

Recommendation with RDS Proxy:
  RDS Proxy max_connections: 100–200 (set via ConnectionPoolConfigurationInfo)
  Lambda concurrency: can be 1000+
  Lambda -> Proxy: each Lambda gets a connection from the proxy pool
  Proxy -> RDS: multiplexed to a much smaller set of real connections
```

---

## Scenario 5: EKS Nodes Not Joining Cluster

**Context:** After creating a new managed node group, all nodes show as `NotReady` for 10 minutes and then are terminated. New nodes never register with the control plane.

**Investigation order:**

```bash
# 1. Check node group status and health
aws eks describe-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name my-new-ng \
  --query 'nodegroup.[status,health]'

# 2. Check EC2 instance state — are they launching?
aws ec2 describe-instances \
  --filters "Name=tag:eks:nodegroup-name,Values=my-new-ng" \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,LaunchTime]'

# 3. Get bootstrap logs from a failing instance (use SSM Session Manager)
aws ssm start-session --target i-0123456789abcdef0
# Then inside the session:
sudo journalctl -u kubelet -f
sudo cat /var/log/cloud-init-output.log
sudo cat /var/log/messages | grep -i "kubelet\|bootstrap"

# 4. Check the cluster's aws-auth ConfigMap
kubectl describe configmap aws-auth -n kube-system

# 5. Check EKS access entries (new method)
aws eks list-access-entries --cluster-name my-cluster
```

**Root cause — missing IAM role in aws-auth:**

```yaml
# aws-auth ConfigMap — node role must be present
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: arn:aws:iam::123456789012:role/my-new-node-role
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
```

**Root cause — node group security group:**

```bash
# The node group security group must allow inbound from control plane SG
# and from other nodes (self-referencing rule for pod-to-pod)

# Check the cluster security group
aws eks describe-cluster --name my-cluster \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId'

# Check the node group security group
aws eks describe-nodegroup --cluster-name my-cluster --nodegroup-name my-ng \
  --query 'nodegroup.resources.remoteAccessSecurityGroup'

# The cluster security group allows bidirectional communication between
# control plane and nodes — if nodes use a separate SG, it must allow
# inbound 443 and 10250 from the cluster SG
```

**Root cause — bootstrap script failure:**

```bash
# On the node (via SSM):
sudo cat /etc/eks/bootstrap.sh

# Common bootstrap failures:
# 1. Wrong cluster name in userdata
# 2. Cluster endpoint not reachable (VPC endpoint missing or SG blocking)
# 3. IMDSv2 required but bootstrap script uses v1 curl
# 4. Outdated AMI with incompatible Kubernetes version
```

---

## Scenario 6: Route 53 DNS Failover Not Triggering

**Context:** The primary region (us-east-1) has been fully down for 8 minutes. Route 53 has a failover routing policy configured, but DNS queries are still returning the primary endpoint.

**Investigation:**

```bash
# 1. Check health check status
aws route53 get-health-check-status --health-check-id abc12345-1234-1234-1234-abc123456789

# 2. List health checks and their configurations
aws route53 list-health-checks

# 3. Check the specific health check configuration
aws route53 get-health-check --health-check-id abc12345 \
  --query 'HealthCheck.HealthCheckConfig'

# 4. Check Route 53 DNS records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z0123456789ABCDEFGHIJ \
  --query 'ResourceRecordSets[?Name==`api.example.com.`]'
```

**Common misconfigurations causing failover to not trigger:**

| Problem | Symptom | Fix |
|---|---|---|
| Health check interval too high | Health check fires every 30s but failure detected too slowly | Set interval to 10s for critical endpoints |
| Threshold too high | Requires 5 consecutive failures before marking unhealthy | Set failure threshold to 2–3 |
| Health check evaluating wrong endpoint | Checking `/` instead of `/healthz` which requires auth | Fix health check path; ensure endpoint responds without auth |
| TTL too high | DNS clients caching the old answer even after failover | Set TTL to 60s maximum; ideally 30s for failover records |
| Alias record misconfiguration | Alias record does not support health check evaluation | Use non-alias record with explicit IP for failover health checks |
| Secondary record is not the correct type | Failover policy but secondary not marked as SECONDARY | Check `Failover` field on each record set |

**Health check configuration for sensitive failover:**

```bash
# Create health check — HTTP endpoint, 10s interval, fail after 2 consecutive failures
aws route53 create-health-check \
  --caller-reference "my-api-hc-$(date +%s)" \
  --health-check-config '{
    "Type": "HTTPS",
    "FullyQualifiedDomainName": "api.example.com",
    "Port": 443,
    "ResourcePath": "/healthz",
    "RequestInterval": 10,
    "FailureThreshold": 2,
    "EnableSNI": true
  }'
```

**Why Alias records and health checks interact:**
Route 53 Alias records that point to AWS resources (like ALBs) do evaluate the ALB health. However, the ALB must report unhealthy for Route 53 to trigger failover — and the ALB only marks itself unhealthy when all targets in all AZs fail. If any target is healthy in any AZ, the ALB is considered healthy by Route 53.

---

## Scenario 7: Lambda Cold Start Causing Latency Spikes

**Context:** A Lambda-backed API shows p99 latency of 8 seconds during low-traffic periods (nights and weekends), but p99 is 200ms during business hours. Customers complain about slow first loads after overnight periods.

**Investigation:**

```bash
# Check Lambda Init duration in CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-api-function \
  --filter-pattern "REPORT" \
  --start-time $(date -d '24 hours ago' +%s%3N) \
  --query 'events[].message' | grep "Init Duration"

# CloudWatch Logs Insights — analyze Init Duration separately
# fields @timestamp, @requestId, @duration, @initDuration, @memorySize, @maxMemoryUsed
# | filter @initDuration > 0
# | stats avg(@initDuration), max(@initDuration), count() by bin(1h)

# Get function configuration
aws lambda get-function-configuration --function-name my-api-function \
  --query '[MemorySize,Timeout,Runtime,VpcConfig]'

# Check current provisioned concurrency
aws lambda list-provisioned-concurrency-configs \
  --function-name my-api-function
```

**Root causes of high cold start duration:**

| Cause | Typical Impact | Fix |
|---|---|---|
| Large deployment package | 500ms–3s | Reduce dependencies, use layers for shared libs |
| VPC configuration | 1–10s (historical; improved post-2019) | Use VPC endpoints, place Lambda in private subnet with endpoint access |
| Heavy initialization code | 500ms–5s | Move initialization inside handler, not at module load |
| Inefficient runtime (JVM, .NET) | 2–8s | Consider Lambda SnapStart (Java), or rewrite hot paths in Go/Node |
| Low memory allocation | Initialization is CPU-throttled at low memory | Increase memory (also increases CPU proportionally) |

**Provisioned concurrency for latency-sensitive functions:**

```bash
# Create a function version first (required for provisioned concurrency)
VERSION=$(aws lambda publish-version \
  --function-name my-api-function \
  --query 'Version' --output text)

# Put provisioned concurrency — keep 10 environments warm
aws lambda put-provisioned-concurrency-config \
  --function-name my-api-function \
  --qualifier $VERSION \
  --provisioned-concurrent-executions 10

# Auto-scale provisioned concurrency based on usage
# Use Application Auto Scaling to scale provisioned concurrency

aws application-autoscaling register-scalable-target \
  --service-namespace lambda \
  --resource-id function:my-api-function:$VERSION \
  --scalable-dimension lambda:function:ProvisionedConcurrency \
  --min-capacity 5 \
  --max-capacity 50
```

**Memory sizing impact on cold start and performance:**

```text
128 MB Lambda:
  Cold start: ~2500ms (slow CPU)
  Execution: ~800ms per request (CPU bottleneck)
  Cost: low memory but slow — often costs MORE due to duration

1024 MB Lambda:
  Cold start: ~400ms (full vCPU)
  Execution: ~100ms per request
  Cost: higher memory × lower duration — often net cheaper

Rule of thumb: start at 512–1024 MB; use Lambda Power Tuning
(open source tool) to find the optimal memory/cost balance.
```

---

## Scenario 8: CloudFormation Stack Stuck in UPDATE_ROLLBACK_FAILED

**Context:** A CloudFormation stack update fails partway through. CloudFormation attempts automatic rollback, which also fails. The stack is now in `UPDATE_ROLLBACK_FAILED` state — no updates, no deletions, and no normal rollback are possible.

**Investigation:**

```bash
# Check stack events to understand why the update AND rollback failed
aws cloudformation describe-stack-events \
  --stack-name my-production-stack \
  --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`ROLLBACK_FAILED`]
    .[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
  --output table

# Get the stack status
aws cloudformation describe-stacks \
  --stack-name my-production-stack \
  --query 'Stacks[0].[StackStatus,StackStatusReason]'

# List resources in the stack to understand what is stuck
aws cloudformation list-stack-resources \
  --stack-name my-production-stack \
  --query 'StackResourceSummaries[].[LogicalResourceId,ResourceType,ResourceStatus]' \
  --output table
```

**Common causes of UPDATE_ROLLBACK_FAILED:**

| Root Cause | Example | Why Rollback Fails |
|---|---|---|
| Resource manually deleted outside CloudFormation | EC2 instance terminated manually | Rollback tries to restore the resource that no longer exists |
| Service limit hit | Ran out of Elastic IPs | Rollback cannot create more of the same resource |
| Dependency outside CloudFormation changed | IAM role that stack depends on was deleted | Rollback cannot re-create the dependent relationship |
| S3 bucket not empty | Stack tries to delete a versioned S3 bucket that has objects | Delete operation fails; rollback cannot recreate from scratch |

**Continue-update-rollback (skipping problematic resources):**

```bash
# Skip the problematic resource and continue the rollback
# This tells CloudFormation to ignore the listed resource during rollback
aws cloudformation continue-update-rollback \
  --stack-name my-production-stack \
  --resources-to-skip LogicalResourceIdOfStuckResource

# If multiple resources are stuck
aws cloudformation continue-update-rollback \
  --stack-name my-production-stack \
  --resources-to-skip MyEc2Instance MyRdsInstance

# Monitor rollback progress
aws cloudformation wait stack-rollback-complete \
  --stack-name my-production-stack
```

**Manual cleanup before continuing rollback:**

```bash
# Example: rollback stuck because S3 bucket is not empty
# Option 1: Empty the bucket manually so rollback can delete it
aws s3 rm s3://my-stuck-bucket --recursive
# Then continue rollback

# Example: rollback stuck because an EC2 instance was manually deleted
# CloudFormation cannot restore it — skip it
aws cloudformation continue-update-rollback \
  --stack-name my-production-stack \
  --resources-to-skip MyEC2Instance

# After rollback completes, fix the state:
# 1. Import the replacement resource into the stack
aws cloudformation create-change-set \
  --stack-name my-production-stack \
  --change-set-name import-replacement \
  --change-set-type IMPORT \
  --resources-to-import '[{
    "ResourceType":"AWS::EC2::Instance",
    "LogicalResourceId":"MyEC2Instance",
    "ResourceIdentifier":{"InstanceId":"i-0newreplacement"}
  }]' \
  --template-body file://template.yaml
```

**Prevention:**

- Never modify CloudFormation-managed resources outside of CloudFormation
- Test stack updates on staging with the same template before production
- Use `--no-rollback` flag during development only — not in production
- Add CloudFormation drift detection to CI: `aws cloudformation detect-stack-drift`
- Set stack termination protection: `aws cloudformation update-termination-protection --enable-termination-protection --stack-name my-production-stack`
- For stateful resources (S3, RDS), set `DeletionPolicy: Retain` so rollback never tries to delete them

---

## Patterns Across All Scenarios

| Pattern | Scenarios | Prevention |
|---|---|---|
| Missing health check depth | 6 | Health checks must test the full request path, not just TCP connectivity |
| IAM least privilege not enforced | 2 | Use IAM Access Analyzer; review iam:PassRole resource constraints |
| No graceful shutdown handling | 3 | Lifecycle hooks; SIGTERM handler; checkpoint-based job design |
| Direct DB connections from serverless | 4 | RDS Proxy for Lambda and ECS; never open connections per invocation |
| Manual changes outside IaC | 8 | CloudFormation drift detection; strict GitOps; no console writes in production |
| DNS TTL too high for failover | 6 | TTL ≤ 60s for failover-enabled records; use Route 53 health checks at 10s interval |
| Cold paths not tested | 7 | Chaos testing including scale-to-zero and traffic ramp tests |
| Node bootstrap failures not observed | 5 | SSM agent on nodes; CloudWatch agent for bootstrap logs; EKS node health alerts |
