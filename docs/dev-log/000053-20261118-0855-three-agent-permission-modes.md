# Dev Log 000053 — 严格设计与实现三种 Agent 权限模式（请求批准 / 帮我审批 / 完全访问权限）

- **时间**：2026-11-18 08:55:57 +08:00
- **任务编号**：000053
- **任务目标**：对照参考图实现前端三种权限模式切换浮层，并在 `@lfaa/tools` 与 `@lfaa/agent` Host 侧强制落实三模式运行边界：
  1. **请求批准（`ask`）**：工作区目录沙箱保护，任何写/改/命令操作每次均须用户点击 `批准 (Yes)` 或 `拒绝 (No)`。
  2. **帮我审批（`smart`）**：工作区目录沙箱保护，按操作签名统计批准次数，同类常规操作累计批准 ≥ 3 次后自动放行（拒绝则清零重试），高危破坏性命令及敏感凭据路径仍强制询问。
  3. **完全访问权限（`full`）**：全部工具自动放行免审批，并解除工作区路径沙箱限制（支持读写本机任意文件与执行命令）。

## 变更文件清单

- `e:\lfaa\packages\core\tools\src\types.ts`、`sandbox.ts`、`builtin-tools.ts`：
  - 为 `ToolExecutionContext` 与 `resolveSafeWorkspacePath` / `resolveSafeWorkspaceRoot` 增加 `allowOutsideWorkspace` 选项；仅在 `full` 模式下允许越出绑定项目目录，默认 `ask` / `smart` 保持严格沙箱隔离。
- `e:\lfaa\packages\core\tools\tests\tools-service.test.ts`：补充 `allowOutsideWorkspace: true` 越界放行单元测试。
- `e:\lfaa\packages\core\agent\src\permission-policy.ts`（213 行，新建）：
  - 实现 `normalizePermissionMode`、`buildApprovalPattern`、`assessToolRisk`、`evaluateToolApproval` 与 `SmartTrustStore`（持久化至 `~/.lfaa/smart-approvals.json`，满 3 次自动放行并支持高危拦截）。
- `e:\lfaa\packages\core\agent\src\types.ts`、`agent-loop.ts`（341 行，核心审批决策与持久化已拆分至 `permission-policy.ts`，保留单一循环体不超过 500 行）、`index.ts`（321 行，含 `AgentService` 调度、SSE 订阅及 `getSmartTrustCounts`/`resetSmartTrust`）、`http-handler.ts`：
  - 接入 `permissionMode` 到 `POST /api/agent/runs`、Think→Act→Check 工具审批循环与工具上下文，并新增 `GET /api/agent/trust` 与 `DELETE /api/agent/trust`。
- `e:\lfaa\packages\core\agent\tests\agent-loop.test.ts`：新增三种权限模式纯策略及端到端闭环测试（验证 `smart` 前 3 次弹窗、第 4 次自动放行、高危兜底，以及 `full` 免审跨目录写入）。
- `e:\lfaa\packages\core\chat\client\components\PermissionModePicker.tsx`（144 行，新建）与 `PermissionModePicker.module.css`（186 行，新建）：
  - 实现底部栏触发胶囊与「应如何批准 LFAA 操作？」浮层（含 `了解更多` 内联说明与橙色警示态）。
- `e:\lfaa\packages\core\chat\client\chat-types.ts`、`chat-store.ts`、`locales.ts`、`components\ChatWorkspace.tsx`、`components\StepTraceList.tsx`、`StepTraceList.module.css`、`components\AgentContextPanel.tsx`、`AgentContextPanel.module.css`：
  - 持久化 `lfaa:permission-mode` 并在发起任务时透传 `permissionMode`；审批卡片按钮更新为 `批准 (Yes)` / `拒绝 (No)` 并展示 `smart` 进度或高危提示；右侧上下文面板同步展示当前权限策略与清空自动放行记忆按钮。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` — **29/29 通过**。
2. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 1.73s`）均以退出码 `0` 通过。
3. **内置浏览器实测验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 页面加载与交互全程控制台报错 `0`、网络请求失败 `0`。
   - 验证默认 `请求批准`、点击打开 `应如何批准 LFAA 操作？` 浮层与 `了解更多` 展开、切换 `帮我审批`、切换橙色 `完全访问权限` 并联动右侧 `Agent 核心能力 -> 权限策略 / 手脚 (工具)`、刷新页面后状态持久化保留以及切回默认态；验收后已关闭临时 Web 服务释放 `5173` 端口。
