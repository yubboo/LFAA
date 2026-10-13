/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 的 dispatch 深度耦合 Cordis Events 类型表；LFAA 提供最小的融合分发助手——
 * 把 Agent 主体绑定到它的 scope carrier，使事件 thisArg 与 payload.agent 不可能错配。
 *
 * 文件：dispatch.ts
 * 功能：agentCarrier（构造 scope carrier）与 emitAgentEvent（单次发射）。
 * 作用：Agent 事件分发保持主体与作用域一致。
 */
import type { Context } from "@deepseek-ai/cordis";
import { scopeTarget, type Scoped } from "lfaa-scope/src/index.js";
import type { Agent } from "./types.js";

/** 为一个 Agent 主体构造 scope carrier（无状态路由对象，可复用）。 */
export function agentCarrier(agent: Agent): Scoped<Agent> {
  return scopeTarget(agent, agent);
}

/**
 * 发射一条 Agent 通知。监听器异常被逐个隔离，不否决生命周期推进。
 * LFAA 版：直接通过 ctx.emit；carrier 作为 thisArg 保持作用域过滤。
 */
export function emitAgentEvent(
  ctx: Context,
  agent: Agent,
  name: string,
  payload: Record<string, unknown>
): void {
  const carrier = agentCarrier(agent);
  try {
    // @ts-expect-error LFAA 事件表尚未扩展 agent 事件；这里做最小运行时分发。
    ctx.emit(name, { ...payload, agent }, carrier);
  } catch {
    // 分发失败不影响主流程。
  }
}
