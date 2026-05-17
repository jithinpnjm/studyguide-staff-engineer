---
title: "Troubleshooting"
sidebar_position: 8
---

# Kubernetes & Containers — Troubleshooting

A field guide. Each scenario follows the same pattern: how it shows up, where to look first, the fix, and how to prevent it next time.

---

## Quick-Reference: Common Errors

| Error | Likely Cause | First Step |
|-------|--------------|-----------|
| `CrashLoopBackOff` | App crashes on start | `kubectl logs <pod> --previous` |
| `ImagePullBackOff` / `ErrImagePull` | Bad image name, registry auth, or rate limit | `kubectl describe pod` → Events |
| `Pending` | No node can schedule the Pod | `kubectl describe pod` → Events |
| `OOMKilled` (exit `137`) | Container exceeded its memory limit | Raise limit or fix the leak |
| `Evicted` | Node memory/disk pressure | `kubectl top nodes`, check node conditions |
| `Node NotReady` | kubelet / network / disk problem | `kubectl describe node`, then kubelet logs |
| Service has no endpoints | Selector mismatch or Pods not Ready | `kubectl get endpoints <svc>` |
| DNS resolution fails | CoreDNS overloaded or ndots blow-up | Check CoreDNS Pods + `dnsConfig.options` |
| RBAC `forbidden` | Missing Role/RoleBinding | `kubectl auth can-i ... --as=<sa>` |
| PVC `Pending` | StorageClass missing, zone mismatch, RWX unsupported | `kubectl describe pvc` |
| Ingress 404 | No matching rule or wrong service | `kubectl describe ingress` |
| Ingress 502 | Backend not Ready / readinessProbe failing | Check Pod logs + endpoints |
| HPA `unable to fetch metrics` | metrics-server not installed/healthy | `kubectl get deploy -n kube-system metrics-server` |
| `context deadline exceeded` | API server unreachable or under load | Check control plane health |

---

## Container Exit Codes

| Exit | Meaning | Action |
|------|---------|--------|
| `0`   | Clean exit | — |
| `1`   | Application error | Read app logs |
| `137` | OOMKilled (128 + SIGKILL) | Raise `memory.limits` or fix the leak |
| `139` | Segfault (128 + SIGSEGV) | Native crash — bad binary / library / arch mismatch |
| `143` | SIGTERM not finished within graceperiod | Increase `terminationGracePeriodSeconds`, handle SIGTERM |
| `255` | Container failed to start | `kubectl describe pod` — wrong command, missing file, immutable filesystem |

---

## Scenario 1: Pod in `CrashLoopBackOff`

**What it means:** The container started, exited, was restarted by kubelet, exited again — back-off keeps growing (10s, 20s, 40s, capped at 5m).

**Investigate:**

```bash
kubectl get pods
kubectl logs <pod-name>                  # logs from current container (often empty if it died fast)
kubectl logs <pod-name> --previous       # logs from the LAST exited container — this is the gold
kubectl describe pod <pod-name>          # Events tell you why
kubectl get pod <pod-name> -o yaml | yq '.status.containerStatuses[].lastState'
```

**Diagnose by exit code:**
- `137` → OOMKilled. Raise memory limit or profile for leaks. Check `containerStatuses[].lastState.terminated.reason`.
- `1`  → Application crash. Read the logs — bad config, missing env var, can't reach a dependency.
- `139` → Segfault. Wrong CPU arch (`amd64` image on `arm64`), corrupt binary, library mismatch.
- `0` repeatedly → App exits cleanly but immediately. Missing daemon mode flag, `CMD` runs once and finishes.

**Hold a crashing Pod for inspection** — replace its command with a sleep so you can `kubectl exec` in:

```yaml
spec:
  containers:
  - name: app
    image: my-app:1.0
    command: ["sleep", "3600"]
```

---

## Scenario 2: Pod Stuck in `Pending`

**What it means:** The API accepted the Pod, but no node can run it.

**Investigate:**

```bash
kubectl describe pod <pod-name>           # Events section is everything
kubectl get nodes -o wide
kubectl describe node                     # check allocatable resources
kubectl get nodes --show-labels           # check labels vs nodeSelector/affinity
```

**Common causes and fixes:**

