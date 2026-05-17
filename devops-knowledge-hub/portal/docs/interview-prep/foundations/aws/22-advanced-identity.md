---
title: "Advanced Identity"
sidebar_position: 22
---

# Advanced Identity

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Advanced identity in the PDF includes Organizations, SCPs, IAM conditions, resource policies, permission boundaries, Identity Center, Directory Service, and Control Tower. These exist because single-account IAM does not scale for enterprises.

Use Organizations and OUs to group accounts. Use SCPs as maximum-permission guardrails. Use IAM Identity Center for workforce federation. Use permission boundaries to constrain what delegated admins or automation can create. Use resource policies for cross-account access. Use `aws:PrincipalOrgID` to restrict resource access to principals from your AWS Organization.

Failure mode: cross-account role assumption works in dev but not prod because prod OU has stricter SCPs or trust policies require external ID/session tags.
