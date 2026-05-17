---
title: "Intermediate"
sidebar_position: 2
---

# Cloud Platforms — Intermediate

Intermediate cloud engineering is about connecting services into reliable systems. You move from knowing EC2, S3, IAM, and RDS individually to understanding their contracts, failure modes, and cost/security tradeoffs.

---

## Production AWS Building Blocks

A common production AWS stack looks like this:

```text
Route 53 -> CloudFront/WAF -> ALB -> private compute -> managed database -> object storage
```

Supporting layers:

```text
IAM -> VPC -> logging -> monitoring -> backups -> cost controls -> incident response
```

The architecture is only production-ready when the supporting layers are designed, not bolted on later.

---

## VPC Design Patterns

A VPC should support isolation, routing clarity, and growth.

### Pattern 1: Single VPC Multi-AZ (most common)

```text
VPC: 10.0.0.0/16
  Region: us-east-1

  AZ us-east-1a:
    Public:   10.0.1.0/24   <- ALB nodes, NAT GW
    Private:  10.0.11.0/24  <- App, EKS nodes
    Database: 10.0.21.0/24  <- RDS primary

  AZ us-east-1b:
    Public:   10.0.2.0/24
    Private:  10.0.12.0/24
    Database: 10.0.22.0/24  <- RDS standby

  AZ us-east-1c:
    Public:   10.0.3.0/24
    Private:  10.0.13.0/24
    Database: 10.0.23.0/24
```

### Pattern 2: Multi-VPC With Transit Gateway (hub-and-spoke)

For organizations with many teams or environments:

```text
Shared Services VPC (10.1.0.0/16)
  -> DNS resolver
  -> Egress NAT
  -> Monitoring agents

Team A VPC (10.2.0.0/16)
Team B VPC (10.3.0.0/16)
Prod VPC   (10.4.0.0/16)

All connected via Transit Gateway
Route tables on TGW control who can talk to whom.
Team VPCs are isolated from each other — only route to shared services.
```

VPC peering limits: peering is non-transitive. If VPC-A peers with VPC-B, and VPC-B peers with VPC-C, VPC-A cannot reach VPC-C through VPC-B. Transit Gateway solves this.

### Routing Pattern

| Subnet | Route to internet | Common resources |
|---|---|---|
| Public | Internet Gateway (igw-) | ALB, NAT Gateway |
| Private | NAT Gateway (nat-) | App servers, EKS nodes, ECS tasks |
| Database | None (no default route) | RDS, Aurora, internal data services |

### Security Groups vs NACLs — Detailed Comparison

| Feature | Security Group | NACL |
|---|---|---|
| Scope | ENI / instance / load balancer | Subnet |
| Stateful | Yes — return traffic automatic | No — must allow return explicitly |
| Rule type | Allow only | Allow and deny |
| Rule evaluation | All rules evaluated; most permissive wins | Numbered rules; first match wins |
| Default (new) | Deny all inbound, allow all outbound | Allow all (default NACL) |
| Common use | App-level traffic policy | Coarse subnet guardrail |

Real example — the NACL statelessness trap:

```text
NACL on database subnet:
  Inbound:  ALLOW TCP 0.0.0.0/0 port 5432
  Outbound: ALLOW TCP 0.0.0.0/0 port 443   <- WRONG

Lambda connects to RDS on port 5432.
Response from RDS goes to Lambda's ephemeral port (32768-60999).
NACL outbound only allows 443, so response is BLOCKED.
Lambda sees a connection timeout even though security group would allow it.

Fix:
  Outbound: ALLOW TCP 0.0.0.0/0 ports 1024-65535 (ephemeral range)
```

SG-to-SG references are more maintainable than CIDR rules. When you add a new AZ or change subnet CIDR, SG-to-SG references still work:

```bash
# Better: reference the source SG instead of a CIDR
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-0app5678
# This allows any instance with sg-0app5678 attached, regardless of IP
```

### AWS CLI Networking Commands

