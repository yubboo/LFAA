// @lfaa/agent-profile 浏览器端接口封装：读写 agent 定义、模型绑定与可选模型清单。
// 只做 HTTP 与类型转换。界面视图模型在这里单独声明，不导入 Host 内部模块（client 边界规则）。
import type { AgentItem, BindingItem, BindingTargetItem, CliRuntimeItem } from "./agents-types";

/** 新建 agent 的提交体。 */
export interface CreateAgentPayload {
  name: string;
  kind: "assistant" | "worker";
  instructions?: string;
  bindingId?: string;
  cliAgentId?: string;
  toolPolicy?: { allow?: string[]; deny?: string[] };
}

/** 更新 agent 的提交体。 */
export interface UpdateAgentPayload {
  name?: string;
  kind?: "assistant" | "worker";
  instructions?: string;
  bindingId?: string | null;
  cliAgentId?: string;
  enabled?: boolean;
  /** 传 null 表示清空工具策略。 */
  toolPolicy?: { allow?: string[]; deny?: string[] } | null;
}

/** 新建绑定的提交体（第一版只做单目标，路由组留给后续阶段）。 */
export interface CreateBindingPayload {
  name: string;
  strategy: "single" | "order" | "rotate" | "usage";
  targets: BindingTargetItem[];
}

/** 模型配置里的一个可选模型，供绑定选择器摊平展示。 */
export interface ModelOption {
  /** `profileId\u0000modelId`，选择器用它作为 value。 */
  value: string;
  profileId: string;
  modelId: string;
  label: string;
}

/** 统一解析 JSON 响应；非 2xx 把服务端 error 文案抛出。 */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = (parsed as { error?: unknown }).error;
    throw new Error(typeof message === "string" && message.trim() ? message : `请求失败（HTTP ${response.status}）。`);
  }
  return parsed as T;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return readJson<T>(response);
}

export async function fetchAgents(): Promise<AgentItem[]> {
  const { agents } = await readJson<{ agents: AgentItem[] }>(await fetch("/api/agents"));
  return agents;
}

export async function createAgent(payload: CreateAgentPayload): Promise<AgentItem> {
  const { agent } = await send<{ agent: AgentItem }>("/api/agents", "POST", payload);
  return agent;
}

export async function updateAgent(id: string, payload: UpdateAgentPayload): Promise<AgentItem> {
  const { agent } = await send<{ agent: AgentItem }>(`/api/agents/${encodeURIComponent(id)}`, "PATCH", payload);
  return agent;
}

export async function deleteAgent(id: string): Promise<void> {
  await send<{ removed: boolean }>(`/api/agents/${encodeURIComponent(id)}`, "DELETE");
}

export async function fetchBindings(): Promise<BindingItem[]> {
  const { bindings } = await readJson<{ bindings: BindingItem[] }>(await fetch("/api/bindings"));
  return bindings;
}

export async function createBinding(payload: CreateBindingPayload): Promise<BindingItem> {
  const { binding } = await send<{ binding: BindingItem }>("/api/bindings", "POST", payload);
  return binding;
}

export async function deleteBinding(id: string): Promise<void> {
  await send<{ removed: boolean }>(`/api/bindings/${encodeURIComponent(id)}`, "DELETE");
}

/** 拉取模型配置并摊平成「供应商/模型」列表，供绑定选择器使用。 */
export async function fetchModelOptions(): Promise<ModelOption[]> {
  const { profiles } = await readJson<{
    profiles: Array<{
      id: string;
      name: string;
      model: string;
      hasApiKey?: boolean;
      kind?: string;
      availableModels?: Array<{ id: string }>;
    }>;
  }>(await fetch("/api/llm/profiles"));
  const options: ModelOption[] = [];
  for (const profile of profiles) {
    // 本地模型（ollama）可以没有 Key，按可用处理。
    if (profile.hasApiKey === false && profile.kind !== "ollama") continue;
    const models = profile.availableModels && profile.availableModels.length > 0
      ? profile.availableModels.map((model) => model.id)
      : [profile.model];
    for (const modelId of models) {
      options.push({
        value: `${profile.id}\u0000${modelId}`,
        profileId: profile.id,
        modelId,
        label: `${profile.name} / ${modelId}`,
      });
    }
  }
  return options;
}
/** 导出全部 agent 与绑定快照（用于备份或换机）。 */
export async function exportAgents(): Promise<unknown> {
  const { snapshot } = await readJson<{ snapshot: unknown }>(await fetch("/api/agents/export"));
  return snapshot;
}

/** 导入快照；返回服务端统计的新增/覆盖数量。 */
export async function importAgents(snapshot: unknown): Promise<{
  agents: { added: number; updated: number };
  bindings: { added: number; updated: number };
}> {
  return send("/api/agents/import", "POST", { snapshot });
}
/** 汇总写/执行类工具名：用于「一键只读」预设，避免手敲。 */
export async function fetchWriteToolNames(): Promise<string[]> {
  const { tools } = await readJson<{ tools: Array<{ name: string; write?: boolean }> }>(await fetch("/api/tools"));
  return tools.filter((tool) => tool.write === true).map((tool) => tool.name);
}


export async function fetchCliRuntimes(refresh = false): Promise<CliRuntimeItem[]> {
  const data = refresh
    ? await send<{ agents: CliRuntimeItem[] }>("/api/cli-agents/refresh", "POST")
    : await readJson<{ agents: CliRuntimeItem[] }>(await fetch("/api/cli-agents"));
  return data.agents ?? [];
}

export async function toggleCliRuntimeEnabled(id: string, enabled: boolean): Promise<CliRuntimeItem[]> {
  const data = await send<{ agents: CliRuntimeItem[] }>(`/api/cli-agents/${encodeURIComponent(id)}`, "PATCH", { enabled });
  window.dispatchEvent(new CustomEvent("lfaa:cli-agents-changed", { detail: data }));
  return data.agents ?? [];
}
