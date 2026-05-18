---
title: "Intermediate"
sidebar_position: 2
---

# MLOps — Intermediate

## MLflow In Depth

MLflow is the most widely adopted open-source MLOps tool. It solves four distinct problems through four components: Tracking, Projects, Models, and Model Registry. This section covers the full API and operational patterns for each.

---

## MLflow Tracking API

The tracking API is what you use inside training scripts. Every training run calls these functions.

### Setup

```python
import mlflow

# Point to your tracking server
# Options:
#   Local SQLite:    sqlite:///mlflow.db
#   Remote server:  http://mlflow-server:5000
#   Databricks:     databricks://<profile>
mlflow.set_tracking_uri("http://mlflow-server:5000")

# Select or create an experiment
mlflow.set_experiment("my-model-v2")
```

### The Core Run Pattern

```python
with mlflow.start_run(run_name="run-2024-01") as run:
    # Log parameters (inputs)
    mlflow.log_param("learning_rate", 0.01)
    mlflow.log_param("max_depth", 5)
    mlflow.log_params({
        "n_estimators": 100,
        "random_state": 42,
    })

    # Train your model here
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # Log metrics (outputs)
    mlflow.log_metric("accuracy", accuracy_score(y_test, y_pred))
    mlflow.log_metric("f1_score", f1_score(y_test, y_pred, average="weighted"))
    mlflow.log_metrics({
        "precision": precision_score(y_test, y_pred, average="weighted"),
        "recall": recall_score(y_test, y_pred, average="weighted"),
    })

    # Log files as artifacts
    mlflow.log_artifact("confusion_matrix.png")
    mlflow.log_artifact("feature_importance.csv")

    # Log a trained model
    mlflow.sklearn.log_model(model, "model")

    # Add metadata tags
    mlflow.set_tag("dataset_version", "v3")
    mlflow.set_tag("owner", "ml-team")
    mlflow.set_tag("environment", "training")

    print(f"Run ID: {run.info.run_id}")
```

### Logging Metrics Over Time (Step Metrics)

For tracking training loss across epochs:

```python
with mlflow.start_run():
    for epoch in range(50):
        loss = train_one_epoch()
        val_loss = evaluate()
        # step parameter enables time-series charts in the UI
        mlflow.log_metric("train_loss", loss, step=epoch)
        mlflow.log_metric("val_loss", val_loss, step=epoch)
```

### Logging Dictionaries and DataFrames as Artifacts

```python
import json
import pandas as pd

with mlflow.start_run():
    # Log a dict as JSON artifact
    config = {"features": ["age", "income"], "target": "churn"}
    with open("config.json", "w") as f:
        json.dump(config, f)
    mlflow.log_artifact("config.json")

    # Log a DataFrame as CSV artifact
    results_df = pd.DataFrame({"actual": y_test, "predicted": y_pred})
    results_df.to_csv("predictions.csv", index=False)
    mlflow.log_artifact("predictions.csv")

    # Log entire directory
    mlflow.log_artifacts("./plots_dir/", artifact_path="plots")
```

### Autolog — Log Everything Automatically

For supported frameworks, one line logs everything:

```python
# Enable before training — logs params, metrics, model automatically
mlflow.sklearn.autolog()

# Now just train normally
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)
# MLflow logged: n_estimators, max_depth, all sklearn params, accuracy, etc.
```

Autolog is supported for: scikit-learn, PyTorch, TensorFlow/Keras, XGBoost, LightGBM, Spark ML.

### Querying Runs Programmatically

```python
# Search runs in an experiment
runs = mlflow.search_runs(
    experiment_names=["my-model-v2"],
    filter_string="metrics.accuracy > 0.90",
    order_by=["metrics.accuracy DESC"],
    max_results=10,
)

# runs is a pandas DataFrame
best_run_id = runs.iloc[0]["run_id"]
best_accuracy = runs.iloc[0]["metrics.accuracy"]
model_uri = f"runs:/{best_run_id}/model"
```

---

## MLflow Model Registry

The Model Registry is where run artifacts become versioned, stage-managed production models.

### Registering a Model

```python
# Method 1: Register from a run artifact URI
model_uri = f"runs:/{run_id}/model"
registered = mlflow.register_model(model_uri, "IrisClassifier")
print(f"Version: {registered.version}")  # "1"

# Method 2: Log and register in one step
with mlflow.start_run():
    mlflow.sklearn.log_model(
        model,
        "model",
        registered_model_name="IrisClassifier",  # auto-registers
    )
```

### Stage Transitions: Staging → Production → Archived

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Move version 1 to Staging for integration testing
client.transition_model_version_stage(
    name="IrisClassifier",
    version=1,
    stage="Staging",
    archive_existing_versions=False,
)

