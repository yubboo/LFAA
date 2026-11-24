# LFAA 原生 MCP（Model Context Protocol）客户端接入方案

- 状态：2026-11-25 负责人确认实施
- 日期：2026-11-25
- 涉及包（规划）：
  - 新增能力包：`packages/extension/mcp`（`@lfaa/mcp`）
  - 新增界面包：`packages/client/ui-mcp`（`@lfaa/client-ui-mcp`）
  - 装配接入：`packages/bundle/web`、`packages/host/web-server`

## 1. 目标与边界

- 让 LFAA 原生支持标准 **MCP（Model Context Protocol）** 客户端，使小鱼在不膨胀内置核心工具的前提下，按需接入 Figma、GitHub、飞书、Notion、数据库、高德地图等外部工具生态。
- 严格遵循 LFAA 架构边界：
  - 能力包 `packages/extension/mcp` 只放 Host/领域层代码（`src/` + `contract/`），不得导入 React/DOM；
  - 界面包 `packages/client/ui-mcp` 放在设置中心「集成 → MCP 服务器」，遵循 `docs/standards/settings-ui.md` 规范。

## 2. 核心设计（分 3 阶段）

### P1：Host 侧 MCP 客户端底座（`packages/extension/mcp`）
- 配置文件存储在 `~/.lfaa/mcp-servers.json`（兼容 Claude Desktop / Cursor 常见 `mcpServers` JSON 结构，支持导入）。
- 支持两种标准传输协议：
  1. **Stdio**：拉起本地 MCP Server 子进程（如 `npx -y @modelcontextprotocol/server-filesystem`），自动生命周期管理与崩溃隔离。
  2. **Streamable HTTP / SSE**：连接远程 MCP Server（支持自定义请求头 / Bearer Token）。
- 工具桥接：连接成功后调用 `tools/list`，把每个外部工具按 `mcp__<serverId>__<toolName>` 命名空间动态注册进 `ctx.tools`；服务器停用或卸载时自动注销，**不污染未启用时的 System Prompt Token**。
- 安全边界：所有外部 MCP 工具默认走 `exec` 审批级别（可按服务器/工具在设置中调整信任策略），环境变量密钥脱敏落盘、绝不回传前端明文。

### P2：HTTP API 与设置中心界面（`packages/client/ui-mcp`）
- 路由：`/api/mcp/servers`（增删改查、启停、测试连接、刷新工具列表）。
- 设置中心「集成 → MCP」页面：
  - 服务器列表（名称、传输类型、运行状态绿/红点、已暴露工具数量、启用开关、重连/删除）；
  - 表单弹窗（新增/编辑 Stdio 命令或 HTTP URL、粘贴 JSON 快速导入）。

### P3：按项目/按需生效与验收
- 支持全局启用或绑定特定项目启用，防止不相关项目的 MCP 工具占用上下文。
- 补齐 mock stdio MCP server 端到端单测、`pnpm probe:boot` 与双主题浏览器验收。
