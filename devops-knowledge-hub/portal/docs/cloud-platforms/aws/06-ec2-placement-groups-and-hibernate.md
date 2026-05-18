---
title: "EC2 Placement Groups And Hibernate"
sidebar_position: 6
---

# EC2 Placement Groups And Hibernate

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Placement groups exist because physical placement affects latency and failure domains. Cluster placement groups pack instances close together for low-latency, high-throughput workloads such as HPC. Spread placement groups separate instances across distinct hardware for failure isolation. Partition placement groups divide instances into logical partitions so large distributed systems like Kafka, Cassandra, or HDFS can avoid correlated hardware failure.

Hibernate preserves instance memory to EBS and resumes later. It is useful for long warmup workloads but not a generic HA mechanism. If the workload must survive infrastructure failure, design stateless replacement or application-level checkpointing.

---

## Placement Group Types

| Type | Purpose | Workload Examples | Risk |
|---|---|---|---|
| Cluster | Pack instances onto same hardware/AZ for low-latency high-bandwidth networking | HPC, MPI, distributed training, Spark clusters | All instances in one AZ; correlated hardware failure risk |
| Spread | Place each instance on distinct hardware | Critical instances that must not fail together (Zookeeper, etcd nodes) | Max 7 instances per AZ per group |
| Partition | Divide into partitions; each partition on distinct hardware rack | Kafka, Cassandra, HDFS, large distributed systems | Up to 7 partitions per AZ; instances aware of their partition |

## Cluster vs Spread vs Partition: Decision Rule

```text
Need fastest network between instances (same workload)?    -> Cluster placement group
Need to protect independent instances from common failure? -> Spread placement group
Need rack-level isolation for a large distributed system?  -> Partition placement group
No special requirements?                                   -> No placement group (default)
```

**Cluster placement group constraints:**
- All instances typically in the same AZ
- Best for Enhanced Networking (ENA) instances
- If you add instances later, AWS may not find space on nearby hardware → `InsufficientCapacity` error

## EC2 Hibernate

Hibernate saves RAM contents to the EBS root volume and stops the instance. On restart, memory is restored and the instance continues from where it left off (processes remain, but open network connections may be dropped).

Requirements:
- Instance must have an encrypted EBS root volume
- Instance memory must fit within the EBS volume
- Supported instance families (not all families support it)
- Maximum hibernate duration: 60 days

**When to use hibernate:**
- Long-warmup services (e.g., JVM with 10+ minute startup)
- Development instances that need quick resume
- Preserving in-memory computation state cheaply

**Do not use hibernate for:**
- Production HA — hibernation is for individual instance pausing, not failure recovery
- Replacing proper autoscaling or stateless design

## CLI: Placement Group Operations

```bash
# Create a cluster placement group
aws ec2 create-placement-group \
  --group-name my-hpc-cluster \
  --strategy cluster

# Create a spread placement group
aws ec2 create-placement-group \
  --group-name my-spread-group \
  --strategy spread

# Create a partition placement group
aws ec2 create-placement-group \
  --group-name my-partition-group \
  --strategy partition \
  --partition-count 3

# Launch an instance in a placement group
aws ec2 run-instances \
  --placement "GroupName=my-hpc-cluster" \
  --instance-type c6i.4xlarge \
  --image-id ami-0abcdef1234567890 \
  --count 4

# Hibernate an instance
aws ec2 stop-instances \
  --instance-ids i-0abcdef1234567890 \
  --hibernate
```

## Interview Q&A

**Q: What is a cluster placement group and when should you use it?**
A: A cluster placement group packs instances onto hardware that is physically close together in the same AZ to achieve the lowest network latency and highest network throughput between instances. Use it for HPC workloads, MPI jobs, and large distributed ML training where instance-to-instance bandwidth is critical. The tradeoff is that all instances are in one AZ with correlated failure risk.

**Q: What is the difference between a spread and partition placement group?**
A: Spread places each individual instance on distinct hardware, guaranteeing that no two instances share a physical host (max 7 per AZ). It is for a small number of critical instances that must not fail together. Partition divides a larger fleet into logical groups (partitions) where each partition runs on distinct hardware racks. It is for large distributed systems like Kafka or Cassandra that are internally replication-aware and need rack-level failure isolation across many instances.
