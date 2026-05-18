---
title: "Hands-On Labs"
sidebar_position: 5
---

# Hands-On Labs: Bash & Shell Scripting

Three SRE labs built from real operational patterns. Each lab teaches a transferable skill that appears repeatedly in production automation.

---

## Lab 1: Health Check Script

### Operational Context

Every SRE team eventually writes a script that answers "is this thing up?" — before a sophisticated monitoring stack exists, or as a fast sanity check during an incident when you don't trust the dashboard. A health check script is one of the first tools you reach for when a deployment just went out, a new environment is being bootstrapped, or a dependency is flaky.

This lab teaches: argument handling, TCP-level reachability with a real timeout, meaningful exit codes, and log lines that are useful in pager alerts or cron output.

**Prerequisites**: Bash 4+, `timeout` (GNU coreutils), basic understanding of exit codes.

**Time estimate**: 30–45 minutes core, +30 minutes for extensions.

---

### Step 1 — Scaffold and validate arguments

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: $0 HOST PORT [HOST PORT ...]" >&2
    echo "       $0 HOST:PORT [HOST:PORT ...]" >&2
    exit 1
}

[[ $# -lt 1 ]] && usage
```

Run it to confirm the skeleton works:

```bash
bash health_check.sh
# → Usage: health_check.sh HOST PORT [HOST PORT ...]
bash health_check.sh; echo "exit: $?"
# → exit: 1
```

---

### Step 2 — Add a log function with timestamps

Bare `echo` output is useless in cron or systemd logs where timestamps aren't added automatically:

```bash
log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}
```

Use `log` everywhere — not bare `echo`. Now each line is independently timestamped and can be redirected to a file while remaining auditable.

---

### Step 3 — Implement TCP health check

The simplest TCP probe in pure bash uses the special `/dev/tcp` pseudo-device — no external tools required:

```bash
check_tcp() {
    local host="$1"
    local port="$2"

    # Validate port is numeric first
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        log "ERROR: port must be a number, got: ${port}" >&2
        return 2
    fi

    local start end latency
    start=$(date +%s%3N)

    if timeout 3 bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
        end=$(date +%s%3N)
        latency=$(( end - start ))
        log "host=${host} port=${port} status=UP latency=${latency}ms"
        return 0
    else
        end=$(date +%s%3N)
        latency=$(( end - start ))
        log "host=${host} port=${port} status=DOWN latency=${latency}ms"
        return 1
    fi
}
```

Test against a live target and a dead port:

```bash
bash health_check.sh google.com 443      # should log UP
bash health_check.sh localhost 19999     # should log DOWN, exit 1
echo "exit was: $?"
```

---

### Step 4 — Support multiple HOST:PORT targets

A real health check script usually checks a list:

```bash
main() {
    local failed=()

    for target in "$@"; do
        local host port
        host="${target%%:*}"
        port="${target##*:}"

        if ! check_tcp "$host" "$port"; then
            failed+=("$target")
        fi
    done

    if [[ ${#failed[@]} -gt 0 ]]; then
        log "FAILED targets: ${failed[*]}" >&2
        exit 1
    fi

    log "All ${#@} targets UP"
    exit 0
}

main "$@"
```

The `%%:*` strips everything from the first colon onwards (the host). The `##*:` strips everything up to and including the last colon (the port).

---

### Complete Script

```bash
#!/usr/bin/env bash
set -euo pipefail

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

usage() {
    echo "Usage: $0 HOST:PORT [HOST:PORT ...]" >&2
    exit 1
}

check_tcp() {
    local host="$1"
    local port="$2"

    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        log "ERROR: port must be a number, got: ${port}" >&2
        return 2
    fi

    local start end latency
    start=$(date +%s%3N)

    if timeout 3 bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
        end=$(date +%s%3N)
        latency=$(( end - start ))
        log "host=${host} port=${port} status=UP latency=${latency}ms"
        return 0
    else
        end=$(date +%s%3N)
        latency=$(( end - start ))
        log "host=${host} port=${port} status=DOWN latency=${latency}ms"
        return 1
    fi
}

main() {
    [[ $# -lt 1 ]] && usage

    local failed=()

    for target in "$@"; do
        local host="${target%%:*}"
        local port="${target##*:}"
        check_tcp "$host" "$port" || failed+=("$target")
    done

    if [[ ${#failed[@]} -gt 0 ]]; then
        log "FAILED: ${failed[*]}" >&2
        exit 1
    fi

    log "All $# targets UP"
}

main "$@"
```

---

### Sample Output

```
[2026-04-09T14:22:01Z] host=api.internal port=8080 status=UP latency=12ms
[2026-04-09T14:22:01Z] host=db.internal port=5432 status=UP latency=4ms
[2026-04-09T14:22:04Z] host=cache.internal port=6379 status=DOWN latency=3001ms
[2026-04-09T14:22:04Z] FAILED: cache.internal:6379
```

Exit code is 0 only if all targets passed.

---

### Common Mistakes

**Script exits immediately on the first DOWN host**

`set -e` causes any non-zero exit to abort the script. Your TCP check returning 1 kills the script before it prints DOWN. Fix: use `if` or append `|| failed+=("$target")` — the `||` is exempt from `set -e`.

**`timeout` not installed**

`timeout` is part of GNU coreutils. On macOS it may be `gtimeout` (via `brew install coreutils`). Fallback: use `nc -z -w3 host port`.

**Firewalled ports cause 3-second hangs for every check**

A DROP rule (rather than REJECT) means every check waits the full timeout. Increase timeout or use `nc -z -w3` which handles this more gracefully.

**Output mixed between stdout and stderr**

Errors go to stderr: `echo "error" >&2`. Log lines go to stdout. Callers capturing stdout to check for "UP" won't be confused by error messages.

---

### Extension Challenges

1. **Exit code severity**: Exit 0 if all pass, exit 1 if 1-50% fail, exit 2 if more than 50% fail.
2. **Retry on DOWN**: Add `--retries N` flag. Retry a DOWN target N times before reporting failure.
3. **Read targets from a file**: Accept `-f targets.txt` where each line is `HOST:PORT`. Skip blank lines and comments.
4. **JSON output**: Add `--json` flag for machine-readable output. Verify with `jq .`.
5. **Kubernetes Service check**: Resolve a Service's ClusterIP with `kubectl get svc ... -o jsonpath` and check that IP on the service port.

---

## Lab 2: Access Log Summary

### Operational Context

During an incident the first question is almost always "what is the error rate?" and the second is "which endpoint and which client?". When you're triaging a new service or a log file someone sent you, you need to extract this signal yourself in under two minutes — you can't always wait for a dashboard.

`awk`, `sort`, and `uniq -c` together form a log analysis toolkit that every SRE must use fluently. This lab builds a reusable script that produces the three most operationally useful summaries from an NGINX access log.

**Prerequisites**: `awk`, `sort`, `uniq` (standard on every Linux system).

**Time estimate**: 25–40 minutes core, +20–30 minutes for extensions.

---

### Step 1 — Understand the log format first

Never assume field positions. Print the first two lines and count fields manually:

```bash
head -2 /var/log/nginx/access.log
```

NGINX combined log format:

```
$remote_addr - $remote_user [$time_local] "$request" $status $bytes "$http_referer" "$http_user_agent"
```

Field positions (awk `$N` notation):

| Field | awk variable | Example value |
|-------|-------------|---------------|
| Client IP | `$1` | `10.0.0.11` |
| Timestamp | `$4 $5` | `[08/Apr/2026:10:00:01 +0000]` |
| HTTP method | `$6` | `"GET` |
| Request path | `$7` | `/api/v1/orders` |
| Protocol | `$8` | `HTTP/1.1"` |
| Status code | `$9` | `200` |
| Bytes sent | `$10` | `512` |

Verify your field mapping before trusting any counts:

```bash
awk '{print $9}' /var/log/nginx/access.log | head -5
# Should show: 200, 404, 500, etc.
```

---

### Step 2 — Count requests per status code

This is the fastest health check. Start here:

```bash
status_summary() {
    local log_file="$1"
    echo "=== Requests by Status Code ==="
    awk '{print $9}' "$log_file" \
        | sort \
        | uniq -c \
        | sort -rn \
        | awk '{printf "  %-6s %s\n", $2, $1}'
}
```

The final `awk` reformats output so status code comes first — `200    41` instead of `41 200`.

---

### Step 3 — Count requests per endpoint (top 10)

```bash
endpoint_summary() {
    local log_file="$1"
    echo "=== Top Endpoints by Request Count ==="
    awk '{print $7}' "$log_file" \
        | sort \
        | uniq -c \
        | sort -rn \
        | head -10 \
        | awk '{printf "  %-40s %s\n", $2, $1}'
}
```

Strip query strings if they clutter output:

```bash
awk '{split($7, a, "?"); print a[1]}' "$log_file" | sort | uniq -c | sort -rn | head -10
```

---

### Step 4 — Find IPs generating 5xx errors

The "who is hammering the broken endpoint" query:

```bash
error_clients() {
    local log_file="$1"
    echo "=== Top IPs with 5xx Responses ==="
    awk '$9 ~ /^5/ {print $1}' "$log_file" \
        | sort \
        | uniq -c \
        | sort -rn \
        | head -10 \
        | awk '{printf "  %-20s %s errors\n", $2, $1}'
}
```

`$9 ~ /^5/` means "status code starts with 5" — matches 500, 502, 503, 504.

---

### Complete Script

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: $0 LOG_FILE" >&2
    exit 1
}

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

status_summary() {
    local log_file="$1"
    echo "=== Requests by Status Code ==="
    awk '{print $9}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | awk '{printf "  %-6s %s\n", $2, $1}'
}

endpoint_summary() {
    local log_file="$1"
    echo "=== Top Endpoints by Request Count ==="
    awk '{split($7, a, "?"); print a[1]}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-40s %s\n", $2, $1}'
}

error_clients() {
    local log_file="$1"
    echo "=== Top IPs with 5xx Responses ==="
    awk '$9 ~ /^5/ {print $1}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-20s %s errors\n", $2, $1}'
}

main() {
    local log_file="${1:-}"

    [[ -z "$log_file" ]] && usage

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

---

### Sample Output

```
Log: /var/log/nginx/access.log  (62 lines)

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

=== Top IPs with 5xx Responses ===
  10.0.0.13            8 errors
  10.0.0.17            4 errors
  10.0.0.12            3 errors
```

---

### Common Mistakes

**Status codes printing as 0 or blank**: field positions shift if the log format differs. Always verify with `awk '{print NR, $9}' file | head -5`.

**`uniq -c` produces wrong counts**: `uniq -c` only collapses consecutive identical lines. Always `sort` before `uniq -c`. Pipeline must be: `| sort | uniq -c | sort -rn`.

**Empty 5xx output**: check whether 5xx lines actually exist: `grep ' 5[0-9][0-9] ' access.log | wc -l`.

**URLs with spaces causing field misalignment**: unusual but possible. If your logs have spaces in URLs, the field positions shift. Use a more careful parser.

---

### Extension Challenges

1. **Error rate percentage**: For each status class, print count and percentage of total.
2. **Time-window filter**: Accept `--from HH:MM --to HH:MM` and only analyze lines in that window.
3. **Response-size analysis**: Top 5 endpoints by total bytes transferred.
4. **Alert threshold**: `--max-error-rate N` flag — if 5xx percentage exceeds N, exit with code 2.

---

## Lab 3: Retry Wrapper with Guardrails

### Operational Context

Retry logic is everywhere in production: deployment scripts waiting for pods to become ready, health check loops polling until a service comes up, database migration scripts waiting for schema. Done badly, retry loops turn a transient blip into a prolonged incident — or worse, they amplify an overloaded system by hammering it.

This lab builds a general-purpose retry wrapper for any command. The key constraints that make retry safe:

1. Exponential backoff — each attempt waits longer than the last
2. Capped sleep — backoff doesn't grow unbounded
3. Attempt logging — every retry is visible
4. Exit code preservation — the real failure exit code is passed through

**Prerequisites**: `sleep`, `date` (standard). Understanding of `$?` and `$@`.

**Time estimate**: 30–45 minutes core, +30 minutes for extensions.

---

### Step 1 — Understand what you're wrapping

The wrapper must run any command the user passes after the script name. The user's command is everything in `$@`.

```bash
echo "Running: $*"
"$@"
echo "Exit code: $?"
```

Use `"$@"` (double-quoted with `@`), not `$*`. `"$@"` preserves argument boundaries. If the command is `grep "hello world" file.txt`, `"$@"` passes three arguments correctly. `$*` collapses them into one string.

---

### Step 2 — Add configurable attempt count and basic loop

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
    (( attempt++ ))
done
```

Test with a command that always fails:

```bash
bash retry.sh false
# should show 3 attempts, all failing

bash retry.sh echo hello
# should show 1 attempt, success
```

---

### Step 3 — Add exponential backoff with a cap

Linear sleep wastes time on slow failures and doesn't relieve pressure on an overwhelmed service. Exponential backoff doubles the wait each time:

```bash
max_sleep="${RETRY_MAX_SLEEP:-30}"
base_sleep=1

# Inside the loop, after a failure:
if [[ $attempt -lt $max_attempts ]]; then
    sleep_time=$(( base_sleep * (2 ** (attempt - 1)) ))
    [[ $sleep_time -gt $max_sleep ]] && sleep_time=$max_sleep
    # Add jitter to spread retriers
    sleep_time=$(( sleep_time + RANDOM % 3 ))
    echo "[attempt $attempt/$max_attempts] sleeping ${sleep_time}s before retry"
    sleep "$sleep_time"
fi
```

With `base_sleep=1`, `max_sleep=30`:

| Attempt | Sleep before next |
|---------|-------------------|
| 1       | 1s                |
| 2       | 2s                |
| 3       | 4s                |
| 4       | 8s                |
| 5       | 16s               |
| 6+      | 30s (capped)      |

---

### Step 4 — Preserve the failing exit code

When all retries are exhausted, the caller needs the real exit code from the failed command:

```bash
last_exit=1

while [[ $attempt -le $max_attempts ]]; do
    if "$@"; then
        exit 0
    fi
    last_exit=$?   # capture immediately — any subsequent command overwrites $?
    # ... backoff ...
    (( attempt++ ))
done

exit "$last_exit"
```

Test exit code preservation:

```bash
bash retry.sh bash -c 'exit 42'
echo "caller sees: $?"
# → caller sees: 42
```

---

### Complete Script

```bash
#!/usr/bin/env bash
set -euo pipefail

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

usage() {
    cat <<EOF
Usage: $0 [--max N] [--sleep S] [--max-sleep M] COMMAND [ARGS...]

  --max N        Max attempts (default: 3, env: RETRY_MAX)
  --sleep S      Base sleep seconds (default: 1)
  --max-sleep M  Max sleep cap in seconds (default: 30)

# SAFE to retry:
#   - Idempotent reads (HTTP GET, kubectl get)
#   - Health-check probes
#   - Waiting for a resource to become available
#
# DANGEROUS to retry without thought:
#   - HTTP POST / payment operations (risk of double-charge)
#   - Destructive operations (kubectl delete, terraform destroy)
#   - Already-overloaded services — retries amplify load
EOF
    exit 1
}

max_attempts="${RETRY_MAX:-3}"
base_sleep=1
max_sleep=30

# Parse optional flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max)       max_attempts="$2"; shift 2 ;;
        --sleep)     base_sleep="$2"; shift 2 ;;
        --max-sleep) max_sleep="$2"; shift 2 ;;
        -h|--help)   usage ;;
        *)           break ;;
    esac
