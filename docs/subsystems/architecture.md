# Architecture overview

[简体中文](architecture.zh.md) · [Documentation](../README.md)

The [architecture authority](../系统总体架构.md) contains the complete current facts. This overview provides a reading route without creating another authority.

`apps` provides entries, `packages` provides capabilities and composition, and Cordis owns lifecycle. Web and Electron share the client API. Authorization, Settings, Session and domain state remain with their existing Host owners. Electron is the desktop mainline; compatibility Tauri code does not establish acceptance of the new desktop product.

Session JSONL owns messages and events. SQLite projects relationships and headers for queries. The body cache is bounded to eight sessions and a 32 MiB encoded budget. Lists return up to 200 headers without restoring complete Kernels. Long chats now have 1–100 message cursor pages; each page still performs two synchronous scans of the full hash chain, so CPU work grows with the log. Lightweight indexes, compaction and settling remain unimplemented.

Daemon has one Shell slot and one rotating maintenance slot. Long Shell commands no longer block Minecraft stop tasks, but a long installation can still occupy the maintenance slot. Electron requests existing lifecycle shutdown through IPC and refuses installation when safe exit cannot be confirmed. Tauri compatibility shutdown now sends the same idempotent app-boot request over stdin and waits for child exit; errors and timeouts keep the app open without force-killing. Real Tauri desktop exit remains untested.

MCP Tools reuses Streamable HTTP sessions only for the same account, App and complete server configuration. The pool is capped at 32 entries and expires idle sessions after 30 seconds. Shared initialization is independent of any one Run's cancellation signal, and each discovery/call has its own lease. Configuration changes or disablement invalidate old leases on the next authoritative discovery; a real user MCP service has not been tested.

Shared Settings types/defaults belong to `util/values`; strict write validation belongs to Settings, while read normalization preserves legacy compatibility. Directory projects are currently available only to Workspace and Minecraft. App registration alone does not integrate project execution. See [storage](storage.md), [execution control](execution-control.md) and [review evidence](../development/workspace-audit-20261008.md).
