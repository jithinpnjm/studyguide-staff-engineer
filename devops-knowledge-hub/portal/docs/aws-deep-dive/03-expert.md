---
title: "Expert"
sidebar_position: 3
---

# AWS Deep Dive — Expert: Advanced Patterns and Platform Engineering

This level covers the services, patterns, and tradeoffs that distinguish senior engineers in AWS interviews and production operations. Every section connects services to operational consequences.

---

## Containers on AWS

### ECR — Elastic Container Registry

ECR stores container images with IAM-controlled access. Use lifecycle policies to remove untagged or old images. Enable vulnerability scanning (ECR Enhanced with Inspector) for shift-left security.

Key points:
- Cross-account ECR access requires ECR resource policy
- ECR Public Gallery for public images
- Pull-through cache for third-party registries (Docker Hub, quay.io) reduces NAT egress

### ECS — Elastic Container Service

ECS is AWS-native container orchestration. Choose ECS when you want containers without Kubernetes complexity.

**Launch types:**
| Launch Type | Control | Use Case |
|---|---|---|
| EC2 | You manage cluster nodes | Custom networking, daemon containers, cost control |
| Fargate | AWS manages compute | Serverless containers, no node management |

**ECS core objects:**

| Object | Meaning |
|---|---|
| Cluster | Logical grouping of services and tasks |
| Task definition | Container spec: image, CPU, memory, ports, volumes, env, IAM |
| Task | Running copy of a task definition |
| Service | Maintains desired task count, handles rolling deploys, integrates with ALB |
| Task role | AWS permissions for application code inside the container |
| Execution role | Permissions for ECS/Fargate agent: pull images from ECR, write logs to CloudWatch |

**Critical distinction:** task role vs execution role is one of the most common interview and production debugging points. If the app cannot call AWS APIs, check the task role. If ECS cannot pull the image or write logs, check the execution role.

**ECS scaling:**
- **Service Auto Scaling:** scale task count based on CloudWatch metrics (CPU, memory, ALB request count, custom)
- **Target tracking:** recommended for consistent throughput targets

**ECS networking (`awsvpc` mode):**
Each task gets its own ENI and private IP. Security groups attach directly to the task, not the host. Enables task-level security group control. Requires sufficient ENI capacity in subnets.

### EKS — Elastic Kubernetes Service

EKS provides a managed Kubernetes control plane. You still operate worker nodes, add-ons, networking, policies, upgrades, and workload design.

**Node options:**
| Option | Description |
|---|---|
| Managed node groups | AWS manages node provisioning and lifecycle |
| Self-managed nodes | Full control; more operational burden |
| Fargate profiles | Serverless pods; no node management; limited to specific workload types |
| Karpenter | Fast, flexible node provisioning based on pod requirements |

**Mapping Kubernetes concepts to AWS:**

| Kubernetes | AWS |
|---|---|
| Pod networking | VPC CNI, ENIs, subnet IP capacity |
| Service LoadBalancer | AWS Load Balancer Controller / ALB or NLB |
| PersistentVolume | EBS CSI driver or EFS CSI driver |
| ServiceAccount identity | IRSA (IAM Roles for Service Accounts) or EKS Pod Identity |
| Node scaling | Cluster Autoscaler or Karpenter |
| Secrets | Secrets Store CSI Driver + Secrets Manager/SSM |

**Critical EKS SRE topics:**
- VPC CNI IP exhaustion (subnet sizing, prefix delegation)
- CoreDNS health and cache behavior
- EBS multi-attach limitations (only io1/io2 multi-attach supported; ReadWriteOnce per pod)
- EKS cluster version upgrades (in-place control plane upgrade, then managed node group upgrade)
- Pod disruption budgets during node termination
- Karpenter drift detection and node consolidation

**IRSA (IAM Roles for Service Accounts):** maps Kubernetes service account to AWS IAM role via OIDC federation. Trust policy condition must match the OIDC subject (`system:serviceaccount:namespace:sa-name`). Pod Identity is the newer, simpler mechanism that doesn't require OIDC condition strings.

### Fargate vs EC2 Launch Type

