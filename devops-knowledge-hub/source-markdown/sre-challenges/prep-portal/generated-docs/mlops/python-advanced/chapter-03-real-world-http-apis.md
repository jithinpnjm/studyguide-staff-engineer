---
title: "Chapter 03 Real World Http Apis"
description: "Generated from mlops/PYTHON/Advanced/chapter_03_real_world_http_apis.ipynb"
slug: "/python-advanced/chapter-03-real-world-http-apis"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_03_real_world_http_apis.ipynb</code></div>

# Chapter 3: Real-World HTTP & APIs

As a DevOps engineer you constantly interact with HTTP APIs:
- GitHub / GitLab (CI/CD triggers, PR status)
- Kubernetes API (pod status, deployments)
- Cloud provider APIs (AWS, GCP)
- Monitoring APIs (Prometheus, Datadog, Grafana)
- Your own internal services

This chapter teaches you how to interact with these APIs professionally —
not just "make a request and hope", but with proper error handling, retries, auth, and async.

## What we cover
| Section | Topic |
|---------|-------|
| 1 | **`requests` deep dive** — sessions, headers, auth, error handling |
| 2 | **Building a robust API client class** — reusable, testable |
| 3 | **Retry with exponential back-off** — don't hammer failing APIs |
| 4 | **Async HTTP with httpx** — concurrent requests the right way |
| 5 | **Real-world: GitHub API client** — a production-grade client |
| 6 | **Working with JSON APIs** — pagination, rate limits, cursors |

---
## 1. The `requests` Library — Deep Dive

You may know `requests.get()`. Let's go much further.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
# pip install requests
# We'll use httpbin.org — a free service that echoes back what you send.
# If you don't have internet, most cells have offline equivalents shown.

import requests
import json

# --- Basic GET ---------------------------------------------------------------
response = requests.get("https://httpbin.org/get", params={"service": "auth", "env": "prod"})

print(f"Status: {response.status_code}")
print(f"URL (with params): {response.url}")
print(f"Content-Type: {response.headers['Content-Type']}")

data = response.json()   # parse JSON — raises if body isn't valid JSON
print(f"Args received by server: {data['args']}")
```

</div>

### What just happened?
We made our first HTTP GET request using the `requests` library.

- `requests.get(url, params={...})` sends a GET request. The `params` dict is automatically turned into a query string: `?service=auth&env=prod`
- `response.status_code` — the HTTP status code. 200 = OK, 404 = not found, 500 = server error
- `response.url` — the full URL including the query string that was actually sent
- `response.headers` — a dict of HTTP headers from the server response
- `response.json()` — parses the response body as JSON and returns a Python dict. Raises `ValueError` if the body isn't valid JSON

We used `httpbin.org` — a free service that echoes back exactly what you sent. Great for testing.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
# --- POST with JSON body -------------------------------------------------------
payload = {
    "service": "auth-api",
    "version": "2.1.0",
    "environment": "prod",
    "replicas": 3
}

response = requests.post(
    "https://httpbin.org/post",
    json=payload,          # automatically sets Content-Type: application/json
    headers={
        "X-Deploy-Token": "abc123",
        "X-Request-ID": "deploy-20250115-001",
    }
)

data = response.json()
print(f"Status: {response.status_code}")
print(f"Data we sent (echoed back): {json.dumps(data['json'], indent=2)}")
print(f"Headers we sent (sample): X-Deploy-Token={data['headers'].get('X-Deploy-Token')}")
```

</div>

### What just happened?
We sent a POST request with a **JSON body** — this is how you create or update resources in REST APIs.

Key points:
- `json=payload` — `requests` automatically serialises the dict to JSON AND sets the `Content-Type: application/json` header for you. If you used `data=` instead, it would send form-encoded data (different format).
- `headers={...}` — custom headers. Here we're sending an auth token and a request ID.
- The server (httpbin) echoes back `data['json']` — the parsed JSON body it received, confirming it arrived correctly.

In real APIs (GitHub, AWS, Kubernetes) you'll send POST/PUT requests like this to create resources.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
# --- Session — reuse connection and headers across multiple requests ----------
# Session = persistent connection pool + shared headers/auth

session = requests.Session()
session.headers.update({
    "Authorization": "Bearer my-api-token-here",
    "User-Agent": "MyDeployBot/1.0",
    "Accept": "application/json",
})

# Every request through this session carries those headers automatically
r1 = session.get("https://httpbin.org/get")
r2 = session.get("https://httpbin.org/headers")