```bash
# Describe VPCs
aws ec2 describe-vpcs \
  --query 'Vpcs[*].{ID:VpcId,CIDR:CidrBlock}'

# Describe subnets
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0abc123"

# Describe route tables
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'RouteTables[*].{ID:RouteTableId,Routes:Routes,Assoc:Associations}'

# Describe security groups
aws ec2 describe-security-groups \
  --group-ids sg-0abc123

# Check ALB scheme (internet-facing vs internal)
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[*].{Name:LoadBalancerName,Scheme:Scheme}'

# Enable VPC Flow Logs
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-0abc123 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/flowlogs \
  --deliver-logs-permission-arn arn:aws:iam::123456789:role/FlowLogsRole
```

---

## IAM In Real Systems

IAM should be designed around identities and workloads, not individual people clicking around.

### Good IAM Patterns

- Human users authenticate through SSO.
- Workloads use roles or workload identity.
- Production access is time-bound and audited.
- CI/CD has separate build and deployment permissions.
- Accounts/projects are separated by environment.
- Organization-level policies prevent dangerous actions globally.

### Policy Evaluation Mental Model

```text
explicit deny -> deny
no allow -> deny
explicit allow with no deny -> allow
```

Policy sources may include identity policies, resource policies, permission boundaries, session policies, and organization guardrails.

### Common IAM Mistakes

- Giving administrator access to CI jobs
- Long-lived access keys in laptops or repositories
- Wildcard actions on wildcard resources
- No MFA for privileged humans
- Shared credentials with no owner
- Missing CloudTrail review

---

## EKS Deep Dive: VPC CNI, IRSA, And ALB Ingress

### EKS Networking: VPC CNI

