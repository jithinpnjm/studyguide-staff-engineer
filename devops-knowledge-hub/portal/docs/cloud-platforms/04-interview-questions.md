---
title: "Interview Questions"
sidebar_position: 4
---

# Cloud Platforms — Interview Questions

Strong cloud interview answers do not only name services. They explain tradeoffs, failure domains, cost, reliability, and operational ownership.

---

## Deep-Dive Technical Questions With Full Answers

### Walk me through how a request from the internet reaches a private EC2 instance running a web app

Full answer with each hop:

```text
1. User browser initiates HTTPS to api.example.com

2. DNS resolution:
   - Browser queries Route 53 for api.example.com
   - Route 53 returns an ALB DNS name (or alias A record pointing to the ALB)
   - ALB DNS resolves to two or more public IPs (one per AZ)

3. TCP + TLS to ALB:
   - Client connects to ALB public IP on port 443
   - ALB is in a public subnet (route table has 0.0.0.0/0 -> IGW)
   - ALB security group must allow inbound 443 from 0.0.0.0/0
   - TLS terminates at the ALB (ACM certificate)

4. ALB evaluates listener rules:
   - Listener on port 443 checks rules (host-based, path-based)
   - Selects the matching target group

5. ALB forwards to target:
   - Target group has EC2 instances (or ECS tasks, EKS pods) in private subnets
   - ALB performs health check on the target before sending traffic
   - Packet sent from ALB ENI to app instance ENI

6. App security group evaluation:
   - App SG must allow inbound on the app port (e.g., 8080) from the ALB SG
   - The source in the SG rule references the ALB security group ID, not a CIDR

7. EC2 instance processes the request:
   - App listens on port 8080
   - App reads from database in the database subnet

8. Database access:
   - App connects to RDS endpoint (which resolves to a private IP in the DB subnet)
   - DB SG allows port 5432/3306 from the App SG
   - DB subnet has no internet route

9. Response travels back:
   - DB -> App (private subnet) -> ALB (public subnet, stateful SG returns automatically)
   - ALB -> Client (TLS encrypted response)
```

Key debugging: if any hop blocks, start from DNS and work inward. "Security group is open" is not enough — check which source the rule allows.

---

### What is the difference between an IAM role and an IAM user? When do you use each?

IAM user: a long-lived identity with a username and password (and optional access keys). It represents a specific human or application. Access keys tied to users age badly — they get copied into laptops, scripts, and forgotten CI jobs.

IAM role: an assumable identity. It does not have static credentials. A principal (user, EC2, Lambda, EKS pod) assumes the role and receives temporary credentials (valid 15 minutes to 12 hours) via AWS STS.

Use IAM users for:
- Rarely. Break-glass accounts that need console login. Emergency access.
- External tooling that cannot use role federation (legacy case).

Use IAM roles for:
- EC2 instances (instance profiles)
- Lambda functions (execution role)
- ECS tasks (task role)
- EKS pods (IRSA / Pod Identity)
- CI/CD systems (assume role via OIDC federation)
- Cross-account access
- Human access via IAM Identity Center (SSO)

Staff-level answer addition: "I avoid IAM users for all workloads and most human access. Long-lived credentials create uncontrolled blast radius — they are copied, leaked, and left in place. For humans, I use IAM Identity Center with permission sets so access is federated through SSO, audited, and can be revoked centrally. For workloads, I use roles because they issue short-lived STS credentials that expire automatically."

---

### How does IRSA work? (Full answer with trust policy, annotation, and token projection)

IRSA (IAM Roles for Service Accounts) allows EKS pods to assume AWS IAM roles without static credentials.

The mechanism:

1. EKS cluster exposes an OIDC endpoint (a URL like `https://oidc.eks.us-east-1.amazonaws.com/id/XXXX`)
2. AWS IAM trusts this OIDC endpoint as an identity provider
3. When a pod starts, the EKS token controller mounts a projected service account token at `/var/run/secrets/eks.amazonaws.com/serviceaccount/token`
4. The AWS SDK reads this token and calls `sts:AssumeRoleWithWebIdentity`
5. STS validates the OIDC token against the registered provider
6. STS returns temporary credentials (access key, secret key, session token)
7. The pod uses these credentials for AWS API calls

Trust policy on the IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLXXXXXXX"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLXXXXXXX:sub":
          "system:serviceaccount:production:my-serviceaccount",
        "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLXXXXXXX:aud":
          "sts.amazonaws.com"
      }
    }
  }]
}
```

ServiceAccount annotation:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-serviceaccount
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/my-pod-role
```

