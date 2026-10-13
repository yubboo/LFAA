# AI Work SSE 请求结束误判修复合同

## 目标、运行入口与 Owner

修复 AI Work 用户发出消息后一直停在“正在思考”、只有刷新页面才显示已保存答复的问题。Web 入口为 `apps/web` → `POST /api/ai/chat/stream`；`packages/api/session-controller` 订阅 Agent Run 并写入 SSE，公共 SSE 连接生命周期由 `packages/api/gateway/src/sse.ts` 的 `openSseStream` 持有。

## 已观察证据

- `POST /ai/chat/stream` 的 JSON 请求体在路由处理前已由 Express 读完；Node 对已完成的 `IncomingMessage` 触发 `close` 是正常请求生命周期。
- 隔离 HTTP 复现中，已消费的 GET/POST 请求分别在约 3–16ms 触发 request `close`，而延迟 SSE delta 在约 500ms 写出。当前 `openSseStream` 把 request `close` 当作回复流断开，令 `stream.closed` 提前为真；`session-controller` 因写后守卫丢弃后续事件。
- 刷新后从 Session 读取已持久化助手消息与该现象一致；这不能说明 Provider 没有生成内容。

## 设置、数据与权限

- 不新增或修改设置中心配置；Provider、`aiRuntime.requestTimeoutSeconds`、权限模式、身份认证、账户隔离及 Session 持久化合同保持原样。
- 不修改 `packages/api/session-controller` 的现有未提交工作、不改 Agent Loop 或客户端状态，不重启运行中的 Web/Control Plane/Daemon，不改真实会话数据。

## 修改范围

- 仅修改 `packages/api/gateway/src/sse.ts` 的连接生命周期：请求正常 `close` 不得关闭响应流；使用响应 `close` 识别客户端断开，并保留请求 `aborted` 的异常请求清理。
- 在 `apps/cli/tests` 增加长期 HTTP 回归：消费 POST JSON 请求体后延迟写 SSE delta，断言当前响应仍收到 delta 和终态事件。
- 更新 `packages/api/gateway/README.md` 的 SSE 生命周期说明及本合同/任务索引。

## 验收

- 定向回归应在旧实现失败、新实现通过；覆盖请求体已消费后 delta/done 到达，并断言 `close()` 撤销请求与响应监听器。
- 运行定向测试、Control Plane 构建、适用类型检查/工作区 Gate 与 `git diff --check`；所有构建产物位于根 `dist/`。
- 本轮不发起真实 Provider 请求，不刷新或操作用户会话，不重启服务。隔离 HTTP 回归和构建不等于已验证运行中旧进程或真实浏览器；运行服务加载源码需后续受控重启。

## 实施与验证记录

- `openSseStream` 不再以请求 `close` 判定响应断开；仅请求 `aborted` 和响应 `close` 会关闭流。显式 `close()` 同时清理心跳与两个监听器，并处理监听前已经结束/销毁的连接。
- 新增隔离 Express + JSON + SSE 回归。修复前客户端请求在 800ms 期限内超时；修复后当前 POST 响应收到 delta 与 done。没有发起 Provider 请求。
- 验证通过：从 `apps/cli` 运行 `node --import tsx --import ./register-package-loader.mjs --test tests/ai-work-sse-lifecycle.test.mjs`（1/1）、同命令运行 `tests/harness-agent-api.test.mjs`（1/1）、`pnpm --filter lfaa-api-gateway run build`、`pnpm run typecheck`、`pnpm run build:control-plane`、`pnpm run check:workspace`（178 个包）及 `git diff --check`。Control Plane 构建产物位于根 `dist/apps/control-plane`，并确认包含新的请求/响应关闭处理。
- 仓库没有 `workspace-preflight` 脚本；按现存入口运行 `check:workspace`。
- 未重启端口 3000 的现有 Control Plane；当前浏览器/服务进程尚未加载此修复。真实 Provider、当前登录页面流式显示和浏览器帧时间未实测；需服务受控重启后才能验收运行进程。
