---
title: "Chapter 07 Testing Mocking Packaging Project Structure"
description: "Generated from mlops/PYTHON/Advanced/chapter_07_testing_mocking_packaging_project_structure.ipynb"
slug: "/python-advanced/chapter-07-testing-mocking-packaging-project-structure"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_07_testing_mocking_packaging_project_structure.ipynb</code></div>

# Chapter 7: Testing, Mocking, Packaging, and Project Structure

This chapter is the bridge from "I can write Python code" to "I can build and maintain Python projects".

For interviews, this chapter matters a lot because many candidates know syntax, but fewer can explain:
- how they structure a project
- how they test behavior safely
- how they mock external systems
- how they package code so it is reusable

That is exactly what we will learn here.

## 1. Why this chapter matters

If you are a DevOps engineer, you will often write Python for:
- automation tools
- API clients
- deployment helpers
- health-check utilities
- CI/CD support scripts

Those tools become much more valuable when they are:
- testable
- modular
- package-friendly
- easy for teammates to understand

## 2. A good project structure

A clean project structure reduces confusion. It also makes interviews easier because you can explain where things belong.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
PROJECT_LAYOUT = """
mytool/
  app/
    __init__.py
    config.py
    schemas.py
    services.py
    main.py
  tests/
    test_main.py
    test_services.py
  requirements.txt
  pyproject.toml
  README.md
"""

print(PROJECT_LAYOUT)
```

</div>

### What just happened?
We printed a recommended **project folder structure** for a Python tool.

Why does structure matter? Imagine someone joins your team and opens your repo. If all your code is in one 500-line file, they have to read everything to find anything. A clear structure tells them immediately:
- *"want to change what the API returns? → look in `app/schemas.py`"*
- *"want to change business logic? → look in `app/services.py`"*
- *"want to change what the app connects to? → look in `app/config.py`"*

**The key separation**:
- `app/` — your application code (the thing you're building)
- `tests/` — your test code (lives separately so it never ships with the app)
- `requirements.txt` — the list of pip packages you need (`pip freeze > requirements.txt`)
- `pyproject.toml` — project metadata and tool configuration (pytest settings, linter settings, etc.)
- `README.md` — instructions for humans

This is the same structure used by FastAPI, SQLAlchemy, and most open source Python projects.

## 3. What makes code testable?

Code is easier to test when:
- functions are small
- business logic is separated from framework code
- inputs and outputs are clear
- external side effects are isolated

That is why we separate routes, services, and models.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
def calculate_retry_delay(attempt: int, base_delay: float = 0.5) -> float:
    return base_delay * (2 ** (attempt - 1))

print(calculate_retry_delay(1))
print(calculate_retry_delay(2))
print(calculate_retry_delay(3))
```

</div>

### What just happened?
We ran a simple pure function — `calculate_retry_delay` — that computes exponential back-off delays.

The outputs `0.5`, `1.0`, `2.0` show the doubling pattern: attempt 1 waits 0.5s, attempt 2 waits 1.0s, attempt 3 waits 2.0s. You used this exact pattern in Chapter 2.

**Why is this function easy to test?**

Think about what would make a function *hard* to test:
- It reads from a database → test needs a database running
- It calls an external API → test needs internet access
- It reads `os.environ` → test needs specific env vars set
- It depends on the current time → test result changes by the clock

`calculate_retry_delay` has none of those problems. Same input → always same output. No hidden dependencies.

In testing, this is called a **pure function**. Most of your business logic should aim to be this clean — it's what makes unit testing fast and reliable.

The formula: `base_delay × 2^(attempt−1)`:
- attempt 1 → `0.5 × 2^0` = 0.5
- attempt 2 → `0.5 × 2^1` = 1.0
- attempt 3 → `0.5 × 2^2` = 2.0

## 4. Your first pytest example

Pytest is popular because tests look like normal Python functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
PYTEST_EXAMPLE = """
def calculate_retry_delay(attempt: int, base_delay: float = 0.5) -> float:
    return base_delay * (2 ** (attempt - 1))


def test_calculate_retry_delay():
    assert calculate_retry_delay(1) == 0.5
    assert calculate_retry_delay(2) == 1.0
    assert calculate_retry_delay(3) == 2.0
"""

