---
title: "Bash Lab 3: Retry Wrapper With Guardrails"
sidebar_position: 99
---

# Bash Lab 3: Retry Wrapper With Guardrails

## Operational Context

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

## Prerequisites

- `sleep`, `date` — standard on every Linux system
- Understanding of `$?` (last exit code) and `$@` (all arguments)
- A simple command to test with: `curl`, `wget`, or even `false`

## Time Estimate

30–45 minutes for the core wrapper. Extensions add 30 minutes.

---

## Step-by-Step Build Guide

### Step 1 — Understand what you're wrapping

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

### Step 2 — Add configurable attempt count and basic retry loop

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

### Step 3 — Add exponential backoff with a cap

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

### Step 4 — Preserve the failing exit code

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

### Step 5 — Add a timestamp to each log line

In automation, bare echo output is hard to correlate with other events. Add a timestamp:

```bash
log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}
```

Replace all `echo` calls inside the retry logic with `log`.

### Step 6 — Add guardrail commentary (important for interviews)

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

## Sample Output

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

## Common Mistakes and How to Debug Them

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

## When NOT to Use This Wrapper

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

## Extension Challenges

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
