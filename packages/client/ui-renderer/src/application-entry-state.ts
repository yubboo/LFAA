/** 功能：解析浏览器历史中的应用入口标记。作用：只接受应用权威清单中的 ID，避免新增应用被旧白名单重定向。 */
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";

export const APPLICATION_ENTRY_STATE_KEY = "lfaaApplicationCenterEntry";

export function readApplicationEntryIdFromHistory(state: unknown): ApplicationId | null {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return null;
  const value = (state as Record<string, unknown>)[APPLICATION_ENTRY_STATE_KEY];
  return typeof value === "string" && APPLICATION_IDS.includes(value as ApplicationId) ? value as ApplicationId : null;
}