| Cause | Symptom in events | Fix |
|-------|-------------------|-----|
| No node has enough CPU/memory | `0/N nodes are available: Insufficient cpu` | Lower requests or add capacity (autoscaler) |
| Node taint without toleration | `0/N nodes are available: 3 node(s) had untolerated taint` | Add toleration or remove taint |
| `nodeSelector` matches no node | `didn't match Pod's node affinity/selector` | Fix selector or label the right nodes |
| PVC not bound | `pod has unbound immediate PersistentVolumeClaims` | Inspect PVC, fix StorageClass |
| ImagePullSecret missing | `pull access denied` later as ImagePullBackOff | Create / reference the secret |

---

## Scenario 3: `ImagePullBackOff` / `ErrImagePull`

```bash
kubectl describe pod <name>          # exact registry error appears here
kubectl get events --sort-by=.lastTimestamp | grep pull
```

**Common patterns:**
- **Typo** in image name or tag — most common.
- **Private registry, no `imagePullSecrets`** — create a `docker-registry` secret and reference it in the Pod spec or default service account.
- **Docker Hub rate limit** (`429 Too Many Requests`) — set up a pull-through cache (Harbor / ECR mirror) or authenticate.
- **Wrong architecture** — pulling an `amd64` image onto `arm64` nodes (`exec format error` on start). Rebuild multi-arch with `docker buildx`.
- **Registry temporarily down** — retry, then investigate registry health.

---

## Scenario 4: Service Has No Endpoints

**Symptom:** Service exists, but traffic times out or hits a 502.

```bash
kubectl get svc <name>
kubectl get endpoints <name>           # if EMPTY → no Pod matches the selector OR no Pod is Ready
kubectl describe svc <name>
kubectl get pods -l <selector-key>=<value> -o wide
```

**Top causes:**
1. **Label selector typo** — service selects `app: backend` but the Pod has `app: back-end`.
2. **Readiness probe failing** — Pods are running but not ready, so they're stripped from endpoints. Inspect with `kubectl describe pod` → Conditions: `Ready: False`.
3. **Wrong `targetPort`** — Service forwards to port 80, container listens on 8080.
4. **NetworkPolicy blocking** — `kubectl describe networkpolicy -n <ns>` and look for an Egress/Ingress rule blocking that traffic.

**Test traffic bypassing the Service:**

```bash
kubectl port-forward pod/<pod-name> 8080:80
curl http://localhost:8080/
```

Or from another Pod in the cluster:

```bash
kubectl run tmp --rm -it --image=busybox -- wget -O- <svc>.<ns>.svc.cluster.local:80
```

---

## Scenario 5: DNS Failures

**Symptom:** Intermittent `Name or service not known` or slow resolution.

**Investigate:**

```bash
# CoreDNS health
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl top pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200

# Resolve from inside the cluster
kubectl run dns-test --rm -it --image=busybox -- nslookup kubernetes.default
```

**Common causes:**
- **CoreDNS at CPU limit** — scale it (`kubectl scale deploy coredns -n kube-system --replicas=4`) or add an HPA.
- **`ndots: 5` blowup** — every external hostname is tried with cluster search domains first. Override at Pod level:
  ```yaml
  dnsConfig:
    options:
    - { name: ndots, value: "2" }
  ```
- **`/etc/resolv.conf` race** with kubelet — Pods occasionally start before DNS is wired. Add a startupProbe so the app waits.
- **NodeLocal DNSCache** missing — install it to remove cross-node DNS hops and the load on CoreDNS.

---

## Scenario 6: PVC Stuck in `Pending`

```bash
kubectl get pvc
kubectl describe pvc <name>
kubectl get storageclass
kubectl describe storageclass <sc-name>
```

**Common causes:**

| Cause | Fix |
|-------|-----|
| `StorageClass` does not exist | Use a valid SC or set the cluster default |
| Cloud disk created in wrong AZ | Set `volumeBindingMode: WaitForFirstConsumer` so the disk is created in the Pod's zone |
| `accessModes: ReadWriteMany` not supported | Use RWO + StatefulSet, or pick a CSI driver that supports RWX (EFS, FSx, Ceph) |
| Quota exceeded | Bump `requests.storage` in the namespace's ResourceQuota |
| Snapshot restoration permissions | CSI controller's IAM role missing — check `kubectl describe pod` for the CSI controller |

