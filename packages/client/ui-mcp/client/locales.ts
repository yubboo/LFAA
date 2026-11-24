// MCP 设置中心中英文界面文案。
const zh = {
  description: "连接本地或远程服务器，为会话添加 MCP 工具。",
  connections: "服务器", add: "添加服务器", import: "导入 JSON", loading: "正在读取服务器…",
  empty: "添加服务器或导入现有配置，开始使用 MCP 工具。", enabled: "启用", edit: "编辑",
  test: "测试连接", reconnect: "重连并刷新工具", tools: "工具", danger: "删除服务器",
  remove: "删除", cancel: "取消", save: "保存", close: "关闭",
  removeConfirm: "删除后会断开连接，并从会话中移除此服务器的工具。",
  project: "项目范围", global: "全部项目与全局会话", missingProject: "项目不可用",
  trust: "服务器审批", toolTrust: "工具审批", ask: "每次确认", trusted: "始终允许",
  inherit: "继承服务器设置", safety: "受信任的工具可在会话中直接运行。",
  id: "服务器名称", transport: "传输方式", command: "本地命令", args: "参数（JSON 数组）",
  env: "环境变量（JSON 对象）", url: "服务 URL", headers: "请求头（JSON 对象）",
  keep: "留空保留当前值。", commandHint: "命令将以当前系统用户身份启动。",
  importHelp: "粘贴 Claude Desktop 或 Cursor 的 mcpServers 配置。新服务器会以停用状态导入。",
  imported: "配置已导入。", saved: "配置已保存。", failed: "操作失败，请检查配置后重试。",
  invalidJson: "请输入有效的 JSON。", tested: (n: number) => `连接成功，发现 ${n} 个工具。`,
  count: (n: number) => `${n} 个工具`,
  status: { disabled: "已停用", connecting: "连接中", connected: "已连接", error: "连接失败" },
};

const en: typeof zh = {
  description: "Connect local or remote servers to add MCP tools to conversations.",
  connections: "Servers", add: "Add server", import: "Import JSON", loading: "Loading servers…",
  empty: "Add a server or import an existing configuration to use MCP tools.", enabled: "Enable", edit: "Edit",
  test: "Test connection", reconnect: "Reconnect and refresh tools", tools: "Tools", danger: "Remove servers",
  remove: "Remove", cancel: "Cancel", save: "Save", close: "Close",
  removeConfirm: "Removing a server disconnects it and removes its tools from conversations.",
  project: "Project scope", global: "All projects and global conversations", missingProject: "Project unavailable",
  trust: "Server approval", toolTrust: "Tool approval", ask: "Ask every time", trusted: "Always allow",
  inherit: "Use server setting", safety: "Trusted tools can run directly in conversations.",
  id: "Server name", transport: "Transport", command: "Local command", args: "Arguments (JSON array)",
  env: "Environment variables (JSON object)", url: "Server URL", headers: "Headers (JSON object)",
  keep: "Leave blank to keep the current value.", commandHint: "The command runs as the current OS user.",
  importHelp: "Paste a Claude Desktop or Cursor mcpServers configuration. Imported servers start disabled.",
  imported: "Configuration imported.", saved: "Configuration saved.", failed: "Action failed. Check the configuration and retry.",
  invalidJson: "Enter valid JSON.", tested: (n) => `Connected. Found ${n} tools.`,
  count: (n) => `${n} tools`,
  status: { disabled: "Disabled", connecting: "Connecting", connected: "Connected", error: "Connection failed" },
};

export type McpLabels = typeof zh;
export const mcpLabels = (isZh: boolean): McpLabels => isZh ? zh : en;
