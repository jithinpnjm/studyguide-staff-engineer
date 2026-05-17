---
title: "Complete SRE Study Curriculum: Basics To Advanced"
sidebar_position: 28
---

# Complete SRE Study Curriculum: Basics To Advanced

This guide changes the foundations section from a troubleshooting-only reference into a full teaching path. Use it the same way the MLOps Python material is organized: start with beginner-friendly explanations, then move into engineering practice, then finish with advanced SRE judgment.

Each topic is taught in three voices:

1. **Teacher to a beginner** - explains the technology from first principles to someone new to the stack.
2. **Teacher to a new engineer** - builds intermediate mental models, operational habits, and implementation skills.
3. **SRE professional to an SRE candidate** - teaches advanced production trade-offs, failure modes, scaling limits, and interview-ready judgment.

---

## How To Study Each Topic

For every topic below, follow this repeatable loop:

1. **Understand the idea** - explain what the technology is, why it exists, and where it fits in production systems.
2. **Learn the vocabulary** - write down the core terms and map them to real examples.
3. **Build a small lab** - run commands, write configuration, or deploy a tiny version.
4. **Debug one failure** - break something intentionally and recover it.
5. **Explain the production trade-off** - describe cost, reliability, security, scalability, and operational risk.
6. **Answer interview questions** - practice explaining decisions, not just commands.

---

## 1. Linux And Operating Systems

### Beginner: teacher to a new student

Linux is the operating system that runs most servers. Start by learning what a process is, what a file is, what a user is, and how the shell lets you control the machine. Learn directory structure, permissions, environment variables, services, logs, and package installation.

Focus on these basics:

- files and directories: `/etc`, `/var`, `/home`, `/tmp`, `/proc`
- users, groups, ownership, and permissions
- shell navigation: `pwd`, `ls`, `cd`, `cat`, `less`, `grep`, `find`
- processes: `ps`, `top`, `kill`, `systemctl`
- logs: `journalctl`, `/var/log/*`
- networking commands: `ip`, `ss`, `curl`, `dig`

### Intermediate: teacher to a new engineer

Now learn how Linux behaves under load. Understand CPU, memory, disk I/O, file descriptors, network sockets, systemd units, cron jobs, and kernel limits. Practice diagnosing slow applications by checking resource pressure before blaming the application.

You should be able to:

- inspect CPU saturation, load average, memory pressure, swap, and OOM kills
- understand systemd service lifecycle and restart policies
- debug disk full, inode exhaustion, permission errors, and port conflicts
- use `strace`, `lsof`, `dmesg`, `iostat`, `vmstat`, and `sar`
- explain the difference between a process, thread, socket, and file descriptor

### Advanced: SRE professional perspective

At SRE level, Linux is not just a host. It is the failure boundary for workloads. You must understand noisy neighbors, kernel tuning, capacity limits, host-level blast radius, system upgrade risk, and how container runtimes depend on namespaces, cgroups, overlay filesystems, and iptables/nftables.

Advanced SRE expectations:

- design safe node upgrade and rollback strategy
- tune kernel/network parameters only with measurement and rollback plans
- debug production incidents using evidence, not guesses
- understand cgroups, namespaces, limits, throttling, and eviction behavior
- connect host metrics to customer impact and SLO burn

---

## 2. Networking Fundamentals

### Beginner: teacher to a new student

Networking is how computers talk. Start with IP addresses, ports, protocols, DNS, routing, TCP, UDP, HTTP, and TLS. Learn what happens when you type a URL in a browser: DNS lookup, TCP connection, TLS handshake, HTTP request, server response.

Learn these first:

- IP address, subnet, gateway, route
- TCP vs UDP
- port and socket
- DNS A, CNAME, TXT records
- HTTP request and response
- TLS certificate and handshake

### Intermediate: teacher to a new engineer

Now learn how applications fail on the network. Practice tracing traffic through clients, load balancers, firewalls, proxies, service discovery, and Kubernetes Services. Understand latency, packet loss, retries, timeouts, connection pooling, and backpressure.

You should be able to:

- debug DNS failures with `dig` and `nslookup`
- inspect listening ports with `ss -lntp`
- test endpoints with `curl -v`
- read HTTP status codes and headers
- explain TCP handshake and connection reset
- distinguish timeout, refused connection, TLS error, and DNS error

### Advanced: SRE professional perspective

At SRE level, networking is a distributed-systems reliability problem. You must reason about blast radius, cross-zone traffic, congestion, load balancing, NAT exhaustion, MTU mismatch, service mesh behavior, certificate rotation, and safe network change management.

Advanced SRE expectations:

