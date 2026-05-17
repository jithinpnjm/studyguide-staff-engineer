---
title: "EC2 Placement Groups And Hibernate"
sidebar_position: 6
---

# EC2 Placement Groups And Hibernate

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Placement groups exist because physical placement affects latency and failure domains. Cluster placement groups pack instances close together for low-latency, high-throughput workloads such as HPC. Spread placement groups separate instances across distinct hardware for failure isolation. Partition placement groups divide instances into logical partitions so large distributed systems like Kafka, Cassandra, or HDFS can avoid correlated hardware failure.

Hibernate preserves instance memory to EBS and resumes later. It is useful for long warmup workloads but not a generic HA mechanism. If the workload must survive infrastructure failure, design stateless replacement or application-level checkpointing.