| Dimension | EC2 Launch Type | Fargate |
|---|---|---|
| Node management | You manage | AWS manages |
| Daemon containers | Supported | Not supported |
| Cost model | Pay for EC2 instance | Pay per vCPU/memory per second |
| Startup time | Instance warmup required | Task starts on-demand |
| Custom networking | Full ENI control | Task-level ENI only |
| Debug access | SSM Session Manager or SSH | Exec into task with ECS Exec |

### App Runner

Fully managed container service for simple web apps and APIs. Fewer controls than ECS/EKS but minimal operational burden. Good for small apps where platform complexity is not justified.

---

## Serverless

### Lambda

Lambda runs functions on-demand without managing servers. You pay per request and execution duration.

**Lambda lifecycle:**
1. Trigger (API Gateway, S3, SQS, EventBridge, etc.)
2. Cold start: init phase (download code, initialize runtime, run init code)
3. Warm execution: handler runs
4. Lambda environment may be reused for subsequent invocations (no guarantee)

**Lambda limits:**
| Limit | Value |
|---|---|
| Execution timeout | 15 minutes max |
| Memory | 128 MB to 10,240 MB |
| Ephemeral storage (/tmp) | 512 MB to 10,240 MB |
| Package size (zip) | 50 MB (zipped), 250 MB (unzipped) |
| Container image size | 10 GB |
| Concurrent executions | 1,000 per Region default (soft limit) |

**Concurrency controls:**
- **Reserved concurrency:** guarantees N invocations for a function AND caps its blast radius; no other function can use those slots
- **Provisioned concurrency:** keeps N environments pre-initialized; eliminates cold starts for latency-sensitive functions

**Lambda Power Tuning:** open-source tool (AWS Step Functions State Machine) that automatically tests different memory configurations and reports the optimal cost/performance setting.

**Lambda layers:** shared dependencies or libraries across multiple functions; reduces package size and centralizes dependency management.

**VPC Lambda:** when Lambda needs access to VPC resources (RDS, ElastiCache), it creates ENIs in your subnets. Adds cold start latency (less significant with Hyperplane ENIs). VPC Lambda without NAT/endpoints cannot reach public internet or AWS APIs.

### API Gateway

API Gateway manages HTTP API front doors with auth, throttling, routing, stages, and integrations.

| Type | Best For | Latency | Features |
|---|---|---|---|
| REST API | Full feature set: API keys, usage plans, request/response transformation | ~10ms overhead | Caching, WAF, custom auth |
| HTTP API | Low-latency, simple proxy | ~5ms overhead | Cheaper, simpler, JWT auth, Lambda/HTTP only |
| WebSocket API | Bidirectional, persistent connections | N/A | Chat, real-time updates |

**API Gateway throttling:**
- Default: 10,000 req/sec burst, 5,000 req/sec steady (account level)
- Per-stage and per-method throttle overrides available
- Throttled requests return 429 Too Many Requests

**Stages and deployments:** APIs are deployed to stages (dev, staging, prod). Use canary deployments to shift a percentage of traffic to a new deployment.

### Step Functions

Step Functions orchestrates workflows using state machines. Use when business logic needs multi-step coordination, retries, waits, branches, and compensating actions.

**Workflow types:**
- **Standard:** long-running (up to 1 year), async, durable state; pay per state transition
- **Express:** high-volume, short-duration (<5 min), pay per duration

**Use cases:** order processing, data pipelines, human approval flows, ETL orchestration, multi-service saga patterns.

### EventBridge

EventBridge routes events using rules. Supports AWS service events, custom events, SaaS integrations (Datadog, Zendesk, etc.), and scheduled events.

| Feature | Description |
|---|---|
| Default event bus | Receives AWS service events |
| Custom event bus | Receives custom application events |
| Event rules | Pattern matching + targets |
| Scheduled rules | Cron and rate expressions |
| Event archive | Replay past events |
| Schema registry | Discovers and maintains event schemas |

Choose EventBridge over SNS when you need event filtering, routing to multiple targets, SaaS integrations, or replay.

### SAM and CDK

