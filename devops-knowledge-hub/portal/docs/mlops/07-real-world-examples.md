---
title: "Real-World Examples"
sidebar_position: 7
---

# MLOps — Real-World Examples

## Scenario 1: Model Accuracy Degradation in Production

**Situation**: A churn prediction model that was performing at 89% accuracy three months ago has dropped to 74% according to the latest labeled dataset batch. Customers are complaining that the product recommendations feel "off." No infrastructure changes have been made.

**Investigation**:

The model receives weekly batches of labeled ground truth (whether the user actually churned). The accuracy metric is computed by the monitoring pipeline and written to Prometheus. An alert fired when the 7-day rolling accuracy fell below 80%.

Step 1 — Rule out infrastructure issues. Check that the serving pod is loading the same model version it was loading last month. Query the model version Prometheus metric and confirm it hasn't changed.

Step 2 — Check for feature drift. Run the drift report against production data from the past 30 days vs the training dataset:

```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=training_df, current_data=recent_production_df)
result = report.as_dict()

drifted_features = [
    col for col, data in result["metrics"][0]["result"]["drift_by_columns"].items()
    if data["drift_detected"]
]
print(f"Drifted features: {drifted_features}")
```

The drift report reveals that `tenure_months` (how long the user has been a customer) and `product_tier` have significant distribution shifts. After investigation: the company ran a promotion that onboarded a large cohort of new users with short tenure and primarily on the entry-level tier — a demographic the model was not trained on.

Step 3 — Decide: retrain or adjust. Because the new cohort is a sustained business shift (not a temporary blip), retraining on recent data is the right fix.

**Resolution**:

1. Trigger the training pipeline with a new data window that includes the new user cohort
2. Evaluate the new model against a held-out test set from recent data
3. Check that the new model performs well on both old and new user segments (avoid catastrophic forgetting)
4. Promote through Staging → Production via the standard model registry workflow
5. Monitor accuracy on the next labeled data batch

**Lessons**: Ground truth feedback loops are essential. Without the weekly labeled batch, this degradation might have been invisible for months. Model monitoring requires both input (drift) and output (accuracy) tracking.

---

## Scenario 2: Data Drift Detection and Automated Alerting

**Situation**: You need to build automated data drift detection for a fraud detection model. Ground truth labels arrive with a 48-hour delay, but you need to detect problems before they compound.

**Architecture**:

```
Production → Request logs → Stream (Kafka)
                                  |
                          Drift Pipeline (runs every hour)
                                  |
                     Compare to training distribution
                                  |
                     Drift score → Prometheus Gauge
                                  |
                     Alert if PSI > 0.2 for any feature
```

**Implementation**:

```python
# drift_monitor.py — runs as a scheduled job
import mlflow
import pandas as pd
import numpy as np
from prometheus_client import Gauge, push_to_gateway
from scipy.stats import ks_2samp

# Feature drift score gauge
DRIFT_SCORE = Gauge("ml_feature_drift_psi", "PSI drift score", ["feature_name"])

def compute_psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    """Population Stability Index. < 0.1 stable, 0.1-0.2 caution, > 0.2 drift."""
    breakpoints = np.linspace(0, 100, bins + 1)
    expected_pct = np.histogram(expected, bins=np.percentile(expected, breakpoints))[0]
    actual_pct = np.histogram(actual, bins=np.percentile(expected, breakpoints))[0]
    expected_pct = (expected_pct + 1e-4) / len(expected)
    actual_pct = (actual_pct + 1e-4) / len(actual)
    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(psi)

def run_drift_check():
    # Load training distribution (saved as artifact at training time)
    training_stats = mlflow.load_dict("models:/FraudDetector/Production", "training_stats.json")

    # Load recent production requests (from your logging system)
    recent_df = pd.read_parquet("s3://logs/fraud-model/last-24h.parquet")

    drifted = []
    for feature in training_stats["features"]:
        psi = compute_psi(
            pd.Series(training_stats[feature]["values"]),
            recent_df[feature].dropna(),
        )
        DRIFT_SCORE.labels(feature_name=feature).set(psi)
        if psi > 0.2:
            drifted.append((feature, psi))

    if drifted:
        alert = f"DRIFT ALERT: {len(drifted)} features drifted: {drifted}"
        # Post to Slack, PagerDuty, etc.
        print(alert)

if __name__ == "__main__":
    run_drift_check()
    push_to_gateway("prometheus-pushgateway:9091", job="drift_monitor")
```