print("Headers seen by server on request 2:")
headers = r2.json()["headers"]
for k in ["Authorization", "User-Agent", "Accept"]:
    print(f"  {k}: {headers.get(k, 'NOT SENT')}")

session.close()   # or use as context manager: `with requests.Session() as s:`
```

</div>

### What just happened?
`requests.Session()` creates a **persistent HTTP session** — a reusable object that remembers settings across requests.

Without a session: every `requests.get()` call opens a new connection, sends headers from scratch, and closes the connection.

With a session:
- **Connection pooling**: connections are reused (faster)
- **Shared headers**: you set `Authorization` once, every request carries it automatically
- **Shared cookies**: useful for APIs that use cookie-based auth

`session.headers.update({...})` merges new headers into the session's defaults. Every subsequent request through this session will include those headers — you never have to repeat them.

Always call `session.close()` when done, or use `with requests.Session() as s:` which closes automatically.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
# --- Proper error handling ----------------------------------------------------
# NEVER just call response.json() without checking status first

def safe_get(url: str, **kwargs) -> dict | None:
    """
    A safe wrapper around requests.get() that:
    1. Raises for 4xx/5xx status codes
    2. Handles connection errors
    3. Handles timeouts
    4. Handles invalid JSON
    """
    try:
        response = requests.get(url, timeout=10, **kwargs)
        response.raise_for_status()   # raises HTTPError for 4xx/5xx
        return response.json()
    except requests.exceptions.Timeout:
        print(f"  TIMEOUT: {url}")
    except requests.exceptions.ConnectionError:
        print(f"  CONNECTION ERROR: {url}")
    except requests.exceptions.HTTPError as e:
        print(f"  HTTP {e.response.status_code}: {url}")
    except ValueError:
        print(f"  INVALID JSON from: {url}")
    return None

# Test with working URL
result = safe_get("https://httpbin.org/get")
print(f"OK: {result is not None}")

# Test with 404
result = safe_get("https://httpbin.org/status/404")
print(f"404 result: {result}")

# Test with 500
result = safe_get("https://httpbin.org/status/500")
print(f"500 result: {result}")
```

</div>

### What just happened?
We wrapped `requests.get()` in proper error handling — this is what **production code** looks like vs beginner code.

The key method is `response.raise_for_status()` — it does nothing if the status is 2xx (success), but raises `requests.exceptions.HTTPError` for 4xx and 5xx responses. Without this call, `requests` happily returns 404 and 500 responses without raising any exception.

The exception hierarchy to catch:
- `requests.exceptions.Timeout` — the server took too long to respond (set with `timeout=10`)
- `requests.exceptions.ConnectionError` — couldn't connect at all (DNS failure, refused connection)
- `requests.exceptions.HTTPError` — connected but got a 4xx or 5xx response
- `ValueError` — connected, got 200, but the body wasn't valid JSON

Always set a `timeout` — without it, your code can hang forever waiting for a server that never responds.

---
## 2. Building a Robust API Client Class

Rather than scattering `requests.get()` calls throughout your code,
build a client class. Benefits:
- One place to configure auth, retries, timeouts
- Easier to test (mock the client, not individual requests)
- Consistent error handling
- Easy to swap transport (requests → httpx) later

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
import requests
import time
import logging
from typing import Any, Dict, Optional
from dataclasses import dataclass, field

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class APIConfig:
    base_url: str
    token: str
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0


class APIError(Exception):
    """Raised when an API call fails after all retries."""
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


