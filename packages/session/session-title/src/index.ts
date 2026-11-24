// @lfaa/session-title：会话标题服务。提供启发式简洁标题与可选的模型生成标题（失败自动回落）。
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { LlmGenerateInput } from "@lfaa/llm";

const FILLER_PREFIX_RE =
  /^(?:你好[，,！!。.\s]*|您好[，,！!。.\s]*|请问[，,\s]*|请只[：:\s]*|请(?:你|帮我|帮忙)?(?:不要调用工具[，,\s]*)?(?:直接)?(?:用\s*\d+\s*[句话个自然段条项]+[，,\s]*)?(?:简短|详细)?(?:介绍一下|介绍|输出一个|输出|生成一个|生成|写一个|写|解释|分析|总结|对比|帮我|告诉我|回答)[：:\s]*|帮我(?:看看|检查|修复|优化|实现|写)[：:\s]*|hi[,\s]+|hello[,\s]+|please[,\s]+|can you[,\s]+|could you[,\s]+|help me[,\s]+)/iu;

/** 根据用户首条提问提炼简洁语义标题（去除客套与指令前缀，避免整段原句直接截断）。 */
export function generateConciseSessionTitle(rawContent: string): string {
  const firstLine = rawContent
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/[#>*_`]/gu, "")
    .trim()
    .split(/\r?\n/u)[0] ?? "";
  let text = firstLine.replace(/\s+/gu, " ").trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = text.replace(FILLER_PREFIX_RE, "").trim();
    if (stripped === text || !stripped) break;
    text = stripped;
  }
  const primaryClause = text.split(/[。！？；;\n]|，不要|，并且|，然后/u)[0]?.trim() || text;
  const cleaned = primaryClause.replace(/^[，,：:\s]+|[，,。.！!？?：:;；\s]+$/gu, "");
  const fallback = firstLine.replace(/\s+/gu, " ").trim();
  const base = cleaned || fallback || "新聊天";
  const cjkCount = (base.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  const maxLen = cjkCount >= 3 ? 16 : 24;
  return base.length > maxLen ? base.slice(0, maxLen).trim() : base;
}

/** 把模型输出归一成可用的标题：单行、去引号与常见前缀、限长 40 字符。 */
export function normalizeGeneratedTitle(raw: string): string {
  const firstLine = raw.trim().split(/\r?\n/u)[0] ?? "";
  const stripped = firstLine
    .replace(/^(?:标题|title)\s*[：:]\s*/iu, "")
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/gu, "")
    .replace(/[。！？!?]+$/u, "")
    .trim();
  if (!stripped) return "";
  return stripped.length > 40 ? stripped.slice(0, 40).trim() : stripped;
}

/** 标题来源：模型生成或启发式回落。 */
export type SessionTitleSource = "llm" | "heuristic";

/** 生成标题的入参。 */
export interface SessionTitleInput {
  userMessage: string;
  assistantReply?: string;
  profileId?: string;
}

/** 基于一次问答生成标题的 LLM 依赖契约，便于测试注入替身。 */
export interface SessionTitleLlm {
  complete(input: LlmGenerateInput): Promise<{ content: string }>;
}

/**
 * 用模型生成标题；任何异常或空结果都回落启发式标题，绝不因为标题失败影响会话。
 */
export async function generateSessionTitle(
  llm: SessionTitleLlm,
  input: SessionTitleInput,
): Promise<{ title: string; source: SessionTitleSource }> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("缺少 userMessage。");
  const fallback = generateConciseSessionTitle(userMessage);
  try {
    const userPrompt = input.assistantReply?.trim()
      ? `用户提问：\n${input.userMessage.slice(0, 2_000)}\n\n助手回复：\n${input.assistantReply.slice(0, 1_500)}`
      : input.userMessage.slice(0, 2_000);
    const out = await llm.complete({
      ...(input.profileId ? { profileId: input.profileId } : {}),
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content: "你是会话标题生成器。请根据用户提问与助手回复，用不超过 12 个汉字或 6 个英文单词概括主题，只输出标题本身，不要引号、不要标点结尾、不要解释。",
        },
        { role: "user", content: userPrompt },
      ],
    });
    const title = normalizeGeneratedTitle(out.content ?? "");
    if (!title) return { title: fallback, source: "heuristic" };
    return { title, source: "llm" };
  } catch {
    return { title: fallback, source: "heuristic" };
  }
}

/** Host 侧会话标题服务，挂载为 `ctx.sessionTitle`。 */
export class SessionTitleService extends Service {
  constructor(ctx: Context) {
    super(ctx, "sessionTitle");
  }

  /** 纯本地启发式标题，不调用模型。 */
  concise(rawContent: string): string {
    return generateConciseSessionTitle(rawContent);
  }

  /** 生成标题：模型可用则用模型，失败或为空回落启发式。 */
  async generate(input: SessionTitleInput): Promise<{ title: string; source: SessionTitleSource }> {
    return generateSessionTitle(this.ctx.llm, input);
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
}

/** 处理 POST /api/session-title：生成一条会话标题。 */
export function createSessionTitleHttpHandler(service: SessionTitleService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/session-title") return false;
    const method = (req.method ?? "GET").toUpperCase();
    try {
      if (method !== "POST") {
        res.setHeader("Allow", "POST");
        sendJson(res, 405, { error: "会话标题接口只支持 POST。" });
        return true;
      }
      const body = await readJsonBody(req);
      const userMessage = typeof body.userMessage === "string" ? body.userMessage : "";
      if (!userMessage.trim()) throw new Error("缺少 userMessage。");
      const result = await service.generate({
        userMessage,
        ...(typeof body.assistantReply === "string" ? { assistantReply: body.assistantReply } : {}),
        ...(typeof body.profileId === "string" ? { profileId: body.profileId } : {}),
      });
      sendJson(res, 200, result);
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}

/** 为 Host 上下文注册会话标题服务；模型服务由 Cordis 注入。 */
export function sessionTitlePlugin(ctx: Context): void {
  new SessionTitleService(ctx);
}

sessionTitlePlugin.inject = ["llm"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    sessionTitle: SessionTitleService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default sessionTitlePlugin;