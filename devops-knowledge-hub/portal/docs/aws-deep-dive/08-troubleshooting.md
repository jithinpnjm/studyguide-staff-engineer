---
title: "Troubleshooting"
sidebar_position: 8
---

# AWS Troubleshooting — Runbooks

Eight AWS runbooks for common SRE incidents. Each runbook follows a consistent pattern: symptoms, isolation steps, likely root causes, fix commands, and prevention.

---

## Runbook 1: EKS Node Not Joining the Cluster

**Symptoms:**
- Nodes in node group show as `NotReady` or never appear in `kubectl get nodes`
- ASG terminates nodes after health check timeout
- `aws eks describe-nodegroup` shows node group health issues

**Step 1 — Check node group and cluster status:**

```bash
# Node group status and health
aws eks describe-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name my-ng \
  --query 'nodegroup.[status,health,scalingConfig]'

# Look for nodes in Kubernetes
kubectl get nodes --sort-by=.metadata.creationTimestamp

# Check for recently added nodes (including NotReady)
kubectl get nodes -o wide | grep -v Ready
```

**Step 2 — Check IAM role (most common cause):**

```bash
# Get the node role ARN from the node group
NODE_ROLE=$(aws eks describe-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name my-ng \
  --query 'nodegroup.nodeRole' --output text)

# Verify the required managed policies are attached
aws iam list-attached-role-policies --role-name $(basename $NODE_ROLE) \
  --query 'AttachedPolicies[].PolicyName' --output table

# Required policies for EKS managed nodes:
# AmazonEKSWorkerNodePolicy
# AmazonEKS_CNI_Policy
# AmazonEC2ContainerRegistryReadOnly
```

**Step 3 — Check aws-auth ConfigMap (legacy) or access entries:**

```bash
# Legacy: check aws-auth
kubectl describe configmap aws-auth -n kube-system

# The node role must appear as:
# - rolearn: arn:aws:iam::ACCOUNT:role/NODE_ROLE_NAME
#   username: system:node:{{EC2PrivateDNSName}}
#   groups:
#     - system:bootstrappers
#     - system:nodes

# Modern: check EKS access entries
aws eks list-access-entries --cluster-name my-cluster
aws eks describe-access-entry \
  --cluster-name my-cluster \
  --principal-arn $NODE_ROLE
```

**Step 4 — Check security group connectivity:**

```bash
# Get cluster security group (allows control plane <-> node communication)
CLUSTER_SG=$(aws eks describe-cluster --name my-cluster \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId' --output text)

# Get node group security group
NODE_SG=$(aws ec2 describe-instances \
  --filters "Name=tag:eks:nodegroup-name,Values=my-ng" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)

# Check inbound rules on the node SG
aws ec2 describe-security-group-rules \
  --filters Name=group-id,Values=$NODE_SG \
  --query 'SecurityGroupRules[?IsEgress==`false`].[FromPort,ToPort,IpProtocol,ReferencedGroupInfo.GroupId]' \
  --output table

# Nodes must allow inbound from cluster SG on:
# - 443 (control plane -> kubelet)
# - 10250 (control plane -> kubelet metrics/exec)
# - 1025-65535 (return traffic from services)
```

**Step 5 — Check bootstrap script on a failing node:**

```bash
# Use SSM Session Manager (no SSH needed)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:eks:nodegroup-name,Values=my-ng" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

aws ssm start-session --target $INSTANCE_ID

# Inside the session:
sudo journalctl -u kubelet --no-pager -n 100
sudo cat /var/log/cloud-init-output.log | tail -100
sudo /etc/eks/bootstrap.sh my-cluster --dry-run  # validate bootstrap args

# Common bootstrap failures:
# 1. Cluster name mismatch in userdata
# 2. IMDSv2 required but bootstrap uses IMDSv1 curl
# 3. Cluster endpoint unreachable — VPC endpoint or SG issue
# 4. AMI incompatible with cluster Kubernetes version
```

**Step 6 — Check VPC endpoint for private clusters:**