- **SAM (Serverless Application Model):** CloudFormation extension with Lambda/API Gateway/DynamoDB shorthand; `sam local` for local testing
- **CDK (Cloud Development Kit):** define AWS infrastructure in Python, TypeScript, Java, etc.; synthesizes to CloudFormation; enables programming constructs for reuse

---

## Advanced Networking

### VPC Peering

Direct networking connection between two VPCs (same or different account/Region). Traffic stays on AWS private network.

**Limitations:**
- No transitive routing: if A peers B and B peers C, A cannot reach C through B
- No overlapping CIDR blocks allowed
- Requires route table entries and security group updates on both sides

### Transit Gateway (TGW)

TGW is a hub-and-spoke cloud router. Connects many VPCs and on-premises networks through a single managed gateway. Eliminates full-mesh VPC peering complexity.

| Feature | VPC Peering | Transit Gateway |
|---|---|---|
| Architecture | Point-to-point | Hub-and-spoke |
| Transitive routing | No | Yes |
| Multi-account | Yes | Yes |
| Cost | No TGW charge; data transfer cost | Per attachment + per GB |
| Complexity | Low for few VPCs | Worth it for 5+ VPCs |

TGW attachments: VPC, VPN, Direct Connect, other TGW (inter-Region peering).

### PrivateLink and VPC Endpoints

VPC endpoints keep traffic between your VPC and AWS services on the private AWS network.

| Type | Services | Mechanism |
|---|---|---|
| Gateway endpoint | S3, DynamoDB | Route table entry; free |
| Interface endpoint | Most AWS APIs (SSM, ECR, CloudWatch, etc.) | ENI in your subnet; hourly + data charges |

**PrivateLink:** mechanism behind interface endpoints. Also allows you to expose your own services to consumers without VPC peering.

**Endpoint policies:** restrict which resources can be accessed through the endpoint. Combine with `aws:SourceVpce` condition in resource policies for defense-in-depth.

### Direct Connect

Dedicated physical network connection from on-premises to AWS.

| Feature | Value |
|---|---|
| Bandwidth | 1 Gbps, 10 Gbps, 100 Gbps |
| Latency | Consistent, predictable |
| Cost | Lower data transfer rate vs internet |
| Encryption | Not encrypted at layer 2; use VPN over DX or application TLS |

**Direct Connect Gateway:** connects one DX to VPCs across multiple Regions without separate DX connections per Region.

**Direct Connect + VPN:** use VPN as a backup path when DX is primary. Provides encrypted, resilient connectivity.

### Site-to-Site VPN

IPSec encrypted tunnels over the public internet between on-premises (Customer Gateway) and AWS (Virtual Private Gateway or Transit Gateway). Lower cost than DX. Good for backup connectivity or lower-bandwidth hybrid workloads.

**VPN tunnel redundancy:** always configure two tunnels (two AWS endpoints) for redundancy.

### Network Firewall

AWS Network Firewall is a managed stateful firewall for VPC traffic inspection and filtering. Supports:
- Stateful rules (Suricata-compatible)
- Domain allow/deny lists
- IDS/IPS inspection
- Deep packet inspection

Deploy at the VPC level, typically in a firewall subnet with traffic steered through it via route tables.

### Route 53 Resolver

- **Inbound endpoints:** on-premises DNS queries can resolve Route 53 private hosted zones
- **Outbound endpoints:** VPC DNS queries forward to on-premises DNS servers via resolver rules
- **DNS Firewall:** block or allow DNS queries by domain pattern to prevent DNS exfiltration

---

## Storage Extras

### Storage Gateway

Connects on-premises environments to AWS storage through three patterns:

| Mode | Protocol | Backed By |
|---|---|---|
| File Gateway | NFS, SMB | S3 |
| Volume Gateway | iSCSI | S3 (cached) or EBS snapshots (stored) |
| Tape Gateway | Virtual tape library (VTL) | S3/Glacier |

### Snow Family

Physical data transfer devices for large data sets when network transfer is too slow or expensive.

