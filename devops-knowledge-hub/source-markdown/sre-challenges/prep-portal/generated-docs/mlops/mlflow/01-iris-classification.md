---
title: "01 Iris Classification"
description: "Generated from mlops/mlflow/01_iris_classification.ipynb"
slug: "/mlflow/01-iris-classification"
---


<div className="notebook-meta">Source: <code>mlops/mlflow/01_iris_classification.ipynb</code></div>

# Chapter 01 — Iris Classification with MLflow Tracking

**What you will learn in this notebook:**
- Create and manage MLflow **Experiments**
- Log **parameters**, **metrics**, and **tags** manually
- Train 3 different classifiers and track each as a separate **Run**
- Save a trained model as an **artifact**
- Compare all runs in the **MLflow UI**

**Dataset:** Iris (150 flower samples, 3 species, 4 features)  
**Task:** Multi-class Classification  
**Algorithms:** Logistic Regression, Random Forest, Support Vector Machine

---

> **Before you start:** Open a terminal and run the MLflow UI so you can watch runs appear live:
> ```bash
> cd /Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow
> mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
> ```
> Then open **http://localhost:5000** in your browser.

---

## Section 1 — Setup

First, import everything we need and connect to the MLflow tracking server.

### Why do we set a tracking URI?
MLflow needs to know **where to store** your experiment data.  
Think of it like telling your CI/CD tool which server to report build results to.  
Options:
- `sqlite:///mlflow.db` — local file (what we use here)
- `http://my-mlflow-server:5000` — a shared remote server (used in teams)
- `mlruns/` — a local folder (MLflow's default if you set nothing)

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
# ── Imports ───────────────────────────────────────────────────────────────────
import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

# Scikit-learn — data, models, and evaluation tools
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

# ── Connect to MLflow ─────────────────────────────────────────────────────────
mlflow.set_tracking_uri("sqlite:///mlflow.db")

print(f"MLflow version   : {mlflow.__version__}")
print(f"Tracking URI     : {mlflow.get_tracking_uri()}")
print("✅ Setup complete!")
```

</div>

---

## Section 2 — Load and Explore the Data

Before training anything, always understand your data.  
This is like reading infrastructure specs before writing a deployment script.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
# ── Load the Iris dataset ─────────────────────────────────────────────────────
iris = load_iris()

# Convert to a DataFrame so it's easier to read (like a spreadsheet)
df = pd.DataFrame(iris.data, columns=iris.feature_names)
df['species'] = [iris.target_names[t] for t in iris.target]

print(f"Dataset shape : {df.shape}  ({df.shape[0]} rows, {df.shape[1]} columns)")
print(f"Features      : {list(iris.feature_names)}")
print(f"Target classes: {list(iris.target_names)}")
print(f"Samples per class:")
print(df['species'].value_counts().to_string())
print()
print("First 5 rows:")
df.head()
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
# ── Basic statistics ──────────────────────────────────────────────────────────
# This shows min, max, mean, std for each feature.
# Useful to spot if features are on very different scales (they are here).
df.describe()
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
# ── Visualise the data ────────────────────────────────────────────────────────
# We plot petal length vs petal width, coloured by species.
# This gives us an intuition for how separable the classes are.

colors = ['#e74c3c', '#2ecc71', '#3498db']

fig, axes = plt.subplots(1, 2, figsize=(12, 4))

for i, species in enumerate(iris.target_names):
    mask = df['species'] == species
    axes[0].scatter(df[mask]['petal length (cm)'],
                    df[mask]['petal width (cm)'],
                    c=colors[i], label=species, alpha=0.7)
    axes[1].scatter(df[mask]['sepal length (cm)'],
                    df[mask]['sepal width (cm)'],
                    c=colors[i], label=species, alpha=0.7)

axes[0].set_xlabel('Petal Length (cm)')
axes[0].set_ylabel('Petal Width (cm)')
axes[0].set_title('Petal Features — Well Separated!')
axes[0].legend()

axes[1].set_xlabel('Sepal Length (cm)')
axes[1].set_ylabel('Sepal Width (cm)')
axes[1].set_title('Sepal Features — More Overlap')
axes[1].legend()

plt.tight_layout()
plt.savefig('iris_data_exploration.png', dpi=100, bbox_inches='tight')
plt.show()
print("📊 Plot saved as iris_data_exploration.png")
```

</div>

---

## Section 3 — Prepare the Data for Training

### Train/Test Split
We split the data into two parts:
- **Training set (80%)** — the model learns from this
- **Test set (20%)** — we evaluate on this data the model has **never seen**

This is exactly like a canary deployment — you test on a subset before trusting the full result.

### Feature Scaling
Some algorithms (like SVM and Logistic Regression) are sensitive to feature scales.  
If one feature ranges 0–1 and another ranges 0–1000, the large one dominates.  
`StandardScaler` normalises each feature to mean=0, std=1.  
Random Forest doesn't need this, but we apply it to all for consistency.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
# ── Split data ────────────────────────────────────────────────────────────────
X = iris.data
y = iris.target

# random_state=42 ensures the split is the same every time you run this
# (like a fixed seed in infrastructure randomness — reproducibility matters)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
    # stratify=y means the split keeps the same class ratio as the original
)

