---
title: "Troubleshooting"
sidebar_position: 8
---

# Troubleshooting: Python for SRE

Ten runbooks for the errors and failure modes that appear most often in production Python automation. Each section covers how to reproduce and diagnose the issue, what causes it, and the correct fix pattern.

---

## 1. Encoding Errors (UnicodeDecodeError, bytes vs str)

### Symptom

Script crashes reading a log file, API response, or subprocess output that contains non-ASCII characters. Error message includes `'utf-8' codec can't decode byte 0x...`.

```
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe2 in position 47: invalid continuation byte
```

### Diagnosis

```python
import sys

# Find where encoding is assumed
# Common sources: open(), subprocess stdout, requests, json.loads on bytes

# Check what type you actually have
raw = b"\xe2\x80\x94"        # bytes
text = "em dash —"      # str
print(type(raw))              # <class 'bytes'>
print(type(text))             # <class 'str'>

# Identify the encoding
import chardet
detected = chardet.detect(raw)
print(detected)               # {'encoding': 'utf-8', 'confidence': 0.99}
```

### Fix

```python
# Reading files — always specify encoding and error handling
with open("/var/log/app.log", encoding="utf-8", errors="replace") as f:
    for line in f:
        process(line)

# errors="replace" substitutes replacement character (U+FFFD) for bad bytes
# errors="ignore"  silently drops bad bytes
# errors="surrogateescape"  round-trips bad bytes (useful for filenames)

# subprocess — text=True uses default locale; be explicit
import subprocess
result = subprocess.run(
    ["kubectl", "logs", "pod/myapp"],
    capture_output=True,
    encoding="utf-8",
    errors="replace",    # don't crash on bad bytes in log output
)

# requests — response.text uses declared charset; response.content is bytes
import requests
resp = requests.get("https://api.example.com/data", timeout=10)
# Explicit decode:
text = resp.content.decode("utf-8", errors="replace")
# Or rely on requests' detected encoding:
resp.encoding = "utf-8"
text = resp.text

# json.loads accepts str or bytes (Python 3.6+)
import json
# Both work:
data = json.loads(b'{"key": "value"}')   # bytes — ok
data = json.loads('{"key": "value"}')    # str — ok
# Problem: bytes with BOM
data = json.loads(raw_bytes.decode("utf-8-sig"))  # strips BOM

# Converting between bytes and str consistently
def safe_decode(data: bytes, encoding: str = "utf-8") -> str:
    return data.decode(encoding, errors="replace")

def safe_encode(text: str, encoding: str = "utf-8") -> bytes:
    return text.encode(encoding, errors="replace")
```

---

## 2. Import Errors and Circular Imports

### Symptom

`ImportError: cannot import name 'X' from 'Y'` or `ModuleNotFoundError: No module named 'X'`. The module is installed but still not found. Or modules that work in isolation fail when combined.

```
ModuleNotFoundError: No module named 'yaml'
ImportError: cannot import name 'Config' from partially initialized module 'myapp.config'
```

### Diagnosis

```python
# Find which Python / site-packages is active
import sys
print(sys.executable)         # which python binary
print(sys.path)               # search path list
print(sys.prefix)             # environment root

# Check if the package is installed in this environment
import importlib
spec = importlib.util.find_spec("yaml")
print(spec)                   # None if not found

# From the shell — verify environment
# which python3
# python3 -m pip show pyyaml
# python3 -c "import yaml; print(yaml.__version__)"

# Diagnose circular import — add temporary prints
# In module A:
print(f"Loading A from {__file__}")
# In module B:
print(f"Loading B from {__file__}")
# Watch the order in the traceback
```

### Fix

```python
# Fix: virtual environment — always activate before running
# python3 -m venv .venv
# source .venv/bin/activate
# pip install -r requirements.txt

# Fix: run as a module, not a file (fixes sys.path issues)
# python3 -m mypackage.script    (correct)
# python3 mypackage/script.py    (can break relative imports)

# Fix: circular imports — restructure to break the cycle

# Pattern 1: move shared code to a third module
# Before: A imports B, B imports A
# After:  A imports common, B imports common

# Pattern 2: defer the import inside the function
# Instead of top-level import that creates a cycle:
def get_config():
    from myapp.config import Config   # deferred — breaks cycle
    return Config()

# Pattern 3: import the module, not the name
import myapp.config                   # module reference, no cycle
cfg = myapp.config.Config()

# Fix: sys.path manipulation (last resort, prefer packaging)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fix: __init__.py imports causing cycles — move logic out of __init__.py
# Instead of importing everything in __init__.py, let callers import directly
from mypackage.utils import helper    # specific import
```