Common failure: the `sub` claim in the trust policy condition must match `system:serviceaccount:<namespace>:<serviceaccount-name>` exactly. A namespace typo causes an STS assume-role failure visible in CloudTrail as `AssumeRoleWithWebIdentity` with `AccessDenied`.

---

### Security Group vs NACL — explain with example

Security Group (SG):
- Attached to an ENI (elastic network interface), not to a subnet
- Stateful: if you allow inbound traffic, the response is automatically allowed
- Allow rules only — no explicit deny rules
- All rules evaluated: if any rule matches, traffic is allowed

NACL:
- Attached to a subnet
- Stateless: both inbound and outbound rules must explicitly allow traffic, including return traffic
- Supports both allow and deny rules
- Rules evaluated in number order; first match wins

Real example — the NACL stateless trap:

```text
Scenario: Lambda in subnet A calls RDS in subnet B on port 5432.

NACL on subnet B (database subnet):
  Inbound rule 100:  ALLOW TCP 10.0.0.0/8 port 5432  <- Lambda can connect
  Outbound rule 100: ALLOW TCP 10.0.0.0/8 port 443   <- WRONG: missing ephemeral ports

What happens:
  Lambda source port is ephemeral (e.g., 49152)
  RDS sends response back to Lambda's ephemeral port
  NACL outbound rule only allows port 443
  Response packet is BLOCKED by NACL
  Lambda sees a timeout even though the SG allows the traffic

Fix:
  Outbound rule 90: ALLOW TCP 10.0.0.0/8 ports 1024-65535
```

When to use each:
- Security Groups: primary control, always. References to other SGs are robust to subnet changes.
- NACLs: coarse guardrails — e.g., blocking a known malicious CIDR range at the subnet level, or adding a deny rule that must override all SG allows.

---

### Design a multi-account AWS org for a fintech with 10 teams

Clarifying questions first: What is the compliance scope (PCI-DSS, SOC 2)? Do all teams need prod isolation? What is the deployment model (Terraform, Control Tower)?

Assuming: PCI scope for payment services, SOC 2 for all environments, 10 product teams.

Account structure:

```text
Root (Management account — billing, org SCPs only)
  OU: Security
    Log Archive account      <- CloudTrail, Config, VPC Flow Logs (tamper-resistant)
    Audit / SIEM account     <- Security Hub aggregation, GuardDuty delegated admin
  OU: Infrastructure
    Network Hub account      <- Transit Gateway, AWS Firewall, centralized NAT
    Shared Services account  <- ECR, CI/CD platform, shared monitoring
    Identity account         <- IAM Identity Center, SSO
  OU: PCI
    PCI-Prod account         <- Payment service only; STRICT SCPs; dedicated auditor access
    PCI-Staging account
  OU: Workloads-Prod
    Team 1 Production account
    ...
    Team 10 Production account
  OU: Workloads-NonProd
    Team 1 Dev/Staging account (or one per team if cost allows)
  OU: Sandbox
    Individual engineer sandboxes (auto-expire, cost cap SCP)
```

SCPs at each level:
- Root: deny disabling CloudTrail, deny disabling GuardDuty, deny creating IAM users
- Security OU: deny modifications to log archive by anyone except security automation
- PCI OU: deny deployment from outside the approved CI pipeline role, restrict regions to one
- Workloads-Prod OU: deny IAM user creation, require approved AMI launch, deny EC2 public IPs

Account vending: new accounts created through Control Tower Account Factory using Terraform-driven automation. Each new account gets standard baseline (cloudtrail, config, guardduty, securityhub, budget alert) applied automatically.

Cross-account access: engineers use IAM Identity Center. A developer gets a `Developer` permission set in their team's non-prod account. A senior engineer gets `ReadOnly` in production plus `Operator` in staging. No IAM users anywhere.

---

### How do you prevent AWS costs from spiraling?

Specific tools and strategies:

1. Cost Anomaly Detection: automated alerts when a service's cost exceeds expected range
2. Budgets: per-account, per-service, per-tag budget with alert at 80% and 100%
3. Cost Explorer: weekly review of top cost drivers by service and usage type
4. Cost and Usage Report (CUR): export to S3 and query with Athena for detailed analysis
5. Compute Optimizer: identifies over-provisioned EC2 and Lambda
6. Trusted Advisor: flags idle resources, unattached EIPs, underused Reserved Instances

