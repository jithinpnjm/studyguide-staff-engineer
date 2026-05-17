---
title: "HTTP, APIs, and Reverse Proxy Paths"
sidebar_position: 22
---

# HTTP, APIs, and Reverse Proxy Paths

## What It Is and Why It Matters

HTTP is the protocol of the modern web and APIs. Understanding HTTP deeply — not just GET/POST, but connection lifecycle, TLS handshake, headers, caching semantics, and status codes — is fundamental to debugging any web-facing service.

Reverse proxies sit in front of application servers. They handle TLS termination, load balancing, rate limiting, authentication, request routing, and observability. NGINX, Envoy, HAProxy, and Traefik are the most common in production environments. Kubernetes Ingress controllers are typically just managed configurations of these.

Understanding how a request flows from a user's browser through DNS, load balancers, TLS termination, reverse proxy, and into an application — and where it can fail at each step — is the core mental model for diagnosing production HTTP problems.

---

## Mental Model: The Request Path

```
User browser
    → DNS lookup (A/AAAA record → IP)
    → TCP connection (3-way handshake)
    → TLS handshake (ClientHello → ServerHello → certificate → key exchange)
    → HTTP request (GET /api/checkout HTTP/1.1)
    → Load balancer (L4: TCP; or L7: HTTP)
    → Reverse proxy / Ingress (NGINX, Envoy)
        → TLS termination (if not already done)
        → Request routing (path/header match → upstream)
        → Health check (is upstream healthy?)
        → Connection pool → backend pod
    → Application (processes request)
    → Response travels the same path back
```

Each hop is a potential failure point. When debugging HTTP issues, walk this path and check each layer.

---

## HTTP Fundamentals

### Request Structure

```
GET /api/v1/users/123 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Accept: application/json
Content-Type: application/json
Connection: keep-alive
```

Key headers:
- `Host`: identifies which virtual host on the server (mandatory in HTTP/1.1)
- `Authorization`: bearer token, basic auth, etc.
- `Content-Type`: format of the request body
- `Accept`: formats the client can handle
- `Connection: keep-alive`: reuse TCP connection (HTTP/1.1 default)

### Response Status Codes

| Range | Meaning | Key codes |
|-------|---------|-----------|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

**502 vs 503 vs 504:**
- 502 Bad Gateway: proxy received an invalid response from the upstream (upstream crashed or returned garbage)
- 503 Service Unavailable: no healthy upstream available (all backends down, or upstream explicitly returned 503)
- 504 Gateway Timeout: proxy waited for upstream to respond, timed out

### HTTP/1.1 vs HTTP/2 vs HTTP/3

**HTTP/1.1:** One request per connection at a time. Workaround: multiple connections (browsers open 6-8 per domain). Head-of-line blocking: a slow request blocks all subsequent requests on that connection.

**HTTP/2:** Multiplexing — multiple requests over one TCP connection via streams. Binary framing (not text). Header compression (HPACK). Server push (server sends resources before client asks). Still has TCP head-of-line blocking at the transport layer.

**HTTP/3:** Built on QUIC (UDP-based). Solves TCP head-of-line blocking. Better performance on lossy networks. Stream-level multiplexing without transport-layer blocking.

In practice: most backend-to-backend traffic is HTTP/1.1 or HTTP/2. HTTP/3 is primarily between clients and CDN edges.

### TLS Handshake

```
Client                          Server
  |                               |
  |--- ClientHello ─────────────>|  (TLS version, cipher suites, random)
  |<── ServerHello ─────────────|  (chosen cipher suite, random, certificate)
  |<── Certificate ─────────────|  (server's public key)
  |<── ServerHelloDone ─────────|
  |--- ClientKeyExchange ───────>|  (pre-master secret, encrypted with server's public key)
  |--- ChangeCipherSpec ────────>|
  |--- Finished ────────────────>|
  |<── ChangeCipherSpec ─────────|
  |<── Finished ─────────────────|
  |                               |
  |=== Encrypted application data =|
```

TLS 1.3 simplifies this to 1-RTT (or even 0-RTT for resumed sessions).

Certificate verification:
1. Client checks the certificate's Common Name (CN) or Subject Alternative Names (SANs) match the hostname
2. Client checks the certificate hasn't expired
3. Client verifies the certificate chain up to a trusted CA in its trust store

Common TLS errors:
- `SSL_ERROR_RX_RECORD_TOO_LONG`: TLS port is actually serving HTTP (usually misconfigured backend)
- `certificate has expired`: self-explanatory; check cert expiry in CI
- `hostname mismatch`: cert is for `api.example.com`, request is to `backend.internal`
- `CERTIFICATE_VERIFY_FAILED`: cert chain can't be verified (missing intermediate, self-signed, wrong root CA)

