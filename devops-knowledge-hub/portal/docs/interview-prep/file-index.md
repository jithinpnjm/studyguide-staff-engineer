---
title: "SRE Docs — File Index & Contents"
sidebar_position: 0
---

# SRE Study Docs — Complete File Index

Quick reference: every file, its new name, and what it covers.

## Foundation Deep Dives (28 guides)

| New filename | What it covers |
|---|---|
| `ansible-and-host-automation.md` | Ansible is an agentless IT automation tool for configuration management, application deployment, and task orchestration. |
| `aws-cloud-services-and-platform-design.md` | This guide turns the AWS Solutions Architect slide topics into SRE learning material. |
| `azure-devops-crossover.md` | Azure DevOps is Microsoft's integrated DevOps platform. |
| `bash-and-shell-scripting.md` | Bash is the control language of Linux operations. |
| `cicd-trusted-delivery-and-platform-security.md` | CI/CD is the system that moves a code change into production safely. |
| `cloud-networking-and-kubernetes-networking.md` | Most production networking incidents happen at the boundary between cloud networking and Kubernetes networking. |
| `complete-sre-study-curriculum.md` | This guide changes the foundations section from a troubleshooting-only reference into a full teaching path. |
| `delivery-systems-jenkins-github-actions-and-argocd.md` | Delivery systems turn code changes into safe production reality. |
| `devops-troubleshooting-and-security-errors.md` | Production failures repeat in patterns: bad credentials, wrong DNS, blocked network paths, expired certificates, brok... |
| `docker-and-container-runtime.md` | Containers power modern platforms: Kubernetes, CI runners, batch jobs, developer environments, and many AI workloads. |
| `end-to-end-project-and-capstone-patterns.md` | Most platform engineering knowledge is taught tool by tool: Kubernetes here, Terraform there, Prometheus separately. |
| `git-and-version-control-for-platform-engineers.md` | Git is more than source control. |
| `http-apis-and-reverse-proxy-paths.md` | HTTP is the protocol of the modern web and APIs. |
| `kafka-and-event-streaming.md` | Apache Kafka is a distributed event streaming platform: a fault-tolerant, high-throughput log that producers write to... |
| `kubernetes-gpu-ai-platforms-and-operators.md` | GPU workloads on Kubernetes are not just larger Pods. |
| `kubernetes-networking-deep-dive.md` | Kubernetes networking is where Linux networking, container networking, DNS, load balancing, policy, cloud networking,... |
| `linux-and-network-administration.md` | Linux is the operating foundation underneath cloud VMs, Kubernetes nodes, CI runners, databases, containers, build ag... |
| `linux-debug-playbook.md` | This playbook is for production days when a Linux host, service, node, or dependency is unhealthy and you need to red... |
| `linux-kubernetes-foundations.md` | Kubernetes is a platform for running containers reliably at scale. |
| `networking-fundamentals.md` | Networking is how systems talk. |
| `observability-slos-and-incident-response.md` | Reliable systems are built by seeing clearly, deciding calmly, and learning continuously. |
| `prometheus-grafana-and-alertmanager.md` | Prometheus, Grafana, and Alertmanager form one of the most common observability stacks used by SRE and platform teams. |
| `python-for-sre.md` | Python is the language you reach for when Bash becomes too fragile. |
| `senior-staff-operating-manual.md` | This guide sets the bar for how to answer across the whole prep pack. |
| `sonarqube-and-code-quality-gates.md` | SonarQube is a static code analysis platform that scans source code for bugs, security vulnerabilities, code smells, ... |
| `sql-and-relational-data-for-sre.md` | Relational databases (PostgreSQL, MySQL, SQLite) underpin most production systems. |
| `system-design-cloud-architecture.md` | System design is not a product-name quiz. |
| `terraform-infrastructure-as-code.md` | Terraform is infrastructure as code. |
| `yaml-and-kubernetes-manifest-design.md` | YAML is the configuration language most Kubernetes engineers touch every day, but production-quality manifest design ... |

## AWS Deep Dive (27 files)

