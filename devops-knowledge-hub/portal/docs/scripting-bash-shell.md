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
