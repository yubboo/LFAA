/**
 * 功能：保存和读取当前用户的应用中心偏好。
 * 作用：在用户切换应用或模式时经配置域写入账户设置文件，使选择在刷新和重启后恢复。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts。
 */
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
export type ApplicationMode = "normal" | "ai-work";

export interface UserPreferences {
  selectedApp: ApplicationId;
  selectedMode: ApplicationMode;
}

interface PreferenceRow {
  selected_app: ApplicationId;
  selected_mode: ApplicationMode;
}

const defaultPreferences: UserPreferences = {
  selectedApp: "steamcmd",
  selectedMode: "normal"
};

export function getUserPreferences(userId: string): UserPreferences {
  const row = configuration.get("user_preferences", row => (row.user_id === userId)) as PreferenceRow | undefined;

  return row
    ? { selectedApp: row.selected_app, selectedMode: row.selected_mode }
    : { ...defaultPreferences };
}

export function saveUserPreferences(userId: string, preferences: UserPreferences): UserPreferences {
  configuration.save("user_preferences", { user_id: userId, selected_app: preferences.selectedApp, selected_mode: preferences.selectedMode });

  return preferences;
}
