---
title: "SRE Interview Prep"
sidebar_position: 15
---

# SRE Interview Prep

Interview preparation, mock sessions, company-specific guides, study roadmap, and memory palaces — from the SRE interview prep pack.

---

## [SRE] Complete SRE Study Curriculum: Basics To Advanced

## Complete SRE Study Curriculum: Basics To Advanced

This guide changes the foundations section from a troubleshooting-only reference into a full teaching path. Use it the same way the MLOps Python material is organized: start with beginner-friendly explanations, then move into engineering practice, then finish with advanced SRE judgment.

Each topic is taught in three voices:

1. **Teacher to a beginner** - explains the technology from first principles to someone new to the stack.
2. **Teacher to a new engineer** - builds intermediate mental models, operational habits, and implementation skills.
3. **SRE professional to an SRE candidate** - teaches advanced production trade-offs, failure modes, scaling limits, and interview-ready judgment.

---

### How To Study Each Topic

For every topic below, follow this repeatable loop:

1. **Understand the idea** - explain what the technology is, why it exists, and where it fits in production systems.
2. **Learn the vocabulary** - write down the core terms and map them to real examples.
3. **Build a small lab** - run commands, write configuration, or deploy a tiny version.
4. **Debug one failure** - break something intentionally and recover it.
5. **Explain the production trade-off** - describe cost, reliability, security, scalability, and operational risk.
6. **Answer interview questions** - practice explaining decisions, not just commands.

---

### 1. Linux And Operating Systems

#### Beginner: teacher to a new student

Linux is the operating system that runs most servers. Start by learning what a process is, what a file is, what a user is, and how the shell lets you control the machine. Learn directory structure, permissions, environment variables, services, logs, and package installation.

Focus on these basics:

- files and directories: `/etc`, `/var`, `/home`, `/tmp`, `/proc`
- users, groups, ownership, and permissions
- shell navigation: `pwd`, `ls`, `cd`, `cat`, `less`, `grep`, `find`
- processes: `ps`, `top`, `kill`, `systemctl`
- logs: `journalctl`, `/var/log/*`
- networking commands: `ip`, `ss`, `curl`, `dig`

#### Intermediate: teacher to a new engineer

Now learn how Linux behaves under load. Understand CPU, memory, disk I/O, file descriptors, network sockets, systemd units, cron jobs, and kernel limits. Practice diagnosing slow applications by checking resource pressure before blaming the application.

You should be able to:

- inspect CPU saturation, load average, memory pressure, swap, and OOM kills
- understand systemd service lifecycle and restart policies
- debug disk full, inode exhaustion, permission errors, and port conflicts
- use `strace`, `lsof`, `dmesg`, `iostat`, `vmstat`, and `sar`
- explain the difference between a process, thread, socket, and file descriptor

#### Advanced: SRE professional perspective

At SRE level, Linux is not just a host. It is the failure boundary for workloads. You must understand noisy neighbors, kernel tuning, capacity limits, host-level blast radius, system upgrade risk, and how container runtimes depend on namespaces, cgroups, overlay filesystems, and iptables/nftables.

Advanced SRE expectations:

- design safe node upgrade and rollback strategy
- tune kernel/network parameters only with measurement and rollback plans
- debug production incidents using evidence, not guesses
- understand cgroups, namespaces, limits, throttling, and eviction behavior
- connect host metrics to customer impact and SLO burn

---

### 2. Networking Fundamentals

#### Beginner: teacher to a new student

Networking is how computers talk. Start with IP addresses, ports, protocols, DNS, routing, TCP, UDP, HTTP, and TLS. Learn what happens when you type a URL in a browser: DNS lookup, TCP connection, TLS handshake, HTTP request, server response.

Learn these first:

- IP address, subnet, gateway, route
- TCP vs UDP
- port and socket
- DNS A, CNAME, TXT records
- HTTP request and response
- TLS certificate and handshake

#### Intermediate: teacher to a new engineer

Now learn how applications fail on the network. Practice tracing traffic through clients, load balancers, firewalls, proxies, service discovery, and Kubernetes Services. Understand latency, packet loss, retries, timeouts, connection pooling, and backpressure.

You should be able to:

- debug DNS failures with `dig` and `nslookup`
- inspect listening ports with `ss -lntp`
- test endpoints with `curl -v`
- read HTTP status codes and headers
- explain TCP handshake and connection reset
- distinguish timeout, refused connection, TLS error, and DNS error

#### Advanced: SRE professional perspective

At SRE level, networking is a distributed-systems reliability problem. You must reason about blast radius, cross-zone traffic, congestion, load balancing, NAT exhaustion, MTU mismatch, service mesh behavior, certificate rotation, and safe network change management.

Advanced SRE expectations:

- design reliable ingress and egress paths
- understand how retries can amplify outages
- set sane timeout and retry budgets
- debug cross-region latency and partial failure
- protect systems from dependency overload with circuit breakers and rate limits

---

### 3. Kubernetes

#### Beginner: teacher to a new student

Kubernetes runs containers across many machines. Start with Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, and kubectl. Learn that a Pod is the smallest deployable unit, a Deployment keeps replicas running, and a Service gives stable access to changing Pods.

Learn these first:

- container image
- Pod
- Deployment
- Service
- Namespace
- ConfigMap and Secret
- `kubectl get`, `describe`, `logs`, `exec`, `apply`

#### Intermediate: teacher to a new engineer

Now learn how Kubernetes schedules, restarts, scales, and exposes applications. Understand resource requests and limits, probes, rolling updates, HPA, node selectors, taints, tolerations, volumes, ingress, and service discovery.

You should be able to:

- write clean Deployment and Service manifests
- use readiness and liveness probes correctly
- debug CrashLoopBackOff, ImagePullBackOff, Pending Pods, and failed readiness
- explain requests, limits, QoS classes, and eviction
- understand how DNS and Services route traffic to Pods

#### Advanced: SRE professional perspective

At SRE level, Kubernetes is a platform control plane. You must understand cluster upgrades, API server availability, etcd safety, admission control, RBAC, node autoscaling, workload isolation, networking plugins, storage failure, multi-tenancy, and operator lifecycle.

Advanced SRE expectations:

- design safe cluster upgrade strategy
- protect control-plane and etcd reliability
- debug CNI, CoreDNS, kube-proxy, and ingress issues
- set policy guardrails for security and reliability
- understand when Kubernetes automation helps and when it hides risk

---

### 4. Containers And Docker

#### Beginner: teacher to a new student

A container packages an application with its dependencies so it can run consistently. Learn images, containers, Dockerfiles, registries, layers, ports, volumes, and environment variables.

Start with:

- build an image from a Dockerfile
- run a container locally
- expose a port
- mount a volume
- pass environment variables
- inspect logs

#### Intermediate: teacher to a new engineer

Now learn image quality and runtime behavior. Understand small base images, multi-stage builds, non-root users, health checks, image scanning, tags, digests, and runtime limits.

You should be able to:

- write secure Dockerfiles
- reduce image size and build time
- avoid leaking secrets into image layers
- debug container networking and filesystem behavior
- explain image tags vs immutable digests

#### Advanced: SRE professional perspective

At SRE level, containers are supply-chain and runtime boundaries. You must reason about provenance, vulnerability management, registry reliability, runtime isolation, cgroup limits, kernel dependency, and emergency rollback.

Advanced SRE expectations:

- enforce trusted image sources
- design image promotion across environments
- use digest pinning for production reliability
- connect container resource limits to host pressure and SLOs
- debug failures across app, runtime, kernel, and orchestrator layers

---

### 5. Observability, SLOs, And Incident Response

#### Beginner: teacher to a new student

Observability means understanding what a system is doing by looking at metrics, logs, and traces. Learn the difference between symptoms and causes. Learn golden signals: latency, traffic, errors, and saturation.

Start with:

- metrics show numbers over time
- logs show events
- traces show request paths
- dashboards help humans see trends
- alerts should notify only when action is needed

#### Intermediate: teacher to a new engineer

Now learn how to instrument services and operate alerts. Understand Prometheus metrics, Grafana dashboards, Alertmanager routing, log correlation, tracing spans, SLOs, SLIs, error budgets, and alert fatigue.

You should be able to:

- design useful dashboards
- write basic PromQL queries
- define availability and latency SLIs
- create alerts from user impact, not internal noise
- run incident response with roles, timeline, and communication

#### Advanced: SRE professional perspective

At SRE level, observability is a decision system. You must connect telemetry to product reliability, capacity planning, release risk, error-budget policy, and post-incident learning.

Advanced SRE expectations:

- design multi-window burn-rate alerts
- distinguish paging alerts from ticket alerts
- reduce alert noise without hiding real risk
- use SLOs to negotiate reliability vs velocity
- run blameless postmortems that produce system improvements

---

### 6. CI/CD And Progressive Delivery

#### Beginner: teacher to a new student

CI/CD automates building, testing, and deploying software. CI checks code changes. CD moves verified changes to environments. Learn pipeline stages: checkout, build, test, scan, package, deploy.

Start with:

- Git commit triggers pipeline
- tests validate behavior
- artifacts are produced
- deployment updates an environment
- rollback returns to a known good state

#### Intermediate: teacher to a new engineer

Now learn pipeline design. Understand Jenkins, GitHub Actions, Argo CD, environments, approvals, secrets, artifact promotion, deployment strategies, and failure handling.

You should be able to:

- write a simple pipeline
- separate build and deploy stages
- avoid rebuilding artifacts per environment
- use GitOps for Kubernetes manifests
- explain blue-green, canary, and rolling deployment

#### Advanced: SRE professional perspective

At SRE level, delivery systems are production risk controls. You must reason about blast radius, supply-chain security, deployment frequency, rollback speed, progressive traffic shifting, policy gates, and change failure rate.

Advanced SRE expectations:

- design safe release automation
- implement progressive delivery with metrics-based rollback
- protect secrets and signing keys
- prevent pipeline privilege escalation
- measure deployment reliability using DORA and SLO signals

---

### 7. Infrastructure As Code And Terraform

#### Beginner: teacher to a new student

Infrastructure as Code means describing infrastructure in files instead of clicking manually in a console. Terraform reads configuration, compares it with real infrastructure, and creates a plan before applying changes.

Start with:

- provider
- resource
- variable
- output
- state file
- `terraform init`, `plan`, `apply`, `destroy`

#### Intermediate: teacher to a new engineer

Now learn module design, remote state, workspaces or environment separation, plan review, imports, drift detection, and safe refactoring.

You should be able to:

- structure reusable modules
- manage remote state safely
- review plans before applying
- import existing resources
- handle drift without accidental deletion

#### Advanced: SRE professional perspective

At SRE level, Terraform is a change-management system for critical infrastructure. You must design ownership boundaries, state isolation, policy enforcement, provider upgrade strategy, drift detection, emergency rollback, and least-privilege automation.

Advanced SRE expectations:

- avoid giant shared state files
- design module contracts and versioning
- enforce policy as code
- protect state secrets
- plan safe migrations for production resources

---

### 8. Cloud Architecture And AWS

#### Beginner: teacher to a new student

Cloud platforms provide compute, networking, storage, databases, identity, and monitoring as managed services. Learn the basic building blocks before memorizing service names.

Start with:

- compute: VM, container, serverless
- network: VPC, subnet, route table, load balancer
- storage: object, block, file
- identity: users, roles, policies
- monitoring: metrics, logs, alarms

#### Intermediate: teacher to a new engineer

Now learn how cloud services connect. Understand high availability, autoscaling, IAM roles, security groups, private networking, managed databases, object storage lifecycle, backups, and cost visibility.

You should be able to:

- design a simple public web service
- separate public and private subnets
- apply least-privilege IAM
- configure load balancing and autoscaling
- explain backup, restore, and disaster recovery basics

#### Advanced: SRE professional perspective

At SRE level, cloud architecture is about reliability, security, cost, and operability. You must reason about regional failure, dependency limits, quota management, managed-service SLAs, data durability, incident response, and cost-risk trade-offs.

Advanced SRE expectations:

- design multi-AZ and multi-region patterns when justified
- define RTO and RPO clearly
- manage quotas and capacity proactively
- protect identity boundaries
- balance managed services against lock-in and operational burden

---

### 9. Configuration Management And Ansible

#### Beginner: teacher to a new student

Configuration management keeps servers consistent. Ansible connects to machines, runs tasks, and applies desired configuration using playbooks.

Start with:

- inventory
- playbook
- task
- module
- variable
- handler

#### Intermediate: teacher to a new engineer

Now learn roles, templates, idempotency, conditionals, secrets, tags, and testing. Understand that a playbook should be repeatable and safe.

You should be able to:

- write idempotent playbooks
- organize roles
- template configuration files
- restart services only when configuration changes
- handle secrets with vault or external secret systems

#### Advanced: SRE professional perspective

At SRE level, configuration management is fleet safety. You must plan blast radius, staged rollout, failure recovery, inventory accuracy, compliance, and drift control.

Advanced SRE expectations:

- roll out changes in batches
- verify before and after state
- design emergency rollback
- avoid snowflake servers
- integrate config management with monitoring and change records

---

### 10. Git And Version Control

#### Beginner: teacher to a new student

Git records changes to files. Learn repository, commit, branch, merge, remote, pull, and push. Practice small commits with clear messages.

Start with:

- `git status`
- `git add`
- `git commit`
- `git branch`
- `git pull`
- `git push`

#### Intermediate: teacher to a new engineer

Now learn team workflows. Understand pull requests, code review, rebasing, resolving conflicts, tags, release branches, and reverting safely.

You should be able to:

- create clean pull requests
- resolve merge conflicts
- use branches for isolated work
- revert bad changes safely
- write useful commit messages

#### Advanced: SRE professional perspective

At SRE level, Git is the audit trail for production changes. You must connect Git history to incident timelines, deployment systems, compliance, and rollback strategy.

Advanced SRE expectations:

- protect main branches
- require review for production-impacting changes
- sign or verify sensitive commits when needed
- use GitOps for declarative infrastructure
- trace incidents back to changes quickly

---

### 11. Data Systems: SQL And Kafka

#### Beginner: teacher to a new student

SQL stores structured data in tables. Kafka moves streams of events between systems. Learn tables, rows, columns, indexes, topics, partitions, producers, and consumers.

Start with:

- basic SELECT queries
- primary keys and indexes
- topic and partition
- producer and consumer
- consumer group

#### Intermediate: teacher to a new engineer

Now learn performance and reliability. For SQL, study query plans, locking, transactions, connection pools, backups, and replication. For Kafka, study offsets, retention, partitioning, lag, retries, and schema compatibility.

You should be able to:

- debug slow queries
- explain transaction isolation basics
- monitor replication and backup health
- understand Kafka consumer lag
- choose partition keys carefully

#### Advanced: SRE professional perspective

At SRE level, data systems are stateful reliability risks. You must reason about durability, consistency, recovery, reprocessing, failover, capacity, and data-loss blast radius.

Advanced SRE expectations:

- design backup and restore drills
- define RPO and RTO for data systems
- plan schema changes safely
- handle poison messages and replay storms
- understand when eventual consistency is acceptable

---

### 12. Security, Code Quality, And Platform Guardrails

#### Beginner: teacher to a new student

Security means protecting systems from misuse. Code quality means reducing defects before production. Learn authentication, authorization, secrets, dependencies, static analysis, and vulnerability scanning.

Start with:

- identity
- permissions
- secrets
- dependency versions
- code scanning
- least privilege

#### Intermediate: teacher to a new engineer

Now learn CI security gates, SonarQube quality checks, dependency scanning, container scanning, secret scanning, RBAC, admission policies, and audit logs.

You should be able to:

- prevent secrets in Git
- read vulnerability severity and exploitability
- set quality gates without blocking healthy delivery unnecessarily
- apply RBAC correctly
- explain authentication vs authorization

#### Advanced: SRE professional perspective

At SRE level, security is part of reliability. You must design guardrails that reduce production risk while keeping teams productive.

Advanced SRE expectations:

- implement policy as code
- design break-glass access with auditability
- build secure defaults into platforms
- prioritize vulnerabilities based on real exposure
- connect security incidents to operational response

---

### 13. YAML, APIs, And Reverse Proxies

#### Beginner: teacher to a new student

YAML is a human-readable configuration format. APIs let systems communicate. Reverse proxies sit in front of applications and route traffic.

Start with:

- YAML indentation and lists
- HTTP methods: GET, POST, PUT, DELETE
- status codes: 2xx, 3xx, 4xx, 5xx
- headers and body
- proxy routing

#### Intermediate: teacher to a new engineer

Now learn schema validation, Kubernetes manifests, API contracts, ingress routing, TLS termination, path rewriting, rate limiting, and authentication headers.

You should be able to:

- write valid Kubernetes YAML
- debug invalid manifests
- inspect HTTP requests and responses
- configure ingress rules safely
- explain reverse proxy behavior

#### Advanced: SRE professional perspective

At SRE level, APIs and proxies define reliability boundaries. You must reason about versioning, compatibility, timeout budgets, retries, authentication propagation, observability, and traffic shaping.

Advanced SRE expectations:

- design stable API contracts
- avoid retry storms
- set proxy timeouts intentionally
- protect upstreams with rate limits
- debug traffic through multiple proxy layers

---

### 14. Capstone Learning Path

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

### Interview Readiness Checklist

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

---

## [SRE] Foundations: Senior And Staff Interview Operating Manual

## Foundations: Senior And Staff Interview Operating Manual

This guide sets the bar for how to answer across the whole prep pack.

### What Senior Interviewers Actually Want

They are usually testing whether you can:

- reason from first principles under ambiguity
- reduce blast radius before chasing elegance
- connect app symptoms to OS, network, runtime, and control-plane behavior
- make safe operational decisions with incomplete information
- explain tradeoffs clearly and calmly
- think in failure domains, not just components

At staff level, they also want:

- platform judgment
- strong defaults and guardrails
- understanding of organizational and operational coupling
- ability to choose what not to centralize
- awareness of cost, complexity, and operator burden

### The Senior Answer Template

When you answer a troubleshooting or design question, use this structure:

1. Clarify the real goal and constraints.
2. Name the likely layers or failure domains.
3. State the most informative next checks.
4. Explain what evidence would change your mind.
5. Propose mitigation before perfect diagnosis if user impact is active.
6. Close with prevention and validation.

If you skip the first two steps, answers often sound reactive instead of senior.

### The Failure-Domain Habit

Always ask where a problem can live:

- single process
- single host
- single node pool
- single rack or zone
- single cluster
- region
- shared dependency
- control plane
- deploy or config domain
- identity or policy domain

This is one of the fastest ways to sound senior.

### The Symptom Stack

Translate vague symptoms into stacks:

- "the app is slow"
  - DNS
  - TCP connect
  - TLS
  - request queueing
  - app CPU
  - lock contention
  - database wait
  - retries

- "the cluster is broken"
  - scheduler
  - kubelet
  - CNI
  - kube-proxy or dataplane
  - container runtime
  - node pressure
  - stale endpoints
  - auth or admission

### Mentor Mode: How To Sound Senior In Troubleshooting

Bad style:

- "I would check logs and metrics and then debug networking."

Better style:

- "First I would split host-local versus dependency latency. I’d compare one healthy node and one unhealthy node, check request path timings, then inspect TCP state, retransmits, and node pressure before blaming the app."

Great style:

- "Because the symptom is intermittent and load-correlated, I’m prioritizing queueing, DNS, conntrack, and dependency saturation over static config errors. I would first compare a good node and bad node, check `ss -s`, packet retransmits, app latency breakdown, and node PSI to decide whether the host is overloaded, network-impaired, or waiting on a dependency."

### Mentor Mode: How To Sound Senior In System Design

Do not start with products. Start with constraints.

Use this order:

1. users and traffic shape
2. SLOs and latency target
3. consistency needs
4. failure domains
5. core data model
6. request path
7. observability and rollback
8. security and access control
9. cost and operational complexity

### Common Staff-Level Traps

- treating Kubernetes as the system instead of one layer of the system
- assuming healthy averages mean healthy tail latency
- confusing node capacity with safe allocatable capacity
- assuming a load balancer health check proves real user health
- treating retries as harmless
- assuming one cloud abstraction cleanly maps to another
- proposing aggressive automation without blast-radius controls

### Senior Signals By Domain

#### Linux

- you can distinguish CPU saturation from throttling, steal, lock contention, and IO wait
- you understand reclaim and pressure before OOM
- you use namespaces and cgroups as real debugging tools, not vocabulary

#### Networking

- you narrate packet flow clearly
- you distinguish DNS, routing, filtering, handshake, and application delay
- you reason about MTU, retransmits, conntrack, backlog, and NAT state

#### Kubernetes

- you connect Service issues to EndpointSlice, kube-proxy or dataplane, readiness, and CNI
- you understand kubelet and node behavior during stress
- you treat control-plane lag and eventual consistency as real system behavior

#### Reliability

- you define actionable alerts
- you can explain SLO tradeoffs
- you know how to lead with mitigation while preserving evidence

### Practice Rule

For every challenge in this pack, add these four lines to your own answer:

- first likely failure domain:
- fastest disambiguating signal:
- safest immediate mitigation:
- long-term prevention:

---

## [SRE] Mock Interview 1: Linux, Networking, and Kubernetes Troubleshooting

## Mock Interview 1: Linux, Networking, and Kubernetes Troubleshooting

### Format and Intent

This is a 45–60 minute technical depth interview. The interviewer is not testing whether you know the answer — they are testing how you reason under uncertainty. Every question has a diagnostic structure: you are expected to form hypotheses, name the tools that produce evidence, and explain what each result would mean. Jumping to a conclusion without naming evidence is a red flag. Staying vague about the Linux or network layer when the question demands it is also a red flag.

Prepare to be interrupted with "what command gives you that?" and "what does a bad result look like?" Practice answering these out loud before you run them mentally.

**Suggested timing per question:** 4–6 minutes verbally, 2–3 minutes written debrief after the mock.

---

### Question 1

**"A service is timing out only from some nodes in a cluster. Walk me through your first ten minutes."**

**Time guidance:** 5–6 minutes. This is a scoping and triage question. Do not solve it — scope it methodically.

**What a strong answer covers:**
- Establishes the boundary: is this all pods on affected nodes, one namespace, one service, or one destination? Use `kubectl get pods -o wide` and compare node placement.
- Checks whether the pattern is node-local (kube-proxy, iptables, CNI agent) or rack/AZ-local (BGP, fabric, MTU).
- Names specific commands: `curl -v`, `traceroute`, `ss -s`, `iptables -L -n -v`, `tcpdump -i any -nn`, `conntrack -L`.
- Considers ECMP hashing and whether flows are consistently routing to one broken backend.
- Separates DNS resolution failures from TCP connect failures from HTTP-level errors early.

**What a weak answer looks like:**
- "I would check the logs and see if there are errors." No commands named, no failure domain reasoning.
- Jumps to "probably a node issue" without explaining how the node-specific pattern was confirmed.

**Sample answer skeleton:**
> "First I confirm the scope: I run `kubectl get pods -o wide` and map which pods are affected versus which nodes they sit on. If pods on nodes A and C fail but nodes B and D succeed, the pattern is node-local. I then check whether this is a new rollout — `kubectl rollout history` — or a pre-existing condition. On an affected node I'd run `curl -v <service-ip>:<port>` directly to test connectivity without DNS, then `ss -s` to check for socket exhaustion. I'd check kube-proxy logs with `journalctl -u kube-proxy --since '10m ago'` and validate iptables rules with `iptables -L KUBE-SERVICES -n -v`. If retransmits show up in `ss -i`, I look at the physical layer — MTU mismatch, bad NIC queue, or a failed BGP peer at the ToR switch."

---

### Question 2

**"Explain how a packet reaches a Pod from a client outside the cluster."**

**Time guidance:** 4–5 minutes. This is a conceptual depth check. Walk the full path without skipping layers.

**What a strong answer covers:**
- External load balancer (L4 or L7), NodePort or LoadBalancer service, kube-proxy iptables/IPVS rules doing DNAT, routing to the pod CIDR via CNI (Flannel/Cilium/Calico), container veth pair, pod netns.
- Notes that reply packets reverse the path and that conntrack is what makes the stateful DNAT work.
- Mentions where MTU issues can appear (VXLAN encapsulation, IPsec, GRE tunnels adding overhead).
- If Cilium is in scope: eBPF replaces iptables rules; kube-proxy may be absent; XDP handles early path.
- Can state where to look when each hop fails.

**What a weak answer looks like:**
- Stops at "the packet hits the Service and gets routed to a Pod." Does not explain DNAT, conntrack, or the CNI veth.
- Cannot name where MTU or encapsulation overhead enters the picture.

**Sample answer skeleton:**
> "The packet enters the cluster at the cloud LB, which forwards to a healthy node's NodePort or directly to a pod via the LB's backend pool. On the node, kube-proxy (or Cilium eBPF) has installed DNAT rules — the packet's destination is rewritten from the Service ClusterIP to the selected Pod IP. The kernel's conntrack table records this translation so the reply can be un-NATted on the way back. The CNI plugin is responsible for delivering the packet from the node's network namespace to the pod's veth pair inside the pod's netns. In an overlay CNI like Flannel VXLAN, the packet is encapsulated in UDP before crossing the node boundary, which adds 50 bytes of overhead. If the physical MTU is 1500, the effective pod MTU must be set lower or you get silent fragmentation and retransmits."

---

### Question 3

**"A Pod is Ready, but requests still fail. Give me five causes and how you would disprove each one."**

**Time guidance:** 5–6 minutes. Depth over speed. Name the command for each disproof.

**What a strong answer covers:**
- Readiness probe passes but the app is partially broken (bad connection pool, missing env var): `kubectl exec` + `curl localhost:<port>/healthz` with a deeper path.
- Service selector does not match pod labels: `kubectl get endpoints <svc>` — if the pod IP is absent, selector mismatch confirmed.
- kube-proxy lag: iptables rules not yet updated after pod replacement — compare endpoint list vs iptables DNAT chain timestamps.
- Network policy blocking traffic from the caller's namespace: `kubectl get netpol -A` and trace the policy against source/destination labels.
- Application-level TLS cert mismatch or expired cert even though the container is up: `openssl s_client -connect <pod-ip>:<port>` from another pod.

**What a weak answer looks like:**
- Lists causes without naming how to disprove them. "Could be a network policy" with no follow-up.
- Does not distinguish between the probe path and the actual serving path.

**Sample answer skeleton:**
> "Cause one: probe passes a shallow path but the real handler is broken. Disproof: exec into the pod and curl the actual endpoint. Cause two: selector mismatch — `kubectl get endpoints` shows the pod IP is missing. Cause three: stale iptables rule on the caller's node — compare the pod IP in `iptables -L KUBE-SEP-* -n` versus the current pod IP. Cause four: NetworkPolicy block — `kubectl get netpol` in both namespaces, trace ingress rules. Cause five: the app is bound to 127.0.0.1 not 0.0.0.0, so cluster traffic can't reach it — `ss -tlnp` inside the pod confirms the bind address."

---

### Question 4

**"Why can memory pressure hurt latency before any OOM kill occurs?"**

**Time guidance:** 4 minutes. This is a Linux internals question. Be specific about kernel behavior.

**What a strong answer covers:**
- Page reclaim: kswapd wakes up and scans page lists, competing for CPU with application threads.
- Dirty page writeback: if the app writes frequently, the kernel throttles writes when dirty_ratio is hit — this introduces blocking I/O inside what looks like memory operations.
- Swap: even small amounts of swap activity cause microsecond-to-millisecond delays when hot pages are evicted and re-faulted.
- cgroup memory limits: when a cgroup approaches its limit, direct reclaim runs synchronously in the application's call path, adding latency to any allocation.
- THP (Transparent Hugepages): compaction runs to create 2MB pages; compaction scans and pauses can introduce milliseconds of stall even without OOM.

**What a weak answer looks like:**
- "The system starts swapping and slows down." Correct but not enough depth.
- Does not distinguish kswapd (async) from direct reclaim (synchronous, in application path).

**Sample answer skeleton:**
> "The most impactful mechanism is direct reclaim. When a cgroup's memory usage is near its limit, any new allocation triggers synchronous page reclaim inside the calling thread's context — that allocation call now takes milliseconds instead of nanoseconds. This shows up as P99 spikes without OOM events. kswapd also competes for CPU in the background. If dirty page ratio is high, kernel writeback throttling can stall writes inside the app even when the app thinks it is doing in-memory work. I'd confirm with `sar -B`, `cat /proc/vmstat | grep pgmajfault`, and cgroup memory.stat to see reclaim events."

---

### Question 5

**"What does the kubelet do that matters operationally during a bad rollout?"**

**Time guidance:** 4–5 minutes. Focus on kubelet's active role, not just pod scheduling.

**What a strong answer covers:**
- kubelet enforces liveness and readiness probes and acts on them: it restarts containers on liveness failure and removes pods from endpoint slices on readiness failure.
- kubelet garbage collects dead containers and images — during a rollout with crash loops, image layer space can fill up.
- kubelet reports NodeConditions (MemoryPressure, DiskPressure, PIDPressure) which the scheduler and controllers react to.
- kubelet enforces cgroup limits and will OOM-kill a container that exceeds its memory limit.
- During eviction, kubelet follows priority classes — this matters for which pods survive when nodes are under pressure.

**What a weak answer looks like:**
- "kubelet starts and stops pods." Does not explain which signals kubelet acts on or what downstream effects follow.
- Does not mention probe enforcement or eviction.

**Sample answer skeleton:**
> "During a bad rollout the kubelet is doing several things that matter. First, it is running the readiness probe against new pods — if the probe fails, the pod stays out of the endpoint slice and traffic is not sent to it. This is the mechanism that (should) protect the service if rollout detection works. Second, it is running the liveness probe — if the app crashes into a broken state that passes liveness, the kubelet will not restart it, which is the subtle misconfiguration risk. Third, if new pods are crash-looping, the kubelet is pulling images and starting containers repeatedly — that uses ephemeral storage and can trigger DiskPressure. Finally, kubelet emits events that surface in `kubectl describe pod` and in the control plane — those are usually the first signal to an on-call engineer."

---

### Question 6

**"A DNS issue is suspected, but application teams insist 'the network is down.' How do you arbitrate with evidence?"**

**Time guidance:** 4–5 minutes. This is about structured evidence collection and communication under pressure.

