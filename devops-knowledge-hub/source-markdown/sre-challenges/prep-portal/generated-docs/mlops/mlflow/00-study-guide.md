---
title: "00 Study Guide"
description: "Generated from mlops/mlflow/00_study_guide.ipynb"
slug: "/mlflow/00-study-guide"
---


<div className="notebook-meta">Source: <code>mlops/mlflow/00_study_guide.ipynb</code></div>

# MLflow Study Guide
### Your Complete Roadmap — From Zero to MLOps-Ready

---

> **Who is this for?**  
> You are a senior DevOps engineer who understands CI/CD pipelines, version control, artifact management, and deployments.  
> You know basic ML — what training a model means, what accuracy is.  
> You have **never used MLflow** before.  
> This guide is written specifically for you.

---

## Chapter 1 — What Problem Does MLflow Solve?

### The DevOps Analogy

As a DevOps engineer, think about what life was like **before Git**:
- You had folders named `app_v1`, `app_v2`, `app_v2_final`, `app_v2_final_REAL`
- You didn't know who changed what, when, or why
- You couldn't roll back reliably

**ML teams have the same problem — but with models.**

Without MLflow, a data scientist's workflow looks like this:
```
model_v1.pkl
model_v2_better.pkl
model_v3_fixed.pkl
model_final.pkl
model_final2.pkl        ← which one is in production?!
```

And in their notebook:
```python
# tried learning_rate=0.01, got accuracy 82%... or was it 84%? 
# changed max_depth to 5, better results
# TODO: remember what the good parameters were
```

**MLflow is to ML models what Git + Artifactory + a deployment pipeline is to software.**

---

### The Direct Mapping

| DevOps Concept | MLflow Equivalent | What it does |
|---|---|---|
| `git commit` | **MLflow Run** | Snapshot of one training attempt |
| `git log` | **Experiment** | History of all your runs |
| Artifact Registry (e.g. Nexus) | **MLflow Model Registry** | Versioned, tagged model storage |
| `git tag v1.0.0` | **Model Version** | Tag a specific model as v1, v2 |
| Staging / Production environments | **Model Stages** | `Staging`, `Production`, `Archived` |
| `docker build` output | **MLflow Artifact** | The model file, plots, reports |
| `build.log` | **MLflow Metrics** | accuracy, loss, RMSE over time |
| `env vars / config.yaml` | **MLflow Parameters** | learning_rate, max_depth, etc. |

---

## Chapter 2 — The Four Core Components of MLflow

MLflow has 4 main modules. You will use all of them in this course.

