// @lfaa/web-server：构造会话与运行相关处理器（聊天、编码会话、媒体直连生成、Agent 运行）。
// 这些接口都依赖「会话服务 + 工作区根 + 会话内图片解析」，因此与常规处理器分开，避免单文件继续膨胀。
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { createAgentHttpHandler } from "@lfaa/agent";
import type { ApiHandler } from "@lfaa/api-gateway";
import { createChatHttpHandler, createCodingHttpHandler } from "@lfaa/chat";
import { createMediaGenerateHttpHandler, createMediaPlanHttpHandler, findSessionImagePath, isRefinementPrompt, type MediaGenerateOptions, type MediaSource } from "@lfaa/tool-media";

/** 构造会话相关处理器所需的依赖。 */
export interface AgentHandlerDeps {
  context: Context;
  /** 默认工作根：会话未绑定项目时的回退位置。 */
  projectRoot: string;
  chatService: Context["chat"];
  resolveWorkspaceRoots(projectId: string | null): Promise<string[]>;
}

/** 会话相关处理器集合；键名即网关路由 id。 */
export interface AgentHandlers {
  chat: ApiHandler;
  coding: ApiHandler;
  mediaGenerate: ApiHandler;
  /** 生成前返回画幅计划（比例/尺寸），供消息内的生成占位使用。 */
  mediaPlan: ApiHandler;
  agent: ApiHandler;
}