print(f"Total samples  : {len(X)}")
print(f"Training set   : {len(X_train)} samples ({len(X_train)/len(X)*100:.0f}%)")
print(f"Test set       : {len(X_test)} samples ({len(X_test)/len(X)*100:.0f}%)")

# ── Scale features ────────────────────────────────────────────────────────────
scaler = StandardScaler()
# IMPORTANT: fit the scaler ONLY on training data, then apply to both.
# If you fit on all data, you 'leak' test information into training — this gives
# falsely optimistic results. Same principle as not using prod data in dev.
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

print(f"\nFeature scaling applied (mean≈0, std≈1 per feature)")
print(f"Scaled feature means (should be ~0): {X_train_scaled.mean(axis=0).round(2)}")
```

</div>

---

## Section 4 — Your First Real MLflow Experiment

### What is an Experiment?
An **Experiment** is a named container for related runs.  
All runs for the Iris classification problem will live in one experiment: `iris-classification`.

> **DevOps analogy:** An experiment is like a **Jenkins project** or a **GitHub Actions workflow**.  
> Individual runs inside it are like individual **build executions**.

### The `with mlflow.start_run()` pattern
This is the core pattern you'll use everywhere:
```python
with mlflow.start_run():
    # everything logged here belongs to this run
    # when the 'with' block exits, the run is automatically closed
```
It's like a context manager for your ML experiment — clean open and close, just like `with open(file)`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
# ── Create the experiment ─────────────────────────────────────────────────────
# set_experiment() creates the experiment if it doesn't exist,
# or selects it if it does. Safe to call multiple times.

EXPERIMENT_NAME = "iris-classification"
mlflow.set_experiment(EXPERIMENT_NAME)

# Verify it was created
experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
print(f"Experiment Name : {experiment.name}")
print(f"Experiment ID   : {experiment.experiment_id}")
print(f"Artifact Store  : {experiment.artifact_location}")
print(f"Lifecycle Stage : {experiment.lifecycle_stage}")
print()
print("✅ Experiment ready. Open the MLflow UI and you'll see 'iris-classification' in the left sidebar.")
```

</div>

---

## Section 5 — Helper Function: Train and Log a Model

We're going to train 3 different models. Instead of repeating the same MLflow code 3 times,  
we write a function that:
1. Starts an MLflow run
2. Trains the model
3. Evaluates it
4. Logs everything to MLflow
5. Returns the results