```
┌─────────────────────────────────────────────────────────────┐
│                        M L F L O W                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Tracking   │  │   Projects   │  │     Models       │  │
│  │              │  │              │  │                  │  │
│  │ Log params,  │  │ Reproducible │  │ Standard format  │  │
│  │ metrics,     │  │ ML code      │  │ to package and   │  │
│  │ artifacts    │  │ packaging    │  │ deploy models    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│                  ┌──────────────────┐                       │
│                  │  Model Registry  │                       │
│                  │                  │                       │
│                  │ Central store to │                       │
│                  │ version, stage,  │                       │
│                  │ and manage models│                       │
│                  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 MLflow Tracking (Most Used)
This is where you spend 80% of your time. It answers:
- **What parameters** did I use? (`learning_rate=0.01`, `n_estimators=100`)
- **What results** did I get? (`accuracy=0.94`, `loss=0.23`)
- **What files** did I produce? (model.pkl, confusion_matrix.png)
- **When** did I run it? On **what code**?

### 2.2 MLflow Projects
A standard format to **package your ML code** so anyone can run it.  
Think of it like a `Dockerfile` but for ML training scripts.  
Defined in a file called `MLproject`.

### 2.3 MLflow Models
A standard format to **save models** so they can be deployed anywhere —  
as a REST API, a Python function, in Docker, on cloud platforms.  
The key idea: you save once, deploy everywhere.

### 2.4 Model Registry
A centralized place to **manage model lifecycle**:  
`None → Staging → Production → Archived`  
This is your release pipeline for ML models.

---

## Chapter 3 — Key Vocabulary You Must Know

Before writing a single line of code, memorize these terms. They appear everywhere.

| Term | Definition | DevOps Analogy |
|---|---|---|
| **Experiment** | A named group of runs (e.g. `iris-classification`) | A project / repo |
| **Run** | One execution of your training script | One `git commit` or one CI build |
| **Parameter** | An input to your training (`max_depth=5`) | A config/env var |
| **Metric** | A measured output (`accuracy=0.94`) | A build/test KPI |
| **Artifact** | A file produced by a run (model, plot, CSV) | A build artifact |
| **Tag** | Free-form metadata on a run (`env=dev`) | A git tag or label |
| **Model** | A trained ML model saved in MLflow format | A Docker image |
| **Model Version** | A specific version of a registered model | An image tag |
| **Stage** | Lifecycle state of a model version | Deploy environment |
| **Tracking Server** | The backend that stores all run data | Your CI/CD server |
| **Tracking URI** | Where to send run data (local, DB, remote) | Server endpoint URL |

---

## Chapter 4 — The Datasets We Will Use

We use **scikit-learn's built-in datasets** — no downloading required. They are perfect for learning because they are clean, small, and well-understood.

### Dataset 1: Iris 🌸 (Classification)
- **What:** 150 flower samples, 3 species (Setosa, Versicolor, Virginica)
- **Features:** Sepal length, sepal width, petal length, petal width
- **Goal:** Predict the species from measurements
- **ML Task:** Multi-class classification
- **Why it's great for learning:** Simple, clean, 100% understood — focus on MLflow, not data wrangling

### Dataset 2: Diabetes 🩺 (Regression)
- **What:** 442 patient records
- **Features:** Age, BMI, blood pressure, 6 blood serum measurements
- **Goal:** Predict disease progression score (a number, not a category)
- **ML Task:** Regression (predicting a continuous value)
- **Why it's great for learning:** Teaches you regression metrics like RMSE, MAE, R²

### Dataset 3: Wine 🍷 (Multi-class Classification)
- **What:** 178 wines from 3 Italian cultivars
- **Features:** 13 chemical properties (alcohol, malic acid, etc.)
- **Goal:** Classify wine origin from chemical analysis
- **ML Task:** Multi-class classification
- **Why it's great for learning:** More features than Iris — shows feature importance

---

## Chapter 5 — The ML Algorithms We Will Use

You don't need to understand the math. Understand what they are and when to use them.

### For Classification (Iris, Wine)

| Algorithm | Plain English | Key Parameters |
|---|---|---|
| **Logistic Regression** | Draws a line/boundary between classes | `C` (regularization strength) |
| **Random Forest** | Builds many decision trees, votes on the answer | `n_estimators`, `max_depth` |
| **Support Vector Machine (SVM)** | Finds the widest possible gap between classes | `C`, `kernel` |
| **K-Nearest Neighbors (KNN)** | "You are who your neighbors are" — looks at K closest points | `n_neighbors` |

### For Regression (Diabetes)

| Algorithm | Plain English | Key Parameters |
|---|---|---|
| **Linear Regression** | Fits a straight line through the data | none |
| **Ridge Regression** | Linear regression + penalty for large weights | `alpha` |
| **Lasso Regression** | Like Ridge but can zero out irrelevant features | `alpha` |
| **Gradient Boosting** | Builds trees one at a time, each fixing previous errors | `n_estimators`, `learning_rate` |

### The MLflow Insight
> You will train **multiple algorithms on the same data** and use MLflow to track which one performs best.  
> This is exactly what MLflow was built for — **systematic comparison of experiments**.

---

## Chapter 6 — The ML Metrics We Will Track

These are the numbers that tell you how good a model is. MLflow logs all of them.

### Classification Metrics

| Metric | Range | Meaning |
|---|---|---|
| **Accuracy** | 0 to 1 | % of correct predictions. Simple but can mislead on imbalanced data |
| **Precision** | 0 to 1 | Of all positive predictions, how many were actually positive? |
| **Recall** | 0 to 1 | Of all actual positives, how many did we catch? |
| **F1 Score** | 0 to 1 | Harmonic mean of precision and recall. Best single metric |

### Regression Metrics

| Metric | Meaning | Lower is better? |
|---|---|---|
| **RMSE** (Root Mean Squared Error) | Average prediction error in original units | Yes |
| **MAE** (Mean Absolute Error) | Average absolute prediction error | Yes |
| **R²** (R-squared) | % of variance explained by the model (1.0 = perfect) | No — higher is better |

---

## Chapter 7 — The Full Learning Path

Here is the exact sequence of notebooks you will work through:

```
00_study_guide.ipynb          ← YOU ARE HERE
│
├── 01_iris_classification.ipynb
│     ├── Your first MLflow experiment
│     ├── Log params & metrics manually
│     ├── Compare Logistic Regression vs Random Forest vs SVM
│     └── View results in MLflow UI
│
├── 02_diabetes_regression.ipynb
│     ├── Regression metrics (RMSE, MAE, R²)
│     ├── MLflow autolog (one line that logs everything!)
│     ├── Log custom plots as artifacts
│     └── Compare 4 regression algorithms
│
└── 03_wine_model_registry.ipynb
      ├── Register the best model
      ├── Version models (v1, v2, v3)
      ├── Promote: Staging → Production
      └── Load a model from registry and make predictions
