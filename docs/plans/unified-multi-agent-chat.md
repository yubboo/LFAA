# 开发方案：单聊与多 Agent 群聊合二为一（统一主聊天工作区）

> 状态：待负责人评审确认后开工（A1 架构收口与体验统一）。

## 1. 核心理念

彻底取消「单聊一套界面 + 独立群聊页另一套界面」的割裂结构，统一为**一套主聊天工作区（`ui-chat`）**：
- **一个会话 = 1 个用户 + N 个 Agent**：
  - **N = 1**：单聊（默认小鱼，或任选一个自定义角色 / 本机 CLI 代理如 Claude Code、Codex、Antigravity）。
  - **N ≥ 2**：同一会话自动成为**多 Agent 协作群聊**——保留同一个左二项目/会话树、同一个右侧工作台（无限画布/终端/预览/代码审查）、同一套流式消息/代码块/工具活动行/审批弹窗/停止按钮。

---

## 2. 调研与参考（强制 §0）

- **问题与关键词**：`unified single and multi-agent chat session`、LFAA 既有 `packages/client/ui-chat`、`packages/core/agent-group`、`packages/core/session`。
- **独立来源（查阅日期：2026-11-28）**：
  1. Slack / Discord / Linear 的「单聊随时拉人升级为群组协作」模式（零页面切换、上下文连续）。
  2. Ekko Studio 多 Agent 协作时间线模型（不同 Agent 共享同一对话时间线与项目上下文）：https://github.com/EKKOLearnAI/ekko-studio
  3. 本仓既有能力：`ChatSessionRecord` 已原生支持 `kind: "single" | "group"`、`group.agentIds`、`ChatMessageRecord.authorAgentId` 与 `speakerTask`，`packages/core/agent-group` 的 `GroupTurnHub` 已支持 SSE 流式转发与中途停止。
- **方案取舍**：
  - **方案 A（选定）**：把多 Agent 成员管理、分工标签、`@` 指定发言与多成员流式执行直接并入主聊天工作区（`ui-chat`），下掉左一栏孤立的独立「群聊」入口，群聊会话统一显示在左二项目/最近列表里。
  - **方案 B（拒绝）**：继续在左一栏独立维护第二套 `ui-agent-group` 聊天页，重复造轮子且无法复用主聊天的审批、活动行、工作树与右侧工作台。

---

## 3. 具体设计

### 3.1 会话顶栏：极简「协作 Agent 成员」入口（`ChatTopBar`）
- 在主聊天顶栏新增轻量的 **成员胶囊 + `+ 拉成员`** 弹窗（`SessionMembersPopover.tsx`）：
  - 默认展示当前会话的 1 位 Agent（如 `小鱼`），点开可**一键切换**或**勾选拉入多位成员**（支持内置小鱼 + 自定义角色 + 已安装的本机 CLI `Claude Code` / `Codex` / `Antigravity`）。
  - 当勾选 ≥ 2 位成员时：
    - 可为每位成员填写一句可选**分工说明**（如「策划」「写后端」「代码审查」），持久化在 `session.group.memberRoles?: Record<string, string>`；
    - 顶栏紧凑展示当前协作小队胶囊（例如 `小鱼 + Claude Code`），随时增删成员；删回 1 位时无缝退回单聊。
  - 新聊天草稿态（未发首条消息前）同样支持先拉好小队，发第一条消息时自动带上 `kind: "group"` 与 `group` 元数据创建会话。

### 3.2 输入区与发送链路：同一套输入框、同一条流式引擎
- **输入框 `@` 成员协同**：当当前会话有 ≥ 2 位成员时，输入区上方轻量展示成员 `@` 快捷胶囊（也可直接在输入框打 `@` 触发成员补全），点击或输入 `@Claude 写接口 @Codex 做审查` 即可指定顺序。
- **统一发送与流式渲染（`chat-run-actions.ts`）**：
  - **N = 1**：走现有 `/api/agent/runs` 单聊链路，100% 保持原样。
  - **N ≥ 2**：走 `/api/group/runs`（`stream: true`）+ `/api/group/turns/:turnId/events` SSE，直接把每个发言成员的 `speaker_started` / `delta` / `step_update` / `speaker_finished` 写入主聊天 `activeSession.messages`！
  - **同一套消息 UI**：主聊天 `AssistantMessageItem` 读取 `message.authorAgentId` 与 `message.speakerTask`，当会话有多个成员时在助手回复顶部清晰展示发言者徽章（如 `小鱼` / `Claude Code · CLI` + 分工标签），其余 Markdown、代码块、思考块、工具活动行、权限审批、停止按钮 **100% 复用主聊天**。
  - **停止按钮**：点同一个「停止」按钮时，若当前是群聊回合则调用 `POST /api/group/turns/:turnId/abort`，立即中止当前发言者并取消后续排队成员。
  - **主持人分工增强**：在 `packages/core/agent-group/src/orchestrator.ts` 中，若成员配置了分工（`memberRoles`），自动带给主持人规划提示词与每位发言者的 `speakerTask`，实现「按分工自动协作」；若主持人模型未配置 API Key 或规划失败，稳健降级为按成员列表顺序依次执行，绝不卡死。

### 3.3 收口界面复杂度
- 从 `apps/web/src/main.tsx` 移除左一栏孤立的 `agentGroupClientPlugin` 导航入口（避免出现两套互相打架的聊天页），并同步更新 `scripts/verify-web.mts` 校验主聊天顶栏的「协作 Agent 成员」拉人入口与多成员协作态。
- 左二会话列表对 `kind === "group"` 的会话显示群聊小图标，归属在对应的项目或最近列表下。

---

## 4. 验收标准

1. 左一栏不再出现孤立的独立「群聊」页，界面清爽统一。
2. 在任意项目（或默认工作区）的主聊天顶栏点击成员按钮，可直接把 `小鱼`、`Claude Code (CLI)`、`Codex (CLI)` 或自定义角色拉进同一个会话并设置分工，顶栏实时显示协作小队。
3. 多成员会话中发送消息（支持 `@` 指定顺序或不 `@` 自动按分工接力），在主聊天时间线中以同一套 Markdown / 工具活动行 / 停止按钮实时流式输出，每条回复清晰标注发言 Agent。
4. 浅色与深色双主题内置浏览器实测通过（0 控制台报错），`pnpm build`、`pnpm check`、`pnpm lint`、`pnpm verify:web` 及单元测试全部通过。