class BaseAPIClient:
    """
    A reusable HTTP API client with:
    - Session with persistent auth headers
    - Automatic retries with exponential back-off
    - Structured logging
    - Consistent error handling
    """

    def __init__(self, config: APIConfig):
        self.config = config
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {config.token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        })

    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs,
    ) -> Dict[str, Any]:
        url = f"{self.config.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        last_exc = None

        for attempt in range(1, self.config.max_retries + 1):
            try:
                logger.debug(f"{method.upper()} {url} (attempt {attempt})")
                response = self._session.request(
                    method, url,
                    timeout=self.config.timeout,
                    **kwargs,
                )
                response.raise_for_status()
                return response.json()

            except requests.exceptions.Timeout as e:
                last_exc = e
                logger.warning(f"Timeout on attempt {attempt}/{self.config.max_retries}: {url}")

            except requests.exceptions.HTTPError as e:
                status = e.response.status_code
                # Don't retry client errors (4xx) — they won't fix themselves
                if 400 <= status < 500:
                    raise APIError(f"Client error {status}: {url}", status_code=status)
                last_exc = e
                logger.warning(f"Server error {status} on attempt {attempt}: {url}")

            except requests.exceptions.ConnectionError as e:
                last_exc = e
                logger.warning(f"Connection error on attempt {attempt}: {url}")

            if attempt < self.config.max_retries:
                wait = self.config.retry_delay * (2 ** (attempt - 1))  # exponential back-off
                logger.info(f"Retrying in {wait:.1f}s...")
                time.sleep(wait)

        raise APIError(f"All {self.config.max_retries} attempts failed: {url}") from last_exc

    def get(self, endpoint: str, params: dict = None) -> Dict[str, Any]:
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, body: dict) -> Dict[str, Any]:
        return self._request("POST", endpoint, json=body)

    def put(self, endpoint: str, body: dict) -> Dict[str, Any]:
        return self._request("PUT", endpoint, json=body)

    def delete(self, endpoint: str) -> Dict[str, Any]:
        return self._request("DELETE", endpoint)

    def close(self):
        self._session.close()

    def __enter__(self): return self
    def __exit__(self, *_): self.close()


# Demo using httpbin
config = APIConfig(
    base_url="https://httpbin.org",
    token="demo-token-12345",
    max_retries=2,
)

with BaseAPIClient(config) as client:
    # GET
    result = client.get("/get", params={"service": "auth"})
    print(f"GET status: {result.get('args')}")

    # POST
    result = client.post("/post", body={"action": "deploy", "version": "v2"})
    print(f"POST received: {result.get('json')}")

    # 404 — raises immediately (4xx, no retry)
    try:
        client.get("/status/404")
    except APIError as e:
        print(f"APIError: {e} (status={e.status_code})")
```

</div>

### What just happened?
We built a **reusable API client class** — this is the professional pattern for interacting with any HTTP API.

Instead of scattered `requests.get()` calls everywhere, all HTTP logic lives in one place:
- `self._session` — one shared session with auth headers pre-configured
- `_request()` — the core method that handles retries, error handling, and logging for every request
- `get()`, `post()`, `put()`, `delete()` — thin wrappers that call `_request()` with the right HTTP method

The retry logic inside `_request()`:
- Retries on timeouts, connection errors, and 5xx server errors
- Does NOT retry 4xx errors (client errors like 404, 401 — retrying won't fix these)
- Waits `base_delay * 2^(attempt-1)` between retries — that's exponential back-off

`__enter__` / `__exit__` make the client usable with `with` — the session closes automatically.

---
## 3. Retry with Exponential Back-off

When an API is temporarily unavailable, retrying immediately usually makes things worse.
**Exponential back-off** doubles the wait time after each failure:

```
Attempt 1 fails → wait 1s
Attempt 2 fails → wait 2s
Attempt 3 fails → wait 4s
...
```

This is the standard pattern used by AWS SDK, Google Cloud SDK, and Kubernetes client.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
import time, random
from typing import Callable, TypeVar

T = TypeVar("T")

def with_backoff(
    fn: Callable[[], T],
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: bool = True,   # add randomness to avoid thundering herd
) -> T:
    """
    Call fn() with exponential back-off retries.

    Jitter: When 100 services all fail at the same time and retry on the
    same schedule, they all hit the server simultaneously. Jitter spreads
    them out randomly — standard practice at scale.
    """
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as e:
            last_exc = e
            if attempt == max_attempts:
                break
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            if jitter:
                delay *= random.uniform(0.5, 1.5)
            print(f"  Attempt {attempt} failed: {e!r}. Retrying in {delay:.2f}s")
            time.sleep(delay)
    raise last_exc

# Demo: simulate a service that fails 3 times then succeeds
attempt_count = 0

def flaky_health_check() -> str:
    global attempt_count
    attempt_count += 1
    if attempt_count < 4:
        raise ConnectionError(f"Service unavailable (attempt {attempt_count})")
    return "healthy"

random.seed(1)
attempt_count = 0
result = with_backoff(flaky_health_check, max_attempts=5, base_delay=0.1)
print(f"Final result: {result}  (took {attempt_count} attempts)")
```

</div>

### What just happened?
We extracted the retry-with-backoff logic into a **standalone function** that works with any callable.

**Jitter** is the important new concept here. Imagine 500 microservices all hit the same database at once. The DB gets overloaded and rejects them all. Without jitter, they ALL retry after exactly 1 second — another thundering herd. With jitter, each waits a *random* amount around 1 second — they spread out and the DB can recover.

