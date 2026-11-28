# 开发方案：Agents 统一管理（CLI 运行时 + 角色）与群聊完整版升级

> 状态：待负责人评审确认后开工（A1 跨包功能升级）。

## 1. 目标与背景

结合此前已落地的 `/api/cli-agents/*` 宿主探测、多账户隔离与官方 CLI 流式执行能力（`DEV-000698`），分两阶段解决当前两处断层：
1. **Agents 管理层断层**：当前 `Agents` 页只管理自定义角色 + API 模型绑定，而本机 CLI 运行时（`Claude Code`、`Codex`、`Antigravity` 等）藏在设置中心里，自定义角色也无法直接绑定本机 CLI 执行引擎。
2. **群聊体验半成品**：当前 `packages/core/agent-group` 的多成员编排骨架已就绪，但前端 [Group-View.tsx](../../packages/client/ui-agent-group/client/view/Group-View.tsx) 仍采用 1.2s 轮询、仅渲染纯文本、无法中途停止、不能绑定工作区项目，也无法把本机 CLI 代理直接拉进群聊协作。

---

## 2. 调研与参考（强制 §0）

- **问题与关键词**：`EKKOLearnAI/ekko-studio agent management group chat cli`、`stablyai/orca multi-agent cli`、LFAA 既有 `packages/core/agent-profile`、`packages/core/agent-group`、`packages/client/ui-chat/client/store/stream-client.ts`。
- **独立来源（查阅日期：2026-11-28）**：
  1. Ekko Studio（`EKKOLearnAI/ekko-studio`）统一 Agent 管理与跨运行时群聊：https://github.com/EKKOLearnAI/ekko-studio
  2. Orca（`stablyai/orca`）本机官方 CLI 代理管理与多账户隔离：https://github.com/stablyai/orca
  3. Agent Client Protocol（ACP）开放规范：https://github.com/agentclientprotocol/agent-client-protocol
  4. 本仓既有实现：`packages/core/agent-profile`、`packages/core/agent-group`、`packages/host/web-server/src/cli-agents/`。

### 候选方案对比与取舍

| 维度 | 方案 A：保留 LFAA 角色系统 + 顶部整合 CLI 运行时卡片 + 统一 `cli:*` 后端绑定（选定） | 方案 B：把 Agents 页完全改成纯 CLI 卡片网格，废弃自定义角色提示词与工具边界 |
| :--- | :--- | :--- |
| **优势** | 兼具 Ekko 的直观 CLI 管理体验与 LFAA 的角色人设/工具权限/路由组能力；群聊天然支持「角色 + CLI」混编 | 界面简单 |
| **风险与代价** | 需在 `agent-profile` 增加 `cliAgentId`（或 `cli:*` profileId 透传）并在 `AgentsView` 展示两类分区 | 丢失 LFAA 已有角色定制与权限策略，破坏既有 `agent-profile` 契约与测试 |

**结论**：采用 **方案 A**，两阶段连续交付。

---

## 3. 阶段 1：Agents 统一管理（CLI 运行时 + 角色打通）

### 3.1 契约与后端（`packages/core/agent-profile` + `packages/core/agent` + `packages/host/web-server`）
- **`AgentDefinition` 扩展**：新增可选字段 `cliAgentId?: string`（如 `"claude"`、`"codex"`、`"agy"`）。未填时按既有 `bindingId` 走内置引擎 + LLM API；填写后该角色运行时自动把 `profileId` 解析为 `cli:<cliAgentId>`，走官方 CLI 流式执行器（自动带上该 CLI 当前选中的本地订阅账户与工作区目录，并把角色的 `instructions` 拼入系统上下文前缀）。
- **CLI 运行时一键管理接口**：在 `packages/host/web-server/src/handlers/handlers-cli-agents.ts` 保持现有 `/api/cli-agents/*` 契约，并补充：
  - `POST /api/cli-agents/:id/check-update`（只读检测当前版本与最新版本提示，不静默破坏用户环境）；
  - 与设置中心「CLI 代理」Tab 共用同一份状态与变更广播事件，避免两处数据不同步。

