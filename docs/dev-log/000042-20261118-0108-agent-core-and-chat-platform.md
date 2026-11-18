# Dev Log 000042 — Agent 四大核心能力、思考-行动-检查任务循环与核心聊天模块

- **时间**：2026-11-18 01:08:12 +08:00
- **任务编号**：000042
- **审批级别**：A1（已在对话中获用户批准）

## 新增与变更文件清单

### 新增包（`packages/core/*`）
- `@lfaa/llm`（`packages/core/llm/` — **大脑 / 规划与决策**）：
  - `package.json`、`tsconfig.json`
  - `src/types.ts`、`src/openai-adapter.ts`、`src/index.ts`、`src/http-handler.ts`
  - `tests/llm-service.test.ts`
- `@lfaa/rules`（`packages/core/rules/` — **系统规则 / 项目规则 / 用户规则**）：
  - `package.json`、`tsconfig.json`
  - `src/types.ts`、`src/index.ts`、`src/http-handler.ts`
  - `tests/rules-service.test.ts`
- `@lfaa/memory`（`packages/core/memory/` — **短期会话与长期记忆能力**）：
  - `package.json`、`tsconfig.json`
  - `src/types.ts`、`src/session-store.ts`、`src/longterm-store.ts`、`src/index.ts`、`src/http-handler.ts`
  - `tests/memory-service.test.ts`
- `@lfaa/tools`（`packages/core/tools/` — **工具手脚与工作区路径沙箱**）：
  - `package.json`、`tsconfig.json`
  - `src/types.ts`、`src/sandbox.ts`、`src/builtin-tools.ts`、`src/index.ts`
  - `tests/tools-service.test.ts`
- `@lfaa/agent`（`packages/core/agent/` — **Think → Act → Check 任务循环**）：
  - `package.json`、`tsconfig.json`
  - `src/types.ts`、`src/agent-loop.ts`、`src/index.ts`、`src/http-handler.ts`
  - `tests/agent-loop.test.ts`
- `@lfaa/chat`（`packages/core/chat/` — **核心聊天服务与四栏工作台 UI**）：
  - `package.json`、`tsconfig.json`
  - `src/index.ts`、`src/http-handler.ts`
  - `client/css-modules.d.ts`、`client/locales.ts`、`client/chat-types.ts`、`client/chat-store.ts`、`client/index.tsx`
  - `client/components/ChatWorkspace.tsx`、`client/components/ChatWorkspace.module.css`
  - `client/components/StepTraceList.tsx`、`client/components/StepTraceList.module.css`
  - `client/components/AgentContextPanel.tsx`、`client/components/AgentContextPanel.module.css`
  - `client/components/AgentSettingsView.tsx`、`client/components/AgentSettingsView.module.css`
  - `tests/chat-lifecycle.test.ts`

### 跨包契约与装配更新
- `packages/ui/layout/src/index.ts`：新增 `WorkbenchChatSessionSummary` 与 `WorkbenchChatProvider` 契约。
- `packages/ui/layout/client/navigation.ts`：扩展 `RecentItem` 支持 `sessionId`、`active`、`onSelect`。
- `packages/ui/layout/client/workbench-domains.ts`：新增 `buildChatRecentItems`。
- `packages/ui/layout/client/workbench-service.ts`：新增 `registerChatProvider` 与项目非归档聊天数统计注入。
- `packages/ui/layout/client/settings-catalog.ts`：启用 `settings:config`（「模型与规则配置」）。
- `packages/ui/layout/client/locales.ts`：更新左二「最近」空态提示文案。
- `packages/ui/layout/client/components/NavigationGroups.tsx`：支持优先触发会话型最近列表条目 `onSelect`。
- `packages/ui/layout/client/components/WorkspaceBar.tsx`、`packages/ui/layout/client/components/SidebarResizeHandle.tsx`：拆分工作区顶栏与两侧拖拽手柄子组件。
- `packages/ui/layout/client/components/WorkbenchShell.tsx`（402 行，超出 400 行仅 2 行：因集中编排四栏响应式折叠、全局快捷键、会话与项目路由分派，继续拆分收益极小且结构已足够内聚）。
- `packages/workspace/workspace/client/index.tsx`、`packages/workspace/workspace/client/components/ProjectOverlays.tsx`：悬停详情卡读取实时非归档项目聊天数 `N 次聊天`。
- `apps/web/package.json`、`apps/web/src/server.ts`、`apps/web/src/main.tsx`、`package.json`：全量挂载 Host/Client 插件与 HTTP/SSE API 桥接，并将 6 个新增核心包纳入根 `typecheck`。

## 验证结果

1. **全量单元测试与集成测试**：
   - 命令：`pnpm exec tsx --test packages/core/llm/tests/llm-service.test.ts packages/core/rules/tests/rules-service.test.ts packages/core/memory/tests/memory-service.test.ts packages/core/tools/tests/tools-service.test.ts packages/core/agent/tests/agent-loop.test.ts packages/core/chat/tests/chat-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/workspace/workspace/tests/cordis-lifecycle.test.ts`
   - 结果：**26/26 通过**（0 失败，0 跳过），覆盖 LLM 脱敏持久化、规则优先级拼装、记忆写入/裁剪/召回、路径越界拦截、内置工具执行、Agent `Think → Act(人工审批) → Check` 闭环及 Host/Client 插件注册清理。
2. **全量类型检查**：`pnpm run typecheck` — 全部 12 个 `tsconfig.json` 工程通过。
3. **生产构建**：`pnpm run build` — `@lfaa/app-web` 构建通过（`built in 843ms`）。
4. **Playwright 浏览器端到端验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 验证中央聊天首页（`我们要做什么？`、模型/项目绑定选择、发送/配置控件单行对齐）、右侧上下文栏「Agent 核心能力」卡片。
   - 验证 `设置 → 模型与规则配置` 三个页签：模型列表与脱敏 Key 展示、系统规则只读 + 用户全局规则保存恢复、长期记忆增删。
   - 验证发送消息触发会话创建与真实错误反馈、左二「最近」列表联动及删除会话后恢复空态，全程 0 控制台报错。
   - 当前 `pnpm lfaa web`（`task-2369`）已启动并运行最新构建；未执行 `git commit` / `git push`。

## 风险与回滚

- **Host/Client 隔离与安全性**：API Key 仅保存在本机 `~/.lfaa/llm-config.json`，浏览器端仅获取脱敏显示；文件/命令工具通过 `resolveSafeWorkspacePath` 限制于绑定项目根目录且写/命令操作默认需人工点击批准。
- **回滚**：在 `apps/web/src/server.ts` 与 `apps/web/src/main.tsx` 移除 `@lfaa/core/*` 插件装配即可回退到纯工作区 Shell。
