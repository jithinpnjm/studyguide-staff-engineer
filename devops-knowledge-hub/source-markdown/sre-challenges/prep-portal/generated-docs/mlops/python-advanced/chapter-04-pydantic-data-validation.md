---
title: "Chapter 04 Pydantic Data Validation"
description: "Generated from mlops/PYTHON/Advanced/chapter_04_pydantic_data_validation.ipynb"
slug: "/python-advanced/chapter-04-pydantic-data-validation"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_04_pydantic_data_validation.ipynb</code></div>

# Chapter 4: Pydantic — Data Validation & Settings

Before we build APIs with FastAPI, we need to understand **Pydantic** — because FastAPI is
essentially a thin layer on top of Pydantic.

**What is Pydantic?**
Pydantic is a data validation library that uses Python **type hints** to validate and
parse data at runtime. You declare what shape your data should be, and Pydantic enforces it.

## Why this matters in real work
Every time your service receives data from outside — an HTTP request body, a config file,
an environment variable, a database row — that data is **untrusted**. It could be:
- Missing a required field
- The wrong type ("port" came in as `"8080"` string instead of `8080` int)
- Out of range (negative replica count)
- Malformed (invalid email, bad URL)

Pydantic catches all of this **before** the data touches your business logic.

## What we cover
| Section | Topic |
|---------|-------|
| 1 | **BaseModel** — defining data schemas |
| 2 | **Field()** — constraints, defaults, aliases |
| 3 | **Validators** — custom validation logic |
| 4 | **Nested models** — complex structures |
| 5 | **Parsing real data** — JSON, dicts, coercion |
| 6 | **BaseSettings** — typed environment config |
| 7 | **Real-world project** — API response models + app settings |

```bash
pip install pydantic pydantic-settings python-dotenv
```

---
## 1. BaseModel — Your First Pydantic Model

A Pydantic model is a class that inherits from `BaseModel`.
You declare fields with type hints, and Pydantic handles the rest.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
from pydantic import BaseModel
from typing import Optional, List

# Define a model — just like a dataclass, but with validation baked in
class ServiceConfig(BaseModel):
    name: str
    host: str
    port: int
    ssl: bool = True          # default value
    replicas: int = 1

# Create an instance — Pydantic validates as it creates
cfg = ServiceConfig(name="auth-api", host="auth.internal", port=8080)
print(cfg)
print(f"port type: {type(cfg.port)}")   # always int, even if "8080" was passed

# Pydantic auto-coerces types where safe
cfg2 = ServiceConfig(name="db", host="db.internal", port="5432")   # port as string!
print(f"port from string: {cfg2.port!r} (type={type(cfg2.port).__name__})")

# .model_dump() → plain dictionary (useful for JSON serialization)
print(cfg.model_dump())

# .model_dump_json() → JSON string
print(cfg.model_dump_json())
```

</div>

### What just happened?
We defined our first Pydantic model by inheriting from `BaseModel`.

Three things Pydantic gives you for free just from that class definition:
1. **Validation at creation time** — `ServiceConfig(name="auth", host="h", port="8080")` works even though `port` was a string. Pydantic coerces `"8080"` → `8080` automatically.
2. **Nice `__repr__`** — `print(cfg)` shows a readable summary
3. **`.model_dump()`** — converts the object back to a plain Python dict
4. **`.model_dump_json()`** — converts directly to a JSON string

The coercion line is important: `port="5432"` (a string) becomes `port=5432` (an int). Pydantic is smart enough to do safe type conversions. It won't coerce `port="abc"` though — that would raise a `ValidationError`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
# Pydantic catches invalid data immediately — at construction time
from pydantic import BaseModel, ValidationError

class Deployment(BaseModel):
    service: str
    environment: str
    replicas: int

# Pass completely wrong data
try:
    bad = Deployment(service="auth", environment="prod", replicas="not-a-number")
except ValidationError as e:
    print("ValidationError caught:")
    for err in e.errors():
        print(f"  field={err['loc']}  type={err['type']}  msg={err['msg']}")

# Missing required field
try:
    bad2 = Deployment(service="auth", replicas=3)   # environment is missing
except ValidationError as e:
    print("\nMissing field error:")
    for err in e.errors():
        print(f"  field={err['loc']}  msg={err['msg']}")
```

