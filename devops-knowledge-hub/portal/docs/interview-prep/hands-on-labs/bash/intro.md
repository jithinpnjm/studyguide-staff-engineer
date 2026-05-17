---
title: "Bash Labs"
sidebar_position: 0
---

# Bash Labs

These labs build the command-line fluency and safe automation habits that separate senior SRE engineers from those who just know commands. The focus is not on syntax — it is on writing scripts that behave correctly under failure conditions.

## Why This Track Matters Operationally

Bash is the language of the platform boundary. On-call engineers write Bash to check service health, parse logs, retry flaky commands, and build small automation tools. An SRE who cannot write safe, idiomatic Bash under pressure is exposed during incidents. These labs simulate exactly that pressure.

## Prerequisites

- Comfortable with basic shell commands: `curl`, `grep`, `awk`, `sed`, `cut`, `sort`, `wc`
- Understand exit codes and how `if`, `&&`, `||` use them
- Know what `set -e`, `set -u`, and `set -o pipefail` do and why they matter

Foundation reading: [../../foundations/03-bash-and-shell-scripting.md](../../foundations/03-bash-and-shell-scripting.md)

## Labs

1. [lab-01-health-check-script.md](lab-01-health-check-script.md) — Write a script that probes multiple endpoints and reports status clearly. Focus: idempotency, exit code discipline, readable output.
2. [lab-02-log-summary.md](lab-02-log-summary.md) — Parse a structured log file and produce a summary with error counts, top offenders, and rate-over-time. Focus: awk, sort, uniq, and clean output formatting.
3. [lab-03-retry-and-guardrails.md](lab-03-retry-and-guardrails.md) — Write a retry wrapper with backoff, timeout, and safe failure behavior. Focus: loops, sleep, signals, and preventing runaway automation.

## Starter Files

- [starter/health_check.sh](starter/health_check.sh)
- [starter/log_summary.sh](starter/log_summary.sh)
- [starter/retry.sh](starter/retry.sh)

## Learning Progression

**Beginner:** scripts that work in the happy path — correct output when everything succeeds.

**Intermediate:** scripts that handle failures explicitly — what happens when `curl` times out, when a file does not exist, when a command returns a non-zero exit code mid-pipeline.

**Advanced:** scripts that are safe to run in production automation — idempotent, guarded with `set -euo pipefail`, clear error messages, no silent data corruption from failed pipes.

## How To Use These Labs

1. Read the lab scenario and the starter file before writing anything.
2. Identify the failure cases that are not covered by the starter — list them explicitly.
3. Write the extension without looking at a solution.
4. Test it by simulating failures: kill the endpoint mid-run, pass a missing file, break a pipe.
5. Review whether your error messages would be useful at 3am during an incident.

## Tools You Need

- Any macOS or Linux shell (bash 4+ preferred; macOS ships bash 3 by default — install bash 5 via Homebrew if needed)
- `curl` for HTTP probing
- Standard GNU tools: `awk`, `grep`, `sed`, `sort`, `uniq`, `wc`
- A Linux VM or container for production-like command behavior if you want to test cgroup and signal behavior

## Success Criteria

After completing all three labs you should be able to:

- write a production-safe health check script from scratch in under 20 minutes
- parse a multi-field log file and produce a useful summary without looking up awk syntax
- write a retry loop that handles timeouts, backoff, and clean exit correctly
- explain what `set -o pipefail` prevents and give a real example where its absence caused a silent bug
