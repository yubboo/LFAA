# AI Work Run 断流恢复与 Agent 预算上限合同

## 目标、运行入口与 Owner

入口为 Web/桌面共享的 AI Work `/tasks`。`packages/client/connection` 负责 SSE 消费，`packages/client/ui-chat` 负责同一 Run 的会话展示与自动跟随；`packages/api/session-controller` 通过现有账户隔离的 Run Owner 提供事件订阅和重连快照。Agent 循环由 `packages/core/agent-loop` 持有，`aiRuntime.maxModelRequests` 与 `aiRuntime.maxToolCalls` 由 Settings Owner 持久化、校验并在设置中心配置。

本轮目标：SSE 连接在 `done` 前意外 EOF 或遇到可恢复网络/服务错误时，客户端退避后用已收到的同一 Run ID 重新订阅；Agent 的模型请求数与工具请求数始终有有限上限；同一 Run 中成功完成的写入/危险工具不得以相同规范化参数重复派发。不同状态查询仍可重复执行；失败/未知调用继续由原防重规则处理。

## 当前证据与设置合同

- 初始 Run 订阅发送 `session` 快照并含助手消息 ID；现有 GET `/api/ai/runs/:runId/events` 可用同一账户的 Run ID 恢复快照，并在 Run 已结束时补发终态 `done`。
- 当前 SSE 消费器把 EOF 当作正常返回；聊天 UI 已在初始快照时登记自动跟随，因此连接 EOF 后不会为同一 Run 再开订阅。
- 当前 `0` 模型请求预算与工具调用预算均不限制数量；失败/未知工具签名已防重，但成功写操作没有对应保护。
- 沿用 Settings Owner 的 `aiRuntime.maxModelRequests`、`aiRuntime.maxToolCalls`。`0` 表示使用共享设置合同中定义的产品安全上限，正数表示用户设置更低的单轮上限；服务端兼容读取超出上限的旧值时夹到安全上限。不得清空或重置其他用户设置，也不得新增平行预算配置。
- 本轮不改变 `permissions.mode`、身份/账户隔离、Provider 选择、Provider 流终止判定、Session 持久化或真实运行中服务。

## 修改范围

允许修改：共享 SSE 客户端重连与 EOF 事件冲刷；AI Work 同一 Run 跟随生命周期；AI Runtime 共享预算上限、Settings 校验/兼容归一化和设置中心说明；Agent Loop 有效预算执行、成功非只读工具签名防重；对应长期回归、当前任务合同、Agent/Client/Settings/Values 说明文档及架构事实。

禁止修改：Provider 终止语义、通用权限/审批策略、账户或会话存储格式、API 认证和账户隔离、运行中的 Web/Control Plane/Daemon、其他未提交工作、发布/提交及与本轮无关的测试夹具。

## 验收

- SSE 回归先收到初始 Run 快照和部分 delta，随后 EOF；客户端必须以同一 Run ID 发起 GET，采用重连快照继续接收后续 delta，并且只在明确 `done` 后结束。网络重试须采用有上限的指数退避，等待可由现有 `AbortSignal` 取消。
- Run 已终态时重新订阅能接收快照及终态事件；没有收到 `done` 的流不得作为已完成返回。
- `0` 和超大旧设置都不能使单 Run 超过共享合同定义的模型请求/工具调用安全上限；用户正数上限仍更严格生效，并保留已执行结果和清楚的预算终态。
- 完成的同签名写/危险工具只派发一次；第二次请求记录为未派发并停止当前 Run。相同读工具查询仍可按模型判断重复执行；既有失败/未知防重保持有效。
- 运行 Agent 与 SSE 定向长期回归、受影响包构建、类型/工作区检查及 `git diff --check`。构建产物只进入根 `dist/`。真实 Provider、浏览器断网/恢复、桌面 WebView 与帧时间未实际测量时必须明确标记未验。

## 实施与验证记录

- `connection/src/api.ts` 在已取得助手消息 Run ID 后，将 EOF、读取断开和 408/425/429/5xx 视为订阅中断；按 250ms 指数退避、最高 8 秒用同一 Run ID 发 GET，流待完成期间不重放创建 Run 的 POST。只有终态 `done` 才正常返回；响应快照必须与当前 Run ID 相符。退避与请求均可由现有 `AbortSignal` 取消。
- `aiRuntime.maxModelRequests` 与 `aiRuntime.maxToolCalls` 沿用 Settings Owner；共享合同上限分别为 64 与 128，0 使用该上限，正数可收紧。Settings 页面、Joi 合同和读旧值归一化均执行同一上限。Agent Loop 将一批超出剩余工具预算的调用整批记为未派发并结束；成功写/危险工具的相同规范化签名不会再次派发，读取工具可重复查询，原失败/未知防重保留。
- 定向回归通过：`node --import tsx --import ./register-package-loader.mjs --test tests/client-performance.test.mjs`（25/25），同一命令运行 `tests/agent-runtime.test.mjs`（1/1）。测试覆盖同 Run GET 重订阅、快照正文衔接、0 预算、旧超大预算归一化、129 项超额工具批次未派发及成功写操作重复拒绝。
- 包构建通过：`lfaa-util-values`、`lfaa-settings`、`lfaa-agent-loop`、`lfaa-client-connection`、`lfaa-client-ui-settings`；`pnpm run typecheck`、`pnpm run build:web`、`pnpm run build:control-plane`、`pnpm run check:workspace`（178 个包）及 `git diff --check` 均通过。所有构建输出位于根 `dist/`。
- `workspace-preflight` 不在当前根脚本中；已运行可用的 `check:workspace`。没有重启现有服务，没有发起 Provider 请求或真实浏览器/桌面流断网验收；浏览器帧时间和长任务未测。SSE 回归完成时间约 258ms，其中包含 250ms 首次退避；这不是浏览器体验测量。
