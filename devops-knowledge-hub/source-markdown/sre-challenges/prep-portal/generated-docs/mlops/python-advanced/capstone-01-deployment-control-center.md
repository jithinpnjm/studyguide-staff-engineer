---
title: "Capstone 01 Deployment Control Center"
description: "Generated from mlops/PYTHON/Advanced/capstone_01_deployment_control_center.ipynb"
slug: "/python-advanced/capstone-01-deployment-control-center"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/capstone_01_deployment_control_center.ipynb</code></div>

# Capstone: Deployment Control Center

This capstone ties together Chapters 1 to 6 into one realistic story.

We are building a small deployment control center for internal platform work. The goal is not to build a huge production system in one notebook. The goal is to understand how advanced Python pieces fit together in a practical tool.

This project combines:
- Chapter 1: dataclasses, decorators, protocols, context managers
- Chapter 2: asyncio and bounded concurrency
- Chapter 3: API client patterns and retry thinking
- Chapter 4: Pydantic validation and settings
- Chapter 5: FastAPI service structure
- Chapter 6: SQLAlchemy async persistence

## 1. Capstone Problem Statement

Imagine you are building an internal platform tool that:
- receives deployment requests
- validates them
- fans out deployment actions to multiple services
- talks to external systems such as config or health endpoints
- records deployment state in a database
- exposes an API for operators or CI pipelines

That is a very realistic DevOps-flavored Python problem.

## 2. Architecture at a Glance

The flow is:

1. FastAPI route receives a request
2. Pydantic validates the payload and settings
3. Service layer orchestrates the deployment
4. Async deployment client performs concurrent health checks / rollout actions
5. SQLAlchemy persists deployment state
6. API returns a clean response model

The code below focuses on the core engineering ideas, not on every production detail.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
from __future__ import annotations

import asyncio
import random
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Protocol

from pydantic import BaseModel, Field, ConfigDict, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
```

</div>

### What just happened?
We imported every library this project uses. Let's map each import to the chapter that taught it:

| Import | From chapter | What it does here |
|--------|-------------|-------------------|
| `asyncio` | Ch 2 | Event loop for concurrent deployments |
| `contextmanager` | Ch 1 | Timer context manager for measuring deploy time |
| `dataclass, field` | Ch 1 | `DeploymentRecord` — internal state holder |
| `Enum` | Ch 4 | `Environment` enum (dev/staging/prod) |
| `wraps` | Ch 1 | Preserves function metadata in the retry decorator |
| `Protocol` | Ch 1 | `DeployBackend` — pluggable backend interface |
| `BaseModel, Field` | Ch 4 | `DeploymentRequest` — validates incoming requests |
| `BaseSettings` | Ch 4 | `AppSettings` — reads config from env vars |

`from __future__ import annotations` at the top enables **postponed evaluation of annotations** — it allows forward references like `list[str]` without quoting them as `"list[str]"`. This is standard in modern Python code.

## 3. Pydantic Models and Settings

We start with validated inputs and typed settings. This is the contract layer of the system.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Environment(str, Enum):
    DEV = 'dev'
    STAGING = 'staging'
    PROD = 'prod'


class DeploymentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag: str = Field(..., min_length=1)
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=20)
    requested_by: str = Field(..., min_length=1)


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='CONTROL_', extra='ignore')

    api_name: str = 'deployment-control-center'
    max_concurrency: int = 3
    default_timeout_seconds: int = 5
    auth_token: SecretStr = SecretStr('demo-token')


settings = AppSettings()
request = DeploymentRequest(
    service_name='auth-api',
    image_tag='v2.1.0',
    environment=Environment.PROD,
    replicas=3,
    requested_by='ci-pipeline',
)

print(settings)
print(request.model_dump())
```

</div>

### What just happened?
We defined the **contract layer** — the shapes that data must conform to throughout the system.

