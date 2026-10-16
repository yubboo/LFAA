# Application panels and template direction

[中文完整合同](application-panels-templates.zh.md) · [Task contract](../PROMPTS.md#lfaa-application-panels-templates-20261016)

The user confirmed on 2026-10-16 that LFAA should center on a general coding agent and task-driven multi-agent collaboration. Apps provide conventional controls and manage real results. Conversations and agent execution use the shared `/work` workspace.

Two template types are planned: deliverable templates produce documents, code projects and other artifacts; application panel templates produce interactive app instances backed by real data queries and actions. Users should be able to customize and version templates. Instances retain their source version and remain independent of subsequent template edits.

Manual and agent operations must use the same domain, file, identity and permission owners. Templates provide structure and acceptance criteria, while models decide actions from user goals and real execution results. Generated code must be validated and registered through the existing app/plugin lifecycle before running as an integrated application.

Implementation order: clean up app-specific agent UI; implement template definitions, versions and management; validate deliverable generation and storage; then implement panel instances and real service bindings. Template storage and instance indexing need an explicit owner contract before implementation. Settings, bounded reads, cancellation, responsive layout and Appearance follow existing repository rules.

This change only cleans up existing application panel UI and records the direction. Template CRUD, generation and dynamic panel execution remain unimplemented and unverified. See the linked Chinese contract for detailed boundaries and acceptance criteria.
