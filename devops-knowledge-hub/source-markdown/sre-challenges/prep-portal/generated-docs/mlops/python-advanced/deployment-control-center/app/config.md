---
title: "Config"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/app/config.py"
slug: "/python-advanced/deployment-control-center-app-config"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/app/config.py`

```python
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Typed application settings.

    Why this file matters:
    - It keeps configuration in one place.
    - It avoids scattered os.environ lookups.
    - It gives validation for values like timeouts and concurrency limits.
    """

    model_config = SettingsConfigDict(env_prefix="CONTROL_", extra="ignore")

    app_name: str = "Deployment Control Center"
    app_env: str = Field(default="dev", pattern="^(dev|staging|prod|test)$")
    database_url: str = "sqlite+aiosqlite:///./deployments.db"
    max_concurrency: int = Field(default=3, ge=1, le=20)
    request_timeout_seconds: int = Field(default=5, ge=1, le=60)
    api_token: SecretStr = SecretStr("demo-token")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return one cached settings object.

    This is the standard pattern in many FastAPI applications because:
    - config does not usually need to be rebuilt on every request
    - it is easy to override in tests
    """

    return Settings()

```