`class Environment(str, Enum)` — inheriting from both `str` and `Enum` means:
- `Environment.PROD` has the value `"prod"` (a real string)
- It serialises to `"prod"` in JSON automatically (not `<Environment.PROD: 'prod'>`)

`model_config = ConfigDict(extra='forbid')` on `DeploymentRequest` — this is a strict mode: if the client sends any field that's NOT declared in the model (like `"debug": true`), Pydantic raises a validation error immediately. This prevents clients from accidentally passing data you don't handle.

`AppSettings` with `env_prefix='APP_'` — all configuration comes from environment variables. `APP_ENV`, `APP_MAX_CONCURRENCY` etc. In a real deployment you'd set these as Kubernetes secrets or ECS environment variables. The code never has hardcoded config values.

## 4. Domain Objects, Protocols, Decorators, and Context Managers

This section brings in Chapter 1 ideas. We use a dataclass for internal state, a protocol for pluggable deploy backends, a retry decorator, and a timer context manager.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
@dataclass
class DeploymentRecord:
    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    requested_by: str
    status: str = 'pending'
    events: list[str] = field(default_factory=list)


class DeployBackend(Protocol):
    async def deploy(self, record: DeploymentRecord) -> dict:
        ...


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


@contextmanager
def timed_block(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f'{label}: {elapsed:.3f}s')
```

</div>

### What just happened?
This cell defines four things from Chapter 1, working together:

**`DeploymentRecord` (dataclass)** — the internal state object that travels through the whole system. Notice it has an `events: list[str]` field — this is an audit trail. Every time something happens to a deployment, we append a string describing it.

**`DeployBackend` (Protocol)** — defines what any deployment backend must be able to do: `async def deploy(record) -> dict`. The `SimulatedDeployClient` in the next cell satisfies this protocol without inheriting from it.

**`retry_async` (decorator with arguments)** — the async version of the `@retry` decorator from Chapter 1. Notice it uses `@wraps(fn)` to preserve the function name, and `async def wrapper` because it wraps async functions.

**`Timer` (context manager)** — measures wall-clock time. Used to record how long each deployment takes for the audit log.

## 5. Async Deployment Client with Bounded Concurrency

This section brings in Chapters 2 and 3. We simulate an async deployment backend with concurrency control and retry behavior.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class SimulatedDeployClient:
    def __init__(self, max_concurrency: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrency)

    @retry_async(max_attempts=3, delay=0.05)
    async def deploy(self, record: DeploymentRecord) -> dict:
        async with self.semaphore:
            await asyncio.sleep(random.uniform(0.1, 0.3))
            if random.random() < 0.15:
                raise ConnectionError(f'temporary failure for {record.service_name}')
            return {
                'deployment_id': record.id,
                'service_name': record.service_name,
                'status': 'running',
                'environment': record.environment.value,
            }


client = SimulatedDeployClient(max_concurrency=settings.max_concurrency)
```

</div>

### What just happened?
`SimulatedDeployClient` is our fake deployment backend — it simulates talking to a real system.

Two key patterns here:

**`asyncio.Semaphore(max_concurrency=3)`** — a semaphore is a concurrency control mechanism. `async with self.semaphore:` means "only 3 coroutines can be inside this block at the same time". This prevents flooding a real deployment system with 50 simultaneous requests. The 4th coroutine has to wait until one of the 3 finishes.

**`@retry_async(max_attempts=3, delay=0.05)`** — the decorator we defined in the previous cell. If `deploy()` raises `ConnectionError`, it will retry up to 3 times with a small delay. The `if random.random() < 0.15:` simulates a 15% chance of a transient failure — realistic for network operations.

The combination of semaphore + retry is a production-grade pattern for calling external APIs safely.

## 6. Orchestration Layer

