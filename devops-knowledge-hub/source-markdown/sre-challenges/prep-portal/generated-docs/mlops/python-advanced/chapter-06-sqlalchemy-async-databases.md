---
title: "Chapter 06 Sqlalchemy Async Databases"
description: "Generated from mlops/PYTHON/Advanced/chapter_06_sqlalchemy_async_databases.ipynb"
slug: "/python-advanced/chapter-06-sqlalchemy-async-databases"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_06_sqlalchemy_async_databases.ipynb</code></div>

# Chapter 6: SQLAlchemy Async — Real Databases in Python

So far we've stored data in memory (Python dicts). Real applications need **persistent storage** —
data that survives restarts, can be queried efficiently, and is shared across multiple instances.

**SQLAlchemy** is the most widely-used Python database library. It works with:
- PostgreSQL (production standard)
- MySQL / MariaDB
- SQLite (development / testing — no server needed)
- And more

## Two layers of SQLAlchemy

| Layer | What it does | When to use |
|-------|--------------|-------------|
| **Core** | SQL expression language — close to raw SQL | Complex queries, data pipelines |
| **ORM** | Map Python classes to DB tables | CRUD apps, APIs, most web services |

We focus on the **ORM** with **async sessions** — the modern pattern for FastAPI + SQLAlchemy.

## What we cover
| Section | Topic |
|---------|-------|
| 1 | **Models** — define your database tables as Python classes |
| 2 | **Async engine + sessions** — connecting to the database |
| 3 | **CRUD operations** — create, read, update, delete |
| 4 | **Relationships** — linked tables (one-to-many, many-to-many) |
| 5 | **Queries** — filtering, ordering, pagination |
| 6 | **Migrations with Alembic** — evolving your schema safely |
| 7 | **Complete project** — our Deployment API with a real database |

```bash
pip install sqlalchemy aiosqlite asyncpg alembic
# SQLite async (dev/test): aiosqlite
# PostgreSQL async (prod):  asyncpg
```

> **We use SQLite in this notebook** — no database server needed.
> The same code works with PostgreSQL by changing the connection URL.

---
## 1. Defining Models — Tables as Python Classes

In SQLAlchemy ORM, each Python class represents a database table.
Field types, constraints, and relationships are declared on the class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid

# ── Base class — all models inherit from this ──────────────────────────────
class Base(DeclarativeBase):
    pass

# ── Enums ──────────────────────────────────────────────────────────────────
class Environment(str, Enum):
    DEV     = "dev"
    STAGING = "staging"
    PROD    = "prod"

class DeploymentStatus(str, Enum):
    PENDING     = "pending"
    RUNNING     = "running"
    SUCCESS     = "success"
    FAILED      = "failed"
    ROLLED_BACK = "rolled_back"

# ── Models ─────────────────────────────────────────────────────────────────

class Service(Base):
    """
    Represents a deployable service (auth-api, user-svc, etc.)
    One service can have many deployments.
    """
    __tablename__ = "services"

    # Mapped[type] = modern SQLAlchemy 2.0 style — fully type-annotated
    id:          Mapped[int]            = mapped_column(Integer, primary_key=True)
    name:        Mapped[str]            = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    team:        Mapped[str]            = mapped_column(String(50), nullable=False)
    active:      Mapped[bool]           = mapped_column(Boolean, default=True)
    created_at:  Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship — one Service has many Deployments
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="service", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Service id={self.id} name={self.name!r}>"


class Deployment(Base):
    """
    A single deployment event — service X was deployed with image Y to environment Z.
    """
    __tablename__ = "deployments"

    id:           Mapped[str]              = mapped_column(
                                               String(36), primary_key=True,
                                               default=lambda: str(uuid.uuid4())
                                           )
    service_id:   Mapped[int]              = mapped_column(ForeignKey("services.id"), nullable=False)
    image_tag:    Mapped[str]              = mapped_column(String(200), nullable=False)
    environment:  Mapped[Environment]      = mapped_column(SAEnum(Environment), nullable=False)
    replicas:     Mapped[int]              = mapped_column(Integer, default=1)
    status:       Mapped[DeploymentStatus] = mapped_column(
                                               SAEnum(DeploymentStatus),
                                               default=DeploymentStatus.PENDING
                                           )
    deployed_by:  Mapped[str]              = mapped_column(String(100), nullable=False)
    notes:        Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    created_at:   Mapped[datetime]         = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:   Mapped[datetime]         = mapped_column(
                                               DateTime, default=datetime.utcnow,
                                               onupdate=datetime.utcnow
                                           )

    # Back-reference to Service
    service: Mapped["Service"] = relationship("Service", back_populates="deployments")

    def __repr__(self) -> str:
        return f"<Deployment id={self.id} service_id={self.service_id} env={self.environment}>"


class DeploymentEvent(Base):
    """
    Log of events during a deployment (started, health-check-pass, etc.)
    """
    __tablename__ = "deployment_events"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True)
    deployment_id: Mapped[str]      = mapped_column(ForeignKey("deployments.id"), nullable=False)
    event_type:    Mapped[str]      = mapped_column(String(50), nullable=False)
    message:       Mapped[str]      = mapped_column(Text, nullable=False)
    occurred_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    deployment: Mapped["Deployment"] = relationship("Deployment")

