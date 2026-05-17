---
title: "Cheat Sheet"
sidebar_position: 6
---

# Cloud Platforms — Cheat Sheet

Fast recall for AWS/GCP/Azure concepts, CLI checks, architecture patterns, and interview-ready comparisons.

---

## Core Cloud Layers

```text
identity -> network -> compute -> storage -> database -> traffic management -> observability -> cost
```

| Layer | AWS | GCP | Azure |
|---|---|---|---|
| Identity | IAM | Cloud IAM | Entra ID / RBAC |
| Network | VPC | VPC | VNet |
| VM | EC2 | Compute Engine | Virtual Machines |
| Object storage | S3 | Cloud Storage | Blob Storage |
| Relational DB | RDS / Aurora | Cloud SQL / AlloyDB | Azure SQL |
| Kubernetes | EKS | GKE | AKS |
| Functions | Lambda | Cloud Functions | Azure Functions |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| CDN | CloudFront | Cloud CDN | Azure CDN / Front Door |
| Monitoring | CloudWatch | Cloud Monitoring | Azure Monitor |
| Audit | CloudTrail | Cloud Audit Logs | Activity Logs |

---

## Shared Responsibility

```text
provider: facilities, hardware, managed platform
customer: identity, data, policies, app, config, exposure
```

Quick rule:

```text
The more managed the service, the less OS/platform work you own, but you still own data and access.
```

---

## AWS IAM Quick Recall

```text
principal -> action -> resource -> policy evaluation -> allow/deny
```

Evaluation rules:

```text
explicit deny wins
allow required
implicit deny by default
```

Best practices:

- Use SSO for humans.
- Use roles for workloads.
- Avoid long-lived keys.
- Enable MFA for privileged humans.
- Separate dev/staging/prod accounts.
- Review unused permissions.

---

## VPC Components

| Component | Purpose |
|---|---|
| VPC | Isolated virtual network |
| Subnet | IP range in one AZ |
| Route table | Controls packet path |
| Internet Gateway | Public internet route |
| NAT Gateway | Private subnet outbound internet |
| Security Group | Stateful workload firewall |
| NACL | Stateless subnet firewall |
| VPC Endpoint | Private cloud-service access |
| Transit Gateway | Hub-and-spoke routing |
| VPC Flow Logs | Network traffic records |

---

## Public vs Private Subnet

```text
public subnet: route to Internet Gateway
private subnet: no direct inbound internet path
```

Recommended layout:

```text
public: load balancer, NAT gateway
private: application compute
database: database only, no public route
```

---

## Security Group vs NACL

| Feature | Security Group | NACL |
|---|---|---|
| Scope | ENI/workload | Subnet |
| Stateful | Yes | No |
| Rules | Allow rules | Allow and deny rules |
| Common use | App access control | Coarse subnet guardrail |

---

## EC2 Pricing

| Model | Use case |
|---|---|
| On-demand | Unknown or short-lived workload |
| Reserved Instance | Stable instance pattern |
| Savings Plan | Stable compute spend |
| Spot | Interruptible stateless/batch jobs |
| Dedicated Host | Licensing or compliance |

---

## Auto Scaling Terms

```text
scale out: add capacity
scale in: remove capacity
scalability: can grow
elasticity: grows and shrinks automatically
```

Important knobs:

- Minimum capacity
- Desired capacity
- Maximum capacity
- Cooldown/warmup
- Target tracking metric
- Health check type

---

## S3 Storage Classes

| Class | Use case |
|---|---|
| Standard | Frequent access |
| Standard-IA | Infrequent access |
| One Zone-IA | Lower cost, single-AZ durability tradeoff |
| Intelligent-Tiering | Unknown access patterns |
| Glacier Instant | Archive with fast retrieval |
| Glacier Flexible | Archive with slower retrieval |
| Deep Archive | Long-term low-cost archive |

S3 safety checklist:

```text
block public access
versioning for critical data
lifecycle policies
replication only when RPO requires it
encryption
access logs or audit events when needed
```

---

## RDS And Aurora

| Feature | Purpose |
|---|---|
| Multi-AZ | High availability |
| Read replica | Read scaling |
| Automated backup | Point-in-time restore |
| Storage autoscaling | Avoid storage-full incidents |
| RDS Proxy | Connection pooling and faster recovery behavior |
| Aurora Global Database | Cross-region replication pattern |

Common metrics:

```text
CPUUtilization
DatabaseConnections
FreeStorageSpace
ReadLatency
WriteLatency
ReplicaLag
```

---

## DynamoDB Quick Recall

