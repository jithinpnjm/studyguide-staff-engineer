---
title: "Stress Interview and Incident Response — Nebius Stage 4"
sidebar_position: 6
---

# Stress Interview and Incident Response — Nebius Stage 4

> Stage 4 at Nebius is unusual: a 30-minute deliberate stress scenario where you must debug a production incident in real time, under pressure, while narrating your thinking. The pressure is intentional — they want to see how you behave when things are hard, not when they are easy.

---

## Mental Model

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

## Part 1: The Structured Debugging Approach

### Step 1 — Orient Before You Act
Before running any command, answer these 4 questions:
1. What is the symptom? (latency spike? error rate? resource exhaustion?)
2. What scope? (one node? one pod? all pods? all users? one region?)
3. What changed recently? (deploy? config change? traffic increase? hardware event?)
4. What is the blast radius? (how many users affected? is this getting worse?)

### Step 2 — Form a Hypothesis
A hypothesis is: "I believe [X] is causing [Y] because [Z]."

**Good hypothesis:** "I believe the database connection pool is exhausted because the error messages show `connection timeout` and the service was recently deployed with fewer connection pool slots."

**Bad non-hypothesis:** "Let me just check everything."

### Step 3 — Test the Hypothesis (One Command, One Thing)
Each command should test exactly one hypothesis. Interpret the output before running the next command.

### Step 4 — Communicate Every Step
In the stress interview, silence is failure. Even if you don't know what to do next, say:
- "I'm not finding evidence for my first hypothesis. Let me think about what else could cause this."
- "I see this output — it's unexpected. Let me pause and reason about what it means."

### Step 5 — Identify Mitigation Separately from Root Cause
Sometimes you can mitigate (stop the bleeding) before you find root cause. State this explicitly:
- "I want to separate: what can we do right now to reduce user impact, vs what is the actual root cause?"
- Mitigation: restart pod, scale up replicas, route traffic away from bad node
- Root cause: needs more investigation, can happen in parallel

---

## Part 2: Incident Scenarios — Full Practice Run

### Incident 1: GPU Training Job Hanging

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

### Incident 2: Kubernetes Node NotReady, Pods Evicted

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

### Incident 3: Inference API Latency Spike (P99 4x Normal)

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

### Incident 4: Kernel-Level Linux Debug (Stage 2 Style)

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

## Part 3: Common Stress Interview Patterns

### "The chmod doesn't work" Pattern
Tests creative Linux problem-solving. See [01-linux-deep-dive.md](/docs/nebius/linux-deep-dive) for the full answer.

**Key tools to mention:**
- `getfacl`/`setfacl` — POSIX ACLs
- `setcap` — Linux capabilities
- `nsenter` — enter another process's namespace
- `lsattr`/`chattr` — immutable flag
- `ls -Z` — SELinux context
- Bind mounts for path remapping

---

### "Load average is high but CPU is low" Pattern
Always remember: load average counts R + D state threads.

```bash
vmstat 1 3       # check "b" column (blocked in IO)
iostat -xz 1 3   # check await and %util
cat /proc/pressure/io   # PSI io pressure

# Find D-state processes
ps aux | awk '$8 == "D" {print}'
```

---

### "New connections failing, old connections fine" Pattern
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

### "Service is slow only for some users" Pattern
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

## Part 4: Post-Mortem Thinking

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

## Points to Remember

- Start every answer with "I observe X, my hypothesis is Y because Z"
- Narrate constantly — silence is failure in the stress interview
- Separate mitigation (stop bleeding now) from root cause (fix permanently)
- Load average ≠ CPU usage. High load + low CPU = IO or lock contention.
- `D` state processes are waiting on kernel IO — not killable, not debuggable with SIGTERM
- When stuck: "Let me think out loud about what else could cause this" — they want to see your process
- Always close with: detection gap, response improvement, systemic fix

## Full Incident Toolbox

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
