---
title: "☁️ Cloud Platforms"
sidebar_position: 4
description: "Zero to hero study guide for Cloud Platforms — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Cloud platforms (AWS, GCP, Azure) are the infrastructure substrate for nearly all modern systems. As a Staff/Principal SRE, you don't just use cloud services — you make architectural decisions that determine reliability, cost, security, and scalability for the entire organization. A wrong choice in cloud architecture compounds for years.

Business outcomes from the PDFs:
- **Cost** — AWS provides on-demand pricing; you pay only for what you use. Right-sizing via Cost Explorer and Compute Optimizer can reduce bills significantly.
- **Reliability** — Multi-AZ and multi-region design, managed services, and proper IAM are the difference between 99.9% and 99.99% uptime.
- **Security** — Misconfigured S3 buckets and IAM policies are the leading causes of cloud breaches. GuardDuty + CloudTrail is the minimum viable monitoring baseline.
- **Speed** — Managed services (RDS, EKS, Lambda) dramatically reduce time-to-market vs self-managed equivalents.

---

## The Shared Responsibility Model

AWS is responsible for security **OF** the cloud (hardware, facilities, hypervisor). You are responsible for security **IN** the cloud: OS patches, IAM, data encryption, network config.

- **IaaS (EC2)** — you manage OS, runtime, middleware, data
- **PaaS (Elastic Beanstalk, RDS)** — AWS manages runtime/platform; you manage data and app config
- **SaaS (DynamoDB, S3)** — AWS manages everything except your data and access policies

---

## AWS Core Services

### IAM — Identity and Access Management

IAM is your security perimeter. Everything in AWS is an API call, and IAM controls which calls are authorized.

**Core components:**
- **IAM User** — A person or service with long-term credentials. IAM user limit is 5,000 per AWS account.
- **IAM Group** — A collection of users. Assign permissions to the group, not individual users.
- **IAM Role** — An identity with permissions but no permanent credentials. Roles issue temporary credentials via STS. Best practice: human users and workloads should access AWS using temporary credentials from roles, not long-lived user keys.
- **IAM Policy** — A JSON document listing permissions (Actions, Resources, Effects). Policies attach to users, groups, or roles.
- **IAM Permission** — Two types: identity-based and resource-based.

**How IAM authorization works:**
1. A principal (user, role, federated identity) authenticates with AWS.
2. The principal makes a request (action, resource, environment data).
3. AWS evaluates all applicable policies: identity-based, resource-based, permission boundaries, SCPs.
4. Explicit deny always wins. Implicit deny is default. Explicit allow is required.

**Key Q&A from PDFs:**

Q: What is the difference between an AWS account root user and an IAM user?
> The root user created the account and has unrestricted access to all services and billing. An IAM user is a person or service granted specific custom permissions by an administrator. Never use the root user for day-to-day operations.

Q: Can a user have multiple IAM roles?
> Yes. Using multiple IAM roles with Terraform allows managing access to resources in a more secure and scalable manner. A user can assume roles sequentially, but only one role is active at a time.

Q: How many IAM users can I create?
> The IAM user limit is 5,000 per AWS account.

**Best practices:**
- Enable MFA for all users, especially root and admin accounts
- Never hardcode credentials in code — use IAM roles for EC2/Lambda/ECS
- Use least-privilege policies; use IAM Access Analyzer to find overly permissive policies
- Rotate access keys; prefer roles over long-lived access keys
- Use AWS Organizations + SCPs (Service Control Policies) for guardrails across accounts

---

### VPC — Virtual Private Cloud

A VPC is an isolated portion of the AWS cloud. You define IP address ranges, subnets, route tables, and gateways.

**VPC components (from PDF interview Q&A):**

Q: List the components required to build Amazon VPC?
> Subnet, Internet Gateway, NAT Gateway, HW VPN Connection, Virtual Private Gateway, Customer Gateway, Router, Peering Connection, VPC Endpoint for S3, Egress-only Internet Gateway.

**Subnet types:**
- **Public subnet** — has a route to an Internet Gateway; resources here can be accessed from the internet
- **Private subnet** — no direct internet route; instances use NAT Gateway to initiate outbound connections
- **Intra subnet** — fully isolated, used for internal services like EKS control plane ENIs