| Device | Capacity | Use Case |
|---|---|---|
| Snowcone | 8 TB usable | Edge computing, small transfers |
| Snowball Edge Storage Optimized | 80 TB usable | Large data migration |
| Snowball Edge Compute Optimized | 28 TB usable + GPU | Edge ML, local compute |
| Snowmobile | 100 PB | Exabyte-scale migration |

**Rule:** if uploading data would take more than a week over your internet connection, Snowball may be more practical.

### DataSync

Managed data transfer between on-premises storage and AWS, or between AWS storage services. Faster than open-source tools. Supports NFS, SMB, S3, EFS, FSx. Use for one-time or recurring migrations.

### FSx Family

| Product | Protocol | Use Case |
|---|---|---|
| FSx for Windows File Server | SMB, DFS | Windows apps, home directories, Active Directory integration |
| FSx for Lustre | POSIX Lustre | HPC, ML training, high-performance compute |
| FSx for NetApp ONTAP | NFS, SMB, iSCSI | Enterprise storage requiring NetApp features |
| FSx for OpenZFS | NFS | ZFS-compatible workloads, low-latency filesystems |

FSx for Lustre integrates natively with S3 — can lazy-load from S3 on read and write back results to S3.

### AWS Transfer Family

Managed SFTP, FTPS, FTP, and AS2 endpoints backed by S3 or EFS. Lets existing tools and partners connect via standard file transfer protocols to cloud storage.

---

## Data and Analytics

### Athena

Serverless SQL query service over data in S3. No servers to manage. Pay per query (per TB scanned).

**Performance best practices:**
- Use columnar formats (Parquet, ORC) — reduce data scanned
- Partition data by date, region, or other query dimensions
- Compress data (Snappy, GZIP)
- Use Athena workgroups and query result caching

**Use cases:** ad hoc log analysis, data lake exploration, cost analysis from CUR, security investigation.

### Glue

Managed ETL and data catalog service.

| Component | Purpose |
|---|---|
| Data Catalog | Central metadata repository for tables, schemas, partitions |
| Crawlers | Scan data sources and populate/update the catalog |
| ETL jobs | Spark-based transformation scripts (Python or Scala) |
| Glue Studio | Visual ETL job builder |
| DataBrew | No-code data preparation and profiling |

**Data Catalog is shared with Athena, Redshift Spectrum, and EMR** — one catalog, multiple query engines.

### Redshift

Managed columnar data warehouse for analytical queries at scale.

| Feature | Value |
|---|---|
| Storage | Columnar, compressed |
| Node types | RA3 (separated compute/storage), DC2 (dense compute) |
| Spectrum | Query S3 data from Redshift without loading |
| Serverless | Automatic scaling, pay per query |
| Concurrency scaling | Auto adds capacity for peak query volume |

**Use when:** structured analytical queries, BI dashboards, SQL-based analytics at scale.

### EMR — Elastic MapReduce

Managed big data framework clusters. Supports Spark, Hadoop, Hive, Presto, HBase, Flink.

EMR on EC2 (traditional), EMR on EKS, EMR Serverless. Use for large-scale data transformation, ML preprocessing, and log analytics that don't fit Athena's per-query model.

### OpenSearch (formerly Elasticsearch)

Search and log analytics platform. Supports full-text search, log analytics (via OpenSearch Dashboards), anomaly detection.

**Operational considerations:**
- Shard count affects performance and cluster stability
- JVM heap sizing important; aim for under 50% heap utilization
- Use index lifecycle management (ILM) for log retention
- Not a drop-in replacement for all relational database use cases

### QuickSight

AWS-native BI and visualization service. Integrates with Athena, Redshift, S3, RDS, and other sources. SPICE engine for in-memory fast queries.

### Lake Formation

Centralized governance for data lakes. Simplifies access control for S3-based data lakes — column-level, row-level, and tag-based access control layered on top of S3 and Glue Catalog.

### MSK — Managed Streaming for Kafka

Managed Apache Kafka. Use when workloads depend on Kafka-compatible APIs, consumers, or ecosystem tools. More operational control than Kinesis, more operational complexity too.

