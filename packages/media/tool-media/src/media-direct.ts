// 媒体直连生成接口：选中生图/生视频/语音模型时，输入描述直接生成媒体并写入会话消息。
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { resolveImagePlan } from "./image-ratio";
import { readImageRecipe } from "./media-http";

/** 客户端引用的是某条消息中的产物，由宿主确认来源后提供路径。 */
export interface MediaSource { messageId: string; path: string }

/** 直连生成需要的 Host 回调，避免媒体包直接依赖 memory/agent 实现。 */
export interface MediaGenerateOptions {
  /** 执行已注册的媒体工具（generate_image / generate_video / generate_speech）。 */
  executeTool: (
    name: string,
    args: Record<string, unknown>,
    context: { workspaceRoots: string[]; sessionId: string; runId: string; signal: AbortSignal },
  ) => Promise<{ ok: boolean; output: string; summary: string; metadata?: Record<string, unknown> }>;
  /** 把会话绑定项目解析成工作区根目录。 */
  resolveWorkspaceRoots: (projectId: string | null) => Promise<string[]>;
  /** 会话绑定工作树时的输出与引用根；缺省沿用项目根。 */
  resolveSessionWorkspaceRoots?: (sessionId: string) => Promise<string[]>;
  /** 读取会话所属项目。 */
  getSessionProjectId: (sessionId: string) => Promise<string | null>;
  /** 读取会话附件（图片）并转成 data URL，用于图生图参考。 */
  resolveAttachmentImages?: (sessionId: string, attachmentIds: string[]) => Promise<string[]>;
  /** 查找该会话最近一次生成的媒体文件路径，用于「再亮一点/改成水彩」这类迭代修改。 */
  findLastMediaPath?: (sessionId: string, kind: "image" | "video" | "audio") => Promise<string | undefined>;
  resolveImageSource?: (sessionId: string, source: MediaSource) => Promise<string | undefined>;
  /**
   * 生图提示词扩写：交给同套餐里的对话模型把用户的一句话改写成专业提示词，
   * 返回改写结果与给用户看的计划句；失败返回 null 时按原文生成。
   */
  enhanceImagePrompt?: (prompt: string, options: { profileId?: string; ratio: string; style?: string }) => Promise<{ prompt: string; plan?: string } | null>;
  withIdleSession?: <T>(sessionId: string, task: () => Promise<T>) => Promise<T>;
  /** 追加一条会话消息（用户或助手）。 */
  appendMessage: (
    sessionId: string,
    message: {
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: number;
      attachments?: Array<{ id: string; kind: "image" }>;
      /** 用户引用过的会话内生成图片，用于在气泡里还原当时引用的是哪张。 */
      references?: MediaSource[];
    },
  ) => Promise<void>;
}

const MEDIA_KIND_TOOLS = {
  image: "generate_image",
  video: "generate_video",
  audio: "generate_speech",
} as const;

type MediaKind = keyof typeof MEDIA_KIND_TOOLS;

/** 从客户端请求或媒体元数据读出受控字段。 */
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 3) : [];
}

function readSource(value: unknown): MediaSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { messageId, path } = value as Partial<MediaSource>;
  return typeof messageId === "string" && messageId.trim() && typeof path === "string" && path.trim()
    ? { messageId, path } : undefined;
}

/** 读取 JSON 请求体；空体返回空对象。 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 按媒体类型映射工具入参。 */
function buildToolArgs(kind: MediaKind, body: Record<string, unknown>, prompt: string, referenceImages: string[], attachmentIds: string[]): Record<string, unknown> {
  // 用户明确选中的模型必须真正用于生成，而不是被自动选择的默认图像模型覆盖。
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const modelFields = {
    ...(modelId ? { modelId } : {}),
    ...(profileId ? { profileId } : {}),
  };
  if (kind === "image") {
    const style = typeof body.style === "string" ? body.style.trim() : "";
    const size = typeof body.size === "string" ? body.size.trim() : "";
    // 输入栏选定的画幅（9:16 等）随请求体传入，生成工具据此决定尺寸与构图提示。
    const ratio = typeof body.ratio === "string" ? body.ratio.trim() : "";
    return {
      prompt,
      ...modelFields,
      ...(style ? { style } : {}),
      ...(size ? { size } : {}),
      ...(ratio ? { ratio } : {}),
      ...(referenceImages.length > 0 ? { referenceImages } : {}),
      ...(attachmentIds.length ? { replayAttachmentIds: attachmentIds } : {}),
      ...(typeof body.n === "number" ? { n: body.n } : {}),
      ...(typeof body.watermark === "boolean" ? { watermark: body.watermark } : {}),
      ...(typeof body.negativePrompt === "string" ? { negativePrompt: body.negativePrompt } : {}),
    };
  }
  if (kind === "video") {
    const duration = typeof body.duration === "number" ? body.duration : 2;
    const resolution = typeof body.resolution === "string" ? body.resolution : "720P";
    const ratio = typeof body.ratio === "string" ? body.ratio : "16:9";
    return { prompt, ...modelFields, duration, resolution, ratio, waitSeconds: 240 };
  }
  return { text: prompt, ...modelFields };
}

