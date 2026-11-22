// 媒体生成动作：画幅计划、参考图上传、生成请求与本地占位插入/移除。
// 从 ChatRunActions 拆出：只依赖 ChatStorePort 与会话获取回调，不持有运行事件客户端，便于单测。
import { fetchJson } from "./chat-http";
import type { ChatStorePort } from "./chat-store-port";
import type { ChatSessionDetail } from "./chat-types";
import type { MediaGenerationInput } from "@lfaa/tool-media/client";
import { uploadAttachment } from "../composer/composer-attachments";

/** 媒体生成结果：失败只回错误文案，成功时带回画幅比例供消息区布局。 */
export interface MediaGenerationResult {
  ok: boolean;
  error?: string;
  ratio?: string;
}

/** 生成媒体：先锁发送入口并插入占位，再上传参考图并请求 Host；失败时只清理本轮临时消息。 */
export async function generateMedia(
  port: ChatStorePort,
  input: MediaGenerationInput,
  ensureSession: () => Promise<ChatSessionDetail>,
): Promise<MediaGenerationResult> {
  const state = port.getState();
  if (state.submittingMessage || state.runningRunId) return { ok: false, error: "请等待当前任务结束。" };
  port.patchState({ submittingMessage: true, errorMessage: "" });
  let session: ChatSessionDetail | null = null;
  try {
    session = await ensureSession();
    const kind = "kind" in input ? input.kind : "image";
    const prompt = "prompt" in input ? input.prompt : "";
    const requestedRatio = "ratio" in input ? input.ratio : undefined;
    // 先取画幅计划：消息区按目标比例立刻出现生成占位（本地宿主毫秒级，失败不影响生成）。
    const plan = prompt.trim() && kind === "image"
      ? await fetchJson<{ ratio?: string }>("/api/media/plan", {
        method: "POST",
        body: JSON.stringify({ prompt, ...(requestedRatio ? { ratio: requestedRatio } : {}) }),
      }).catch(() => null)
      : null;
    showLocalMediaPlaceholder(port, session, kind, prompt, plan?.ratio ?? requestedRatio);
    let payload: object = input;
    if ("prompt" in input) {
      const { imageFiles, attachmentIds = [], ...fields } = input;
      const ids = [...attachmentIds];
      for (const file of (imageFiles ?? []).slice(0, Math.max(0, 3 - ids.length))) {
        const id = await uploadAttachment(session.id, file);
        if (!id) throw new Error("参考图上传失败，请检查图片大小并重试。");
        ids.push(id);
      }
      payload = { ...fields, ...(ids.length ? { attachmentIds: ids } : {}) };
    }
    const res = await fetchJson<{ ok?: boolean; error?: string }>("/api/media/generate", {
      method: "POST",
      body: JSON.stringify({ sessionId: session.id, ...payload }),
    });
    if (!res.ok) {
      dropLocalMediaPlaceholder(port, session.id);
      return { ok: false, ...(res.error ? { error: res.error } : {}) };
    }
    if (port.getState().activeSessionId === session.id) await port.openSession(session.id);
    return { ok: true, ...(plan?.ratio ? { ratio: plan.ratio } : {}) };
  } catch (error) {
    if (session) dropLocalMediaPlaceholder(port, session.id);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    port.patchState({ submittingMessage: false });
  }
}

/** 在消息区插入本轮的临时用户消息与生成占位；真实消息在生成完成后由 openSession 覆盖。 */
function showLocalMediaPlaceholder(
  port: ChatStorePort,
  session: ChatSessionDetail,
  kind: "image" | "video" | "audio",
  prompt: string,
  ratio?: string,
): void {
  const now = Date.now();
  const messages = [...session.messages];
  if (prompt.trim()) {
    messages.push({ id: `local-media-user-${now}`, role: "user", content: prompt, createdAt: now });
  }
  messages.push({
    id: `local-media-assistant-${now}`,
    role: "assistant",
    content: "",
    status: "streaming",
    mediaGenerating: { kind, ...(ratio ? { ratio } : {}) },
    createdAt: now,
  });
  port.patchState({ activeSession: { ...session, messages } });
}

/** 生成失败时只移除本轮临时消息，保留用户其余记录。 */
function dropLocalMediaPlaceholder(port: ChatStorePort, sessionId: string): void {
  const session = port.getState().activeSession;
  if (!session || session.id !== sessionId) return;
  port.patchState({
    activeSession: { ...session, messages: session.messages.filter((message) => !message.id.startsWith("local-media-")) },
  });
}