done

[[ $# -lt 1 ]] && usage

attempt=1
last_exit=1

while [[ $attempt -le $max_attempts ]]; do
    log "[attempt $attempt/$max_attempts] running: $*"

    if "$@"; then
        if [[ $attempt -gt 1 ]]; then
            log "WARNING: succeeded after $attempt attempts — investigate retry rate"
        fi
        exit 0
    fi
    last_exit=$?

    log "[attempt $attempt/$max_attempts] failed with exit code $last_exit"

    if [[ $attempt -lt $max_attempts ]]; then
        sleep_time=$(( base_sleep * (2 ** (attempt - 1)) ))
        [[ $sleep_time -gt $max_sleep ]] && sleep_time=$max_sleep
        sleep_time=$(( sleep_time + RANDOM % 3 ))
        log "sleeping ${sleep_time}s before retry"
        sleep "$sleep_time"
    fi

    (( attempt++ ))
done

log "all $max_attempts attempts failed" >&2
exit "$last_exit"
```

---

### Sample Output

```
[2026-04-09T14:30:00Z] [attempt 1/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:00Z] [attempt 1/4] failed with exit code 7
[2026-04-09T14:30:00Z] sleeping 1s before retry
[2026-04-09T14:30:01Z] [attempt 2/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:01Z] [attempt 2/4] failed with exit code 7
[2026-04-09T14:30:01Z] sleeping 2s before retry
[2026-04-09T14:30:03Z] [attempt 3/4] running: curl -sf http://localhost:8080/healthz
[2026-04-09T14:30:03Z] [attempt 3/4] succeeded
```

---

### Common Mistakes

**`set -e` kills the script on first failure**: your `if "$@"; then` construct is exempt from `set -e` — use it. Never run the command bare inside a retry loop with strict mode.

**Arithmetic fails with `set -u`**: always initialize `attempt=1` and `last_exit=1` before the loop.

**Exit code is always 1 instead of the real code**: save `$?` immediately after the failed command. Any command between the failure and `last_exit=$?` overwrites `$?`.

**Retry loops hiding real problems**: if CI keeps succeeding on attempt 3 or 4, the real issue is being hidden. Monitor retry rate, not just final success.

**Tight retry loop hammering a recovering service**: always test with `--dry-run` or echo the command first. Never remove sleep for testing and forget to put it back.

---

### When NOT to Use This Wrapper

**Amplifying overload**: A service returning 503 is overwhelmed. Retrying immediately with 10 clients each retrying 3 times turns 10 requests into 30 at the worst possible moment. Use jitter (`RANDOM % N` added to sleep) to spread retries.

**Non-idempotent operations**: If your command creates a payment, sends an email, or modifies a record that can't be deduplicated, retrying causes double operations. Always ask: "if this runs twice, is that safe?"

**Cascading retry storms**: Retry loops in multiple layers of a stack combine: if each of three layers retries 3 times, a single failure triggers 27 attempts at the database layer.

---

### Extension Challenges

1. **Retry on specific exit codes only**: Add `--retry-on 7,22,28` — only retry if the command's exit code is in the list.
2. **Deadline mode**: Add `--deadline 60` — retry until the wall-clock deadline expires using `date +%s`.
3. **Dry-run flag**: Add `--dry-run` — prints command and backoff plan without running anything.
4. **Integrate with Lab 1**: Use `./retry.sh` to wrap `./health_check.sh` and wait until a service comes up after deployment.