**What a strong answer covers:**
- Separates DNS resolution failure from TCP connectivity failure from HTTP failure — each has a different test.
- Tests DNS directly: `dig @<coredns-ip> <service-name>.namespace.svc.cluster.local` from inside a pod.
- Tests raw connectivity: `curl -v <pod-ip>:<port>` bypassing DNS, to prove the network path works.
- Checks CoreDNS health independently: pod restarts, CPU throttling (`kubectl top pod -n kube-system`), upstream DNS resolution.
- Presents the evidence neutrally: "DNS resolution failed with NXDOMAIN from CoreDNS at 15:32; TCP connect to the pod IP succeeds; therefore the network is up and DNS is the failure."

**What a weak answer looks like:**
- "I would check the logs and explain to the team what I found." No specific tests, no evidence structure.
- Takes sides ("they're wrong") instead of using evidence to narrow the scope.

**Sample answer skeleton:**
> "I run two tests in parallel from inside the affected pod. Test one: `curl -v http://<direct-pod-ip>:<port>/` — this bypasses DNS entirely. If it succeeds, the network is not down and DNS is the issue. Test two: `dig @10.96.0.10 <service>.namespace.svc.cluster.local` — if this returns NXDOMAIN or times out, CoreDNS is the problem. I check CoreDNS pods for restarts and CPU throttling. I present the result as a timeline: TCP works, DNS fails at time X, CoreDNS pod was at 98% CPU limit. That is the arbitration. The network path is fine; the DNS resolver is the bottleneck."

---

### Question 7

**"You see retransmits, elevated tail latency, and partial rack impact. What layers do you test first and why?"**

**Time guidance:** 5 minutes. Layered diagnostic reasoning is the point.

**What a strong answer covers:**
- Rack-partial pattern strongly implicates physical: a bad ToR switch, a degraded uplink, or a failed NIC on one or two nodes.
- First checks: `ethtool -S <iface>` for NIC error counters, `ip -s link` for TX/RX errors and drops, `/proc/net/dev`.
- Second layer: checks whether affected pods all share the same physical host or the same ToR — `kubectl get pods -o wide` plus node-to-rack mapping.
- Network layer: ECMP routing asymmetry causing one path to be congested while others are idle.
- Distinguishes TCP retransmits (application-visible, causes latency jitter) from ethernet-level retransmits (layer 2, may be invisible to applications but indicate physical degradation).

**What a weak answer looks like:**
- Starts with application logs. Physical symptoms are described but no physical-layer tools are named.
- Does not use the "partial rack" clue to narrow scope early.

**Sample answer skeleton:**
> "Partial rack impact tells me this is probably physical before it is logical. I start with `ethtool -S eth0` on nodes in the affected rack — I am looking for `tx_errors`, `rx_missed_errors`, and `rx_crc_errors`. Simultaneously I check `ip -s link` for drops. If one node has a degraded NIC, I see asymmetric error counts compared to healthy nodes. If the NIC is clean, I look at the ToR switch: is there a port flapping? I get this from the network team's syslog or from SNMP counters. Only after ruling out physical do I look at iptables conntrack overflow or kernel ring buffer drops with `dmesg | grep -i drop`."

---

### Question 8

**"What are requests, limits, and QoS really buying you in a multi-tenant platform?"**

**Time guidance:** 4 minutes. This is a policy and system design question disguised as a K8s question.

**What a strong answer covers:**
- Requests determine scheduling: the scheduler will not place a pod on a node unless the sum of requests fits the node's allocatable capacity.
- Limits are enforced by cgroups at runtime: CPU limit triggers CFS throttling; memory limit triggers OOM kill.
- QoS class (Guaranteed, Burstable, BestEffort) determines eviction order and OOM score — important for protecting high-priority workloads under node pressure.
- In multi-tenant settings, a single badly configured workload without limits can cause noisy neighbor CPU or memory issues.
- Requests and limits alone are not enough — namespace ResourceQuotas and LimitRanges enforce guardrails at the tenant level.

**What a weak answer looks like:**
- "Requests tell K8s how much CPU/memory a pod needs." Technically right but misses the scheduling and enforcement mechanics.
- Does not mention QoS classes or eviction behavior.

**Sample answer skeleton:**
> "Requests are a scheduling hint and a QoS input. The scheduler packs pods until the sum of requests exceeds the node's allocatable. Limits are a runtime enforcement: the Linux CFS scheduler enforces CPU limits with quota cycles, and the cgroup memory controller enforces memory limits. The QoS class is derived from the relationship between requests and limits — Guaranteed means they are equal, which gives the pod a low OOM score and makes it last to be evicted. In a multi-tenant platform, Guaranteed QoS for critical control-plane workloads means they survive node memory pressure that would evict BestEffort pods first. I'd also add LimitRanges so tenants who omit limits still get defaults."

---

### Question 9

**"A probe configuration caused cascading failure during peak load. Explain the mechanism."**

**Time guidance:** 5 minutes. Walk through the failure chain step by step.

**What a strong answer covers:**
- A liveness probe with too-short a timeout and too-low a failure threshold: under load, the app is slow to respond, the probe fails, kubelet restarts the container, the restart causes more latency elsewhere (lost connections, cold cache), which causes more probe failures.
- A readiness probe misconfiguration: probe passes but the app is not ready (shallow health check), traffic is sent to an overwhelmed pod, which fails, which triggers more retries, which causes overload.
- Probe timeout being shorter than the app's P99 under load: normal load causes normal probe failures during bursts.
- Cascading effect: as pods are restarted, fewer pods handle the same traffic, increasing per-pod load, causing more probe failures, causing more restarts — a death spiral.
- Mitigation: generous timeouts, initialDelaySeconds, startupProbe to avoid premature liveness during warm-up.

**What a weak answer looks like:**
- "The probe was configured wrong and pods kept restarting." No failure chain, no explanation of why restarts cause more restarts.

**Sample answer skeleton:**
> "The mechanism is a feedback loop. Under peak load, the app is responding to real requests at P99 of 800ms. The liveness probe has a `timeoutSeconds: 1` and `failureThreshold: 2`, so two 1-second probe timeouts in a row trigger a restart. During peak load, every pod is slow enough to fail two consecutive probes. kubelet begins restarting pods serially. Each restart removes a pod from the endpoint set — the remaining pods handle proportionally more traffic, pushing their latency higher. This causes them to fail probes faster. Within 2–3 minutes, the deployment has restarted most of its pods during peak load, drained the connection pool, and cleared any in-memory cache. Traffic is now hitting cold pods in a death spiral."

---

### Question 10

**"Give me an example of a production issue where Linux, networking, and Kubernetes all interacted."**

**Time guidance:** 6 minutes. This is behavioral and technical combined. Use a real or realistic scenario.

**What a strong answer covers:**
- Tells a structured story: context, symptoms, hypothesis chain, diagnosis, fix, prevention.
- Shows that the candidate can reason across layers without compartmentalizing.
- The root cause should be genuinely cross-layer (not just "K8s thing" or "network thing").
- Names the tools used at each layer and what each one revealed.
- Includes what was learned and what changed as a result.

**What a weak answer looks like:**
- A vague story: "We had a networking issue and eventually found a K8s config problem." No commands named, no failure chain.
- A single-layer story that is relabeled as multi-layer.

**Sample answer skeleton:**
> "We had intermittent 503s in one region. Pods were healthy, endpoints were populated, logs showed nothing. I ran `tcpdump` on the affected node and saw SYN packets arriving but no SYN-ACK. The conntrack table was full — `sysctl net.netfilter.nf_conntrack_max` was at its default of 65536, and we had scaled to 200+ pods per node during a load test. The conntrack overflow silently dropped new connections. This was a Linux kernel parameter, triggered by a Kubernetes scaling event, on a network path that only used conntrack because kube-proxy was in iptables mode. Fix: raised nf_conntrack_max and nf_conntrack_buckets, added monitoring on conntrack usage. Prevention: added a node-level DaemonSet that monitors conntrack fill rate and alerts before saturation."

---

### Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | Names specific commands unprompted. Explains what output means, not just what to run. Reasons through failure chains. Uses "partial rack" or "some nodes" clues to narrow the scope early. Distinguishes probe paths from serving paths. |
| Medium | Concepts are mostly correct but generic. Commands are named only after probing. Does not reach the kernel or network layer without prompting. Treats K8s objects as the only layer of abstraction. |
| Weak | Stays at YAML or dashboard level. Uses "check the logs" as a primary diagnostic tool without naming which logs or what to look for. Cannot describe a failure chain. Cannot name commands for more than one layer. |

---

### Self-Debrief Template

After each practice run, write one sentence per item:

1. Which question took longest? Was that appropriate for the depth required?
2. Which answer stayed at the YAML/dashboard layer when it should have gone deeper?
3. Did you name commands or tools without prompting on at least 7 of 10 questions?
4. Where did you jump to a single root cause too early?
5. Did you use the clues in the question (partial rack, some nodes, peak load) to narrow the scope?
6. What is one mechanism you described clearly, and one you would reread before the next run?

---

## [SRE] Mock Interview 2: Distributed Systems, HA, Low Latency, and Resilience

## Mock Interview 2: Distributed Systems, HA, Low Latency, and Resilience

### Format and Intent

This is a 60-minute system design interview with SRE depth. Unlike a pure design interview, the interviewer here expects you to lead with failure modes, not feature enthusiasm. Every design decision should be accompanied by an explicit tradeoff: what does this buy you, what does it cost, what breaks first if the assumption changes?

The questions are open-ended by design. A strong candidate narrows them with requirements before drawing boxes. A weak candidate draws boxes immediately and adds requirements as an afterthought.

**Suggested timing per question:** 6–8 minutes for design questions, 3–4 minutes for conceptual questions.

Practice this out loud. The difference between a well-structured verbal answer and an unstructured one is stark on distributed systems questions.

---

### Question 1

**"Design a low-latency control-plane API used by many internal services across zones."**

**Time guidance:** 7–8 minutes. Start with requirements before any architecture.

**What a strong answer covers:**
- Opens with clarifying questions: what is the latency target (P99)? What are the consistency requirements — can callers tolerate stale reads? What is the write rate? How many internal callers?
- Proposes a design with a local read path (per-zone caching or read replicas) to avoid cross-zone latency on the critical read path.
- Names the consistency model explicitly: eventual for reads, strong for writes to a primary, with bounded staleness for caches.
- Discusses leader election or primary routing (etcd, Raft, or external coordinator) for write coordination.
- Includes a client-side retry strategy with exponential backoff and jitter, plus circuit breakers to prevent cascade when the control plane is degraded.

**What a weak answer looks like:**
- Immediately proposes "a REST API behind a load balancer with a database." No latency reasoning, no zone topology consideration.
- Does not address what happens when the API is slow or partially available.

**Sample answer skeleton:**
> "Before I design anything: what is the P99 latency target and is it for reads or writes? Are callers tolerant of bounded staleness, say 1 second? Is this read-heavy? Assuming read-heavy with strong-write, I'd put a replicated in-memory store (like a per-zone Redis cluster or a distributed cache) in front of a strongly-consistent write log. Reads hit the local zone replica. Writes go to the primary and replicate asynchronously. Cache invalidation is event-driven via a change stream. For the unavailability case: callers get a circuit breaker that returns last-known-good data after N failures, so the control plane being slow doesn't immediately take down callers. I'd set SLOs on the read P99 per zone separately from write latency."

---

### Question 2

**"How would you detect and survive overload caused by a successful product launch?"**

**Time guidance:** 6 minutes. Detection and survival are both required — do not cover only one.

**What a strong answer covers:**
- Detection: leading indicators before service impact — queue depth, request rate acceleration, error rate on backends even while frontend appears healthy, saturation metrics approaching capacity.
- Survival mechanisms: load shedding (drop lowest-priority traffic before saturation), backpressure propagation (upstream callers are told to slow down), horizontal auto-scaling pre-warmed before the event.
- Pre-event preparation: load test to establish capacity baselines; set traffic targets and have runbooks for staged scale-out; coordinate with capacity team on quota pre-provisioning.
- During event: feature flags to disable expensive operations (e.g., turn off heavy analytics endpoints), graceful degradation of non-essential features.
- Post-event: review which capacity signals fired first and adjust alerting thresholds.

**What a weak answer looks like:**
- "We would scale up." No detection signals named, no priority traffic shedding, no pre-event strategy.
- Does not distinguish detection (knowing overload is coming) from survival (protecting the service once it arrives).

**Sample answer skeleton:**
> "Detection comes first. I'd instrument request rate acceleration with a derivative metric — if req/s is growing at 20% per minute, that is a leading indicator before error rate spikes. I'd also watch queue depth and backend saturation metrics. For survival: load shedding at the ingress layer (drop or 503 non-critical traffic classes by authenticated tier), with priority lanes for core flows like checkout or auth. Auto-scaling should be pre-warmed, not reactive — for a known launch we'd scale to estimated peak minus 20% in advance and set the auto-scaler ceiling above. During the event, feature flags disable expensive non-essential paths. The key is: shedding and degradation preserve the core service when capacity math doesn't work out."

---

### Question 3

**"What are the biggest causes of tail latency in distributed systems?"**

**Time guidance:** 4–5 minutes. Be specific and mechanistic, not just categorical.

**What a strong answer covers:**
- Queuing delay: even a lightly loaded system with high variance in request service time produces a long tail. Little's Law applies — queue depth times service time equals latency.
- GC pauses (JVM or Go): stop-the-world GC pauses of 10–100ms create P99 spikes that are invisible to CPU metrics.
- Head-of-line blocking: a slow request at the front of a connection's queue delays all requests behind it (relevant in HTTP/1.1, and partially in HTTP/2 with many streams).
- Fan-out amplification: a request that fans out to N backends has a latency of max(backend latencies), not average — the tail of the ensemble grows with N.
- Stragglers: in large fan-out architectures, one slow node defines the response time. Hedged requests (send a duplicate after a short delay, cancel when first response arrives) reduce this.

**What a weak answer looks like:**
- "Network latency and slow databases." Not wrong, but does not engage with the distribution mechanics.
- Cannot explain why P99 is disproportionately worse than P50 in a fan-out system.

**Sample answer skeleton:**
> "The most underappreciated cause is fan-out amplification. If a request fans out to 100 shards, the total latency is the maximum across 100 distributions. Even if each shard has a P99 of 10ms, the chance that at least one shard takes 10ms on a given request is near-certain. With 100 shards, your effective P99 is roughly the P99.99 of a single shard. The mitigation is hedged requests with a short speculative delay. Beyond that: GC pauses in managed runtimes create P99 spikes that are hard to attribute, queuing delay increases non-linearly as utilization approaches 100%, and TCP head-of-line blocking on shared connections concentrates slow requests."

---

### Question 4

**"Compare active-active and active-passive for a service with strict availability goals."**

**Time guidance:** 5 minutes. Frame this as a tradeoff, not a recommendation.

**What a strong answer covers:**
- Active-active: all nodes serve traffic simultaneously. Failover is instant because no promotion is needed. Requires that writes be either conflict-free (CRDT, last-write-wins with causal ordering) or routed to the same primary by key.
- Active-passive: one node is primary, standby is promoted on failure. Failover takes time (detection + promotion + DNS/LB update). Simpler consistency model. Risk of split-brain if the primary is slow but not dead.
- Strict availability goal pushes toward active-active to eliminate failover time. But active-active requires harder consistency engineering.
- Practical hybrid: active-active for reads (strong availability, tolerates node loss), active-passive for writes (simpler consistency, accept brief write unavailability on failover).
- Split-brain risk in active-passive: use fencing tokens or STONITH to guarantee the old primary cannot accept writes after promotion.

**What a weak answer looks like:**
- "Active-active is better because it has no single point of failure." Does not address the consistency complexity or split-brain risk.

**Sample answer skeleton:**
> "The tradeoff is consistency complexity versus failover time. Active-passive is operationally simpler — one primary, one standby, clear write path — but failover takes time: detection is 10–30 seconds, promotion adds more. For a service with a 99.99% availability SLO, that failover time may burn through the annual error budget in one incident. Active-active eliminates failover time but requires you to reason about concurrent writes. If the service is read-heavy, active-active reads with active-passive writes is a practical middle ground. The risk I'd highlight is split-brain in active-passive: if the primary is network-partitioned but not dead, you need a reliable fencing mechanism before the standby accepts writes."

---

### Question 5

**"When do retries help, and when do they make the incident worse?"**

**Time guidance:** 4 minutes. Think about retry storms, idempotency, and amplification.

**What a strong answer covers:**
- Retries help when the error is transient: a momentary network glitch, a pod restart, a connection pool blip. The success rate on the second attempt is high.
- Retries hurt when the service is overloaded: each failed request that retries adds load to an already-struggling service. At 3x retry multiplier, a service at 80% capacity receives 240% load.
- Retry amplification compounds through a call graph: if A retries B and B retries C, a single user request becomes 9 requests at layer C.
- Mitigations: exponential backoff with jitter (spreads retry load over time), retry budget (limit retries to N% of total requests per time window), idempotency keys (so the service can deduplicate retried writes).
- Non-idempotent operations should not be retried without idempotency keys — retrying a payment or an order creation causes double-execution.

**What a weak answer looks like:**
- "Retries help with transient errors. Use exponential backoff." Correct but shallow — no amplification math, no idempotency discussion.

**Sample answer skeleton:**
> "Retries work against transient, low-rate errors — a SYN timeout, a single bad pod. They fail catastrophically under partial overload. If a service is at 70% capacity and experiencing 10% errors, and every caller retries once, the effective load becomes 110%+ of capacity, pushing the error rate higher, causing more retries. This is a retry storm. The fix is a retry budget at the RPC layer — say, allow retries for at most 10% of total requests in a 10-second window. Beyond that, the caller returns an error rather than amplifying. Exponential backoff with jitter reduces synchronization effects. And for writes: any operation that is not idempotent needs an idempotency key sent by the client so the server can deduplicate retried requests."

---

### Question 6

**"How do you design observability for a system where the tracing backend itself can fail?"**

**Time guidance:** 5 minutes. This is about resilience of the observability plane, not just its design.

**What a strong answer covers:**
- Head-based vs. tail-based sampling: head-based sampling decisions are made at trace start, so traces are not lost if the backend is slow (sampled data is just not collected). Tail-based requires buffering until the trace is complete.
- Local buffering and async export: the tracing SDK should buffer spans locally and export asynchronously so that a slow or unavailable tracing backend does not block the application request path.
- Sampling under pressure: when the collector is degraded, reduce the sample rate rather than blocking. This preserves application performance at the cost of trace completeness.
- Metrics as a fallback: structured logs and RED metrics (Rate, Error, Duration) per service should be independently available even when distributed traces are lost, so that incident diagnosis does not require traces.
- Backpressure from the collector: the application SDK should apply a circuit breaker or drop spans rather than queueing indefinitely.

**What a weak answer looks like:**
- "Use a reliable tracing backend like Jaeger." Does not address what happens when the backend is unavailable.

**Sample answer skeleton:**
> "The principle is: observability infrastructure must not be in the critical path of the application. Tracing is asynchronous — spans are batched and exported out-of-band. The SDK buffers locally, drops spans if the buffer fills, and uses a circuit breaker against the collector endpoint. If the tracing backend is down, the application continues serving requests; we lose trace data but not availability. The fallback is RED metrics and structured logs, which should be collected independently via a different pipeline. I'd also tail-based-sample only critical traces and head-sample the rest to reduce collector load. During a collector outage, I'd reduce the global sample rate to near-zero to eliminate export pressure."

---

### Question 7

**"How would you choose between queueing, shedding, and backpressure?"**

**Time guidance:** 5 minutes. These are three fundamentally different flow control mechanisms — compare them with intent.

**What a strong answer covers:**
- Queueing: absorbs short bursts, allows smooth throughput. Fails when the burst lasts longer than the queue drain time — queue depth grows unbounded, latency grows unbounded, and eventually memory is exhausted. Queuing is a latency amplifier for sustained overload.
- Load shedding: reject requests when at or near capacity. Latency stays low for accepted requests. The user experience degrades (errors) but the service stays alive. Best when some requests are lower priority than others.
- Backpressure: the overloaded service signals its callers to slow down. This requires a cooperative protocol (rate limiting headers, TCP flow control, async acknowledgment). It prevents the overload from occurring in the first place.
- Choosing: backpressure is best when callers can slow down safely (async pipelines, batch jobs). Shedding is best when caller latency budget is tight and there is a priority ordering. Queueing is best for genuine bursts that are short relative to service time.

**What a weak answer looks like:**
- "Use a queue to handle traffic spikes." Does not address when queuing makes things worse or how backpressure works.

**Sample answer skeleton:**
> "They solve different problems. Queueing smooths burst traffic but trades latency for throughput — during sustained overload, the queue fills and latency grows without bound. I use queueing only when the overload is transient and I can bound queue depth with a timeout. Shedding is preferable when I need to protect the service at the cost of some requests: reject at the edge, preserve the core. This requires a priority classification. Backpressure is the cleanest solution when the protocol supports it — the overloaded component signals upstream to slow production. In a Kafka pipeline, consumer lag is implicit backpressure. In a gRPC service, I can return RESOURCE_EXHAUSTED and the client should back off. The danger of queueing is the illusion of resilience — the queue is growing, the service looks 'up', but latency is already unacceptable."

---

### Question 8

**"Explain a safe failover decision when data consistency is uncertain."**

**Time guidance:** 5 minutes. Focus on the decision process, not just the mechanism.

**What a strong answer covers:**
- Acknowledges the CAP tradeoff explicitly: if you cannot confirm the standby is consistent with the primary, promoting it trades availability for potential data loss or divergence.
- Fencing: before promoting the standby, attempt to fence the primary — revoke its access credentials, remove it from the LB, or break its storage connection — to prevent split-brain writes.
- Observation window: wait for the standby's replication lag metric to reach zero (if possible) before promoting. If it cannot reach zero (primary is unreachable), make a conscious decision with documented acceptance of potential data divergence up to the last known replication position.
- Rollback criteria: define in advance what state of the primary's data would require reconciliation after failover. Automate detection of divergent writes.
- Human-in-the-loop for uncertain states: fully automated failover is safe only when the system can definitively determine replication state. Under uncertainty, alert a human before promoting.

**What a weak answer looks like:**
- "Promote the standby and reconcile later." Does not address fencing, divergence scope, or the decision process.

**Sample answer skeleton:**
> "The first action is not promotion — it is fencing. I need to guarantee the old primary cannot accept writes while the standby is promoted, or I get divergent state that is very hard to reconcile. If the primary is unreachable (not just slow), I revoke its database credentials or remove its storage mount via the control plane before promoting the standby. Then I check replication lag on the standby: how many bytes or transactions are missing? I document that number, note the time, and accept that those transactions are potentially lost. After promotion I compare primary transaction logs (if the primary recovers) against the standby's committed state to detect divergence. Automated failover only executes if replication lag is below a threshold; above that threshold, a human approves."

---

### Question 9

**"How would you define SLOs for a control-plane service used by CI/CD systems?"**

**Time guidance:** 4–5 minutes. SLOs require a user perspective, not just metrics.

**What a strong answer covers:**
- Identifies the user of the SLO: CI/CD systems care about job success rate and job start latency, not raw API latency — the SLO should reflect the user's experience.
- Distinguishes availability SLOs (proportion of requests that succeed) from latency SLOs (proportion under a threshold).
- Sets a meaningful latency threshold: for a control plane that schedules CI jobs, P95 < 500ms might be the SLO; above that, job start times degrade noticeably.
- Defines a burn rate alert: an SLO without alerting is a metric, not an operational commitment.
- Considers SLO windows and reset: a 28-day rolling window is common; the error budget resets at the window boundary.
- Excludes known planned maintenance from SLO calculations explicitly.

**What a weak answer looks like:**
- "99.9% availability." No user framing, no latency SLO, no burn rate, no error budget.

**Sample answer skeleton:**
> "I start by asking: what does a CI/CD system care about? It cares that job submissions succeed and that jobs start within a predictable time. So my SLOs would be: (1) 99.9% of job submission API calls succeed, measured as non-5xx responses over a 28-day rolling window; (2) 95% of job-start-to-first-event latency is under 2 seconds. The second SLO reflects user experience more than raw API latency. I'd set a fast burn rate alert: if we consume 5% of our monthly error budget in any 1-hour window, page immediately. I'd also define a slow burn alert: 10% of budget consumed in 6 hours, ticket created. Error budget resets monthly. Planned maintenance windows are excluded from SLO calculation if communicated 48 hours in advance."

---

### Question 10

**"What would you test in a game day before trusting this design?"**

**Time guidance:** 5 minutes. Be specific about failure injection, not just "chaos engineering."

**What a strong answer covers:**
- Zone loss: kill all nodes in one AZ and verify that read latency stays within SLO, write availability degrades gracefully, and auto-recovery completes within the recovery time objective.
- Dependency degradation: introduce 200ms latency to the database or upstream service and verify that circuit breakers fire before the control plane's own latency SLO is breached.
- Leader failure: kill the write-primary node and measure the time to election completion and the first successful write on the new primary.
- Overload injection: ramp request rate to 150% of capacity and verify that load shedding activates, priority traffic is preserved, and the service recovers cleanly when load drops.
- Observability: verify that alerts fire within the expected detection window during each failure scenario, and that runbooks correctly describe the observed symptoms.

**What a weak answer looks like:**
- "We'd do a game day and test various failure scenarios." No specific tests, no success criteria, no detection verification.

**Sample answer skeleton:**
> "I'd structure the game day around four failure types. First: AZ loss — drain all nodes in zone-b and verify that the service continues with degraded capacity, latency stays within SLO on the surviving zones, and the auto-scaler compensates within 5 minutes. Second: dependency slowdown — inject 500ms artificial latency on the database connection and verify that the circuit breaker opens before our P99 SLO is breached. Third: primary failure — kill the write leader and measure time-to-first-write on the elected successor. My acceptance criterion is under 30 seconds. Fourth: overload — ramp to 200% of traffic and verify load shedding fires, core flows stay available, and the service recovers cleanly when load drops. After each test, I verify that the alert fired within the expected detection window."

---

### Pressure Follow-Up Questions

These are typically asked mid-answer to test depth. Prepare a 60-second response to each:

- **"What breaks first if one zone is lost?"** — Name the component (write primary, stateful service, cache) and the blast radius on latency and availability.
- **"What breaks first if latency doubles but capacity stays the same?"** — Queueing model: service time doubles, queue depth grows, effective throughput drops. What saturates first?
- **"What breaks first if a dependency returns partial success?"** — Which callers tolerate partial responses? Which ones fail open vs. fail closed?
- **"What gets rolled back and what does not?"** — Stateless config changes roll back easily. Migrated data schemas, consumed Kafka offsets, and written records do not. Name your rollback boundary.

---

### Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | States requirements and constraints before drawing architecture. Names failure modes before naming features. Uses specific numbers (latency targets, retry budgets, error budget percentages). Identifies the consistency model explicitly. Addresses rollback and recovery. |
| Medium | Design is generally correct but generic. Failure modes are named but not quantified. Does not address consistency model or SLO structure. Architecture is boxes-and-arrows without operational depth. |
| Weak | Jumps to architecture immediately without requirements. Does not address what happens when a component fails. Cannot explain the tradeoffs between design alternatives. Treats availability as binary. |

---

### Self-Debrief Template

After each practice run, write one sentence per item:

1. Did you state requirements before drawing any architecture on Q1?
2. Which question did you cover only the happy path on?
3. Did you quantify at least one decision (latency target, retry budget, error rate threshold)?
4. Where did you use vague terms like "resilient" or "scalable" without defining them?
5. Which failure mode in your design did you not have a good answer for?
6. What is one concept (fan-out amplification, backpressure, SLO burn rate) you should reread before the next run?

---

## [SRE] Mock Interview 3: Platform, Cloud, CI/CD, and Security

## Mock Interview 3: Platform, Cloud, CI/CD, and Security

### Format and Intent

This is a 60-minute platform engineering interview testing breadth across cloud, security, and delivery pipelines with staff-level depth on tradeoffs. The interviewer expects you to reason about what to centralize versus what to delegate, where blast radius sits, and how security and reliability interact — especially where one undermines the other if poorly designed.

Questions are intentionally open-ended. Strong candidates narrow them by stating assumptions and constraints. Weak candidates treat every question as an invitation to describe a technology instead of a decision.

**Suggested timing per question:** 5–7 minutes for design questions, 3–4 minutes for conceptual/behavioral questions.

---

### Question 1

**"Design a secure internal platform on GCP for services running mainly on GKE."**

**Time guidance:** 7–8 minutes. This is a scoping question before it is a design question.

**What a strong answer covers:**
- Clarifies scope: number of teams, trust tiers, compliance requirements (SOC 2? internal only?), and whether this is greenfield or migration.
- Identity and access: Workload Identity for pod-level GCP credentials (no service account key files), IAM with least privilege, separate GCP projects per environment (dev/staging/prod) for blast radius isolation.
- Network: VPC with private GKE clusters, no public node IPs, Cloud NAT for egress, Private Service Connect or VPC peering for managed services, network policies inside the cluster enforced by Cilium or Calico.
- Secret management: Secrets Manager or Vault, mounted at runtime via the CSI driver — not baked into images.
- Supply chain: Artifact Registry with Container Analysis for vulnerability scanning, Binary Authorization policy to block unscanned or unsigned images in prod.

**What a weak answer looks like:**
- "I'd use GKE with Cloud SQL and Pub/Sub." Names GCP services but does not address identity model, network segmentation, or secret handling.
- Treats this as a capacity design question rather than a security architecture question.

**Sample answer skeleton:**
> "My first constraints: private cluster (no public node or master IPs), Workload Identity for pod credentials (no key files in Secrets), and per-environment GCP projects so a misconfigured dev workload cannot reach prod. Network-wise: GKE inside a private VPC, Cloud NAT for outbound, Shared VPC if multiple projects need connectivity, and Cilium NetworkPolicies for east-west control inside the cluster. For secrets: Secrets Manager accessed via the CSI secrets driver, not via env vars in manifests. For the supply chain: Artifact Registry with binary scanning, and a Binary Authorization policy in prod that requires an attestation from the scanning pipeline before a pod can be scheduled. For audit: Cloud Audit Logs to BigQuery with 1-year retention."

---

### Question 2

