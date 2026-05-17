---
title: "Chapter 01 Advanced Python Patterns"
description: "Generated from mlops/PYTHON/Advanced/chapter_01_advanced_python_patterns.ipynb"
slug: "/python-advanced/chapter-01-advanced-python-patterns"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_01_advanced_python_patterns.ipynb</code></div>

# Chapter 1: Advanced Python Patterns

You've completed the Basics series — you know syntax, OOP, data structures, file I/O, and standard libraries.
Now we level up into patterns that **professional Python engineers use every day** in production code.

## What we cover in this chapter
| Section | Topic |
|---------|-------|
| 1 | **Type Hints** — annotate your code, catch bugs before runtime |
| 2 | **Dataclasses** — eliminate boilerplate from data-holding classes |
| 3 | **Context Managers** — guaranteed setup and teardown |
| 4 | **Advanced Decorators** — decorators that accept arguments, class-based |
| 5 | **Protocol Classes** — flexible structural interfaces |
| 6 | **Real-world project** — typed config management system |

> **DevOps angle**: These patterns appear everywhere — Ansible modules, Kubernetes Python clients,
> FastAPI route handlers, Celery tasks, Terraform providers. Mastering them makes reading those
> codebases much easier.

---
## 1. Type Hints — Self-Documenting Code

Python is dynamically typed — you never *have* to declare types. But once your codebase grows,
the question *"what does this function expect?"* becomes important.

**Type hints** answer that question at the code level, without changing how Python executes.
They are read by:
- Your IDE (autocomplete, inline error highlighting)
- `mypy` — a static type checker you can add to CI
- Other developers (and your future self)

Think of them like **labels on server rack ports**: the hardware works without them,
but with them you don't accidentally plug the wrong cable.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
# --- Basic annotations ---
# Syntax: param: type  and  -> return_type
from typing import List, Dict, Optional, Tuple, Union, Callable

def greet(name: str) -> str:
    return f"Hello, {name}!"

def add(a: int, b: int) -> int:
    return a + b

# Optional[X] means "X or None" — extremely common for "not found" returns
def find_server(server_id: str) -> Optional[str]:
    registry = {"s1": "10.0.0.1", "s2": "10.0.0.2"}
    return registry.get(server_id)   # .get() returns None when key missing

print(find_server("s1"))   # 10.0.0.1
print(find_server("s9"))   # None  <-- type system knows this can happen
```

</div>

### What just happened?
We wrote functions with **type hints** — the `: str` after a parameter name and `-> str` after the parentheses.

- `name: str` means "this parameter should be a string"
- `-> str` means "this function returns a string"
- `Optional[str]` means "either a string, or `None`" — you'll use this a lot when a function might not find what it's looking for (like `.get()` on a dict)

**Nothing changes at runtime** — Python doesn't enforce these hints. They're for your IDE and for other developers reading your code. Think of them as documentation that can be *checked* automatically.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
# --- Container types (Python 3.9+ can use list[str] instead of List[str]) ---
from typing import List, Dict, Tuple, Set

def get_active_servers() -> List[str]:
    return ["web-01", "web-02", "db-01"]

def get_env_config() -> Dict[str, str]:
    return {"DB_HOST": "localhost", "DB_PORT": "5432", "APP_ENV": "prod"}

def parse_address(address: str) -> Tuple[str, int]:
    host, port = address.split(":")
    return host, int(port)

host, port = parse_address("api.example.com:443")
print(f"Host: {host}, Port: {port}")
```

</div>

### What just happened?
We used `List[str]`, `Dict[str, str]`, and `Tuple[str, int]` — these are called **generic types**.

- `List[str]` = a list where every item is a string (not just "any list")
- `Dict[str, str]` = a dictionary with string keys AND string values
- `Tuple[str, int]` = a tuple with exactly 2 items: first a string, then an int

Why bother? Without these, your IDE can't help you. With `-> List[str]`, it knows that when you call `get_active_servers()` you'll get strings back, so it can autocomplete string methods on each item.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
# --- Callable types: annotate functions that accept other functions ---
# Callable[[arg_type1, arg_type2], return_type]
from typing import Callable, List

def apply_to_each(items: List[str], fn: Callable[[str], str]) -> List[str]:
    """Apply any str->str function to every item."""
    return [fn(item) for item in items]

