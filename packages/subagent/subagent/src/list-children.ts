/**
 * 功能：列出某账户的子代理（含投影）。
 * 作用：从 manager 取活动/近期运行，折叠为只读目录行，供控制工具展示。
 * 关联文件：manager.ts、projection-types.ts。
 */
import type { SubagentManager } from "./manager.js";
import type { SubagentCatalogEntry } from "./projection-types.js";

/** 列出某账户的子代理目录行。 */
export function listChildren(manager: SubagentManager, userId: string): SubagentCatalogEntry[] {
  return manager.listRuns(userId).map(run => ({
    runId: run.runId,
    driver: run.driver,
    label: run.description,
    activity: run.status,
    startedAt: run.startedAt
  }));
}
