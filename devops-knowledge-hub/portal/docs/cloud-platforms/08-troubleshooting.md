---
title: "Troubleshooting"
sidebar_position: 8
---

# Cloud Platforms — Troubleshooting

Cloud troubleshooting is layer-by-layer debugging. Do not jump directly into one service dashboard. First identify which layer is failing.

```text
DNS -> CDN/WAF -> load balancer -> compute -> service dependency -> database/storage
```

---

## Universal Cloud Triage

Ask:

1. What changed recently?
2. Is the issue regional, zonal, account-specific, or service-specific?
3. Is DNS resolving correctly?
4. Is traffic reaching the edge or load balancer?
5. Are targets healthy?
6. Are workloads running and ready?
7. Are dependencies reachable?
8. Did IAM, network policy, or configuration change?
9. Is this a capacity issue, permission issue, routing issue, or application issue?

---

## Layer Matrix

| Symptom | Likely layer | First checks |
|---|---|---|
| Domain does not resolve | DNS | Hosted zone, records, TTL |
| Some users see stale content | CDN | Cache behavior, invalidation, headers |
| 403 at edge | WAF/CDN | WAF rules, origin policy, auth headers |
| 502 from ALB | Load balancer/app | Target health, app port, logs |
| Private service cannot reach internet | Network | Route table, NAT, firewall, DNS |
| App cannot access cloud API | Identity | Role, policy, trust, service account |
| DB connections exhausted | Database/app | Connection count, pool, concurrency |
| Storage cost spike | Storage/logging | Lifecycle, retention, access pattern |

---

## AWS CLI And IAM Debugging

### First Line: Identify The Caller

```bash
# Always start with who is calling
aws sts get-caller-identity
# Output: AccountId, UserId, Arn of the current principal

# If you need to test as a different role
aws sts assume-role \
  --role-arn arn:aws:iam::123:role/my-role \
  --role-session-name debug-session
```

### Simulate A Policy

```bash
# Check whether a principal can perform specific actions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123:role/my-role \
  --action-names s3:GetObject s3:PutObject kms:Decrypt \
  --resource-arns arn:aws:s3:::my-bucket/* \
  --query 'EvaluationResults[*].{Action:EvalActionName,Decision:EvalDecision}'

# Output:
# s3:GetObject: allowed
# s3:PutObject: implicitDeny
# kms:Decrypt: explicitDeny  <- permission boundary or SCP blocking
```

### Trace IAM AccessDenied In CloudTrail

```bash
# Find the denied event
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=my-app-role \
  --query 'Events[*].{Time:EventTime,Event:CloudTrailEvent}' \
  --max-results 5 | \
  jq '.[0].Event | fromjson | {api: .eventName, error: .errorCode, message: .errorMessage}'

# Check last access for each service (helps identify unused permissions)
aws iam generate-service-last-accessed-details \
  --arn arn:aws:iam::123:role/my-role
# Then:
aws iam get-service-last-accessed-details --job-id <job-id>
```

The complete IAM debug sequence for `AccessDenied`:

```text
1. aws sts get-caller-identity  <- confirm who is making the call
2. Identify the exact API action and resource ARN from the error
3. Check identity policy: aws iam get-role-policy or list-attached-role-policies
4. Check resource policy: e.g., aws s3api get-bucket-policy --bucket my-bucket
5. Check trust policy: aws iam get-role --role-name my-role
6. Check permission boundary: aws iam get-role | grep PermissionsBoundary
7. Check SCP (organization-level): requires management account or AWS Support
8. Check KMS key policy if encryption involved: aws kms get-key-policy --key-id my-key
9. Use CloudTrail for the exact denied request context
```

---

## DNS And Route 53

Useful checks:

```bash
dig example.com
dig example.com +trace
nslookup example.com
```

Look for:

- Wrong hosted zone
- Wrong record type
- Old TTL still active
- Health check failover not configured
- Alias target changed
- Split-horizon DNS confusion

