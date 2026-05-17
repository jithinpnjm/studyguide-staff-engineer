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

## Lab 8: EKS Cluster Skeleton With Terraform

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
