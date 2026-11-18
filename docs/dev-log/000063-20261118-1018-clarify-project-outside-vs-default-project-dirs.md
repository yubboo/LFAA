# Dev Log 000063 — 明确区分「项目外聊天（`~/.lfaa`）」与「默认新建项目目录（`<系统文档>/lfaa`）」

- **编号**：000063
- **时间**：2026-11-18 10:18:39 +08:00
- **任务名**：`clarify-project-outside-vs-default-project-dirs`
- **状态**：已完成修改、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 设计纠正与职责划分

此前将 `<系统文档>\LFAA` 误挂在「项目外聊天文件夹」下；现严格按职责拆分为互不混淆的三层结构：

1. **项目外聊天 / 应用数据文件夹（类似 `.codex`）**：`C:\Users\<当前用户>\.lfaa`
   - 未关联任何项目、直接开「新聊天」时默认使用此目录；
   - **所有历史会话文件**（无论项目内或项目外发起的聊天）均固定存放在 `C:\Users\<当前用户>\.lfaa\sessions\`，通过会话记录中的 `projectId` 区分关联项目，绝不混入具体项目源码目录。
2. **默认新建项目目录**：`<系统文档>\lfaa`（如实测环境下自动识别为 `D:\Documents\lfaa`）
   - 在侧栏「+ 创建新项目」仅填写项目名称、不添加源文件夹时，自动在此目录下新建同名项目文件夹（如 `app1`），**仅存项目本身文件，不存聊天会话**，且可在「设置 → 常规 → 默认新建项目目录」修改基础路径。
3. **资料库与资产库目录（`data/`）**：默认 `~/.lfaa\data`
   - 存放 `agent-outputs/`、`user-assets/`、`long-term-memory.json` 与 `vault-index.json`，可在「设置 → 存储」无损迁移到当前项目根目录下的 `\data` 或任意自定义目录。

---

## 2. 实际变更清单

- 修改 [general-settings.ts](file:///e:/lfaa/packages/core/chat/src/general-settings.ts)（263 行）与 [index.ts](file:///e:/lfaa/packages/core/chat/src/index.ts)：拆分 `outsideProjectFolder`（默认 `~/.lfaa`）与 `defaultProjectsFolder`（默认 `<MyDocuments>\lfaa`），增加 `schemaVersion: 2` 自动升级逻辑以纠正先前保存的旧 v1 配置。
- 修改 [index.ts](file:///e:/lfaa/packages/workspace/workspace/src/index.ts) 与 [server.ts](file:///e:/lfaa/apps/web/src/server.ts)：为 `@lfaa/workspace` 增加 `defaultProjectsDirResolver`，从「设置 → 常规」动态读取 `defaultProjectsFolder` 作为按名称新建项目的默认基础目录。
- 修改 [general-settings-client.ts](file:///e:/lfaa/packages/core/chat/client/general-settings-client.ts)、[GeneralSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsView.tsx) 与 [GeneralSettingsGeneralGroup.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsGeneralGroup.tsx)（306 行，低于 400 行强约束阈值）：在「常规」设置中并列提供「项目外聊天文件夹（`~/.lfaa`）」与「默认新建项目目录（`<系统文档>\lfaa`）」的查看与更改功能。
- 修改 [types.ts](file:///e:/lfaa/packages/core/memory/src/types.ts)、[storage-manager.ts](file:///e:/lfaa/packages/core/memory/src/storage-manager.ts)、[chat-types.ts](file:///e:/lfaa/packages/core/chat/client/chat-types.ts) 与 [StorageSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/StorageSettingsView.tsx)：在「设置 → 存储」增加「应用数据文件夹（类似 `.codex`）：`~/.lfaa`」展示。
- 修改 [locales.ts](file:///e:/lfaa/packages/workspace/workspace/client/locales.ts)：更新新建项目弹窗底部提示文案。
- 修改 [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts) 与 [cordis-lifecycle.test.ts](file:///e:/lfaa/packages/workspace/workspace/tests/cordis-lifecycle.test.ts)：验证 `resolveDefaultOutsideProjectFolder()`、`resolveDefaultProjectsFolder()` 与 `defaultProjectsDirResolver` 创建项目行为。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **36/36 通过**（`duration_ms 2625.7538`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 1.39s`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验：`设置 → 常规` 显示 `项目外聊天文件夹: C:\Users\Administrator\.lfaa` 与 `默认新建项目目录: D:\Documents\lfaa`；`设置 → 存储` 显示 `当前资料库目录: E:\lfaa\data`、`应用数据文件夹: C:\Users\Administrator\.lfaa` 与 `历史会话目录: C:\Users\Administrator\.lfaa\sessions`；新建项目弹窗提示同步生效并正常取消关闭（最终截图见 [final_step_16.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/908fa449-ad25-4228-9d46-6b37013c246c/final_step_16.png)）。
- 后台 `pnpm lfaa web`（`task-1087`）保持在线服务于 `http://127.0.0.1:5173/`；未执行 `git commit` / `git push`。