</div>

### What just happened?
Pydantic raises `ValidationError` when data doesn't match the model — not a generic `TypeError` or `ValueError`, but a structured error with field-level details.

Each error in `e.errors()` is a dict with:
- `loc` — which field failed (e.g. `('replicas',)`)
- `type` — the category of error (e.g. `int_parsing`)
- `msg` — human-readable explanation

This is extremely useful in APIs — you can forward these errors directly to the client so they know exactly which field was wrong and why. FastAPI does this automatically (Chapter 5).

Notice the second example catches a **missing required field** — `environment` has no default and wasn't provided, so Pydantic reports it as `missing`.

---
## 2. Field() — Constraints, Defaults, Aliases, Descriptions

`Field()` lets you add extra rules to individual fields beyond just the type.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
from pydantic import BaseModel, Field
from typing import Optional

class ServiceConfig(BaseModel):
    # Field(default, constraints...)
    name: str          = Field(..., min_length=2, max_length=50,
                               description="Unique service name")
    host: str          = Field(..., description="Hostname or IP")
    port: int          = Field(..., ge=1, le=65535,
                               description="Port number (1-65535)")
    replicas: int      = Field(default=1, ge=1, le=100)
    environment: str   = Field(default="dev",
                               pattern="^(dev|staging|prod)$")
    # alias: the field is stored as 'max_conn' but JSON uses 'maxConnections'
    max_conn: int      = Field(default=100, alias="maxConnections", ge=1)

# Creating with Python names
cfg = ServiceConfig(name="auth-api", host="auth.internal", port=8080,
                    environment="prod", maxConnections=200)
print(cfg)
print(f"max_conn: {cfg.max_conn}")

# Creating from JSON with alias names
import json
json_data = '{"name": "user-svc", "host": "users.internal", "port": 8081, "maxConnections": 50}'
cfg2 = ServiceConfig.model_validate_json(json_data)
print(f"\nFrom JSON: {cfg2}")

# Validation catches constraint violations
from pydantic import ValidationError
try:
    bad = ServiceConfig(name="x", host="h", port=99999)  # port > 65535
except ValidationError as e:
    print(f"\nConstraint violation: {e.errors()[0]['msg']}")