**Security layers:**
- **Security Groups** — stateful firewall at the instance level. Defines which traffic is allowed TO or FROM an EC2 instance. Automatically denies unauthorized access. Configure both INBOUND and OUTBOUND rules.
- **Network ACLs (NACLs)** — stateless firewall at the subnet level. Controls traffic TO or FROM a subnet. Evaluated in rule-number order; first match wins.

Q: Difference between Security Groups and ACLs in a VPC?
> A Security Group defines which traffic is allowed to/from an EC2 instance. A NACL controls at the subnet level. Security Groups are stateful (return traffic is automatically allowed); NACLs are stateless (you must explicitly allow both directions).

**Connectivity options (from PDF):**
- **Internet Gateway** — for public subnets to reach the internet
- **NAT Gateway** — allows private subnets to connect to the internet without exposing them to inbound connections
- **VPN Gateway + Customer Gateway** — site-to-site VPN connection to your on-premises network
- **AWS Direct Connect** — dedicated private connection from your data center to AWS (not over internet)
- **VPC Peering** — direct connectivity between two VPCs. Cannot span regions (from PDF: "Peering Connection are available only between VPC in the same region"). Cannot connect a VPC with a VPC owned by another AWS account without the other owner accepting the connection.
- **VPC Endpoints** — private connectivity to AWS services (S3, DynamoDB) without internet traffic

Q: How can you monitor network traffic in your VPC?
> Using Amazon VPC Flow Logs feature. Flow logs capture information about IP traffic going to and from network interfaces in your VPC.

**VPC CIDR planning:**
```
Production VPC:   10.0.0.0/16
  Public subnets:   10.0.101.0/24, 10.0.102.0/24  (one per AZ)
  Private subnets:  10.0.1.0/24,   10.0.2.0/24    (one per AZ)
  Intra subnets:    10.0.5.0/24,   10.0.6.0/24    (for EKS, etc.)
```

**Multi-VPC patterns:**
- **Multi-VPC** — separate VPCs per environment or team; use Transit Gateway for hub-and-spoke routing
- **Multi-Account** — separate AWS accounts per environment; stronger isolation boundary, use AWS Organizations
- Single VPC is appropriate only for: high-performance computing, identity management, or small single applications

---

### EC2 — Elastic Compute Cloud

EC2 is AWS's virtual machine service. Choosing the right instance type and pricing model is a core cost optimization lever.

**Instance families:**
- **General purpose (m-series)** — balanced compute, memory, networking. Good for web servers, app servers.
- **Compute optimized (c-series)** — high CPU:memory ratio. Good for batch processing, gaming, HPC.
- **Memory optimized (r-series)** — high memory. Good for in-memory databases, analytics.
- **Storage optimized (i-series)** — high IOPS local storage. Good for NoSQL databases, data warehousing.
- **Accelerated computing (p/g-series)** — GPU instances. Good for ML training, graphics, HPC.

**Pricing models (from PDF Q&A):**
- **On-demand** — pay per second/hour, no commitment. Most expensive, maximum flexibility.
- **Reserved Instances** — 1 or 3 year commitment. 30-60% discount. Best for predictable, steady-state workloads.
- **Spot Instances** — bid on spare EC2 capacity. 70-90% discount. Can be interrupted with 2-minute notice. Best for stateless, fault-tolerant workloads.
- **Savings Plans** — flexible commitment (compute or EC2). Similar discount to Reserved but applies across instance families.
- **Dedicated** — physical hardware dedicated to your use. Required for compliance or licensing reasons.

Q: What is the difference between stopping and terminating an EC2 instance?
> When you STOP an instance, it performs a normal shutdown. The EBS volume remains attached and you can restart later. When you TERMINATE an instance, it gets deleted and cannot be restarted. EBS volumes attached with "delete on termination" flag set will also be deleted.

Q: What is an AMI?
> AMI stands for Amazon Machine Image. It's a template comprising software configuration: Operating System, application server, application, etc. AMIs are region-specific — when launching an EC2 instance, select an AMI within the same region.

**Auto Scaling:**

Auto Scaling allows you to automatically scale instances based on demand (CPU, memory, custom metrics).

Q: What is Auto Scaling?
> Creating duplicate instances during heavy business hours. Scale-IN: Reducing the number of instances. Scale-OUT: Increasing instances by duplicating. Two components: Auto Scaling Groups and Launch Configuration (or Launch Template).