**"What parts of that design would change in AWS, and what should stay conceptually the same?"**

**Time guidance:** 4–5 minutes. This tests portable principles versus vendor-specific mechanics.

**What a strong answer covers:**
- What stays the same: least privilege identity per workload, private network topology, secrets at runtime not in images, per-environment account isolation, signed/scanned artifact policy.
- What changes mechanically: IAM Roles for Service Accounts (IRSA) replaces Workload Identity; AWS Secrets Manager or Parameter Store replaces GCP Secrets Manager; ECR replaces Artifact Registry; security groups plus VPC CNI replace Cloud NAT and Cilium; EKS managed node groups replace GKE node pools.
- Important differences: AWS's multi-account model with AWS Organizations and SCPs is more mature than GCP's folder/project model for enforcing guardrails at scale; AWS PrivateLink for service connectivity.
- The candidate should emphasize that the principles (isolation, least privilege, runtime secrets, supply chain integrity) do not change, only the implementation APIs.

**What a weak answer looks like:**
- Lists AWS equivalents of GCP services without discussing why the principles are portable or where the gaps are.

**Sample answer skeleton:**
> "The conceptual model stays identical: workload identity, private networking, runtime secrets, per-environment isolation, and artifact integrity. The mechanics change. Workload Identity becomes IRSA — IAM roles annotated on Kubernetes service accounts, with the OIDC provider federation managed by EKS. Private cluster networking uses the VPC CNI and private API server endpoint. Secrets use Secrets Manager via the CSI driver or Parameter Store for simpler cases. Artifact supply chain uses ECR with image scanning and a Lambda-backed admission webhook if you want the equivalent of Binary Authorization. The one area where AWS is structurally different is isolation: I'd use AWS Organizations with SCPs to enforce guardrails across accounts, which is more powerful than GCP folder-level IAM."

---

### Question 3

**"How do you know what is running in production came from reviewed source?"**

**Time guidance:** 5 minutes. This is a supply chain security question with operational depth.

**What a strong answer covers:**
- Source-to-image traceability: CI builds are triggered from reviewed commits on protected branches; the image is tagged with the git SHA and built only by the CI system (not developer laptops).
- Image signing: use Cosign to sign images at build time with a key held in the CI system or via keyless signing with OIDC (Sigstore). The signature is stored in the registry alongside the image.
- Admission control: a ValidatingWebhookConfiguration in the cluster verifies the Cosign signature before allowing image scheduling. Images without a valid signature are rejected.
- SBOM generation: the build pipeline produces a Software Bill of Materials attached to the image, enabling vulnerability correlation against the production inventory.
- Audit trail: the registry's push logs tied to CI job IDs, combined with Kubernetes audit logs showing which image was admitted, provide end-to-end traceability.

**What a weak answer looks like:**
- "We use CI/CD to build images from source." Does not address signing, admission control, or how you prove it at runtime.

**Sample answer skeleton:**
> "The chain has four links. First, builds only run in CI on commits that passed code review on a protected branch — no developer can push an image directly to the production registry. Second, the CI pipeline signs the image with Cosign using keyless signing against our OIDC provider, so the signature attests to the CI job and commit that produced it. Third, in the production cluster, a Cosign admission webhook rejects any image that lacks a valid signature from our CI identity. Fourth, we attach an SBOM to every image at build time — this lets us query 'which production pods contain this vulnerable library' without guessing. The audit trail is: git commit, CI job ID, image digest, signature, and admission log entry."

---

### Question 4

**"How would you design a multi-tenant CI platform with different trust levels?"**

**Time guidance:** 6 minutes. Distinguish the trust levels first, then design for each.

**What a strong answer covers:**
- Defines trust tiers explicitly: external contributors (OSS repos), internal developers, platform team, production deploy agents — each with different privilege levels.
- Isolation model: namespace-level isolation for low-trust jobs, separate node pools with taints for medium-trust, entirely separate clusters for production deploy agents.
- Secrets: low-trust jobs have no access to production secrets. Secrets are injected at execution time by the CI platform only for jobs that have passed review gates.
- Network: CI job pods should not have broad egress to internal services. Network policies restrict CI workloads to only the registries and build caches they need.
- Ephemeral environments: each build runs in an ephemeral namespace that is deleted post-run to prevent state leakage between tenants.

**What a weak answer looks like:**
- "Use separate namespaces per team." Namespaces are not a strong isolation boundary in Kubernetes — this misses network, secrets, and node-level isolation.

**Sample answer skeleton:**
> "I'd model three trust tiers. Untrusted builds — PRs from forks or external contributors — run in ephemeral pods on a dedicated node pool with no egress beyond the build cache and registry. They get no secrets. Medium-trust builds — internal team CI — run in namespace-isolated jobs with access to non-production secrets via Vault dynamic credentials, network egress scoped to internal artifact stores. High-trust deploy jobs — production releases — run on a separate, hardened node pool with audited secret access, require a promotion approval gate, and are scoped to only the service account and namespace they deploy to. The separation is: node pool taints enforce workload placement, network policies enforce egress, and Vault policies enforce which secrets each tier can request. Ephemeral namespaces guarantee no state leaks between runs."

---

### Question 5

**"What are the most important default guardrails for product teams?"**

**Time guidance:** 4–5 minutes. Think about defaults that protect without blocking.

**What a strong answer covers:**
- Resource requests and limits via LimitRanges: prevents unbounded resource consumption by teams that omit them.
- NetworkPolicy default-deny: all pods start with no ingress/egress and teams declare what they need. Prevents lateral movement by default.
- Non-root enforcement via PodSecurityAdmission (restricted profile): containers cannot run as UID 0 by default, reducing privilege escalation risk.
- Image pull policy Always for mutable tags in non-dev environments: prevents stale cached image execution.
- Namespace-level ResourceQuotas: prevents one team from consuming all cluster capacity during an incident or misconfiguration.

**What a weak answer looks like:**
- Lists features without explaining the threat they address or the failure mode they prevent.

**Sample answer skeleton:**
> "I'd default five guardrails. One: LimitRanges that inject default CPU and memory requests/limits — this ensures scheduling works and prevents noisy-neighbor OOM kills. Two: PodSecurityAdmission at restricted, applied namespace-wide — no root containers, no privilege escalation, no host namespace sharing. Three: a default-deny NetworkPolicy in every namespace — teams declare the ports they need; unknown traffic is blocked. Four: ResourceQuotas per namespace so one team can't accidentally exhaust cluster capacity during a misconfiguration incident. Five: OPA/Kyverno policies that enforce image origin from the approved registry and deny images without a recent scan attestation. These are all applied by platform automation on namespace creation — teams don't need to remember them."

---

### Question 6

**"How would you implement break-glass access without undermining normal safety controls?"**

**Time guidance:** 5 minutes. Break-glass is an incident tool, not an escape hatch from process.

**What a strong answer covers:**
- Break-glass accounts are pre-provisioned, stored in a secure vault, and time-limited: access grants expire after a fixed window (e.g., 4 hours) with no renewal without explicit re-justification.
- Every use generates an immutable audit log entry: who accessed it, when, from which IP, and what justification was provided.
- Alert on every use: break-glass access should immediately notify the security team and the on-call SRE manager, even if it was legitimate. No silent break-glass use.
- Post-use review: the access session produces a record that feeds into a mandatory post-incident review. Was it necessary? Could normal access paths have handled it?
- Normal controls are not bypassed silently: break-glass bypasses approval workflows but does not disable audit logging, MFA, or network access controls.

**What a weak answer looks like:**
- "We have a shared admin password in a password manager." No auditability, no time limits, no alerting.

**Sample answer skeleton:**
> "Break-glass access is an emergency override that must leave a louder audit trail than normal access, not a quieter one. Implementation: a dedicated service account per cluster stored in Vault under a break-glass policy. Checking it out requires MFA, a required justification field, and creates an immediate PagerDuty alert to the security on-call. The credential is valid for 4 hours. All API actions taken during the break-glass session are tagged in the Kubernetes audit log with the break-glass credential, which is distinct from normal service account tokens. After the incident, the break-glass key is rotated and the session record is reviewed within 24 hours. The review asks: what was done, was it necessary, and what process change prevents the need next time."

---

### Question 7

**"A policy is technically correct but teams constantly bypass it. What do you do?"**

**Time guidance:** 4 minutes. This is behavioral with platform design implications.

**What a strong answer covers:**
- Diagnoses why before reacting: is the bypass happening because the policy is too restrictive, because the tooling makes compliance harder than non-compliance, or because teams don't understand the risk?
- Measures the bypass rate and its impact: is this causing actual security or reliability incidents, or is it theoretical risk?
- Engages teams as partners: holds office hours or interviews with the engineering teams to understand the friction point.
- Makes the correct path easier than the bypass: if teams bypass because the approved secret manager is slow and the env var is fast, fix the secret manager's performance.
- Enforces selectively at high-risk chokepoints (production deploy) while giving flexibility in lower-risk environments, rather than applying maximum friction everywhere.

**What a weak answer looks like:**
- "We'd enforce it harder with OPA and reject all non-compliant workloads." Does not address why teams bypass, and risks adversarial relationship.

**Sample answer skeleton:**
> "Before I tighten enforcement, I want to understand the bypass pattern. Are teams bypassing in dev only, or in production? Is the bypass creating actual risk — are secrets ending up in logs, or is it a theoretical concern? I'd start by running a 30-minute interview with two or three of the teams who bypass most frequently. Usually the answer is: the compliant path has a 10-minute setup overhead and the non-compliant path takes 30 seconds. The fix is ergonomic: make the correct path as fast as the bypass. If I can't fix the ergonomics immediately, I'd enforce the policy only at the production promotion gate — teams have flexibility in dev, but production requires compliance. That creates the right incentive without blocking development velocity."

---

### Question 8

**"How do you balance platform standardization with cloud-native advantages?"**

**Time guidance:** 4–5 minutes. This is a philosophical tradeoff question — give a concrete framework.

**What a strong answer covers:**
- Standardization reduces cognitive load, enables centralized security and compliance enforcement, and makes on-call rotation possible across services.
- Over-standardization blocks teams from using managed services that would reduce their operational burden — forcing teams to run their own database when Cloud SQL would work creates more operational risk, not less.
- The right model is opinionated defaults with an escape valve: the platform provides a golden path (standard k8s deployment, standard ingress, standard metrics pipeline) that works for 80% of use cases without configuration. Teams can opt out with justification.
- Standardize on interfaces, not implementations: standardize on how services expose health endpoints, metrics, and traces. Don't mandate which framework or language.
- Escape valve has a cost: teams that opt out own their operational burden for the deviation. Platform team will not debug or on-call for non-standard configurations.

**What a weak answer looks like:**
- "Standardization is important but teams need flexibility." True but says nothing about how to make that tradeoff operationally.

**Sample answer skeleton:**
> "I use the golden path model: the platform provides a default stack that handles 80% of cases with minimal configuration — standard Helm chart conventions, standard sidecars, standard alert rules pre-baked. This is the path of least resistance. For the 20% of cases where a team needs something different — say, a stateful workload that needs a specific storage class, or a latency-sensitive service that can't tolerate a sidecar — they can deviate, but they own the operational burden of the deviation and must document the justification. What I always standardize regardless of deviation: the observability interface (how you expose metrics, logs, and traces), the identity interface (what service account you use), and the admission policy (what the cluster will accept). These are the seams where cross-cutting concerns live. The implementations can vary."

---

### Question 9

**"What signals tell you your delivery platform itself is becoming a reliability risk?"**

**Time guidance:** 4 minutes. The platform is usually the last thing teams think to instrument.

**What a strong answer covers:**
- CI build success rate trending downward: flaky infra causes flaky builds, which causes teams to re-run and lose confidence.
- Mean time to deploy increasing: if a deployment that used to take 5 minutes now takes 25, the platform is accumulating hidden debt.
- Rollback frequency increasing without corresponding deploy frequency increase: teams are deploying but reverting more, which may indicate the validation pipeline is failing to catch regressions.
- Teams building shadow pipelines: a strong signal that the official platform is not trusted or not fast enough.
- Incident involvement of the platform team: if SREs or developers raise platform bugs during production incidents, the platform has become a reliability dependency in the wrong direction.

**What a weak answer looks like:**
- "I'd monitor the CI pipeline." Too vague — no specific signals, no trend analysis.

**Sample answer skeleton:**
> "I'd track five platform-specific SLIs. First: build success rate — if the rate of 'infra error' build failures exceeds 2%, the platform is unreliable. Second: P95 deploy duration — this should be stable or decreasing; a 20% increase over a quarter is a signal. Third: rollback rate per deployment — if this climbs, validation is insufficient or the platform is introducing regressions. Fourth: the number of teams that have created their own pipelines outside the standard one — this is a behavioral signal that the platform has failed to meet their needs. Fifth: platform team involvement in production incidents — if we appear in three post-incident reviews in a month as a contributing factor, we are a reliability risk."

---

### Question 10

**"Describe a platform incident that starts as a security concern and turns into a reliability incident."**

**Time guidance:** 6 minutes. Use a real or realistic scenario. Show the causal chain.

**What a strong answer covers:**
- The scenario has a clear moment where a security action (revocation, rotation, policy change) causes a reliability impact that was not anticipated.
- The candidate explains the failure chain, not just the endpoints.
- Names the detection and response timeline, with specific tools and signals.
- Explains what the platform team should have done differently to prevent the reliability impact.
- Ends with a systemic change (not just "we fixed the secret").

**What a weak answer looks like:**
- "A credential leaked and we had to rotate it, which caused downtime." No causal chain, no platform design lesson.

**Sample answer skeleton:**
> "A security scan flagged a long-lived service account key that had been committed to a repository six weeks prior. The correct response was to revoke it immediately. The platform team revoked the key at 14:00. Within 4 minutes, 40% of production pods began failing auth to Cloud Storage — the key had been distributed as a Kubernetes Secret across 6 clusters as part of a legacy integration that wasn't in the platform's inventory. The security team had revoked it without checking blast radius. We restored service by issuing a new short-lived key via Workload Identity, but the incident lasted 22 minutes. The systemic fix: credential inventory — all credentials in the platform must be registered with their consuming services, so that any rotation or revocation runs through a blast-radius check first. And Workload Identity for everything new, so there's nothing long-lived to revoke."

---

### Interviewer Follow-Up Pressure Questions

These are injected mid-answer to test depth. Prepare a 60-second response to each:

- **"Where is the real blast radius?"** — Which teams, services, or environments would be affected if this policy fires incorrectly or this component fails?
- **"What would you centralize?"** — Name the specific responsibilities that belong to the platform team, with a reason.
- **"What would you leave to teams?"** — Name what decentralization enables and what risk it accepts.
- **"What is the rollback story?"** — For a policy change, a platform upgrade, or a security control: how do you revert it, and what is the recovery time?
- **"What does auditability mean in practice?"** — Not just "we have logs." Who reads them, how frequently, and what action do they trigger?

---

### Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | Frames answers around tradeoffs and failure modes. Distinguishes centralized controls from team autonomy with reasoning. Names specific tools, APIs, and policies. Addresses blast radius before features. Includes rollback and auditability unprompted. |
| Medium | Correct on the technology layer but generic on tradeoffs. Can name tools but cannot explain the design decision behind choosing them. Treats security and reliability as separate concerns. |
| Weak | Describes technology without design decisions. Cannot explain what breaks first. Does not address blast radius, rollback, or auditability. Treats the question as a feature list rather than a system design problem. |

---

### Self-Debrief Template

After each practice run, write one sentence per item:

1. On Q1, did you state isolation model and identity model before naming GCP services?
2. Which answer treated security and reliability as if they were independent?
3. Did you address blast radius on at least 3 of the 10 questions?
4. Where did you describe a technology instead of a decision?
5. Which question exposed a gap in your knowledge of a specific tool or mechanism?
6. What is one platform principle you articulated clearly, and one you would strengthen before the next run?

---

## [SRE] Nebius: Company, Stack, and Interview Guide

## Nebius: Company, Stack, and Interview Guide

> Know who you are interviewing with as deeply as you know the technology they test you on.

---

### What Is Nebius?

Nebius Group (NASDAQ: NBIS) is a **full-stack AI cloud company** headquartered in Amsterdam. It emerged in 2024 from Yandex's international assets when Yandex divested its non-Russian operations under Western sanctions. The founding team of ~850+ engineers brought 15–20 years of hyperscale infrastructure experience from building Yandex Cloud.

**In plain terms:** Nebius is what you get when hyperscale infrastructure engineers decide to build a GPU cloud from scratch, specifically for AI workloads, without the general-purpose cloud baggage of AWS/GCP/Azure.

**Key facts:**
- 1,400+ employees, 400+ infrastructure/platform engineers
- Data centers: Finland (primary), New Jersey (US), Iceland (H200 cluster)
- Backed by NVIDIA ($2B), Meta (up to $27B), Microsoft ($19.4B)
- Revenue FY2025: $529.8M, growing 479% YoY
- ARR target: $7–9B by end of 2026

---

### What Nebius Actually Builds

Understanding their products tells you what their SREs operate every day.

#### 1. GPU Compute (Core Product)
- **GPU fleet:** NVIDIA GB300 NVL72, HGX B300/B200/H200/H100 — multiple Blackwell generations
- First cloud globally to run GB300 NVL72 on 800 Gbps InfiniBand
- Bare-metal performance with KVM/QEMU virtualization for tenant isolation
- SREs manage the hypervisor layer, not just the orchestration layer

#### 2. High-Speed Networking
- **InfiniBand:** NVIDIA Quantum-X800 at 800 Gbps, non-blocking fabric
- **RoCE:** RDMA over Converged Ethernet with Spectrum-X as alternative
- 3–5 microsecond latency (vs 20–80ms for standard Ethernet)
- RDMA for direct memory access without CPU involvement
- This is not your typical Kubernetes networking problem — it is physics-level engineering

#### 3. Storage
- Proprietary shared filesystem: up to **1 TB/s read throughput**
- NFS at 12 GBps read per 8-GPU VM (vs AWS EFS max 1.5 GBps)
- Object storage at 2 GB/s per GPU
- WEKA and VAST Data integrations for enterprise use

#### 4. Managed Kubernetes
- **Cilium CNI** with Hubble enabled by default — eBPF-based dataplane
- Hardware monitoring with automatic node tainting for faulty nodes
- HPA for autoscaling inference workloads
- Topology-aware scheduling for GPU job placement

#### 5. Soperator (their open-source Kubernetes operator for Slurm)
- Runs Slurm workloads inside Kubernetes
- Node types: Login (SSH load-balanced), Controller, Worker (StatefulSets)
- "Jail" — shared PV mounted across nodes using Linux `pivot_root` + namespaces
- Inline health checks, node autohealing, topology-aware training job placement
- GitHub: `nebius/soperator`

#### 6. Token Factory (LLM Inference Platform)
- Serves foundation models: text, vision, audio, multimodal
- KV cache-aware routing (cache hit rate tuned from 5% to 50–60%)
- Prefill/decode phase separation
- Dedicated inference endpoints with 99.9% uptime SLA
- vLLM, Triton, Ray Serve as serving backends

#### 7. Reliability Model (The 5-Layer System)
Their published fault tolerance architecture — know this:
1. **Multi-stage acceptance testing:** factory → deployment → virtualization → pre-provisioning
2. **Passive + active health monitoring:** continuous ECC error tracking, XID codes, NVLink bandwidth, IB counters
3. **Workload isolation and prevention:** automatic node draining, emergency checkpointing signals
4. **Automated node replacement:** spare buffer pool, pre-installed dependencies, fully automated
5. **End-to-end observability:** dashboards, Slack notifications, root-cause tracking

**MTTR: 12 minutes** average from fault detection to replacement node provisioned. This is achieved by pre-staging replacement nodes, not by fixing broken nodes under pressure.

---

### The Interview Process (4 Stages)

Nebius publishes their SRE interview structure publicly. No secrets here.

#### Stage 1 — Initial Interview (60–90 min)
**What happens:**
- Questions about your experience: languages, OS, databases, tools
- General questions on service management, Linux, networks
- One practical coding task
- One practical Linux console task

**What they are looking for:**
- Breadth — do you have real operational experience?
- How you think through problems, not just what you know
- Comfort with Linux terminal work under observation

**Preparation:**
- Be ready to explain any tool you mention at three levels: what it is, how it works internally, how you have used it at scale
- The Linux console task is often: given a symptom, diagnose it live

---

#### Stage 2 — Technical Interview (60–90 min)
**What happens:**
- Deep dive: Linux internals, system calls, file descriptors
- 2 algorithm problems (Easy to Medium LeetCode difficulty)

**Confirmed question patterns:**
- "What would you do if you don't have the right permissions for a file your service needs, but `chmod` doesn't work?" (tests creative Linux problem-solving: ACLs, bind mounts, `nsenter`, capabilities, `chattr`)
- "Explain what happens when a process calls `open()`"
- "How does cgroup v2 limit CPU for a container?"
- "Walk me through the `/proc` filesystem — what can you find there?"

**Confirmed LeetCode problems (reported by candidates):**
- Pascal's Triangle
- Minimum Path Sum
- Maximum Units on a Truck
- Isomorphic Strings
- Custom Sort String

**What they are looking for:**
- Deep Linux systems knowledge, not surface-level familiarity
- Clean, readable code — not clever tricks
- Structured thinking when problem-solving

---

#### Stage 3 — System Design (60–90 min)
**What happens:**
- Design a distributed system
- Evaluate overall system performance
- Estimate required computing resources

**Confirmed example prompt:**
- "Design a web app that counts square roots" — deceptively simple, tests scalability thinking

**What a Staff SRE candidate should expect:**
- Design a fault-tolerant GPU training cluster (they have published this architecture)
- Design an LLM inference platform at scale
- Design an observability pipeline for a 10,000+ GPU cluster

**What they are looking for:**
- Can you drive the design? Do you ask the right clarifying questions?
- Do you think about failure modes and recovery, not just the happy path?
- Can you estimate resource requirements with real numbers?
- Do you understand the Nebius reliability model (5-layer) as a design pattern?

---

#### Stage 4 — Stress Interview (30 min)
**What happens:**
- Simulate a production incident in a deliberately pressured environment
- They may interrupt, add new information, or push back on your hypotheses

**What they are looking for:**
- Structured, hypothesis-driven debugging (not random command firing)
- Communication under pressure — can you narrate what you are doing and why?
- Prioritization — what do you check first and why?
- Composure — do you slow down when overwhelmed or speed up and make mistakes?

**The winning pattern:**
```
"I observe X symptom. My first hypothesis is Y because Z.
To confirm, I will run [command] and look for [specific output].
While I confirm that, the immediate mitigation I would consider is A.
If Y is wrong, my next hypothesis is B."
```

---

### What the Six Competency Dimensions Mean

Nebius assesses all candidates on six explicit dimensions. Know what each one actually requires:

#### 1. Linux and Network Proficiency
**Not:** knowing commands  
**Actually:** understanding kernel subsystems — scheduler, memory management, VFS, cgroups, namespaces, TCP stack

#### 2. Console Tools and Utilities
**Not:** knowing tool names  
**Actually:** live terminal work — diagnosing a problem with only terminal access, using `strace`, `ss`, `perf`, `dmesg`, `/proc`

#### 3. Common Service Operation Issue Handling
**Not:** describing runbooks  
**Actually:** structured incident command — hypothesis, evidence, mitigation, escalation, post-mortem thinking

#### 4. Code Writing in Python or Go
**Not:** knowing syntax  
**Actually:** clean, production-quality automation scripts with error handling, retries, timeouts, structured logging

#### 5. Service/System Design and Architecture
**Not:** drawing boxes  
**Actually:** designing for failure, estimating capacity, making tradeoffs explicit, thinking like an operator not an architect

#### 6. Classical Algorithms and Data Structures
**Not:** grinding LeetCode  
**Actually:** clear problem decomposition, correct complexity analysis, readable implementation in one pass

---

### Recommended Books (From Nebius Directly)

Nebius publishes a reading list for SRE candidates. These are not suggestions — read the relevant chapters.

1. **"Systems Performance: Enterprise and the Cloud"** — Brendan Gregg  
   The single most important book. Covers USE method, flame graphs, every OS subsystem, BPF tools. Read chapters 1, 2, 5, 6, 7, 9.

2. **"The Linux Programming Interface"** — Michael Kerrisk  
   The definitive Linux systems programming reference. Focus on: processes, signals, file I/O, memory mapping, sockets, namespaces.

3. **"UNIX and Linux System Administration Handbook"** — Evi Nemeth et al.  
   Broad operational depth. Good for filling gaps in your mental model.

4. **"Practical Monitoring: Effective Strategies for the Real World"** — Mike Julian  
   Observability philosophy. Short, practical, and directly applicable to how Nebius builds observability into their reliability model.

5. **"Performance Analysis and Tuning on Modern CPUs"** — Denis Bakhvalov  
   CPU microarchitecture, cache effects, branch prediction. Relevant for GPU cluster operations and low-level performance debugging.

6. **Google SRE Book** (free at sre.google)  
   SLOs, error budgets, toil reduction, on-call culture. Know this framework cold.

---

### Tech Stack Summary (For Interview Context)

When they ask "tell me about your experience with X," these are the Xs that matter:

| Domain | Stack |
|--------|-------|
| Compute | QEMU/KVM, NVIDIA GPU drivers, DCGM, virtio |
| Container orchestration | Kubernetes, Helm, Kustomize |
| CNI | Cilium (eBPF dataplane, Hubble, NetworkPolicy) |
| GPU scheduling | NVIDIA device plugin, Node Feature Discovery, Kueue, topology-aware scheduling |
| AI workload orchestration | Soperator (Slurm in K8s), KubeFlow, Ray, SkyPilot |
| Inference serving | vLLM, Triton Inference Server, Ray Serve |
| Networking | InfiniBand (RDMA), RoCE, BGP, VPC, Cilium/eBPF |
| Observability | Prometheus, Grafana, Loki, Alertmanager, DCGM exporter, Hubble |
| IaC | Terraform |
| CI/CD | ArgoCD, GitHub Actions |
| Languages | Python (automation), Go (tooling) |
| Linux debugging | perf, eBPF/bpftrace, strace, ltrace, ss, ip, tcpdump, /proc, /sys |

---

### The One Thing That Separates Staff from Senior at Nebius

At the senior level, you solve problems. At the staff level, you prevent classes of problems and build systems that detect, isolate, and recover from failures automatically.

In the interview, this means:
- When you design something, explain how it fails and how it recovers
- When you debug something, explain what you would build so you never debug it manually again
- When you describe an incident, explain the detection gap and the systemic fix

Nebius's own 5-layer reliability model is the perfect example: they do not rely on humans to respond to GPU hardware failures fast enough — they built automation that detects, drains, and replaces nodes in 12 minutes with no human in the loop.

That is the mindset they want to see.

---

## [SRE] Linux Systems Deep Dive — Nebius Level

## Linux Systems Deep Dive — Nebius Level

> Nebius was built by Yandex engineers. They do not just use Linux — they debug it at the kernel level, tune it for GPU workloads, and run hypervisors on it. This is the highest-weighted area in their SRE interview bar.

---

### Mental Model

Linux is a collection of abstractions built on top of hardware. Every abstraction — a process, a file, a socket, a container — is a kernel-managed data structure with defined lifecycle, resource accounting, and failure modes.

When something breaks, the path to root cause always goes through one question:
> Which kernel subsystem is misbehaving, and what evidence can I find in `/proc`, `/sys`, or kernel logs?

---

### Part 1: Process Model (Beginner → Expert)

#### What Is a Process?
A process is a running instance of a program. It has:
- A PID (process ID) — unique integer, assigned on `fork()`
- A virtual address space — isolated memory view
- File descriptors — open files, sockets, pipes
- A thread group (main thread + any spawned threads)
- Resource accounting (CPU, memory, I/O)
- A parent process (PPID) — all processes form a tree rooted at PID 1

**In `/proc/<pid>/`:**
```
/proc/1234/status      # human-readable state, memory, uid
/proc/1234/maps        # virtual memory map (segments)
/proc/1234/smaps       # detailed per-mapping memory stats
/proc/1234/fd/         # open file descriptors (symlinks)
/proc/1234/fdinfo/     # position, flags for each fd
/proc/1234/cmdline     # argv[0..n], null-separated
/proc/1234/environ     # environment variables
/proc/1234/stack       # kernel stack trace (need root)
/proc/1234/wchan       # kernel function process is sleeping in
/proc/1234/net/        # per-namespace network state
```

#### Process States
```
R — Running or runnable (on run queue)
S — Interruptible sleep (waiting for event, wakes on signal)
D — Uninterruptible sleep (waiting for I/O, does NOT wake on signal)
Z — Zombie (exited, waiting for parent to call wait())
T — Stopped (SIGSTOP or debugger breakpoint)
```

**Why D state matters:**
A process in D state cannot be killed. It is waiting on a kernel I/O operation. High D state count = kernel I/O subsystem problem (disk, NFS, driver hang). This is not a CPU problem — it explains high load average with low CPU utilization.

#### How `fork()` and `exec()` Work
```
fork()  — creates a copy-on-write clone of the calling process
           child gets same address space, fd table, but new PID
           memory is only physically copied when written (COW)

exec()  — replaces the current process's program image
           loads new binary, resets stack/heap, keeps PID and open fds
           this is how shells launch commands: fork then exec
```