```bash
# Private clusters need VPC endpoints for the Kubernetes API
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'VpcEndpoints[].[ServiceName,State]' --output table

# Required endpoints for EKS nodes in private subnets:
# com.amazonaws.REGION.ec2
# com.amazonaws.REGION.ecr.api
# com.amazonaws.REGION.ecr.dkr
# com.amazonaws.REGION.s3 (Gateway endpoint)
# com.amazonaws.REGION.sts
# com.amazonaws.REGION.elasticloadbalancing
```

---

## Runbook 2: ALB 502 / 503 / 504 Errors

**Symptoms:**
- Users receiving HTTP 5xx errors from the ALB
- Elevated `HTTPCode_ELB_5XX_Count` in CloudWatch
- Application appears healthy in some regions or for some users

**Step 1 — Identify whether errors are ALB-generated or target-generated:**

```bash
# ALB-generated errors (ALB itself is failing)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/1234567890abcdef \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Sum

# Target-generated errors (app code is returning 5xx)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=TargetGroup,Value=targetgroup/my-tg/1234567890 \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Sum
```

**Error code interpretation:**

| HTTP Code | Source | Meaning |
|---|---|---|
| 502 | ALB | Bad gateway — target returned an invalid response or closed connection |
| 503 | ALB | No healthy targets available in the target group |
| 504 | ALB | Gateway timeout — target did not respond within the ALB timeout period |
| 5xx (target) | App | Application code returned 5xx — look at app logs |

**Step 2 — Check target health:**

```bash
# List target groups
aws elbv2 describe-target-groups \
  --query 'TargetGroups[].[TargetGroupName,TargetGroupArn,HealthCheckPath]' --output table

# Check target health with reason codes
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/my-tg/abc \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason,TargetHealth.Description]' \
  --output table

# Common health check reasons:
# Target.ResponseCodeMismatch — app returned non-2xx on health check path
# Target.Timeout — health check endpoint too slow
# Target.FailedHealthChecks — too many consecutive failures
# Elb.InitialHealthChecking — new target not yet evaluated
```

**Step 3 — Check timeout mismatch (common cause of 504):**

```bash
# Get ALB listener and target group timeout settings
aws elbv2 describe-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --query 'Attributes[?Key==`deregistration_delay.timeout_seconds` || Key==`slow_start.duration_seconds`]'

# ALB idle timeout (connection timeout to backend)
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --query 'Attributes[?Key==`idle_timeout.timeout_seconds`]'

# The app's server timeout must be LONGER than the ALB timeout.
# If ALB timeout = 60s but app times out in 30s, ALB gets closed connection -> 502
# Fix: increase app timeout OR decrease ALB timeout
```

**Step 4 — Check security groups:**

```bash
# ALB SG must allow inbound HTTPS from internet
# Target SG must allow inbound from ALB SG on app port

ALB_SG=sg-alb123
TARGET_SG=sg-target456
APP_PORT=8080

# Check target SG allows traffic from ALB SG
aws ec2 describe-security-group-rules \
  --filters Name=group-id,Values=$TARGET_SG \
  --query "SecurityGroupRules[?IsEgress==\`false\` && FromPort<=\`$APP_PORT\` && ToPort>=\`$APP_PORT\`]"
```

**Step 5 — Check ALB access logs:**

```bash
# Enable ALB access logs if not already enabled
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn arn:aws:... \
  --attributes Key=access_logs.s3.enabled,Value=true Key=access_logs.s3.bucket,Value=my-alb-logs

# Query access logs with Athena or CloudWatch Logs Insights
# Useful fields: time, client:port, target:port, request_processing_time,
#                target_processing_time, elb_status_code, target_status_code
```

---

## Runbook 3: RDS Connection Refused or Exhausted

**Symptoms:**
- Application logs show `connection refused`, `too many connections`, or `remaining connection slots are reserved`
- `DatabaseConnections` CloudWatch metric near or exceeding `max_connections`
- Requests timing out with database-related errors

**Step 1 — Check connection count and trends:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=my-db \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Maximum,Average
```

**Step 2 — Check max_connections parameter:**

```bash
# Get the parameter group
aws rds describe-db-instances \
  --db-instance-identifier my-db \
  --query 'DBInstances[0].DBParameterGroups'

