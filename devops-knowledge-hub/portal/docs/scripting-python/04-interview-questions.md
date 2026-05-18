---
title: "Interview Questions"
sidebar_position: 4
---

# Python Interview Questions for SRE

Twenty-five questions covering the GIL, concurrency, common gotchas, and what makes an ops tool production-grade. Answers are written for senior-level clarity.

---

## Language and Runtime

### Q1. What is the GIL and how does it affect SRE tooling?

The Global Interpreter Lock (GIL) is a mutex in CPython that allows only one thread to execute Python bytecode at a time. It exists to protect reference-counted memory management from concurrent modification.

**Impact on SRE work:**
- `ThreadPoolExecutor` is still effective for I/O-bound work (HTTP checks, subprocess calls, file I/O) because threads release the GIL while waiting for I/O.
- The GIL prevents true parallelism for CPU-bound work. Use `ProcessPoolExecutor` or `multiprocessing` for CPU-heavy tasks like parsing massive log files.
- `asyncio` avoids the GIL issue entirely because it runs on a single thread — concurrency comes from cooperative yielding, not preemption.

**In an interview:** Say "The GIL prevents CPU-bound parallelism in threads but doesn't block I/O concurrency, which is why `ThreadPoolExecutor` still works for health checkers."

---

### Q2. What is the difference between mutable and immutable types? What is the mutable default argument gotcha?

**Mutable:** `list`, `dict`, `set`, bytearray — can be changed in place.
**Immutable:** `str`, `int`, `float`, `tuple`, `frozenset`, `bytes` — cannot be changed.

**The gotcha:**

```python
# WRONG — the default list is created once and shared across all calls
def add_pod(pod: str, pods: list = []) -> list:
    pods.append(pod)
    return pods

add_pod("api-1")   # ["api-1"]
add_pod("api-2")   # ["api-1", "api-2"]  — unexpected!

# CORRECT — use None as sentinel and create a new list per call
def add_pod(pod: str, pods: list = None) -> list:
    if pods is None:
        pods = []
    pods.append(pod)
    return pods
```

This is one of the most common Python interview traps. The mutable default is evaluated once at function definition time.

---

### Q3. List vs Generator — when to use which?

| Aspect | List | Generator |
|---|---|---|
| Memory | Holds all items in memory | One item at a time |
| Reusable | Yes — iterate multiple times | No — exhausted after one pass |
| Random access | `items[5]` works | No random access |
| Speed | Faster for small data | Faster for large/infinite data |

```python
# List — fine for small results
pods = [p.metadata.name for p in v1.list_namespaced_pod("production").items]

# Generator — use for large log files
def parse_logs(path: str):
    with open(path) as f:
        for line in f:
            yield json.loads(line.strip())

# A generator expression
error_count = sum(1 for r in parse_logs("/var/log/app.log") if r.get("level") == "ERROR")
```

**Rule:** If you only need to iterate once and the data could be large, use a generator.

---

### Q4. async vs threading — when to use which?

| Pattern | Best for | Libraries |
|---|---|---|
| `asyncio` + `httpx` | High-concurrency I/O (100+ endpoints) | httpx, aiohttp, asyncpg |
| `ThreadPoolExecutor` | Blocking I/O libraries without async support | requests, paramiko, subprocess |
| `ProcessPoolExecutor` | CPU-bound work | anything |

```python
# asyncio — 100 probes run in ~1 × timeout (truly concurrent)
async def probe_all(urls):
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*[client.get(u, timeout=5) for u in urls])

# ThreadPoolExecutor — 10 probes run in ~1 × timeout (concurrent via GIL release)
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = [pool.submit(requests.get, u, timeout=5) for u in urls]
```

**In an interview:** "I use `asyncio` when I'm writing greenfield async code. I use threads when I'm wrapping libraries like `requests` or `paramiko` that don't support async natively."

---

### Q5. What does `shell=True` do and why is it dangerous?

When `shell=True`, `subprocess.run` passes the command string to `/bin/sh -c`. This means:
- Shell expansion, globbing, and variable substitution happen
- A user-supplied string can inject arbitrary shell commands