SRE tip: DNS changes are not instant. TTL and resolver caching matter during rollback.

---

## CloudFront Or CDN Issues

Symptoms:

- Users see stale content.
- Only some regions are affected.
- Origin works but CDN returns an error.

Check:

- Cache behavior path pattern
- Origin configuration
- TLS certificate
- Cache-Control headers
- Invalidation history
- WAF rules

Safer static site pattern:

```text
versioned assets with long cache
HTML entry point with shorter cache
```

---

## ALB 502 And 504 Troubleshooting

ALB error codes and their meaning:

| Code | Source | Meaning |
|---|---|---|
| 502 | ALB-generated | Target returned malformed response, closed connection, or wrong protocol |
| 503 | ALB-generated | No healthy targets in target group |
| 504 | ALB-generated | Target did not respond within timeout |
| 5xx from target | App-generated | App responded with 5xx (target is "healthy" by ALB definition) |

### ALB 502 Diagnosis

```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/my-tg/abc \
  --query 'TargetHealthDescriptions[*].{Target:Target.Id,Port:Target.Port,State:TargetHealth.State,Reason:TargetHealth.Reason,Description:TargetHealth.Description}'

# Check ALB access logs (if enabled) for 5xx breakdown
# ALB access logs in S3 — use Athena or Logs Insights
# Look for: elb_status_code vs target_status_code
# If elb=502 and target is blank/0: ALB could not connect to target at all
# If elb=502 and target=200: ALB rejected the response (e.g., Content-Length mismatch)

# Check listener rules
aws elbv2 describe-rules \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:123:listener/app/my-alb/abc/xxx

# Check security group on worker nodes (EKS)
# The ALB target type=ip sends traffic from ALB to pod IP directly
# Worker node SG must allow inbound from ALB SG on the pod port
aws ec2 describe-security-groups \
  --group-ids sg-worker-nodes \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`8080`]'
```

Common ALB 502 causes in EKS:
- Worker node security group blocks traffic from ALB (target-type=ip: ALB connects to pod IP directly)
- Pod not listening on the port declared in the Service
- Pod readiness probe failing but pod stays in target group (health check path differs from readiness)

### Load Balancer Problems

For ALB/NLB issues, check:

```text
target group health
listener rules
security group rules (especially ALB SG -> worker node SG for EKS IP mode)
health check path and expected status code
backend port
TLS certificate
```

If ALB health checks fail, do not only check whether the process is running. Check whether the exact health check path returns the expected status code. A `200` on `/` does not mean `/healthz` returns `200`.

---

## VPC Reachability Troubleshooting

Private workload cannot reach a dependency? Check in order:

```text
1. DNS: does the hostname resolve from inside the VPC?
2. Route table: is there a route for the destination?
3. Security group: does the SG allow traffic on the right port from the right source?
4. NACL: do inbound AND outbound rules allow the traffic (including ephemeral ports)?
5. NAT Gateway: is the private subnet routed to a NAT GW (not the IGW)?
6. VPC endpoint: should this traffic use a private endpoint instead of internet path?
7. App listening: is the process actually listening on the expected port?
```

### VPC Reachability Analyzer

The Reachability Analyzer traces a path between two resources and tells you which hop is blocking:

```bash
# Create a path to test
NIPA=$(aws ec2 create-network-insights-path \
  --source eni-0abc1234 \
  --destination eni-0def5678 \
  --protocol TCP \
  --destination-port 5432 \
  --query 'NetworkInsightsPath.NetworkInsightsPathId' \
  --output text)

# Run the analysis
AID=$(aws ec2 start-network-insights-analysis \
  --network-insights-path-id $NIPA \
  --query 'NetworkInsightsAnalysis.NetworkInsightsAnalysisId' \
  --output text)

# Get results (wait a few seconds)
aws ec2 describe-network-insights-analyses \
  --network-insights-analysis-ids $AID \
  --query 'NetworkInsightsAnalyses[0].{Status:Status,NetworkPathFound:NetworkPathFound,Explanations:Explanations}'
```