**Alerting rule in Prometheus**:

```yaml
groups:
  - name: ml-drift
    rules:
      - alert: FeatureDriftDetected
        expr: ml_feature_drift_psi > 0.2
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Data drift detected for feature {{ $labels.feature_name }}"
          description: "PSI score {{ $value }} exceeds 0.2 threshold"
```

---

## Scenario 3: GPU OOM During Training

**Situation**: A PyTorch training job that was running fine last week is now crashing with `torch.cuda.OutOfMemoryError` after 2 hours. The job failed at epoch 47/100.

**Investigation**:

```bash
# Check GPU memory when the job runs
kubectl exec -it training-pod -- nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv,noheader

# Check recent GPU events
kubectl exec -it training-pod -- nvidia-smi --query-accounted-apps=name,used_memory --format=csv

# Check if there are other pods on the same GPU node
kubectl describe node gpu-node-01 | grep -A5 "Allocated resources"
```

The investigation reveals: the dataset was updated with longer text sequences (max_length increased from 512 to 768 tokens). The KV cache size scales quadratically with sequence length. At epoch 47, the memory that was sufficient for 512-token sequences is no longer sufficient for 768-token sequences when the batch size is 32.

**Resolution**:

```python
# In train.py — add gradient checkpointing and reduce batch size
import torch

# Option 1: Gradient checkpointing — trade compute for memory
model.gradient_checkpointing_enable()

# Option 2: Reduce batch size and use gradient accumulation
# Instead of: batch_size=32, 1 optimizer step per batch
# Use: batch_size=8, accumulate_grad_batches=4 (equivalent effective batch size)

# Option 3: Mixed precision training
from torch.cuda.amp import autocast, GradScaler
scaler = GradScaler()

for batch in dataloader:
    optimizer.zero_grad()
    with autocast():                          # fp16 where safe
        loss = model(batch)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

Also: add checkpointing so long training jobs can resume from where they failed:

```python
if epoch % 10 == 0:
    torch.save({
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "loss": loss,
    }, f"checkpoint_epoch_{epoch}.pt")
    mlflow.log_artifact(f"checkpoint_epoch_{epoch}.pt", "checkpoints")
```

**Lessons**: Dataset changes can silently break memory budgets. Add GPU memory monitoring alerts. Always implement checkpointing for long-running training jobs.

---

## Scenario 4: Model Registry Promotion Workflow in a Team

**Situation**: A team of five ML engineers needs a repeatable, auditable process for promoting models from experimentation to production. They've had two incidents where incorrect model versions reached production.

**Solution**: Implement a promotion workflow enforced by CI/CD.

```python
# promote_model.py — called by CI/CD after tests pass
import mlflow
from mlflow.tracking import MlflowClient
import argparse
import os

def promote(model_name: str, version: int, to_stage: str, promoted_by: str):
    client = MlflowClient()

    # Verify model passed evaluation (tag set by test pipeline)
    version_details = client.get_model_version(model_name, version)
    tags = version_details.tags

    required_tag = "integration_tests_passed"
    if tags.get(required_tag) != "true":
        raise RuntimeError(f"Cannot promote: {required_tag} tag not set to 'true'. Run tests first.")

    # Record who promoted and when
    client.set_model_version_tag(model_name, version, "promoted_to", to_stage)
    client.set_model_version_tag(model_name, version, "promoted_by", promoted_by)
    client.set_model_version_tag(model_name, version, "promoted_at", str(pd.Timestamp.now()))

    # Perform promotion
    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage=to_stage,
        archive_existing_versions=(to_stage == "Production"),
    )
    print(f"SUCCESS: {model_name} v{version} promoted to {to_stage} by {promoted_by}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--version", type=int, required=True)
    parser.add_argument("--to-stage", required=True, choices=["Staging", "Production", "Archived"])
    args = parser.parse_args()

    promote(
        model_name=args.model_name,
        version=args.version,
        to_stage=args.to_stage,
        promoted_by=os.environ["CI_USER"],  # injected by CI/CD
    )
