---
title: "Hands-On Labs"
sidebar_position: 5
---

# Cloud Platforms — Hands-On Labs

These labs are designed to connect cloud theory with production operations. They focus on IAM, VPC, EC2, S3, RDS, serverless, cost controls, and Kubernetes-on-cloud patterns.

---

## Lab 1: Design A Production VPC

**Goal:** Create a mental and Terraform-ready VPC layout for a two-AZ production application.

### Target Layout

```text
VPC: 10.0.0.0/16

AZ-a:
  public:   10.0.101.0/24
  private:  10.0.1.0/24
  database: 10.0.11.0/24

AZ-b:
  public:   10.0.102.0/24
  private:  10.0.2.0/24
  database: 10.0.12.0/24
```

### Terraform Skeleton

```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "prod-vpc"
  cidr = "10.0.0.0/16"

  azs              = ["eu-central-1a", "eu-central-1b"]
  public_subnets   = ["10.0.101.0/24", "10.0.102.0/24"]
  private_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  database_subnets = ["10.0.11.0/24", "10.0.12.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
}
```

### Verify Design

```bash
terraform init
terraform plan
```

**SRE review questions:**

- What breaks if one AZ fails?
- Where do private workloads get outbound access?
- Are databases reachable from the internet?
- Is the NAT design cost-optimized or HA-optimized?

---

## Lab 2: Launch An EC2 Web Server Safely

**Goal:** Launch a simple web server while keeping the blast radius clear.

### Security Group Shape

```hcl
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Allow HTTP and SSH from approved sources"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### User Data

```bash
#!/bin/bash
apt-get update -y
apt-get install -y nginx
systemctl enable --now nginx
echo "hello from cloud lab" > /var/www/html/index.html
```

### Validate

```bash
curl -I http://<public-ip>
```

**Production note:** for real systems, prefer private instances behind an ALB and use Session Manager or a bastion pattern for administration.

---

## Lab 3: Host A Static Website On S3 And CloudFront

**Goal:** Understand S3 static hosting, CDN, and DNS routing.

### Steps

1. Create an S3 bucket for static assets.
2. Upload `index.html`.
3. Enable bucket policy only if public website hosting is intentionally required.
4. Create a CloudFront distribution with the bucket as origin.
5. Add Route 53 alias record to CloudFront.
6. Add TLS certificate through ACM for the domain.

### Example File

```html
<!doctype html>
<html>
  <body>
    <h1>Hello from S3 and CloudFront</h1>
  </body>
</html>
```

### Operational Checks

```bash
curl -I https://example.com
```

Check:

- CloudFront cache behavior
- TLS certificate domain
- Origin access settings
- Bucket public access settings
- Route 53 alias target

---

## Lab 4: Create RDS With Private Access Only

**Goal:** Design a database that is not publicly reachable.

### Key Terraform Shape

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "prod-db-subnets"
  subnet_ids = var.database_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier             = "prod-postgres"
  engine                 = "postgres"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false
  multi_az               = true
  backup_retention_period = 7
  skip_final_snapshot    = false
}
```

### Validate

From an app host in the private subnet:

```bash
nc -vz <rds-endpoint> 5432
```

From your laptop, it should not be directly reachable unless you use a controlled access path.

**SRE review questions:**

- Are backups enabled?
- Is Multi-AZ enabled for production?
- Which security group can reach port 5432?
- Has restore been tested?

---

## Lab 5: Lambda Processing An S3 Event

**Goal:** Build a simple event-driven flow.

```text
S3 upload -> Lambda invocation -> log result
```

### Handler Example

```python
def handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]
        print(f"processed s3://{bucket}/{key}")
    return {"status": "ok"}
```

### Operational Checks

- Lambda timeout
- Memory allocation
- CloudWatch logs
- Event trigger configuration
- Retry behavior
- Dead-letter queue or failure destination

**Production note:** if processing can take longer than Lambda limits, use SQS, Step Functions, or a container worker.

---

## Lab 6: DynamoDB Access Pattern Design

**Goal:** Model a table from queries, not from entities alone.

### Example Use Case

Orders must be queried by customer and by status.

| Access pattern | Key design |
|---|---|
| Get order by ID | `PK=ORDER#id` |
| List orders by customer | `PK=CUSTOMER#id`, `SK=ORDER#timestamp` |
| List orders by status | GSI with `STATUS#status` |

