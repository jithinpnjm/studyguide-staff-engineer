---
title: Expert
sidebar_position: 3
---

# Expert Python for SRE and Platform Engineering

This guide integrates all seven advanced Python chapters — patterns, concurrency, HTTP, Pydantic, FastAPI, SQLAlchemy, and testing — into a single reference for engineers writing production-grade automation and service code.

---

## 1. Advanced Python Patterns

### Type Hints: TypeVar and Generic

Use `TypeVar` when the input and output types must stay linked:

```python
from typing import TypeVar, Optional, List

T = TypeVar("T")

def first_item(items: List[T]) -> Optional[T]:
    """Return the first item of any list, preserving the element type."""
    return items[0] if items else None

# TypeVar ensures: first_item(["a","b"]) -> Optional[str]
#                  first_item([1, 2, 3]) -> Optional[int]
```

Use `Callable` to type-annotate higher-order functions:

```python
from typing import Callable

def apply_to_each(items: List[str], fn: Callable[[str], str]) -> List[str]:
    return [fn(item) for item in items]

servers = ["web-01", "db-PRIMARY"]
print(apply_to_each(servers, str.upper))
print(apply_to_each(servers, lambda s: s.replace("-", "_")))
```

`TypedDict` is preferable to a plain `dict` when you own the structure:

```python
from typing import TypedDict

class ServerInfo(TypedDict):
    hostname: str
    ip: str
    port: int
    healthy: bool

def describe_server(info: ServerInfo) -> str:
    status = "UP" if info["healthy"] else "DOWN"
    return f"{info['hostname']} ({info['ip']}:{info['port']}) - {status}"
```

### Dataclasses: field(), __post_init__, frozen=True

```python
from dataclasses import dataclass, field
import time

@dataclass
class DeploymentJob:
    name: str
    environment: str
    services: List[str] = field(default_factory=list)   # never use = []
    labels: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time, repr=False)
    job_id: str = field(init=False, repr=False)          # derived field

    def __post_init__(self):
        valid_envs = {"dev", "staging", "prod"}
        if self.environment not in valid_envs:
            raise ValueError(f"environment must be one of {valid_envs}")
        # derived field built in __post_init__
        self.job_id = f"{self.environment}/{self.name.lower().replace(' ', '-')}"

    def add_service(self, svc: str) -> None:
        self.services.append(svc)

job = DeploymentJob("Auth Deploy", "prod", services=["auth-api"])
job.add_service("auth-db")
print(job)
print(f"job_id: {job.job_id}")
```

`frozen=True` makes a dataclass immutable and hashable — ideal for configuration value objects:

```python
@dataclass(frozen=True)
class Endpoint:
    host: str
    port: int
    path: str = "/"

    @property
    def url(self) -> str:
        return f"https://{self.host}:{self.port}{self.path}"

ep = Endpoint("api.example.com", 443, "/v2/health")
# can be used in sets and as dict keys because it is hashable
endpoints: set[Endpoint] = {
    Endpoint("api.example.com", 443, "/v2/users"),
    Endpoint("api.example.com", 443, "/v2/users"),  # duplicate removed
}
print(f"Unique endpoints: {len(endpoints)}")
```

### Context Managers: __enter__/__exit__ and @contextmanager

**Class-based** — useful when you need state across enter/exit:

```python
import time

class Timer:
    def __init__(self, label: str = ""):
        self.label = label
        self.elapsed = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self   # this is what goes in `as t`

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self._start
        status = "ERROR" if exc_type else "OK"
        print(f"[{self.label}] {status} - {self.elapsed:.4f}s")
        return False   # False = do not suppress exceptions

with Timer("health check batch") as t:
    time.sleep(0.1)
print(f"Elapsed: {t.elapsed:.4f}s")
```

**Generator-based** — cleaner for most cases:

```python
from contextlib import contextmanager
import tempfile, shutil, os

@contextmanager
def temp_workspace(prefix: str = "work_"):
    workspace = tempfile.mkdtemp(prefix=prefix)
    print(f"Created: {workspace}")
    try:
        yield workspace   # caller gets this path
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
        print(f"Deleted: {workspace}")

with temp_workspace("deploy_") as ws:
    config_path = os.path.join(ws, "deploy.yml")
    with open(config_path, "w") as f:
        f.write("environment: staging\nreplicas: 2\n")
    print(f"Files: {os.listdir(ws)}")
# workspace is deleted automatically here
```

**DB transaction pattern** — commit on success, rollback on any exception, always close:

```python
@contextmanager
def db_transaction(dsn: str):
    db = connect(dsn)
    try:
        yield db
        db.commit()    # only reached if no exception
    except Exception as e:
        db.rollback()
        raise          # re-raise so the caller still sees the error
    finally:
        db.disconnect()  # always runs
```

### Advanced Decorators

**Decorator with arguments** — three levels of nesting:

```python
import functools, time

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    exceptions: tuple = (Exception,),
):
    def decorator(func):
        @functools.wraps(func)   # preserves __name__, __doc__
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    print(f"[{func.__name__}] attempt {attempt}/{max_attempts} failed: {e}")
                    if attempt < max_attempts:
                        time.sleep(delay * (2 ** (attempt - 1)))
            raise last_exc
        return wrapper
    return decorator

@retry(max_attempts=4, delay=0.1, exceptions=(ConnectionError,))
def check_service_health(service: str) -> dict:
    # 65% chance of transient failure for demo
    import random
    if random.random() < 0.65:
        raise ConnectionError(f"Timeout reaching {service}")
    return {"service": service, "status": "healthy"}
```

**Class-based decorator** — when the decorator needs persistent state between calls:

```python
import functools, time

class RateLimit:
    """Limits calls to a function to N per second.
    State (last call time) is stored on the instance."""

    def __init__(self, calls_per_second: float):
        self.interval = 1.0 / calls_per_second
        self._last = 0.0

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            wait = self.interval - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            return func(*args, **kwargs)
        return wrapper

@RateLimit(calls_per_second=5)
def fetch_metric(name: str) -> float:
    import random
    return round(random.uniform(0.0, 100.0), 2)
```

### Protocol: Structural Typing

`Protocol` defines an interface without requiring explicit inheritance — duck typing with type safety. Use `@runtime_checkable` to enable `isinstance()` checks:

```python
from typing import Protocol, runtime_checkable, List

@runtime_checkable
class Deployable(Protocol):
    name: str
    def deploy(self, environment: str) -> bool: ...
    def rollback(self) -> bool: ...
    def health_check(self) -> dict: ...

# These classes do NOT inherit from Deployable
class DockerService:
    def __init__(self, name: str, image: str):
        self.name = name; self.image = image

    def deploy(self, environment: str) -> bool:
        print(f"docker pull {self.image} && docker-compose up -d [{environment}]")
        return True

    def rollback(self) -> bool:
        print(f"docker-compose down && docker pull {self.image}:previous")
        return True

    def health_check(self) -> dict:
        return {"name": self.name, "type": "docker", "status": "healthy"}

class LambdaFunction:
    def __init__(self, name: str, arn: str):
        self.name = name; self.arn = arn

    def deploy(self, environment: str) -> bool:
        print(f"aws lambda update-function-code --function-name {self.name} [{environment}]")
        return True

    def rollback(self) -> bool: ...
    def health_check(self) -> dict:
        return {"name": self.name, "type": "lambda", "status": "healthy"}

def run_deployment(services: List[Deployable], env: str) -> None:
    for svc in services:
        svc.deploy(env)
        print(svc.health_check())

pipeline = [
    DockerService("auth-api", "company/auth-api:v2.1"),
    LambdaFunction("resize-images", "arn:aws:lambda:us-east-1:123:function:resize"),
]
run_deployment(pipeline, "staging")
print(isinstance(pipeline[0], Deployable))  # True, via @runtime_checkable
```

### Structural Pattern Matching (match/case)

Python 3.10+ structural pattern matching for event dispatch:

```python
def handle_event(event: dict) -> str:
    match event:
        case {"type": "deployment", "status": "failed", "service": svc}:
            return f"Deployment failed for {svc} - triggering rollback"
        case {"type": "alert", "severity": "critical"}:
            return "Critical alert - paging on-call"
        case {"type": "alert", "severity": str(level)}:
            return f"Alert at severity {level}"
        case _:
            return "Unknown event"
```

---

## 2. Concurrency: GIL, Threading, Multiprocessing, Asyncio

### The GIL and Concurrency Decision Matrix

The Global Interpreter Lock (GIL) means only one thread runs Python bytecode at a time. While a thread waits for I/O (network, disk), it releases the GIL — so other threads can run. For CPU-bound work, use processes to bypass the GIL entirely.

```
Task is CPU-heavy (calculations, parsing, compression)?
  -> ProcessPoolExecutor (separate processes, each with its own GIL)

Task is I/O-bound (network, files, databases)?
  -> Many concurrent tasks with high control? asyncio + await
  -> Simpler code OK, or calling sync libraries? ThreadPoolExecutor
```

