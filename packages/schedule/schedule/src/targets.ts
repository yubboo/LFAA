/**
 * 功能：保存定时任务创建时的真实会话与继承工具范围。
 * 作用：到点交付仍由 Agent Run 执行；模型不能伪造账户、App 或目标会话。
 * 关联文件：tools.ts、client.ts、agent-loop/index.ts；共享 SQLite 为该调度域的权威持久化。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";

database.exec(`CREATE TABLE IF NOT EXISTS lfaa_schedule_targets (
  task_id TEXT PRIMARY KEY NOT NULL REFERENCES lfaa_schedule_tasks(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL, app_id TEXT NOT NULL, session_id TEXT NOT NULL, tools_json TEXT NOT NULL
) STRICT`);

export interface ScheduleTarget { userId: string; appId: ApplicationId; sessionId: string; allowedToolNames: string[] }
export function bindScheduleTarget(taskId: string, target: ScheduleTarget): void {
  if (!target.sessionId || !APPLICATION_IDS.includes(target.appId) || target.allowedToolNames.length > 512) throw new Error("定时任务缺少有效的运行目标。");
  database.prepare("INSERT INTO lfaa_schedule_targets(task_id,owner_id,app_id,session_id,tools_json) VALUES(?,?,?,?,?)").run(taskId, target.userId, target.appId, target.sessionId, JSON.stringify(target.allowedToolNames));
}
export function getScheduleTarget(taskId: string, userId: string): ScheduleTarget | null {
  const row = database.prepare("SELECT * FROM lfaa_schedule_targets WHERE task_id=? AND owner_id=?").get(taskId, userId) as { app_id: string; session_id: string; tools_json: string } | undefined;
  if (!row || !APPLICATION_IDS.includes(row.app_id as ApplicationId)) return null;
  const tools: unknown = JSON.parse(row.tools_json);
  if (!Array.isArray(tools) || tools.length > 512 || tools.some(name => typeof name !== "string")) throw new Error("定时任务工具范围损坏。");
  return { userId, appId: row.app_id as ApplicationId, sessionId: row.session_id, allowedToolNames: tools as string[] };
}
