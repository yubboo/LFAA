/**
 * 文件：index.ts
 * 功能：登记联网能力缝服务 lfaaWeb，维护搜索/抓取 Provider 注册表并在执行时选择可用 Provider。
 * 作用：Provider 重复注册会被拒绝；执行时按“显式配置 ID → 唯一可用 Provider”规则选择，
 *      不依赖注册顺序；搜索结果的 sources 在返回前强制按 maxResults 截断。
 * 不负责：具体 Provider 网络实现、模型工具 schema、HTML 渲染。
 * 关联文件：types.ts、packages/web/web-fetch-http、packages/web/web-search-deepseek、packages/web/tool-web。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web。
 */
import type { Context } from "@deepseek-ai/cordis";
import { WebError } from "./types.js";
import type {
  WebFetchProvider,
  WebFetchRequest,
  WebFetchResult,
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
} from "./types.js";

export { WebError } from "./types.js";
export type {
  WebFetchBody,
  WebFetchProvider,
  WebFetchRequest,
  WebFetchResult,
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from "./types.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaWeb: WebRuntime;
  }
}

interface ResolvableProvider {
  readonly id: string;
  available(): boolean;
}

/**
 * 联网能力缝服务。每个 Context 一个实例，通过 ctx.provide("lfaaWeb", ...) 注册。
 *
 * 选择语义（执行时解析，不依赖注册顺序）：
 * - 显式配置 ID 已注册且 available() → 该 Provider；
 * - 显式配置 ID 未注册 → WEB_PROVIDER_CONFIGURED_MISSING；
 * - 显式配置 ID 已注册但不可用 → WEB_PROVIDER_CONFIGURED_UNAVAILABLE；
 * - 未配置且恰好一个可用 Provider → 该 Provider；
 * - 未配置且多个可用 → WEB_PROVIDER_AMBIGUOUS；
 * - 未配置且无可用 → WEB_PROVIDER_UNAVAILABLE。
 */
export class WebRuntime {
  private readonly searchProviders = new Map<string, WebSearchProvider>();
  private readonly fetchProviders = new Map<string, WebFetchProvider>();

  constructor(
    /** 显式指定的搜索/抓取 Provider ID；省略时走“唯一可用”自动选择。 */
    private readonly configured: { searchProvider?: string; fetchProvider?: string } = {},
  ) {}

  /** 注册搜索 Provider；ID 重复抛 WEB_DUPLICATE_PROVIDER。返回注销函数。 */
  registerSearchProvider(provider: WebSearchProvider): () => void {
    return this.registerProvider(this.searchProviders, provider);
  }

  /** 注册抓取 Provider；ID 重复抛 WEB_DUPLICATE_PROVIDER。返回注销函数。 */
  registerFetchProvider(provider: WebFetchProvider): () => void {
    return this.registerProvider(this.fetchProviders, provider);
  }

  private registerProvider<P extends { readonly id: string }>(store: Map<string, P>, provider: P): () => void {
    if (store.has(provider.id)) {
      throw new WebError(`id 为 "${provider.id}" 的联网 Provider 已注册`, "WEB_DUPLICATE_PROVIDER");
    }
    store.set(provider.id, provider);
    return () => { if (store.get(provider.id) === provider) store.delete(provider.id); };
  }

  /** 通过选中的 Provider 执行一次搜索；结果按 request.maxResults 截断。 */
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const provider = this.resolve(this.searchProviders, this.configured.searchProvider);
    const result = await provider.search(request, signal);
    return capSources(result, request.maxResults);
  }

  /** 通过选中的 Provider 抓取一个 URL；非 2xx 是结果而非抛错。 */
  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    const provider = this.resolve(this.fetchProviders, this.configured.fetchProvider);
    return provider.fetch(request, signal);
  }

  private resolve<P extends ResolvableProvider>(providers: ReadonlyMap<string, P>, configuredId: string | undefined): P {
    if (configuredId !== undefined) {
      const provider = providers.get(configuredId);
      if (!provider) {
        throw new WebError(`已配置的联网 Provider "${configuredId}" 未注册`, "WEB_PROVIDER_CONFIGURED_MISSING");
      }
      if (!provider.available()) {
        throw new WebError(`已配置的联网 Provider "${configuredId}" 已注册但当前不可用`, "WEB_PROVIDER_CONFIGURED_UNAVAILABLE");
      }
      return provider;
    }
    const usable = [...providers.values()].filter((item) => item.available());
    const [single] = usable;
    if (single === undefined) {
      throw new WebError("当前没有可用的联网 Provider", "WEB_PROVIDER_UNAVAILABLE");
    }
    if (usable.length > 1) {
      const ids = usable.map((item) => item.id).join(", ");
      throw new WebError(`存在多个可用联网 Provider（${ids}），请显式指定一个`, "WEB_PROVIDER_AMBIGUOUS");
    }
    return single;
  }
}

/** 按 maxResults 截断 sources，并在截断时置 truncated。 */
function capSources(result: WebSearchResult, maxResults: number | undefined): WebSearchResult {
  if (maxResults === undefined || result.sources.length <= maxResults) return result;
  return { ...result, sources: result.sources.slice(0, maxResults), truncated: true };
}

/** Cordis 插件名（加载器诊断用）。 */
export const name = "lfaaWeb";

/** 登记 lfaaWeb 服务。无 inject：它是后续联网 Provider 的基础服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, new WebRuntime());
}