| | Threading | Multiprocessing | Asyncio |
|--|-----------|-----------------|---------|
| **Real parallelism** | No (GIL) | Yes | No (single thread) |
| **Best for** | I/O-bound | CPU-bound | High-concurrency I/O |
| **Overhead per task** | Medium | High (process spawn) | Very low |
| **Shared state** | Tricky (locks) | Hard (separate memory) | Easy (single thread) |

### Thread and Lock Primitives

```python
import threading

lock = threading.Lock()
rlock = threading.RLock()  # reentrant lock — same thread can acquire multiple times
event = threading.Event()

# Queue for thread-safe producer/consumer
from queue import Queue
work_queue: Queue[str] = Queue()

def worker(worker_id: int) -> None:
    while not work_queue.empty():
        try:
            job = work_queue.get_nowait()
        except Exception:
            return
        time.sleep(0.1)
        print(f"worker-{worker_id} finished {job}")
        work_queue.task_done()

for job in ["build", "test", "scan", "push", "deploy"]:
    work_queue.put(job)

threads = [threading.Thread(target=worker, args=(i,)) for i in range(1, 3)]
for t in threads: t.start()
for t in threads: t.join()
```

### ThreadPoolExecutor

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import time, random

def check_health(server: str) -> dict:
    time.sleep(random.uniform(0.5, 1.5))   # simulate network I/O
    return {"server": server, "healthy": random.random() > 0.2}

servers = ["web-01", "web-02", "db-primary", "cache-01", "api-gw"]

# as_completed yields results as they finish (fastest first)
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(check_health, s): s for s in servers}
    for future in as_completed(futures):
        server = futures[future]
        try:
            result = future.result()
            icon = "OK" if result["healthy"] else "FAIL"
            print(f"[{icon}] {server}")
        except Exception as e:
            print(f"[ERR] {server}: {e}")

# executor.map() - simpler when order matters
results = list(executor.map(check_health, servers))
```

### ProcessPoolExecutor (CPU-bound)

```python
from concurrent.futures import ProcessPoolExecutor
import math

def is_prime(n: int) -> bool:
    if n < 2: return False
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0: return False
    return True

def count_primes(start_end):
    start, end = start_end
    return sum(1 for n in range(start, end) if is_prime(n))

if __name__ == "__main__":
    ranges = [(i, i + 250_000) for i in range(0, 2_000_000, 250_000)]
    with ProcessPoolExecutor() as executor:  # defaults to cpu_count() workers
        chunk_counts = list(executor.map(count_primes, ranges))
    print(f"Total primes: {sum(chunk_counts):,}")
```

### asyncio: Event Loop, Coroutines, Tasks, gather, wait, shield

```python
import asyncio, random

async def async_check_health(server: str) -> dict:
    await asyncio.sleep(random.uniform(0.5, 1.5))  # yields control to event loop
    return {"server": server, "latency_ms": round(random.uniform(50, 500))}

async def check_all(servers: list) -> list:
    # gather runs all coroutines concurrently and returns results in input order
    return await asyncio.gather(*[async_check_health(s) for s in servers])

# create_task starts the coroutine immediately in the background
async def deploy_pipeline():
    auth_task = asyncio.create_task(deploy_service("auth-api", 2.0))
    user_task = asyncio.create_task(deploy_service("user-svc", 1.5))
    monitor = asyncio.create_task(monitor_loop(3.5))

    results = await asyncio.gather(auth_task, user_task)
    monitor.cancel()  # clean up background task
    return results

# gather with error handling - return_exceptions=True
results = await asyncio.gather(*tasks, return_exceptions=True)
for result in results:
    if isinstance(result, Exception):
        print(f"Failed: {result}")

# Timeout
try:
    result = await asyncio.wait_for(slow_operation(), timeout=5.0)
except asyncio.TimeoutError:
    print("Operation timed out after 5s")

# shield protects a coroutine from cancellation
result = await asyncio.shield(critical_operation())

# Run blocking sync code from async (delegates to thread pool)
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, blocking_sync_function, arg)

asyncio.run(check_all(["web-01", "web-02", "db-01"]))
```

### Bounded Concurrency with Semaphore

```python
async def bounded_check(server: str, sem: asyncio.Semaphore) -> dict:
    async with sem:   # at most `limit` coroutines run inside at once
        await asyncio.sleep(random.uniform(0.1, 0.4))
        return {"server": server, "healthy": random.random() > 0.15}

