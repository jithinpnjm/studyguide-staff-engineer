---
title: "Test App"
description: "Generated from mlops/PYTHON/Advanced/deployment_control_center/tests/test_app.py"
slug: "/python-advanced/deployment-control-center-tests-test-app"
---

> Source: `mlops/PYTHON/Advanced/deployment_control_center/tests/test_app.py`

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    """
    Smallest useful test.

    It checks:
    - the app starts
    - the route exists
    - the response looks correct
    """

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data


def test_create_and_fetch_deployment() -> None:
    payload = {
        "service_name": "auth-api",
        "image_tag": "v2.1.0",
        "environment": "prod",
        "replicas": 3,
        "requested_by": "pytest",
    }

    create_response = client.post("/deployments", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["service_name"] == "auth-api"
    assert created["status"] == "running"

    deployment_id = created["id"]
    get_response = client.get(f"/deployments/{deployment_id}")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["id"] == deployment_id


def test_update_status() -> None:
    payload = {
        "service_name": "user-svc",
        "image_tag": "v1.5.0",
        "environment": "staging",
        "replicas": 2,
        "requested_by": "pytest",
    }
    created = client.post("/deployments", json=payload).json()

    update_response = client.patch(
        f"/deployments/{created['id']}/status",
        json={"status": "success"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "success"


def test_validation_error_for_bad_payload() -> None:
    """
    FastAPI + Pydantic should reject invalid input automatically.
    """

    bad_payload = {
        "service_name": "INVALID NAME",
        "image_tag": "v2.1.0",
        "environment": "prod",
        "replicas": 0,
        "requested_by": "pytest",
    }
    response = client.post("/deployments", json=bad_payload)
    assert response.status_code == 422

```
