---
title: "Interview Questions"
sidebar_position: 4
---

# AWS Interview Questions — Staff Engineer and SRE Level

25+ Q&A pairs covering VPC design, IAM, EC2, RDS, EKS, multi-region, cost optimization, and production operations. Each answer is written at the senior level — explaining mechanisms and operational consequences, not just feature names.

---

## VPC and Networking

**Q1: Walk me through what makes a subnet "public" in AWS.**

A subnet is public because its route table has a default route (`0.0.0.0/0`) pointing to an Internet Gateway, and the resources in it have public IP addresses or Elastic IPs. Without both the IGW route and a publicly addressable IP, traffic cannot reach the resource from the internet. A subnet with an IGW route but private-only IPs would have instances that cannot receive inbound internet traffic but could still initiate outbound connections through NAT if another route existed.

The private/public label is a convention about route tables, not a property of the subnet object itself.

---

**Q2: What is the difference between a Security Group and a NACL?**

Security groups are stateful, resource-level allow rules. They attach to ENIs (Elastic Network Interfaces). Because they are stateful, if inbound traffic is allowed, the response traffic is automatically permitted even if there is no explicit outbound rule for the return port.

NACLs are stateless subnet-level controls. They apply to all traffic entering and leaving a subnet. Because they are stateless, you must explicitly allow both the request and the response — including ephemeral return ports (typically 1024–65535). NACLs also evaluate rules in numbered order, and the first match wins.

In practice: Security Groups are the primary tool for application-level traffic control. NACLs are a coarse guardrail — use them to deny specific CIDRs or as a second layer of defense, not as a replacement for security groups.

---

**Q3: You are designing a multi-tier application. How do you structure VPC subnets?**

I use a three-tier subnet model:

```text
Public subnets (2+ AZs): ALB, NAT Gateways only
Private app subnets (2+ AZs): ECS/EKS workloads, EC2 app tier
Private data subnets (2+ AZs): RDS, ElastiCache, internal services
```

No workload gets a public IP. The ALB is the only public-facing entry point. NAT Gateways sit in public subnets so private app instances can initiate outbound connections. VPC gateway endpoints for S3 and DynamoDB prevent S3/DynamoDB traffic from hitting NAT (cost and security improvement). Interface endpoints for other AWS services reduce NAT traffic further.

Each tier has its own security group that only allows traffic from the tier above it.

---

**Q4: What is Transit Gateway and when would you use it instead of VPC peering?**

Transit Gateway is a managed cloud router that connects VPCs and on-premises networks through a hub-and-spoke topology. VPC peering is a direct peer connection between two VPCs with no transitive routing — if A peers with B and B peers with C, A still cannot reach C through B.

I use VPC peering for simple two-VPC connectivity (e.g., a shared services VPC and one workload VPC). I use Transit Gateway when:
- Three or more VPCs need to communicate
- On-premises needs to reach multiple VPCs
- I need centralized egress through a firewall VPC
- I need cross-Region connectivity via TGW peering

Transit Gateway scales linearly in complexity — adding a new VPC is one attachment plus route entries, not N new peering connections.

---

**Q5: What is PrivateLink and how does it differ from VPC peering?**

PrivateLink creates one-directional private connectivity from a consumer VPC to a specific service endpoint in a producer VPC. The consumer creates an Interface VPC Endpoint (an ENI in their subnet). Traffic stays on the AWS network, never touching the internet.

Differences from VPC peering:
- Peering is bidirectional; PrivateLink is one-directional (consumer to producer)
- PrivateLink does not expose the full producer VPC network — only the specific service behind the NLB
- PrivateLink works across overlapping CIDR ranges; VPC peering does not
- PrivateLink supports multi-account and multi-tenant use cases cleanly

Use PrivateLink when you want to expose a service to other VPCs/accounts without full network-level access.

---

## IAM and Security

**Q6: Explain the IAM policy evaluation order when a request results in AccessDenied.**

AWS evaluates a request through this chain:
1. Organization SCP — if the action is denied at the SCP level, result is deny regardless of everything else
2. Resource-based policy (if present) — cross-account access requires this
3. Permissions boundary on the principal — caps what the identity policy can grant
4. Session policy (if using AssumeRole with session policy) — further restricts the session
5. Identity policy (IAM policy attached to user or role) — what the principal is allowed to do
6. An explicit deny anywhere wins over any allow