**Important:** mounting a PVC into a Pod that runs on a different node than the PVC's zone will fail at attach time, not at PVC creation. Always use `WaitForFirstConsumer` for zonal block storage.

---

## Scenario 7: Node `NotReady`

```bash
kubectl get nodes
kubectl describe node <name>             # Conditions section is the diagnostic
ssh <node>                               # if you can — inspect kubelet directly
journalctl -u kubelet -n 200 --no-pager
journalctl -u containerd -n 200 --no-pager
```

**Conditions to read:**
- `MemoryPressure: True` → node out of RAM.
- `DiskPressure: True` → node out of disk (often `/var/lib/containerd`).
- `PIDPressure: True` → too many processes; raise `kubelet --max-pods`.
- `NetworkUnavailable: True` → CNI failure; restart CNI pods on the node.
- `Ready: False` reason `KubeletNotReady` → kubelet down or unreachable.

**Recovery:**

```bash
kubectl cordon <node>                                              # stop new scheduling
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data    # move workload off
# … investigate / reboot / replace the node …
kubectl uncordon <node>                                            # bring back
```

If the node is unrecoverable in a managed group, terminate the underlying EC2/GCE VM — the autoscaler replaces it.

---

## Scenario 8: HPA Is Not Scaling

```bash
kubectl get hpa
kubectl describe hpa <name>              # AbleToScale / ScalingActive Conditions
kubectl top pods                         # do metrics work AT ALL?
kubectl get deploy -n kube-system metrics-server
kubectl logs -n kube-system deploy/metrics-server --tail=100
```

**Common causes:**
- **`metrics-server` not installed** — install it:
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```
- **Container has no `resources.requests`** — HPA on `Utilization` needs `requests` to compute percentage. Set CPU and memory requests on every container.
- **Metric not available** — `kubectl top pods` returns errors. Fix metrics-server before debugging HPA.
- **Cooldown** — HPA stabilizes for 5 minutes by default before scaling down. Tweak `behavior.scaleDown.stabilizationWindowSeconds` if you really need faster.

---

## Scenario 9: RBAC `forbidden` Errors

**Symptom:** `Error from server (Forbidden): pods is forbidden: User "foo" cannot list resource "pods"`.

**Diagnose exactly what is missing:**

```bash
kubectl auth whoami
kubectl auth can-i list pods --as=foo
kubectl auth can-i list pods --as=foo -n my-ns
kubectl auth can-i --list --as=system:serviceaccount:my-ns:my-sa

# Find what bindings exist for a subject
kubectl get rolebinding,clusterrolebinding -A -o json | \
  jq '.items[] | select(.subjects[]?.name=="foo")'
```

**Fix patterns:**
- A user needs to list Pods cluster-wide → `ClusterRoleBinding` to the `view` `ClusterRole`.
- A workload's ServiceAccount needs to read Secrets in its own namespace → `Role` + `RoleBinding` in that namespace, *not* cluster-wide.
- Never bind `cluster-admin` to an application ServiceAccount.

---

## Scenario 10: Ingress Returning 404 or 502

**404 — no rule matches the request.**

```bash
kubectl describe ingress <name>
kubectl get ingress <name> -o yaml
```

Check the `Host:` header the client sent matches a rule. Check `path` and `pathType` (`Prefix` vs `Exact`). Check `ingressClassName` matches the controller you have installed.

**502 — backend not healthy.**

```bash
kubectl get endpoints <backend-service>
kubectl describe pod -l <selector>
kubectl logs -l <selector> --tail=100
```

The Service exists but has no ready Pods, or Pods are returning errors. Often a misconfigured readinessProbe is the culprit — the Pod is up but its `/ready` endpoint 500s.

---

## Scenario 11: API Server Slow or Unreachable

**Symptom:** `kubectl` hangs, `context deadline exceeded`.

```bash
kubectl get --raw='/readyz?verbose'
kubectl get --raw='/livez?verbose'
kubectl get componentstatuses
kubectl top nodes
```

**Common causes:**
- **etcd disk latency** — fast disks (`iops`, p99 fsync < 10 ms) are mandatory. Check etcd logs.
- **Admission webhook timing out** — every API write goes through every webhook. One slow webhook freezes the API. Check `kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations`.
- **API server CPU/memory limits hit** — managed clusters auto-scale this; self-managed clusters need bigger control plane nodes.
- **Rate limiting** — heavy GitOps controllers (ArgoCD, Flux) can hammer the API server. Tune polling intervals; use server-side apply.

---

## Scenario 12: Pod Evicted

**Symptom:** `Pod was evicted due to memory pressure` (or disk).

```bash
kubectl get pods -A | grep Evicted
kubectl describe node <node-where-it-ran> | head -50
kubectl top nodes
```

**Cleanup:**

```bash
# Bulk-delete evicted Pods
kubectl get pods -A -o json | \
  jq -r '.items[] | select(.status.reason=="Evicted") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns pod; do kubectl delete pod -n "$ns" "$pod"; done