print("Models defined:")
print(f"  Service     → table: {Service.__tablename__}")
print(f"  Deployment  → table: {Deployment.__tablename__}")
print(f"  DeploymentEvent → table: {DeploymentEvent.__tablename__}")
print(f"  Columns in Deployment: {[c.name for c in Deployment.__table__.columns]}")
```

</div>

### What just happened?
We defined three database tables as Python classes. This is the SQLAlchemy ORM approach — each class = one table, each `mapped_column` = one column.

Key concepts:
- **`class Base(DeclarativeBase)`** — all your models inherit from this. SQLAlchemy uses it to discover all tables when you call `create_all()`.
- **`Mapped[int]`** — the modern SQLAlchemy 2.0 type annotation. `Mapped[str]` means "this column holds strings", `Mapped[Optional[str]]` means it can be NULL in the database.
- **`mapped_column(...)`** — defines column properties: type, constraints, defaults
- **`primary_key=True`** — this column is the unique identifier for each row
- **`ForeignKey("services.id")`** — creates a link between tables. `Deployment.service_id` must match an `id` in the `services` table.
- **`relationship(...)`** — not a real database column. It tells SQLAlchemy how to join tables when you navigate between objects in Python (e.g. `service.deployments`)
- **`cascade="all, delete-orphan"`** — when a `Service` is deleted, automatically delete all its `Deployment` rows too

---
## 2. Async Engine and Sessions

The engine is your connection to the database.
The session is how you interact with it within a single request/operation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# ── Create async engine ───────────────────────────────────────────────────
# SQLite (development/testing — no server needed)
DATABASE_URL = "sqlite+aiosqlite:///./deployments.db"
# PostgreSQL (production):
# DATABASE_URL = "postgresql+asyncpg://user:password@localhost:5432/deployments"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,        # echo=True logs every SQL query (useful for debugging)
)

# ── Session factory ────────────────────────────────────────────────────────
# async_sessionmaker creates AsyncSession instances
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,   # keep objects usable after commit (important!)
    class_=AsyncSession,
)

# ── Create all tables ──────────────────────────────────────────────────────
async def init_db():
    """Create all tables defined in Base.metadata."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created!")

asyncio.run(init_db())

# ── Test raw connection ────────────────────────────────────────────────────
async def test_connection():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        print(f"Connection test: {result.scalar()}")

asyncio.run(test_connection())
```

</div>

### What just happened?
The **engine** is your connection to the database. The **session** is how you talk to it within one operation.