AWS VPC CNI assigns each pod a real VPC IP address (from the node's subnet CIDR). This is different from GKE, which uses its own pod CIDR allocation. The consequence: pod IP addresses consume VPC CIDR space.

```text
Node has 10 ENIs, each with 30 secondary IPs -> 300 pod slots
If subnet is /24 (254 addresses), and you have 5 nodes with 50 pods each,
that is 250 pod IPs plus 5 node IPs = subnet getting full.
```

Symptoms of VPC CNI IP exhaustion:

- Pods stuck in Pending state
- Node shows CPU/memory available but Pods still Pending
- CNI error: `no IPs available`

```bash
# Check node capacity and IP status
kubectl describe node ip-10-0-1-100.us-east-1.compute.internal | grep -A5 "Allocatable"

# Describe network interfaces for a node
aws ec2 describe-network-interfaces \
  --filters "Name=attachment.instance-id,Values=i-0abc123"

# View CNI plugin logs
kubectl logs -n kube-system -l k8s-app=aws-node --tail=50
```

Fix options: use larger subnets, use prefix delegation (allows /28 blocks per ENI instead of individual IPs), or use Karpenter with multiple subnet selectors.

### IRSA: IAM Roles for Service Accounts

IRSA lets Kubernetes pods assume AWS IAM roles without static credentials. The EKS cluster acts as an OIDC provider. A ServiceAccount annotation ties the K8s identity to an AWS role.

Setup steps:

```bash
# Step 1: Associate OIDC provider with the cluster (one time per cluster)
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --region us-east-1 \
  --approve

# Step 2: Create IAM role with trust policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
OIDC_PROVIDER=$(aws eks describe-cluster --name my-cluster \
  --query "cluster.identity.oidc.issuer" --output text | sed 's|https://||')

cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER}"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "${OIDC_PROVIDER}:sub": "system:serviceaccount:my-namespace:my-serviceaccount"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name my-pod-role \
  --assume-role-policy-document file://trust-policy.json

# Step 3: Attach permissions policy
aws iam attach-role-policy \
  --role-name my-pod-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Step 4: Annotate the Kubernetes ServiceAccount
kubectl create serviceaccount my-serviceaccount -n my-namespace
kubectl annotate serviceaccount my-serviceaccount \
  -n my-namespace \
  eks.amazonaws.com/role-arn=arn:aws:iam::${ACCOUNT_ID}:role/my-pod-role
```

IRSA trust policy condition: the `sub` field must match `system:serviceaccount:<namespace>:<serviceaccount-name>` exactly. A mismatch causes an `AssumeRoleWithWebIdentity` failure visible in CloudTrail.

ServiceAccount YAML:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-serviceaccount
  namespace: my-namespace
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/my-pod-role
```

Pod spec referencing the ServiceAccount:

```yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: my-serviceaccount
  containers:
  - name: app
    image: my-image
    # The AWS SDK will auto-detect the projected token at:
    # /var/run/secrets/eks.amazonaws.com/serviceaccount/token
```

### ALB Ingress Controller

The AWS Load Balancer Controller provisions ALBs from Kubernetes Ingress resources. It needs an IAM role (via IRSA) to create and manage AWS resources.

```bash
# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=my-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

Ingress resource targeting pods directly (IP mode):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip          # pod IPs, not node IPs
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123:certificate/abc
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

Target type `ip` sends traffic directly to pod IPs. Target type `instance` sends to node IPs and uses NodePort. IP mode gives per-pod health checks and works with VPC CNI natively.

### EKS Node Groups vs Fargate

| Option | When to use |
|---|---|
| Managed node groups | Standard; AWS manages node OS patching and replacement |
| Self-managed nodes | Deep customization needed; specific AMIs required |
| Fargate profiles | Serverless pods; no node management; works well for isolated workloads |
| Karpenter | Dynamic right-sizing; consolidation; supports diverse instance types |

```bash
# Create EKS cluster with eksctl
eksctl create cluster \
  --name my-cluster \
  --region us-east-1 \
  --version 1.30 \
  --nodegroup-name default \
  --node-type m6i.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --name my-cluster --region us-east-1

# List node groups
aws eks list-nodegroups --cluster-name my-cluster

# Upgrade node group AMI
aws eks update-nodegroup-version \
  --cluster-name my-cluster \
  --nodegroup-name default
```

---

## EC2 And Auto Scaling

EC2 is flexible but operationally heavier than serverless or managed platforms.

### Instance Family Decision

| Workload | Instance family direction |
|---|---|
| General web/API | General purpose |
| CPU-heavy batch | Compute optimized |
| In-memory analytics | Memory optimized |
| Local high IOPS | Storage optimized |
| ML or graphics | Accelerated computing |

### Pricing Decision

| Pricing model | Use when |
|---|---|
| On-demand | Unknown or temporary workloads |
| Savings Plans | Predictable compute baseline |
| Reserved Instances | Stable long-term instance usage |
| Spot | Stateless, restartable, fault-tolerant jobs |
| Dedicated Host | Licensing or compliance requirement |

### Auto Scaling

Auto Scaling has two dimensions:

- **Scale out**: add more instances.
- **Scale in**: remove instances.

Important production details:

- Health checks should reflect application readiness.
- Scale-in protection may be needed for stateful or long-running tasks.
- Warmup time prevents thrashing.
- Target tracking works well for simple CPU or request-per-target goals.

---

## Auto Scaling: Launch Templates And Lifecycle Hooks

Launch templates define how ASG instances are created. They replace launch configurations (now deprecated):

```bash
# Create a launch template
aws ec2 create-launch-template \
  --launch-template-name my-app-lt \
  --version-description "v1" \
  --launch-template-data '{
    "ImageId": "ami-0abc123",
    "InstanceType": "m6i.large",
    "IamInstanceProfile": {"Arn": "arn:aws:iam::123:instance-profile/my-role"},
    "SecurityGroupIds": ["sg-0app123"],
    "UserData": "<base64-encoded-script>"
  }'

# Create ASG using the launch template
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name my-asg \
  --launch-template "LaunchTemplateName=my-app-lt,Version=$Latest" \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 3 \
  --vpc-zone-identifier "subnet-0abc,subnet-0def"
```

ASG lifecycle hooks let you pause instance launch or termination to run custom logic:

```bash
# Hook: pause before instance goes into service (useful for warming up)
aws autoscaling put-lifecycle-hook \
  --lifecycle-hook-name my-launch-hook \
  --auto-scaling-group-name my-asg \
  --lifecycle-transition autoscaling:EC2_INSTANCE_LAUNCHING \
  --default-result CONTINUE \
  --heartbeat-timeout 300

# Scale-in protection: prevent specific instances from being terminated
aws autoscaling set-instance-protection \
  --instance-ids i-0abc123 \
  --auto-scaling-group-name my-asg \
  --protected-from-scale-in
```

---

## S3 Operational Design

S3 is object storage with extremely high durability. Use it for static assets, backups, logs, data lakes, and artifacts.

### Storage Classes

| Class | Use case |
|---|---|
| Standard | Frequently accessed data |
| Standard-IA | Infrequent but rapid retrieval |
| One Zone-IA | Cheaper data with AZ-loss tolerance |
| Glacier Instant Retrieval | Archive with millisecond retrieval |
| Glacier Flexible Retrieval | Archive with slower retrieval |
| Deep Archive | Long-term compliance archive |
| Intelligent-Tiering | Unknown or changing access patterns |

### Production Controls

- Block public access by default.
- Use bucket policies intentionally.
- Enable versioning for critical buckets.
- Use lifecycle policies for cost control.
- Enable replication for cross-region recovery needs.
- Use access logs or CloudTrail data events where required.

### S3 Lifecycle Policy Example

```json
{
  "Rules": [{
    "ID": "app-logs-lifecycle",
    "Status": "Enabled",
    "Filter": {"Prefix": "logs/"},
    "Transitions": [
      {"Days": 30,  "StorageClass": "STANDARD_IA"},
      {"Days": 90,  "StorageClass": "GLACIER"}
    ],
    "Expiration": {"Days": 365},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
  }]
}
```

Apply via CLI:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration file://lifecycle.json
```

### Presigned URLs

Presigned URLs grant time-limited access to private objects without changing bucket policy:

```bash
# Generate a presigned URL valid for 1 hour
aws s3 presign s3://my-bucket/my-object.pdf --expires-in 3600
```

### S3 Replication

Same-Region Replication (SRR) and Cross-Region Replication (CRR) both require versioning enabled on the source bucket. Replication is not retroactive — only new objects are replicated.

```bash
aws s3api put-bucket-replication \
  --bucket source-bucket \
  --replication-configuration '{
    "Role": "arn:aws:iam::123:role/replication-role",
    "Rules": [{
      "Status": "Enabled",
      "Destination": {
        "Bucket": "arn:aws:s3:::dest-bucket",
        "StorageClass": "STANDARD_IA"
      }
    }]
  }'
