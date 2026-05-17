---
title: "Data And Analytics"
sidebar_position: 19
---

# Data And Analytics

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Athena queries S3 directly and is excellent for ad hoc analysis over logs/data lakes. Redshift is a data warehouse for structured analytics. OpenSearch supports search and log analytics. EMR runs big data frameworks such as Spark. Glue provides ETL and cataloging. Lake Formation centralizes data lake governance. MSK provides managed Kafka. Kinesis provides AWS-native streaming.

Operational teaching point: analytics systems can quietly become production dependencies. If fraud detection, dashboards, search, or alert enrichment depends on these pipelines, then ingestion lag, schema drift, partition mistakes, and retention failures become reliability incidents.