Q: What is the difference between scalability and elasticity?
> Scalability is the ability to increase resources to meet demand (vertical or horizontal). Elasticity is the ability to automatically provision and de-provision resources based on demand. An EC2 Auto Scaling Group with target tracking policy is elasticity; migrating to microservices for independent scaling is scalability.

**Launch and secure an EC2 instance (step-by-step from PDF):**
1. Go to EC2 Dashboard, click Launch Instance
2. Choose AMI (e.g., Ubuntu 24.04)
3. Choose instance type (e.g., t2.large)
4. Configure VPC and subnet (use private subnet for backend services)
5. Add storage (modify root volume size as needed, e.g., 30 GB)
6. Configure Security Group: open only required ports (22 for SSH, 80 for HTTP, 443 for HTTPS)
7. Create or select a key pair; download the .pem file and store securely
8. Click Launch Instances

**Securing EC2 (from PDF Solutions Architect Q&A):**
- Use Security Groups to restrict inbound/outbound traffic
- Use NACLs for subnet-level control
- Keep EC2 instances in private subnets; use bastion host or AWS Session Manager for access
- Enable IAM roles for permissions — never use hardcoded credentials
- Patch OS regularly using SSM Patch Manager
- Enable CloudTrail, VPC Flow Logs, and GuardDuty

---

### S3 — Simple Storage Service

S3 is object storage with 11 nines (99.999999999%) durability. It is a key-value store with an HTTP API — fundamentally different from a filesystem.

**Key characteristics (from PDFs):**
- Unlimited storage; file sizes from 0 bytes to 5 TB
- Object-based storage; stored in Buckets
- Bucket names must be globally unique
- Read-after-write consistency for new objects (PUT of a new key)
- Eventual consistency for overwrites and deletes (though AWS now offers strong consistency)

**Storage classes:**
- **S3 Standard** — frequently accessed data; highest availability (99.99%)
- **S3 Standard-IA (Infrequent Access)** — less frequently accessed data; 30-day minimum storage charge; lower storage cost, higher retrieval cost
- **S3 One Zone-IA** — single AZ only; cheaper than Standard-IA; risk: AZ failure causes data loss
- **S3 Glacier Instant Retrieval** — archive; millisecond retrieval; 90-day minimum
- **S3 Glacier Flexible Retrieval** — archive; retrieval in minutes to hours; 90-day minimum
- **S3 Glacier Deep Archive** — lowest cost; retrieval in hours; 180-day minimum; for long-term compliance data
- **S3 Intelligent-Tiering** — auto-moves objects between access tiers based on access patterns; no retrieval fees; monitoring fee per object

Q: What are the pricing components for S3?
> Pay for: storage used (e.g., $0.023/GB for Standard), requests made (PUT, GET), and data transferred out. S3 Standard includes 1 TB/month free data transfer via CloudFront.

**S3 advantages (from PDF):**
1. Budget-friendly — pay-as-you-go model
2. High scalability — auto-scales with demand; no capacity planning
3. Durability — 99.999999999% (11 nines); if you store 100 billion objects, you'll lose at most 1
4. High availability — data replicated across multiple AZs within a region
5. Security — automatic encryption on upload; IAM, bucket policies, and ACLs for access control

**S3 Cross-Region Replication (CRR) — troubleshooting checklist:**
- Versioning must be enabled on both source and destination buckets
- IAM role must have replication permissions
- Objects uploaded before enabling CRR are not replicated
- Check CloudWatch metrics for replication lag

---

### RDS — Relational Database Service

RDS is a managed relational database service supporting MySQL, PostgreSQL, MariaDB, Oracle, and SQL Server.

**Key features:**
- Automated backups, patching, and minor version upgrades
- Multi-AZ: synchronous standby, auto-failover in under 60 seconds
- Read replicas: asynchronous replication for read scaling
- Point-in-time recovery using automated backups

**RDS Proxy (from PDF — detailed coverage):**
- A fully managed proxy layer between application and database
- Works by pooling and sharing DB connections (connection multiplexing)
- Reduces the load on the database by reusing connections rather than opening new ones
- Reduces failover times for Aurora and RDS by **66%**
- Supports IAM authentication — removes the need for database credentials in application code
- DB credentials managed via AWS Secrets Manager
- Compatible with: Aurora MySQL, RDS MySQL, Aurora PostgreSQL, RDS PostgreSQL

