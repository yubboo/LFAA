# Performance, safety and maintainability

[简体中文](performance.zh.md) · [Documentation](../README.md)

The [Chinese source](performance.zh.md) contains the original contracts, settings inventory and historical verification. Improvements must satisfy performance, safety and maintainability together.

Avoid overlapping reads, duplicate subscriptions, unchanged rerenders, synchronous heavy work on interactive paths and unbounded retained data. Clean timers, observers, streams and listeners. Do not bypass authorization, change user preferences or introduce a second business authority to improve speed.

This review bounds Session body retention and avoids Kernel restoration in header lists. The shortcut listener reads a configuration reference updated after commit, so unrelated settings do not reinstall it. Shared settings and background metadata remove duplicated authorities without altering appearance defaults. Separate Daemon task slots prevent an unlimited Shell command from monopolizing maintenance.

Evidence distinguishes work counts, encoded cache budgets, build output and actual interaction/frame timing. No browser frame-time claim is made by a passing typecheck or bundle build. Startup integrity scans, single-session synchronous reads, long maintenance tasks and MCP connection pooling remain separate follow-up work.