print(PYTEST_EXAMPLE)
```

</div>

### What just happened?
We printed what a **pytest test file** looks like. Pytest is Python's most popular testing framework.

The `assert` keyword is the heart of a test. `assert X == Y` passes silently if X equals Y, and raises `AssertionError` if not — pytest catches that and marks the test as failed.

**The three-part test structure (Arrange → Act → Assert)**:
```python
# Arrange — set up the inputs
attempt = 1

# Act — call the function being tested
result = calculate_retry_delay(attempt)

# Assert — verify the result is what you expected
assert result == 0.5
```

**How to run tests**:
```bash
pytest tests/              # run all tests in the tests/ folder
pytest tests/ -v           # verbose — shows each test name
pytest tests/ -k "retry"   # run only tests with "retry" in the name
```

Pytest discovers tests automatically — any function starting with `test_` in any file starting with `test_` will be found and run.

## 5. Mocking external systems

Mocking means we replace a real dependency with a fake one during a test.

Why?
- we do not want tests to depend on the internet
- we do not want tests to depend on a real database
- we do not want tests to call expensive or dangerous external systems

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
from unittest.mock import Mock


def deploy_service(client, service_name: str) -> str:
    response = client.start_deployment(service_name)
    return response['status']


fake_client = Mock()
fake_client.start_deployment.return_value = {'status': 'running'}

result = deploy_service(fake_client, 'auth-api')
print(result)
print(fake_client.start_deployment.called)
```

</div>

### What just happened?
We used `unittest.mock.Mock()` to replace a real deployment client with a fake one.

`Mock()` is a chameleon object — you can call any method on it and it won't crash:
- `fake_client.start_deployment("auth-api")` — returns a `Mock` object by default
- `fake_client.start_deployment.return_value = {'status': 'running'}` — now it returns that dict

The crucial point: `deploy_service(client, service_name)` doesn't know or care whether `client` is real or fake. It just calls `client.start_deployment(name)` and reads `response['status']`. As long as the fake behaves the same way at that interface, the test is valid.

**Why mocking matters for DevOps engineers specifically:**
- Your scripts call Kubernetes API, GitHub API, AWS API
- You don't want tests to create real AWS resources or trigger real deployments
- Mocks let you test "what does my script do when the API returns an error?" without actually causing an error in production

`fake_client.start_deployment.called` returns `True` — you can verify a method *was* called, not just what it returned. This checks behaviour, not just output.

## 6. Example pytest test with a mock

This is how mocking often looks in a real test file.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
MOCK_TEST_EXAMPLE = """
from unittest.mock import Mock


def deploy_service(client, service_name: str) -> str:
    response = client.start_deployment(service_name)
    return response['status']


def test_deploy_service_uses_client():
    fake_client = Mock()
    fake_client.start_deployment.return_value = {'status': 'running'}

    result = deploy_service(fake_client, 'auth-api')

    assert result == 'running'
    fake_client.start_deployment.assert_called_once_with('auth-api')
"""

print(MOCK_TEST_EXAMPLE)
```

</div>

### What just happened?
We printed a complete pytest test function using a Mock — this is what your test files will actually look like.

Breaking down `test_deploy_service_uses_client()`:
1. `fake_client = Mock()` — create the fake
2. `fake_client.start_deployment.return_value = {'status': 'running'}` — tell it what to return
3. `result = deploy_service(fake_client, 'auth-api')` — run the real function with the fake
4. `assert result == 'running'` — verify the return value
5. `fake_client.start_deployment.assert_called_once_with('auth-api')` — verify it was called with the right argument

That last assertion is powerful: it checks not just *that* the method was called, but *how* it was called. If your code accidentally called `start_deployment('AUTH-API')` (wrong case) the test would catch it.

**Other useful Mock assertions:**
```python
mock.method.assert_called_once()          # called exactly once
mock.method.assert_called_with("arg")     # last call had this argument
mock.method.call_count == 3               # was called 3 times
mock.method.assert_not_called()           # never called
```

## 7. Packaging basics

Packaging does not have to feel scary.

At beginner level, just remember:
- a package is a reusable project
- `pyproject.toml` is the modern place for project metadata
- packaging makes installation, testing, and reuse cleaner

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
PYPROJECT_EXAMPLE = """
[project]
name = 'my-deployment-tool'
version = '0.1.0'
description = 'A learning project for deployment automation'
requires-python = '>=3.10'

[tool.pytest.ini_options]
testpaths = ['tests']
"""

print(PYPROJECT_EXAMPLE)
```