servers = ["web-01", "db-PRIMARY", "cache-node"]
print(apply_to_each(servers, str.upper))
print(apply_to_each(servers, lambda s: s.replace("-", "_")))
```

</div>

### What just happened?
`Callable[[str], bool]` is how you type-hint a **function that's passed as an argument**.

Breaking it down:
- `Callable` = "this is a function"
- `[[str], bool]` = "it takes one `str` argument and returns a `bool`"

So `apply_filter(items, predicate)` says: *give me a list and any function that takes a string and returns True/False, and I'll use that function to filter the list.*

This is the foundation of functional programming — passing functions as arguments. The `lambda s: s.startswith("prod")` is just a short anonymous function that matches the required shape.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
# --- TypeVar: generics — keep type relationship between input and output ---
from typing import TypeVar

T = TypeVar("T")   # T = "some type, I don't care which, but be consistent"

def first_item(items: List[T]) -> Optional[T]:
    """
    Return the first item of any list.
    If you pass List[str]  -> returns Optional[str]
    If you pass List[int]  -> returns Optional[int]
    The TypeVar ensures input and output types stay linked.
    """
    return items[0] if items else None

print(first_item(["alpha", "beta"]))   # str
print(first_item([10, 20, 30]))        # int
print(first_item([]))                  # None
```

</div>

### What just happened?
`TypeVar('T')` creates a **placeholder type** — think of it as saying *"whatever type you give me, I'll give you back the same type"*.

Without TypeVar, `first_item(items: List) -> Optional[any]` loses type information — your IDE doesn't know the result type.

With `T`, Python knows:
- `first_item(["a", "b"])` → returns `Optional[str]`
- `first_item([1, 2, 3])` → returns `Optional[int]`

The type flows through. This is called **generics** — the same technique used in Java and TypeScript.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
# --- TypedDict: declare the exact shape of a dictionary (great for API responses) ---
from typing import TypedDict

class ServerInfo(TypedDict):
    hostname: str
    ip: str
    port: int
    healthy: bool

def describe_server(info: ServerInfo) -> str:
    status = "UP" if info["healthy"] else "DOWN"
    return f"{info['hostname']} ({info['ip']}:{info['port']}) — {status}"

server: ServerInfo = {
    "hostname": "web-01",
    "ip": "10.0.0.1",
    "port": 443,
    "healthy": True,
}
print(describe_server(server))
```

</div>

### What just happened?
`TypedDict` lets you declare the **exact shape** of a dictionary — which keys exist and what types their values are.

Without it, `info: dict` tells us nothing. With `class ServerInfo(TypedDict)`, your IDE knows that `info["port"]` is always an `int`, and will warn you if you try to access a key that doesn't exist.

**When to use TypedDict vs dataclass?**
- Use `TypedDict` when you're working with JSON data from APIs (it stays a dict)
- Use `dataclass` (next section) when you want an actual object with methods

---
## 2. Dataclasses — Kill the Boilerplate

In Chapter 21 you wrote classes with `__init__`, `__repr__`, `__eq__` by hand.
For classes that mainly *hold data*, `@dataclass` generates all of that automatically
from your field declarations.

Before dataclasses:
```python
class Config:
    def __init__(self, host, port, ssl=True):
        self.host = host; self.port = port; self.ssl = ssl
    def __repr__(self): ...
    def __eq__(self, other): ...
```

After:
```python
@dataclass
class Config:
    host: str
    port: int
    ssl: bool = True
```

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
from dataclasses import dataclass, field
from typing import List, Dict

# @dataclass auto-generates: __init__, __repr__, __eq__
@dataclass
class ServiceConfig:
    name: str
    host: str
    port: int
    environment: str
    ssl: bool = True          # default value
    replicas: int = 1

cfg1 = ServiceConfig("auth", "auth.internal", 8080, "prod", replicas=3)
cfg2 = ServiceConfig("auth", "auth.internal", 8080, "prod", replicas=3)
cfg3 = ServiceConfig("users", "users.internal", 8081, "staging")

print(cfg1)              # __repr__ for free
print(cfg1 == cfg2)      # True  — __eq__ for free
print(cfg1 == cfg3)      # False
```

</div>

### What just happened?
The `@dataclass` decorator looked at your field declarations and **automatically generated** `__init__`, `__repr__`, and `__eq__` for you.

Compare:
- Without `@dataclass`: you'd write ~15 lines of boilerplate
- With `@dataclass`: 4 lines, same result

Notice:
- `ssl: bool = True` — that's a default value, same as `def __init__(self, ..., ssl=True)`
- `print(s1)` shows a nice readable representation — that's the auto-generated `__repr__`
- `s1 == s2` works and returns `True` — that's the auto-generated `__eq__`

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
# field() gives you more control over individual fields
from dataclasses import dataclass, field
from typing import List, Dict
import time

