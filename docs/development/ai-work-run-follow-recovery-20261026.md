<a id="lfaa-ai-work-run-follow-recovery-20261026"></a>

# LFAA-AI-WORK-RUN-FOLLOW-RECOVERY-20261026：恢复断开的回复状态

## 用户问题与目标

`/work` 中 Agent 会话已结束或等待用户时，旧助手消息仍显示“正在回复”，并出现“恢复任务跟随”；点击恢复没有效果。目标是让自动恢复和手动恢复都能重新订阅已有 Run 的真实事件与终态，更新对应消息状态，且不新建模型轮次。

## Owner、入口与设置

- 运行入口：Web 与 Desktop 共用 Client 的 `/work` AI Work 聊天。
- Client 入口 `packages/client/ui-chat/src/AiWorkChat.tsx` 负责恢复触发及消息视图；连接层 `packages/client/connection/src/api.ts` 通过认证 SSE 读取既有 Run；Agent Loop / Session Owner 仍提供真实 Run 与持久消息状态。
- 不新增设置。沿用当前账户认证、Session/App 校验和 `permissions.mode`；续接只读取已有 Run 事件，不重新执行模型或工具。
- 不修改 Minecraft、Java、Daemon、其他会话或用户偏好。

## 复现与验收

- 复现证据：当前内置浏览器 `/work` 显示“恢复任务跟随”“正在回复”；对恢复按钮执行一次点击后界面无变化。源码中两个恢复入口均调用 `sendMessage("", runId)`，但空输入守卫在 Run ID 分支前返回，因而不会订阅事件。已确认这是 Client 续接入口缺陷。
- 空正文仅在普通新消息无附件时拒绝；提供 `followRunId` 时必须进入已存在 Run 的 SSE 订阅。
- 活动 Run 收到真实完成/停止/错误事件后，助手消息改为对应终态并清除“正在回复”；等待用户输入时显示真实等待状态；用户点击恢复能产生订阅。
- 增加回归覆盖普通空输入仍被拦截、空正文 Run 续接通过，以及事件流真实终态回写；运行定向回归、Client 类型、ui-chat 与 Web 构建、差异检查。
- 使用当前源码启动正式 Web，并在内置浏览器 `/work` 验证恢复动作和终态展示；截图、视口和无法复现范围写入实施记录。真实 Provider 与 Daemon 不作为该 UI 状态修复的通过条件。

## 性能、安全与边界

续接复用既有认证 SSE 与现存 Run，不新增轮询、订阅或并发请求；现有 `AbortController` 仍负责撤销事件读取。工具调用、数据写入及权限判断继续只发生在服务端原 Run 内，本次恢复点击本身不提交新消息。

## 实施记录

- `sendMessage` 的空正文守卫现在只拦截普通新消息；自动续接与“恢复任务跟随”传入已有 `followRunId` 时继续读取该 Run 的认证 SSE，并由原有 `done` 事件将消息写为完成、停止或错误状态。没有提交新模型轮次或工具调用。
- 修复前在当前内置浏览器 `/work` 可见“恢复任务跟随”和“正在回复”；点击无变化。修复后相关回归覆盖自动/手动调用沿用同一 Run、普通空消息继续拦截。
- 定向回归：`ai-work-run-follow-recovery.test.mjs`、`ai-work-response-timeline.test.mjs`、`runtime-environment.test.mjs` 合计 18/18 通过；`pnpm run typecheck`、`pnpm run build:web`、`pnpm run build:control-plane` 通过，Web/Control Plane 产物写入根 `dist/`。
- 页面当前指向的 LFAA 会话已由用户选择暂停。为避免页面加载时自动重新跟随并可能让 Agent 继续该会话，本轮没有刷新该会话或点击恢复；因此修复后的浏览器交互尚未实测，已有截图只作为修复前复现证据，不标记为页面验收通过。正式 Web 的 `/api/health` 返回 `ok`，但根页面明确返回源码/构建指纹不一致的重启保护页；未重启现有服务。