- design reliable ingress and egress paths
- understand how retries can amplify outages
- set sane timeout and retry budgets
- debug cross-region latency and partial failure
- protect systems from dependency overload with circuit breakers and rate limits

---

## 3. Kubernetes

### Beginner: teacher to a new student

Kubernetes runs containers across many machines. Start with Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, and kubectl. Learn that a Pod is the smallest deployable unit, a Deployment keeps replicas running, and a Service gives stable access to changing Pods.

Learn these first:

- container image
- Pod
- Deployment
- Service
- Namespace
- ConfigMap and Secret
- `kubectl get`, `describe`, `logs`, `exec`, `apply`

### Intermediate: teacher to a new engineer

Now learn how Kubernetes schedules, restarts, scales, and exposes applications. Understand resource requests and limits, probes, rolling updates, HPA, node selectors, taints, tolerations, volumes, ingress, and service discovery.

You should be able to:

- write clean Deployment and Service manifests
- use readiness and liveness probes correctly
- debug CrashLoopBackOff, ImagePullBackOff, Pending Pods, and failed readiness
- explain requests, limits, QoS classes, and eviction
- understand how DNS and Services route traffic to Pods

### Advanced: SRE professional perspective

At SRE level, Kubernetes is a platform control plane. You must understand cluster upgrades, API server availability, etcd safety, admission control, RBAC, node autoscaling, workload isolation, networking plugins, storage failure, multi-tenancy, and operator lifecycle.

Advanced SRE expectations:

- design safe cluster upgrade strategy
- protect control-plane and etcd reliability
- debug CNI, CoreDNS, kube-proxy, and ingress issues
- set policy guardrails for security and reliability
- understand when Kubernetes automation helps and when it hides risk

---

## 4. Containers And Docker

### Beginner: teacher to a new student

A container packages an application with its dependencies so it can run consistently. Learn images, containers, Dockerfiles, registries, layers, ports, volumes, and environment variables.

Start with:

- build an image from a Dockerfile
- run a container locally
- expose a port
- mount a volume
- pass environment variables
- inspect logs

### Intermediate: teacher to a new engineer

Now learn image quality and runtime behavior. Understand small base images, multi-stage builds, non-root users, health checks, image scanning, tags, digests, and runtime limits.

You should be able to:

- write secure Dockerfiles
- reduce image size and build time
- avoid leaking secrets into image layers
- debug container networking and filesystem behavior
- explain image tags vs immutable digests

### Advanced: SRE professional perspective

At SRE level, containers are supply-chain and runtime boundaries. You must reason about provenance, vulnerability management, registry reliability, runtime isolation, cgroup limits, kernel dependency, and emergency rollback.

Advanced SRE expectations:

- enforce trusted image sources
- design image promotion across environments
- use digest pinning for production reliability
- connect container resource limits to host pressure and SLOs
- debug failures across app, runtime, kernel, and orchestrator layers

---

## 5. Observability, SLOs, And Incident Response

### Beginner: teacher to a new student

Observability means understanding what a system is doing by looking at metrics, logs, and traces. Learn the difference between symptoms and causes. Learn golden signals: latency, traffic, errors, and saturation.

Start with:

- metrics show numbers over time
- logs show events
- traces show request paths
- dashboards help humans see trends
- alerts should notify only when action is needed

### Intermediate: teacher to a new engineer

Now learn how to instrument services and operate alerts. Understand Prometheus metrics, Grafana dashboards, Alertmanager routing, log correlation, tracing spans, SLOs, SLIs, error budgets, and alert fatigue.

You should be able to:

- design useful dashboards
- write basic PromQL queries
- define availability and latency SLIs
- create alerts from user impact, not internal noise
- run incident response with roles, timeline, and communication

### Advanced: SRE professional perspective

At SRE level, observability is a decision system. You must connect telemetry to product reliability, capacity planning, release risk, error-budget policy, and post-incident learning.

Advanced SRE expectations:

- design multi-window burn-rate alerts
- distinguish paging alerts from ticket alerts
- reduce alert noise without hiding real risk
- use SLOs to negotiate reliability vs velocity
- run blameless postmortems that produce system improvements

---

## 6. CI/CD And Progressive Delivery

### Beginner: teacher to a new student

CI/CD automates building, testing, and deploying software. CI checks code changes. CD moves verified changes to environments. Learn pipeline stages: checkout, build, test, scan, package, deploy.

Start with:

- Git commit triggers pipeline
- tests validate behavior
- artifacts are produced
- deployment updates an environment
- rollback returns to a known good state

### Intermediate: teacher to a new engineer

Now learn pipeline design. Understand Jenkins, GitHub Actions, Argo CD, environments, approvals, secrets, artifact promotion, deployment strategies, and failure handling.

