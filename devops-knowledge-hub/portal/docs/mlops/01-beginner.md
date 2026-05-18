---
title: "Beginner"
sidebar_position: 1
---

# MLOps — Beginner

## What Is MLOps?

MLOps (Machine Learning Operations) is the discipline of applying DevOps practices to machine learning systems. It bridges the gap between model development (done by data scientists) and production deployment (done by engineers). Without MLOps, models live in notebooks and never reliably reach production. With MLOps, models are versioned, tested, deployed, and monitored the same way software is.

The simplest mental model: MLOps is what happens when you take a trained model from a Jupyter notebook and turn it into a reliable, monitored production service.

---

## The ML Lifecycle

Understanding where MLOps fits requires understanding the full machine learning lifecycle. Every production ML system moves through these stages:

```
Data Collection
      |
      v
Data Preparation (cleaning, feature engineering, validation)
      |
      v
Model Training (algorithm selection, hyperparameter tuning)
      |
      v
Model Evaluation (metrics, baseline comparison, bias check)
      |
      v
Model Registration (version, tag, store)
      |
      v
Deployment (REST API, batch job, edge)
      |
      v
Monitoring (data drift, model drift, latency, errors)
      |
      v
Retrain / Iterate
```

The loop from Monitoring back to Data Collection is what separates a one-shot model from a sustainable ML system. MLOps provides tooling and practices for every stage.

---

## MLOps vs DevOps: Key Differences

Both MLOps and DevOps share core principles — versioning, automation, reproducibility, observability. But ML adds unique challenges:

| Dimension | DevOps | MLOps |
|---|---|---|
| Artifact | Docker image, binary | Trained model + code + data |
| Testing | Unit tests, integration tests | Data validation, model evaluation, fairness checks |
| Deployment risk | Code bugs | Model accuracy, data drift, silent failures |
| Reproducibility | Same code → same binary | Same code + same data + same seed → same model |
| Monitoring | CPU, memory, error rates | Prediction quality, data distribution shift, feature drift |
| Rollback | Redeploy old image | Reload previous model version from registry |
| Configuration | Config files, env vars | Hyperparameters, training config, feature schemas |

The biggest operational difference: a deployed model can degrade silently. The service stays healthy (returns HTTP 200) but predictions become wrong as the real world changes. This is concept drift — and it has no equivalent in standard software deployment.

---

## Key Roles in MLOps

### Data Scientist
- Builds and experiments with models
- Owns model accuracy and metric definitions
- Produces trained model artifacts
- Typically uses Python, Jupyter, scikit-learn, PyTorch, TensorFlow

### ML Engineer
- Takes data scientist outputs and makes them production-ready
- Builds training pipelines, feature stores, and serving infrastructure
- Owns model API performance and reliability
- Bridge between data science and infrastructure

### MLOps Engineer
- Designs and maintains the ML platform
- Owns experiment tracking, model registry, CI/CD for ML, monitoring infrastructure
- Ensures reproducibility, governance, and reliability of the whole ML lifecycle
- Often has a DevOps or SRE background

### Platform / SRE
- Ensures underlying compute (GPU scheduling, Kubernetes) is available
- Owns infrastructure SLOs that ML services depend on
- Responds to production incidents for ML serving infrastructure

---

## Tooling Landscape

The MLOps ecosystem is large. Here is the map organized by function:

### Experiment Tracking
Track parameters, metrics, and artifacts across training runs.
- **MLflow** — open source, widely adopted, works with any framework
- **Weights & Biases (W&B)** — managed service, strong visualization
- **Neptune.ai** — team-focused experiment tracking
- **Comet** — experiment tracking with model production monitoring

### Model Registry
Store, version, and stage-transition trained models.
- **MLflow Model Registry** — built into MLflow
- **Hugging Face Hub** — for NLP models
- **Vertex AI Model Registry** — GCP managed
- **SageMaker Model Registry** — AWS managed

### Pipeline Orchestration
Automate multi-step ML workflows (data prep → train → evaluate → deploy).
- **Kubeflow Pipelines** — Kubernetes-native ML pipelines
- **Apache Airflow** — general DAG orchestrator, widely used for ML
- **Prefect / Dagster** — modern workflow orchestrators
- **ZenML** — open-source MLOps framework with pipelines

### Model Serving
Serve models as REST APIs or batch prediction services.
- **MLflow Models** — built-in serving (`mlflow models serve`)
- **BentoML** — flexible model serving, supports many frameworks
- **NVIDIA Triton Inference Server** — high-performance GPU inference
- **TorchServe** — PyTorch model serving
- **KServe** — Kubernetes-native model serving (formerly KFServing)
- **FastAPI** — custom serving with full control