### Useful Commands From Inside A Pod Or VM

```bash
# Test DNS resolution
nslookup my-service.production.svc.cluster.local
dig my-db.cluster-xxx.us-east-1.rds.amazonaws.com

# Test TCP reachability
nc -vz my-db.cluster-xxx.us-east-1.rds.amazonaws.com 5432

# Trace route (may be blocked by security groups at hops)
traceroute my-db.cluster-xxx.us-east-1.rds.amazonaws.com

# Full HTTP debug
curl -v https://my-api.example.com/health
```

### Common VPC Connectivity Causes

| Symptom | Likely cause |
|---|---|
| DNS resolution fails inside pod | CoreDNS problem or search domain misconfiguration |
| DNS resolves but connection refused | Security group blocking source, or process not listening |
| Connection timeout (not refused) | NACL blocking return traffic, or route missing |
| Intermittent timeouts at scale | NAT Gateway SNAT port exhaustion |
| Works from pod but not from Lambda | Lambda in VPC subnet with no NAT, or wrong SG |
| Private subnet cannot reach S3 | Need S3 gateway endpoint (not NAT for this) |

### EKS Node NotReady Due To VPC CNI IP Exhaustion

```bash
# Symptoms: pods stuck Pending, nodes show available CPU/memory
kubectl describe pod <pending-pod>
# Look for: "Insufficient pods" or "0/N nodes are available: N Insufficient pods"

# Check node IP allocation
kubectl describe node ip-10-0-1-100.us-east-1.compute.internal | grep -E "Capacity|Allocatable"
# pods: shows max pods (depends on instance type ENI limits)

# Check CNI status
kubectl get pods -n kube-system -l k8s-app=aws-node
kubectl logs -n kube-system aws-node-<xyz> | grep -i "IP address"

# Check ENI usage on the node
aws ec2 describe-network-interfaces \
  --filters "Name=attachment.instance-id,Values=i-0abc123" \
  --query 'NetworkInterfaces[*].{ID:NetworkInterfaceId,IPs:PrivateIpAddresses}'
```

Fix options:
- Use prefix delegation (EKS add-on config, assigns /28 blocks per ENI slot)
- Use larger instance types with more ENI/IP capacity
- Add subnets with more address space and update the node group

---

## EKS Pod Cannot Reach Internet

```bash
# Check from inside the pod
kubectl exec -it my-pod -n production -- curl -v https://api.external.com

# If DNS fails first:
kubectl exec -it my-pod -n production -- nslookup api.external.com
# Check CoreDNS is healthy
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check the node's route table
kubectl get node -o wide  # find node IP
# In AWS console: check which route table is associated with the node's subnet
# Private subnet must have 0.0.0.0/0 -> NAT Gateway route

# Check if security group blocks outbound
aws ec2 describe-security-groups \
  --group-ids sg-node-group \
  --query 'SecurityGroups[0].IpPermissionsEgress'
# Must allow outbound 443 (or 0/0)
```

Common causes and fixes:

| Cause | Fix |
|---|---|
| Subnet has no default route (no NAT GW) | Add NAT Gateway to public subnet; add route 0.0.0.0/0 -> nat-xxxx to private route table |
| NAT Gateway in wrong AZ | Node in AZ-b routing through NAT GW in AZ-a (cross-AZ charge + possible AZ issue) — add NAT GW per AZ |
| Security group blocks outbound | Add outbound allow rule for 443 and 80 |
| NetworkPolicy denies egress | Check `kubectl get networkpolicy -n production`; default-deny may block egress |
| Cluster has private endpoint only | kubectl/CI access requires VPN or VPC peering to cluster VPC |

---

## IAM Or Access Problems

Symptoms:

- Deployment suddenly cannot call cloud APIs.
- App works in staging but not production.
- One role or service account fails while others work.

