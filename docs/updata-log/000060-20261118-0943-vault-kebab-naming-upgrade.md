# Update Log 000060 — 优化 `data/` 数据目录规范命名并无损自动升级

- **编号**：000060
- **时间**：2026-11-18 09:43:11 +08:00
- **对应 Dev Log**：[000060-20261118-0943-vault-kebab-naming-upgrade.md](file:///e:/lfaa/docs/dev-log/000060-20261118-0943-vault-kebab-naming-upgrade.md)

---

## 更新内容

1. **统一规范英文命名**
   - `data/` 下目录与文件升级为：`agent-outputs/`（Agent 产物）、`user-assets/`（用户资产）、`chat-sessions/`（历史对话）、`long-term-memory.json`（长期记忆）与 `vault-index.json`（资料库索引）。

2. **旧数据无损自动升级**
   - 已有旧目录（`artifacts` / `assets` / `sessions` / `memory.json` / `library-index.json`）在启动访问时会自动无损重命名迁移至新命名，不丢失任何记忆、会话或资产内容。