```

**Root-cause fix:** the node ran out of memory or disk. Either:
- Tighten Pod memory limits so kubelet evicts the over-user, not bystanders.
- Add LimitRange + ResourceQuota so a misbehaving namespace cannot starve the node.
- Add capacity / enable cluster autoscaler.
- Move `BestEffort` workloads off shared nodes — they evict first under pressure.

---

## Scenario 13: Helm Release Stuck in `pending-upgrade`

```bash
helm list -A | grep pending
helm history my-app -n my-ns

# Roll back to last good revision
helm rollback my-app <last-good-rev> -n my-ns

# Last resort: edit the release secret directly
kubectl get secret -n my-ns -l owner=helm,name=my-app
kubectl delete secret sh.helm.release.v1.my-app.v<stuck-rev> -n my-ns
```

Always run `helm upgrade --atomic --timeout 10m` so failed upgrades auto-rollback and clear the stuck state.

---

## Scenario 14: ConfigMap or Secret Update Not Reflected in Pod

| Mount type | Update behaviour |
|------------|------------------|
| Volume mount of a ConfigMap | Updated within ~60 s — file content changes |
| Volume mount of a Secret | Updated within ~60 s — file content changes |
| `envFrom` / `env.valueFrom.configMapKeyRef` | **NOT updated** — Pod must be restarted |
| `subPath` mounts | **NOT updated** — needs full mount or Pod restart |

```bash
# Force a rollout to pick up new env-mapped config
kubectl rollout restart deployment/my-app
```

For GitOps, add an annotation that includes a hash of the ConfigMap so changes trigger a re-deploy automatically:

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: "{{ include (print $.Template.BasePath \"/configmap.yaml\") . | sha256sum }}"
```

---

## PromQL — Queries Every Operator Should Have Saved

```promql
# Container restart spikes
increase(kube_pod_container_status_restarts_total[1h]) > 5

# Deployment with replicas unavailable
kube_deployment_status_replicas_unavailable > 0

# CPU throttled (>25% of periods)
rate(container_cpu_cfs_throttled_seconds_total[5m])
  / rate(container_cpu_cfs_periods_total[5m]) > 0.25

# Container memory approaching limit (OOMKill territory)
container_memory_working_set_bytes
  / container_spec_memory_limit_bytes > 0.8

# PVC > 85% full
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85

# API server p99 latency
histogram_quantile(0.99,
  sum by (le, verb, resource) (
    rate(apiserver_request_duration_seconds_bucket{verb!="WATCH"}[5m])
  ))

# etcd fsync latency (the canary for cluster health)
histogram_quantile(0.99,
  rate(etcd_disk_wal_fsync_duration_seconds_bucket[5m]))

# CoreDNS errors
sum(rate(coredns_dns_responses_total{rcode!="NOERROR"}[5m]))
```

---

## Debug Checklist When Something Just Feels Wrong

1. `kubectl get nodes` — is the cluster itself healthy?
2. `kubectl get pods -A | grep -v Running` — anything not Running/Completed?
3. `kubectl get events -A --sort-by=.lastTimestamp | tail -30` — what just happened?
4. `kubectl top nodes` and `kubectl top pods -A --sort-by=memory` — resource pressure?
5. `kubectl get --raw='/readyz?verbose'` — control plane ready?
6. `kubectl logs -n kube-system <core-component>` — coredns, kube-proxy, controller-manager, scheduler
7. If you suspect a network issue: `kubectl run tmp --rm -it --image=nicolaka/netshoot -- bash` and run `dig`, `curl`, `mtr` from inside the cluster.

---

## Packet-Path Debugging Method

When networking "feels broken," do not say "CNI issue" until you have proven where the path breaks. Walk the path layer by layer.