Check:

```text
principal identity
attached policies
trust relationship
permission boundary
organization policy
resource policy
recent IAM changes
```

SRE tip: permission problems often appear as application errors. Always check the exact cloud API error in logs.

---

## EC2 Or VM Issues

Symptoms:

- Instance unreachable
- App process stopped
- Disk full
- CPU saturated
- Instance failed health check

Checks:

```bash
df -h
free -m
top
systemctl status nginx
journalctl -u nginx --since "1 hour ago"
```

Cloud-side checks:

```text
instance status checks
system status checks
security group
route table
NACL
EBS volume metrics
Auto Scaling activity
```

If the instance is cattle, replace it. If it is a pet, document why and remove that dependency later.

---

## S3 Access Denied Troubleshooting

S3 `Access Denied` can come from multiple sources. Identify which layer is blocking:

```bash
# Get the bucket policy
aws s3api get-bucket-policy --bucket my-bucket | jq '.Policy | fromjson'

# Check Block Public Access settings
aws s3api get-public-access-block --bucket my-bucket

# Check object ACL (if ACLs are enabled)
aws s3api get-object-acl --bucket my-bucket --key my-object.txt

# Who is calling?
aws sts get-caller-identity

# Check if bucket is encrypted with KMS and the caller has kms:Decrypt
aws s3api get-bucket-encryption --bucket my-bucket
# If CMK: the calling role must have kms:Decrypt in the key policy AND identity policy

# Check if the caller is in the same account as the bucket owner
# Cross-account S3 requires BOTH bucket policy AND identity policy to allow
```

Common S3 Access Denied causes:

| Cause | Diagnosis | Fix |
|---|---|---|
| Identity policy missing `s3:GetObject` | `simulate-principal-policy` | Add action to role |
| Bucket policy denies the caller | Get bucket policy, check principal | Update bucket policy |
| Block Public Access enabled (for public access) | `get-public-access-block` | Intentional? Use signed URL or CloudFront |
| KMS key policy denies caller | Check key policy, check `kms:Decrypt` | Update key policy |
| Cross-account access: bucket policy allows, but caller's identity policy does not | Both must allow | Add S3 actions to the role policy in the external account |
| VPC endpoint policy too narrow | Check endpoint policy | Expand endpoint policy |

---

## RDS Connection Refused And Troubleshooting

### Connection Refused Or Timeout

```bash
# Test connectivity from app host
nc -vz my-db.cluster-xxx.us-east-1.rds.amazonaws.com 5432
# Connection refused: SG is blocking, or RDS is not listening
# Timeout: NACL blocking return traffic, or routing issue

# Check RDS SG allows inbound from app SG
aws ec2 describe-security-groups \
  --group-ids sg-rds1234 \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]'

# RDS events (shows failover, storage, maintenance)
aws rds describe-events \
  --source-identifier my-postgres \
  --source-type db-instance \
  --duration 60 \
  --query 'Events[*].{Time:Date,Message:Message}'
```

### High Connection Count

```bash
# Check current connection count via CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=my-postgres \
  --start-time $(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ") \
  --end-time $(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --period 60 \
  --statistics Maximum
# Fix: Add RDS Proxy between Lambda/app and RDS
```

Symptoms:

- Connection timeouts
- High CPU
- Connection count spike (port 5432 or 3306)
- Slow queries
- Replica lag
- Storage full

Check:

```text
security group: port 5432/3306 allowed from app SG
subnet group: correct subnets
RDS events: failover/maintenance/storage
DB connections count vs max_connections
CPU utilization and IOPS
free storage space
slow query log
replica lag (ReplicaLag metric)
recent schema migrations
```

Common fixes:

- Add or tune application connection pooling.
- Use RDS Proxy for bursty connection patterns.
- Add read replica for read-heavy workloads.
- Increase storage or enable storage autoscaling.
- Fix slow queries before scaling blindly.

---

## S3 Issues

