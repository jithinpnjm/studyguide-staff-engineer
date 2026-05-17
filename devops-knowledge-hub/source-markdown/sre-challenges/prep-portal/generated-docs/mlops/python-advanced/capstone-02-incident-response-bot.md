---
title: "Capstone 02 Incident Response Bot"
description: "Generated from mlops/PYTHON/Advanced/capstone_02_incident_response_bot.ipynb"
slug: "/python-advanced/capstone-02-incident-response-bot"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/capstone_02_incident_response_bot.ipynb</code></div>

# Capstone 2: Incident Response Bot

This capstone builds a realistic DevOps monitoring tool from scratch.
It ties together every chapter in the Advanced series.

## What we build
A bot that:
1. Monitors health of multiple services concurrently (Chapter 2 — asyncio)
2. Creates incidents when services go down (Chapter 1 — dataclasses, protocols)
3. Tracks incident lifecycle: detected → acknowledged → resolved
4. Sends alert notifications via a pluggable interface (Chapter 1 — Protocol)
5. Exposes a status page API (Chapter 5 — FastAPI)
6. Stores incident history (Chapter 6 — SQLAlchemy)

## How it maps to what you learned

| Concept | Where used |
|---------|------------|
| Type hints + dataclasses (Ch 1) | ServiceConfig, Incident |
| Protocol + decorators (Ch 1) | AlertNotifier, retry decorator |
| Context managers (Ch 1) | monitor_session |
| asyncio + Semaphore (Ch 2) | Parallel health checks |
| Pydantic + Settings (Ch 4) | Config validation |
| FastAPI (Ch 5) | Status page API |
| SQLAlchemy (Ch 6) | Incident persistence |
| Testing patterns (Ch 7) | SilentNotifier for tests |

---
## Part 1: Imports and Core Types

All imports and enums in one place. Each import links back to the chapter that taught it.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
import asyncio
import random
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import wraps
from typing import Optional, List, Dict, Protocol, runtime_checkable

# Pydantic (Chapter 4)
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

print('All imports loaded successfully.')
```

</div>

### What just happened?
We imported all libraries in one block. This is the standard way to organise imports in a Python module.

The three groups follow PEP8 convention:
1. **Standard library** — `asyncio`, `random`, `time`, `uuid`, `contextlib`, `dataclasses`, `datetime`, `enum`, `functools`, `typing` — these are all built into Python, no install needed
2. **Third-party** — `pydantic`, `pydantic_settings` — installed via `pip install pydantic pydantic-settings`

In a real project you would also have a third group:
```python
# Local imports
from app.config import get_settings
from app.models import Incident
```

---
## Part 2: Enums, Dataclasses, and the Notifier Protocol

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
# --- Enums ---
class ServiceStatus(str, Enum):
    HEALTHY  = 'healthy'
    DEGRADED = 'degraded'
    DOWN     = 'down'
    UNKNOWN  = 'unknown'

class IncidentSeverity(str, Enum):
    LOW      = 'low'
    MEDIUM   = 'medium'
    HIGH     = 'high'
    CRITICAL = 'critical'

class IncidentState(str, Enum):
    DETECTED     = 'detected'
    ACKNOWLEDGED = 'acknowledged'
    RESOLVED     = 'resolved'


# --- Service config (frozen dataclass = immutable) ---
@dataclass(frozen=True)
class ServiceConfig:
    name: str
    health_url: str
    team: str
    severity: IncidentSeverity = IncidentSeverity.HIGH
    failure_threshold: int = 2  # consecutive failures before alerting


# --- Incident dataclass (mutable, has methods) ---
@dataclass
class Incident:
    id: str
    service_name: str
    severity: IncidentSeverity
    state: IncidentState
    detected_at: datetime
    description: str
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    timeline: List[str] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        end = self.resolved_at or datetime.utcnow()
        return (end - self.detected_at).total_seconds()

    def acknowledge(self, by: str) -> None:
        self.state = IncidentState.ACKNOWLEDGED
        self.acknowledged_by = by
        self.acknowledged_at = datetime.utcnow()
        self.timeline.append(f'Acknowledged by {by}')

    def resolve(self) -> None:
        self.state = IncidentState.RESOLVED
        self.resolved_at = datetime.utcnow()
        self.timeline.append(f'Resolved at {self.resolved_at.strftime("%H:%M:%S")}')


# --- Protocol for alert notifiers ---
@runtime_checkable
class AlertNotifier(Protocol):
    async def notify(self, incident: Incident, event: str) -> None:
        ...


# --- Console notifier (development) ---
class ConsoleNotifier:
    async def notify(self, incident: Incident, event: str) -> None:
        icons = {'detected': '[!!]', 'acknowledged': '[..]', 'resolved': '[OK]'}
        icon = icons.get(event, '[--]')
        print(f'  {icon} {event.upper():12s} {incident.service_name:20s} {incident.severity.value}')


# --- Silent notifier (testing) ---
class SilentNotifier:
    def __init__(self):
        self.calls: List[dict] = []
    async def notify(self, incident: Incident, event: str) -> None:
        self.calls.append({'event': event, 'service': incident.service_name})


# Quick demo
print('ServiceStatus values:', [s.value for s in ServiceStatus])
print('IncidentSeverity values:', [s.value for s in IncidentSeverity])
print('ConsoleNotifier satisfies AlertNotifier protocol?', isinstance(ConsoleNotifier(), AlertNotifier))
print('SilentNotifier satisfies AlertNotifier protocol?', isinstance(SilentNotifier(), AlertNotifier))
```

