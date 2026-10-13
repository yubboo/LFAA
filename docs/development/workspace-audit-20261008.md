# Workspace review and repairs (2026-10-08)

[简体中文](workspace-audit-20261008.zh.md) · [Documentation](../README.md)

The review covers the current `H:/LFAA1` checkout. The user-selected `H:/deepseek-harness` was read only for structure and documentation organization. Existing uncommitted desktop-update work is preserved; no product release, installation, restart or data migration was performed.

The [Chinese review](workspace-audit-20261008.zh.md) provides a finding-by-finding assessment of GLM 5.3. Confirmed defects include Shell-induced maintenance starvation, Windows Electron termination without lifecycle IPC, retained Session bodies, duplicated Settings contracts, missing package declarations/entries, missing CI, Windows credential ACLs and documentation drift.

Repairs separate Shell and maintenance lanes, connect Electron to existing shutdown IPC, bound Session body caching to eight sessions/32 MiB, select up to 200 owned headers without restoring full Kernels, centralize Settings types/defaults/write validation and background metadata, regenerate workspace maps/inventory, introduce checks/CI and remove the force-push menu entry. The existing update-surface opacity now has save validation.

Managed-process termination is checked after the existing fallback; an unconfirmed exit causes failure rather than permitting installation. Three MCP/Skill test files now isolate data before loading Host modules. KaTeX direct and Markdown dependencies use the maintainer's fixed 0.18.2 release; a real rendering regression verifies that inherited trust does not enable image inclusion.

Some GLM conclusions need correction: directory projects are deliberately limited to Workspace/Minecraft; the unlimited command default is an explicit setting; private package versions are not product release versions; historical version resets must remain recorded; Workbench border overrides preserve configured contrast.

The documentation tree now separates user, subsystem, development, reference, language and archive topics, with paired English/Chinese guides. Earlier authorities retain their paths; 171 historical contracts retain IDs, anchors and index links. Historical records remain in their original language. An unrelated CAD attachment and redundant markers were removed; user data, requested placeholders, old releases and backups remain.

Remaining work includes long maintenance-task contention, growing metadata indexes/startup scans, persistent compaction, core domain adapters and large-file modularization. Session message paging and MCP connection pooling are implemented. A later follow-up makes each page use one asynchronous full-chain scan and pins remote-production MCP connections to validated public DNS results; the per-page scan remains O(n) in log size, and real MCP acceptance remains unverified. See the [current plan](../开发计划.md). Publishing still requires ready assets before announcing a version.

No real desktop exit/upgrade, live Minecraft stop, Provider/MCP integration, browser frame-time measurement, remote CI run or additional platform package acceptance is claimed. Final local results are recorded in the Chinese review. The [file manifest](workspace-audit-files-20261008.md) lists every changed path and responsibility.

Local results from the original review: 114 CLI tests, a final seven-test shutdown group (four repeated), all 52 Electron tests and six engineering/security tests passed. Client/Host type checks, isolated Web/Host builds, workspace/document checks and peer checks passed. The production dependency audit returned no known advisories for 439 entries; development dependencies were not fully audited. The follow-up below records additional checks.

## Follow-up: four remaining code gaps

The Tauri compatibility shell now requests the shared app-boot shutdown over stdin and waits for the child process; timeout or nonzero exit does not force-kill it. Session APIs and both AI Work chats support stable cursor paging. MCP sessions are pooled by user, App and full server configuration with a 32-connection cap and 30-second idle expiry. Web dependencies are split into independent chunks, including Shiki's C++ macro and regex modules; the entry file is about 19.2 kB (6.3 kB gzip), while the lazy C++ grammar remains about 501.3 kB (33.5 kB gzip) and still triggers Vite's warning. Entry size does not represent total initial transfer, and browser frame time was not measured.

Follow-up checks: Client/Host TypeScript checks, targeted Session/MCP/Capability/Agent Loop regressions, an isolated Web build, and development plus release `cargo check` for the Windows MSVC target completed locally. No real desktop install/upgrade or close, live Minecraft stop, real user MCP service, browser interaction/frame-time measurement or remote CI run was accepted. No active service was restarted, real user data changed, or release/commit performed.

## Follow-up: MCP egress and Session paging

Remote production control planes validate every resolved MCP address and pin the HTTP(S) connection to the validated result; mixed public/private DNS answers are denied. Desktop, explicit local-CLI loopback and development/test loopback modes retain access to local MCP servers, and redirects remain rejected.

Session pages now perform one asynchronous stream pass over the JSONL chain, preserving full SHA-256 verification. The extra scan working set uses a 64 KiB read buffer, the current event and at most 101 sorted message candidates; maintaining that candidate window uses binary insertion instead of sorting after every message. Each page still reads the full log (O(n) in log size), and the repository's transaction-deduplication index still grows with historical transactions.

Current targeted checks: MCP tests 2/2, Session paging/cache test 1/1, authenticated Web Profile API test 1/1 and Host typecheck passed. The integration test now waits with a fixed bound for asynchronous memory persistence and reads token totals through the Session Owner API instead of the retired SQLite `ai_usage` table. An isolated fixture with 130 messages in two events produced a 32,866-byte log; one limit-50 page created one read stream, scanned all 32,866 bytes and returned 50 messages. Real long-session time/memory curves were not measured. Remote multi-account deployment and real MCP/browser/desktop behavior remain unverified.