</div>

### What just happened?
We printed a minimal `pyproject.toml` — the modern Python project configuration file.

`pyproject.toml` replaces the older `setup.py` and `setup.cfg`. Everything lives in one place:

```toml
[project]               ← basic metadata (name, version, description, Python version)
[tool.pytest]           ← pytest configuration (where tests live, what plugins to use)
[tool.ruff]             ← linter configuration (code style rules)
[tool.mypy]             ← type checker configuration
```

**The key fields:**
- `name` — the package name (what you'd `pip install`)
- `version` — your current version (use semantic versioning: `major.minor.patch`)
- `requires-python = ">=3.10"` — enforces the Python version for anyone installing this
- `testpaths = ["tests"]` — tells pytest where to look for tests

For a DevOps tool you're building for your team, this file makes it installable:
```bash
pip install -e .    # install in "editable" mode — your code changes take effect immediately
```

You don't need to master all of this now — just know that `pyproject.toml` exists, what it does, and where to add new configuration when needed.

## 8. A healthy interview answer

If someone asks, "How do you structure a Python project?", a strong simple answer could be:

- I separate app code from tests
- I keep business logic out of route handlers when possible
- I use Pydantic or typed models for contracts
- I write small pytest tests for core behavior
- I mock external systems so tests stay fast and reliable
- I keep project metadata in `pyproject.toml`

That is already a strong practical answer.

## 9. How this chapter connects to your capstone project

The `deployment_control_center/` project next to this notebook uses these exact ideas:
- `app/` for application code
- `tests/` for tests
- `requirements.txt` for dependencies
- `pyproject.toml` for project metadata
- separation of route logic, schemas, config, DB, and services

So this chapter is not isolated theory. It directly supports the capstone.

## 10. What to practice next

Good next exercises:
- add one more API route and write tests for it
- mock a deployment backend in a service-layer test
- add a failing test first, then implement the fix
- explain the folder structure out loud as if you were in an interview

That is how confidence grows.

---
## Practice Questions

---

### Question 1 — Write Real Tests with pytest

Create a file called `test_retry.py` with these two test functions:

**Test 1: `test_retry_delay_doubles`**
Assert that each attempt doubles the previous delay:
- attempt 1 → 0.5s
- attempt 2 → 1.0s
- attempt 3 → 2.0s
- attempt 4 → 4.0s

**Test 2: `test_retry_delay_custom_base`**
Call `calculate_retry_delay(attempt=2, base_delay=1.0)` and assert the result is `2.0`.

Run your tests with `pytest test_retry.py -v` and make sure both pass.

---

### Question 2 — Mocking Practice

Write a function `check_service_health(http_client, url: str) -> str` that:
- Calls `http_client.get(url)`
- If the response has `status_code == 200` → returns `"healthy"`
- If the response has `status_code != 200` → returns `"unhealthy"`
- If calling `http_client.get(url)` raises a `ConnectionError` → returns `"unreachable"`

Then write three pytest test functions using `Mock()`:
1. `test_health_when_200` — mock returns `Mock(status_code=200)` → assert returns `"healthy"`
2. `test_health_when_500` — mock returns `Mock(status_code=500)` → assert returns `"unhealthy"`
3. `test_health_when_connection_error` — mock raises `ConnectionError` → assert returns `"unreachable"`

This is exactly the kind of test you'd write for a health-check utility in a real project.