**When to use RDS Proxy:**
- Applications with unpredictable workloads that frequently open/close DB connections
- AWS Lambda-based serverless applications making thousands of connections in short bursts
- Higher availability during transient database failures
- EC2-based applications with connection pool exhaustion issues

**Connection multiplexing explained:**
> Each database transaction uses one underlying database connection, which can be reused once the transaction finishes. RDS Proxy shares these connections between client connections, minimizing resource overhead on the database server.

**RDS limitations to know:**
- RDS Proxy must be within the same VPC as the RDS instance
- Does not support all database features (some transaction pinning scenarios)

**RDS troubleshooting from PDF:**
- RDS instance not connecting: check security group, verify DB port (3306 for MySQL, 5432 for PostgreSQL), check VPC subnet routing
- RDS high CPU: check slow query log, add read replicas for read-heavy workloads
- Connection timeout from Lambda: use RDS Proxy to pool connections
- Storage full: increase allocated storage or enable storage autoscaling
- Read replica lagging: check for long-running transactions on primary; replica lag metric in CloudWatch

---

### Aurora

AWS-reimplemented MySQL/PostgreSQL. Storage auto-scales in 10 GB increments.

- ~5x faster than MySQL, ~3x faster than PostgreSQL for many workloads
- Storage is replicated 6 ways across 3 AZs automatically
- **Aurora Serverless v2** — scales in fine-grained ACU (Aurora Capacity Unit) increments; good for variable workloads
- **Aurora Global Database** — sub-second replication across regions; promotes a secondary region to primary in under 1 minute during a regional failure

---

### CloudFront — Content Delivery Network

CloudFront distributes content with low latency from 400+ edge locations globally.

- Delivers content by creating a CloudFront distribution linked to S3 buckets or other origins
- **Geo-Targeting** — show personalized content to audience based on geographic location without changing the URL (geo-restriction and geo-routing)
- Pricing: based on data transfer and HTTP/HTTPS requests; includes 1 TB/month free data transfer
- Integrate with WAF for application-layer protection at the edge

---

### Route 53 — DNS and Traffic Management

Highly scalable and reliable DNS web service.

**Routing policies:**
- **Simple routing** — maps one domain to a single resource
- **Weighted routing** — distributes traffic among multiple resources by percentage
- **Latency-based routing** — routes to the region with lowest network latency for the user
- **Failover routing** — primary/secondary configuration with health checks
- **Geolocation routing** — routes based on user's geographic location
- **Multi-value answer routing** — returns multiple healthy records; basic load balancing

**Use in 3-tier architecture (from PDF project):**
- Route 53 at the top receives user requests
- Routes to ALB (Application Load Balancer)
- ALB distributes to EC2 instances in Auto Scaling Group across multiple AZs
- EC2 instances connect to RDS in private subnets

---

### ELB — Elastic Load Balancing

**Three types:**
- **ALB (Application Load Balancer)** — Layer 7; routes based on URL path, hostname, headers; supports WebSockets; best for HTTP/HTTPS microservices
- **NLB (Network Load Balancer)** — Layer 4; TCP/UDP; ultra-low latency; handles millions of requests per second; preserves source IP
- **CLB (Classic Load Balancer)** — legacy; not recommended for new deployments

**ELB troubleshooting from PDF:**
- ELB not routing traffic: check target group health checks, verify security group allows health check traffic from ELB
- Target group showing unhealthy: application may not be returning 200 on health check path; check application logs
- SSL certificate not working: verify certificate is issued for the correct domain in ACM; check listener configuration

---

### Lambda — Serverless Functions

Lambda runs code without managing infrastructure. Event-driven, auto-scales from zero to thousands of concurrent executions.

**Limits:**
- Max execution duration: 15 minutes
- Max memory: 10 GB
- Max deployment package: 250 MB (unzipped)
- Cold start: 50ms to 5s depending on runtime and package size

**Troubleshooting from PDF:**
- **Lambda timeout**: increase timeout up to 15 minutes; or break the function into smaller async steps using SQS/Step Functions
- **Memory exceeded**: increase memory allocation; Lambda also allocates CPU proportional to memory
- **API Gateway 500**: check Lambda execution logs in CloudWatch; check IAM permissions on Lambda resource policy; verify Lambda function handles errors and returns proper response format

**Common patterns:**
- API Gateway + Lambda + DynamoDB — serverless REST API
- S3 trigger + Lambda — process uploaded files (image resizing, ETL)
- EventBridge + Lambda — scheduled tasks and event-driven automation
- SQS + Lambda — asynchronous processing with automatic retry