**Kinesis vs MSK:**
- Kinesis: AWS-native, simpler, managed sharding, tighter AWS integration
- MSK: Kafka-compatible, open-source ecosystem, more consumer model flexibility

---

## Security

### KMS — Key Management Service

KMS manages encryption keys used by S3, EBS, RDS, Lambda environment variables, Secrets Manager, and many other services. KMS is central — if misconfigured, many services fail simultaneously.

**Key types:**
| Type | Who Manages | Visibility | Use Case |
|---|---|---|---|
| AWS owned | AWS | Not visible to you | Default encryption for many services |
| AWS managed | AWS (per-service) | Visible in account | Service default when you enable encryption |
| Customer managed (CMK) | You control | Full control | Audit, rotation, cross-account, grants |
| Multi-Region keys | You control | Replicated to other Regions | Client-side cross-Region encryption |

**KMS key policy:** every CMK has a key policy that must explicitly allow use. IAM policies alone are insufficient without the key policy granting access. This is a common cause of `AccessDenied` when encryption is added.

**Key rotation:** automatic annual rotation for CMKs. Enables rotation without needing to re-encrypt data — KMS maintains old key material.

**KMS grants:** temporary, specific permissions delegated to a principal. Used by services like S3, EBS, and RDS to use CMKs on your behalf.

### CloudHSM

Dedicated hardware security modules. Use for:
- FIPS 140-2 Level 3 compliance
- Custom cryptographic operations
- Applications that require private key material never leaves your HSM

Most teams should start with KMS; CloudHSM is for strict compliance or custom crypto requirements.

### ACM — AWS Certificate Manager

Issues and manages TLS certificates for ALB, CloudFront, API Gateway, and other supported services. Auto-renewal. Free for certificates used with AWS services.

**ACM Private CA:** issue private certificates for internal services. Useful for mTLS and internal certificate management.

### Secrets Manager vs SSM Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Automatic rotation | Yes (Lambda-based) | No (manual or custom) |
| Cross-Region replication | Yes | No |
| Cost | Per secret per month | Free (standard); cost for advanced |
| Best for | DB credentials, API keys with rotation | Config values, simple secrets |

Both integrate with CloudTrail for audit. Both support KMS encryption. Use Secrets Manager when rotation or cross-Region secret replication is needed.

### WAF — Web Application Firewall

HTTP(S) filtering for CloudFront, ALB, API Gateway, App Runner.

**Rule types:**
- IP allow/block lists
- AWS managed rule groups (common threats, known bad IPs, SQL injection, XSS)
- Rate-based rules (throttle by IP)
- Bot control
- Account takeover protection

**WAF logging:** send to S3, CloudWatch Logs, or Kinesis Firehose for analysis.

### Shield

| Tier | Cost | Protection |
|---|---|---|
| Shield Standard | Free | L3/L4 DDoS protection for all AWS customers |
| Shield Advanced | $3,000/month + usage | L7 DDoS protection, attack visibility, DDoS cost protection, 24/7 DRT access |

Shield Advanced integrates with WAF for L7 protection. DRT (DDoS Response Team) helps during attacks.

### GuardDuty

Threat detection service that analyzes VPC Flow Logs, CloudTrail, DNS logs, and EKS audit logs. Detects:
- Reconnaissance (port scans, credential brute force)
- Unusual API calls or IAM behavior
- Data exfiltration patterns
- Compromised instances calling malicious IPs
- Crypto mining

**No agents required** — GuardDuty is agentless threat detection. Enable in all Regions.

### Inspector

Automated vulnerability management. Scans:
- EC2 instances (OS-level CVEs via SSM agent)
- Lambda functions (package vulnerabilities)
- ECR container images (on push and continuously)

Integrates with Security Hub for centralized findings.

### Macie

Uses ML to discover and protect sensitive data in S3. Identifies PII, financial data, and credentials. Alerts on overly permissive buckets and anomalous access patterns.

### Security Hub

Central security findings aggregator. Collects findings from GuardDuty, Inspector, Macie, Config, Firewall Manager, and third-party tools. Supports automated remediation via EventBridge rules.

