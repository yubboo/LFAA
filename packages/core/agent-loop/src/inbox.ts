/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/inbox.ts（MIT，commit 639ed01）。
 * LFAA 适配：DSH inbox 基于 session-projection 的 in-flight 事件；LFAA 的 LiveRun 用一个普通数组
 * pendingTurns / inbox 缓冲用户消息。本模块抽出一个有界队列，显式表达“运行中时新消息排队、
 * 取消时丢弃、竞态时只取最新一条”的语义。
 *
 * 文件：inbox.ts
 * 功能：运行期间到达的用户消息缓冲（next-turn / next-step pending），支持取消与竞态合并。
 * 作用：execute-turn 在 run 结束后 drain() 取出下一条待处理消息；Live 模式下 onDelta 之间到达的
 *       消息进入队列而不是打断正在进行的模型流。
 * 不负责：消息持久化或触发新 run；那是 session-controller / runs.ts 的职责。
 */

/** 一条排队中的用户输入。 */
export interface InboxEnvelope {
  kind: "next-turn" | "next-step";
  content: string;
  queuedAt: string;
}

/**
 * 有界用户消息收件箱。同一时间只保留每个 kind 的最新语义：
 *   - next-turn：下一个完整回合的输入；新到来时覆盖旧的（避免堆积多轮未处理输入）。
 *   - next-step：在当前工具流内插队的下一步指令；同样只保留最新一条。
 * 这正是 DSH inbox“合并同类型 in-flight、拒绝过期消息”的 LFAA 版。
 */
export class InboxQueue {
  private nextTurn: InboxEnvelope | null = null;
  private nextStep: InboxEnvelope | null = null;

  /** 是否有待处理消息。 */
  get hasPending(): boolean {
    return this.nextTurn !== null || this.nextStep !== null;
  }

  /** 入队一条用户输入。同类型新消息覆盖旧消息（竞态：只认最新意图）。 */
  enqueue(kind: InboxEnvelope["kind"], content: string, now = new Date().toISOString()): InboxEnvelope {
    const envelope: InboxEnvelope = { kind, content, queuedAt: now };
    if (kind === "next-turn") this.nextTurn = envelope;
    else this.nextStep = envelope;
    return envelope;
  }

  /**
   * 取出下一条要处理的消息。优先级：next-step（插队指令）先于 next-turn。
   * 取出即移除（drain 语义）。
   */
  drain(): InboxEnvelope | null {
    if (this.nextStep) {
      const step = this.nextStep;
      this.nextStep = null;
      return step;
    }
    if (this.nextTurn) {
      const turn = this.nextTurn;
      this.nextTurn = null;
      return turn;
    }
    return null;
  }

  /** 取消并清空所有待处理消息（会话被中止/删除时调用）。 */
  cancel(): void {
    this.nextTurn = null;
    this.nextStep = null;
  }

  /** 只读快照（调试/观察用）。 */
  peek(): { nextTurn: InboxEnvelope | null; nextStep: InboxEnvelope | null } {
    return { nextTurn: this.nextTurn, nextStep: this.nextStep };
  }
}