```text
single-table design starts from access patterns
query is preferred
scan is expensive
partition key distribution matters
```

Capacity modes:

| Mode | Use case |
|---|---|
| On-demand | Unpredictable traffic |
| Provisioned | Stable predictable traffic |

---

## Lambda Limits To Remember

```text
max duration: 15 minutes
memory affects CPU
cold starts depend on runtime/package/VPC/init work
concurrency protects or harms downstream dependencies
```

Common patterns:

```text
API Gateway -> Lambda -> DynamoDB
S3 event -> Lambda -> processing
EventBridge -> Lambda -> scheduled task
SQS -> Lambda -> async worker
```

---

## Load Balancer Selection

| Need | Use |
|---|---|
| HTTP path routing | ALB |
| Hostname routing | ALB |
| TCP/UDP | NLB |
| Very low latency L4 | NLB |
| Legacy basic balancing | Avoid CLB for new systems |
| Global caching | CloudFront |

---

## Route 53 Routing Policies

| Policy | Use |
|---|---|
| Simple | One target |
| Weighted | Percentage split |
| Latency | Route to lowest-latency region |
| Failover | Primary/secondary |
| Geolocation | Route by user geography |
| Multi-value | Return multiple healthy records |

---

## High Availability Pattern

```text
Route 53
  -> CloudFront/WAF
  -> ALB across public subnets
  -> app compute across private subnets
  -> RDS/Aurora Multi-AZ in database subnets
  -> S3 for static assets/backups
```

---

## Cost Quick Checks

```text
idle databases
unattached disks
old snapshots
NAT data processing
cross-AZ traffic
cross-region traffic
log retention
underused EC2
missing lifecycle policy
```

Cost tools:

```text
Cost Explorer
Compute Optimizer
Trusted Advisor
Cost and Usage Report
Budgets
```

---

## Full AWS CLI Reference

### IAM And STS

```bash
# Who am I?
aws sts get-caller-identity

# Assume a role
aws sts assume-role \
  --role-arn arn:aws:iam::123456789:role/target-role \
  --role-session-name session-name

# Assume role and export creds to env
eval $(aws sts assume-role \
  --role-arn arn:aws:iam::123456789:role/target-role \
  --role-session-name debug \
  --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
  --output text | awk '{print "export AWS_ACCESS_KEY_ID="$1"\nexport AWS_SECRET_ACCESS_KEY="$2"\nexport AWS_SESSION_TOKEN="$3}')

# List roles
aws iam list-roles --query 'Roles[*].{Name:RoleName,ARN:Arn}'

# Simulate policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123:role/my-role \
  --action-names s3:GetObject,s3:PutObject \
  --resource-arns arn:aws:s3:::my-bucket/*

# Get role's trust policy
aws iam get-role --role-name my-role \
  --query 'Role.AssumeRolePolicyDocument'

# List attached policies on a role
aws iam list-attached-role-policies --role-name my-role
```

### VPC And EC2

```bash
# List VPCs
aws ec2 describe-vpcs \
  --query 'Vpcs[*].{ID:VpcId,CIDR:CidrBlock,Tags:Tags}'

# List subnets in a VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'Subnets[*].{ID:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Public:MapPublicIpOnLaunch}'

# List route tables
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'RouteTables[*].{ID:RouteTableId,Routes:Routes,Assoc:Associations[*].SubnetId}'

# Describe security groups
aws ec2 describe-security-groups \
  --group-ids sg-0abc123

# Authorize SG ingress (SG-to-SG reference)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-0app5678

# List running EC2 instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].{ID:InstanceId,Type:InstanceType,IP:PrivateIpAddress,AZ:Placement.AvailabilityZone,Name:Tags[?Key==`Name`]|[0].Value}'

# VPC Flow Logs enable
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-0abc123 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/flowlogs \
  --deliver-logs-permission-arn arn:aws:iam::123:role/FlowLogsRole

# VPC Reachability Analyzer
aws ec2 create-network-insights-path \
  --source eni-0abc123 \
  --destination sg-0def456 \
  --protocol TCP \
  --destination-port 443

aws ec2 start-network-insights-analysis \
  --network-insights-path-id nip-0abc123
```

### EKS

```bash
# Update kubeconfig
aws eks update-kubeconfig --name my-cluster --region us-east-1

# List clusters
aws eks list-clusters

# Describe cluster (shows OIDC URL, k8s version, endpoint)
aws eks describe-cluster --name my-cluster

# List node groups
aws eks list-nodegroups --cluster-name my-cluster

# Upgrade node group AMI
aws eks update-nodegroup-version \
  --cluster-name my-cluster \
  --nodegroup-name default

# Check node labels from EC2 perspective
kubectl get nodes -o json | jq '.items[].metadata.labels'

# Check VPC CNI IP allocation
kubectl describe daemonset aws-node -n kube-system | grep image
kubectl logs -n kube-system -l k8s-app=aws-node | tail -30
```