### Detective

Analyzes GuardDuty findings, CloudTrail, and VPC Flow Logs to help investigate security incidents. Visualizes entity relationships and behavior over time. Complements GuardDuty (detection) with investigation capabilities.

### Firewall Manager

Centrally manage WAF, Shield Advanced, Security Groups, and Network Firewall policies across accounts in an AWS Organization. Enforces security policies at scale.

---

## Advanced Identity

### Cognito

| Component | Purpose |
|---|---|
| User Pools | User directory: sign-up, sign-in, MFA, JWT tokens |
| Identity Pools (Federated Identities) | Exchange identity tokens for temporary AWS credentials |

**User Pools** handle authentication. **Identity Pools** handle authorization to AWS resources.

Pattern: User Pool authenticates user -> Identity Pool exchanges Cognito token for scoped IAM temporary credentials -> User calls AWS services directly (S3, DynamoDB) with scoped credentials.

### IAM Identity Center (SSO)

Centralized workforce identity federation for multiple AWS accounts and SAML 2.0 applications. Replaces managing separate IAM users per account.

- Integrates with Active Directory, Okta, Azure AD via SAML/SCIM
- Permission sets define access; assigned to accounts and groups
- CLI access via AWS CLI v2 SSO login

### AWS Organizations

Manage multiple accounts under a single Organization. Key features:

| Feature | Purpose |
|---|---|
| Management account | Root of the Organization; holds billing |
| Organizational Units (OUs) | Group accounts by environment, team, or function |
| Service Control Policies (SCPs) | Maximum permission guardrails — do NOT grant permissions |
| Tag policies | Enforce tagging standards |
| AI services opt-out policies | Control AI data collection |
| Delegated administrator | Assign management of specific services to member accounts |

**SCP evaluation:** SCPs limit what IAM policies can do. A valid IAM policy can still be denied if the SCP doesn't allow the action. Explicit allow required at both SCP and IAM level (except for management account).

**Recommended account structure:**
```text
AWS Organization
  Management account (billing only)
  Security OU
    Audit account (CloudTrail, Config aggregator)
    Log archive account
  Infrastructure OU
    Shared network account (Transit Gateway, Direct Connect)
  Workload OUs
    Dev accounts
    Staging accounts
    Production accounts
```

### RAM — Resource Access Manager

Share AWS resources across accounts without VPC peering or duplication. Supports sharing: Transit Gateway, subnets, Route 53 Resolver rules, License Manager, and more.

**Common use:** share a central Transit Gateway or subnets from a shared network account to workload accounts.

### AWS Directory Service

| Option | Description |
|---|---|
| Managed Microsoft AD | Fully managed AD in AWS; supports trusts with on-premises AD |
| AD Connector | Proxy to on-premises AD without caching directory data in AWS |
| Simple AD | Samba-based; for small, simple AD-compatible workloads |

Used for: EC2 domain join, WorkSpaces, RDS SQL Server Windows Auth, SSO with AD.

---

## Monitoring and Observability

### CloudWatch

**Metrics:** numeric time-series, 1-minute granularity (detailed monitoring), namespaced by service.

Key metrics by service:
- **ALB:** `TargetResponseTime`, `HTTPCode_Target_5XX_Count`, `RequestCount`, `HealthyHostCount`
- **EC2:** `CPUUtilization`, `StatusCheckFailed`, `NetworkIn/Out`, `DiskReadOps`
- **RDS:** `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace`, `ReadLatency`, `ReplicaLag`
- **Lambda:** `Errors`, `Duration`, `Throttles`, `ConcurrentExecutions`, `IteratorAge`
- **SQS:** `ApproximateAgeOfOldestMessage`, `ApproximateNumberOfMessagesVisible`

**Embedded Metric Format (EMF):** structured log format that CloudWatch automatically extracts as custom metrics. Enables high-cardinality metrics without PutMetricData API calls.

**CloudWatch Logs:** centralize application and system logs. Use structured JSON. Insights for ad hoc log queries during incidents. Log groups have retention policies (default: indefinite — set retention to control cost).