</div>

### What just happened?
We defined the core data types and the notifier interface.

**`ServiceConfig` is `frozen=True`** — service configs should never change at runtime. Frozen dataclasses are immutable, hashable, and safe to share across async tasks.

**`Incident` has methods** (`acknowledge`, `resolve`) — dataclasses can have methods just like regular classes. Each method updates the state AND appends to the `timeline` list (audit trail). This keeps related behaviour with the data.

**`@runtime_checkable` on `AlertNotifier`** — without this, `isinstance(obj, AlertNotifier)` would raise a TypeError. With it, you can check at runtime whether any object satisfies the protocol.

**`ConsoleNotifier` and `SilentNotifier`** — both satisfy `AlertNotifier` without inheriting from it. In production you would add a `SlackNotifier`, `PagerDutyNotifier` etc. The rest of the code only sees `AlertNotifier` — it does not care which one you plug in.

---
## Part 3: Async Health Checker with Bounded Concurrency

The `HealthChecker` hits each service endpoint concurrently.
`asyncio.Semaphore` ensures we never fire more than N requests simultaneously.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class HealthChecker:
    def __init__(self, max_concurrent: int = 5):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._failure_counts: Dict[str, int] = {}

    async def check_one(self, svc: ServiceConfig) -> tuple:
        async with self._semaphore:  # only max_concurrent checks run at once
            await asyncio.sleep(random.uniform(0.05, 0.25))  # simulate HTTP latency
            roll = random.random()
            if roll < 0.10:
                status = ServiceStatus.DOWN
            elif roll < 0.18:
                status = ServiceStatus.DEGRADED
            else:
                status = ServiceStatus.HEALTHY

            if status == ServiceStatus.HEALTHY:
                self._failure_counts[svc.name] = 0
            else:
                self._failure_counts[svc.name] = self._failure_counts.get(svc.name, 0) + 1

            return svc.name, status

    async def check_all(self, services: List[ServiceConfig]) -> Dict[str, ServiceStatus]:
        tasks = [self.check_one(s) for s in services]
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
        return self._failure_counts.get(svc.name, 0) >= svc.failure_threshold


# --- Define services to monitor ---
services = [
    ServiceConfig('auth-api',    'https://auth.internal/health',    'platform',  IncidentSeverity.CRITICAL),
    ServiceConfig('user-svc',    'https://users.internal/health',   'backend',   IncidentSeverity.HIGH),
    ServiceConfig('payment-api', 'https://pay.internal/health',     'payments',  IncidentSeverity.CRITICAL),
    ServiceConfig('notifier',    'https://notify.internal/health',  'backend',   IncidentSeverity.MEDIUM),
    ServiceConfig('analytics',   'https://data.internal/health',    'data',      IncidentSeverity.LOW),
]

random.seed(42)
checker = HealthChecker(max_concurrent=3)

start = time.time()
statuses = asyncio.run(checker.check_all(services))
elapsed = time.time() - start

for name, status in statuses.items():
    icon = {'healthy': 'OK', 'degraded': '!!', 'down': 'XX', 'unknown': '??'}.get(status.value)
    print(f'  [{icon}] {name:20s}  {status.value}')