`random.uniform(0.5, 1.5)` multiplies the delay by a random factor between 0.5x and 1.5x. Simple but effective.

`min(base * 2**attempt, max_delay)` caps the delay so it never grows beyond `max_delay` — you don't want to wait 5 minutes after 10 failures.

---
## 4. Async HTTP with httpx

`httpx` is a modern HTTP library that supports both sync and async,
has the same API as `requests`, and is the recommended choice for async code.

```python
pip install httpx
```

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
# httpx sync (drop-in replacement for requests)
# import httpx
# response = httpx.get("https://api.example.com/health")

# httpx async — the real power
# async with httpx.AsyncClient() as client:
#     response = await client.get(url)
#     data = response.json()

# ── We simulate httpx here for offline demo ──────────────────────────────
import asyncio, time, random
from typing import List, Dict, Any

class FakeAsyncClient:
    """Simulates httpx.AsyncClient.  Replace with real httpx in your code."""
    async def __aenter__(self): return self
    async def __aexit__(self, *_): pass

    async def get(self, url: str, headers: dict = None, params: dict = None):
        await asyncio.sleep(random.uniform(0.05, 0.2))
        class Resp:
            status_code = 200
            def raise_for_status(self): pass
            def json(self_inner):
                return {"url": url, "params": params or {}}
        return Resp()

    async def post(self, url, json=None, headers=None):
        await asyncio.sleep(random.uniform(0.05, 0.15))
        class Resp:
            status_code = 201
            def raise_for_status(self): pass
            def json(self_inner): return {"created": True, "data": json}
        return Resp()


# ── Async API Client ──────────────────────────────────────────────────────
class AsyncAPIClient:
    """Async version of BaseAPIClient using httpx.AsyncClient (simulated here)."""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        self._client = FakeAsyncClient()   # replace with httpx.AsyncClient()

    async def __aenter__(self):
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *args):
        await self._client.__aexit__(*args)

    async def get(self, endpoint: str, params: dict = None) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        resp = await self._client.get(url, headers=self.headers, params=params)
        resp.raise_for_status()
        return resp.json()

    async def post(self, endpoint: str, body: dict) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        resp = await self._client.post(url, json=body, headers=self.headers)
        resp.raise_for_status()
        return resp.json()


# ── Demo: parallel requests ────────────────────────────────────────────────
async def fetch_all_service_configs(services: List[str]) -> List[Dict[str, Any]]:
    async with AsyncAPIClient("https://config.internal", "token-xyz") as client:
        tasks = [client.get(f"/services/{svc}/config") for svc in services]
        return await asyncio.gather(*tasks, return_exceptions=True)

services = ["auth-api", "user-svc", "payment-api", "notification-svc", "analytics"]

print(f"Fetching configs for {len(services)} services concurrently...")
random.seed(42)
start = time.time()
results = asyncio.run(fetch_all_service_configs(services))
elapsed = time.time() - start

print(f"Done in {elapsed:.2f}s")
for svc, result in zip(services, results):
    if isinstance(result, Exception):
        print(f"  ERROR {svc}: {result}")
    else:
        print(f"  OK    {svc}: {result.get('url', '?').split('/')[-2]}")