async def run_all(servers: list, limit: int = 3):
    sem = asyncio.Semaphore(limit)
    tasks = [bounded_check(s, sem) for s in servers]
    return await asyncio.gather(*tasks)
```

---

## 3. Real-World HTTP APIs

### requests Session with Connection Pooling

```python
import requests

session = requests.Session()
session.headers.update({
    "Authorization": "Bearer my-token",
    "User-Agent": "MyDeployBot/1.0",
    "Accept": "application/json",
})
# Connection pooling is automatic - all calls reuse the same TCP connections
response = session.get("https://api.example.com/services", timeout=10)
response.raise_for_status()   # raises HTTPError for 4xx/5xx
data = response.json()
session.close()
# or: with requests.Session() as session: ...
```

### Retry with Exponential Backoff and Jitter

```python
import time, random
from typing import TypeVar, Callable

T = TypeVar("T")

def with_backoff(
    fn: Callable[[], T],
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: bool = True,
) -> T:
    """Call fn() with exponential backoff retries.
    Jitter prevents thundering herd: 500 services retrying simultaneously
    would re-overload the server. Random spread avoids this."""
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as e:
            last_exc = e
            if attempt == max_attempts: break
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            if jitter:
                delay *= random.uniform(0.5, 1.5)
            print(f"Attempt {attempt} failed. Retrying in {delay:.2f}s")
            time.sleep(delay)
    raise last_exc
```

### Reusable API Client Class

```python
import requests, time, logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class APIConfig:
    base_url: str
    token: str
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0

class APIError(Exception):
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code

class BaseAPIClient:
    def __init__(self, config: APIConfig):
        self.config = config
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {config.token}",
            "Accept": "application/json",
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        url = f"{self.config.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        last_exc = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                resp = self._session.request(method, url,
                                              timeout=self.config.timeout, **kwargs)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.HTTPError as e:
                if 400 <= e.response.status_code < 500:
                    raise APIError(f"Client error {e.response.status_code}",
                                   status_code=e.response.status_code)
                last_exc = e
            except (requests.exceptions.Timeout,
                    requests.exceptions.ConnectionError) as e:
                last_exc = e
            if attempt < self.config.max_retries:
                time.sleep(self.config.retry_delay * (2 ** (attempt - 1)))
        raise APIError(f"All retries exhausted for {url}") from last_exc

    def get(self, endpoint: str, params: dict = None) -> dict:
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, body: dict) -> dict:
        return self._request("POST", endpoint, json=body)

    def __enter__(self): return self
    def __exit__(self, *_): self._session.close()
```

### httpx Async Client

```python
import asyncio, httpx

async def fetch_all_configs(services: list[str]) -> list[dict]:
    async with httpx.AsyncClient(
        headers={"Authorization": "Bearer token"},
        timeout=10.0,
    ) as client:
        tasks = [client.get(f"https://config.internal/services/{s}") for s in services]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        results = []
        for resp in responses:
            if isinstance(resp, Exception):
                results.append({"error": str(resp)})
            else:
                resp.raise_for_status()
                results.append(resp.json())
        return results
```

### Circuit Breaker Pattern

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"       # normal operation
    OPEN = "open"           # failing, reject calls fast
    HALF_OPEN = "half_open" # testing recovery

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._failures = 0
        self._state = CircuitState.CLOSED
        self._opened_at: float = 0.0

    def call(self, fn, *args, **kwargs):
        if self._state == CircuitState.OPEN:
            if time.time() - self._opened_at > self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
            else:
                raise RuntimeError("Circuit OPEN - call rejected")
        try:
            result = fn(*args, **kwargs)
            self._failures = 0
            self._state = CircuitState.CLOSED
            return result
        except Exception:
            self._failures += 1
            if self._failures >= self.failure_threshold:
                self._state = CircuitState.OPEN
                self._opened_at = time.time()
            raise
```

### Rate Limiting and Webhook Receiver

```python
# Handle 429 Retry-After
if resp.status_code == 429:
    retry_after = int(resp.headers.get("Retry-After", 60))
    time.sleep(retry_after)
    continue

# Link header pagination (GitHub-style)
while url:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    yield from resp.json()
    link = resp.headers.get("Link", "")
    url = None
    for part in link.split(","):
        if 'rel="next"' in part:
            url = part.split(";")[0].strip().strip("<>")
```

---

## 4. Pydantic: Data Validation and Settings

### BaseModel, Field Constraints, and Validators

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
import re