**CloudWatch Alarms:** alarm on user-impact metrics, not just resource utilization. Good alarms: high 5xx rate, p95 latency above SLO, queue age rising, replica lag, Lambda throttles. Tune thresholds and link to runbooks.

**CloudWatch Dashboards:** cross-Region and cross-account dashboards for unified operational view.

**Contributor Insights:** identify top contributors to high-volume metrics from logs (e.g., top IP addresses, slowest API endpoints).

### CloudTrail

Records all AWS API activity. The audit trail for "who changed what."

| Feature | Value |
|---|---|
| Management events | API calls (default enabled) |
| Data events | S3 object-level operations, Lambda invocations (extra cost) |
| Insights events | Anomalous API call volume detection |
| Multi-Region trail | Single trail covering all Regions |
| CloudTrail Lake | Query CloudTrail events with SQL (no S3 needed) |

**Use CloudTrail for:** IAM incident investigation, change tracking, unauthorized access investigation, EventBridge rules triggered by API calls.

### AWS Config

Records resource configuration history and evaluates compliance rules.

| Feature | Value |
|---|---|
| Configuration recorder | Tracks all resource changes |
| Config rules | Evaluate compliance (AWS managed or custom Lambda-based) |
| Conformance packs | Collections of rules for compliance frameworks (CIS, NIST) |
| Aggregator | Cross-account, cross-Region compliance view |
| Remediation | Auto-remediate via SSM Automation |

**Use Config for:** detecting public S3 buckets, tracking security group drift, encryption compliance, change history for incident investigation.

### X-Ray

Distributed tracing for Lambda, API Gateway, ECS, EKS, and EC2 applications. Provides service maps showing request flow and latency between services.

**Use X-Ray when:** debugging latency spikes, identifying slow downstream calls, understanding microservice interactions.

### AWS Health Dashboard

| Dashboard | Audience |
|---|---|
| AWS Service Health Dashboard | Global; shows AWS-wide service status |
| Personal Health Dashboard | Your account; shows events impacting YOUR resources |

Personal Health Dashboard events should trigger automated runbooks and incident response. Can be forwarded to EventBridge for automated response.

### Separation of Telemetry Concerns

```text
CloudWatch metrics/logs:  What is happening operationally?
CloudTrail:               Who called which AWS API?
AWS Config:               How did resource configuration change?
VPC Flow Logs:            What network flows were accepted or rejected?
EventBridge:              How do we react to events?
X-Ray:                    Where did this request spend time?
```

---

## Disaster Recovery and Migrations

### RPO and RTO

| Term | Meaning |
|---|---|
| RPO (Recovery Point Objective) | How much data loss is acceptable |
| RTO (Recovery Time Objective) | How much downtime is acceptable |

RPO and RTO are business requirements that drive architecture cost.

### DR Strategies

| Strategy | Cost | RTO | RPO | Description |
|---|---|---|---|---|
| Backup and restore | Lowest | Hours-days | Hours-days | Backups to S3/Glacier; restore from scratch |
| Pilot light | Low | 10-60 minutes | Minutes | Core pieces running (DB replication); scale up on failure |
| Warm standby | Medium | Minutes | Seconds-minutes | Scaled-down but functional environment running in DR Region |
| Multi-site active-active | Highest | Near-zero | Near-zero | Both Regions serve traffic; failover is traffic rerouting |

**Operational truth:** a backup that has never been restored is only a hope. A DR design that has never been exercised is a diagram, not a capability.

### Elastic Disaster Recovery (DRS)

Block-level continuous replication to AWS for fast failover from on-premises or other clouds. Lower RPO than traditional backup/restore approaches.

### DMS — Database Migration Service

Migrates databases with minimal downtime. Supports homogeneous (same engine) and heterogeneous (cross-engine) migrations. Continuous replication available for minimum-downtime cutovers.

**Schema Conversion Tool (SCT):** converts schema and stored procedures from one engine to another (e.g., Oracle to Aurora PostgreSQL).

### MGN — Application Migration Service

Lift-and-shift migration. Installs a lightweight agent on source servers, replicates to AWS, and enables cutover. Replaces Server Migration Service (SMS).