**Read through the function carefully — every line is commented.**

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
def train_and_log(model, model_name, params, X_train, X_test, y_train, y_test):
    """
    Train a model, evaluate it, and log everything to MLflow.
    
    Args:
        model       : an untrained sklearn model object
        model_name  : a string name for the run (e.g. "Logistic Regression")
        params      : dict of hyperparameters to log
        X_train/test: training and test features
        y_train/test: training and test labels
    
    Returns:
        dict of metrics for comparison
    """
    
    # ── Start an MLflow run ───────────────────────────────────────────────────
    # run_name appears in the UI — make it descriptive
    with mlflow.start_run(run_name=model_name) as run:

        # ── Step 1: Log parameters ────────────────────────────────────────────
        # Parameters are the INPUTS to training — the knobs you turn.
        # Always log the model name itself as a param for easy filtering.
        mlflow.log_param("model_type", model_name)
        mlflow.log_param("test_size", 0.2)
        mlflow.log_param("random_state", 42)
        mlflow.log_params(params)  # log model-specific hyperparameters

        # ── Step 2: Train the model ───────────────────────────────────────────
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        # ── Step 3: Calculate metrics ─────────────────────────────────────────
        # average='weighted' accounts for class imbalance (even though Iris is balanced)
        accuracy  = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall    = recall_score(y_test, y_pred, average='weighted')
        f1        = f1_score(y_test, y_pred, average='weighted')

        # ── Step 4: Log metrics ───────────────────────────────────────────────
        # Metrics are the OUTPUTS of training — what you measure.
        mlflow.log_metrics({
            "accuracy" : accuracy,
            "precision": precision,
            "recall"   : recall,
            "f1_score" : f1
        })

        # ── Step 5: Add tags ──────────────────────────────────────────────────
        # Tags are free-form metadata. Use them to annotate runs.
        # Useful for filtering in the UI later.
        mlflow.set_tag("dataset", "iris")
        mlflow.set_tag("task", "classification")
        mlflow.set_tag("owner", "jithin")

        # ── Step 6: Generate and log the confusion matrix as an artifact ──────
        # Artifacts are FILES — plots, reports, model files, CSVs.
        # We generate the plot, save it to disk, then log it.
        cm = confusion_matrix(y_test, y_pred)
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(cm, cmap='Blues')
        plt.colorbar(im)
        ax.set_xticks(range(3))
        ax.set_yticks(range(3))
        ax.set_xticklabels(iris.target_names, rotation=45)
        ax.set_yticklabels(iris.target_names)
        ax.set_xlabel('Predicted')
        ax.set_ylabel('Actual')
        ax.set_title(f'Confusion Matrix — {model_name}')
        for i in range(3):
            for j in range(3):
                ax.text(j, i, cm[i, j], ha='center', va='center',
                        color='white' if cm[i, j] > cm.max()/2 else 'black',
                        fontsize=14, fontweight='bold')
        plt.tight_layout()
        cm_path = f"confusion_matrix_{model_name.replace(' ', '_')}.png"
        plt.savefig(cm_path, dpi=100, bbox_inches='tight')
        plt.close()
        mlflow.log_artifact(cm_path)  # ← upload the saved file to MLflow

        # ── Step 7: Save the trained model ────────────────────────────────────
        # This saves the model in MLflow's standard format.
        # Later you can load it with mlflow.sklearn.load_model()
        mlflow.sklearn.log_model(model, "model")

        # ── Step 8: Print a summary ───────────────────────────────────────────
        print(f"{'─'*50}")
        print(f"Model     : {model_name}")
        print(f"Run ID    : {run.info.run_id}")
        print(f"Accuracy  : {accuracy:.4f}")
        print(f"F1 Score  : {f1:.4f}")
        print(f"Precision : {precision:.4f}")
        print(f"Recall    : {recall:.4f}")

        return {
            "model_name": model_name,
            "run_id"    : run.info.run_id,
            "accuracy"  : accuracy,
            "f1_score"  : f1,
            "precision" : precision,
            "recall"    : recall
        }

print("✅ Helper function defined. Ready to train models.")
```

</div>

---

## Section 6 — Train Model 1: Logistic Regression

**What it is:** Draws a decision boundary between classes using a mathematical function.  
Despite the name, it's a **classification** algorithm, not regression.  

**Key hyperparameter:** `C` — regularization strength.  
- Low `C` → simpler model, less likely to overfit  
- High `C` → model tries harder to fit training data  

**When to use:** Fast, interpretable baseline. Good first model to try.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
# ── Logistic Regression ───────────────────────────────────────────────────────
lr_model = LogisticRegression(C=1.0, max_iter=200, random_state=42)

lr_params = {
    "C"         : 1.0,       # regularization — default is 1.0
    "max_iter"  : 200,       # max iterations for the solver
    "solver"    : "lbfgs",   # the optimization algorithm used internally
    "scaling"   : True       # we scaled the features before training
}

lr_results = train_and_log(
    model=lr_model,
    model_name="Logistic Regression",
    params=lr_params,
    X_train=X_train_scaled,
    X_test=X_test_scaled,
    y_train=y_train,
    y_test=y_test
)

print("\n👉 Now check the MLflow UI — you should see a new run in 'iris-classification'")
```

</div>

---

## Section 7 — Train Model 2: Random Forest