### eksctl Reference

```bash
# Create cluster
eksctl create cluster \
  --name my-cluster \
  --region us-east-1 \
  --version 1.30 \
  --nodegroup-name default \
  --node-type m6i.large \
  --nodes 3 \
  --managed \
  --with-oidc

# Associate OIDC provider (IRSA prerequisite)
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --region us-east-1 \
  --approve

# Create IRSA ServiceAccount
eksctl create iamserviceaccount \
  --cluster my-cluster \
  --namespace production \
  --name my-app-sa \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --approve

# Upgrade cluster
eksctl upgrade cluster \
  --name my-cluster \
  --version 1.31 \
  --approve

# Upgrade nodegroup
eksctl upgrade nodegroup \
  --cluster my-cluster \
  --name default

# Create Fargate profile
eksctl create fargateprofile \
  --cluster my-cluster \
  --name my-fargate-profile \
  --namespace serverless-ns
```

### S3

```bash
# List buckets
aws s3 ls

# List objects
aws s3 ls s3://my-bucket/ --recursive --human-readable

# Copy
aws s3 cp local-file.txt s3://my-bucket/path/

# Sync
aws s3 sync ./local-dir s3://my-bucket/prefix/ --delete

# Get bucket policy
aws s3api get-bucket-policy --bucket my-bucket

# Get bucket lifecycle
aws s3api get-bucket-lifecycle-configuration --bucket my-bucket

# Generate presigned URL (1 hour)
aws s3 presign s3://my-bucket/my-object.pdf --expires-in 3600

# Check public access block
aws s3api get-public-access-block --bucket my-bucket

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled
```

### RDS

```bash
# List RDS instances
aws rds describe-db-instances \
  --query 'DBInstances[*].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,MultiAZ:MultiAZ}'

# Trigger failover (testing)
aws rds reboot-db-instance \
  --db-instance-identifier my-postgres \
  --force-failover

# Generate auth token for IAM auth
aws rds generate-db-auth-token \
  --hostname my-db.cluster-xxx.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --region us-east-1 \
  --username my-user

# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-postgres \
  --db-snapshot-identifier my-snapshot-$(date +%Y%m%d)
```

### CloudWatch

```bash
# List metric alarms
aws cloudwatch describe-alarms \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}'

# Put metric data (custom metric)
aws cloudwatch put-metric-data \
  --namespace MyApp \
  --metric-name DeploymentSuccess \
  --value 1 \
  --dimensions Environment=production

# Get metric statistics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/my-alb/abc \
  --start-time $(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ") \
  --end-time $(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --period 300 \
  --statistics Average,p95,p99

# Run a Logs Insights query
aws logs start-query \
  --log-group-name /aws/eks/my-cluster/cluster \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /error/ | limit 20'

# Get query results
aws logs get-query-results --query-id <query-id>
```

### Route 53

```bash
# List hosted zones
aws route53 list-hosted-zones

# List records in a zone
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234ABC \
  --query 'ResourceRecordSets[*].{Name:Name,Type:Type,TTL:TTL}'

# Test DNS resolution
aws route53 test-dns-answer \
  --hosted-zone-id Z1234ABC \
  --record-name api.example.com \
  --record-type A
```

---

## gcloud Reference

```bash
# Auth
gcloud auth login
gcloud auth application-default login

# Project management
gcloud config set project my-project-id
gcloud projects list

# Compute
gcloud compute instances list
gcloud compute ssh my-instance --zone us-central1-a

# Container (GKE)
gcloud container clusters list
gcloud container clusters get-credentials my-cluster --zone us-central1-a
gcloud container clusters update my-cluster --enable-workload-identity

# IAM
gcloud iam service-accounts list
gcloud iam service-accounts create my-sa --display-name "My SA"
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:my-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Storage
gsutil ls gs://my-bucket/
gsutil cp file.txt gs://my-bucket/
gsutil iam ch serviceAccount:my-sa@my-project.iam.gserviceaccount.com:roles/storage.objectAdmin gs://my-bucket

# Secret Manager
gcloud secrets create my-secret --data-file=secret.txt
gcloud secrets versions access latest --secret my-secret
```

---

## az Reference