```

---

## RDS, Aurora, And RDS Proxy

RDS reduces operational work for relational databases, but it does not remove database engineering.

### RDS Features

- Automated backups
- Point-in-time restore
- Multi-AZ failover
- Read replicas
- Patch management
- Storage autoscaling

### Multi-AZ vs Read Replica

| Feature | Multi-AZ | Read replica |
|---|---|---|
| Purpose | High availability | Read scaling |
| Replication | Synchronous or managed HA | Asynchronous |
| Used by app for reads | Usually no | Yes |
| Failover | Automatic | Manual or promoted depending setup |

### RDS Multi-AZ Failover Mechanics

A Multi-AZ DB instance has a standby in a different AZ. Replication is synchronous (zero data loss). When a failover occurs:

1. Primary fails or maintenance triggers failover
2. AWS detects failure (typically within 60 seconds)
3. DNS CNAME of the RDS endpoint flips to the standby
4. Standby becomes the new primary
5. Applications must reconnect (the endpoint DNS is the same, but the IP changes)

Applications that do not handle reconnect properly after failover will keep failing even after the database is healthy. Use connection retry logic and set reasonable DNS TTL.

```bash
# Trigger a manual failover (for testing)
aws rds reboot-db-instance \
  --db-instance-identifier my-postgres \
  --force-failover

# Check current failover/HA status
aws rds describe-db-instances \
  --db-instance-identifier my-postgres \
  --query 'DBInstances[0].{Status:DBInstanceStatus,MultiAZ:MultiAZ,SecondaryAZ:SecondaryAvailabilityZone}'
