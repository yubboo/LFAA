/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import { SessionKernel, SessionStore } from "./kernel.js";
import { SessionRuntimeContext } from "./runtime-context.js";
export * from "./kernel.js";
export * from "./runtime-context.js";
// DSH 对齐的能力面（按 DSH 文件形态；类型与便捷包装，单源真相仍在 kernel.ts）
export { encodeSessionSeqRanges, decodeSessionSeqRanges } from "./seq-ranges.js";
export type { EncodedSessionSeq } from "./seq-ranges.js";
export { deriveSessionEventMessage, isSurfaceEvent, foldSessionSurface, deriveSurfaceMessages } from "./surface.js";
export { canonicalSessionRequestHeader, foldSessionRequestHeader, sessionRequestHeadersEqual } from "./request-header.js";
export { resolvedToolHistoryOf } from "./tool-history.js";
export type { SessionToolHistory, SessionToolSchema } from "./kernel.js";
export { KNOWN_SESSION_EVENT_TYPES, isKnownSessionEventType } from "./known-event-types.js";
export { SessionPreparation } from "./preparation.js";
export { forkSession, SessionForkError } from "./fork.js";
export { repairOpenTail } from "./repair.js";
export { assertValidSessionSeq, assertBalancedToolCalls } from "./invariant.js";
export const name = "lfaaSessions";
export function apply(ctx: Context): void {
  // Cordis 插件只获得不绑定账户数据的内核构造器；会话读取/写入继续走认证 Host 与 Agent Loop Owner。
  ctx.provide(name, Object.freeze({ SessionKernel, SessionStore, SessionRuntimeContext }));
}