# Check max_connections value
aws rds describe-db-parameters \
  --db-parameter-group-name my-pg-params \
  --query 'Parameters[?ParameterName==`max_connections`]'

# For PostgreSQL: max_connections formula = LEAST({DBInstanceClassMemory/9531392}, 5000)
# db.t3.medium (4 GiB):  ~420 connections
# db.r6g.large (16 GiB): ~1700 connections
# db.r6g.xlarge (32 GiB): ~3400 connections
```

**Step 3 — Check RDS events for recent issues:**

```bash
aws rds describe-events \
  --source-identifier my-db \
  --source-type db-instance \
  --duration 120 \
  --query 'Events[].[Date,Message]' --output table
```

**Step 4 — Check security group allows connection:**

```bash
# RDS SG must allow inbound on 5432 from app SG
DB_SG=sg-db123
APP_SG=sg-app456

aws ec2 describe-security-group-rules \
  --filters Name=group-id,Values=$DB_SG \
  --query "SecurityGroupRules[?IsEgress==\`false\` && FromPort<=\`5432\` && ToPort>=\`5432\`]
    .[FromPort,IpProtocol,ReferencedGroupInfo.GroupId,CidrIpv4]" \
  --output table
```

**Step 5 — Immediate mitigation (kill idle connections):**

```bash
# Connect via RDS Query Editor, bastion, or SSM port forward
# Find and terminate idle connections (PostgreSQL)
psql -h my-db.xxxx.us-east-1.rds.amazonaws.com -U admin -d mydb << 'EOF'
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Kill idle connections older than 10 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '10 minutes'
  AND pid <> pg_backend_pid();
EOF
```

**Step 6 — Set up RDS Proxy (permanent fix):**

```bash
# Create Secrets Manager secret for RDS credentials first
aws secretsmanager create-secret \
  --name rds/my-db/admin \
  --secret-string '{"username":"admin","password":"mypassword","host":"my-db.xxxx.rds.amazonaws.com","port":5432,"dbname":"mydb"}'

# Create the proxy
aws rds create-db-proxy \
  --db-proxy-name my-db-proxy \
  --engine-family POSTGRESQL \
  --auth '[{"AuthScheme":"SECRETS","SecretArn":"arn:aws:secretsmanager:us-east-1:123456789012:secret:rds/my-db/admin","IAMAuth":"DISABLED"}]' \
  --role-arn arn:aws:iam::123456789012:role/rds-proxy-role \
  --vpc-subnet-ids subnet-aaa subnet-bbb subnet-ccc \
  --vpc-security-group-ids sg-proxy

# Register the RDS instance as a target
aws rds register-db-proxy-targets \
  --db-proxy-name my-db-proxy \
  --db-instance-identifiers my-db
```

---

## Runbook 4: S3 Access Denied

**Symptoms:**
- Application receives `AccessDenied` from S3 operations
- `aws s3 ls s3://my-bucket` returns `AccessDenied`
- CloudTrail shows `s3:GetObject` or `s3:PutObject` denied

**Step 1 — Confirm the exact error and caller identity:**

```bash
# Who is making the request?
aws sts get-caller-identity

# Test the operation manually with the same role
aws s3 ls s3://my-bucket --profile my-role
aws s3api get-object --bucket my-bucket --key my-key /tmp/test

# Check CloudTrail for the denied call (data events must be enabled)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=my-bucket \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?ErrorCode!=`null`].[EventTime,Username,EventName,ErrorCode,ErrorMessage]'
```

**Step 2 — Check the four access layers in order:**

```bash
# Layer 1: IAM identity policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-app-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::my-bucket/my-key

# Layer 2: S3 bucket policy
aws s3api get-bucket-policy --bucket my-bucket | jq '.Policy | fromjson'

# Layer 3: Block Public Access settings
aws s3api get-public-access-block --bucket my-bucket

# Layer 4: VPC endpoint policy (if accessing from within VPC via endpoint)
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" \
  --query 'VpcEndpoints[].[VpcEndpointId,PolicyDocument]'
```

**Step 3 — Check KMS if bucket uses SSE-KMS:**