```

</div>

### What just happened?
This is the async version of our API client, using `httpx.AsyncClient` (simulated here).

The key difference from the sync version:
- `async def get(...)` — it's a coroutine, must be awaited
- `async with AsyncHTTPClient() as client:` — async context manager (uses `__aenter__`/`__aexit__`)
- `await client.get(url)` — pauses here, letting other requests run

`__aenter__` and `__aexit__` are the async equivalents of `__enter__` and `__exit__`. Any class can be used as both a sync AND async context manager by implementing both pairs.

In real code, replace `FakeAsyncClient` with `httpx.AsyncClient()` and everything works identically.

---
## 5. Real-World: GitHub API Client

GitHub's API is a great learning target — well-documented, free to use (rate-limited),
and extremely relevant for DevOps work.

We build a proper client with:
- Typed methods for common operations
- Pagination support
- Rate limit awareness

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
import requests, time
from typing import List, Dict, Any, Optional, Iterator
from dataclasses import dataclass


@dataclass
class RateLimitInfo:
    limit: int
    remaining: int
    reset_at: float   # Unix timestamp

    @property
    def reset_in_seconds(self) -> float:
        return max(0, self.reset_at - time.time())

    def __str__(self) -> str:
        return f"{self.remaining}/{self.limit} remaining, resets in {self.reset_in_seconds:.0f}s"


class GitHubClient:
    """
    GitHub REST API v3 client.

    Usage:
        client = GitHubClient(token="ghp_your_token")
        repos = client.list_repos("your-org")

    Without a token you get 60 requests/hour.
    With a token: 5000 requests/hour.
    """

    BASE = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        self._session = requests.Session()
        self._session.headers.update({
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "MyGitHubClient/1.0",
        })
        if token:
            self._session.headers["Authorization"] = f"token {token}"
        self.rate_limit: Optional[RateLimitInfo] = None

    def _get(self, path: str, params: dict = None) -> requests.Response:
        url = f"{self.BASE}/{path.lstrip('/')}"
        resp = self._session.get(url, params=params, timeout=15)

        # Update rate limit from every response
        if "X-RateLimit-Limit" in resp.headers:
            self.rate_limit = RateLimitInfo(
                limit=int(resp.headers["X-RateLimit-Limit"]),
                remaining=int(resp.headers["X-RateLimit-Remaining"]),
                reset_at=float(resp.headers["X-RateLimit-Reset"]),
            )

        resp.raise_for_status()
        return resp

    def get_repo(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get repository metadata."""
        return self._get(f"/repos/{owner}/{repo}").json()

    def list_repos(self, org: str, type: str = "public") -> List[Dict[str, Any]]:
        """List all repos for an org (handles pagination)."""
        return list(self._paginate(f"/orgs/{org}/repos", {"type": type, "per_page": 100}))

    def list_issues(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        labels: str = None,
    ) -> List[Dict[str, Any]]:
        params = {"state": state, "per_page": 100}
        if labels:
            params["labels"] = labels
        return list(self._paginate(f"/repos/{owner}/{repo}/issues", params))

    def get_workflow_runs(
        self,
        owner: str,
        repo: str,
        workflow_id: str,
        status: str = None,
    ) -> List[Dict[str, Any]]:
        """List GitHub Actions workflow runs."""
        params = {"per_page": 100}
        if status:
            params["status"] = status
        resp = self._get(f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", params)
        return resp.json().get("workflow_runs", [])

    def _paginate(self, path: str, params: dict = None) -> Iterator[Dict[str, Any]]:
        """
        Handle GitHub pagination automatically.
        GitHub returns results in pages of up to 100 items.
        The 'next' page URL is in the Link header.
        """
        url = f"{self.BASE}/{path.lstrip('/')}"
        params = params or {}

        while url:
            resp = self._session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            yield from resp.json()

            # Parse Link header for next page
            link = resp.headers.get("Link", "")
            url = None
            params = {}   # don't re-send params, they're baked into the next URL
            for part in link.split(","):
                if 'rel="next"' in part:
                    url = part.split(";")[0].strip().strip("<>")
                    break

    def close(self):
        self._session.close()

    def __enter__(self): return self
    def __exit__(self, *_): self.close()


# ── Demo (no token required for public repos) ──────────────────────────────
print("=== GitHub API Client Demo ===\n")

with GitHubClient() as gh:
    # Get a public repo
    try:
        repo = gh.get_repo("pallets", "flask")
        print(f"Repository: {repo['full_name']}")
        print(f"  Stars:       {repo['stargazers_count']:,}")
        print(f"  Forks:       {repo['forks_count']:,}")
        print(f"  Open issues: {repo['open_issues_count']:,}")
        print(f"  Language:    {repo['language']}")
        print(f"  Updated:     {repo['updated_at']}")

        if gh.rate_limit:
            print(f"\nRate limit: {gh.rate_limit}")

        # List open issues (first 5)
        issues = gh.list_issues("pallets", "flask", state="open")
        print(f"\nOpen issues (showing first 5 of {len(issues)}):")
        for issue in issues[:5]:
            labels = [l["name"] for l in issue.get("labels", [])]
            label_str = f" [{', '.join(labels)}]" if labels else ""
            print(f"  #{issue['number']:4d}: {issue['title'][:60]}{label_str}")

    except requests.exceptions.HTTPError as e:
        print(f"API error: {e}")
    except requests.exceptions.ConnectionError:
        print("No internet connection — skipping live API demo")
        print("(The client class is ready to use when connected)")
```

</div>

### What just happened?
We fetched configs for 5 services **all at the same time** using `asyncio.gather()`.