1. **Classify the traffic type.**
   - Pod to Pod (same node)
   - Pod to Pod (cross-node)
   - Pod to Service (ClusterIP)
   - External client → Ingress
   - Pod → external service
2. **Test DNS separately** — `dig +short` from the source pod.
3. **Test the backend Pod IP directly** — bypasses Service and DNS.
4. **Test the Service name and ClusterIP** — confirms kube-proxy / Cilium translation.
5. **Inspect EndpointSlice** — is the backend actually registered?
6. **Inspect NetworkPolicy** — is there a policy selecting the source or destination?
7. **Inspect node datapath** — iptables / IPVS / eBPF state on the source node.
8. **Inspect cloud path** — security groups, NAT gateway, firewall, if traffic leaves the cluster.

Diagnostic shortcuts:

| Result | Interpretation |
|---|---|
| Both PodIP and Service fail | Backend app, NetworkPolicy, route, or listener problem |
| PodIP works, Service fails | Service definition, EndpointSlice, kube-proxy/eBPF, or policy |
| Same-node works, cross-node fails | Overlay tunnel, MTU, or CNI cross-node datapath |
| Only one node fails | Node-local CNI agent, conntrack, or kernel state on that node |
| Only one rack fails | Physical layer — NIC, ToR switch, cable |

---

## Command Interpretation Table

| Command | What it answers | Bad signs |
|---|---|---|
| `kubectl get pods -o wide` | Pod placement and IPs | Failures concentrated on one node |
| `kubectl get svc` | Service definition | Wrong port / type |
| `kubectl get endpointslice` | Ready backends | Empty endpoints |
| `nslookup` from Pod | DNS resolution path | Timeout / SERVFAIL |
| `curl <Service>` vs `curl <PodIP>` | Service vs backend path | Service fails, PodIP works |
| `hubble observe` | Cilium flow / drop visibility | Policy / drop reasons |
| `conntrack -S` | Kernel flow tracking | `insert_failed` / drops |
| `tcpdump` | Packet truth | SYN with no reply, RST mid-flow |
| `ethtool -S` | NIC counters | `rx_crc_errors`, `tx_errors` |
| `ip -s link` | Interface drops | Sustained `dropped` > 0 |
| `nvidia-smi` | GPU visibility | No devices, XID errors |
| `crictl ps` | What is running on a node | Wrong image, restart loops |

---

## Scenario 15: Conntrack Table Full

**Symptom:** New connections fail intermittently while existing connections keep working. DNS times out under load. Service traffic flaky during traffic spikes.

```bash
# On the affected node
conntrack -S
# look for insert_failed > 0 or drop > 0
cat /proc/sys/net/netfilter/nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
ss -s
```

If `nf_conntrack_count` is close to `nf_conntrack_max`, the table is exhausted.

**Fix (immediate):**

```bash
sysctl -w net.netfilter.nf_conntrack_max=524288
sysctl -w net.netfilter.nf_conntrack_buckets=131072
```

Persist via `/etc/sysctl.d/`.

**Prevention:**

- Node-level DaemonSet alerting at > 70% of `nf_conntrack_max`.
- Long-term: Cilium kube-proxy replacement removes Service traffic from conntrack entirely.

---

## Scenario 16: Overlay MTU Mismatch

**Symptom:** Small packets work, large packets hang. TLS handshakes intermittently fail. Uploads >1MB stall. No clear error in app logs.

```bash
# From the source pod
ping -M do -s 1472 <target>      # 1472 + 28 IP/ICMP overhead = 1500 MTU
ping -M do -s 1422 <target>      # account for 50 bytes of VXLAN overhead
tracepath <target>
ip link show eth0                # check pod MTU
```

If small pings work but `1472` fails, the path's effective MTU is below 1500. Overlay encapsulation often costs ~50 bytes (VXLAN) or more (IPsec, GRE).

**Fix:** lower pod MTU to (physical_MTU - encapsulation_overhead). For VXLAN on 1500 MTU networks, set pod MTU to 1450. Each CNI exposes a different config knob:

- Cilium: `tunnel-mode: vxlan` + auto-detects, but verify `cilium config view | grep mtu`.
- Flannel: configure `EgressMTU` in the Flannel config.
- Calico: `FELIX_VXLANMTU` env var on calico-node.

