---
title: "Cheat Sheet"
sidebar_position: 6
---

# MLOps — Cheat Sheet

## MLflow Python API Quick Reference

### Setup

```python
import mlflow

mlflow.set_tracking_uri("http://mlflow-server:5000")     # remote server
mlflow.set_tracking_uri("sqlite:///mlflow.db")            # local SQLite
mlflow.set_tracking_uri("mlruns/")                        # local folder (default)

mlflow.set_experiment("experiment-name")                  # create/select experiment
mlflow.get_tracking_uri()                                 # current URI
mlflow.get_experiment_by_name("name")                     # get experiment object
```

### Run Lifecycle

```python
# Context manager (recommended — auto-closes on exception)
with mlflow.start_run(run_name="my-run") as run:
    run_id = run.info.run_id
    ...

# Manual start/end
run = mlflow.start_run(run_name="my-run")
...
mlflow.end_run(status="FINISHED")  # or "FAILED", "KILLED"

# Nested runs
with mlflow.start_run(run_name="parent"):
    with mlflow.start_run(run_name="child", nested=True):
        ...
```

### Logging

```python
# Parameters
mlflow.log_param("learning_rate", 0.01)
mlflow.log_params({"max_depth": 5, "n_estimators": 100})

# Metrics (single value)
mlflow.log_metric("accuracy", 0.94)
mlflow.log_metrics({"precision": 0.92, "recall": 0.91})

# Metrics over time (with step)
for epoch in range(100):
    mlflow.log_metric("train_loss", loss, step=epoch)
    mlflow.log_metric("val_loss", val_loss, step=epoch)

# Tags (free-form metadata)
mlflow.set_tag("owner", "team-ml")
mlflow.set_tags({"env": "production", "data_version": "v3"})

# Artifacts (files)
mlflow.log_artifact("report.csv")                          # single file
mlflow.log_artifact("plot.png", artifact_path="plots/")    # into subfolder
mlflow.log_artifacts("./output_dir/", artifact_path="results/")  # entire dir

# Log dict/text inline
mlflow.log_dict({"key": "value"}, "config.json")
mlflow.log_text("hello world", "notes.txt")
mlflow.log_figure(fig, "confusion_matrix.png")             # matplotlib figure

# Models
mlflow.sklearn.log_model(sklearn_model, "model")
mlflow.pytorch.log_model(torch_model, "model")
mlflow.tensorflow.log_model(tf_model, "model")
mlflow.xgboost.log_model(xgb_model, "model")
mlflow.pyfunc.log_model("model", python_model=MyPyfuncModel())
```

### Autolog

```python
mlflow.sklearn.autolog()       # auto-logs all sklearn params, metrics, model
mlflow.pytorch.autolog()       # auto-logs PyTorch Lightning training
mlflow.xgboost.autolog()
mlflow.lightgbm.autolog()
mlflow.autolog()               # enable for all supported frameworks
mlflow.autolog(disable=True)   # turn off
```

### Searching and Loading

```python
# Search runs
runs_df = mlflow.search_runs(
    experiment_names=["my-exp"],
    filter_string="metrics.accuracy > 0.90 AND params.model_type = 'RandomForest'",
    order_by=["metrics.accuracy DESC"],
    max_results=50,
)

# Load a model
model = mlflow.sklearn.load_model(f"runs:/{run_id}/model")
model = mlflow.sklearn.load_model("models:/MyModel/Production")
model = mlflow.sklearn.load_model("models:/MyModel/2")         # by version
model = mlflow.pyfunc.load_model("models:/MyModel/Staging")    # generic
```

### Model Registry via Client