```bash
# Get bucket encryption configuration
aws s3api get-bucket-encryption --bucket my-bucket

# If SSE-KMS: the caller must also have kms:Decrypt (for reads) or kms:GenerateDataKey (for writes)
KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx-xxxx

# Check key policy
aws kms get-key-policy --key-id $KMS_KEY_ID --policy-name default

# Simulate KMS access
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-app-role \
  --action-names kms:Decrypt kms:GenerateDataKey \
  --resource-arns $KMS_KEY_ID
```

**Common S3 AccessDenied causes:**

| Cause | Check | Fix |
|---|---|---|
| Identity policy missing s3 action | `iam simulate-principal-policy` | Add missing s3 action to role policy |
| Bucket policy explicitly denies | `get-bucket-policy` | Remove explicit deny or add allow for the principal |
| Block Public Access prevents public bucket policy | `get-public-access-block` | Use IAM identity policy instead of public bucket policy |
| VPC endpoint policy too restrictive | `describe-vpc-endpoints` | Update endpoint policy to allow the bucket or use `"Resource":"*"` |
| KMS key policy does not trust the role | `get-key-policy` | Add role to KMS key policy with kms:Decrypt/GenerateDataKey |
| Cross-account access without resource policy | No bucket policy allowing the other account | Add bucket policy granting access to the specific cross-account role |
| SCP denies the action at organization level | `organizations describe-policy` | Update SCP or request exception |

---

## Runbook 5: Lambda Invocation Failures

**Symptoms:**
- Lambda functions returning errors or not completing
- Elevated `Errors`, `Throttles`, or `DeadLetterErrors` metrics
- Downstream services receiving no response or partial responses

**Step 1 — Identify the failure type:**

```bash
# Check Lambda metrics for the last 30 minutes
for METRIC in Errors Throttles DeadLetterErrors ConcurrentExecutions Duration; do
  echo "=== $METRIC ==="
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name $METRIC \
    --dimensions Name=FunctionName,Value=my-function \
    --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 60 \
    --statistics Sum Maximum
done
```

**Step 2 — Read error details from CloudWatch Logs:**

```bash
# Tail recent logs
aws logs tail /aws/lambda/my-function --since 15m

# Search for specific error patterns
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --start-time $(date -d '30 minutes ago' +%s%3N) \
  --filter-pattern "ERROR"

# CloudWatch Logs Insights — structured error analysis
# fields @timestamp, @requestId, @message
# | filter @message like /Task timed out|REPORT|ERROR/
# | sort @timestamp desc
# | limit 100
```

**Step 3 — Check for timeout errors:**

```bash
# Get current timeout setting
aws lambda get-function-configuration --function-name my-function \
  --query '[Timeout,MemorySize,Runtime]'

# "Task timed out after X.XX seconds" in logs = timeout exceeded
# Fix: increase timeout
aws lambda update-function-configuration \
  --function-name my-function \
  --timeout 60  # maximum is 900 seconds (15 minutes)
```

**Step 4 — Check for OOM (Out of Memory) errors:**

```bash
# Lambda REPORT lines show memory used vs limit
# "REPORT ... Memory Size: 128 MB Max Memory Used: 128 MB" = OOM likely

# Increase memory
aws lambda update-function-configuration \
  --function-name my-function \
  --memory-size 512

# Memory and CPU scale proportionally — more memory also means faster execution
```

**Step 5 — Check for permission errors:**

```bash
# Get the execution role
ROLE=$(aws lambda get-function-configuration \
  --function-name my-function \
  --query 'Role' --output text)

# List policies on the role
aws iam list-attached-role-policies --role-name $(basename $ROLE)
aws iam list-role-policies --role-name $(basename $ROLE)

# Simulate a specific action
aws iam simulate-principal-policy \
  --policy-source-arn $ROLE \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::my-output-bucket/*
```

**Step 6 — Check for VPC configuration issues:**

```bash
# If Lambda is in a VPC, it needs:
# 1. Subnets with NAT Gateway (for internet access) or VPC endpoints (for AWS services)
# 2. Security group allowing outbound 443

aws lambda get-function-configuration \
  --function-name my-function \
  --query 'VpcConfig'

# Check if subnet has route to NAT or VPC endpoint
SUBNET_ID=subnet-0abc123
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$SUBNET_ID" \
  --query 'RouteTables[].[RouteTableId,Routes[].[DestinationCidrBlock,GatewayId,NatGatewayId]]'
```

