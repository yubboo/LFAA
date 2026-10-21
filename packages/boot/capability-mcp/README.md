# LFAA MCP 能力安装适配器

lfaa-capability-mcp 把用户提供的 Streamable HTTP 端点和用户明确给出的本机 stdio 命令接入通用 capability_* 工具，并复用账户 Settings Owner 与 lfaa-mcp-client 的真实协议 Runtime。HTTP 检查只执行 MCP initialize、tools/list，不调用远端工具；stdio 检查会启动准确的本机 command/argv 并执行同样的 MCP 握手，因此由通用 Capability Install Tool 经 Permission Owner 标为危险操作。审批显示命令摘要，并按用户、App 与命令/argv 指纹限定范围。

检查、安装前核对和安装后回读仅发现当前候选 MCP，并关闭其临时租约；它们不对账或关闭其他运行中的 MCP 会话。安装凭证固定工具合同摘要、账户、App 和 Owner 校验的目标；安装只将服务写入当前账户并绑定一个 App。stdio 记录由 Settings Owner 持久化，Runtime 仍通过 `shell:false`、受限子进程环境、本机 Host 检查和最后租约回收执行。若 Run 在运行时回读后、设置写入前取消，适配器会再次检查取消信号并中止写入；已消费的安装凭证不可重放，候选 Runtime 租约会先关闭。来源检查不会安装 MCP 包或解释 Shell 字符串，但用户提供的可执行命令仍可能具有其自身副作用，必须先经过统一危险操作权限。

安装记录包含远端工具名称、说明和输入 schema 的 SHA-256。Agent Runtime 每次发现已启用服务时都会重算该摘要；远端工具清单变化后，整项服务不向模型暴露。该摘要固定的是 MCP 工具合同，不是远端服务器代码；部署方仍可能在保持同一合同的情况下更换实现。MCP 工具调用继续按现有高风险权限和审批合同执行。

本适配器只接受无内嵌认证资料的 HTTP/HTTPS Streamable HTTP 端点。远程生产控制端解析并校验端点的全部 DNS 地址，拒绝非公网单播地址，并将实际连接固定到该次校验结果；DNS 混合返回公网与私网地址时整项拒绝。本机桌面、本机 CLI 和 loopback 开发仍可访问用户自己的本机 MCP。MCP 请求不跟随 HTTP 重定向。远程生产模式当前不支持管理员配置私网例外。

当前不提供 OAuth、凭据管理或公共 MCP 目录。能力适配器不替用户下载或安装 MCP 程序。plugins.enabled、服务自身 enabled 和 App 范围均尊重现有设置，安装适配器本身不修改全局 AI 扩展开关；模型可另经受权限约束的能力开关工具申请开启；设置中心扩展开关关闭时结果是“已安装”，不会报告为 Runtime 可用。旧服务没有摘要字段时维持原有行为。

Agent Runtime 的 MCP Tools Owner 按用户、App 和完整服务配置指纹复用 HTTP/stdio 会话；池最多保留 32 个连接，空闲 30 秒回收。Agent 能力发现会对账启用列表，配置变更或停用会标记旧连接失效，并在最后一个调用租约释放后关闭。安装探测显式关闭该对账，避免候选检查影响其他活跃服务；所有探测连接仍由租约持有并在结束时释放。用户 Run 的取消信号只绑定当前工具调用，不会污染共享传输；连接池不是工具调用结果缓存，也不会重放工具。真实用户 MCP 服务、远端配置撤销和网络断连行为尚未验收。

## 本机 stdio MCP Runtime

本机 stdio MCP 可由用户在“设置中心 > 插件 > MCP 连接”显式配置，也可通过本适配器检查用户明确提供的 command/argv、安装到当前账户和单一 App。Adapter 检查和 Agent Runtime 使用同一个 lfaa-mcp-client；Runtime 以 `shell:false` 启动直接可执行文件，限制参数与输出，使用桌面环境变量白名单，并在最后一个 Run 租约结束时关闭进程。远程生产 Host 在启动本机进程前失败关闭。Computer-Use 服务需要额外勾选标记，并同时通过账户 `computerControl.enabled` 开关；所有 MCP 工具继续受现有 `permissions.mode` 高风险权限合同约束。

stdio MCP 的 initialize instructions 只作为不可信能力说明交给模型，不能改变本轮目标或授权。工具返回的合法图片只进入当前 Provider 请求，历史与活动记录不保留图像字节。本机 stdio 不会由远程生产 Web 控制端代用户启动。能力安装适配器不会安装或下载第三方 MCP 程序。
