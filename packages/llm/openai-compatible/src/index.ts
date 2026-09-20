/**
 * 文件：index.ts
 * 作用：把 OpenAI-compatible Provider 连接转换成一次 LFAA 文本模型调用。
 * 负责：协议路由、模型参数映射、HTTP 状态归一化、Provider 文本响应解析。
 * 不负责：账户/Secret 持久化、Run 生命周期、Session 历史、Vite/HTTP Controller。
 * 状态归属：无持久状态；每次调用只消费显式参数。
 * 对外接口：callOpenAiCompatibleTextModel、LlmConversationMessage。
 * 关联文件：packages/api/agent-controller/src/agent-runtime-bridge.ts、packages/settings/config-system/src/settings/ai/。
 * 修改注意事项：不得把远端响应体或认证值拼入错误；Provider 特有参数必须来自 Config System capability 描述。
 */
import {
  AiProviderRegistry,
  builtinAiProviderPlugins,
  type AiAccountRecord,
  type AiModelSettingValue,
} from "@lfaa/config-system";
import type { AgentRunRequest } from "@lfaa/agent-runtime";

export type LlmConversationMessage = { role: "user" | "assistant"; content: string };
type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

const REASONING_BOOST_INSTRUCTION =
  "Use a more deliberate verification pass before answering. Keep internal reasoning private and return only the final answer.";

function setRequestPath(target: Record<string, unknown>, path: string, value: AiModelSettingValue): void {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("Provider 返回了无效响应。");
  const root = payload as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  const choices = root.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) return content.trim();
      }
    }
  }
  const output = root.output;
  if (Array.isArray(output)) {
    const text = output.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string"
        ? [(part as Record<string, unknown>).text as string] : []);
    }).join("");
    if (text.trim()) return text.trim();
  }
  throw new Error("Provider 响应没有可显示的文本。");
}

export async function callOpenAiCompatibleTextModel(options: {
  account: AiAccountRecord;
  request: AgentRunRequest;
  credential: string;
  history: readonly LlmConversationMessage[];
  signal: AbortSignal;
}): Promise<string> {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  const provider = registry.get(options.account.providerId);
  const connection = provider.resolveConnection({ authMethodId: options.account.authMethodId, settings: options.account.settings });
  if (connection.protocol !== "openai-compatible" || !connection.baseUrl || !connection.authHeader) {
    throw new Error("当前认证方式尚未接入本地 API Runtime；ChatGPT/Codex 套餐由官方 Harness Adapter 承担。");
  }

  const authValue = connection.authHeader.scheme ? `${connection.authHeader.scheme} ${options.credential}` : options.credential;
  const headers = { "content-type": "application/json", accept: "application/json", [connection.authHeader.name]: authValue };
  const capability = provider.describeModel(options.request.model.modelId);
  const settings = options.request.model.settings ?? {};
  const providerHistory: readonly ProviderMessage[] = options.request.executionHints?.reasoningBoost
    ? [{ role: "system", content: REASONING_BOOST_INSTRUCTION }, ...options.history]
    : options.history;

  let url: string;
  const body: Record<string, unknown> = { model: options.request.model.modelId };
  if (options.account.providerId === "openai") {
    url = `${connection.baseUrl.replace(/\/$/, "")}/responses`;
    body.input = providerHistory.map((message) => ({ role: message.role, content: message.content }));
  } else {
    url = `${connection.baseUrl.replace(/\/$/, "")}/chat/completions`;
    body.messages = providerHistory;
  }

  for (const field of capability?.settings ?? []) {
    const value = settings[field.id];
    if (value !== undefined) setRequestPath(body, field.requestPath, value);
  }

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: options.signal });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Provider 认证失败（HTTP 401），请重新验证当前账户凭据。");
    if (response.status === 429) throw new Error("Provider 当前限流或额度不足（HTTP 429）。");
    throw new Error(`Provider 调用失败（HTTP ${response.status}）。`);
  }
  return responseText(await response.json());
}
