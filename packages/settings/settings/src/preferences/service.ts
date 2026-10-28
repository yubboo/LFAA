/**
 * 功能：保存和读取当前用户的 App、工作模式与首次入口引导偏好。
 * 作用：在用户切换应用/模式或完成首次入口引导时经配置域写入账户设置文件。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts。
 */
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
export type ApplicationMode = "normal" | "ai-work";

export interface UserPreferences {
  selectedApp: ApplicationId;
  selectedMode: ApplicationMode;
  guidedEntryCompleted: boolean;
}

interface PreferenceRow {
  selected_app: ApplicationId;
  selected_mode: ApplicationMode;
  guided_entry_completed?: boolean;
}

const defaultPreferences: UserPreferences = {
  selectedApp: "steamcmd",
  selectedMode: "normal",
  guidedEntryCompleted: false
};

export function getUserPreferences(userId: string): UserPreferences {
  const row = configuration.get("user_preferences", row => (row.user_id === userId)) as PreferenceRow | undefined;

  return row
    ? { selectedApp: row.selected_app, selectedMode: row.selected_mode, guidedEntryCompleted: row.guided_entry_completed === true }
    : { ...defaultPreferences };
}

export function saveUserPreferences(userId: string, preferences: UserPreferences): UserPreferences {
  configuration.save("user_preferences", { user_id: userId, selected_app: preferences.selectedApp, selected_mode: preferences.selectedMode, guided_entry_completed: preferences.guidedEntryCompleted });

  return preferences;
}
