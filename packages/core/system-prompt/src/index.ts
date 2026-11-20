// @lfaa/system-prompt：系统提示词分段注册服务。插件按需追加段落，Agent 在组装 system 时统一合并。
import { Service } from "@deepseek-ai/cordis";
import type { Context, Plugin } from "@deepseek-ai/cordis";

/** 一个可追加到系统提示词的段落；text 可为字符串或惰性求值函数。 */
export interface PromptSegment {
  id: string;
  /** 数值越小越靠前；相同顺序按注册先后。 */
  order?: number;
  text: string | (() => string | Promise<string>);
}

/** 已注册段落的公开摘要，供诊断页展示。 */
export interface PromptSegmentSummary {
  id: string;
  order: number;
}

/** 提示词服务：管理段落并按顺序合成，永不抛错（单段失败只跳过该段）。 */
export class PromptService extends Service {
  private readonly segments = new Map<string, PromptSegment>();

  constructor(ctx: Context) {
    super(ctx, "prompt");
  }

  /** 注册或替换同 id 段落；返回注销函数。 */
  registerSegment(segment: PromptSegment): () => void {
    const id = segment.id.trim();
    if (!id) throw new Error("提示词段落 id 不能为空。");
    this.segments.set(id, { ...segment, id });
    return () => {
      if (this.segments.has(id)) this.segments.delete(id);
    };
  }

  list(): PromptSegmentSummary[] {
    return [...this.segments.values()].map(({ id, order }) => ({ id, order: order ?? 0 }));
  }

  /** 按 order 升序、同序按注册顺序拼接；空段与求值失败的段被跳过。 */
  async compose(): Promise<string> {
    const ordered = [...this.segments.values()]
      .map((segment, index) => ({ segment, index }))
      .sort((a, b) => (a.segment.order ?? 0) - (b.segment.order ?? 0) || a.index - b.index);
    const parts: string[] = [];
    for (const { segment } of ordered) {
      try {
        const text = typeof segment.text === "function" ? await segment.text() : segment.text;
        const trimmed = text.trim();
        if (trimmed) parts.push(trimmed);
      } catch {
        // 单段求值失败不应影响整轮运行，跳过并继续。
      }
    }
    return parts.join("\n\n");
  }
}

const systemPromptCore: Plugin.Object<void> = {
  name: "lfaa-system-prompt",
  apply(ctx) {
    new PromptService(ctx);
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default systemPromptCore;