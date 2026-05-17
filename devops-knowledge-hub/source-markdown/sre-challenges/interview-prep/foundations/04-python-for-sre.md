# Foundations: Python Premium Teaching Guide For SRE And Platform Engineers

Python is the language you reach for when Bash becomes too fragile.

For SRE work, Python is less about algorithms and more about reliable automation: tools that call APIs, parse structured data, inspect systems, retry safely, log clearly, and fail predictably.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — syntax, data structures, files, functions.
2. **Intermediate Layer** — JSON/YAML, subprocess, HTTP APIs, logging, exceptions.
3. **Advanced Layer** — retries, concurrency, CLIs, tests, packaging, type hints.
4. **Production SRE Layer** — Kubernetes/cloud automation, health tools, incident scripts.
5. **Interview Layer** — explain when Python beats Bash and how to build maintainable ops tools.

---

# Memory Palace: Operations Workshop

| Python Concept | Workshop Analogy | Meaning |
|---|---|---|
| Script | Procedure card | Repeatable automation |
| Function | Specialized tool | Reusable logic |
| Module | Toolbox drawer | Related code grouped |
| Exception | Alarm light | Failure path |
| Logger | Audit camera | What happened |
| CLI | Control panel | Operator interface |
| Test | Safety check | Prevent regressions |
| Package | Tool kit shipment | Reusable distribution |

---

# Beginner Layer: Why Python For SRE

Use Python when you need:

- structured data handling
- API integration
- complex branching logic
- maintainable automation
- tests
- retries and timeouts
- reusable internal tools

Use Bash when you are mostly chaining commands.

Use Python when logic becomes a program.

---

# Beginner Layer: Core Syntax

```python
service = "checkout"
replicas = 3
healthy = True
latency_ms = 245.7
```

Strings and f-strings:

```python
namespace = "prod"
pod = "api-7d9f"
print(f"Checking {namespace}/{pod}")
```

---

# Beginner Layer: Data Structures

Lists:

```python
pods = ["api-1", "api-2"]
pods.append("api-3")
```

Dictionaries:

```python
status = {"api-1": "Running", "api-2": "CrashLoopBackOff"}
print(status.get("api-3", "Unknown"))
```

Sets:

```python
expected = {"a", "b", "c"}
actual = {"a", "b"}
missing = expected - actual
```

Comprehension:

```python
healthy = [n for n, s in status.items() if s == "Running"]
```

---

# Beginner Layer: Functions

```python
def is_healthy(code: int) -> bool:
    return 200 <= code < 300
```

Good operational tools are built from small testable functions.

---

# Intermediate Layer: Files And Paths

```python
from pathlib import Path

path = Path("/var/log/app.log")
if path.exists():
    print(path.read_text()[:500])
```

Prefer `pathlib` over fragile string path handling.

---

# Intermediate Layer: JSON And YAML

```python
import json
raw = '{"service":"api","replicas":3}'
data = json.loads(raw)
```

```python
import yaml
manifest = yaml.safe_load(Path("deployment.yaml").read_text())
print(manifest["kind"])
```

Use real parsers, not regex hacks.

---

# Intermediate Layer: Exceptions And Exit Codes

```python
import sys
from pathlib import Path

try:
    data = Path("config.json").read_text()
except FileNotFoundError:
    print("config missing")
    sys.exit(1)
```

Rules:

- catch specific exceptions
- add useful context
- exit non-zero on failure
- never silently swallow errors

---

# Intermediate Layer: Logging Like An Operator

```python
import logging
logging.basicConfig(level=logging.INFO,
 format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
logger.info("starting check")
```

Logs should answer:

- what happened?
- when?
- against what target?
- what action was taken?

---

# Intermediate Layer: Running Commands Safely

```python
import subprocess

result = subprocess.run(
    ["kubectl", "get", "pods", "-A", "-o", "json"],
    capture_output=True,
    text=True,
    timeout=30,
    check=True,
)
```

