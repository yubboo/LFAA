/**
 * 功能：维护首次配置提醒的本地“今日暂停”状态。
 * 作用：让工作台弹窗与设置中心读取、设置和清除同一账户的当日提醒暂停标记。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx。
 */

// “今日”按当前浏览器本地日历日计算，与用户看到的日期保持一致。
export function getSetupReminderLocalDay(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setupReminderSnoozeKey(userId: string): string {
  return `lfaa:setup-reminder-snooze:${userId}`;
}

// 标记仅暂停该账户在此浏览器中的当天提醒；日期过期后无需清理即可自然恢复。
export function isSetupReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay()): boolean {
  try {
    return window.localStorage.getItem(setupReminderSnoozeKey(userId)) === today;
  } catch {
    return false;
  }
}

export function setSetupReminderSnoozedToday(userId: string, today = getSetupReminderLocalDay()): boolean {
  try {
    window.localStorage.setItem(setupReminderSnoozeKey(userId), today);
    return true;
  } catch {
    return false;
  }
}

export function clearSetupReminderSnooze(userId: string): boolean {
  try {
    window.localStorage.removeItem(setupReminderSnoozeKey(userId));
    return true;
  } catch {
    return false;
  }
}
