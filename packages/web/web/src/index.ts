// @lfaa/web：网页能力 seam。多个抓取实现按优先级注册，工具与 Agent 只依赖本服务，便于替换实现。
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";

/** 一次网页抓取请求。 */
export interface WebFetchRequest {
  url: string;
  /** 调用方取消（如会话中断）时中止抓取。 */
  signal?: AbortSignal;
}

/** 抓取结果：保留原始正文，正文抽取与清洗交给上层工具。 */
export interface WebFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
  /** 正文因体积上限被截断时为 true。 */
  truncated: boolean;
}

/** 具体抓取实现：HTTP、无头浏览器或内网代理，同一时刻可并存多个。 */
export interface WebProvider {
  id: string;
  /** 数值越大越先尝试；缺省 0。 */
  priority?: number;
  fetchText(request: WebFetchRequest): Promise<WebFetchResult>;
}

/** 按优先级排序抓取实现，供服务与测试共用。 */
export function orderProviders(providers: readonly WebProvider[]): WebProvider[] {
  return [...providers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** 面向工具与 Agent 的网页服务：只暴露「按优先级取到正文」这一件事。 */
export class WebService extends Service {
  private readonly providers = new Map<string, WebProvider>();

  constructor(ctx: Context) {
    super(ctx, "web");
  }

  /** 注册抓取实现，返回注销函数；插件卸载时由 ctx.effect 回收。 */
  registerProvider(provider: WebProvider): () => void {
    const id = provider.id.trim();
    if (!id) throw new Error("网页抓取实现的 id 不能为空。");
    this.providers.set(id, { ...provider, id, priority: provider.priority ?? 0 });
    return () => {
      if (this.providers.get(id) === provider || this.providers.has(id)) this.providers.delete(id);
    };
  }

  /** 列出已注册实现的 id 与优先级，供设置页诊断。 */
  listProviders(): Array<{ id: string; priority: number }> {
    return orderProviders([...this.providers.values()]).map(({ id, priority }) => ({ id, priority: priority ?? 0 }));
  }

  /** 依次尝试实现，全部失败时汇总各自错误后抛出，避免掩盖根因。 */
  async fetchText(request: WebFetchRequest): Promise<WebFetchResult> {
    const ordered = orderProviders([...this.providers.values()]);
    if (ordered.length === 0) {
      throw new Error("没有可用的网页抓取实现，请先挂载 @lfaa/web-fetch-http。");
    }
    const failures: string[] = [];
    for (const provider of ordered) {
      try {
        return await provider.fetchText(request);
      } catch (error) {
        failures.push(`${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`网页抓取失败（${failures.join("；")}）`);
  }
}

/** 为 Host 上下文注册网页服务。 */
export function webPlugin(ctx: Context): void {
  new WebService(ctx);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    web: WebService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default webPlugin;