/** 判断是否是「基于上一张图继续改」的迭代指令。 */
export function isRefinementPrompt(prompt: string): boolean {
  return /这张|上图|上一张|刚才的图|^(?:再(?:来|画|生成|亮|暗|加|改|换)|不够|太(?:丑|胖|矮|瘦|暗|亮|假|模糊)了?|(?:苗条|瘦|修长|高挑|漂亮|好看|自然|真实|清晰|亮|暗)(?:一些|一点)|更(?:亮|暗|真|清晰|自然|苗条|瘦|修长|漂亮|好看)|改[成为]|把|调整|保留|换成|加上|去掉|参考|基于)|\b(?:make it|try again|one more|previous image|this image)\b/iu.test(prompt.trim());
}

/** 生成前解析画幅计划：客户端据此渲染对应比例的生成占位，真正尺寸仍由生成工具决定。 */
export function createMediaPlanHttpHandler() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/media/plan") return false;
    const send = (status: number, payload: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(payload));
    };
    if ((req.method ?? "GET").toUpperCase() !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end();
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        send(400, { error: "缺少生成描述。" });
        return true;
      }
      const plan = resolveImagePlan(prompt, typeof body.ratio === "string" ? body.ratio : undefined);
      send(200, { ratio: plan.ratio, size: plan.size ?? null, explicit: plan.explicit });
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  };
}

