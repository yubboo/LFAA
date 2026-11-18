// 为 LFAA 内置 Agent 注册记忆写入与资料库/资产库读写工具（随 AgentService 卸载自动清理）。
import type { Context } from "@deepseek-ai/cordis";

export function registerAgentLibraryTools(ctx: Context): () => void {
  const offSaveMemory = ctx.tools.registerTool({
    name: "save_memory",
    title: "记录长期记忆",
    description: "将重要的项目约束或用户长期偏好保存至资料库记忆库，供后续对话自动召回。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "简明清晰的事实或偏好描述" },
        scope: { type: "string", enum: ["global", "project"], description: "global 全局或 project 当前项目" },
        tags: { type: "array", items: { type: "string" }, description: "可选标签" },
      },
      required: ["content"],
    },
    execute: async (args, execCtx) => {
      const session = await ctx.memory.getSession(execCtx.sessionId);
      const scope = args.scope === "project" && session?.projectId ? "project" : "global";
      const entry = await ctx.memory.addMemory({
        scope,
        projectId: scope === "project" ? (session?.projectId ?? null) : null,
        content: typeof args.content === "string" ? args.content : "",
        tags: Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string") : [],
        sourceSessionId: execCtx.sessionId,
      });
      return {
        ok: true,
        output: `已保存记忆 (${entry.scope}): ${entry.content}`,
        summary: "已写入资料库记忆",
      };
    },
  });

  const offListLibrary = ctx.tools.registerTool({
    name: "list_library_assets",
    title: "查看资料库与资产库",
    description: "列出 LFAA 本地资料库中的长期记忆、Agent 产物与本地资产，并显示当前存储目录。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["all", "artifact", "asset"], description: "筛选分类，默认 all" },
        query: { type: "string", description: "按标题、文件名或标签检索（可选）" },
      },
    },
    execute: async (args, execCtx) => {
      const session = await ctx.memory.getSession(execCtx.sessionId);
      const category = args.category === "artifact" || args.category === "asset" ? args.category : undefined;
      const query = typeof args.query === "string" ? args.query : undefined;
      const [storage, assets, memories] = await Promise.all([
        ctx.memory.getStorageState(),
        ctx.memory.listLibraryAssets({
          ...(category ? { category } : {}),
          ...(session?.projectId ? { projectId: session.projectId } : {}),
          ...(query ? { query } : {}),
        }),
        ctx.memory.listLongTermMemories({
          ...(session?.projectId ? { projectId: session.projectId } : {}),
          ...(query ? { query } : {}),
        }),
      ]);
      const assetLines = assets.slice(0, 20).map(
        (a) => `- [${a.category}] ${a.title} (${a.fileName}, id=${a.id}, path=${a.relativePath})`,
      );
      const memLines = memories.slice(0, 12).map((m) => `- [${m.scope}] ${m.content}`);
      return {
        ok: true,
        output: [
          `资料库根目录：${storage.dataRoot}`,
          `资产/产物 (${assets.length})：`,
          assetLines.join("\n") || "（暂无资产或产物）",
          `长期记忆 (${memories.length})：`,
          memLines.join("\n") || "（暂无长期记忆）",
        ].join("\n"),
        summary: `资料库含 ${assets.length} 项资产与 ${memories.length} 条记忆`,
      };
    },
  });

  const offReadLibrary = ctx.tools.registerTool({
    name: "read_library_asset",
    title: "读取资料库资产",
    description: "根据资产 ID 或标题读取资料库中的产物/资产文本内容。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "资产 ID 或标题关键字" },
      },
      required: ["id"],
    },
    execute: async (args) => {
      const rawId = typeof args.id === "string" ? args.id.trim() : "";
      if (!rawId) return { ok: false, output: "缺少资产 ID 或标题。", summary: "参数缺失" };
      let detail = await ctx.memory.readLibraryAsset(rawId);
      if (!detail) {
        const matched = await ctx.memory.listLibraryAssets({ query: rawId });
        if (matched[0]) {
          detail = await ctx.memory.readLibraryAsset(matched[0].id);
        }
      }
      if (!detail) {
        return { ok: false, output: `资料库中未找到资产：${rawId}`, summary: "未找到资产" };
      }
      return {
        ok: true,
        output: `# ${detail.item.title} (${detail.item.relativePath})\n\n${detail.content}`,
        summary: `已读取 ${detail.item.fileName}`,
      };
    },
  });

  const offSaveArtifact = ctx.tools.registerTool({
    name: "save_library_artifact",
    title: "保存产物到资产库",
    description: "将 Agent 生成的报告、文档、代码成品或分析结果保存到 LFAA 资料库/资产库，方便用户在「资料库」查看。",
    permissionLevel: "write",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "产物标题" },
        fileName: { type: "string", description: "建议文件名，例如 architecture-report.md" },
        content: { type: "string", description: "完整文本或 Markdown 内容" },
        summary: { type: "string", description: "一句话产物摘要（可选）" },
        tags: { type: "array", items: { type: "string" }, description: "标签列表（可选）" },
      },
      required: ["title", "fileName", "content"],
    },
    execute: async (args, execCtx) => {
      const session = await ctx.memory.getSession(execCtx.sessionId);
      const item = await ctx.memory.saveLibraryAsset({
        category: "artifact",
        title: typeof args.title === "string" ? args.title : "Agent 产物",
        fileName: typeof args.fileName === "string" ? args.fileName : "artifact.md",
        content: typeof args.content === "string" ? args.content : "",
        ...(typeof args.summary === "string" ? { summary: args.summary } : {}),
        tags: Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string") : [],
        projectId: session?.projectId ?? null,
        sourceSessionId: execCtx.sessionId,
        sourceRunId: execCtx.runId,
      });
      const storage = await ctx.memory.getStorageState();
      return {
        ok: true,
        output: `已将产物保存至资产库：${storage.dataRoot}/${item.relativePath} (id=${item.id})`,
        summary: `已归档产物 ${item.fileName}`,
      };
    },
  });

  return () => {
    offSaveArtifact();
    offReadLibrary();
    offListLibrary();
    offSaveMemory();
  };
}