```python
from mlflow.tracking import MlflowClient
client = MlflowClient()

# Register
registered = mlflow.register_model(f"runs:/{run_id}/model", "ModelName")

# Stage transitions
client.transition_model_version_stage("ModelName", version=1, stage="Staging")
client.transition_model_version_stage("ModelName", version=1, stage="Production",
                                       archive_existing_versions=True)
client.transition_model_version_stage("ModelName", version=1, stage="Archived")

# Metadata
client.update_registered_model("ModelName", description="Description here")
client.update_model_version("ModelName", version=1, description="Version notes")
client.set_model_version_tag("ModelName", 1, "approved_by", "engineer")

# Query
client.get_registered_model("ModelName")
client.get_latest_versions("ModelName", stages=["Production"])
client.search_registered_models()

# Delete (use carefully)
client.delete_model_version("ModelName", version=1)
client.delete_registered_model("ModelName")  # deletes all versions
```

---

## MLflow CLI Commands

```bash
# Start UI
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000

# Start tracking server
mlflow server \
  --backend-store-uri postgresql://user:pass@host:5432/mlflow \
  --default-artifact-root s3://bucket/mlflow \
  --host 0.0.0.0 \
  --port 5000 \
  --workers 4

# Serve a model as REST API
mlflow models serve -m "models:/MyModel/Production" --port 5001 --no-conda

# Build Docker container for a model
mlflow models build-docker -m "models:/MyModel/Production" -n my-model-image

# Predict from CLI
mlflow models predict -m "runs:/RUN_ID/model" -i input.json -t json

# List experiments
mlflow experiments list

# Create experiment
mlflow experiments create --experiment-name my-experiment

# List runs
mlflow runs list --experiment-name my-experiment

# Download artifacts
mlflow artifacts download --run-id RUN_ID --artifact-path model

# Garbage collect deleted runs
mlflow gc --backend-store-uri sqlite:///mlflow.db

# Export/import runs
mlflow run . -P alpha=0.5 -e main
```

---

## DVC Commands

```bash
# Initialize
dvc init                        # in a git repo
dvc remote add -d myremote s3://bucket/dvc
dvc remote add -d myremote gs://bucket/dvc
dvc remote add -d myremote azure://container/path

# Track files/directories
dvc add data/dataset.csv        # creates data/dataset.csv.dvc
dvc add models/                 # track a directory

# Push/pull data
dvc push                        # upload tracked files to remote
dvc pull                        # download tracked files from remote
dvc fetch                       # download without checking out

# Data versioning with Git
git checkout v1.0 -- data/dataset.csv.dvc
dvc checkout                    # sync data files to match .dvc pointers

# Pipelines
dvc repro                       # run changed pipeline stages
dvc repro --force               # force re-run all stages
dvc dag                         # show pipeline DAG
dvc status                      # show what has changed

# Metrics and parameters
dvc params show                 # show current params
dvc params diff HEAD~1          # compare params to previous commit
dvc metrics show                # show tracked metrics
dvc metrics diff                # compare metrics

# Experiments
dvc exp run                     # run a new experiment
dvc exp show                    # table of all experiments
dvc exp diff exp-abc exp-xyz    # compare two experiments
dvc exp apply exp-abc           # apply an experiment's changes

# Troubleshooting
dvc doctor                      # check environment
dvc status --cloud              # compare local vs remote
dvc cache dir                   # show local cache location
```

---

## kubectl GPU Commands

```bash
# Check GPU node resources
kubectl describe node <node-name> | grep -A5 nvidia.com/gpu
kubectl get nodes -o custom-columns="NAME:.metadata.name,GPU:.status.allocatable.nvidia\.com/gpu"

# Show GPU labels
kubectl get nodes --show-labels | grep nvidia
kubectl get nodes -L nvidia.com/gpu.product

# Check allocations
kubectl describe node <node> | grep -E "Allocatable|Allocated"

# GPU Operator health
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl describe clusterpolicy
kubectl logs -n gpu-operator -l app=gpu-operator

# DCGM exporter metrics
kubectl logs -n gpu-operator ds/nvidia-dcgm-exporter | tail -20

# Debug a GPU pod
kubectl describe pod <pod> | grep -A10 "Events:"
kubectl exec -it <pod> -- nvidia-smi
kubectl exec -it <pod> -- nvidia-smi --query-gpu=memory.total,memory.used --format=csv

# Training jobs
kubectl get pods -l training.kubeflow.org/job-name=<job>
kubectl logs -f <training-pod>

# Check GPU utilization on a node (if kubectl node shell available)
kubectl node-shell <gpu-node> -- nvidia-smi dmon -s u
```