**What it is:** Builds many decision trees on random subsets of the data,  
then **votes** on the final answer (ensemble method).  

**Key hyperparameters:**
- `n_estimators` — how many trees to build (more = better but slower)
- `max_depth` — how deep each tree can grow (deeper = more complex, risk of overfitting)

**When to use:** Very robust, handles many feature types, rarely needs tuning to work well.  
One of the most widely used algorithms in practice.

> **Note:** Random Forest does NOT need feature scaling. It splits on thresholds, not distances.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
# ── Random Forest ─────────────────────────────────────────────────────────────
rf_model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)

rf_params = {
    "n_estimators": 100,    # number of trees in the forest
    "max_depth"   : 5,      # max depth of each tree
    "criterion"   : "gini", # how to measure split quality
    "scaling"     : False   # Random Forest doesn't need scaling
}

# Note: we pass X_train (not scaled) — RF doesn't need it
rf_results = train_and_log(
    model=rf_model,
    model_name="Random Forest",
    params=rf_params,
    X_train=X_train,        # unscaled!
    X_test=X_test,
    y_train=y_train,
    y_test=y_test
)

print("\n👉 Check the MLflow UI again — you should now have 2 runs.")
```

</div>

---

## Section 8 — Train Model 3: Support Vector Machine (SVM)

**What it is:** Finds the **widest possible margin** between classes.  
Imagine drawing a road between two cities — SVM finds the widest road that separates them.

**Key hyperparameters:**
- `C` — how much to penalise misclassifications (high C = stricter)
- `kernel` — the shape of the decision boundary (`linear`, `rbf`, `poly`)

**When to use:** Works very well for small-to-medium datasets with clear margins.  
Requires feature scaling.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
# ── Support Vector Machine ────────────────────────────────────────────────────
svm_model = SVC(C=1.0, kernel='rbf', random_state=42)

svm_params = {
    "C"      : 1.0,    # regularization parameter
    "kernel" : "rbf",  # radial basis function — handles non-linear boundaries
    "gamma"  : "scale",# how far the influence of a single training point reaches
    "scaling": True
}

svm_results = train_and_log(
    model=svm_model,
    model_name="SVM",
    params=svm_params,
    X_train=X_train_scaled,
    X_test=X_test_scaled,
    y_train=y_train,
    y_test=y_test
)

print("\n👉 All 3 runs complete. Check the MLflow UI — you should see all 3 now.")
```

</div>

---

## Section 9 — Compare Results

Now let's compare all 3 models side by side — this is what MLflow is built for.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
# ── Side-by-side comparison table ────────────────────────────────────────────
results = [lr_results, rf_results, svm_results]

comparison_df = pd.DataFrame(results).set_index('model_name')
comparison_df = comparison_df.drop(columns=['run_id'])
comparison_df = comparison_df.round(4)

print("Model Comparison (Test Set Performance):")
print("=" * 60)
print(comparison_df.to_string())
print("=" * 60)

best_model = comparison_df['accuracy'].idxmax()
best_score = comparison_df['accuracy'].max()
print(f"\n🏆 Best model by accuracy: {best_model} ({best_score:.4f})")
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
# ── Bar chart comparison ──────────────────────────────────────────────────────
metrics_to_plot = ['accuracy', 'precision', 'recall', 'f1_score']
model_names = [r['model_name'] for r in results]

x = np.arange(len(model_names))
width = 0.2
colors_bar = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12']

fig, ax = plt.subplots(figsize=(10, 5))

for i, metric in enumerate(metrics_to_plot):
    values = [r[metric] for r in results]
    bars = ax.bar(x + i * width, values, width, label=metric,
                  color=colors_bar[i], alpha=0.8)
    # Add value labels on top of each bar
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                f'{val:.3f}', ha='center', va='bottom', fontsize=8)