This is the service layer. It converts validated requests into internal records, calls the backend, and updates deployment state.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
async def run_deployment(req: DeploymentRequest, backend: DeployBackend) -> DeploymentRecord:
    record = DeploymentRecord(
        id=str(uuid.uuid4()),
        service_name=req.service_name,
        image_tag=req.image_tag,
        environment=req.environment,
        replicas=req.replicas,
        requested_by=req.requested_by,
    )
    record.events.append('request_validated')

    result = await backend.deploy(record)
    record.status = result['status']
    record.events.append('deployment_started')
    return record


with timed_block('single deployment'):
    random.seed(7)
    record = asyncio.run(run_deployment(request, client))

print(record)
```

</div>

### What just happened?
`run_deployment` is the **orchestration function** — it connects all the pieces in the right order.

Trace the flow:
1. Create a `DeploymentRecord` from the validated `DeploymentRequest`
2. Append `'request_validated'` to the audit trail
3. Use the `Timer` context manager to measure deployment time
4. Call `await backend.deploy(record)` — the actual work (async, might retry)
5. Set `record.status` from the result
6. Append another event to the audit trail with the elapsed time

This function doesn't care if `backend` is `SimulatedDeployClient` or a real Kubernetes client — it just calls `backend.deploy()`. That's the Protocol pattern in action.

`async def` + `await backend.deploy(record)` — the function is async because it waits for the backend. This means it can be used with `asyncio.gather()` to deploy multiple services concurrently.

## 7. Multi-Service Fan-Out

A very common pattern in internal platform tooling is to fan out the same operation to many services or environments.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
async def rollout_many(service_names: list[str]) -> list[DeploymentRecord]:
    requests = [
        DeploymentRequest(
            service_name=name,
            image_tag='v9.9.9',
            environment=Environment.STAGING,
            replicas=2,
            requested_by='ops-bot',
        )
        for name in service_names
    ]
    tasks = [run_deployment(req, client) for req in requests]
    return await asyncio.gather(*tasks)


random.seed(21)
records = asyncio.run(rollout_many(['auth-api', 'user-svc', 'payment-api', 'analytics']))
for item in records:
    print(item.service_name, item.status, item.events)
```

</div>

### What just happened?
`rollout_many` is the **fan-out pattern** — send the same operation to many targets at the same time.

The list comprehension creates one `DeploymentRequest` per service name. Then:
```python
tasks = [run_deployment(req, client) for req in requests]
return await asyncio.gather(*tasks)
```
This creates all coroutines and runs them all concurrently. With the semaphore set to `max_concurrency=3`, at most 3 deployments run simultaneously — the rest queue up.

Looking at the output — all services deploy in roughly the time of one deployment, not N times that. That's the power of concurrent fan-out.

The `events` list on each record shows the audit trail: `['request_validated', 'deployment_done in 0.12s']`. In production this would be written to a database table for observability.

## 8. FastAPI Layer

Below is a compact FastAPI shape for the capstone. This is intentionally shown as a code blueprint rather than executed in the notebook.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
FASTAPI_BLUEPRINT = """
from fastapi import FastAPI, Depends
from typing import Annotated

app = FastAPI(title='Deployment Control Center')

def get_settings() -> AppSettings:
    return AppSettings()

@app.post('/deployments')
async def create_deployment(
    req: DeploymentRequest,
    settings: Annotated[AppSettings, Depends(get_settings)],
):
    backend = SimulatedDeployClient(max_concurrency=settings.max_concurrency)
    record = await run_deployment(req, backend)
    return record
"""

print(FASTAPI_BLUEPRINT)
```

</div>

### What just happened?
We printed the FastAPI route that would sit on top of our orchestration layer.

Notice how thin the route handler is:
```python
@app.post('/deployments')
async def create_deployment(req: DeploymentRequest, settings: ...):
    backend = SimulatedDeployClient(max_concurrency=settings.max_concurrency)
    record = await run_deployment(req, backend)
    return record
