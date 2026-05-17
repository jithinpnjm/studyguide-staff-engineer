---
title: "Models"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/models.py"
slug: "/python-advanced/deployment-control-center-app-models"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/models.py`

```python
from datetime import datetime
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.schemas import DeploymentStatus, Environment


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


class Deployment(Base):
    """
    Database table for deployments.

    Think of this as the persistent version of a deployment record.
    If the application restarts, this data still exists in the database.
    """

    __tablename__ = "deployments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service_name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_tag: Mapped[str] = mapped_column(String(100), nullable=False)
    environment: Mapped[Environment] = mapped_column(SAEnum(Environment), nullable=False)
    replicas: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[DeploymentStatus] = mapped_column(
        SAEnum(DeploymentStatus), default=DeploymentStatus.PENDING, nullable=False
    )
    requested_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

```
