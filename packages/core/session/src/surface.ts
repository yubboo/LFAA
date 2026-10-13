/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话表面派生：从不可变事件日志折叠出用户可见/可请求的消息序列。
 * 实现权威在 kernel.ts；本模块按 DSH 形态重导出并补充便捷包装。
 *
 * 文件：surface.ts
 * 功能：deriveSessionEventMessage / foldSessionSurface / deriveSurfaceMessages。
 */
import { SessionKernel, foldSessionSurface as fold } from "./kernel.js";
export { deriveSessionEventMessage, isSurfaceEvent } from "./kernel.js";
export type { SessionSurfaceItem } from "./kernel.js";

/** 从一组事件折叠表面项。 */
export function foldSessionSurface(sessionId: string, events: readonly import("./kernel.js").SessionEvent[]): readonly import("./kernel.js").SessionSurfaceItem[] {
  return fold(sessionId, events);
}

/** 从内核实例派生当前应发给模型的表面消息序列。 */
export function deriveSurfaceMessages(session: SessionKernel): readonly import("./kernel.js").SessionModelMessage[] {
  return session.deriveSurfaceMessages();
}
