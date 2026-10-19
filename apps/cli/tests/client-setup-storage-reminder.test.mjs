/** 功能：回归首次业务内容存储提醒的明确选择。作用：验证按钮文案、Owner 路径映射与成功后关闭条件；不触碰真实账户数据。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const reminder = readFileSync(new URL('../../../packages/client/ui-settings-general/src/SetupReminder.tsx', import.meta.url), 'utf8');
const reminderStyles = readFileSync(new URL('../../../packages/client/ui-layout/src/workbench.css', import.meta.url), 'utf8');

test('内容存储提醒将系统推荐和自定义位置收敛到设置入口', () => {
  assert.match(reminder, /<Button type="primary" disabled=\{saving\} onClick=\{\(\) => openReminderSettings\("workspace"\)\}>去配置存储<\/Button>/u);
  assert.doesNotMatch(reminder, /chooseContentLocation|saveProjectContentDirectory|>更改为系统推荐<|>自定义位置</u);
  assert.match(reminder, /点击“去配置存储”后，可在“项目与存储”选择系统推荐或自定义位置/u);
});

test('设置导航会立即收起提醒，且设置路由不显示凭据提醒', () => {
  assert.match(reminder, /const openReminderSettings = \(section: "ai" \| "workspace"\) => \{\s*setOpen\(false\);\s*shownRef\.current = false;\s*onOpenSettings\(section\);/u);
  assert.match(reminder, /open=\{settings\.general\.notificationPopupsEnabled && !isSettingsPage && \(Boolean\(activePriorityPrompt\) \|\| !suspended && open\)\}/u);
  assert.match(reminder, /const activePriorityPrompt = priorityPrompt\s*&& settings\.general\.notificationPopupsEnabled\s*&& !isSettingsPage/u);
  assert.match(reminder, /onClick=\{\(\) => openReminderSettings\("ai"\)\}>\{promptAction\}<\/Button>/u);
  assert.match(reminder, /setOpen\(false\);\s*activePriorityPrompt\.onAction\(\);/u);
  assert.match(reminder, /accountsResult\.value\?\.accounts\.some\(account => account\.active\)/u);
  assert.match(reminder, /title: "尚未配置大模型", description: "请前往设置中心完成配置。"/u);
});

test('关键提醒把长期关闭合并到“不更改”，并提供当日暂停与五分钟后重试', () => {
  const footer = reminder.match(/footer=\{activePriorityPrompt[\s\S]*?\n      centered/u)?.[0] ?? '';
  assert.match(footer, /dismissCredentialReminderForToday\}>今日不再提醒/u);
  assert.match(footer, /remindLater\("credential"\)\}>稍后再说/u);
  assert.match(footer, /dismissForToday\}>今日不再提醒/u);
  assert.match(footer, /onClick=\{remindCurrentLater\}>稍后再说/u);
  assert.doesNotMatch(footer, /<Button[^>]*>不再提醒<\/Button>/u);

  assert.match(reminder, /saveReminderDisabled\(currentReminder\.category\)/u);
  assert.match(reminder, /onClick=\{\(\) => void disableReminder\(\)\}>不更改/u);
  assert.match(reminder, /const disableReminder = async \(\) => \{[\s\S]*await saveReminderDisabled\(currentReminder\.category\);\s*shownRef\.current = false;\s*setOpen\(false\);/u);
  assert.doesNotMatch(reminder.match(/const disableReminder = async \(\) => \{[\s\S]*?\n  \};/u)?.[0] ?? "", /onOpenSettings|onNavigate/u);
  assert.match(reminder, /onClick=\{\(\) => void disableCredentialReminder\(\)\}>不更改/u);
  assert.match(reminder, /关闭后续业务内容存储提醒/u);
  assert.match(reminder, /关闭后续 AI Provider 提醒/u);
  assert.match(reminder, /const REMIND_LATER_DELAY_MS = 5 \* 60 \* 1000/u);
  assert.match(reminder, /setRemindLaterUntil\(\(current\) => \(\{ \.\.\.current, \[reminder\]: Date\.now\(\) \+ REMIND_LATER_DELAY_MS \}\)\)/u);
  assert.match(reminder, /window\.setTimeout\(\(\) => \{[\s\S]*shownRef\.current = false;[\s\S]*\}, Math\.max\(0, nextReminderAt - now\)\)/u);
  assert.match(reminder, /return \(\) => window\.clearTimeout\(timer\)/u);
});

test('凭据和 AI 提醒将“不更改”放左侧，配置操作放右侧', () => {
  const credentialBranch = reminder.indexOf(': activePriorityPrompt ? <>');
  const credentialActions = reminder.indexOf('<Space wrap className="setup-reminder-card__actions">', credentialBranch);
  const credentialNoChange = reminder.indexOf('disableCredentialReminder()', credentialActions);
  const credentialChange = reminder.indexOf('activePriorityPrompt.onAction()', credentialNoChange);
  assert.ok(credentialBranch >= 0 && credentialActions > credentialBranch);
  assert.ok(credentialNoChange > credentialActions && credentialChange > credentialNoChange);

  const aiBranch = reminder.indexOf('{missing[0] === "ai" && !activePriorityPrompt ? <>');
  const aiActions = reminder.indexOf('<Space wrap className="setup-reminder-card__actions">', aiBranch);
  const aiNoChange = reminder.indexOf('disableReminder()', aiActions);
  const aiConfigure = reminder.indexOf('openReminderSettings("ai")', aiNoChange);
  assert.ok(aiBranch >= 0 && aiActions > aiBranch);
  assert.ok(aiNoChange > aiActions && aiConfigure > aiNoChange);
});

test('关键提醒操作在窄屏换行且保留弹窗正文滚动', () => {
  assert.match(reminderStyles, /\.setup-reminder-modal \.ant-modal-body\s*\{[^}]*overflow-y:\s*auto;/su);
  assert.match(reminderStyles, /\.setup-reminder-card__actions\.ant-space\s*\{[^}]*flex-wrap:\s*wrap;/su);
  assert.match(reminderStyles, /\.ant-modal-footer \.ant-space\s*\{[^}]*flex-wrap:\s*wrap;/su);
  assert.match(reminderStyles, /\.ant-modal-footer \.ant-btn\s*\{[^}]*max-width:\s*100%[^}]*white-space:\s*normal;/su);
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
    assert.match(reminder, /category === "ai-provider"\s*\? \{ aiProviderReminderEnabled: false \}\s*:\s*\{ setupReminderEnabled: false \}/u);
    assert.match(reminder, /onClick=\{remindCurrentLater\}>稍后再说/u);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});
