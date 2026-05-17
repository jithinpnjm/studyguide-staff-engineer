---
title: “Beginner”
sidebar_position: 1
---

# Cloud Platforms — Beginner

Cloud platforms are the infrastructure substrate for modern systems. As an SRE or platform engineer, you do not only “use AWS” or “deploy to GCP.” You make decisions that affect reliability, cost, security, scaling, operability, and incident response for years.

The beginner goal is to build a strong mental model of the cloud:

```text
identity -> network -> compute -> storage -> database -> load balancing -> observability -> cost controls
```

If you understand those layers, individual services become easier to reason about.

AWS is not one giant computer. It is a collection of separately scoped systems. Some resources are global, many are regional, and some are zonal. Misunderstanding that scope is a common root cause of outages because engineers assume redundancy exists where it does not.

```text
Global:   IAM users, Route 53 public hosted zones, CloudFront
Regional: VPC, ALB, RDS, Lambda, DynamoDB table, S3 bucket location
Zonal:    EC2 instance, EBS volume, subnet, NAT Gateway
```

---

## AWS Global Infrastructure: Regions, AZs, And Edge Locations

### Regions

A Region is AWS's unit for placing workloads in a broad physical area of the world. Each Region is isolated from other Regions. Most services create resources inside one Region and do not replicate across Regions unless your design explicitly does that.

Common Region codes:

| Region code | Location |
|---|---|
| us-east-1 | US East (N. Virginia) — oldest, most services |
| us-east-2 | US East (Ohio) |
| us-west-1 | US West (N. California) |
| us-west-2 | US West (Oregon) |
| eu-west-1 | Europe (Ireland) |
| eu-west-2 | Europe (London) |
| eu-central-1 | Europe (Frankfurt) |
| ap-south-1 | Asia Pacific (Mumbai) |
| ap-southeast-1 | Asia Pacific (Singapore) |
| ap-northeast-1 | Asia Pacific (Tokyo) |
| ca-central-1 | Canada (Central) |
| sa-east-1 | South America (Sao Paulo) |

Choose a Region based on: user latency, data residency and compliance, service availability, pricing, and disaster recovery requirements.

### Availability Zones

An Availability Zone is made of one or more data centers with independent power, networking, and connectivity. AZs in the same Region are connected by low-latency private networking.

Production principle:

- one AZ is a failure domain
- two AZs are the minimum for common HA
- three AZs are better when the service supports it and cost allows it

A bad design example: all EC2 instances, EBS volumes, NAT Gateways, and the database live in one AZ. This looks deployed-to-AWS but is still a single-site system.

### Edge Locations

Edge locations exist because user experience is often limited by distance. AWS services that use edge locations include CloudFront, Route 53, AWS WAF, and Global Accelerator. The mental model is "front door near the user, origin deeper in AWS."

---

## Why Cloud Matters For SREs

Cloud platforms give teams managed infrastructure primitives:

- Virtual machines
- Private networks
- Object storage
- Managed databases
- Load balancers
- Serverless compute
- Container platforms
- Monitoring and audit logs
- IAM and policy systems

The SRE value is not just knowing service names. It is knowing the operational tradeoff behind each service.

| Decision | Reliability impact | Cost impact | Security impact |
|---|---|---|---|
| Multi-AZ database | Survives AZ failure | Higher cost | Better resilience |
| Public subnet instance | Easy access | May be cheaper short-term | Larger attack surface |
| Managed database | Less ops burden | Premium price | Provider handles patching layer |
| Spot compute | Cheap capacity | Interruptions possible | Good for stateless jobs |
| Serverless | Auto-scales fast | Can surprise on high volume | Less OS control |

---

## Shared Responsibility Model

Cloud providers are responsible for security **of** the cloud: facilities, hardware, physical networking, and managed service infrastructure.

You are responsible for security **in** the cloud: IAM, data access, application code, network exposure, encryption settings, operating-system patching where applicable, and runtime configuration.

