# Agent 网络 egress allowlist 实现合同

## 当前事实

- `lfaa-sandbox-policy` 已把网络策略建模为 `none`、精确 DNS 主机+端口 allowlist 和 `unrestricted`。策略数据不会自行实施 OS 网络限制。
- `lfaa-sandbox` 要求提供方对文件隔离和网络隔离分别返回实测状态；Windows AppContainer Provider 目前使用 `CapabilityCount=0`，只支持受限模式无网络，allowlist 和受限开放网络请求都会 `SANDBOX_UNAVAILABLE` 失败关闭。
- Claude SDK 运行环境由 `safeEnv()` 构造，只注入每次 Run 的随机 relay token 与 loopback Base URL。真实 Anthropic API Key 保留于 Host，由 `lfaa-llm` 固定转发；这隔离了账户 Key，不代表 OS 网络出站已受限。产品关闭 SDK 内置工具，以 `tools: []` 和父 Run 的进程内 MCP 承载工具；MCP 动作仍回到 Agent Loop 共用 dispatch 与 Permission Owner。

## 2026-10-27 当前源码复核

- Claude 外部 driver 在 `packages/subagent/tool-subagent/src/external-target.ts` 与 `packages/core/agent-loop/src/execute-turn.ts` 都检查 `aiRuntime.executionSandboxMode === "danger-full-access"`；授权期间设置变化也会拒绝执行。因此当前 SDK CLI 运行并未进入 AppContainer，不能把通用 Shell 的无网络回归当成 Claude SDK 的网络隔离证据。
- 本机 Shell 与 Daemon 的受限执行调用 `createSandboxExecutionPolicy()` 时没有传入 `networkPolicy`，所以按权威策略默认 `none`；`rg` 未发现任何生产调用方实际请求 `allowlist`。当前 allowlist 是策略/校验合同，尚未接到 Agent SDK 或产品执行入口。
- Electron NSIS 安装配置 `perMachine: false`；`packages/host/daemon/README.md` 说明 Daemon 作为桌面子进程或用户启动的远程进程运行，系统服务托管未接入。当前源码未发现 Windows Service 安装调用或 WFP Engine/Filter 写入调用。故当前不存在可安全承接每次 Run WFP 变更的特权 Service Owner。
- 现有 Windows x64 回归验证了受限 AppContainer 不能连本机 loopback listener；不覆盖 Claude SDK、真实 Anthropic API、Broker、WFP 或网络旁路观测。
- 上游 Claude Code sandbox 也不能填补此缺口：Anthropic 文档明确它只包围 Shell 命令及其子进程，MCP Server、Hooks 和其他 SDK 进程在沙箱外；原生 Windows 命令不受该 sandbox 保护。[Anthropic sandbox scope](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox)
- 锁定 `@anthropic-ai/claude-agent-sdk@0.3.310` 的本地 `sdk.d.ts` 暴露 `env`、命令沙箱设置和同步 `spawnClaudeCodeProcess(options) => SpawnedProcess`，没有 HTTP client/fetch/transport 注入口。项目当前 `tools: []` 也关闭了上游 Shell 命令，所以其 `sandbox.network.allowedDomains` 不会约束 Claude CLI 自己的模型 API 请求。自定义 spawn 可改变 CLI 运行位置，不能单独改变 CLI 的 API 传输。

本轮结论：网络 allowlist 虽已进入类型合同，但没有产品执行路径；Claude SDK 当前依靠 `danger-full-access` 门槛运行。Host 临时 relay 已实现凭据隔离基础，不改启动门槛、不改成 `internetClient`，不宣称 egress 隔离已完成。用户已接受“per-user 继续为默认、可选新增管理员级 per-machine WFP Service”；该选择解除安装模式的产品决策门，服务 Owner、安装/更新/卸载、降权 IPC、恢复授权与真实网络过滤仍须完成设计和验证。

## 下一批候选实现与决策门

