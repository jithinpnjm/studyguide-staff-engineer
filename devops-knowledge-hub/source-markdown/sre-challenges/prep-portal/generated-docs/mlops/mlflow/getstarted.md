---
title: "Getstarted"
description: "Generated from mlops/mlflow/getstarted.ipynb"
slug: "/mlflow/getstarted"
---


<div className="notebook-meta">Source: <code>mlops/mlflow/getstarted.ipynb</code></div>

# MLflow Study Guide for a DevOps Engineer

This notebook is our learning path. We are not rushing into code. We are going to build intuition first, then small working pieces, then a complete MLflow project.

You already bring strong engineering habits from DevOps. That is an advantage here. MLflow will make more sense if you think of it as an operational layer around machine learning work.

## 1. Why MLflow matters

When ML engineers experiment, they change many things:
- dataset
- train/test split
- model type
- hyperparameters
- feature engineering

Without tracking, it becomes hard to answer simple questions such as:
- Which run gave the best result?
- Which parameters were used?
- Which model file was produced?
- Can we reproduce that result later?

That is the problem MLflow solves.

## 2. A DevOps mental model

A helpful way to think about MLflow:

- `Git` tracks source code history
- `CI/CD` tracks build and deployment flow
- `Docker` standardizes environments
- `Observability tools` track runtime behavior
- `MLflow` tracks ML experiments, models, and metadata

So MLflow is not the model itself. It is the system that helps us manage the ML lifecycle with traceability.

## 3. What we are going to build

Our beginner project will be intentionally small:

1. Load a built-in scikit-learn dataset such as `iris`
2. Train a simple model
3. Measure performance
4. Log the run in MLflow
5. Open the MLflow UI and compare runs

This first version is enough to understand the workflow end to end.

## 4. Core MLflow concepts

### Experiment
A named container for related runs.

### Run
One execution of training code.

### Parameters
Inputs you choose before training. Example: model type, dataset name, random seed.

### Metrics
Numbers produced after or during training. Example: accuracy, RMSE, F1 score.

### Artifacts
Files produced by the run. Example: trained model, plots, CSV files, feature lists.

### Model
A saved and reusable packaged model, often stored with metadata and environment details.

## 5. How one MLflow run feels in practice

A run usually looks like this:

1. Start a run
2. Log parameters
3. Train the model
4. Compute metrics
5. Log metrics
6. Save model and other files as artifacts
7. End the run

That is the loop we will repeat many times.

## 6. Why this matters operationally

As a DevOps engineer, these are the familiar concerns you will appreciate:

- reproducibility
- auditability
- environment consistency
- artifact management
- promotion of the right version
- visibility into changes over time

MLflow helps bring those concerns into the ML world.

## 7. Where MLflow fits in the bigger picture

A simple ML lifecycle looks like this:

`data -> training code -> experiment tracking -> model artifact -> serving/deployment`

MLflow mainly helps with the middle part:
- tracking experiments
- packaging models
- organizing reproducible runs
- sometimes registry and deployment integration

It does not replace all MLOps tooling, but it covers a very important layer.

## 8. Our learning roadmap

We will move in this order:

### Phase 1: ML refresher
- dataset
- features and target
- train/test split
- basic evaluation

### Phase 2: First MLflow run
- create an experiment
- log parameters
- log metrics
- inspect the UI

### Phase 3: Improve the project
- compare multiple runs
- log models
- add artifacts such as plots
- make the project reproducible

### Phase 4: Think like MLOps
- packaging
- model versioning
- promotion path
- CI/CD ideas for ML

## 9. What you need to know before touching code

For our first practical step, you only need these concepts:

- `X` means input features
- `y` means target labels or values
- training data teaches the model
- test data checks how well it generalizes
- a metric gives us a measurable outcome
- MLflow records the context around that outcome

## 10. Reflection questions

Answer these in plain English before moving on:

1. Why is saving only the trained model file not enough?
2. What is the difference between a parameter and a metric?
3. Why do we keep a test set separate from training data?
4. If two runs have different accuracy, what extra details would you want MLflow to show you?

You do not need perfect answers. The goal is to build mental structure.

## 11. What comes next

In the next notebook step, we will do only one practical thing:

**load a simple dataset and understand the training flow before adding MLflow logging.**

We will keep it slow, visual, and beginner-friendly.

## 12. ML Refresher with Iris

Now we move from concept to a tiny hands-on workflow.

We are still not doing full MLflow yet. First, we want the basic ML training flow to feel natural.

### Our goal in this section

We will focus on only four ideas:
- what `X` means
- what `y` means
- why we split into train and test
- how to train and evaluate one simple model