**Verification step in CNI rollout:** test a 1400-byte UDP packet with DF set to an external endpoint from a pod. If it fails, MTU is wrong.

---

## Scenario 17: One Node Has Failures (Node-Local Bug)

**Symptom:** Pods on node A fail, pods on the same Deployment running on node B succeed. The pattern points to node-local state.

```bash
kubectl get pods -o wide                       # confirm placement
kubectl describe node <node-a>
ip route                                       # on node A
conntrack -S                                   # on node A
journalctl -u kubelet -n 100 --no-pager
journalctl -u containerd -n 100 --no-pager

# CNI agent on this node
kubectl get pods -n kube-system -o wide | grep <node-a>
kubectl logs -n kube-system <cni-pod-on-node-a>
```

Likely causes:

- CNI agent (cilium, calico-node, kube-flannel) crashed on this node.
- Conntrack exhaustion on this node.
- Route table drift (a static route missing after a reboot).
- Kernel module not loaded (`xt_conntrack`, `nf_nat`, eBPF maps).

**Fast recovery:** cordon and drain the node, let the autoscaler / autohealer replace it. The underlying state drift is replaced by a fresh node build.

---

## Scenario 18: Partial Rack Impact (Physical Layer)

**Symptom:** Retransmits, elevated tail latency, only on nodes in one rack. Application logs show nothing useful.

Rack-partial pattern is almost always **physical** before logical. Start at L1/L2:

```bash
# On affected nodes
ethtool -S eth0 | grep -E 'errors|dropped'
ip -s link
cat /proc/net/dev | grep -v lo

# Look for asymmetric counters compared to healthy nodes
```

If one node shows `rx_crc_errors` orders of magnitude higher than neighbors, a NIC or transceiver is failing. If multiple nodes in the same rack show similar errors, the ToR switch or its uplink is the suspect — escalate to the network team.

Only after ruling out physical, look at:

- conntrack overflow (`conntrack -S`)
- kernel ring buffer drops (`dmesg | grep -i 'drop\|over'`)
- ECMP routing asymmetry causing all flows to one congested path

Do not start by reading application logs when "partial rack" is the clue.

---

## Scenario 19: GPU Pod Pending Or CUDA Fails

**GPU Pod Pending:**

```bash
kubectl describe pod <gpu-pod>            # scheduler events
kubectl get nodes -L nvidia.com/gpu.product
kubectl describe node <gpu-node> | grep -A 5 nvidia.com/gpu
```

Likely causes:

- Insufficient `nvidia.com/gpu` allocatable.
- Wrong `nodeSelector` (`nvidia.com/gpu.product` value does not match any node).
- Missing toleration for the GPU node taint.
- Quota / Kueue queue blocking admission.

**GPU node Ready but allocatable shows 0:**

```bash
kubectl get pods -n gpu-operator
kubectl logs -n gpu-operator deploy/gpu-operator-validator
kubectl logs -n gpu-operator ds/nvidia-device-plugin-daemonset
```

The node is `Ready: True` but the device plugin failed — kubelet never advertised GPUs. Inspect the operator pods on the affected node.

**Pod starts but CUDA fails (`CUDA error: no kernel image is available`):**

- CUDA version in image vs driver on host: driver supports up to a CUDA version determined by the driver's release notes.
- The container runtime (nvidia-container-runtime) was not injected — verify with `crictl inspect <id>` and look for `/dev/nvidia*` devices.

**XID errors in `nvidia-smi -q -d ECC` or DCGM exporter:** hardware fault. Cordon the node, replace the GPU or the node.

---

## Scenario 20: Admission Webhook Is Hanging The API Server

**Symptom:** `kubectl` requests time out. `kubectl get pods` works but `kubectl apply -f x.yaml` hangs. Existing workloads keep running; new operations stall.

```bash
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations -o yaml | grep -E 'name:|failurePolicy:|timeoutSeconds:'

# Check the webhook backend
kubectl get pods -n <webhook-ns>
kubectl logs -n <webhook-ns> <webhook-pod>
```

If a webhook with `failurePolicy: Fail` cannot reach its backend pods, the API server rejects matching requests. Common culprits:

- Kyverno pods restarting after an upgrade.
- cert-manager webhook pods unable to acquire their TLS certs.
- A custom admission service that has scaled to zero.