```

</div>

### What just happened?
`Field()` adds extra rules beyond just the type.

Common constraints:
- `...` (three dots) as the first argument means **required** (same as no default)
- `min_length=2, max_length=50` — string length bounds
- `ge=1, le=65535` — `ge` = greater-than-or-equal, `le` = less-than-or-equal (for numbers)
- `pattern="^(dev|staging|prod)$"` — regex pattern the string must match
- `alias="maxConnections"` — the field is stored as `max_conn` in Python but the JSON key is `maxConnections`

The alias is important for real-world APIs that use camelCase in JSON but you prefer snake_case in Python. `model_validate_json()` parses the raw JSON string using aliases.

---
## 3. Validators — Custom Validation Logic

Sometimes the constraint you need can't be expressed with `ge=`, `le=`, `pattern=`.
`@field_validator` lets you write any Python code to validate a field.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
import re

class DeploymentRequest(BaseModel):
    service_name: str
    image_tag: str          # e.g. "v2.1.0" or "sha256:abc123"
    environment: str
    replicas: int = Field(default=1, ge=1)
    notify_email: Optional[str] = None

    @field_validator("service_name")
    @classmethod
    def service_name_must_be_kebab_case(cls, v: str) -> str:
        """Service names must be lowercase kebab-case: auth-api, user-svc"""
        if not re.match(r'^[a-z][a-z0-9-]*$', v):
            raise ValueError(
                f"service_name must be lowercase kebab-case (e.g. 'auth-api'), got: {v!r}"
            )
        return v

    @field_validator("image_tag")
    @classmethod
    def validate_image_tag(cls, v: str) -> str:
        """Must be a semver tag or a SHA256 digest."""
        semver = re.match(r'^v\d+\.\d+\.\d+', v)
        sha    = re.match(r'^sha256:[a-f0-9]{64}$', v)
        if not (semver or sha):
            raise ValueError(
                f"image_tag must be semver (v1.2.3) or sha256 digest, got: {v!r}"
            )
        return v

    @field_validator("notify_email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError(f"Invalid email: {v!r}")
        return v.lower()

    # model_validator runs after ALL fields are validated — can cross-check fields
    @model_validator(mode="after")
    def prod_requires_multiple_replicas(self) -> "DeploymentRequest":
        if self.environment == "prod" and self.replicas < 2:
            raise ValueError("Production deployments require at least 2 replicas")
        return self

from pydantic import ValidationError

# Valid request
req = DeploymentRequest(
    service_name="auth-api",
    image_tag="v2.1.0",
    environment="prod",
    replicas=3,
    notify_email="OPS@EXAMPLE.COM",   # will be lowercased
)
print(f"Valid: {req}")
print(f"Email normalized: {req.notify_email}")

# Invalid service name
try:
    DeploymentRequest(service_name="AuthAPI", image_tag="v1.0.0", environment="dev")
except ValidationError as e:
    print(f"\nInvalid name: {e.errors()[0]['msg']}")

# Cross-field validation failure
try:
    DeploymentRequest(service_name="auth-api", image_tag="v1.0.0",
                      environment="prod", replicas=1)
except ValidationError as e:
    print(f"Cross-field: {e.errors()[0]['msg']}")
```

</div>

### What just happened?
`@field_validator` lets you write **any Python code** to validate a field — you're not limited to simple constraints.

Things to notice:
- `@classmethod` is required — Pydantic calls validators as class methods
- The method receives the value `v` and must either return it (valid) or raise `ValueError` (invalid)
- You can also **transform** the value — `return v.lower()` normalises the email
- Multiple validators can stack on the same field

`@model_validator(mode="after")` runs after ALL fields are validated. It receives `self` (the fully constructed model) and can check relationships between fields. Here we enforce "prod needs ≥2 replicas" — a rule that depends on two fields at once.

The `info.data` inside `@field_validator` gives you access to other already-validated fields.

---
## 4. Nested Models — Complex Data Structures

Real-world data is nested. A deployment has a service, which has an endpoint,
which has health check config... Pydantic handles arbitrary nesting.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

class HealthCheckConfig(BaseModel):
    path: str = "/health"
    interval_seconds: int = Field(default=30, ge=5)
    timeout_seconds: int = Field(default=5, ge=1)
    healthy_threshold: int = Field(default=2, ge=1)
    unhealthy_threshold: int = Field(default=3, ge=1)

class ResourceLimits(BaseModel):
    cpu_millicores: int = Field(default=500, ge=100)   # 500m = 0.5 CPU
    memory_mb: int = Field(default=512, ge=64)

class ContainerSpec(BaseModel):
    image: str
    tag: str = "latest"
    port: int = Field(..., ge=1, le=65535)
    env_vars: Dict[str, str] = Field(default_factory=dict)
    resources: ResourceLimits = Field(default_factory=ResourceLimits)
    health_check: HealthCheckConfig = Field(default_factory=HealthCheckConfig)

class DeploymentSpec(BaseModel):
    name: str
    namespace: str = "default"
    replicas: int = Field(default=1, ge=0)
    containers: List[ContainerSpec]
    labels: Dict[str, str] = Field(default_factory=dict)
    annotations: Dict[str, str] = Field(default_factory=dict)