class DeploymentRequest(BaseModel):
    service_name: str   # ... means required
    image_tag: str      = Field(..., min_length=1)
    environment: str    = Field(default="dev", pattern="^(dev|staging|prod)$")
    replicas: int       = Field(default=1, ge=1, le=50)
    notify_email: Optional[str] = None

    @field_validator("service_name")
    @classmethod
    def must_be_kebab_case(cls, v: str) -> str:
        if not re.match(r'^[a-z][a-z0-9-]*$', v):
            raise ValueError(f"must be lowercase kebab-case, got {v!r}")
        return v

    @field_validator("notify_email")
    @classmethod
    def normalize_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None: return v
        if "@" not in v:
            raise ValueError(f"Invalid email: {v!r}")
        return v.lower()   # transform, not just validate

    @model_validator(mode="after")   # cross-field validation, runs after all fields
    def prod_needs_multiple_replicas(self) -> "DeploymentRequest":
        if self.environment == "prod" and self.replicas < 2:
            raise ValueError("prod requires at least 2 replicas")
        return self

# Validation errors are structured, not generic
from pydantic import ValidationError
try:
    DeploymentRequest(service_name="AuthAPI", image_tag="v1.0.0", environment="dev")
except ValidationError as e:
    for err in e.errors():
        print(f"field={err['loc']} msg={err['msg']}")
```

### Nested Models and computed_field

```python
from pydantic import BaseModel, Field, computed_field
from typing import Dict

class ResourceLimits(BaseModel):
    cpu_millicores: int = Field(default=500, ge=100)
    memory_mb: int = Field(default=512, ge=64)

    @computed_field
    @property
    def cpu_cores(self) -> float:
        return self.cpu_millicores / 1000

class ContainerSpec(BaseModel):
    image: str
    tag: str = "latest"
    port: int = Field(..., ge=1, le=65535)
    env_vars: Dict[str, str] = Field(default_factory=dict)
    resources: ResourceLimits = Field(default_factory=ResourceLimits)

# Parsing and serialization
spec = ContainerSpec.model_validate(raw_dict)
spec = ContainerSpec.model_validate_json(raw_json_string)
d = spec.model_dump()
j = spec.model_dump_json(indent=2)
updated = spec.model_copy(update={"tag": "v2.0.0"})
```

### Discriminated Unions

```python
from typing import Literal, Union, Annotated
from pydantic import BaseModel, Field

class DockerDeploy(BaseModel):
    type: Literal["docker"]
    image: str
    replicas: int = 1

class LambdaDeploy(BaseModel):
    type: Literal["lambda"]
    function_name: str
    memory_mb: int = 512

DeployTarget = Annotated[
    Union[DockerDeploy, LambdaDeploy],
    Field(discriminator="type")
]

class Pipeline(BaseModel):
    target: DeployTarget
    # Pydantic picks the right model based on target.type
```

### BaseSettings for Environment Config

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr
from functools import lru_cache

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_",    # APP_PORT, APP_DB_HOST, etc.
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )
    app_name: str = "my-service"
    environment: str = Field(default="dev", pattern="^(dev|staging|prod)$")
    port: int = Field(default=8080, ge=1, le=65535)
    debug: bool = False
    db_host: str = "localhost"
    db_password: SecretStr = SecretStr("changeme")   # hidden in logs

    @property
    def database_url(self) -> str:
        return (f"postgresql+asyncpg://app:{self.db_password.get_secret_value()}"
                f"@{self.db_host}/appdb")

    @property
    def is_production(self) -> bool:
        return self.environment == "prod"

@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()   # reads env vars once, cached forever

s = get_settings()
print(s.db_password)               # **********
print(s.db_password.get_secret_value())  # actual value
```

---

## 5. FastAPI: Production REST APIs

### App Structure, Lifespan, and Middleware

```python
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Annotated
import time

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Startup: initialize DB pool, warm caches...")
    yield
    print("Shutdown: close connections...")

app = FastAPI(title="Deployment API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"])

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Response-Time"] = f"{time.time() - start:.3f}s"
    return response
```

### Dependency Injection

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    settings: AppSettings = Depends(get_settings),
) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@app.get("/deployments/{deployment_id}")
async def get_deployment(
    deployment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[dict, Depends(get_current_user)],
) -> DeploymentResponse:
    dep = await db.get(Deployment, deployment_id)
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return DeploymentResponse.model_validate(dep)
```

### Route with Pydantic Models and Background Tasks

```python
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime

class Environment(str, Enum):
    DEV = "dev"; STAGING = "staging"; PROD = "prod"