### Example Item

```json
{
  "PK": "CUSTOMER#123",
  "SK": "ORDER#2026-05-17T10:00:00Z",
  "orderId": "ord-001",
  "status": "PAID",
  "total": 99.90
}
```

### Review Questions

- Are you using Query or Scan?
- Is the partition key high-cardinality?
- Can one customer or status become a hot partition?
- Is on-demand or provisioned mode better for this traffic?

---

## Lab 7: Cost Review Drill

**Goal:** Practice identifying waste in a cloud account.

Checklist:

```text
unused load balancers
idle databases
stopped EC2 with attached EBS volumes
unattached EBS volumes
old snapshots
NAT Gateway data processing spikes
cross-AZ traffic spikes
CloudWatch log groups with long retention
S3 buckets without lifecycle policies
underutilized reserved capacity
```

Create a remediation table:

| Finding | Risk | Saving action | Owner | Due date |
|---|---|---|---|---|
| Idle RDS instance | Low traffic, high cost | Stop/delete after owner approval | Team A | Friday |
| Logs retained 365 days | Cost growth | Reduce to 30 days if allowed | Platform | Monday |

---

## Lab 8: EKS Cluster With IRSA, ALB Ingress, And EBS CSI

**Goal:** Deploy a production-grade EKS cluster with workload identity, ALB-based ingress, and EBS persistent storage.

### Step 1: Create Cluster

```bash
eksctl create cluster \
  --name my-cluster \
  --region us-east-1 \
  --version 1.30 \
  --nodegroup-name default \
  --node-type m6i.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed \
  --asg-access \
  --with-oidc \
  --vpc-private-subnets subnet-0abc,subnet-0def \
  --vpc-public-subnets subnet-0ghi,subnet-0jkl

# Update kubeconfig
aws eks update-kubeconfig --name my-cluster --region us-east-1

# Verify cluster
kubectl get nodes
kubectl cluster-info
```

### Step 2: Install AWS Load Balancer Controller (ALB Ingress)

```bash
# Create IRSA for the ALB controller
eksctl create iamserviceaccount \
  --cluster my-cluster \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
  --approve

# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=my-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# Verify
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### Step 3: Deploy A Sample App With Ingress

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      serviceAccountName: my-app-sa
      containers:
      - name: app
        image: nginx:1.25
        ports:
        - containerPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
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
            name: my-app
            port:
              number: 80
```

```bash
kubectl apply -f deployment.yaml

# Watch ALB provisioning (takes 1-2 minutes)
kubectl get ingress -n production -w

# Get the ALB DNS name
kubectl get ingress -n production my-app-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Step 4: Install EBS CSI Driver

```bash
# Create IRSA for EBS CSI
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster my-cluster \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve

# Install as EKS add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name aws-ebs-csi-driver

# Create a StorageClass
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
EOF
```

### Step 5: Set Up IRSA for App Pod

```bash
# Associate OIDC provider (if not done at cluster creation)
eksctl utils associate-iam-oidc-provider --cluster my-cluster --approve

# Create IAM role and ServiceAccount for the app
eksctl create iamserviceaccount \
  --name my-app-sa \
  --namespace production \
  --cluster my-cluster \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --approve

# Verify annotation
kubectl describe serviceaccount my-app-sa -n production | grep role-arn

# Test from a pod
kubectl run test-pod --image=amazon/aws-cli --rm -it \
  --serviceaccount=my-app-sa -n production -- \
  aws sts get-caller-identity
```

---

## Lab EKS-B: CloudWatch Container Insights And Log Insights

**Goal:** Set up centralized observability for an EKS cluster.

### Enable Container Insights

```bash
# Deploy CloudWatch agent and Fluent Bit
ClusterName=my-cluster
RegionName=us-east-1
FluentBitHttpPort='2020'
FluentBitReadFromHead='Off'
[[ ${FluentBitReadFromHead} = 'On' ]] && FluentBitReadFromTail='Off'|| FluentBitReadFromTail='On'

curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml \
  | sed 's/{{cluster_name}}/'${ClusterName}'/;s/{{region_name}}/'${RegionName}'/;s/{{http_server_toggle}}/'${FluentBitHttpPort}'/;s/{{read_from_head}}/'${FluentBitReadFromHead}'/;s/{{read_from_tail}}/'${FluentBitReadFromTail}'/' \
  | kubectl apply -f -
