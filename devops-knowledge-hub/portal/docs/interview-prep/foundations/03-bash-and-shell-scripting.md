---
title: "Foundations: Bash Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 3
---

# Foundations: Bash Premium Teaching Guide For SRE And Platform Engineers

Bash is the control language of Linux operations. It glues commands together, automates repetitive work, and helps you debug production quickly.

If Linux is the operating foundation, Bash is the hand tool you carry every day.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — terminal fluency, variables, quoting, exit codes.
2. **Intermediate Layer** — pipes, text processing, functions, JSON/API workflows.
3. **Advanced Layer** — strict mode, traps, retries, idempotency, parallelism.
4. **Production SRE Layer** — triage one-liners, runbook scripts, safety patterns.
5. **Interview Layer** — explain when Bash is right and when to switch to Python.

---

# Memory Palace: Bash Is A Toolbox

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

# Beginner Layer: What Bash Actually Is

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

# Beginner Layer: Terminal Fluency

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

# Beginner Layer: Variables And Quoting

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

# Beginner Layer: Exit Codes

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

# Intermediate Layer: Safe Script Foundation

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

# Intermediate Layer: Conditionals, Loops, Functions

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

# Intermediate Layer: Pipes And Text Processing

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

# Intermediate Layer: JSON And APIs

Modern operations use JSON everywhere.

```bash
kubectl get pods -o json | jq '.items[].metadata.name'
curl -s https://api.example.com/status | jq '.status'
```

Use `jq` instead of fragile grep/sed parsing for JSON.

---

# Advanced Layer: Traps And Cleanup

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

# Advanced Layer: Retry With Backoff

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

# Advanced Layer: Idempotency

Idempotent scripts can run more than once safely.

```bash
mkdir -p /opt/app
cp -n config /opt/app/
```

Production automation should prefer idempotency over “run once and hope.”

---

# Advanced Layer: Safe Deletes

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

# Advanced Layer: Parallelism

```bash
for host in app1 app2 app3; do
  ssh "$host" uptime &
done
wait
```

Parallelism is powerful, but add limits for large fleets. Unbounded parallel SSH can create an incident.

---

# Production SRE Layer: Useful One-Liners

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

# Production SRE Layer: Real Incidents

## Log Disk Full

Check:

```bash
find /var/log -type f -size +500M
lsof +L1
```

## Service Down On Many Hosts

```bash
for h in app1 app2 app3; do
  ssh "$h" systemctl is-active myapp || echo "$h failed"
done
```

## API Returning 500

```bash
curl -vk https://api.example.com/health
tail -f /var/log/app.log
```

## Cleanup Script Deleted Too Much

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

# Bash vs Python Judgment

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

# Interview Layer: Strong Answers

## Why `set -euo pipefail`?

> It reduces silent failures by failing on unhandled errors, unset variables, and failed pipeline components.

## Why quote variables?

> To avoid accidental word splitting, glob expansion, and dangerous path handling.

## When replace Bash with Python?

> When logic, data structures, error handling, and maintainability outgrow shell orchestration.

## How safely run commands on many hosts?

> Limit concurrency, log results per host, handle timeouts, avoid broad destructive commands, and prefer orchestration tools for repeated fleet work.

---

# Labs

## Beginner

1. Write backup script.
2. Parse small log file.
3. Use variables and conditionals.

## Intermediate

1. Health-check multiple URLs.
2. Summarize nginx logs.
3. Process JSON with jq.

## Advanced

1. Retry wrapper with backoff.
2. Safe cleanup script with dry-run.
3. Parallel host checker with concurrency limit.
4. Deploy script with rollback hook.

---

# Memory Review

- Why is quoting variables important?
- Why does pipefail matter?
- When is jq safer than grep?
- Why use trap cleanup EXIT?
- When should Bash become Python?

---

# Senior Summary

> I use Bash for fast, composable operational tasks close to the OS. I make scripts safer with strict mode, quoting, traps, idempotency, bounded retries, and guardrails around destructive operations. When logic becomes complex or long-lived, I switch to Python.