A common production case: an ECS task has a valid identity policy allowing S3 writes, but the S3 object uses SSE-KMS encryption and the task role lacks `kms:GenerateDataKey`. The error appears as an S3 failure, but the root cause is the KMS key policy.

Debugging: `aws sts get-caller-identity` to confirm the runtime principal, CloudTrail to find the exact failed API call, then evaluate each layer of the chain.

---

**Q7: What is an IAM permission boundary and when would you use it?**

A permission boundary is a policy that sets the maximum permissions a role or user can have, regardless of what their identity policy grants. It does not grant permissions — it only caps them.

Use case: you want to allow developers to create IAM roles for their applications (so they can manage their own service accounts), but you do not want those application roles to have more permissions than the developers themselves. You attach a permission boundary to the developer's IAM policy that restricts what roles they can create.

For example:
```json
// Developer policy: can create roles AND attach permission boundary
"iam:CreateRole", "iam:AttachRolePolicy",
// But only if the permission boundary is applied
"Condition": {"StringEquals": {"iam:PermissionsBoundary": "arn:aws:iam::123456789:policy/DeveloperBoundary"}}
```

---

**Q8: What is IRSA (IAM Roles for Service Accounts) in EKS and why is it preferred over node instance profiles?**

IRSA allows individual Kubernetes pods to assume specific IAM roles via OIDC federation. Each pod gets AWS credentials scoped to its own role — not the node's instance profile.

Node instance profiles are too broad: every pod on the node shares the same AWS credentials. If one pod is compromised, it has the same AWS access as every other pod on that node.

With IRSA:
1. EKS cluster has an OIDC provider URL
2. IAM role trust policy specifies the Kubernetes service account (`system:serviceaccount:namespace:serviceaccountname`)
3. Pod's service account is annotated with the IAM role ARN
4. Pod receives projected OIDC token that STS exchanges for temporary credentials

This follows least-privilege at the pod level. A database migration job can have write access to the database schema and nothing else.

---

## EC2 and Compute

**Q9: What are EC2 placement groups and when do you use each type?**

Placement groups control where EC2 instances are physically placed:

**Cluster placement group**: packs instances close together on the same underlying hardware rack. Provides the lowest latency and highest network throughput (up to 100 Gbps). Use for HPC, MPI workloads, or distributed systems that need high-bandwidth low-latency between nodes. Risk: correlated failure — all instances on the same rack.

**Spread placement group**: places each instance on distinct underlying hardware in different racks. Maximum 7 instances per AZ per group. Use for small fleets of critical instances that must never fail together (Zookeeper quorum, Kafka brokers).

**Partition placement group**: divides instances into logical partitions on separate racks. Up to 7 partitions per AZ, hundreds of instances per partition. Use for large distributed systems like Cassandra, HDFS, Kafka where you want failure isolation between logical groups (racks).

---

**Q10: You need to run a stateful application on EC2 that must survive instance failure. How do you design storage?**

Use EBS volumes — not instance store. EBS is network-attached, persistent, and survives instance stop/start. If the instance fails, detach the EBS volume and reattach it to a replacement instance.

For the recovery pattern:
1. EBS volume is the stateful component
2. Launch a new instance from the same AMI
3. Attach the EBS volume
4. The application reads from the volume and continues

Additional protections:
- Enable Delete on Termination = false for data volumes (true for root volume is okay)
- Take regular EBS snapshots to S3 for backup
- Use `gp3` for general workloads — decouples IOPS/throughput from size

For distributed stateful applications (e.g., Elasticsearch, Kafka), use multiple nodes across AZs with data replication between them so no single EBS volume is a single point of failure.

---

## RDS and Databases

**Q11: What is the difference between RDS Multi-AZ and a Read Replica?**

Multi-AZ is for availability. It maintains a synchronous standby replica in a second AZ. On primary failure, AWS automatically promotes the standby and updates the DNS endpoint. The standby does not serve reads. Failover takes 1–2 minutes.

Read Replica is for scalability. It maintains an asynchronous copy of the primary that can serve read traffic. Replication is asynchronous — replicas can lag. Read replicas can be in the same or different Region. They can be promoted to standalone databases (useful for DR and migrations).

They serve different problems:
- Multi-AZ → survive primary failure without data loss
- Read Replica → offload read traffic from the primary, support cross-Region reads

