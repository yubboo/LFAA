# Dev Log 000056 — 资料库/资产库本地存储、内置 Agent 读写归档与设置中心存储无损迁移联动

- **编号**：000056
- **时间**：2026-11-18 09:19:09 +08:00
- **任务名**：`library-assets-and-storage-migration`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 目标与背景

完善 LFAA 左侧导航「资料库（`library`）」与「设置中心 → 存储（`settings:storage`）」联动能力：

1. 将「资料库」建设为 **Agent 本地长期记忆库 + 个人/Agent 统一资产库**：内置 Agent 可感知当前资料库目录与近期资产，直接读取资产内容，并将 Agent 生产产物自动归档到资产库目录中。
2. 明确存储目录策略与热切换无损迁移：
   - 默认存储位置：`C:\Users\Administrator\.lfaa\data`（`join(homedir(), ".lfaa", "data")`）；
   - 项目推荐目录：`<projectRoot>\data`（例如 `E:\lfaa\data`）；
   - 用户自定义目录：自动规范化路径，若末尾非 `data` 则自动追加 `\data`；
   - 中途更改存储位置时，采用 **Copy-Verify-Switch**（复制、校验文件数与字节数、原子更新配置指针并热切换内存中的 `SessionStore` / `LongTermMemoryStore` / `AssetLibraryStore` 路径），实现无损迁移。

---

## 2. 实际变更清单

### 2.1 `packages/core/memory`（Host 存储管理、资产索引与 HTTP API）