```

### Useful CloudWatch Logs Insights Queries

```
# OOMKilled containers in last 24h
fields @timestamp, kubernetes.container_name, log
| filter log like /OOMKilled|killed/
| stats count() by kubernetes.container_name
| sort count desc

# Pod restarts by container (requires Container Insights metrics)
fields kubernetes.container_name, kubernetes.namespace_name
| filter MetricName = "pod_number_of_container_restarts"
| stats max(Value) as restarts by kubernetes.container_name, kubernetes.namespace_name
| sort restarts desc

# 5xx errors from ALB access log
fields @timestamp, request_url, target_status_code
| filter target_status_code >= 500
| stats count() as errors by request_url
| sort errors desc
| limit 20

# Lambda duration p99
fields @timestamp, @duration, function_name
| stats percentile(@duration, 99) as p99_ms by function_name
| sort p99_ms desc
```

### Create Alarm On Container Restart Count

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name eks-container-restarts-high \
  --namespace ContainerInsights \
  --metric-name pod_number_of_container_restarts \
  --dimensions Name=ClusterName,Value=my-cluster \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123:alerts
```

---

## Lab COST-1: AWS Cost Explorer, Budgets, And Anomaly Alerts

**Goal:** Set up a cost governance baseline for a production account.

### Step 1: Enable Cost Allocation Tags

```bash
# Activate tags for cost allocation
aws ce create-cost-category-definition \
  --name TeamCostAllocation \
  --rule-version CostCategoryExpression.v1 \
  --rules '[
    {"Value":"platform","Rule":{"Tags":{"Key":"Team","Values":["platform"],"MatchOptions":["EQUALS"]}}},
    {"Value":"backend","Rule":{"Tags":{"Key":"Team","Values":["backend"],"MatchOptions":["EQUALS"]}}}
  ]'
```

### Step 2: Create Budgets With Alerts

```bash
# Monthly budget for production account
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "production-monthly",
    "BudgetLimit": {"Amount": "5000", "Unit": "USD"},
    "BudgetType": "COST",
    "TimeUnit": "MONTHLY"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "sre-team@company.com"}]
  }]'
```

### Step 3: Set Up Cost Anomaly Detection

```bash
# Create monitor for all services
MONITOR_ARN=$(aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "all-services-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }' \
  --query 'MonitorArn' --output text)

# Create subscription: alert when anomaly > $100
aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    "SubscriptionName": "anomaly-alert",
    "MonitorArnList": ["'"$MONITOR_ARN"'"],
    "Subscribers": [{"Address": "arn:aws:sns:us-east-1:123:cost-alerts", "Type": "SNS"}],
    "Threshold": 100,
    "Frequency": "DAILY"
  }'
```

### Step 4: Query Cost By Service And Tag

```bash
# Get cost breakdown by service for last 30 days
aws ce get-cost-and-usage \
  --time-period Start=2026-04-17,End=2026-05-17 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[*].Groups[*].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
  --output table

# Get cost by Team tag
aws ce get-cost-and-usage \
  --time-period Start=2026-04-17,End=2026-05-17 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=TAG,Key=Team \
  --query 'ResultsByTime[*].Groups[*].{Team:Keys[0],Cost:Metrics.UnblendedCost.Amount}'
```

---

## Lab GCP-1: GCP Public Platform (Cloud Design Lab 1)

**Goal:** Design a public production platform on GCP for a customer-facing API with global users.

**Scenario:** Global users, read-heavy traffic, public DNS, CDN, WAF, L7 load balancing, stateless API on GKE, private Cloud SQL, Pub/Sub for async work, centralized observability, zonal failure tolerance.

### Step 1: Think, Don't Just Draw

Before designing, answer in order:

1. What is public? Only the external load balancer IP. Everything else is private.
2. Request path: User -> Cloud DNS -> Cloud CDN -> Cloud Armor -> External HTTPS LB -> GKE -> Cloud SQL
3. Stateless vs stateful: GKE pods = stateless; Cloud SQL = stateful (HA is complex here)
4. Failure domains: zonal failure (one GKE zone down), regional failure, Pub/Sub backlog
5. Security from outside in: Cloud Armor at edge, Workload Identity in cluster, Secrets Manager for DB credentials
6. Delivery: Cloud Build -> Artifact Registry -> Binary Authorization -> Cloud Deploy