You can (and often should) use both simultaneously: Multi-AZ primary for HA, read replicas for read scaling.

---

**Q12: How would you handle a connection storm hitting RDS after an autoscaling event?**

A connection storm happens when a fleet of instances scales rapidly and each instance opens many connections simultaneously, exhausting `max_connections` on RDS.

Solutions, in order of preference:
1. **RDS Proxy**: managed connection pooler that sits between the application tier and RDS. It maintains a persistent connection pool to the DB and multiplexes application connections. The application sees many connections; the DB sees a controlled pool.
2. **Application-level connection pooling**: configure PgBouncer (PostgreSQL) or ProxySQL (MySQL) as a sidecar or shared service
3. **Reduce `max_connections` per application instance**: configure your ORM or DB driver to use fewer connections per instance
4. **Tune `max_connections` parameter**: increase DB `max_connections`, but this increases memory consumption and can destabilize the DB under load

RDS Proxy is the AWS-native answer for Lambda and EKS workloads that cannot predict connection count.

---

**Q13: When would you choose Aurora over RDS, and when would you stick with RDS?**

Choose Aurora when:
- You need faster failover (Aurora typically fails over in under 30 seconds vs 1–2 min for RDS)
- You need to scale reads with multiple Aurora Replicas (up to 15) with minimal lag
- You want Aurora Serverless v2 for unpredictable or variable workloads
- You want Aurora Global Database for cross-Region replication with low RPO
- You are building a new MySQL/PostgreSQL app and can accept the Aurora-specific operational model

Stick with RDS when:
- You need a specific database engine version not supported by Aurora
- You are migrating an existing self-managed database and need exact compatibility
- Cost is a primary constraint — Aurora is more expensive than equivalent RDS instances
- You have Oracle or SQL Server licensing requirements

Both require the same application discipline: good schema, indexes, connection management, and failover-aware pooling.

---

## EKS vs ECS and Containers

**Q14: When do you choose EKS over ECS?**

Choose EKS when:
- The organization uses Kubernetes elsewhere and wants consistent tooling (GitOps, CRDs, operators)
- You need Kubernetes-native features: Custom Resource Definitions, admission webhooks, Kubernetes network policies
- You need ecosystem tools that only work with Kubernetes (Argo, Crossplane, Istio)
- Multi-cloud portability is a requirement (same Kubernetes manifests can run on GKE, AKS)

Choose ECS when:
- You want simpler AWS-native container orchestration without Kubernetes complexity
- The team does not have Kubernetes expertise and does not need it
- Fargate is the primary compute model (ECS Fargate is operationally simpler)
- You are migrating an existing application and ECS fits the architecture

Staff engineer framing: EKS is not universally better — it adds networking complexity (VPC CNI, IRSA, add-on management), upgrade overhead, and team knowledge requirements. ECS is often the right choice for smaller teams or simpler services.

---

**Q15: Explain the ECS task role vs execution role distinction.**

This is a critical distinction and a common production failure.

**Execution role**: used by the ECS agent and Fargate runtime to manage the task lifecycle. Actions include: pulling the container image from ECR, creating CloudWatch log groups, writing task logs, fetching secrets from Secrets Manager/SSM.

**Task role**: used by the application code running inside the container to call AWS APIs. Actions include: writing to S3, reading from DynamoDB, publishing to SQS, calling other AWS services.

Common failure: a developer grants S3 permissions to the execution role instead of the task role. The container starts fine (execution role works for startup), but the application gets `AccessDenied` when trying to write to S3.

Design habit: give execution roles only what ECS needs (ECR pull, CloudWatch logs, Secrets Manager decryption). Give task roles only what the application code needs.

---

## Multi-Region and Availability

**Q16: Design a Route 53 setup for active-passive multi-region failover.**

```text
Primary Record:
  api.example.com -> Failover = PRIMARY
  Alias to ALB in us-east-1
  Health check: HTTPS /healthz every 10s
  Evaluate target health = Yes

Secondary Record:
  api.example.com -> Failover = SECONDARY
  Alias to ALB in eu-west-1
  (no health check required on secondary — only used when primary fails)
```

When the primary health check fails (e.g., ALB health check returns unhealthy for 3 consecutive checks), Route 53 stops returning the primary record and returns the secondary.

Caveats:
- DNS failover is not instant — depends on TTL and resolver caching
- Set TTL to 60 seconds or lower for records that need fast failover
- Health check must check actual application health, not just TCP connectivity