```

Aurora serverless vs provisioned:

| Mode | Use case | Scaling |
|---|---|---|
| Provisioned | Predictable, stable workloads | Manual or storage autoscaling |
| Aurora Serverless v2 | Variable or unpredictable workloads | Scales in fractional ACUs |
| Aurora Global Database | Multi-region reads and DR | Cross-region replicas with < 1s lag |

### RDS Proxy

RDS Proxy pools and reuses database connections. It is especially useful for Lambda or bursty application workloads that would otherwise open too many database connections.

Use it when:

- Apps frequently open and close connections.
- Lambda functions connect to RDS.
- Failover time matters.
- Database connection exhaustion is a recurring issue.

RDS Proxy also supports IAM authentication:

```bash
# Generate an auth token for IAM-authenticated RDS connection
aws rds generate-db-auth-token \
  --hostname my-db.cluster-xxxx.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --region us-east-1 \
  --username my-app-user
```

---

## Lambda And Event-Driven Design

Lambda is good for event-driven workloads, scheduled tasks, light APIs, and asynchronous processing.

Common patterns:

```text
API Gateway -> Lambda -> DynamoDB
S3 object upload -> Lambda -> image or data processing
EventBridge schedule -> Lambda -> automation
SQS queue -> Lambda -> async worker
```

Important limits:

- Maximum execution duration: 15 minutes.
- Memory allocation also affects CPU allocation.
- Cold starts depend on runtime, package size, VPC use, and initialization work.
- Concurrency can protect downstream services or throttle them accidentally.

---

## DynamoDB Design Basics

DynamoDB is not a relational database. It is designed around access patterns.

Key ideas:

- Partition key decides data distribution.
- Sort key enables ordered access within a partition.
- GSI supports alternate query patterns.
- Query is preferred; Scan is expensive on large tables.
- On-demand mode is easier for unpredictable workloads.
- Provisioned mode is cost-effective for stable traffic.

Troubleshooting signs:

- Throttling: capacity or hot partition issue.
- Slow query: missing key design or GSI.
- Expensive workload: scans or poor access pattern modeling.

---

## CloudWatch: Metrics, Alarms, Logs Insights

CloudWatch answers "what is happening operationally?" Three key areas:

### Metric Math and Alarms

```bash
# List available metrics for EKS
aws cloudwatch list-metrics --namespace ContainerInsights

# Get a specific metric
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/my-alb/abc123 \
  --start-time 2026-05-17T10:00:00Z \
  --end-time 2026-05-17T11:00:00Z \
  --period 60 \
  --statistics Average

# Create an alarm on ALB 5xx rate
aws cloudwatch put-metric-alarm \
  --alarm-name alb-5xx-high \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/abc123 \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123:my-topic
```

### CloudWatch Logs Insights Queries

```
# Count 5xx errors in last hour by path
fields @timestamp, @message
| filter status >= 500
| stats count(*) as error_count by path
| sort error_count desc
| limit 20

# Find slow queries (p99 latency)
fields @timestamp, duration, requestId
| filter duration > 1000
| stats percentile(duration, 99) as p99_ms by bin(5m)

# EKS container restarts
fields @timestamp, kubernetes.container_name, log
| filter log like /OOMKilled|CrashLoop/
| stats count(*) by kubernetes.container_name
```

### EventBridge Rules

EventBridge routes AWS service events to targets:

```bash
# Rule: alert when RDS failover happens
aws events put-rule \
  --name rds-failover-alert \
  --event-pattern '{"source":["aws.rds"],"detail-type":["RDS DB Instance Event"],"detail":{"Message":["Failover"]}}'

# Add SNS target to the rule
aws events put-targets \
  --rule rds-failover-alert \
  --targets '[{"Id":"sns-target","Arn":"arn:aws:sns:us-east-1:123:alerts"}]'