```bash
# Auth
az login
az account set --subscription "my-subscription"
az account list --output table

# Resource groups
az group list --output table
az group create --name my-rg --location eastus

# AKS
az aks list --output table
az aks get-credentials --resource-group my-rg --name my-cluster
az aks nodepool list --resource-group my-rg --cluster-name my-cluster
az aks upgrade --resource-group my-rg --name my-cluster --kubernetes-version 1.29

# ACR
az acr list --output table
az acr login --name myregistry
az acr build --registry myregistry --image myapp:v1 .
az acr repository list --name myregistry

# Network
az network vnet list --output table
az network nsg list --resource-group my-rg
az network nic show-effective-nsg --resource-group my-rg --name my-nic

# VM
az vm list --resource-group my-rg --output table
az vm start --resource-group my-rg --name my-vm
```

---

## jq Patterns For AWS CLI Output

```bash
# Extract instance IDs from describe-instances
aws ec2 describe-instances | jq '.Reservations[].Instances[].InstanceId'

# Get all running instance IPs
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" | \
  jq '.Reservations[].Instances[] | {id: .InstanceId, ip: .PrivateIpAddress, az: .Placement.AvailabilityZone}'

# Get all security group rules for a group
aws ec2 describe-security-groups --group-ids sg-0abc123 | \
  jq '.SecurityGroups[0].IpPermissions[] | {port: .FromPort, sources: .IpRanges[].CidrIp}'

# Find EC2 instances without a Name tag
aws ec2 describe-instances | \
  jq '.Reservations[].Instances[] | select(.Tags | map(.Key) | contains(["Name"]) | not) | .InstanceId'

# Get all EKS OIDC providers
aws eks describe-cluster --name my-cluster | \
  jq '.cluster.identity.oidc.issuer'

# Parse cost explorer output
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-05-01 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE | \
  jq '.ResultsByTime[0].Groups | sort_by(.Metrics.UnblendedCost.Amount | tonumber) | reverse | .[:10] | .[] | {service: .Keys[0], cost: .Metrics.UnblendedCost.Amount}'
```

---

## Terraform AWS Provider Snippets

```hcl
# Provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "my-tfstate-bucket"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::123456789:role/terraform-deployer"
  }
  default_tags {
    tags = {
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# VPC module
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "prod-vpc"
  cidr = "10.0.0.0/16"
  azs  = ["us-east-1a", "us-east-1b", "us-east-1c"]

  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets  = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  database_subnets = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false  # one per AZ for HA
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    "kubernetes.io/cluster/my-cluster" = "shared"
  }
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}
```

---

## CloudWatch Log Insights Query Examples

```
# Error rate spike analysis
fields @timestamp, @message
| filter @message like /ERROR|Exception|WARN/
| stats count(*) as errors by bin(5m)
| sort @timestamp desc

# API latency percentiles
fields @timestamp, @duration
| stats
    avg(@duration) as avg_ms,
    percentile(@duration, 95) as p95_ms,
    percentile(@duration, 99) as p99_ms
  by bin(5m)

# Lambda cold starts
fields @timestamp, @type, @initDuration
| filter @type = "REPORT"
| filter @initDuration > 0
| stats count(*) as cold_starts, avg(@initDuration) as avg_init_ms by bin(1h)

# VPC Flow Log REJECT analysis
fields srcAddr, dstAddr, srcPort, dstPort, action
| filter action = "REJECT"
| stats count(*) as blocked by srcAddr, dstPort
| sort blocked desc
| limit 20

# EKS API server errors
fields @timestamp, verb, resource, responseStatus.code
| filter responseStatus.code >= 400
| stats count(*) as errors by verb, resource, responseStatus.code
| sort errors desc
```

---

## Incident Trace Path

```text
DNS -> CDN -> WAF -> load balancer -> target -> app -> dependency -> database
```

At each layer ask:

```text
is it reachable?
is it healthy?
is it allowed?
is it saturated?
what changed?
```

### Layer-By-Layer CLI Commands

```bash
# DNS layer
dig api.example.com
dig api.example.com +trace
nslookup api.example.com 8.8.8.8

# Network layer
nc -vz <host> 443
curl -v https://api.example.com
traceroute api.example.com

# ALB layer
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/my-tg/abc

# EKS pod layer
kubectl get pods -n production
kubectl describe pod <pod-name> -n production
kubectl logs <pod-name> -n production --since=10m
kubectl exec -it <pod-name> -n production -- curl -v http://internal-service:8080/health

# Database layer
aws rds describe-db-instances \
  --db-instance-identifier my-postgres \
  --query 'DBInstances[0].{Status:DBInstanceStatus,CPU:Endpoint.Port}'
```