---

## REST API Design Principles

### Resource-Oriented Design

Good REST APIs treat resources as nouns, not actions:

```
# Good — resources as nouns
GET    /users/123          → get user
POST   /users              → create user
PUT    /users/123          → replace user
PATCH  /users/123          → partial update
DELETE /users/123          → delete user

# Bad — actions as verbs
POST /getUserById
POST /createNewUser
POST /deleteUser
```

HTTP verbs carry semantic meaning:
- `GET`: safe (no side effects), idempotent (multiple identical requests = same result)
- `PUT`: idempotent (same request multiple times = same result)
- `POST`: not idempotent (creating a resource each call)
- `DELETE`: idempotent
- `PATCH`: not necessarily idempotent (depends on operation)

### Idempotency Keys

For non-idempotent operations (POST), use idempotency keys to prevent duplicate operations (network retry that reached the server):

```
POST /payments
Idempotency-Key: 4b2d9e8f-a1b2-4c3d-8e9f-1a2b3c4d5e6f

{
  "amount": 100,
  "currency": "USD"
}
```

Server checks if it has seen this key — if yes, returns the cached response. If no, processes and stores the result with the key.

### Versioning

Common approaches:
```
# URL path versioning (most common, very explicit)
GET /v1/users/123
GET /v2/users/123

# Header versioning (cleaner URLs, harder to test in browser)
GET /users/123
API-Version: 2024-01-01

# Content negotiation
Accept: application/vnd.company.users.v2+json
```

### Pagination

```
# Offset-based (simple, but inefficient at large offsets)
GET /users?offset=100&limit=20

# Cursor-based (efficient, consistent with concurrent writes)
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
# cursor is opaque token, usually base64-encoded {id: 100}

# Response
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_more": true
  }
}
```

---

## NGINX Deep Dive

### Core Configuration Structure

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;          # one worker per CPU core
worker_rlimit_nofile 65535;     # max open files per worker

events {
    worker_connections 4096;    # connections per worker
    use epoll;                  # Linux: use epoll for event handling
    multi_accept on;            # accept multiple connections per event
}

