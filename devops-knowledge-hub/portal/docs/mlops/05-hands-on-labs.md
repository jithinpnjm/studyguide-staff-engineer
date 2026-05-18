---
title: "Hands-On Labs"
sidebar_position: 5
---

# MLOps — Hands-On Labs

## Prerequisites

Before starting the labs, ensure you have:

```bash
pip install mlflow scikit-learn pandas numpy matplotlib fastapi uvicorn httpx pytest
```

Start the MLflow tracking server locally (run in a separate terminal, keep it running):

```bash
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
```

Open [http://localhost:5000](http://localhost:5000) in your browser to see the MLflow UI.

---

## Lab 1: MLflow Iris Classification (Full Walkthrough)

**Goal**: Train three classifiers on the Iris dataset, log everything to MLflow, and compare runs in the UI.

**What you will practice**: `set_experiment`, `start_run`, `log_param`, `log_metric`, `log_artifact`, `log_model`, `search_runs`

### Step 1: Setup

```python
import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)

# Connect to local MLflow
mlflow.set_tracking_uri("sqlite:///mlflow.db")
print(f"Tracking URI: {mlflow.get_tracking_uri()}")
```

### Step 2: Load and Explore Data

```python
iris = load_iris()
df = pd.DataFrame(iris.data, columns=iris.feature_names)
df['species'] = [iris.target_names[t] for t in iris.target]

print(f"Shape: {df.shape}")
print(f"Features: {list(iris.feature_names)}")
print(f"Classes: {list(iris.target_names)}")
print(df['species'].value_counts())
```

### Step 3: Prepare Data

```python
X, y = iris.data, iris.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Scale for LR and SVM (not needed for Random Forest)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print(f"Train: {len(X_train)}, Test: {len(X_test)}")
```

### Step 4: Create the Experiment

```python
EXPERIMENT_NAME = "iris-classification"
mlflow.set_experiment(EXPERIMENT_NAME)

exp = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
print(f"Experiment ID: {exp.experiment_id}")
print(f"Artifact Location: {exp.artifact_location}")
```

### Step 5: Training Helper Function

```python
def train_and_log(model, model_name, params, X_train, X_test, y_train, y_test):
    with mlflow.start_run(run_name=model_name) as run:
        # Log parameters
        mlflow.log_param("model_type", model_name)
        mlflow.log_param("test_size", 0.2)
        mlflow.log_param("random_state", 42)
        mlflow.log_params(params)

        # Train
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        # Compute metrics
        metrics = {
            "accuracy":  accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred, average='weighted'),
            "recall":    recall_score(y_test, y_pred, average='weighted'),
            "f1_score":  f1_score(y_test, y_pred, average='weighted'),
        }

        # Log metrics
        mlflow.log_metrics(metrics)

        # Add tags
        mlflow.set_tag("dataset", "iris")
        mlflow.set_tag("task", "classification")

        # Log confusion matrix as artifact
        cm = confusion_matrix(y_test, y_pred)
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.imshow(cm, cmap='Blues')
        ax.set_xlabel('Predicted')
        ax.set_ylabel('Actual')
        ax.set_title(f'Confusion Matrix — {model_name}')
        for i in range(3):
            for j in range(3):
                ax.text(j, i, cm[i, j], ha='center', va='center', fontsize=12)
        plt.tight_layout()
        cm_path = f"cm_{model_name.replace(' ', '_')}.png"
        plt.savefig(cm_path)
        plt.close()
        mlflow.log_artifact(cm_path)

        # Save model
        mlflow.sklearn.log_model(model, "model")

        print(f"{model_name}: accuracy={metrics['accuracy']:.4f}, f1={metrics['f1_score']:.4f}")
        return {**{"model_name": model_name, "run_id": run.info.run_id}, **metrics}
```

### Step 6: Train All Three Models

```python
# Model 1: Logistic Regression
lr_results = train_and_log(
    model=LogisticRegression(C=1.0, max_iter=200, random_state=42),
    model_name="Logistic Regression",
    params={"C": 1.0, "max_iter": 200, "solver": "lbfgs"},
    X_train=X_train_scaled, X_test=X_test_scaled,
    y_train=y_train, y_test=y_test,
)

# Model 2: Random Forest (no scaling needed)
rf_results = train_and_log(
    model=RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
    model_name="Random Forest",
    params={"n_estimators": 100, "max_depth": 5, "criterion": "gini"},
    X_train=X_train, X_test=X_test,
    y_train=y_train, y_test=y_test,
)

# Model 3: SVM
svm_results = train_and_log(
    model=SVC(C=1.0, kernel='rbf', random_state=42),
    model_name="SVM",
    params={"C": 1.0, "kernel": "rbf", "gamma": "scale"},
    X_train=X_train_scaled, X_test=X_test_scaled,
    y_train=y_train, y_test=y_test,
)
```

### Step 7: Compare Results Programmatically

```python
# Query all runs from this experiment, sorted by accuracy
runs_df = mlflow.search_runs(
    experiment_names=[EXPERIMENT_NAME],
    order_by=["metrics.accuracy DESC"],
)

cols = ['tags.mlflow.runName', 'metrics.accuracy', 'metrics.f1_score', 'params.model_type']
print(runs_df[cols].to_string(index=False))

best_run_id = runs_df.iloc[0]["run_id"]
print(f"\nBest model run ID: {best_run_id}")
print(f"Model URI: runs:/{best_run_id}/model")
```

**Checkpoint**: Open [http://localhost:5000](http://localhost:5000), click on `iris-classification`, select all 3 runs, click Compare. Review the parallel coordinates chart.

---

## Lab 2: MLflow Model Registry Workflow

**Goal**: Register the best model, navigate stage transitions, and load by stage.

**Continues from Lab 1** — you need at least one logged model with a run ID.

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()
MODEL_NAME = "IrisClassifier"

# Step 1: Register the best run's model
best_run_id = runs_df.iloc[0]["run_id"]  # from Lab 1
model_uri = f"runs:/{best_run_id}/model"

registered = mlflow.register_model(model_uri, MODEL_NAME)
print(f"Registered: {MODEL_NAME} v{registered.version}")
print(f"Stage: {registered.current_stage}")  # None
```

```python
# Step 2: Promote to Staging
client.transition_model_version_stage(
    name=MODEL_NAME,
    version=registered.version,
    stage="Staging",
)
print(f"v{registered.version} is now in Staging")

# Step 3: Load from Staging and run tests
staging_model = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}/Staging")
staging_preds = staging_model.predict(X_test_scaled)
staging_acc = accuracy_score(y_test, staging_preds)
print(f"Staging model accuracy: {staging_acc:.4f}")

# Simulate integration test
assert staging_acc > 0.85, "Staging model failed quality gate"
print("Integration test passed")
```

```python
# Step 4: Promote to Production
client.transition_model_version_stage(
    name=MODEL_NAME,
    version=registered.version,
    stage="Production",
    archive_existing_versions=True,
)
print(f"v{registered.version} is now in Production")

# Step 5: Load the Production model (the way serving code does it)
prod_model = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}/Production")
print(f"Production model loaded. Type: {type(prod_model).__name__}")