print(f'\nAll {len(services)} services checked in {elapsed:.2f}s (concurrent)')
```

</div>

### What just happened?
`HealthChecker` is the engine of the bot — it runs all health checks at the same time.

**`asyncio.Semaphore(max_concurrent=3)`** — imagine a door that only lets 3 people through at once. Each `async with self._semaphore:` block grabs one slot. When the slot is free the coroutine proceeds; when all 3 are busy it waits. This prevents flooding services with too many requests.

**`self._failure_counts` dict** — tracks how many checks in a row each service has failed. We only create an incident after `failure_threshold` consecutive failures. This filters out transient blips — the same way Kubernetes `livenessProbe` has a `failureThreshold`.

**`return_exceptions=True`** in `asyncio.gather` — if one check raises an unexpected exception, it becomes a regular return value instead of cancelling all other checks. We mark that service as `UNKNOWN` and keep going.

The timing output proves concurrency: 5 services each taking 0.05–0.25s finish in ~0.25s total (the longest single check), not ~1.25s (sum of all checks).

---
## Part 4: Incident Manager

The `IncidentManager` decides when to create incidents and when to resolve them.
It uses `ConsoleNotifier` (or any `AlertNotifier`) to send alerts.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
class IncidentManager:
    def __init__(self, notifier: AlertNotifier):
        self.notifier = notifier
        self._open: Dict[str, Incident] = {}   # service_name -> open incident
        self._resolved: List[Incident] = []

    async def process(self, results: Dict[str, ServiceStatus],
                      svc_map: Dict[str, ServiceConfig],
                      checker: HealthChecker) -> None:
        for svc_name, status in results.items():
            svc = svc_map[svc_name]
            if status == ServiceStatus.HEALTHY:
                if svc_name in self._open:
                    inc = self._open.pop(svc_name)
                    inc.resolve()
                    self._resolved.append(inc)
                    await self.notifier.notify(inc, 'resolved')
            else:
                if svc_name not in self._open and checker.should_alert(svc):
                    inc = Incident(
                        id=uuid.uuid4().hex[:8],
                        service_name=svc_name,
                        severity=svc.severity,
                        state=IncidentState.DETECTED,
                        detected_at=datetime.utcnow(),
                        description=f'{svc_name} is {status.value} ({svc.failure_threshold} consecutive failures)',
                    )
                    inc.timeline.append(f'Detected at {inc.detected_at.strftime("%H:%M:%S")}')
                    self._open[svc_name] = inc
                    await self.notifier.notify(inc, 'detected')

    def acknowledge(self, svc_name: str, by: str) -> Optional[Incident]:
        inc = self._open.get(svc_name)
        if inc:
            inc.acknowledge(by)
        return inc

    @property
    def open_incidents(self) -> List[Incident]:
        return list(self._open.values())

    @property
    def resolved_incidents(self) -> List[Incident]:
        return self._resolved

    def summary(self) -> dict:
        return {
            'open': len(self._open),
            'critical_open': sum(1 for i in self._open.values() if i.severity == IncidentSeverity.CRITICAL),
            'resolved': len(self._resolved),
        }


print('IncidentManager defined.')
```

</div>

### What just happened?
`IncidentManager.process()` runs the decision logic after every health check round.

For each service result:
```
if HEALTHY:
    if there is an open incident -> resolve it, notify 'resolved'
if UNHEALTHY:
    if no open incident AND threshold reached -> create incident, notify 'detected'
    (if already open, do nothing - already alerted)
```

**Why one incident per service at a time?** A service can only be broken in one way at a time. We don't want 10 identical alerts every minute. Once created, the incident stays open until the service recovers.

**`self._open: Dict[str, Incident]`** — maps service name to its open incident. `self._resolved` is the history list.

**`await self.notifier.notify(...)`** — async because real notifiers (Slack, PagerDuty) make HTTP calls. IncidentManager does not care which notifier is plugged in — it just calls `notify()`.

---
## Part 5: Monitoring Loop and Context Manager

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
@contextmanager
def monitor_session(label: str):
    start = time.perf_counter()
    print(f'\n{'='*50}')
    print(f'SESSION: {label}')
    print(f'{'='*50}')
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f'Session finished in {elapsed:.2f}s')
        print(f'{'='*50}')


async def run_monitoring(services: List[ServiceConfig], rounds: int = 3,
                         interval: float = 0.3, notifier=None) -> IncidentManager:
    if notifier is None:
        notifier = ConsoleNotifier()
    checker = HealthChecker(max_concurrent=5)
    manager = IncidentManager(notifier=notifier)
    svc_map = {s.name: s for s in services}

    for r in range(1, rounds + 1):
        print(f'  Round {r}/{rounds}')
        statuses = await checker.check_all(services)
        await manager.process(statuses, svc_map, checker)
        healthy = sum(1 for s in statuses.values() if s == ServiceStatus.HEALTHY)
        print(f'  -> {healthy}/{len(services)} healthy')
        if r < rounds:
            await asyncio.sleep(interval)

    return manager


