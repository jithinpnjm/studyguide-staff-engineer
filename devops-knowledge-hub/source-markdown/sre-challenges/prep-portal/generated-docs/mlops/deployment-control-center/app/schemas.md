---
title: "Schemas"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/schemas.py"
slug: "/deployment-control-center/app-schemas"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/schemas.py`

```python
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Environment(str, Enum):
    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class DeploymentCreate(BaseModel):
    """
    Request model for creating a deployment.

    Why this exists:
    - FastAPI will validate incoming JSON against this model.
    - Bad requests are rejected early.
    - The API contract becomes explicit and readable.
    """

    model_config = ConfigDict(extra="forbid")

    service_name: str = Field(..., pattern=r"^[a-z][a-z0-9-]{1,49}$")
    image_tag: str = Field(..., min_length=1)
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=20)
    requested_by: str = Field(..., min_length=1)


class DeploymentUpdateStatus(BaseModel):
    status: DeploymentStatus


class DeploymentRead(BaseModel):
    """
    Response model returned to API clients.

    We keep this separate from the database model so that:
    - the API contract is stable
    - internal database details stay internal
    """

    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    status: DeploymentStatus
    requested_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    app_name: str


class StatsResponse(BaseModel):
    total_deployments: int
    by_status: dict[str, int]

```