| Service model | Provider manages | You manage |
|---|---|---|
| IaaS | Data center, hardware, hypervisor | OS, app, data, network rules |
| PaaS | Runtime platform, patching layer | App config, data, access policy |
| SaaS/managed service | Most infrastructure | Data, identity, usage, policy |

Example:

- EC2: you patch the OS.
- RDS: provider patches the database platform, but you manage schema, queries, and access.
- S3: provider runs storage, but you own bucket policies and object access.

---

## Account And Project Structure

A beginner mistake is putting everything into one cloud account or project. A production organization usually separates environments.

```text
organization
  -> dev account/project
  -> staging account/project
  -> production account/project
  -> security/logging account/project
  -> shared networking account/project
```

Benefits:

- Smaller blast radius
- Cleaner billing
- Better access control
- Easier audit
- Safer experimentation in dev

For AWS, this is commonly done with AWS Organizations and Service Control Policies. For GCP, folders and projects provide a similar isolation structure. For Azure, management groups, subscriptions, and resource groups form the hierarchy.

---

## IAM Basics

IAM is the cloud security perimeter. Everything in cloud is an API call, and IAM decides which calls are allowed.

IAM answers: who can do what to which resource under what conditions?

Core concepts:

| Concept | Meaning |
|---|---|
| Principal | The actor: user, role, AWS service, federated identity |
| Action | API operation, such as `s3:GetObject` or `ec2:DescribeInstances` |
| Resource | Target ARN, such as a bucket ARN or role ARN |
| Condition | Extra rule such as source IP, MFA, tag, VPC endpoint |
| Policy | JSON document that allows or denies actions |
| Role | Assumable identity with temporary credentials |
| Trust policy | JSON document: who is allowed to assume the role |
| Group | Collection of users for easier permission management |
| Permission boundary | Maximum permissions an identity may receive |
| Organization policy | Higher-level guardrail across accounts/projects (SCP) |

### The Principal to Resource Flow

```text
principal authenticates
  -> principal requests action on resource
  -> identity policies evaluated
  -> resource policies evaluated
  -> permission boundaries checked
  -> organization SCPs checked
  -> explicit deny wins
  -> allow is required
  -> otherwise deny by default
```

### IAM Users vs IAM Roles

Use IAM users rarely. Long-lived human credentials get copied into laptops, scripts, CI systems, and forgotten terminals. Prefer federation through IAM Identity Center or an external identity provider.

For workloads, always use roles:

- EC2 instance role: lets an instance call AWS APIs without static keys
- Lambda execution role: lets a function write logs and access dependencies
- ECS task role: gives each task its own scoped permissions
- EKS IRSA: gives Kubernetes workloads AWS permissions without long-lived keys

### Core AWS CLI IAM Commands

```bash
# Who am I?
aws sts get-caller-identity

# Configure credentials
aws configure
# or use SSO
aws configure sso

# List IAM roles
aws iam list-roles --query 'Roles[*].{Name:RoleName,ARN:Arn}'

# Get a role's attached policies
aws iam list-attached-role-policies --role-name my-role

# Simulate whether a principal can do an action
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789:role/my-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::my-bucket/*

# Assume a role (one-liner with STS)
aws sts assume-role \
  --role-arn arn:aws:iam::123456789:role/target-role \
  --role-session-name my-session
```

Beginner rules:

- Do not use root/admin identities for daily work.
- Prefer roles or workload identity over long-lived keys.
- Enable MFA for human access.
- Grant least privilege.
- Review unused permissions.

---

## Networking Basics And VPC Walkthrough

A cloud network is the boundary where most architecture decisions start.

AWS VPC terminology:

| Component | Purpose |
|---|---|
| VPC | Isolated virtual network in a Region |
| Subnet | IP range inside one Availability Zone |
| Route table | Decides where traffic goes (per subnet) |
| Internet Gateway | Enables public internet path for public subnets |
| NAT Gateway | Outbound internet path for private subnets (no inbound) |
| Security Group | Stateful firewall attached to ENI/instance |
| NACL | Stateless subnet-level firewall |
| VPC Endpoint | Private access to AWS services without internet path |
| Transit Gateway | Hub-and-spoke routing across many VPCs |
| VPC Flow Logs | Records metadata about IP traffic flows |

