---
title: "Db"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/db.py"
slug: "/deployment-control-center/app-db"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/db.py`

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import Base


settings = get_settings()

# The engine knows how to talk to the database.
engine = create_async_engine(settings.database_url, echo=False)

# The session factory creates per-request database sessions.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """
    Create all tables.

    In a real production app we would use Alembic migrations instead of
    create_all(), but this keeps the learning project simple.
    """

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield one database session for a request.

    Why this pattern matters:
    - each request gets a clean session
    - success commits
    - failure rolls back
    - resources always close
    """

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

```
