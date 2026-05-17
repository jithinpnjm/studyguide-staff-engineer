---
title: "Disaster Recovery And Migrations"
sidebar_position: 25
---

# Disaster Recovery And Migrations

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers RPO/RTO, backup/restore, pilot light, warm standby, active-active, Elastic Disaster Recovery, DMS, SCT, AWS Backup, MGN, Application Discovery, VMware Cloud, and large data transfer.

DR starts with business requirements. RPO is acceptable data loss. RTO is acceptable downtime. Backup/restore is cheaper but slower. Pilot light keeps core pieces ready. Warm standby runs a scaled-down environment. Multi-site active-active is fastest and most expensive.

The operational truth: a backup that has never been restored is only a hope. A DR design that has never been exercised is a diagram, not a capability.