---

## 3. Memory Leaks — Finding with tracemalloc, gc Module

### Symptom

A long-running script or service consumes ever-increasing memory. Resident set size grows without bound. Eventually killed by OOM.

### Diagnosis

```python
import tracemalloc
import gc

# Enable tracemalloc at program start
tracemalloc.start()

# ... run the code under suspicion ...

# Snapshot comparison — take two snapshots and compare
snapshot1 = tracemalloc.take_snapshot()

# ... run more iterations ...

snapshot2 = tracemalloc.take_snapshot()

top_stats = snapshot2.compare_to(snapshot1, "lineno")
print("Top memory differences:")
for stat in top_stats[:10]:
    print(stat)

# Or: single snapshot to find current top allocators
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics("lineno")
for stat in top_stats[:10]:
    print(stat)

# Find reference cycles
gc.collect()
if gc.garbage:
    print(f"Uncollectable: {len(gc.garbage)} objects")
    for obj in gc.garbage[:5]:
        print(type(obj), repr(obj)[:100])
```

### Common Leak Patterns and Fixes

```python
# Pattern 1: unbounded cache (most common)
# Bug: dict grows forever
_cache = {}
def get_value(key):
    if key not in _cache:
        _cache[key] = expensive_fetch(key)
    return _cache[key]

# Fix: use functools.lru_cache with maxsize
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_value(key):
    return expensive_fetch(key)

# Or: use a bounded structure
from collections import OrderedDict
class BoundedCache:
    def __init__(self, maxsize=1000):
        self._cache = OrderedDict()
        self._maxsize = maxsize
    def get(self, key):
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None
    def set(self, key, value):
        self._cache[key] = value
        self._cache.move_to_end(key)
        if len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)


# Pattern 2: closures holding references
# Bug: event handler closure holds reference to large object
def register_handlers(large_data):
    def handler(event):
        process(large_data)   # large_data never released
    subscribe(handler)        # subscription lives forever

# Fix: use weakref or pass only what you need
import weakref
def register_handlers(large_data):
    ref = weakref.ref(large_data)
    def handler(event):
        data = ref()
        if data is not None:
            process(data)
    subscribe(handler)


# Pattern 3: global state accumulating across requests
# Bug: module-level list grows in a long-running process
errors = []    # module global
def handle_request(req):
    try:
        process(req)
    except Exception as exc:
        errors.append(str(exc))    # never cleared

# Fix: use a bounded deque or clear periodically
from collections import deque
errors: deque = deque(maxlen=1000)   # automatically drops old entries


# Pattern 4: open file handles / connections not closed
# Bug: file handle leaked
def read_config(path):
    f = open(path)
    return f.read()   # f never closed if exception occurs

# Fix: always use context manager
def read_config(path):
    with open(path, encoding="utf-8") as f:
        return f.read()
```

---

## 4. Async Pitfalls — Blocking Calls, Event Loop Errors, Nested asyncio.run()

### Symptom

`RuntimeError: This event loop is already running`. Application hangs. Coroutines that should run concurrently execute sequentially. `asyncio.run()` called from within an async function.

### Diagnosis

```python
import asyncio

# Check if an event loop is running
try:
    loop = asyncio.get_running_loop()
    print(f"Loop running: {loop}")
except RuntimeError:
    print("No running loop")

# Find blocking calls — use asyncio's debug mode
import os
os.environ["PYTHONASYNCIODEBUG"] = "1"
# Logs a warning for any coroutine or callback that blocks > 100ms

# Or set it programmatically
asyncio.get_event_loop().slow_callback_duration = 0.05   # 50ms threshold
```

### Fix