This is the smallest useful ML workflow.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
from sklearn.datasets import load_iris

iris = load_iris(as_frame=True)
X = iris.data
y = iris.target

print('Feature matrix shape:', X.shape)
print('Target shape:', y.shape)
print('Feature names:', list(X.columns))
```

</div>

### What just happened?

- `X` is the feature matrix
- each row is one flower sample
- each column is one measured feature
- `y` is the target label we want to predict

In this dataset, `X` contains flower measurements and `y` contains the flower class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
X.head()
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
y.head()
```

</div>

### Why train/test split matters

If we train and evaluate on the same data, the model may look better than it really is.

We split the data so that:
- the training set teaches the model
- the test set checks how the model performs on unseen data

This is our first defense against fooling ourselves.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

print('X_train shape:', X_train.shape)
print('X_test shape:', X_test.shape)
print('y_train shape:', y_train.shape)
print('y_test shape:', y_test.shape)
```

</div>

### Understanding `test_size`, `random_state`, and `stratify`

- `test_size=0.2` means 20% of the data is reserved for testing
- `random_state=42` makes the split reproducible
- `stratify=y` keeps class balance similar across train and test sets

As a DevOps engineer, think of `random_state` as a reproducibility control.

### Train one simple model

We will use logistic regression.

Do not worry about the math yet. The important workflow is:
- create the model
- fit on training data
- predict on test data
- measure performance

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

model = LogisticRegression(max_iter=300)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print('Accuracy:', round(accuracy, 4))
```

</div>

### What is the metric telling us?

Accuracy is the fraction of correct predictions.

If accuracy is `0.90`, that means 90% of predictions were correct on the test set.

Later, MLflow will record this value so we can compare runs.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
list(zip(predictions[:5], y_test.iloc[:5]))
```

</div>

### Reflection

Pause here and answer these in your own words:

1. Why is `X` a table while `y` is one column?
2. Why do we call `fit()` on training data only?
3. Why do we compute accuracy on `X_test` and `y_test`?
4. Which values here could later be logged to MLflow as parameters?
5. Which values here could later be logged to MLflow as metrics?

## 13. Bridge to MLflow

You have now seen the raw ML workflow:

1. load data
2. split data
3. train model
4. predict
5. evaluate

MLflow does not replace these steps.

MLflow sits around these steps and records what happened.

## 14. Your First Real MLflow Run

Now we will wrap the workflow you already understand with MLflow.

Our goal is very small:
- connect to the tracking database
- create or select an experiment
- start one run
- log one or two parameters
- log one metric

That is enough to understand the heart of MLflow.

### Step 1: Connect to the same tracking store every time

We use an absolute SQLite path so every notebook points to the same MLflow database.

This is important because relative paths can silently create confusion when notebooks run from different working directories.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
import mlflow

TRACKING_URI = "sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db"

mlflow.set_tracking_uri(TRACKING_URI)
print('Tracking URI:', mlflow.get_tracking_uri())
```

</div>

### Step 2: Choose an experiment

An experiment is just a named container for related runs.

Think of it like a project bucket for a family of ML attempts.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
experiment_name = 'iris-learning-lab'
mlflow.set_experiment(experiment_name)

print('Active experiment:', experiment_name)
```

</div>

### Step 3: Start a run and log context

This is the core pattern in MLflow.

Inside `start_run()` we record what we chose and what happened.

For now we will log:
- the dataset name
- the test size
- the random seed
- the model type
- the accuracy metric

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
with mlflow.start_run(run_name='iris-logistic-regression') as run:
    mlflow.log_param('dataset', 'iris')
    mlflow.log_param('test_size', 0.2)
    mlflow.log_param('random_state', 42)
    mlflow.log_param('model_type', 'LogisticRegression')
    mlflow.log_metric('accuracy', accuracy)

    run_id = run.info.run_id
    print('Run ID:', run_id)
    print('Logged accuracy:', round(accuracy, 4))
```

</div>

### What did we just log?

- parameters are the choices we made before or during the run
- metrics are the measured outcomes

In this example:
- `dataset`, `test_size`, `random_state`, and `model_type` are parameters
- `accuracy` is the metric

### Step 4: Inspect experiments from code

Before opening the UI, it is useful to confirm from Python that MLflow can see the experiment.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 37</div>

```python
experiments = mlflow.search_experiments()

for exp in experiments:
    print(exp.experiment_id, '|', exp.name, '|', exp.lifecycle_stage)
```

</div>

### Step 5: Inspect the latest runs from code

This is helpful when you want quick validation from a notebook without leaving Python.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 39</div>

