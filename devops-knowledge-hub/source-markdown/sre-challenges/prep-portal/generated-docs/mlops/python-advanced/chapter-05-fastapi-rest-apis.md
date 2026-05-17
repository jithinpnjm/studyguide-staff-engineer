---
title: "Chapter 05 Fastapi Rest Apis"
description: "Generated from mlops/PYTHON/Advanced/chapter_05_fastapi_rest_apis.ipynb"
slug: "/python-advanced/chapter-05-fastapi-rest-apis"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_05_fastapi_rest_apis.ipynb</code></div>

# Chapter 5: FastAPI — Building Production REST APIs

FastAPI is the most popular Python web framework for building APIs today. It's used by:
- Netflix, Uber, Microsoft, Explosion AI
- Most modern Python ML model serving (TorchServe alternative, custom model APIs)
- Internal DevOps tooling and automation APIs

## Why FastAPI over Flask or Django?

| | Flask | Django REST | FastAPI |
|-|-------|-------------|---------|
| Performance | Slow (sync) | Slow (sync) | Fast (async ASGI) |
| Type safety | None | Limited | Full (via Pydantic) |
| Auto docs | Manual | drf-spectacular | Built-in (Swagger + ReDoc) |
| Validation | Manual | Serializers | Automatic (Pydantic) |
| Async support | Bolted-on | Limited | Native |
| Learning curve | Low | High | Medium |

**The key insight**: FastAPI combines three things you already know:
- Python **type hints** (Chapter 1)
- **Pydantic** models (Chapter 4)
- **Async/await** (Chapter 2)

## What we build
A **Deployment Management API** — a service that tracks deployments of microservices.
This is a realistic tool you'd actually build and use.

## What we cover
| Section | Topic |
|---------|-------|
| 1 | **App structure + first routes** |
| 2 | **Path, query, and body parameters** |
| 3 | **Pydantic request/response models** |
| 4 | **Dependency injection** — auth, DB, settings |
| 5 | **Error handling** |
| 6 | **Background tasks** |
| 7 | **Complete working API** — run it, test it |

```bash
pip install fastapi uvicorn[standard] httpx
```

> **How to run**: At the end of this notebook we save the app to a `.py` file and run it.
> In Jupyter you can also use `nest_asyncio` + `uvicorn.run()` in-process.

---
## 1. Your First FastAPI App

Let's start simple and build up from there.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
# We'll build the app incrementally.
# In this cell: just show the structure — the full runnable app is at the end.

# --- app.py skeleton ---
SKELETON = """
from fastapi import FastAPI

# Create the app — this is equivalent to Flask's `app = Flask(__name__)`
app = FastAPI(
    title="Deployment API",
    description="Manages service deployments across environments",
    version="1.0.0",
)

# A route is a Python function decorated with @app.METHOD("/path")
# The return value is automatically serialized to JSON
@app.get("/")
def root():
    return {"message": "Deployment API is running"}

@app.get("/health")
def health():
    return {"status": "healthy", "version": "1.0.0"}

# To run:
# uvicorn app:app --reload --port 8000
#
# Then visit:
# http://localhost:8000/         → JSON response
# http://localhost:8000/docs     → Interactive Swagger UI (FREE, auto-generated!)
# http://localhost:8000/redoc    → ReDoc documentation
"""

print(SKELETON)
print("FastAPI gives you Swagger docs for FREE with zero extra code!")
```

</div>

### What just happened?
We looked at the skeleton of a FastAPI app.

Three lines do all the setup:
```python
from fastapi import FastAPI
app = FastAPI(title="...", version="...")
```

Then each route is just a decorated function. `@app.get("/health")` means: *when a GET request comes in at `/health`, call this function and return its result as JSON*.

The **biggest win**: visit `http://localhost:8000/docs` and you get a full interactive API documentation page — generated automatically from your code and type hints, zero extra work. This is Swagger UI. You can test every endpoint directly in the browser.

---
## 2. Path, Query, and Body Parameters

FastAPI automatically reads parameters from:
- **Path**: `/deployments/{deployment_id}` — part of the URL
- **Query**: `/deployments?env=prod&page=1` — after the `?`
- **Body**: JSON payload — from the request body (POST/PUT)
- **Header**: `Authorization: Bearer ...` — from HTTP headers

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
# We demonstrate all parameter types here.
# FastAPI knows which is which purely from the function signature:
#   - If it matches a path variable  → path param
#   - If it's a primitive type       → query param
#   - If it's a Pydantic model       → request body