# Step 6: Add metadata
client.update_registered_model(
    name=MODEL_NAME,
    description="Iris flower species classifier. Best accuracy from Lab 1 experiment.",
)
client.set_model_version_tag(MODEL_NAME, registered.version, "approved_by", "lab-engineer")
```

```python
# Step 7: List all versions
for version in client.get_latest_versions(MODEL_NAME):
    print(f"v{version.version} — {version.current_stage} — run {version.run_id[:8]}")
```

---

## Lab 3: Deploy MLflow Model as FastAPI Endpoint

**Goal**: Load a registered MLflow model inside a FastAPI service and serve predictions over HTTP.

### Save the serving script

```python
# Save as model_server.py
serving_code = '''
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mlflow.sklearn
import numpy as np
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Iris Classifier API", version="1.0.0")

MODEL_URI = "models:/IrisClassifier/Production"
model = None

CLASS_NAMES = ["setosa", "versicolor", "virginica"]

@app.on_event("startup")
async def load_model():
    global model
    logger.info(f"Loading model from {MODEL_URI}")
    mlflow.set_tracking_uri("sqlite:///mlflow.db")
    model = mlflow.sklearn.load_model(MODEL_URI)
    logger.info("Model loaded successfully")

class PredictRequest(BaseModel):
    features: list[list[float]]
    # Each inner list: [sepal_length, sepal_width, petal_length, petal_width]

class PredictResponse(BaseModel):
    predictions: list[str]
    class_indices: list[int]
    latency_ms: float

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start = time.perf_counter()
    features = np.array(request.features)
    class_indices = model.predict(features).tolist()
    predictions = [CLASS_NAMES[i] for i in class_indices]
    latency_ms = (time.perf_counter() - start) * 1000

    return PredictResponse(
        predictions=predictions,
        class_indices=class_indices,
        latency_ms=round(latency_ms, 2),
    )

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.get("/model-info")
async def model_info():
    return {"model_uri": MODEL_URI, "model_type": type(model).__name__}
'''

