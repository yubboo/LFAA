# LFAA MCP Client

`lfaa-mcp-client` 持有真实 HTTP/stdio MCP 协议、连接池、出站校验与租约。旧 `core/tools/src/mcp-tools.ts` 已迁到 `src/runtime.ts`；Core 只消费工具合同，安装适配器复用此 Owner。

工具与 `resources/list`、`resources/templates/list`、`resources/read` 共用 initialize 能力、连接和账户/App 范围；资源服务可不声明 tools。资源页最多 200 项，协议响应有界，二进制 blob 不进入资源正文历史。执行前重新校验账户、App、配置及开关；启用状态或合同变化后旧工具拒绝执行。

HTTP 池最多 32 连接，空闲 30 秒回收；stdio 最后租约结束即关闭。Run 取消只影响当前调用，宿主卸载撤销连接，不缓存/重放副作用。Settings 的 plugins.enabled、mcpServers、computerControl.enabled 与现有权限管线共同控制范围；不安装未知 MCP 或自动获取凭据。

构建输出为根 `dist/packages/mcp/mcp-client/`。协议夹具已覆盖工具、资源、取消、图片和撤销；真实用户服务未实测。
