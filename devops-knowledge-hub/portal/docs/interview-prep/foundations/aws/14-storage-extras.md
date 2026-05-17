---
title: "Storage Extras"
sidebar_position: 14
---

# Storage Extras

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers Snowball, FSx, Storage Gateway, Transfer Family, and DataSync. These services exist mostly for migration, hybrid, and specialized filesystem needs.

Snowball solves physical data transfer when network movement is too slow or expensive. FSx solves managed filesystem needs beyond EFS: Windows File Server for SMB/Windows workloads, Lustre for high-performance compute, NetApp ONTAP and OpenZFS for enterprise filesystem compatibility. Storage Gateway connects on-premises environments to AWS storage through file, volume, or tape patterns. Transfer Family gives managed SFTP/FTPS/FTP endpoints backed by S3 or EFS. DataSync moves data between on-premises and AWS storage or between AWS storage services.

Senior explanation: these are not first-choice services for every app. They are integration tools when real enterprises have existing data, protocols, appliances, and migration constraints.