### AWS Backup

Centralized backup management across RDS, EBS, EFS, DynamoDB, FSx, EC2, S3, DocumentDB, Neptune.

**Vault Lock (WORM):** prevents backup deletion within the retention period — useful for compliance.

---

## Machine Learning

### SageMaker

Platform for building, training, and deploying ML models.

| Component | Purpose |
|---|---|
| Studio | IDE for ML development |
| Training jobs | Managed training with EC2/GPU instances |
| Processing jobs | Feature engineering, evaluation |
| Endpoints | Real-time inference at scale |
| Batch transform | Offline batch inference |
| Pipelines | ML workflow orchestration |
| Model Monitor | Detect data drift and model quality degradation |
| Canvas | No-code ML for business analysts |

**SRE angle:** SageMaker endpoints need IAM, VPC networking, autoscaling, monitoring, and rollback plans. Treat model endpoints like production services.

### AI/ML Services

| Service | Purpose |
|---|---|
| Rekognition | Image/video analysis: faces, objects, text, content moderation |
| Transcribe | Speech to text |
| Polly | Text to speech |
| Translate | Language translation |
| Lex | Conversational bots (Alexa tech) |
| Comprehend | NLP: sentiment, entities, key phrases, PII detection |
| Textract | Extract text, forms, and tables from scanned documents |
| Kendra | Enterprise search powered by ML |
| Personalize | Recommendation engine |
| Forecast | Time-series forecasting |
| CodeWhisperer | AI coding assistant |
| Bedrock | Foundation models (Claude, Llama, Titan) via managed API |

**SRE framing:** ML systems still need IAM, networking, data privacy, cost controls, latency SLOs, retry behavior, batch vs online inference design, monitoring, and rollback plans. Design ML pipelines asynchronously: accept upload -> emit event -> process async -> store result -> notify.

---

## Well-Architected Framework

The AWS Well-Architected Framework provides a consistent approach to evaluate architectures. For senior interviews, use the pillars as design review questions, not a recitation checklist.

### The Six Pillars

| Pillar | SRE Translation |
|---|---|
| Operational Excellence | Deploy, observe, respond, and improve safely |
| Security | Least privilege, detection, encryption, and isolation |
| Reliability | Recover from failure, test failure modes, and scale |
| Performance Efficiency | Match resources to workload requirements |
| Cost Optimization | Avoid waste, match spend to value, and right-size |
| Sustainability | Minimize environmental impact through efficient design |

### Key Design Questions per Pillar

**Operational Excellence:**
- Can we deploy without manual steps?
- Do we have runbooks for common failure modes?
- Do changes go through code review and automated testing?
- Can we roll back a bad deployment within 5 minutes?

**Security:**
- What is the blast radius if one role is compromised?
- Is all data encrypted at rest and in transit?
- Who can delete production data?
- How quickly would we detect an intruder?

**Reliability:**
- What happens if one AZ fails?
- What is our tested RTO and RPO?
- Do health checks reflect actual readiness?
- Have we chaos-tested key failure modes?

**Performance Efficiency:**
- Are we scaling on the right metric?
- Are we using the right service for the access pattern?
- Are there unused features driving cost without value?

**Cost Optimization:**
- What are the top three cost drivers in this workload?
- Are any resources idle or underutilized?
- Have we analyzed savings plans or reserved capacity?

**Sustainability:**
- Are we using managed services where they reduce idle compute?
- Do we have lifecycle policies to delete what we don't need?
- Are we placing workloads in Regions with better renewable energy?

### Trusted Advisor

Automated best-practice checks across: cost optimization, performance, security, fault tolerance, service limits, and operational excellence. Requires Business or Enterprise Support for full checks.

### Senior Interview Closing Answer

```text
For any AWS design, I explain: the request path end-to-end, the trust boundaries,
the failure domains and what absorbs each failure, the data durability model,
the observability signals (metrics/logs/traces/audit), the scaling controls, 
the cost drivers, and the recovery plan with tested RTOs.
That is stronger than naming services from a diagram.
```
