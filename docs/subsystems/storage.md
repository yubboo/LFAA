# Storage ownership

[简体中文](storage.zh.md) · [Documentation](../README.md)

The [Chinese storage guide](storage.zh.md) records the complete storage contracts and migration evidence. All data stays within the configured `LFAA_DATA_DIR`; this reorganization does not move or merge user data.

Account preferences use their existing Configuration owner and user-scoped JSON layout. Structured configuration, encrypted Provider credentials and relational domain metadata retain their existing SQLite tables. Session events and messages remain authoritative JSONL. Images, Markdown bodies and workflow files remain user-scoped files. The Storage Hub registers named backends; it does not replace domain ownership.

The Session repository verifies the hash chain before projecting data and fails closed on missing committed history. Cached bodies are limited to eight sessions and 32 MiB of encoded records. Cold reads revalidate logs. SQLite selects up to 200 owned headers; list rendering uses a lightweight plan-state projection instead of restoring every Kernel. Header and transaction indexes, startup scanning and individual log sizes remain growth limits to address separately.

Credential directories use POSIX 0700 or Windows protected ACLs restricted to the current OS account, SYSTEM and Administrators. Failure to set protection stops key access/creation. Passwords, recovery secrets and Provider credentials retain the existing hashing/encryption and account boundaries.

Migration markers, revision checks and backups remain mandatory. Never reset malformed data to fabricate success, replay unknown tool side effects or clean other checkouts based on historical paths.