ax.set_xticks(x + width * 1.5)
ax.set_xticklabels(model_names)
ax.set_ylabel('Score')
ax.set_title('Model Comparison — Iris Classification')
ax.legend(loc='lower right')
ax.set_ylim(0.8, 1.05)
ax.grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig('model_comparison.png', dpi=100, bbox_inches='tight')
plt.show()
print("📊 Comparison chart saved as model_comparison.png")
```

</div>

---

## Section 10 — Query MLflow Programmatically

You don't have to use the UI to get results. You can query MLflow from Python too.  
This is powerful for automation — imagine a CI/CD pipeline that automatically checks  
if the new model is better than the one in production before promoting it.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
# ── Query all runs from the experiment ───────────────────────────────────────
# This is like 'git log' but for ML runs.

runs_df = mlflow.search_runs(
    experiment_names=[EXPERIMENT_NAME],
    order_by=["metrics.accuracy DESC"]   # sort by best accuracy first
)

# Show only the columns we care about
cols = ['tags.mlflow.runName', 'metrics.accuracy', 'metrics.f1_score',
        'params.model_type', 'params.C', 'params.n_estimators']
available_cols = [c for c in cols if c in runs_df.columns]

print("All runs in 'iris-classification' experiment (sorted by accuracy):")
print(runs_df[available_cols].to_string(index=False))
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
# ── Get the best run programmatically ────────────────────────────────────────
# This is how you'd automate model promotion in a CI/CD pipeline.

best_run = runs_df.iloc[0]  # first row = highest accuracy (sorted above)

print("Best Run Details:")
print(f"  Run Name : {best_run.get('tags.mlflow.runName', 'N/A')}")
print(f"  Run ID   : {best_run['run_id']}")
print(f"  Accuracy : {best_run['metrics.accuracy']:.4f}")
print(f"  F1 Score : {best_run['metrics.f1_score']:.4f}")
print()
print(f"Model URI for registry: runs:/{best_run['run_id']}/model")
print()
print("💡 In the next notebook (02), we'll use this URI to register the best model.")
```

</div>

---

## Section 11 — Detailed Report on the Best Model

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
# ── Print full classification report for each model ───────────────────────────
# classification_report shows per-class precision, recall, F1
# This is more informative than a single accuracy number

models_trained = [
    ("Logistic Regression", lr_model,  X_test_scaled),
    ("Random Forest",       rf_model,  X_test),
    ("SVM",                 svm_model, X_test_scaled),
]

for name, model, X_t in models_trained:
    y_pred = model.predict(X_t)
    print(f"{'='*50}")
    print(f"Classification Report — {name}")
    print('='*50)
    print(classification_report(y_test, y_pred,
                                 target_names=iris.target_names))
```

</div>

---

## Section 12 — Exploring the MLflow UI

Now that you have 3 runs logged, here's what to look at in the UI at **http://localhost:5000**:

### Step-by-step UI walkthrough:

**1. Experiment view**
- Click on `iris-classification` in the left sidebar
- You'll see a table with all 3 runs — each row is one training run
- The columns show your logged metrics and params

**2. Compare runs**
- Tick the checkboxes for all 3 runs
- Click **"Compare"** button
- You'll see a parallel coordinates chart and bar charts comparing metrics
- This is how ML teams decide which model to promote to production

**3. Drill into a single run**
- Click on any run name
- See **Parameters** tab — all the config you logged
- See **Metrics** tab — all the scores you logged  
- See **Artifacts** tab — the confusion matrix PNG and the saved model folder

**4. View the saved model**
- In the Artifacts tab, click the `model` folder
- You'll see `MLmodel` (metadata), `model.pkl` (the model), `conda.yaml`, `requirements.txt`
- MLflow saved everything needed to reproduce and deploy this model

---

## Summary — What You Learned in This Notebook

| ✅ | Skill |
|---|---|
| ✅ | Create an MLflow experiment with `set_experiment()` |
| ✅ | Log parameters with `log_param()` / `log_params()` |
| ✅ | Log metrics with `log_metric()` / `log_metrics()` |
| ✅ | Add tags with `set_tag()` |
| ✅ | Log a file as an artifact with `log_artifact()` |
| ✅ | Save a trained model with `mlflow.sklearn.log_model()` |
| ✅ | Query all runs programmatically with `search_runs()` |
| ✅ | Compare models in the MLflow UI |

---

## Next: Notebook 02 — Diabetes Regression

In the next notebook you will learn:
- **Regression** metrics (RMSE, MAE, R²) instead of classification metrics
- **`mlflow.sklearn.autolog()`** — one line that automatically logs EVERYTHING
- Logging **multiple artifacts** (feature importance plots, residual plots)
- Comparing 4 different regression algorithms

> **Your homework before notebook 02:**  
> Open the MLflow UI, find the best model run, and explore its artifacts tab.  
> Can you find the confusion matrix PNG that was uploaded?
