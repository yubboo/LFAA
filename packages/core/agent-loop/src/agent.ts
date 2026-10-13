/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/agent.ts（MIT，commit 639ed01）。
 * LFAA 适配：DSH 的 ReactLoopAgent 是一个庞大的事件溯源反应器；LFAA 的 run-turn.ts 已是等价的
 * 直接式循环。本模块不复制整个反应器，而是提供“回合拦截钩子注册表”——这是 DSH agent 对外
 * 暴露的、可被观测/扩展的接缝，也契合 LFAA 已有的 onAssistantEvent 回调风格。
 *
 * 文件：agent.ts
 * 功能：登记 turn 级拦截点（turn 开始 / 每次模型请求前 / turn 结束），供观测与上下文管理接线。
 * 作用：execute-turn 在关键节点调用 AgentHooks 的对应方法；上下文管理钩子（compaction/spill）
 *       正是挂在 beforeRequest 拦截点上的一个观察者。
 * 不负责：模型决策本身；这只是拦截/观测层，绝不替代模型的工具选择。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 一次 turn 的标识。 */
export interface AgentTurnContext {
  runId: string;
  turnId: string;
  sessionId: string;
}

/** 回合拦截钩子集合。全部可选；未提供即跳过。 */
export interface AgentHooks {
  /** turn 开始（用户消息已入队，首次请求尚未发出）。 */
  onTurnStart?: (ctx: AgentTurnContext, userMessage: string) => void | Promise<void>;
  /** 每次发模型请求前：可观测（并由 runtime-context 据此触发压缩/溢出）。 */
  beforeRequest?: (ctx: AgentTurnContext, messages: AiCompletionMessage[]) => void | Promise<void>;
  /** turn 结束（complete / interrupted / error）。 */
  onTurnEnd?: (ctx: AgentTurnContext, status: "complete" | "interrupted" | "error") => void | Promise<void>;
}

/** 聚合多个钩子为一个（按注册顺序串行执行，单个失败不影响其余）。 */
export class AgentHookRegistry implements AgentHooks {
  private readonly hooks: AgentHooks[] = [];

  register(hook: AgentHooks): void {
    this.hooks.push(hook);
  }

  async onTurnStart(ctx: AgentTurnContext, userMessage: string): Promise<void> {
    for (const hook of this.hooks) {
      try { await hook.onTurnStart?.(ctx, userMessage); } catch { /* 观测失败不阻断 */ }
    }
  }

  async beforeRequest(ctx: AgentTurnContext, messages: AiCompletionMessage[]): Promise<void> {
    for (const hook of this.hooks) {
      try { await hook.beforeRequest?.(ctx, messages); } catch { /* 观测失败不阻断 */ }
    }
  }

  async onTurnEnd(ctx: AgentTurnContext, status: "complete" | "interrupted" | "error"): Promise<void> {
    for (const hook of this.hooks) {
      try { await hook.onTurnEnd?.(ctx, status); } catch { /* 观测失败不阻断 */ }
    }
  }
}