```python
# Dangerous — user input can escape
user_input = "file.txt; rm -rf /"
subprocess.run(f"cat {user_input}", shell=True)  # executes rm -rf /

# Safe — argument list, no shell
subprocess.run(["cat", user_input], shell=False)  # passes literal string
```

**Rule:** Use `shell=True` only when the command string is fully under your control and cannot contain user input.

---

### Q6. What is `*args` and `**kwargs`? Give an SRE example.

`*args` collects positional arguments into a tuple. `**kwargs` collects keyword arguments into a dict.

```python
def log_event(level: str, *messages: str, **context) -> None:
    import json, datetime
    record = {
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "level": level,
        "msg": " ".join(messages),
        **context,
    }
    print(json.dumps(record))

log_event("INFO", "Pod restarted", namespace="prod", pod="api-1", count=3)
# → {"ts":"...","level":"INFO","msg":"Pod restarted","namespace":"prod","pod":"api-1","count":3}
```

---

### Q7. What is a decorator and what are common SRE uses?

A decorator wraps a function to add behaviour. Common SRE uses:
- `@retry` — automatic retries with backoff
- `@timed` — log execution duration
- `@require_env("API_KEY")` — fail fast if required env vars are missing
- `@cached_property` — compute once, cache on the instance

```python
import functools, os

def require_env(*var_names):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            missing = [v for v in var_names if not os.environ.get(v)]
            if missing:
                raise EnvironmentError(f"Missing required env vars: {missing}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@require_env("SLACK_TOKEN", "PAGERDUTY_KEY")
def send_alert(message: str) -> None:
    ...
```

---

### Q8. Explain Python's exception hierarchy.

```
BaseException
├── SystemExit          (sys.exit())
├── KeyboardInterrupt   (Ctrl-C)
├── GeneratorExit       (generator close)
└── Exception           (all "normal" errors)
    ├── RuntimeError
    ├── ValueError
    ├── TypeError
    ├── OSError
    │   ├── FileNotFoundError
    │   └── PermissionError
    ├── ConnectionError
    └── ...
```

**Key points:**
- `except Exception` catches all normal errors but NOT `KeyboardInterrupt` or `SystemExit`
- `except BaseException` catches everything — use only in top-level crash handlers
- Catch specific before general: if `TimeoutError` is a subclass of `OSError`, catch `TimeoutError` first

---

### Q9. What is `__enter__` / `__exit__` and why does SRE tooling use context managers?

`with` calls `__enter__` before the block and `__exit__` after — even if an exception occurs. This guarantees cleanup.

```python
class TempFile:
    def __init__(self, suffix=".yaml"):
        self._suffix = suffix
        self._path = None

    def __enter__(self) -> str:
        import tempfile
        fd, self._path = tempfile.mkstemp(suffix=self._suffix)
        os.close(fd)
        return self._path

    def __exit__(self, *_):
        import os
        if self._path and os.path.exists(self._path):
            os.unlink(self._path)

with TempFile(".yaml") as path:
    write_manifest(path)
    subprocess.run(["kubectl", "apply", "-f", path], check=True)
# File is deleted here even if kubectl raised an exception
```

---

### Q10. What is a dataclass and how does it differ from a regular class?

`@dataclass` auto-generates `__init__`, `__repr__`, and optionally `__eq__` based on annotated fields. It removes boilerplate for data-carrying objects.

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class PodHealth:
    name: str
    namespace: str
    phase: str
    restart_count: int = 0
    error: Optional[str] = None
    labels: dict = field(default_factory=dict)

p = PodHealth("api-1", "prod", "Running")
print(p)   # PodHealth(name='api-1', namespace='prod', phase='Running', ...)
```

Use `@dataclass(frozen=True)` for immutable value objects (hashable, usable as dict keys).

---

## SRE-Specific Questions

### Q11. How do you handle secrets in Python scripts?

**Never hardcode.** Priority order:
1. Vault agent sidecar injecting secrets as env vars or files
2. Cloud-native secret manager via SDK (AWS SSM Parameter Store, GCP Secret Manager)
3. Kubernetes Secret mounted as env var or file
4. `os.environ["SECRET_NAME"]` — reads at runtime from the environment
5. `python-dotenv` for local development only — never in production

```python
import os, boto3