PARAMS_DEMO = """
from fastapi import FastAPI, Query, Path, Header, Body
from typing import Optional, List
from pydantic import BaseModel

app = FastAPI()

# --- PATH PARAMETER ---
# /deployments/dep-001  →  deployment_id = "dep-001"
@app.get("/deployments/{deployment_id}")
def get_deployment(
    deployment_id: str = Path(..., description="Deployment ID", min_length=1)
):
    return {"id": deployment_id, "status": "running"}


# --- QUERY PARAMETERS ---
# /deployments?environment=prod&page=2&page_size=50
@app.get("/deployments")
def list_deployments(
    environment: Optional[str] = Query(default=None, description="Filter by environment"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    include_failed: bool = Query(default=False),
):
    return {
        "environment": environment,
        "page": page,
        "page_size": page_size,
        "include_failed": include_failed,
    }


# --- REQUEST BODY (Pydantic model) ---
class CreateDeploymentRequest(BaseModel):
    service_name: str
    image_tag: str
    environment: str
    replicas: int = 1

@app.post("/deployments", status_code=201)
def create_deployment(request: CreateDeploymentRequest):
    # FastAPI validates the JSON body against CreateDeploymentRequest automatically
    # If validation fails → 422 Unprocessable Entity (with field-level errors)
    return {"id": "dep-new", **request.model_dump()}


# --- HEADERS ---
@app.get("/secure-endpoint")
def secure_endpoint(
    authorization: str = Header(..., description="Bearer token"),
    x_request_id: Optional[str] = Header(default=None),
):
    return {"auth_present": bool(authorization), "request_id": x_request_id}
"""
print(PARAMS_DEMO)
```

</div>

### What just happened?
FastAPI reads your **function signature** to know where each parameter comes from — you don't have to tell it explicitly (most of the time).

The rules:
- If the parameter name matches a `{variable}` in the path → **path parameter**
- If the parameter is a primitive type (`str`, `int`, `bool`) with no path match → **query parameter**
- If the parameter is a Pydantic model → **request body** (JSON)
- If you use `Header(...)` → **HTTP header**

`Query(default=None, ge=1)` and `Path(...)` are optional wrappers that let you add constraints and descriptions — the same `Field()` style you learned in Pydantic chapter.

`status_code=201` on `@app.post` — 201 means "Created", the correct HTTP status for a resource that was just created (200 means "OK" for a read).

---
## 3. Response Models — Control What Gets Returned

By default FastAPI returns whatever your function returns.
`response_model=` tells FastAPI to:
1. Validate the return value against a Pydantic model
2. **Strip any extra fields** (security: don't accidentally leak passwords)
3. Show the correct schema in the auto-docs

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
RESPONSE_MODELS_DEMO = """
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

app = FastAPI()

# Internal model has sensitive fields
class DeploymentInDB(BaseModel):
    id: str
    service_name: str
    image_tag: str
    environment: str
    status: str
    created_by: str
    # Sensitive — should NOT be returned to clients
    internal_token: str
    deploy_key: str

# Public model — only safe fields
class DeploymentPublic(BaseModel):
    id: str
    service_name: str
    image_tag: str
    environment: str
    status: str

# Fake DB
fake_db = {
    "dep-001": DeploymentInDB(
        id="dep-001", service_name="auth-api", image_tag="v2.0",
        environment="prod", status="running",
        created_by="ci-user",
        internal_token="SECRET_TOKEN_DONT_LEAK",
        deploy_key="PRIVATE_KEY_DONT_LEAK",
    )
}

# response_model strips internal_token and deploy_key from the response
@app.get("/deployments/{deployment_id}", response_model=DeploymentPublic)
def get_deployment(deployment_id: str):
    dep = fake_db.get(deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep   # FastAPI filters this through DeploymentPublic — secrets stripped!


# response_model_exclude_unset: don't include fields that weren't explicitly set
# Useful for PATCH endpoints where you only return changed fields
@app.get("/deployments", response_model=List[DeploymentPublic])
def list_deployments():
    return list(fake_db.values())
"""
print(RESPONSE_MODELS_DEMO)
```

</div>

### What just happened?
`response_model=DeploymentPublic` tells FastAPI to **filter the response** through that Pydantic model before sending it.