You should be able to:

- write a simple pipeline
- separate build and deploy stages
- avoid rebuilding artifacts per environment
- use GitOps for Kubernetes manifests
- explain blue-green, canary, and rolling deployment

### Advanced: SRE professional perspective

At SRE level, delivery systems are production risk controls. You must reason about blast radius, supply-chain security, deployment frequency, rollback speed, progressive traffic shifting, policy gates, and change failure rate.

Advanced SRE expectations:

- design safe release automation
- implement progressive delivery with metrics-based rollback
- protect secrets and signing keys
- prevent pipeline privilege escalation
- measure deployment reliability using DORA and SLO signals

---

## 7. Infrastructure As Code And Terraform

### Beginner: teacher to a new student

Infrastructure as Code means describing infrastructure in files instead of clicking manually in a console. Terraform reads configuration, compares it with real infrastructure, and creates a plan before applying changes.

Start with:

- provider
- resource
- variable
- output
- state file
- `terraform init`, `plan`, `apply`, `destroy`

### Intermediate: teacher to a new engineer

Now learn module design, remote state, workspaces or environment separation, plan review, imports, drift detection, and safe refactoring.

You should be able to:

- structure reusable modules
- manage remote state safely
- review plans before applying
- import existing resources
- handle drift without accidental deletion

### Advanced: SRE professional perspective

At SRE level, Terraform is a change-management system for critical infrastructure. You must design ownership boundaries, state isolation, policy enforcement, provider upgrade strategy, drift detection, emergency rollback, and least-privilege automation.

Advanced SRE expectations:

- avoid giant shared state files
- design module contracts and versioning
- enforce policy as code
- protect state secrets
- plan safe migrations for production resources

---

## 8. Cloud Architecture And AWS

### Beginner: teacher to a new student

Cloud platforms provide compute, networking, storage, databases, identity, and monitoring as managed services. Learn the basic building blocks before memorizing service names.

Start with:

- compute: VM, container, serverless
- network: VPC, subnet, route table, load balancer
- storage: object, block, file
- identity: users, roles, policies
- monitoring: metrics, logs, alarms

### Intermediate: teacher to a new engineer

Now learn how cloud services connect. Understand high availability, autoscaling, IAM roles, security groups, private networking, managed databases, object storage lifecycle, backups, and cost visibility.

You should be able to:

- design a simple public web service
- separate public and private subnets
- apply least-privilege IAM
- configure load balancing and autoscaling
- explain backup, restore, and disaster recovery basics

### Advanced: SRE professional perspective

At SRE level, cloud architecture is about reliability, security, cost, and operability. You must reason about regional failure, dependency limits, quota management, managed-service SLAs, data durability, incident response, and cost-risk trade-offs.

Advanced SRE expectations:

- design multi-AZ and multi-region patterns when justified
- define RTO and RPO clearly
- manage quotas and capacity proactively
- protect identity boundaries
- balance managed services against lock-in and operational burden

---

## 9. Configuration Management And Ansible

### Beginner: teacher to a new student

Configuration management keeps servers consistent. Ansible connects to machines, runs tasks, and applies desired configuration using playbooks.

Start with:

- inventory
- playbook
- task
- module
- variable
- handler

### Intermediate: teacher to a new engineer

Now learn roles, templates, idempotency, conditionals, secrets, tags, and testing. Understand that a playbook should be repeatable and safe.

You should be able to:

- write idempotent playbooks
- organize roles
- template configuration files
- restart services only when configuration changes
- handle secrets with vault or external secret systems

### Advanced: SRE professional perspective

At SRE level, configuration management is fleet safety. You must plan blast radius, staged rollout, failure recovery, inventory accuracy, compliance, and drift control.

Advanced SRE expectations:

- roll out changes in batches
- verify before and after state
- design emergency rollback
- avoid snowflake servers
- integrate config management with monitoring and change records

---

## 10. Git And Version Control

### Beginner: teacher to a new student

Git records changes to files. Learn repository, commit, branch, merge, remote, pull, and push. Practice small commits with clear messages.

Start with:

- `git status`
- `git add`
- `git commit`
- `git branch`
- `git pull`
- `git push`

### Intermediate: teacher to a new engineer

Now learn team workflows. Understand pull requests, code review, rebasing, resolving conflicts, tags, release branches, and reverting safely.

You should be able to:

- create clean pull requests
- resolve merge conflicts
- use branches for isolated work
- revert bad changes safely
- write useful commit messages

### Advanced: SRE professional perspective

At SRE level, Git is the audit trail for production changes. You must connect Git history to incident timelines, deployment systems, compliance, and rollback strategy.