```

---

## Load Balancing And CDN

### ALB

Use Application Load Balancer for HTTP/HTTPS microservices, path routing, host routing, headers, and WebSockets.

### NLB

Use Network Load Balancer for TCP/UDP, ultra-low latency, static IP needs, and source IP preservation.

### CloudFront

Use CloudFront for caching static or dynamic content near users, reducing origin load and latency.

Common edge pattern:

```text
Route 53 -> CloudFront -> WAF -> ALB -> app
```

---

## GCP Intermediate: GKE, Cloud SQL, And Cloud Armor

### GKE Autopilot vs Standard

| Mode | When to use |
|---|---|
| Standard | Full control over node pools, custom node config, specific instance types |
| Autopilot | Serverless nodes; Google manages node provisioning; pay per pod |

GKE uses VPC-native (alias IPs) networking. Pods get IPs from a secondary IP range on the subnet — no VPC CIDR exhaustion like AWS VPC CNI.

### GCS Storage Classes

| Class | Minimum storage | Use case |
|---|---|---|
| Standard | None | Frequently accessed data |
| Nearline | 30 days | Access < once per month |
| Coldline | 90 days | Access < once per quarter |
| Archive | 365 days | Long-term backup |

### Cloud Armor

Cloud Armor is GCP's WAF and DDoS protection, attached to the External HTTPS Load Balancer:

```bash
# Create a security policy
gcloud compute security-policies create my-policy \
  --description "WAF policy for API"

# Add a rule to block a specific IP range
gcloud compute security-policies rules create 1000 \
  --security-policy my-policy \
  --expression "inIpRange(origin.ip, '192.0.2.0/24')" \
  --action deny-403

# Attach to a backend service
gcloud compute backend-services update my-backend \
  --security-policy my-policy \
  --global
```

### VPC Service Controls

VPC Service Controls create a security perimeter around GCP API services. Even if a workload has a valid credential, it cannot access a service outside the perimeter without explicit access levels.

Use case: prevent a compromised service account from exfiltrating Cloud SQL data to an external destination.

---

## Azure Intermediate: AKS, ACR, And Azure Monitor

### AKS

AKS control plane is free (AWS EKS charges ~$0.10/hr). Key differences:

```bash
# Create AKS cluster
az aks create \
  --resource-group my-rg \
  --name my-cluster \
  --kubernetes-version 1.29 \
  --node-count 3 \
  --node-vm-size Standard_D4s_v5 \
  --network-plugin azure \
  --enable-managed-identity \
  --generate-ssh-keys

# Add a node pool
az aks nodepool add \
  --resource-group my-rg \
  --cluster-name my-cluster \
  --name gpupool \
  --node-vm-size Standard_NC6s_v3 \
  --node-count 1

# Enable Azure Workload Identity
az aks update \
  --resource-group my-rg \
  --name my-cluster \
  --enable-oidc-issuer \
  --enable-workload-identity
```

### Azure Workload Identity (equivalent of IRSA)

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  namespace: default
  annotations:
    azure.workload.identity/client-id: "<managed-identity-client-id>"
```

### Azure Container Registry

```bash
# Login to ACR
az acr login --name myregistry

# Build and push via ACR tasks (no local Docker needed)
az acr build --registry myregistry --image myapp:v1 .

# Add geo-replication
az acr replication create --registry myregistry --location westeurope
```

### Network Security Groups (Azure equivalent of AWS Security Groups)

NSGs are stateful and can be attached to subnets or NICs. They support both allow and deny rules (unlike AWS SGs which are allow-only).

```bash
# Create NSG
az network nsg create --resource-group my-rg --name my-nsg

# Add a rule
az network nsg rule create \
  --resource-group my-rg \
  --nsg-name my-nsg \
  --name allow-https \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-range 443

# Show effective NSG rules for a NIC
az network nic show-effective-nsg \
  --resource-group my-rg \
  --name my-nic
```

---

## Intermediate Takeaways

1. Network layout determines security and blast radius.
2. IAM design should use roles and environment isolation.
3. EC2 is powerful but operationally heavier.
4. S3 needs policy, lifecycle, and versioning decisions.
5. RDS Multi-AZ is for availability; replicas are for scaling reads.
6. Lambda is excellent for event-driven work but has runtime limits.
7. DynamoDB requires access-pattern-first design.
8. Load balancer health checks must match real app readiness.
