# 右侧工作台重构、内置浏览器、后台任务与多 Agent 协作方案

| 项目 | 内容 |
| --- | --- |
| 状态 | 已确认并完成三期实施与验收（2026-11-19） |
| 日期 | 2026-11-19（Asia/Shanghai） |
| 实施级别 | A1（新增 Host/Client 能力包、引入 `playwright-core` 依赖、重构右栏面板与 Agent 协作通道） |

## 1. 目标与范围

将 LFAA 现有的单一「工作详情」右侧栏重构为工作台控制台（对齐参考图），并按 DSH 架构模式补齐三项核心运行能力：

1. **右侧菜单栏重构（`@lfaa/chat/client`）**：提供顶栏搜索/直达 URL、快捷功能入口（审查、打开文件、终端、浏览器、侧边提问、扩展）、实时「子智能体」列表与「后台任务」列表，同时保留原有工作详情与多标签页文件预览（[WorkspaceFileTabs.tsx](../../packages/client/ui-chat/client/workbench/WorkspaceFileTabs.tsx)）。
2. **后台任务系统（`@lfaa/jobs`）**：参考 DSH `jobs` / `jobs-local` / `tool-jobs`，支持会话级隔离的后台命令行进程、实时 stdout/stderr（复用 `@lfaa/shell-env` 编码解码）、状态追踪与停止清理。
3. **内置浏览器（`@lfaa/browser`）**：参考 DSH `browser-use` 的独占服务注册模式 + `playwright-core`（方案 A：优先复用本机已安装的 Microsoft Edge / Google Chrome，不下载冗余浏览器二进制），为小鱼 Agent 提供完整的网页浏览、DOM 交互与控制台排错工具，并在右栏实时可视化呈现与支持人工接管。
4. **子智能体与多 Agent 协作（`@lfaa/subagent`）**：参考 DSH `subagent` / `subagent-spawn-in-process` / `tool-subagent`，允许主 Agent 派发、并行执行与消息协调多个隔离的子智能体完成调研、代码审查或浏览器自测任务。

### 不修改的范围

- 四栏 Shell（`@lfaa/ui-layout`）的栏位顺序、宽度计算与拖拽/吸附机制保持不变。
- `@lfaa/chat` 现有流式消息时间线（`AssistantTimeline`）、`@lfaa/skills`、本地 Git 审查核心逻辑保持兼容不破坏。
- 运行时不直接引用 `E:\lfaa1\deepseek-harness` 本地磁盘路径。

## 2. 右侧栏交互与界面契约

```text
┌──────────────────────────────────────┐
│ 🔍 搜索或输入 URL                  ⋮ │  ← 过滤动作/任务；输入 http(s):// 回车直达浏览器
├──────────────────────────────────────┤
│ 📄 审查                              │  ← 切换至右栏内嵌代码审查快捷视图
│ 📑 打开文件                          │  ← 切换至 WorkspaceFileTabs（未选文件时列最近变更）
│ 🖥 终端                              │  ← 切换至当前会话命令/后台任务实时输出流
│ 🌐 浏览器                            │  ← 切换至内置浏览器控制面板（画面、URL、控制台、接管）
│ 💬 侧边提问                          │  ← 轻量侧边问答面板（独立于主聊天流）
│ 🧩 扩展                           >  │  ← 跳转扩展/技能中心
├──────────────────────────────────────┤
│ 子智能体  N                          │
│  ✓ Browser UI Verifier               │  ← 实时状态（运行中/完成/失败），点击看过程与结论
├──────────────────────────────────────┤
│ 后台任务  N                          │
│  ▣ Run typecheck and build           │  ← 实时状态，点击看实时日志，支持终止与「查看全部」
│  查看全部                            │
└──────────────────────────────────────┘
```

- **总览与子视图切换**：点击任意入口在右栏内部切换至对应视图，顶部提供「← 返回控制台」条；点击主聊天里的文件变更仍直接打开 `打开文件`（`WorkspaceFileTabs`）。`⋮` 菜单保留打开「工作详情（模型/工具/权限/记忆/规则）」与跳至设置页的入口。
- **双主题与窄屏**：全部采用 `@lfaa/ui-theme` 语义 CSS 变量，无硬编码色值；在 `<= 1023px` 窄屏下沿用现有右栏抽屉契约。

## 3. 公开契约与工具接口

### 3.1 `@lfaa/jobs`（`packages/core/jobs`）

- **Cordis 服务**：`ctx.jobs`（`JobsService`），按 `sessionId` 隔离管理后台进程生命周期；Host 停机或会话中止时自动回收子进程与定时器。
- **Agent 工具**：
  - `start_background_task`（`permissionLevel: "exec"`）：启动后台命令，返回 `taskId`、`status` 与初始输出。
  - `get_background_task`（`permissionLevel: "read"`）：按 `taskId` 读取最新增量/尾部日志（有长度上限）与退出码。
  - `list_background_tasks`（`permissionLevel: "read"`）：列出当前会话登记的后台任务。
  - `stop_background_task`（`permissionLevel: "exec"`）：停止指定后台任务。
- **HTTP/SSE 接口**：`GET /api/jobs?sessionId=...`、`GET /api/jobs/:id`、`POST /api/jobs/:id/stop`。

### 3.2 `@lfaa/browser`（`packages/core/browser`）