```

### Each notebook will teach you:
1. **Concept** — What is this feature and why does it exist?
2. **Code** — Minimal, well-commented implementation
3. **Verify** — How to check it worked in the MLflow UI
4. **DevOps Bridge** — How this maps to something you already know

---

## Chapter 8 — Setup & Verification

Let's verify your environment is ready before starting.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
# ============================================================
# STEP 1: Check that all required packages are installed
# ============================================================
# Run this cell. If you see version numbers, you're good to go.

import mlflow
import sklearn
import pandas as pd
import numpy as np
import matplotlib

print(f"MLflow version    : {mlflow.__version__}")
print(f"Scikit-learn      : {sklearn.__version__}")
print(f"Pandas            : {pd.__version__}")
print(f"NumPy             : {np.__version__}")
print(f"Matplotlib        : {matplotlib.__version__}")
print()
print("✅ All packages loaded successfully!")
```

<div className="notebook-output__label">Output</div>

```text
MLflow version    : 3.10.1
Scikit-learn      : 1.8.0
Pandas            : 2.3.3
NumPy             : 2.4.3
Matplotlib        : 3.10.8

✅ All packages loaded successfully!
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
# ============================================================
# STEP 2: Connect to your local MLflow tracking server
# ============================================================
# We use a SQLite database file as our tracking backend.
# This is like using a local SQLite DB instead of a full PostgreSQL server.
# For production, you'd point this to a real server.

import os

# Set the tracking URI to our local SQLite database
# This tells MLflow: "store all run data in this file"
mlflow.set_tracking_uri("sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db")

# Verify the connection
print(f"Tracking URI: {mlflow.get_tracking_uri()}")
print("✅ Connected to MLflow tracking server!")
```

<div className="notebook-output__label">Output</div>

```text
Tracking URI: sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db
✅ Connected to MLflow tracking server!
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
# ============================================================
# STEP 3: Explore the built-in scikit-learn datasets
# ============================================================

from sklearn.datasets import load_iris, load_diabetes, load_wine

# Load all three datasets
iris    = load_iris()
diabetes = load_diabetes()
wine    = load_wine()

# Print a summary for each
datasets = [
    ("Iris",     iris,     "Classification"),
    ("Diabetes", diabetes, "Regression"),
    ("Wine",     wine,     "Classification"),
]

for name, ds, task in datasets:
    print(f"Dataset  : {name}")
    print(f"Task     : {task}")
    print(f"Samples  : {ds.data.shape[0]}")
    print(f"Features : {ds.data.shape[1]} → {list(ds.feature_names)}")
    if hasattr(ds, 'target_names'):
        print(f"Classes  : {list(ds.target_names)}")
    print("-" * 60)
```

<div className="notebook-output__label">Output</div>

