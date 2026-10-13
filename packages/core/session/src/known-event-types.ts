/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 已知事件类型清单：会话日志允许追加的全部事件类型。
 * 权威集合在 kernel.ts；本模块按 DSH 形态导出常量与判定函数。
 *
 * 文件：known-event-types.ts
 * 功能：KNOWN_SESSION_EVENT_TYPES 列表 + isKnownSessionEventType 判定。
 */
import type { SessionEventType } from "./kernel.js";

/** 会话日志允许的全部事件类型。 */
export const KNOWN_SESSION_EVENT_TYPES: readonly SessionEventType[] = [
  "session/created",
  "session/title",
  "session/project",
  "session/archived",
  "session/plan-mode",
  "session/branch-memory",
  "turn/start",
  "turn/end",
  "step/start",
  "step/end",
  "session/side-chat",
  "user/message",
  "system/message",
  "developer/message",
  "assistant/message",
  "message/feedback",
  "assistant/response",
  "assistant/attempt",
  "request/header",
  "request/context",
  "tool/call",
  "tool/result",
  "activity/change",
  "usage/record",
  "session/end-seed"
] as const;

/** 判断一个字符串是否是已知会话事件类型。 */
export function isKnownSessionEventType(type: string): type is SessionEventType {
  return (KNOWN_SESSION_EVENT_TYPES as readonly string[]).includes(type);
}
