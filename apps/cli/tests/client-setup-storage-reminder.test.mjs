/** 功能：回归首次业务内容存储提醒的明确选择。作用：验证按钮文案、Owner 路径映射与成功后关闭条件；不触碰真实账户数据。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const reminder = readFileSync(new URL('../../../packages/client/ui-settings-general/src/SetupReminder.tsx', import.meta.url), 'utf8');

test('首次内容提醒将不更改与系统推荐明确显示为两个操作', () => {
  assert.match(reminder, /onClick=\{\(\) => void chooseContentLocation\(false\)\}>不更改<\/Button>/u);
  assert.match(reminder, /onClick=\{\(\) => void chooseContentLocation\(true\)\}>更改为系统推荐<\/Button>/u);
  assert.match(reminder, /<Button disabled=\{saving\} onClick=\{\(\) => \{ setOpen\(false\); onOpenSettings\("workspace"\); \}\}>自定义位置<\/Button>/u);
});

test('首次内容提醒只保存 Owner 返回的默认或推荐路径，并等待持久化成功后关闭', () => {
  assert.match(reminder, /const directory = useRecommended \? locations\.recommendedContentDirectory : locations\.defaultContentDirectory;/u);
  assert.match(reminder, /const result = await saveProjectContentDirectory\(directory\);\s*if \(!result\.configured\) throw new Error\("内容存储位置尚未保存，请重试。"\);/u);
  assert.match(reminder, /setMissing\(current => current\.filter\(item => item !== "storage"\)\);\s*setOpen\(false\);/u);
  assert.match(reminder, /catch \(error\) \{\s*setSaveError\(getErrorMessage\(error\)\);/u);
});

test('AI Provider 与业务存储提醒按类别暂停，且“稍后再说”不永久关闭', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    } }
  });
  try {
    const { clearSetupReminderSnooze, isSetupReminderSnoozedToday, setSetupReminderSnoozedToday } = await import('../../../packages/client/ui-settings-general/src/setup-reminder.ts');
    assert.equal(setSetupReminderSnoozedToday('user-a', '2026-10-19', 'ai-provider'), true);
    assert.equal(isSetupReminderSnoozedToday('user-a', '2026-10-19', 'ai-provider'), true);
    assert.equal(isSetupReminderSnoozedToday('user-a', '2026-10-19', 'content-storage'), false);
    assert.equal(isSetupReminderSnoozedToday('user-a', '2026-10-20', 'ai-provider'), false);
    values.set('lfaa:setup-reminder-snooze:user-b', '2026-10-19');
    assert.equal(isSetupReminderSnoozedToday('user-b', '2026-10-19', 'ai-provider'), true);
    assert.equal(isSetupReminderSnoozedToday('user-b', '2026-10-19', 'content-storage'), true);
    assert.equal(clearSetupReminderSnooze('user-b', 'ai-provider'), true);
    assert.equal(isSetupReminderSnoozedToday('user-b', '2026-10-19', 'ai-provider'), false);
    assert.equal(isSetupReminderSnoozedToday('user-b', '2026-10-19', 'content-storage'), true);
    assert.match(reminder, /currentReminder\?\.category === "ai-provider"\s*\? \{ aiProviderReminderEnabled: false \}\s*:\s*\{ setupReminderEnabled: false \}/u);
    assert.match(reminder, /onClick=\{\(\) => setOpen\(false\)\}>稍后再说/u);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});