```text
Dataset  : Iris
Task     : Classification
Samples  : 150
Features : 4 → ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)']
Classes  : [np.str_('setosa'), np.str_('versicolor'), np.str_('virginica')]
------------------------------------------------------------
Dataset  : Diabetes
Task     : Regression
Samples  : 442
Features : 10 → ['age', 'sex', 'bmi', 'bp', 's1', 's2', 's3', 's4', 's5', 's6']
------------------------------------------------------------
Dataset  : Wine
Task     : Classification
Samples  : 178
Features : 13 → ['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium', 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins', 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline']
Classes  : [np.str_('class_0'), np.str_('class_1'), np.str_('class_2')]
------------------------------------------------------------
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
# ============================================================
# STEP 4: Your first MLflow interaction — List experiments
# ============================================================
# Think of this like 'git log' but for ML experiments.
# If this is a fresh DB, you'll only see the 'Default' experiment.

experiments = mlflow.search_experiments()

print(f"Found {len(experiments)} experiment(s) in the tracking server:\n")
for exp in experiments:
    print(f"  ID   : {exp.experiment_id}")
    print(f"  Name : {exp.name}")
    print(f"  Stage: {exp.lifecycle_stage}")
    print()
```

<div className="notebook-output__label">Output</div>

```text
Found 3 experiment(s) in the tracking server:

  ID   : 3
  Name : tracking-quickstart
  Stage: active

  ID   : 1
  Name : check the Local server
  Stage: active

  ID   : 0
  Name : Default
  Stage: active
```

</div>

## Chapter 9 — How to Start the MLflow UI

The MLflow UI is your **dashboard** — like a Grafana or Kibana for your ML experiments.

### Start it from your terminal:

```bash
# Navigate to the mlflow directory
cd /Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow

# Start the UI, pointing it at your SQLite database
mlflow ui --backend-store-uri sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db --port 5000
```

Then open your browser: **http://localhost:5000**

### What you will see:
- All your experiments listed on the left
- All runs in a table with params and metrics
- Comparison charts between runs
- Artifacts (model files, plots) stored per run

> **DevOps note:** Keep this UI running in a separate terminal while you work through the notebooks. Every time you run a training cell, you'll see a new entry appear in the UI — just like watching a CI pipeline log in real time.

---

## Chapter 10 — Quick Reference: Core MLflow API

These are the ~10 functions you will use over and over. Bookmark this.

```python
import mlflow

# ── SETUP ──────────────────────────────────────────────────
mlflow.set_tracking_uri("sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db")   # Where to store data
mlflow.set_experiment("my-experiment")            # Which experiment (creates if missing)

# ── RUN LIFECYCLE ──────────────────────────────────────────
with mlflow.start_run(run_name="my-run"):         # Start recording

    # ── LOGGING ────────────────────────────────────────────
    mlflow.log_param("learning_rate", 0.01)       # Log a single parameter
    mlflow.log_params({"max_depth": 5,            # Log many parameters at once
                       "n_estimators": 100})

    mlflow.log_metric("accuracy", 0.94)           # Log a single metric
    mlflow.log_metrics({"precision": 0.92,        # Log many metrics at once
                        "recall": 0.91})

    mlflow.log_artifact("confusion_matrix.png")  # Log a file
    mlflow.log_artifact("model_report.txt")

    mlflow.set_tag("author", "jithin")            # Add metadata tag

    # ── SAVE MODEL ─────────────────────────────────────────
    mlflow.sklearn.log_model(model, "model")      # Save the trained model

# ── AUTOLOG (magic one-liner!) ──────────────────────────────
mlflow.sklearn.autolog()   # Automatically logs EVERYTHING for sklearn models

# ── MODEL REGISTRY ─────────────────────────────────────────
mlflow.register_model("runs:/RUN_ID/model",       # Register a run's model
                      "MyModelName")
```

---

## Summary — What You've Learned in This Guide

| ✅ | Concept |
|---|---|
| ✅ | Why MLflow exists (the problem it solves) |
| ✅ | How MLflow maps to DevOps tools you already know |
| ✅ | The 4 components: Tracking, Projects, Models, Registry |
| ✅ | Key vocabulary: Experiment, Run, Parameter, Metric, Artifact |
| ✅ | The 3 datasets and what we'll do with them |
| ✅ | The algorithms and metrics we'll use |
| ✅ | The full learning path |
| ✅ | Environment setup and verification |
| ✅ | How to start the MLflow UI |
| ✅ | The core MLflow API cheat sheet |

---

## Next Step

Open **`01_iris_classification.ipynb`**

You will:
- Create your first real MLflow experiment
- Train 3 classification models on the Iris dataset
- Log parameters and metrics for each
- Compare them visually in the MLflow UI

> **Before you open it:** Start the MLflow UI in a terminal so you can watch runs appear in real time as you execute notebook cells.