### VPC Diagram Walkthrough

A three-tier production VPC across two Availability Zones:

```text
VPC: 10.0.0.0/16
  AZ us-east-1a:
    Public subnet:   10.0.1.0/24   <- ALB, NAT Gateway
    Private subnet:  10.0.11.0/24  <- App servers, EKS nodes
    Database subnet: 10.0.21.0/24  <- RDS, ElastiCache

  AZ us-east-1b:
    Public subnet:   10.0.2.0/24   <- ALB, NAT Gateway
    Private subnet:  10.0.12.0/24  <- App servers, EKS nodes
    Database subnet: 10.0.22.0/24  <- RDS standby

Route tables:
  Public RT:   0.0.0.0/0 -> Internet Gateway (igw-xxxx)
  Private RT:  0.0.0.0/0 -> NAT Gateway (nat-xxxx, one per AZ)
  Database RT: 10.0.0.0/16 -> local (no internet route)
```

What makes a subnet public: a route for `0.0.0.0/0` pointing to an Internet Gateway. What makes a subnet private: a route for `0.0.0.0/0` pointing to a NAT Gateway, or no default route at all. The subnet label is just a name — the route table is what matters.

### Request Flow: Internet to Private EC2

```text
User browser
  -> DNS resolves app.example.com (Route 53)
  -> ALB public IP (in public subnet, listens on 443)
  -> ALB security group: allow 443 from 0.0.0.0/0
  -> ALB selects healthy target in private subnet
  -> App EC2 security group: allow 8080 from ALB SG
  -> App connects to RDS (database subnet)
  -> DB security group: allow 5432 from App SG only
```

Key insight: each hop has a security group that must explicitly allow the traffic. The database subnet has no route to the internet, so even if a security group were accidentally opened, external hosts still could not initiate connections to it.

### Core AWS CLI Networking Commands

```bash
# Describe VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].{ID:VpcId,CIDR:CidrBlock,Name:Tags[?Key==`Name`]|[0].Value}'

# Describe subnets in a VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0abc123" \
  --query 'Subnets[*].{ID:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock}'

# Describe route tables
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=vpc-0abc123"

# Describe security groups
aws ec2 describe-security-groups \
  --group-ids sg-0abc123 \
  --query 'SecurityGroups[*].IpPermissions'

# Describe running instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].{ID:InstanceId,Type:InstanceType,IP:PrivateIpAddress,AZ:Placement.AvailabilityZone}'

# List S3 buckets
aws s3 ls

# List objects in a bucket
aws s3 ls s3://my-bucket/

# Get caller identity
aws sts get-caller-identity
```

---

## Compute Options

Cloud compute comes in several models.

| Model | AWS example | Good for | Tradeoff |
|---|---|---|---|
| Virtual machine | EC2 | Full control, legacy apps | You manage OS lifecycle |
| Containers | ECS, EKS, Fargate | Microservices | Platform complexity |
| Serverless function | Lambda | Event-driven tasks | Runtime limits, cold starts |
| Managed app platform | Elastic Beanstalk, App Runner | Fast deployment | Less control |

EC2 pricing models:

- On-demand: flexible, highest cost.
- Reserved Instances or Savings Plans: cheaper for predictable use.
- Spot Instances: large discount, can be interrupted.
- Dedicated hosts: compliance or licensing needs.

---

## Storage And Databases

Object storage and databases solve different problems.

| Need | Service family |
|---|---|
| Static files, backups, logs, data lake | Object storage such as S3 |
| Transactional relational workload | RDS, Aurora, Cloud SQL, Azure SQL |
| Key-value or document workload | DynamoDB, Firestore, Cosmos DB |
| Cache | ElastiCache, Memorystore, Azure Cache |
| Block storage for VM | EBS, Persistent Disk, Managed Disk |

