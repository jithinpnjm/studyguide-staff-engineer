---
title: "Expert"
sidebar_position: 3
---

# MLOps — Expert

## ML Model Serving Patterns

Model serving converts a trained model into a production API that handles real traffic. The right approach depends on latency requirements, throughput, model size, and operational complexity.

### REST API Patterns

The simplest serving pattern: wrap your model in a FastAPI or Flask application.

```
Client → Load Balancer → Model API Pod → Model (loaded in memory)
```

Key design decisions:
- **Synchronous vs async**: async allows handling concurrent requests without blocking on I/O
- **Batch vs single**: batching multiple requests improves GPU utilization but adds latency
- **Warm loading**: load the model at startup, not per-request (cold load is catastrophic for latency)

### FastAPI + MLflow Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mlflow.sklearn
import numpy as np
import time

app = FastAPI(title="Model Serving API")

# Load model once at startup — never per-request
MODEL_URI = "models:/IrisClassifier/Production"
model = None

@app.on_event("startup")
async def load_model():
    global model
    model = mlflow.sklearn.load_model(MODEL_URI)
    print(f"Model loaded from: {MODEL_URI}")

class PredictRequest(BaseModel):
    features: list[list[float]]  # batch of feature vectors

class PredictResponse(BaseModel):
    predictions: list[int]
    model_version: str
    latency_ms: float

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(503, "Model not loaded")

    start = time.perf_counter()
    predictions = model.predict(np.array(request.features))
    latency_ms = (time.perf_counter() - start) * 1000

    return PredictResponse(
        predictions=predictions.tolist(),
        model_version="Production",
        latency_ms=round(latency_ms, 2),
    )

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}
```

### BentoML

BentoML is a serving framework designed specifically for ML models. It handles batching, multiple runners, and deployment artifacts (Bentos).

```python
import bentoml
import mlflow

# Save model to BentoML from MLflow
mlflow_model = mlflow.sklearn.load_model("models:/IrisClassifier/Production")
bento_model = bentoml.sklearn.save_model("iris_classifier", mlflow_model)

# Define service
import bentoml
from bentoml.io import NumpyNdarray

svc = bentoml.Service("iris_classifier", runners=[
    bentoml.sklearn.get("iris_classifier:latest").to_runner()
])

@svc.api(input=NumpyNdarray(), output=NumpyNdarray())
async def predict(input_data):
    return await svc.runner.predict.async_run(input_data)
```

```bash
# Serve
bentoml serve iris_classifier:latest --reload

# Build and containerize
bentoml build
bentoml containerize iris_classifier:latest
```

### NVIDIA Triton Inference Server

Triton is the high-performance inference server for GPU workloads. It supports multiple frameworks (TensorRT, ONNX, PyTorch, TensorFlow) and advanced features like dynamic batching.

```
model_repository/
  iris_classifier/
    config.pbtxt     ← model configuration
    1/
      model.onnx     ← model file
```

```protobuf
# config.pbtxt
name: "iris_classifier"
platform: "onnxruntime_onnx"
max_batch_size: 64
dynamic_batching {
  preferred_batch_size: [8, 16, 32]
  max_queue_delay_microseconds: 100
}
input [
  { name: "input", data_type: TYPE_FP32, dims: [4] }
]
output [
  { name: "output", data_type: TYPE_INT64, dims: [1] }
]
```

```bash
# Run Triton
docker run --gpus all -p 8000:8000 -p 8001:8001 \
  -v /path/to/model_repository:/models \
  nvcr.io/nvidia/tritonserver:24.01-py3 \
  tritonserver --model-repository=/models
```

---

## GPU Scheduling on Kubernetes

Kubernetes does not have native GPU awareness. GPUs are exposed through extended resources via the NVIDIA device plugin.

### The GPU Stack

```
GPU hardware
  NVIDIA driver
    container runtime (nvidia-container-toolkit)
      NVIDIA device plugin (DaemonSet)
        kubelet extended resources
          scheduler placement
            Pod uses GPU
              DCGM exporter → Prometheus metrics
```

A failure at any layer makes GPUs unavailable to workloads.

### Requesting GPUs in Pod Spec

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: training-job
spec:
  containers:
    - name: trainer
      image: pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime
      resources:
        limits:
          nvidia.com/gpu: 2          # request exactly 2 GPUs
      command: ["python", "train.py"]
  nodeSelector:
    nvidia.com/gpu.product: "NVIDIA-A100-80GB"  # target specific GPU type
  tolerations:
    - key: dedicated
      operator: Equal
      value: gpu
      effect: NoSchedule
```

Important rules:
- GPU requests and limits must be equal (you get all-or-nothing)
- Standard GPU allocation is not fractional
- A Pod that requests 2 GPUs must land on a node with at least 2 free GPUs

### GPU Time-Slicing

Time-slicing allows multiple Pods to share one GPU. It is not hardware isolation — all Pods compete for the same GPU memory.

