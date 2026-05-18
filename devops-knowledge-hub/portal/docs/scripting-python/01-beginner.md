---
title: "Beginner"
sidebar_position: 1
---

# Python Basics for SRE

Python is the language you reach for when Bash becomes too fragile. For SRE work it is less about algorithms and more about reliable automation: tools that call APIs, parse structured data, inspect systems, retry safely, log clearly, and fail predictably.

**Use Python when you need:**
- Structured data handling (JSON, YAML)
- API integration with timeouts and retries
- Complex branching logic
- Maintainable, testable automation
- Reusable internal tools

**Use Bash when you are mostly chaining commands. Use Python when logic becomes a program.**

---

## Setting Up Python

### Install on Linux (Debian/Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip -y
python3 --version
pip3 --version
```

### Install on Linux (Red Hat/CentOS)

```bash
sudo yum install python3 python3-pip -y
```

### Virtual Environments

```bash
# Create and activate (Linux)
python3 -m venv .venv
source .venv/bin/activate
deactivate

# Create and activate (Windows)
python -m venv .venv
.venv\Scripts\activate
deactivate
```

### Install Essential SRE Libraries

```bash
pip install requests pyyaml psutil kubernetes boto3 prometheus-client
pip install ruff mypy pytest  # dev tooling
```

---

## Data Types

Python's built-in types cover nearly every SRE automation need:

```python
# Scalar types
service = "checkout"          # str
replicas = 3                  # int
latency_ms = 245.7            # float
healthy = True                # bool

# Check types
print(type(replicas))         # <class 'int'>

# Type conversion
num_str = "10"
num_int = int(num_str)        # 10
x = 89
x_float = float(x)           # 89.0
```

---

## Data Structures

### Lists — ordered, mutable

```python
pods = ["api-1", "api-2"]
pods.append("api-3")
pods.remove("api-1")
print(pods[0])           # api-2
print(len(pods))         # 2
```

### Tuples — ordered, immutable

```python
coords = (10.0, 20.0)
# coords[0] = 5  # raises TypeError — tuples are immutable
host, port = ("db.internal", 5432)   # tuple unpacking
```

### Dictionaries — key-value pairs

```python
status = {"api-1": "Running", "api-2": "CrashLoopBackOff"}
print(status.get("api-3", "Unknown"))   # Unknown — safe default

# Iterating
for pod, state in status.items():
    print(f"{pod}: {state}")

# Update
status["api-3"] = "Pending"
```

### Sets — unordered, unique elements

```python
expected = {"a", "b", "c"}
actual   = {"a", "b"}
missing  = expected - actual    # {"c"}
extra    = actual - expected    # set()
```

### Comprehensions

```python
# List comprehension
healthy = [name for name, s in status.items() if s == "Running"]

# Dict comprehension
error_pods = {name: s for name, s in status.items() if s != "Running"}

# Set comprehension
namespaces = {pod.split("-")[0] for pod in pods}
```

---

## Variables and Assignment

```python
# Multiple assignment
namespace, pod, container = "prod", "api-7d9f", "web"

# Assign same value
a = b = c = 0

# Unpack from list
values = [1, 2, 3]
x, y, z = values

# f-strings (preferred for readability)
print(f"Checking {namespace}/{pod}")
print(f"Latency: {latency_ms:.1f}ms")
```

### Global vs Local Scope

```python
TIMEOUT = 30   # module-level constant (treat as global)

def check_service(url: str) -> bool:
    timeout = TIMEOUT   # reads global, no shadow issue
    # ...
    return True

def override_timeout(new_val: int) -> None:
    global TIMEOUT     # explicitly modify module-level
    TIMEOUT = new_val
```

---

## Control Flow

```python
# if / elif / else
status_code = 503
if 200 <= status_code < 300:
    state = "healthy"
elif status_code == 503:
    state = "degraded"
else:
    state = "unknown"

