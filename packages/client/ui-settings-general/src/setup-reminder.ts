/**
 * 功能：维护凭据、AI 和业务内容提醒的本地“今日暂停”状态。
 * 作用：按账户、提醒类别隔离浏览器当日暂停标记，日期过期后自然恢复。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx。
 */

// “今日”按当前浏览器本地日历日计算，与用户看到的日期保持一致。
export function getSetupReminderLocalDay(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type SetupReminderCategory = "ai-provider" | "content-storage";

function setupReminderSnoozeKey(userId: string, category: SetupReminderCategory): string {
  return `lfaa:setup-reminder-snooze:${userId}:${category}`;
}

// 旧版本只有一个首次配置暂停标记，兼容它在当天暂停两个原有类别。
function hasLegacySetupReminderSnooze(userId: string, today: string): boolean {
  try {
    return window.localStorage.getItem(`lfaa:setup-reminder-snooze:${userId}`) === today;
  } catch {
    return false;
  }
}

// 旧标记暂停了原来的全部配置提醒；用户操作任一新类别前先拆分，保留另一类别的当天状态。
function migrateLegacySetupReminderSnooze(userId: string): void {
  const legacyKey = `lfaa:setup-reminder-snooze:${userId}`;
  const legacyDay = window.localStorage.getItem(legacyKey);
  if (!legacyDay) return;
  for (const category of ["ai-provider", "content-storage"] as const) {
    const key = setupReminderSnoozeKey(userId, category);
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, legacyDay);
  }
  window.localStorage.removeItem(legacyKey);
}

// 标记仅暂停该账户、此浏览器和此类别的当天提醒；日期过期后无需清理即可自然恢复。
export function isSetupReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay(), category: SetupReminderCategory = "content-storage"): boolean {
  try {
    return window.localStorage.getItem(setupReminderSnoozeKey(userId, category)) === today
      || hasLegacySetupReminderSnooze(userId, today);
  } catch {
    return false;
  }
}

export function setSetupReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay(), category: SetupReminderCategory = "content-storage"): boolean {
  try {
    migrateLegacySetupReminderSnooze(userId);
    window.localStorage.setItem(setupReminderSnoozeKey(userId, category), today);
    return true;
  } catch {
    return false;
  }
}

export function clearSetupReminderSnooze(userId: string, category: SetupReminderCategory = "content-storage"): boolean {
  try {
    migrateLegacySetupReminderSnooze(userId);
    window.localStorage.removeItem(setupReminderSnoozeKey(userId, category));
    return true;
  } catch {
    return false;
  }
}

function credentialReminderSnoozeKey(userId: string): string {
  return `lfaa:credential-reminder-snooze:${userId}`;
}

// 凭据安全提醒单独暂停，不能连带隐藏首次配置提醒。
export function isCredentialReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay()): boolean {
  try {
    return window.localStorage.getItem(credentialReminderSnoozeKey(userId)) === today;
  } catch {
    return false;
  }
}

export function setCredentialReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay()): boolean {
  try {
    window.localStorage.setItem(credentialReminderSnoozeKey(userId), today);
    return true;
  } catch {
    return false;
  }
}