```yaml
# ConfigMap for time-slicing
apiVersion: v1
kind: ConfigMap
metadata:
  name: time-slicing-config
  namespace: gpu-operator
data:
  any: |
    version: v1
    flags:
      migStrategy: none
    sharing:
      timeSlicing:
        resources:
          - name: nvidia.com/gpu
            replicas: 4   # expose 1 GPU as 4 virtual GPUs
```

Use cases for time-slicing:
- Multiple small inference services sharing one GPU
- Development environments where strict isolation is not required

### MIG — Multi-Instance GPU

MIG (Multi-Instance GPU) partitions a GPU into hardware-isolated slices. Supported on A100, H100.

```bash
# Check MIG status
nvidia-smi mig -i 0 -lgip   # list GPU instance profiles

# Enable MIG mode
sudo nvidia-smi -i 0 -mig 1

# Create MIG instances (example: 3x 2g.20gb slices on A100)
sudo nvidia-smi mig -cgi 2g.20gb -C
```

In Kubernetes, MIG resources appear as:
```yaml
resources:
  limits:
    nvidia.com/mig-2g.20gb: 1   # request one 2g.20gb MIG slice
```

MIG vs time-slicing comparison:

| | Time-slicing | MIG |
|---|---|---|
| Hardware isolation | No | Yes |
| Memory isolation | No | Yes |
| Supported GPUs | Most NVIDIA GPUs | A100, H100, A30 |
| Use case | Dev/test, light inference | Multi-tenant production |
| Scheduling complexity | Low | Higher |

### NVIDIA GPU Operator

The GPU Operator automates all GPU node setup as a single Helm install:

```bash
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update

helm install gpu-operator nvidia/gpu-operator \
  --namespace gpu-operator \
  --create-namespace
```

The operator manages: drivers, container toolkit, device plugin, DCGM exporter, MIG manager, node feature discovery.

```bash
# Check operator health
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl describe node <gpu-node> | grep nvidia.com/gpu
```

---

## Kubeflow Pipelines

Kubeflow Pipelines provides a Kubernetes-native way to define, schedule, and run ML pipelines as DAGs of containerized steps.

### Defining a Pipeline

```python
from kfp import dsl
from kfp.dsl import component, pipeline, Output, Dataset, Model, Metrics

@component(base_image="python:3.11", packages_to_install=["scikit-learn", "pandas"])
def prepare_data(output_dataset: Output[Dataset]):
    from sklearn.datasets import load_iris
    import pandas as pd
    iris = load_iris(as_frame=True)
    df = iris.frame
    df.to_csv(output_dataset.path, index=False)

@component(base_image="python:3.11", packages_to_install=["scikit-learn", "mlflow"])
def train_model(
    input_dataset: Dataset,
    output_model: Output[Model],
    output_metrics: Output[Metrics],
    n_estimators: int = 100,
):
    import mlflow
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score

    df = pd.read_csv(input_dataset.path)
    X, y = df.drop("target", axis=1), df["target"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    model = RandomForestClassifier(n_estimators=n_estimators)
    model.fit(X_train, y_train)
    acc = accuracy_score(y_test, model.predict(X_test))

    output_metrics.log_metric("accuracy", acc)
    import pickle
    with open(output_model.path, "wb") as f:
        pickle.dump(model, f)

@pipeline(name="iris-pipeline")
def iris_pipeline(n_estimators: int = 100):
    prepare_task = prepare_data()
    train_task = train_model(
        input_dataset=prepare_task.outputs["output_dataset"],
        n_estimators=n_estimators,
    )

# Compile and submit
from kfp import compiler
compiler.Compiler().compile(iris_pipeline, "iris_pipeline.yaml")
```

---

## Model Monitoring

Models degrade silently. Monitoring is how you detect degradation before users notice.

### Data Drift Detection

Data drift occurs when the statistical distribution of incoming features changes from the distribution at training time.

```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

# Reference = training data distribution
# Current = recent production data
report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=train_df, current_data=production_df)

# Check result
result = report.as_dict()
if result["metrics"][0]["result"]["dataset_drift"]:
    print("ALERT: Data drift detected")
    # Trigger alert or retraining pipeline
```

### Concept Drift

Concept drift is when the relationship between features and the correct label changes, even if features themselves look the same. Examples: a fraud detection model trained before a new fraud pattern emerges, a churn model after a market competitor launches.

Detection requires labeled data in production (ground truth feedback), which is often delayed. Common approaches:
- **Population Stability Index (PSI)**: compares score distributions
- **Statistical tests**: KS test (continuous), chi-square (categorical)
- **Performance windows**: compute accuracy over rolling windows when ground truth arrives

### Prometheus Metrics for ML Services

Instrument your serving code to emit ML-specific metrics:

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Model version currently serving
model_version_gauge = Gauge("ml_model_version", "Current model version in production", ["model_name"])