# Build a realistic deployment spec
spec = DeploymentSpec(
    name="auth-api",
    namespace="production",
    replicas=3,
    containers=[
        ContainerSpec(
            image="company/auth-api",
            tag="v2.1.0",
            port=8080,
            env_vars={
                "LOG_LEVEL": "INFO",
                "DB_POOL_SIZE": "10",
            },
            resources=ResourceLimits(cpu_millicores=1000, memory_mb=1024),
            health_check=HealthCheckConfig(path="/v1/health", interval_seconds=15),
        )
    ],
    labels={"app": "auth-api", "team": "platform", "tier": "backend"},
)

print(spec.model_dump_json(indent=2))
```

</div>

### What just happened?
Pydantic models can nest inside each other — `DeploymentSpec` contains a list of `ContainerSpec`, which contains a `ResourceLimits` and a `HealthCheckConfig`.

Each nested model is validated independently. If `cpu_millicores=-100` inside `ResourceLimits`, Pydantic catches it at the `ResourceLimits` level and reports the full path like `containers.0.resources.cpu_millicores`.

`field(default_factory=ResourceLimits)` — when a field's default is a mutable object (like another model), use `default_factory` so each instance gets its own copy.

`model_dump_json(indent=2)` serialises the entire nested structure to a nicely formatted JSON string — great for logging, storing in a database, or sending over HTTP.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
# Parsing nested data from a dict (e.g., from an API response or config file)
import json

raw_json = """
{
    "name": "user-service",
    "namespace": "production",
    "replicas": 2,
    "containers": [
        {
            "image": "company/user-svc",
            "tag": "v1.5.3",
            "port": 8081,
            "env_vars": {"CACHE_TTL": "300"},
            "resources": {"cpu_millicores": 500, "memory_mb": 512}
        }
    ],
    "labels": {"app": "user-svc"}
}
"""

spec = DeploymentSpec.model_validate_json(raw_json)
print(f"Parsed: {spec.name} with {len(spec.containers)} container(s)")
print(f"Container image: {spec.containers[0].image}:{spec.containers[0].tag}")
print(f"Health check: {spec.containers[0].health_check.path} every {spec.containers[0].health_check.interval_seconds}s")

# Update a nested field (Pydantic models are immutable by default, use model_copy)
updated = spec.model_copy(
    update={"replicas": 5, "labels": {**spec.labels, "version": "v1.5.3"}}
)
print(f"\nUpdated replicas: {updated.replicas}")
print(f"Updated labels: {updated.labels}")
```

</div>

### What just happened?
`model_validate_json(raw_json)` parses a raw JSON string directly into a Pydantic model — it handles the parsing AND validation in one step.

`model_copy(update={...})` creates a **new instance** with some fields changed. Pydantic models are not frozen by default, but `model_copy` is the idiomatic way to create a modified version — it's explicit and makes it clear you're creating a new object.

Notice `{**spec.labels, "version": "v1.5.3"}` — this spreads the existing labels dict and adds one new key. Standard Python dict merging.

---
## 5. Parsing Real Data — API Responses, Coercion, Partial Data

Pydantic is excellent for parsing data coming from external sources where you
don't control the shape (APIs, webhooks, database rows).

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime

# Model for a GitHub-style API response
class GitHubUser(BaseModel):
    login: str
    id: int
    node_id: str
    avatar_url: str
    html_url: str
    type: str
    site_admin: bool = False

class GitHubRepo(BaseModel):
    id: int
    name: str
    full_name: str
    private: bool
    owner: GitHubUser     # nested model!
    html_url: str
    description: Optional[str] = None
    fork: bool = False
    stargazers_count: int = 0
    watchers_count: int = 0
    forks_count: int = 0
    open_issues_count: int = 0
    default_branch: str = "main"
    # GitHub returns ISO datetime strings — Pydantic auto-parses them
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    pushed_at: Optional[datetime] = None