def get_db_password() -> str:
    # Option 1: Environment variable (simplest)
    if pw := os.environ.get("DB_PASSWORD"):
        return pw

    # Option 2: AWS SSM Parameter Store
    ssm = boto3.client("ssm", region_name="us-east-1")
    param = ssm.get_parameter(Name="/prod/db/password", WithDecryption=True)
    return param["Parameter"]["Value"]
```

---

### Q12. How do you make a Python script production-safe?

Six requirements:
1. **Structured JSON logging** — every log line is parseable
2. **Explicit timeouts** on all network calls
3. **Exponential backoff with jitter** on retries — bad retries amplify incidents
4. **Graceful SIGTERM handling** — finish in-flight work before exit
5. **Prometheus metrics** — latency, error rate, success count
6. **Linting and type checking in CI** — `ruff`, `mypy`

```python
import signal, sys, logging

logger = logging.getLogger(__name__)
_shutdown = False

def _handle_sigterm(sig, frame):
    global _shutdown
    logger.info("SIGTERM received — draining")
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_sigterm)

while not _shutdown:
    do_work()

logger.info("Clean shutdown complete")
sys.exit(0)
```

---

### Q13. When should you replace a Bash script with Python?

Replace Bash when:
- You need to parse JSON, YAML, or XML (never grep/awk structured data)
- Logic branches more than 2–3 levels deep
- You need retries with backoff
- The tool needs tests
- Multiple people will maintain it
- It calls multiple APIs
- You need meaningful error messages

Keep Bash for: `cp`, `rsync`, `find | xargs`, simple one-shot pipeline chaining.

---

### Q14. What are Python's common performance pitfalls?

| Pitfall | Fix |
|---|---|
| Quadratic string concat in a loop | `"".join(parts)` |
| Loading an entire 10GB log into memory | Iterate line by line / use a generator |
| `time.time()` for duration measurement | `time.monotonic()` (not affected by NTP) |
| `dict` lookups in a hot loop | Cache the value in a local variable |
| Creating objects in a tight loop | Pre-allocate or use `__slots__` |
| Unpickling untrusted data | Never — use JSON instead |

---

### Q15. Explain `time.monotonic()` vs `time.time()`.

`time.time()` returns wall-clock time. It can go backward or jump forward due to NTP sync, leap seconds, or system clock adjustments. **Never use it to measure durations.**

`time.monotonic()` always moves forward, is never affected by clock adjustments, and is specifically designed for measuring elapsed time.

```python
# Always do this for latency measurements
start = time.monotonic()
do_work()
elapsed_ms = int((time.monotonic() - start) * 1000)
```

---

### Q16. What is `collections.Counter` and when would you use it in SRE tooling?

`Counter` is a dict subclass optimised for counting. It provides `most_common(n)` which returns the N most frequent elements sorted descending — exactly what you need for incident summaries.

```python
from collections import Counter

def error_summary(records: list[dict]) -> None:
    counts = Counter(
        r.get("error_type", "(none)")
        for r in records
        if r.get("level") == "ERROR"
    )
    for error_type, count in counts.most_common(10):
        print(f"  {error_type:<30} {count}")
```

---

### Q17. What is `sys.exit()` and what are meaningful exit codes?

`sys.exit(n)` raises `SystemExit(n)`. The shell reads the exit code from `$?`.

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Incorrect usage (bad arguments) |
| Any other non-zero | Application-defined failure |

**Rule:** Always exit non-zero on failure. A probe that returns 0 whether it succeeded or failed is useless in CI and cron.

---

### Q18. What is the difference between `==` and `is`?

`==` checks value equality. `is` checks identity (same object in memory).

```python
a = [1, 2, 3]
b = [1, 2, 3]
print(a == b)   # True — same values
print(a is b)   # False — different objects

# Correct pattern
if value is None: ...     # use `is` for None
if value == "Running": ... # use `==` for values
```

**Gotcha:** Small integers (-5 to 256) and short strings are interned by CPython, so `is` may return `True` for them — but never rely on this.

---

### Q19. How does Python handle encoding? What is the `errors` parameter?

Python 3 strings are Unicode. When opening files, the default encoding is platform-dependent (usually UTF-8 on Linux). Log files from production systems may contain non-UTF-8 bytes.

```python
# errors="strict" — raises UnicodeDecodeError (default)
# errors="replace" — substitutes U+FFFD replacement character
# errors="ignore" — drops invalid bytes silently (dangerous — information loss)

