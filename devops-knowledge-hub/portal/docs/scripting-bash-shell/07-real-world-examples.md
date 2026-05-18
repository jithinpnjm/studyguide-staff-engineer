---
title: "Real-World Examples"
sidebar_position: 7
---

# Real-World Examples: SRE Scripts

8+ complete SRE scenarios covering on-call triage, deployment automation, log rotation, health checks, and cleanup jobs. Every script follows production conventions: strict mode, structured logging, traps, and idempotency.

---

## 1. Service Health Check — Multiple Endpoints

Used during incident triage, after deployments, and in CI smoke tests.

```bash
#!/usr/bin/env bash
set -euo pipefail

ENDPOINTS=(
    "http://payment:8080/health"
    "http://auth:8081/health"
    "http://inventory:8082/health"
    "http://billing:8083/health"
)

TIMEOUT="${HEALTHCHECK_TIMEOUT:-5}"
FAILED=()

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

for url in "${ENDPOINTS[@]}"; do
    if curl -sf --max-time "$TIMEOUT" "$url" &>/dev/null; then
        log "OK    $url"
    else
        log "FAIL  $url"
        FAILED+=("$url")
    fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
    log "ERROR: ${#FAILED[@]} endpoint(s) failed: ${FAILED[*]}" >&2
    exit 1
fi

log "All ${#ENDPOINTS[@]} endpoints healthy"
```

---

## 2. Kubernetes Deployment Script

Production deployment with dry-run, rollout wait, and rollback on failure.

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:?NAMESPACE required}"
IMAGE="${IMAGE:?IMAGE required}"
DEPLOYMENT="${DEPLOYMENT:-myapp}"
DRY_RUN="${DRY_RUN:-false}"
TIMEOUT="${ROLLOUT_TIMEOUT:-300}"

