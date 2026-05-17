---
title: "💻 Bash & Shell Scripting"
sidebar_position: 16
description: "Zero to hero study guide for Bash & Shell Scripting — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## Why Bash for SRE?

Bash is the lingua franca of servers. Every Linux host has it. You use it for bootstrapping, cron jobs, init scripts, Docker entrypoints, Kubernetes init containers, CI/CD pipelines, and quick automation where Python is overkill. Knowing Bash deeply — not just copy-pasting snippets — separates junior ops from senior SRE.

---

## Script Foundations

### Strict Mode — Always Use This

```bash
#!/usr/bin/env bash
set -euo pipefail

# set -e  → exit on any error (use || true to suppress intentionally)
# set -u  → treat unset variables as errors
# set -o pipefail → catch errors in pipes (ls | grep → grep exit code won't hide ls error)
```

**Common pattern to allow optional commands**:
```bash
set -euo pipefail

# OK to fail — use || true
backup_old_config() {
    cp /etc/myapp/config.yaml /etc/myapp/config.yaml.bak || true
}

# Check if a command exists
if ! command -v kubectl &>/dev/null; then
    echo "kubectl not installed" >&2
    exit 1
fi
```

### Variables and Quoting

```bash
# Always double-quote variables to prevent word splitting
name="hello world"
echo "$name"        # correct: "hello world"
echo $name          # wrong: splits into "hello" "world"

# Default values
PORT=${PORT:-8080}
ENV=${APP_ENV:?APP_ENV must be set}   # exits with message if unset

# Command substitution
current_date=$(date +%Y-%m-%d)
pod_count=$(kubectl get pods -n prod --no-headers | wc -l)

# Arithmetic
total=$((free_mem + used_mem))
percent=$(( used_mem * 100 / total_mem ))
```

### Arrays

```bash
# Indexed arrays
services=("payment" "auth" "inventory" "gateway")

# Iterate
for svc in "${services[@]}"; do
    echo "Checking $svc..."
done

# Array length
echo "Count: ${#services[@]}"

# Slice
first_two=("${services[@]:0:2}")

# Associative arrays (bash 4+)
declare -A ports
ports["payment"]=8080
ports["auth"]=8081
for svc in "${!ports[@]}"; do
    echo "$svc runs on ${ports[$svc]}"
done
```

---

## Functions

```bash
# Define early, call later
die() {
    echo "[ERROR] $*" >&2
    exit 1
}

require_env() {
    local var="$1"
    [[ -n "${!var:-}" ]] || die "Required env var $var is not set"
}

log() {
    echo "[$(date +%T)] $*"
}

# Usage
require_env DATABASE_URL
require_env API_KEY

log "Starting deployment"
```

### Return Values

```bash
# Functions return 0 (success) or non-zero (failure)
is_healthy() {
    local url="$1"
    curl -sf --max-time 5 "$url/health" &>/dev/null
}

if is_healthy "http://payment:8080"; then
    log "Payment service is healthy"
else
    die "Payment service health check failed"
fi
```

---

## String Manipulation

```bash
filename="backup-2025-01-15.tar.gz"

# Substrings
echo "${filename:0:6}"          # "backup"

# Strip prefix/suffix
echo "${filename#backup-}"      # "2025-01-15.tar.gz"
echo "${filename%.tar.gz}"      # "backup-2025-01-15"

# Replace
echo "${filename/-/_}"          # "backup_2025-01-15.tar.gz"  (first match)
echo "${filename//-/_}"         # "backup_2025_01_15.tar.gz"  (all matches)

# Case conversion (bash 4+)
env="PRODUCTION"
echo "${env,,}"                 # "production"
echo "${env^}"                  # "Production"

# Length
echo "${#filename}"             # 23

# Check if string contains substring
if [[ "$filename" == *".gz" ]]; then
    echo "Compressed file"
fi

# Regex match
if [[ "$filename" =~ ^backup-([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    echo "Date: ${BASH_REMATCH[1]}"
fi
```

---

## Conditionals and Tests

```bash
# [[ ]] is always preferred over [ ] in bash scripts

# File tests
[[ -f /etc/passwd ]]     # regular file exists
[[ -d /var/log ]]        # directory exists
[[ -r /etc/secret ]]     # file is readable
[[ -s /tmp/data.csv ]]   # file is non-empty
[[ -L /usr/bin/python ]] # is symlink

# String tests
[[ -z "$var" ]]          # empty string
[[ -n "$var" ]]          # non-empty string
[[ "$a" == "$b" ]]       # string equal
[[ "$a" != "$b" ]]       # string not equal

# Integer tests
[[ $count -eq 0 ]]       # equal
[[ $count -gt 5 ]]       # greater than
[[ $count -le 100 ]]     # less than or equal

# Compound
[[ -f "$file" && -s "$file" ]]   # file exists AND non-empty
[[ "$env" == "prod" || "$env" == "production" ]]
```

---

## Loops

```bash
# For loop over command output (safe pattern)
while IFS= read -r line; do
    echo "Processing: $line"
done < <(kubectl get pods -n prod --no-headers -o custom-columns="NAME:.metadata.name")

# C-style for
for ((i=0; i<10; i++)); do
    echo "Iteration $i"
done

# Until loop
until kubectl rollout status deployment/payment -n prod; do
    echo "Waiting for rollout..."
    sleep 5
done

# Loop with index
for i in "${!services[@]}"; do
    echo "$i: ${services[$i]}"
done
```

---

## Error Handling

