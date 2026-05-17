# MLOps Workspace

This area is intentionally separate from the interview-prep system.

Use it for:

- Python learning and scripting practice
- notebook-based MLOps study
- MLflow experiments
- small runnable Python application patterns

## Structure

- `PYTHON/Basics/`
  Core Python notebooks from syntax through functions, OOP, files, exceptions, logging, NumPy, and pandas.
- `PYTHON/Advanced/`
  Advanced Python notebooks covering patterns, concurrency, HTTP APIs, Pydantic, FastAPI, SQLAlchemy, testing, and capstones.
- `PYTHON/Advanced/deployment_control_center/`
  A runnable FastAPI project extracted from the advanced capstone.
- `mlflow/`
  MLflow notebooks and local experiment material.

## Recommended Reading Order

1. `PYTHON/Basics/`
2. `PYTHON/Advanced/`
3. `PYTHON/Advanced/deployment_control_center/`
4. `mlflow/`

## Python Notebook Workflow

Create one local environment for the Python notebook track:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops
python3 -m venv .venv
source .venv/bin/activate
pip install -r PYTHON/requirements.txt
python -m ipykernel install --user --name sre-challenges-mlops --display-name "SRE Challenges MLOps"
jupyter lab
```

Open notebooks from:

- `PYTHON/Basics/`
- `PYTHON/Advanced/`

## Deployment Control Center

This is the clearest runnable Python project in the MLOps area.

Run it with:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/PYTHON/Advanced/deployment_control_center
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Useful endpoints:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/health`

Run tests with:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/PYTHON/Advanced/deployment_control_center
source .venv/bin/activate
pytest -q
```

## MLflow Study Area

Install dependencies and start MLflow locally:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/mlflow
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mlflow ui --backend-store-uri sqlite:///mlflow.db
```

Then open:

- `http://127.0.0.1:5000`

Suggested notebook order:

1. `00_study_guide.ipynb`
2. `getstarted.ipynb`
3. `01_iris_classification.ipynb`

## Notes

- Keep `mlops/` independent from `interview-prep/`.
- Treat this area as a practical Python and MLOps workspace.
- The portal now has a dedicated MLOps page to help you navigate this content cleanly.