# Prediction request count and latency
prediction_requests = Counter("ml_predictions_total", "Total predictions served", ["model_name", "status"])
prediction_latency = Histogram(
    "ml_prediction_latency_seconds",
    "Model inference latency",
    ["model_name"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

# Feature drift score (updated periodically)
drift_score = Gauge("ml_feature_drift_score", "Latest drift score", ["feature_name"])

# Usage
model_version_gauge.labels(model_name="iris_classifier").set(2)

with prediction_latency.labels(model_name="iris_classifier").time():
    prediction = model.predict(features)
    prediction_requests.labels(model_name="iris_classifier", status="success").inc()
```

---

## A/B Testing for Models

A/B testing allows you to compare two model versions by routing traffic splits and measuring outcomes.

```
                     ┌──────────────────────────────┐
Request              │    A/B Traffic Router        │
─────────────────►   │    (10% → Model B)           │
                     │    (90% → Model A)           │
                     └──────────────────────────────┘
                              │           │
                         Model A       Model B
                       (Production)  (Challenger)
                              │           │
                         Log prediction + metadata
                              │           │
                         Measure: accuracy, CTR, revenue
```

Implementation in nginx / Envoy or at the application layer:

```python
import random
import mlflow.sklearn

model_a = mlflow.sklearn.load_model("models:/IrisClassifier/1")  # current
model_b = mlflow.sklearn.load_model("models:/IrisClassifier/2")  # challenger

@app.post("/predict")
async def predict_ab(request: PredictRequest):
    # Route 10% of traffic to model B
    if random.random() < 0.10:
        model = model_b
        variant = "B"
    else:
        model = model_a
        variant = "A"

    prediction = model.predict(np.array(request.features))

    # Log variant for analysis
    ab_requests.labels(variant=variant).inc()

    return {"predictions": prediction.tolist(), "variant": variant}
```

---

## Shadow Deployment

Shadow deployment runs the challenger model alongside production without serving its predictions to users. It validates model behavior under real traffic with zero user impact.

```
Request ──────────────────────────────► Model A (Production)
         │                                      │
         └──► Model B (Shadow)                  │
              (response discarded)              │
                                           Response to user
```

Collect shadow predictions and compare to production predictions offline to validate correctness before promoting.

---

## Canary Deployment for ML

Canary for ML combines small traffic percentage routing with metric monitoring:

1. Deploy new model version alongside production
2. Route 1–5% of traffic to the new version
3. Monitor: latency, error rate, downstream business metrics
4. If metrics are healthy, gradually increase percentage
5. If metrics degrade, route all traffic back to stable version immediately

---

## SLOs for ML Services

ML services need SLOs beyond standard infrastructure SLOs:

| SLO | Target | Alert Threshold |
|---|---|---|
| Inference latency p99 | < 200ms | > 250ms for 5 min |
| Inference error rate | < 0.1% | > 0.5% for 2 min |
| Model availability | > 99.9% | any period below |
| Prediction accuracy (sampled) | > 90% | < 85% over 1hr window |
| Feature drift score | < 0.2 (PSI) | > 0.25 triggers review |
| Model version freshness | retrain within 30d | > 45d stale triggers alert |

---

## Feature Stores

A feature store is a centralized system for computing, storing, and serving ML features consistently across training and serving.

### The Training/Serving Skew Problem

Without a feature store, the same feature (e.g., "user's 7-day purchase count") is often computed differently in:
- The training pipeline (batch SQL query on historical data)
- The serving API (real-time computation on fresh data)

Even small differences in computation logic cause training/serving skew — the model sees different features at serving time than it was trained on.

### Feast Example (Open Source)

```python
from feast import FeatureStore

store = FeatureStore(repo_path="feature_repo/")

# Training: retrieve historical features
training_df = store.get_historical_features(
    entity_df=entity_df,
    features=["user_stats:purchase_count_7d", "user_stats:avg_order_value"],
).to_df()

# Serving: retrieve online (real-time) features
feature_vector = store.get_online_features(
    features=["user_stats:purchase_count_7d", "user_stats:avg_order_value"],
    entity_rows=[{"user_id": "user_123"}],
).to_dict()
```

The same `user_stats` feature definition drives both batch retrieval (training) and online serving — guaranteeing consistency.

---

## Model Versioning Strategy

A consistent versioning strategy is essential for auditability, rollback, and governance.

### Recommended Approach

```
Semantic version:  MAJOR.MINOR.PATCH
                     │      │     │
                     │      │     └── bug fix in serving/pipeline code
                     │      └── new features, data, minor retraining
                     └── breaking change: new target variable, feature schema change
```

Tag every production model version with:
- Run ID (traceable to training experiment)
- Training data version (DVC hash or date range)
- Git SHA of training code
- Evaluation metrics at promotion time
- Approval metadata (who approved, when)

---

## Summary

- FastAPI + MLflow load_model is the simplest serving pattern
- BentoML and Triton serve more complex multi-framework and GPU workloads
- GPU scheduling requires: device plugin, node labels/taints, correct resource requests
- MIG provides hardware GPU isolation; time-slicing provides software sharing
- Kubeflow Pipelines defines ML workflows as containerized DAGs on Kubernetes
- Model monitoring: data drift (input distribution shift), concept drift (label relationship shift)
- Evidently AI provides Python-native drift detection and reporting
- A/B testing and canary deployment reduce risk of model promotion
- Feature stores solve training/serving skew by unifying feature computation
- SLOs for ML extend beyond infrastructure to prediction quality and feature freshness