### 3.2 Agents 页界面升级（`packages/client/ui-agent-profile`）
- **顶部分区切换（或上下双区）**：
  - **「运行时（CLI 代理）」卡片网格**（借鉴 Ekko Studio 卡片密度，严格使用 `@lfaa/ui-theme` 语义变量）：
    - 首张卡片为 **LFAA 内置引擎（内置）**；
    - 其余卡片按「已安装 / 未安装」列出 `Claude Code`、`Codex`、`Antigravity`、`OpenCode`、`Grok`、`Cursor`、`Copilot`、`ZCode`、`Aider`；
    - 每张卡片展示状态徽章、版本号、启用开关、快捷「账户与设置」抽屉/展开区、复制安装/启动命令与刷新按钮。
  - **「自定义角色」管理区**：保留现有列表与右侧 `Agent-Editor`，在「执行引擎 / 模型绑定」控件中允许直接选择：
    - `内置引擎（跟随默认模型 / 指定模型绑定）`
    - `本机 CLI 代理（Claude Code / Codex / Antigravity 等已安装项）`

---

## 4. 阶段 2：群聊完整版升级（`packages/core/agent-group` + `packages/client/ui-agent-group`）

### 4.1 后端能力补齐
- **混编成员**：群成员 `agentIds` 同时支持：
  - 内置与自定义角色 id（如 `xiaoyu`、自定义架构师/审校角色）；
  - 直接拉入已启用的本机 CLI 代理（id 形如 `cli:claude`、`cli:codex`、`cli:agy`），`orchestrator.ts` 启动发言时自动透传 `profileId: "cli:<id>"`。
- **建群与群设置**：
  - 建群时支持绑定 `projectId`（项目目录，使群内所有 Agent 与 CLI 在同一项目上下文中协作）；
  - 新增 `PATCH /api/group/sessions/:id` 支持随时修改群名、增删成员、切换主持人、调整每轮最大发言数；
  - 新增 `POST /api/group/runs/:turnId/abort` 支持一键中止当前正在发言的成员并终止后续排队成员。
- **实时流式推送**：
  - `runGroupTurn` 立即返回 `turnId` 与当前首个 `runId`（或在 `GET /api/group/turns/:turnId/events` 聚合整轮 SSE 事件流，转发每个成员的 `run_started` / `delta` / `step_update` / `run_finished`），彻底淘汰 1.2s 轮询。

### 4.2 前端体验升级（`packages/client/ui-agent-group`）
- **SSE 实时流式 + 中途停止**：接入真实 SSE，逐字流式渲染每个发言成员的输出，运行中显示当前正在发言的成员徽标与「停止本轮」按钮。
- **富文本消息与步骤**：渲染 Markdown（标题、列表、表格、带高亮与一键复制的代码块）以及可折叠的思考/工具活动步骤，并清晰标注发言成员头像/名称、引擎标签（如 `Claude Code · CLI` / `DeepSeek`）。
- **输入与群管理体验**：
  - 输入框支持键入 `@` 自动弹出群成员补全浮层（上下键选择、回车插入）；
  - 群顶栏展示绑定项目、成员列表与「群设置」抽屉（随时增删成员、切换主持人、解绑/换绑项目）。

---

## 5. 包边界与约束检查

- 不新增违规跨包依赖：
  - `packages/core/agent-profile` 仅新增纯数据字段 `cliAgentId?: string`，不反向依赖 `host` 或 `ui`；
  - `packages/core/agent-group` 仅扩展 HTTP 路由与 SSE 转发；
  - `packages/client/ui-agent-profile` 与 `packages/client/ui-agent-group` 保持小文件拆分（`.tsx ≤ 400`、`.ts ≤ 500`、`.module.css ≤ 400`），严禁写死颜色，严格消费 `@lfaa/ui-theme` 语义变量。

---

## 6. 验收标准

1. **阶段 1**：打开左一栏 `Agents` 页可见「CLI 运行时」卡片网格（自动检测本机已安装如 `Claude Code`）与「自定义角色」区；新建/编辑角色时可直接绑定本机 CLI 代理或 API 模型；与设置中心「CLI 代理」状态完全同步。
2. **阶段 2**：群聊支持绑定项目、混编内置小鱼 + 自定义角色 + 本机 CLI 代理；发送消息后通过 SSE 实时逐字流式渲染 Markdown/代码块并可中途停止；输入框 `@` 弹出成员补全；群设置可随时增删成员。
3. **质量门禁**：浅色 + 深色双主题内置浏览器实测通过（0 控制台报错），`pnpm build`、`pnpm check`、`pnpm lint`、`pnpm verify:web` 及新增单元测试全部通过。
