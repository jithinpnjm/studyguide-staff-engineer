---
title: "CloudFront And Global Accelerator"
sidebar_position: 13
---

# CloudFront And Global Accelerator

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

CloudFront exists to put cached content and HTTP edge logic closer to users. It reduces latency, lowers origin load, and integrates with TLS, WAF, signed URLs/cookies, origin access control, and cache policies. The origin can be S3, ALB, API Gateway, or a custom HTTP service.

The key teaching concept is cache correctness. CloudFront improves speed only when caching behavior matches content behavior. Static assets should use long TTLs and versioned filenames. Dynamic APIs usually need careful cache keys, headers, cookies, and query string behavior. Invalidation exists, but frequent invalidation is often a sign that asset versioning is weak.

Global Accelerator exists for a different problem: stable anycast IPs and optimized routing over the AWS global network to healthy regional endpoints. It does not replace CloudFront caching. Use CloudFront for HTTP caching and edge content. Use Global Accelerator for static IPs, fast regional routing, and non-cacheable TCP/UDP style needs.

Failure modes:

- stale cache after deploy
- cache key missing header/cookie/query dimension
- origin overloaded after cache miss storm
- WAF blocks legitimate traffic
- S3 origin exposed directly instead of through controlled access

AWS docs:

- CloudFront invalidation: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html

---

## CloudFront Key Concepts

| Concept | Meaning | Operational Impact |
|---|---|---|
| Origin | Source of truth: S3, ALB, API GW, custom HTTP | CloudFront forwards cache misses to origin |
| Distribution | CloudFront deployment with origins, behaviors, and settings | One distribution can have multiple origins |
| Cache behavior | Rules per URL pattern: cache policy, TTL, origin | Match static assets differently from API paths |
| Cache policy | What dimensions go into the cache key | Wrong cache key = stale data served to wrong users |
| TTL | How long a cached response is valid | Long TTL for static files; short/no TTL for dynamic APIs |
| Invalidation | Remove cached object before TTL expires | Costs money; prefer versioned asset names instead |
| Origin Access Control (OAC) | Restricts S3 access to CloudFront only | Prevents users from bypassing CloudFront to hit S3 directly |
| Signed URLs / Signed Cookies | Time-limited or access-controlled content | For premium content, downloads, or private assets |
| Edge Functions | Lambda@Edge or CloudFront Functions | Request/response manipulation at edge (auth, redirects, A/B) |

## Cache Key Design

```text
Too broad (same cache for all users):
  Cache key: URL only
  Problem: user A sees user B's personalized content

Too narrow (cache never hits):
  Cache key: URL + all headers + all cookies + all query strings
  Problem: every request is unique; origin gets hammered

Correct approach:
  Static assets: URL only (version in filename: app.v2.js)
  API responses: URL + Accept-Language + specific query strings only
  Authenticated content: avoid caching or use signed URLs
```

## CloudFront vs Global Accelerator: Decision

| Criteria | CloudFront | Global Accelerator |
|---|---|---|
| Protocol | HTTP/HTTPS only | Any TCP/UDP |
| Content caching | Yes (core feature) | No |
| Static IP addresses | No (DNS-based) | Yes (anycast IPs) |
| Best for | Static assets, APIs, CDN, WAF integration | Static IPs for firewall allowlisting, non-HTTP, gaming, IoT, fast regional failover |
| Routing logic | Cache hit/miss + edge rules | Routes to healthiest endpoint over AWS global network |
| DDoS protection | Shield Standard + WAF integration | Shield Standard (Shield Advanced available) |

## S3 + CloudFront: Secure Pattern

```text
S3 bucket:
  - Block Public Access: ON
  - Bucket policy: allow CloudFront OAC only
  - No direct public access

CloudFront distribution:
  - Origin: S3 with OAC
  - Cache behavior: long TTL for assets
  - WAF: attached for bot control and rate limiting
  - HTTPS only: redirect HTTP to HTTPS
```

**Never expose S3 bucket directly for a CloudFront-fronted static site.** Use OAC to ensure all traffic goes through CloudFront (for caching, WAF, signed URLs, and cost control).

## CLI: Common CloudFront Operations

```bash
# List distributions
aws cloudfront list-distributions \
  --query "DistributionList.Items[*].{ID:Id,Domain:DomainName,Status:Status}"

# Invalidate a path (remove from cache)
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/index.html" "/assets/*"

# Get distribution config (inspect origins and behaviors)
aws cloudfront get-distribution-config \
  --id E1234567890ABC

# Check cache hit ratio (CloudWatch metric)
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=E1234567890ABC Name=Region,Value=Global \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Average
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Stale content after deploy | Cache TTL not expired; no invalidation | Invalidate on deploy or use versioned asset filenames (preferred) |
| Cache miss storm after TTL expiry | All CDN caches expire at same time; origin overwhelmed | Use origin shield; randomize TTL with jitter; ensure origin can handle burst |
| Users see wrong content (personalization) | Cache key includes user-specific headers/cookies | Use separate cache behavior for personalized paths; do not cache personalized responses |
| Direct S3 URL accessible bypassing CloudFront | No OAC; bucket policy allows public | Enable OAC; restrict bucket policy to CloudFront principal only |
| WAF blocking legitimate traffic | Rule too broad (e.g., AWS Managed Rule false positive) | Add exception rule; test in Count mode before Block |
| CloudFront 502/504 from origin | Origin ALB or Lambda is overloaded or misconfigured | Check origin health; ensure CloudFront can reach origin on origin port |

## Interview Q&A

**Q: What is the difference between CloudFront and Global Accelerator?**
A: CloudFront is an HTTP/HTTPS CDN that caches content at edge locations and runs edge functions. It is the right choice for websites, APIs, and any HTTP workload with cacheable responses. Global Accelerator provides static anycast IP addresses that route traffic over the AWS global backbone to the healthiest regional endpoint. It supports any TCP/UDP protocol and is used when static IPs are required (firewall allowlisting) or for non-HTTP workloads.

**Q: How would you prevent stale cached content after a frontend deploy?**
A: Two approaches: 1) Use versioned asset filenames — `app.abc1234.js` instead of `app.js`. The new filename is never cached, so users automatically get the new version. This is best practice. 2) Run a CloudFront invalidation on the paths that changed (`/index.html`, `/assets/*`). Invalidation costs money and is eventually consistent, so it should not be your only mechanism.

**Q: How do you restrict an S3 bucket so it is only accessible through CloudFront?**
A: Use Origin Access Control (OAC). Create an OAC in CloudFront and configure the distribution to use it as the origin access identity. Then update the S3 bucket policy to allow `s3:GetObject` only from the CloudFront service principal with the OAC ARN. Enable Block Public Access on the bucket to prevent direct access.