### Step 2: Network Layout

```bash
# Create VPC
gcloud compute networks create app-vpc --subnet-mode=custom

# Create subnets (separate ranges for nodes, pods, services)
gcloud compute networks subnets create gke-subnet \
  --network app-vpc \
  --region us-central1 \
  --range 10.0.0.0/20 \
  --secondary-range pods=10.4.0.0/14,services=10.0.16.0/20

# Create Cloud NAT for egress
gcloud compute routers create my-router --region us-central1 --network app-vpc
gcloud compute routers nats create my-nat \
  --router my-router --region us-central1 \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges
```

### Step 3: Private GKE Cluster

```bash
gcloud container clusters create my-cluster \
  --region us-central1 \
  --network app-vpc \
  --subnetwork gke-subnet \
  --cluster-secondary-range-name pods \
  --services-secondary-range-name services \
  --enable-private-nodes \
  --master-ipv4-cidr 172.16.0.0/28 \
  --enable-workload-identity \
  --workload-pool my-project.svc.id.goog \
  --enable-master-authorized-networks \
  --master-authorized-networks "10.0.0.0/8"
```

### Step 4: Cloud SQL With Private IP

```bash
# Create instance with private IP only
gcloud sql instances create my-postgres \
  --database-version POSTGRES_15 \
  --tier db-n1-standard-2 \
  --region us-central1 \
  --network app-vpc \
  --no-assign-ip \
  --availability-type REGIONAL   # multi-zonal HA
```

### Step 5: Cloud Armor WAF Policy

```bash
# Create security policy
gcloud compute security-policies create api-armor \
  --description "WAF for public API"

# Add OWASP managed rule set
gcloud compute security-policies rules create 1000 \
  --security-policy api-armor \
  --expression "evaluatePreconfiguredExpr('sqli-stable')" \
  --action deny-403

# Rate limiting rule (100 req/min per IP)
gcloud compute security-policies rules create 2000 \
  --security-policy api-armor \
  --expression "true" \
  --action rate-based-ban \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 300
```

### Zonal Failure Walkthrough

If zone `us-central1-b` goes down at 2am:

```text
What is automatic:
  GKE: pods in healthy zones continue serving
  Cloud SQL: if primary was in us-central1-b, automatic failover to standby zone (1-2 min)
  Load balancer: routes traffic to healthy GKE node pools in other zones

What you validate:
  kubectl get nodes (us-central1-b nodes show NotReady)
  Check Cloud SQL failover status
  Verify other zones have enough pod capacity

What requires manual action:
  If PodDisruptionBudgets are too strict: pods may not reschedule
  If the zone failure is partial (not full NotReady): may need to cordon nodes manually
```

---

## Lab NET-1: Network Boundary Drill (From Cloud Networking Drill 01)

**Scenario:** ML platform with public inference API, internal admin dashboard, PostgreSQL database, and GPU batch workers. Security found admin endpoint accidentally exposed to internet.

### Correct Zone Model

```text
Internet
   | HTTPS 443
   v
[Public Load Balancer / WAF]   <- External IP only here
   |
   | Private IP only
   v
[Inference API subnet 10.0.1.0/24]   <- Separate from admin
[Admin UI subnet 10.0.2.0/24]        <- Only VPN or IAP access
   |
   v
[Database subnet 10.0.3.0/24]        <- No internet route
[GPU Worker subnet 10.0.4.0/24]      <- Egress-only via NAT
```

Why the admin subnet is separate from the inference API subnet:
- Inference API must scale for customer traffic with wider inbound rules
- Admin UI must only be reachable from corporate VPN or specific IP ranges
- Same ALB for both creates risk: WAF bypass or ALB misconfig exposes admin routes

### Review The Problematic Terraform

```hcl
# WRONG: open admin to internet
resource "aws_security_group_rule" "admin_inbound" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]  # open to all internet
  security_group_id = aws_security_group.admin_ui.id
}

resource "aws_lb_listener" "admin" {
  load_balancer_arn = aws_lb.public_alb.arn  # same ALB as inference API
  port              = 8443
  protocol          = "HTTPS"
}
```