with open("model_server.py", "w") as f:
    f.write(serving_code)
print("Saved model_server.py")
```

### Run the server

```bash
uvicorn model_server:app --reload --port 8080
```

### Test with httpx

```python
import httpx

BASE_URL = "http://localhost:8080"

# Health check
response = httpx.get(f"{BASE_URL}/health")
print(response.json())  # {"status": "healthy", "model_loaded": true}

# Single prediction (Iris setosa: small petal)
payload = {"features": [[5.1, 3.5, 1.4, 0.2]]}
response = httpx.post(f"{BASE_URL}/predict", json=payload)
print(response.json())
# {"predictions": ["setosa"], "class_indices": [0], "latency_ms": 1.2}

# Batch prediction
payload = {
    "features": [
        [5.1, 3.5, 1.4, 0.2],   # setosa
        [6.2, 2.9, 4.3, 1.3],   # versicolor
        [7.3, 2.9, 6.3, 1.8],   # virginica
    ]
}
response = httpx.post(f"{BASE_URL}/predict", json=payload)
print(response.json())
# {"predictions": ["setosa", "versicolor", "virginica"], ...}
```

**Auto-generated docs**: Open [http://localhost:8080/docs](http://localhost:8080/docs) for the interactive Swagger UI.

---

## Lab 4: Deployment Control Center Capstone Overview

**Goal**: Understand and build the Deployment Control Center — a realistic FastAPI + SQLAlchemy + asyncio project that models a platform tool you would actually build and use.

### What the project does

The Deployment Control Center is an internal API for managing service deployments. It demonstrates how advanced Python and web framework patterns fit together:

- **FastAPI** handles HTTP routing and request/response validation
- **Pydantic** validates incoming deployment requests and application settings
- **asyncio + Semaphore** fans out deployment actions to multiple services concurrently with bounded concurrency
- **SQLAlchemy async** persists deployment state to a database
- **Protocol** enables pluggable deployment backends (simulated, real Kubernetes, etc.)
- **dataclass** holds internal deployment state with an audit trail

### Project structure

```
deployment_control_center/
  app/
    config.py      # Pydantic BaseSettings — env-driven config
    schemas.py     # Pydantic models for request/response shapes
    models.py      # SQLAlchemy ORM models (database tables)
    db.py          # Async engine and session factory
    services.py    # Business logic — orchestration layer
    main.py        # FastAPI app, routes
  tests/
    test_app.py    # pytest + TestClient
```

### Step 1: Define the contract layer

```python
from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict

class Environment(str, Enum):
    DEV     = 'dev'
    STAGING = 'staging'
    PROD    = 'prod'

class DeploymentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')  # reject unknown fields

    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag:    str = Field(..., min_length=1)
    environment:  Environment
    replicas:     int = Field(default=1, ge=1, le=20)
    requested_by: str = Field(..., min_length=1)

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='CONTROL_', extra='ignore')

    api_name:                str = 'deployment-control-center'
    max_concurrency:         int = 3
    default_timeout_seconds: int = 5
```

### Step 2: Add the domain objects and async backend

```python
import asyncio, random, uuid, time
from dataclasses import dataclass, field
from typing import Protocol
from contextlib import contextmanager
from functools import wraps

@dataclass
class DeploymentRecord:
    id:           str
    service_name: str
    image_tag:    str
    environment:  Environment
    replicas:     int
    requested_by: str
    status:       str = 'pending'
    events:       list[str] = field(default_factory=list)

class DeployBackend(Protocol):
    async def deploy(self, record: DeploymentRecord) -> dict: ...

def retry_async(max_attempts: int = 3, delay: float = 0.1):
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt < max_attempts:
                        await asyncio.sleep(delay * attempt)
            raise last_exc
        return wrapper
    return decorator

class SimulatedDeployClient:
    def __init__(self, max_concurrency: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrency)

    @retry_async(max_attempts=3, delay=0.05)
    async def deploy(self, record: DeploymentRecord) -> dict:
        async with self.semaphore:
            await asyncio.sleep(random.uniform(0.1, 0.3))
            if random.random() < 0.15:
                raise ConnectionError(f'transient failure for {record.service_name}')
            return {'deployment_id': record.id, 'service_name': record.service_name, 'status': 'running'}
