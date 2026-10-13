/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 通过 session-projection 注册器登记投影；LFAA 直接提供一个纯函数，
 * 从会话内核事件折叠出回合/步骤边界。
 *
 * 文件：projection.ts
 * 功能：从会话事件折叠 TurnBoundaryProjection（开放回合/最近步骤/最近回合号）。
 * 作用：归档准入、运行状态展示读取这个投影。
 */
import type { TurnBoundaryProjection } from "./types.js";
import type { SessionEvent } from "./kernel-adapter.js";

/**
 * 折叠会话事件流为回合/步骤边界。
 * 单趟扫描；turn/end 关闭开放回合，step/start 记录最近步骤。
 */
export function foldTurnBoundary(events: readonly SessionEvent[]): TurnBoundaryProjection {
  let openTurnId: string | null = null;
  let lastStep: number | null = null;
  let lastTurn = 0;

  for (const event of events) {
    switch (event.type) {
      case "turn/start":
        openTurnId = event.data.turnId;
        lastTurn += 1;
        break;
      case "step/start":
        lastStep = event.data.step;
        break;
      case "turn/end":
        if (openTurnId === event.data.turnId) openTurnId = null;
        break;
      default:
        break;
    }
  }
  return { openTurnId, lastStep, lastTurn };
}