**Why this matters for containers:** A container runtime calls `clone()` (Linux's extended fork) with namespace flags. The new "process" has isolated views of PID space, network, filesystem, and IPC.

---

### Part 2: Linux Namespaces (Beginner → Expert)

#### What Are Namespaces?
Namespaces are a kernel mechanism that **wraps a global resource so each process sees its own isolated instance**. This is the foundation of containers.

There are 8 namespace types in Linux:

| Namespace | `clone()` flag | What it isolates |
|-----------|---------------|-----------------|
| `mnt` | `CLONE_NEWNS` | Filesystem mount table |
| `pid` | `CLONE_NEWPID` | Process ID space |
| `net` | `CLONE_NEWNET` | Network stack (interfaces, routes, iptables) |
| `ipc` | `CLONE_NEWIPC` | IPC: System V, POSIX message queues |
| `uts` | `CLONE_NEWUTS` | Hostname and domain name |
| `user` | `CLONE_NEWUSER` | UID/GID mapping (rootless containers) |
| `cgroup` | `CLONE_NEWCGROUP` | cgroup root view |
| `time` | `CLONE_NEWTIME` | Clock offsets (Linux 5.6+) |

#### How Container Runtimes Use Namespaces

When Docker or containerd starts a container:
1. `clone()` is called with `CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC`
2. The new process sees: PID 1 as itself, its own network interface, its own filesystem root, its own hostname
3. `pivot_root()` or `chroot()` changes the filesystem root to the container image layer

**Soperator's "jail" uses the same mechanism:** worker nodes share a PV but each worker uses `pivot_root` + namespaces to isolate its execution environment.

#### Inspecting Namespaces
```bash
# List namespaces of a process
ls -la /proc/<pid>/ns/

# List all namespaces in the system
lsns

# Enter a process's namespace
nsenter -t <pid> --net --pid --mount -- /bin/bash

# See which namespace a process is in (by inode)
readlink /proc/<pid>/ns/net
```

#### User Namespaces (Important for Rootless Containers)
User namespaces allow a process to be "root" inside a container while mapping to an unprivileged UID on the host:
```
Container UID 0 → Host UID 100000 (defined in /etc/subuid)
```

This is how Podman runs rootless containers. The kernel enforces that the "root" inside the container has no privileges on the host.

---

### Part 3: cgroups v2 (Beginner → Expert)

#### What Are cgroups?
Control groups (cgroups) allow the kernel to **limit, account for, and isolate resource usage** of process groups.

**cgroups v1:** Each resource controller (cpu, memory, blkio) had its own hierarchy. Complex, inconsistent.  
**cgroups v2:** Unified hierarchy. All controllers under one tree. Container runtimes (containerd, crun) use v2 exclusively since kernel 5.x.

#### The cgroup Hierarchy
```bash
# The root cgroup
/sys/fs/cgroup/

# A container's cgroup (typical path)
/sys/fs/cgroup/system.slice/docker-<id>.scope/

# What's inside a cgroup directory
cat /sys/fs/cgroup/system.slice/memory.max        # memory limit
cat /sys/fs/cgroup/system.slice/cpu.max           # CPU bandwidth: "quota period"
cat /sys/fs/cgroup/system.slice/io.max            # block IO limits
cat /sys/fs/cgroup/system.slice/memory.current    # current memory usage
cat /sys/fs/cgroup/system.slice/cpu.stat          # CPU stats
cat /sys/fs/cgroup/system.slice/memory.stat       # detailed memory breakdown
```

#### CPU Limiting with cgroups v2
```
cpu.max = "200000 1000000"
# This means: 200ms CPU time out of every 1000ms period = 0.2 CPU cores
```

**How it works internally:**
- CFS (Completely Fair Scheduler) uses a quota/period model
- When a cgroup exhausts its quota, processes are "throttled" — moved to D state until next period
- Throttling shows up as `cpu_throttled_seconds` in metrics — very useful for diagnosing Kubernetes CPU limits issues

#### Memory Limiting and OOM
```
memory.max = 2G        # hard limit, OOM kill when exceeded
memory.high = 1.8G     # soft limit, triggers reclaim but no kill
memory.swap.max = 0    # disable swap for this cgroup
```

**OOM behavior:**
1. Process attempts allocation, fails
2. Kernel invokes OOM killer for the cgroup
3. OOM killer scores processes (RSS + penalty) and kills the highest scorer
4. `dmesg` shows: `OOM kill process <name> total-vm:<x>kB`

**Why containers get OOM killed:** A Java app's JVM allocates 2x its `-Xmx` for off-heap memory (metaspace, code cache, direct buffers). Setting Kubernetes `memory: 2Gi` limit with a JVM configured for 2GB heap = OOM kill.

#### Inspecting cgroups
```bash
# See cgroup v1 or v2
cat /proc/filesystems | grep cgroup
stat /sys/fs/cgroup                          # type tmpfs = v1, type cgroup2 = v2

# Find a process's cgroup
cat /proc/<pid>/cgroup

# Current memory use in a container cgroup
cat /sys/fs/cgroup/kubepods/pod<uid>/<container-id>/memory.current

# PSI (Pressure Stall Information) — available in cgroups v2
cat /sys/fs/cgroup/kubepods/.../cpu.pressure
cat /sys/fs/cgroup/kubepods/.../memory.pressure
cat /sys/fs/cgroup/kubepods/.../io.pressure
```

**PSI explained:** A value like `some avg10=12.34` means 12.34% of time in the last 10 seconds, at least one task was stalled waiting for this resource. This is far more useful than `top`'s CPU% for diagnosing resource saturation.

---

### Part 4: System Calls and File Descriptors (Beginner → Expert)

#### What Is a System Call?
A syscall is the interface between user space and kernel space. User code cannot directly access hardware or kernel data structures — it must ask the kernel.

**The mechanics:**
1. User code calls a C library wrapper (e.g., `write()`)
2. Wrapper sets up registers and executes `syscall` instruction (x86-64)
3. CPU switches from ring 3 (user) to ring 0 (kernel)
4. Kernel validates arguments, performs operation, returns result
5. CPU switches back, return value is in `rax` register

**Why this matters for SRE:** Every file open, network send, and timer create is a syscall. `strace` intercepts all syscalls for a process, making it the most powerful single-process debugger available without writing code.

#### File Descriptors
Every open file, socket, pipe, or device is represented by a file descriptor — a small integer index into the process's fd table.

```
fd 0 = stdin
fd 1 = stdout
fd 2 = stderr
fd 3+ = first open file/socket/pipe
```

**Inspecting file descriptors:**
```bash
# List open fds for a process
ls -la /proc/<pid>/fd/
lsof -p <pid>

# Count open fds (useful for fd leak detection)
ls /proc/<pid>/fd | wc -l

# See fd limit
cat /proc/<pid>/limits | grep "open files"
ulimit -n                    # per-shell limit
cat /proc/sys/fs/file-max    # system-wide limit
```

**Fd leak scenario:** A service opens log files but never closes them. Over hours, `ls /proc/<pid>/fd | wc -l` grows without bound. Eventually hits `ulimit -n` and the service starts failing with `Too many open files`. Fix: audit the code for missing `close()` / `with` statements, increase limit as temp mitigation.

#### Key Syscalls to Know for SRE Debugging

| Syscall | What It Does | Why It Matters |
|---------|-------------|----------------|
| `open()` / `openat()` | Opens a file | fd leaks, permission errors, ENOENT |
| `read()` / `write()` | I/O on fd | blocks when kernel buffer is full |
| `mmap()` | Maps file/memory into address space | JVM, shared memory, huge pages |
| `clone()` | Creates process/thread/container | container startup, thread creation |
| `execve()` | Executes a program | shell commands, container entrypoint |
| `epoll_wait()` | Event notification for multiple fds | async I/O, event loops (nginx, Go runtime) |
| `futex()` | Fast userspace mutex | contention shows as blocked threads |
| `inotify_add_watch()` | File system event notification | log rotation, config reload |
| `accept()` / `connect()` | TCP connection lifecycle | connection pool exhaustion |
| `sendfile()` | Zero-copy file transfer | nginx static file serving |

#### Debugging with strace
```bash
# Attach to running process, see all syscalls
strace -p <pid>

# Count syscalls (profile mode)
strace -c -p <pid>

# See timing between syscalls (find slow operations)
strace -T -p <pid>

# Trace only specific syscalls
strace -e trace=read,write,open -p <pid>

# Trace a new process and all its children
strace -f -e trace=network ./my-app

# Common pattern: find why app is slow
strace -T -p <pid> 2>&1 | sort -t'<' -k2 -n | tail -20
# This shows the 20 slowest syscalls
```

---

### Part 5: Linux Performance Tools — USE Method

#### The USE Method (Brendan Gregg, Netflix)
For every resource, check: **Utilization, Saturation, Errors**

| Resource | Utilization | Saturation | Errors |
|----------|------------|-----------|--------|
| CPU | `mpstat`, `top` %cpu | `vmstat` r (run queue) | `dmesg` MCE |
| Memory | `free` used/total | `vmstat` si/so (swap), PSI | OOM kills in dmesg |
| Disk I/O | `iostat` %util | `iostat` await, queue | `dmesg` I/O errors |
| Network | `sar -n DEV` %ifutil | `netstat -s` retransmits | `ip -s link` errors |

#### CPU Performance Tools
```bash
# Load average context (1/5/15 min)
uptime
# Rule: load > nCPU = saturation

# Per-CPU utilization
mpstat -P ALL 1

# Who is using CPU right now
top                      # interactive
pidstat -u 1             # per-process, non-interactive
ps aux --sort=-%cpu | head

# CPU flame graph (Brendan Gregg method)
perf record -F 99 -a -g -- sleep 30    # sample at 99 Hz
perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > flame.svg

# CPU throttling in containers/cgroups
cat /sys/fs/cgroup/kubepods/.../cpu.stat | grep throttled

# Hardware performance counters
perf stat -e cache-misses,cache-references,instructions,cycles ./app
```

#### Memory Performance Tools
```bash
# Quick overview
free -h
vmstat 1 5              # si/so = swap in/out
cat /proc/meminfo

# Detailed memory breakdown
cat /proc/meminfo | grep -E 'MemFree|Cached|Buffers|Slab|Dirty|Writeback'

# Find memory-hungry processes
ps aux --sort=-%mem | head
cat /proc/<pid>/smaps | grep -E 'Size:|Rss:|Pss:' | awk '{s+=$2} END {print s/1024 "MB"}'

# Memory pressure
cat /proc/pressure/memory          # PSI
cat /proc/buddyinfo                # page allocator state
cat /proc/slabinfo | sort -k3 -rn | head  # kernel slab allocations

# Huge pages (important for GPU workloads)
cat /proc/meminfo | grep Huge
hugeadm --pool-list
echo 512 > /proc/sys/vm/nr_hugepages   # allocate huge pages
```

#### I/O Performance Tools
```bash
# Block device stats
iostat -xz 1 5
# %util > 80% = device saturated
# await > r_await or w_await = distinguish read vs write latency

# I/O per process
iotop -o -b -n 5        # top-like, batch mode

# Block I/O latency distribution (eBPF)
biolatency                    # requires bpftools
bpftrace -e 'kprobe:blk_account_io_done { @[comm] = hist(nsecs); }'

# Filesystem-specific
df -h && df -i          # disk and inode usage
cat /proc/diskstats     # raw block device statistics
```

#### Network Performance Tools
```bash
# Interface stats
ip -s link
sar -n DEV 1 5          # network interface utilization

# TCP stats
ss -s                   # summary
ss -tan state TIME-WAIT | wc -l    # TIME_WAIT count
netstat -s | grep -i retransmit    # retransmit count

# Per-connection detail
ss -tanp                # all TCP sockets with process

# Kernel TCP parameters
sysctl net.core.somaxconn          # listen backlog
sysctl net.ipv4.tcp_tw_reuse       # TIME_WAIT reuse
sysctl net.netfilter.nf_conntrack_count   # conntrack entries used
sysctl net.netfilter.nf_conntrack_max     # conntrack max

# DNS resolution timing
time nslookup google.com
dig +stats google.com
```

---

### Part 6: eBPF — What It Is and How to Use It

#### What Is eBPF?
eBPF (extended Berkeley Packet Filter) is a Linux kernel feature that lets you run sandboxed programs in the kernel in response to events — without writing kernel modules and without rebooting.

**Before eBPF:** Adding observability to the kernel meant writing kernel modules (risky, fragile, version-dependent) or recompiling the kernel.

**With eBPF:** You write a small program, the kernel verifies it is safe (no loops, bounded execution, no illegal memory access), and attaches it to a kernel event. The program runs every time the event fires.

**This is why Cilium exists:** Cilium replaces iptables with eBPF programs attached to network hooks, giving O(1) lookup vs iptables' O(n) rule chain traversal.

#### eBPF Attachment Points
- **kprobe/kretprobe:** Attach to any kernel function entry/return
- **tracepoint:** Stable kernel trace events (preferred over kprobes)
- **uprobe/uretprobe:** Attach to user-space function entry/return
- **XDP (eXpress Data Path):** Earliest possible packet hook, before sk_buff allocation
- **TC (Traffic Control):** After packet is in kernel networking, before routing
- **socket filters:** Filter packets for specific sockets
- **perf events:** Sampling-based profiling

#### bpftrace — Quick eBPF Scripting
```bash
# Trace all execve() calls (every command that runs)
bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s\n", str(args->filename)); }'

# Trace TCP connection accepts
bpftrace -e 'kretprobe:inet_csk_accept { printf("accept: %s\n", comm); }'

# Profile CPU usage by function (sample every 99ms)
bpftrace -e 'profile:hz:99 { @[kstack] = count(); }'

# Watch file opens
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s opens %s\n", comm, str(args->filename)); }'

# Measure block I/O latency
bpftrace -e 'kprobe:blk_account_io_start { @start[arg0] = nsecs; }
kprobe:blk_account_io_done /@start[arg0]/ { @lat = hist(nsecs - @start[arg0]); delete(@start[arg0]); }'

# Find processes causing page faults
bpftrace -e 'software:page-faults:100 { @[comm, pid] = count(); }'
```

#### BCC Tools (Higher-level eBPF)
```bash
# CPU profiling (flame graph data)
profile -F 99 -a 30     

# TCP connection tracing
tcpconnect              # new outbound connections
tcpaccept               # new inbound connections
tcpretrans              # TCP retransmissions

# File I/O tracing
opensnoop               # all file opens
filetop                 # top files by I/O

# Memory
memleak                 # detect memory leaks

# Latency
runqlat                 # run queue latency histogram
biolatency              # block I/O latency histogram
```

---

### Part 7: QEMU/KVM Virtualization (Nebius-Specific)

#### Why This Matters at Nebius
Nebius uses QEMU/KVM to virtualize their GPU compute nodes. Their Compute Node SRE team maintains the hypervisor layer. You need to understand how VMs work at this level.

#### KVM Architecture
```
┌─────────────────────────────────┐
│  Guest OS (VM)                  │
│  ┌─────────────────────────┐    │
│  │ Application              │    │
│  │ Guest kernel (ring 0)    │    │  ← Guest thinks it's ring 0
│  └────────────┬────────────┘    │
│               │ VM exits         │
└───────────────┼─────────────────┘
                │
┌───────────────▼─────────────────┐
│  KVM (kernel module)            │
│  Handles VM exits, VMCS         │
│                                 │
│  QEMU (user space)              │
│  Device emulation, I/O, mgmt   │
└─────────────────────────────────┘
```

**KVM:** Linux kernel module that enables hardware virtualization (Intel VT-x, AMD SVM). Uses VMCS (Virtual Machine Control Structure) to save/restore guest state on VM exits.

**QEMU:** User-space process that emulates hardware devices (VirtIO NIC, disk, GPU passthrough). Communicates with KVM via `/dev/kvm` ioctl calls.

#### VM Exit — The Critical Concept
A "VM exit" is when the guest CPU stops executing guest code and gives control back to KVM:
- Guest executes a privileged instruction (I/O port, MSR write, CPUID)
- Guest triggers an interrupt that KVM needs to handle
- VMX preemption timer fires (time slice expired)

**VM exit overhead:** Each VM exit takes 1,000–10,000 ns (1–10 µs). For GPU workloads, you want to minimize exits — this is why virtio drivers are used instead of emulated hardware (virtio uses shared memory and batch notification instead of per-I/O exits).

#### VirtIO
```
virtio-net:   Virtual NIC with direct memory access, no per-packet exit
virtio-blk:   Virtual disk with batch I/O queue, efficient for SSDs
virtio-mem:   Hot-pluggable memory
vhost-net:    Kernel-level virtio-net processing (fewer kernel/user switches)
vhost-user:   User-space vhost (DPDK, SPDK for high-performance I/O)
```

#### CPU Pinning and NUMA Topology
For GPU workloads, incorrect NUMA topology causes significant performance degradation:
```bash
# Check NUMA topology
numactl --hardware
lscpu | grep -E 'NUMA|Socket|Core'

# Pin VM to specific NUMA node
numactl --cpunodebind=0 --membind=0 -- qemu-system-x86_64 [options]

# In libvirt XML (Nebius uses declarative VM config)
# <vcpupin vcpu='0' cpuset='0-7'/>
# <numatune><memory mode='strict' nodeset='0'/></numatune>

# Check if VM is NUMA-aware
virsh numatune <vm-name>
```

**Why this matters for Nebius:** GPU PCIe slots are connected to specific CPUs via PCIe lanes. A GPU VM's vCPUs must be pinned to the CPU that owns that GPU's PCIe root complex, or data transfer goes through the remote CPU, adding ~100ns latency per transfer.

#### GPU Passthrough (PCIe passthrough / VFIO)
```bash
# Check if IOMMU is enabled (required for GPU passthrough)
dmesg | grep -i iommu
cat /proc/cmdline | grep iommu   # intel_iommu=on or amd_iommu=on

# Find GPU IOMMU group
for d in /sys/kernel/iommu_groups/*/devices/*; do
  echo "$(basename $(dirname $(dirname $d))): $(lspci -nns $(basename $d))"
done | grep -i nvidia

# VFIO passthrough: all devices in same IOMMU group must be passed together
# Unbind from nvidia driver, bind to vfio-pci
echo "10de 2204" > /sys/bus/pci/drivers/vfio-pci/new_id  # RTX 3090 example
```

#### Debugging VM Performance Issues
```bash
# VM exit statistics (KVM counters)
cat /sys/kernel/debug/kvm/exits    # total exits
cat /sys/kernel/debug/kvm/*        # all KVM debug counters

# Perf on KVM
perf kvm stat record sleep 30
perf kvm stat report

# Find noisy VMs
virsh list
virsh domstats <vm>
virsh schedinfo <vm>

# Check for memory balloon pressure (guest being compressed)
virsh dommemstat <vm>

# QEMU process, confirm it is using KVM acceleration
ls -la /proc/<qemu-pid>/fd | grep kvm
```

---

### Part 8: Nebius-Level Interview Questions + Strong Answers

#### Q: "What would you do if you don't have the right permissions for a file your service needs, but chmod doesn't work?"

This is a Stage 2 question. "chmod doesn't work" means the standard POSIX permission model is insufficient or broken. Explore alternatives:

```
1. POSIX ACLs (getfacl/setfacl) — grant access to a specific user without changing owner/group
   setfacl -m u:myservice:r /path/to/file

2. Capabilities (getcap/setcap) — grant specific kernel privilege without root
   setcap cap_net_raw+ep /usr/bin/ping

3. Bind mounts — mount the file at a path where the service has access
   mount --bind /restricted/file /accessible/path/file

4. nsenter — enter the namespace of the process that has access and operate from there
   nsenter -t <pid> --mount --pid -- cat /path/to/file

5. chattr — check if the file has immutable flag set (chattr +i)
   lsattr /path/to/file

6. SELinux/AppArmor — if MAC policy is blocking access, you need to adjust policy labels
   ls -Z /path/to/file     (SELinux context)
   aa-status               (AppArmor status)

7. Overlay filesystem — if the file is in a read-only layer, create a writable overlay
   mount -t overlay overlay -o lowerdir=/ro,upperdir=/rw,workdir=/work /merged
```

**Strong answer structure:** "First I would confirm exactly what is failing — is it EACCES or EPERM? strace on the process would tell me the exact syscall and error. EACCES = permissions issue. EPERM = capability or SELinux issue. Then I would check in order: ACLs, capabilities, MAC policy, file immutable flags, and namespace context."

---

#### Q: "Explain what a load average of 10 on a 4-core machine means."

Weak answer: "It means the system is overloaded."

**Strong answer:**
"Load average counts threads in run state (R) plus threads in uninterruptible sleep (D). A value of 10 on 4 cores means 10 threads are competing for CPU or waiting on kernel I/O at once — that is 2.5x oversubscribed.

But the composition matters:
- If all 10 are in R state: CPU contention, processes are being scheduled in/out — expect latency jitter
- If all 10 are in D state: I/O bottleneck, not CPU — maybe disk, NFS, or a hung driver

I would check `vmstat 1 5`: if `r` column is high, it is CPU saturation. If `b` is high and `r` is low, it is I/O wait. Then `iostat -xz 1` to identify the device. PSI in `/proc/pressure/` gives a more accurate view than load average because load average can spike on a brief I/O burst and stay elevated for 5+ minutes due to exponential decay."

---

#### Q: "How does cgroup v2 limit CPU for a container?"

"cgroups v2 uses the CFS bandwidth controller. The `cpu.max` file contains two values: quota and period. For example, `200000 1000000` means the cgroup can use at most 200ms of CPU time in each 1000ms window — equivalent to 0.2 CPU cores.

Internally: the CFS scheduler tracks `cpu.stat`'s `usage_usec` counter. When a cgroup exhausts its quota for the current period, the scheduler throttles all processes in that cgroup — they are moved to a waiting state and are not scheduled until the period resets. This shows up as `throttled_usec` in `cpu.stat`.

This is why Kubernetes CPU limits can cause latency spikes without high CPU utilization: a bursty workload exhausts its 100ms quota in the first 10ms of a period, then is throttled for 90ms. The host CPU has plenty of capacity but the process is forced to wait. The fix is either to increase the CPU limit or — better — switch to CPU requests only without limits for latency-sensitive workloads."

---

### Points to Remember

- `D` state processes cannot be killed — they are waiting on kernel I/O
- Load average counts R + D state, not just CPU usage
- cgroups v2 uses a unified hierarchy under `/sys/fs/cgroup/`
- `cpu.max` quota/period model can cause CPU throttling at low utilization
- Containers use `clone()` with namespace flags, not `fork()` alone
- `pivot_root()` changes the filesystem root for a namespace (core container mechanism)
- File descriptors survive `fork()` — this is how stdout/stderr redirection works and how fd leaks happen
- eBPF programs are kernel-verified (safe) — no risk of kernel panics from bpftrace
- KVM uses VMCS hardware mechanism — guest state is saved/restored on VM exits
- GPU passthrough requires IOMMU enabled in BIOS + kernel cmdline
- NUMA mismatch between vCPUs and GPU PCIe = hidden latency for GPU VMs

### What to Study Next

- [02-kubernetes-cilium-production.md](/docs/nebius/kubernetes-cilium-production) — how Linux primitives map to Kubernetes
- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply this knowledge to live debugging scenarios
- Brendan Gregg's "Systems Performance" — chapters 5 (CPUs) and 7 (Memory)

---

## [SRE] Kubernetes and Cilium at Production Depth — Nebius Level

## Kubernetes and Cilium at Production Depth — Nebius Level

> Nebius runs all managed Kubernetes with Cilium CNI by default. Every SRE candidate is expected to understand Kubernetes internals at control plane level and Cilium at the eBPF dataplane level — not just "kubectl apply" operational familiarity.

---

### Mental Model

Kubernetes is a distributed system with two distinct planes:

**Control plane:** Makes decisions — schedules pods, reconciles desired vs actual state, manages secrets, issues certificates.

**Data plane:** Executes decisions — runs containers, routes packets, enforces policy.

A fault in the control plane causes new work to fail but existing workloads continue. A fault in the data plane breaks running workloads. Understanding which plane is failing is the first step in every Kubernetes incident.

---

### Part 1: Control Plane Components Deep Dive

#### kube-apiserver

The API server is the single point of truth and the only component that reads/writes etcd.

**What it does:**
- Validates and persists API objects
- Authenticates requests (certificates, OIDC, service account tokens)
- Authorizes requests (RBAC)
- Serves as the watch/event bus for all controllers

**What breaks and how you know:**
```bash
# API server latency (key SLI)
kubectl get --request-timeout=2s nodes

# API server logs
kubectl logs -n kube-system kube-apiserver-<node>

# Check audit log for permission errors
grep "RBAC DENY" /var/log/kubernetes/audit.log

# Verify API server certificate expiry
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates
kubeadm certs check-expiration
```

**Failure mode: API server is up but slow**
- Cause: etcd is slow (check etcd latency metrics)
- Cause: admission webhooks timing out (check webhook configs, pod logs)
- Cause: large number of watchers / list operations hitting etcd
- Mitigation: pagination for large list operations, cache results, reduce webhook overhead

#### etcd

Distributed key-value store using the Raft consensus algorithm. Every API object is stored here.

**What it does:**
- Stores all Kubernetes state
- Implements Raft for consensus across 3 or 5 nodes
- Uses a WAL (Write-Ahead Log) for durability

**Key metrics and commands:**
```bash
# etcd health
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# etcd latency (critical SLI for Kubernetes health)
etcdctl endpoint status --write-out=table

# Compact and defrag (reduces disk usage)
etcdctl compact <revision>
etcdctl defrag

# Backup
etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db
etcdctl snapshot verify /backup/etcd-$(date +%Y%m%d).db
```

**What you must know about etcd:**
- Raft requires majority quorum. A 3-node cluster can tolerate 1 failure. 5-node cluster tolerates 2 failures.
- etcd leader election uses heartbeats. A long GC pause (Java, Go) or high I/O latency can trigger election timeout.
- etcd is NOT designed for large values. Kubernetes stores secrets and ConfigMaps here. Large configmaps → etcd performance problems.
- etcd revision is a global monotonically increasing counter. Every write increments it. High revision = lots of writes = needs compaction.

#### kube-scheduler

Assigns pods to nodes. It does NOT start pods — it only sets `pod.spec.nodeName`.

**Scheduling algorithm:**
1. **Filtering:** Remove nodes that cannot run the pod (insufficient resources, taints, node affinity, volume topology)
2. **Scoring:** Rank remaining nodes (spreading, resource balance, node affinity preference)
3. **Binding:** Write the assignment to etcd via API server

**Why pods stay pending:**
```bash
# Describe the pod — Reason in Events section
kubectl describe pod <name> -n <namespace>

# Common reasons:
# "Insufficient cpu" / "Insufficient memory" → no node has enough resources
# "didn't match Pod's node affinity" → node selector / affinity mismatch
# "node(s) had taint X that the pod didn't tolerate" → taint/toleration mismatch
# "pod has unbound immediate PersistentVolumeClaims" → PVC not bound, wrong StorageClass
# "node(s) didn't have enough free storage" → ephemeral storage constraint

# Check what nodes actually have available
kubectl describe nodes | grep -A 5 "Allocated resources"
```

#### kube-controller-manager

A single binary running multiple control loops (controllers). Each controller watches specific resources and reconciles desired vs actual state.

**Key controllers:**
- `ReplicaSet controller:` ensures correct pod count
- `Deployment controller:` manages rollout strategy
- `StatefulSet controller:` manages ordered pod creation/deletion
- `Node controller:` monitors node health, evicts pods from NotReady nodes (after 5 minutes by default)
- `EndpointSlice controller:` populates EndpointSlices when pods become ready
- `PersistentVolume controller:` binds PVCs to PVs

**The reconciliation loop pattern (critical for understanding operators):**
```
Watch API server for relevant objects
For each object:
  1. Read desired state from object spec
  2. Observe actual state from world
  3. Calculate diff
  4. Take action to close the gap
  5. Update object status
  Loop
```

This is exactly how Kubernetes operators work. Soperator's controller watches `SlurmCluster` CRDs and reconciles the actual Slurm cluster state.

#### kubelet

The agent running on every node. Responsible for container lifecycle.

```bash
# kubelet logs
journalctl -u kubelet -f
journalctl -u kubelet --since "10 minutes ago"

# kubelet configuration
cat /var/lib/kubelet/config.yaml

# kubelet status
systemctl status kubelet

# Node-level container state
crictl ps                          # list containers (containerd)
crictl inspect <container-id>      # container details
crictl logs <container-id>         # container logs

# Resource pressure flags
kubectl describe node <name> | grep -A 10 Conditions
# Look for: MemoryPressure, DiskPressure, PIDPressure
```

**How kubelet handles a pod:**
1. Watches API server for pods assigned to this node (`spec.nodeName == thisNode`)
2. Calls container runtime (containerd) via CRI gRPC
3. containerd pulls image, creates container namespaces, mounts volumes
4. Sets up pod networking by calling CNI plugin (Cilium)
5. Runs liveness/readiness probes
6. Reports status back to API server

---

### Part 2: Pod Networking — From Zero to Packet

#### How a Pod Gets an IP (The CNI Chain)
When kubelet creates a pod, it calls the configured CNI plugin (Cilium at Nebius) with:
```json
{
  "command": "ADD",
  "containerID": "...",
  "netns": "/var/run/netns/<id>",
  "ifname": "eth0",
  "config": {...}
}
```

CNI plugin responsibilities (what Cilium does):
1. Create a veth pair: one end `eth0` in the pod namespace, one end in the node network namespace
2. Configure IP address and routes inside the pod namespace
3. Set up dataplane rules for the pod's IP (eBPF maps in Cilium's case)
4. Return IP address to kubelet

**Resulting topology:**
```
Pod network namespace                Node network namespace
┌─────────────────┐                  ┌────────────────────────┐
│  eth0 (10.1.2.3)│                  │  lxcXXXXXX (veth peer) │
│  (veth end)     │◄─── veth pair ──►│  eBPF program attached  │
│                 │                  │                         │
│  route: default │                  │  cilium_host            │
│  via 169.254.1.1│                  │  (gateway for pods)     │
└─────────────────┘                  └────────────────────────┘
```

#### How Cilium Routes Packets (eBPF vs iptables)

**Traditional iptables approach:**
- kube-proxy watches Services and writes iptables rules
- Each packet to a Service VIP matches a DNAT rule (chosen probabilistically with `statistic --mode random`)
- This is O(n) — every packet must traverse every iptables rule before matching
- At 10,000+ services: measurable latency overhead

**Cilium's eBPF approach:**
- Cilium attaches eBPF programs to TC (Traffic Control) hooks on every veth interface
- Service endpoints are stored in eBPF hash maps — O(1) lookup
- DNAT is performed by the eBPF program, not by the kernel's netfilter
- No iptables rules for service routing — entire network policy in eBPF

**What this means operationally:**
```bash
# Cilium's eBPF maps
cilium map list                     # list all eBPF maps
cilium map get cilium_lb4_services  # Service VIP → backend list
cilium map get cilium_ipcache       # IP → identity mapping
cilium map get cilium_policy        # policy rules

# Pod connectivity debugging
cilium endpoint list               # all pods managed by Cilium
cilium endpoint get <endpoint-id>  # policy, health, labels

# Flow monitoring (Hubble)
hubble observe --namespace default --follow
hubble observe --pod web-server --type drop    # dropped packets only
hubble observe --from-pod frontend --to-pod backend

# Check if a pod can reach another
cilium connectivity test            # full connectivity test suite
```