```

The pipeline enforces: tests must pass before promotion, promotion is recorded with who and when, CI/CD runs promotion not humans (reducing manual error).

---

## Scenario 5: Rolling Back a Bad Model

**Situation**: A new fraud detection model version was promoted to production at 2:00 PM. By 3:30 PM, the false positive rate has tripled — legitimate transactions are being declined at 15% vs the normal 5%. On-call is paged.

**Immediate response** (within 5 minutes):

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()
MODEL_NAME = "FraudDetector"

# Find the previous Production version (now Archived)
all_versions = client.get_registered_model(MODEL_NAME).latest_versions
archived = [v for v in all_versions if v.current_stage == "Archived"]
previous_version = max(archived, key=lambda v: int(v.version))

# Promote previous version back to Production immediately
client.transition_model_version_stage(
    name=MODEL_NAME,
    version=previous_version.version,
    stage="Production",
    archive_existing_versions=True,   # this archives the bad version
)

print(f"Rolled back to v{previous_version.version}")
```

If serving code polls the model registry, this takes effect within the polling interval (typically 30–60 seconds) without any pod restart.

**Post-incident investigation**:

1. Compare training data distributions between the bad version and the previous stable version
2. Check if evaluation metrics in the registry were computed on the same test set
3. Review: did the test set represent the actual production request distribution?
4. Check: was the false positive rate metric tracked in the model registry evaluation?

**Lessons**: Track business-level metrics (false positive rate, not just accuracy) in the model evaluation gate. Keep the previous production version easily accessible (never delete Archived versions immediately). Verify rollback procedure is tested before you need it.

---

## Scenario 6: Inference Latency Spike

**Situation**: The p99 inference latency for the recommendation model jumped from 45ms to 380ms starting at 11:20 AM. No model changes were made. Traffic volume is normal.

**Investigation using Prometheus**:

```promql
# Check latency percentiles over time
histogram_quantile(0.99, rate(model_prediction_latency_seconds_bucket[5m]))

# Check if it's all requests or just some
histogram_quantile(0.99, rate(model_prediction_latency_seconds_bucket{endpoint="/predict"}[5m]))

# Check request rate
rate(model_predictions_total[5m])

# Check GPU utilization
nvidia_gpu_duty_cycle
```

The Prometheus data shows: p99 jumped, but p50 is unchanged. This indicates a bimodal distribution — some requests are fast (30ms), some are slow (380ms). The slow requests are not GPU-bound (GPU utilization is low). The pattern correlates with requests that hit a specific feature — `user_embedding`.

Root cause: the feature store Redis cache for `user_embedding` started evicting entries due to memory pressure (a separate team increased their Redis usage on the shared cluster). Cache miss requires a database query that takes ~350ms.

**Resolution**:

1. Immediate: increase Redis memory allocation for the feature store namespace
2. Short-term: add circuit breaker — if feature store lookup exceeds 100ms, use a default embedding or skip the feature
3. Long-term: separate Redis instance for feature store to prevent noisy neighbor

```python
async def get_user_embedding(user_id: str, timeout: float = 0.1) -> np.ndarray:
    try:
        async with asyncio.timeout(timeout):
            return await redis.get(f"embedding:{user_id}")
    except (asyncio.TimeoutError, Exception):
        # Fall back to cached default — degraded but functional
        CACHE_MISS_COUNTER.inc()
        return DEFAULT_EMBEDDING
```

---

## Scenario 7: Feature Store Cache Miss Storm

**Situation**: After a Redis failover at 6:00 AM, the feature store cache is empty. As traffic ramps up in the morning, every request misses cache and hits the online feature computation service. The computation service becomes the bottleneck and starts returning 500s, causing prediction failures.

**Architecture issue**:

