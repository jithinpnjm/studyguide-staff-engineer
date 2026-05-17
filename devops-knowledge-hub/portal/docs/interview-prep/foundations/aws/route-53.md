---
title: "Route 53"
sidebar_position: 10
---

# Route 53

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Route 53 exists because DNS is the first dependency in most user journeys. It maps human names to infrastructure endpoints and can apply routing logic. The PDF covers records, hosted zones, TTL, CNAME vs Alias, routing policies, health checks, resolvers, and hybrid DNS.

The operational lesson is that DNS is cached and indirect. A low TTL can help changes propagate faster, but recursive resolvers and client behavior still matter. DNS failover is useful, but it is not instantaneous and should not be confused with load balancer health checking.

Routing policies should be explained by intent:

- Simple: one normal answer.
- Weighted: controlled traffic split or canary.
- Latency: send users to lower-latency Region.
- Failover: active-passive DR.
- Geolocation/geoproximity: location-aware routing.
- Multivalue: return multiple healthy records.
- IP-based: route based on source CIDR.

Failure modes:

- wrong hosted zone updated
- CNAME used at zone apex where Alias is needed
- TTL delays recovery
- health check checks the wrong thing
- private hosted zone associated with wrong VPC
- hybrid DNS resolver rules missing

AWS docs:

- Route 53 routing policies: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html