This is a security feature. Our internal `DeploymentInDB` object has `internal_token` and `deploy_key` fields. Without `response_model`, those would leak to the client. With it, FastAPI runs the return value through `DeploymentPublic` — only fields declared in `DeploymentPublic` pass through.

This means you can safely return your full internal object from the function — FastAPI strips anything that shouldn't be public. No need to manually build a separate dict.

`response_model` also tells the Swagger docs what shape the response will be, so clients know what to expect.

---
## 4. Dependency Injection — Auth, DB, Settings

Dependency injection is one of FastAPI's most powerful features.
It lets you:
- Share database connections across requests
- Centralize authentication
- Inject settings without global variables
- Write testable code (swap real deps for mocks in tests)

`Depends()` is FastAPI's DI system — it calls your "dependency function" and injects the result.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
DEPENDENCY_DEMO = """
from fastapi import FastAPI, Depends, HTTPException, Header
from typing import Optional, Annotated

app = FastAPI()

# ── Dependency: current user from token ────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    Extract and verify the current user from the Authorization header.
    Real implementation would verify a JWT token.
    This function is called automatically for routes that Depends() on it.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.removeprefix("Bearer ").strip()
    # In reality: decode JWT, lookup user in DB, etc.
    fake_users = {"token-alice": {"id": 1, "username": "alice", "role": "admin"},
                  "token-bob":   {"id": 2, "username": "bob",   "role": "viewer"}}
    user = fake_users.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that depends on another dependency."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return current_user

# ── Dependency: database session ───────────────────────────────────────────
class FakeDB:
    def __init__(self): self.closed = False
    def query(self, q): return [{"id": 1, "name": "result"}]
    def close(self): self.closed = True

def get_db():
    """
    Yield a DB session, ensuring it's closed after the request.
    Using yield makes this a context manager — cleanup happens after response.
    """
    db = FakeDB()
    try:
        yield db
    finally:
        db.close()

# ── Routes using dependencies ──────────────────────────────────────────────

# Annotated[type, Depends(...)] is the modern FastAPI syntax (cleaner)
CurrentUser = Annotated[dict, Depends(get_current_user)]
AdminUser   = Annotated[dict, Depends(require_admin)]
DBSession   = Annotated[FakeDB, Depends(get_db)]

@app.get("/deployments")
def list_deployments(user: CurrentUser, db: DBSession):
    # user is automatically injected — comes from get_current_user()
    # db is automatically injected — comes from get_db()
    results = db.query("SELECT * FROM deployments")
    return {"user": user["username"], "deployments": results}

@app.delete("/deployments/{dep_id}")
def delete_deployment(dep_id: str, admin: AdminUser, db: DBSession):
    # Only admins can delete — require_admin() handles the check
    return {"deleted": dep_id, "by": admin["username"]}
"""
print(DEPENDENCY_DEMO)
```

</div>

### What just happened?
`Depends()` is FastAPI's **dependency injection** system — one of its most powerful features.

When FastAPI calls your route function:
1. It sees `user: CurrentUser` which is `Annotated[dict, Depends(get_current_user)]`
2. It calls `get_current_user(authorization=...)` first, injecting the `Authorization` header
3. If that succeeds, the result becomes the `user` argument in your route

**Chained dependencies**: `require_admin` itself `Depends(get_current_user)` — so FastAPI resolves the whole chain automatically. Your route just asks for `admin: AdminUser` and gets a verified admin dict.

**`yield` in `get_db()`** makes it a generator dependency — code before `yield` runs before the route, code after `yield` runs after the route (cleanup). This is how database sessions are managed — open before, close after, guaranteed.

`Annotated[dict, Depends(...)]` is the modern style — it keeps the type hint (`dict`) separate from the dependency declaration.

---
## 5. Error Handling

FastAPI gives you `HTTPException` for structured HTTP errors.
You can also register custom exception handlers for application-level errors.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
ERROR_HANDLING_DEMO = """
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import Optional

app = FastAPI()

# ── Custom application exceptions ─────────────────────────────────────────
class DeploymentNotFoundError(Exception):
    def __init__(self, deployment_id: str):
        self.deployment_id = deployment_id

class DeploymentConflictError(Exception):
    def __init__(self, service: str, environment: str):
        self.service = service
        self.environment = environment

# ── Register handlers for custom exceptions ────────────────────────────────
@app.exception_handler(DeploymentNotFoundError)
async def not_found_handler(request: Request, exc: DeploymentNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"error": "not_found", "detail": f"Deployment {exc.deployment_id!r} not found"},
    )

@app.exception_handler(DeploymentConflictError)
async def conflict_handler(request: Request, exc: DeploymentConflictError):
    return JSONResponse(
        status_code=409,
        content={
            "error": "conflict",
            "detail": f"A deployment of {exc.service!r} to {exc.environment!r} is already running",
        },
    )

# ── Routes ────────────────────────────────────────────────────────────────
fake_active = {"auth-api/prod": "dep-001"}

@app.get("/deployments/{dep_id}")
def get_deployment(dep_id: str):
    if dep_id == "dep-000":
        raise HTTPException(status_code=404, detail="Deployment not found")
    if dep_id == "dep-999":
        raise DeploymentNotFoundError(dep_id)   # uses our custom handler
    return {"id": dep_id, "status": "running"}

class CreateRequest(BaseModel):
    service_name: str
    environment: str

@app.post("/deployments", status_code=201)
def create_deployment(req: CreateRequest):
    key = f"{req.service_name}/{req.environment}"
    if key in fake_active:
        raise DeploymentConflictError(req.service_name, req.environment)
    return {"id": "dep-new", "service": req.service_name}
"""
print(ERROR_HANDLING_DEMO)
```