/** 处理 POST /api/media/generate：直接生成媒体并落库为对话消息。 */
export function createMediaGenerateHttpHandler(options: MediaGenerateOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (status: number, payload: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(payload));
    };
    if (urlObj.pathname === "/api/media/recipe" && req.method === "GET") {
      const source = readSource(Object.fromEntries(urlObj.searchParams));
      const sessionId = urlObj.searchParams.get("sessionId");
      const path = source && sessionId ? await options.resolveImageSource?.(sessionId, source) : undefined;
      send(200, { canRegenerate: Boolean(path && await readImageRecipe(path)) });
      return true;
    }
    if (urlObj.pathname !== "/api/media/generate") return false;
    if ((req.method ?? "GET").toUpperCase() !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end();
      return true;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch {
      send(400, { error: "请求体不是合法 JSON。" });
      return true;
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const source = readSource(body.regenerate);
    const kindRaw = source ? "image" : typeof body.kind === "string" ? body.kind : "";
    if (!sessionId || ("regenerate" in body && !source) || !Object.hasOwn(MEDIA_KIND_TOOLS, kindRaw)) {
      send(400, { error: "缺少 sessionId / prompt，或 kind 不是 image / video / audio。" });
      return true;
    }
    const kind = kindRaw as MediaKind;
    const generate = async () => {
      if (source) {
        const file = await options.resolveImageSource?.(sessionId, source);
        const recipe = file ? await readImageRecipe(file) : undefined;
        if (!recipe) throw new Error("这张图片的生成参数不可用，或图片不属于当前会话。");
        body = recipe;
      }
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) throw new Error("请输入生成描述。");
      const attachmentIds = kind === "image" ? strings(body.attachmentIds) : [];
      const attachmentImages = attachmentIds.length ? await options.resolveAttachmentImages?.(sessionId, attachmentIds) ?? [] : [];
      if (attachmentImages.length !== attachmentIds.length) throw new Error("参考图附件已经不可用，请重新添加。");
      const sourceRefs = kind === "image" && Array.isArray(body.referenceSources) ? body.referenceSources.slice(0, 3) : [];
      const referenceImages = [...attachmentImages];
      // 引用图先由宿主确认归属与路径，再把可用路径同时写回用户消息，避免气泡里丢失。
      const validatedReferences: MediaSource[] = [];
      for (const candidate of sourceRefs) {
        const reference = readSource(candidate);
        const path = reference ? await options.resolveImageSource?.(sessionId, reference) : undefined;
        if (!reference || !path) throw new Error("引用图片不可用，或图片不属于当前会话。");
        referenceImages.push(path);
        validatedReferences.push({ messageId: reference.messageId, path });
      }
      if (kind === "image") referenceImages.push(...strings(source ? body.replayPaths : body.referenceImages));
      if (kind === "image" && !source && referenceImages.length === 0 && isRefinementPrompt(prompt)) {
        const previous = await options.findLastMediaPath?.(sessionId, "image");
        if (previous) referenceImages.push(previous);
      }
      const kindLabel = kind === "image" ? "图片" : kind === "video" ? "视频" : "语音";
      const now = Date.now();
      // 画幅以用户描述与输入栏选择为准；扩写后仍把比例显式传给工具，避免改写丢掉比例。
      const imagePlan = kind === "image" ? resolveImagePlan(prompt, typeof body.ratio === "string" ? body.ratio : undefined) : null;
      let toolPrompt = prompt;
      let planLine = "";
      if (kind === "image" && !source && imagePlan) {
        const enhanced = await options.enhanceImagePrompt?.(prompt, {
          ...(typeof body.profileId === "string" && body.profileId.trim() ? { profileId: body.profileId.trim() } : {}),
          ratio: imagePlan.ratio,
          ...(typeof body.style === "string" && body.style.trim() ? { style: body.style.trim() } : {}),
        }).catch(() => null);
        if (enhanced?.prompt.trim()) {
          toolPrompt = enhanced.prompt.trim();
          planLine = enhanced.plan?.trim() ?? "";
        }
      }
      const userMessageId = randomUUID();
      const assistantMessageId = randomUUID();
      const projectId = await options.getSessionProjectId(sessionId);
      const workspaceRoots = options.resolveSessionWorkspaceRoots
        ? await options.resolveSessionWorkspaceRoots(sessionId)
        : await options.resolveWorkspaceRoots(projectId);
      await options.appendMessage(sessionId, {
        id: userMessageId,
        role: "user",
        content: prompt,
        createdAt: now,
        ...(attachmentIds.length ? { attachments: attachmentIds.map((id) => ({ id, kind: "image" as const })) } : {}),
        ...(validatedReferences.length ? { references: validatedReferences } : {}),
      });
      let result: { ok: boolean; output: string; summary: string; metadata?: Record<string, unknown> };
      const toolArgs = buildToolArgs(kind, body, toolPrompt, referenceImages.slice(0, 3), attachmentIds);
      if (imagePlan?.explicit) toolArgs.ratio = imagePlan.ratio;
      try {
        result = await options.executeTool(MEDIA_KIND_TOOLS[kind], toolArgs, {
          workspaceRoots,
          sessionId,
          runId: `media-direct-${assistantMessageId}`,
          signal: new AbortController().signal,
        });
      } catch (error) {
        result = { ok: false, output: `生成${kindLabel}失败：${error instanceof Error ? error.message : String(error)}`, summary: "失败" };
      }
      // 和豆包一样先说明「我会生成什么」，再展示结果；扩写失败时只显示结果。
      const assistantContent = planLine && result.ok ? `${planLine}\n\n${result.output}` : result.output;
      await options.appendMessage(sessionId, {
        id: assistantMessageId,
        role: "assistant",
        content: assistantContent,
        createdAt: Date.now(),
      });
      return {
        ok: result.ok,
        kind,
        content: assistantContent,
        userMessageId,
        assistantMessageId,
        files: Array.isArray(result.metadata?.files) ? result.metadata.files : [],
        ...(result.ok ? {} : { error: result.output }),
      };
    };
    try {
      send(200, await (options.withIdleSession ? options.withIdleSession(sessionId, generate) : generate()));
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  };
}