```bash
# Trap for cleanup
cleanup() {
    local exit_code=$?
    echo "Cleaning up (exit code: $exit_code)"
    rm -f "$TMPFILE"
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

TMPFILE=$(mktemp)

# Retry logic
retry() {
    local retries="$1"
    local delay="$2"
    shift 2
    local attempt=1
    while true; do
        "$@" && return 0
        if [[ $attempt -ge $retries ]]; then
            echo "Command failed after $retries attempts: $*" >&2
            return 1
        fi
        echo "Attempt $attempt failed, retrying in ${delay}s..."
        sleep "$delay"
        delay=$((delay * 2))   # exponential backoff
        ((attempt++))
    done
}

# Usage
retry 3 2 curl -sf "https://api.example.com/health"
```

---

## Working with Files and Processes

```bash
# Process text files efficiently
# Count lines matching pattern
grep -c "ERROR" /var/log/app.log

# Extract field from CSV (awk)
awk -F',' '{print $3}' data.csv

# Sum a column
awk -F',' '{sum += $2} END {print sum}' metrics.csv

# Find files modified in last 24h
find /var/log -name "*.log" -newer /tmp/yesterday -type f

# Watch a log file for errors, alert on match
tail -f /var/log/app.log | grep --line-buffered "FATAL" | while IFS= read -r line; do
    echo "FATAL: $line"
    # send alert here
done

# Disk usage — top 10 directories
du -sh /var/* 2>/dev/null | sort -rh | head -10

# Check port is listening
if ss -tlnp | grep -q ":8080 "; then
    echo "Port 8080 is open"
fi
```

---

## Kubernetes Bash Patterns

```bash
# Wait for deployment rollout
wait_for_rollout() {
    local ns="$1"
    local deploy="$2"
    local timeout="${3:-300}"
    kubectl rollout status deployment/"$deploy" -n "$ns" --timeout="${timeout}s"
}

# Get pod logs from all replicas
get_all_logs() {
    local ns="$1"
    local selector="$2"
    kubectl get pods -n "$ns" -l "$selector" --no-headers -o name | while IFS= read -r pod; do
        echo "=== $pod ==="
        kubectl logs -n "$ns" "$pod" --tail=50
    done
}

# Scale and verify
scale_deploy() {
    local ns="$1" deploy="$2" replicas="$3"
    kubectl scale deployment "$deploy" -n "$ns" --replicas="$replicas"
    wait_for_rollout "$ns" "$deploy"
    log "Scaled $deploy to $replicas replicas"
}

# Restart all pods in namespace
kubectl rollout restart deployment -n "$NAMESPACE"

# Delete stuck terminating pods
kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed -o name | \
    xargs -r kubectl delete -n "$NAMESPACE" --force --grace-period=0
```

---

## CI/CD Shell Patterns

```bash
# Semantic versioning from git tags
VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "0.0.0")
BUILD_NUM=${GITHUB_RUN_NUMBER:-local}
IMAGE_TAG="${VERSION}-${BUILD_NUM}"

# Canary deploy check
check_canary() {
    local svc="$1"
    local threshold="${2:-0.01}"    # 1% error rate
    local error_rate
    error_rate=$(curl -s "http://prometheus:9090/api/v1/query" \
        --data-urlencode "query=rate(http_errors_total{service=\"$svc\"}[5m]) / rate(http_requests_total{service=\"$svc\"}[5m])" \
        | jq -r '.data.result[0].value[1] // "0"')
    if (( $(echo "$error_rate > $threshold" | bc -l) )); then
        echo "ERROR RATE $error_rate exceeds threshold $threshold" >&2
        return 1
    fi
    echo "Error rate OK: $error_rate"
}

# Docker build with cache
docker build \
    --cache-from "myregistry/myapp:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    -t "myregistry/myapp:${IMAGE_TAG}" \
    -t "myregistry/myapp:latest" \
    .
```

---

## Script Templates

### Deployment Script Template

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:?NAMESPACE required}"
IMAGE="${IMAGE:?IMAGE required}"
DRY_RUN="${DRY_RUN:-false}"

log()  { echo "[$(date +%T)] INFO  $*"; }
warn() { echo "[$(date +%T)] WARN  $*" >&2; }
die()  { echo "[$(date +%T)] ERROR $*" >&2; exit 1; }

cleanup() { log "Done (exit $?)"; }
trap cleanup EXIT

main() {
    log "Deploying $IMAGE to namespace $NAMESPACE"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run — skipping actual deploy"
        return 0
    fi

    kubectl set image deployment/myapp \
        myapp="$IMAGE" \
        -n "$NAMESPACE"

    kubectl rollout status deployment/myapp \
        -n "$NAMESPACE" \
        --timeout=300s

    log "Deployment successful"
}

main "$@"
```

### Health Check Script Template

```bash
#!/usr/bin/env bash
set -euo pipefail

ENDPOINTS=(
    "http://payment:8080/health"
    "http://auth:8081/health"
    "http://inventory:8082/health"
)

FAILED=()

for url in "${ENDPOINTS[@]}"; do
    if curl -sf --max-time 5 "$url" &>/dev/null; then
        echo "[OK]   $url"
    else
        echo "[FAIL] $url"
        FAILED+=("$url")
    fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "Failed endpoints: ${FAILED[*]}" >&2
    exit 1
fi

echo "All ${#ENDPOINTS[@]} endpoints healthy"
```

---

## Debugging Bash Scripts

```bash
# Trace mode — print each command before execution
set -x

# Trace a specific section only
set -x
some_tricky_function
set +x

# Run script with trace from outside
bash -x myscript.sh

# Lint with shellcheck (install: brew install shellcheck)
shellcheck myscript.sh

# Step through interactively
bash --debugger myscript.sh   # requires bash 4.1+ and extdebug

# Print variable state
declare -p my_array    # shows type and value
```

---

## Performance Tips

```bash
# Avoid subshell per iteration — use process substitution
# BAD: forks a subshell per line
cat file.txt | while read line; do ...

# GOOD: no extra subshell
while IFS= read -r line; do ...
done < file.txt