- `create_async_engine(DATABASE_URL)` — creates the engine. The URL format tells SQLAlchemy which database and driver to use: `sqlite+aiosqlite` means SQLite with the async `aiosqlite` driver. For PostgreSQL you'd use `postgresql+asyncpg://user:pass@host/dbname`.
- `echo=False` — set to `True` during development to see every SQL query in the console (very helpful for debugging)
- `async_sessionmaker(engine, ...)` — a factory that creates `AsyncSession` instances. Think of it like a class you call to get a new session.
- `expire_on_commit=False` — by default SQLAlchemy "expires" objects after commit (they'd need a DB round-trip to access any attribute). Setting this `False` keeps objects usable after commit — important in async code.
- `Base.metadata.create_all(conn)` — creates all tables in the database if they don't exist already. Safe to call multiple times.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
# ── Dependency for FastAPI — yields a session per request ──────────────────
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db_session() -> AsyncSession:
    """
    FastAPI dependency — yields a fresh session for each request.
    Commits on success, rolls back on exception, always closes.

    Usage in FastAPI:
        @app.post("/items")
        async def create_item(
            item: ItemRequest,
            db: AsyncSession = Depends(get_db_session)
        ):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        # Session closes automatically (context manager)

print("Session factory and dependency ready.")
```

</div>

### What just happened?
This is the standard FastAPI + SQLAlchemy pattern for managing database sessions.

`yield` turns `get_db_session` into a **generator dependency**:
- Code before `yield` = setup (opens the session)
- `yield session` = hands the session to the route function
- Code after `yield` = teardown (commit or rollback, then close)

`try/commit` + `except/rollback` ensures:
- If the route function runs without errors → `commit()` saves all changes permanently
- If any exception occurs → `rollback()` undoes all changes, leaving the DB clean
- Session always closes (the `async with` handles that)

You never need to call `commit()` or `rollback()` in your route functions — the dependency handles it. Just make your changes and return.

---
## 3. CRUD Operations — Create, Read, Update, Delete

Now let's actually use the database.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── CREATE ────────────────────────────────────────────────────────────────

async def create_service(db: AsyncSession, name: str, team: str,
                          description: str = None) -> Service:
    service = Service(name=name, team=team, description=description)
    db.add(service)
    await db.flush()    # assigns the ID without committing
    await db.refresh(service)   # reload from DB to get defaults
    return service

async def create_deployment(
    db: AsyncSession,
    service_id: int,
    image_tag: str,
    environment: Environment,
    deployed_by: str,
    replicas: int = 1,
) -> Deployment:
    deployment = Deployment(
        service_id=service_id,
        image_tag=image_tag,
        environment=environment,
        deployed_by=deployed_by,
        replicas=replicas,
        status=DeploymentStatus.PENDING,
    )
    db.add(deployment)
    await db.flush()
    await db.refresh(deployment)
    return deployment

# ── READ ──────────────────────────────────────────────────────────────────

async def get_service_by_name(db: AsyncSession, name: str) -> Service | None:
    result = await db.execute(
        select(Service).where(Service.name == name)
    )
    return result.scalar_one_or_none()

async def get_deployment(db: AsyncSession, deployment_id: str) -> Deployment | None:
    result = await db.execute(
        select(Deployment).where(Deployment.id == deployment_id)
    )
    return result.scalar_one_or_none()

async def list_deployments(
    db: AsyncSession,
    environment: Environment | None = None,
    status: DeploymentStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Deployment]:
    query = select(Deployment).order_by(Deployment.created_at.desc())
    if environment:
        query = query.where(Deployment.environment == environment)
    if status:
        query = query.where(Deployment.status == status)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())

# ── UPDATE ────────────────────────────────────────────────────────────────

async def update_deployment_status(
    db: AsyncSession,
    deployment_id: str,
    new_status: DeploymentStatus,
) -> Deployment | None:
    deployment = await get_deployment(db, deployment_id)
    if not deployment:
        return None
    deployment.status = new_status
    deployment.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(deployment)
    return deployment

# ── DELETE ────────────────────────────────────────────────────────────────

async def delete_service(db: AsyncSession, service_id: int) -> bool:
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        return False
    await db.delete(service)   # cascade deletes deployments too
    return True

print("CRUD functions defined.")
```

</div>

### What just happened?
We defined clean, reusable async functions for each database operation.

Important SQLAlchemy patterns here:

- **`select(Model).where(Model.field == value)`** — this is how you build a SELECT query. It's not executed yet — it's just a query object.
- **`await db.execute(query)`** — this actually runs the query against the database
- **`.scalar_one_or_none()`** — gets one result or `None` if not found. Use `.scalar_one()` when you're certain it exists (raises if not found).
- **`db.add(obj)`** — stages a new object for insertion. Not saved yet.
- **`await db.flush()`** — sends the INSERT to the database within the current transaction (assigns the auto-generated ID) but doesn't commit. Other transactions can't see it yet.
- **`await db.refresh(obj)`** — re-reads the object from the database to pick up any server-generated values (like `default=datetime.utcnow`)

Think of the session like a shopping cart: `add()` puts things in, `flush()` processes them temporarily, `commit()` completes the purchase.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
# ── Demo: use all CRUD operations ─────────────────────────────────────────
import asyncio

async def crud_demo():
    async with AsyncSessionLocal() as db:
        # CREATE services
        auth_svc = await create_service(db, "auth-api", "platform", "Authentication service")
        user_svc = await create_service(db, "user-svc", "backend",  "User management service")
        pay_svc  = await create_service(db, "payment-api", "payments", "Payment processing")
        await db.commit()
        print(f"Created services: {auth_svc}, {user_svc}, {pay_svc}")

        # CREATE deployments
        dep1 = await create_deployment(db, auth_svc.id, "v2.1.0", Environment.PROD, "ci-user", 3)
        dep2 = await create_deployment(db, auth_svc.id, "v2.0.9", Environment.STAGING, "alice", 1)
        dep3 = await create_deployment(db, user_svc.id, "v1.5.3", Environment.PROD, "ci-user", 2)
        await db.commit()
        print(f"\nCreated deployments:")
        for d in [dep1, dep2, dep3]:
            print(f"  {d.id[:8]}... {d.image_tag} → {d.environment.value} [{d.status.value}]")

        # READ by name
        found = await get_service_by_name(db, "auth-api")
        print(f"\nFound by name: {found}")

        # LIST with filter
        prod_deps = await list_deployments(db, environment=Environment.PROD)
        print(f"\nProd deployments ({len(prod_deps)}):")
        for d in prod_deps:
            print(f"  {d.id[:8]}... svc_id={d.service_id} tag={d.image_tag}")

        # UPDATE status
        updated = await update_deployment_status(db, dep1.id, DeploymentStatus.RUNNING)
        await db.commit()
        print(f"\nUpdated {dep1.id[:8]}... status → {updated.status.value}")

        # DELETE
        deleted = await delete_service(db, pay_svc.id)
        await db.commit()
        print(f"\nDeleted payment-api: {deleted}")

        remaining = await db.execute(select(Service))
        print(f"Remaining services: {[s.name for s in remaining.scalars().all()]}")

asyncio.run(crud_demo())
```

</div>

### What just happened?
We ran all four CRUD operations end-to-end against a real SQLite database file (`deployments.db`).

A few things worth noting:

- `await db.commit()` is called after creating services, then again after creating deployments. Each `commit()` makes those changes permanent and visible to other sessions.
- `dep1.id` shows a UUID like `"3a7f2b1c-..."` — this was generated by `default=lambda: str(uuid.uuid4())` in the model definition, not by the database itself.
- After `delete_service(db, pay_svc.id)` with `cascade="all, delete-orphan"`, any deployments belonging to `payment-api` would also be deleted automatically — the database enforces this via foreign key constraints.
- The remaining services query confirms the delete worked.

---
## 4. Relationships — Querying Linked Data

SQLAlchemy relationships let you navigate between related objects easily.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
import asyncio
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import select, func

async def relationship_demo():
    async with AsyncSessionLocal() as db:

        # Load a service WITH its deployments in one query
        # selectinload: efficient for one-to-many (uses a second SELECT, not JOIN)
        result = await db.execute(
            select(Service)
            .where(Service.name == "auth-api")
            .options(selectinload(Service.deployments))
        )
        auth = result.scalar_one_or_none()

        if auth:
            print(f"Service: {auth.name} (team={auth.team})")
            print(f"Deployments ({len(auth.deployments)}):")
            for dep in auth.deployments:
                print(f"  {dep.id[:8]}... {dep.image_tag} {dep.environment.value} {dep.status.value}")

        # Load deployments WITH their service (reverse direction)
        result = await db.execute(
            select(Deployment)
            .options(joinedload(Deployment.service))   # JOIN in one query
            .where(Deployment.environment == Environment.PROD)
        )
        deps = result.scalars().all()
        print(f"\nProd deployments with service names:")
        for dep in deps:
            print(f"  {dep.id[:8]}... {dep.service.name} ({dep.service.team}) → {dep.image_tag}")

        # Aggregate queries
        result = await db.execute(
            select(
                Service.name,
                func.count(Deployment.id).label("deployment_count")
            )
            .join(Deployment, Deployment.service_id == Service.id, isouter=True)
            .group_by(Service.name)
            .order_by(func.count(Deployment.id).desc())
        )
        print("\nDeployment counts per service:")
        for row in result:
            print(f"  {row.name}: {row.deployment_count} deployments")

asyncio.run(relationship_demo())
```

</div>

### What just happened?
We queried related data using SQLAlchemy's relationship loading strategies.

Two strategies:
1. **`selectinload`** — runs a second SELECT query to fetch related objects. Best for one-to-many (one service → many deployments). The query looks like: `SELECT * FROM deployments WHERE service_id IN (1, 2, 3)`.
2. **`joinedload`** — uses a SQL JOIN to fetch everything in one query. Best for many-to-one (each deployment → one service). The query looks like: `SELECT deployments.*, services.* FROM deployments JOIN services ON ...`.

Without these, accessing `auth.deployments` or `dep.service` would raise a `MissingGreenlet` error in async code — SQLAlchemy doesn't know to lazy-load in an async context.

The aggregate query at the bottom uses `func.count()` and `GROUP BY` — standard SQL, but expressed in Python. `func` is SQLAlchemy's way to call SQL functions like `COUNT`, `SUM`, `MAX`, etc.

---
## 5. Advanced Queries — Filtering, Ordering, Pagination

Real applications need more than simple selects.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
import asyncio
from sqlalchemy import select, func, and_, or_, desc, asc
from datetime import datetime, timedelta

async def advanced_queries_demo():
    # First add more data to query against
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Service).where(Service.name == "user-svc"))
        user_svc = result.scalar_one_or_none()
        if user_svc:
            for tag, env, status in [
                ("v1.5.0", Environment.PROD,    DeploymentStatus.SUCCESS),
                ("v1.4.9", Environment.STAGING, DeploymentStatus.SUCCESS),
                ("v1.5.1", Environment.DEV,     DeploymentStatus.FAILED),
            ]:
                d = await create_deployment(db, user_svc.id, tag, env, "bob")
                d.status = status
            await db.commit()

    async with AsyncSessionLocal() as db:

        # ── AND / OR conditions ───────────────────────────────────────────
        result = await db.execute(
            select(Deployment).where(
                and_(
                    Deployment.environment == Environment.PROD,
                    or_(
                        Deployment.status == DeploymentStatus.RUNNING,
                        Deployment.status == DeploymentStatus.SUCCESS,
                    )
                )
            )
        )
        print("Prod deployments that are RUNNING or SUCCESS:")
        for d in result.scalars().all():
            print(f"  {d.id[:8]}... {d.image_tag} [{d.status.value}]")

        # ── Recent deployments (last 24h) ─────────────────────────────────
        cutoff = datetime.utcnow() - timedelta(hours=24)
        result = await db.execute(
            select(Deployment)
            .where(Deployment.created_at >= cutoff)
            .order_by(desc(Deployment.created_at))
        )
        recent = result.scalars().all()
        print(f"\nDeployments in last 24h: {len(recent)}")

        # ── Count by status ────────────────────────────────────────────────
        result = await db.execute(
            select(Deployment.status, func.count(Deployment.id).label("count"))
            .group_by(Deployment.status)
            .order_by(desc("count"))
        )
        print("\nDeployment counts by status:")
        for row in result:
            print(f"  {row.status.value:15s}: {row.count}")

        # ── Pagination (offset-based) ──────────────────────────────────────
        page = 1
        page_size = 2
        offset = (page - 1) * page_size

        total_result = await db.execute(
            select(func.count(Deployment.id))
        )
        total = total_result.scalar()

        result = await db.execute(
            select(Deployment)
            .order_by(desc(Deployment.created_at))
            .limit(page_size).offset(offset)
        )
        page_items = result.scalars().all()
        print(f"\nPage {page} of deployments (page_size={page_size}, total={total}):")
        for d in page_items:
            print(f"  {d.id[:8]}... {d.image_tag} {d.environment.value}")

asyncio.run(advanced_queries_demo())
```

</div>

### What just happened?
We used more complex query building with `and_()`, `or_()`, `desc()`, and pagination.

- **`and_()` / `or_()`** — combine multiple conditions. You can also use Python's `&` and `|` operators on column expressions, but `and_()` / `or_()` is clearer.
- **`desc(Deployment.created_at)`** — ORDER BY created_at DESC. Use `asc()` for ascending.
- **Date filtering**: `Deployment.created_at >= cutoff` compares datetime values — SQLAlchemy translates this to a SQL `WHERE created_at >= '2025-01-14T...'` clause.
- **Pagination**: `.limit(page_size).offset(offset)` maps to SQL `LIMIT 2 OFFSET 0` — skip `offset` rows and return at most `page_size`. Always pair this with `ORDER BY` so results are consistent across pages.
- **`func.count()`** returns a single value — use `.scalar()` (not `.scalars().all()`) to get just that number.

---
## 6. Alembic — Database Migrations

When you change your models (add a column, rename a table), you need to update
the database schema without losing data. **Alembic** manages this.

```bash
# One-time setup
alembic init alembic

# Generate a migration after changing your models
alembic revision --autogenerate -m "add notes column to deployments"

# Apply migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

Alembic generates Python migration files like this:

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
# This is what an Alembic migration file looks like
MIGRATION_EXAMPLE = """
# alembic/versions/a1b2c3d4e5f6_add_notes_to_deployments.py

revision = 'a1b2c3d4e5f6'
down_revision = '000000000000'

from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Add a new column
    op.add_column('deployments',
        sa.Column('notes', sa.Text(), nullable=True)
    )
    # Add an index
    op.create_index('ix_deployments_environment', 'deployments', ['environment'])

def downgrade() -> None:
    # Reverse the changes
    op.drop_index('ix_deployments_environment', table_name='deployments')
    op.drop_column('deployments', 'notes')
"""

# alembic.ini points to your database
ALEMBIC_INI = """
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://user:pass@localhost/mydb
"""

print("Alembic migration pattern:")
print(MIGRATION_EXAMPLE)
print("\nKey Alembic commands:")
commands = [
    ("alembic init alembic",             "Create alembic directory (run once)"),
    ("alembic revision --autogenerate",  "Generate migration from model changes"),
    ("alembic upgrade head",             "Apply all pending migrations"),
    ("alembic downgrade -1",             "Roll back last migration"),
    ("alembic history",                  "Show migration history"),
    ("alembic current",                  "Show current DB version"),
]
for cmd, desc in commands:
    print(f"  {cmd:45s}  # {desc}")
```

</div>

### What just happened?
We looked at an Alembic migration file — the standard way to evolve your database schema safely in production.

Why not just run `create_all()` again? Because `create_all()` only creates tables that don't exist — it won't add new columns to existing tables, rename columns, or add indexes. Alembic tracks the history of every schema change.

Each migration has:
- `upgrade()` — applies the change (add column, create index, etc.)
- `downgrade()` — reverses the change (allows rolling back if something breaks)

`--autogenerate` is the killer feature: Alembic compares your current SQLAlchemy models against the actual database schema and generates the migration file automatically. You just review it and run `alembic upgrade head`.

In a team: migrations are committed to git. Everyone runs `alembic upgrade head` to sync their local DB.

---
## 7. Complete Project: Deployment API with Real Database

Now let's wire our FastAPI from Chapter 5 with SQLAlchemy.
The in-memory dict is replaced with real async DB operations.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
FULL_API_WITH_DB = """
# deployment_api_db.py
# Run: uvicorn deployment_api_db:app --reload
# pip install fastapi uvicorn[standard] sqlalchemy aiosqlite pydantic-settings

from fastapi import FastAPI, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SAEnum, select, func, desc
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, selectinload
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import Optional, List, Annotated
from datetime import datetime
from enum import Enum
import uuid, asyncio

# ── Enums ─────────────────────────────────────────────────────────────────

class Environment(str, Enum):
    DEV = "dev"; STAGING = "staging"; PROD = "prod"

class DeploymentStatus(str, Enum):
    PENDING = "pending"; RUNNING = "running"
    SUCCESS = "success"; FAILED = "failed"

# ── Database models ───────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass

class Service(Base):
    __tablename__ = "services"
    id:          Mapped[int]   = mapped_column(Integer, primary_key=True)
    name:        Mapped[str]   = mapped_column(String(100), unique=True)
    team:        Mapped[str]   = mapped_column(String(50))
    active:      Mapped[bool]  = mapped_column(Boolean, default=True)
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="service", cascade="all, delete-orphan"
    )