# Simulate a raw API response dict (with extra unknown fields)
raw_api_response = {
    "id": 123456,
    "name": "myapp",
    "full_name": "myorg/myapp",
    "private": False,
    "owner": {
        "login": "myorg",
        "id": 9999,
        "node_id": "abc",
        "avatar_url": "https://avatars.githubusercontent.com/u/9999",
        "html_url": "https://github.com/myorg",
        "type": "Organization",
        "site_admin": False,
        # Lots of extra fields from the real API — Pydantic ignores them by default
        "gravatar_id": "",
        "url": "https://api.github.com/orgs/myorg",
        "repos_url": "...",
    },
    "html_url": "https://github.com/myorg/myapp",
    "description": "My application",
    "fork": False,
    "stargazers_count": 42,
    "forks_count": 7,
    "open_issues_count": 3,
    "default_branch": "main",
    "created_at": "2023-01-15T10:30:00Z",
    "updated_at": "2025-01-10T14:22:00Z",
    "pushed_at": "2025-01-10T14:20:00Z",
    # unknown fields — Pydantic ignores these
    "subscribers_url": "...",
    "deployments_url": "...",
    "git_refs_url": "...",
}

repo = GitHubRepo.model_validate(raw_api_response)
print(f"Repo: {repo.full_name}")
print(f"Owner: {repo.owner.login} (type={repo.owner.type})")
print(f"Stars: {repo.stargazers_count}")
print(f"Created: {repo.created_at.strftime('%Y-%m-%d')}")
print(f"Updated: {repo.updated_at.strftime('%Y-%m-%d %H:%M')}")
```

</div>

### What just happened?
This is a realistic scenario: you call an API and get back a huge JSON dict with 30+ fields, but you only care about 10 of them.

By default Pydantic **ignores extra fields** — all those `subscribers_url`, `git_refs_url` etc. are simply discarded. Your model only picks up the fields you declared.

`Optional[datetime] = None` with a datetime string in the JSON: Pydantic automatically parses ISO 8601 strings like `"2023-01-15T10:30:00Z"` into Python `datetime` objects. You can then call `.strftime()` on them. No manual parsing needed.

`GitHubUser` is nested inside `GitHubRepo` — Pydantic recursively validates the `owner` dict against `GitHubUser` automatically.

---
## 6. BaseSettings — Typed Environment Configuration

This is one of the most practical Pydantic features for DevOps work.
`BaseSettings` reads your configuration from:
1. Environment variables
2. `.env` files
3. Default values in code

It replaces the mess of `os.environ.get("DB_HOST", "localhost")` scattered everywhere.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
# pip install pydantic-settings
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr
from typing import Optional
import os

class AppSettings(BaseSettings):
    """
    Application configuration loaded from environment variables.

    In production: set these as real env vars (K8s secrets, ECS task defs, etc.)
    In development: put them in a .env file
    In tests: override with direct values

    Variable names are UPPER_CASE by default.
    """
    # These map to env vars: APP_NAME, APP_ENV, APP_PORT, etc.
    model_config = SettingsConfigDict(
        env_prefix="APP_",        # all env vars start with APP_
        env_file=".env",          # load from .env file if present
        case_sensitive=False,     # APP_PORT and app_port both work
        extra="ignore",           # ignore unknown env vars
    )

    app_name: str = "my-service"
    environment: str = Field(default="dev", pattern="^(dev|staging|prod)$")
    port: int = Field(default=8080, ge=1, le=65535)
    debug: bool = False
    log_level: str = "INFO"

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "appdb"
    db_user: str = "app"
    # SecretStr: value is hidden in logs and repr (__str__ shows '**********')
    db_password: SecretStr = SecretStr("changeme")

    # Optional external services
    redis_url: Optional[str] = None
    sentry_dsn: Optional[str] = None

    @property
    def database_url(self) -> str:
        """Build connection string from components."""
        return (f"postgresql+asyncpg://{self.db_user}:{self.db_password.get_secret_value()}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}")

    @property
    def is_production(self) -> bool:
        return self.environment == "prod"

# Load settings — reads from env vars automatically
# For demo, we'll set env vars directly
os.environ["APP_ENVIRONMENT"] = "staging"
os.environ["APP_PORT"] = "9000"
os.environ["APP_DB_HOST"] = "postgres.internal"
os.environ["APP_DB_PASSWORD"] = "super-secret-password"

settings = AppSettings()

print(f"app_name:    {settings.app_name}")
print(f"environment: {settings.environment}")
print(f"port:        {settings.port}")
print(f"db_host:     {settings.db_host}")
print(f"db_password: {settings.db_password}")           # shows '**********'
print(f"db_password: {settings.db_password.get_secret_value()}")  # real value
print(f"db_url:      {settings.database_url}")
print(f"is_prod:     {settings.is_production}")
```

