# Dev Log 000060 — 规范重构 `data/` 本地资料库子目录与文件命名并实现无损自动升级

- **编号**：000060
- **时间**：2026-11-18 09:43:11 +08:00
- **任务名**：`vault-kebab-naming-upgrade`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 变更目标

按负责人确认的规范英文命名，调整 `data/` 本地资料库结构并兼容升级已有旧命名文件：

| 旧命名 | 新规范命名 | 用途 |
| --- | --- | --- |
| `artifacts/` | `agent-outputs/` | Agent 生产产物目录 |
| `assets/` | `user-assets/` | 用户导入与新建本地资产目录 |
| `sessions/` | `chat-sessions/` | 对话会话记录目录 |
| `memory.json` | `long-term-memory.json` | Agent 长期记忆文件 |
| `library-index.json` | `vault-index.json` | 资料库资产与产物元数据索引 |

---

## 2. 实际变更清单

- 新增 [vault-layout.ts](file:///e:/lfaa/packages/core/memory/src/vault-layout.ts)（107 行）：定义规范常量 `VAULT_DIRS`、`VAULT_FILES` 与旧命名常量，实现 `upgradeVaultLayoutInRoot`，初始化时自动将已有旧目录/文件无损迁移至新命名并重写 `vault-index.json` 中的 `relativePath`。
- 修改 [storage-manager.ts](file:///e:/lfaa/packages/core/memory/src/storage-manager.ts)（334 行）：接入 `VAULT_DIRS`、`VAULT_FILES` 与 `upgradeVaultLayoutInRoot`，同步调整目录创建、磁盘统计及 `~/.lfaa` 旧数据接管路径。
- 修改 [asset-store.ts](file:///e:/lfaa/packages/core/memory/src/asset-store.ts)（192 行）：使用 `VAULT_DIRS.artifacts`、`VAULT_DIRS.assets` 与 `VAULT_FILES.vaultIndex`。
- 修改 [index.ts](file:///e:/lfaa/packages/core/memory/src/index.ts)：接入并重导出 `VAULT_DIRS`、`VAULT_FILES`（仅在明确隔离路径 `sessionsDir`/`memoryFilePath` 测试配置外使用）。
- 修改 [memory-service.test.ts](file:///e:/lfaa/packages/core/memory/tests/memory-service.test.ts)：更新迁移目录断言为 `agent-outputs`/`user-assets`/`chat-sessions`，并新增单测 `StorageManager 自动无损升级旧版 artifacts/assets/sessions/memory.json/library-index.json 目录命名`。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **34/34 通过**（`duration_ms 1445.8983`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 451ms`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测期间访问「资料库」与「设置 → 存储」已自动触发本地 `E:\lfaa\data` 无损升级，磁盘确认已切换为 `agent-outputs`、`chat-sessions`、`user-assets`、`long-term-memory.json`（保留 `历史会话: 1`、`总占用空间: 1010 B`），截图已核验 [final_step_6.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/f6c12f1f-1f06-4a05-b283-b82d200c9f01/final_step_6.png)。
- 遵照用户保持服务运行要求，后台 `pnpm lfaa web`（`task-825`）继续在线服务于 `http://127.0.0.1:5173/`；未执行 `git commit` / `git push`。