# Run 3 rounds with console output
random.seed(7)
with monitor_session('Demo - 3 rounds'):
    manager = asyncio.run(run_monitoring(services, rounds=3, interval=0.1))

print()
print('Summary:', manager.summary())
if manager.open_incidents:
    print('Open incidents:')
    for inc in manager.open_incidents:
        print(f'  [{inc.severity.value}] {inc.service_name}: {inc.description}')
if manager.resolved_incidents:
    print('Resolved:')
    for inc in manager.resolved_incidents:
        print(f'  {inc.service_name} resolved in {inc.duration_seconds:.1f}s')
```

</div>

### What just happened?
We combined the `HealthChecker` and `IncidentManager` into a complete monitoring loop.

**`monitor_session` context manager** — wraps the monitoring run with a header, footer, and timing. A small touch that makes logs much easier to read in production. It uses `try/finally` so the footer always prints even if the loop crashes.

**`run_monitoring` function** — the orchestrator:
1. Create a checker and manager
2. For each round: check all services concurrently, process results, wait, repeat
3. Return the manager so the caller can inspect incidents

In production this `for r in range(rounds)` becomes `while True` running every 30 or 60 seconds as a background service.

The output shows the full lifecycle: services go down, alerts fire, some recover and get resolved. The `manager.summary()` gives a dashboard-style count.

---
## Part 6: FastAPI Status Page

A read-only API that surfaces the current incident state.
Engineers can query this from a browser, curl, or a Slack bot.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
# The FastAPI app shown below — save to status_api.py and run:
# uvicorn status_api:app --reload

FASTAPI_CODE = '''
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

app = FastAPI(title='Incident Status Page')

# manager is initialised at startup and shared across requests
# monitoring loop runs as asyncio.create_task() in the background

class IncidentOut(BaseModel):
    id: str
    service_name: str
    severity: str
    state: str
    detected_at: datetime
    description: str
    acknowledged_by: Optional[str] = None
    duration_seconds: float

class StatusOut(BaseModel):
    status: str
    open_count: int
    critical_count: int
    incidents: List[IncidentOut]

@app.get("/status", response_model=StatusOut)
async def get_status():
    open_incs = manager.open_incidents
    return StatusOut(
        status="all_clear" if not open_incs else "incidents_active",
        open_count=len(open_incs),
        critical_count=sum(1 for i in open_incs if i.severity.value=="critical"),
        incidents=[
            IncidentOut(
                id=i.id, service_name=i.service_name,
                severity=i.severity.value, state=i.state.value,
                detected_at=i.detected_at, description=i.description,
                acknowledged_by=i.acknowledged_by,
                duration_seconds=round(i.duration_seconds, 1),
            ) for i in open_incs
        ],
    )

@app.post("/incidents/{service_name}/acknowledge")
async def acknowledge(service_name: str, by: str):
    inc = manager.acknowledge(service_name, by=by)
    if not inc:
        raise HTTPException(404, f"No open incident for {service_name!r}")
    return {"acknowledged": True, "by": by}

@app.get("/incidents/history")
async def history(limit: int = 20):
    resolved = manager.resolved_incidents[-limit:]
    return [{"id": i.id, "service": i.service_name,
             "duration_s": round(i.duration_seconds, 1)} for i in reversed(resolved)]
'''

print(FASTAPI_CODE)
print('Endpoints:')
print('  GET  /status                       -> current open incidents')
print('  POST /incidents/{name}/acknowledge -> mark as acknowledged')
print('  GET  /incidents/history            -> resolved incident log')
```

</div>

### What just happened?
We designed the FastAPI layer on top of `IncidentManager`.

The routes are intentionally **thin** — 3 lines of logic each. All the real work happens in `IncidentManager`, which is independently testable without FastAPI.

**`IncidentOut` Pydantic model** — converts our `Incident` dataclass to a clean JSON response. It only exposes fields that are safe and useful for API consumers. Internal fields like the full `timeline` list are excluded.

**Three endpoints pattern** (standard for incident tools):
- `GET /status` — are we on fire right now? (used by dashboards, Slack bots)
- `POST /incidents/{name}/acknowledge` — engineer says "I know, I'm looking at it" (used by oncall)
- `GET /incidents/history` — audit log (used for postmortems)