- 修改 [types.ts](file:///e:/lfaa/packages/core/memory/src/types.ts)：新增 `LibraryItemCategory`、`LibraryAssetItem`、`SaveLibraryAssetInput`、`StorageLocationMode`、`StorageConfigState`、`StorageStats`、`StorageMigrationResult` 等契约类型。
- 修改 [session-store.ts](file:///e:/lfaa/packages/core/memory/src/session-store.ts)：补充 `setSessionsDir` / `getSessionsDir` 支持迁移后热切换会话目录。
- 修改 [longterm-store.ts](file:///e:/lfaa/packages/core/memory/src/longterm-store.ts)：补充 `setFilePath` / `getFilePath` 支持迁移后热切换长期记忆文件路径。
- 新增 [asset-store.ts](file:///e:/lfaa/packages/core/memory/src/asset-store.ts)（191 行）：实现 `AssetLibraryStore`，管理 `<dataRoot>/artifacts/<YYYY-MM-DD>/`、`<dataRoot>/assets/` 与 `library-index.json`，支持路径安全边界校验与 UTF-8 / Base64 读写。
- 新增 [storage-manager.ts](file:///e:/lfaa/packages/core/memory/src/storage-manager.ts)（290 行）：实现 `normalizeCustomDataPath`（未以 `data` 结尾时自动补全 `\data`）与 `StorageManager`，管理 `storage-config.json` 指针、旧版 `~/.lfaa/memory.json` 与 `~/.lfaa/sessions` 接管、`getStats` 磁盘统计以及 Copy-Verify-Switch `migrate` 无损迁移。
- 修改 [index.ts](file:///e:/lfaa/packages/core/memory/src/index.ts)（210 行）：将 `AssetLibraryStore` 与 `StorageManager` 接入 `MemoryService`（测试显式传入 `sessionsDir` / `memoryFilePath` 时保留 `isolatedMode` 隔离模式），暴露 `listLibraryAssets`、`saveLibraryAsset`、`readLibraryAsset`、`removeLibraryAsset`、`getStorageState`、`getStorageStats`、`migrateStorage`。
- 修改 [http-handler.ts](file:///e:/lfaa/packages/core/memory/src/http-handler.ts)（190 行）：新增 `/api/library`（`GET`、`POST`、`GET /api/library/:id`、`DELETE /api/library/:id`）与 `/api/storage`（`GET`、`POST /api/storage/migrate`、`POST /api/storage/open-explorer`）。
- 修改 [memory-service.test.ts](file:///e:/lfaa/packages/core/memory/tests/memory-service.test.ts)：新增单测 `MemoryService 管理资产库产物、自定义路径规范化与无损迁移`。

### 2.2 `packages/core/agent`（内置 Agent 资料库工具与系统提示词）

- 新增 [builtin-agent-tools.ts](file:///e:/lfaa/packages/core/agent/src/builtin-agent-tools.ts)（159 行）：拆出 `registerAgentLibraryTools`，注册 `save_memory`、`list_library_assets`、`read_library_asset` 与 `save_library_artifact` 工具并在 `stop()` 时清理。
- 修改 [index.ts](file:///e:/lfaa/packages/core/agent/src/index.ts)（292 行）：构造函数接入 `registerAgentLibraryTools(ctx)`，并在 `stop()` 中统一注销清理。
- 修改 [agent-loop.ts](file:///e:/lfaa/packages/core/agent/src/agent-loop.ts)：向系统提示词动态注入实时 `storageState.dataRoot`、`recentAssets` 摘要及 Agent 产物自动归档约束指令。
- 修改 [agent-loop.test.ts](file:///e:/lfaa/packages/core/agent/tests/agent-loop.test.ts)：补充 `LFAA 资料库/资产库本地目录` 系统提示词注入与 `list_library_assets` / `save_library_artifact` 工具注册断言。

### 2.3 `apps/web`、`packages/ui/layout` 与 `packages/core/chat`（前端视图与宿主联动）

- 修改 [server.ts](file:///e:/lfaa/apps/web/src/server.ts)：为 `memoryPlugin` 配置 `recommendedProjectDataRoot: resolve(process.cwd(), "data")`，并为 `createMemoryHttpHandler` 接入 `resolveActiveProjectRoot`。
- 修改 [settings-catalog.ts](file:///e:/lfaa/packages/ui/layout/client/settings-catalog.ts)：将 `settings:storage`（存储 / Storage）标记为 `implemented: true`。
- 修改 [chat-types.ts](file:///e:/lfaa/packages/core/chat/client/chat-types.ts) 与 [chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts)：补充资料库与存储配置类型及 `refreshLibraryAndStorage`、`saveLibraryAsset`、`readLibraryAsset`、`removeLibraryAsset`、`migrateStorage`、`pickStorageFolder`、`openStorageFolderInExplorer` 等 Store 动作。
- 修改 [locales.ts](file:///e:/lfaa/packages/core/chat/client/locales.ts)：补充资料库与存储设置中英文字典。
- 新增 [LibraryView.tsx](file:///e:/lfaa/packages/core/chat/client/components/LibraryView.tsx)（290 行，小于 400 行阈值）与 [LibraryView.module.css](file:///e:/lfaa/packages/core/chat/client/components/LibraryView.module.css)（312 行，小于 400 行阈值）：实现资料库/资产库视图（标签过滤、搜索、文件导入、新增记忆、内容预览、复制、系统目录打开与跳转存储位置设置）。
  - 行数说明：`LibraryView.tsx`（290 行）与 `LibraryView.module.css`（312 行）均超过 250 行自检线，但职责单一且均低于 400 行强约束阈值，包含中文分区注释与完整无障碍语义。
- 新增 [StorageSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/StorageSettingsView.tsx)（230 行）与 [StorageSettingsView.module.css](file:///e:/lfaa/packages/core/chat/client/components/StorageSettingsView.module.css)（200 行）：实现当前活动路径展示、5 项磁盘与条目统计卡片、3 种存储模式切换卡片（默认位置、项目推荐目录、自定义目录含文件夹选择与实时 `\data` 预览）以及无损迁移触发与校验回执展示。
- 修改 [index.tsx](file:///e:/lfaa/packages/core/chat/client/index.tsx)：注册 `"library"` 与 `"settings:storage"` 视图，将 `"agent-capabilities"` 右侧面板匹配扩展至这两个视图，并在卸载时执行清理。
- 修改 [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts)：扩展生命周期测试，验证 `"library"` 与 `"settings:storage"` 的注册及卸载清理。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **32/32 通过**（`duration_ms 964.5879`） |
| TypeScript 类型检查 | `pnpm run typecheck` | **exit code 0** |
| Web 构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 492ms`） |
| 内置浏览器实测验收 | `browser` 子代理实测 `http://127.0.0.1:5173/`（`1440x900`） | **5 项全通过**（控制台 error = 0，网络失败 = 0） |

内置浏览器实测核心路径摘要（实测完成后已回滚数据并关闭本地服务释放 `5173` 端口）：

1. 打开「资料库」确认初始路径 `C:\Users\Administrator\.lfaa\data`，写入 `"QA 资料库测试记忆"` 后右侧统计更新为 `1 条长期记忆`。
2. 点击「存储位置设置」进入「设置 → 存储」，确认 5 项统计（`长期记忆: 1`、`历史会话: 1`、`Agent 产物: 0`、`本地资产: 0`、`总占用空间: 1.2 KB`）、三种模式卡片及自定义路径输入实时拼接 `\data`（`D:\TempVault\data`）。
3. 触发无损迁移至项目推荐目录 `E:\lfaa\data`，收到回执 `已完成无损迁移与校验： E:\lfaa\data（2 files, 1.2 KB）`，切换回「资料库」确认目录与测试记忆完整保留。
4. 回滚迁移至默认位置 `C:\Users\Administrator\.lfaa\data`（`2 files, 1.2 KB`），删除测试记忆后恢复 `0 条长期记忆`。
5. 观察项记录：浏览器实测时，自定义目录卡片需直接点击单选控件激活（Playwright 点击外层容器未触发单选切换），已在后续迭代按需关注交互热区覆盖。

---

## 4. 风险与范围说明

- 本轮未执行 `git commit` 或 `git push`，严格遵守仓库规范。
- 涉及多端/大组件样式行数超过 250 行但均低于 400 行，已在本日志备案；已停止后台测试用 `pnpm lfaa web`（`task-559`）以释放端口。