Architectural controls:
- VPC endpoints for S3 and ECR to avoid NAT Gateway charges on high-volume traffic
- One NAT Gateway per AZ (not a shared one — but also not cross-AZ traffic)
- S3 lifecycle policies on all buckets with log data
- Reserved Instances or Compute Savings Plans for stable baseline
- Karpenter or Spot for non-critical EKS workloads
- Required tagging enforced by SCP or Config rule

Tag-based showback: every resource must have `Team`, `Environment`, `Service` tags. Cost allocation tags activated in billing. Monthly report sent to each team lead showing their spend.

---

### A region went down — what happens to your app?

Answer depends on which DR tier the system is designed for:

Backup and restore tier:
- Primary region goes down
- Team restores RDS snapshot in secondary region (1-4 hours)
- Redeploys app stack from Terraform (30-60 min)
- Updates Route 53 to point to secondary ALB
- RTO: 2-6 hours, RPO: last backup interval (e.g., 5 minutes with point-in-time recovery)

Pilot light tier:
- Minimal secondary stack already deployed (just RDS replica + a dormant ASG)
- On failover: scale up ASG in secondary region, promote RDS replica, update Route 53
- RTO: 10-30 minutes, RPO: seconds (synchronous replication lag)

Warm standby tier:
- Reduced-scale secondary already serving real traffic or being health-checked
- ASG at minimum size, fully configured, just smaller
- On failover: increase desired capacity in ASG, Route 53 failover routing activates
- RTO: 2-5 minutes, RPO: seconds

Active-active tier (multi-region):
- Route 53 latency routing already directing some traffic to both regions
- DynamoDB Global Tables replicate in near-real-time
- On regional failure: Route 53 health checks detect unhealthy region, stop routing to it
- RTO: seconds to 1 minute (DNS TTL), RPO: near-zero for DynamoDB, seconds for cached data
- Complexity: write conflicts in active-active writes must be designed for

The real staff-level answer: "My first action is not to panic-failover. I confirm the scope: is it a full regional outage, or one AZ, or a specific service? I check the AWS Service Health Dashboard. If it is a true regional outage and my RTO requires it, I execute the tested runbook. If the RTO allows waiting, I often wait for AWS to recover because failover adds its own risks — especially if data replication has not been tested."

---

### How is GCP IAM different from AWS IAM?

| Aspect | AWS IAM | GCP IAM |
|---|---|---|
| Model | Policy documents attached to identities or resources | Bindings: member + role + resource |
| Policy evaluation | Explicit deny wins; allow required | No implicit deny at resource level; inheritance from parent |
| Groups | IAM Groups | Cloud Identity groups (Google Workspace) |
| Service account | IAM roles for EC2/Lambda/EKS | GCP service accounts are principals, not just roles |
| Cross-account/project | Cross-account assume-role with trust policy | IAM binding at project/folder level; Workload Identity for K8s |
| Org-level guardrails | Service Control Policies (SCP) on OUs | Organization Policy Constraints at org/folder/project |
| Workload identity | IRSA (EKS) or EC2 instance profile | Workload Identity binding (GKE) or metadata server |
| Conditions | Condition keys in policy statements | IAM Conditions on bindings (resource type, tags) |
| User federation | IAM Identity Center / SAML | Cloud Identity / Google Workspace |

Key operational difference: in GCP, a service account is both a resource (you can grant IAM roles on it) and a principal (you can grant it access to other resources). In AWS, an IAM role is what you assume — not something that gets granted access as a principal in the same way.

---

### What is Workload Identity in GCP/Azure?

GCP Workload Identity:
- Binds a Kubernetes service account (KSA) to a GCP IAM service account (GSA)
- Pods running with the KSA can call GCP APIs as the GSA — no key files
- GKE metadata server intercepts credential requests and federates them

```bash
# Create the GCP service account
gcloud iam service-accounts create my-app-sa

# Grant GSA access to a resource
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:my-app-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Allow the KSA to impersonate the GSA
gcloud iam service-accounts add-iam-policy-binding my-app-sa@my-project.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:my-project.svc.id.goog[my-namespace/my-ksa]"

# Annotate the KSA
kubectl annotate serviceaccount my-ksa \
  -n my-namespace \
  iam.gke.io/gcp-service-account=my-app-sa@my-project.iam.gserviceaccount.com
```