**Step 7 — Check for throttling:**

```bash
# Check concurrent execution limits
aws lambda get-account-settings \
  --query 'AccountLimit.[ConcurrentExecutions,UnreservedConcurrentExecutions]'

# Check if the function has reserved concurrency
aws lambda get-function-concurrency --function-name my-function

# If throttled — options:
# 1. Request a service quota increase for concurrent executions
# 2. Set reserved concurrency to protect function from other functions consuming capacity
aws lambda put-function-concurrency \
  --function-name my-function \
  --reserved-concurrent-executions 100
```

---

## Runbook 6: CloudWatch Alarms Stuck in INSUFFICIENT_DATA

**Symptoms:**
- CloudWatch alarms show state `INSUFFICIENT_DATA` for extended periods
- Alarms never transition to `OK` or `ALARM` even when metrics should trigger them
- Dashboard shows gaps in metric data

**Step 1 — Understand INSUFFICIENT_DATA:**

```text
INSUFFICIENT_DATA means CloudWatch received no data points for the metric
during the evaluation period — not that the metric is zero.

Common causes:
- The metric emitting resource was deleted or stopped
- The namespace or dimension changed (e.g., new instance ID after replacement)
- Metric retention exceeded (metrics expire after 15 months, data points sooner)
- Custom metric not being published (publisher stopped or failed)
- Wrong namespace or dimension in the alarm definition
```

**Step 2 — Verify metric data exists:**

```bash
# Check if any data exists for the metric recently
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0abc123456 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average

# If no data: the instance may have been replaced or metric dimensions changed
```

**Step 3 — Check the alarm configuration:**

```bash
# Get full alarm configuration
aws cloudwatch describe-alarms \
  --alarm-names my-cpu-alarm \
  --query 'MetricAlarms[].[AlarmName,MetricName,Namespace,Dimensions,Period,EvaluationPeriods,Statistic,State,StateReason]'

# Verify the dimensions match what is currently being published
aws cloudwatch list-metrics \
  --namespace AWS/EC2 \
  --dimensions Name=InstanceId,Value=i-0abc123456 \
  --query 'Metrics[].[MetricName,Dimensions]'
```

**Step 4 — Fix dimension drift (auto-scaling instance replacement):**

```bash
# For ASG-backed services, use ALB target-level or ASG-level metrics instead of per-instance
# These survive instance replacement:

# ALB metric (not tied to instance ID)
aws cloudwatch put-metric-alarm \
  --alarm-name alb-high-5xx \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/1234567890abcdef \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching

# treat-missing-data options:
# breaching       — treat missing as threshold exceeded (conservative)
# notBreaching    — treat missing as within threshold (alarm remains OK)
# ignore          — maintain current state
# missing         — INSUFFICIENT_DATA (default)
```

**Step 5 — Fix custom metric publisher:**

```bash
# If the alarm is on a custom metric, verify the publisher is running
# Check if the CloudWatch agent is running on EC2
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets '[{"Key":"tag:Name","Values":["my-instance"]}]' \
  --parameters '{"commands":["systemctl status amazon-cloudwatch-agent"]}'

# Manually push a test data point to verify the metric path
aws cloudwatch put-metric-data \
  --namespace MyApp/Metrics \
  --metric-name RequestCount \
  --value 1 \
  --dimensions Name=Service,Value=api-service
```

---

## Runbook 7: ECS Task Failing to Start

**Symptoms:**
- ECS service desired count not matching running count
- Tasks stopping immediately after starting
- `aws ecs describe-services` shows tasks in `STOPPED` or `PENDING` state

**Step 1 — Check service and task state:**