# Avoid calling external commands in loops
# BAD: forks date process 1000 times
for i in $(seq 1000); do
    ts=$(date +%s)
done

# GOOD: use bash built-ins
for i in $(seq 1000); do
    printf -v ts '%(%s)T' -1  # bash 4.2+ printf time
done

# Use mapfile to read array from command output (no subshell per line)
mapfile -t pods < <(kubectl get pods -n prod --no-headers -o name)
echo "Pod count: ${#pods[@]}"
```

---

## Common One-Liners

```bash
# Delete all failed pods
kubectl get pods -A --field-selector=status.phase=Failed -o name | xargs kubectl delete

# Follow logs from pods matching label
kubectl get pods -l app=payment -o name | head -1 | xargs kubectl logs -f

# Get all container images in cluster
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Find large files
find / -xdev -type f -size +100M -printf '%s %p\n' 2>/dev/null | sort -rn | head -10

# Count HTTP status codes in nginx access log
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Show memory usage by process
ps aux --sort=-%mem | awk 'NR==1 || /[0-9]+/{printf "%-20s %6s %6s\n", $11, $3, $4}' | head -20

# Test if TCP port is open
timeout 3 bash -c "cat < /dev/null > /dev/tcp/hostname/8080" && echo open || echo closed
```

---

## Interview Prep

**"What does `set -euo pipefail` do?"**
`-e`: exit on any non-zero exit code. `-u`: error on unset variables. `-o pipefail`: propagate pipe failures (without it, `false | true` exits 0). Together they make scripts fail fast and explicit.

**"How do you safely handle user input in a script?"**
Never use `eval` or pass user input directly to `rm`/`rm -rf`. Use `--` to separate options from arguments (`rm -- "$file"`). Validate with regex before using in commands. Use `printf '%q'` if you must construct command strings.

**"How do you pass arguments safely to commands?"**
Wrap in double quotes: `"$var"`. For arrays: `"${arr[@]}"`. Never use bare `$var` in `[[ ]]` comparisons for command arguments (word splitting). Use `--` to end option parsing.

**"How would you write a production deployment script?"**
Strict mode (`set -euo pipefail`), trap for cleanup on exit, logging with timestamps to stdout, required env var validation, dry-run mode, rollout status wait with timeout, and smoke test before exit 0.

**"Bash vs Python for automation — when do you choose which?"**
Bash for gluing Unix tools, simple file ops, and one-liners that stay < 50 lines. Python once you need data structures, retry logic, async I/O, SDK clients, or anything that will grow. If you're adding `awk`, `sed`, and `grep` in the same script, consider Python.



---

## 📁 Source Documents

> 4 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Shell Scripting] 1741163111410](http://localhost:8765/api/documents/b00d3446-cedd-40c4-a285-b217ad2ec2de/view) | PDF | beginner |
| [[Shell Scripting] 1741963318824](http://localhost:8765/api/documents/27f13a2e-c377-4585-a150-a2ffb1f12699/view) | PDF | intermediate |
| [[Linux] 1745729250800](http://localhost:8765/api/documents/bb5c4ca6-50ec-4ba1-8445-a7a3778cf46a/view) | PDF | intermediate |
| [[Linux] Linux Cheat Sheet](http://localhost:8765/api/documents/c17c28a0-0b92-4d92-a43a-15fae6bca704/view) | PDF | beginner |


<AIChatWidget domain="scripting-bash-shell" title="Ask AI about Bash & Shell Scripting" />

---

## [SRE] Foundations: Bash Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Bash Premium Teaching Guide For SRE And Platform Engineers

Bash is the control language of Linux operations. It glues commands together, automates repetitive work, and helps you debug production quickly.

If Linux is the operating foundation, Bash is the hand tool you carry every day.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — terminal fluency, variables, quoting, exit codes.
2. **Intermediate Layer** — pipes, text processing, functions, JSON/API workflows.
3. **Advanced Layer** — strict mode, traps, retries, idempotency, parallelism.
4. **Production SRE Layer** — triage one-liners, runbook scripts, safety patterns.
5. **Interview Layer** — explain when Bash is right and when to switch to Python.

---

## Memory Palace: Bash Is A Toolbox

| Bash Concept | Toolbox Analogy | Meaning |
|---|---|---|
| Shell | Workbench | Where commands are assembled |
| Command | Tool | Does one job |
| Pipe | Hose connector | Sends output into next tool |
| Variable | Label | Stores reusable value |
| Function | Tool bundle | Reusable operation |
| Exit Code | Status light | Success or failure |
| Trap | Cleanup hook | Runs on exit/interruption |
| Script | Procedure card | Repeatable automation |

---

## Beginner Layer: What Bash Actually Is

Bash is both:

1. an interactive shell
2. a scripting language

It mostly orchestrates other programs.

```text
stdin  -> input
stdout -> normal output
stderr -> errors
exit code -> success/failure
```

Unix philosophy:

> Small tools that do one thing well, combined with pipes.

---

## Beginner Layer: Terminal Fluency

Navigation:

```bash
pwd
ls -lah
cd /path
mkdir demo
touch file.txt
cp a b
mv a b
rm file.txt
```

Reading files:

```bash
less file
head -20 file
tail -50 file
tail -f /var/log/app.log
```

Help:

```bash
man grep
command --help
which kubectl
type cd
history
```

---

## Beginner Layer: Variables And Quoting

```bash
name="cluster-a"
echo "$name"
```

Always quote variables unless you intentionally want word splitting or glob expansion.

Risky:

```bash
echo $name
```

Safer:

```bash
echo "$name"
```

Command substitution:

```bash
pods=$(kubectl get pods --no-headers | wc -l)
now=$(date +%F-%H%M)
```

---

## Beginner Layer: Exit Codes

Most commands return `0` for success and non-zero for failure.

```bash
curl -sf https://example.com/health
if [[ $? -eq 0 ]]; then
  echo healthy