/** 创建会话/媒体/Agent 处理器。 */
export function createAgentHandlers(deps: AgentHandlerDeps): AgentHandlers {
  const { context, projectRoot, chatService, resolveWorkspaceRoots } = deps;

  // 会话内图片解析：只在会话消息里按来源定位已落盘的文件，不接受任意路径。
  const resolveSessionImage = async (id: string, source?: MediaSource): Promise<string | undefined> => {
    const session = await context.memory.getSession(id);
    if (!session) return undefined;
    const roots = await resolveWorkspaceRoots(session.projectId);
    for (const message of [...session.messages].reverse()) {
      if (message.role !== "assistant" || (source && message.id !== source.messageId)) continue;
      const path = await findSessionImagePath(message.content, roots, source?.path);
      if (path) return path;
    }
    return undefined;
  };

  const chat = createChatHttpHandler(chatService, {
    resolveSessionPreset: (id) => context.plugins.resolveSessionPreset(id),
    withIdleSession: (sessionId, action) => context.agent.withIdleSession(sessionId, action),
    // 追问建议由模型根据本轮问答生成，保留既有能力，仅调整前端展示样式。
    suggestFollowUps: async ({ userPrompt, assistantReply }) => {
      const output = await context.llm.complete({
        messages: [
          {
            role: "system",
            content: "你是追问建议生成器。根据用户提问与助手回答，给出 3 条用户最可能继续追问的简短问题。只输出 JSON 字符串数组，不要任何解释。",
          },
          {
            role: "user",
            content: `用户提问：${userPrompt.slice(0, 800)}\n\n助手回答：${assistantReply.slice(0, 2000)}`,
          },
        ],
        // 该模型先输出推理再输出正文，200 token 会被推理吃光（finishReason=length），此处放宽。
        maxTokens: 900,
        temperature: 0.7,
      });
      // LlmGenerateOutput 的正文放在 content 字段（不是 text）。
      const text = (output as { content?: string }).content ?? "";
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start < 0 || end <= start) return [];
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        return [];
      }
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
        : [];
    },
    // 项目起步建议：新会话绑定项目且尚无消息时，围绕该项目生成 3 条起步请求。
    suggestStarters: async ({ projectId }) => {
      const projects = await context.workspace.listProjects();
      const project = projects.find((item) => item.id === projectId) ?? null;
      const name = project?.name ?? "当前项目";
      const root = project?.rootPath || project?.rootPaths?.[0] || "";
      const entries = root ? (await readdir(root).catch(() => [] as string[])).slice(0, 30) : [];
      let readme = "";
      for (const file of ["README.md", "README.zh.md", "package.json"]) {
        if (!root) break;
        readme = (await readFile(join(root, file), "utf8").catch(() => "")).slice(0, 1_200);
        if (readme.trim()) break;
      }
      // 模型不可用时的兜底也按真实交付顺序给出，第一条即最推荐的下一步。
      const fallback = [
        `梳理 ${name} 现状与验收标准，确认交付目标`,
        `制定 ${name} 的交付方案与任务拆分`,
        `按方案实现并跑通构建与测试`,
      ].map((item) => item.slice(0, 32));
      try {
        const output = await context.llm.complete({
          messages: [
            {
              role: "system",
              content: "你是项目交付规划器。根据项目名、顶层文件与 README 摘要，按真实项目交付顺序（需求与验收标准 → 方案设计 → 实现 → 测试验证 → 构建交付），给出 3 条用户打开该项目新会话时应执行的下一步请求。要求：中文、动词开头、具体可执行、每条不超过 26 字、只输出 JSON 字符串数组不要解释；第 1 条必须是当前最推荐、最能推进项目交付的下一步，其余两条是紧随其后的备选。",
            },
            {
              role: "user",
              content: `项目名：${name}\n顶层文件：${entries.join("、") || "（无）"}\nREADME 摘要：${readme || "（无）"}`,
            },
          ],
          // 该模型先输出推理再输出正文，预算放宽避免被推理吃光。
          maxTokens: 2_000,
          temperature: 0.4,
        });
        const text = (output as { content?: string }).content ?? "";
        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");
        const parsed: unknown = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : [];
        const suggestions = Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
          : [];
        return suggestions.length > 0 ? suggestions : fallback;
      } catch {
        return fallback;
      }
    },
  });

  const coding = createCodingHttpHandler(chatService, {
    resolveProjectCandidates: async () => {
      const projects = await context.workspace.listProjects();
      return projects
        .map((project) => ({
          rootPath: project.rootPath || project.rootPaths?.[0] || "",
          name: project.name,
          projectId: project.id,
        }))
        .filter((project) => Boolean(project.rootPath));
    },
    resolveTargetRoot: async (projectId) => {
      if (!projectId) return projectRoot;
      const projects = await context.workspace.listProjects();
      const matched = projects.find((item) => item.id === projectId);
      return matched?.rootPath || matched?.rootPaths?.[0] || projectRoot;
    },
  });

  // 提示词扩写用的对话模型：优先已知较快的 flash 型号，其次任意 flash/mini，最后取第一个对话模型。
  const pickChatModelId = (profile: { availableModels?: Array<{ id: string; modelKind?: string }> } | null): string | undefined => {
    const chatModels = (profile?.availableModels ?? []).filter((model) => (model.modelKind ?? "chat") === "chat");
    for (const preferred of ["deepseek-v4.1-flash", "qwen3.8-flash", "qwen3.6-flash"]) {
      if (chatModels.some((model) => model.id === preferred)) return preferred;
    }
    const fast = chatModels.find((model) => /flash|mini|turbo|lite/iu.test(model.id));
    return (fast ?? chatModels[0])?.id;
  };

  // 生图提示词导演：把用户原话扩写成带光线、镜头、质感的高质量提示词，并给出一句画面说明。
  // 任何失败或超时（10 秒）都回退为原始提示词，不能因为扩写阻塞生成。
  const styleLabelOf = (style?: string): string => ({
    photo: "真实写真摄影",
    cinematic: "电影感画面",
    illustration: "精致插画",
    anime: "二次元动漫",
    watercolor: "水彩画",
    "3d": "3D 渲染",
  } as Record<string, string>)[style ?? ""] ?? "";
  const enhanceImagePrompt: NonNullable<MediaGenerateOptions["enhanceImagePrompt"]> = async (prompt, enhancement) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const profile = await context.llm.resolveProfile(enhancement.profileId);
      const modelId = pickChatModelId(profile);
      if (!modelId) return null;
      const styleLabel = styleLabelOf(enhancement.style);
      const output = await context.llm.complete({
        profileId: profile.id,
        modelId,
        signal: controller.signal,
        messages: [
          {
            role: "system",
            content: "你是专业生图提示词导演。把用户的一句话需求改写成一条可直接用于生图模型的高质量提示词。要求：1) 完整保留用户明确写出的主体、人数、服装、动作、场景、文字与画幅比例，不得删改或添加冲突内容；2) 补充光线方向与质感、镜头焦段与景深、构图、色调与画面质感；3) 使用中文，80-140 字；4) 若给出风格，画面必须保持该风格；5) 只输出 JSON：{\"plan\":\"给用户看的一句画面说明（第一人称，不超过40字，只描述将生成的画面主体与氛围，不要提提示词、参数或扩写过程）\",\"prompt\":\"改写后的生图提示词\"}，不要输出任何解释或 Markdown。",
          },
          { role: "user", content: `用户需求：${prompt}\n画幅：${enhancement.ratio}${styleLabel ? `\n风格：${styleLabel}` : ""}` },
        ],
        temperature: 0.5,
        maxTokens: 400,
      });
      const text = (output as { content?: string }).content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      const parsed = JSON.parse(text.slice(start, end + 1)) as { plan?: unknown; prompt?: unknown };
      const enhanced = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
      const plan = typeof parsed.plan === "string" ? parsed.plan.trim() : "";
      return enhanced ? { prompt: enhanced, ...(plan ? { plan } : {}) } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // 由同一会话与磁盘边界约束直接生成、以及 Agent 工具使用的参考图。
  const mediaGenerate = createMediaGenerateHttpHandler({
    executeTool: (name, args, toolContext) => context.tools.executeTool(name, args, {
      ...toolContext,
      sandboxMode: "workspace-write",
    }),
    // 输入栏附件里的图片转 data URL，作为图生图参考图。
    resolveAttachmentImages: async (sessionId, ids) => {
      const images: string[] = [];
      for (const id of ids.slice(0, 3)) {
        const file = await context.attachment?.get(sessionId, id).catch(() => null);
        if (file && /^image\//u.test(file.item.mime)) {
          images.push(`data:${file.item.mime};base64,${file.contentBase64}`);
        }
      }
      return images;
    },
    withIdleSession: (id, task) => context.agent.withIdleSession(id, task),
    resolveImageSource: resolveSessionImage,
    enhanceImagePrompt,
    findLastMediaPath: (id, kind) => kind === "image" ? resolveSessionImage(id) : Promise.resolve(undefined),
    resolveWorkspaceRoots,
    getSessionProjectId: async (id) => {
      const session = await context.memory.getSession(id);
      if (!session) throw new Error("找不到聊天会话。");
      return session.projectId;
    },
    appendMessage: async (id, message) => {
      await context.memory.appendMessage(id, message);
    },
  });

  const agent = createAgentHttpHandler(context.agent, {
    resolveWorkspaceRoots,
    resolveReferenceImages: async (sessionId, prompt, sources) => {
      if (Array.isArray(sources) && sources.length) {
        return Promise.all(sources.slice(0, 3).map(async (source: Partial<MediaSource> | null) => {
          const path = typeof source?.messageId === "string" && typeof source.path === "string"
            ? await resolveSessionImage(sessionId, { messageId: source.messageId, path: source.path }) : undefined;
          if (!path) throw new Error("引用图片不可用，或图片不属于当前会话。");
          return path;
        }));
      }
      const latest = isRefinementPrompt(prompt) ? await resolveSessionImage(sessionId) : undefined;
      return latest ? [latest] : [];
    },
    // 聊天模型附图时同样把已验证的图片附件写入用户消息，气泡才能显示缩略图。
    resolveAttachments: async (sessionId, rawIds) => {
      const ids = Array.isArray(rawIds)
        ? rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).slice(0, 8)
        : [];
      const attachments: Array<{ id: string; kind: "image" }> = [];
      for (const id of ids) {
        const file = await context.attachment?.get(sessionId, id).catch(() => null);
        if (file && /^image\//u.test(file.item.mime)) attachments.push({ id, kind: "image" });
      }
      return attachments;
    },
  });

  return { chat, coding, mediaGenerate, mediaPlan: createMediaPlanHttpHandler(), agent };
}