# for loop with range
for attempt in range(3):
    print(f"Attempt {attempt + 1}")

# for loop over collection
for pod in pods:
    print(pod)

# while loop
retries = 0
while retries < 5:
    retries += 1

# Loop control
for pod in pods:
    if pod.startswith("debug-"):
        continue          # skip debug pods
    if pod == "critical":
        break             # stop on critical pod
```

---

## Functions

Good operational tools are built from small, testable functions.

```python
# Basic function with type hints
def is_healthy(code: int) -> bool:
    return 200 <= code < 300

# Default arguments
def probe_url(url: str, timeout: float = 5.0) -> dict:
    import time, requests
    start = time.monotonic()
    try:
        resp = requests.get(url, timeout=timeout)
        return {
            "url": url,
            "status": resp.status_code,
            "ok": is_healthy(resp.status_code),
            "latency_ms": int((time.monotonic() - start) * 1000),
        }
    except Exception as exc:
        return {"url": url, "status": "ERROR", "ok": False, "detail": str(exc)}

# *args and **kwargs
def log_event(level: str, *messages: str, **context) -> None:
    import json, datetime
    record = {
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "level": level,
        "msg": " ".join(messages),
        **context,
    }
    print(json.dumps(record))

log_event("INFO", "Pod restarted", namespace="prod", pod="api-1")

# Lambda (use sparingly — prefer named functions for ops tooling)
is_error = lambda code: code >= 400
```

---

## File I/O

### Reading Files

```python
from pathlib import Path

path = Path("/var/log/app.log")
if path.exists():
    content = path.read_text()        # entire file as string
    lines = path.read_text().splitlines()

# Preferred for large files: iterate line by line
with open("/var/log/app.log") as f:
    for line in f:
        line = line.rstrip("\n")
        if "ERROR" in line:
            print(line)
```

### Writing Files

```python
# Write (overwrites)
with open("report.txt", "w") as f:
    f.write("Pod summary\n")
    f.write(f"Healthy pods: {len(healthy)}\n")

# Append
with open("report.txt", "a") as f:
    f.write("---\n")

# pathlib shortcut
Path("output.json").write_text('{"status": "ok"}')
```

### Encoding Safety

```python
# Always specify encoding when working with logs that may have non-ASCII chars
with open("/var/log/app.log", encoding="utf-8", errors="replace") as f:
    for line in f:
        process(line)
```

---

## Environment Variables

```python
import os

# Read — returns None if not set
db_password = os.environ.get("DB_PASSWORD")

# Read with default
log_level = os.environ.get("LOG_LEVEL", "INFO")

# Read required — raise if missing
api_key = os.environ["API_KEY"]   # KeyError if not set

# Set (for current process only)
os.environ["MY_VAR"] = "value"
```

---

## Subprocess

```python
import subprocess

# Run a command safely — prefer list form, not shell=True
result = subprocess.run(
    ["kubectl", "get", "pods", "-A", "-o", "json"],
    capture_output=True,
    text=True,
    timeout=30,
    check=True,        # raises CalledProcessError on non-zero exit
)
print(result.stdout)

# Without check — inspect manually
result = subprocess.run(["ls", "-l", "/tmp"], capture_output=True, text=True)
if result.returncode != 0:
    print(f"Error: {result.stderr}")