```python
runs = mlflow.search_runs(experiment_names=[experiment_name])
runs[['run_id', 'params.dataset', 'params.model_type', 'metrics.accuracy', 'status']].head()
```

</div>

### How to open the MLflow UI

From the terminal, run:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow
mlflow ui --backend-store-uri sqlite:////Users/jithinpjoseph/Documents/GitHub/MLOps/MLFLOW/mlflow/mlflow.db --default-artifact-root ./mlartifacts
```

Then open `http://127.0.0.1:5000`.

Find the experiment named `iris-learning-lab` and inspect the run we just created.

### Reflection for this chapter

Answer these in your own words after you run the cells:

1. What is the difference between `mlflow.set_experiment()` and `mlflow.start_run()`?
2. Which logged values are parameters?
3. Which logged value is the metric?
4. Why is the tracking URI important?
5. If you changed `test_size` from `0.2` to `0.3`, what would you expect MLflow to help you compare?

## 15. What comes next

In the next chapter, we can deepen the project in one of two natural ways:

- compare multiple runs with different parameter values
- log the trained model itself as an artifact

We will take only one of those at a time.

## 16. Compare Multiple Runs

This chapter is where MLflow becomes truly useful.

Instead of logging one run, we will log several runs and compare them.

The key discipline is this:
- change one thing at a time
- keep the rest stable
- compare the outcome

That gives us meaningful experiments rather than random trial and error.

### What we will vary

We will keep the dataset and model the same, and vary only `test_size`.

This is a good beginner exercise because it teaches experimental control.

Later we can vary model type, hyperparameters, or datasets.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 45</div>

```python
test_sizes = [0.2, 0.25, 0.3]
test_sizes
```

</div>

### Create a reusable training function

We are wrapping the training steps in a function so we can repeat the experiment cleanly.

This is also a good engineering habit: put repeatable logic into a reusable unit.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 47</div>

```python
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

def train_and_evaluate(test_size, random_state=42):
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    model = LogisticRegression(max_iter=300)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)

    return {
        'test_size': test_size,
        'random_state': random_state,
        'train_rows': len(X_train),
        'test_rows': len(X_test),
        'accuracy': accuracy,
    }
```

</div>

### Log multiple runs into MLflow

For each `test_size`, we will:
- train the model
- compute accuracy
- start a new MLflow run
- log the parameters and metrics

Each loop iteration becomes one run in the experiment.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 49</div>

```python
results = []

for test_size in test_sizes:
    result = train_and_evaluate(test_size=test_size, random_state=42)

    with mlflow.start_run(run_name=f'iris-test-size-{test_size}'):
        mlflow.log_param('dataset', 'iris')
        mlflow.log_param('model_type', 'LogisticRegression')
        mlflow.log_param('test_size', result['test_size'])
        mlflow.log_param('random_state', result['random_state'])
        mlflow.log_metric('accuracy', result['accuracy'])
        mlflow.log_metric('train_rows', result['train_rows'])
        mlflow.log_metric('test_rows', result['test_rows'])

    results.append(result)

print('Logged runs:', len(results))
results
```

</div>

### Turn the results into a table

Tables make comparisons easier than reading raw printed output.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 51</div>

```python
import pandas as pd

results_df = pd.DataFrame(results)
results_df.sort_values(by='accuracy', ascending=False)
```

</div>

### Inspect runs from MLflow itself

Now we compare the same runs using MLflow's tracking data, not just our Python list.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 53</div>

```python
runs = mlflow.search_runs(experiment_names=[experiment_name])
runs[['run_id', 'run_name', 'params.test_size', 'metrics.accuracy', 'metrics.train_rows', 'metrics.test_rows', 'status']].head(10)
```

</div>

### How to think about the result

Do not immediately assume that the highest accuracy means we found a universally better setup.

For now, the real learning is:
- one parameter changed
- each change produced a separate run
- MLflow stored the run context and the outcome
- we can compare the runs later without relying on memory

### What to look for in the UI

Open the MLflow UI and look inside the `iris-learning-lab` experiment.

Notice how each run has:
- a run name
- parameters
- metrics
- a timestamp

This is why MLflow is powerful: it turns experiments into something observable and reviewable.

### Reflection for this chapter

Answer these in your own words after you practice:

1. Why did we vary only one parameter?
2. Why is it useful to give each run a readable name?
3. Which fields in this chapter are parameters?
4. Which field is the main metric?
5. Why is comparing runs in MLflow better than just printing results in the notebook?

## 17. What comes next

The next natural chapter is to log the trained model itself as an MLflow artifact.

That will connect experiment tracking to model packaging, which is a very important MLOps bridge.
