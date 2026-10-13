/**
 * 文件：index.ts
 * 功能：会话遥测——在内存中记录会话生命周期计数（创建/提交/删除次数）。
 * 作用：给可观测面板提供轻量计数；不采集正文、用户标识或密钥。
 * 边界：只存计数与事件类型名，容量有界；导出器（如 OTEL）由 session-telemetry-otel 适配。
 * 关联文件：session-telemetry-otel、session-persistence。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 遥测记录器：按事件类型计数。 */
export class SessionTelemetry {
  private readonly counters = new Map<string, number>();
  private totalEvents = 0;

  /** 记录一次生命周期事件（只记类型名，不带会话内容）。 */
  record(type: string): void {
    this.counters.set(type, (this.counters.get(type) ?? 0) + 1);
    this.totalEvents += 1;
  }

  /** 只读快照。 */
  snapshot(): { readonly total: number; readonly byType: ReadonlyMap<string, number> } {
    return { total: this.totalEvents, byType: new Map(this.counters) };
  }
}

export const name = "lfaaSessionTelemetry";
export function apply(ctx: Context): void {
  ctx.provide(name, new SessionTelemetry());
}