# Safe for incident tooling:
with open("/var/log/app.log", encoding="utf-8", errors="replace") as f:
    for line in f:
        process(line)
```

---

### Q20. What is `pathlib.Path` and why prefer it over `os.path`?

`pathlib.Path` provides an object-oriented interface to filesystem paths. It is more readable, composable, and platform-safe than string manipulation with `os.path`.

```python
from pathlib import Path

log_dir = Path("/var/log/myapp")
log_file = log_dir / "app.log"         # path joining with /
print(log_file.suffix)                  # .log
print(log_file.stem)                    # app
print(log_file.exists())               # bool
content = log_file.read_text()         # read entire file
log_file.write_text("content")         # write entire file
for f in log_dir.glob("*.log"):        # glob
    print(f.name)
```

---

### Q21. What Python libraries are most important for SRE work?

| Library | Purpose |
|---|---|
| `requests` / `httpx` | HTTP calls |
| `pyyaml` | YAML parsing |
| `kubernetes` | Kubernetes API client |
| `boto3` | AWS SDK |
| `paramiko` | SSH automation |
| `psutil` | System resource monitoring |
| `prometheus_client` | Custom exporters |
| `subprocess` | Shell command execution |
| `argparse` | CLI argument parsing |
| `logging` | Structured logging |
| `concurrent.futures` | Parallel I/O |
| `asyncio` / `httpx` | Async I/O |

---

### Q22. What is a generator and how does it differ from a list comprehension?

A list comprehension `[expr for x in iterable]` produces a list eagerly (all values in memory). A generator expression `(expr for x in iterable)` produces a generator object that yields values lazily.

```python
# List — all 1,000,000 items in memory immediately
squares = [x**2 for x in range(1_000_000)]

# Generator — one item at a time, constant memory
squares = (x**2 for x in range(1_000_000))

# Use with sum(), any(), all(), max() — they stop early if possible
first_large = next(x for x in squares if x > 1000)
```

---

### Q23. How do you test an operational Python tool?

Use `pytest`. Key patterns for SRE tools:

```python
import pytest
from unittest.mock import patch, MagicMock

def test_is_healthy():
    assert is_healthy(200) is True
    assert is_healthy(204) is True
    assert is_healthy(500) is False

def test_probe_timeout(monkeypatch):
    """Mock requests to simulate a timeout."""
    import requests
    monkeypatch.setattr(requests, "get", MagicMock(side_effect=requests.exceptions.Timeout()))
    result = probe("https://example.com")
    assert result["ok"] is False
    assert "TIMEOUT" in result["status"]

def test_exit_code_on_failure():
    """Ensure the CLI exits non-zero when any probe fails."""
    with pytest.raises(SystemExit) as exc_info:
        main(["https://localhost:19999/unreachable"])
    assert exc_info.value.code != 0
```

---

### Q24. What is `functools.wraps` and why is it needed in decorators?

When you wrap a function, the wrapper replaces it — so `__name__`, `__doc__`, and other attributes come from the wrapper, not the original. `@functools.wraps(func)` copies these attributes from the original to the wrapper.

```python
def my_decorator(func):
    @functools.wraps(func)    # without this, func.__name__ would be "wrapper"
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@my_decorator
def fetch_metrics():
    """Fetch current metrics."""
    pass

print(fetch_metrics.__name__)   # "fetch_metrics" (correct)
print(fetch_metrics.__doc__)    # "Fetch current metrics." (correct)
```

---

### Q25. Senior summary: how do you describe your Python approach for SRE?

> I use Python when operational automation needs structure: APIs, structured parsing, retries, timeouts, tests, and maintainability. I design tools with clear JSON logging, explicit failures, safe subprocess usage, and predictable exit codes so they integrate cleanly with CI/CD and incident workflows. I know when to stay with Bash for simple command chaining and when Bash has become technical debt that needs a Python rewrite.