# After tests pass, promote to Production
client.transition_model_version_stage(
    name="IrisClassifier",
    version=1,
    stage="Production",
    archive_existing_versions=True,  # archive previous Production version
)

# Archive a model that is no longer needed
client.transition_model_version_stage(
    name="IrisClassifier",
    version=1,
    stage="Archived",
)
```

Stages: `None` (just registered) → `Staging` → `Production` → `Archived`

### Loading Models by Stage

```python
# Load the current Production model — your serving code uses this
model = mlflow.sklearn.load_model("models:/IrisClassifier/Production")
predictions = model.predict(X_new)

# Load a specific version for testing
model_v2 = mlflow.sklearn.load_model("models:/IrisClassifier/2")

# Load the Staging model for integration tests
staging_model = mlflow.sklearn.load_model("models:/IrisClassifier/Staging")
```

### Listing and Searching Registry

```python
client = MlflowClient()

# List all registered models
for model in client.search_registered_models():
    print(f"Name: {model.name}")
    for version in model.latest_versions:
        print(f"  v{version.version} — {version.current_stage} — run {version.run_id}")

# Get specific model details
model_details = client.get_registered_model("IrisClassifier")
```

### Adding Metadata to Registered Models

```python
client = MlflowClient()

# Add description to the registered model
client.update_registered_model(
    name="IrisClassifier",
    description="Iris flower species classifier. Trained on 150 samples. F1=0.97.",
)

# Add description and tags to a specific version
client.update_model_version(
    name="IrisClassifier",
    version=2,
    description="Retrained with 2024-Q1 data. Improved on edge cases.",
)
client.set_model_version_tag("IrisClassifier", 2, "approved_by", "ml-lead")
client.set_model_version_tag("IrisClassifier", 2, "data_version", "v3.1")
```

---

## MLflow Server Setup

### Local Development

```bash
# Start with SQLite backend — file-based, no server required
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000

# Start tracking server (headless, no UI)
mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlartifacts --port 5000
```

### Production Setup (PostgreSQL + S3)

```bash
# Full production server
mlflow server \
  --backend-store-uri postgresql://user:password@postgres-host:5432/mlflow \
  --default-artifact-root s3://my-mlflow-artifacts/mlflow \
  --host 0.0.0.0 \
  --port 5000 \
  --workers 4
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mlflow-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mlflow
  template:
    metadata:
      labels:
        app: mlflow
    spec:
      containers:
        - name: mlflow
          image: ghcr.io/mlflow/mlflow:latest
          args:
            - server
            - --backend-store-uri
            - postgresql://$(DB_USER):$(DB_PASS)@postgres:5432/mlflow
            - --default-artifact-root
            - s3://mlflow-artifacts/
            - --host
            - "0.0.0.0"
          envFrom:
            - secretRef:
                name: mlflow-db-secret
```

---

## Model Flavors

MLflow uses "flavors" to support multiple ML frameworks under one standard format. A single saved model folder contains multiple representation layers.

### Built-in Flavors

```python
# scikit-learn
mlflow.sklearn.log_model(sklearn_model, "model")
mlflow.sklearn.load_model("models:/MyModel/Production")

# PyTorch
mlflow.pytorch.log_model(torch_model, "model")
mlflow.pytorch.load_model("models:/TorchModel/Production")

# TensorFlow / Keras
mlflow.tensorflow.log_model(tf_model, "model")

# XGBoost
mlflow.xgboost.log_model(xgb_model, "model")

# LightGBM
mlflow.lightgbm.log_model(lgb_model, "model")

# HuggingFace Transformers
mlflow.transformers.log_model(pipeline, "model")
```

### pyfunc — The Universal Flavor

`pyfunc` is the generic Python function flavor. Any model saved in pyfunc format can be served the same way regardless of framework:

```python
class CustomModel(mlflow.pyfunc.PythonModel):
    def load_context(self, context):
        """Called once when the model is loaded."""
        import pickle
        with open(context.artifacts["model_path"], "rb") as f:
            self.model = pickle.load(f)

    def predict(self, context, model_input):
        """Called for every prediction request."""
        return self.model.predict(model_input)

# Save a custom model
with mlflow.start_run():
    mlflow.pyfunc.log_model(
        artifact_path="model",
        python_model=CustomModel(),
        artifacts={"model_path": "my_model.pkl"},
        conda_env="conda.yaml",
    )

