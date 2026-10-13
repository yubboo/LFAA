/**
 * 文件：invariant.ts
 * 功能：定时任务表的轻量一致性巡检。
 * 作用：在不依赖会话事件流的前提下，发现“活动任务无触发时刻 / 触发时刻早于上次触发 /
 *       规则 JSON 损坏”等坏数据；DSH 的会话流不变量（foldScheduleEvents）依赖 session 分片，
 *       见文末集成需要说明。
 * 关联文件：packages/schedule/schedule/src/store.ts。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface ScheduleHealthProblem {
  readonly taskId: string;
  readonly reason: string;
}

/** 扫描全表，返回所有活动任务中的一致性问题（不修复，只报告）。 */
export function inspectScheduleHealth(): readonly ScheduleHealthProblem[] {
  const problems: ScheduleHealthProblem[] = [];
  const rows = database.prepare(`
    SELECT id, rule_json, next_fire_at, last_fired_at, status
    FROM lfaa_schedule_tasks WHERE status = 'active'
  `).all() as unknown as Array<{
    id: string; rule_json: string; next_fire_at: number | null; last_fired_at: number | null; status: string;
  }>;
  for (const row of rows) {
    if (row.next_fire_at === null || Number(row.next_fire_at) <= 0) {
      problems.push({ taskId: row.id, reason: "活动任务缺少有效的下次触发时刻" });
      continue;
    }
    if (row.last_fired_at !== null && Number(row.next_fire_at) < Number(row.last_fired_at)) {
      problems.push({ taskId: row.id, reason: "下次触发时刻早于上次触发（时钟回拨或写库异常）" });
    }
    try {
      JSON.parse(row.rule_json) as unknown;
    } catch {
      problems.push({ taskId: row.id, reason: "规则 JSON 损坏" });
    }
  }
  return problems;
}

/**
 * 集成需要：DSH packages/schedule/schedule/src/invariant.ts 依赖 dsh-invariants 与
 * dsh-session 的会话事件流校验（schedule/change 事件可重放）。LFAA 的会话事件流与 invariants
 * 注册中心尚未在本分片范围内稳定导出，故本文件只做表数据巡检；会话流一致性待 session 分片接线。
 */
export const name = "schedule-invariant";