Azure Workload Identity:
- Pods get a projected federated token validated by Azure AD
- Pod can call Azure APIs as a Managed Identity without static credentials
- Similar concept to IRSA; implemented via OIDC federation between AKS and Azure AD

Both patterns achieve the same goal: eliminate long-lived cloud credentials from pods. The implementation differs (OIDC federation vs GKE metadata server), but the security principle is identical.

---

### Mock Interview Q10: Security action causes reliability incident — describe the causal chain

Scenario from production experience:

A security scan flagged a long-lived AWS access key that had been accidentally committed to a Git repository six weeks earlier. The correct action was to revoke the key immediately.

Timeline:
- 14:00 UTC: Security team revokes the access key via `aws iam delete-access-key`
- 14:04 UTC: 40% of production pods begin failing with `UnauthorizedError` accessing S3
- 14:05 UTC: PagerDuty fires — `s3_upload_errors_high`
- 14:08 UTC: On-call engineer checks app logs; sees `AWS SDK: InvalidClientTokenId`
- 14:10 UTC: Engineer checks AWS console for access key; key is deleted
- 14:12 UTC: Root cause identified: the revoked key was in a Kubernetes Secret distributed across three production clusters as a legacy deployment (not yet migrated to IRSA)
- 14:22 UTC: New temporary key created and pushed to all clusters via `kubectl patch secret`
- 14:26 UTC: Errors clear; incident resolved (22 minutes of partial outage)

Root cause: security team had no inventory of which services used the rotated credential. Blast-radius check was skipped.

Systemic fix:
1. Credential inventory: every AWS credential in the system must be registered with its consuming services in a CMDB or secrets management tool
2. IRSA migration plan: all remaining access-key-based workloads migrated to IRSA within 90 days
3. Rotation runbook: before revoking any credential, blast-radius check is required (grep secrets across clusters, check IAM last-used report)
4. Automated scanning: `aws iam get-access-key-last-used` in a nightly job to flag credentials not used in 30 days

---

### How do you choose between AWS, GCP, and Azure? (Staff-level criteria)

This is a decision framework question, not a preference question.

Criteria:

1. Existing team expertise: the fastest path to production reliability is the platform the team already knows deeply. Switching cloud requires re-learning networking, IAM, managed services, and incident tooling.

2. Existing commercial relationships: some organizations have EDPs (Enterprise Discount Programs) or MSPs that make one cloud significantly cheaper. A 20-30% discount is a strong factor.

3. Regulatory compliance and data residency: some compliance frameworks (e.g., FedRAMP, IL-5) have more AWS-certified services. EU data residency may favor GCP's EU-only configurations.

4. Services unique to one cloud: BigQuery ML and Vertex AI are strongest on GCP. Azure AD/Entra integration is strongest on Azure for Microsoft shops. AWS has the broadest service catalog overall.

5. Kubernetes ecosystem: all three have strong managed Kubernetes (EKS, GKE, AKS). GKE Autopilot is the lowest-ops option. EKS has the best AWS integration (IRSA, VPC CNI, ALB controller).

6. Multi-cloud strategy: if the organization explicitly wants cloud portability, design around portable interfaces (Kubernetes, Terraform, OpenTelemetry) rather than deep cloud-native services. But "multi-cloud by default" often adds complexity without proportional benefit.

Staff-level framing: "I would not choose a cloud platform before understanding the team's expertise, existing contracts, compliance requirements, and key services needed. I would also challenge the premise if the team wants to run multi-cloud without a specific reason — the operational complexity of two clouds often exceeds the resilience benefit unless you have active-active multi-cloud requirements."

---

### Pressure follow-up: "Where is the real blast radius?"

For a security group misconfiguration:
- Which services have the changed SG? (describe-security-groups --group-ids)
- Which instances/pods are in the affected SG? (describe-instances --filters)
- Which subnets/AZs are affected?
- Which dependent services call those instances?
- Does the change affect ingress (inbound blocked), egress (outbound blocked), or both?

For an SCP change:
- Which OUs and accounts does the SCP apply to?
- Which API calls does it deny?
- Which workloads call those APIs? (CloudTrail + Service last accessed data)
- Can existing workloads still function, or will they fail on next call?

For an IAM role change:
- Which principals assume this role? (aws iam list-entities-for-policy)
- Which API calls does the policy grant/deny?
- Which services are impacted right now vs at next token refresh?

---

## Beginner Questions

### What is the shared responsibility model?