</div>

### What just happened?
`BaseSettings` is a special Pydantic class that reads values from **environment variables** automatically.

With `env_prefix="APP_"`:
- `port: int` looks for an env var named `APP_PORT`
- `db_host: str` looks for `APP_DB_HOST`

It follows the priority order: env var → `.env` file → default value.

`SecretStr` is a special type that wraps a string but hides its value:
- `print(settings.db_password)` → `**********` (safe to log)
- `settings.db_password.get_secret_value()` → the real value (only when you need it)

The `@property` methods (`database_url`, `is_production`) compute derived values from the raw settings — this keeps your business logic clean.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
# Settings as a singleton — the standard pattern in applications
from functools import lru_cache

@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """
    Returns the same AppSettings instance every time (cached).
    lru_cache(maxsize=1) means: call once, cache the result, return cached.

    Usage everywhere in your app:
        from config import get_settings
        settings = get_settings()

    In tests, you can override with:
        from unittest.mock import patch
        with patch('myapp.config.get_settings', return_value=AppSettings(environment='test')):
            ...
    """
    return AppSettings()

s1 = get_settings()
s2 = get_settings()
print(f"Same instance? {s1 is s2}")    # True — cached
print(f"Environment: {s1.environment}")
```

</div>

### What just happened?
`@lru_cache(maxsize=1)` is Python's built-in memoisation decorator.

`lru_cache` = "Least Recently Used cache". With `maxsize=1`, it stores the result of the **first call** and returns that same result for every future call — never calling the function again.

Why use this for settings?
- `BaseSettings()` reads from environment variables and `.env` files — that's file I/O
- You don't want that happening on every request in a web server
- With `@lru_cache`, settings are read once at startup and reused everywhere

`s1 is s2` prints `True` — both variables point to the exact same object in memory (not just equal values, the exact same instance).

---
## 7. Real-World Project: API Models + Application Settings

Let's build the full set of Pydantic models you'd use in a real deployment management API.
This is exactly the kind of code you'll write when we build FastAPI in Chapter 5.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

# ── Enums ──────────────────────────────────────────────────────────────────

class Environment(str, Enum):
    DEV     = "dev"
    STAGING = "staging"
    PROD    = "prod"

class DeploymentStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    SUCCESS   = "success"
    FAILED    = "failed"
    ROLLED_BACK = "rolled_back"

# ── Request models (what the client SENDS) ─────────────────────────────────

class CreateDeploymentRequest(BaseModel):
    service_name: str   = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$',
                                description="Lowercase kebab-case service name")
    image_tag: str      = Field(..., min_length=1, description="Docker image tag")
    environment: Environment
    replicas: int       = Field(default=1, ge=1, le=50)
    config_overrides: Dict[str, str] = Field(default_factory=dict)
    requested_by: str   = Field(..., min_length=1, description="User or system requesting")

    @model_validator(mode="after")
    def prod_requires_more_replicas(self) -> "CreateDeploymentRequest":
        if self.environment == Environment.PROD and self.replicas < 2:
            raise ValueError("Production requires at least 2 replicas")
        return self

class UpdateDeploymentRequest(BaseModel):
    replicas: Optional[int] = Field(default=None, ge=1, le=50)
    config_overrides: Optional[Dict[str, str]] = None

# ── Response models (what the API RETURNS) ─────────────────────────────────

class DeploymentResponse(BaseModel):
    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    status: DeploymentStatus
    requested_by: str
    created_at: datetime
    updated_at: datetime
    logs_url: Optional[str] = None

    # model_config controls serialization behaviour
    from pydantic import ConfigDict
    model_config = ConfigDict(
        use_enum_values=True,      # serialize enums as their values ("prod" not Environment.PROD)
    )

class DeploymentListResponse(BaseModel):
    items: List[DeploymentResponse]
    total: int
    page: int
    page_size: int

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None

# ── Application settings ────────────────────────────────────────────────────

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DEPLOY_", extra="ignore")

    app_name: str = "deployment-api"
    environment: Environment = Environment.DEV
    port: int = Field(default=8000, ge=1, le=65535)
    debug: bool = False
    db_url: str = "postgresql+asyncpg://user:pass@localhost/deployments"
    secret_key: str = "change-me-in-production"
    max_concurrent_deployments: int = 5

# ── Demo ───────────────────────────────────────────────────────────────────

print("=== Request validation ===\n")

# Valid request
req = CreateDeploymentRequest(
    service_name="payment-api",
    image_tag="v3.0.1",
    environment=Environment.PROD,
    replicas=3,
    requested_by="ci-pipeline",
)
print(f"Request: {req.model_dump_json(indent=2)}")

# Simulate creating a deployment response
response = DeploymentResponse(
    id=str(uuid.uuid4()),
    service_name=req.service_name,
    image_tag=req.image_tag,
    environment=req.environment,
    replicas=req.replicas,
    status=DeploymentStatus.PENDING,
    requested_by=req.requested_by,
    created_at=datetime.utcnow(),
    updated_at=datetime.utcnow(),
    logs_url=f"https://logs.internal/deployments/payment-api/latest",
)
print(f"\nResponse: {response.model_dump_json(indent=2)}")
```