```python
# Fix 1: never call asyncio.run() inside an async function
# Bug:
async def outer():
    result = asyncio.run(inner())   # RuntimeError: event loop already running

# Fix:
async def outer():
    result = await inner()          # await, don't run

# Fix 2: blocking I/O in async context — run in executor
import asyncio
import requests   # synchronous library

async def fetch_data(url: str) -> dict:
    loop = asyncio.get_running_loop()
    # Run blocking call in thread pool
    response = await loop.run_in_executor(
        None,                          # default ThreadPoolExecutor
        lambda: requests.get(url, timeout=10).json()
    )
    return response

# Better: use an async HTTP library
import httpx
async def fetch_data(url: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


# Fix 3: running async from sync context when loop may already exist
# Use asyncio.get_event_loop().run_until_complete() carefully, or:
import asyncio

def run_async(coro):
    """Run a coroutine from sync code safely."""
    try:
        loop = asyncio.get_running_loop()
        # Already in async context — cannot call run_until_complete
        # Schedule as a task instead
        return loop.create_task(coro)
    except RuntimeError:
        return asyncio.run(coro)


# Fix 4: concurrent tasks — don't await sequentially
# Bug: sequential despite being async
async def check_all(urls):
    results = []
    for url in urls:
        result = await check(url)   # waits for each before starting next
        results.append(result)
    return results

# Fix: use gather for true concurrency
async def check_all(urls):
    tasks = [check(url) for url in urls]
    return await asyncio.gather(*tasks, return_exceptions=True)

# Fix 5: event loop closed errors in tests or scripts
# Use asyncio.run() as the single entry point; avoid creating loops manually
async def main():
    await do_work()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 5. subprocess Deadlocks — stdout and stderr, communicate() vs wait()

### Symptom

Script hangs indefinitely on `proc.wait()` or when reading from `proc.stdout`. The subprocess appears to be running but never finishes.

### Diagnosis

The classic deadlock: your code reads from `stdout` while the subprocess's `stderr` pipe fills up (default pipe buffer is ~64KB on Linux). The subprocess blocks on writing stderr; your code blocks on reading stdout. Neither can proceed.

```python
import subprocess