class CreateDeploymentRequest(BaseModel):
    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag: str
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=50)

class DeploymentResponse(BaseModel):
    id: str
    service_name: str
    status: str
    created_at: datetime

@app.post("/deployments", response_model=DeploymentResponse, status_code=201)
async def create_deployment(
    request: CreateDeploymentRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dep = Deployment(**request.model_dump())
    db.add(dep)
    await db.commit()
    # fire-and-forget: runs after the response is sent
    background_tasks.add_task(notify_slack, dep.id, dep.service_name)
    return DeploymentResponse.model_validate(dep)
```

### Error Handling and OpenAPI Schema

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class DeploymentConflictError(Exception):
    def __init__(self, service: str):
        self.service = service

@app.exception_handler(DeploymentConflictError)
async def conflict_handler(request: Request, exc: DeploymentConflictError):
    return JSONResponse(
        status_code=409,
        content={"error": "conflict", "detail": f"{exc.service} already deploying"},
    )
```

Visit `/docs` for auto-generated Swagger UI. Visit `/redoc` for ReDoc. Both are generated from your type hints and Pydantic models at zero additional cost.

---

## 6. SQLAlchemy Async: Databases

### Declarative Models with Mapped Columns

```python
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime
from typing import Optional, List
import uuid

class Base(DeclarativeBase):
    pass

class Service(Base):
    __tablename__ = "services"

    id:          Mapped[int]            = mapped_column(Integer, primary_key=True)
    name:        Mapped[str]            = mapped_column(String(100), unique=True, nullable=False)
    team:        Mapped[str]            = mapped_column(String(50), nullable=False)
    active:      Mapped[bool]           = mapped_column(default=True)
    created_at:  Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)

    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="service", cascade="all, delete-orphan"
    )

class Deployment(Base):
    __tablename__ = "deployments"

    id:           Mapped[str]      = mapped_column(
                                       String(36), primary_key=True,
                                       default=lambda: str(uuid.uuid4())
                                   )
    service_id:   Mapped[int]      = mapped_column(ForeignKey("services.id"), nullable=False)
    image_tag:    Mapped[str]      = mapped_column(String(200), nullable=False)
    status:       Mapped[str]      = mapped_column(String(20), default="pending")
    deployed_by:  Mapped[str]      = mapped_column(String(100), nullable=False)
    created_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:   Mapped[datetime] = mapped_column(
                                       DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
                                   )
    service: Mapped["Service"] = relationship("Service", back_populates="deployments")
```

### Async Engine, Sessions, and CRUD

```python
# SQLite for dev/tests, PostgreSQL for production
DATABASE_URL = "sqlite+aiosqlite:///./app.db"
# DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/appdb"

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# FastAPI dependency
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# CRUD
async def create_deployment(db: AsyncSession, service_id: int, image_tag: str) -> Deployment:
    dep = Deployment(service_id=service_id, image_tag=image_tag, deployed_by="ci")
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return dep

async def list_deployments(db: AsyncSession, status: str = None) -> list[Deployment]:
    from sqlalchemy import select
    stmt = select(Deployment)
    if status:
        stmt = stmt.where(Deployment.status == status)
    stmt = stmt.order_by(Deployment.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    return list(result.scalars().all())
```

### Query Optimization and Alembic Migrations

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Eager load to avoid N+1 queries
stmt = (
    select(Service)
    .where(Service.active == True)
    .options(selectinload(Service.deployments))
    .limit(50)
)
result = await db.execute(stmt)
services = result.scalars().all()
```

```bash
# Alembic migration workflow
alembic init alembic
alembic revision --autogenerate -m "add deployment_notes column"
alembic upgrade head
alembic downgrade -1
```

---

## 7. Testing: pytest, Mocks, Async, and Project Structure

### Project Layout (src layout)

```
my-service/
  src/
    myservice/
      __init__.py
      config.py          # BaseSettings
      models.py          # SQLAlchemy ORM models
      schemas.py         # Pydantic request/response models
      services.py        # business logic (independently testable)
      api/
        routes.py        # FastAPI route handlers
        dependencies.py  # Depends() functions
  tests/
    conftest.py          # shared fixtures (db, client, settings)
    test_services.py
    test_api.py
  pyproject.toml
  alembic/
```

### pytest Fixtures, conftest, and Parametrize

```python
# conftest.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.models import Base
from app.api.dependencies import get_db

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()   # isolate each test

@pytest.fixture
async def client(db):
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

# Parametrize for table-driven tests
@pytest.mark.parametrize("attempt,expected", [
    (1, 0.5), (2, 1.0), (3, 2.0), (4, 4.0),
])
def test_retry_delay(attempt: int, expected: float):
    from app.services import calculate_retry_delay
    assert calculate_retry_delay(attempt) == expected
```

### unittest.mock: MagicMock, patch, AsyncMock

```python
from unittest.mock import MagicMock, patch, AsyncMock

# Synchronous mock
def test_deploy_calls_client():
    fake_client = MagicMock()
    fake_client.start_deployment.return_value = {"status": "running"}

    result = deploy_service(fake_client, "auth-api")

    assert result == "running"
    fake_client.start_deployment.assert_called_once_with("auth-api")

# Async mock
@pytest.mark.asyncio
async def test_async_health_check():
    mock_client = AsyncMock()
    mock_client.get.return_value = MagicMock(
        status_code=200,
        json=lambda: {"status": "healthy"},
    )
    result = await check_health_async(mock_client, "https://api.example.com/health")
    assert result["status"] == "healthy"

# Patching at import location
def test_with_patch():
    with patch("app.services.requests.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: {"ok": True}
        )
        result = fetch_config("https://config.internal/app")
    mock_get.assert_called_once()
    assert result == {"ok": True}
```

### pytest-asyncio and monkeypatch

```python
# pyproject.toml - run all async tests automatically
# [tool.pytest.ini_options]
# asyncio_mode = "auto"

@pytest.mark.asyncio
async def test_create_deployment(client):
    resp = await client.post("/deployments", json={
        "service_name": "auth-api",
        "image_tag": "v1.0.0",
        "environment": "staging",
        "replicas": 1,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["service_name"] == "auth-api"
    assert "id" in data

def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("APP_ENVIRONMENT", "prod")
    monkeypatch.setenv("APP_PORT", "9000")
    settings = AppSettings()
    assert settings.environment == "prod"
    assert settings.port == 9000
```

### Coverage and pyproject.toml

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["src"]
omit = ["*/tests/*", "*/migrations/*"]

[tool.coverage.report]
fail_under = 80

[project]
name = "my-service"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "pydantic>=2.6",
    "pydantic-settings>=2.2",
    "sqlalchemy>=2.0",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio", "pytest-cov", "httpx", "aiosqlite"]
```

```bash
pytest --cov=src --cov-report=term-missing
```

---

## 8. Capstone: Deployment Control Center Architecture

The Deployment Control Center integrates all seven chapters into a realistic internal platform tool:

```
HTTP request
  -> FastAPI route receives request (Chapter 5)
     -> Pydantic validates payload and settings (Chapter 4)
        -> Service layer orchestrates (Chapter 1: Protocol, dataclass, decorator)
           -> Async client fans out with bounded concurrency (Chapter 2: asyncio, Semaphore)
              -> httpx hits real external endpoints (Chapter 3)
                 -> SQLAlchemy persists deployment state (Chapter 6)
                    -> pytest tests verify each layer independently (Chapter 7)
```

**Core patterns from the capstone source:**

```python
# Pydantic contract layer
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict

class DeploymentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')  # reject unknown fields
    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag: str = Field(..., min_length=1)
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=20)
    requested_by: str = Field(..., min_length=1)

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='CONTROL_', extra='ignore')
    max_concurrency: int = 3
    auth_token: SecretStr = SecretStr('demo-token')

# Domain objects + Protocol
@dataclass
class DeploymentRecord:
    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    requested_by: str
    status: str = 'pending'
    events: list[str] = field(default_factory=list)  # audit trail

class DeployBackend(Protocol):
    async def deploy(self, record: DeploymentRecord) -> dict: ...

# Async retry decorator
def retry_async(max_attempts: int = 3, delay: float = 0.1):
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt < max_attempts:
                        await asyncio.sleep(delay * attempt)
            raise last_exc
        return wrapper
    return decorator

# Simulated backend with semaphore + retry
class SimulatedDeployClient:
    def __init__(self, max_concurrency: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrency)

    @retry_async(max_attempts=3, delay=0.05)
    async def deploy(self, record: DeploymentRecord) -> dict:
        async with self.semaphore:   # at most max_concurrency deploys at once
            await asyncio.sleep(random.uniform(0.1, 0.3))
            return {'status': 'running', 'service_name': record.service_name}

# Orchestration
async def run_deployment(req: DeploymentRequest, backend: DeployBackend) -> DeploymentRecord:
    record = DeploymentRecord(id=str(uuid.uuid4()), **req.model_dump())
    record.events.append('request_validated')
    result = await backend.deploy(record)
    record.status = result['status']
    record.events.append('deployment_started')
    return record

# Fan-out
async def rollout_many(service_names: list[str]) -> list[DeploymentRecord]:
    requests = [DeploymentRequest(service_name=name, image_tag='v9.9.9',
                                   environment=Environment.STAGING, replicas=2,
                                   requested_by='ops-bot')
                for name in service_names]
    client = SimulatedDeployClient(max_concurrency=3)
    tasks = [run_deployment(req, client) for req in requests]
    return await asyncio.gather(*tasks)  # semaphore inside client caps actual concurrency

# Thin FastAPI route
@app.post('/deployments')
async def create_deployment(
    req: DeploymentRequest,
    settings: Annotated[AppSettings, Depends(get_settings)],
):
    backend = SimulatedDeployClient(max_concurrency=settings.max_concurrency)
    record = await run_deployment(req, backend)
    return record
```

---

## 9. Incident Response Bot: Key Architecture

The Incident Response Bot pattern demonstrates event-driven monitoring with Protocol-based alerting:

```python
# AlertNotifier Protocol - plug in Slack, PagerDuty, email, etc.
@runtime_checkable
class AlertNotifier(Protocol):
    async def notify(self, incident: Incident, event: str) -> None: ...

class SlackNotifier:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def notify(self, incident: Incident, event: str) -> None:
        payload = {
            "text": f"[{event.upper()}] {incident.service_name} - {incident.severity.value}",
            "attachments": [{"color": "danger", "text": incident.description}]
        }
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=payload)

class SilentNotifier:
    """For testing - captures calls without sending anything."""
    def __init__(self): self.calls: list[dict] = []
    async def notify(self, incident: Incident, event: str) -> None:
        self.calls.append({"event": event, "service": incident.service_name})

# Health checker with bounded concurrency and failure threshold
class HealthChecker:
    def __init__(self, max_concurrent: int = 5):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._failure_counts: dict[str, int] = {}

    async def check_all(self, services: list[ServiceConfig]) -> dict[str, ServiceStatus]:
        tasks = [self._check_one(s) for s in services]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        statuses = {}
        for svc, result in zip(services, results):
            if isinstance(result, Exception):
                statuses[svc.name] = ServiceStatus.UNKNOWN
            else:
                name, status = result
                statuses[name] = status
        return statuses

    def should_alert(self, svc: ServiceConfig) -> bool:
        # Only alert after consecutive failures exceed threshold
        return self._failure_counts.get(svc.name, 0) >= svc.failure_threshold
```

---

## Quick Reference: Key Patterns

| Pattern | Module | When to Use |
|---------|--------|-------------|
| `@dataclass(frozen=True)` | dataclasses | Immutable value objects, hashable |
| `@contextmanager` | contextlib | Any guaranteed setup/teardown |
| `TypeVar("T")` | typing | Generic functions preserving type |
| `Protocol` + `@runtime_checkable` | typing | Structural interfaces, pluggable backends |
| `ThreadPoolExecutor` | concurrent.futures | I/O-bound parallel work |
| `ProcessPoolExecutor` | concurrent.futures | CPU-bound parallel work |
| `asyncio.gather` | asyncio | Many concurrent async tasks |
| `asyncio.Semaphore` | asyncio | Cap fan-out concurrency |
| `asyncio.wait_for` | asyncio | Timeout on any async operation |
| `requests.Session` | requests | Multiple calls to same API |
| `httpx.AsyncClient` | httpx | Async HTTP with connection reuse |
| `BaseModel` + `Field` | pydantic | Validate any untrusted external data |
| `@field_validator` | pydantic | Custom field validation/transform |
| `@model_validator(mode="after")` | pydantic | Cross-field validation rules |
| `BaseSettings` + `SecretStr` | pydantic-settings | Typed env var config, hidden secrets |
| `Depends()` | fastapi | Dependency injection (db, auth, settings) |
| `BackgroundTasks` | fastapi | Fire-and-forget after response sent |
| `async_sessionmaker` | sqlalchemy | Async DB session management |
| `selectinload` | sqlalchemy.orm | Avoid N+1 query problem |
| `alembic upgrade head` | alembic | Apply pending DB schema migrations |
| `AsyncMock` | unittest.mock | Mock async functions in tests |
| `pytest.mark.parametrize` | pytest | Table-driven test cases |
| `monkeypatch.setenv` | pytest | Override env vars in a single test |