---

### DynamoDB — NoSQL Database

Managed key-value and document database. Single-digit millisecond performance at any scale.

**Capacity modes:**
- **Provisioned** — specify read/write capacity units (RCUs/WCUs); use auto-scaling; cheaper for predictable workloads
- **On-demand** — pay per request; no capacity planning; more expensive per request but good for unpredictable traffic

**Troubleshooting from PDF:**
- **ProvisionedThroughputExceededException** — increase provisioned capacity or switch to on-demand mode; implement exponential backoff in application code
- **Query performance slower than expected** — check if query is using a GSI (Global Secondary Index); avoid scan operations on large tables; use query with partition key
- **DynamoDB Streams not triggering Lambda** — verify stream is enabled on the table; check Lambda trigger configuration; check Lambda execution role permissions; verify batch size setting

---

### AWS CodeBuild — CI/CD Build Service

Fully managed CI service that compiles source code, runs unit tests, and produces deployable artifacts.

**Pricing (from PDF):**
- Small instance (3 GB RAM, 2 vCPUs): $0.005/min
- Medium instance (7 GB RAM, 4 vCPUs): $0.01/min
- Large instance (15 GB RAM, 8 vCPUs): $0.02/min
- Example: 10-minute build on medium instance = 10 × $0.01 = $0.10

**buildspec.yml structure:**
```yaml
version: 0.2
phases:
  install:
    commands:
      - echo Installing dependencies
      - npm install
  build:
    commands:
      - echo Building the application
      - npm run build
  post_build:
    commands:
      - echo Build complete
artifacts:
  files:
    - '**/*'
  base-directory: build
```

**CodePipeline integration:**
1. Source Stage — CodeCommit, GitHub, or S3 triggers the pipeline
2. Build Stage — CodeBuild compiles and tests the code
3. Deploy Stage — CodeDeploy or Lambda deploys the application

**Best practices for CodeBuild:**
- Use IAM roles with least privilege permissions
- Cache dependencies (node_modules, Maven, pip cache) to speed up builds
- Use parallel builds to reduce deployment time
- Store build artifacts in S3 with encryption
- Use VPC configuration for builds that need access to private resources

---

## Highly Available Architecture Patterns

### 3-Tier Architecture (from PDF Project)

A production-grade 3-tier architecture in AWS:

**Presentation Layer (Front-End):**
- Route 53 for DNS routing
- CloudFront for CDN and SSL termination
- ALB in front of web servers

**Application Layer (Back-End):**
- EC2 instances in private subnets across multiple AZs
- Auto Scaling Group for elasticity
- ALB distributes traffic across AZs

**Data Layer:**
- RDS MySQL in private subnets (Multi-AZ enabled)
- Separate subnets for databases, isolated from application layer

**Security architecture:**
- Web servers in public subnets (only ports 80, 443)
- App servers in private subnets (only accessible from ALB)
- Databases in private subnets (only accessible from app servers)
- No direct internet access to databases

### Designing for High Availability (from PDF Solutions Architect Q&A)

Q: How do you design a highly available and fault-tolerant architecture in AWS?
> - Use Multi-AZ and Multi-Region deployments
> - Auto Scaling Groups for EC2 instances
> - Use Elastic Load Balancers (ALB/NLB) across multiple Availability Zones
> - Store data in S3 or RDS with Multi-AZ or Aurora Global Database
> - Use Route 53 for DNS-based routing and health checks
> 
> Example: For a global web application, use ALB in front of EC2 Auto Scaling groups in two AZs. DB layer: Aurora Global DB for cross-region replication, S3 for static content. Route 53 latency-based routing across regions for resilience.

### Secure and Scalable API Design (from PDF)

Q: How would you design a secure and scalable API using AWS services?
> - Use Amazon API Gateway to expose REST/HTTP APIs
> - Lambda for backend logic (serverless)
> - Use Cognito for user authentication or IAM roles for service access
> - Apply rate limiting and throttling at API Gateway
> - Enable WAF and CloudFront for additional security and caching
> 
> Example: Mobile backend using API Gateway + Lambda + DynamoDB. Cognito for user pools. All data encrypted at rest and in transit. CloudWatch for monitoring.

---

## Cost Optimization