In production, the `manager` object would be created at app startup with `@app.on_event('startup')`, and `run_monitoring(...)` would run as a background task via `asyncio.create_task()`.

This is exactly how PagerDuty, OpsGenie, and Alertmanager work — a monitoring loop feeds incident state, a REST API exposes it.

---
## Part 7: End-to-End Test with SilentNotifier

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
async def full_run():
    notifier = SilentNotifier()
    random.seed(99)

    manager = await run_monitoring(services, rounds=5, interval=0.05, notifier=notifier)

    print('=== FINAL REPORT ===')
    s = manager.summary()
    print(f'  Open incidents:    {s["open"]}')
    print(f'  Critical open:     {s["critical_open"]}')
    print(f'  Resolved:          {s["resolved"]}')

    print(f'\nNotification log ({len(notifier.calls)} total):')
    counts = {}
    for c in notifier.calls:
        counts[c['event']] = counts.get(c['event'], 0) + 1
    for event, n in counts.items():
        print(f'  {event:15s}: {n}')

    if manager.open_incidents:
        print('\nAcknowledging all open incidents...')
        for inc in manager.open_incidents:
            manager.acknowledge(inc.service_name, by='ops-bot')
            print(f'  Acked: {inc.service_name} -> {inc.state.value} by {inc.acknowledged_by}')

    return manager, notifier


manager_result, notifier_result = asyncio.run(full_run())

# Verify behaviour (test-style assertions)
assert len(notifier_result.calls) > 0, 'Should have sent at least one notification'
print('\nAll assertions passed.')
```

</div>

### What just happened?
This is the full end-to-end test using `SilentNotifier`.

**Why `SilentNotifier` instead of `ConsoleNotifier` here?** Because we want to *programmatically verify* behaviour, not just read printed output.

`notifier.calls` is a list of dicts recording every notification. We can assert:
- `len(notifier.calls) > 0` — at least one alert was sent
- check specific events by filtering `notifier.calls`

This is the **same pattern** as the mock testing from Chapter 7. `SilentNotifier` is essentially a hand-written mock — it records calls without side effects. In a real pytest test you would write:
```python
def test_incident_fires_notification():
    notifier = SilentNotifier()
    # ... run checks ...
    detected = [c for c in notifier.calls if c['event'] == 'detected']
    assert len(detected) >= 1
```

The `assert` at the end proves the system works as expected. If any assertion fails, you know immediately what broke.

---
## Summary — What You Built

| Component | Pattern | Chapter |
|-----------|---------|--------|
| `ServiceConfig` | Frozen dataclass | Ch 1 |
| `Incident` with methods | Dataclass + behaviour | Ch 1 |
| `AlertNotifier` | Protocol (pluggable) | Ch 1 |
| `monitor_session` | Context manager | Ch 1 |
| `HealthChecker.check_all` | asyncio.gather | Ch 2 |
| Bounded concurrency | asyncio.Semaphore | Ch 2 |
| Config from env | BaseSettings (Pydantic) | Ch 4 |
| Status Page API | FastAPI routes | Ch 5 |
| Incident persistence | SQLAlchemy (blueprint) | Ch 6 |
| `SilentNotifier` in tests | Mock-style testing | Ch 7 |

## Practice Questions

---

### Question 1 — Add a Retry Decorator

Write an async retry decorator `@retry_async(max_attempts=3, delay=0.1)` and apply it to `HealthChecker.check_one`.

The decorator should:
- Retry up to `max_attempts` times if the function raises any `Exception`
- Wait `delay * 2^attempt` seconds between retries (exponential back-off)
- Use `@wraps(fn)` to preserve the function name
- After all retries fail, re-raise the last exception

Test it by temporarily making `check_one` raise `ConnectionError` 2 out of 3 times and verifying it eventually returns a result.

---

### Question 2 — Persist Incidents to SQLite

Using SQLAlchemy (Chapter 6), add persistence to the `IncidentManager`:

1. Create an `IncidentRow` SQLAlchemy model with columns: `id`, `service_name`, `severity`, `state`, `detected_at`, `resolved_at`, `description`
2. Modify `IncidentManager.process()` to save each new incident to the database when created
3. Modify the resolve path to update `resolved_at` and `state` in the database
4. Write a function `load_open_incidents(db) -> List[Incident]` that queries the database for all incidents where `state != 'resolved'` — used to restore state after a bot restart

This is the last missing piece before the Incident Response Bot is production-ready.
