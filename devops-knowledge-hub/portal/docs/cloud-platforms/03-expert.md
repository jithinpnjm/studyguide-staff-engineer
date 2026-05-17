---
title: "Expert"
sidebar_position: 3
---

# Cloud Platforms — Expert

Expert cloud engineering is about designing for failure, policy, multi-account boundaries, migration safety, cost control, and operability. At this level, cloud services are not isolated products. They are contracts between teams, platforms, and production systems.

---

## Staff-Level Cloud Design Questions

Before choosing services, clarify:

1. What is the availability target?
2. What is the failure domain: AZ, region, account, cluster, service, dependency?
3. What data cannot be lost?
4. What is the recovery time objective?
5. What is the recovery point objective?
6. Who owns operations after launch?
7. What is the cost ceiling?
8. What security or compliance constraints exist?

Cloud architecture without these constraints is just a service list.

---

## Multi-Account AWS Org Design And Landing Zone

### OU Structure

AWS Organizations organizes accounts into Organizational Units (OUs). OUs inherit Service Control Policies from parent nodes.

Recommended OU structure for a fintech or large platform organization:

```text
Root
  Management account (no workloads, billing only)
  OU: Security
    Log Archive account     <- centralized CloudTrail/Config/FlowLogs
    Audit account           <- Security Hub aggregation, GuardDuty master
    Security Tooling account
  OU: Infrastructure
    Shared Network account  <- Transit Gateway, VPC, DNS
    Shared Services account <- CI/CD, container registry, monitoring
  OU: Workloads
    OU: Dev
      Team A Dev account
      Team B Dev account
    OU: Staging
      Team A Staging account
    OU: Production
      Team A Production account
      Team B Production account
```

Why separate accounts:
- Compromise in dev should not reach production (different IAM, different network)
- Billing and cost allocation are cleaner
- Service quotas are separated per account
- IAM policies are easier to reason about within a single account
- CloudTrail logs are centralized and protected from workload admins
- SCPs can enforce org-wide guardrails independent of individual account admins

### Service Control Policies

SCPs define the maximum permissions any identity in an account can have. They do not grant permissions; they reduce them.