The list comprehension `[client.get(f"/services/{svc}/config") for svc in services]` creates 5 coroutines. They don't start yet — coroutines are lazy. `asyncio.gather(*tasks)` starts all of them simultaneously.

`return_exceptions=True` means if any request fails, we still get results for the others — no single failure kills the whole batch.

Notice the `isinstance(result, Exception)` check — we handle each result individually: print OK or ERROR per service.

---
## 6. Handling Pagination, Rate Limits, and Cursors

Most production APIs have these features. Here's a reusable pattern.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
import time, requests
from typing import Iterator, Dict, Any, Optional

class PaginatedAPIClient:
    """
    Generic paginated API client supporting:
    - Offset pagination: ?page=1&per_page=100
    - Cursor pagination: ?cursor=abc123 (used by Slack, Stripe, etc.)
    - Link header pagination (GitHub style)
    - Rate limit detection and automatic throttling
    """

    def __init__(self, base_url: str, headers: dict = None):
        self._session = requests.Session()
        if headers:
            self._session.headers.update(headers)

    def paginate_offset(
        self,
        endpoint: str,
        results_key: str = "data",
        page_size: int = 100,
    ) -> Iterator[Dict[str, Any]]:
        """Offset-based pagination: ?page=N&per_page=100"""
        page = 1
        while True:
            resp = self._session.get(
                endpoint,
                params={"page": page, "per_page": page_size},
                timeout=30,
            )

            # Handle rate limiting
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 60))
                print(f"  Rate limited! Waiting {retry_after}s")
                time.sleep(retry_after)
                continue

            resp.raise_for_status()
            data = resp.json()
            items = data.get(results_key, [])

            if not items:
                break

            yield from items

            # Some APIs tell you total pages
            total_pages = data.get("total_pages") or data.get("meta", {}).get("total_pages")
            if total_pages and page >= total_pages:
                break

            page += 1

    def paginate_cursor(
        self,
        endpoint: str,
        results_key: str = "data",
        cursor_key: str = "next_cursor",
    ) -> Iterator[Dict[str, Any]]:
        """Cursor-based pagination: returns a cursor pointing to next batch."""
        cursor: Optional[str] = None

        while True:
            params = {}
            if cursor:
                params["cursor"] = cursor

            resp = self._session.get(endpoint, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            yield from data.get(results_key, [])

            cursor = data.get(cursor_key)
            if not cursor:
                break


# ── Demo: simulated paginated API ─────────────────────────────────────────
from unittest.mock import patch, MagicMock

def make_fake_response(page: int, per_page: int, total: int = 250):
    """Create a fake paginated API response."""
    start = (page - 1) * per_page
    end = min(start + per_page, total)
    items = [{"id": i, "name": f"deployment-{i:04d}"} for i in range(start, end)]
    total_pages = (total + per_page - 1) // per_page

    mock = MagicMock()
    mock.status_code = 200
    mock.raise_for_status = lambda: None
    mock.json.return_value = {
        "data": items,
        "total_pages": total_pages,
        "page": page,
    }
    return mock

client = PaginatedAPIClient("https://api.example.com")

page_num = 0
def fake_get(url, params=None, timeout=None):
    global page_num
    page_num += 1
    return make_fake_response(params.get("page", 1), params.get("per_page", 100))

with patch.object(client._session, "get", side_effect=fake_get):
    all_deployments = list(client.paginate_offset(
        "https://api.example.com/deployments",
        results_key="data",
        page_size=100,
    ))

print(f"Fetched {len(all_deployments)} deployments in {page_num} API pages")
print(f"First: {all_deployments[0]}")
print(f"Last:  {all_deployments[-1]}")
```

</div>

### What just happened?
Most production APIs don't return all results at once — they return pages (e.g. 100 items per page).

Two common pagination styles:
1. **Offset-based**: `?page=1&per_page=100`, `?page=2&per_page=100` — easy to implement, works for most APIs
2. **Cursor-based**: `?cursor=abc123` — the server gives you a token pointing to the next batch. More efficient for large datasets (used by Stripe, Slack, Twitter)

Our `paginate_offset()` method keeps requesting the next page until it gets an empty result or hits `total_pages`. It's a **generator** (`yield from`) so it doesn't load all pages into memory at once — it yields items as each page arrives.

The `unittest.mock.patch` at the bottom is how you test API code without a real server — we replace `session.get` with a fake function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
# ── Real-world pattern: combining everything ──────────────────────────────
# A deployment status reporter that:
# 1. Fetches all recent deployments (paginated)
# 2. Checks health of each deployed service (concurrent)
# 3. Generates a summary report

import asyncio, time, random
from dataclasses import dataclass
from typing import List, Dict

@dataclass
class DeploymentRecord:
    id: str
    service: str
    version: str
    environment: str
    deployed_at: str
    status: str = "unknown"

# Simulate fetching from an API
def fetch_recent_deployments(limit: int = 20) -> List[DeploymentRecord]:
    services = ["auth-api", "user-svc", "payment-api", "notification", "analytics"]
    envs = ["prod", "staging", "dev"]
    records = []
    for i in range(limit):
        svc = random.choice(services)
        records.append(DeploymentRecord(
            id=f"dep-{i:04d}",
            service=svc,
            version=f"v{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,20)}",
            environment=random.choice(envs),
            deployed_at=f"2025-01-{random.randint(1,15):02d}T{random.randint(0,23):02d}:00:00Z",
        ))
    return records

# Async health check
async def check_service_health(service: str, env: str) -> tuple[str, str]:
    await asyncio.sleep(random.uniform(0.05, 0.2))
    status = random.choice(["healthy", "healthy", "healthy", "degraded", "down"])
    return f"{env}/{service}", status

async def generate_deployment_report(deployments: List[DeploymentRecord]) -> None:
    # Check health of all unique service+env combinations concurrently
    combos = list({(d.service, d.environment) for d in deployments})
    print(f"Checking health of {len(combos)} service/env combinations concurrently...")

    tasks = [check_service_health(svc, env) for svc, env in combos]
    results = await asyncio.gather(*tasks)
    health_map = dict(results)

    # Annotate deployments with health status
    for d in deployments:
        d.status = health_map.get(f"{d.environment}/{d.service}", "unknown")

    # Generate report
    print("\n" + "=" * 60)
    print("DEPLOYMENT STATUS REPORT")
    print("=" * 60)

    by_env: Dict[str, List[DeploymentRecord]] = {}
    for d in deployments:
        by_env.setdefault(d.environment, []).append(d)

    for env in sorted(by_env.keys()):
        print(f"\n[{env.upper()}]")
        for d in sorted(by_env[env], key=lambda x: x.service):
            icon = {"healthy": "✓", "degraded": "!", "down": "✗"}.get(d.status, "?")
            print(f"  {icon} {d.service:20s} {d.version:12s} {d.status}")

    total = len(deployments)
    healthy = sum(1 for d in deployments if d.status == "healthy")
    print(f"\nSummary: {healthy}/{total} deployments healthy")

random.seed(99)
deployments = fetch_recent_deployments(15)

start = time.time()
asyncio.run(generate_deployment_report(deployments))
print(f"\nReport generated in {time.time() - start:.2f}s")
```

</div>

### What just happened?
This is the **capstone** combining everything from this chapter:

1. `fetch_recent_deployments()` — sync function, simulates fetching from a paginated API
2. `check_service_health()` — async function, one per unique service+environment combo
3. `asyncio.gather(*tasks)` — all health checks run simultaneously
4. `health_map = dict(results)` — combines the results into a lookup dict
5. Report generation — groups deployments by environment, annotates with health status

The flow mirrors what you'd actually build for a DevOps dashboard:
- Fetch deployment data from your CI/CD system
- Check live health of each service concurrently
- Join the two datasets and render a report

Notice we deduplicate with a set comprehension: `{(d.service, d.environment) for d in deployments}` — no point checking the same service+env twice.

---
## Summary

| Tool | Use when | Key feature |
|------|----------|-------------|
| `requests` | Sync code, simple scripts | Familiar, mature, great docs |
| `requests.Session` | Multiple calls to same API | Connection pooling, shared headers |
| `httpx` (sync) | Drop-in requests replacement | Modern, HTTP/2, better timeouts |
| `httpx` (async) | Async code, many concurrent calls | Native async, same API |
| Retry + back-off | Unreliable network or APIs | Don't hammer failing services |
| Pagination helpers | APIs that page results | Get all data without manual loops |

## Patterns Cheat Sheet

```python
# Session with auth (sync)
session = requests.Session()
session.headers.update({"Authorization": "Bearer TOKEN"})

# Retry with back-off
for attempt in range(max_retries):
    try:
        return session.get(url, timeout=30).json()
    except requests.HTTPError as e:
        if 400 <= e.response.status_code < 500: raise  # don't retry 4xx
        time.sleep(base * 2**attempt)

# Async multiple requests
async with httpx.AsyncClient(headers=auth_headers) as client:
    results = await asyncio.gather(*[client.get(url) for url in urls])

# Pagination
while url:
    resp = session.get(url); yield from resp.json()["items"]
    url = parse_next_link(resp.headers.get("Link", ""))
```

## What to explore next
- **FastAPI** — build your own REST APIs with type hints and async
- **SQLAlchemy** — async database access from Python
- **Pydantic** — data validation for API request/response models (used by FastAPI)
- **httpx** docs: https://www.python-httpx.org/

---
## Add-on: Production Habits for API Clients

A lot of Python HTTP examples stop at `requests.get(url)`.

Real tools need a bit more discipline:
- read tokens from environment variables, not source code
- always set timeouts explicitly
- attach correlation IDs or request IDs
- redact secrets before logging
- separate request transport from business logic

This is especially important for internal DevOps tools, where debugging and auditability matter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
import os
import uuid
from dataclasses import dataclass
from typing import Optional


@dataclass
class ClientSettings:
    base_url: str
    token: str
    timeout: int = 15

    @classmethod
    def from_env(cls, prefix: str = 'DEPLOY_API_') -> 'ClientSettings':
        base_url = os.environ.get(f'{prefix}BASE_URL', 'https://api.internal.example')
        token = os.environ.get(f'{prefix}TOKEN', 'demo-token')
        timeout = int(os.environ.get(f'{prefix}TIMEOUT', '15'))
        return cls(base_url=base_url, token=token, timeout=timeout)


def build_headers(settings: ClientSettings, request_id: Optional[str] = None) -> dict[str, str]:
    return {
        'Authorization': f'Bearer {settings.token}',
        'Accept': 'application/json',
        'X-Request-ID': request_id or str(uuid.uuid4()),
    }


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    redacted = headers.copy()
    if 'Authorization' in redacted:
        redacted['Authorization'] = 'Bearer ***REDACTED***'
    return redacted


settings = ClientSettings.from_env()
headers = build_headers(settings, request_id='deploy-12345')
print('Settings:', settings)
print('Headers for logs:', redact_headers(headers))
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
def classify_status(status_code: int) -> str:
    if 200 <= status_code < 300:
        return 'success'
    if status_code in {408, 429, 500, 502, 503, 504}:
        return 'retryable'
    if 400 <= status_code < 500:
        return 'client_error'
    return 'server_error'


for code in [200, 201, 400, 401, 404, 429, 500, 503]:
    print(f'{code} -> {classify_status(code)}')
```

</div>

### Why this add-on matters

This is the difference between a demo script and a tool you can trust in production.

A strong interview answer is not just:
- "I know `requests` and `httpx`."

It is more like:
- "I always set timeouts explicitly."
- "I keep tokens out of source code."
- "I attach request IDs for traceability."
- "I treat 429 and 503 differently from 401 and 404."

That shows engineering judgment, not only library familiarity.

---
## Practice Questions

---

### Question 1 — Robust API Client

Using the `BaseAPIClient` class from this chapter as a starting point, build a `JSONPlaceholderClient` that wraps the free test API at `https://jsonplaceholder.typicode.com`.

It should have these methods (all using `self.get()` or `self.post()`):
- `get_post(post_id: int) -> dict` — fetch `/posts/{post_id}`
- `list_posts(user_id: int = None) -> list` — fetch `/posts`, optionally filtered by `?userId=`
- `create_post(title: str, body: str, user_id: int) -> dict` — POST to `/posts`

Test it:
```python
client = JSONPlaceholderClient(base_url="https://jsonplaceholder.typicode.com", token="")
post = client.get_post(1)
print(post["title"])

posts = client.list_posts(user_id=1)
print(f"User 1 has {len(posts)} posts")
```

---

### Question 2 — Async Parallel Requests

Write an async function `fetch_posts_parallel(post_ids: list) -> list` that:
- Takes a list of post IDs (e.g. `[1, 5, 10, 15, 20]`)
- Fetches all of them **concurrently** from `https://jsonplaceholder.typicode.com/posts/{id}` (simulate with `asyncio.sleep` + a dict of fake data if no internet)
- Returns a list of dicts, in the same order as the input IDs
- Handles failures gracefully — if one fetch fails, return `{"id": id, "error": "failed"}` for that one

Print the titles of all posts fetched, and the total time taken.