log()  { printf '[%s] INFO  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
warn() { printf '[%s] WARN  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
die()  { printf '[%s] ERROR %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null || die "missing required command: $1"; }

rollback() {
    warn "Rolling back $DEPLOYMENT in $NAMESPACE"
    kubectl rollout undo deployment/"$DEPLOYMENT" -n "$NAMESPACE" || true
}

cleanup() {
    local code=$?
    if [[ $code -ne 0 ]]; then
        warn "Deployment failed (exit $code) — initiating rollback"
        rollback
    fi
    log "Done (exit $code)"
}
trap cleanup EXIT

require kubectl
require jq

log "Deploying $IMAGE to $DEPLOYMENT in $NAMESPACE"

if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry run — no changes will be made"
    exit 0
fi

# Deploy
kubectl set image deployment/"$DEPLOYMENT" \
    "${DEPLOYMENT}=${IMAGE}" \
    -n "$NAMESPACE"

# Wait for rollout
log "Waiting for rollout (timeout: ${TIMEOUT}s)"
kubectl rollout status deployment/"$DEPLOYMENT" \
    -n "$NAMESPACE" \
    --timeout="${TIMEOUT}s"

# Smoke test
CLUSTER_IP=$(kubectl get svc "$DEPLOYMENT" -n "$NAMESPACE" \
    -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

if [[ -n "$CLUSTER_IP" ]]; then
    log "Running smoke test against $CLUSTER_IP"
    if ! curl -sf --max-time 10 "http://${CLUSTER_IP}/health" &>/dev/null; then
        die "Smoke test failed — deployment not healthy"
    fi
    log "Smoke test passed"
fi

log "Deployment successful: $IMAGE"
```

---

## 3. Log Rotation Script

Rotate application logs older than N days, with disk usage reporting and dry-run mode.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-/var/log/app}"
MAX_DAYS="${MAX_DAYS:-30}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/var/log/archive}"
DRY_RUN="${DRY_RUN:-false}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
die() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR $*" >&2; exit 1; }

[[ -d "$LOG_DIR" ]] || die "Log directory not found: $LOG_DIR"

log "Starting log rotation: LOG_DIR=$LOG_DIR MAX_DAYS=$MAX_DAYS"
log "Disk usage before: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"

if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry run — files that would be rotated:"
    find "$LOG_DIR" -type f -name "*.log" -mtime +"$MAX_DAYS" -printf '  %p (%s bytes)\n'
    log "End of dry run"
    exit 0
fi

mkdir -p "$ARCHIVE_DIR"

# Count and rotate
rotated=0
total_size=0

while IFS= read -r logfile; do
    size=$(stat -c%s "$logfile" 2>/dev/null || echo 0)
    archive_name="${ARCHIVE_DIR}/$(basename "$logfile").$(date +%Y%m%d%H%M%S).gz"

    log "Archiving: $logfile -> $archive_name"
    gzip -c "$logfile" > "$archive_name"
    rm -f "$logfile"

    (( rotated++ ))
    (( total_size += size ))
done < <(find "$LOG_DIR" -type f -name "*.log" -mtime +"$MAX_DAYS")

log "Rotated $rotated file(s) ($(( total_size / 1024 / 1024 )) MB freed)"
log "Disk usage after: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"

# Clean up archives older than 90 days
find "$ARCHIVE_DIR" -type f -name "*.gz" -mtime +90 -delete
log "Cleaned archives older than 90 days"
```

---

## 4. Multi-Host Service Checker (On-Call Runbook)

Run during an incident to quickly determine which hosts have a service down.

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:?Usage: $0 SERVICE [HOST...]}"
shift
HOSTS=("${@:-app1 app2 app3}")

TIMEOUT=10
PASS=()
FAIL=()

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

check_host() {
    local host="$1"
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$host" \
        "systemctl is-active $SERVICE" &>/dev/null; then
        PASS+=("$host")
        log "OK    $host: $SERVICE is active"
    else
        FAIL+=("$host")
        log "FAIL  $host: $SERVICE is NOT active"
    fi
}

log "Checking $SERVICE on ${#HOSTS[@]} host(s)"

declare -A pids
for host in "${HOSTS[@]}"; do
    check_host "$host" &
    pids["$host"]=$!
done

for host in "${!pids[@]}"; do
    wait "${pids[$host]}" 2>/dev/null || true
done

echo ""
echo "=== Summary ==="
echo "Pass: ${#PASS[@]}/${#HOSTS[@]}   ${PASS[*]:-none}"
echo "Fail: ${#FAIL[@]}/${#HOSTS[@]}   ${FAIL[*]:-none}"

[[ ${#FAIL[@]} -eq 0 ]]
```

---

## 5. Kubernetes Cleanup — Remove Stuck Resources

On-call one-liner turned into a safe, auditable script.

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:?NAMESPACE required}"
DRY_RUN="${DRY_RUN:-true}"   # safe default: dry-run

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] WARN $*" >&2; }

kubectl_cmd() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN: kubectl $*"
    else
        kubectl "$@"
    fi
}

log "Cleaning stuck resources in namespace: $NAMESPACE (DRY_RUN=$DRY_RUN)"

# Failed pods
log "--- Failed Pods ---"
while IFS= read -r pod; do
    [[ -z "$pod" ]] && continue
    log "Deleting failed pod: $pod"
    kubectl_cmd delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force
done < <(kubectl get pods -n "$NAMESPACE" \
    --field-selector=status.phase=Failed \
    --no-headers -o name 2>/dev/null)

# Terminating pods (stuck for > 5 minutes)
log "--- Stuck Terminating Pods ---"
while IFS= read -r pod; do
    [[ -z "$pod" ]] && continue
    log "Force-deleting stuck pod: $pod"
    kubectl_cmd delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force
done < <(kubectl get pods -n "$NAMESPACE" \
    --no-headers -o custom-columns="NAME:.metadata.name,STATUS:.status.phase" \
    | awk '$2=="Terminating" {print $1}' 2>/dev/null)

# Completed jobs
log "--- Completed Jobs ---"
while IFS= read -r job; do
    [[ -z "$job" ]] && continue
    log "Deleting completed job: $job"
    kubectl_cmd delete job "$job" -n "$NAMESPACE"
done < <(kubectl get jobs -n "$NAMESPACE" \
    --field-selector=status.successful=1 \
    --no-headers -o name 2>/dev/null)

log "Done"
```

---

## 6. Disk Usage Alert Script (Cron Job)

Sends a summary when any filesystem exceeds a threshold. Runs from cron every 15 minutes.

```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD="${DISK_THRESHOLD:-85}"     # percentage
ALERT_EMAIL="${ALERT_EMAIL:-ops@example.com}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

# Collect filesystems over threshold
alerts=()

while IFS= read -r line; do
    # line format: "Use% Mounted"
    usage="${line%% *}"
    mount="${line##* }"
    usage_num="${usage%%%}"   # strip %

    if (( usage_num >= THRESHOLD )); then
        alerts+=("${usage} used on ${mount}")
    fi
done < <(df -h --output=pcent,target | tail -n +2 | grep -v tmpfs)

if [[ ${#alerts[@]} -eq 0 ]]; then
    log "All filesystems below ${THRESHOLD}% — no alerts"
    exit 0
fi

# Build report
report=$(cat <<EOF
DISK USAGE ALERT — $(hostname) — $(date -u)
Threshold: ${THRESHOLD}%

Filesystems over threshold:
$(printf '  %s\n' "${alerts[@]}")

Full disk report:
$(df -h --output=pcent,target | tail -n +2)

Top directories by size:
$(du -sh /var/* /home/* 2>/dev/null | sort -rh | head -10)
EOF
)

log "ALERT: ${#alerts[@]} filesystem(s) over ${THRESHOLD}%"
echo "$report"

# Send email if configured
if command -v mail &>/dev/null && [[ -n "$ALERT_EMAIL" ]]; then
    echo "$report" | mail -s "Disk Alert: $(hostname)" "$ALERT_EMAIL"
    log "Alert email sent to $ALERT_EMAIL"
fi
```

---

## 7. Database Backup Script

Idempotent daily backup with retention, verification, and atomic file handling.

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:?DB_HOST required}"
DB_NAME="${DB_NAME:?DB_NAME required}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/backup/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

DATE=$(date +%Y-%m-%d)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"
TMPFILE=""

log()     { printf '[%s] INFO  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die()     { printf '[%s] ERROR %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

cleanup() {
    [[ -n "$TMPFILE" ]] && rm -f "$TMPFILE"
    log "Backup script finished (exit $?)"
}
trap cleanup EXIT INT TERM

mkdir -p "$BACKUP_DIR"

# Idempotent: skip if today's backup already exists
if [[ -f "$BACKUP_FILE" ]]; then
    log "Backup already exists: $BACKUP_FILE — skipping"
    exit 0
fi

log "Starting backup: $DB_NAME -> $BACKUP_FILE"

# Atomic write: write to temp file, rename on success
TMPFILE=$(mktemp "${BACKUP_FILE}.XXXXXX")

# Backup
if ! pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$TMPFILE"; then
    die "pg_dump failed — backup aborted"
fi

# Verify the dump is non-empty
if [[ ! -s "$TMPFILE" ]]; then
    die "Backup file is empty — something went wrong"
fi

# Atomic rename
mv -f "$TMPFILE" "$BACKUP_FILE"
TMPFILE=""   # prevent cleanup from deleting the real backup

local_size=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup complete: $BACKUP_FILE ($local_size)"

# Remove old backups
log "Removing backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" \
    -mtime +"$RETENTION_DAYS" \
    -delete \
    -print | while IFS= read -r deleted; do
        log "Removed: $deleted"
    done
```

---

## 8. API Poller with Exponential Backoff

Wait for an external API to return a healthy status — common in CI pipelines waiting for a staging environment to come up.

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${1:?Usage: $0 URL}"
MAX_WAIT="${MAX_WAIT:-300}"    # total seconds to wait
INTERVAL="${INTERVAL:-5}"      # initial poll interval

log() { printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }

deadline=$(( $(date +%s) + MAX_WAIT ))
attempt=0
interval=$INTERVAL

log "Polling $URL (max wait: ${MAX_WAIT}s)"

while [[ $(date +%s) -lt $deadline ]]; do
    (( attempt++ ))

    response=$(curl -sf --max-time 5 "$URL" 2>/dev/null || echo "")

    if [[ -n "$response" ]]; then
        status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "ok")
        if [[ "$status" == "ok" || "$status" == "healthy" || "$status" == "up" ]]; then
            log "Healthy after $attempt attempt(s) — status=$status"
            exit 0
        fi
        log "Attempt $attempt: status=$status (not ready yet)"
    else
        log "Attempt $attempt: no response from $URL"
    fi

    remaining=$(( deadline - $(date +%s) ))
    sleep_time=$(( interval < remaining ? interval : remaining ))
    [[ $sleep_time -le 0 ]] && break

    log "Sleeping ${sleep_time}s (${remaining}s remaining)"
    sleep "$sleep_time"

    # Exponential backoff, capped at 30s
    interval=$(( interval * 2 ))
    (( interval > 30 )) && interval=30
done

log "ERROR: $URL not healthy after ${MAX_WAIT}s" >&2
exit 1
```

---

## 9. On-Call Triage One-Liners (Runbook Snippets)

Patterns you reach for during incidents:

```bash
# Top disk usage
du -sh /var/* 2>/dev/null | sort -rh | head -10

# Log disk full — deleted-but-open files
lsof +L1 | grep -v "^COMMAND" | awk '{print $7, $9}' | sort -rn | head -10

# Find large log files
find /var/log -type f -size +500M -printf '%s %p\n' | sort -rn

# Count HTTP status codes in nginx access log
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Socket states
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c

# Service down on multiple hosts
for h in app1 app2 app3; do
    ssh "$h" "systemctl is-active myapp" 2>/dev/null && echo "$h: OK" || echo "$h: FAILED"
done

# API returning errors
curl -v https://api.example.com/health 2>&1 | grep -E "< HTTP|error"

# Tail logs from all pods matching a label
kubectl get pods -l app=payment -o name | xargs -I{} kubectl logs -f {}

# Watch pod restarts
watch -n 10 'kubectl get pods -A --sort-by=".status.containerStatuses[0].restartCount" | tail -20'

# Test TCP connectivity without netcat
timeout 3 bash -c "echo > /dev/tcp/hostname/8080" && echo "open" || echo "closed"

# Memory usage by process
ps aux --sort=-%mem | head -15

# Check if process is consuming all CPU
ps aux --sort=-%cpu | head -10

# Find files modified in last 5 minutes
find /etc /opt/app -newer /tmp/5min_ago -type f 2>/dev/null
```

---

## Bash vs Python Decision Guide

Patterns from these examples that should switch to Python:

| If your script is doing this | Switch to Python |
|---|---|
| Parsing complex JSON beyond simple `jq` queries | `json` module, typed data |
| Multiple authenticated API calls with tokens | `requests` with session management |
| Tracking state across multiple runs | Use a DB, not a temp file |
| Complex retry logic with different retry strategies per error type | Python exception hierarchy |
| Growing past 200 lines with nested functions | Maintainability demands it |
| Needs unit tests | `pytest` > `bats` for complex logic |

Keep using Bash for everything in this guide — it's the right tool for gluing OS-level operations.
