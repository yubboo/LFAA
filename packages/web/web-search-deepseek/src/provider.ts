/**
 * 文件：provider.ts
 * 功能：DeepSeek 搜索 Provider——通过 Anthropic 兼容 Messages API 调用原生 web_search_20250305。
 * 作用：每次搜索消耗一次模型回合，返回结构化结果块；结果块缺失视为错误，不做正文抓取兜底。
 * 不依赖 ctx.llm：线上格式与原生 fetch 客户端由本 Provider 私有。
 * 关联文件：types.ts、packages/web/web。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-search-deepseek。
 * LFAA 适配：密钥不写死；优先从 settings 中当前用户已激活的 DeepSeek 账户注入，
 *      其次取环境变量 DEEPSEEK_API_KEY；端点可用 DEEPSEEK_SEARCH_BASE_URL 覆盖。
 */
import { WebError } from "lfaa-web/src/types.js";
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from "lfaa-web/src/types.js";
import { resolveActiveAiModelConfiguration } from "lfaa-settings/src/service.js";
import type { AnthropicError, AnthropicResponse, ContentBlock, TextBlock, WebSearchToolResultBlock } from "./types.js";

/** Provider 注册使用的稳定 ID。 */
export const DEEPSEEK_PROVIDER_ID = "deepseek-official";

/** 辅助搜索默认端点（含 /v1），/messages 由本 Provider 拼接。 */
export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic/v1";

/** 默认 Anthropic 格式模型名。 */
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

/** 默认 anthropic-version 头。 */
export const DEEPSEEK_DEFAULT_API_VERSION = "2023-06-01";

/** 默认生成 token 上限。 */
export const DEEPSEEK_DEFAULT_MAX_TOKENS = 4096;

/** 单次请求 web_search 服务工具最大调用次数。 */
export const DEEPSEEK_DEFAULT_MAX_USES = 5;

const USER_AGENT = "lfaa-harness/0.1";

/** 从 text 块的 citations 构造 url→引用正文 映射（snippet 来源）。 */
export function citationSnippets(blocks: readonly ContentBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of blocks) {
    if (block.type !== "text") continue;
    for (const cite of ((block as TextBlock).citations ?? [])) {
      if (cite.url != null && cite.url.length > 0 && cite.cited_text != null && cite.cited_text.length > 0 && !map.has(cite.url)) {
        map.set(cite.url, cite.cited_text);
      }
    }
  }
  return map;
}

/** 把 Anthropic Messages 响应映射为归一化搜索结果。 */
export function mapAnthropicResponse(response: AnthropicResponse): WebSearchResult {
  const blocks = response.content ?? [];
  const resultBlocks = blocks.filter(
    (block): block is WebSearchToolResultBlock => block.type === "web_search_tool_result",
  );
  if (resultBlocks.length === 0) {
    throw new WebError("DeepSeek 未返回 web_search_tool_result 块，本次请求可能未触发原生联网搜索", "WEB_PROVIDER_ERROR");
  }
  const snippets = citationSnippets(blocks);
  const seen = new Set<string>();
  const sources: WebSearchSource[] = [];
  for (const block of resultBlocks) {
    for (const item of block.content ?? []) {
      if (item.type !== "web_search_result" || item.url.length === 0 || seen.has(item.url)) continue;
      seen.add(item.url);
      const snippet = snippets.get(item.url);
      sources.push({
        url: item.url,
        ...(item.title != null && item.title.length > 0 ? { title: item.title } : {}),
        ...(snippet != null && snippet.length > 0 ? { snippet } : {}),
        ...(item.page_age != null && item.page_age.length > 0 ? { publishedAt: item.page_age } : {}),
      });
    }
  }
  return { sources, truncated: false };
}

/** 解析一次搜索所需的密钥与端点。 */
interface ResolvedCredential {
  apiKey: string;
  baseURL: string;
}

/**
 * 解析当前搜索的密钥。优先当前用户已激活的 DeepSeek 账户（服务端注入，不写入日志），
 * 其次环境变量 DEEPSEEK_API_KEY；都没有则抛结构化错误，指引用户在设置中配置 DeepSeek 账户。
 */
async function resolveCredential(request: WebSearchRequest): Promise<ResolvedCredential> {
  const baseURL = process.env.DEEPSEEK_SEARCH_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL;
  if (request.userId !== undefined) {
    try {
      const account = resolveActiveAiModelConfiguration(request.userId);
      if (account && account.providerId === "deepseek" && account.secret.length > 0) {
        return { apiKey: account.secret, baseURL };
      }
    } catch {
      // 账户读取失败时回退到环境变量，不把账户异常暴露为 Provider 内部错误。
    }
  }
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey !== undefined && envKey.length > 0) return { apiKey: envKey, baseURL };
  throw new WebError(
    "DeepSeek 搜索缺少密钥：请在设置中心配置并激活一个 DeepSeek 账户，或在服务端环境变量 DEEPSEEK_API_KEY 中提供密钥。",
    "WEB_PROVIDER_CREDENTIAL_MISSING",
  );
}

/** DeepSeek 联网搜索 Provider。 */
export class DeepSeekSearchProvider implements WebSearchProvider {
  readonly id = DEEPSEEK_PROVIDER_ID;

  /** 廉价本地检查：端点可解析即可注册；密钥在真正搜索时按用户解析。 */
  available(): boolean {
    try {
      new URL(DEEPSEEK_DEFAULT_BASE_URL);
      return true;
    } catch {
      return false;
    }
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    if (signal?.aborted) throw new WebError("DeepSeek 搜索已取消", "WEB_ABORTED");
    const credential = await resolveCredential(request);
    const endpoint = `${credential.baseURL}/messages`;
    const body = {
      model: DEEPSEEK_DEFAULT_MODEL,
      max_tokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
      messages: [{
        role: "user" as const,
        content: [{ type: "text" as const, text: `请对以下查询进行联网搜索：${request.query}` }],
      }],
      tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: DEEPSEEK_DEFAULT_MAX_USES }],
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          "x-api-key": credential.apiKey,
          "authorization": `Bearer ${credential.apiKey}`,
          "anthropic-version": DEEPSEEK_DEFAULT_API_VERSION,
          "content-type": "application/json",
          "accept": "application/json",
          "user-agent": USER_AGENT,
        },
        body: JSON.stringify(body),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw new WebError("DeepSeek 搜索已取消", "WEB_ABORTED", { cause: error });
      throw new WebError(`DeepSeek 搜索请求失败：${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
    }

    if (!response.ok) {
      const status = response.status;
      let message = `DeepSeek API 错误（HTTP ${status}）`;
      try {
        const parsed = await response.json() as AnthropicError;
        const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
        if (detail !== undefined && detail.length > 0) message += `：${detail}`;
      } catch {
        // 非 JSON 错误体不影响主错误信息。
      }
      throw new WebError(`${message}。搜索端点为 ${endpoint}，请在设置中心检查 DeepSeek 账户配置。`, "WEB_PROVIDER_ERROR");
    }

    try {
      const payload = await response.json() as AnthropicResponse;
      return mapAnthropicResponse(payload);
    } catch (error) {
      if (error instanceof WebError) throw error;
      if (signal?.aborted) throw new WebError("DeepSeek 搜索已取消", "WEB_ABORTED", { cause: error });
      throw new WebError(`DeepSeek 返回了无法解析的响应：${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
    }
  }
}

/** fetch/AbortSignal 取消错误识别。 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