</div>

### What just happened?
This is the complete set of Pydantic models you'd write for a real deployment API.

The design decisions worth noting:

1. **`Environment` and `DeploymentStatus` as `str, Enum`** — inheriting from both `str` and `Enum` means enum values serialise as their string values (`"prod"` not `<Environment.PROD>`). Much friendlier for JSON APIs.

2. **Separate request and response models** — `CreateDeploymentRequest` is what the client sends; `DeploymentResponse` is what you return. They're different! The response has `id`, `created_at`, `updated_at` that the client doesn't provide.

3. **`@model_validator` cross-field rule** — `info.data.get("environment")` inside `@field_validator` accesses sibling fields (already validated ones).

4. **`use_enum_values=True`** in `model_config` — tells Pydantic to store and serialise enum fields as their plain string values, not as enum objects.

In Chapter 5 (FastAPI), these exact models plug directly into route handlers.

---
## Summary

| Feature | What it does | When to use |
|---------|--------------|-------------|
| `BaseModel` | Define + validate data shape | Any data coming from outside |
| `Field(ge=, le=, pattern=)` | Constraint rules on fields | Input validation |
| `@field_validator` | Custom field validation | Complex rules, transformations |
| `@model_validator` | Cross-field validation | Rules that span multiple fields |
| Nested models | Hierarchical data structures | Complex configs, API responses |
| `model_validate()` | Parse dict → model | API responses, DB rows |
| `model_dump_json()` | Model → JSON | Sending data to APIs |
| `SecretStr` | Hide sensitive values | Passwords, API keys |
| `BaseSettings` | Load from env vars / .env | App configuration |

## Key Patterns

```python
# Define a model
class MyModel(BaseModel):
    name: str = Field(..., min_length=1)
    count: int = Field(default=0, ge=0)

# Parse and validate
obj = MyModel.model_validate({"name": "test", "count": 5})
obj = MyModel.model_validate_json('{"name": "test"}')

# Serialize
d   = obj.model_dump()
j   = obj.model_dump_json()

# Catch errors
try:
    MyModel(name="", count=-1)
except ValidationError as e:
    for err in e.errors():
        print(err["loc"], err["msg"])

# Settings from env
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_")
    port: int = 8080
```