http {
    # Connection settings
    keepalive_timeout 65;
    keepalive_requests 1000;
    client_max_body_size 10m;
    client_body_timeout 12;
    client_header_timeout 12;

    # Logging
    log_format json_combined escape=json
        '{'
          '"time":"$time_iso8601",'
          '"remote_addr":"$remote_addr",'
          '"method":"$request_method",'
          '"uri":"$request_uri",'
          '"status":"$status",'
          '"body_bytes":"$body_bytes_sent",'
          '"request_time":"$request_time",'
          '"upstream_addr":"$upstream_addr",'
          '"upstream_response_time":"$upstream_response_time"'
        '}';

    access_log /var/log/nginx/access.log json_combined;

    include /etc/nginx/conf.d/*.conf;
}
```

### Virtual Host and Upstream

```nginx
# /etc/nginx/conf.d/api.conf

upstream api_backend {
    least_conn;                  # route to backend with fewest active connections
    keepalive 32;                # keep 32 persistent connections to backend

    server backend1:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend2:8080 weight=3 max_fails=3 fail_timeout=30s;
    server backend3:8080 weight=1 backup;    # only used if others are all down
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/api.example.com.pem;
    ssl_certificate_key /etc/ssl/api.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";         # enable keepalive to backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 8 8k;
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

### Rate Limiting

```nginx
http {
    # Define rate limit zone: key=IP, zone name, zone size, rate
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $http_authorization zone=auth_limit:10m rate=100r/m;

    server {
        location /api/ {
            # Allow burst of 20 requests, then strictly enforce 10r/s
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;

            # Also limit by auth token (per-user rate limiting)
            limit_req zone=auth_limit burst=10;
        }
    }
}
```

### Caching

```nginx
http {
    proxy_cache_path /var/cache/nginx levels=1:2
                     keys_zone=api_cache:10m
                     max_size=1g
                     inactive=60m;

    server {
        location /api/products/ {
            proxy_cache api_cache;
            proxy_cache_valid 200 5m;         # cache 200 responses for 5 minutes
            proxy_cache_valid 404 1m;
            proxy_cache_use_stale error timeout; # serve stale on backend error
            proxy_cache_key "$scheme$request_method$host$request_uri";
            add_header X-Cache-Status $upstream_cache_status;
        }
    }
}
```

---

## Envoy and Service Mesh

### Why Envoy

Envoy is the data-plane proxy used in service mesh architectures (Istio, Linkerd). Unlike NGINX which uses a static configuration file, Envoy's configuration is dynamic — it can be updated via xDS APIs without restart.

Key Envoy concepts:
- **Listeners**: accept incoming connections (like NGINX `server {}`)
- **Routes**: match requests to clusters (like NGINX `location {}`)
- **Clusters**: groups of upstream endpoints (like NGINX `upstream {}`)
- **Filters**: pluggable processing chain (rate limiting, auth, metrics, tracing)

### Service Mesh Pattern

In Istio, each pod has an Envoy sidecar injected automatically:

```
Client Pod
    → Envoy sidecar (outbound)
        → mTLS (mutual TLS between services)
        → Circuit breaker
        → Retry policy
        → Distributed tracing
        → Metrics
    → Envoy sidecar (inbound) of server pod
    → Server Pod application
```

The application doesn't need to implement retry, TLS, or tracing — Envoy handles it transparently.

### Traffic Management with Istio

```yaml
# VirtualService: routing rules
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: checkout
spec:
  hosts:
    - checkout
  http:
    - match:
        - headers:
            x-user-segment:
              exact: beta-users
      route:
        - destination:
            host: checkout
            subset: v2
          weight: 100
    - route:
        - destination:
            host: checkout
            subset: v1
          weight: 90
        - destination:
            host: checkout
            subset: v2
          weight: 10

---
# DestinationRule: upstream policies
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: checkout
spec:
  host: checkout
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutiveGatewayErrors: 5
      interval: 10s
      baseEjectionTime: 30s    # eject bad hosts for 30 seconds
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

---

## Debugging HTTP Issues

### Full Request Trace with curl

```bash
# Full timing breakdown
curl -w "@curl-format.txt" -o /dev/null -s https://api.example.com/health

# curl-format.txt:
# time_namelookup:  %{time_namelookup}s\n
# time_connect:     %{time_connect}s\n
# time_appconnect:  %{time_appconnect}s\n   (TLS)
# time_redirect:    %{time_redirect}s\n
# time_pretransfer: %{time_pretransfer}s\n
# time_starttransfer: %{time_starttransfer}s\n
# time_total:       %{time_total}s\n

# Check TLS certificate
curl -v --head https://api.example.com 2>&1 | grep -A 5 "SSL certificate"

# Test with specific headers
curl -H "Authorization: Bearer token123" \
     -H "Accept: application/json" \
     https://api.example.com/users/123

# Follow redirects, show all headers
curl -vL https://api.example.com/old-path

# Send POST with JSON body
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"name": "Alice", "email": "alice@example.com"}' \
     https://api.example.com/users
```

### Reading NGINX Access Logs

```bash
# Last 100 requests
tail -100 /var/log/nginx/access.log

# Only 5xx errors
grep '" 5' /var/log/nginx/access.log | tail -50

# Requests taking more than 1 second (if using json log format)
cat /var/log/nginx/access.log | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        r = json.loads(line)
        if float(r.get('request_time', 0)) > 1.0:
            print(r)
    except:
        pass
"

# Top 10 slowest requests
jq -r '.request_time + \" \" + .uri' /var/log/nginx/access.log | \
  sort -n -r | head -10

# Error rate by minute
grep '" 5' /var/log/nginx/access.log | \
  awk '{print $4}' | cut -c2-17 | sort | uniq -c
```

### Diagnosing 502s

502 Bad Gateway means NGINX got a bad response from the upstream:

```bash
# Check if upstream is healthy
curl http://backend-pod:8080/health

# Check NGINX error log for upstream errors
tail -50 /var/log/nginx/error.log
# Look for: "no live upstreams", "connect() failed", "recv() failed"

# Check if upstream pods are running
kubectl get pods -n production
kubectl describe pod <backend-pod>

# Check if backend is returning 4xx/5xx that NGINX is proxying as 502
# (Some proxy configs treat upstream errors as 502)
kubectl logs <backend-pod> | tail -50

# Check connection pool
# If you see "no live upstreams while connecting to upstream"
# Check fail_timeout and max_fails settings
```

### Diagnosing 504s

504 Gateway Timeout means the upstream didn't respond in time:

```bash
# Check proxy_read_timeout in NGINX config
grep -r proxy_read_timeout /etc/nginx/

# Check application response time
kubectl top pods -n production  # is backend pod CPU-saturated?

# Trace slow request in application logs
kubectl logs <backend-pod> | grep "request_id=<id>"

# Check database — is the slow response caused by a slow query?
# Look for database logs showing long-running queries
```

---

## Common Failure Modes

**Connection pool exhaustion:** Too many concurrent requests, not enough connections in the upstream pool. Symptom: 502s with "no live upstreams" in NGINX error log despite backends being healthy. Fix: increase `keepalive` in upstream block, increase backend application's max connections, or scale out backends.

**Timeout misconfiguration cascade:** NGINX `proxy_read_timeout` is 60s. Client timeout is 30s. The client gives up after 30s, but NGINX keeps the connection to the backend for another 30s. Fix: always set client timeout shorter than proxy timeout, which should be shorter than application timeout.

**X-Forwarded-For not set:** Application needs client IP but receives proxy IP. Fix: set `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`. Application must use the last IP in X-Forwarded-For (or X-Real-IP) to get the actual client IP.

**TLS certificate expiry:** Certificate expires → HTTPS fails → service is down. Fix: automate certificate renewal (cert-manager in Kubernetes, Let's Encrypt, ACM on AWS). Alert at 30, 14, and 7 days before expiry.

**Large request body rejected:** Default `client_max_body_size` in NGINX is 1MB. File upload returns 413. Fix: increase `client_max_body_size` for relevant locations.

---

## Key Questions and Answers

**Q: What is the difference between a 502 and a 503 and a 504?**

502 (Bad Gateway): the proxy received an invalid or empty response from the upstream. Usually means the upstream process crashed, is starting up, or is returning garbage. 503 (Service Unavailable): no healthy upstream is available (all backends failed health checks, or the upstream explicitly returned 503 for overload shedding). 504 (Gateway Timeout): the proxy waited too long for the upstream to respond. Usually means the upstream is alive but slow — database query running long, external API latency, CPU saturation.

**Q: How does NGINX choose which upstream to route to?**

By default, round-robin: each new request goes to the next backend in sequence. Alternative load balancing methods: `least_conn` (send to backend with fewest active connections — better for variable-length requests), `ip_hash` (same client IP always goes to same backend — session stickiness), `random two` (pick 2 backends randomly, choose the one with fewer connections). For long-lived connections (WebSockets, gRPC), `least_conn` or `ip_hash` is preferred over round-robin.

**Q: How do you debug a slow HTTP endpoint?**

Walk the request path: (1) DNS lookup time (resolve manually with `dig`); (2) TCP + TLS time (`curl -w` timing); (3) NGINX processing time (check `$upstream_response_time` vs `$request_time` in logs — difference is NGINX overhead); (4) Backend processing time (application logs, traces); (5) Database query time (slow query logs, application traces). The difference between total request time and upstream response time tells you if NGINX is the bottleneck. The difference between upstream response time and database query time tells you if application code is the bottleneck.

**Q: How does rate limiting work in NGINX and when would you use it?**

NGINX rate limiting uses a leaky bucket algorithm. The `limit_req_zone` defines a shared memory zone keyed by some identifier (usually client IP or auth token), with a maximum fill rate. `limit_req` enforces the limit with an optional burst allowance. Without `burst`, any excess request gets 429 immediately. With `burst=20`, up to 20 extra requests can be queued. Use rate limiting to protect against: API abuse, DDoS amplification, upstream overload from a single client. Rate limiting by auth token (per-user) is fairer than by IP (doesn't penalize users behind NAT).

---

## Points to Remember

- HTTP request path: DNS → TCP → TLS → load balancer → proxy → application
- 502: bad response from upstream; 503: no upstream available; 504: upstream timed out
- TLS 1.3 is 1-RTT; always pin TLS minimum version to 1.2
- REST: resources as nouns, HTTP verbs carry semantic meaning (GET=safe+idempotent, POST=not idempotent)
- Idempotency keys prevent duplicate POST operations on client retry
- NGINX: `upstream {}` for backends, `location {}` for routing, `proxy_pass` to forward
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` to pass client IP
- `keepalive` in upstream block enables persistent connections (reduces TCP overhead)
- Rate limiting: `limit_req_zone` defines the zone, `limit_req` enforces it, 429 on exceed
- Envoy + service mesh: sidecar proxy provides mTLS, retry, circuit breaking transparently
- TLS cert expiry monitoring: alert at 30, 14, 7 days before expiry

## What to Study Next

- [Networking Fundamentals](./networking-fundamentals) — TCP/IP layer below HTTP
- [Cloud Networking and Kubernetes Networking](./cloud-networking-and-kubernetes-networking) — how HTTP flows through cloud and K8s
- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — measuring HTTP latency and errors