```

**Rules:**
- Prefer argument lists over `shell=True` (avoids injection and quoting issues)
- Always set `timeout` — a hung subprocess will hang your tool forever
- Use `capture_output=True` to collect stdout/stderr instead of letting it print
- Use `check=True` when a non-zero exit is always a fatal error

---

## argparse — CLI Arguments

```python
import argparse
import sys

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="HTTP health probe for SRE use",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("urls", nargs="+", help="URLs to probe")
    parser.add_argument(
        "--timeout", type=float, default=5.0,
        help="Request timeout in seconds (default: %(default)s)"
    )
    parser.add_argument(
        "--output", choices=["text", "json"], default="text",
        help="Output format"
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    return parser

def main() -> int:
    args = build_parser().parse_args()
    # use args.urls, args.timeout, args.output, args.verbose
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Good CLIs include:** help text, sane defaults, clear exit codes, readable output.

---

## requests Library Basics

```python
import requests

# GET with timeout (always set a timeout)
resp = requests.get("https://api.example.com/healthz", timeout=5)
print(resp.status_code)   # 200
print(resp.json())         # parsed JSON body

# POST with JSON body
resp = requests.post(
    "https://api.example.com/events",
    json={"type": "alert", "message": "disk 90% full"},
    headers={"Authorization": f"Bearer {token}"},
    timeout=10,
)
resp.raise_for_status()   # raises HTTPError on 4xx/5xx

# Session — reuse TCP connection across multiple requests
session = requests.Session()
session.headers.update({"Authorization": f"Bearer {token}"})
for url in urls:
    resp = session.get(url, timeout=5)
    print(resp.status_code)
```

---

## JSON and YAML

```python
import json

# Parse JSON string
raw = '{"service":"api","replicas":3}'
data = json.loads(raw)
print(data["replicas"])   # 3

# Read JSON file
with open("config.json") as f:
    config = json.load(f)

# Write JSON file
with open("output.json", "w") as f:
    json.dump({"status": "ok", "count": 42}, f, indent=2)

# Pretty-print to stdout
print(json.dumps(data, indent=2))
```

```python
import yaml

# Read YAML (use safe_load — never yaml.load without Loader)
with open("deployment.yaml") as f:
    manifest = yaml.safe_load(f)
print(manifest["kind"])   # Deployment

# Multi-document YAML (kubectl manifests)
with open("multi.yaml") as f:
    docs = list(yaml.safe_load_all(f))

# Write YAML
data = {"name": "myapp", "version": "1.0"}
with open("output.yaml", "w") as f:
    yaml.dump(data, f, default_flow_style=False)
```

---

## Error Handling Basics

```python
import sys

# Catch specific exceptions — never bare `except:`
try:
    data = json.loads(raw_input)
except json.JSONDecodeError as exc:
    print(f"Invalid JSON: {exc}", file=sys.stderr)
    sys.exit(1)
except FileNotFoundError:
    print("Config file missing", file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    # Broad catch as last resort — log the full exception
    print(f"Unexpected error: {exc}", file=sys.stderr)
    sys.exit(2)

# Exception hierarchy matters — catch specific before general
# requests.exceptions.Timeout is a subclass of requests.exceptions.RequestException
try:
    resp = requests.get(url, timeout=5)
except requests.exceptions.Timeout:
    print(f"{url}: timed out")
except requests.exceptions.ConnectionError:
    print(f"{url}: connection refused")
except requests.exceptions.RequestException as exc:
    print(f"{url}: request failed: {exc}")
```

**Rules:**
- Catch specific exceptions
- Add useful context in the message
- Exit non-zero on failure
- Never silently swallow errors

---

## Monitoring System Resources

```python
import psutil

print(f"CPU Usage:    {psutil.cpu_percent(interval=1):.1f}%")
print(f"Memory Usage: {psutil.virtual_memory().percent:.1f}%")
print(f"Disk Usage:   {psutil.disk_usage('/').percent:.1f}%")

# Per-process
for proc in psutil.process_iter(["pid", "name", "memory_percent"]):
    if proc.info["memory_percent"] > 10:
        print(f"PID {proc.info['pid']} {proc.info['name']}: {proc.info['memory_percent']:.1f}%")
```

---

## Bash vs Python Judgment

| Use Bash | Use Python |
|---|---|
| Command chaining | Complex logic |
| One-liners | Reusable tool |
| Text streams | JSON / YAML / API data |
| Quick runbooks | Tests and packaging |
| Shell-native ops | Structured errors and retries |

Senior engineers know when Bash has become technical debt.