## Next Chapter
**Chapter 5: FastAPI** — now that you know Pydantic, building a REST API with FastAPI
will feel natural. Every route handler uses these exact model patterns.

---
## Add-on: Strict Contracts and Schema Evolution

This is where Pydantic becomes more than input validation.

In real systems, data contracts change over time. Interviewers and senior engineers care about whether you can think about:
- strict vs permissive validation
- compatibility with older payloads
- aliasing and field deprecation
- rejecting unknown fields when safety matters

These are very practical concerns for APIs, config loaders, and deployment tooling.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
from pydantic import BaseModel, Field, ConfigDict, ValidationError


class StrictDeploymentPayload(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)

    service_name: str
    replicas: int
    dry_run: bool = False


print('Valid payload:')
obj = StrictDeploymentPayload(service_name='auth-api', replicas=3, dry_run=True)
print(obj)

print('\nType coercion is NOT allowed in strict mode:')
try:
    StrictDeploymentPayload(service_name='auth-api', replicas='3')
except ValidationError as e:
    print(e.errors()[0]['msg'])

print('\nUnknown fields are rejected:')
try:
    StrictDeploymentPayload(service_name='auth-api', replicas=3, unknown='x')
except ValidationError as e:
    print(e.errors()[0]['msg'])
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
from pydantic import BaseModel, Field, AliasChoices


class DeploymentPayloadV2(BaseModel):
    service_name: str = Field(validation_alias=AliasChoices('service_name', 'serviceName'))
    image_tag: str = Field(validation_alias=AliasChoices('image_tag', 'imageTag'))
    replicas: int = 1


old_style = {'service_name': 'user-svc', 'image_tag': 'v1.2.0', 'replicas': 2}
new_style = {'serviceName': 'payment-api', 'imageTag': 'v3.0.0', 'replicas': 4}

print('Old payload style:', DeploymentPayloadV2.model_validate(old_style).model_dump())
print('New payload style:', DeploymentPayloadV2.model_validate(new_style).model_dump())
```

</div>

### Why this add-on matters

This is one of the clearest differences between toy code and engineering code.

Good things to say in interviews:
- "I use `extra='forbid'` when I need contract safety."
- "I use aliases when payload shapes evolve over time."
- "I choose strict mode when silent coercion would be risky."

That kind of answer shows that you think about data contracts, not only about syntax.

---
## Practice Questions

---

### Question 1 — Model with Validation

Create a Pydantic model `ServerSpec` with:
- `hostname` (str) — must match pattern `^[a-z0-9-]+$`, length 3–50
- `ip_address` (str) — must match a simple IPv4 pattern like `192.168.1.1` (hint: `pattern=r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'`)
- `role` (str) — must be one of: `"web"`, `"db"`, `"cache"`, `"worker"`
- `cpu_cores` (int) — between 1 and 128
- `memory_gb` (int) — between 1 and 512
- `tags` (list of strings) — default empty

Add a `@model_validator` that raises `ValueError` if `role == "db"` and `memory_gb < 8` (databases need at least 8GB RAM).

Test it with valid and invalid data, and print the `ValidationError` details.

---

### Question 2 — BaseSettings

Create an `AppConfig` class using `BaseSettings` that reads:
- `APP_HOST` → `host: str` (default `"0.0.0.0"`)
- `APP_PORT` → `port: int` (default `8080`, must be 1–65535)
- `APP_ENV` → `environment: str` (default `"dev"`)
- `APP_SECRET` → `secret: SecretStr` (required, no default)
- `APP_DEBUG` → `debug: bool` (default `False`)

Add a `@property` called `is_secure` that returns `True` if `environment == "prod"` and `debug == False`.

Set the env vars in Python using `os.environ`, create the settings, and print each field. Make sure the secret value is hidden when printed.