```
Request → Model API → Feature Store SDK → Redis (empty after failover)
                                                  → Fallback: Online Compute (overloaded)
                                                  → 500 errors
                                                  → Prediction fails
```

**Mitigation strategies**:

1. **Cache warming on startup**: after failover, trigger a background job to pre-populate the cache with the most-accessed keys before serving live traffic.

2. **Stale cache serving**: configure Redis to serve stale values rather than erroring when the authoritative source is unavailable (Redis `WAIT` with fallback).

3. **Tiered caching**: L1 in-process cache (e.g., LRU dict in the serving pod) for the hottest features. L2 Redis. L3 online compute. L1 cache survives Redis failover for hot keys.

4. **Graceful degradation**: if the feature store is unavailable, serve predictions without optional features rather than failing the request entirely.

```python
class FeatureStoreClient:
    def __init__(self, redis_client, compute_client):
        self._redis = redis_client
        self._compute = compute_client
        self._local_cache = {}  # L1: in-process

    async def get_features(self, entity_id: str) -> dict:
        # L1: in-process cache
        if entity_id in self._local_cache:
            return self._local_cache[entity_id]

        # L2: Redis
        try:
            cached = await self._redis.get(entity_id)
            if cached:
                features = json.loads(cached)
                self._local_cache[entity_id] = features
                return features
        except Exception:
            pass

        # L3: Online compute (fallback — expensive)
        try:
            features = await self._compute.compute(entity_id)
            await self._redis.set(entity_id, json.dumps(features), ex=3600)
            return features
        except Exception:
            # Graceful degradation: return defaults
            return DEFAULT_FEATURES
```

---

## Scenario 8: A/B Test Setup for Model Comparison

**Situation**: The data science team has a new recommendation model they believe will improve click-through rate (CTR) by 15%. You need to run a statistically rigorous A/B test before full rollout.

**Traffic split design**:

```
10% of users → Model B (challenger)
90% of users → Model A (control)
```

User assignment must be deterministic (same user always gets same model) to avoid confounding. Use a hash of the user ID:

```python
import hashlib

def get_model_variant(user_id: str, experiment_id: str, split: float = 0.10) -> str:
    """Deterministic, consistent assignment based on user_id."""
    key = f"{user_id}:{experiment_id}"
    hash_val = int(hashlib.md5(key.encode()).hexdigest(), 16)
    normalized = (hash_val % 10000) / 10000.0  # 0.0 to 1.0
    return "B" if normalized < split else "A"

@app.post("/recommend")
async def recommend(request: RecommendRequest):
    variant = get_model_variant(request.user_id, experiment_id="exp-2024-Q1")
    model = model_b if variant == "B" else model_a

    predictions = model.predict(features)

    # Log event for analysis
    await analytics.log({
        "user_id": request.user_id,
        "variant": variant,
        "predictions": predictions.tolist(),
        "timestamp": time.time(),
    })

    return {"recommendations": predictions.tolist(), "variant": variant}
```

**Statistical analysis** (after collecting data):

```python
import scipy.stats as stats

# Collect CTR for each variant from analytics data
ctr_a = df[df["variant"] == "A"]["clicked"].mean()
ctr_b = df[df["variant"] == "B"]["clicked"].mean()
n_a = len(df[df["variant"] == "A"])
n_b = len(df[df["variant"] == "B"])

# Two-proportion z-test
z_stat, p_value = stats.proportions_ztest(
    [df[df["variant"] == "B"]["clicked"].sum(), df[df["variant"] == "A"]["clicked"].sum()],
    [n_b, n_a],
)

print(f"CTR A: {ctr_a:.4f}, CTR B: {ctr_b:.4f}")
print(f"Lift: {(ctr_b - ctr_a) / ctr_a * 100:.1f}%")
print(f"p-value: {p_value:.4f}")

if p_value < 0.05:
    print("Result is statistically significant — safe to promote Model B")
else:
    print("Result is NOT statistically significant — need more data or no difference")
```

**Guardrail metrics**: always monitor both the primary metric (CTR) and guardrail metrics (session length, revenue per session, error rate) during the A/B test. A model that improves CTR but reduces purchase rate should not be promoted.
