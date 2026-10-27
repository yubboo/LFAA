# LFAA 小鱼本机命令无返回修复（2026-10-27）

<a id="lfaa-local-agent-shell-execution-hang-20261027"></a>

## 目标与复现证据

用户要求小鱼开发 Minecraft 签到插件。本机 Agent Run 派发第一条 `local_execute_command`（`mvn -v; echo ...; java -version`）后超过 6 分钟仍显示运行，Agent Git 中没有新文件。用户通过界面暂停后，工具活动仍显示执行中。本轮不再调用 Provider；只修复本机命令执行、超时与取消链路。

## Owner、设置与边界

入口是 `/work` Pi Agent Loop → `packages/shell/tool-shell` 的 `local_execute_command` → `lfaa-shell` → `lfaa-pwsh-local` / `spawnLocalProcess`。工具授权仍由现有 Permission Owner 决定；本机数据工作区仍使用 `general.taskFolder` 与当前仓库目录；沙箱仍由 `aiRuntime.executionSandboxMode` 决定。

`aiRuntime.commandTimeoutSeconds` 的既有合同明确为 AI Work 节点命令时限（默认 0 表示节点命令不限时），不得将其套用于本机 Shell。省略模型工具 `timeoutSeconds` 时由 Shell Owner 使用现有 120 秒默认值；工具可明确请求 1–600 秒并受 Shell 最大 600 秒限制。不得更改用户偏好、API Key、模型、Agent 请求预算、审批或工作区设置，也不新增设置。

## 修改范围与验收

- `local_execute_command` 省略超时时不把节点设置的 0 传成本机无限等待；显式超时按本机工具合同传递。
- 本机 PowerShell Shell 的默认与零值请求均使用现有 Shell 默认超时；超时/取消通过 `lfaa-win32-process` Owner 终止 PowerShell 及后代，失败时回退停止直接子进程。
- 保留一次性 Shell 的真实退出码、部分输出、失败/超时/取消终态；超时/取消结果仍不可作为成功或安全重放依据。其他沙箱取消路径保持原有行为。
- 增加直接回归覆盖本机超时参数隔离、PowerShell 默认边界、异步停止回调与 Windows 进程树终止。
- 构建受影响 Shell/Shell Tool 包，运行两组定向回归与 `git diff --check`。不运行真实 Provider，不重启现有服务，不操作原会话或插件。

## 实施与验证记录

- `local_execute_command` 不再读取节点命令超时设置，只在模型为这次调用提供 `timeoutSeconds` 时把该值交给 Shell；省略时让 Shell 补齐有界默认值。PowerShell Provider 统一把 0/缺省解析为 120 秒，并把取消和超时交给 `lfaa-win32-process`；进程树 Owner 未成功时回退终止直接子进程。
- `spawnLocalProcess` 现在把真实 PID 传给平台停止回调，兼容同步/异步结果；拒绝或异常时停止直接子进程。现有沙箱回调的同步合同保持兼容。
- `local-shell-runtime.test.mjs` 与 `agent-response-latency.test.mjs` 定向回归通过 19/19；覆盖节点时限不泄漏到本机工具、显式本机超时正确传递、120 秒/零值有界、异步停止回调、Windows 父子进程树回收和 PowerShell 取消。Shell、PowerShell Provider、Tool Shell 与 Control Plane 构建通过；CLI Host 类型检查通过；本次相关文件 `git diff --check` 通过。
- 用 LFAA PowerShell Provider 直接执行原始 `mvn -v; echo "---"; java -version`，默认时限为 120000ms，450ms 返回真实退出码 1、`timedOut=false`、`aborted=false`；错误清楚指出当前执行环境的 PATH 找不到 `mvn` 和 `java`。这证明命令不再无限挂起，但本轮没有调用大模型或创建签到插件；插件实际开发还受 Maven/JDK 当前不可用影响。
- Windows AppContainer 集成回归 `agent-shell-sandbox.test.mjs` 在其 120 秒用时上限超时；测试清理随后报告 isolated home `EPERM`。检查时没有残留 Sandbox Host/PowerShell 进程，临时目录 ACL 显示继承的管理员完全控制，但自动审查拒绝了清理该目录的递归删除操作，因此保留在 `dist/.tmp/lfaa-agent-shell-sandbox-home-Y0gYiy`。这个集成验收尚未通过，不把通用 Shell/进程树回归冒充为 AppContainer 实测。
- 更新受影响包的生成目录清单后，`pnpm run check:workspace` 仍报 7 项既存文档错误：2 个旧悬停截图链接缺失、5 个旧合同引用不存在；本轮新合同锚点通过。未重启现有控制端、未调用真实模型、未改账户设置/Key/模型/权限/会话。