Advanced SRE expectations:

- protect main branches
- require review for production-impacting changes
- sign or verify sensitive commits when needed
- use GitOps for declarative infrastructure
- trace incidents back to changes quickly

---

## 11. Data Systems: SQL And Kafka

### Beginner: teacher to a new student

SQL stores structured data in tables. Kafka moves streams of events between systems. Learn tables, rows, columns, indexes, topics, partitions, producers, and consumers.

Start with:

- basic SELECT queries
- primary keys and indexes
- topic and partition
- producer and consumer
- consumer group

### Intermediate: teacher to a new engineer

Now learn performance and reliability. For SQL, study query plans, locking, transactions, connection pools, backups, and replication. For Kafka, study offsets, retention, partitioning, lag, retries, and schema compatibility.

You should be able to:

- debug slow queries
- explain transaction isolation basics
- monitor replication and backup health
- understand Kafka consumer lag
- choose partition keys carefully

### Advanced: SRE professional perspective

At SRE level, data systems are stateful reliability risks. You must reason about durability, consistency, recovery, reprocessing, failover, capacity, and data-loss blast radius.

Advanced SRE expectations:

- design backup and restore drills
- define RPO and RTO for data systems
- plan schema changes safely
- handle poison messages and replay storms
- understand when eventual consistency is acceptable

---

## 12. Security, Code Quality, And Platform Guardrails

### Beginner: teacher to a new student

Security means protecting systems from misuse. Code quality means reducing defects before production. Learn authentication, authorization, secrets, dependencies, static analysis, and vulnerability scanning.

Start with:

- identity
- permissions
- secrets
- dependency versions
- code scanning
- least privilege

### Intermediate: teacher to a new engineer

Now learn CI security gates, SonarQube quality checks, dependency scanning, container scanning, secret scanning, RBAC, admission policies, and audit logs.

You should be able to:

- prevent secrets in Git
- read vulnerability severity and exploitability
- set quality gates without blocking healthy delivery unnecessarily
- apply RBAC correctly
- explain authentication vs authorization

### Advanced: SRE professional perspective

At SRE level, security is part of reliability. You must design guardrails that reduce production risk while keeping teams productive.

Advanced SRE expectations:

- implement policy as code
- design break-glass access with auditability
- build secure defaults into platforms
- prioritize vulnerabilities based on real exposure
- connect security incidents to operational response

---

## 13. YAML, APIs, And Reverse Proxies

### Beginner: teacher to a new student

YAML is a human-readable configuration format. APIs let systems communicate. Reverse proxies sit in front of applications and route traffic.

Start with:

- YAML indentation and lists
- HTTP methods: GET, POST, PUT, DELETE
- status codes: 2xx, 3xx, 4xx, 5xx
- headers and body
- proxy routing

### Intermediate: teacher to a new engineer

Now learn schema validation, Kubernetes manifests, API contracts, ingress routing, TLS termination, path rewriting, rate limiting, and authentication headers.

You should be able to:

- write valid Kubernetes YAML
- debug invalid manifests
- inspect HTTP requests and responses
- configure ingress rules safely
- explain reverse proxy behavior

### Advanced: SRE professional perspective

At SRE level, APIs and proxies define reliability boundaries. You must reason about versioning, compatibility, timeout budgets, retries, authentication propagation, observability, and traffic shaping.

Advanced SRE expectations:

- design stable API contracts
- avoid retry storms
- set proxy timeouts intentionally
- protect upstreams with rate limits
- debug traffic through multiple proxy layers

---

## 14. Capstone Learning Path

Use this capstone to combine everything:

1. Build a small application and containerize it.
2. Deploy it to Kubernetes with resource requests, probes, and a Service.
3. Add ingress, TLS, and DNS.
4. Add Prometheus metrics and Grafana dashboard.
5. Define one availability SLO and one latency SLO.
6. Create CI/CD for build, scan, and deploy.
7. Manage infrastructure with Terraform.
8. Configure supporting hosts with Ansible if needed.
9. Add logs and traces.
10. Break the system in controlled ways and write incident notes.
11. Document rollback, backup, restore, and disaster recovery.
12. Explain the design as an SRE: reliability, security, cost, scale, and operational risk.

---

## Interview Readiness Checklist

You are ready when you can explain each topic at three levels:

- **Beginner explanation:** what it is and why it exists.
- **Intermediate explanation:** how to build, configure, and debug it.
- **Advanced explanation:** how it fails in production and how an SRE reduces risk.

For every answer, use this structure:

1. define the concept simply
2. give a small example
3. explain the operational risk
4. describe how you would observe it
5. describe how you would recover from failure
6. describe how you would prevent recurrence