Q: How do you reduce AWS costs in an enterprise architecture?
> - Right-size instances using Cost Explorer and Compute Optimizer
> - Use Savings Plans or Reserved Instances for predictable workloads
> - Use S3 Intelligent-Tiering or lifecycle policies for storage
> - Leverage Lambda or Fargate for short-lived compute
> - Monitor using AWS Cost and Usage Reports
> - Stop unused EC2 instances (automate with Lambda + EventBridge)
> - Use Spot Instances for batch processing and fault-tolerant workloads

**Tools for cost visibility:**
- **Top Services Table** — dashboard showing top 5 most used services and their costs
- **Cost Explorer** — analyze and visualize your costs and usage over time
- **AWS Compute Optimizer** — recommends optimal EC2 instance types based on utilization data
- **Trusted Advisor** — automated checks for cost optimization, security, fault tolerance, performance

---

## Terraform on AWS — EKS Cluster Setup

The PDFs include a full working Terraform project to deploy an EKS cluster. This is the pattern used in production.

**Folder structure:**
```
├── main.tf          # Provider config, Terraform version constraints
├── vpc.tf           # VPC, subnets, NAT gateway
├── eks.tf           # EKS cluster and managed node groups
├── variables.tf     # Input variables
├── iam.tf           # IAM roles and policies for worker nodes
├── outputs.tf       # Cluster endpoint, kubeconfig, etc.
└── security_group.tf  # Custom SGs for node access
```

**main.tf — provider and version constraints:**
```hcl
terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92.0"
    }
  }
}
```

**variables.tf — key variables:**
```hcl
variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "name" {
  description = "EKS cluster name"
  type        = string
  default     = "tes-dev-eks-cluster"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["eu-north-1a", "eu-north-1b"]
}

variable "private_subnets" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "intra_subnets" {
  type    = list(string)
  default = ["10.0.5.0/24", "10.0.6.0/24"]
}

variable "eks_cluster_version" {
  default = "1.31"
}
```

**vpc.tf — VPC module:**
```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${var.name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.azs
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  intra_subnets   = var.intra_subnets

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = {
    Terraform   = "true"
    Environment = var.env
  }
}
```

**eks.tf — EKS cluster module:**
```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = local.name
  cluster_version = "1.31"

  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_addons = {
    vpc-cni = {
      most_recent   = true
      addon_version = "v1.14.1-eksbuild.1"
    }
    kube-proxy = {
      most_recent = true
    }
    coredns = {
      most_recent   = true
      addon_version = "v1.10.1-eksbuild.1"
    }
  }
}
```

---

## AWS DevOps Troubleshooting

The PDFs provide a structured troubleshooting guide. Key patterns:

### EC2 Troubleshooting

**EC2 instance not starting:**
- Check if the AMI is available in the region
- Verify instance type is available in the selected AZ
- Check IAM permissions for launching instances
- Review service quotas for instance limits (default: 20 instances per region for new accounts)

**EC2 high CPU utilization:**
- Check CloudWatch metrics: CPUUtilization, NetworkIn, NetworkOut
- SSH in and run `top` or `htop` to identify the high-CPU process
- Consider vertical scaling (larger instance type) or horizontal scaling (Auto Scaling Group)

**EC2 connection timeout (SSH issues):**
- Verify security group allows port 22 from your IP
- Confirm the key pair matches what was specified at launch
- Check if the instance is in a public subnet with a public IP or Elastic IP
- Use SSM Session Manager as an alternative to SSH (no port 22 needed)

**EC2 unable to reach the internet:**
- Verify the subnet has a route to an Internet Gateway (public subnet) or NAT Gateway (private subnet)
- Check security group outbound rules
- Verify the instance has a public IP or Elastic IP (for public subnet)

### S3 Troubleshooting

**S3 access denied (403 error):**
- Check IAM policy — does the user/role have `s3:GetObject` permission?
- Check bucket policy — does it explicitly deny or not allow the principal?
- Check S3 Block Public Access settings at account and bucket level

**S3 lifecycle policy not deleting objects:**
- Verify the lifecycle rule is enabled (not just created)
- Check the prefix/tag filter matches the objects
- Lifecycle policies run once a day; objects may not be deleted immediately

### IAM Troubleshooting

**IAM policy not granting expected access:**
- Use IAM Policy Simulator to test which actions are allowed
- Check for explicit denies in any attached policy
- Check SCPs from AWS Organizations (they apply before IAM policies)

