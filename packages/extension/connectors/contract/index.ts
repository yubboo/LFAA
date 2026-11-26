// 定义连接器（MCP / CLI）列表、CLI 动作模板与参数 schema 的浏览器安全契约；不回流可执行文件细节以外的敏感值。
export type ConnectorKind = "mcp" | "cli";
export type ConnectorStatus = "disabled" | "connecting" | "ready" | "error";
export type ConnectorTrust = "ask" | "trusted";

/** 工具级别的信任：inherit 表示跟随连接器设置。 */
export interface ConnectorToolSummary {
  name: string;
  title: string;
  trust: ConnectorTrust | "inherit";
}

/** CLI 动作的只读摘要，列表页用来显示动作数与只读标记。 */
export interface CliActionSummary {
  id: string;
  title: string;
  readOnly: boolean;
  /** 动作级审批；缺省表示继承连接器设置。 */
  trust?: ConnectorTrust;
}

/** 连接器列表项：MCP 与 CLI 共用同一形状，`kind` 区分来源。 */
export interface ConnectorSummary {
  id: string;
  kind: ConnectorKind;
  name: string;
  description: string;
  enabled: boolean;
  projectId: string | null;
  trust: ConnectorTrust;
  status: ConnectorStatus;
  /** mcp：传输与地址摘要；cli：可执行文件与解析结果。 */
  detail: string;
  tools: ConnectorToolSummary[];
  actions: CliActionSummary[];
}

export type CliParamType = "string" | "number" | "boolean";

/** 动作参数：类型与说明直接映射成工具的 JSON Schema。 */
export interface CliParamConfig {
  type: CliParamType;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: string | number | boolean;
}

/** argv 项：字面量字符串，或带占位符值的对象；when 引用布尔参数决定是否拼接。 */
export type CliArgConfig = string | { arg: string; value?: string; when?: string };

/** 一个可被智能体调用的 CLI 动作。 */
export interface CliActionConfig {
  id: string;
  title: string;
  description: string;
  readOnly: boolean;
  /** 动作级审批；缺省表示继承连接器设置。 */
  trust?: ConnectorTrust;
  argv: CliArgConfig[];
  params: Record<string, CliParamConfig>;
  timeoutMs?: number;
}

/** CLI 连接器配置：动作列表在这里声明，执行时只按模板拼 argv，不经过 shell。 */
export interface CliConnectorConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  projectId: string | null;
  trust: ConnectorTrust;
  executable: string;
  cwd: string;
  env: Record<string, string>;
  probeArgs: string[];
  actions: CliActionConfig[];
}

/** 内置模板：只预填配置，不安装二进制。 */
export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  connector: CliConnectorConfig;
}

export interface ConnectorTestResult {
  ok: boolean;
  detail: string;
}

export interface ConnectorProbeResult {
  path?: string;
  version?: string;
  error?: string;
}

/** 目录条目的分类；popular 由条目自身的 popular 标记推导，不单独存储。 */
export type CatalogCategory = "dev" | "office" | "data" | "system";

export type CatalogInputKind = "text" | "password" | "directory";

/** 连接前需要用户填写的输入项（目录、令牌、连接串）。 */
export interface CatalogInput {
  key: string;
  label: string;
  kind: CatalogInputKind;
  placeholder?: string;
  required?: boolean;
}

/** 安装方式：只接受内置目录里的固定参数，避免任意命令执行。 */
export interface CatalogInstallSpec {
  manager: "winget" | "npm" | "choco" | "scoop";
  id: string;
}

export interface CatalogMcpDefinition {
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface CatalogCliDefinition {
  executable: string;
  actions: CliActionConfig[];
  installs?: CatalogInstallSpec[];
  /** 连接时真正执行一次以证明命令可用；缺省用 --version。 */
  probeArgs?: string[];
}

/** 内置目录条目：连接后落成 MCP 服务器或 CLI 连接器。 */
export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  /** 首版图标用 emoji，不随包分发品牌素材。 */
  glyph: string;
  category: CatalogCategory;
  popular?: boolean;
  kind: ConnectorKind;
  publisher: string;
  version: string;
  website: string;
  privacy?: string;
  examples: string[];
  inputs?: CatalogInput[];
  mcp?: CatalogMcpDefinition;
  cli?: CatalogCliDefinition;
}

/** 目录条目 + 当前连接状态与真实工具数量。 */
export interface CatalogItem extends CatalogEntry {
  connected: boolean;
  status: ConnectorStatus;
  /** 已注册（MCP）或已声明（CLI）的工具数，用于证明连接确实带回了能力。 */
  toolCount: number;
  /** CLI 连接器的动作数；MCP 为 0。 */
  actionCount: number;
}

export type CatalogJobState = "running" | "done" | "error";

/** 连接/安装任务：客户端轮询它显示进度与结果。 */
export interface CatalogJob {
  id: string;
  entryId: string;
  state: CatalogJobState;
  message: string;
  startedAt: number;
}