#### Services: How EndpointSlices Work

A Service is a virtual IP (ClusterIP). No packet is ever delivered to the ClusterIP — it is always translated to a backend Pod IP before delivery.

**The chain:**
1. Application resolves `my-service.default.svc.cluster.local` via CoreDNS
2. CoreDNS returns the Service's ClusterIP (e.g., `10.96.0.100`)
3. Application sends packet to `10.96.0.100:8080`
4. Cilium eBPF program intercepts the packet at TC hook
5. Cilium looks up the Service in its eBPF map, selects a ready endpoint
6. Cilium DNAT: destination IP changed from `10.96.0.100` to `10.1.2.5` (a backend Pod IP)
7. Packet routed normally to the Pod

**Why "pod is running but service is broken":**
- Pod is running but readiness probe is failing → Pod IP is NOT in EndpointSlice → Cilium has no endpoint to route to
- NetworkPolicy blocking traffic → Cilium drops the packet (check Hubble)
- Wrong port in Service spec → DNAT maps to wrong port
- Service selector doesn't match pod labels → no endpoints

```bash
# Check EndpointSlice
kubectl get endpointslice -l kubernetes.io/service-name=my-service -o yaml
# Look at "endpoints" — are any listed? Is "ready: true"?

# Check if service selector matches pods
kubectl get svc my-service -o jsonpath='{.spec.selector}'
kubectl get pods -l <matching-labels>
```

---

### Part 3: GPU Scheduling in Kubernetes

#### The Device Plugin Model
Kubernetes has no built-in GPU concept. GPUs are exposed as extended resources via the Device Plugin framework.

**How it works:**
1. NVIDIA device plugin runs as DaemonSet on every GPU node
2. Plugin registers resource type `nvidia.com/gpu` with kubelet
3. Plugin discovers GPUs on the node (via NVML)
4. kubelet advertises `nvidia.com/gpu: 8` (for an 8-GPU node) in Node capacity
5. When a pod requests `nvidia.com/gpu: 1`, scheduler assigns pod to a GPU node
6. Plugin allocates a specific GPU to the container (sets device files, drivers)

**Requesting GPUs in pods:**
```yaml
resources:
  limits:
    nvidia.com/gpu: 1          # request exactly 1 GPU
    nvidia.com/gpu: 4          # request 4 GPUs (they come from the same node by default)
  # Note: GPU resources are NOT overcommittable (unlike CPU/memory)
```

**Node Feature Discovery (NFD):**
NFD scans nodes and labels them with hardware features:
```bash
kubectl get nodes -o json | jq '.items[].metadata.labels | to_entries | 
  map(select(.key | contains("nvidia")))' | head -30

# Common labels:
# nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
# nvidia.com/gpu.count: "8"
# nvidia.com/cuda.driver.major: "535"
# feature.node.kubernetes.io/cpu-cpuid.AVX512: "true"
```

#### Topology-Aware GPU Scheduling (Critical for Distributed Training)

For multi-GPU training jobs, performance depends critically on GPU placement:
- GPUs in the same NVLink domain communicate at 600 GB/s (NVLink 3.0)
- GPUs in different NUMA nodes communicate through PCIe + CPU at 64 GB/s
- GPUs on different nodes communicate via InfiniBand at 200–800 Gbps

**Kubernetes topology manager:**
```yaml
# kubelet configuration
topologyManagerPolicy: best-effort   # or: none, restricted, single-numa-node
topologyManagerScope: pod            # allocate resources from same NUMA node for entire pod
```

**Gang scheduling with Kueue:**
Distributed training requires ALL workers to start simultaneously (gang scheduling). If worker 3 of 8 fails to schedule, the other 7 workers sit idle wasting GPU hours.

```yaml
# Kueue ClusterQueue for GPU batch jobs
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: gpu-cluster-queue
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: ["cpu", "memory", "nvidia.com/gpu"]
    flavors:
    - name: h100-nodes
      resources:
      - name: nvidia.com/gpu
        nominalQuota: 64    # 8 nodes × 8 GPUs
```

---

### Part 4: Kubernetes Operators — The Pattern That Powers Nebius's Soperator

#### What Is an Operator?
An operator is a Kubernetes controller that encodes operational knowledge about a specific application. It watches custom resources (CRDs) and reconciles the actual state to match the desired state.

**Why operators exist:**
Kubernetes built-in controllers handle generic workloads well. But complex stateful systems — databases, distributed training clusters, Slurm schedulers — have domain-specific lifecycle requirements:
- How do you roll a database upgrade with zero data loss?
- How do you handle a training job failure at worker 3 without losing the checkpoint?
- How do you drain and replace a Slurm node without losing jobs?

An operator answers these questions in code.

#### The Reconcile Loop
```go
// Every operator implements this interface
func (r *MyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch the custom resource
    var myResource myv1.MyResource
    if err := r.Get(ctx, req.NamespacedName, &myResource); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 2. Observe actual state
    // ... query actual system state ...
    
    // 3. Calculate diff and reconcile
    if actualState != myResource.Spec.DesiredState {
        // take action
    }
    
    // 4. Update status
    myResource.Status.State = "Ready"
    r.Status().Update(ctx, &myResource)
    
    // 5. Requeue after N seconds to catch drift
    return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}
```

#### What Happens When the Operator is Down?
A crucial question. The operator is not in the critical path for running workloads — it only manages changes.
- If the operator pod crashes: existing resources keep running, but no new changes are applied, no self-healing happens
- This is why operators need high availability (leader election with multiple replicas)
- This is why operators must be idempotent — on restart, re-running reconcile on all objects should produce the same result

#### Soperator Architecture (Nebius's Real-World Example)
```
┌──────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                       │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Login Pod   │  │ Controller   │  │ Worker Pods  │   │
│  │  (SSH LB)    │  │   Pod        │  │ (StatefulSet)│   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │           │
│         └─────────────────┼──────────────────┘           │
│                           │ Shared PV (RWX)               │
│                      "Jail" mount                         │
│                     (pivot_root + ns)                     │
└──────────────────────────────────────────────────────────┘
         ▲
         │ CRD: SlurmCluster
         │
  ┌──────┴──────┐
  │  Soperator  │ ← watches SlurmCluster CRD
  │  Controller │   reconciles actual Slurm cluster state
  └─────────────┘
```

**The "jail" mechanism:**
- All Slurm nodes share a PersistentVolume (ReadWriteMany NFS or WEKA)
- Each node uses Linux `pivot_root` to set its root to the shared PV path
- Combined with PID/mount/network namespaces, this creates an isolated execution environment
- Workers can see each other's filesystems (for MPI/NCCL) while being isolated at the OS level

---

### Part 5: Kubernetes Failure Modes and Debugging

#### Scenario: Pod is Pending
```bash
# Step 1: Describe the pod
kubectl describe pod <name> -n <ns> | grep -A 20 Events:

# What each message means:
"0/10 nodes are available: 10 Insufficient nvidia.com/gpu"
# → All GPU quota is consumed

"0/10 nodes are available: 10 node(s) had taint NoSchedule"
# → GPU nodes are tainted; your pod needs matching toleration

"0/10 nodes are available: topology mismatch"
# → Topology-aware placement couldn't find a valid node

"pod has unbound immediate PersistentVolumeClaims"
# → PVC not bound; check StorageClass, PV availability, CSI driver
kubectl get pvc -n <ns>
kubectl get pv
kubectl logs -n kube-system <csi-driver-pod>
```

#### Scenario: Pod in CrashLoopBackOff
```bash
# Get previous container logs (after crash)
kubectl logs <pod> --previous

# Describe pod for exit code
kubectl describe pod <pod> | grep -A 5 "Last State"
# Exit code 1: application error
# Exit code 137: OOMKilled (SIGKILL from kernel OOM killer)
# Exit code 139: Segfault (SIGSEGV)

# Check OOM killer
kubectl describe pod <pod> | grep OOMKilled
# Also check node dmesg via kubectl debug
```

#### Scenario: Service Unreachable
```bash
# 1. Verify endpoints exist and are ready
kubectl get endpoints <svc>
kubectl get endpointslice -l kubernetes.io/service-name=<svc>

# 2. Test DNS resolution inside a pod
kubectl exec -it debug-pod -- nslookup my-service.default.svc.cluster.local
kubectl exec -it debug-pod -- cat /etc/resolv.conf

# 3. Test direct pod IP (bypass service)
kubectl exec -it debug-pod -- curl http://<pod-ip>:<port>

# 4. Check NetworkPolicy
kubectl get networkpolicy -n <ns>
# Can use Hubble to see drops:
hubble observe --type drop --namespace default

# 5. CoreDNS health
kubectl logs -n kube-system deploy/coredns
kubectl get svc -n kube-system kube-dns
```

#### Scenario: Node NotReady
```bash
# 1. Check node conditions
kubectl describe node <name> | grep -A 10 Conditions

# 2. SSH to node, check kubelet
systemctl status kubelet
journalctl -u kubelet --since "5 minutes ago"

# 3. Check container runtime
systemctl status containerd
crictl info

# 4. Disk and memory pressure
df -h
free -h
cat /proc/pressure/memory

# 5. Cilium agent health
kubectl exec -n kube-system ds/cilium -- cilium status
```

---

### Part 6: Cilium Deep Dive — eBPF Network Dataplane

#### Why Cilium Uses Identity-Based Policy
Traditional firewalls use IP addresses for policy. In Kubernetes, pod IPs are ephemeral — they change on every restart. Cilium uses **security identity** — a hash of the pod's labels — instead of IPs.

```
pod labels: {app: frontend, version: v2}
→ identity: 12345 (hash of labels)
→ policy: allow identity 12345 to reach identity 67890 (backend) on port 8080
```

When a pod is replaced, the new pod gets the same labels → same identity → same policy. No policy update needed.

#### NetworkPolicy: What Blocks What
```yaml
# This policy allows only pods with label "app: backend" to receive traffic on port 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - port: 8080
# Default deny: all other ingress traffic to backend pods is dropped
```

