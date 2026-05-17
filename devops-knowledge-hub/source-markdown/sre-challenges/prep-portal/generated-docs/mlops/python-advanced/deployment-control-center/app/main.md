---
title: "Main"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/main.py"
slug: "/python-advanced/deployment-control-center-app-main"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/main.py`

```python
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_db_session, init_db
from app.schemas import (
    DeploymentCreate,
    DeploymentRead,
    DeploymentUpdateStatus,
    HealthResponse,
    StatsResponse,
)
from app.services import DeploymentOrchestrator


app = FastAPI(title="Deployment Control Center", version="0.1.0")


@app.on_event("startup")
async def startup() -> None:
    """
    Initialize the database when the app starts.

    This makes the project easy to run for learning purposes.
    """

    await init_db()


def get_orchestrator(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DeploymentOrchestrator:
    return DeploymentOrchestrator(max_concurrency=settings.max_concurrency)


@app.get("/health", response_model=HealthResponse)
async def health(
    settings: Annotated[Settings, Depends(get_settings)],
) -> HealthResponse:
    return HealthResponse(status="healthy", app_name=settings.app_name)


@app.post("/deployments", response_model=DeploymentRead, status_code=201)
async def create_deployment(
    payload: DeploymentCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    orchestrator: Annotated[DeploymentOrchestrator, Depends(get_orchestrator)],
) -> DeploymentRead:
    deployment = await orchestrator.create_deployment(db, payload)
    return DeploymentRead.model_validate(deployment)


@app.get("/deployments", response_model=list[DeploymentRead])
async def list_deployments(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    orchestrator: Annotated[DeploymentOrchestrator, Depends(get_orchestrator)],
) -> list[DeploymentRead]:
    items = await orchestrator.list_deployments(db)
    return [DeploymentRead.model_validate(item) for item in items]


@app.get("/deployments/{deployment_id}", response_model=DeploymentRead)
async def get_deployment(
    deployment_id: str,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    orchestrator: Annotated[DeploymentOrchestrator, Depends(get_orchestrator)],
) -> DeploymentRead:
    deployment = await orchestrator.get_deployment(db, deployment_id)
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return DeploymentRead.model_validate(deployment)


@app.patch("/deployments/{deployment_id}/status", response_model=DeploymentRead)
async def update_deployment_status(
    deployment_id: str,
    payload: DeploymentUpdateStatus,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    orchestrator: Annotated[DeploymentOrchestrator, Depends(get_orchestrator)],
) -> DeploymentRead:
    deployment = await orchestrator.update_status(db, deployment_id, payload.status)
    if deployment is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return DeploymentRead.model_validate(deployment)


@app.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    orchestrator: Annotated[DeploymentOrchestrator, Depends(get_orchestrator)],
) -> StatsResponse:
    return await orchestrator.get_stats(db)

```