The provider runs the cloud infrastructure. The customer configures and operates what they build on it: identities, data, application code, network exposure, runtime configuration, and workload policies.

### What is the difference between IaaS, PaaS, and SaaS?

IaaS gives virtual infrastructure such as VMs and networks. PaaS manages more of the runtime platform. SaaS provides a complete managed application or service. More managed means less operational burden but also less low-level control.

### What is IAM?

IAM is the control system for who or what can call cloud APIs. It normally includes principals, roles, policies, groups, service accounts, and higher-level organization guardrails.

### Why avoid daily use of the root or owner account?

It has too much power and too much blast radius. Use it only for account-level tasks. Daily work should use SSO, role assumption, and least privilege.

---

## AWS Service Questions

### IAM user vs IAM role?

A user is a long-lived identity. A role is assumed for a session and is preferred for workloads, automation, and cross-account access.

### What components are needed to build a VPC?

Subnets, route tables, Internet Gateway, NAT Gateway, endpoints, security groups, NACLs, peering, VPN or Transit Gateway depending on connectivity needs.

### Security Group vs NACL?

A Security Group is stateful and applies close to a workload. A NACL is stateless and applies at subnet level. Security Groups are normally the main workload traffic control.

### Public subnet vs private subnet?

A public subnet has a route to an Internet Gateway. A private subnet does not accept direct inbound internet traffic and usually uses NAT or private endpoints for outbound dependencies.

### What is Auto Scaling?

Automatic capacity adjustment based on demand. Scale-out adds capacity. Scale-in removes capacity. Elasticity is the automatic part of scaling.

### On-demand vs reserved vs spot?

On-demand is flexible. Reserved or Savings Plans fit stable baseline usage. Spot is cheaper but interruptible and fits restartable or stateless jobs.

---

## Storage And Database Questions

### What is S3 used for?

Object storage for static content, backups, logs, data lakes, build artifacts, and archives. It is not a normal filesystem.

### What does S3 versioning help with?

It helps recover from accidental overwrite or delete. It is a recovery feature, not a complete backup strategy by itself.

### RDS Multi-AZ vs read replica?

Multi-AZ is primarily for availability and failover. Read replicas are primarily for read scaling and reporting workloads.

### What is RDS Proxy?

A managed proxy that pools and reuses database connections. It is useful for bursty applications, Lambda workloads, and systems with connection exhaustion.

### When choose DynamoDB?

Choose it for key-value or document workloads with known access patterns, high scale, and low-latency reads and writes. Avoid it when the data model needs relational joins and ad-hoc querying.

---

## Architecture Questions

### Design a highly available three-tier application in AWS.

A strong answer includes Route 53, optional CloudFront/WAF, ALB across public subnets, compute in private subnets, RDS or Aurora in database subnets, Multi-AZ, Auto Scaling, IAM roles, logs, metrics, alarms, and backup strategy.

### How would you design a secure and scalable API?

Use API Gateway or ALB depending on protocol needs. Add authentication, throttling, structured logging, metrics, tracing, least-privilege backend permissions, and WAF if the API is internet-facing.

### How do you design disaster recovery?

Start with RTO and RPO. Then choose backup/restore, pilot light, warm standby, or active-active. Test failover. Data replication, DNS routing, secrets, and runbooks must all work.

---

## Cost Questions

### How do you reduce cloud cost?

Right-size compute, buy commitments for stable baseline, use Spot for tolerant workloads, use storage lifecycle policies, stop unused resources, reduce unnecessary data transfer, and require tagging.

### What are common hidden costs?

NAT data processing, cross-AZ transfer, cross-region traffic, idle databases, unattached disks, old snapshots, high-volume logs, long retention, and load balancer hours.

### How do you balance cost and reliability?

Do not remove redundancy blindly. Understand the failure mode. One NAT Gateway is cheaper than one per AZ, but it creates a dependency that may not match production reliability goals.

---

## Staff-Level Questions

### How would you create cloud standards for many teams?

Build golden paths: account/project structure, network baseline, IAM model, service templates, observability, cost tags, and deployment patterns. Allow deviations only with clear ownership.

### Managed service or self-managed?

Compare operational burden, reliability target, team expertise, customization, cost, portability, compliance, and incident ownership. Managed services reduce toil but may reduce low-level control.

### What signals show cloud architecture is unhealthy?

Manual changes are common, cloud cost grows faster than traffic, production and staging differ heavily, logs are missing during incidents, roles are too broad, databases are too exposed, or backups are never restored in tests.

