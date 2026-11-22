// 运行期插话：把运行中追加的用户消息（steer）并入当前对话，并在轨迹中留记录。
import type { LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import type { RunLoopDeps } from "./run-types";

/** 取出待插话消息并追加到对话；返回实际注入的条数。 */
export function injectSteeringMessages(
  deps: Pick<RunLoopDeps, "drainSteering">,
  conversation: LlmMessage[],
  iteration: number,
  pushStep: (step: AgentStepTrace) => void,
  now = Date.now(),
): number {
  let injected = 0;
  for (const text of deps.drainSteering?.() ?? []) {
    const content = text.trim();
    if (!content) continue;
    conversation.push({ role: "user", content });
    injected += 1;
    pushStep({
      id: `steer-${iteration}-${now}-${injected}`,
      iteration,
      phase: "check",
      status: "done",
      title: `已插入补充消息：${content.slice(0, 60)}`,
      timestamp: now,
    } as AgentStepTrace);
  }
  return injected;
}