# Serve it — same command regardless of framework
mlflow.pyfunc.load_model("models:/MyCustomModel/Production")
```

---

## Feature Engineering Patterns

Feature engineering transforms raw data into the inputs a model expects. These patterns are critical for production reliability.

### Consistent Feature Pipelines with scikit-learn

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer

# Define transformations
numeric_features = ["age", "income", "tenure"]
categorical_features = ["region", "product_type"]

preprocessor = ColumnTransformer([
    ("num", StandardScaler(), numeric_features),
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
])

# Combine with model into a pipeline
pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier()),
])

# Train and log the entire pipeline — preprocessing is bundled with the model
with mlflow.start_run():
    pipeline.fit(X_train, y_train)
    mlflow.sklearn.log_model(pipeline, "model")  # saves preprocessor + model together
```

The critical insight: save the entire pipeline, not just the model. When you load the model for serving, preprocessing happens automatically — no risk of training/serving skew.

---

## Data Versioning with DVC

DVC (Data Version Control) adds Git-like versioning to large data files that don't belong in Git.

### Basic DVC Workflow

```bash
# Initialize DVC in a Git repo
git init my-ml-project
cd my-ml-project
dvc init
git commit -m "Initialize DVC"

# Add a dataset to DVC tracking
dvc add data/iris.csv
# DVC creates: data/iris.csv.dvc (small metadata file)
# DVC adds data/iris.csv to .gitignore

# Commit the metadata (not the data itself)
git add data/iris.csv.dvc .gitignore
git commit -m "Track iris dataset with DVC"

# Configure remote storage
dvc remote add -d myremote s3://my-dvc-bucket/data
git commit -m "Configure DVC remote"

# Push data to remote storage
dvc push

# On another machine, pull data
git clone <repo>
dvc pull  # downloads data from remote
```

### Switching Dataset Versions

```bash
# Checkout a previous version of the data
git checkout v1.0 -- data/iris.csv.dvc
dvc checkout  # updates actual data file to match the .dvc pointer

# Run a pipeline stage with the old data
dvc repro
```

### DVC Pipelines

DVC can also version the full pipeline, not just data:

```yaml
# dvc.yaml
stages:
  prepare:
    cmd: python src/prepare.py
    deps:
      - src/prepare.py
      - data/raw/iris.csv
    outs:
      - data/processed/iris_clean.csv

  train:
    cmd: python src/train.py
    deps:
      - src/train.py
      - data/processed/iris_clean.csv
    params:
      - params.yaml:
          - model.n_estimators
          - model.max_depth
    outs:
      - models/rf_model.pkl
    metrics:
      - metrics.json:
          cache: false
```

```bash
dvc repro           # run only changed stages
dvc params diff     # compare parameters across commits
dvc metrics show    # show all tracked metrics
dvc metrics diff    # compare metrics across commits
```

---

## CI/CD for ML Pipelines

A mature MLOps CI/CD pipeline treats model training the same way software CI/CD treats code builds.

### GitHub Actions Example

```yaml
name: ML CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - "src/**"
      - "data/**"
      - "params.yaml"

jobs:
  data-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate data schema
        run: python src/validate_data.py

  train-and-evaluate:
    needs: data-validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Pull data
        run: dvc pull --run-cache
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET }}
      - name: Train model
        run: |
          python src/train.py
          # Outputs metrics to metrics.json, model to models/
      - name: Compare metrics to baseline
        run: |
          python src/compare_metrics.py --baseline models/baseline_metrics.json
          # Fails if new model is worse than production baseline

  register-and-promote:
    needs: train-and-evaluate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Register model to MLflow registry
        run: python src/register_model.py --stage Staging
      - name: Run integration tests against Staging
        run: pytest tests/integration/ --model-stage Staging
      - name: Promote to Production if tests pass
        run: python src/promote_model.py --from Staging --to Production
```

### Model Quality Gates

In the compare step, a quality gate blocks promotion if the new model is worse:

```python
# src/compare_metrics.py
import json
import sys

with open("metrics.json") as f:
    new_metrics = json.load(f)

with open(baseline_path) as f:
    baseline = json.load(f)

if new_metrics["accuracy"] < baseline["accuracy"] - 0.02:
    print(f"FAIL: accuracy {new_metrics['accuracy']:.4f} < baseline {baseline['accuracy']:.4f} - 0.02")
    sys.exit(1)

print(f"PASS: new model meets quality threshold")
```

---

## Summary

- MLflow Tracking API: `set_experiment`, `start_run`, `log_param`, `log_metric`, `log_artifact`, `log_model`
- Autolog captures everything for supported frameworks in one line
- Model Registry stages: None → Staging → Production → Archived
- pyfunc flavor is the universal format — serve any model the same way
- Save full sklearn pipelines (with preprocessing) to avoid training/serving skew
- DVC versions large data files via metadata pointers committed to Git
- CI/CD for ML needs: data validation, training, metric comparison gate, then registry promotion
