/**
 * 功能：保存和读取当前用户的应用中心偏好。
 * 作用：在用户切换应用或模式时写入 SQLite，使选择在刷新和重启后恢复。
 * 关联文件：server/src/database.ts、server/src/api/routes.ts。
 */
import { database } from "../../database.js";

export type ApplicationId = "steamcmd" | "minecraft" | "writing";
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
  const row = database.prepare(`
    SELECT selected_app, selected_mode
    FROM user_preferences
    WHERE user_id = ?
  `).get(userId) as PreferenceRow | undefined;

  return row
    ? { selectedApp: row.selected_app, selectedMode: row.selected_mode }
    : { ...defaultPreferences };
}

export function saveUserPreferences(userId: string, preferences: UserPreferences): UserPreferences {
  database.prepare(`
    INSERT INTO user_preferences (user_id, selected_app, selected_mode)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      selected_app = excluded.selected_app,
      selected_mode = excluded.selected_mode,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(userId, preferences.selectedApp, preferences.selectedMode);

  return preferences;
}
