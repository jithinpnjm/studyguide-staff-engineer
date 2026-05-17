---
title: "Foundations: Docker And Container Runtime Premium Teaching Guide"
sidebar_position: 13
---

# Foundations: Docker And Container Runtime Premium Teaching Guide

Containers power modern platforms: Kubernetes, CI runners, batch jobs, developer environments, and many AI workloads.

A container is not a tiny VM. It is usually a Linux process tree isolated with namespaces, limited with cgroups, and started from an image filesystem.

This guide teaches containers from first principles to production-grade runtime operations.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — images, containers, Docker basics.
2. **Intermediate Layer** — Dockerfiles, networking, volumes, registries.
3. **Advanced Layer** — namespaces, cgroups, overlayfs, PID 1, runtimes.
4. **Production SRE Layer** — pull failures, OOM, disk pressure, crash loops.
5. **Interview Layer** — explain containers from Linux internals upward.

---

# Memory Palace: Apartment Building

| Concept | Analogy | Meaning |
|---|---|---|
| Host | Building | Linux machine |
| Image | Blueprint + furniture set | Packaged filesystem |
| Container | Apartment in use | Running isolated process |
| Namespace | Apartment walls | Visibility isolation |
| cgroup | Utility meter | Resource limits |
| Runtime | Building manager | Starts and supervises |
| Registry | Warehouse | Image storage |
| Volume | Storage locker | Persistent data |

---

# Beginner Layer: What A Container Really Is

```text
Image + writable layer + namespaces + cgroups + process = container
```

Important truths:

- containers share the host kernel
- startup is usually faster than VMs
- isolation is strong but different from hardware virtualization
- deleting a container does not delete its image automatically

---

# Beginner Layer: Core Docker Commands

```bash
docker pull nginx:1.25
docker run --name web -p 8080:80 nginx:1.25
docker ps
docker logs web
docker exec -it web sh
docker stop web
docker rm web
```

Distinction:

- image = package
- container = running instance

---

# Beginner Layer: Lifecycle Thinking

```text
build -> push -> pull -> run -> observe -> stop -> remove
```

In production, reliability depends on every stage, not only `docker run`.

---

# Intermediate Layer: Images And Layers

Each Dockerfile instruction often creates a layer.

Good cache order:

1. base image
2. OS deps
3. language deps
4. application code

Why?

Frequent code changes should not invalidate expensive dependency layers.

---

# Intermediate Layer: Better Dockerfiles

Use:

- small trusted base images
- pinned versions
- multi-stage builds
- non-root users
- explicit entrypoints
- `.dockerignore`

Avoid:

- giant build contexts
- secrets in image layers
- unnecessary packages

---

# Intermediate Layer: Multi-Stage Builds

Builder stage compiles. Runtime stage stays small.

Benefits:

- faster pulls
- smaller attack surface
- fewer CVEs
- cleaner runtime image

---

# Intermediate Layer: Volumes And Persistence

Container writable layers are ephemeral.

Use volumes for:

- databases in dev/test
- caches needing persistence
- shared data paths
- backups/export targets

Rule:

> Never treat a container layer as durable production storage.

---

# Intermediate Layer: Networking Basics

Common path:

```text
container eth0 -> veth -> bridge -> host NAT -> network
```

Port publish:

```bash
docker run -p 8080:80 nginx
```

Means host port 8080 forwards to container port 80.

---

# Intermediate Layer: Registries

Use registries for image distribution.

Production habits:

- immutable tags
- digest pinning
- vulnerability scanning
- retention cleanup
- signed images when possible

Avoid production use of mutable `latest`.

---

# Advanced Layer: PID 1 Problem

The container entry process becomes PID 1.

PID 1 must:

- receive signals
- terminate gracefully
- reap zombie child processes

Bad signal handling causes stuck shutdowns and slow rollouts.

Use exec form commands and init wrappers when needed.

---

# Advanced Layer: Namespaces

| Namespace | Isolates |
|---|---|
| PID | processes |
| NET | interfaces/routes/ports |
| MNT | mounts |
| UTS | hostname |
| IPC | shared IPC |
| USER | UID/GID mapping |

Namespaces change what the process can see.

---

# Advanced Layer: cgroups

cgroups control resources.

```bash
docker run --memory=512m --cpus=1.5 app
```

Behavior:

- memory exceeded -> kill/OOM
- CPU exceeded -> throttling
- no limits -> noisy neighbors possible

Kubernetes requests/limits rely on these primitives underneath.

---

# Advanced Layer: Overlay Filesystems

Images are stacked read-only layers plus writable container layer.

Implications:

- image layers reused efficiently
- many small layers can help caching
- logs written inside container consume node disk
- deleting runtime files does not shrink image history

---

# Advanced Layer: Runtime Stack

Modern Kubernetes path:

```text
kubelet -> CRI -> containerd -> runc -> Linux kernel
```

On nodes, `crictl` is often more useful than Docker CLI.

---

# Production SRE Layer: Real Incidents

## ImagePullBackOff

Check:

- wrong tag
- registry auth
- network reachability
- rate limits
- architecture mismatch

## CrashLoopBackOff

Check:

- startup logs
- command/entrypoint
- missing env or secret
- dependency unavailable

## OOMKilled

Check:

- memory limits too low
- leak
- spike load
- heap tuning

## Node Disk Full

Common causes:

- container logs
- old images
- writable layers
- build cache

## Slow Shutdown During Deploy

Likely:

- PID 1 not handling SIGTERM
- grace period too short
- hanging child processes

---

# Production SRE Layer: Troubleshooting Flow

## Container Won’t Start

Check:

- image exists
- command valid
- port conflict
- missing config
- permissions

## App Running But Unreachable

Check:

- listening port
- bind address
- publish mapping
- firewall/network policy

## Resource Starvation

Check:

- limits
- host contention
- cgroup stats
- throttling

---

# Kubernetes Connection

| Container World | Kubernetes World |
|---|---|
| docker run | Pod spec |
| -p publish | Service / Ingress |
| volume mount | volume / PVC |
| restart manually | controller reconciliation |
| memory/cpu flags | requests / limits |

Kubernetes adds orchestration, not magic. Linux primitives still matter.

---

# Interview Layer: Strong Answers

## Why are containers not VMs?

> Containers share the host kernel and isolate processes with kernel primitives instead of virtualizing full hardware.

## Why use multi-stage builds?

> They separate build tooling from runtime image, reducing size and attack surface.

## What happens when memory limit is exceeded?

> The kernel may OOM kill the containerized process.

## Why can shutdowns be slow?

> PID 1 may mishandle signals or child processes may not exit cleanly.

---

# Labs

## Beginner

1. Run nginx.
2. Publish a port.
3. Inspect logs.
4. Exec into container.

## Intermediate

1. Build a Dockerfile.
2. Use a volume.
3. Push to registry.
4. Compare image sizes.

## Advanced

1. Multi-stage build.
2. Run as non-root.
3. Simulate OOM.
4. Inspect namespaces.
5. Debug with crictl on a node.

---

# Memory Review

- Why is an image not a container?
- Why is PID 1 special?
- Why avoid `latest`?
- Why can logs fill node disks?
- Why does Kubernetes still require Linux knowledge?

---

# Senior Summary

> I treat containers as Linux processes packaged with images and controlled by kernel isolation primitives. In production I separate image issues, startup issues, runtime resource limits, networking problems, and node-level storage/runtime failures before taking action.