```

### Step 3: Orchestration and fan-out

```python
async def run_deployment(req: DeploymentRequest, backend: DeployBackend) -> DeploymentRecord:
    record = DeploymentRecord(
        id=str(uuid.uuid4()),
        service_name=req.service_name,
        image_tag=req.image_tag,
        environment=req.environment,
        replicas=req.replicas,
        requested_by=req.requested_by,
    )
    record.events.append('request_validated')
    result = await backend.deploy(record)
    record.status = result['status']
    record.events.append('deployment_started')
    return record

async def rollout_many(service_names: list[str]) -> list[DeploymentRecord]:
    client = SimulatedDeployClient(max_concurrency=3)
    requests = [
        DeploymentRequest(
            service_name=name, image_tag='v1.0.0',
            environment=Environment.STAGING, replicas=2, requested_by='ci-pipeline',
        )
        for name in service_names
    ]
    tasks = [run_deployment(req, client) for req in requests]
    return await asyncio.gather(*tasks)

# Run it
records = asyncio.run(rollout_many(['auth-api', 'user-svc', 'payment-api']))
for r in records:
    print(r.service_name, r.status, r.events)
```

### Step 4: Run the full project

```bash
cd deployment_control_center
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy aiosqlite pydantic pydantic-settings httpx pytest
uvicorn app.main:app --reload
```

Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

```bash
# Run tests
pytest tests/ -q
```

**Interview takeaway**: If you can explain this project clearly, you demonstrate Pydantic input validation, FastAPI route structure, asyncio concurrency control, SQLAlchemy persistence, and why services and routes should be separated.

---

## Lab 5: Monitor Model Endpoint with Prometheus + Grafana

**Goal**: Instrument the FastAPI model server with Prometheus metrics and visualize them in Grafana.

### Step 1: Add prometheus-client to the serving code

```python
# Extended model_server.py with Prometheus metrics
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app
import time

# Define metrics
PREDICTIONS_TOTAL = Counter(
    "model_predictions_total",
    "Total number of prediction requests",
    ["model_name", "status"],
)
PREDICTION_LATENCY = Histogram(
    "model_prediction_latency_seconds",
    "Prediction request latency",
    ["model_name"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)
MODEL_VERSION = Gauge("model_version_info", "Model version info", ["model_name", "stage"])

# Mount metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Updated predict endpoint
@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if model is None:
        PREDICTIONS_TOTAL.labels(model_name="iris", status="error").inc()
        raise HTTPException(status_code=503, detail="Model not loaded")

    with PREDICTION_LATENCY.labels(model_name="iris").time():
        features = np.array(request.features)
        class_indices = model.predict(features).tolist()

    predictions = [CLASS_NAMES[i] for i in class_indices]
    PREDICTIONS_TOTAL.labels(model_name="iris", status="success").inc()

    return PredictResponse(predictions=predictions, class_indices=class_indices, latency_ms=0)
```

### Step 2: Prometheus configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "model-serving"
    static_configs:
      - targets: ["localhost:8080"]
    metrics_path: "/metrics"
```

```bash
# Run Prometheus
docker run -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### Step 3: Grafana dashboard queries

```promql
# Request rate (per second)
rate(model_predictions_total[5m])

# p99 prediction latency
histogram_quantile(0.99, rate(model_prediction_latency_seconds_bucket[5m]))

# Error rate
rate(model_predictions_total{status="error"}[5m])
/ rate(model_predictions_total[5m])

# Total predictions in last hour
increase(model_predictions_total[1h])
```

```bash
# Run Grafana
docker run -d -p 3000:3000 grafana/grafana
# Default login: admin/admin
# Add Prometheus as data source: http://localhost:9090
```

### Step 4: Load test to generate metrics

```bash
pip install locust
```

```python
# locustfile.py
from locust import HttpUser, task, between
import random

class ModelUser(HttpUser):
    wait_time = between(0.1, 0.5)

    @task
    def predict(self):
        # Random iris features
        features = [
            [round(random.uniform(4.5, 7.5), 1) for _ in range(4)]
        ]
        self.client.post("/predict", json={"features": features})
```

```bash
locust -f locustfile.py --headless -u 10 -r 2 --run-time 60s --host http://localhost:8080
```

Watch the Grafana dashboard update in real time as requests flow through the model server.

---

## Lab Summary

| Lab | Skill Practiced |
|---|---|
| Lab 1 | MLflow experiment tracking end-to-end |
| Lab 2 | Model Registry: register, stage transition, load by stage |
| Lab 3 | Deploy MLflow model as a production FastAPI API |
| Lab 4 | Capstone: full Python project with FastAPI + asyncio + SQLAlchemy |
| Lab 5 | Observability: Prometheus metrics + Grafana for ML serving |