S3 mental model:

```text
bucket -> object key -> object bytes + metadata
```

S3 is not a POSIX filesystem. It is an object store with HTTP API semantics.

RDS mental model:

```text
application -> connection pool/proxy -> database endpoint -> storage and replicas
```

Managed databases reduce operational burden, but they do not remove schema design, query tuning, connection management, or backup testing.

---

## Load Balancing And DNS

Load balancers distribute traffic. DNS decides where clients start.

AWS examples:

| Service | Purpose |
|---|---|
| Route 53 | DNS and traffic policy |
| ALB | Layer 7 HTTP/HTTPS routing |
| NLB | Layer 4 TCP/UDP routing |
| CloudFront | CDN and edge caching |
| WAF | Web application filtering |

A basic web request path:

```text
user -> DNS -> CDN -> load balancer -> service -> pod/instance -> database
```

SREs should be able to trace failures across this path.

---

## Observability And Audit

Minimum cloud observability baseline:

- Metrics for compute, database, storage, and load balancer
- Logs for application and platform components
- Audit logs for API calls
- Flow logs for network traffic
- Alerts for availability, saturation, error rate, and security events

AWS examples:

| Need | Service |
|---|---|
| Metrics and logs | CloudWatch |
| API audit | CloudTrail |
| Network flow logs | VPC Flow Logs |
| Security findings | GuardDuty, Security Hub |
| Config drift | AWS Config |

---

## Beginner Architecture: Three-Tier App

Classic AWS pattern:

```text
Route 53
  -> CloudFront
  -> ALB in public subnets
  -> EC2/EKS/ECS app in private subnets
  -> RDS in isolated database subnets
```

Key rules:

- Keep databases private.
- Put load balancers, not app nodes, on the public edge.
- Use multiple Availability Zones.
- Use Auto Scaling for stateless compute.
- Use managed database backups and failover.
- Use IAM roles for workloads.

---

## GCP Basics: Projects, IAM, And gcloud CLI

GCP organizes resources into a hierarchy: Organization -> Folder -> Project -> Resources.

A project is the base billing and resource container. Each project has its own IAM bindings, API enablement, quotas, and network.

### GCP IAM Model

GCP IAM is binding-based rather than policy-document-based:

```text
member (who) + role (what permissions) + resource (where)
= IAM binding
```

Member types: `user:`, `serviceAccount:`, `group:`, `domain:`, `allUsers`, `allAuthenticatedUsers`.

Common predefined roles:

| Role | Permissions |
|---|---|
| `roles/viewer` | Read-only across project |
| `roles/editor` | Read/write, most resources |
| `roles/owner` | Full control including IAM |
| `roles/iam.serviceAccountUser` | Can act as the service account |
| `roles/container.developer` | Manage GKE workloads |
| `roles/storage.objectViewer` | Read GCS objects |

### gcloud CLI Basics

```bash
# Authenticate
gcloud auth login

# Authenticate for application default credentials (for SDK use)
gcloud auth application-default login

# Set active project
gcloud config set project my-project-id

# Verify current config
gcloud config list

# List projects
gcloud projects list

# Create a service account
gcloud iam service-accounts create my-sa --display-name "My Service Account"

# Bind a role to a service account on a project
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:my-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# List GKE clusters
gcloud container clusters list

# Get GKE credentials
gcloud container clusters get-credentials my-cluster --zone us-central1-a
```

---

## Azure Basics: Subscriptions, Resource Groups, And az CLI

Azure organizes resources: Management Groups -> Subscriptions -> Resource Groups -> Resources.

A subscription is the billing and governance unit. A resource group is a logical container for related resources in the same lifecycle. Unlike AWS regions, Azure resource groups can span regions but resources within them are placed in specific regions.

### Azure RBAC Model

Azure uses Role-Based Access Control. Assignments bind a principal (user, group, managed identity) to a role at a scope (management group, subscription, resource group, or resource).

Built-in roles:

| Role | Scope |
|---|---|
| Owner | Full control including RBAC |
| Contributor | Create/modify resources, no RBAC |
| Reader | View-only |
| User Access Administrator | Manage access only |

### az CLI Basics

```bash
# Login
az login

# Set default subscription
az account set --subscription "my-subscription-name"

# List subscriptions
az account list --output table

# List resource groups
az group list --output table

# Create resource group
az group create --name my-rg --location eastus

# List VMs
az vm list --resource-group my-rg --output table

# Get AKS credentials
az aks get-credentials --resource-group my-rg --name my-cluster

# List AKS node pools
az aks nodepool list --resource-group my-rg --cluster-name my-cluster
```

---

## Cloud Service Comparison Table

Equivalent services across AWS, GCP, and Azure:

| Category | AWS | GCP | Azure |
|---|---|---|---|
| Virtual machines | EC2 | Compute Engine | Virtual Machines |
| Managed Kubernetes | EKS | GKE | AKS |
| Serverless functions | Lambda | Cloud Functions | Azure Functions |
| Serverless containers | Fargate/ECS | Cloud Run | Azure Container Apps |
| Object storage | S3 | Cloud Storage (GCS) | Blob Storage |
| Block storage | EBS | Persistent Disk | Managed Disks |
| Shared file storage | EFS | Filestore | Azure Files |
| Relational DB (managed) | RDS/Aurora | Cloud SQL | Azure SQL Database |
| NoSQL DB | DynamoDB | Firestore/Bigtable | Cosmos DB |
| In-memory cache | ElastiCache (Redis) | Memorystore | Azure Cache for Redis |
| Message queue | SQS | Pub/Sub (pull) | Azure Service Bus |
| Pub/Sub fanout | SNS | Pub/Sub | Azure Event Grid |
| Streaming | Kinesis | Dataflow/Pub/Sub | Azure Event Hubs |
| CDN | CloudFront | Cloud CDN | Azure CDN / Front Door |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| Load balancer (L7) | ALB | Cloud Load Balancing | Application Gateway |
| Load balancer (L4) | NLB | Cloud Load Balancing (TCP) | Azure Load Balancer |
| WAF | AWS WAF | Cloud Armor | Azure WAF |
| Identity / IAM | IAM | Cloud IAM | Entra ID (Azure AD) |
| Workload identity | IRSA / Pod Identity | Workload Identity | Workload Identity / Managed Identity |
| Container registry | ECR | Artifact Registry | Azure Container Registry |
| Secret management | Secrets Manager | Secret Manager | Azure Key Vault |
| Monitoring / metrics | CloudWatch | Cloud Monitoring | Azure Monitor |
| Audit logs | CloudTrail | Cloud Audit Logs | Activity Logs |
| Network | VPC | VPC (global) | VNet |
| Network policy | Security Groups + NACLs | Firewall rules | NSGs |
| Private connectivity | PrivateLink/Endpoints | Private Service Connect | Private Link |
| Network hub | Transit Gateway | Shared VPC / NCC | Azure Virtual WAN |
| IaC | CloudFormation | Deployment Manager | ARM Templates / Bicep |
| GitOps/CI | CodePipeline / CodeBuild | Cloud Build / Cloud Deploy | Azure DevOps / Pipelines |

---

## Beginner Takeaways

1. IAM controls cloud API access. Use roles and workload identity, not long-lived keys.
2. Network design defines blast radius. Database subnets must have no internet route.
3. Multi-AZ is the default for production reliability. One AZ is a failure domain.
4. Public subnets should be used intentionally and sparingly — only for LBs and NAT gateways.
5. Managed services reduce undifferentiated operations work.
6. Serverless reduces infrastructure management but adds runtime limits.
7. Cost is an architecture concern, not only a finance concern.
8. Audit logs and flow logs are essential for incident response.
9. AWS, GCP, and Azure share the same fundamental concepts — identity, network, compute, storage — with different naming and implementation details.
10. Always verify caller identity (`aws sts get-caller-identity`) before debugging IAM issues.
