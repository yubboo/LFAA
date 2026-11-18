# Dev Log 000066 — 实现 LFAA 内置 Git 引擎、编码设置（Git 与代码审查）及代码审查工作台

- **编号**：000066
- **时间**：2026-11-18 10:57:49 +08:00
- **任务名**：`builtin-git-and-code-review`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 功能架构与设计

1. **Host 内置 Git 与编码配置服务（`@lfaa/chat/src` + `@lfaa/app-web`）**：
   - 新增持久化配置存储 `~/.lfaa/coding-settings.json`，管理 **Git** 配置（`branchPrefix` 默认 `lfaa/`、`prMergeMethod`、`alwaysForcePush`、`createDraftPr`、`reviewDisplayMode`、`commitInstructions`、`prInstructions`）与 **代码审查** 配置（`activeSubTab`、`repoProvider`、`autoReview`、`triggerCondition`、`thoroughReview`、`useQuotaForReview`、`reviewAgentFocus`、`customReviewInstructions`、`repoOverrides`）。
   - 新增基于原生 `git` 子进程（安全参数数组 + 路径与分支名校验，无命令注入）的内置 Git 引擎：自动探测当前工作区与绑定本地项目仓库、解析状态/分支/提交历史/Unified Diff、按分支前缀创建或切换分支、暂存/取消暂存、按提交指引生成提交草案、真提交与生成 PR 草案。
   - 新增内置代码审查引擎：逐文件与逐新增行检查冲突标记、疑似密钥泄漏、类型放宽、调试残留与空异常捕获等风险并持久化至 `~/.lfaa/code-reviews.json`，同时支持在聊天框使用 `/review` 一键触发并遵循「内联 / 单独」展示方式。
2. **设置中心与代码审查工作台（`@lfaa/ui-layout` + `@lfaa/chat/client`）**：
   - 在设置中心 `编码` 分组下新增 `代码审查`（`settings:codeReview`）与 `Git`（`settings:git`）两项设置页面，支持真实仓库清单检测、单仓策略切换与分级个人偏好配置。
   - 升级左一/左二「代码审查」域为真实双栏工作台（`工作区变更与 Diff` / `提交记录与分支` / `代码审查报告`），与 `Git 设置` / `代码审查设置` 互通。

---

## 2. 实际变更清单

- **Host 服务与 HTTP 接口**：
  - [coding-settings.ts](file:///e:/lfaa/packages/core/chat/src/coding-settings.ts)（177 行，新增）：编码设置规范化与 `~/.lfaa/coding-settings.json` 持久化。
  - [git-service.ts](file:///e:/lfaa/packages/core/chat/src/git-service.ts)（395 行，新增，低于 500 行强约束阈值；职责聚焦 Git CLI 封装与状态/Diff/提交/PR 草案，后续若新增 worktree 管理可继续独立拆文件）：Git 仓储发现与安全操作核心服务。
  - [review-service.ts](file:///e:/lfaa/packages/core/chat/src/review-service.ts)（243 行，新增）：Unified Diff 审查规则引擎与 `~/.lfaa/code-reviews.json` 历史管理。
  - [git-http-handler.ts](file:///e:/lfaa/packages/core/chat/src/git-http-handler.ts)（161 行，新增）：提供 `/api/chat/coding-settings`、`/api/git/*` 与 `/api/code-review/*`。
  - [index.ts](file:///e:/lfaa/packages/core/chat/src/index.ts) 与 [server.ts](file:///e:/lfaa/apps/web/src/server.ts)：挂载并装配编码设置、内置 Git 与审查 API 路由。
- **UI 布局与前端工作台**：
  - [settings-catalog.ts](file:///e:/lfaa/packages/ui/layout/client/settings-catalog.ts) 与 [DomainSidebarMenu.tsx](file:///e:/lfaa/packages/ui/layout/client/components/DomainSidebarMenu.tsx)：挂载 `settings:codeReview`、`settings:git` 及 `codeReview` 领域左二菜单。
  - [GeneralSettingsControls.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsControls.tsx)：`SettingGroupCard.title` 设为可选以复用无标题分组卡片。
  - [coding-settings-client.ts](file:///e:/lfaa/packages/core/chat/client/coding-settings-client.ts)（238 行，新增）、[GitSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/GitSettingsView.tsx)（167 行，新增）、[CodeReviewSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewSettingsView.tsx)（309 行，新增，低于 400 行强约束阈值，复用公共设置卡片控件）。
  - [CodeReviewView.tsx](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewView.tsx)（339 行，新增，低于 400 行强约束阈值；已将左右两栏拆分为 [CodeReviewListPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewListPane.tsx) 162 行 与 [CodeReviewDiffPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewDiffPane.tsx) 104 行）、[CodeReviewView.module.css](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewView.module.css)（300 行，新增，低于 400 行强约束阈值）与 [CodingSettingsExtras.module.css](file:///e:/lfaa/packages/core/chat/client/components/CodingSettingsExtras.module.css)（136 行，新增）。
  - [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx) 与 [index.tsx](file:///e:/lfaa/packages/core/chat/client/index.tsx)：接入 `/review` 斜杠指令支持并注册 3 个新视图。
- **测试文件**：
  - [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts)：补充 `settings:git` / `settings:codeReview` / `codeReview` 视图注册卸载断言，以及临时 `git init` 真仓分支前缀新建、暂存、代码审查检出、提交与 `--force-with-lease` PR 草案端到端测试。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test` 覆盖全部 10 个测试文件 | **38/38 通过**（`duration_ms 2459.9249`） |
| TypeScript 类型检查 | `pnpm run typecheck` | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 972ms`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验（`browser` 子代理 `977a0475-a59e-4ff6-bdd9-8932102d99a4`）：
  1. `设置 → 编码 → Git` 与 `设置 → 编码 → 代码审查` 全部控件、切换开关、真实代码仓库发现（`yubboo/LFAA · main · 111 变更`）、单仓策略切换与子标签页切换全部可用且无报错。
  2. `内置 Git 与代码审查` 工作台可正常展示工作区 111 项变更、`apps/web/src/server.ts` 着色 Diff、提交历史、提交信息草案、PR 草案与真实代码审查报告（`共审查 13 个变更文件（+900 / -139 行），未发现阻塞性风险。`），且经二次 CSS 防溢出修复后左侧清单与历史报告卡片无横向滚动裁剪。
  3. 最终验收截图见 [final_step_53.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/977a0475-a59e-4ff6-bdd9-8932102d99a4/final_step_53.png)。
- Web 服务 `pnpm lfaa web`（`task-1354`）已保持在后台运行，可随时访问 `http://127.0.0.1:5173/`。
