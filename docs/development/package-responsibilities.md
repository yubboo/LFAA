# LFAA Package Responsibilities and Assembly

[简体中文 full specification](package-responsibilities.zh.md) · [Development rules](../../开发规范.md) · [System architecture](../系统总体架构.md)

The Chinese specification is the authoritative package-boundary reference. Use it for the full package-group table and migration requirements. You do not need to read every section for every change:

1. For a package change, confirm its real Owner and public contract in the package README and caller code. Review the dependency rules and that package group.
2. For a capability, content, data, or runtime change, also review the sections on Prompt/Skill/Tool ownership and lifecycle.
3. For a repository-wide audit or migration, follow the directory-by-directory evidence requirements.

Core rules:

- Directory names and manifests are navigation clues; confirm behavior from implementation, callers, stored data, and execution results.
- Each business rule and data fact has one Owner. Apps and Bundles assemble capabilities; they do not duplicate domain behavior or content.
- Keep dependencies acyclic and use declared, public package entries. Separate client, server, and Daemon runtime imports.
- A source package is not necessarily assembled or usable. Report source, assembly, and real acceptance status separately.
- Keep authentication, data isolation, parameter checks, and the existing Permission Owner in the execution path. Never treat a model-visible Tool or external Skill as authorization.
- Ordinary development checks affected packages and consumers. A full audit covers every directory in the generated inventory.
