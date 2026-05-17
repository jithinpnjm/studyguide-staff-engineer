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