```bash
# Get service status
aws ecs describe-services \
  --cluster my-cluster \
  --services my-service \
  --query 'services[].[serviceName,desiredCount,runningCount,pendingCount,events[0:3]]'

# List stopped tasks for the service
aws ecs list-tasks \
  --cluster my-cluster \
  --service-name my-service \
  --desired-status STOPPED \
  --query 'taskArns'

# Describe a stopped task
aws ecs describe-tasks \
  --cluster my-cluster \
  --tasks arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123 \
  --query 'tasks[].[lastStatus,stopCode,stoppedReason,containers[].[name,lastStatus,reason,exitCode]]'
```

**Step 2 — Check image pull errors:**

```bash
# If stoppedReason contains "CannotPullContainerError" or "Image cannot be pulled"

# Verify the image exists in ECR
aws ecr describe-images \
  --repository-name my-app \
  --image-ids imageTag=v1.2.3

# Check ECR repository policy (cross-account?)
aws ecr get-repository-policy --repository-name my-app

# Check the task execution role has ECR permissions
EXEC_ROLE=arn:aws:iam::123456789012:role/ecsTaskExecutionRole
aws iam list-attached-role-policies \
  --role-name ecsTaskExecutionRole \
  --query 'AttachedPolicies[].PolicyName'
# Should include: AmazonECSTaskExecutionRolePolicy

# If using ECR in another account, check the execution role has cross-account ECR permissions
aws iam simulate-principal-policy \
  --policy-source-arn $EXEC_ROLE \
  --action-names ecr:GetDownloadUrlForLayer ecr:BatchGetImage \
  --resource-arns arn:aws:ecr:us-east-1:123456789012:repository/my-app
```

**Step 3 — Check task role vs execution role:**

```bash
# Two distinct roles:
# Task Execution Role = used by ECS agent to pull image, write logs, fetch secrets
# Task Role = used by app code inside the container to call AWS services

aws ecs describe-task-definition \
  --task-definition my-task-def \
  --query 'taskDefinition.[taskRoleArn,executionRoleArn]'
```

**Step 4 — Check resource constraints:**

```bash
# Check if cluster has enough resources (for EC2 launch type)
aws ecs describe-clusters --clusters my-cluster \
  --query 'clusters[].[clusterName,registeredContainerInstancesCount,runningTasksCount,pendingTasksCount]'

# List container instances and their available resources
aws ecs list-container-instances --cluster my-cluster
aws ecs describe-container-instances \
  --cluster my-cluster \
  --container-instances $(aws ecs list-container-instances --cluster my-cluster --query 'containerInstanceArns[0]' --output text) \
  --query 'containerInstances[].[remainingResources]'

# For Fargate: check service quota for Fargate vCPU and memory
aws service-quotas get-service-quota \
  --service-code fargate \
  --quota-code L-3032A538  # Fargate On-Demand vCPU resource count
```

**Step 5 — Check CloudWatch Logs for application startup errors:**

```bash
# Get the log configuration from task definition
aws ecs describe-task-definition \
  --task-definition my-task-def \
  --query 'taskDefinition.containerDefinitions[].[name,logConfiguration]'

# Read logs for the most recent stopped task
aws logs tail /ecs/my-task-def --since 30m | head -100
```

**Step 6 — Check security group for ECS tasks:**

```bash
# Fargate tasks have ENIs with security groups
# Check task network interface
aws ecs describe-tasks \
  --cluster my-cluster \
  --tasks arn:aws:ecs:... \
  --query 'tasks[].attachments[?type==`ElasticNetworkInterface`].details'

# The SG must allow outbound 443 for:
# - ECR image pull
# - Secrets Manager/SSM Parameter Store
# - CloudWatch Logs
# - Any AWS API the app calls
```

---

## Runbook 8: Cost Spike Investigation

**Symptoms:**
- AWS billing alert fires for unusual spend
- Monthly cost projection significantly above expected
- A specific service or account showing unusual charges

**Step 1 — Identify the cost spike service and time:**

```bash
# Use Cost Explorer CLI to get service breakdown
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].{Date:TimePeriod.Start,Groups:Groups[].[Keys[0],Metrics.BlendedCost.Amount]}' \
  --output json | jq '.'

# Get top spenders by service for the last 7 days
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[-1].Groups | sort_by(@, &Metrics.UnblendedCost.Amount) | reverse(@)[:10]'
```

