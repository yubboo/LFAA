/**
 * 文件：index.ts
 * 功能：会话投影——把持久化层的原始表行折叠成 UI/控制器可直接消费的轻量视图。
 * 作用：单一投影口径，保证列表行、消息卡片、轨迹摘要对外形状一致。
 * 边界：投影是输出闸门——模型历史（含工具原始参数/输出）、内部请求头与任何凭证一律不进入投影结果。
 * 关联文件：session-projection-cache、session-persistence、core/session/sessions.ts。
 * 移植说明：概念参考 DSH session-projection 的「只读轻量视图」定位，但按 LFAA 四表行结构重写。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { SessionHeaderRecord, SessionMessageRecord } from "lfaa-session-format";

/** 列表/卡片用的会话轻量视图。 */
export interface SessionHeaderView {
  readonly id: string;
  readonly title: string;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly appId: string;
}

/** 消息轻量视图（不含 model_history 等受保护字段）。 */
export interface SessionMessageView {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly status: string;
  readonly createdAt: string;
}

/** 把会话头行折叠成列表视图；只读公开字段。 */
export function projectSessionHeader(row: Record<string, unknown>): SessionHeaderView {
  const header = row as Partial<SessionHeaderRecord>;
  return {
    id: String(header.id ?? ""),
    title: typeof header.title === "string" ? header.title : "",
    archived: Number(header.archived) === 1,
    createdAt: typeof header.created_at === "string" ? header.created_at : "",
    updatedAt: typeof header.updated_at === "string" ? header.updated_at : "",
    appId: typeof header.app_id === "string" ? header.app_id : ""
  };
}

/** 把消息行折叠成展示视图；刻意丢弃 model_history / activity_json。 */
export function projectMessage(row: Record<string, unknown>): SessionMessageView {
  const message = row as Partial<SessionMessageRecord>;
  return {
    id: String(message.id ?? ""),
    role: message.role === "assistant" ? "assistant" : "user",
    content: typeof message.content === "string" ? message.content : "",
    status: typeof message.status === "string" ? message.status : "unknown",
    createdAt: typeof message.created_at === "string" ? message.created_at : ""
  };
}

/** 会话投影服务：汇总纯函数入口，供控制器按需调用。 */
export interface SessionProjectionService {
  readonly header: (row: Record<string, unknown>) => SessionHeaderView;
  readonly message: (row: Record<string, unknown>) => SessionMessageView;
}

export const name = "lfaaSessionProjection";
export function apply(ctx: Context): void {
  const service: SessionProjectionService = { header: projectSessionHeader, message: projectMessage };
  ctx.provide(name, service);
}