class Deployment(Base):
    __tablename__ = "deployments"
    id:          Mapped[str]              = mapped_column(String(36), primary_key=True,
                                             default=lambda: str(uuid.uuid4()))
    service_id:  Mapped[int]              = mapped_column(ForeignKey("services.id"))
    image_tag:   Mapped[str]              = mapped_column(String(200))
    environment: Mapped[Environment]      = mapped_column(SAEnum(Environment))
    replicas:    Mapped[int]              = mapped_column(Integer, default=1)
    status:      Mapped[DeploymentStatus] = mapped_column(SAEnum(DeploymentStatus),
                                             default=DeploymentStatus.PENDING)
    deployed_by: Mapped[str]              = mapped_column(String(100))
    created_at:  Mapped[datetime]         = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:  Mapped[datetime]         = mapped_column(DateTime, default=datetime.utcnow,
                                             onupdate=datetime.utcnow)
    service: Mapped["Service"] = relationship("Service", back_populates="deployments")

# ── Database setup ────────────────────────────────────────────────────────

engine = create_async_engine("sqlite+aiosqlite:///./deploy.db", echo=False)
AsyncSession_ = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with AsyncSession_() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# ── Pydantic schemas ──────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    team: str

class ServiceOut(BaseModel):
    id: int; name: str; team: str; active: bool; created_at: datetime
    model_config = {"from_attributes": True}   # allow creating from ORM objects

