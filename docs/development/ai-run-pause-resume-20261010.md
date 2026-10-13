# AI Work Run 安全暂停与继续合同

## 目标、入口与 Owner

入口为 Web/桌面共享的 AI Work `/tasks`。`packages/client/ui-chat` 展示当前 Run 的暂停/继续状态，`packages/client/connection` 提供认证 API 与 SSE 状态事件；`packages/api/session-controller` 校验账户并路由控制请求；`packages/core/agent-loop` 是唯一 Run 生命周期 Owner，并负责在安全检查点挂起、恢复当前执行。

目标是让用户暂停后能继续同一个活动 Run，而不是把运行中的助手消息改为 `interrupted`。继续沿用原 Run ID、原会话与 Agent Loop 执行栈；不得创建额外用户消息、Run 或第二套运行器。

## 设置与运行边界

- 不新增或迁移设置。沿用 `permissions.mode`、`aiRuntime.requestTimeoutSeconds`、`aiRuntime.maxModelRequests`、`aiRuntime.maxToolCalls` 与既有外观主题令牌；设置值、默认值、持久化、校验及设置页映射均不修改。
- SSE 订阅断开只撤销订阅，不影响 Run。显式暂停/继续经当前认证账户的 Run API 请求，并通过现有 SSE 事件同步状态；API 继续依赖 `packages/core/session` 的账户归属检查。
- 暂停请求不 abort Provider、已派发工具或节点任务。运行中的原子操作先真实结束，再在下一个 Agent 检查点挂起；等待期间显示“正在暂停”，到达检查点后显示“已暂停”。检查点覆盖每次模型请求前/返回后、每项工具派发前/结果后以及排队 Run 开始前；审批与澄清等待本身不派发副作用，可立即确认暂停，交互结果到达后仍须由用户继续才会越过检查点。
- 到达暂停点后 Agent 执行栈等待同一 Run 的恢复信号。恢复只解除等待，不重新创建 Run、不重发已完成的工具、不更改权限或账户范围。保留独立的显式“停止并终止当前任务”控件与 cancel API；暂停和终止具有不同的界面入口及生命周期语义。
- 暂停状态驻留在当前 Control Plane 进程的 Run Owner 中；刷新页面可从同一 SSE Run 读取当前状态。服务重启仍按现有规则把未完成 Run 标记为中断，不承诺跨进程持久暂停/恢复。

## 修改范围

允许修改 Agent Loop 暂停门闩与检查点、Session Controller 的账户隔离暂停/继续路由、共享 Client API/SSE 状态消费、AI Work 运行控件与状态说明、直接相关长期回归、Agent/Client README、架构事实、当前任务合同与索引。

禁止中断或重放正在运行的外部副作用；禁止把普通断流改为暂停、改变 Provider/工具重试和权限合同、改变 Session 持久化格式或 Settings 配置、重启现有服务、覆盖其他未提交工作、提交或发布。

## 验收

- 普通点击暂停不触发 `/cancel` 或 `AbortController.abort()`；当前 Run 先发出 `pausing`，安全检查点确认后发出 `paused`，继续后发出 `running` 并使用相同 Run ID。
- Provider 流返回工具调用时，若暂停请求已到达，工具不得在恢复前派发；已派发工具在安全完成前不被中断，暂停后继续不重复派发。最终 Run 完成后状态正常转为 `complete`。
- 订阅新建、重连及已暂停 Run 时均能读取当前暂停状态；取消仍会以 `interrupted` 终态结束并释放等待者/监听器。
- 覆盖暂停门闩状态转换、队列等待、Provider 检查点、工具派发边界、同 Run 恢复、账户隔离、SSE 回读和取消清理。运行直接相关 Agent/API/Client 回归、受影响包构建、类型/工作区检查与 `git diff --check`；构建输出只写根 `dist/`。
- 真实 Provider 暂停耗时、登录态浏览器/桌面交互、服务重启后的恢复和帧时间未测时明确标记，不以合成回归或构建宣称验收。

## 实施与验证记录

已实现：AI Work 运行控件提供同一 Run 暂停/继续与独立停止；Agent Loop 在 Provider/工具安全检查点挂起原执行栈，并将审批、澄清等待视为可即时确认的安全等待。暂停门闩只在当前 Control Plane 进程驻留。

- 回归：`ai-run-pause-resume.test.mjs` 3/3；`agent-runtime.test.mjs` 2/2；`client-performance.test.mjs` 27/27；`harness-agent-api.test.mjs` 1/1。
- 类型及构建：`pnpm run typecheck` 通过；Agent Loop、Session Controller、Client Connection、UI Chat 四个受影响包构建通过；Control Plane 构建通过；`pnpm --filter ./apps/web run build` 通过。
- 工作区：178 包 `check:workspace` 通过；`git diff --check` 通过。构建输出位于根 `dist/`。
- 首次 Web 构建遇到源码指纹变化，并查出共享聊天组件已声明的 `onOpenProjectFileReview` 未解构；补齐后标准 `pnpm run build:web` 通过，未修改构建脚本。
- 仓库未提供 `workspace-preflight` 命令；已执行 `check:workspace` 替代工作区结构/依赖检查。
- 未实测：真实 Provider 停顿时长、登录态浏览器/桌面交互、进程重启后的任务恢复与帧时间；未重启任何现有服务。
- 设置：未新增或修改 Settings 配置；继续使用既有账户权限/AI Runtime 与外观令牌。