---

## Mock Interview Platform Questions (From SRE Mock Interview 03)

### Design a secure internal platform on GCP for services running mainly on GKE

Strong answer skeleton:

"My first constraints: private cluster (no public node or master IPs), Workload Identity for pod credentials (no key files in Secrets), and per-environment GCP projects so a misconfigured dev workload cannot reach prod.

Network: GKE inside a private VPC, Cloud NAT for outbound, Shared VPC if multiple projects need connectivity, Cilium NetworkPolicies for east-west control inside the cluster.

Secrets: Secrets Manager accessed via the CSI secrets driver, not via env vars in manifests.

Supply chain: Artifact Registry with binary scanning, and a Binary Authorization policy in prod that requires an attestation from the scanning pipeline before a pod can be scheduled.

Audit: Cloud Audit Logs to BigQuery with 1-year retention."

### What parts of that GCP design would change in AWS, and what stays the same?

What stays the same (portable principles):
- Least privilege identity per workload
- Private network topology
- Secrets at runtime, not in images
- Per-environment account/project isolation
- Signed/scanned artifact policy

What changes (vendor mechanics):
- IRSA replaces Workload Identity (same concept, different federation mechanism)
- AWS Secrets Manager or Parameter Store replaces GCP Secret Manager
- ECR with scanning replaces Artifact Registry
- Security Groups + VPC CNI replace Cloud NAT + Cilium
- AWS Organizations with SCPs is more mature than GCP folder/project IAM for enforcing guardrails at scale

### What signals tell you your delivery platform is becoming a reliability risk?

Five platform SLIs to track:
1. Build success rate: if infra-error failures exceed 2%, the platform is unreliable
2. P95 deploy duration: stable or decreasing; a 20% increase over a quarter is a signal
3. Rollback rate per deployment: if this climbs, validation is insufficient
4. Teams creating shadow pipelines: behavioral signal that the platform failed to meet needs
5. Platform team involvement in production incidents: if you appear in three post-incident reviews in a month as a contributing factor, you are a reliability risk

### How do you handle a policy that teams constantly bypass?

Diagnosis before reaction:
- Is the bypass in dev only, or in production?
- Is it creating actual risk?
- Interview two or three of the teams who bypass most frequently

Usually the answer: the compliant path has 10-minute setup overhead; the non-compliant path takes 30 seconds.

Fix ergonomics first: make the correct path as fast as the bypass. If you cannot fix ergonomics immediately, enforce the policy only at the production promotion gate — teams have flexibility in dev but production requires compliance.

### What does break-glass access look like in practice?

- Dedicated service account per cluster stored in Vault under a break-glass policy
- Checking it out requires MFA, a required justification field, and creates an immediate PagerDuty alert to security on-call
- Credential valid for 4 hours
- All API actions taken during break-glass session tagged in Kubernetes audit log with the break-glass credential
- After incident: break-glass key rotated, session record reviewed within 24 hours
- Review asks: what was done, was it necessary, what prevents the need next time

---

## Pressure Follow-Ups

### Where is the blast radius?

Identify the affected account/project, region, VPC, subnet, role, database, service, and users. For credential issues: which services use the credential, which AWS APIs do they call, which data can they access.

### What is the rollback story?

For infrastructure: revert Terraform or module versions, apply in non-production first. For applications: use the previous artifact and a fast deployment path. For databases: use compatible schema changes (expand-contract) or tested restore paths. For IAM policy changes: save the policy version before modifying, revert to the saved version.

### What would you centralize?

Account vending, network baselines, audit logging, IAM guardrails, cost allocation, observability standards, and secure templates. Security controls that protect the blast radius of the platform (CloudTrail, GuardDuty, Security Hub) must always be centralized.

### What would you delegate?

Application-specific scaling, service-level alerts, feature architecture, and non-production experimentation inside platform guardrails. Teams that deviate from golden paths own their operational burden for the deviation.

### What does auditability mean in practice?

Not just "we have logs." Auditability means:
- CloudTrail captures API calls across all accounts (organization trail)
- Logs are immutable in the log archive account (only security automation can write, not delete)
- Alerts fire on specific high-risk actions (root login, SCP change, GuardDuty finding)
- Log review is scheduled (weekly automated report on critical findings)
- Log access is scoped (not everyone can query raw CloudTrail; SIEM or Security Hub aggregates findings)
