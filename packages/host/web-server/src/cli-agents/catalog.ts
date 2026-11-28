// 官方外部 CLI 代理目录与公共类型定义：供本机探测、账户隔离、终端启动与聊天后端路由共用。
// 关联：packages/host/web-server/src/cli-agents/；运行环境：Node Host。

export type CliAgentMode = "chat" | "terminal";

export interface CliAgentAccount {
  id: string;
  label: string;
  /** 隔离的本地配置/登录上下文目录（位于 ~/.lfaa/cli-accounts/<agentId>/<accountId>）。 */
  homeDir: string;
  createdAt: number;
}

export interface CliAgentUserConfig {
  enabled: boolean;
  openMode: CliAgentMode;
  extraArgs: string;
  /** 空字符串或 null 表示复用系统默认登录；非空为受管账户 id。 */
  activeAccountId: string | null;
  accounts: CliAgentAccount[];
}

export interface CliAgentDefinition {
  id: string;
  name: string;
  vendor: string;
  binary: string;
  /** 备选可执行文件名（如 Windows 下的 .cmd 包装或别名）。 */
  aliases?: readonly string[];
  descriptionZh: string;
  descriptionEn: string;
  /** 是否支持在 LFAA 聊天框直接流式对话。 */
  supportsChat: boolean;
  /** 支持通过独立目录做多账户隔离时对应的环境变量名（如 CODEX_HOME、CLAUDE_CONFIG_DIR）。 */
  accountEnvVar?: string;
  /** 登录命令提示，用于一键在集成终端引导官方网页/OAuth 登录。 */
  loginCommand: string;
  /** 终端交互模式默认命令。 */
  terminalCommand: string;
  /** 未安装时的官方安装命令或文档链接。 */
  installHint: string;
  docsUrl: string;
}

export interface CliAgentDetection {
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  /** 是否检测到系统默认登录凭证文件（只读判定，不读取密钥内容）。 */
  systemLoginDetected: boolean;
  checkedAt: number;
}

export interface CliAgentSnapshot {
  id: string;
  name: string;
  vendor: string;
  binary: string;
  descriptionZh: string;
  descriptionEn: string;
  supportsChat: boolean;
  supportsAccounts: boolean;
  accountEnvVar: string | null;
  loginCommand: string;
  terminalCommand: string;
  installHint: string;
  docsUrl: string;
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  systemLoginDetected: boolean;
  enabled: boolean;
  openMode: CliAgentMode;
  extraArgs: string;
  activeAccountId: string | null;
  accounts: CliAgentAccount[];
}

export interface CliAgentsOverview {
  defaultOpenMode: CliAgentMode;
  agents: CliAgentSnapshot[];
}

/** 首批内置官方 CLI 代理目录：前 3 项支持聊天流式直连 + 账户隔离，其余支持探测、开关与终端启动。 */
export const CLI_AGENT_CATALOG: readonly CliAgentDefinition[] = [
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    binary: "codex",
    descriptionZh: "OpenAI 官方编码代理，支持 ChatGPT Plus/Pro 订阅网页登录与多账户隔离。",
    descriptionEn: "OpenAI official coding agent with ChatGPT subscription login and isolated local accounts.",
    supportsChat: true,
    accountEnvVar: "CODEX_HOME",
    loginCommand: "codex login",
    terminalCommand: "codex",
    installHint: "npm install -g @openai/codex",
    docsUrl: "https://github.com/openai/codex",
  },
  {
    id: "claude",
    name: "Claude Code",
    vendor: "Anthropic",
    binary: "claude",
    descriptionZh: "Anthropic 官方终端代理，支持 Claude Pro/Max 订阅登录与独立配置目录切换。",
    descriptionEn: "Anthropic official coding CLI with Claude subscription login and isolated config dirs.",
    supportsChat: true,
    accountEnvVar: "CLAUDE_CONFIG_DIR",
    loginCommand: "claude login",
    terminalCommand: "claude",
    installHint: "npm install -g @anthropic-ai/claude-code",
    docsUrl: "https://docs.anthropic.com/en/docs/claude-code",
  },
  {
    id: "agy",
    name: "Antigravity",
    vendor: "Google",
    binary: "agy",
    descriptionZh: "Google Antigravity 官方 CLI，复用本机 Google AI 套餐登录上下文。",
    descriptionEn: "Google Antigravity CLI reusing your local Google AI subscription context.",
    supportsChat: true,
    accountEnvVar: "AGY_HOME",
    loginCommand: "agy auth login",
    terminalCommand: "agy",
    installHint: "安装 Antigravity CLI 并确保 agy 在 PATH 中",
    docsUrl: "https://antigravity.google",
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "OpenCode",
    binary: "opencode",
    descriptionZh: "开源多模型终端编码代理，支持在集成终端启动。",
    descriptionEn: "Open-source terminal coding agent launched inside the integrated terminal.",
    supportsChat: false,
    loginCommand: "opencode auth login",
    terminalCommand: "opencode",
    installHint: "npm install -g opencode-ai",
    docsUrl: "https://opencode.ai",
  },
  {
    id: "grok",
    name: "Grok CLI",
    vendor: "xAI",
    binary: "grok",
    descriptionZh: "xAI Grok 命令行代理，支持在集成终端登录与运行。",
    descriptionEn: "xAI Grok CLI for terminal login and agent sessions.",
    supportsChat: false,
    loginCommand: "grok login",
    terminalCommand: "grok",
    installHint: "npm install -g @xai-official/grok-cli",
    docsUrl: "https://docs.x.ai",
  },
  {
    id: "cursor-agent",
    name: "Cursor Agent",
    vendor: "Cursor",
    binary: "cursor-agent",
    descriptionZh: "Cursor 官方 CLI 代理，复用本机 Cursor 订阅登录。",
    descriptionEn: "Cursor official CLI agent reusing your local Cursor subscription.",
    supportsChat: false,
    loginCommand: "cursor-agent login",
    terminalCommand: "cursor-agent",
    installHint: "curl https://cursor.com/install -fsS | bash",
    docsUrl: "https://cursor.com",
  },
  {
    id: "copilot",
    name: "GitHub Copilot CLI",
    vendor: "GitHub",
    binary: "copilot",
    descriptionZh: "GitHub Copilot 官方命令行代理。",
    descriptionEn: "GitHub Copilot official CLI agent.",
    supportsChat: false,
    loginCommand: "copilot auth login",
    terminalCommand: "copilot",
    installHint: "npm install -g @github/copilot",
    docsUrl: "https://github.com/features/copilot",
  },
  {
    id: "zcode",
    name: "ZCode (GLM)",
    vendor: "Z.AI / 智谱",
    binary: "zcode",
    descriptionZh: "智谱 / Z.AI GLM Coding Plan 官方命令行代理。",
    descriptionEn: "Z.AI / BigModel GLM Coding Plan official CLI agent.",
    supportsChat: false,
    loginCommand: "zcode login",
    terminalCommand: "zcode",
    installHint: "npm install -g @z-ai/zcode",
    docsUrl: "https://z.ai",
  },
  {
    id: "aider",
    name: "Aider",
    vendor: "Aider",
    binary: "aider",
    descriptionZh: "开源 Git 结对编程命令行代理。",
    descriptionEn: "Open-source Git pair programming CLI.",
    supportsChat: false,
    loginCommand: "aider --help",
    terminalCommand: "aider",
    installHint: "pip install aider-install && aider-install",
    docsUrl: "https://aider.chat",
  },
];

export function findCliAgentDefinition(id: string): CliAgentDefinition | undefined {
  return CLI_AGENT_CATALOG.find((item) => item.id === id);
}