Prefer argument lists.

Avoid `shell=True` unless fully controlled.

---

# Intermediate Layer: HTTP APIs With Timeouts

```python
import urllib.request
with urllib.request.urlopen("https://example.com", timeout=5) as resp:
    print(resp.status)
```

Every network call needs a timeout.

---

# Advanced Layer: Retries With Backoff

```python
import time
for attempt in range(3):
    try:
        break
    except Exception:
        time.sleep(2 ** attempt)
```

Better production retries use:

- max attempts
- jitter
- timeout per attempt
- retry only transient errors

Bad retries amplify incidents.

---

# Advanced Layer: Concurrency

Use threads for many network checks.

```python
from concurrent.futures import ThreadPoolExecutor
```

Use processes for CPU-heavy tasks.

Do not create unlimited workers.

---

# Advanced Layer: Dataclasses And Types

```python
from dataclasses import dataclass

@dataclass
class CheckResult:
    target: str
    ok: bool
    latency_ms: float
```

Type hints help readability and tooling.

---

# Advanced Layer: Building CLIs

```python
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("url")
args = parser.parse_args()
```

Good CLIs include:

- help text
- sane defaults
- clear exit codes
- readable output

---

# Advanced Layer: Testing

```python
def is_success(code: int) -> bool:
    return 200 <= code < 300

def test_is_success():
    assert is_success(200)
```

Use tests when tools can affect production.

---

# Production SRE Layer: Real Incidents

## Bash Script Became Unmaintainable

Symptoms:

- nested conditions
- JSON parsed with grep
- no tests

Fix:

Rewrite as Python CLI with modules and tests.

## Health Checker Hung During Incident

Cause:

- no timeout

Fix:

Every network call gets timeout and bounded retries.

## Need Fast Kubernetes Audit

Python can summarize pod states, restarts, image drift, or namespace health quickly.

```python
import json, subprocess
raw = subprocess.run([
 "kubectl","get","pods","-A","-o","json"
], capture_output=True, text=True).stdout
data = json.loads(raw)
print(len(data["items"]))
```

---

# Production SRE Layer: Tool Design Principles

Build tools that are:

- idempotent where possible
- timeout aware
- observable with logs
- safe by default
- configurable
- testable
- easy to run in CI/CD

---

# Bash Vs Python Judgment

| Use Bash | Use Python |
|---|---|
| command chaining | complex logic |
| one-liners | reusable tool |
| text streams | JSON/YAML/API data |
| quick runbooks | tests/packaging |
| shell-native ops | structured errors |

Senior engineers know when Bash has become technical debt.

---

# Interview Layer: Strong Answers

## When replace Bash with Python?

> When workflows need structure, parsing, retries, tests, maintainability, or reusable interfaces.

## Why are timeouts mandatory?

> A tool that can hang forever is dangerous during incidents and automation runs.

## Why avoid `shell=True`?

> It increases injection and quoting risks and makes argument handling less safe.

## What makes an ops tool production-grade?

> Clear logging, explicit failures, timeouts, retries, tests, and safe defaults.

---

# Labs

## Beginner

1. Read file and count errors.
2. Parse JSON.
3. Write simple CLI.

## Intermediate

1. Call HTTP endpoint with timeout.
2. Run kubectl and parse JSON.
3. Summarize pod states.

## Advanced

1. Add retry/backoff.
2. Parallel health checks.
3. Add tests.
4. Package as installable CLI.

---

# Memory Review

- Why is Python better than Bash for JSON-heavy work?
- Why should every network call have a timeout?
- Why is shell=True risky?
- What makes retries dangerous?
- What makes an SRE tool maintainable?

---

# Senior Summary

> I use Python when operational automation needs structure: APIs, structured parsing, retries, timeouts, tests, and maintainability. I design tools with clear logging, explicit failures, safe subprocess usage, and predictable exit codes so they integrate cleanly with CI/CD and incident workflows.
