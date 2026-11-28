// @lfaa/agent-profile 浏览器端视图模型：只描述界面需要渲染的字段，不依赖 Host 内部类型。
// 该包没有 contract 子路径；界面与 Host 通过 JSON 字段名对齐，字段增删在同一轮两端一起改。

/** 一个 agent 在列表里的展示形态。 */
export interface AgentItem {
  id: string;
  name: string;
  kind: "assistant" | "worker";
  source: "builtin" | "user" | "imported";
  enabled: boolean;
  description?: string;
  icon?: string;
  instructions?: string;
  bindingId?: string;
  /** 可选：绑定本机官方 CLI 运行时 id（如 claude / codex / agy）。 */
  cliAgentId?: string;
  /** 工具边界：deny 永远剔除，allow 非空时只放行名单内。 */
  toolPolicy?: { allow?: string[]; deny?: string[] };
}

/** 本机官方 CLI 运行时摘要（来自 /api/cli-agents）。 */
export interface CliRuntimeItem {
  id: string;
  name: string;
  vendor: string;
  binary: string;
  descriptionZh: string;
  descriptionEn: string;
  supportsChat: boolean;
  loginCommand: string;
  installHint: string;
  docsUrl: string;
  installed: boolean;
  version: string | null;
  systemLoginDetected: boolean;
  enabled: boolean;
}

/** 绑定里的一个目标。 */
export interface BindingTargetItem {
  profileId: string;
  modelId?: string;
}

/** 一份模型绑定（单模型与路由组同一形态）。 */
export interface BindingItem {
  id: string;
  name: string;
  strategy: "single" | "order" | "rotate" | "usage";
  targets: BindingTargetItem[];
  onError: "next" | "fail";
  cooldownMs?: number;
  inheritGlobal?: boolean;
  builtin?: boolean;
}