</div>

### What just happened?
FastAPI has two error mechanisms:

1. **`HTTPException`** — for expected HTTP errors. `raise HTTPException(status_code=404, detail="...")` immediately stops the route and sends a JSON error response `{"detail": "..."}`. This is the most common pattern.

2. **Custom exception handlers** — for application-level exceptions that don't know about HTTP. `@app.exception_handler(MyException)` registers a function that converts `MyException` into a JSON response. This keeps your business logic clean — the `Service` layer raises `DeploymentNotFoundError` (a domain concept), and the handler translates it to HTTP 404.

The advantage of custom handlers: your business logic code doesn't need to import `fastapi` or know about HTTP status codes.

---
## 6. Background Tasks

Sometimes you want to respond immediately but do work after the response is sent.
FastAPI's `BackgroundTasks` handles this cleanly.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
BACKGROUND_TASKS_DEMO = """
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import time, logging

logger = logging.getLogger(__name__)
app = FastAPI()

# ── Background functions (run AFTER the response is sent) ──────────────────

def send_deploy_notification(service: str, environment: str, status: str) -> None:
    """Simulate sending a Slack/email notification."""
    time.sleep(1)   # simulate network call
    logger.info(f"Notification sent: {service} → {environment}: {status}")

def update_deployment_registry(deployment_id: str, metadata: dict) -> None:
    """Update an external service registry asynchronously."""
    time.sleep(0.5)
    logger.info(f"Registry updated for {deployment_id}: {metadata}")

# ── Route using background tasks ───────────────────────────────────────────
class CreateDeploymentRequest(BaseModel):
    service_name: str
    environment: str
    image_tag: str

@app.post("/deployments", status_code=202)   # 202 = Accepted (processing async)
def create_deployment(
    req: CreateDeploymentRequest,
    background_tasks: BackgroundTasks,
):
    # Do the critical work synchronously
    deployment_id = f"dep-{req.service_name}-{req.environment}"

    # Schedule non-critical work for AFTER the response is sent
    # Client doesn't wait for these
    background_tasks.add_task(
        send_deploy_notification,
        service=req.service_name,
        environment=req.environment,
        status="initiated",
    )
    background_tasks.add_task(
        update_deployment_registry,
        deployment_id=deployment_id,
        metadata={"image": req.image_tag, "env": req.environment},
    )

    # Response is sent immediately — background tasks run after
    return {
        "id": deployment_id,
        "status": "accepted",
        "message": "Deployment initiated. Notifications will be sent shortly.",
    }
"""
print(BACKGROUND_TASKS_DEMO)
```

</div>

### What just happened?
`BackgroundTasks` lets you schedule work to happen **after the response is sent**.

The flow:
1. Client sends POST `/deployments`
2. FastAPI calls your route function
3. Route creates the deployment record (fast, synchronous)
4. Route calls `background_tasks.add_task(send_notification, ...)` — this *schedules* the task, doesn't run it yet
5. Route returns the response immediately — client gets `202 Accepted` right away
6. **After** the response is sent, FastAPI runs the background tasks

`status_code=202` means "Accepted" — I received your request and am processing it asynchronously. 201 would mean it's fully created right now.

Use background tasks for things the client doesn't need to wait for: notifications, audit logs, cache invalidation, updating a registry.

---
## 7. The Complete Working API

Now let's put it all together into a **complete, runnable** deployment management API.
Save this to `deployment_api.py` and run with `uvicorn deployment_api:app --reload`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
FULL_APP = """
# deployment_api.py
# Run with: uvicorn deployment_api:app --reload --port 8000
# Docs at:  http://localhost:8000/docs

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Path, Header
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Dict, Annotated
from datetime import datetime
from enum import Enum
import uuid, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Settings ─────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DEPLOY_", extra="ignore")
    api_title: str = "Deployment API"
    api_version: str = "1.0.0"
    debug: bool = False
    admin_token: str = "admin-secret"

def get_settings() -> Settings:
    return Settings()


# ── Enums ─────────────────────────────────────────────────────────────────

class Environment(str, Enum):
    DEV     = "dev"
    STAGING = "staging"
    PROD    = "prod"

class DeploymentStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    SUCCESS   = "success"
    FAILED    = "failed"


# ── Pydantic models ───────────────────────────────────────────────────────

class CreateDeploymentRequest(BaseModel):
    service_name: str   = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag: str      = Field(..., min_length=1)
    environment: Environment
    replicas: int       = Field(default=1, ge=1, le=20)

    @field_validator("image_tag")
    @classmethod
    def tag_not_latest_in_prod(cls, v, info):
        # Access other fields via info.data
        env = info.data.get("environment")
        if env == Environment.PROD and v == "latest":
            raise ValueError("Cannot deploy 'latest' tag to production")
        return v

class UpdateReplicasRequest(BaseModel):
    replicas: int = Field(..., ge=0, le=20)

class DeploymentResponse(BaseModel):
    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    status: DeploymentStatus
    created_at: datetime
    updated_at: datetime


# ── In-memory store (replace with real DB in Chapter 6) ───────────────────

_store: Dict[str, dict] = {}


# ── Dependencies ──────────────────────────────────────────────────────────

def get_current_user(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return authorization.removeprefix("Bearer ").strip()

def require_admin(
    token: str = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> str:
    if token != settings.admin_token:
        raise HTTPException(403, "Admin access required")
    return token


# ── App ───────────────────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="Tracks and manages service deployments",
)


# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
def health():
    return {"status": "healthy", "version": settings.api_version}


@app.post("/deployments", response_model=DeploymentResponse, status_code=201,
          tags=["deployments"])
def create_deployment(
    req: CreateDeploymentRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[str, Depends(get_current_user)],
):
    dep_id = f"dep-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    deployment = {
        "id": dep_id,
        "service_name": req.service_name,
        "image_tag": req.image_tag,
        "environment": req.environment.value,
        "replicas": req.replicas,
        "status": DeploymentStatus.PENDING.value,
        "created_at": now,
        "updated_at": now,
        "created_by": user,
    }
    _store[dep_id] = deployment

    def start_deploy():
        import time; time.sleep(0.5)
        _store[dep_id]["status"] = DeploymentStatus.RUNNING.value
        logger.info(f"Deployment {dep_id} is now RUNNING")

    background_tasks.add_task(start_deploy)
    return deployment


@app.get("/deployments", response_model=List[DeploymentResponse], tags=["deployments"])
def list_deployments(
    environment: Optional[Environment] = Query(default=None),
    status: Optional[DeploymentStatus] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    items = list(_store.values())
    if environment:
        items = [d for d in items if d["environment"] == environment.value]
    if status:
        items = [d for d in items if d["status"] == status.value]
    start = (page - 1) * page_size
    return items[start: start + page_size]


@app.get("/deployments/{deployment_id}", response_model=DeploymentResponse,
         tags=["deployments"])
def get_deployment(deployment_id: str = Path(..., min_length=1)):
    dep = _store.get(deployment_id)
    if not dep:
        raise HTTPException(404, f"Deployment {deployment_id!r} not found")
    return dep


@app.patch("/deployments/{deployment_id}/replicas",
           response_model=DeploymentResponse, tags=["deployments"])
def update_replicas(
    deployment_id: str,
    req: UpdateReplicasRequest,
    admin: Annotated[str, Depends(require_admin)],
):
    dep = _store.get(deployment_id)
    if not dep:
        raise HTTPException(404, f"Deployment {deployment_id!r} not found")
    dep["replicas"] = req.replicas
    dep["updated_at"] = datetime.utcnow()
    return dep


@app.delete("/deployments/{deployment_id}", status_code=204, tags=["deployments"])
def delete_deployment(
    deployment_id: str,
    admin: Annotated[str, Depends(require_admin)],
):
    if deployment_id not in _store:
        raise HTTPException(404, f"Deployment {deployment_id!r} not found")
    del _store[deployment_id]
"""

# Write the API to a file so you can actually run it
import os
api_path = os.path.join(os.path.dirname(os.path.abspath("__file__")), "deployment_api.py")
with open(api_path, "w") as f:
    f.write(FULL_APP.strip())
print(f"Saved to: {api_path}")
print()
print("To run:")
print("  uvicorn deployment_api:app --reload --port 8000")
print()
print("Then visit:")
print("  http://localhost:8000/docs    ← Swagger UI")
print("  http://localhost:8000/redoc   ← ReDoc")
```