| New filename | What it covers |
|---|---|
| `advanced-identity.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `classic-web-architectures.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `cloudfront-and-global-accelerator.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `containers-on-aws.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `data-and-analytics.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `database-choices.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `disaster-recovery-and-migrations.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `ebs-efs-instance-store-ami.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `ec2-basics.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `ec2-networking-public-ip-private-ip-eni-elastic-ip.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `ec2-placement-groups-and-hibernate.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `ec2-purchasing-options.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `getting-started-with-aws.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `high-availability-and-scalability.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `iam.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `integration-and-messaging-sqs-sns-kinesis-mq.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `machine-learning.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `monitoring-audit-and-performance.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `more-solutions-architecture-and-other-services.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `rds-aurora-and-elasticache.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `route-53.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `s3-s3-advanced-and-s3-security.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `security-and-encryption.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `serverless.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `storage-extras.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `vpc-deep-topic.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |
| `well-architected-trusted-advisor-and-exam-review.md` | > Source spine: `AWS Certified Solutions Architect Slides v47. |

## Bash Labs

| New filename | What it covers |
|---|---|
| `health-check-script.md` | Every SRE team eventually writes a script that answers "is this thing up? |
| `log-summary.md` | During an incident the first question is almost always "what is the error rate? |
| `retry-and-guardrails.md` | Retry logic is everywhere in production systems: deployment scripts waiting for a pod to become ready, health check l... |

## Cloud Design Labs

| New filename | What it covers |
|---|---|
| `aws-crossover-rebuild.md` | Take the GCP-first public platform from Lab 1 and rebuild it for AWS-first operation. |
| `gcp-public-platform.md` | Design a public production platform on GCP for a customer-facing API product with global users. |
| `low-latency-multi-region-control-plane.md` | Design a low-latency control plane used by compute workloads across GCP and AWS. |
| `private-internal-platform.md` | Design an internal developer platform for private services, internal dashboards, and event-driven workers. |

## Cloud Networking Drills

| New filename | What it covers |
|---|---|
| `aws-vpc-sg-nacl-and-routing.md` | Your team runs a multi-tier application in AWS: a public ALB, app servers in private subnets, and an RDS PostgreSQL i... |
| `gcp-vpc-and-load-balancing.md` | Your team is migrating an ML inference service to GCP. |
| `kubernetes-cloud-networking-path.md` | An internet client sends a request to `https://api. |
| `public-private-network-boundaries.md` | You are designing the network architecture for an ML platform that will serve external customers. |

## Kubernetes Labs

| New filename | What it covers |
|---|---|
| `gpu-ml-ai-platform-review.md` | A company is building an AI compute platform on Kubernetes. |
| `node-pressure-and-scheduling.md` | Your platform runs GPU training jobs alongside long-running inference services. |
| `operators-mesh-and-dr-review.md` | A platform team has been running Kubernetes for two years. |
| `pod-service-debug.md` | You are on-call for an ML inference platform. |
| `rollout-and-probes.md` | You are deploying version 1. |

## Linux Labs

| New filename | What it covers |
|---|---|
| `filesystem-and-io.md` | "Disk write timeout" with `df -h` showing 40% used is one of the most confusing alerts an SRE encounters. |
| `host-triage.md` | You get paged at 2 AM. |
| `processes-cgroups-namespaces.md` | Kubernetes says the pod is Running. |

## Linux Admin Drills

| New filename | What it covers |
|---|---|
| `command-mastery-checklist.md` | For each command, the format is: **what problem it solves**, **one key signal to look for**, **one thing it cannot te... |
| `filesystem-and-storage-admin.md` | Storage failures are one of the most reliably confusing categories of incidents. |
| `process-socket-and-network-admin.md` | "Clients time out" is one of the most ambiguous alerts an SRE receives. |
| `service-and-systemd-triage.md` | A deploy is pushed. Someone in Slack says "service looks unhealthy." You SSH to the host. What is the first command? ... |

## Networking Labs

| New filename | What it covers |
|---|---|
| `http-dns-flow.md` | A user reports that `https://api. |
| `routing-firewall-and-capture.md` | An alert fires at 16:12 UTC: the `payment-processor` service is unreachable from the `order-service` pod, but the sam... |
| `ssh-latency.md` | An ops engineer reports that SSH to `bastion. |

## Python Labs

| New filename | What it covers |
|---|---|
| `http-probe.md` | Synthetic probes — scripts that actively make HTTP requests and report back — are one of the oldest and most reliable... |
| `json-log-analyzer.md` | Structured logging — where each log line is a JSON object — is now the standard in microservices. |
| `k8s-event-summary.md` | `kubectl get events` is one of the first commands you run when a workload is misbehaving. |

## Mock Interviews

| New filename | What it covers |
|---|---|
| `distributed-systems-and-resilience.md` | This is a 60-minute system design interview with SRE depth. |
| `nebius-linux-kubernetes-troubleshooting.md` | This is a 45–60 minute technical depth interview. |
| `platform-cloud-and-security.md` | This is a 60-minute platform engineering interview testing breadth across cloud, security, and delivery pipelines wit... |

## Nebius Company-Specific Prep

| New filename | What it covers |
|---|---|
| `coding-algorithms.md` | > Nebius's coding stage is Stage 2: 2 LeetCode-style problems (Easy to Medium) + practical SRE automation tasks. |
| `company-stack-interview-guide.md` | > Know who you are interviewing with as deeply as you know the technology they test you on. |
| `gpu-ai-infrastructure.md` | > Nebius is an AI-first cloud. |
| `kubernetes-cilium-production.md` | > Nebius runs all managed Kubernetes with Cilium CNI by default. |
| `linux-deep-dive.md` | > Nebius was built by Yandex engineers. |
| `stress-interview-incident-response.md` | > Stage 4 at Nebius is unusual: a 30-minute deliberate stress scenario where you must debug a production incident in ... |
| `system-design.md` | > Nebius's system design stage tests whether you can design infrastructure that fails gracefully, recovers automatica... |

## interview-prep

| New filename | What it covers |
|---|---|
| `4-week-roadmap.md` | This roadmap assumes 60 to 90 minutes per day. |