For more sophisticated routing, use Route 53 Application Recovery Controller (ARC) for readiness checks that validate the full stack before routing traffic.

---

**Q17: What is the difference between RTO and RPO, and how do different AWS DR patterns map to them?**

RPO (Recovery Point Objective) = maximum acceptable data loss. If your RPO is 5 minutes, you can lose at most 5 minutes of data.

RTO (Recovery Time Objective) = maximum acceptable downtime. If your RTO is 30 minutes, service must resume within 30 minutes of failure.

| AWS DR Pattern | Typical RTO | Typical RPO | How |
|---|---|---|---|
| Backup & Restore | Hours | Hours | S3 backups, RDS snapshots — restore from scratch |
| Pilot Light | 10–30 min | Minutes | Core DB replicated, app infra off — scale up on failover |
| Warm Standby | Minutes | Seconds | Scaled-down prod running in DR region — scale up + switch |
| Multi-Region Active-Active | Near-zero | Near-zero | Route 53 multi-region, DynamoDB Global Tables, Aurora Global |

Business drives the requirement. Technical design enables it. The engineer's job is to build what the business actually needs — not the most expensive option.

---

## Cost Optimization

**Q18: Your AWS bill jumped 40% this month. How do you investigate?**

1. Open AWS Cost Explorer. Switch to daily view. Find which day the spike started.
2. Break down by service. Which service shows the increase?
3. For the top offender, break down by Usage Type. Common culprits:
   - `DataTransfer-Out-Bytes`: internet egress spike
   - `DataProcessing-Bytes`: NAT Gateway traffic spike
   - `TimedStorage-ByteHrs`: S3 storage growth (check if versions accumulating)
   - `BoxUsage`: EC2 instance hours (check if ASG scaled and did not scale back)
4. Use Cost Anomaly Detection for proactive alerting on future spikes
5. Check CloudWatch metrics for NAT Gateway bytes processed — compare before/after spike

Root causes I look for:
- New deployment that routes S3/ECR/API traffic through NAT (fix: add VPC endpoints)
- Missing S3 lifecycle policy accumulating old versions
- ASG that scaled out but cooldown prevented scale-in
- CloudWatch Logs verbose mode left on in production

---

**Q19: What is the difference between Reserved Instances and Savings Plans?**

**Reserved Instances** are a commitment to use a specific instance type in a specific Region (Standard RI) or instance family in a Region (Convertible RI). Standard RIs offer the deepest discount but are inflexible. You can sell unused Standard RIs on the Reserved Instance Marketplace.

**Savings Plans** are a commitment to spend a minimum dollar amount per hour on compute (Compute Savings Plan) or on specific EC2 families in specific Regions (EC2 Instance Savings Plans). Compute Savings Plans apply automatically to any EC2 instance, Fargate, or Lambda usage without specifying instance type.

For most organizations: use Compute Savings Plans. They are simpler to manage and automatically cover workload changes (if you switch from `m5` to `m6i`, the plan still applies).

---

## Operations and Debugging

**Q20: ALB is showing 502 errors. What is your debugging flow?**

502 Bad Gateway from ALB means the ALB reached the target but received an invalid response.

Debugging flow:
1. Check ALB CloudWatch metric `HTTPCode_ELB_5XX_Count` vs `HTTPCode_Target_5XX_Count`
   - If `ELB_5XX` without `Target_5XX` → ALB itself cannot reach targets (check SGs, NACLs, target health)
   - If `Target_5XX` → application is returning 5xx (check app logs)
2. Check ALB target health. In the console: Target Groups → Targets → Health Status
3. Read health check failure reason codes
4. If targets are healthy but still 502: application is accepting the connection but returning an invalid HTTP response (check app error logs, check timeouts in the application)
5. If targets are unhealthy: check EC2/ECS/EKS process is running, listening on the correct port, security group from ALB to target is open, NACL return traffic is allowed

---

**Q21: An EKS node is not joining the cluster after launch. How do you investigate?**

Nodes fail to join for several common reasons:

1. **IAM instance profile missing or wrong**: the node needs `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, and `AmazonEC2ContainerRegistryReadOnly`
2. **Security group blocks API server**: node must reach the EKS control plane on port 443 and 10250
3. **Subnet routing issues**: node needs outbound internet (or VPC endpoints for: ECR, S3, EC2, STS, EKS) to bootstrap
4. **aws-auth ConfigMap not updated** (legacy): node's IAM role is not mapped to `system:bootstrappers` group
5. **Kubernetes version mismatch**: node kubelet version is incompatible with control plane version (kubelet can be ±1 minor version from control plane)

Debugging:
```bash
# Check bootstrap logs on the node
sudo cat /var/log/cloud-init-output.log
sudo journalctl -u kubelet --no-pager -n 100

# Check if node appears in cluster at all
kubectl get nodes --watch

# Check CloudTrail for STS/EC2 IAM failures
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventSource,AttributeValue=sts.amazonaws.com
```

---

**Q22: RDS failover happened but your application is still returning database errors 10 minutes later. Why?**

The most common cause: connection pool holds stale connections to the old primary IP.

When RDS Multi-AZ failover happens:
1. AWS promotes the standby to primary
2. The RDS DNS endpoint (`mydb.cluster.us-east-1.rds.amazonaws.com`) is updated to point to the new primary
3. But the DNS change takes ~30–60 seconds to propagate
4. Connection pools that cached the IP or did not reconnect continue sending queries to the old primary (which is now offline)

Fixes:
- Configure DB driver with `connect_timeout` and aggressive `socket_timeout`
- Enable connection validation in your pool (test connection before using it)
- Use RDS Proxy — it handles the failover transparently and reconnects automatically
- Set `TCP_KEEPALIVE` to detect dead connections faster
- Explicitly handle `OperationalError` / connection errors with retry logic

---

**Q23: Your ECS tasks are failing to pull the container image from ECR. What do you check?**

1. **Execution role ECR permissions**: the task execution role needs `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`
2. **Network path**: ECS task must reach ECR endpoints. If the task is in a private subnet:
   - Either a NAT Gateway provides outbound internet
   - Or Interface VPC Endpoints for ECR (`com.amazonaws.region.ecr.api` and `com.amazonaws.region.ecr.dkr`) and S3 (for image layer storage)
3. **Image URI correctness**: confirm registry URI, image name, and tag match what is in the task definition
4. **ECR lifecycle policy**: if the image was deleted by a lifecycle policy before the pull
5. **Cross-account access**: if the ECR registry is in a different account, the repository policy must allow the consuming account's execution role

---

## Architecture Trade-offs

**Q24: CloudFront or Global Accelerator — when do you choose each?**

**CloudFront**: HTTP caching and edge content delivery. Use when:
- Serving static assets (JS, CSS, images, video) that benefit from edge caching
- Integrating WAF at the edge before traffic reaches your origin
- Serving APIs where many requests are cacheable
- Content can tolerate TTL-based staleness

**Global Accelerator**: static anycast IPs and routing optimization over the AWS backbone. Use when:
- You need stable static IP addresses for allowlisting (CloudFront IPs change)
- You serve non-HTTP protocols (TCP, UDP — gaming, IoT, custom protocols)
- You want fast regional failover with consistent IPs
- Responses are not cacheable (real-time trading, custom TCP apps)

These can be used together: CloudFront in front of Global Accelerator for content that needs both caching and stable entry IPs.

---

**Q25: How would you design a multi-region active-active architecture for a write-heavy workload?**

This is a distributed systems problem, not just an AWS configuration problem. The core challenge: writes in two regions must not conflict, and both regions must serve consistent reads.

Approach options:

**Option 1 — Regional write isolation**: each region owns a partition of the data (e.g., by customer ID shard). Route 53 geolocation routes each customer to their home region. No cross-region write conflicts because data is sharded. Cross-region reads for non-home-region access.

**Option 2 — DynamoDB Global Tables**: active-active replication with eventual consistency. Each region can accept writes. Conflicts resolved using "last writer wins" with vector clocks. Works well for use cases that tolerate eventual consistency (e.g., user preferences, shopping carts).

**Option 3 — Aurora Global Database**: single writer region, reader endpoints in other regions. Not truly active-active for writes but provides extremely fast cross-region read access (typically under 1s replication lag). Failover to a secondary region promotes it to writer.

Staff engineer framing: "active-active" often means different things to different people. I clarify: do writes need to succeed in all regions simultaneously? If yes, we need conflict resolution. If reads from any region and writes to one primary is acceptable (Aurora Global style), that is simpler and more consistent.