现有 `subagent-claude-sdk-mcp-isolation.test.mjs` 与 `anthropic-messages-relay.test.mjs` 已用锁定 SDK 和本地假 endpoint 验证 Host relay 的凭据隔离、固定上游、SSE 和取消；回归未在 AppContainer 内运行，不能证明生产 sandbox 可访问本机代理。已实施的 relay 是下文第一批，不构成 OS egress 边界。后续可行路线是：

1. 受信任的 LFAA Host 持有一个单次 Run、随机端口/令牌的本地 Anthropic Messages API relay；SDK 只获得 relay 地址和短时令牌，不接收账户 API Key。relay 限定路由和方法，并通过 `lfaa-llm` Owner 向固定的 `https://api.anthropic.com` 发起经过 TLS 校验的流式请求，再把有界响应交回 SDK。实际 API Key 继续从现有 Credential Owner 取得。
2. Windows x64 AppContainer 本身保持无一般网络能力。若要允许它访问 relay，需在每次 Run 为本次 Package SID 安装只允许 relay 端口的 loopback WFP 规则，并拒绝其他 loopback/公网；规则随取消、退出、崩溃和 Daemon 重启撤销或失败关闭。WFP/loopback 规则只能由具备系统权限的执行 Owner 安装，不能由普通 Daemon 自行假设可写。
3. Windows Service 只持有 WFP 规则生命周期，不接触 Anthropic Key 或请求正文；TLS、Provider、账单/用量和凭据仍由既有 Host/LLM/Credentials Owner 持有。原始 CONNECT 或通用字节代理不满足目标主机验证。

该方案会新增可选的管理员安装组件和系统服务生命周期；保持当前 per-user 默认安装时，该能力无法启用，Claude SDK 仍限于用户明确选择的 `danger-full-access`。当前 SDK 本地假服务回归证明 API 请求经 LFAA Host relay 改道并保护账户 Key，不证明 WFP、受限 AppContainer loopback 或端到端拒绝旁路。用户已明确接受可选 per-machine WFP Service，并要求 per-user 保持默认。下一批应先确定单一 Service/Installer Owner、最小化受限 IPC、安装/更新/卸载与崩溃恢复语义，再覆盖真实 AppContainer 对 relay 端口可达、其他 loopback/公网不可达及服务离线时失败关闭，之后才扩大到受限 SDK 执行。

### 第一批：将账户 API Key 留在 Host

在等待系统服务安装方式决定期间，可独立实现并验证 Host 侧请求 relay，为将来受限网络提供可复用传输：

- **运行范围**：先只用于当前已允许的 `danger-full-access` SDK Run；继续沿用外部目标门槛，不在本批允许 `workspace-write` 或 `read-only` 启动 SDK。此批隔离 API Key，不宣称隔离 OS egress。
- **Owner**：`packages/subagent/subagent-claude-code` 创建并关闭每次 Run 的 loopback relay，随机 token 仅授权当前 CLI 子进程；`packages/llm/llm` 固定 Anthropic API upstream、附加真实账户 Key、拒绝重定向并转发流；Credential Owner 仍是唯一 Key 来源；Agent Loop/Permission Owner 与设置均不变。
- **协议**：relay 只接受 `POST /v1/messages`，以及锁定 SDK 请求所需的唯一 query `?beta=true`；请求为有界 JSON 并通过本次随机 `x-api-key` token 认证。拒绝其他方法/路由/query、缺失或错误 token、超限请求和并发超限。上游地址固定为 `https://api.anthropic.com/v1/messages`，不使用 SDK 环境中的外部代理/base URL。只透传协议必要头和流响应；错误正文有界且脱敏。用户 Key 不进入子进程环境、命令行、日志、工具 observation 或 Client。
- **生命周期/资源**：每个 Run 最多一个活跃模型 HTTP 请求；读取请求体和错误响应都有明确字节上限；客户端断开、Run 取消、超时和 SDK 结束都会 abort 上游并关闭 listener；请求/响应流遵循背压，不把完整 SSE 缓存到内存。
- **验证结果**：`apps/cli/tests/anthropic-messages-relay.test.mjs` 与锁定 SDK/真实 MCP 协议测试、Claude 权限测试合计 16/16 通过；锁定 SDK 实际请求路径包含 `?beta=true`，relay 只额外允许该固定 query。测试覆盖固定上游与 redirect:error、方法/路径/query/token/请求体上限/响应体上限、上游 redirect 拒绝、错误 Key/token 脱敏、SSE 原样转发、Run 取消与 listener 关闭。SDK 子进程环境不含账户 Key，Host 传输只把 Key 发给 `https://api.anthropic.com/v1/messages`。`lfaa-llm` 和 `lfaa-subagent-claude-code` 根 dist 包构建、`pnpm exec tsc --noEmit -p tsconfig.host.json`、219 包 `pnpm run sync:workspace` / `pnpm run check:workspace`、`git diff --check` 通过。本地假服务没有访问真实 Anthropic；真实 API、AppContainer loopback 与 WFP enforcement 继续标为未验。