**STS token expired:**
- Tokens issued by `sts:AssumeRole` have a limited lifetime (1 hour default, up to 12 hours max)
- Implement token refresh logic in your application
- Use Instance Profile (EC2) or Task Role (ECS/EKS) to get automatic rotation

---

## AWS Migration Strategy (from PDF)

Enterprise cloud migration framework used in production:

**Applications migrated in example project:**
- 10 microservices
- 4 monolithic applications
- 5 MySQL databases

**Phase 1: Planning and Preparation**
1. Dev, DevOps, and QA teams discuss migration strategy
2. Managers and architects plan the necessary actions
3. Scrum Master schedules migration meetings and tracks status
4. Prepare an application inventory (Excel sheet with apps, databases, dependencies)
5. Review and assign tasks per team

**Migration phases (6R framework):**
- **Rehost** — "lift and shift"; move to EC2 with minimal changes
- **Replatform** — move to RDS instead of self-managed MySQL; minimal code changes
- **Refactor** — re-architect to use managed services (Lambda, ECS, DynamoDB)
- **Repurchase** — move to SaaS alternatives
- **Retain** — keep on-premises for now (compliance, latency requirements)
- **Retire** — decommission unused applications

---

## AWS DevOps Project Reference

From the PDF "AWS Projects" — a curated list of hands-on projects:

**Web Hosting and Deployment:**
1. Static Website Hosting — S3 + Route 53 + CloudFront
2. WordPress on AWS Lightsail
3. EC2-based Web Server — Apache/Nginx on EC2
4. Scalable Web App with ALB and Auto Scaling
5. Multi-Tier Web App — VPC + ALB + EC2 + RDS

**Serverless and Modern:**
6. Serverless API — Lambda + API Gateway + DynamoDB
7. GraphQL API — AppSync + DynamoDB
8. URL Shortener — Lambda + DynamoDB
9. Event-Driven Microservices — SNS + SQS
10. Serverless Image Resizer — S3 trigger + Lambda

**IaC and Automation:**
11. Terraform for AWS — VPC + EC2 + RDS
12. CloudFormation for IaC — automated provisioning
13. AWS CDK Deployment — programmatic infrastructure
14. Automated EC2 Scaling Based on Load
15. Self-Healing Infrastructure — Terraform + Auto Scaling

---

## Interview Q&A Reference

Q: What is the relation between Availability Zone and Region?
> AWS Regions are separate geographical areas (e.g., us-west-1, ap-south-1). Availability Zones are isolated data centers within a region. AZs within a region are connected by high-bandwidth, low-latency links. AZs can replicate themselves. You should design across at least 2 AZs for production workloads.

Q: How do you upgrade or downgrade a system with near-zero downtime?
> 1. Open EC2 console
> 2. Choose the target OS AMI
> 3. Launch a new instance with the new instance type
> 4. Install all updates and applications
> 5. Test the new instance
> 6. If working, swap the instance behind the load balancer
> 7. Terminate the old instance once traffic drains

Q: How do you set up SSH agent forwarding?
> 1. Go to PuTTY Configuration
> 2. Navigate to SSH → Auth
> 3. Enable "Allow agent forwarding"
> This avoids copying your private key to intermediate bastion hosts.

Q: What are the steps involved in a CloudFormation solution?
> 1. Create or use an existing CloudFormation template (JSON or YAML format)
> 2. Save the template in S3 (serves as a repository)
> 3. Use AWS CloudFormation console or CLI to create a stack from the template
> 4. CloudFormation reads the template, understands service relationships, and provisions resources in the correct order

Q: What is Elastic IP (EIP)?
> EIP stands for Elastic IP address. It is designed for dynamic cloud computing. When you need a static IP address for your instances that persists across stop/start cycles, use EIP. Without EIP, the public IP changes every time you stop and restart an instance.

Q: What are the different connectivity options for your VPC?
> Internet Gateway, Virtual Private Gateway, NAT, Endpoints, Peering Connections.

Q: In a VPC, how many EC2 instances can you use?
> Initially limited to launch 20 EC2 instances at a time. Maximum VPC size is 65,536 instances.

Q: Can you establish a peering connection to a VPC in a different region?
> Not possible via VPC Peering. Peering connections are available only between VPCs in the same region. For cross-region connectivity, use Transit Gateway or AWS PrivateLink.