Symptoms:

- Access denied
- Object not found
- Static site broken
- Replication lag
- Unexpected cost increase

Check:

```text
bucket policy
object key
public access block
KMS key policy
lifecycle policy
versioning
replication rule
CloudFront origin path
```

For static websites, distinguish these:

```text
S3 REST endpoint
S3 website endpoint
CloudFront distribution endpoint
custom domain
```

They behave differently.

---

## Lambda Issues

Symptoms:

- Timeout
- Memory exceeded
- Cold starts
- Throttling
- Downstream service overload

Check:

```text
timeout setting
memory setting
concurrency
CloudWatch logs
event source retry policy
DLQ or failure destination
VPC networking
```

If Lambda overloads a database, cap concurrency or introduce SQS/RDS Proxy.

---

## DynamoDB Issues

Symptoms:

- Throttling
- Slow query
- High cost
- Lambda trigger not firing

Check:

```text
partition key design
hot partitions
GSI usage
capacity mode
stream enabled
batch size
retry behavior
```

Avoid large table scans in production paths. Design from access patterns first.

---

## CloudWatch Alarm Not Firing

```bash
# Check alarm state and reason
aws cloudwatch describe-alarms \
  --alarm-names my-alarm \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason,Metric:MetricName,Namespace:Namespace}'

# Common states:
# OK: metric is below threshold
# ALARM: metric is above threshold, alarm should have fired
# INSUFFICIENT_DATA: not enough data points to evaluate

# Check if the metric is actually being published
aws cloudwatch list-metrics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --query 'Metrics[*].Dimensions'
# If empty: metric has no data (no requests, or wrong dimension name)

# Check the dimension values — wrong values mean the alarm sees no data
# For EKS Container Insights, check ClusterName dimension exactly
aws cloudwatch list-metrics \
  --namespace ContainerInsights \
  --query 'Metrics[?MetricName==`pod_cpu_utilization`].Dimensions'
```

Common reasons alarms do not fire:
- Metric has no data because nothing is publishing it (wrong namespace, wrong dimension)
- `INSUFFICIENT_DATA` treated as OK (default behavior — change with `treat-missing-data: breaching`)
- Evaluation period too short to catch a brief spike
- Wrong statistics (Sum vs Average matters for sparse metrics)

Fix insufficient data treatment:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name my-alarm \
  --treat-missing-data breaching \
  ... (other params)
```

---

## AWS Cost Spike Investigation

```bash
# Step 1: Service breakdown for last 30 days
aws ce get-cost-and-usage \
  --time-period Start=2026-04-17,End=2026-05-17 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE | \
  jq '.ResultsByTime[0].Groups | sort_by(.Metrics.UnblendedCost.Amount | tonumber) | reverse | .[:10] | .[] | {service: .Keys[0], cost: .Metrics.UnblendedCost.Amount}'

# Step 2: Find who launched expensive resources
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=RunInstances \
  --start-time 2026-05-10T00:00:00Z \
  --query 'Events[*].{Time:EventTime,User:Username,Source:SourceIPAddress}'

# Step 3: Check for NAT Gateway spike
aws cloudwatch get-metric-statistics \
  --namespace AWS/NatGateway \
  --metric-name BytesOutToDestination \
  --dimensions Name=NatGatewayId,Value=nat-0abc123 \
  --start-time 2026-05-10T00:00:00Z \
  --end-time 2026-05-17T00:00:00Z \
  --period 86400 \
  --statistics Sum

# Step 4: Check unattached EBS volumes
aws ec2 describe-volumes \
  --filters "Name=status,Values=available" \
  --query 'Volumes[*].{ID:VolumeId,Size:Size,Type:VolumeType,AZ:AvailabilityZone}'