## OS 边界与设计约束

Windows AppContainer 的网络能力按 Internet、Intranet、客户端/服务端等类别授予；`internetClient` 是一般公网能力，不能表达域名 allowlist。[Microsoft AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)

WFP 可依据 AppContainer Package SID 及远端 IP 等字段过滤连接，但筛选条件不包含 DNS 查询名或 HTTPS 主机名。解析后的 IP/端口规则不能证明 TLS authority/SNI 与 allowlist 主机相符，也不能安全处理共享 CDN IP、DNS 变化或重绑定。[WFP filtering condition identifiers](https://learn.microsoft.com/en-us/windows-hardware/drivers/network/filtering-condition-identifiers)、[WFP ALE conditions](https://learn.microsoft.com/en-us/windows/win32/fwp/filtering-conditions-available-at-each-filtering-layer)

为每次运行动态新增 WFP 过滤器需要对过滤器容器有 `FWPM_ACTRL_ADD` 权限。Windows 默认将 WFP 引擎写权限授予 Administrators 和 Network Configuration Operators；动态 session 本身不提升普通进程权限。[WFP access control](https://learn.microsoft.com/en-us/windows/win32/fwp/access-control)

当前产品没有可复用的特权网络服务 Owner：Electron 主进程以普通子进程方式启动本机 Daemon；Daemon README 也明确远程主机安装器与系统服务托管未接入。因此不能假定 Daemon 可以在每次 Agent Run 前写入 WFP 策略，也不能把 Rust Sandbox Host 等同于已安装的特权服务。

AppContainer TCP loopback 需要 loopback exemption；该开关启用的是 AppContainer 的 loopback 通路，不限定到某个代理端口。现有无网络回归要求 AppContainer 不能连接本机监听端口，因此不得把“设置 `HTTPS_PROXY`”或开启 loopback exemption 当作 egress 安全边界。[Windows Firewall loopback troubleshooting](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/troubleshooting-uwp-firewall)

AppContainer 与完整性较高的 Broker 可以通过具名对象 IPC 通信，具名管道可用 DACL 限定到本次 Package SID。但 Broker 必须提供有类型、有限范围的请求接口；允许任意 CONNECT/字节隧道就会把它变成通用公网代理。[Microsoft named object sharing](https://learn.microsoft.com/en-us/windows/apps/develop/communication/sharing-named-objects)

## Owner 顺序与决策门

1. **权限与网络策略 Owner**：`packages/sandbox/sandbox-policy` 保持精确目的地主机+端口和默认无网络；`packages/sandbox/sandbox` 继续要求独立的网络执行回执。网络目标来源必须是当前用户目标或被选能力的真实合同，不新增权限模式或第二套强制审批。
2. **Windows 执行 Owner**：`packages/sandbox/sandbox-windows-acl` 与 `native/system` 负责选择并实现真正不可绕过的 OS egress 边界；若选择 WFP，还需先由 Electron/安装器与 Daemon Owner 提供特权服务安装、生命周期及卸载合同。当前 per-user 安装与普通 Daemon 没有这个 Owner。解决安装/回收 Owner、当前权限模式下的授权来源、崩溃后的 fail-closed 清理和既有本机网络隔离后，再写执行实现。
3. **Claude 凭据/传输 Owner**：`packages/subagent/subagent-claude-code` 与 `packages/core/agent-loop` 负责 SDK 同步 spawn、Host 异步就绪/回执的桥接及每 Run relay 生命周期。真实 API Key 已留在受信任 Host，由 `packages/llm/llm` 发送到固定 Anthropic endpoint；锁定 SDK 通过随机 loopback token 请求。当前 relay 可在 `danger-full-access` 下保护账户凭据，但 OS 级网络边界与 AppContainer loopback 尚未实现/验证。`tools: []`、MCP 配对、Claude Code 命令 sandbox 与遥测关闭不能替代 egress 执行证据；锁定 SDK 没有公开模型 HTTP transport 注入口。WFP 的 IP/端口过滤本身也不能验证 TLS authority/SNI；后续仍须有可验证目的主机身份的受限 API Broker/传输，且不得提供任意 CONNECT/字节隧道。
4. **平台回归 Owner**：先 Windows x64，再按相同策略合同验 Linux/macOS Provider；一个平台的策略数据或构建通过不代表其他平台具备 egress 执行能力。

在验证标准满足前，Windows allowlist 必须继续拒绝。不能为了 Claude SDK 联网而给 Agent AppContainer 添加 `internetClient`，不能默认开启本机 loopback，也不能把用户选择的 `danger-full-access` 描述成 allowlist 沙箱。

## 端到端验收

- `none`：IPv4/IPv6 TCP、UDP、DNS、QUIC、DoH、loopback 和系统代理绕过均无法从受限 Agent 进程出站；访问工作区和既有工具仍按各自 Owner 工作。
- `allowlist`：只允许精确主机+端口；覆盖多 A/AAAA、共享 IP、DNS 变化/重绑定、SNI/authority、重定向、代理配置、IPv4/IPv6、UDP/QUIC、DoH、子进程与原始 Socket 旁路。不能把 DNS 解析结果本身当成主机身份验证。
- Broker/过滤器具有本次随机 Run 身份；两个并发 Run 不能交换权限。正常结束、取消、超时、Host 崩溃、Daemon 重启和清理失败都必须验证网络规则撤销或失败关闭。
- Claude SDK 模型请求在授权目的地主机上成功；随机外站、本机其他服务、工作区外文件与未登记工具均拒绝。密钥不得出现在工作区、命令参数、工具 observation、日志或工具子进程环境中。
- 真实 Windows x64 执行需观察实际连接与拒绝证据，并将 OS 层回执与策略目标关联到同一 Run。单元测试、策略 Schema、代理变量、DNS 查询日志和 Host 构建都不能单独证明没有直连旁路。

## 参考源码

- `packages/sandbox/sandbox-policy/src/index.ts`
- `packages/sandbox/sandbox/src/index.ts`
- `packages/sandbox/sandbox-windows-acl/src/index.ts`
- `native/system/src/agent_sandbox.rs`
- `packages/subagent/subagent-claude-code/src/index.ts`
- `packages/subagent/subagent-claude-code/src/anthropic-relay.ts`（单 Run loopback relay、token 校验、流边界和清理）
- `apps/cli/tests/subagent-claude-sdk-mcp-isolation.test.mjs`（锁定 SDK/MCP 与 Host relay 端到端本地假 endpoint 回归）
- `apps/cli/tests/anthropic-messages-relay.test.mjs`（固定 endpoint、路由/token/大小/错误/取消合同回归）
- `packages/llm/llm/src/anthropic-messages.ts`（固定 Anthropic Messages 上游 Owner）
- `packages/core/agent-loop/src/execute-turn.ts`
- `packages/subagent/tool-subagent/src/external-target.ts`（当前 `danger-full-access` 门槛）
- `apps/desktop-electron/package.json`（当前 per-user NSIS 安装）
- `apps/desktop-electron/src/main.mjs`（Daemon 当前由桌面主进程启动）
- `packages/host/daemon/README.md`（系统服务托管尚未接入）
