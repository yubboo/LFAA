/**
 * 功能：把活动运行句柄折叠为只读投影。
 * 作用：隔离内部可变句柄，对外只暴露目录行与计时，避免模型/客户端触达取消函数。
 * 关联文件：projection-types.ts、manager.ts。
 */
import type { SubagentRunHandle } from "./types.js";
import type { SubagentCatalogEntry, SubagentTiming } from "./projection-types.js";

/** 把一个运行句柄投影为目录行。 */
export function projectCatalogEntry(run: SubagentRunHandle): SubagentCatalogEntry {
  return {
    runId: run.runId,
    driver: run.driver,
    label: run.description,
    activity: run.status,
    startedAt: run.startedAt
  };
}

/** 把一个运行句柄投影为计时信息。 */
export function projectTiming(run: SubagentRunHandle): SubagentTiming {
  if (run.status !== "running") {
    const endedAt = Date.now(); // 一次性运行无结束时间戳字段，用当前近似值
    const started = Date.parse(run.startedAt);
    return { settledMs: Number.isFinite(started) ? Math.max(0, endedAt - started) : 0 };
  }
  return { settledMs: 0, activeSince: run.startedAt };
}
