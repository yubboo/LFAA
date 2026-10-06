# LFAA MCP 能力安装适配器

lfaa-capability-mcp 把用户提供的 Streamable HTTP MCP 端点接入通用 capability_* 工具，并复用账户设置与 lfaa-tools 的真实协议 Runtime。检查只执行 MCP initialize、tools/list，不调用远端工具；安装前会重新检查工具合同，按当前用户写入 plugins.mcpServers，并只绑定本次选中的一个 App。

安装记录包含远端工具名称、说明和输入 schema 的 SHA-256。Agent Runtime 每次发现已启用服务时都会重算该摘要；远端工具清单变化后，整项服务不向模型暴露。该摘要固定的是 MCP 工具合同，不是远端服务器代码；部署方仍可能在保持同一合同的情况下更换实现。MCP 工具调用继续按现有高风险权限和审批合同执行。

本适配器只接受无内嵌认证资料的 HTTP/HTTPS Streamable HTTP 端点。当前不安装 GitHub 中的 stdio MCP 包，不提供 OAuth、凭据管理或公共 MCP 目录。plugins.enabled、服务自身 enabled 和 App 范围均尊重现有设置，不会替用户打开全局 AI 扩展开关；设置中心扩展开关关闭时结果是“已安装”，不会报告为 Runtime 可用。旧服务没有摘要字段时维持原有行为。