class DeploymentCreate(BaseModel):
    service_name: str
    image_tag: str = Field(..., min_length=1)
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=20)
    deployed_by: str

class DeploymentOut(BaseModel):
    id: str; service_id: int; image_tag: str; environment: Environment
    replicas: int; status: DeploymentStatus; deployed_by: str
    created_at: datetime; updated_at: datetime
    model_config = {"from_attributes": True}

class DeploymentWithService(DeploymentOut):
    service: ServiceOut

class StatsOut(BaseModel):
    total_deployments: int
    by_status: dict
    by_environment: dict

# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(title="Deployment API (DB)", version="2.0.0")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

DB = Annotated[AsyncSession, Depends(get_db)]

# Services
@app.post("/services", response_model=ServiceOut, status_code=201, tags=["services"])
async def create_service(req: ServiceCreate, db: DB):
    existing = await db.execute(select(Service).where(Service.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Service {req.name!r} already exists")
    svc = Service(name=req.name, team=req.team)
    db.add(svc); await db.flush(); await db.refresh(svc)
    return svc

@app.get("/services", response_model=List[ServiceOut], tags=["services"])
async def list_services(db: DB):
    result = await db.execute(select(Service).where(Service.active == True))
    return result.scalars().all()

# Deployments
@app.post("/deployments", response_model=DeploymentOut, status_code=201, tags=["deployments"])
async def create_deployment(req: DeploymentCreate, db: DB):
    result = await db.execute(select(Service).where(Service.name == req.service_name))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(404, f"Service {req.service_name!r} not found")
    dep = Deployment(
        service_id=svc.id, image_tag=req.image_tag, environment=req.environment,
        replicas=req.replicas, deployed_by=req.deployed_by,
    )
    db.add(dep); await db.flush(); await db.refresh(dep)
    return dep

@app.get("/deployments", response_model=List[DeploymentOut], tags=["deployments"])
async def list_deployments(
    db: DB,
    environment: Optional[Environment] = Query(default=None),
    status: Optional[DeploymentStatus] = Query(default=None),
    service_name: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query = select(Deployment).order_by(desc(Deployment.created_at))
    if environment: query = query.where(Deployment.environment == environment)
    if status:      query = query.where(Deployment.status == status)
    if service_name:
        query = query.join(Service).where(Service.name == service_name)
    result = await db.execute(query.limit(page_size).offset((page-1)*page_size))
    return result.scalars().all()

@app.get("/deployments/{dep_id}", response_model=DeploymentWithService, tags=["deployments"])
async def get_deployment(dep_id: str, db: DB):
    result = await db.execute(
        select(Deployment).where(Deployment.id == dep_id)
        .options(selectinload(Deployment.service))
    )
    dep = result.scalar_one_or_none()
    if not dep: raise HTTPException(404, "Deployment not found")
    return dep

@app.patch("/deployments/{dep_id}/status", response_model=DeploymentOut, tags=["deployments"])
async def update_status(dep_id: str, status: DeploymentStatus, db: DB):
    result = await db.execute(select(Deployment).where(Deployment.id == dep_id))
    dep = result.scalar_one_or_none()
    if not dep: raise HTTPException(404, "Deployment not found")
    dep.status = status; dep.updated_at = datetime.utcnow()
    await db.flush(); await db.refresh(dep)
    return dep

@app.get("/stats", response_model=StatsOut, tags=["analytics"])
async def get_stats(db: DB):
    total_result = await db.execute(select(func.count(Deployment.id)))
    total = total_result.scalar()

    status_result = await db.execute(
        select(Deployment.status, func.count(Deployment.id))
        .group_by(Deployment.status)
    )
    env_result = await db.execute(
        select(Deployment.environment, func.count(Deployment.id))
        .group_by(Deployment.environment)
    )
    return StatsOut(
        total_deployments=total,
        by_status={str(r[0].value): r[1] for r in status_result},
        by_environment={str(r[0].value): r[1] for r in env_result},
    )
"""

with open("deployment_api_db.py", "w") as f:
    f.write(FULL_API_WITH_DB.strip())

print("Saved: deployment_api_db.py")
print()
print("Run with:")
print("  uvicorn deployment_api_db:app --reload --port 8000")
print()
print("Then try:")
print("  POST /services           { name, team }")
print("  POST /deployments        { service_name, image_tag, environment, deployed_by }")
print("  GET  /deployments        ?environment=prod&status=running")
print("  GET  /deployments/{id}   (includes service details)")
print("  PATCH /deployments/{id}/status   ?status=success")
print("  GET  /stats              (deployment counts)")
```

</div>

### What just happened?
We wrote `deployment_api_db.py` — the Chapter 5 API rewritten to use a real SQLite database instead of an in-memory dict.

Key differences from Chapter 5's version:

- **`@app.on_event("startup")`** — runs once when the server starts. We use it to create the database tables. In production you'd use Alembic migrations instead.
- **`DB = Annotated[AsyncSession, Depends(get_db)]`** — the DB session dependency, injected into every route that needs database access.
- **`selectinload(Deployment.service)`** in `get_deployment` — loads the related `Service` object in the same query, so `dep.service.name` works without another DB round-trip.
- **`?status=success`** in the PATCH route — status is passed as a query param rather than in the body (for a simple scalar update, this is idiomatic)
- The stats endpoint uses `func.count()` and GROUP BY — real SQL aggregation, not Python loops

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
# Test the complete DB-backed API end-to-end
import asyncio, importlib.util

spec = importlib.util.spec_from_file_location("deployment_api_db", "deployment_api_db.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# Init DB
asyncio.run(mod.startup())

from fastapi.testclient import TestClient
client = TestClient(mod.app)

print("=== End-to-End API + Database Test ===\n")

# Create services
for svc in [
    {"name": "auth-api", "team": "platform"},
    {"name": "user-svc", "team": "backend"},
    {"name": "payment-api", "team": "payments"},
]:
    r = client.post("/services", json=svc)
    print(f"Created service: {r.json()['name']} (id={r.json()['id']})")

# Create deployments
deployments = [
    {"service_name": "auth-api",    "image_tag": "v2.1.0", "environment": "prod",    "deployed_by": "ci"},
    {"service_name": "auth-api",    "image_tag": "v2.0.9", "environment": "staging", "deployed_by": "alice"},
    {"service_name": "user-svc",    "image_tag": "v1.5.3", "environment": "prod",    "deployed_by": "ci"},
    {"service_name": "payment-api", "image_tag": "v3.0.0", "environment": "prod",    "deployed_by": "bob"},
    {"service_name": "user-svc",    "image_tag": "v1.5.4", "environment": "dev",     "deployed_by": "carol"},
]
dep_ids = []
print()
for req in deployments:
    r = client.post("/deployments", json=req)
    dep_ids.append(r.json()["id"])
    print(f"Deployed {req['service_name']:12s} {req['image_tag']:8s} → {req['environment']}")

# Update some statuses
for dep_id, status in zip(dep_ids[:3], ["success", "running", "success"]):
    client.patch(f"/deployments/{dep_id}/status?status={status}")

# Query with filters
print()
r = client.get("/deployments?environment=prod")
print(f"Prod deployments: {len(r.json())}")

r = client.get("/deployments?status=success")
print(f"Successful deployments: {len(r.json())}")

# Get one with full service details
r = client.get(f"/deployments/{dep_ids[0]}")
d = r.json()
print(f"\nDeployment detail:")
print(f"  id:          {d['id'][:12]}...")
print(f"  image:       {d['image_tag']}")
print(f"  environment: {d['environment']}")
print(f"  status:      {d['status']}")
print(f"  service:     {d['service']['name']} (team={d['service']['team']})")

# Stats
r = client.get("/stats")
stats = r.json()
print(f"\nStats:")
print(f"  Total deployments: {stats['total_deployments']}")
print(f"  By status:      {stats['by_status']}")
print(f"  By environment: {stats['by_environment']}")
```

</div>

### What just happened?
We tested the entire stack — FastAPI + SQLAlchemy + SQLite — using `TestClient`, all without a running server.

`asyncio.run(mod.startup())` creates the tables before the tests run. `TestClient` then makes HTTP requests that go through the full chain: FastAPI route → dependency injection → SQLAlchemy session → SQLite file on disk → response.

What the test proves:
- Services are created and persisted
- Deployments are created and linked to services
- Status updates work and are saved
- Filters (`?environment=prod`, `?status=success`) work correctly
- The `GET /deployments/{id}` response includes the nested `service` object (thanks to `selectinload`)
- The `/stats` endpoint returns correct counts from real SQL aggregation

After this test, a `deployments.db` file exists on disk — you can open it with any SQLite browser to inspect the data.

---
## Summary

### The full stack you now know

```
HTTP Request
    ↓
FastAPI Route (@app.post, @app.get)
    ↓ validates with
Pydantic Model (BaseModel, Field, @validator)
    ↓ passes to
Async Function (async def, await)
    ↓ calls
SQLAlchemy Async Session (CRUD operations)
    ↓ talks to
PostgreSQL / SQLite Database
    ↓ returns
Pydantic Response Model (serialized to JSON)
    ↓
HTTP Response
```

### Key SQLAlchemy patterns

```python
# Model
class Item(Base):
    __tablename__ = "items"
    id:   Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

# Session dependency (FastAPI)
async def get_db():
    async with AsyncSession_() as session:
        try:    yield session;  await session.commit()
        except: await session.rollback(); raise

# Create
item = Item(name="test"); db.add(item); await db.flush()

# Read
result = await db.execute(select(Item).where(Item.id == 1))
item = result.scalar_one_or_none()

# Update
item.name = "updated"; await db.flush()

# Delete
await db.delete(item)

# Query with filters
await db.execute(
    select(Item)
    .where(and_(Item.active == True, Item.team == "backend"))
    .order_by(desc(Item.created_at))
    .limit(20).offset(0)
)
```

### What you've built across chapters 4-6
A **production-ready Deployment Management API** with:
- Input validation (Pydantic)
- Authentication via dependency injection (FastAPI)
- Persistent storage with relationships (SQLAlchemy)
- Async throughout (asyncio + aiosqlite/asyncpg)
- Automatic Swagger docs
- Full test coverage via TestClient

## Next steps to explore
- **Alembic** — proper database migrations for production
- **Redis** — caching with `aioredis`
- **Celery** — background job queues
- **Docker Compose** — run FastAPI + PostgreSQL + Redis together
- **pytest + pytest-asyncio** — proper async test suites

---
## Add-on: Transactions, Unit of Work, and Session Pitfalls

This is one of the most valuable real-world topics in database work.

At a senior level, people care whether you understand:
- what should happen in one transaction
- when to commit vs flush
- why long-lived sessions are dangerous
- how to avoid partial writes when multiple steps must succeed together

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
import asyncio
from sqlalchemy import select


async def transaction_demo():
    async with AsyncSessionLocal() as db:
        try:
            service = await create_service(db, 'reporting-api', 'analytics', 'Reporting service')
            await create_deployment(db, service.id, 'v1.0.0', Environment.STAGING, 'mentor', 2)

            # Simulate a failure after part of the work has happened
            raise RuntimeError('health check failed before commit')

            await db.commit()
        except Exception as exc:
            await db.rollback()
            print('Rolled back transaction because:', exc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Service).where(Service.name == 'reporting-api'))
        service = result.scalar_one_or_none()
        print('Service exists after rollback?', bool(service))

asyncio.run(transaction_demo())
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
FLUSH_VS_COMMIT = """
flush()
  - sends pending SQL to the database now
  - gives you generated IDs before commit
  - changes are still inside the current transaction

commit()
  - permanently saves the transaction
  - ends the transaction boundary
  - should usually happen once per request/unit of work

refresh(obj)
  - reloads the object from the database
  - useful after defaults or triggers change values
"""

print(FLUSH_VS_COMMIT)
```

</div>

### Why this add-on matters

A strong database answer is not only about writing queries.
It is also about transaction boundaries and consistency.

Useful interview phrases:
- "I commit once per unit of work, not after every tiny step."
- "I use flush when I need generated IDs before commit."
- "I rollback the whole transaction if one dependent step fails."
- "I avoid long-lived sessions because they can hold stale state and leak resources."

That is the kind of thinking that makes database code safer in production.

---
## Practice Questions

---

### Question 1 — Add a New Model and Relationship

Add a new SQLAlchemy model `DeploymentTag` to the existing setup:
- Table name: `deployment_tags`
- Fields: `id` (int, PK), `deployment_id` (FK to `deployments.id`), `key` (str, 50), `value` (str, 200)
- Add a `tags` relationship to `Deployment` (one-to-many, cascade delete)

Then write two async functions:
- `add_tag(db, deployment_id, key, value) -> DeploymentTag`
- `get_tags(db, deployment_id) -> list[DeploymentTag]`

Test by creating a deployment and adding tags like `{"env": "prod", "team": "platform", "version": "v2.1"}`, then fetching them back.

---

### Question 2 — Query Practice

Using the `Deployment` model, write an async function `get_deployment_stats(db) -> dict` that returns:

```python
{
  "total": 10,
  "prod_count": 4,
  "failed_count": 2,
  "latest_deployment": "dep-abc123",   # id of most recently created
  "services_deployed": 3,              # count of distinct service_ids
}
```

Use SQLAlchemy's `func.count()`, `func.max()`, and `select()` with `.where()` conditions — no Python loops over all rows.

Hint: you may need multiple `db.execute()` calls, or look up `func.count(Deployment.service_id.distinct())` for the distinct count.
