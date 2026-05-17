---
title: "Services"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/services.py"
slug: "/deployment-control-center/app-services"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/services.py`

```python
import asyncio
import random
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Deployment
from app.schemas import DeploymentCreate, DeploymentStatus, StatsResponse


class DeploymentOrchestrator:
    """
    Service layer for deployment operations.

    Why a service layer is useful:
    - routes stay small
    - business logic becomes reusable
    - testing becomes easier
    """

    def __init__(self, max_concurrency: int = 3):
        self._semaphore = asyncio.Semaphore(max_concurrency)

    async def _simulate_external_rollout(self, service_name: str) -> None:
        """
        Simulate an external deployment call.

        In a real system this might call:
        - Kubernetes API
        - ArgoCD
        - a deployment service
        - a config or health endpoint
        """

        async with self._semaphore:
            await asyncio.sleep(random.uniform(0.05, 0.15))

    async def create_deployment(self, db: AsyncSession, payload: DeploymentCreate) -> Deployment:
        deployment = Deployment(
            service_name=payload.service_name,
            image_tag=payload.image_tag,
            environment=payload.environment,
            replicas=payload.replicas,
            requested_by=payload.requested_by,
            status=DeploymentStatus.PENDING,
        )
        db.add(deployment)
        await db.flush()
        await db.refresh(deployment)

        # We simulate moving from pending to running after the orchestration step.
        await self._simulate_external_rollout(payload.service_name)
        deployment.status = DeploymentStatus.RUNNING
        deployment.updated_at = datetime.utcnow()
        await db.flush()
        await db.refresh(deployment)
        return deployment

    async def list_deployments(self, db: AsyncSession) -> list[Deployment]:
        result = await db.execute(select(Deployment).order_by(Deployment.created_at.desc()))
        return list(result.scalars().all())

    async def get_deployment(self, db: AsyncSession, deployment_id: str) -> Deployment | None:
        result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
        return result.scalar_one_or_none()

    async def update_status(
        self, db: AsyncSession, deployment_id: str, status: DeploymentStatus
    ) -> Deployment | None:
        deployment = await self.get_deployment(db, deployment_id)
        if deployment is None:
            return None
        deployment.status = status
        deployment.updated_at = datetime.utcnow()
        await db.flush()
        await db.refresh(deployment)
        return deployment

    async def get_stats(self, db: AsyncSession) -> StatsResponse:
        total_result = await db.execute(select(func.count(Deployment.id)))
        total = int(total_result.scalar() or 0)

        grouped_result = await db.execute(
            select(Deployment.status, func.count(Deployment.id)).group_by(Deployment.status)
        )
        by_status = {row[0].value: row[1] for row in grouped_result}
        return StatsResponse(total_deployments=total, by_status=by_status)

```
