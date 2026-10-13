/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 读 agent/inbox/spliced 事件；LFAA 会话事件是 turn/step 词汇（kernel.ts）。
 * 这里按 LFAA 事件折叠“一个回合是否真的消耗并跑完了工作”。
 *
 * 文件：consumed-work.ts
 * 功能：从会话日志折叠“已消耗工作”——区分真正进入过模型步骤的回合 vs 空转/被拒回合。
 * 作用：归档/恢复时判断这个 Agent 的工作是否已交代清楚。
 */
import type { SessionEvent } from "./kernel-adapter.js";

/** 一个 Agent 日志如何交代它消耗的工作。 */
export interface ConsumedWork {
  /** 最近一个交代了已消耗工作的回合结束事件；无则缺省。 */
  readonly end?: SessionEvent;
}

/**
 * 折叠一个会话日志（或其自有后缀）为“已消耗工作”账目。
 * 进入过 step 的回合才算跑完工作；只开了回合没进步骤的不算。
 */
export function foldConsumedWork(events: readonly SessionEvent[]): ConsumedWork {
  const steppedTurns = new Set<string>();
  let end: SessionEvent | undefined;

  for (const event of events) {
    switch (event.type) {
      case "turn/start":
        break;
      case "step/start":
        steppedTurns.add(event.data.turnId);
        break;
      case "turn/end":
        // 进入过步骤的回合结束，才算交代了工作。
        if (steppedTurns.delete(event.data.turnId)) end = event;
        break;
      default:
        break;
    }
  }
  return end === undefined ? {} : { end };
}