# Bug: deadlock if stderr generates > 64KB of output
proc = subprocess.Popen(
    ["long_running_cmd"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
stdout = proc.stdout.read()   # blocks if stderr buffer full
proc.wait()                    # never reached
```

### Fix

```python
import subprocess

# Fix 1: use communicate() — handles both streams concurrently
proc = subprocess.Popen(
    ["kubectl", "apply", "-f", "manifest.yaml"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
stdout, stderr = proc.communicate(timeout=60)   # reads both safely
if proc.returncode != 0:
    raise subprocess.CalledProcessError(proc.returncode, proc.args, stdout, stderr)

# Fix 2: use subprocess.run() — preferred for most cases
result = subprocess.run(
    ["kubectl", "apply", "-f", "manifest.yaml"],
    capture_output=True,
    text=True,
    timeout=60,
    check=True,      # raises CalledProcessError on non-zero exit
)
print(result.stdout)

# Fix 3: merge stderr into stdout (for commands where you want all output)
result = subprocess.run(
    ["make", "build"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,   # merge stderr into stdout pipe
    text=True,
    timeout=300,
)

# Fix 4: stream output line by line (for long-running commands)
import sys
proc = subprocess.Popen(
    ["long_running_build"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,   # merge to avoid deadlock
    text=True,
    bufsize=1,                  # line-buffered
)
for line in proc.stdout:
    sys.stdout.write(line)
    sys.stdout.flush()
proc.wait()
if proc.returncode != 0:
    raise RuntimeError(f"Build failed with exit {proc.returncode}")

# Fix 5: timeout handling
try:
    result = subprocess.run(
        ["slow_command"],
        capture_output=True,
        text=True,
        timeout=30,
    )
except subprocess.TimeoutExpired as exc:
    exc.process.kill()
    stdout, stderr = exc.process.communicate()
    raise RuntimeError(f"Command timed out after 30s") from exc
```

---

## 6. SSL Certificate Verification Failures

### Symptom

`requests.exceptions.SSLError: HTTPSConnectionPool... certificate verify failed` when connecting to internal APIs, on-prem services, or after a certificate rotation.

### Diagnosis

```python
import ssl
import requests

# Get details about the certificate
import socket
context = ssl.create_default_context()
with socket.create_connection(("api.internal", 443)) as sock:
    with context.wrap_socket(sock, server_hostname="api.internal") as ssock:
        cert = ssock.getpeercert()
        print(cert)   # check issuer, subject, notAfter

# Test with openssl from shell:
# openssl s_client -connect api.internal:443 -showcerts
# openssl verify -CAfile /etc/ssl/certs/ca-bundle.crt server.crt
```

### Fix

```python
import requests
import os

# Fix 1: add custom CA bundle (correct approach for internal CAs)
resp = requests.get(
    "https://api.internal/health",
    verify="/etc/ssl/certs/company-ca-bundle.crt",   # path to CA bundle
    timeout=10,
)

# Fix 2: set CA via environment variable (applies to all requests in process)
os.environ["REQUESTS_CA_BUNDLE"] = "/etc/ssl/certs/company-ca-bundle.crt"
os.environ["SSL_CERT_FILE"] = "/etc/ssl/certs/company-ca-bundle.crt"

# Fix 3: add to system trust store (permanent, affects all tools)
# On RHEL/CentOS: copy to /etc/pki/ca-trust/source/anchors/ && update-ca-trust
# On Debian/Ubuntu: copy to /usr/local/share/ca-certificates/ && update-ca-certificates

# Fix 4: disable verification — ONLY for dev/internal-only non-sensitive endpoints
# Never disable in production for public APIs
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
resp = requests.get("https://api.internal/health", verify=False, timeout=10)

# Fix 5: kubernetes in-cluster — use the mounted service account CA
in_cluster_ca = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
resp = requests.get(
    "https://kubernetes.default.svc/api/v1/namespaces",
    verify=in_cluster_ca,
    headers={"Authorization": f"Bearer {service_account_token}"},
    timeout=10,
)

# Fix 6: custom SSL context for fine-grained control
import ssl
ctx = ssl.create_default_context(cafile="/etc/ssl/certs/company-ca.crt")
ctx.check_hostname = True
ctx.verify_mode = ssl.CERT_REQUIRED
# Use with urllib.request or httpx
```

---

## 7. requests Timeout and Retry Issues

### Symptom

Script hangs for minutes when an endpoint is slow. Or retries fire immediately without backoff. Or retries don't retry on connection errors, only on HTTP errors.

### Diagnosis

```python
import requests

# Default: no timeout — will hang forever
resp = requests.get("https://slow-api.example.com/data")

# The timeout tuple: (connect_timeout, read_timeout)
# connect: time to establish TCP connection
# read: time to wait for data between chunks
```

### Fix

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time

# Fix 1: always set a timeout tuple
resp = requests.get(
    "https://api.example.com/data",
    timeout=(5, 30),   # 5s connect, 30s read
)

# Fix 2: retry with backoff using urllib3 Retry
def make_session(
    retries: int = 3,
    backoff_factor: float = 0.5,
    status_forcelist: tuple = (429, 500, 502, 503, 504),
) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=backoff_factor,    # waits 0.5s, 1s, 2s between retries
        status_forcelist=status_forcelist,
        allowed_methods={"GET", "HEAD", "OPTIONS", "POST"},  # retry POST too
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

session = make_session()
resp = session.get("https://api.example.com/data", timeout=(5, 30))
resp.raise_for_status()

# Fix 3: manual retry with exponential backoff for more control
def get_with_retry(url: str, max_attempts: int = 4, base_delay: float = 1.0) -> dict:
    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.get(url, timeout=(5, 30))
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            if attempt == max_attempts:
                raise
            delay = base_delay * (2 ** (attempt - 1))
            print(f"Timeout on attempt {attempt}, retrying in {delay:.1f}s")
            time.sleep(delay)
        except requests.exceptions.HTTPError as exc:
            if exc.response.status_code < 500:
                raise   # 4xx — don't retry
            if attempt == max_attempts:
                raise
            delay = base_delay * (2 ** (attempt - 1))
            print(f"HTTP {exc.response.status_code} on attempt {attempt}, retrying in {delay:.1f}s")
            time.sleep(delay)
        except requests.exceptions.ConnectionError:
            if attempt == max_attempts:
                raise
            time.sleep(base_delay * (2 ** (attempt - 1)))

# Fix 4: rate limit — respect Retry-After header
def handle_rate_limit(resp: requests.Response) -> None:
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 60))
        print(f"Rate limited — waiting {retry_after}s")
        time.sleep(retry_after)
```

---

## 8. JSON/YAML Parsing Errors — Large Files, Partial Data, safe_load

### Symptom

`json.JSONDecodeError` on partial API responses. YAML parsing fails on Kubernetes manifests with `!!python/...` tags or multiple documents. Large JSON files exhaust memory.

### Diagnosis

```python
import json

# Locate the exact error position
raw = '{"key": "value", "broken": }'
try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    print(f"Error at line {exc.lineno}, col {exc.colno}: {exc.msg}")
    print(f"Context: {raw[max(0, exc.pos-20):exc.pos+20]!r}")

# YAML: identify tag issues
import yaml
try:
    doc = yaml.load(untrusted_yaml, Loader=yaml.FullLoader)
except yaml.YAMLError as exc:
    print(exc)
```

### Fix

```python
import json
import yaml

# JSON: always use safe error handling
def parse_json_safe(raw: str | bytes) -> dict | None:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        import logging
        logging.error("JSON parse failed at pos %d: %s", exc.pos, exc.msg)
        return None

# YAML: always use safe_load (never yaml.load with untrusted input)
# yaml.load() can execute arbitrary Python via !!python/object tags
with open("deployment.yaml") as f:
    doc = yaml.safe_load(f)          # safe

# Multi-document YAML (kubectl manifests)
with open("manifests.yaml") as f:
    docs = list(yaml.safe_load_all(f))   # generator — load all documents

# Large JSON files — use ijson for streaming (avoid loading all into memory)
# pip install ijson
import ijson

def stream_large_json(path: str):
    with open(path, "rb") as f:
        # Stream array items one at a time
        for item in ijson.items(f, "items.item"):
            yield item

for record in stream_large_json("/var/data/large_events.json"):
    process(record)   # constant memory regardless of file size

# NDJSON (newline-delimited JSON) — line by line
def stream_ndjson(path: str):
    with open(path, encoding="utf-8", errors="replace") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                import logging
                logging.warning("Line %d: invalid JSON: %s", line_num, exc.msg)

# Partial JSON from a truncated API response
def safe_json_parse(raw: str, fallback=None):
    if not raw or not raw.strip():
        return fallback
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return fallback

# YAML with multiple Kubernetes manifests — handle null documents
docs = [d for d in yaml.safe_load_all(manifest_string) if d is not None]
```

---

## 9. Threading Issues — GIL Limitations, Race Conditions, Thread-Safe Data Structures

### Symptom

Concurrent script doesn't speed up CPU-bound work. Dictionary corrupted with wrong values. `list.append()` called from multiple threads produces incorrect length. Counter misses increments.

### Diagnosis

```python
import threading
import sys

# The GIL — only one thread runs Python bytecode at a time
# CPU-bound work: threads won't help, use multiprocessing
# I/O-bound work: threads DO help (GIL released during I/O)

# Find race conditions with thread sanitizer (Python 3.12+)
# python3 -X tsan script.py

# Manually identify shared mutable state
# Look for: module-level dicts/lists, object attributes mutated by multiple threads
```

### Fix

```python
import threading
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from collections import deque
import queue

# Fix 1: use threading for I/O-bound work (HTTP, SSH, disk)
def check_endpoint(url: str) -> dict:
    import requests
    try:
        resp = requests.get(url, timeout=5)
        return {"url": url, "status": resp.status_code, "ok": resp.ok}
    except Exception as exc:
        return {"url": url, "status": None, "ok": False, "error": str(exc)}

urls = ["https://svc1/health", "https://svc2/health", "https://svc3/health"]
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(check_endpoint, url): url for url in urls}
    for future in as_completed(futures):
        result = future.result()
        print(result)

# Fix 2: use multiprocessing for CPU-bound work (data processing, parsing)
from concurrent.futures import ProcessPoolExecutor

def process_chunk(records: list) -> list:
    return [transform(r) for r in records]   # CPU-heavy

chunks = [records[i:i+1000] for i in range(0, len(records), 1000)]
with ProcessPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(process_chunk, chunks))

# Fix 3: protect shared mutable state with a lock
class SafeCounter:
    def __init__(self):
        self._count = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:
            self._count += 1

    @property
    def value(self):
        with self._lock:
            return self._count

counter = SafeCounter()

# Fix 4: use thread-safe data structures
# queue.Queue is thread-safe (use instead of list for producer-consumer)
result_queue: queue.Queue = queue.Queue()

def worker(item):
    result = process(item)
    result_queue.put(result)   # thread-safe

# threading.local() for per-thread state
local_data = threading.local()
def get_connection():
    if not hasattr(local_data, "conn"):
        local_data.conn = create_db_connection()   # one per thread
    return local_data.conn

# Fix 5: avoid shared mutable defaults in functions (a separate issue but common)
# Bug:
def add_to_list(item, result=[]):   # mutable default — shared across calls!
    result.append(item)
    return result

# Fix:
def add_to_list(item, result=None):
    if result is None:
        result = []
    result.append(item)
    return result
```

---

## 10. Kubernetes/Cloud SDK Errors — Auth Failures, Rate Limiting, Pagination

### Symptom

`kubernetes.client.exceptions.ApiException: (401) Unauthorized`. `botocore.exceptions.ClientError: An error occurred (ThrottlingException)`. Results are truncated — the script only sees 500 pods instead of 2000.

### Diagnosis

```python
# Kubernetes: check what config is being loaded
from kubernetes import client, config as k8s_config

try:
    k8s_config.load_incluster_config()    # running inside a pod
    print("Loaded in-cluster config")
except k8s_config.config_exception.ConfigException:
    k8s_config.load_kube_config()         # local ~/.kube/config
    print("Loaded kube config")

# Check the current context
import subprocess
result = subprocess.run(["kubectl", "config", "current-context"], capture_output=True, text=True)
print(result.stdout.strip())

# AWS: check which identity is being used
import boto3
sts = boto3.client("sts")
identity = sts.get_caller_identity()
print(identity)   # shows Account, UserId, Arn
```

### Fix

```python
from kubernetes import client, config as k8s_config
from kubernetes.client.exceptions import ApiException
import boto3
from botocore.exceptions import ClientError
import time

# Fix 1: authentication — handle both in-cluster and local contexts
def get_k8s_client() -> client.CoreV1Api:
    try:
        k8s_config.load_incluster_config()
    except k8s_config.config_exception.ConfigException:
        k8s_config.load_kube_config()
    return client.CoreV1Api()

# Fix 2: Kubernetes pagination — always paginate, never assume all items fit
def list_all_pods(namespace: str = None) -> list:
    core_v1 = get_k8s_client()
    pods = []
    _continue = None

    while True:
        kwargs = {"limit": 500, "_continue": _continue}
        if namespace:
            resp = core_v1.list_namespaced_pod(namespace, **kwargs)
        else:
            resp = core_v1.list_pod_for_all_namespaces(**kwargs)
        pods.extend(resp.items)
        _continue = resp.metadata._continue
        if not _continue:
            break

    return pods

# Fix 3: Kubernetes rate limiting with retry on 429 / 503
def k8s_with_retry(func, *args, max_retries=3, **kwargs):
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except ApiException as exc:
            if exc.status in (429, 503) and attempt < max_retries:
                delay = 2 ** attempt
                print(f"API rate limited ({exc.status}), retrying in {delay}s")
                time.sleep(delay)
            else:
                raise

core_v1 = get_k8s_client()
pods = k8s_with_retry(core_v1.list_pod_for_all_namespaces, limit=500)

# Fix 4: AWS pagination — use paginators (never assume a single API call returns all results)
def list_all_ec2_instances(region: str = "us-east-1") -> list:
    ec2 = boto3.client("ec2", region_name=region)
    paginator = ec2.get_paginator("describe_instances")
    instances = []
    for page in paginator.paginate():
        for reservation in page["Reservations"]:
            instances.extend(reservation["Instances"])
    return instances

# Fix 5: AWS throttling — exponential backoff with jitter
import random

def aws_with_retry(func, *args, max_attempts=5, **kwargs):
    for attempt in range(1, max_attempts + 1):
        try:
            return func(*args, **kwargs)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("ThrottlingException", "RequestLimitExceeded", "TooManyRequestsException"):
                if attempt == max_attempts:
                    raise
                # Exponential backoff with full jitter
                cap = min(32, 2 ** attempt)
                delay = random.uniform(0, cap)
                print(f"Throttled ({code}), attempt {attempt}/{max_attempts}, waiting {delay:.1f}s")
                time.sleep(delay)
            else:
                raise

# Fix 6: Kubernetes watch for events (streaming instead of polling)
from kubernetes import watch

def watch_pods(namespace: str = "default"):
    core_v1 = get_k8s_client()
    w = watch.Watch()
    try:
        for event in w.stream(
            core_v1.list_namespaced_pod,
            namespace=namespace,
            timeout_seconds=300,
        ):
            event_type = event["type"]   # ADDED, MODIFIED, DELETED
            pod = event["object"]
            name = pod.metadata.name
            phase = pod.status.phase
            print(f"{event_type}: {name} ({phase})")
    except ApiException as exc:
        if exc.status == 410:   # ResourceVersion too old — restart watch
            watch_pods(namespace)
        raise
    finally:
        w.stop()
```
