# Cloud Platforms — Zero to Hero

## 🎯 Why This Domain Matters
Mastering cloud platforms is about wielding the fundamental building blocks of modern infrastructure to achieve business and reliability goals. It’s the difference between simply *using* the cloud and *governing* it. For a Staff/Principal engineer, this expertise solves critical problems: it prevents sprawling, insecure, and expensive infrastructure chaos. Without this deep knowledge, organizations suffer from runaway costs due to unoptimized resources and egress fees, security breaches from misconfigured IAM policies and public S3 buckets, and poor reliability from architectures that aren't fault-tolerant.

Staff engineers are the architects of the "paved road." They create the foundational patterns, landing zones, and automation that allow hundreds of product teams to deploy services quickly, securely, and cost-effectively. Their expertise directly translates to business agility (faster time-to-market), financial health (predictable cloud spend), and customer trust (high availability and security). When this expertise is lacking, every team reinvents the wheel, security becomes a game of whack-a-mole, and the cloud bill becomes an unpredictable liability.

## 📋 Prerequisites & Mental Models
To unlock this domain, you must internalize a few key concepts that form the bedrock of cloud-native thinking.

*   **The Shared Responsibility Model:** Understand exactly where the cloud provider's responsibility ends and yours begins. For IaaS (like EC2), the provider manages the physical hardware and virtualization layer; you manage everything else, from the OS up. For PaaS (like RDS), they manage the OS and database software; you manage the data, schema, and access control. For SaaS, they manage almost everything. Misunderstanding this model leads to critical gaps in security and operations.
*   **Everything is an API:** The console is a convenience. The true power of the cloud is its API-driven nature. Every resource—a VM, a storage bucket, a network—is an object that can be created, configured, and destroyed programmatically. This mental model is the prerequisite for Infrastructure as Code (IaC) and true automation. Stop thinking in clicks; start thinking in API calls and declarative state.
*   **Cattle, Not Pets:** Servers and other infrastructure components should be treated as ephemeral and disposable (cattle), not unique and hand-tended (pets). If a server misbehaves, you don't log in to fix it; you terminate it and let an automated process replace it with a new, identical one from a golden image. This mindset is fundamental to building scalable, self-healing systems.
*   **Design for Failure:** In a distributed system at scale, failures are not exceptions; they are statistical certainties. Disks will fail, networks will partition, and entire availability zones can go down. The mental model is to build systems that anticipate and gracefully handle these failures, rather than assuming a perfect, failure-free environment. This leads to patterns like multi-AZ deployments, health checks, and automated failover.

## 🔷 Core Concepts

#### Managed Services Trade-offs
A managed service (e.g., AWS RDS, EKS, Google Cloud SQL) is not just a technology; it's a strategic decision to offload operational burden.
*   **Why it exists:** To free engineering teams from the undifferentiated heavy lifting of patching, backups, high-availability configuration, and scaling of common infrastructure components like databases or Kubernetes control planes. This allows them to focus on application logic that delivers business value.
*   **The Trade-off:** You trade control and customisation for operational simplicity and velocity.
    *   **Pro-Managed (e.g., RDS):** Automated backups, point-in-time recovery, multi-AZ failover with a single checkbox, and managed patching. The TCO is often lower when accounting for engineering hours spent on database administration.
    *   **Pro-Self-Hosted (e.g., PostgreSQL on EC2):** Full control over the OS, database version, extensions, and performance tuning parameters. Necessary for legacy applications with specific version dependencies or when you need performance tuning capabilities not exposed by the managed service API.
    *   **Real-world Implication:** Choosing RDS means you can't SSH into the database server to install a custom monitoring agent or tweak obscure kernel parameters. If your application requires this, RDS is a non-starter. Choosing EKS means you accept AWS's opinion on control plane configuration and upgrade paths, but you don't have to worry about `etcd` backups.

#### Landing Zones & Multi-Account Strategy
A landing zone is a pre-configured, secure, and scalable multi-account AWS environment that acts as a starting point for all workloads. It's the foundational scaffolding for your entire cloud presence.
*   **Why it exists:** To prevent chaos. Without a landing zone, every new project becomes a greenfield deployment of VPCs, IAM roles, and logging, leading to inconsistent security postures and operational complexity. A landing zone establishes a baseline for networking, identity, security, and logging from day one.
*   **Core Components:**
    1.  **AWS Organizations:** Central management for all your accounts.
    2.  **Management/Root Account:** Used only for billing and creating new accounts.
    3.  **Identity Account:** Centralizes IAM users and roles, often federated with an external IdP (like Okta or Azure AD).
    4.  **Security Account:** Hosts security tools like GuardDuty, Security Hub, and receives logs for auditing.
    5.  **Log Archive Account:** An immutable S3 bucket for centralized, long-term storage of CloudTrail and other logs.
    6.  **Network Account:** Manages shared networking resources like Transit Gateways or VPC endpoints.
    7.  **Workload Accounts (Dev/Staging/Prod):** Isolated environments for applications, preventing a breach or misconfiguration in dev from impacting production.
*   **Service Control Policies (SCPs):** These are guardrails applied at the Organization level. For example, you can use an SCP to deny the ability to disable CloudTrail logging or to restrict deployments to specific regions, enforcing compliance across all accounts.

#### IAM at Scale
Identity and Access Management (IAM) is the nervous system of cloud security. At scale, it's not about individual users but about defining and managing access for thousands of roles, services, and federated identities.
*   **Why it exists:** To enforce the principle of least privilege programmatically. Who (principal) can do what (action) on which resource (resource) under what conditions (condition)?
*   **Key Principles at Scale:**
    *   **Federate, Don't Create Users:** Use an external Identity Provider (IdP) to manage human users. Users never get long-lived IAM credentials; they assume temporary roles via SAML or OIDC federation. This centralizes user management and simplifies on/off-boarding.
    *   **Roles for Everything:** EC2 instances, Lambda functions, and EKS pods should always use IAM Roles to get temporary credentials. Never embed access keys in code or configuration.
    *   **Attribute-Based Access Control (ABAC):** Instead of creating hundreds of specific roles, use tags and attributes to define permissions. For example, a single policy can grant access to resources if the principal's `team` tag matches the resource's `team` tag. This scales much better than managing thousands of role-specific policies.
    *   **Permissions Boundaries:** A powerful but complex feature. It sets the *maximum* permissions a role can ever have, even if its identity policy is more permissive. This is used by platform teams to delegate role creation to developers while ensuring they can't escalate their own privileges beyond a defined boundary.

#### Multi-Cloud & Hybrid Cloud Patterns
These