---

## Model Serving Patterns Comparison

| Pattern | Latency | Throughput | GPU Support | Operational Complexity | Best For |
|---|---|---|---|---|---|
| `mlflow models serve` | Medium | Low | No | Minimal | Development, testing |
| FastAPI + mlflow.load_model | Low | Medium | Depends on model | Low | Custom single-model serving |
| BentoML | Low | High | Yes | Medium | Multi-runner, framework-agnostic |
| NVIDIA Triton | Very Low | Very High | Native GPU | High | Production GPU inference, large models |
| TorchServe | Low | High | Yes | Medium | PyTorch-specific production serving |
| KServe (on K8s) | Low | High | Yes | High | Kubernetes-native, multi-model, autoscaling |
| Seldon Core | Low | High | Yes | Very High | Enterprise, explainability, AB testing |

### When to Choose What

- **Development / demo**: `mlflow models serve` — zero code, instant
- **Custom logic needed**: FastAPI + model load — full control
- **Multiple frameworks, GPU**: BentoML — good middle ground
- **Maximum GPU throughput, LLMs**: Triton — handles TensorRT, ONNX, PyTorch natively
- **Kubernetes-native, autoscaling, canary**: KServe — when you're already on K8s

---

## Common MLflow Patterns

```python
# Pattern 1: Sweep hyperparameters
for lr in [0.001, 0.01, 0.1]:
    with mlflow.start_run(run_name=f"lr-{lr}"):
        mlflow.log_param("learning_rate", lr)
        model = train(lr=lr)
        mlflow.log_metric("accuracy", evaluate(model))
        mlflow.sklearn.log_model(model, "model")

# Pattern 2: Get best model from experiment
runs = mlflow.search_runs(["my-exp"], order_by=["metrics.accuracy DESC"], max_results=1)
best_model = mlflow.sklearn.load_model(f"runs:/{runs.iloc[0]['run_id']}/model")

# Pattern 3: Auto-register best model in CI
if accuracy > THRESHOLD:
    mlflow.register_model(f"runs:/{run_id}/model", "ProductionModel")

# Pattern 4: Compare production vs challenger
prod = mlflow.sklearn.load_model("models:/MyModel/Production")
challenger = mlflow.sklearn.load_model("models:/MyModel/Staging")
prod_acc = accuracy_score(y_test, prod.predict(X_test))
chal_acc = accuracy_score(y_test, challenger.predict(X_test))
if chal_acc > prod_acc:
    client.transition_model_version_stage("MyModel", challenger_version, "Production", archive_existing_versions=True)
```

---

## Environment Variables Reference

```bash
# MLflow
MLFLOW_TRACKING_URI=http://mlflow-server:5000
MLFLOW_EXPERIMENT_NAME=my-experiment
MLFLOW_S3_ENDPOINT_URL=http://minio:9000     # custom S3-compatible endpoint
AWS_ACCESS_KEY_ID=...                         # for S3 artifact storage
AWS_SECRET_ACCESS_KEY=...

# DVC
DVC_REMOTE_DEFAULT=myremote

# NVIDIA
CUDA_VISIBLE_DEVICES=0,1                     # which GPUs are visible
NVIDIA_VISIBLE_DEVICES=all                   # in containers
CUDA_LAUNCH_BLOCKING=1                       # synchronous CUDA for debugging

# Triton
TRITONSERVER_BACKEND_DIRECTORY=/opt/tritonserver/backends
MODEL_REPOSITORY=/models
```
