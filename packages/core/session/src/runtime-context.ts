/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/runtime-context.ts（MIT, commit 639ed01）。
 * LFAA 适配：DSH 的 runtime-context 是事件投影；这里基于 LFAA 自己的 SessionKernel 提供一个只读观测层，
 * 暴露回合生命周期与上下文规模提示，供 agent-loop 的 compaction/spill 钩子判断是否触发。
 *
 * 文件：runtime-context.ts
 * 功能：会话运行时上下文快照——当前是否有开放回合、消息规模、最近请求头。
 * 作用：与 agent-loop 的 manageContextBeforeRequest 配合；它不改写历史，只观测。
 * 不负责：真正压缩/溢出（那是 compaction/spill 包）。
 */
import type { SessionKernel } from "./kernel.js";

/** 一次运行时上下文快照。 */
export interface SessionRuntimeSnapshot {
  /** 会话内消息（surface）条数。 */
  messageCount: number;
  /** 当前是否有开放回合。 */
  hasOpenTurn: boolean;
  /** 最近一次 request/header 的模型标识（若有）。 */
  modelId: string | null;
  /** surface 内容是否自上次快照后变化。 */
  surfaceChanged: boolean;
}

/** 对 SessionKernel 的轻量运行时观测包装。 */
export class SessionRuntimeContext {
  private lastSurfaceGeneration = 0;
  constructor(private readonly session: SessionKernel) {}

  /** 取当前快照。 */
  snapshot(): SessionRuntimeSnapshot {
    const surface = this.session.surface;
    const generation = this.session.surfaceContentGeneration;
    const changed = generation !== this.lastSurfaceGeneration;
    this.lastSurfaceGeneration = generation;
    return {
      messageCount: surface.length,
      hasOpenTurn: this.session.hasOpenTurn(this.currentTurnId() ?? ""),
      modelId: this.session.requestHeader?.data.modelId ?? null,
      surfaceChanged: changed
    };
  }

  private currentTurnId(): string | null {
    // SessionKernel 不直接暴露当前 turnId；openStep/hasOpenTurn 需要调用方传入。
    // 这里返回 null，开放回合判断由 agent-loop 结合 runId 使用。
    return null;
  }

  /** 派生当前请求应使用的消息序列（LFAA 权威：来自 kernel 的 surface 派生）。 */
  deriveMessages() {
    return this.session.deriveMessages();
  }
}