Important SCP patterns:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyOutsideApprovedRegions",
      "Effect": "Deny",
      "NotAction": [
        "iam:*", "organizations:*", "support:*",
        "budgets:*", "trustedadvisor:*", "sts:*",
        "cloudfront:*", "route53:*"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": ["us-east-1", "eu-west-1", "ap-south-1"]
        }
      }
    },
    {
      "Sid": "DenyCloudTrailDisable",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "cloudtrail:UpdateTrail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyPublicS3BucketAccess",
      "Effect": "Deny",
      "Action": [
        "s3:PutBucketAcl",
        "s3:PutBucketPolicy"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": ["public-read", "public-read-write", "authenticated-read"]
        }
      }
    },
    {
      "Sid": "RequireMFAForSensitiveActions",
      "Effect": "Deny",
      "Action": ["iam:*", "organizations:*"],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

### AWS Control Tower And Account Vending Machine

Control Tower builds a landing zone automatically: sets up OUs, deploys SCPs, creates log archive and audit accounts, and enables CloudTrail organization trails.

Account vending: new team accounts are provisioned through Control Tower Account Factory (or custom automation using Organizations CreateAccount + Terraform). Each new account gets the standard guardrails applied automatically at the OU level.

### Transit Gateway: Centralized Egress

Transit Gateway (TGW) is a hub-and-spoke router that connects many VPCs and on-premises networks without full-mesh peering.

```text
Spoke VPCs (team A, team B, team C)
  -> TGW (central hub)
  -> Inspection VPC (centralized NAT + firewall)
  -> Internet
```

TGW route table design for isolation:

```bash
# Create a Transit Gateway
aws ec2 create-transit-gateway \
  --description "prod-tgw" \
  --options DefaultRouteTableAssociation=disable,DefaultRouteTablePropagation=disable

# Create separate route tables (one for spoke VPCs, one for shared services)
aws ec2 create-transit-gateway-route-table \
  --transit-gateway-id tgw-0abc123 \
  --tag-specifications 'ResourceType=transit-gateway-route-table,Tags=[{Key=Name,Value=spoke-rt}]'

# Add a blackhole route to prevent one spoke from reaching another
aws ec2 create-transit-gateway-route \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-route-table-id tgw-rtb-0abc123 \
  --blackhole
```

### AWS PrivateLink

PrivateLink lets you expose a service in one VPC to consumers in other VPCs without VPC peering, NAT, or internet exposure.

| Endpoint type | Use case |
|---|---|
| Gateway endpoint | S3, DynamoDB (free, route-table-based) |
| Interface endpoint | Most AWS services via PrivateLink (ENI in your VPC) |
| VPC endpoint service | Expose your own service to other VPCs/accounts |

```bash
# Create an interface endpoint for Secrets Manager
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0abc123 \
  --service-name com.amazonaws.us-east-1.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-0abc subnet-0def \
  --security-group-ids sg-0abc123 \
  --private-dns-enabled

# Create a gateway endpoint for S3 (free, no ENI)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0abc123 \
  --service-name com.amazonaws.us-east-1.s3 \
  --vpc-endpoint-type Gateway \
  --route-table-ids rtb-0private1 rtb-0private2
```

---

## Multi-Account And Landing Zone Design

A production landing zone separates concerns.

```text
organization
  -> security account
  -> logging account
  -> shared-network account
  -> dev workload account
  -> staging workload account
  -> production workload account
```

Why this matters:

- Compromise in dev should not reach production.
- Billing should be attributable.
- Audit logs should be protected from workload admins.
- Network routing should be centrally governed.
- Organization policies should prevent unsafe patterns.

AWS mechanisms:

- AWS Organizations
- Service Control Policies
- IAM Identity Center
- CloudTrail organization trails
- Control Tower landing zone
- AWS Config aggregators

GCP equivalents:

- Organization node
- Folders
- Projects
- IAM conditions
- Organization policies
- Shared VPC
- Cloud Audit Logs

Azure equivalents:

- Management groups
- Subscriptions
- Resource groups
- Azure Policy
- Entra ID
- Activity Logs

---

## Blast Radius Design

A cloud design should answer: what breaks when this component fails?

| Boundary | Example | Why it matters |
|---|---|---|
| Account/project | prod vs dev | Limits credential and policy blast radius |
| Region | eu-central-1 vs us-east-1 | Limits regional outage impact |
| AZ | subnet placement | Handles datacenter-level failure |
| VPC | network segmentation | Controls lateral movement |
| IAM role | workload identity | Limits API damage |
| KMS key | encryption boundary | Limits data access impact |

Staff-level answer: choose boundaries based on business impact, not arbitrary symmetry.

---

## Multi-AZ vs Multi-Region

### Multi-AZ

Multi-AZ is the default for production systems. It handles one Availability Zone failing without requiring global traffic movement.

Use for:

- Normal production web apps
- Regional databases
- Load-balanced services
- EKS/ECS clusters

### Multi-Region

Multi-region is a business continuity design, not a default checkbox. It adds complexity in data replication, deployment coordination, DNS routing, failover testing, and consistency.

Use when:

- Regional outage is unacceptable
- Compliance requires geographic resilience
- Global latency matters
- RTO/RPO justify the complexity

### Active-Active vs Active-Passive

| Pattern | Pros | Cons |
|---|---|---|
| Active-passive | Simpler, cheaper | Failover path must be tested |
| Active-active | Lower latency, higher resilience | Data consistency and routing complexity |

---

## Data Resilience

Data determines whether rollback and failover are real.

For relational systems:

- Use Multi-AZ for regional high availability.
- Use read replicas for read scale, not primary HA by default.
- Use point-in-time restore for operator mistakes.
- Test backups by restoring them.
- Use expand-contract migrations for application rollback.

For object storage:

- Enable versioning for critical buckets.
- Use lifecycle policies intentionally.
- Use cross-region replication only when RPO needs it.
- Protect buckets with block-public-access and least privilege policies.

For globally replicated databases:

- Understand write-region constraints.
- Understand eventual consistency windows.
- Practice regional promotion.

---

## Cloud Network Architecture

Expert network design focuses on routing intent and isolation.

Patterns:

```text
hub-and-spoke with Transit Gateway
shared VPC for centralized networking
private service endpoints for managed APIs
separate ingress and egress inspection paths
```

Key questions:

- Which workloads need internet egress?
- Which services must be private-only?
- Where are inspection, NAT, and firewall controls placed?
- How do teams request new connectivity?
- How is flow logging retained and queried?

Common mistakes:

- One giant flat VPC
- Shared security groups across unrelated apps
- Overlapping CIDR ranges
- No flow logs
- Public access for operational convenience

---

## Identity Architecture For Workloads

Workloads should receive identity from the platform rather than carrying static secrets.

Patterns:

- IAM roles for EC2 instance profiles
- IRSA for EKS service accounts
- GCP Workload Identity
- Azure Managed Identity
- OIDC federation from CI/CD systems

Benefits:

- No long-lived cloud keys in code
- Better audit trail
- Easier rotation
- Least privilege per workload
- Reduced blast radius

Expert design separates identities by service, environment, and function. A metrics exporter should not use the same role as a production deployer.

---

## Cost Architecture And FinOps Patterns

Cost optimization is not “turn things off later.” It is architecture.

| Cost lever | Example |
|---|---|
| Right-sizing | Resize EC2 and database instances by utilization |
| Reserved Instances | For stable instance types and families (1yr or 3yr) |
| Savings Plans | For flexible compute commitment across families/regions |
| Spot usage | Batch and stateless workers — 70-90% discount, interruptible |
| Storage lifecycle | S3 IA/Glacier lifecycle policies |
| Elasticity | Auto Scaling and serverless for variable load |
| Data transfer awareness | Avoid unnecessary cross-AZ and cross-region traffic |
| VPC endpoints | Reduce NAT Gateway costs for AWS API traffic |
| Observability retention | Route high-volume logs to S3 instead of CloudWatch long-term |

### Reserved Instances vs Savings Plans

| Commitment type | Flexibility | Discount |
|---|---|---|
| Standard Reserved Instance | Locked to instance family/region | Up to 72% |
| Convertible Reserved Instance | Can change instance family | Up to 66% |
| Compute Savings Plan | Any compute (EC2, Lambda, Fargate) in any region | Up to 66% |
| EC2 Instance Savings Plan | Specific region + family, any OS/size | Up to 72% |

For most teams: Compute Savings Plans are preferred because they cover more compute types and allow migration between instance families.

### FinOps Patterns

Tagging strategy is the foundation of cost allocation:

```bash
# Enforce required tags with an SCP or AWS Config rule
# Minimum required tags:
# Environment: dev | staging | prod
# Team: platform | backend | data
# Service: api | worker | db
# CostCenter: eg. CC-1234

# Tag an EC2 instance
aws ec2 create-tags \
  --resources i-0abc123 \
  --tags Key=Environment,Value=prod Key=Team,Value=backend Key=Service,Value=api
```

Cost Anomaly Detection:

```bash
# Create a cost anomaly monitor
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    “MonitorName”: “service-monitor”,
    “MonitorType”: “DIMENSIONAL”,
    “MonitorDimension”: “SERVICE”
  }'

# Create an alert subscription
aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    “SubscriptionName”: “alert-on-anomaly”,
    “MonitorArnList”: [“arn:aws:ce::123:anomalymonitor/xxx”],
    “Subscribers”: [{“Address”: “arn:aws:sns:us-east-1:123:alerts”, “Type”: “SNS”}],
    “Threshold”: 100,
    “Frequency”: “DAILY”
  }'
```

Compute Optimizer: right-sizes EC2, Lambda, and EBS volumes based on historical metrics. Access via console or:

```bash
aws compute-optimizer get-ec2-instance-recommendations \
  --query 'instanceRecommendations[*].{Instance:instanceArn,Finding:finding,Options:recommendationOptions[0].instanceType}'
```

Showback vs chargeback:
- Showback: report cost per team/service for visibility without internal billing
- Chargeback: bill teams internally based on actual consumption (requires mature tagging + CUR)

Staff-level framing: cost efficiency must not silently reduce reliability. For example, one NAT Gateway is cheaper than three, but it creates an AZ dependency.

---

## AWS Security Baseline

Minimum production baseline:

- MFA or SSO for humans
- Root/admin identity locked down
- No public buckets
- Central audit logging
- Flow logs for key VPCs
- GuardDuty or equivalent threat detection
- Config or policy monitoring
- Encryption at rest and in transit
- Patch automation for VM fleets
- Least privilege for workloads

Strong teams define this as platform default, not team-by-team memory.

### GuardDuty, Security Hub, And Config

GuardDuty analyzes CloudTrail, VPC Flow Logs, and DNS logs for suspicious patterns (credential exfiltration, unusual API calls, port scanning, crypto mining).

```bash
# Enable GuardDuty
aws guardduty create-detector --enable

# Enable Security Hub (aggregates findings from GuardDuty, Inspector, Macie, Config)
aws securityhub enable-security-hub

# Check Security Hub score
aws securityhub get-findings \
  --filters '{"SeverityLabel":[{"Value":"CRITICAL","Comparison":"EQUALS"}]}' \
  --query 'Findings[*].{Title:Title,Resource:Resources[0].Id}'

# List non-compliant Config rules
aws configservice describe-compliance-by-config-rule \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByConfigRules[*].ConfigRuleName'
```

### Secrets Management

AWS Secrets Manager vs SSM Parameter Store:

| Feature | Secrets Manager | Parameter Store |
|---|---|---|
| Automatic rotation | Yes (Lambda-based) | No (manual) |
| Cost | $0.40/secret/month | Free (standard tier) |
| Cross-account access | Yes | Yes (with resource policy) |
| Multi-Region secrets | Yes | No |
| Best for | DB credentials, API keys needing rotation | Config values, non-rotated secrets |

Secrets Manager rotation:

```bash
# Enable automatic rotation for an RDS secret
aws secretsmanager rotate-secret \
  --secret-id my-db-credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=30

# Create a multi-Region secret replica
aws secretsmanager replicate-secret-to-regions \
  --secret-id my-api-key \
  --add-replica-regions '[{"Region": "eu-west-1"}]'
```

---

## Disaster Recovery Tiers

DR is about recovering from serious failures. Choose tier based on RTO/RPO requirements and budget.

| DR Strategy | Cost | RTO | RPO | Mechanism |
|---|---|---|---|---|
| Backup and restore | Lowest | Hours | Hours | S3 backups, RDS snapshots; restore from scratch |
| Pilot light | Low | 10-30 min | Minutes | Minimal secondary infra; scale up on failover |
| Warm standby | Medium | Minutes | Seconds | Reduced-scale secondary; quickly scale to full |
| Multi-site active-active | Highest | Near-zero | Near-zero | Full duplicate; Route 53 routes traffic to healthy region |

### Multi-Region Active-Active

Route 53 routing patterns for DR:

```bash
# Latency-based routing: routes to lowest latency region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "Region": "us-east-1",
        "SetIdentifier": "us-east-1",
        "AliasTarget": {"DNSName": "my-alb-us.example.com", "EvaluateTargetHealth": true, "HostedZoneId": "Z35SXDOTRQ7X7K"}
      }
    }]
  }'

# Failover routing: active-passive
# Primary record with FailoverRoutingPolicy=PRIMARY
# Secondary record with FailoverRoutingPolicy=SECONDARY (only used when primary health check fails)
```

DynamoDB Global Tables for multi-region:

```bash
# Create a global table (multi-region replication)
aws dynamodb create-global-table \
  --global-table-name my-orders \
  --replication-group '[{"RegionName":"us-east-1"},{"RegionName":"eu-west-1"}]'
```

S3 Cross-Region Replication for multi-region backup:

```bash
aws s3api put-bucket-replication \
  --bucket source-us-east-1 \
  --replication-configuration '{
    "Role": "arn:aws:iam::123:role/s3-crr-role",
    "Rules": [{"Status":"Enabled","Destination":{"Bucket":"arn:aws:s3:::dest-eu-west-1","StorageClass":"STANDARD_IA"}}]
  }'
```

---

## Platform Golden Paths

A cloud platform should provide opinionated defaults.

Examples:

- Standard VPC module
- Standard EKS/GKE/AKS cluster module
- Standard RDS module with backups and monitoring
- Standard service template with logging, metrics, alerts
- Standard CI/CD and GitOps promotion path
- Standard tagging and cost allocation

Golden paths reduce cognitive load. Escape hatches should exist, but teams that deviate own the extra operational burden.

---

## Cloud Failure Modes

### Regional Service Degradation

Response:

- Confirm provider health and local symptoms.
- Identify affected services and dependencies.
- Use prepared failover path if RTO requires it.
- Avoid improvised cross-region recovery under pressure.

### IAM Policy Misconfiguration

Symptoms:

- Deployments fail suddenly.
- Apps cannot access cloud APIs.
- Only one environment affected.

Check recent IAM, organization policy, role trust, and service account changes.

### NAT Or Egress Failure

Symptoms:

- Private workloads cannot reach external APIs.
- Package installs fail.
- Webhooks fail.

Check route tables, NAT health, firewall rules, DNS, and VPC endpoints.

### Database Connection Storm

Symptoms:

- DB CPU and connection count spike.
- App errors increase.
- Lambda or autoscaling events correlate.

Mitigation can include connection pooling, RDS Proxy, rate limiting, or scaling read paths.

---

## GCP Expert: Anthos, Workload Identity Federation, And Shared VPC

### Anthos

Anthos extends GCP's managed control plane to on-premises or other clouds. It provides GKE consistency, Config Controller (policy-as-code via Config Connector), and Anthos Service Mesh across environments.

Use cases: organizations with on-premises Kubernetes that want GKE-consistent tooling and governance without full cloud migration.

### Workload Identity Federation

GCP Workload Identity Federation allows external identities (GitHub Actions, AWS IAM, Azure AD) to impersonate GCP service accounts without long-lived keys:

```bash
# Create a workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --location global \
  --display-name "GitHub Actions Pool"

# Add an OIDC provider (GitHub Actions)
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location global \
  --workload-identity-pool github-pool \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository"

# Allow a specific GitHub repo to impersonate a service account
gcloud iam service-accounts add-iam-policy-binding my-sa@project.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/github-pool/attribute.repository/myorg/myrepo"
```

### Shared VPC

Shared VPC centralizes network management. A host project owns the VPC and subnets. Service projects attach to the host VPC and launch resources into shared subnets.

Benefits: central network team controls routing, firewall, and CIDR; product teams deploy their workloads into shared subnets without needing to manage networking.

```bash
# Enable Shared VPC hosting in the host project
gcloud compute shared-vpc enable my-host-project

# Associate a service project
gcloud compute shared-vpc associated-projects add my-service-project \
  --host-project my-host-project
```

### BigQuery IAM

BigQuery uses row-level and column-level security in addition to standard IAM:

```bash
# Grant dataset access
bq add-iam-policy-binding \
  --member=serviceAccount:my-sa@project.iam.gserviceaccount.com \
  --role=roles/bigquery.dataViewer \
  my-project:my-dataset
```

---

## Azure Expert: Management Groups, Policy, Arc, And Defender

### Azure Management Groups

Management Groups sit above subscriptions and allow policies and RBAC to be applied hierarchically:

```text
Root Management Group
  OU: Platform
    Subscription: Connectivity   <- hub VNet, ExpressRoute, Firewall
    Subscription: Identity       <- Active Directory
    Subscription: Management     <- Log Analytics, Automation
  OU: Landing Zones
    OU: Corp
      Subscription: Team A Prod
    OU: Online
      Subscription: Team B Prod
  OU: Sandbox
    Subscription: Dev/Test
```

### Azure Policy

Azure Policy enforces compliance on resources:

```bash
# Assign a built-in policy: require tags on resources
az policy assignment create \
  --name require-env-tag \
  --policy /providers/Microsoft.Authorization/policyDefinitions/96670d01-0a4d-4649-9c89-2d3abc0a5025 \
  --scope /subscriptions/my-subscription-id \
  --params '{"tagName":{"value":"Environment"}}'

# List non-compliant resources
az policy state list \
  --filter "complianceState eq 'NonCompliant'" \
  --query '[*].{Resource:resourceId,Policy:policyDefinitionName}'
```

### Azure Arc

Azure Arc extends Azure management to resources outside Azure (on-premises, AWS, GCP). Arc-enabled Kubernetes clusters can be managed with Azure Policy, GitOps, and Azure Monitor from Azure's control plane.

```bash
# Connect an external Kubernetes cluster to Azure Arc
az connectedk8s connect \
  --name my-cluster \
  --resource-group my-rg

# Deploy a GitOps configuration to an Arc cluster
az k8s-configuration flux create \
  --cluster-name my-cluster \
  --resource-group my-rg \
  --cluster-type connectedClusters \
  --name my-gitops-config \
  --url https://github.com/myorg/fleet-config \
  --branch main
```

### Microsoft Defender For Cloud

Defender for Cloud provides security posture management and threat protection across Azure, AWS, and GCP workloads (similar to AWS Security Hub + GuardDuty):

```bash
# Enable Defender for Cloud on a subscription
az security pricing create \
  --name VirtualMachines \
  --tier standard

# Get security recommendations
az security assessment list \
  --query '[?status.code==`Unhealthy`].{Name:displayName,Resource:resourceDetails.id}'
```

---

## Expert Takeaways

1. Cloud design is blast-radius design.
2. Multi-account/project structure is a security and reliability boundary.
3. Multi-region is expensive operational complexity and must be justified.
4. Workload identity is safer than static keys.
5. Cost controls must preserve reliability intent.
6. Golden paths make secure defaults easy.
7. Data recovery must be tested, not assumed.
8. Architecture is incomplete without observability and rollback paths.