**What gets blocked silently:**
- Prometheus scraping (its pods don't have the right labels)
- Health check probes from kubelet (uses node IP, not pod identity)
- Distributed tracing sidecars (need explicit egress policy)
- External DNS lookups (need egress to port 53)

**Debugging with Hubble:**
```bash
# Enable Hubble if not already
cilium hubble enable

# Real-time flow observation
hubble observe --follow

# See all drops for a specific pod
hubble observe --from-pod <namespace>/<pod> --type drop

# L7 visibility (HTTP)
hubble observe --follow --protocol http
# Shows: [source] → [destination] http GET /api/v1/foo 200 1ms

# Export flows for analysis
hubble observe -o json > flows.json
```

---

### Part 7: Nebius-Level Interview Questions + Strong Answers

#### Q: "Walk me through what happens when I run kubectl apply -f pod.yaml"

"The YAML is sent to the API server as a POST or PATCH request. The API server:
1. Authenticates the request (checks my certificate or token)
2. Authorizes it (RBAC: can I create pods in this namespace?)
3. Runs mutating admission webhooks — these can modify the pod spec (e.g., inject sidecars, set default requests)
4. Validates the result against the schema
5. Runs validating admission webhooks — these can reject the pod if policy is violated
6. Persists to etcd and returns 201 Created

Now the scheduler watches the API server for pods with no `spec.nodeName`. It sees the new pod, runs the scheduling algorithm (filter → score → bind), and writes `spec.nodeName` back to the pod object in etcd.

The kubelet on the target node watches for pods assigned to it. It sees the pod, calls containerd via CRI to create the container. containerd calls the image registry to pull if needed, sets up the container filesystem, creates namespaces, and starts the process. Kubelet calls Cilium CNI to set up networking. Cilium creates the veth pair, assigns an IP, and programs eBPF maps for service routing and network policy.

Kubelet begins running readiness probes. Once the probe passes, kubelet sets `conditions.ready = true` on the pod. The EndpointSlice controller adds this pod's IP to the EndpointSlice for any matching Services. Now the pod receives traffic."

---

#### Q: "A service has 3 replicas but one pod is receiving 80% of traffic. What happened?"

"This is a connection-stickiness problem. The most common cause is that the load balancer (or Cilium's eBPF service selection) is correctly distributing new connections, but one client (or a pool client) is holding long-lived connections to one pod.

HTTP/2 over persistent connections is the most frequent culprit. A single HTTP/2 connection can multiplex hundreds of requests. If the client uses one persistent HTTP/2 connection, all its requests go to one pod.

Diagnosis:
1. Check request rates per pod with `kubectl top pods` or Prometheus query `rate(http_requests_total[1m])` by pod label
2. Check active connection count per pod endpoint
3. Use Hubble to count flows per source-destination pair

Solutions:
- At the load balancer level: use connection draining, force reconnects periodically
- At the application level: limit max requests per connection (gRPC MaxConnectionAgeGrace)
- At the Kubernetes level: use `sessionAffinity: None` (should be default)
- For gRPC specifically: use client-side load balancing (headless service + DNS-based) or a mesh like Istio that does L7 load balancing per request"

---

### Points to Remember

- API server → etcd → all other components watch the API server. Nothing talks directly to etcd except the API server.
- Scheduler only writes `spec.nodeName`. It does not start containers.
- kubelet reads from API server, calls CRI (containerd), calls CNI (Cilium).
- Cilium uses eBPF hash maps for O(1) service lookup vs iptables O(n) chain traversal.
- NetworkPolicy is default-allow if no policy exists. A policy on a pod makes everything else default-deny.
- GPU requests use `nvidia.com/gpu` extended resource — NOT overcommittable like CPU.
- Operators reconcile CRDs. They are not in the critical path for running workloads.
- etcd needs majority quorum. 3-node cluster tolerates 1 failure.
- Soperator uses `pivot_root` + Linux namespaces to create "jails" on shared PVs.
- Pod identity in Cilium is based on labels, not IPs — survives pod restarts without policy updates.

### What to Study Next

- [03-gpu-ai-infrastructure.md](/docs/nebius/gpu-ai-infrastructure) — GPU hardware and distributed training operations
- [04-system-design.md](/docs/nebius/system-design) — Design a fault-tolerant GPU cluster
- [01-linux-deep-dive.md](/docs/nebius/linux-deep-dive) — The Linux primitives that Kubernetes is built on

---

## [SRE] GPU and AI Infrastructure — Nebius Level

## GPU and AI Infrastructure — Nebius Level

> Nebius is an AI-first cloud. Their SREs operate GPU fleets, InfiniBand fabrics, and LLM inference platforms at hyperscale. This is not typical Kubernetes operations — it requires understanding hardware failure modes, high-speed networking physics, and AI workload lifecycle.

---

### Mental Model

GPU infrastructure has a fundamentally different failure economics than CPU infrastructure:
- One failed GPU in an 8-GPU training job can idle 7 working GPUs
- Network congestion on InfiniBand can reduce all-reduce throughput by 90%
- A model checkpoint is hours of work — losing it to a hardware failure without checkpointing means starting over

**The Nebius philosophy:** Automate detection, isolation, and replacement so fast that humans never need to be in the emergency loop. Their 12-minute MTTR is achieved by automation, not heroics.

---

### Part 1: GPU Hardware and Failure Modes

#### GPU Architecture (What You Need to Know as an SRE)

A modern NVIDIA GPU (H100, H200, B200) is a compute device with:
- **SMs (Streaming Multiprocessors):** Where computation happens. H100 has 132 SMs.
- **HBM memory:** High-Bandwidth Memory stacked on the GPU die. H100: 80GB HBM3 at 3.35 TB/s
- **NVLink:** High-speed GPU-to-GPU interconnect within a node. H100 NVLink 4.0: 900 GB/s bidirectional
- **PCIe interface:** GPU-to-CPU communication path. PCIe 4.0 x16: ~32 GB/s (much slower than NVLink)
- **InfiniBand HCA:** Network interface card for GPU-to-GPU across nodes. 200–800 Gbps

**Why memory bandwidth matters more than compute:**
For most AI workloads (LLM inference, large batch training), the bottleneck is loading weights from HBM to SMs, not arithmetic. A model with 70B parameters at FP16 requires 140GB of memory — this is why multi-GPU serving exists.

#### GPU Health Monitoring with DCGM

DCGM (Data Center GPU Manager) is NVIDIA's tool for GPU fleet management and health monitoring.

```bash
# Check GPU health
dcgmi diag -r 1          # quick health check
dcgmi diag -r 3          # comprehensive health check (takes minutes)

# GPU field values (real-time)
dcgmi dmon -e 203,252,155,1004,1005,1006
# 203  = SM utilization
# 252  = Memory utilization
# 155  = Temperature
# 1004 = PCIe TX bytes
# 1005 = PCIe RX bytes
# 1006 = NVLink bandwidth

# Check for ECC errors (critical)
dcgmi dmon -e 310,311,312,313,314,315
# 310 = SBE memory errors (Single Bit: usually correctable)
# 311 = DBE memory errors (Double Bit: uncorrectable, GPU needs replacement)
# 312 = SBE L1 cache
# 313 = DBE L1 cache

# GPU topology
dcgmi topo -d 0          # GPU 0 topology

# Also via nvidia-smi
nvidia-smi -q -d ECC          # ECC error counts
nvidia-smi -q -d CLOCK         # clock speeds (thermal throttling visible here)
nvidia-smi -q -d TEMPERATURE   # temperatures
nvidia-smi topo -m             # NVLink topology matrix
```

#### XID Error Codes (Critical for Nebius SRE)

XID errors are GPU hardware error codes logged by the NVIDIA driver. They appear in `dmesg` and are critical indicators of GPU health.

```bash
# Find XID errors
dmesg | grep -i "NVRM: Xid"
journalctl -k | grep "Xid"
```

**Key XID codes:**

| XID | Meaning | Action |
|-----|---------|--------|
| 13 | Graphics Engine Exception | Usually page fault in GPU code; check application |
| 31 | GPU memory page fault | Application error or driver bug |
| 43 | GPU stopped processing | GPU hang; may recover after reset |
| 45 | Preemptive cleanup | GPU reset occurred |
| 48 | DBE (Double Bit ECC Error) | **GPU needs replacement** — unrecoverable memory error |
| 61 | Internal micro-controller halt | **GPU needs replacement** |
| 63 | ECC page retirement | ECC row retired; monitor count, >10 = replace |
| 74 | NVLink error | InfiniBand/NVLink degradation; investigate fabric |
| 79 | GPU fell off the bus | PCIe error; check seating and power |
| 119 | GSP RPC timeout | Firmware error; try reset, then replace |

**Nebius's response to critical XID codes:**
1. DCGM health monitor detects XID 48 or 61
2. Kubernetes node is automatically tainted `nvidia.com/gpu-failure: NoSchedule`
3. Running pods are checkpointed or signaled to drain
4. Node is removed from the scheduling pool
5. Spare node from pre-provisioned buffer is brought in as replacement
6. Total time: ~12 minutes

#### GPU Performance Debugging

```bash
# GPU utilization and memory
watch -n 1 nvidia-smi

# Detailed per-process GPU usage
nvidia-smi pmon -s um          # process-level utilization and memory

# Check thermal throttling
nvidia-smi -q -d CLOCK | grep -A 3 "Clocks Throttle Reasons"
# "HW Thermal Slowdown" = GPU is too hot, clocks reduced
# "SW Power Cap" = power limit hit, clocks reduced

# NVLink health per GPU
nvidia-smi nvlink --status -i 0      # NVLink status for GPU 0
nvidia-smi nvlink --errorcounters -i 0  # NVLink error counts

# InfiniBand port health
ibstat                               # IB HCA status
ibstatus                             # IB HCA status (shorter)
ibportstate 0 1                      # port state for port 1 of HCA 0
perfquery                            # port performance counters

# IB bandwidth benchmark
ib_write_bw                          # measure IB write bandwidth
ib_write_lat                         # measure IB write latency
# Nebius uses these as standard health checks
```

---

### Part 2: InfiniBand — The Networking Backbone for GPU Clusters

#### What Is InfiniBand?

InfiniBand is a high-performance network technology designed from scratch for HPC (High-Performance Computing). Unlike Ethernet which evolved from LAN technology, InfiniBand was built with three priorities:
1. **Extremely low latency:** 3–5 microseconds port-to-port (vs 20–80µs for 100G Ethernet)
2. **Very high bandwidth:** 200 Gbps (HDR) to 800 Gbps (NDR) per port
3. **RDMA:** Remote Direct Memory Access — one GPU can write to another GPU's memory without involving the destination CPU

**Why RDMA matters for AI training:**
In a distributed training all-reduce operation:
- With TCP/Ethernet: GPU memory → CPU → kernel TCP stack → NIC → wire → NIC → kernel → CPU → GPU memory (~10µs + software overhead)
- With RDMA: GPU memory → RDMA engine in NIC → wire → RDMA engine in NIC → GPU memory (~3µs, no CPU involvement)

For a 70B parameter model with 140GB of weight gradients synchronized every iteration, this difference is massive.

#### InfiniBand Architecture

```
GPU Cluster (Fat Tree Topology)
                    
    [Core Switch 1]  [Core Switch 2]
          │                │
    ─────────────────────────────
    │              │             │
[Spine Switch 1] [Spine Switch 2] [Spine Switch 3]
    │         ─────┘        ─────┘
    │        │             │
[Leaf Switch] [Leaf Switch] [Leaf Switch]
   │  │         │  │           │  │
[GPU][GPU]   [GPU][GPU]     [GPU][GPU]
   (Node 1)    (Node 2)       (Node 3)
```

**Fat Tree topology:** Non-blocking bandwidth between any two nodes. Every path from leaf to leaf has the same bandwidth. This ensures all-reduce operations do not have bottleneck links.

#### RoCE — InfiniBand-Style RDMA over Ethernet

Nebius also uses **RoCE (RDMA over Converged Ethernet)** with NVIDIA Spectrum-X as an alternative to InfiniBand:
- Same RDMA capabilities as InfiniBand
- Uses standard Ethernet cabling and switches
- Lower cost than InfiniBand at moderate scale
- Requires Priority Flow Control (PFC) and ECN (Explicit Congestion Notification) for reliable operation
- NVIDIA Quantum-2 InfiniBand vs Spectrum-X Ethernet are Nebius's two network options

#### InfiniBand Troubleshooting

```bash
# Check IB fabric health
ibdiagnet                        # comprehensive fabric diagnostic
ibswitches                       # list all switches in fabric
ibrouters                        # list routers (rarely used)
iblinkinfo                       # all link states and speeds

# Port state
ibportstate <lid> <port>
# Expected: LinkUp, Active, Active (physical, logical, subnet)

# Check for degraded links
iblinkinfo | grep -v "==4X  25.781 Gbps"   # shows non-HDR links

# Performance counters
perfquery <lid> <port>
# Look for: PortXmitDiscards, PortRcvErrors, LinkErrorRecovery, SymbolErrorCounter
# Any non-zero errors = investigate

# Bandwidth test between two nodes
# On receiver:
ib_write_bw -d mlx5_0
# On sender:
ib_write_bw -d mlx5_0 <receiver-ip>

# Expected for HDR200 (200 Gbps): ~23,000 MB/s
# Expected for NDR800 (800 Gbps): ~90,000 MB/s
# If measured value is <80% of expected: link degradation

# Check for IB routing issues
ibping <lid>                     # ping a node by LID
ibtracert <lid>                  # trace route through fabric
```

#### NCCL (NVIDIA Collective Communications Library)

NCCL implements collective operations (all-reduce, broadcast, all-gather) used by PyTorch and TensorFlow for distributed training.

```bash
# NCCL debug logging (set in environment before training job)
export NCCL_DEBUG=INFO           # basic NCCL messages
export NCCL_DEBUG=WARN           # only warnings and errors
export NCCL_DEBUG_SUBSYS=ALL     # very verbose

# NCCL IB transport selection
export NCCL_IB_HCA=mlx5_0       # force specific HCA
export NCCL_IB_DISABLE=0        # enable IB (default if IB available)
export NCCL_P2P_DISABLE=0       # enable NVLink P2P (default)

# NCCL bandwidth test
nccl-tests/build/all_reduce_perf -b 8 -e 512M -f 2 -g 8
# Tests all-reduce from 8 bytes to 512MB, doubling each time, 8 GPUs
# Key metric: busbw (bus bandwidth) — should be near IB link speed
```

---

### Part 3: Distributed Training — Failure Modes and Operations

#### How Distributed Training Works

**Data Parallelism (most common):**
- Each GPU gets a copy of the model
- Dataset is split across GPUs (each GPU sees different batches)
- After forward+backward pass, gradients are synchronized via all-reduce
- All GPUs update their models identically

```
GPU 0: batch 0 → forward → backward → gradients
GPU 1: batch 1 → forward → backward → gradients
...
GPU 7: batch 7 → forward → backward → gradients
                                ↓
                    All-reduce: sum gradients across all GPUs
                                ↓
                    Each GPU updates model with summed gradients
```

**Tensor Parallelism (for very large models):**
- A single model layer is split across GPUs
- Requires extremely fast GPU-to-GPU communication (NVLink)
- All 8 GPUs in a node compute parts of the same layer simultaneously

**Pipeline Parallelism:**
- Different model layers on different GPUs
- Micro-batches flow through the pipeline
- GPUs are rarely all working simultaneously (bubble overhead)

#### Distributed Training Failure Modes

**Worker crash:**
- One process dies (OOM, CUDA error, kernel kill)
- Training job hangs — other workers are waiting for the failed worker in all-reduce
- Recovery: detect via timeout, checkpoint the state, restart the failed worker from checkpoint

**Straggler node:**
- One GPU/node is slow (thermal throttle, PCIe degradation, slower DRAM)
- All-reduce is synchronous — the fastest workers wait for the slowest
- Recovery: identify via per-worker timing, check hardware health, replace if persistent

**Network congestion:**
- IB fabric congestion causes packet drops or retransmissions
- all-reduce latency spikes → training throughput drops
- Check: `perfquery` for PortXmitDiscards, NCCL_DEBUG for timeout messages

**CUDA error mid-training:**
```
RuntimeError: CUDA error: device-side assert triggered
# This is a GPU computation error, often:
# - NaN in gradients (learning rate too high, missing gradient clipping)
# - Invalid memory access in CUDA kernel
# - GPU soft error (ECC correctable, usually harmless)

# After CUDA error: job should checkpoint, node should be health-checked
# Persistent CUDA errors → DCGM diagnostic → XID check
```

#### Checkpointing Strategy

Checkpointing is saving training state to persistent storage so a failure can resume from a checkpoint rather than restarting from scratch.

**What to checkpoint:**
- Model weights (the most important)
- Optimizer state (momentum, Adam m/v vectors)
- Training step count
- RNG state (for reproducibility)
- DataLoader state (to resume from same position in dataset)

**Checkpoint frequency tradeoffs:**
- Too infrequent: lose hours of work on failure
- Too frequent: checkpoint I/O stalls training, wastes GPU time

**Nebius's approach:**
- On detecting a hardware fault, emit SIGTERM to the training process
- Training process has a signal handler that triggers an emergency checkpoint
- Node replacement happens while checkpoint is being saved
- Training resumes on new node from checkpoint

```python
# Signal handler for graceful checkpoint on SIGTERM
import signal, sys, torch

def save_checkpoint(model, optimizer, step, path):
    torch.save({
        'step': step,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
    }, path)

def sigterm_handler(signum, frame):
    print("SIGTERM received — saving checkpoint before exit")
    save_checkpoint(model, optimizer, current_step, '/checkpoint/latest.pt')
    sys.exit(0)

signal.signal(signal.SIGTERM, sigterm_handler)
```

---

### Part 4: LLM Inference Platform (Token Factory)

#### How LLM Inference Works

Running inference on a large language model is different from training:
- **No gradient computation** — just forward pass
- **Memory bound, not compute bound** — loading 70B × 2 bytes (FP16) = 140GB per request start
- **KV cache** — the key/value attention states from prior tokens are cached to avoid recomputation
- **Autoregressive generation** — each token depends on all previous tokens

**Two phases:**
1. **Prefill:** Process the prompt (all input tokens at once). Computationally intensive. Parallelizable across tokens.
2. **Decode:** Generate output tokens one by one. Memory bandwidth bound. Sequential.

This is why Nebius separates prefill and decode onto different resources — they have different hardware requirements.

#### vLLM Architecture

vLLM is the most widely used LLM inference serving framework. Key innovations:

**PagedAttention:** KV cache is managed in fixed-size pages (like OS virtual memory), allowing the system to:
- Allocate KV cache pages on demand (no pre-allocation per request)
- Share KV cache pages between requests with the same prefix (KV cache sharing)
- Achieve much higher throughput than naive implementations

```python
# vLLM inference example (how it's invoked)
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Llama-3-70b-instruct", 
          tensor_parallel_size=8,      # split model across 8 GPUs
          gpu_memory_utilization=0.90)  # use 90% of GPU memory for KV cache

outputs = llm.generate(
    ["Explain InfiniBand networking"],
    SamplingParams(temperature=0.7, max_tokens=200)
)
```

**vLLM SRE concerns:**
- OOM: KV cache fills up → requests fail. Fix: reduce `gpu_memory_utilization`, enable preemption
- High latency: too many concurrent requests, decode phase bottlenecked on memory bandwidth
- Model loading time: 70B model at FP16 = 140GB. Loading takes minutes without optimizations (quantization, lazy loading)

#### KV Cache-Aware Routing (Nebius's 50–60% Hit Rate)

When many users send similar prompts (same system prompt, same few-shot examples), their KV cache can be shared:
```
Request 1: "You are a helpful assistant. [unique user question A]"
Request 2: "You are a helpful assistant. [unique user question B]"
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
           Same prefix → same KV cache
```

Nebius's routing layer:
1. Hash the prompt prefix
2. Route to the server that already has that prefix in KV cache
3. Cache hit: skip prefill for the shared prefix, only compute decode
4. Cache miss: full prefill, cache the result

Result: 50–60% cache hit rate → 50–60% of requests skip expensive prefill → 2–3x throughput improvement

#### Autoscaling Inference Workloads

```yaml
# HPA for inference deployment
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-inference
  minReplicas: 2
  maxReplicas: 16
  metrics:
  - type: External
    external:
      metric:
        name: inference_queue_depth   # custom metric from Prometheus
      target:
        type: AverageValue
        averageValue: "10"            # scale when queue > 10 requests per replica
```

**Scale-to-zero challenge for GPU inference:**
- Cold start time for a 70B model: 3–5 minutes (load model from storage to GPU HBM)
- Cannot scale to zero for real user-facing services — need minimum warm replicas
- Nebius keeps "warm capacity" — pre-loaded model on standby GPUs

---

### Part 5: Soperator — Running HPC Inside Kubernetes

#### What Problem Soperator Solves

HPC workloads traditionally use Slurm as their scheduler. Data scientists and HPC users expect:
- SSH into login nodes
- `srun`/`sbatch` job submission
- MPI, OpenMPI, NCCL collective communications
- Shared filesystem across all nodes

But cloud providers run Kubernetes, not bare-metal Slurm clusters. Soperator bridges this: it runs Slurm inside Kubernetes while preserving the Slurm user experience.

#### Soperator Architecture

**Custom Resource: `SlurmCluster`**
```yaml
apiVersion: slurmops.nebius.com/v1
kind: SlurmCluster
metadata:
  name: my-hpc-cluster
spec:
  slurmVersion: "23.11"
  login:
    replicas: 2               # HA login nodes
    service: LoadBalancer     # external SSH access
  controller:
    replicas: 1               # Slurm controller
  workers:
    replicas: 32              # 32 Slurm worker nodes
    resources:
      nvidia.com/gpu: 8       # 8 GPUs per worker
    nodeSelector:
      nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
  jail:
    storageClass: weka-fast   # shared filesystem for jail mount
    size: 10Ti
```

**The "jail" (shared filesystem + namespace isolation):**
```
Traditional Slurm node:
  - Dedicated VM/bare-metal with full OS
  - SSH directly to Slurm node

Soperator worker pod:
  - Kubernetes Pod running StatefulSet
  - Shared PV mounted at /
  - pivot_root changes / to the shared PV
  - PID namespace: Job sees PID 1 = Slurm daemon
  - Network namespace: Dedicated IP, RDMA-capable
  - User can SSH into login pod, run srun, which dispatches to worker pods
```

**Why `pivot_root` instead of `chroot`:**
`chroot` only changes the root for filesystem operations — the process still runs in the same mount namespace. `pivot_root` actually replaces the root filesystem mount point, moves the old root to a mount point, then unmounts it. This is what container runtimes do. More complete isolation.

#### Soperator Node Autohealing

When a worker node fails (GPU error, kernel panic):
1. Soperator controller detects: Pod in `Error` or `OOMKilled` state, or Slurm node marked DOWN
2. Controller drains in-flight Slurm jobs (sends SIGTERM, waits for checkpoint)
3. Controller deletes the failed worker Pod
4. StatefulSet controller creates a replacement Pod
5. New Pod starts, mounts shared PV, joins Slurm cluster as a fresh node
6. Jobs that were checkpointed are resubmitted to the new node

---

### Part 6: Nebius's 5-Layer Fault Tolerance (System Design Reference)

This is Nebius's published reliability architecture. Know it deeply — it will be referenced in system design interviews.

#### Layer 1: Multi-Stage Acceptance Testing
Before a GPU node enters service, it goes through:
1. **Factory testing:** NVIDIA burn-in at manufacturer
2. **Delivery testing:** Nebius re-runs DCGM diagnostics on delivery
3. **Pre-deployment:** Full GPU, CPU, memory, IB bandwidth tests
4. **Pre-provisioning:** Attach to cluster, run synthetic workload, verify performance
**Result:** Only GPUs that pass all four stages are put into production rotation.

#### Layer 2: Continuous Health Monitoring
Running production nodes are monitored continuously:
- ECC single-bit errors: tracked, node flagged if rate exceeds threshold
- ECC double-bit errors: immediate taint (XID 48)
- NVLink bandwidth: tested via synthetic benchmark on schedule
- InfiniBand: port counters polled by `perfquery`, degraded links flagged
- Temperature and power: DCGM monitors thermal throttling events
- PCIe error counters: polled from `/sys/bus/pci/`

#### Layer 3: Workload Isolation and Prevention
When monitoring detects an issue:
- Node is tainted (`nvidia.com/gpu-degraded: NoSchedule`) immediately
- In-flight training jobs receive SIGTERM for checkpoint
- New workloads are not scheduled on this node
- SLO timer starts for replacement

#### Layer 4: Automated Node Replacement
- A buffer pool of pre-provisioned, fully tested replacement nodes is always ready
- When a node is condemned: replacement node is allocated from buffer
- Replacement node has all dependencies pre-installed (drivers, NCCL, framework)
- Node joins the cluster, becomes schedulable
- Condemned node is sent back for diagnostics/repair
- **Total time: ~12 minutes** (detection → replacement ready)

#### Layer 5: End-to-End Observability
- Dashboards: Grafana showing fleet health, incident history, replacement rates
- Alerts: PagerDuty/Slack for P1 events
- Root cause tracking: each replacement is tagged with failure type
- Trend analysis: identify systematic issues (bad batch of GPUs, firmware version, deployment pattern)

---

### Part 7: Interview Questions + Strong Answers

#### Q: "How would you detect a GPU hardware failure in production before it impacts a training job?"

"I would implement a multi-layer detection strategy:

**Layer 1 — Continuous passive monitoring:**
DCGM exporter running on every node exports to Prometheus. Alert rules on:
- `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL > 0` → immediately page: unrecoverable memory error
- `DCGM_FI_DEV_ECC_SBE_VOL_TOTAL` rate increase → flag for investigation
- `DCGM_FI_DEV_GPU_TEMP > 85` → thermal alert, check cooling
- XID errors in dmesg → parsed by a log scraper, critical XID codes trigger alert

**Layer 2 — Active health checks:**
Schedule a weekly `dcgmi diag -r 3` (comprehensive diagnostic) during low-utilization windows. Also schedule hourly `ib_write_bw` tests between all node pairs to catch InfiniBand degradation early.

**Layer 3 — Workload-level telemetry:**
Monitor per-GPU utilization during training jobs. A GPU that drops to less than 50% utilization while others are at 95% is likely degraded (thermal throttle, PCIe issue, slow DRAM). Alert: `histogram_quantile(0.05, dcgm_sm_utilization)` below threshold per node during training.

**Layer 4 — Automatic response:**
When DCGM detects a critical error, a DaemonSet on each node runs a controller loop that:
1. Reads DCGM health status
2. If unhealthy: taints the node `nvidia.com/gpu-health: unhealthy: NoSchedule`
3. Triggers checkpoint signal to running workloads
4. Creates a `NodeReplacementRequest` custom resource
5. The node replacement operator handles provisioning from the buffer pool"

---

#### Q: "A distributed training job is running 40% slower than expected. How do you diagnose it?"

"First I establish a baseline: what is 'expected' performance? If I have previous run metrics, I compare them. If not, the theoretical peak is based on hardware specs.

Then I look at three bottleneck categories:

**Compute bottleneck (are GPUs actually computing?):**
```bash
# Per-GPU utilization during the job
nvidia-smi dmon -s u -d 1 | head -50
# If SM utilization is <70%: the job is waiting for data or communication, not computing
```

**Data loading bottleneck (IO/CPU feeding the GPU):**
```bash
# CPU utilization on data loader workers
pidstat -u 1 | grep python
# Check DataLoader prefetch queue depth in application logs
# If CPUs are maxed: increase DataLoader workers, use faster storage, pre-process data
```

**Communication bottleneck (all-reduce is slow):**
```bash
# NCCL timing in logs
export NCCL_DEBUG=INFO
# Look for: "NCCL INFO AllReduce ... took Xms" — compare to bandwidth expectation

# IB bandwidth between nodes
ib_write_bw -d mlx5_0 <node2-ip>
# If below expected: check IB port errors, fabric congestion, ECMP routing

# Check for straggler (one slow node delays all)
# Compare per-node iteration times in training logs
```

**Most common root cause I've seen:** A single node with thermal throttling causes the entire job to run at 60% of the slowest node's speed. Identify with `dcgmi dmon -e 190,191` (GPU clock speeds) — throttled node shows lower clocks."

---

### Points to Remember

- ECC single-bit errors: track over time. Double-bit errors: immediate GPU replacement.
- XID 48 (DBE ECC) and XID 61 (controller halt) mean the GPU must be replaced.
- InfiniBand is not Ethernet. It is a different network stack with RDMA and its own management tools.
- NCCL all-reduce is synchronous — one slow GPU stalls all GPUs in the job.
- KV cache in vLLM is managed with PagedAttention — like virtual memory for attention states.
- Nebius's 5-layer fault tolerance achieves 12-minute MTTR via pre-provisioned spare nodes.
- Soperator uses `pivot_root` + namespaces to create isolated Slurm environments inside Kubernetes.
- Checkpointing strategy: frequency vs overhead tradeoff. SIGTERM handler for emergency checkpoint.
- DCGM is the primary GPU health monitoring tool. Run `dcgmi diag` regularly as preventive maintenance.
- RoCE requires PFC + ECN to prevent packet drops (unlike InfiniBand which has hardware flow control).

### What to Study Next

- [04-system-design.md](/docs/nebius/system-design) — Design the GPU cluster reliability system from scratch
- [02-kubernetes-cilium-production.md](/docs/nebius/kubernetes-cilium-production) — Kubernetes orchestration for GPU workloads
- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — Incident scenarios involving GPU failures

---

## [SRE] System Design for Nebius — Distributed GPU Infrastructure

## System Design for Nebius — Distributed GPU Infrastructure

> Nebius's system design stage tests whether you can design infrastructure that fails gracefully, recovers automatically, and scales to hyperscale. This is not FAANG-style "design Twitter" — it is infrastructure design for AI workloads.

---

### Mental Model for System Design at Nebius

Three principles drive every good answer:

1. **Design for failure, not for success.** Every component will fail. The question is whether your system detects it, isolates it, and recovers from it automatically — without human intervention.

2. **Estimate, then design.** A design without numbers is a guess. How many GPUs? What throughput? What latency SLO? Numbers force you to justify your architecture choices.

3. **Observability is not an afterthought.** Instrument everything from day one. You cannot fix what you cannot see, and at Nebius scale, silent failures are the most dangerous kind.

---

### How to Run a System Design Interview (The Framework)

#### Step 1 — Clarify Requirements (5 minutes)
Never start drawing before you ask:
- **Scale:** How many GPUs in the cluster? How many concurrent training jobs? What is peak throughput?
- **Reliability:** What is the SLO? 99.9% = 8.7 hours/year downtime. 99.99% = 52 minutes.
- **Latency:** What is the acceptable MTTR for a GPU node failure?
- **Consistency vs availability:** Can a training job tolerate a brief interruption if it can checkpoint and resume?
- **Scope:** Design the whole system or a specific component?

#### Step 2 — Capacity Estimation (5 minutes)
Make rough estimates before designing:
- Write down key numbers: nodes, GPUs per node, network bandwidth, storage throughput
- Back-of-envelope: "If we have 1,000 nodes × 8 GPUs = 8,000 GPUs. At 80% utilization, ~6,400 active GPUs."
- Estimate storage: "A 70B model at BF16 = 140GB. With 100 concurrent inference replicas = 14TB hot storage."

#### Step 3 — High-Level Architecture (10 minutes)
Draw the major components and data flows. Be explicit about:
- Control plane vs data plane
- Synchronous vs asynchronous paths
- Where state lives (and what happens if that state is lost)

#### Step 4 — Deep Dive (20 minutes)
Interviewer will pick 1–2 areas to go deep. Be ready for:
- "How does the health monitoring work exactly?"
- "What happens if the replacement node fails too?"
- "How do you handle a partial cluster failure?"

#### Step 5 — Tradeoffs and Failure Scenarios (5 minutes)
Close with:
- What are the known weaknesses of your design?
- What would you do differently with more time?
- What could cause your system to fail in ways you haven't addressed?

---

### Design 1: Fault-Tolerant GPU Training Cluster

**Prompt:** "Design a system that can run large-scale distributed AI training workloads with high reliability and fast recovery from hardware failures."

This is the most Nebius-relevant system design. Their engineering blog describes exactly this — use it as your reference architecture.

#### Clarifying Questions to Ask
- "What cluster size are we targeting? 1,000 nodes? 10,000?"
- "What is the target MTTR for a single GPU node failure?"
- "Should training jobs auto-resume from checkpoint or require manual restart?"
- "Do we need multi-tenant support (multiple users sharing the cluster)?"
- "What is the acceptable overhead of health monitoring on training throughput?"

#### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Management Plane                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Kubernetes  │  │   Soperator  │  │  Health Controller   │  │
│  │  API Server  │  │  (Slurm CRD) │  │  (Node Lifecycle)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │                 │                      │
┌─────────▼─────────────────▼──────────────────────▼─────────────┐
│                    Compute Plane                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Node Pool (Production)              Node Pool (Buffer)   │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐        ┌──────┐ ┌──────┐    │  │
│  │  │Node 1│ │Node 2│ │Node 3│  ...   │Node N│ │Node M│    │  │
│  │  │8xH100│ │8xH100│ │8xH100│        │8xH100│ │8xH100│    │  │
│  │  └──────┘ └──────┘ └──────┘        └──────┘ └──────┘    │  │
│  │  DCGM agents on every node    Pre-tested, pre-provisioned │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               InfiniBand Fabric (Fat Tree)                 │  │
│  │  Non-blocking 800 Gbps between any two nodes              │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────────┐
│                   Observability Plane                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Prometheus  │  │   Grafana    │  │      Alertmanager    │  │
│  │  + DCGM exp  │  │  Dashboards  │  │  PagerDuty / Slack   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

#### The Health Monitoring Pipeline (Core Component)

```
DCGM Agent (on each node)
    │ scrapes every 10s
    │ ECC errors, XID codes, temperature, NVLink BW, IB counters
    ▼
Prometheus (cluster-wide)
    │ stores time-series
    │ evaluates alert rules
    ▼
Alertmanager
    │ deduplication, routing, inhibition
    ▼
Health Controller (custom Kubernetes operator)
    │ receives alert
    │ evaluates severity
    ├─ WARN (SBE errors): flag node, schedule next maintenance window
    └─ CRITICAL (DBE error, XID 48/61): immediately taint + drain
            │
            ▼
    Node Replacement Operator
            │ selects pre-provisioned spare from buffer pool
            │ joins spare to cluster
            │ marks failed node for diagnostics
            └─ ~12 minutes total
```

**Buffer pool sizing calculation:**
- At 1,000 nodes: GPU hardware failure rate ≈ 0.5% per day = 5 failures/day
- Each replacement takes 12 minutes, requires 1 spare
- At peak failure rate: need ~2 spares available simultaneously
- Add safety margin: maintain 2–3% buffer = 20–30 spare nodes for 1,000-node cluster

**Interview follow-up: "What if the buffer pool is exhausted?"**
- Alert on buffer pool depth < threshold (e.g., < 5 spares)
- Failed node replacement falls back to: drain job, schedule on next available production node after others complete
- Degrade gracefully: accept longer MTTR rather than over-provision buffer

#### Checkpoint and Recovery Strategy

```
Training Job Lifecycle:
─────────────────────────────────────────────────────────────────
normal run ──────────────────────────────────────────────────────►
                 checkpoint      checkpoint
                    │               │
             ───────▼───────────────▼─────────────────────────────
                 /checkpoint/step-1000   /checkpoint/step-2000

hardware fault detected at step 2500:
1. Health controller taints node
2. Job coordinator receives SIGTERM
3. Job saves emergency checkpoint at step 2500
4. Job exits cleanly
5. Replacement node is provisioned (runs in parallel with step 3-4)
6. Scheduler submits job with --resume /checkpoint/step-2500
7. Training continues with no data loss
─────────────────────────────────────────────────────────────────
```

**Checkpoint storage design:**
- Use distributed filesystem (WEKA/VAST) with multi-AZ replication
- Checkpoint write is not on the critical path — use async write, job continues computing
- Keep last N checkpoints, rotate old ones (save storage)
- Pre-validate checkpoint integrity: save checksum, verify on load

#### SLO Definition for the Training Platform

| SLO | Target | Measurement |
|-----|--------|-------------|
| Node MTTR (hardware failure → replacement ready) | ≤ 15 minutes | P99 replacement time |
| Training job resumption time (from checkpoint) | ≤ 5 minutes | P95 job restart time |
| Job completion rate (fraction of submitted jobs that complete without manual intervention) | ≥ 99.5% | 30-day rolling |
| Cluster GPU utilization | ≥ 80% | Daily average |
| Health monitoring detection latency | ≤ 30 seconds | P95 ECC→alert time |

---

### Design 2: LLM Inference Platform at Scale

**Prompt:** "Design an inference platform that can serve multiple large language models with 99.9% uptime, sub-second latency, and cost-efficient GPU utilization."

#### Capacity Estimation
- Target: 100K requests/day peak = ~1,200 requests/minute peak
- Model: Llama-3 70B, FP16 = 140GB, needs 2× H100 80GB per replica
- Prefill latency for 1K token prompt: ~500ms on 2× H100
- Decode throughput: ~50 tokens/second per replica
- Average response: 200 output tokens = 4 seconds of decode
- RPS per replica: ~15 concurrent requests with batching
- Replicas needed: 1,200 / 15 = 80 replicas → 160 H100 GPUs for 70B model

#### Component Architecture

```
                    ┌─────────────────────┐
                    │   API Gateway        │
                    │   (rate limiting,    │
                    │   auth, routing)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Router / Scheduler  │
                    │  (KV-cache aware)    │
                    │  prefix hash → node  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │  vLLM Pod   │      │  vLLM Pod   │     │  vLLM Pod   │
   │  (2× H100)  │      │  (2× H100)  │     │  (2× H100)  │
   │  Llama-3 70B│      │  Llama-3 70B│     │  Llama-3 70B│
   │  + KV cache │      │  + KV cache │      │  + KV cache │
   └─────────────┘      └─────────────┘     └─────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Model Registry     │
                    │   (weights storage)  │
                    │   WEKA filesystem    │
                    └─────────────────────┘
```

#### KV-Cache Aware Routing (Critical Differentiator)

```python
# Pseudocode for KV-cache aware router
def route_request(request: InferenceRequest) -> str:
    # Extract the system prompt + first N tokens as the "prefix"
    prefix = extract_prefix(request.messages, max_tokens=512)
    prefix_hash = sha256(prefix)
    
    # Find a replica that has this prefix cached
    for replica in get_healthy_replicas():
        if replica.has_prefix(prefix_hash):
            return replica.endpoint  # cache hit: fast prefill
    
    # No cache hit: route to least-loaded replica
    return get_least_loaded_replica().endpoint
```

**Tradeoff to discuss in interview:**
- KV-cache routing creates affinity — some replicas get more traffic
- Pure load balancing would be more even but lose cache benefits
- Solution: combine cache affinity with a load cap (if replica is >90% loaded, route to next-best)

#### Autoscaling Strategy

```
Scale signal: inference_queue_depth > 10 per replica for > 60 seconds
Scale up: add 2 replicas (model loading takes 3 minutes — scale proactively)
Scale down: inference_queue_depth < 2 per replica for > 5 minutes, scale in 1 replica
Min replicas: 2 (for HA — one replica should survive any single pod failure)
Max replicas: 80 (GPU budget)

Scale-to-zero: NOT for production inference (3-minute cold start is unacceptable)
Scale-to-zero: YES for dev/test endpoints (cost savings, longer SLO acceptable)
```

#### Handling Model Updates (Zero-Downtime Deployment)

```
Blue-green deployment for model updates:
1. Provision new replicas with updated model (green fleet)
2. Pre-warm green fleet: send test requests, ensure model is loaded and responsive
3. Router: shift 10% traffic to green fleet (canary)
4. Monitor: error rate, latency, accuracy metrics
5. If healthy for 10 minutes: shift 100% traffic to green
6. Decommission blue fleet
7. If unhealthy: shift 0% back to blue immediately

Key difference from web service blue-green:
- "Pre-warm" step is critical because model loading takes minutes
- GPU memory must be available on green nodes before starting switch
```

---

### Design 3: Observability Pipeline for a GPU Cloud

**Prompt:** "Design the observability stack for a 10,000-GPU cluster. It should handle metrics, logs, and traces at scale."

#### Scale Estimation
- 10,000 GPUs = ~1,250 nodes (8 GPU each)
- Metrics: each node exposes ~500 metrics, scraped every 15s = ~42K metrics/second ingested
- Logs: 1,250 nodes × 100 log lines/second average = 125K log lines/second
- Traces: training spans are long-lived (hours), not like web request traces — adapt accordingly

#### Architecture

```
                        ┌───────────────────────────────────┐
Nodes                   │  Metrics          Logs    Traces   │
                        │  Prometheus   Fluentbit  OTel Agent │
  ┌──────────────┐      └──────┬─────────────┬────────┬─────┘
  │  Node Exporter│            │             │        │
  │  DCGM Exporter│────────────┤             │        │
  │  cAdvisor    │            │             │        │
  │  App metrics  │            │             │        │
  └──────────────┘            │             │        │
                               ▼             ▼        ▼
                        ┌──────────┐  ┌──────────┐ ┌──────────┐
                        │  Prom    │  │   Loki   │ │  Tempo   │
                        │  Remote  │  │ (log agg)│ │ (traces) │
                        │  Write   │  └────┬─────┘ └────┬─────┘
                        └────┬─────┘       │             │
                             │             │             │
                        ┌────▼─────────────▼─────────────▼─────┐
                        │          Grafana (Unified UI)          │
                        │  Dashboards | Alerts | Explore         │
                        └────────────────────┬──────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Alertmanager    │
                                    │  PagerDuty/Slack │
                                    └─────────────────┘
```

#### Prometheus at Scale — The Federation Challenge

A single Prometheus instance can handle ~1M active time series. At 10K nodes × 500 metrics = 5M series — needs sharding.

**Two strategies:**

**Strategy 1: Prometheus Federation**
```yaml
# Global Prometheus scrapes aggregated metrics from regional Prometheus instances
scrape_configs:
- job_name: 'federate'
  honor_labels: true
  metrics_path: '/federate'
  params:
    match[]:
    - '{__name__=~"job:.*"}'   # only pre-aggregated metrics
  static_configs:
  - targets:
    - 'prometheus-region-1:9090'
    - 'prometheus-region-2:9090'
```

**Strategy 2: Thanos or Cortex (preferred at Nebius scale)**
- Multiple Prometheus instances, each sharding a portion of the cluster
- Thanos Sidecar uploads data to object storage (Nebius Object Storage)
- Thanos Query handles cross-shard queries with deduplication
- Thanos Compact for long-term storage compaction
- This gives: unlimited retention, global queries, HA

#### SLI/SLO Design for the Platform

**What to measure (SLIs):**
- GPU availability: `count(healthy_gpus) / count(total_gpus)` — target 99.5%
- Training job completion rate: jobs completed / jobs submitted — target 99.5%
- Inference API error rate: `rate(http_errors_5xx[5m]) / rate(http_requests[5m])` — target < 0.1%
- Inference P99 latency: `histogram_quantile(0.99, inference_duration_seconds)` — target < 2s

**Alert routing:**
```yaml
# Critical: pages on-call immediately
- alert: GPUHealthCritical
  expr: dcgm_ecc_dbe_errors_total > 0
  labels:
    severity: critical
  annotations:
    summary: "GPU {{ $labels.gpu }} has uncorrectable ECC errors"
    runbook: "https://wiki/runbooks/gpu-ecc-critical"

# Warning: creates ticket, notifies Slack
- alert: InferenceLatencyHigh
  expr: histogram_quantile(0.99, rate(inference_duration_seconds_bucket[5m])) > 1.5
  for: 5m
  labels:
    severity: warning
```

---

### Design 4: Kubernetes Multi-Tenant GPU Cluster

**Prompt:** "Design a Kubernetes cluster that supports multiple tenants sharing a GPU pool, with fair resource allocation, isolation, and cost attribution."

#### The Core Challenges
1. **Resource contention:** One tenant can starve others if not limited
2. **Isolation:** A tenant's training failure should not affect other tenants
3. **Cost attribution:** Who used what, for billing and chargeback
4. **Fairness:** Multiple jobs waiting for the same GPU pool

#### Architecture with Kueue

```yaml
# ClusterQueue: defines resource capacity
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: shared-gpu-pool
spec:
  namespaceSelector: {}
  cohort: company-wide           # enables borrowing between queues
  resourceGroups:
  - coveredResources: ["nvidia.com/gpu", "cpu", "memory"]
    flavors:
    - name: h100-nodes
      resources:
      - name: nvidia.com/gpu
        nominalQuota: 64         # 8 nodes guaranteed
        borrowingLimit: 128      # can borrow up to 128 if pool is available
        lendingLimit: 32         # can lend up to 32 to others

---
# LocalQueue: per-team queue
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  name: team-research-queue
  namespace: team-research
spec:
  clusterQueue: shared-gpu-pool
```

**Preemption strategy:**
- High-priority job from Team A needs GPUs held by low-priority job from Team B
- Kueue preempts Team B's job (sends SIGTERM for checkpoint), releases GPUs
- Team B's job is re-queued (will run when capacity is available)
- Fair scheduling: BorrowWithinCohort — teams can borrow each other's capacity

#### Namespace Isolation Model

```
Kubernetes Cluster
├── Namespace: team-research
│   ├── ResourceQuota: 64 GPUs max, 1TB memory max
│   ├── LimitRange: pod max = 8 GPUs per pod
│   ├── NetworkPolicy: egress to internet blocked, ingress from team only
│   └── Pod Security Standard: Restricted (no privileged containers)
│
├── Namespace: team-inference
│   ├── ResourceQuota: 32 GPUs max
│   └── ...
│
└── Namespace: kube-system (cluster management)
    └── (isolated from tenant workloads)
```

#### Cost Attribution

```
# Per-namespace GPU hour consumption
sum by (namespace) (
  increase(
    kube_pod_container_resource_requests{resource="nvidia.com/gpu"}[1d]
  )
)

# This gives you: "Team Research used 1,024 GPU-hours today"
# Multiply by cost-per-GPU-hour = chargeback amount
```

---

### Common Tradeoffs to Discuss in Every Design

#### Availability vs Consistency
- During a network partition, should the cluster accept new job submissions (availability) or refuse until quorum is restored (consistency)?
- For training jobs: availability — resume from checkpoint if needed
- For billing data: consistency — wrong charges are worse than delayed job acceptance

#### Horizontal vs Vertical Scaling
- Inference serving: scale horizontally (add replicas) — stateless, easy
- etcd: scale vertically (more RAM/faster disk) — consensus overhead makes horizontal scaling harder
- Checkpointing storage: scale horizontally (more nodes, more WEKA storage servers)

#### Centralized vs Distributed Monitoring
- Centralized (Thanos): global queries, easier operations, single failure domain
- Distributed (per-datacenter Prometheus): fault isolation, lower cross-DC traffic, harder to query globally

---

### Points to Remember

- Always ask clarifying questions before designing — scale, SLO, latency requirements
- Buffer pool sizing: 2–3% of cluster as spare nodes is the Nebius model
- KV-cache aware routing improves inference throughput 2–3x without adding hardware
- Blue-green for ML inference: pre-warm before shifting traffic (model loading takes minutes)
- Thanos/Cortex over raw Prometheus for >5M active time series
- Kueue for fair multi-tenant GPU scheduling with gang scheduling and preemption
- SLI/SLO definitions: make them measurable, make them actionable
- The 5-layer reliability model is Nebius's actual architecture — knowing it shows you did homework

### What to Study Next

- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply these designs to incident scenarios
- [03-gpu-ai-infrastructure.md](/docs/nebius/gpu-ai-infrastructure) — the hardware detail behind these designs
- Interview-prep foundations [07-system-design-cloud-architecture.md](../foundations/07-system-design-cloud-architecture.md) — broader system design principles

---

## [SRE] Coding and Algorithms — Nebius Interview Prep

## Coding and Algorithms — Nebius Interview Prep

> Nebius's coding stage is Stage 2: 2 LeetCode-style problems (Easy to Medium) + practical SRE automation tasks. The bar is clean code, not trick solutions. Python is the preferred language for most SRE candidates.

---

### Mental Model

Nebius is not a FAANG algorithms shop. They test coding because:
1. SREs write real code (automation tools, health checkers, data processors)
2. They want to see how you think and structure code under observation
3. They want to confirm you can handle basic data structures without fumbling

**What wins:** Clean, readable code with proper error handling and correct complexity analysis.
**What loses:** Over-engineering, syntax errors, or not talking through your approach.

---

### Part 1: SRE Automation — Python Scripts You Must Be Able to Write

These are the practical coding tasks that show up in Stage 1 and Stage 2.

#### Script 1: HTTP Health Checker with Retry and Backoff

```python
#!/usr/bin/env python3
"""
HTTP health checker with exponential backoff and structured output.
Nebius-relevant: health checking API endpoints, service availability probing.
"""
import argparse
import json
import logging
import random
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

@dataclass
class HealthResult:
    url: str
    status_code: Optional[int]
    latency_ms: float
    healthy: bool
    error: Optional[str] = None

def probe_url(url: str, timeout_s: float = 5.0) -> HealthResult:
    """Single HTTP probe attempt."""
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as resp:
            latency_ms = (time.monotonic() - start) * 1000
            healthy = 200 <= resp.status < 400
            return HealthResult(
                url=url,
                status_code=resp.status,
                latency_ms=latency_ms,
                healthy=healthy
            )
    except urllib.error.HTTPError as e:
        latency_ms = (time.monotonic() - start) * 1000
        return HealthResult(url=url, status_code=e.code,
                           latency_ms=latency_ms, healthy=False,
                           error=str(e))
    except Exception as e:
        latency_ms = (time.monotonic() - start) * 1000
        return HealthResult(url=url, status_code=None,
                           latency_ms=latency_ms, healthy=False,
                           error=str(e))

def check_with_retry(url: str, retries: int = 3,
                     base_delay_s: float = 1.0,
                     max_delay_s: float = 30.0,
                     timeout_s: float = 5.0) -> HealthResult:
    """Probe with exponential backoff + jitter."""
    last_result = None
    for attempt in range(retries + 1):
        result = probe_url(url, timeout_s)
        if result.healthy:
            return result
        last_result = result
        if attempt < retries:
            # Exponential backoff with full jitter
            delay = min(base_delay_s * (2 ** attempt), max_delay_s)
            jitter = random.uniform(0, delay)
            logging.warning(
                "Attempt %d/%d failed for %s (error=%s). Retrying in %.1fs",
                attempt + 1, retries + 1, url, result.error, jitter
            )
            time.sleep(jitter)
    return last_result

def main() -> int:
    parser = argparse.ArgumentParser(description="HTTP health checker")
    parser.add_argument("urls", nargs="+", help="URLs to check")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    results = []
    all_healthy = True

    for url in args.urls:
        result = check_with_retry(url, retries=args.retries,
                                  timeout_s=args.timeout)
        results.append(result)
        if not result.healthy:
            all_healthy = False
        if args.json:
            print(json.dumps({
                "url": result.url,
                "status": result.status_code,
                "latency_ms": round(result.latency_ms, 2),
                "healthy": result.healthy,
                "error": result.error
            }))
        else:
            status = "OK" if result.healthy else "FAIL"
            print(f"[{status}] {url} — {result.status_code} — {result.latency_ms:.1f}ms")

    return 0 if all_healthy else 1

if __name__ == "__main__":
    sys.exit(main())
```

**Key patterns to explain in interview:**
- `time.monotonic()` — not `time.time()`. Monotonic clock is not affected by system clock adjustments (NTP, leap seconds). Always use for latency measurement.
- Full jitter in backoff: `random.uniform(0, delay)` — distributes retry load across multiple clients. Without jitter, all clients retry at the same time and create thundering herd.
- `@dataclass` — clean result container without boilerplate `__init__`. Shows modern Python knowledge.
- Exit code 1 on failure — scripts are composable. CI/CD and monitoring systems rely on exit codes.

---

#### Script 2: JSON Log Analyzer

```python
#!/usr/bin/env python3
"""
Analyze newline-delimited JSON logs.
Nebius-relevant: analyzing training logs, inference request logs, health check logs.
"""
import argparse
import collections
import json
import sys
from pathlib import Path
from typing import Iterator

def parse_log_lines(source) -> Iterator[dict]:
    """Yield parsed log entries, skip malformed lines."""
    for i, line in enumerate(source, 1):
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            # Log but don't crash — partial log files are common
            print(f"Warning: line {i} is not valid JSON: {e}", file=sys.stderr)

def analyze_logs(entries: Iterator[dict]) -> dict:
    """Compute summary statistics from log entries."""
    error_counts = collections.Counter()
    level_counts = collections.Counter()
    latency_values = []
    total = 0

    for entry in entries:
        total += 1
        level = entry.get("level", entry.get("severity", "unknown")).upper()
        level_counts[level] += 1

        # Count errors by type
        if level in ("ERROR", "CRITICAL", "FATAL"):
            error_type = entry.get("error_type",
                                   entry.get("exception",
                                   entry.get("msg", "unknown")))
            # Truncate long messages for grouping
            error_key = str(error_type)[:80]
            error_counts[error_key] += 1

        # Collect latency if present
        for lat_key in ("latency_ms", "duration_ms", "response_time_ms"):
            if lat_key in entry:
                try:
                    latency_values.append(float(entry[lat_key]))
                except (ValueError, TypeError):
                    pass
                break

    result = {
        "total_lines": total,
        "by_level": dict(level_counts.most_common()),
        "top_errors": dict(error_counts.most_common(10)),
    }

    if latency_values:
        latency_values.sort()
        n = len(latency_values)
        result["latency"] = {
            "count": n,
            "p50_ms": round(latency_values[n // 2], 2),
            "p95_ms": round(latency_values[int(n * 0.95)], 2),
            "p99_ms": round(latency_values[int(n * 0.99)], 2),
            "max_ms": round(latency_values[-1], 2),
        }

    return result

def main() -> int:
    parser = argparse.ArgumentParser(description="JSON log analyzer")
    parser.add_argument("logfile", nargs="?", help="Log file (default: stdin)")
    args = parser.parse_args()

    if args.logfile:
        source = Path(args.logfile).open()
    else:
        source = sys.stdin

    with source if hasattr(source, '__enter__') else open(args.logfile) as f:
        entries = parse_log_lines(f)
        summary = analyze_logs(entries)

    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Key patterns:**
- Generator (`yield`) — processes huge log files without loading all into memory
- `collections.Counter` — for frequency counting, has `.most_common(n)` built in
- Graceful handling of malformed lines — real log files are always slightly broken
- Works with both file and stdin — composable with `cat`, `kubectl logs`, `docker logs`

---

#### Script 3: Kubernetes Pod Resource Reporter

```python
#!/usr/bin/env python3
"""
Report GPU and CPU resource usage per namespace.
Nebius-relevant: GPU quota monitoring, cost attribution, capacity planning.
"""
import json
import subprocess
import sys
from collections import defaultdict

def kubectl(*args) -> dict:
    """Run kubectl and return parsed JSON output."""
    cmd = ["kubectl"] + list(args) + ["-o", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

def parse_resource(value: str) -> float:
    """Convert Kubernetes resource string to float (CPU=cores, memory=bytes, GPU=count)."""
    if not value:
        return 0.0
    # CPU: "100m" = 0.1 cores, "2" = 2 cores
    if value.endswith("m"):
        return float(value[:-1]) / 1000
    # Memory: "128Mi", "2Gi", "1Ti"
    suffixes = {"Ki": 2**10, "Mi": 2**20, "Gi": 2**30, "Ti": 2**40,
                "K": 1000, "M": 10**6, "G": 10**9, "T": 10**12}
    for suffix, multiplier in suffixes.items():
        if value.endswith(suffix):
            return float(value[:-len(suffix)]) * multiplier
    return float(value)

def get_pod_resources() -> dict:
    """Aggregate resource requests by namespace."""
    pods_data = kubectl("get", "pods", "--all-namespaces")
    by_namespace = defaultdict(lambda: defaultdict(float))

    for pod in pods_data.get("items", []):
        ns = pod["metadata"]["namespace"]
        phase = pod.get("status", {}).get("phase", "")
        if phase not in ("Running", "Pending"):
            continue

        for container in pod.get("spec", {}).get("containers", []):
            requests = container.get("resources", {}).get("requests", {})
            by_namespace[ns]["cpu"] += parse_resource(requests.get("cpu", "0"))
            by_namespace[ns]["memory_gb"] += parse_resource(
                requests.get("memory", "0")) / 2**30
            by_namespace[ns]["gpus"] += parse_resource(
                requests.get("nvidia.com/gpu", "0"))

    return dict(by_namespace)

def main() -> int:
    try:
        resources = get_pod_resources()
    except subprocess.CalledProcessError as e:
        print(f"kubectl error: {e.stderr}", file=sys.stderr)
        return 1

    if not resources:
        print("No resources found.")
        return 0

    # Print table
    print(f"{'NAMESPACE':<30} {'CPU':>8} {'MEMORY(GB)':>12} {'GPUS':>6}")
    print("-" * 60)

    total = defaultdict(float)
    for ns in sorted(resources):
        r = resources[ns]
        print(f"{ns:<30} {r['cpu']:>8.2f} {r['memory_gb']:>12.1f} {r['gpus']:>6.0f}")
        for k, v in r.items():
            total[k] += v

    print("-" * 60)
    print(f"{'TOTAL':<30} {total['cpu']:>8.2f} {total['memory_gb']:>12.1f} {total['gpus']:>6.0f}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

#### Script 4: Retry Decorator (Common Interview Pattern)

```python
import functools
import logging
import random
import time
from typing import Callable, Tuple, Type

def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    jitter: bool = True
):
    """
    Decorator for retrying a function with exponential backoff.
    
    Usage:
        @retry(max_attempts=5, exceptions=(IOError, TimeoutError))
        def call_api():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts - 1:
                        break
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    if jitter:
                        delay = random.uniform(0, delay)
                    logging.warning(
                        "%s: attempt %d/%d failed (%s). Retrying in %.1fs",
                        func.__name__, attempt + 1, max_attempts, e, delay
                    )
                    time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator

# Example usage
@retry(max_attempts=4, base_delay=2.0, exceptions=(ConnectionError, TimeoutError))
def fetch_model_weights(model_id: str) -> bytes:
    """Fetch model weights from object storage."""
    # ... implementation
    pass
```

---

### Part 2: Algorithms — What Nebius Actually Tests

Confirmed from real candidate reports. These are Easy to Medium LeetCode problems. Focus on clean implementation, not memorized solutions.

#### Pattern 1: Dynamic Programming

**Pascal's Triangle (LeetCode 118 — Easy)**
```python
def generate(numRows: int) -> list[list[int]]:
    """
    Generate first numRows of Pascal's Triangle.
    Each element = sum of two elements above it.
    
    Time: O(n²)  Space: O(n²)
    """
    if numRows == 0:
        return []
    
    triangle = [[1]]
    
    for row_idx in range(1, numRows):
        prev = triangle[row_idx - 1]
        # First and last element are always 1
        row = [1]
        # Middle elements = sum of two above
        for j in range(1, row_idx):
            row.append(prev[j-1] + prev[j])
        row.append(1)
        triangle.append(row)
    
    return triangle

# Test
assert generate(5) == [[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
```

**Minimum Path Sum (LeetCode 64 — Medium)**
```python
def minPathSum(grid: list[list[int]]) -> int:
    """
    Find path from top-left to bottom-right with minimum sum.
    Can only move right or down.
    
    Key insight: dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]
    Optimize space: modify grid in-place.
    
    Time: O(m*n)  Space: O(1) with in-place modification
    """
    m, n = len(grid), len(grid[0])
    
    # First row: can only come from left
    for j in range(1, n):
        grid[0][j] += grid[0][j-1]
    
    # First column: can only come from above
    for i in range(1, m):
        grid[i][0] += grid[i-1][0]
    
    # Fill rest: take minimum of above and left
    for i in range(1, m):
        for j in range(1, n):
            grid[i][j] += min(grid[i-1][j], grid[i][j-1])
    
    return grid[m-1][n-1]
```

**Interview tip for DP:** Always state the recurrence relation first: "dp[i][j] represents X, and it equals Y because Z." This shows you understand the problem, not just the code.

---

#### Pattern 2: Hash Maps

**Isomorphic Strings (LeetCode 205 — Easy)**
```python
def isIsomorphic(s: str, t: str) -> bool:
    """
    Two strings are isomorphic if characters can be replaced consistently.
    'egg' and 'add' are isomorphic: e→a, g→d
    'foo' and 'bar' are not: o maps to both 'a' and 'r'
    
    Key: bidirectional mapping required (s→t and t→s)
    
    Time: O(n)  Space: O(1) — bounded by character set size (256)
    """
    s_to_t = {}
    t_to_s = {}
    
    for cs, ct in zip(s, t):
        if cs in s_to_t:
            if s_to_t[cs] != ct:
                return False  # s char mapped to different t char
        else:
            s_to_t[cs] = ct
        
        if ct in t_to_s:
            if t_to_s[ct] != cs:
                return False  # t char mapped to different s char
        else:
            t_to_s[ct] = cs
    
    return True

# Test cases
assert isIsomorphic("egg", "add") == True
assert isIsomorphic("foo", "bar") == False
assert isIsomorphic("paper", "title") == True
```

---

#### Pattern 3: Greedy + Sorting

**Maximum Units on a Truck (LeetCode 1710 — Easy)**
```python
def maximumUnits(boxTypes: list[list[int]], truckSize: int) -> int:
    """
    boxTypes[i] = [numberOfBoxes, numberOfUnitsPerBox]
    Maximize units loaded on truck of given size.
    
    Greedy: always load the box type with most units per box first.
    
    Time: O(n log n) for sort  Space: O(1)
    """
    # Sort by units per box, descending
    boxTypes.sort(key=lambda x: x[1], reverse=True)
    
    total_units = 0
    remaining_capacity = truckSize
    
    for num_boxes, units_per_box in boxTypes:
        if remaining_capacity <= 0:
            break
        # Take as many of this box type as possible
        boxes_taken = min(num_boxes, remaining_capacity)
        total_units += boxes_taken * units_per_box
        remaining_capacity -= boxes_taken
    
    return total_units

# Test
assert maximumUnits([[1,3],[2,2],[3,1]], 4) == 8  # take 1×3 + 2×2 + 1×1
assert maximumUnits([[5,10],[2,5],[4,7],[3,9]], 10) == 91
```

---

#### Pattern 4: String Manipulation

**Custom Sort String (LeetCode 791 — Medium)**
```python
def customSortString(order: str, s: str) -> str:
    """
    Sort s such that characters appear in the order specified by 'order'.
    Characters not in order can appear in any position.
    
    Approach: count chars in s, rebuild in order's sequence.
    
    Time: O(n + k) where k=len(order)  Space: O(n)
    """
    # Count characters in s
    count = collections.Counter(s)
    
    result = []
    # First: characters in order, in order
    for c in order:
        result.append(c * count.pop(c, 0))
    
    # Then: remaining characters (not in order)
    for c, cnt in count.items():
        result.append(c * cnt)
    
    return "".join(result)

import collections
# Test
assert customSortString("cba", "abcd") in ["cbad", "cbda"]  # c before b before a, d anywhere
```

---

### Part 3: How to Perform in a Live Coding Interview

#### Before Writing Code
1. Repeat the problem back: "So I need to X, given Y, and return Z?"
2. Clarify edge cases: "What if the input is empty? Can values be negative?"
3. State your approach: "I'll use a hash map for O(1) lookup. The time complexity will be O(n)."
4. Only then code

#### While Coding
- Talk through what you're doing: "I'm sorting here because I want to greedily pick the highest-value boxes first."
- If you get stuck: "I'm going to stub this function and come back to it."
- Test with the example first: run through the example by hand before submitting

#### When Done
- Test with edge cases: empty input, single element, all same value
- State complexity: "Time is O(n log n) for the sort, space is O(n) for the result."
- Ask: "Should I optimize for space? I could do this in O(1) with an in-place approach."

#### Common Mistakes to Avoid
- Not handling empty input
- Off-by-one in array indexing
- Assuming int when float is possible
- Mutating input without flagging it
- Not discussing complexity at the end

---

### Part 4: Python for SRE — Patterns You Must Know

#### subprocess — Running Shell Commands Safely
```python
import subprocess

# SAFE: list form prevents shell injection
result = subprocess.run(
    ["kubectl", "get", "pods", "-n", namespace],
    capture_output=True,
    text=True,
    check=True          # raises CalledProcessError on non-zero exit
)
print(result.stdout)

# UNSAFE: never use shell=True with user input
# subprocess.run(f"kubectl get pods -n {namespace}", shell=True)  # injection risk!

# Capture both stdout and stderr
result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if result.returncode != 0:
    logging.error("Command failed: %s", result.stderr.decode())
```

#### pathlib — Modern File Operations
```python
from pathlib import Path

# Create directory tree
checkpoint_dir = Path("/checkpoints") / "job-123" / "step-1000"
checkpoint_dir.mkdir(parents=True, exist_ok=True)

# Iterate files matching pattern
for log_file in Path("/var/log").glob("**/*.log"):
    print(log_file)

# Read / write safely
config = Path("/etc/myapp/config.json").read_text()
Path("/tmp/output.json").write_text(json.dumps(data))

# Check existence without exception
if not (checkpoint_dir / "model.pt").exists():
    raise FileNotFoundError(f"Checkpoint not found: {checkpoint_dir}")
```

#### context managers — Resource Safety
```python
# Always use context managers for file I/O
with open("/path/to/file") as f:
    data = f.read()

# Custom context manager for temporary resources
from contextlib import contextmanager

@contextmanager
def temp_gpu_allocation(gpu_id: int):
    """Allocate GPU and ensure cleanup on exit."""
    allocate_gpu(gpu_id)
    try:
        yield gpu_id
    finally:
        release_gpu(gpu_id)  # always runs, even on exception

with temp_gpu_allocation(0) as gpu:
    run_inference(gpu)
```

#### argparse — CLI Tools
```python
import argparse

def parse_args():
    parser = argparse.ArgumentParser(
        description="GPU cluster health checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --nodes 10 --threshold 0.95
  %(prog)s --dry-run --verbose
"""
    )
    parser.add_argument("--nodes", type=int, default=10,
                       help="Number of nodes to check (default: 10)")
    parser.add_argument("--threshold", type=float, default=0.95,
                       help="Health threshold 0.0-1.0 (default: 0.95)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Check without making changes")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()
```

---

### Points to Remember

- `time.monotonic()` for latency measurement, not `time.time()`
- Full jitter backoff prevents thundering herd
- Generators (`yield`) for large file processing — don't load everything into memory
- `subprocess.run()` with list args (not shell=True) to avoid injection
- `collections.Counter` and `collections.defaultdict` — interview favorites
- State your approach before coding, complexity at the end
- Edge cases: empty input, single element, duplicates, negative numbers
- Exit code 1 on failure — scripts must be composable

### What to Study Next

- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply coding skills to live incident debugging
- LeetCode practice: Pascal's Triangle, Minimum Path Sum, Maximum Units on a Truck, Isomorphic Strings, Custom Sort String
- Python docs: `collections`, `pathlib`, `subprocess`, `argparse`, `contextlib`

---

## [SRE] Stress Interview and Incident Response — Nebius Stage 4

## Stress Interview and Incident Response — Nebius Stage 4

> Stage 4 at Nebius is unusual: a 30-minute deliberate stress scenario where you must debug a production incident in real time, under pressure, while narrating your thinking. The pressure is intentional — they want to see how you behave when things are hard, not when they are easy.

---

### Mental Model

The stress interview is not testing whether you know the answer. It is testing:
1. **Structured thinking under pressure** — do you have a method or do you flail?
2. **Communication under pressure** — can you explain what you're doing and why?
3. **Hypothesis-driven debugging** — do you form hypotheses and test them, or fire random commands?
4. **Composure** — do you slow down when overwhelmed, or speed up and make errors?

**The winning script for every answer:**
```
"I observe [X symptom].
My first hypothesis is [Y] because [Z reasoning].
To confirm, I will run [specific command] and look for [specific output].
While I confirm that, the immediate mitigation I would consider is [A].
If Y is wrong, my next hypothesis is B."
```

Practice this script until it is automatic.

---

### Part 1: The Structured Debugging Approach

#### Step 1 — Orient Before You Act
Before running any command, answer these 4 questions:
1. What is the symptom? (latency spike? error rate? resource exhaustion?)
2. What scope? (one node? one pod? all pods? all users? one region?)
3. What changed recently? (deploy? config change? traffic increase? hardware event?)
4. What is the blast radius? (how many users affected? is this getting worse?)

#### Step 2 — Form a Hypothesis
A hypothesis is: "I believe [X] is causing [Y] because [Z]."

**Good hypothesis:** "I believe the database connection pool is exhausted because the error messages show `connection timeout` and the service was recently deployed with fewer connection pool slots."

**Bad non-hypothesis:** "Let me just check everything."

#### Step 3 — Test the Hypothesis (One Command, One Thing)
Each command should test exactly one hypothesis. Interpret the output before running the next command.

#### Step 4 — Communicate Every Step
In the stress interview, silence is failure. Even if you don't know what to do next, say:
- "I'm not finding evidence for my first hypothesis. Let me think about what else could cause this."
- "I see this output — it's unexpected. Let me pause and reason about what it means."

#### Step 5 — Identify Mitigation Separately from Root Cause
Sometimes you can mitigate (stop the bleeding) before you find root cause. State this explicitly:
- "I want to separate: what can we do right now to reduce user impact, vs what is the actual root cause?"
- Mitigation: restart pod, scale up replicas, route traffic away from bad node
- Root cause: needs more investigation, can happen in parallel

---

### Part 2: Incident Scenarios — Full Practice Run

#### Incident 1: GPU Training Job Hanging

**Scenario:** "A distributed training job submitted 2 hours ago has not progressed in 45 minutes. GPU utilization is at 0% for all workers. The job has not crashed — all pods are in Running state."

---

**Structured response:**

**Orient:**
```
Symptom: Training job running but not making progress. 0% GPU utilization.
Scope: This specific job, all workers
Recent changes: None mentioned — ask the interviewer
```

**Hypothesis 1:** All-reduce communication is blocked — one worker is waiting for another.
```bash
# Check if NCCL is waiting by looking at process state
kubectl get pods -l job-name=my-training-job -o wide
# All Running — good, not crashed

# SSH into one worker
kubectl exec -it worker-0 -- bash

# Check what the Python process is doing
ps aux | grep python
# PID 1234 — check its state

cat /proc/1234/wchan
# If showing "futex_wait" or similar — process is blocked on synchronization

# Check NCCL debug output
kubectl logs worker-0 | tail -50
# Look for: "NCCL INFO AllReduce" or "NCCL WARN" messages
```

**If NCCL is waiting:**
```bash
# Identify which worker is the straggler
# All workers wait for the slowest in synchronous all-reduce
for pod in $(kubectl get pods -l job-name=my-training-job -o name); do
  echo "=== $pod ===" 
  kubectl exec $pod -- cat /proc/1/status | grep State
done
# One might show "D" (uninterruptible sleep) — that's the hung one
```

**Hypothesis 2:** One worker has a GPU error (XID code, ECC error).
```bash
# Check dmesg on each worker node
kubectl get pods -l job-name=my-training-job -o wide | awk '{print $7}'
# Get node names

# Check for GPU errors
kubectl debug node/<node-name> -it --image=ubuntu -- dmesg | grep -i "NVRM\|xid\|GPU"
# XID 43 = GPU stopped processing
# XID 48 = ECC uncorrectable error → GPU hardware failure
```

**Hypothesis 3:** Network partition — one worker cannot reach others.
```bash
# From worker-0, try to reach worker-1's IP directly
kubectl exec -it worker-0 -- ping <worker-1-ip>
# Or test NCCL connectivity
kubectl exec -it worker-0 -- ib_write_lat <worker-1-ip>
# If IB latency fails or times out: network partition
```

**Mitigation:**
"My immediate mitigation would be to checkpoint what we have and restart the job. Since it's been hanging for 45 minutes, we've lost ~45 minutes of compute. If I can identify which worker is stuck, I can preemptively drain it and restart the job with a replacement worker, rather than letting all workers idle further."

---

#### Incident 2: Kubernetes Node NotReady, Pods Evicted

**Scenario:** "We have 3 nodes in a NotReady state. About 40 pods have been evicted and are failing to reschedule. Users are reporting intermittent service errors."

---

**Structured response:**

**Orient:**
```
Symptom: 3 nodes NotReady, 40 pods evicted, services degraded
Scope: 3 nodes (out of how many? ask interviewer)
Recent changes: ask — deployment? kernel upgrade? hardware event?
Blast radius: what services are affected? which pods are critical?
```

**Immediate mitigation (buy time for investigation):**
```bash
# First: understand which pods are critical and whether other nodes can absorb them
kubectl get nodes
kubectl describe nodes <notready-node1> <notready-node2> <notready-node3> | grep -A 10 Conditions

# Check if critical pods have enough capacity on healthy nodes
kubectl get pods --field-selector=status.phase=Pending
kubectl describe pod <pending-pod> | grep -A 5 Events
# If "Insufficient memory/cpu" — capacity issue on remaining nodes
```

**Hypothesis 1:** kubelet failure on those nodes.
```bash
# SSH to one of the NotReady nodes
ssh <node>
systemctl status kubelet
journalctl -u kubelet --since "30 minutes ago" | tail -50

# Common kubelet failure reasons:
# - /var/lib/kubelet out of disk space
# - containerd not running
# - certificate expired
df -h /var/lib/kubelet
systemctl status containerd
kubeadm certs check-expiration
```

**Hypothesis 2:** Disk pressure or memory pressure on those nodes.
```bash
# Check node conditions
kubectl describe node <node> | grep -A 20 Conditions
# Look for: MemoryPressure=True, DiskPressure=True, PIDPressure=True

# Verify on node
ssh <node>
df -h        # disk usage
df -i        # inode usage — often overlooked
free -h      # memory
cat /proc/pressure/memory
```

**Hypothesis 3:** Network partition (nodes can't reach API server).
```bash
# Check if nodes can reach API server
ssh <node>
curl -k https://<apiserver-ip>:6443/healthz
# If timeout: routing issue, firewall, or network partition

# Check node's route to API server
ip route
traceroute <apiserver-ip>
```

**Hypothesis 4:** Kernel panic or hardware event.
```bash
ssh <node>
dmesg | tail -100
# Look for: OOM, hardware error, kernel BUG, NIC reset, PCIe error

journalctl -k --since "1 hour ago" | grep -E 'ERROR|WARN|panic|killed'
# Check for GPU XID errors
dmesg | grep -i "NVRM: Xid"
```

**Root cause determination path:**
"Based on what I find, my next steps diverge:
- If kubelet is crashed: `systemctl restart kubelet`, investigate why it crashed
- If disk full: clear docker images (`crictl rmi --prune`), identify what is filling disk
- If network partition: investigate switch or VPC routing issue, check recent infrastructure changes
- If hardware failure: cordon node, replace via automated pipeline"

---

#### Incident 3: Inference API Latency Spike (P99 4x Normal)

**Scenario:** "Our LLM inference API has P99 latency of 8 seconds, up from normal 2 seconds. Error rate is still low (under 0.5%) but users are complaining. This started 20 minutes ago."

---

**Structured response:**

**Orient:**
```
Symptom: Latency spike (P99 4x), started 20 min ago
Scope: P99 — affects tail requests most. P50 normal?
Recent changes: ask
Is error rate low because requests are timing out or because they succeed slowly?
```

**Hypothesis 1:** Request queue depth increased — too many concurrent requests.
```bash
# Check queue depth metric (if instrumented)
# Prometheus query:
# inference_queue_depth{job="llm-inference"} by (pod)

# Check pod CPU/memory — are vLLM pods struggling?
kubectl top pods -n inference
kubectl get hpa -n inference   # is autoscaler trying to scale but can't?
```

**Hypothesis 2:** GPU memory pressure — KV cache is full, requests are queued or preempted.
```bash
# Check GPU memory on inference pods
kubectl exec -n inference <vllm-pod> -- nvidia-smi
# If GPU memory is >90%: KV cache is near capacity

# vLLM logs for preemption events
kubectl logs -n inference <vllm-pod> | grep -i "preempt\|cache\|queue"
# "Running requests preempted" = GPU memory pressure
```

**Hypothesis 3:** One or more replicas are degraded (GPU error, OOM, soft failure).
```bash
# Check if traffic is balanced across replicas
# If one replica is slow, load balancer may still route to it
kubectl get pods -n inference -o wide
kubectl top pods -n inference

# Check individual pod latency (if per-pod metrics available)
# If one pod has much higher latency: that pod is the culprit
kubectl describe pod <slow-pod> | grep -A 10 Events
kubectl logs <slow-pod> | tail -50
```

**Hypothesis 4:** Upstream dependency is slow (model weights storage, external API).
```bash
# Check if model is being loaded (cold start)
kubectl logs <vllm-pod> | grep -i "loading model\|model loaded"

# If recently restarted: 3-5 min cold start is normal
kubectl get pods -n inference -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}'
```

**Mitigation options:**
```
Immediate:
1. Scale out: kubectl scale deployment/llm-inference --replicas=+4
   (if GPU capacity available)
2. Shed load: enable rate limiting at API gateway level
3. Route around: if one pod is bad, drain it: kubectl cordon <node>

Medium-term:
4. Increase vLLM max_num_seqs (concurrent requests) if CPU-bound
5. Enable chunked prefill for long prompts (reduces P99 latency from slow prefills)
```

---

#### Incident 4: Kernel-Level Linux Debug (Stage 2 Style)

**Scenario:** "A service is responding slowly. It was fine yesterday. No deployment occurred. The host looks healthy in monitoring."

---

**The 10-minute triage (narrate every step):**

```bash
# Step 1: Orientation
uptime
# load average: 0.3 — low. This is NOT CPU saturation

date
w
# Only my SSH session — no rogue users

# Step 2: CPU/memory/IO snapshot
vmstat 1 5
# Watching: r (run queue), b (blocked), si/so (swap), wa (IO wait)
# Result: wa=35 — significant IO wait. CPU is WAITING, not computing

iostat -xz 1 5
# Result: sda await=320ms, %util=95%
# This is the culprit: disk is saturated

# Step 3: Find what process is causing the IO
iotop -o -b -n 3
# PID 4521 (java) doing 180MB/s write

ps aux | grep 4521
# It's the application log writer

# Step 4: Why is it writing so much?
ls -lh /var/log/myapp/
# app.log is 48GB — rolled log wasn't picked up

lsof -p 4521 | grep log
# /var/log/myapp/app.log — one file, 48GB

# Step 5: Check if log rotation is working
systemctl status logrotate
cat /etc/logrotate.d/myapp
journalctl -u logrotate
# logrotate ran yesterday, but app is not re-opening after rotate (missing USR1 signal)
```

**Answer structure:**
"The service slowness is caused by extreme disk IO wait, not CPU or memory. The application's log file grew to 48GB because logrotate is not triggering the application to reopen its log file after rotation. The disk is at 95% utilization trying to write to this file.

Immediate mitigation: send SIGUSR1 to the app to reopen logs (if it supports it), then manually trigger logrotate. Also: I'd add disk IO alerting at 70% utilization and verify logrotate's postrotate configuration sends the correct signal.

Root cause: incomplete logrotate configuration — missing `postrotate: kill -USR1 $(cat /var/run/myapp.pid)`."

---

### Part 3: Common Stress Interview Patterns

#### "The chmod doesn't work" Pattern
Tests creative Linux problem-solving. See [01-linux-deep-dive.md](/docs/nebius/linux-deep-dive) for the full answer.

**Key tools to mention:**
- `getfacl`/`setfacl` — POSIX ACLs
- `setcap` — Linux capabilities
- `nsenter` — enter another process's namespace
- `lsattr`/`chattr` — immutable flag
- `ls -Z` — SELinux context
- Bind mounts for path remapping

---

#### "Load average is high but CPU is low" Pattern
Always remember: load average counts R + D state threads.

```bash
vmstat 1 3       # check "b" column (blocked in IO)
iostat -xz 1 3   # check await and %util
cat /proc/pressure/io   # PSI io pressure

# Find D-state processes
ps aux | awk '$8 == "D" {print}'
```

---

#### "New connections failing, old connections fine" Pattern
```bash
# conntrack table
sysctl net.netfilter.nf_conntrack_count   # current
sysctl net.netfilter.nf_conntrack_max     # max
# If count == max: conntrack exhausted

# Backlog
ss -lnt | grep <port>   # check listen queue: Recv-Q = backlog waiting
sysctl net.core.somaxconn   # max listen backlog

# TIME_WAIT exhaustion
ss -tan state TIME-WAIT | wc -l
sysctl net.ipv4.tcp_tw_reuse
```

---

#### "Service is slow only for some users" Pattern
```bash
# Not global — something specific to those users
# Hypothesis: regional routing? specific backend? specific request type?

# Check if correlated with specific backend pods
kubectl top pods   # one pod consuming much more CPU?

# Check if correlated with request characteristics
# Use access logs: filter slow requests, look for patterns (user-agent, path, size)
kubectl logs <pod> | awk '$NF > 2000'   # requests taking >2s

# DNS resolution difference?
# Test from inside the cluster
kubectl exec -it debug -- nslookup slow-dependency
```

---

### Part 4: Post-Mortem Thinking

Nebius values SREs who think beyond the immediate fix to systemic improvement. At the end of every incident scenario, be ready to answer:

**"What would you do to prevent this from happening again?"**

Template:
1. **Detection gap:** What monitoring/alerting was missing that would have caught this earlier?
2. **Response improvement:** What runbook steps were missing that would have shortened MTTR?
3. **Systemic fix:** What architectural change prevents this class of failure?

**Example for the disk IO incident:**
- Detection gap: "We had no disk IO utilization alert. I'd add: alert when `disk_io_utilization > 70% for 5 minutes`."
- Response improvement: "No runbook for 'service slow, disk IO high'. I'd write one with the exact commands from this incident."
- Systemic fix: "Logrotate configuration should be validated in CI/CD. And the application should write structured logs to stdout (container log pattern) rather than directly to disk files — logrotate wouldn't be needed."

---

### Points to Remember

- Start every answer with "I observe X, my hypothesis is Y because Z"
- Narrate constantly — silence is failure in the stress interview
- Separate mitigation (stop bleeding now) from root cause (fix permanently)
- Load average ≠ CPU usage. High load + low CPU = IO or lock contention.
- `D` state processes are waiting on kernel IO — not killable, not debuggable with SIGTERM
- When stuck: "Let me think out loud about what else could cause this" — they want to see your process
- Always close with: detection gap, response improvement, systemic fix

### Full Incident Toolbox

```bash
# Orientation
uptime && hostname && date

# CPU
top, htop, pidstat -u 1, mpstat -P ALL 1

# Memory
free -h, vmstat 1 5 (si/so=swap), cat /proc/pressure/memory

# IO
iostat -xz 1 5, iotop -o, lsof -p <pid>

# Network
ss -s, ss -tanp, netstat -s | grep retransmit, tcpdump -i any host <ip>

# Processes
ps aux --sort=-%cpu, ps aux | awk '$8=="D"', strace -T -p <pid>

# Kubernetes
kubectl describe pod/node, kubectl top pods/nodes, kubectl logs --previous
kubectl get events --sort-by='.lastTimestamp'

# GPU
nvidia-smi, dcgmi diag -r 1, dmesg | grep "NVRM: Xid"

# Filesystem
df -h && df -i, findmnt, lsattr <file>

# Logs
journalctl -p err -n 100, dmesg | tail -100
```

---

## [SRE] 4-Week Study Roadmap

## 4-Week Study Roadmap

This roadmap assumes 60 to 90 minutes per day. If you have more time, add practice scenario repetitions rather than trying to read everything at once.

---

### Week 1: Linux, Networking, and Kubernetes Fundamentals

Goal: become confident with host triage, packet flow, and Kubernetes core behavior.

#### Day 1 — Linux and networking base

- Read [foundations/10-linux-and-network-administration.md](foundations/10-linux-and-network-administration.md)
- Read [foundations/01-networking-fundamentals.md](foundations/01-networking-fundamentals.md)
- Practice: describe TCP handshake, what TIME_WAIT means operationally, and how NAT changes packet flow

#### Day 2 — Linux debugging

- Read [foundations/05-linux-debug-playbook.md](foundations/05-linux-debug-playbook.md)
- Work through [hands-on-labs/linux/lab-01-host-triage.md](hands-on-labs/linux/lab-01-host-triage.md)
- Practice: walk a slow service scenario from uptime to strace without notes

#### Day 3 — Linux to Kubernetes

- Read [foundations/02-linux-kubernetes-foundations.md](foundations/02-linux-kubernetes-foundations.md)
- Work through [hands-on-labs/linux/lab-03-processes-cgroups-namespaces.md](hands-on-labs/linux/lab-03-processes-cgroups-namespaces.md)
- Practice: explain how Linux namespaces and cgroups map to a running pod

#### Day 4 — Kubernetes networking

- Read [foundations/06-kubernetes-networking-deep-dive.md](foundations/06-kubernetes-networking-deep-dive.md)
- Read [foundations/11-cloud-networking-and-kubernetes-networking.md](foundations/11-cloud-networking-and-kubernetes-networking.md)
- Work through [hands-on-labs/cloud-networking/drill-04-kubernetes-cloud-networking-path.md](hands-on-labs/cloud-networking/drill-04-kubernetes-cloud-networking-path.md)
- Practice: trace a packet from an external client to a pod, naming each hop

#### Day 5 — Containers and manifest design

- Read [foundations/13-docker-and-container-runtime.md](foundations/13-docker-and-container-runtime.md)
- Read [foundations/25-yaml-and-kubernetes-manifest-design.md](foundations/25-yaml-and-kubernetes-manifest-design.md)
- Work through [hands-on-labs/kubernetes/lab-01-pod-service-debug.md](hands-on-labs/kubernetes/lab-01-pod-service-debug.md)
- Practice: write a production-quality Deployment manifest with probes, resource limits, and PDB from memory

#### Day 6 — Networking labs

- Work through [hands-on-labs/networking/lab-01-http-dns-flow.md](hands-on-labs/networking/lab-01-http-dns-flow.md)
- Work through [hands-on-labs/linux-admin/drill-03-process-socket-and-network-admin.md](hands-on-labs/linux-admin/drill-03-process-socket-and-network-admin.md)
- Practice: diagnose a "service not reachable" scenario by checking DNS, endpoints, and NetworkPolicy

#### Day 7 — Practice scenario 1

- Run [mock-interviews/01-nebius-linux-kubernetes-troubleshooting.md](mock-interviews/01-nebius-linux-kubernetes-troubleshooting.md)
- Keep it to 45 minutes; answer without notes first
- Write down the exact gaps — those are Week 2 targets

---

### Week 2: Observability, Incident Response, and Debugging Depth

Goal: become strong at production debugging, SLO design, and alert triage.

#### Day 8 — Observability and SLOs

- Read [foundations/09-observability-slos-and-incident-response.md](foundations/09-observability-slos-and-incident-response.md)
- Practice: design an SLO for a customer-facing API — define the SLI, threshold, error budget, and burn rate alerts

#### Day 9 — Prometheus and Grafana

- Read [foundations/19-prometheus-grafana-and-alertmanager.md](foundations/19-prometheus-grafana-and-alertmanager.md)
- Practice: write PromQL for error rate, p99 latency, and a burn rate alert rule without reference

#### Day 10 — Kubernetes rollouts and scheduling

- Work through [hands-on-labs/kubernetes/lab-02-rollout-and-probes.md](hands-on-labs/kubernetes/lab-02-rollout-and-probes.md)
- Work through [hands-on-labs/kubernetes/lab-03-node-pressure-and-scheduling.md](hands-on-labs/kubernetes/lab-03-node-pressure-and-scheduling.md)
- Practice: explain how kubelet handles OOMKilled, evictions, and probe failures during a bad rollout

#### Day 11 — Structured troubleshooting

- Read [foundations/26-devops-troubleshooting-and-security-errors.md](foundations/26-devops-troubleshooting-and-security-errors.md)
- Work through [hands-on-labs/linux-admin/drill-01-service-and-systemd-triage.md](hands-on-labs/linux-admin/drill-01-service-and-systemd-triage.md)
- Practice: run the orient → hypothesis → test → interpret framework against a CrashLoopBackOff scenario

#### Day 12 — CI/CD and delivery

- Read [foundations/08-cicd-trusted-delivery-and-platform-security.md](foundations/08-cicd-trusted-delivery-and-platform-security.md)
- Read [foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md](foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md)
- Practice: describe a secure path from code commit to production, including image signing and policy gates

#### Day 13 — Linux admin depth

- Work through [hands-on-labs/linux-admin/drill-02-filesystem-and-storage-admin.md](hands-on-labs/linux-admin/drill-02-filesystem-and-storage-admin.md)
- Work through [hands-on-labs/linux/lab-02-filesystem-and-io.md](hands-on-labs/linux/lab-02-filesystem-and-io.md)
- Practice: diagnose a disk-full scenario including deleted-but-open file handles and inode exhaustion

#### Day 14 — Practice scenario 2

- Run [mock-interviews/02-distributed-systems-and-resilience.md](mock-interviews/02-distributed-systems-and-resilience.md)
- Keep answers structured: hypothesis, evidence, action, outcome
- Score yourself on clarity, tradeoff reasoning, and failure mode coverage

---

### Week 3: Cloud, Infrastructure, and System Design

Goal: design production-grade systems and reason through cross-layer tradeoffs.

#### Day 15 — System design and cloud architecture

- Read [foundations/07-system-design-cloud-architecture.md](foundations/07-system-design-cloud-architecture.md)
- Read [foundations/14-aws-cloud-services-and-platform-design.md](foundations/14-aws-cloud-services-and-platform-design.md)
- Practice: sketch a multi-AZ web application with VPC design, EKS, RDS Multi-AZ, and Route 53

#### Day 16 — Terraform and IaC

- Read [foundations/15-terraform-infrastructure-as-code.md](foundations/15-terraform-infrastructure-as-code.md)
- Practice: describe how you structure Terraform state across infrastructure layers and why

#### Day 17 — Cloud design labs

- Work through [hands-on-labs/cloud-design/lab-01-gcp-public-platform.md](hands-on-labs/cloud-design/lab-01-gcp-public-platform.md)
- Read [hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md](hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md)
- Compare your answer to the reference; identify gaps in failure domain reasoning

#### Day 18 — GPU and AI platform

- Read [foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)
- Work through [hands-on-labs/kubernetes/lab-04-gpu-ml-ai-platform-review.md](hands-on-labs/kubernetes/lab-04-gpu-ml-ai-platform-review.md)
- Read [hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md](hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md)

#### Day 19 — Platform services

- Read [foundations/20-kafka-and-event-streaming.md](foundations/20-kafka-and-event-streaming.md)
- Read [foundations/22-http-apis-and-reverse-proxy-paths.md](foundations/22-http-apis-and-reverse-proxy-paths.md)
- Practice: explain how consumer lag develops and how you diagnose it; describe NGINX upstream config and rate limiting

#### Day 20 — End-to-end composition

- Read [foundations/27-end-to-end-project-and-capstone-patterns.md](foundations/27-end-to-end-project-and-capstone-patterns.md)
- Practice: trace a deployment failure from CI log to pod event to log line, naming each tool at each step

#### Day 21 — Practice scenario 3

- Run [mock-interviews/03-platform-cloud-and-security.md](mock-interviews/03-platform-cloud-and-security.md)
- Follow up with a written architecture summary in under one page
- Record what you were confident about and what you hedged on

---

### Week 4: Depth, Gaps, and Targeted Repair

Goal: convert knowledge into confident, precise execution — including areas you've been avoiding.

#### Day 22 — Remaining foundations

Pick two you haven't read:
- [foundations/18-ansible-and-host-automation.md](foundations/18-ansible-and-host-automation.md)
- [foundations/21-sql-and-relational-data-for-sre.md](foundations/21-sql-and-relational-data-for-sre.md)
- [foundations/16-git-and-version-control-for-platform-engineers.md](foundations/16-git-and-version-control-for-platform-engineers.md)
- [foundations/23-azure-devops-crossover.md](foundations/23-azure-devops-crossover.md)
- [foundations/24-sonarqube-and-code-quality-gates.md](foundations/24-sonarqube-and-code-quality-gates.md)

#### Day 23 — Redo weak scenarios

- Revisit the mock interview where you struggled most
- Answer the hardest questions again — without notes, in senior-level language
- Add tradeoffs and failure modes to every answer

#### Day 24 — Scripting depth

- Read [foundations/03-bash-and-shell-scripting.md](foundations/03-bash-and-shell-scripting.md) or [foundations/04-python-for-sre.md](foundations/04-python-for-sre.md)
- Work through [hands-on-labs/bash/lab-03-retry-and-guardrails.md](hands-on-labs/bash/lab-03-retry-and-guardrails.md)
- Work through [hands-on-labs/python/lab-03-k8s-event-summary.md](hands-on-labs/python/lab-03-k8s-event-summary.md)

#### Day 25 — Mixed mock

- Run one 60-minute mixed scenario drawing from all three mock interview files
- Practice staying structured under pressure: state the hypothesis, name the command, interpret the output

#### Day 26 — Cheat sheets

Build short recall sheets for:
- Linux debugging flow (60-second system check)
- Kubernetes pod-to-packet path
- SLO and burn rate alert design
- Deployment rollout and rollback procedure
- Terraform state layer strategy

#### Day 27 — Final system design drill

- Work through [hands-on-labs/cloud-design/lab-04-low-latency-multi-region-control-plane.md](hands-on-labs/cloud-design/lab-04-low-latency-multi-region-control-plane.md)
- Focus on failure domains, latency tradeoffs, and multi-region consistency

#### Day 28 — Review and calibrate

- Read [foundations/00-senior-staff-operating-manual.md](foundations/00-senior-staff-operating-manual.md)
- Run one final mock scenario
- Prioritize calm execution over last-minute breadth

---

## [SRE] Start Here: Canonical SRE Learning Roadmap

## Start Here: Canonical SRE Learning Roadmap

This is the single source of truth for the study site.

Use this roadmap as the default path. The goal is not to memorize isolated interview answers. The goal is to build SRE and platform engineering fluency from first principles to production-level reasoning.

The site now uses a **memory palace** approach: every major platform layer is tied to a relatable real-world scene so you can recall concepts under interview or incident pressure.

---

### The Full Memory Path

Walk through the site like a story:

| Phase | Technical focus | Memory palace | What you learn to recall |
|---|---|---|---|
| 1 | Linux host fundamentals | Hospital | CPU, memory, disk, processes, permissions, systemd, logs |
| 1 | Networking | Hotel guest journey | DNS, routing, TCP, TLS, load balancers, firewalls |
| 2 | Kubernetes | City operations center | pods, services, nodes, scheduler, CNI, CoreDNS, policies |
| 3 | Observability and incidents | Emergency command room | SLIs, SLOs, alerts, dashboards, timelines, mitigation |
| 4 | Cloud architecture | Airport / city grid | regions, zones, routes, gateways, capacity, blast radius |
| 4 | CI/CD and GitOps | Factory assembly line | source, build, scan, approve, deploy, rollback |
| 5 | Automation | Hospital playbook desk | repeatable safe operations, scripts, idempotency |
| 6 | Staff synthesis | Operating review board | tradeoffs, failure modes, platform maturity |

Read [Study Memory Palace](memory-palace.md) before deep study. Use [How To Use Each Module](module-template.md) as the standard pattern for reading each page.

---

### How To Study Each Phase

For every phase, repeat this loop:

1. **Read for the mental model.** What system are you operating?
2. **Attach it to the memory palace.** What real-world scene helps you remember it?
3. **Trace the request or failure path.** Follow packets, processes, pods, alerts, deployments, or state changes end to end.
4. **Do one hands-on drill.** Run commands, inspect output, break something, and fix it.
5. **Explain it out loud.** Turn the topic into a senior interview answer.
6. **Write one operational note.** Capture symptoms, likely causes, commands, and remediation.

---

### Phase 1: Linux, Networking, And Host Fundamentals

Start here. These topics are the base layer for almost everything else in SRE.

Memory hooks:

- **Linux host = hospital**: doctors, beds, storage rooms, badges, incident logs.
- **Networking = hotel guest journey**: directory lookup, room number, hallway, door, guard, secure conversation.

Read in this order:

1. [Linux and network administration](foundations/10-linux-and-network-administration.md)
2. [Networking fundamentals](foundations/01-networking-fundamentals.md)
3. [Linux and Kubernetes foundations](foundations/02-linux-kubernetes-foundations.md)
4. [Linux debug playbook](foundations/05-linux-debug-playbook.md)

Exit criteria:

- You can troubleshoot CPU, memory, disk, DNS, port, and connectivity problems without guessing.
- You can explain packet flow from a process on one host to a service on another host.
- You can read common Linux command output and decide what to check next.

Practice:

- [Linux labs](hands-on-labs/linux/)
- [Linux admin labs](hands-on-labs/linux-admin/)
- [Networking labs](hands-on-labs/networking/)

---

### Phase 2: Kubernetes And Containers

Kubernetes is easier when you understand the host first.

Memory hook:

- **Kubernetes = city operations center**: buildings are nodes, apartments are pods, city directory is DNS, roads are CNI, public phone numbers are Services.

Read in this order:

1. [Kubernetes networking deep dive](foundations/06-kubernetes-networking-deep-dive.md)
2. [Cloud networking and Kubernetes networking](foundations/11-cloud-networking-and-kubernetes-networking.md)
3. [Docker and container runtime](foundations/13-docker-and-container-runtime.md)
4. [YAML and Kubernetes manifest design](foundations/25-yaml-and-kubernetes-manifest-design.md)
5. [Kubernetes GPU, AI platforms, and operators](foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)

Exit criteria:

- You can debug Pending, CrashLoopBackOff, ImagePullBackOff, DNS, service routing, ingress, and node-pressure failures.
- You can explain the difference between container image, container runtime, pod sandbox, process isolation, and workload scheduling.
- You can read a manifest and identify missing resources, probes, labels, security context, rollout strategy, and operational risks.

Practice:

- [Kubernetes labs](hands-on-labs/kubernetes/)
- [Cloud networking labs](hands-on-labs/cloud-networking/)

---

### Phase 3: Observability, SLOs, And Incident Response

Now learn how to see and control production systems.

Memory hook:

- **Observability = emergency command room**: vital signs, alarms, incident commander, patient stabilization, postmortem review.

Read in this order:

1. [Observability, SLOs, and incident response](foundations/09-observability-slos-and-incident-response.md)
2. [Prometheus, Grafana, and Alertmanager](foundations/19-prometheus-grafana-and-alertmanager.md)
3. [DevOps troubleshooting and security errors](foundations/26-devops-troubleshooting-and-security-errors.md)

Exit criteria:

- You can write useful PromQL for latency, errors, saturation, traffic, availability, and burn rate.
- You can explain a clean incident timeline.
- You can propose dashboards and alerts for a service without over-instrumenting it.

---

### Phase 4: Cloud Architecture, Infrastructure, And Delivery

This phase connects systems thinking with production delivery.

Memory hooks:

- **Cloud architecture = airport / city grid**: routes, gates, zones, backup paths, security boundaries.
- **CI/CD = factory assembly line**: source, build, test, scan, approve, ship, rollback.

Read in this order:

1. [System design and cloud architecture](foundations/07-system-design-cloud-architecture.md)
2. [AWS cloud services and platform design](foundations/14-aws-cloud-services-and-platform-design.md)
3. [Terraform infrastructure as code](foundations/15-terraform-infrastructure-as-code.md)
4. [CI/CD trusted delivery and platform security](foundations/08-cicd-trusted-delivery-and-platform-security.md)
5. [Delivery systems: Jenkins, GitHub Actions, and ArgoCD](foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md)
6. [Git and version control for platform engineers](foundations/16-git-and-version-control-for-platform-engineers.md)

Exit criteria:

- You can design a platform from load balancer to compute, storage, network, observability, security, delivery, and disaster recovery.
- You can explain tradeoffs instead of listing services.
- You can identify blast radius and failure modes in an architecture.

---

### Phase 5: Automation, Data, And Platform Services

This phase teaches the supporting tools SREs use to operate platforms at scale.

Memory hook:

- **Automation = hospital playbook desk**: standard procedures, safety checks, repeatable operations, rollback notes.

Read in this order:

1. [Bash and shell scripting](foundations/03-bash-and-shell-scripting.md)
2. [Python for SRE](foundations/04-python-for-sre.md)
3. [Ansible and host automation](foundations/18-ansible-and-host-automation.md)
4. [Kafka and event streaming](foundations/20-kafka-and-event-streaming.md)
5. [SQL and relational data for SRE](foundations/21-sql-and-relational-data-for-sre.md)
6. [HTTP, APIs, and reverse proxy paths](foundations/22-http-apis-and-reverse-proxy-paths.md)
7. [Azure DevOps crossover](foundations/23-azure-devops-crossover.md)
8. [SonarQube and code quality gates](foundations/24-sonarqube-and-code-quality-gates.md)

Exit criteria:

- You can automate routine checks without making production more dangerous.
- You can debug common API, proxy, queue, SQL, and automation failures.
- You can explain the operational tradeoff behind each tool.

---

### Phase 6: Synthesis, Capstone, And Staff-Level Reasoning

Finish here after you have enough depth in the earlier phases.

Memory hook:

- **Staff synthesis = operating review board**: assumptions, tradeoffs, failure modes, cost, security, operability, rollout, and long-term ownership.

Read in this order:

1. [End-to-end project and capstone patterns](foundations/27-end-to-end-project-and-capstone-patterns.md)
2. [Senior/staff operating manual](foundations/00-senior-staff-operating-manual.md)
3. [Reference answer: GCP public platform](hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md)
4. [Reference answer: GPU ML/AI platform](hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md)

Exit criteria:

- You can produce an end-to-end design with assumptions, architecture, data flow, failure modes, observability, rollout, and tradeoffs.
- You can identify what junior, mid-level, senior, and staff-level answers each include.
- You can explain not only what you would build, but how you would operate it for months.

---

### Optional Track: Nebius AI Sprint

Use this only if preparing for a Nebius AI Staff SRE interview. It is intentionally specific and should not be the default learning path.

- [Nebius sprint overview](nebius/README.md)
- [Company, stack, and interview guide](nebius/00-company-stack-interview-guide.md)
- [Linux deep dive](nebius/01-linux-deep-dive.md)
- [Kubernetes and Cilium production](nebius/02-kubernetes-cilium-production.md)
- [GPU AI infrastructure](nebius/03-gpu-ai-infrastructure.md)
- [System design](nebius/04-system-design.md)
- [Coding and algorithms](nebius/05-coding-algorithms.md)
- [Stress interview and incident response](nebius/06-stress-interview-incident-response.md)

---

### Daily Study Rule

Every session should include:

- **One concept read** from a foundation guide.
- **One memory-palace recall** without notes.
- **One practical drill** from a lab or command sequence.
- **One spoken or written answer** explaining what you learned.

Read, remember, practice, explain, repeat.

---

## [SRE] SRE Memory Palace Study Method

## SRE Memory Palace Study Method

This site is not only a document archive. It is a memory system for senior SRE reasoning.

The goal is to make complex infrastructure topics feel like places you can walk through in your head. When you forget a command or concept, you should be able to return to a familiar scene: a hotel, a hospital, a city, an airport, or a factory floor.

### The Core Idea

Use one relatable story for each technical layer.

| Technical layer | Memory palace | Why it works |
|---|---|---|
| Linux host | Hospital building | Patients, rooms, equipment, alarms, storage, staff, permissions |
| Networking | Hotel guest journey | Reception, rooms, keys, hallways, elevators, blocked doors, address lookup |
| Kubernetes | City operations center | Schedulers, neighborhoods, services, traffic control, health checks |
| Observability | Emergency command room | Dashboards, alarms, incident commander, evidence, timelines |
| Cloud architecture | Airport or city grid | Zones, routes, security, capacity, blast radius, redundancy |
| CI/CD and GitOps | Factory assembly line | Source, build, scan, approve, deploy, rollback |
| Automation | Hospital playbook desk | Repeatable procedures, safe defaults, idempotent actions |

You are not using analogies to avoid technical depth. You are using them to create durable recall hooks.

### How To Study With A Memory Palace

For each page, use this loop:

1. **Place the topic in a scene.** Example: a Linux host is a hospital.
2. **Map each subsystem to a room or role.** Example: `/var/log` is the nurse station logbook.
3. **Attach commands to actions.** Example: `journalctl` means reading the incident log.
4. **Create a failure story.** Example: patients are waiting because the elevator is stuck, not because doctors are slow.
5. **Translate back to production language.** Example: high load with low CPU suggests IO wait or blocked work.
6. **Practice recall without notes.** Walk through the palace and explain the investigation aloud.

### The Hospital Model For Linux

Think of a Linux server as a hospital under pressure.

| Linux concept | Hospital memory hook | Production meaning |
|---|---|---|
| CPU | Doctors actively treating patients | Active compute work |
| Memory | Beds and active patient charts | Working set and cached state |
| Swap | Overflow hallway beds | Survival mechanism, but slow and risky |
| Disk space | Storage rooms | Capacity for files/logs/data |
| Inodes | Number of storage labels/shelves | You can run out of file slots before bytes |
| Processes | Patients/procedures currently running | Work units on the host |
| Systemd | Hospital operations manager | Starts, stops, restarts, and supervises services |
| Journald/logs | Nurse station incident log | Evidence timeline |
| Network interface | Ambulance bay | Where traffic enters/leaves |
| DNS | Hospital directory desk | Name-to-address lookup |
| Routes | Hallway map | Where packets go next |
| Permissions | Staff badges and room access | Identity and authorization |
| Mounts | Connected hospital wings | Filesystems attached into the namespace |

#### Example Story: The Hospital Feels Slow

A hospital administrator says, “Everything is slow.”

A junior operator asks, “Are the doctors busy?”

A senior operator asks:

- Are doctors actually busy, or are patients waiting for elevators?
- Are there enough beds?
- Is the pharmacy reachable?
- Are storage rooms full?
- Did the hospital start sending people to an overflow hallway?
- Did yesterday’s maintenance change a door lock?

Technical translation:

- Check CPU, memory, IO, disk, network, and recent changes before assuming CPU.
- High load with low CPU can mean blocked IO or uninterruptible sleep.
- Swap activity can create latency before the system is completely out of memory.
- Deleted-open files can keep disk space allocated after cleanup.

### The Hotel Model For Networking

Think of a request as a guest trying to reach a room in a hotel.

| Networking concept | Hotel memory hook | Production meaning |
|---|---|---|
| DNS | Front desk directory | Convert service name to IP |
| IP address | Room number | Destination location |
| Port | Specific door at the room | Application listener |
| Route | Hallway/elevator path | Next hop decision |
| Firewall/security group | Security guard | Policy allow/deny |
| TCP handshake | Guest and room confirming entry | Transport session setup |
| TLS | Identity check and encrypted conversation | Secure channel |
| HTTP | Guest request at the desk | Application protocol |
| Load balancer | Concierge choosing a room | Distribution across backends |
| Timeout | Guest gives up waiting | Latency or dependency failure |

#### Example Story: The Guest Cannot Enter

A guest says, “I cannot get to room 443.”

Do not immediately blame the security guard.

Ask:

1. Did the guest know the hotel address? DNS.
2. Did they reach the building? IP routing.
3. Did they find the right floor? route and next hop.
4. Was the door open? listening port.
5. Did the guard block them? firewall/security policy.
6. Did the room answer but reject the conversation? TLS/application.

Technical translation:

- DNS failure is different from TCP failure.
- TCP success is different from HTTP success.
- A service can be running but listening only on localhost.
- A load balancer can be healthy while a backend is unhealthy.

### The City Model For Kubernetes

Think of Kubernetes as a city operations center.

| Kubernetes concept | City memory hook | Production meaning |
|---|---|---|
| Cluster | City | Whole platform boundary |
| Node | Building | Worker host |
| Pod | Apartment/unit | Smallest scheduled workload unit |
| Container | Person/process inside unit | Isolated workload process |
| Scheduler | Housing assignment office | Places pods onto nodes |
| Kubelet | Building manager | Keeps pods running on a node |
| Service | Public directory number | Stable access path to pods |
| Ingress | City gate | External HTTP entry |
| CNI | Road network | Pod-to-pod connectivity |
| CoreDNS | City directory | Service name resolution |
| Readiness probe | “Open for visitors” sign | Can receive traffic |
| Liveness probe | “Still alive?” welfare check | Restart if stuck |
| Resource requests | Reserved capacity | Scheduling promise |
| Limits | Hard safety boundary | Runtime ceiling |

### The Emergency Room Model For Incidents

An incident is not random debugging. It is emergency medicine for systems.

| Incident concept | Hospital emergency hook | Production meaning |
|---|---|---|
| Symptom | Patient complaint | User-visible problem |
| SLI | Vital sign | Measured user-facing signal |
| SLO | Healthy range | Reliability target |
| Alert | Alarm bell | Requires attention |
| Incident commander | ER lead doctor | Coordinates response |
| Mitigation | Stabilize patient | Reduce user impact first |
| Root cause | Diagnosis | Underlying failure mechanism |
| Postmortem | Medical review | Learn without blame |

### Daily Recall Drill

Use this five-minute drill after each study session:

1. Close the page.
2. Pick one palace: hospital, hotel, city, command room, airport, or factory.
3. Walk through five rooms.
4. Name the technical concept attached to each room.
5. Explain one failure story using only the palace.
6. Translate the story back into commands, signals, and remediation.

### Example Recall Prompt

Prompt yourself:

> “A hotel guest knows the room number, reaches the floor, but the door does not open. What is the equivalent networking failure?”

Strong answer:

> “DNS and routing likely worked because the destination was found. Now I need to check whether the target port is listening, whether local firewall/security policy blocks it, whether the service is bound to the right address, and whether TLS/application negotiation fails after connection.”

### Rule For Every Page On This Site

Every major guide should eventually include:

- a memory hook
- a senior mental model
- a triage path
- command or tool interpretation
- real incident stories
- hands-on drills
- interview answer shape
- recall prompts

This is how the site becomes easier to memorize without becoming shallow.
