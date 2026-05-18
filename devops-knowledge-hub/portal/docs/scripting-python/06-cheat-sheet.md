---
title: "Cheat Sheet"
sidebar_position: 6
---

# Python SRE Cheat Sheet

Quick reference for the patterns used most often in SRE automation.

---

## Built-in Functions

```python
# Type conversion
int("42")          # 42
float("3.14")      # 3.14
str(42)            # "42"
bool(0)            # False
list((1, 2, 3))   # [1, 2, 3]
dict(a=1, b=2)    # {"a": 1, "b": 2}

# Iteration
len([1, 2, 3])           # 3
range(5)                  # 0 1 2 3 4
enumerate(["a","b"])      # (0,"a"), (1,"b")
zip([1,2], ["a","b"])     # (1,"a"), (2,"b")
sorted([3,1,2])           # [1, 2, 3]
sorted(pods, key=lambda p: p.restart_count, reverse=True)
reversed([1,2,3])         # iterator: 3 2 1
map(str, [1,2,3])        # ["1","2","3"]
filter(None, [1,0,2,None]) # [1, 2]
any([False, True, False]) # True
all([True, True, False])  # False
max([1,5,3])              # 5
min([1,5,3])              # 1
sum([1,2,3])              # 6
abs(-5)                    # 5
round(3.14159, 2)         # 3.14
type(42)                  # <class 'int'>
isinstance(42, int)        # True
hasattr(obj, "name")      # True/False
getattr(obj, "name", "default")
vars(obj)                 # obj.__dict__
dir(obj)                  # list of attributes
id(obj)                   # memory address
hash("string")            # integer hash
```

---

## String Operations

```python
s = "Hello, SRE World"

# f-strings (preferred)
name = "prod"
latency = 42.5
f"Cluster: {name}"
f"Latency: {latency:.1f}ms"
f"Hex: {255:#x}"           # 0xff
f"Zero-pad: {5:04d}"       # 0005
f"Align left: {name:<20}"  # "prod                "

# Methods
s.upper()             # "HELLO, SRE WORLD"
s.lower()             # "hello, sre world"
s.strip()             # remove leading/trailing whitespace
s.lstrip("H")         # "ello, SRE World"
s.rstrip()
s.split(", ")         # ["Hello", "SRE World"]
s.split("\n")         # split on newline
"  ".join(["a","b"]) # "a  b"
"\n".join(lines)      # join list into multi-line string
s.startswith("Hello") # True
s.endswith("World")   # True
s.replace("SRE", "DevOps")
s.find("SRE")         # 7 (index) or -1
"SRE" in s            # True
s.count("l")          # 3
s.encode("utf-8")     # bytes
b"bytes".decode("utf-8") # str

# Multiline
text = """\
line 1
line 2
"""
```

---

## Comprehensions

```python
# List comprehension
squares = [x**2 for x in range(10)]
errors = [r for r in records if r["level"] == "ERROR"]

# Dict comprehension
by_service = {r["service"]: r for r in records}
inverted = {v: k for k, v in original.items()}

# Set comprehension
unique_services = {r.get("service") for r in records}

# Generator expression (lazy — no brackets)
error_count = sum(1 for r in records if r.get("level") == "ERROR")
first_error = next((r for r in records if r.get("level") == "ERROR"), None)

# Nested comprehension
flat = [item for sublist in nested_list for item in sublist]

# With condition and transform
pod_names = [
    p.metadata.name.upper()
    for p in pods.items
    if p.status.phase == "Running"
]
```

---

## subprocess Patterns

```python
import subprocess

# Run and capture output — preferred pattern
result = subprocess.run(
    ["kubectl", "get", "pods", "-A", "-o", "json"],
    capture_output=True,
    text=True,
    timeout=30,
    check=True,           # raises CalledProcessError on non-zero exit
)
print(result.stdout)

# Without check — inspect manually
result = subprocess.run(["df", "-h", "/"], capture_output=True, text=True)
if result.returncode != 0:
    print(f"Error: {result.stderr}")

# Parse JSON output from kubectl
import json
result = subprocess.run(
    ["kubectl", "get", "pods", "-A", "-o", "json"],
    capture_output=True, text=True, timeout=30,
)
data = json.loads(result.stdout)
pods = data["items"]

# Run with stdin input
result = subprocess.run(
    ["kubectl", "apply", "-f", "-"],
    input=yaml_manifest_string,
    capture_output=True, text=True,
)

# Pipe two commands
ps = subprocess.run(["ps", "aux"], capture_output=True, text=True)
grep = subprocess.run(
    ["grep", "python"],
    input=ps.stdout, capture_output=True, text=True,
)

# Never do this (injection risk)
# subprocess.run(f"ls {user_dir}", shell=True)   # BAD

# Get just stdout as string, raise on error
output = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], text=True
).strip()
```