### Feature Stores
Centralize feature computation, storage, and serving.
- **Feast** — open-source feature store
- **Tecton** — managed enterprise feature store
- **Vertex AI Feature Store** — GCP managed
- **SageMaker Feature Store** — AWS managed

### Data Versioning
Version datasets the same way you version code.
- **DVC (Data Version Control)** — Git-like versioning for datasets and models
- **Delta Lake** — versioned data tables for Spark/Databricks
- **LakeFS** — Git-like branching for data lakes

### Cloud Platforms (all-in-one)
- **AWS SageMaker** — end-to-end managed ML platform on AWS
- **Google Vertex AI** — end-to-end managed ML platform on GCP
- **Azure ML** — end-to-end managed ML platform on Azure
- **Databricks** — unified analytics and ML platform

---

## Experiment Tracking Concepts

Experiment tracking is the foundation of reproducible ML. You must understand these concepts before working with any tracking tool.

### Experiment
A named container for related training runs. Example: `iris-classification` or `fraud-detection-v2`. All runs comparing different hyperparameters for the same problem belong to one experiment.

DevOps analogy: a GitHub repository or a Jenkins project.

### Run
A single execution of a training script. Each run captures the exact parameters, metrics, and artifacts produced. If you train a Random Forest with `n_estimators=100` and then again with `n_estimators=200`, those are two separate runs inside the same experiment.

DevOps analogy: one CI pipeline execution or one `git commit`.

### Parameters
The inputs you choose before training. Examples: `learning_rate=0.01`, `max_depth=5`, `batch_size=32`. Parameters are configuration — the knobs you turn to influence training.

DevOps analogy: environment variables or config file values.

### Metrics
Measured outputs produced during or after training. Examples: `accuracy=0.94`, `f1_score=0.91`, `rmse=12.3`. Metrics tell you how well the model performed.

DevOps analogy: build KPIs like test coverage %, deployment success rate, or p99 latency.

### Artifacts
Files produced by a run. Examples: the trained model file (`model.pkl`), a confusion matrix plot, a CSV report, a feature importance chart. Artifacts are the durable outputs of a run.

DevOps analogy: build artifacts — Docker images, compiled binaries, test reports.

### Model Registry
A centralized store for production-grade models. Unlike raw run artifacts, registered models have lifecycle stages and version history. The typical flow:

```
Run produces model artifact
        |
        v
Register model → Model v1 (None/Development stage)
        |
        v
Promote to Staging → Integration tests pass
        |
        v
Promote to Production → Live traffic
        |
        v
Archive when superseded
```

DevOps analogy: an artifact registry (Nexus, Artifactory) combined with a deployment pipeline.

### Tracking Server
The backend service that stores all experiment data — runs, parameters, metrics, and artifacts. Can be:
- **Local file system** — SQLite DB + `mlruns/` folder (development only)
- **Remote database** — PostgreSQL + S3 for artifacts (team use)
- **Managed service** — Databricks MLflow, W&B, etc.

DevOps analogy: your CI/CD server (Jenkins, GitHub Actions) or your artifact repository server.

---

## The DevOps Analogy for MLflow

MLflow maps directly onto DevOps tools you already understand:

| DevOps Concept | MLflow Equivalent |
|---|---|
| `git commit` | MLflow Run |
| `git log` | Experiment (history of all runs) |
| Artifact registry (Nexus/Artifactory) | MLflow Model Registry |
| `git tag v1.0.0` | Model Version |
| Staging / Production environments | Model Stages |
| Docker image (build output) | MLflow Artifact |
| Build log | MLflow Metrics |
| `config.yaml` / env vars | MLflow Parameters |

The insight: ML teams had the same chaos that software teams had before Git. Folders named `model_v1.pkl`, `model_final.pkl`, `model_final_REAL.pkl` with no traceability. MLflow solves that — it is Git + Artifactory + deployment pipeline for models.

---

## Summary

- MLOps applies DevOps practices to ML systems
- The lifecycle is: data → train → evaluate → register → deploy → monitor → retrain
- MLOps differs from DevOps most in monitoring (silent model degradation) and reproducibility (code + data + seed)
- Key roles: data scientist, ML engineer, MLOps engineer
- Core tooling: MLflow (tracking + registry), Kubeflow (pipelines), DVC (data versioning), BentoML/Triton (serving)
- Experiment tracking concepts: experiment, run, parameters, metrics, artifacts, model registry