@dataclass
class DeploymentJob:
    name: str
    environment: str
    # Mutable defaults MUST use field(default_factory=...) — plain [] would be shared!
    services: List[str] = field(default_factory=list)
    labels:   Dict[str, str] = field(default_factory=dict)
    # repr=False hides this field from __repr__ (keeps output clean)
    created_at: float = field(default_factory=time.time, repr=False)
    # init=False means it's NOT a constructor param — set in __post_init__
    job_id: str = field(init=False, repr=False)

    def __post_init__(self):
        """__post_init__ runs automatically right after __init__.
        Use it for: derived fields, validation, type coercion.
        """
        valid_envs = {"dev", "staging", "prod"}
        if self.environment not in valid_envs:
            raise ValueError(f"environment must be one of {valid_envs}")
        # Derived field — built from other fields
        self.job_id = f"{self.environment}/{self.name.lower().replace(' ', '-')}"

    def add_service(self, svc: str) -> None:
        self.services.append(svc)

job = DeploymentJob("Auth Deploy", "prod", services=["auth-api"])
job.add_service("auth-db")
print(job)
print(f"job_id: {job.job_id}")

# Validation in action
try:
    bad = DeploymentJob("x", "production")   # "production" not in valid_envs
except ValueError as e:
    print(f"Caught: {e}")
```

</div>

### What just happened?
We used `field()` for more control over individual fields:

- `field(default_factory=list)` — **important**: you can't write `services: List[str] = []` in a dataclass because that list would be *shared* between all instances. `default_factory=list` creates a fresh list for each instance.
- `repr=False` — hides `created_at` from the printed output (keeps it clean)
- `init=False` — `job_id` is NOT a constructor parameter; it's set in `__post_init__`

`__post_init__` runs automatically right after `__init__`. Use it for:
1. **Validation** — raise early if data is wrong
2. **Derived fields** — fields that are calculated from other fields (like `job_id`)

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
# frozen=True — immutable dataclasses (hashable, thread-safe)
from dataclasses import dataclass

@dataclass(frozen=True)
class Endpoint:
    host: str
    port: int
    path: str = "/"

    @property
    def url(self) -> str:
        return f"https://{self.host}:{self.port}{self.path}"

ep = Endpoint("api.example.com", 443, "/v2/health")
print(ep.url)

# Frozen = immutable — cannot change after creation
try:
    ep.host = "other.com"
except Exception as e:
    print(f"Immutable: {type(e).__name__}")

# Frozen = hashable — can use in sets and as dict keys
endpoints: set[Endpoint] = {
    Endpoint("api.example.com", 443, "/v2/users"),
    Endpoint("api.example.com", 443, "/v2/posts"),
    Endpoint("api.example.com", 443, "/v2/users"),  # duplicate — removed
}
print(f"Unique endpoints: {len(endpoints)}")
```

</div>

### What just happened?
`frozen=True` makes the dataclass **immutable** — once created, no field can be changed.