fi
```

Better:

```bash
if curl -sf https://example.com/health; then
  echo healthy
else
  echo unhealthy
fi
```

---

## Intermediate Layer: Safe Script Foundation

For serious scripts:

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

Meaning:

- `-e`: stop on unhandled error
- `-u`: fail on unset variable
- `pipefail`: pipeline fails if any command fails
- safer word splitting

Strict mode is not magic. You still need clear error handling.

---

## Intermediate Layer: Conditionals, Loops, Functions

Conditionals:

```bash
if [[ -f /etc/hosts ]]; then
  echo exists
fi
```

Loops:

```bash
while read -r line; do
  echo "$line"
done < file.txt
```

Functions:

```bash
log(){ printf '[%s] %s\n' "$(date -Is)" "$*" >&2; }
die(){ log "ERROR: $*"; exit 1; }
require(){ command -v "$1" >/dev/null || die "missing $1"; }
```

Functions make runbook automation readable.

---

## Intermediate Layer: Pipes And Text Processing

Useful tools:

```bash
grep -E 'ERROR|WARN' app.log
awk '{print $1}' access.log
sed -n '1,20p' file
sort file | uniq -c | sort -rn
cut -d: -f1 /etc/passwd
```

Mental model:

```text
command output -> filter -> transform -> summarize
```

---

## Intermediate Layer: JSON And APIs

Modern operations use JSON everywhere.

```bash
kubectl get pods -o json | jq '.items[].metadata.name'
curl -s https://api.example.com/status | jq '.status'
```

Use `jq` instead of fragile grep/sed parsing for JSON.

---

## Advanced Layer: Traps And Cleanup

```bash
tmp=$(mktemp)
cleanup(){ rm -f "$tmp"; }
trap cleanup EXIT
```

Use traps for:

- temp file cleanup
- lock release
- rollback hooks
- signal handling

---

## Advanced Layer: Retry With Backoff

```bash
for i in 1 2 3; do
  if curl -sf https://api.example.com/health; then
    break
  fi
  sleep $((i * 2))
done
```

Retries should be bounded. Infinite retries hide failure.

---

## Advanced Layer: Idempotency

Idempotent scripts can run more than once safely.

```bash
mkdir -p /opt/app
cp -n config /opt/app/
```

Production automation should prefer idempotency over “run once and hope.”

---

## Advanced Layer: Safe Deletes

Dangerous:

```bash
rm -rf $target/cache
```

Safer:

```bash
[[ -n "${target:-}" ]] || exit 1
rm -rf "${target:?}/cache"
```

Most shell disasters are quoting and variable-expansion disasters.

---

## Advanced Layer: Parallelism

```bash
for host in app1 app2 app3; do
  ssh "$host" uptime &