- **Cordis 服务**：`ctx.browserUse` 独占注册槽位（借鉴 DSH `BrowserUseRegistry`）+ `ctx.browser`（基于 `playwright-core` 优先连接本机 `msedge` / `chrome`，无头或按需可见切换，每个会话独立 `BrowserContext`）。
- **Agent 工具**：
  - `browser_navigate`（`url`）：打开或跳转网页，校验仅允许 `http://` / `https://`（本地 `127.0.0.1` / `localhost` 归为 `read` 或快速放行，外网跳转/交互遵循当前权限模式）。
  - `browser_snapshot`：返回页面标题、URL、可交互元素索引清单（`[e1] button "登录"`）与页面关键文本。
  - `browser_click` / `browser_type` / `browser_scroll` / `browser_press_key`：通过元素索引或 CSS 选择器操作页面。
  - `browser_screenshot`：截取当前可视区域并返回图片路径与 DataURL/资源链接，同时更新右栏实时画面。
  - `browser_console`：返回累计 Console 错误/警告与失败 HTTP 请求（`status >= 400`）。
- **人工接管与安全边界**：
  - 严格禁止绕过验证码、反爬校验或自动完成支付；遇到登录/验证码时，Agent 应暂停并提示用户，用户在右栏「浏览器」面板操作完成后点击「继续让 Agent 执行」。
  - 提供 `/api/browser/state`、`/api/browser/navigate`、`/api/browser/screenshot`、`/api/browser/control` 供右栏与输入栏 `+` 菜单（`ctxBrowser`）及设置页 `settings:browser` 接入。

### 3.3 `@lfaa/subagent`（`packages/core/subagent`）

- **Cordis 服务**：`ctx.subagent`（`SubagentService`），复用 `executeAgentTaskLoop` 在进程内启动独立子上下文；子智能体继承同一授权工作区，可指定角色（`role`）、只读/读写能力范围（默认不允许子智能体递归无限创建子智能体，设置最大深度 `maxDepth = 1` 与默认步数保护）。
- **Agent 工具**：
  - `invoke_subagent`（`role`、`prompt`、`mode?: "read" | "write"`、`wait?: boolean`）：创建并启动子智能体；支持同时发出多个只读子任务并发执行。
  - `message_subagent`（`subagentId`、`message`）：向指定子智能体追加指示或唤醒。
  - `list_subagents` / `stop_subagent`：查询状态摘要或终止指定子智能体。
- **HTTP 接口**：`GET /api/subagents?sessionId=...`、`GET /api/subagents/:id`、`POST /api/subagents/:id/stop`。

## 4. 分期实施计划与文件清单

| 阶段 | 拟新增 / 修改范围 | 验收标准 |
| --- | --- | --- |
| **第 1 期：后台任务 + 右栏重构** | 新增 `packages/core/jobs/`（`package.json`、`tsconfig.json`、`src/`、`tests/`）；重构 `packages/core/chat/client/components/AgentContextPanel.tsx`（及拆分子面板组件与 CSS Modules），接入 `apps/web/src/server.ts`。 | 右栏在深/浅主题与窄屏下按参考图展示搜索/URL 栏、6 个入口、`后台任务` 列表与原「工作详情」切换；小鱼 Agent 可启动后台任务、读日志并手动停止，会话隔离且无遗留僵尸进程。 |
| **第 2 期：内置浏览器（方案 A）** | 安装 `playwright-core` 至 `packages/core/browser/`；实现 `BrowserUseRegistry` + Edge/Chrome 驱动 + 7 个浏览器工具 + HTTP 接口；实现右栏「浏览器」实时画面/导航/控制台/人工接管面板；打通 `ComposerAddMenu` `ctxBrowser` 与 `settings:browser`。 | 小鱼 Agent 能自行打开 `http://127.0.0.1:5173`（或测试页）、快照元素、点击交互、截图并检查控制台零报错；右栏实时同步显示画面并支持人工暂停接管。 |
| **第 3 期：子智能体与多 Agent 协作** | 新增 `packages/core/subagent/`（进程内子运行调度、并发限制、工具注册、HTTP 接口）；在右栏接入 `子智能体` 实时列表与详情抽屉；在 `apps/web` 与 `@lfaa/agent` 完成装配。 | 主 Agent 可并发派发 2 个子智能体完成独立调研并汇总结果；右栏实时显示状态与结果，支持停止与清理，无内存/句柄泄漏。 |

## 5. 风险评估与回滚办法

- **风险**：
  1. `playwright-core` 依赖本机安装的 Edge/Chrome 路径；若部分机器未安装，需在 `browser` 初始化与 `settings:browser` 给出明确提示与自定义可执行路径配置。
  2. 后台进程与浏览器实例若未绑定 AbortSignal/Cordis `ctx.effect`，热重载或停止服务时可能残留进程。方案强制要求所有子进程和 `BrowserContext` 挂载到 Cordis 生命周期及会话清理钩子。
  3. 多 Agent 并发执行可能提高模型 API 速率消耗，需限制单会话并发子智能体上限（默认最多 4 个）并支持一键停止。
- **回滚办法**：三期能力均以独立 Cordis 服务与可选右栏视图装配，每期在 `apps/web/src/server.ts` 移除对应插件注册并还原右栏入口即可完全回滚，不影响现有聊天记录与既有文件预览功能。
