# Deployment Control Center

This folder turns the notebook capstone into a small real Python project.

The goal is not to make this enterprise-grade in one step. The goal is to show how the ideas from Chapters 1 to 6 fit together in a structure you could actually run, test, and discuss in an interview.

## What this project teaches

- `app/config.py`
  This is where settings live. We use Pydantic settings so configuration is typed and validated.

- `app/schemas.py`
  This is where request and response models live. These models define the contract of the API.

- `app/models.py`
  This is where SQLAlchemy database models live. These represent the database tables.

- `app/db.py`
  This file creates the async database engine and session factory.

- `app/services.py`
  This is the business-logic layer. The FastAPI routes should stay small and call into services like this.

- `app/main.py`
  This is the FastAPI application entry point.

- `tests/test_app.py`
  This shows how to test the API with `pytest` and `TestClient`.

## Folder structure

```text
deployment_control_center/
  app/
    __init__.py
    config.py
    db.py
    main.py
    models.py
    schemas.py
    services.py
  tests/
    test_app.py
  requirements.txt
  pyproject.toml
  README.md
```

## How to run

```bash
cd /Users/jithinpjoseph/Documents/GitHub/MLOps/PYTHON/Advanced/deployment_control_center
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/health`

## How to run tests

```bash
cd /Users/jithinpjoseph/Documents/GitHub/MLOps/PYTHON/Advanced/deployment_control_center
source .venv/bin/activate
pytest -q
```

## Beginner reading order

Read the project in this order:

1. `app/schemas.py`
2. `app/config.py`
3. `app/models.py`
4. `app/services.py`
5. `app/main.py`
6. `tests/test_app.py`

That order helps because:

- schemas explain what data enters and leaves the app
- config explains environment-driven behavior
- models explain persistence
- services explain the actual work
- main explains HTTP wiring
- tests explain how we prove behavior

## Interview takeaway

If you can explain this project clearly, you can tell a strong story:

- I know how to validate input with Pydantic.
- I know how to structure an API with FastAPI.
- I know how to persist state with SQLAlchemy.
- I know why services and routes should be separated.
- I know how to test the result.