Why would you want that?
- **Safety**: an `Endpoint` shouldn't change after creation — it represents a fixed network location
- **Hashable**: frozen dataclasses can be used in `set` and as `dict` keys (regular dataclasses can't)

Notice how the duplicate `Endpoint` in the set was automatically removed — because frozen dataclasses implement `__hash__` based on their field values, so two endpoints with the same host/port/path are considered identical.

---
## 3. Context Managers — Guaranteed Cleanup

The `with` statement runs code inside a *context* where **setup always has a corresponding teardown**,
even if an exception is raised.

You already use this for files:
```python
with open("data.txt") as f:
    content = f.read()
# File is closed here — even if an exception happened inside
```

You can build your own for anything that needs cleanup:
- Database connections
- Network sockets
- Timer measurements
- Temporary directories / files
- Lock files (critical for deploy scripts)
- API sessions

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
# Method 1: Class-based — implement __enter__ and __exit__
import time

class Timer:
    """Measure wall-clock time of any code block."""

    def __init__(self, label: str = ""):
        self.label = label
        self.elapsed = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self   # This object is what goes in `as t`

    def __exit__(self, exc_type, exc_val, exc_tb):
        # exc_type is None when no exception occurred
        self.elapsed = time.perf_counter() - self._start
        prefix = f"[{self.label}] " if self.label else ""
        status = "ERROR" if exc_type else "OK"
        print(f"{prefix}{status} — {self.elapsed:.4f}s")
        return False  # False = don't suppress exceptions

with Timer("sum 1M numbers") as t:
    total = sum(range(1_000_000))

print(f"Result: {total:,}, took {t.elapsed:.4f}s")
```

</div>

### What just happened?
We built a **context manager** — the thing that powers the `with` statement.

Two special methods make it work:
- `__enter__` = runs when you enter the `with` block; the `return self` is what becomes the `as t` variable
- `__exit__` = runs when you leave the `with` block, **even if an exception occurred**

The three parameters of `__exit__` (`exc_type`, `exc_val`, `exc_tb`) tell you if an exception happened:
- If everything was fine: all three are `None`
- If an exception occurred: they contain the exception details

Returning `False` means "don't hide the exception if one occurred". Returning `True` would swallow it.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
# Method 2: contextlib.contextmanager — simpler, uses a generator
# Everything BEFORE yield = __enter__
# Everything AFTER yield  = __exit__
# yield value              = what goes in `as x`
from contextlib import contextmanager
import os, shutil, tempfile

@contextmanager
def temp_workspace(prefix: str = "work_"):
    """
    Create a temporary directory, hand it to the caller, then delete it.
    Real-world use: CI steps that need scratch space, integration tests.
    """
    workspace = tempfile.mkdtemp(prefix=prefix)
    print(f"Created: {workspace}")
    try:
        yield workspace          # caller gets this path
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
        print(f"Deleted: {workspace}")

with temp_workspace("deploy_") as ws:
    # Write some config files
    config_path = os.path.join(ws, "deploy.yml")
    with open(config_path, "w") as f:
        f.write("environment: staging\nreplicas: 2\n")
    print(f"Files in workspace: {os.listdir(ws)}")
    print("Running deployment steps...")

print("After block — workspace is gone.")
```

</div>

### What just happened?
`@contextmanager` is an easier way to write a context manager using a **generator** (a function with `yield`).

The split is:
- Everything **before** `yield` = setup (runs when entering `with`)
- The `yield` value = what goes in `as workspace`
- Everything **after** `yield` (in `finally`) = teardown (runs when leaving `with`)

`try/finally` is critical here — without it, the cleanup code wouldn't run if an exception occurred inside the `with` block. With `finally`, cleanup **always** runs, guaranteed.

This is much cleaner than writing a full class with `__enter__` and `__exit__`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
# Real-world: simulated DB transaction context manager
from contextlib import contextmanager

class FakeDB:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.connected = False
        self._ops = []

    def connect(self):    self.connected = True;  print(f"  Connected to {self.dsn}")
    def disconnect(self): self.connected = False;  print(f"  Disconnected")
    def execute(self, sql: str):
        if not self.connected: raise RuntimeError("Not connected")
        self._ops.append(sql);  print(f"  SQL: {sql}")
    def commit(self):   print(f"  Committed {len(self._ops)} ops"); self._ops.clear()
    def rollback(self): print(f"  Rolled back {len(self._ops)} ops"); self._ops.clear()

@contextmanager
def db_transaction(dsn: str):
    db = FakeDB(dsn)
    db.connect()
    try:
        yield db       # caller uses `db` inside the with block
        db.commit()    # only reached if no exception
    except Exception as e:
        db.rollback()
        raise          # re-raise so caller knows about the error
    finally:
        db.disconnect()  # always runs

# SUCCESS
print("=== Successful transaction ===")
with db_transaction("postgres://prod-db/app") as db:
    db.execute("INSERT INTO deployments(name) VALUES ('v2.1')")
    db.execute("UPDATE services SET status='deployed' WHERE id=1")

# FAILURE — automatic rollback
print("\n=== Failed transaction ===")
try:
    with db_transaction("postgres://prod-db/app") as db:
        db.execute("INSERT INTO events(type) VALUES ('deploy')")
        raise ValueError("Health check failed before commit")
except ValueError as e:
    print(f"Handled: {e}")
```

</div>

### What just happened?
This is a real-world pattern you'll see in almost every production Python application.

The `db_transaction` context manager wraps database operations so that:
1. The connection is opened for you
2. If everything succeeds → `commit()` saves all changes permanently
3. If anything fails → `rollback()` undoes all changes (nothing is half-saved)
4. The connection is **always** closed (`finally` block)

This is the **transactional guarantee** — either ALL the SQL operations succeed, or NONE of them do. Without this, a crash halfway through could leave your database in a broken state.

Notice `raise` after `rollback()` — we rollback AND re-raise the exception so the caller still knows something went wrong.

---
## 4. Advanced Decorators

From Chapter 31 you know basic decorators. Now:
- **Decorators with arguments**: `@retry(max_attempts=3)` — needs an extra wrapper
- **`functools.wraps`**: preserve the original function's name and docstring
- **Class-based decorators**: useful when the decorator needs to hold state

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
import functools, time, random
from typing import Callable, Type, Tuple

# WHY functools.wraps matters
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper   # wrapper replaces func — metadata lost!

def good_decorator(func):
    @functools.wraps(func)          # copies __name__, __doc__, __module__
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@bad_decorator
def fetch_config():
    """Load configuration from remote source."""
    pass

@good_decorator
def deploy_service():
    """Deploy the service to the target environment."""
    pass

print(f"bad:  __name__={fetch_config.__name__!r}, __doc__={fetch_config.__doc__!r}")
print(f"good: __name__={deploy_service.__name__!r}, __doc__={deploy_service.__doc__!r}")
```

</div>

### What just happened?
We compared two decorators: one that loses the original function's identity, and one that preserves it.

When you wrap a function with a decorator, the wrapper *replaces* the original. Without `@functools.wraps`, debugging becomes painful:
- `func.__name__` returns `'wrapper'` instead of the real name
- `func.__doc__` returns `None` — your docstring is gone
- Stack traces show `wrapper` everywhere instead of your real function names

`@functools.wraps(func)` copies `__name__`, `__doc__`, `__module__`, and other metadata from the original function to the wrapper. **Always use it when writing decorators.**

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
# Decorator WITH arguments — requires an extra level of nesting
# @retry(attempts=3) -> retry(3) returns a decorator, which wraps the function

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Retry decorator — retries a function on specified exceptions.
    Usage:
        @retry(max_attempts=5, delay=0.5, exceptions=(ConnectionError, TimeoutError))
        def call_api(): ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    print(f"  [{func.__name__}] attempt {attempt}/{max_attempts} failed: {e}")
                    if attempt < max_attempts:
                        time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator

# --- Simulate a flaky service health check ---
call_count = 0

@retry(max_attempts=4, delay=0.05, exceptions=(ConnectionError,))
def check_service_health(service: str) -> dict:
    global call_count
    call_count += 1
    if random.random() < 0.65:
        raise ConnectionError(f"Timeout reaching {service}")
    return {"service": service, "status": "healthy"}

random.seed(7)
try:
    result = check_service_health("auth-service")
    print(f"Result: {result}")
except ConnectionError:
    print("All retry attempts exhausted")
print(f"Total calls made: {call_count}")
```

</div>

### What just happened?
We wrote a decorator that **takes arguments** — `@retry(max_attempts=4, delay=0.05)`.

This requires **three levels of nesting**:
1. `retry(max_attempts, delay, exceptions)` — the outer function that receives the arguments
2. `decorator(func)` — the actual decorator, receives the function
3. `wrapper(*args, **kwargs)` — the replacement function that runs instead

It looks complex but the pattern is always the same. Read it as: *"retry() returns a decorator, which returns a wrapper"*.

The demo shows a function that randomly fails — the decorator retries it automatically. Notice `random.seed(7)` makes the randomness predictable so the demo is reproducible.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
# Class-based decorator — useful when the decorator needs persistent state
import time
from collections import deque

class RateLimit:
    """
    Limits calls to a function to N per second.
    The call history is stored on the decorator instance (state!).

    Real-world: API clients must respect provider rate limits.
    GitHub API: 5000 requests/hour.  Twitter: 15 requests/15 min.
    """

    def __init__(self, calls_per_second: float):
        self.interval = 1.0 / calls_per_second
        self._last = 0.0

    def __call__(self, func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            wait = self.interval - (time.time() - self._last)
            if wait > 0:
                print(f"  rate-limited, sleeping {wait:.2f}s")
                time.sleep(wait)
            self._last = time.time()
            return func(*args, **kwargs)
        return wrapper

limiter = RateLimit(calls_per_second=3)   # max 3 calls/sec

@limiter
def fetch_metric(name: str) -> float:
    return round(random.uniform(0.0, 100.0), 2)

print("Fetching 5 metrics with rate limiting (3/sec):")
t0 = time.time()
for metric in ["cpu", "mem", "disk", "net_in", "net_out"]:
    val = fetch_metric(metric)
    print(f"  {metric}: {val}  (t={time.time()-t0:.2f}s)")
```

</div>

### What just happened?
Instead of three nested functions, we used a **class as a decorator**.

A class becomes a decorator when it has:
- `__init__` — receives the decorator's arguments (`calls_per_second`)
- `__call__` — receives the function to wrap (this is what makes the instance *callable*)

The big advantage over function-based decorators: **state**. The class stores `self._last` (when the last call happened) between calls. A function-based decorator would need a `nonlocal` variable or a closure, which is messier.

The rate limiter measures time since the last call and sleeps if you're calling too fast. Watch the `t=` timestamps in the output — each call is spaced ~0.33s apart (3 calls/sec).

---
## 5. Protocol Classes — Structural Interfaces

`ABC` (Abstract Base Class) from Chapter 25 requires **explicit inheritance**:
```python
class MyClass(Deployable):   # must declare it
    ...
```

`Protocol` uses **structural typing** — if an object has the right methods, it satisfies the
protocol automatically, even without inheriting it.  This is Python's typed duck typing.

> If it has a `deploy()`, a `rollback()`, and a `health_check()` — it's `Deployable`.
> I don't care what class it is.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 35</div>

```python
from typing import Protocol, runtime_checkable, List

@runtime_checkable   # allows isinstance() checks at runtime
class Deployable(Protocol):
    name: str

    def deploy(self, environment: str) -> bool: ...
    def rollback(self) -> bool: ...
    def health_check(self) -> dict: ...

# These classes do NOT inherit from Deployable
class DockerService:
    def __init__(self, name: str, image: str):
        self.name = name
        self.image = image

    def deploy(self, environment: str) -> bool:
        print(f"  docker pull {self.image} && docker-compose up -d [{environment}]")
        return True

    def rollback(self) -> bool:
        print(f"  docker-compose down && docker pull {self.image}:previous")
        return True

    def health_check(self) -> dict:
        return {"name": self.name, "type": "docker", "status": "healthy"}


class LambdaFunction:
    def __init__(self, name: str, arn: str):
        self.name = name
        self.arn = arn

    def deploy(self, environment: str) -> bool:
        print(f"  aws lambda update-function-code --function-name {self.name} [{environment}]")
        return True

    def rollback(self) -> bool:
        print(f"  aws lambda update-alias --name {self.name} --function-version PREVIOUS")
        return True

    def health_check(self) -> dict:
        return {"name": self.name, "type": "lambda", "status": "healthy"}


def run_deployment(services: List[Deployable], env: str) -> None:
    """Deploy any list of Deployable things. Doesn't matter what class they are."""
    print(f"\nDeploying {len(services)} services to [{env}]")
    for svc in services:
        ok = svc.deploy(env)
        status = svc.health_check()
        print(f"  health: {status}")

pipeline = [
    DockerService("auth-api", "company/auth-api:v2.1"),
    LambdaFunction("resize-images", "arn:aws:lambda:us-east-1:123:function:resize"),
    DockerService("user-svc",  "company/user-svc:v1.5"),
]

run_deployment(pipeline, "staging")

# isinstance works because of @runtime_checkable
print(f"\nDockerService is Deployable? {isinstance(pipeline[0], Deployable)}")
print(f"LambdaFunction is Deployable? {isinstance(pipeline[1], Deployable)}")
```

</div>

### What just happened?
We defined a `Deployable` Protocol — a description of what methods an object must have, **without requiring inheritance**.

`DockerService` and `LambdaFunction` never say `class DockerService(Deployable)` — they just happen to have the right methods. Python considers them `Deployable` anyway.

This is called **structural subtyping** (or "duck typing with type safety"). Compare to ABC:
- `ABC`: "you must explicitly declare you implement this interface"
- `Protocol`: "if you have the right methods, you're in"

`@runtime_checkable` allows `isinstance(obj, Deployable)` checks at runtime (normally Protocols are only for static type checkers).

`run_deployment()` accepts `List[Deployable]` — it doesn't care if they're Docker, Lambda, or anything else, as long as they have `deploy()`, `rollback()`, and `health_check()`.

---
## 6. Real-World Project: Typed Configuration Manager

Let's combine everything into a practical system you'd use in a real DevOps pipeline.

What we're building:
- `ServiceConfig` — frozen dataclass, validation in `__post_init__`
- `ConfigSource` — Protocol for pluggable sources (memory, JSON file, env vars)
- `ConfigManager` — loads from multiple sources, context manager for transactions
- `@validate_required` — decorator for validation guard
- Full type hints throughout

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 38</div>

```python
import json, os, functools, time
from dataclasses import dataclass, field
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Protocol

# ── Types ──────────────────────────────────────────────────────────────────

@dataclass
class ServiceConfig:
    name: str
    host: str
    port: int
    environment: str
    replicas: int = 1
    ssl: bool = True
    tags: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not (1 <= self.port <= 65535):
            raise ValueError(f"Invalid port {self.port}")
        if self.replicas < 1:
            raise ValueError("replicas must be >= 1")

    @property
    def base_url(self) -> str:
        scheme = "https" if self.ssl else "http"
        return f"{scheme}://{self.host}:{self.port}"


# ── Protocol: pluggable config sources ─────────────────────────────────────

class ConfigSource(Protocol):
    def load(self) -> Dict[str, Any]: ...
    def save(self, data: Dict[str, Any]) -> None: ...


class MemorySource:
    def __init__(self, data: Dict[str, Any] = None):
        self._data = data or {}
    def load(self) -> Dict[str, Any]: return self._data.copy()
    def save(self, data: Dict[str, Any]) -> None: self._data = data.copy()


class JsonFileSource:
    def __init__(self, path: str):
        self.path = path
    def load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path): return {}
        with open(self.path) as f: return json.load(f)
    def save(self, data: Dict[str, Any]) -> None:
        with open(self.path, "w") as f: json.dump(data, f, indent=2)


class EnvVarSource:
    """Read config from environment variables with a prefix (e.g. APP_AUTH_HOST)."""
    def __init__(self, prefix: str = "APP_"):
        self.prefix = prefix
    def load(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        for k, v in os.environ.items():
            if k.startswith(self.prefix):
                result[k[len(self.prefix):].lower()] = v
        return result
    def save(self, data: Dict[str, Any]) -> None:
        raise NotImplementedError("Cannot write to environment variables")


# ── Decorator ──────────────────────────────────────────────────────────────

def require_loaded(method):
    """Guard: raise if ConfigManager hasn't loaded yet."""
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        if not self._loaded:
            raise RuntimeError("Call load() before accessing configs")
        return method(self, *args, **kwargs)
    return wrapper


# ── ConfigManager ──────────────────────────────────────────────────────────

class ConfigManager:
    def __init__(self, sources: List[ConfigSource]):
        self.sources = sources
        self._configs: Dict[str, ServiceConfig] = {}
        self._loaded = False

    def load(self) -> None:
        """Merge configs from all sources (later sources override earlier ones)."""
        merged: Dict[str, Any] = {}
        for src in self.sources:
            merged.update(src.load())

        self._configs = {}
        for name, data in merged.items():
            if isinstance(data, dict):
                try:
                    self._configs[name] = ServiceConfig(name=name, **data)
                except Exception as e:
                    print(f"  Warning: skipping {name!r}: {e}")
        self._loaded = True
        print(f"Loaded {len(self._configs)} configs")

    @require_loaded
    def get(self, name: str) -> Optional[ServiceConfig]:
        return self._configs.get(name)

    @require_loaded
    def add(self, cfg: ServiceConfig) -> None:
        self._configs[cfg.name] = cfg

    @require_loaded
    def by_env(self, env: str) -> List[ServiceConfig]:
        return [c for c in self._configs.values() if c.environment == env]

    @require_loaded
    def all_names(self) -> List[str]:
        return list(self._configs.keys())

    @contextmanager
    def transaction(self):
        """Atomic config changes — rollback on exception."""
        snapshot = self._configs.copy()
        try:
            yield self
            print("  Transaction committed")
        except Exception as e:
            self._configs = snapshot
            print(f"  Transaction rolled back ({e})")
            raise


# ── Demo ───────────────────────────────────────────────────────────────────

initial = {
    "auth-api": {
        "host": "auth.internal", "port": 8080,
        "environment": "prod", "replicas": 3,
        "tags": ["auth", "critical"],
    },
    "user-api": {
        "host": "users.internal", "port": 8081,
        "environment": "prod", "replicas": 2,
    },
    "feature-service": {
        "host": "features.internal", "port": 8082,
        "environment": "staging", "ssl": False,
    },
}

mgr = ConfigManager(sources=[MemorySource(initial)])
mgr.load()

print(f"All services: {mgr.all_names()}")
print(f"Prod services: {[s.name for s in mgr.by_env('prod')]}")

auth = mgr.get("auth-api")
print(f"Auth URL: {auth.base_url}  replicas: {auth.replicas}  tags: {auth.tags}")

# Transaction — add a service, fail midway, expect rollback
print("\n--- Transaction demo ---")
try:
    with mgr.transaction() as m:
        m.add(ServiceConfig("payment-api", "payments.internal", 8083, "prod", replicas=5))
        print(f"  Services during transaction: {m.all_names()}")
        raise RuntimeError("Payment cert validation failed!")
except RuntimeError:
    pass

print(f"Services after rollback: {mgr.all_names()}")
# payment-api should be gone
```

</div>

### What just happened?
This is the **capstone** of the chapter — all five patterns working together:

| Pattern | Where used |
|---------|-----------|
| Type hints | Every function signature, `Dict[str, Any]`, `Optional[ServiceConfig]` |
| Dataclass | `ServiceConfig` with validation in `__post_init__` |
| Protocol | `ConfigSource` — `MemorySource`, `JsonFileSource`, `EnvVarSource` all satisfy it without inheriting |
| Decorator | `@require_loaded` guards every method that needs the config loaded first |
| Context manager | `transaction()` — changes roll back if anything raises an exception |

The transaction demo is key: we add `payment-api`, confirm it's there, then raise an exception. After the `with` block, `payment-api` is **gone** — the rollback restored the snapshot. This is exactly how database transactions work.

---
## Summary

| Pattern | Why it matters | Key syntax |
|---------|---------------|------------|
| **Type hints** | Catches bugs at dev time, self-documents intent | `def f(x: str) -> Optional[int]` |
| **Dataclasses** | Eliminates repetitive `__init__`/`__repr__`/`__eq__` | `@dataclass`, `field()`, `__post_init__` |
| **Context managers** | Guarantees cleanup even on exception | `__enter__`/`__exit__`, `@contextmanager` |
| **Advanced decorators** | Cross-cutting concerns (retry, rate-limit, auth) | outer function returns decorator |
| **Protocols** | Flexible structural interfaces, no forced inheritance | `class P(Protocol): ...` |

## Next Chapter
**Chapter 2: Concurrency — Threading, Multiprocessing, and Async/Await**
We'll explore when to use threads, when to use processes, and when async is the right tool.
All with real-world examples: parallel HTTP requests, async file processing, background workers.

---
## Add-on: Build a Small CLI Ops Tool

This is the missing bridge from "advanced Python concepts" to "I can build a useful tool".

A lot of interviews expect you to go beyond syntax and show that you can combine:
- `argparse` for CLI ergonomics
- `pathlib` for safe file handling
- `dataclasses` for structured results
- `logging` for observability
- clean function boundaries for testability

The example below builds a tiny log-summary CLI. This is very close to the kind of internal tooling DevOps engineers often write.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 42</div>

```python
from __future__ import annotations

import argparse
import json
import logging
import tempfile
from collections import Counter
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
logger = logging.getLogger('log_summary')


@dataclass
class LogSummary:
    path: str
    total_lines: int
    error_count: int
    warn_count: int
    top_levels: dict[str, int]


def summarize_log(path: Path) -> LogSummary:
    counts = Counter()
    total = 0

    for line in path.read_text().splitlines():
        total += 1
        if '[ERROR]' in line:
            counts['ERROR'] += 1
        elif '[WARN]' in line:
            counts['WARN'] += 1
        elif '[INFO]' in line:
            counts['INFO'] += 1
        else:
            counts['OTHER'] += 1

    return LogSummary(
        path=path.name,
        total_lines=total,
        error_count=counts['ERROR'],
        warn_count=counts['WARN'],
        top_levels=dict(counts),
    )


def scan_logs(directory: Path) -> list[LogSummary]:
    log_files = sorted(directory.glob('*.log'))
    logger.info('Scanning %s log files in %s', len(log_files), directory)
    return [summarize_log(path) for path in log_files]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Summarize application log files.')
    parser.add_argument('--log-dir', type=Path, required=True, help='Directory containing *.log files')
    parser.add_argument('--as-json', action='store_true', help='Print JSON instead of human-readable lines')
    return parser


def render_report(items: Iterable[LogSummary], as_json: bool = False) -> None:
    items = list(items)
    if as_json:
        print(json.dumps([asdict(item) for item in items], indent=2))
        return

    for item in items:
        print(f"{item.path:18s} lines={item.total_lines:3d} errors={item.error_count:2d} warns={item.warn_count:2d}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    results = scan_logs(args.log_dir)
    render_report(results, as_json=args.as_json)
    return 0
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 43</div>

```python
with tempfile.TemporaryDirectory(prefix='logs_demo_') as tmp:
    tmp_path = Path(tmp)
    (tmp_path / 'auth.log').write_text(
        '2025-03-01 [INFO] starting\n'
        '2025-03-01 [WARN] retrying token refresh\n'
        '2025-03-01 [ERROR] failed to connect to db\n'
    )
    (tmp_path / 'worker.log').write_text(
        '2025-03-01 [INFO] job received\n'
        '2025-03-01 [INFO] job completed\n'
    )

    print('Human-readable output:')
    main(['--log-dir', str(tmp_path)])

    print('\nJSON output:')
    main(['--log-dir', str(tmp_path), '--as-json'])
```

</div>

### Why this add-on matters

This section is interview-relevant because it shows that advanced Python is not only about decorators and protocols.
It is also about building maintainable tools with:
- clear input parsing
- composable functions
- structured output
- production-friendly logging

If you can explain this flow calmly in an interview, you already sound much more like someone who writes real engineering tools.

---
## Practice Questions

Try these on your own — they cover the main concepts from this chapter.

---

### Question 1 — Type Hints + Dataclass

Write a dataclass called `PipelineRun` with these fields:
- `name` (str, required)
- `branch` (str, required)
- `triggered_by` (str, required)
- `stages` (list of strings, default empty)
- `success` (bool, default `False`)
- `run_id` (str, NOT a constructor param — set in `__post_init__` as `"{branch}-{name}"`)

Add a `__post_init__` that raises `ValueError` if `name` contains a space.

Write a function `summarise(run: PipelineRun) -> str` with full type hints that returns a one-line summary like:
```
main-deploy: 3 stages, success=True
```

---

### Question 2 — Context Manager + Decorator

**Part A**: Write a `@contextmanager` called `log_block(label)` that:
- Prints `"START: {label}"` when entering
- Prints `"END: {label} ({elapsed:.2f}s)"` when exiting
- Still works if an exception is raised inside the block (prints `"FAILED: {label}"` instead)

**Part B**: Write a decorator `@validate_positive` that wraps any function and raises `ValueError` if any positional argument is a number ≤ 0.

Test both:
```python
with log_block("data load"):
    time.sleep(0.1)

@validate_positive
def set_replicas(count: int) -> str:
    return f"Replicas set to {count}"

print(set_replicas(3))   # works
print(set_replicas(-1))  # should raise ValueError
```
