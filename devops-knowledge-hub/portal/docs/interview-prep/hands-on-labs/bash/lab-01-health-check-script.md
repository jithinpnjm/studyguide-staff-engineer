---
title: "Bash Lab 1: Health Check Script"
sidebar_position: 99
---

# Bash Lab 1: Health Check Script

## Operational Context

Every SRE team eventually writes a script that answers "is this thing up?" before a more
sophisticated monitoring stack exists — or as a fast sanity check during an incident when you
don't trust the dashboard. A health check script is one of the first tools you reach for when
a deployment just went out, a new environment is being bootstrapped, or a dependency is flaky
and you want to know *right now* whether it's reachable.

This lab teaches the fundamentals: argument handling, TCP-level reachability with a real
timeout, meaningful exit codes, and log lines that are useful in a pager alert or cron job
output. These patterns appear in every production automation script.

## Prerequisites

- Bash 4+
- `nc` (netcat) or `bash /dev/tcp` — both approaches are covered below
- Basic understanding of exit codes (0 = success, non-zero = failure)

## Time Estimate

30–45 minutes to complete the core script. Extensions add another 30 minutes.

---

## Step-by-Step Build Guide

### Step 1 — Get the scaffold running

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

### Step 2 — Replace the TODO with a real TCP check

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

### Step 3 — Add a timestamp to every log line

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

### Step 4 — Make the output operator-friendly

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

### Step 5 — Validate that port is a number

`/dev/tcp` will silently misbehave if port is not a number. Add a guard:

```bash
if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "error: port must be a number, got: ${port}" >&2
    exit 2
fi
```

Note the `>&2` — errors go to stderr, not stdout. This matters when callers capture stdout.

### Step 6 — Support multiple host:port pairs (optional but common)

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

## Sample Output

```
[2026-04-09T14:22:01Z] host=api.internal port=8080 status=UP latency=12ms
[2026-04-09T14:22:01Z] host=db.internal port=5432 status=UP latency=4ms
[2026-04-09T14:22:04Z] host=cache.internal port=6379 status=DOWN latency=3001ms
```

Exit code is 0 only if all targets passed. If any target is DOWN, exit code is 1.

---

## Common Mistakes and How to Debug Them

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

## Extension Challenges

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