---

## requests Patterns

```python
import requests

# GET with timeout (always set timeout)
resp = requests.get("https://api.example.com/healthz", timeout=5)
resp.status_code          # 200
resp.headers              # dict
resp.text                 # string body
resp.json()               # parsed JSON
resp.content              # bytes body
len(resp.content)         # size in bytes

# POST with JSON body
resp = requests.post(
    "https://api.example.com/events",
    json={"type": "alert", "message": "disk full"},
    headers={"Authorization": f"Bearer {token}"},
    timeout=10,
)
resp.raise_for_status()   # HTTPError on 4xx/5xx

# Session — reuse TCP connection
session = requests.Session()
session.headers.update({"Authorization": f"Bearer {token}"})
session.mount("https://", requests.adapters.HTTPAdapter(
    max_retries=requests.adapters.Retry(total=3, backoff_factor=0.5)
))
resp = session.get("https://api.example.com/data", timeout=5)

# PATCH, PUT, DELETE
requests.patch(url, json=patch_body, timeout=5)
requests.put(url, data=form_data, timeout=5)
requests.delete(url, timeout=5)

# Query parameters
resp = requests.get(url, params={"namespace": "prod", "limit": 100}, timeout=5)

# Disable SSL verification (avoid in production)
resp = requests.get(url, verify=False, timeout=5)   # noqa: S501

# Exception handling
try:
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
except requests.exceptions.Timeout:
    print("timed out")
except requests.exceptions.ConnectionError:
    print("connection refused")
except requests.exceptions.HTTPError as exc:
    print(f"HTTP {exc.response.status_code}")
except requests.exceptions.RequestException as exc:
    print(f"request failed: {exc}")
```

---

## JSON Handling

```python
import json

# Parse string → dict
data = json.loads('{"service":"api","replicas":3}')

# Serialize dict → string
s = json.dumps(data, indent=2, sort_keys=True)

# Read from file
with open("config.json") as f:
    config = json.load(f)

# Write to file
with open("output.json", "w") as f:
    json.dump(data, f, indent=2)

# Pretty-print to stdout
print(json.dumps(data, indent=2))

# Handle datetime serialization
import datetime
def json_default(obj):
    if isinstance(obj, datetime.datetime):
        return obj.isoformat() + "Z"
    raise TypeError(f"Not serializable: {type(obj)}")
json.dumps({"ts": datetime.datetime.utcnow()}, default=json_default)
```

---

## YAML Handling

```python
import yaml

# Read single document
with open("deployment.yaml") as f:
    manifest = yaml.safe_load(f)   # always safe_load, never yaml.load

# Read multi-document (kubectl apply -f)
with open("manifests.yaml") as f:
    docs = list(yaml.safe_load_all(f))

# Parse from string
doc = yaml.safe_load("name: myapp\nversion: 1.0")

# Write to file
with open("output.yaml", "w") as f:
    yaml.dump(data, f, default_flow_style=False)

# Write multi-document
with open("multi.yaml", "w") as f:
    yaml.dump_all(docs, f, default_flow_style=False)

# Serialize to string
yaml_str = yaml.dump(data, default_flow_style=False)
```

---

## File and Path Patterns

```python
from pathlib import Path
import os

# Path construction
log_dir = Path("/var/log/myapp")
log_file = log_dir / "app.log"      # join with /

# Tests
log_file.exists()                    # bool
log_file.is_file()                   # bool
log_dir.is_dir()                     # bool

# Read/write
content = log_file.read_text(encoding="utf-8")
lines = content.splitlines()
log_file.write_text("content", encoding="utf-8")

# File properties
log_file.name          # "app.log"
log_file.stem          # "app"
log_file.suffix        # ".log"
log_file.parent        # Path("/var/log/myapp")

# Glob
for f in log_dir.glob("*.log"):
    print(f.name)

# Create directory
Path("/tmp/output").mkdir(parents=True, exist_ok=True)

# Temp files
import tempfile
with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
    yaml.dump(manifest, f)
    temp_path = f.name
# ... use temp_path ...
os.unlink(temp_path)   # clean up

# Iterate large file line by line (constant memory)
with open("/var/log/app.log", encoding="utf-8", errors="replace") as f:
    for line in f:
        process(line.rstrip("\n"))
```