</div>

### What just happened?
We wrote the complete `deployment_api.py` to disk — a fully working FastAPI application.

Key things in the full app worth noting:

- **`@field_validator` with `info.data`** — accessing `environment` (a sibling field) inside the validator for `image_tag`. This lets us enforce "no `latest` tag in production".
- **`Annotated` type aliases** — `CurrentUser = Annotated[dict, Depends(get_current_user)]` and `DB = Annotated[...Depends(get_db)]`. Defining these once at the top and reusing them in every route keeps things DRY.
- **`BackgroundTasks`** — the deploy route uses a background task to update status after responding
- **In-memory dict `_store`** — fine for learning, but in production this is replaced with a real database (Chapter 6)

To run: `uvicorn deployment_api:app --reload` then open `http://localhost:8000/docs`

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
# Test the API in-process using FastAPI's TestClient (no server needed)
# This is how you write tests for FastAPI apps

# pip install httpx  (TestClient uses httpx under the hood)
import sys, os, importlib.util

# Load the deployment_api module we just wrote
spec = importlib.util.spec_from_file_location("deployment_api", "deployment_api.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
app = module.app

from fastapi.testclient import TestClient

client = TestClient(app)

print("=== Testing Deployment API ===\n")

# Health check
r = client.get("/health")
print(f"GET /health → {r.status_code}: {r.json()}")

# Create deployment (requires auth header)
r = client.post(
    "/deployments",
    json={"service_name": "auth-api", "image_tag": "v2.1.0", "environment": "prod", "replicas": 3},
    headers={"Authorization": "Bearer some-user-token"},
)
print(f"\nPOST /deployments → {r.status_code}: {r.json()}")
dep_id = r.json()["id"]

# Get by ID
r = client.get(f"/deployments/{dep_id}", headers={"Authorization": "Bearer some-user-token"})
print(f"\nGET /deployments/{dep_id} → {r.status_code}: {r.json()}")

# List with filter
r = client.get("/deployments?environment=prod", headers={"Authorization": "Bearer some-user-token"})
print(f"\nGET /deployments?environment=prod → {r.status_code}: {len(r.json())} items")

# Update replicas (admin only)
r = client.patch(
    f"/deployments/{dep_id}/replicas",
    json={"replicas": 5},
    headers={"Authorization": "Bearer admin-secret"},
)
print(f"\nPATCH /deployments/{dep_id}/replicas → {r.status_code}: replicas={r.json()['replicas']}")

# Try to update replicas as non-admin
r = client.patch(
    f"/deployments/{dep_id}/replicas",
    json={"replicas": 1},
    headers={"Authorization": "Bearer not-admin"},
)
print(f"\nPATCH as non-admin → {r.status_code}: {r.json()}")

# Validation error — 'latest' not allowed in prod
r = client.post(
    "/deployments",
    json={"service_name": "user-svc", "image_tag": "latest", "environment": "prod"},
    headers={"Authorization": "Bearer user-token"},
)
print(f"\nPOST with 'latest' in prod → {r.status_code} (expected 422)")

# 404
r = client.get("/deployments/dep-nonexistent", headers={"Authorization": "Bearer t"})
print(f"\nGET nonexistent → {r.status_code}: {r.json()}")
```

</div>

### What just happened?
`TestClient` from `fastapi.testclient` lets you test your API without running a real server.

It works by simulating HTTP requests directly against your `app` object — no network involved. This makes tests fast and reliable.

Notice what we tested:
- **Happy path**: create → get → list with filter → update replicas
- **Auth failure**: non-admin trying to delete (403)
- **Validation failure**: `latest` tag in prod (422 Unprocessable Entity — Pydantic caught it)
- **404**: getting a non-existent deployment

422 is FastAPI's standard response for Pydantic validation errors — it includes field-level details in the response body so clients know exactly what was wrong.

This is the exact pattern used in real FastAPI projects — write your routes, test them with `TestClient`, no mocking needed.

---
## Quick Reference

### Route decorators
```python
@app.get("/path")          # Read
@app.post("/path")         # Create
@app.put("/path/{id}")     # Replace
@app.patch("/path/{id}")   # Partial update
@app.delete("/path/{id}")  # Delete
```

### Parameter types
```python
def route(
    item_id: int,                              # path param (in URL pattern)
    q: Optional[str] = None,                   # query param (?q=value)
    body: MyModel = Body(...),                 # request body
    token: str = Header(...),                  # HTTP header
    user = Depends(get_current_user),          # dependency injection
):
```

### Response control
```python
@app.get("/items", response_model=List[ItemOut])   # strips hidden fields
@app.post("/items", status_code=201)               # custom status code
raise HTTPException(status_code=404, detail="Not found")
```

### Testing
```python
from fastapi.testclient import TestClient
client = TestClient(app)
r = client.get("/health")
assert r.status_code == 200
```

## Next Chapter
**Chapter 6: SQLAlchemy Async** — replace the in-memory dict in our API with a real
PostgreSQL database using async SQLAlchemy.

---
## Add-on: API Project Structure and Operational Middleware

Once you move beyond a single file, API design is not just about routes.
It is also about structure, traceability, and cross-cutting behavior.

For a DevOps engineer, a good FastAPI app should feel observable and maintainable.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
PROJECT_LAYOUT = """
myapi/
  app/
    main.py
    routes/
      deployments.py
      health.py
    schemas/
      deployment.py
    services/
      deployment_service.py
    dependencies/
      auth.py
      db.py
    middleware/
      request_id.py
    config.py
  tests/
    test_deployments.py
    test_health.py
"""

print(PROJECT_LAYOUT)
print('Rule of thumb: routes stay thin, business logic moves to services, schemas stay in one place.')
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
REQUEST_ID_MIDDLEWARE = """
from uuid import uuid4
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get('X-Request-ID', str(uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        return response

app = FastAPI()
app.add_middleware(RequestIDMiddleware)
"""

print(REQUEST_ID_MIDDLEWARE)
```

</div>

### Why this add-on matters

A lot of candidates can explain `@app.get()`.
Fewer can explain how they keep an API maintainable once it grows.

Strong interview signals:
- "I keep route handlers thin and push logic into services."
- "I add request IDs for traceability."
- "I separate schemas, dependencies, and business logic into modules."

That moves your answer from framework knowledge to engineering maturity.

---
## Practice Questions

---

### Question 1 — Build a Routes

Add a new endpoint to the `deployment_api.py` we created:

```
GET /deployments/summary
```

It should return a summary dict like:
```json
{
  "total": 5,
  "by_environment": {"prod": 2, "staging": 2, "dev": 1},
  "by_status": {"pending": 1, "running": 3, "success": 1}
}
```

Requirements:
- Needs the `Authorization` header (use `Depends(get_current_user)`)
- Use `response_model` with a Pydantic model called `DeploymentSummary`
- Test it with `TestClient`

Hint: loop over `_store.values()` and use a `Counter` or a `defaultdict(int)`.

---

### Question 2 — Dependency Injection

Create a new dependency function `get_pagination(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100))` that returns a tuple `(offset, limit)`.

Use it in the `GET /deployments` route:
```python
def list_deployments(
    pagination: Annotated[tuple, Depends(get_pagination)],
    ...
):
    offset, limit = pagination
    ...
```

This is a common real-world pattern — extract repeated query parameters into a shared dependency so every paginated route gets them automatically.

Test that `GET /deployments?page=2&page_size=2` returns the correct slice of results.
