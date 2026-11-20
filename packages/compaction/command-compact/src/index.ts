// @lfaa/command-compact：把「立即压缩上下文」做成模型可调用的工具，下一轮运行生效。
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/compaction-basic";
import "@lfaa/tools";

/** 工具返回文案：明确说明"下一轮生效"，避免模型误以为立刻清空。 */
export function compactRequestedMessage(): string {
  return "已请求压缩上下文：下一次模型调用前会按更小预算强制压缩一轮，保留系统提示、最近轮次与最后一条需求。";
}

const commandCompactCore: Plugin.Object<void> = {
  name: "lfaa-command-compact",
  inject: ["compaction", "tools"],
  apply(ctx) {
    ctx.effect(() => ctx.tools.registerTool({
      moduleName: "@lfaa/command-compact",
      name: "compact_context",
      title: "立即压缩上下文",
      description: "当对话很长、需要腾出上下文空间时调用。压缩在下一次模型调用前生效，只保留系统提示、最近轮次与最后一条需求。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        ctx.compaction.requestCompaction();
        return {
          ok: true,
          output: compactRequestedMessage(),
          summary: "已请求压缩上下文",
          metadata: { compactionRequested: true },
        };
      },
    }));
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default commandCompactCore;