---

## Environment Variables

```python
import os

# Read
val = os.environ.get("KEY")              # None if missing
val = os.environ.get("KEY", "default")  # with default
val = os.environ["KEY"]                  # KeyError if missing

# Set (current process only)
os.environ["MY_VAR"] = "value"

# Delete
os.environ.pop("MY_VAR", None)

# All env vars
for k, v in os.environ.items():
    print(f"{k}={v}")

# Load .env file (dev only)
from dotenv import load_dotenv
load_dotenv()  # reads .env file into os.environ
```

---

## Logging

```python
import logging
import sys

# Basic setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)

# Per-module logger
logger = logging.getLogger(__name__)
logger.debug("verbose detail")
logger.info("normal operation: %s", service_name)
logger.warning("degraded: %s", error)
logger.error("failed: %s", exc)
logger.critical("fatal: %s", exc)
logger.exception("unhandled exception")   # includes traceback

# Log levels (numeric)
# DEBUG=10, INFO=20, WARNING=30, ERROR=40, CRITICAL=50

# Set level dynamically
logging.getLogger().setLevel(logging.DEBUG)

# Structured JSON logging
import json, datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "ts": datetime.datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        })
```

---

## datetime Patterns

```python
import datetime

# Now (UTC — always use UTC in ops tooling)
now = datetime.datetime.now(datetime.timezone.utc)
now_str = now.isoformat()   # "2026-05-17T10:00:00+00:00"

# Parse ISO timestamp
ts = datetime.datetime.fromisoformat("2026-04-09T10:00:01Z".replace("Z", "+00:00"))

# Arithmetic
one_hour_ago = now - datetime.timedelta(hours=1)
thirty_min = datetime.timedelta(minutes=30)

# Compare
if ts >= now - datetime.timedelta(minutes=30):
    print("recent event")

# Format for display
now.strftime("%Y-%m-%d %H:%M:%S UTC")
```

---

## collections Patterns

```python
from collections import Counter, defaultdict, deque, OrderedDict

# Counter — count anything
counts = Counter(["a", "b", "a", "c", "a"])
counts.most_common(2)    # [("a", 3), ("b", 1)]
counts["a"]              # 3
counts["z"]              # 0 (not KeyError)

# defaultdict — auto-create missing keys
by_service = defaultdict(list)
for record in records:
    by_service[record["service"]].append(record)

# deque — efficient append/pop from both ends
recent = deque(maxlen=100)   # fixed-size ring buffer
recent.append(new_item)       # old items drop when full
```

---

## Error Handling Patterns

```python
import sys

# Specific exception — always preferred
try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    print(f"Invalid JSON: {exc}", file=sys.stderr)
    sys.exit(1)

# Multiple exceptions
try:
    connect()
except (ConnectionRefusedError, TimeoutError) as exc:
    print(f"Connection failed: {exc}", file=sys.stderr)

# Exception chaining (preserves original traceback)
try:
    result = fetch_config(url)
except requests.exceptions.RequestException as exc:
    raise RuntimeError(f"Failed to load config from {url}") from exc

# Finally — always runs
try:
    conn = open_connection()
    do_work(conn)
except Exception as exc:
    logger.error("work failed: %s", exc)
finally:
    conn.close()   # always cleaned up

# Suppress specific exceptions
import contextlib
with contextlib.suppress(FileNotFoundError):
    os.unlink("/tmp/stale.lock")
```

---

## Type Hints Quick Reference

```python
from typing import Optional, Union, Any
from collections.abc import Iterator, Generator, Callable

# Basic
def greet(name: str) -> str: ...
def count(items: list[str]) -> int: ...
def lookup(key: str) -> Optional[str]: ...   # str or None
def process(val: Union[str, int]) -> None: ...   # Python 3.9: str | int

# Callable
def apply(func: Callable[[str], bool], items: list[str]) -> list[str]:
    return [i for i in items if func(i)]

# Generator
def read_lines(path: str) -> Generator[str, None, None]:
    with open(path) as f:
        yield from f

# Dict with typed values
config: dict[str, str] = {}
```