done
wait
```

Parallelism is powerful, but add limits for large fleets. Unbounded parallel SSH can create an incident.

---

## Production SRE Layer: Useful One-Liners

Top disk usage:

```bash
du -sh /var/* | sort -rh | head
```

Count HTTP status codes:

```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

Socket states:

```bash
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c
```

Watch pods:

```bash
watch -n 5 'kubectl get pods -A'
```

---

## Production SRE Layer: Real Incidents

### Log Disk Full

Check:

```bash
find /var/log -type f -size +500M
lsof +L1
```

### Service Down On Many Hosts

```bash
for h in app1 app2 app3; do
  ssh "$h" systemctl is-active myapp || echo "$h failed"
done
```

### API Returning 500

```bash
curl -vk https://api.example.com/health
tail -f /var/log/app.log
```

### Cleanup Script Deleted Too Much

Cause:

- unquoted variable
- empty path
- no guardrail

Fix:

- quote variables
- require non-empty target
- dry-run mode
- explicit allowlist

---

## Bash vs Python Judgment

Use Bash when:

- chaining commands
- quick automation
- OS/file/log tasks
- deployment glue
- simple runbook steps

Use Python when:

- complex logic
- structured data
- APIs with auth
- long-lived tooling
- tests and packaging matter

Senior engineers know when Bash has become a liability.

---

## Interview Layer: Strong Answers

### Why `set -euo pipefail`?

> It reduces silent failures by failing on unhandled errors, unset variables, and failed pipeline components.

### Why quote variables?

> To avoid accidental word splitting, glob expansion, and dangerous path handling.

### When replace Bash with Python?

> When logic, data structures, error handling, and maintainability outgrow shell orchestration.

### How safely run commands on many hosts?

> Limit concurrency, log results per host, handle timeouts, avoid broad destructive commands, and prefer orchestration tools for repeated fleet work.

---

## Labs

### Beginner

1. Write backup script.
2. Parse small log file.
3. Use variables and conditionals.

### Intermediate

1. Health-check multiple URLs.
2. Summarize nginx logs.
3. Process JSON with jq.

### Advanced

1. Retry wrapper with backoff.
2. Safe cleanup script with dry-run.
3. Parallel host checker with concurrency limit.
4. Deploy script with rollback hook.

---

## Memory Review

- Why is quoting variables important?
- Why does pipefail matter?
- When is jq safer than grep?
- Why use trap cleanup EXIT?
- When should Bash become Python?

---

## Senior Summary

> I use Bash for fast, composable operational tasks close to the OS. I make scripts safer with strict mode, quoting, traps, idempotency, bounded retries, and guardrails around destructive operations. When logic becomes complex or long-lived, I switch to Python.

---

## [SRE] Bash Lab 1: Health Check Script

## Bash Lab 1: Health Check Script

### Operational Context

Every SRE team eventually writes a script that answers "is this thing up?" before a more
sophisticated monitoring stack exists — or as a fast sanity check during an incident when you
don't trust the dashboard. A health check script is one of the first tools you reach for when
a deployment just went out, a new environment is being bootstrapped, or a dependency is flaky
and you want to know *right now* whether it's reachable.

This lab teaches the fundamentals: argument handling, TCP-level reachability with a real
timeout, meaningful exit codes, and log lines that are useful in a pager alert or cron job
output. These patterns appear in every production automation script.

### Prerequisites

- Bash 4+
- `nc` (netcat) or `bash /dev/tcp` — both approaches are covered below
- Basic understanding of exit codes (0 = success, non-zero = failure)

### Time Estimate

30–45 minutes to complete the core script. Extensions add another 30 minutes.

---

### Step-by-Step Build Guide

#### Step 1 — Get the scaffold running

Open `starter/health_check.sh`. It already validates that `HOST` and `PORT` are passed and
prints usage if they aren't. Run it to confirm the skeleton works:

```bash
bash starter/health_check.sh
# → usage: health_check.sh HOST PORT

bash starter/health_check.sh localhost 80
# → TODO: implement TCP health check for localhost:80
```

Confirm the exit code from the missing-args case:

```bash
bash starter/health_check.sh; echo "exit: $?"
# → exit: 1
```

#### Step 2 — Replace the TODO with a real TCP check

The simplest TCP probe in pure bash uses the special `/dev/tcp` pseudo-device. No external
tools required:

```bash
# Pattern: open a TCP connection with a 3-second timeout
# The redirect opens the socket; if it fails, the command fails
timeout 3 bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null
```

Replace the TODO line with this check. Capture the exit code and act on it:

```bash
if timeout 3 bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
    echo "UP"
else
    echo "DOWN"
    exit 1
fi
```

Test against something you know is up and something you know is down:

```bash
bash health_check.sh google.com 443      # should print UP
bash health_check.sh localhost 19999     # should print DOWN, exit 1
echo "exit was: $?"
```

#### Step 3 — Add a timestamp to every log line

Bare `echo` output is fine interactively but useless in cron or systemd logs where timestamps
aren't added automatically. Define a log function at the top of your script and use it
everywhere:

```bash
log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}
```

Replace every `echo` call with `log`. Now each line is independently timestamped, which means
you can redirect output to a file and still know exactly when the check ran.

#### Step 4 — Make the output operator-friendly

Right now the output only says "UP" or "DOWN". Add the host, port, and latency so someone
reading the log knows what was checked without having to reconstruct the command:

```bash
start=$(date +%s%3N)   # milliseconds since epoch
# ... your timeout/tcp check here ...
end=$(date +%s%3N)
latency=$(( end - start ))

log "host=${host} port=${port} status=UP latency=${latency}ms"
```

Structured key=value output is easy to grep and easy to parse with awk later.

#### Step 5 — Validate that port is a number

`/dev/tcp` will silently misbehave if port is not a number. Add a guard:

```bash
if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "error: port must be a number, got: ${port}" >&2
    exit 2
fi
```

Note the `>&2` — errors go to stderr, not stdout. This matters when callers capture stdout.

#### Step 6 — Support multiple host:port pairs (optional but common)

A real health check script usually checks a list. Use a `for` loop over arguments in
`HOST:PORT` format:

```bash
for target in "$@"; do
    host="${target%%:*}"
    port="${target##*:}"
    # ... check each target ...
done
```

The `%%:*` strips everything from the first colon onwards (giving the host).
The `##*:` strips everything up to and including the last colon (giving the port).

---

### Sample Output

```
[2026-04-09T14:22:01Z] host=api.internal port=8080 status=UP latency=12ms
[2026-04-09T14:22:01Z] host=db.internal port=5432 status=UP latency=4ms
[2026-04-09T14:22:04Z] host=cache.internal port=6379 status=DOWN latency=3001ms
```

Exit code is 0 only if all targets passed. If any target is DOWN, exit code is 1.

---

### Common Mistakes and How to Debug Them

**The script exits immediately on the first DOWN host**

`set -e` (from `set -euo pipefail`) causes any non-zero exit to abort the script. Your TCP
check returning 1 will kill the script before it prints "DOWN". Fix: either wrap the check in
an `if`, or temporarily suppress the failure: `timeout ... || true`. Using `if` is cleaner
because it makes intent explicit.

**Timeout is not installed**

`timeout` is part of GNU coreutils. On macOS it may be `gtimeout` (via `brew install
coreutils`). Test with: `which timeout`. As a fallback, the `bash /dev/tcp` approach has
no built-in timeout — you need the `timeout` wrapper, or use `nc -z -w3`.

**Port is in the range but wrong type causes a silent hang**

If port is accidentally set to a hostname string, bash will try to resolve `/dev/tcp/host/otherhost` and hang. The numeric validation in Step 5 prevents this.

**False positives on firewalled ports**

A firewall that drops (rather than rejects) packets will cause your script to hang until
timeout. If you see every check taking exactly 3 seconds, a DROP rule is likely. Increase
the timeout or use `nc -z -w3` which handles this more gracefully.

**Output is mixed between stdout and stderr**

Debugging with `echo` inside the script writes to stdout. Your callers may be capturing
stdout to check for "UP". Add `>&2` to any debug-only lines that aren't part of the real
output.

---

### Extension Challenges

1. **Exit code inventory**: Make the exit code encode how many targets failed. Exit 0 if all
   pass, exit 1 if 1–50% fail, exit 2 if more than 50% fail. Useful for callers that need
   a severity signal.

2. **Retry on DOWN**: Add a `--retries N` flag. If a host is DOWN, retry up to N times with a
   1-second sleep before reporting DOWN. Think carefully about what this means for the overall
   script latency.

3. **Read targets from a file**: Accept a `-f targets.txt` argument where each line is
   `HOST:PORT`. Use `while IFS= read -r line; do ... done < "$file"` to iterate. Skip blank
   lines and lines starting with `#`.

4. **Machine-readable output**: Add a `--json` flag that prints one JSON object per target
   instead of the key=value format. Test with `jq .` to verify your JSON is valid.

5. **Probe a Kubernetes Service**: Extend the script to resolve a Kubernetes Service ClusterIP
   using `kubectl get svc -n NAMESPACE SERVICE -o jsonpath='{.spec.clusterIP}'` and then check
   that IP on the service port. This is how you verify network policy hasn't accidentally
   blocked internal traffic.

---

## [SRE] Bash Lab 2: Access Log Summary

## Bash Lab 2: Access Log Summary

### Operational Context

During an incident the first question is almost always "what is the error rate?" and the
second is "which endpoint and which client?". Dashboards are great when they're already
configured — but when you're triaging a new service, a degraded environment, or a log file
someone dropped into a support ticket, you need to be able to extract this signal yourself
in under two minutes.

`awk`, `sort`, and `uniq -c` together form a log analysis toolkit that every SRE should be
able to use fluently. This lab builds a reusable script that produces the three most
operationally useful summaries from an NGINX access log: request volume by endpoint, error
rate by status code, and top offending clients.

The patterns here transfer directly to Apache logs, HAProxy logs, Envoy access logs (with
minor format adjustments), and any other space-delimited access log.

### Prerequisites

- `awk`, `sort`, `uniq` — standard on every Linux system
- Familiarity with NGINX combined log format (covered in Step 1)
- Sample data: `../shared/logs/sample-nginx-access.log`

### Time Estimate

25–40 minutes for the core script. Extensions add 20–30 minutes.

---

### Step-by-Step Build Guide

#### Step 1 — Understand the log format before writing a single line of awk

Never assume field positions. Print the first two lines of the log and count fields manually:

```bash
head -2 ../shared/logs/sample-nginx-access.log
```

NGINX combined log format:

```
$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
```

Field positions when split on spaces (awk `$N` notation):

| Field | awk | Example value |
|-------|-----|---------------|
| Client IP | `$1` | `10.0.0.11` |
| Timestamp | `$4 $5` | `[08/Apr/2026:10:00:01 +0000]` |
| HTTP method | `$6` | `"GET` |
| Request path | `$7` | `/api/v1/orders` |
| Protocol | `$8` | `HTTP/1.1"` |
| Status code | `$9` | `200` |
| Bytes sent | `$10` | `512` |

Verify your field mapping before trusting any counts:

```bash
awk '{print $9}' ../shared/logs/sample-nginx-access.log | head -5
```

If you see numbers like 200, 404, 500, your field position is correct.

#### Step 2 — Count requests per status code

This is the fastest health check. Start here:

```bash
awk '{print $9}' ../shared/logs/sample-nginx-access.log \
  | sort \
  | uniq -c \
  | sort -rn
```

Wrap this in your script as a function:

```bash
status_summary() {
    local log_file="$1"
    echo "=== Requests by Status Code ==="
    awk '{print $9}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | awk '{printf "  %-6s %s\n", $2, $1}'
}
```

The final `awk` reformats the output so status code comes first (more readable):
`200    41` instead of `41 200`.

#### Step 3 — Count requests per endpoint (top 10)

```bash
endpoint_summary() {
    local log_file="$1"
    echo "=== Top Endpoints by Request Count ==="
    awk '{print $7}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-40s %s\n", $2, $1}'
}
```

Test this. If you see query strings cluttering the output (`/api/v1/search?q=foo`), you can
strip them with: `awk '{split($7, a, "?"); print a[1]}'`

#### Step 4 — Find IPs generating 5xx errors

This is the "who is hammering the broken endpoint" query:

```bash
error_clients() {
    local log_file="$1"
    echo "=== Top IPs with 5xx Responses ==="
    awk '$9 ~ /^5/ {print $1}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-20s %s errors\n", $2, $1}'
}
```

The `$9 ~ /^5/` pattern means "status code starts with 5". This matches 500, 502, 503, 504.

#### Step 5 — Wire everything together with a separator

```bash
main() {
    local log_file="${1:-}"
    if [[ -z "$log_file" ]]; then
        echo "usage: $0 LOG_FILE" >&2
        exit 1
    fi
    if [[ ! -f "$log_file" ]]; then
        echo "error: file not found: $log_file" >&2
        exit 1
    fi

    local total
    total=$(wc -l < "$log_file")
    echo "Log: $log_file  (${total} lines)"
    echo ""
    status_summary "$log_file"
    echo ""
    endpoint_summary "$log_file"
    echo ""
    error_clients "$log_file"
}

main "$@"
```

#### Step 6 — Add a file-not-found check

You added `[[ ! -f "$log_file" ]]` above. Test it:

```bash
bash log_summary.sh /nonexistent.log
# → error: file not found: /nonexistent.log
echo $?  # → 1
```

This matters in automation: if the script silently produces empty output when the log
doesn't exist, the caller can't tell whether there were zero errors or whether the file
was missing.

---

### Sample Output

```
Log: ../shared/logs/sample-nginx-access.log  (62 lines)

=== Requests by Status Code ===
  200    28
  404    12
  500     9
  502     7
  503     6

=== Top Endpoints by Request Count ===
  /api/v1/orders                           18
  /api/v1/users                            14
  /healthz                                  9
  /api/v1/products                          8
  /api/v1/search                            7
  /api/v1/auth/login                        6

=== Top IPs with 5xx Responses ===
  10.0.0.13            8 errors
  10.0.0.17            4 errors
  10.0.0.12            3 errors
```

---

### Common Mistakes and How to Debug Them

**Status codes are printing as 0 or blank**

Field positions shift if the log format is different. Some NGINX configs log a dash for
`$remote_user` differently, or include `$request_time`. Always print the raw field and
inspect it before counting:

```bash
awk '{print NR, $9}' sample-nginx-access.log | head -5
```

**`uniq -c` produces wrong counts**

`uniq -c` only collapses *consecutive* identical lines. If you forget to `sort` before
`uniq -c`, you get per-run counts instead of totals. The pipeline must be:
`... | sort | uniq -c | sort -rn`.

**Empty output for 5xx queries**

Check whether any 5xx lines actually exist:

```bash
grep ' 5[0-9][0-9] ' ../shared/logs/sample-nginx-access.log | wc -l
```

If this returns 0 but you expected errors, your test data may not have any 5xx entries.

**`awk` treating quoted strings as multiple fields**

The `"GET /path HTTP/1.1"` portion in the log is one semantic field but is split by awk
because of the spaces inside the quotes. Field `$6` is `"GET`, `$7` is `/path`, `$8` is
`HTTP/1.1"`. This is expected and is why the endpoint is in `$7`, not `$6`. If your logs
have URLs with spaces (unusual but possible), you'll need a more careful parser.

**Script exits on empty file**

If the log file is empty, `wc -l` returns 0 and awk produces no output — this is fine. But
if you have `set -e` and a pipeline returns non-zero due to an empty result, you may get
unexpected exits. Test: `bash log_summary.sh /dev/null`

---

### Extension Challenges

1. **Error rate percentage**: For each status class (2xx, 3xx, 4xx, 5xx), print the count
   and percentage of total requests. Use `awk` to compute both in one pass.

2. **Time-window filter**: Accept optional `--from` and `--to` arguments in `HH:MM` format
   and only analyze log lines within that window. NGINX timestamps are in the format
   `08/Apr/2026:10:00:01`.

3. **Response-size analysis**: Print the top 5 endpoints by total bytes transferred. This
   reveals bandwidth consumers that may not have the highest request count.

4. **Slow request detection**: NGINX can log `$request_time`. If your sample log included
   this field, find all requests that took more than 1 second and print the endpoint and time.

5. **Alert threshold**: Add a `--max-error-rate` flag. If the 5xx percentage exceeds the
   threshold, print a warning line to stderr and exit with code 2. This makes the script
   usable in a CI or alerting pipeline.

---

## [SRE] Bash Lab 3: Retry Wrapper With Guardrails

## Bash Lab 3: Retry Wrapper With Guardrails

### Operational Context

Retry logic is everywhere in production systems: deployment scripts waiting for a pod to
become ready, health check loops polling until a service comes up, database migration scripts
waiting for the schema to be applied. Done badly, retry loops turn a transient blip into a
prolonged incident — or worse, they amplify an overloaded system by hammering it with
repeated requests exactly when it's struggling to recover.

This lab builds a general-purpose retry wrapper that you can drop in front of *any* command.
The key constraints that make retry safe:

1. **Exponential backoff** — each attempt waits longer than the last
2. **Capped sleep** — backoff doesn't grow unbounded (no 10-minute waits)
3. **Attempt logging** — every retry is visible in the output
4. **Exit code preservation** — the final failure exit code is passed through to the caller

Understanding *when not to retry* is as important as knowing how to retry — this lab covers
both.

### Prerequisites

- `sleep`, `date` — standard on every Linux system
- Understanding of `$?` (last exit code) and `$@` (all arguments)
- A simple command to test with: `curl`, `wget`, or even `false`

### Time Estimate

30–45 minutes for the core wrapper. Extensions add 30 minutes.

---

### Step-by-Step Build Guide

#### Step 1 — Understand what you're wrapping

The wrapper must run *any* command the user passes after the script name. The user's command
is everything in `$@`. Test that your script can receive and re-execute an arbitrary command:

```bash
# Print what will be run, then actually run it
echo "Running: $*"
"$@"
echo "Exit code: $?"
```

Note: use `"$@"` (double-quoted, with `@`), not `$*`. `"$@"` preserves argument boundaries.
If the command is `grep "hello world" file.txt`, `"$@"` passes three arguments correctly.
`$*` collapses them into one string.

#### Step 2 — Add configurable attempt count and basic retry loop

```bash
max_attempts="${RETRY_MAX:-3}"
attempt=1

while [[ $attempt -le $max_attempts ]]; do
    echo "[attempt $attempt/$max_attempts] running: $*"
    if "$@"; then
        echo "[attempt $attempt/$max_attempts] succeeded"
        exit 0
    fi
    last_exit=$?
    echo "[attempt $attempt/$max_attempts] failed with exit code $last_exit"
    attempt=$(( attempt + 1 ))
done
```

Test with a command that always fails:

```bash
bash retry.sh false
# should show 3 attempts, all failing
```

Test with a command that succeeds:

```bash
bash retry.sh echo hello
# should show 1 attempt, success
```

#### Step 3 — Add exponential backoff with a cap

Linear sleep (always wait 1 second) wastes time on slow failures and doesn't relieve pressure
on an overwhelmed service. Exponential backoff doubles the wait each time:

```bash
max_sleep="${RETRY_MAX_SLEEP:-30}"
base_sleep=1

# Inside the retry loop, after a failure and before incrementing attempt:
if [[ $attempt -lt $max_attempts ]]; then
    sleep_time=$(( base_sleep * (2 ** (attempt - 1)) ))
    # Cap the sleep so it doesn't grow unbounded
    if [[ $sleep_time -gt $max_sleep ]]; then
        sleep_time=$max_sleep
    fi
    echo "[attempt $attempt/$max_attempts] sleeping ${sleep_time}s before retry"
    sleep "$sleep_time"
fi
```

With `base_sleep=1` and `max_sleep=30`:
- After attempt 1: sleep 1s
- After attempt 2: sleep 2s
- After attempt 3: sleep 4s
- After attempt 4: sleep 8s
- After attempt 5: sleep 16s
- After attempt 6: sleep 30s (capped)

#### Step 4 — Preserve the failing exit code

When all retries are exhausted, the caller needs the real exit code from the failed command,
not 1 from your script logic. Track it explicitly:

```bash
last_exit=1   # default if we somehow fall through

while [[ $attempt -le $max_attempts ]]; do
    if "$@"; then
        exit 0
    fi
    last_exit=$?
    # ... backoff and retry ...
    attempt=$(( attempt + 1 ))
done

echo "[retry] all $max_attempts attempts failed"
exit "$last_exit"
```

Test:

```bash
bash retry.sh bash -c 'exit 42'
echo "caller sees: $?"
# → caller sees: 42
```

#### Step 5 — Add a timestamp to each log line

In automation, bare echo output is hard to correlate with other events. Add a timestamp:

```bash
log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}
```

Replace all `echo` calls inside the retry logic with `log`.

#### Step 6 — Add guardrail commentary (important for interviews)

Add a comment block in your script explaining when retry is safe vs dangerous. This
demonstrates operational maturity:

```bash
# SAFE to retry:
#   - Idempotent reads (HTTP GET, kubectl get)
#   - Health-check probes
#   - Waiting for a resource to become available
#
# DANGEROUS to retry without thought:
#   - HTTP POST / payment operations (risk of double-charge)
#   - Destructive operations (kubectl delete, terraform destroy)
#   - Already-overloaded services — retries amplify load
#   - Non-idempotent database writes
```

---

### Sample Output

```
[2026-04-09T14:30:00Z] [attempt 1/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:00Z] [attempt 1/4] failed with exit code 7
[2026-04-09T14:30:00Z] [attempt 1/4] sleeping 1s before retry
[2026-04-09T14:30:01Z] [attempt 2/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:01Z] [attempt 2/4] failed with exit code 7
[2026-04-09T14:30:01Z] [attempt 2/4] sleeping 2s before retry
[2026-04-09T14:30:03Z] [attempt 3/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:03Z] [attempt 3/4] succeeded
```

Exit code is 0 if any attempt succeeded. Exit code is the last command's exit code if all
attempts failed.

---

### Common Mistakes and How to Debug Them

**`set -e` kills the script on the first failure**

With `set -euo pipefail`, a command returning non-zero exits the script immediately. Your
retry loop depends on *catching* non-zero exit codes. Use `if "$@"; then ... fi` instead of
running the command bare. The `if` construct is exempt from `set -e`.

Alternatively, temporarily disable `set -e` around the loop:
```bash
set +e
"$@"
last_exit=$?
set -e
```

Using `if` is cleaner and is the recommended approach.

**Arithmetic on `attempt` fails with `set -u`**

`$(( attempt + 1 ))` is fine. But if you write `let attempt++` and attempt is unset, you get
an error. Always initialize variables before the loop.

**The exit code is always 1 instead of the real code**

If you check `$?` but then run another command before saving it, you've lost the real exit
code. Save it immediately: `last_exit=$?`. Any command between the failed command and
`last_exit=$?` will overwrite `$?`.

**Retry loops hiding real problems in CI**

If a CI job is retrying 10 times and mostly succeeding on attempt 3, the real issue is
being hidden. Add monitoring for retry *rate*, not just final success/failure. In this lab,
print a warning if more than 1 retry was needed: `if [[ $attempt -gt 1 ]]; then log "WARNING: succeeded after $attempt attempts"`.

**Using `sleep` in a tight loop on a production system**

If your command is fast and you have many retries, the sleep caps help. But if max_sleep is
0 or you remove the sleep for testing and forget to put it back, you can create a tight
retry loop that hammers a database or API. Always test with `--dry-run` or `echo` first.

---

### When NOT to Use This Wrapper

This is the most important section. Retry logic is not always helpful.

**Amplifying overload**: A service returning 503 is telling you it's overwhelmed. Retrying
immediately with 10 clients each retrying 3 times turns 10 requests into 30 requests at the
worst possible moment. Real systems use jitter (randomized sleep) to spread retries out.

**Non-idempotent operations**: If your command creates a payment, sends an email, or modifies
a record that can't be deduplicated, retrying can cause double operations. Always ask: "if
this runs twice, is that safe?"

**Masking cascading failures**: Retry loops in multiple layers of a stack (client → service →
database) can combine to produce retry storms. If each layer retries 3 times, a single failure
triggers 27 attempts at the database layer.

---

### Extension Challenges

1. **Add jitter**: Instead of deterministic exponential backoff, add a random component:
   `sleep_time=$(( sleep_time + RANDOM % 3 ))`. This spreads load from multiple simultaneous
   retriers and is standard practice in distributed systems.

2. **Retry on specific exit codes only**: Add a `--retry-on 7,22,28` flag. Only retry if the
   command's exit code matches one of the listed codes. This prevents retrying on errors that
   are guaranteed to fail again (e.g., "file not found").

3. **Deadline mode**: Instead of `--max-attempts`, add `--deadline 60` which retries until
   the wall-clock deadline expires. Use `date +%s` to track elapsed time. This is more
   natural for "wait until service is up" use cases.

4. **Dry-run flag**: Add `--dry-run` which prints the command and backoff plan without
   actually running anything. Useful for validating complex invocations in automation scripts.

5. **Integrate with the health check script**: Use `retry.sh` to wrap `health_check.sh` and
   wait until a service comes up after deployment. This is a real pattern used in Kubernetes
   readiness polling and deployment scripts.