**Fast mitigation (emergency only):** delete the offending `ValidatingWebhookConfiguration` or `MutatingWebhookConfiguration`. The cluster regains write capability. Reinstall when the backend is healthy. This bypasses security — only do it during a real outage and with leadership sign-off.

**Prevention:**

- Run admission webhook backends with PDB `minAvailable: 1+`.
- Use `failurePolicy: Ignore` unless the policy is security-critical.
- Set `timeoutSeconds: 5` so a hung webhook fails fast.
- Exclude `kube-system` and other recovery namespaces via `namespaceSelector`.

---

## Scenario 21: etcd Restored But Cluster Still Broken

**Symptom:** etcd restore completes. `etcdctl endpoint health` is happy. `kubectl get nodes` works. But pods don't start, controllers don't reconcile, or admission rejects everything.

Three most likely causes:

1. **Certificates expired.** Kubernetes uses certs for kubelet → API server and API server → etcd. An old etcd snapshot can revive expired certs. Check with `kubeadm certs check-expiration` on the control plane.
2. **Stale object references.** Pods reference Nodes that no longer exist; PVCs reference PVs in a different region; Secrets reference deleted ServiceAccounts. The controller manager logs surface these as "not found" loops.
3. **Stale leases.** `Lease` objects from the previous etcd cluster mismatch the current leader election state. kube-controller-manager and kube-scheduler wait until leases expire and are reacquired (default 15-30s).

**Recovery sequence:**

1. Restart all control-plane components after etcd restore (API server, controller manager, scheduler).
2. Rotate certificates if any are expired (`kubeadm certs renew all`).
3. Clean up orphaned objects with `kubectl delete --field-selector=spec.nodeName=<deleted-node>`.

A cluster restore is **not** complete when etcd is healthy. Validate with a smoke test: deploy a known good manifest end-to-end.

---

## Scenario 22: Velero Backup Reports Success But Restore Fails

**Symptom:** `velero backup describe` shows "Completed". On restore, PV data is missing or stale.

```bash
velero backup describe <backup> --details
velero backup logs <backup> | grep -i 'snapshot\|error\|warning'
```

Common causes:

- **PV snapshot failed silently** but the backup phase is "Completed" — Velero treats PV snapshot failure as a warning, not a backup failure.
- **CSI snapshot class missing** for the storage type — PVs were skipped entirely.
- **Wrong storage class on restore** — PVCs bind to a new SC and the data is not in the new volume.
- **Application is not crash-consistent** — Postgres or other databases need application-level backup (pgBackRest) in addition to PV snapshots.

**Prevention:**

- Alert on PV snapshot success rate in Velero metrics, not just backup phase.
- Run quarterly restore drills; "Backup Completed" is not a restore guarantee.
- Stateful applications require **application-aware** backup. Velero is necessary but not sufficient.

---

## Scenario 23: Probe Death-Spiral Under Load

**Symptom:** Pods restarting in waves. Latency rising. Error rate climbing. Capacity dropping with every restart.

```bash
kubectl describe pod <crashloop-pod> | grep -A 3 "Last State"
kubectl describe pod <crashloop-pod> | grep -A 5 Liveness
kubectl top pod
```

If liveness probe has `timeoutSeconds < 3` or `failureThreshold < 3`, this is your prime suspect.

Mechanism: under load, app P99 exceeds the liveness probe timeout. Pods are killed. Remaining pods get more traffic. Latency rises further. More pods killed. Death spiral.

**Recovery (immediate):**

1. Scale the deployment up to absorb traffic (`kubectl scale deploy --replicas=24`).
2. As capacity stabilizes, error rate falls, P99 drops.
3. Patch the probe before scaling back down:

```bash
kubectl set probe deploy/<name> --liveness \
  --period=20 --timeout=5 --failure-threshold=5
```

**Prevention:**

- Liveness probes test only process responsiveness, never dependencies (DBs, caches).
- CI rule (kube-score) blocks `timeoutSeconds < 3` or `failureThreshold < 3` for liveness.
- Standardize a `/livez` endpoint pattern across services.

---

## Scenario 24: Spot Reclamation Mass-Eviction

**Symptom:** Multiple nodes (all spot) reclaimed within a short window. Pods evicted en masse. PDBs ignored.