```

Common cost spike causes:

- NAT Gateway data processing (EC2/ECR/CloudWatch traffic through NAT instead of VPC endpoints)
- Cross-region traffic (services in different regions calling each other)
- Cross-AZ traffic (same-AZ routing not configured)
- High log volume (verbose logging pushed to CloudWatch at high cardinality)
- Long log retention (30-year default on some log groups)
- Idle databases (test/dev DB forgotten)
- Unattached EBS volumes from terminated instances
- Old snapshots accumulating
- Missing S3 lifecycle policy
- Runaway Auto Scaling event (launched 10x expected capacity)

Cost spike triage is operational triage. Treat it like any other production signal.

---

## GCP Troubleshooting

### VPC Firewall Rules

```bash
# List firewall rules for a network
gcloud compute firewall-rules list --filter="network:app-vpc"

# Check effective firewall rules for an instance
gcloud compute instances describe my-instance --zone us-central1-a \
  --format="get(networkInterfaces[0].network)"

# Use VPC firewall rules log (in Cloud Logging)
# resource.type="gce_subnetwork"
# jsonPayload.rule_details.action="DENY"
# | sort timestamp desc
```

### IAM Policy Troubleshooter

```bash
# Check if a member can perform an action on a resource
gcloud policy-troubleshoot iam \
  --principal-email=my-sa@project.iam.gserviceaccount.com \
  --resource=//storage.googleapis.com/projects/_/buckets/my-bucket \
  --permission=storage.objects.get
```

### GKE Node Pool Issues

```bash
# Check node pool status
gcloud container node-pools describe my-pool \
  --cluster my-cluster \
  --zone us-central1-a

# View node pool events
kubectl get events -n kube-system --sort-by=.lastTimestamp | tail -20

# Check for autoscaling activity
gcloud logging read 'resource.type="k8s_cluster" logName:"cluster-autoscaler"' \
  --limit=50 \
  --format="table(timestamp,textPayload)"
```

---

## Azure Troubleshooting

### NSG Effective Rules

```bash
# Show effective NSG rules for a NIC
az network nic show-effective-nsg \
  --resource-group my-rg \
  --name my-nic \
  --query 'effectiveNetworkSecurityGroups[*].effectiveSecurityRules[?access==`Deny`]'

# Enable NSG flow logs
az network watcher flow-log create \
  --resource-group my-rg \
  --nsg my-nsg \
  --storage-account my-storage-account \
  --enabled true
```

### Azure Monitor Diagnostics

```bash
# Check AKS pod logs via Azure Monitor
az monitor log-analytics query \
  --workspace my-workspace-id \
  --analytics-query "ContainerLog | where ContainerName == 'my-app' | take 100" \
  --output table

# Check AKS activity for node events
az monitor activity-log list \
  --resource-group my-rg \
  --resource-type Microsoft.ContainerService/managedClusters \
  --query '[*].{Time:eventTimestamp,Operation:operationName.value,Status:status.value}'
```

### AKS Node Pool Issues

```bash
# List nodes and status
kubectl get nodes -o wide

# Describe a NotReady node
kubectl describe node my-node

# Check AKS upgrade status
az aks get-upgrades --resource-group my-rg --name my-cluster

# Manually drain a node for maintenance
kubectl drain my-node --ignore-daemonsets --delete-emptydir-data
```

---

## Cost Spike Troubleshooting

Start with:

```text
service breakdown (by service, then by usage type)
region breakdown
tag or account breakdown
daily trend (which day did it start?)
CloudTrail for who launched what
```

Common causes:

- NAT Gateway data processing
- Cross-region traffic
- Cross-AZ traffic
- High log volume
- Long log retention
- Idle databases
- Unattached disks
- Old snapshots
- No S3 lifecycle policy

Cost spike triage is operational triage. Treat it like any other production signal.

---

## Final Rule

Be specific when reporting a cloud incident:

```text
DNS failed.
CDN failed.
Load balancer had no healthy targets.
Private networking failed.
IAM denied the workload.
Database capacity was exhausted.
The application regressed.
```

Each statement points to a different owner, dashboard, and mitigation path.