```

That's it — 3 lines of business logic. FastAPI handles:
- Parsing the JSON body into `DeploymentRequest` (Pydantic validates it)
- Injecting `AppSettings` via `Depends(get_settings)`
- Serialising `record` to JSON for the response

This is the **thin controller, fat service** pattern. The route does routing. `run_deployment` does work. They don't mix.

`async def create_deployment` — the route is async because `run_deployment` is async. FastAPI runs async routes on its event loop, so they work perfectly with `asyncio.gather()` inside.

## 9. SQLAlchemy Async Layer

This is the database shape that would persist deployment records in a real service.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
SQLALCHEMY_BLUEPRINT = """
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime
from datetime import datetime

class Base(DeclarativeBase):
    pass

class DeploymentRow(Base):
    __tablename__ = 'deployments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    service_name: Mapped[str] = mapped_column(String(100))
    image_tag: Mapped[str] = mapped_column(String(100))
    environment: Mapped[str] = mapped_column(String(20))
    replicas: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    requested_by: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
"""

print(SQLALCHEMY_BLUEPRINT)
```

</div>

### What just happened?
We printed the SQLAlchemy model that would persist deployment records to a database.

`DeploymentRow` maps directly to `DeploymentRecord` (our dataclass), but with SQLAlchemy types:
- `String(36)` — UUID strings are 36 characters long
- `String(100)` — service names, image tags
- `DateTime` — timestamps for created/updated

The `events_json` field is interesting — the `events: list[str]` from our dataclass doesn't have a direct SQL equivalent. The standard approach is to serialise it as a JSON string and store it in a `Text` column. You'd use `json.dumps(record.events)` when saving and `json.loads(row.events_json)` when reading.

In the full production version, `run_deployment` would accept a `db: AsyncSession` parameter and call `db.add(DeploymentRow(...))` after the deploy completes, giving you a permanent audit trail.

## 10. What This Capstone Teaches

This notebook is worth revisiting because it teaches how the pieces fit together, not just what each library does in isolation.

If you can explain this capstone clearly, you can tell a strong interview story:
- Pydantic validates the boundary
- dataclasses and protocols shape internal design
- decorators and context managers add cross-cutting behavior cleanly
- asyncio gives safe fan-out with bounded concurrency
- FastAPI exposes the service cleanly
- SQLAlchemy gives persistence and transaction boundaries

## 11. Next Practical Extensions

Natural next improvements would be:
- replace the simulated client with real `httpx.AsyncClient`
- store records in a real async SQLAlchemy database
- add a request ID middleware in FastAPI
- add pytest tests for the service layer and API routes
- package it as a real internal CLI plus service

That is exactly how toy knowledge becomes tool-building skill.

---
## Capstone Extension Challenges

These are harder than the chapter questions — they extend the capstone into something more production-like.

---

### Challenge 1 — Add Rollback Support

Add a `rollback` method to `SimulatedDeployClient`:
```python
async def rollback(self, record: DeploymentRecord) -> dict:
    # simulate rolling back a deployment
    ...
```

Update `DeployBackend` Protocol to include `rollback`.

Update `run_deployment` so that if `backend.deploy(record)` fails after all retries, it calls `backend.rollback(record)`, sets `record.status = "rolled_back"`, and appends `"rollback_triggered"` to `record.events`.

Test by setting a very high failure rate (e.g. `random.random() < 0.9`) and running `rollout_many` — verify that failed deployments show `status="rolled_back"` in the output.

---

### Challenge 2 — Persist to SQLite

Wire the capstone to a real SQLite database:

1. Create the `DeploymentRow` SQLAlchemy model from the blueprint above
2. Create an async engine with `sqlite+aiosqlite:///./capstone.db`
3. Modify `run_deployment` to accept an optional `db: AsyncSession = None` parameter
4. After a successful deploy, save a `DeploymentRow` to the database
5. Add a new function `get_deployment_history(db) -> list[DeploymentRow]` that returns all records ordered by `created_at DESC`

Call `rollout_many` and then immediately call `get_deployment_history` to verify the records were saved.