PDBs are **not** honored during spot/preemptible reclamation — the cloud provider does not coordinate with the Kubernetes API. The 2-minute interruption notice is your only signal.

**Detection:**

```bash
kubectl get nodes -L node.kubernetes.io/instance-type
kubectl get events -A --field-selector reason=NodeTerminationEvent
```

**Mitigation:**

- Run **aws-node-termination-handler** (or equivalent) as a DaemonSet. It watches EC2 instance metadata for the interruption notice and triggers `kubectl drain` early.
- Topology spread constraints with `maxSkew: 1` so a multi-node loss does not concentrate impact on one workload.
- Mix node groups: on-demand baseline for p50 traffic + spot for burst.
- For latency-critical paths, **refuse spot** via node affinity (`karpenter.sh/capacity-type: on-demand`).
- For training: frequent checkpoints. Spot reclamation is expected; design for resume.

---

## Scenario 25: KubeProxy Stale iptables Rules

**Symptom:** Traffic to a Service occasionally goes to a pod that no longer exists. Error rate has a low constant baseline; refresh window is 30-60s after a pod replacement.

```bash
# On a node
iptables -L KUBE-SEP-* -n -v | head -50
ipvsadm -L -n   # if IPVS mode
```

If you see SEP rules pointing at Pod IPs that no longer exist, kube-proxy has not synced. Causes:

- High pod churn rate exceeding kube-proxy's reconcile interval.
- kube-proxy CPU starved on the node.
- Bug in kube-proxy version (rare, but check the changelog).

**Mitigation:**

- Restart kube-proxy on the affected node.
- Long-term: move to IPVS or eBPF (Cilium kube-proxy replacement) — both update more efficiently than iptables at scale.

---

## Scenario 26: Service Mesh Routes Traffic Into A Void

**Symptom:** After a `DestinationRule` or `VirtualService` change, the service starts returning 503 for every request. App pods are healthy.

```bash
istioctl analyze -n <ns>
istioctl proxy-config routes <pod>.<ns>
istioctl proxy-config clusters <pod>.<ns> | grep <service>
istioctl proxy-config endpoints <pod>.<ns> | grep <service>

# Inspect Envoy access logs
kubectl logs <pod> -c istio-proxy --tail=50
```

If `endpoints` is empty for a subset, the `DestinationRule` references a `subset` (e.g., `v2`) that no `WorkloadEntry` or pod matches. Envoy has no upstream and returns 503 NoHealthyUpstream.

**Recovery:**

- Roll back the offending CR.
- Run `istioctl analyze` in CI before applying mesh resources.
- Add a synthetic probe through the mesh that verifies routes resolve to non-empty endpoint sets.

---

## Scenario 27: Pod Has Network But CoreDNS Is Unreachable From Only One Namespace

**Symptom:** Pods in `prod` resolve DNS fine. Pods in `analytics` get NXDOMAIN or timeout for every name.

```bash
kubectl get networkpolicy -n analytics
kubectl describe networkpolicy -n analytics
```

Likely cause: a NetworkPolicy in `analytics` selects pods for egress but does not allow egress to `kube-system`'s CoreDNS pods on UDP/TCP 53.

**Fix:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: analytics }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector:
        matchLabels: { kubernetes.io/metadata.name: kube-system }
      podSelector:
        matchLabels: { k8s-app: kube-dns }
    ports:
    - { protocol: UDP, port: 53 }
    - { protocol: TCP, port: 53 }
```

DNS needs **both** UDP and TCP 53 explicitly. Many policy templates forget TCP.

---

## Scenario 28: Sidecar OOMKilled Before The App

**Symptom:** Pods restart but the app exit code is 0; the sidecar (e.g., `istio-proxy`) shows `OOMKilled` with exit 137.

```bash
kubectl describe pod <pod> | grep -A 4 "istio-proxy"
```

Sidecars participate in pod-level QoS. If the app has `requests=limits` but the sidecar does not, the pod is `Burstable`, not `Guaranteed`. Under node memory pressure the sidecar gets evicted/OOMKilled first.

**Fix:**

- Set `requests=limits` on both the app **and** the sidecar.
- Bump sidecar request/limit to handle p99 sidecar memory under traffic (typically 200-300Mi for Envoy in Istio).
- For high-density workloads, consider Istio ambient mode to drop per-pod sidecars entirely.
