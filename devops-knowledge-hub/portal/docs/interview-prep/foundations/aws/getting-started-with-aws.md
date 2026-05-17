---
title: "Getting Started With AWS"
sidebar_position: 1
---

# Getting Started With AWS

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The slide deck starts by introducing AWS as a cloud provider, but for interview learning that definition is too shallow. AWS is an API-driven infrastructure platform. Instead of filing tickets for servers, networks, firewalls, storage, load balancers, and databases, you declare or call APIs to create them. That changes the operational model: infrastructure becomes fast, repeatable, observable, and dangerous. A wrong IAM policy, route table, or autoscaling rule can affect production in seconds.

The first principle is scope. Some AWS services are global, some are regional, and some are zonal. IAM feels global. S3 bucket names are global, but buckets live in a selected Region. VPCs are regional. Subnets are zonal. EC2 instances and EBS volumes are zonal. Route 53 and CloudFront sit closer to the global edge. When a production system fails, scope tells you where to look. A single-AZ issue should not bring down a multi-AZ app. A regional control plane issue should not destroy already-running data plane traffic if the architecture is resilient. A global identity or DNS mistake can have a much wider blast radius.

Interview framing:

```text
AWS is not just rented servers. It is programmable infrastructure with explicit
identity, network, failure, and geographic boundaries. I design by deciding which
boundary should absorb each failure.
```