**Step 2 — Check Cost Anomaly Detection:**

```bash
# List recent cost anomalies
aws ce get-anomalies \
  --date-interval StartDate=$(date -d '30 days ago' +%Y-%m-%d),EndDate=$(date +%Y-%m-%d) \
  --query 'Anomalies[].[AnomalyId,AnomalyStartDate,AnomalyEndDate,Impact.TotalImpact,RootCauses[0]]'

# Get anomaly details
aws ce get-anomaly-monitors \
  --query 'AnomalyMonitors[].[MonitorName,MonitorType,MonitorDimension]'
```

**Step 3 — Investigate NAT Gateway costs (common surprise):**

```bash
# NAT Gateway charges: $0.045 per GB processed
# Check bytes out to internet from NAT Gateways
aws cloudwatch get-metric-statistics \
  --namespace AWS/NATGateway \
  --metric-name BytesOutToInternet \
  --dimensions Name=NatGatewayId,Value=nat-0abc123 \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Find top talkers using VPC Flow Logs in Athena or Logs Insights
# Query VPC Flow Logs: sort by bytes descending to find top source IPs
```

**Step 4 — Investigate EC2 compute costs:**

```bash
# Find running instances by type (look for unexpected large instances)
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].[InstanceType,LaunchTime,Tags[?Key==`Name`]|[0].Value,InstanceId]' \
  --output table | sort

# Check for Spot instance spending (should be cheaper — confirm it is)
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"PURCHASE_TYPE","Values":["On Demand"]}}' \
  --group-by Type=DIMENSION,Key=INSTANCE_TYPE
```

**Step 5 — Tag-based analysis:**

```bash
# Cost by team tag
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=TAG,Key=team

# Cost by environment tag
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=TAG,Key=environment

# Find untagged resources (they show as blank in tag groups)
# Use AWS Config rule: required-tags
```

**Step 6 — Common cost spike causes and fixes:**

| Cause | Detection | Fix |
|---|---|---|
| EC2 instances not terminated after test | `describe-instances` shows old launch times | Terminate; add auto-expiry via Instance Scheduler |
| NAT Gateway heavy S3/ECR traffic | NAT `BytesOutToInternet` high | Add Gateway Endpoint for S3; Interface Endpoint for ECR |
| CloudWatch Logs retention not set | `describe-log-groups` shows retention=Never | Set retention on all log groups (e.g., 90 days) |
| Unused load balancers | `describe-load-balancers` with no targets | Delete idle ALBs/NLBs |
| Unattached EBS volumes | `describe-volumes --filters Name=status,Values=available` | Snapshot and delete |
| Unattached Elastic IPs | `describe-addresses --filters Name=domain,Values=vpc` | Release; each costs $0.005/hr |
| Old EBS snapshots | `describe-snapshots --owner-ids self` | Delete snapshots older than retention policy |
| High-cardinality custom CloudWatch metrics | Cost Explorer shows CloudWatch charges | Reduce dimensions; use EMF or structured logging instead |
| RDS Multi-AZ dev/test database | `describe-db-instances --query '...[?MultiAZ==true]'` | Convert dev RDS to Single-AZ or Aurora Serverless |

**Step 7 — Set up preventive alerting:**

```bash
# Create a billing alarm
aws cloudwatch put-metric-alarm \
  --alarm-name monthly-spend-alert \
  --alarm-description "Alert when estimated charges exceed $1000" \
  --namespace AWS/Billing \
  --metric-name EstimatedCharges \
  --dimensions Name=Currency,Value=USD \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:billing-alerts

# Create Cost Anomaly Detection monitor
aws ce create-anomaly-monitor \
  --anomaly-monitor '{"MonitorName":"service-monitor","MonitorType":"DIMENSIONAL","MonitorDimension":"SERVICE"}'

aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    "SubscriptionName": "daily-spend-alert",
    "Threshold": 100,
    "Frequency": "DAILY",
    "MonitorArnList": ["arn:aws:ce::123456789012:anomalymonitor/abc123"],
    "Subscribers": [{"Address":"arn:aws:sns:us-east-1:123456789012:billing-alerts","Type":"SNS"}]
  }'
```