### Fixed Version

```hcl
# Internal ALB for admin only
resource "aws_lb" "admin_internal" {
  name               = "admin-internal-alb"
  internal           = true   # no public IP
  load_balancer_type = "application"
  subnets            = var.private_subnet_ids
  security_groups    = [aws_security_group.admin_alb.id]
}

# Admin ALB SG: only allow from corporate VPN CIDR
resource "aws_security_group" "admin_alb" {
  vpc_id = var.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.50.0.0/16"]  # corporate VPN CIDR only
  }
}
```

---

## Lab NET-3: AWS VPC SG, NACL, And Routing Drill (From Cloud Networking Drill 03)

**Scenario:** Multi-tier AWS app (ALB -> app servers -> RDS). After a "least-privilege tightening" deploy, app servers cannot reach the database.

### Diagnose The SG Incident

```bash
# Check what changed in the DB security group
aws ec2 describe-security-groups \
  --group-ids sg-0db1234 \
  --query 'SecurityGroups[*].IpPermissions'

# The output shows the change: SG-to-SG reference was replaced by a single-AZ CIDR
# Before: source-group sg-0app5678 (matches all instances with that SG)
# After:  cidr 10.0.2.0/24 (only AZ-a app subnet; AZ-b lost access)
```

The Terraform diff that caused the incident:

```diff
resource "aws_security_group_rule" "db_from_app" {
-  source_security_group_id = aws_security_group.app.id   # correct: all AZs
+  cidr_blocks = ["10.0.2.0/24"]                          # wrong: only AZ-a
}
```

Fix:

```bash
# Restore the SG-to-SG reference
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db1234 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-0app5678
```

### NACL Ephemeral Port Fix (For Lambda Backup Jobs)

Lambda uses ephemeral source ports. NACL on the database subnet must allow outbound ephemeral range:

```bash
# Add missing outbound rule for ephemeral ports
aws ec2 create-network-acl-entry \
  --network-acl-id acl-0db9876 \
  --egress \
  --rule-number 90 \
  --protocol tcp \
  --port-range From=1024,To=65535 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow
```

### Enable VPC Flow Logs For Forensics

```bash
aws ec2 create-flow-logs \
  --resource-type Subnet \
  --resource-ids subnet-0db1234 \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/database-subnet \
  --deliver-logs-permission-arn arn:aws:iam::123:role/FlowLogsRole

# Query REJECT records in CloudWatch Logs Insights
# fields srcAddr, dstAddr, srcPort, dstPort, action
# | filter action = "REJECT"
# | stats count(*) as rejects by srcAddr, dstPort
# | sort rejects desc
```

### Use CloudTrail To Find Who Made The Change

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AuthorizeSecurityGroupIngress \
  --start-time 2026-05-17T22:00:00Z \
  --end-time 2026-05-17T23:00:00Z \
  --query 'Events[*].{Time:EventTime,User:Username,Source:SourceIPAddress}'
```

---

## Lab EKS-C: EKS Cluster Skeleton With Terraform

**Goal:** Understand the basic Terraform structure for EKS.

```text
terraform/
  main.tf
  vpc.tf
  eks.tf
  iam.tf
  variables.tf
  outputs.tf
```

### Module Shape

```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.30"

  subnet_ids = var.private_subnet_ids
  vpc_id     = var.vpc_id

  eks_managed_node_groups = {
    default = {
      min_size     = 2
      max_size     = 5
      desired_size = 2
      instance_types = ["m6i.large"]
    }
  }
}
```

### Review Questions

- Are nodes private?
- Is control plane access restricted?
- Are logs enabled?
- Is IRSA or workload identity enabled?
- Are node groups spread across AZs?

---

## Lab 9: Cloud Incident Trace

**Goal:** Trace a failed request through cloud layers.

```text
DNS -> CDN -> WAF -> ALB -> app target -> database
```

For each layer, collect one signal:

| Layer | Signal |
|---|---|
| DNS | Correct record and TTL |
| CDN | Cache status and origin errors |
| WAF | Blocked requests |
| ALB | Target health and 5xx count |
| App | Logs and latency |
| DB | Connections, CPU, slow queries |

This lab builds the habit of layer-by-layer debugging.
