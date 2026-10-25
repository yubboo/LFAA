# LFAA MCP Client

`lfaa-mcp-client` 持有真实 HTTP/stdio MCP 协议、连接池、出站校验与租约。旧 `core/tools/src/mcp-tools.ts` 已迁到 `src/runtime.ts`；Core 只消费工具合同，安装适配器复用此 Owner。

工具与 `resources/list`、`resources/templates/list`、`resources/read` 共用 initialize 能力、连接和账户/App 范围；资源服务可不声明 tools。资源页最多 200 项，协议响应有界，二进制 blob 不进入资源正文历史。执行前重新校验账户、App、配置及开关；启用状态或合同变化后旧工具拒绝执行。

单 MCP 服务最多缓存 512 项工具、单个 inputSchema 64 KiB、目录 schema 总量 16 MiB；至多 64 项的小目录继续逐项暴露给模型。超过 64 项时改为三个按需工具：搜索 20 项/页（最大 32）、读取单个准确 inputSchema、按原 schema 校验后调用。207 项合成目录夹具验证模型函数定义数由 207 降至 3；实际调用仍显示远端原始工具名和参数审批摘要。活动时间线使用有界的服务名/远端工具名标题，不复制 MCP 原始返回正文。MCP 2020-12 tuple schema 由 Ajv 2020 验证。目录工具不缓存执行结果，也不扩大服务 App 范围。

HTTP 池最多 32 连接，空闲 30 秒回收；stdio 最后租约结束即关闭。Windows 上的 `npx`/`npx.cmd`/`npx.ps1` 会映射到当前 Node 安装里的 `npm/bin/npx-cli.js`，仍以参数数组和 `shell:false` 启动；stdio 进程由 `lfaa-win32-process` 的进程树终止回收：npx/uvx/dnx 这类 runner 会再启动真正的服务进程，只终止直接子进程会留下孙进程，因此关闭与协议失败终止都按整棵进程树回收。Run 取消只影响当前调用，宿主卸载撤销连接，不缓存/重放副作用。Settings 的 plugins.enabled、mcpServers、computerControl.enabled 与现有权限管线共同控制范围；不安装未知 MCP 或自动获取凭据。

`discoverMcpTools` 默认对账当前用户/App 的启用列表，属于 Agent 能力发现的权威入口。来源检查及安装适配器的安装前探测/状态回读传入 `{ reconcile: false }`：它们只借用或临时租赁指定候选连接，不会因候选清单不完整而关闭其他 MCP 会话；调用者仍须在 `finally` 释放返回的租约。取消信号和账户、App 绑定不变。

构建输出为根 `dist/packages/mcp/mcp-client/`。协议夹具覆盖工具、资源、取消、图片、撤销及 207 项大目录的按需检索/调用和 2020-12 参数校验；真实 REA npm MCP、Provider、目标程序和桌面未实测。
