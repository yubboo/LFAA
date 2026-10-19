import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createReleaseAnnouncementPersistence } from '../../../packages/client/ui-layout/src/release-announcement.ts';

const workbench = readFileSync(new URL('../../../packages/client/ui-layout/src/Workbench.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../packages/client/ui-layout/src/workbench.css', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../../../packages/client/ui-settings/src/SettingsPage.tsx', import.meta.url), 'utf8');

test('公告确认按账户隔离并记录已确认的产品版本', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const firstAccount = createReleaseAnnouncementPersistence('user/one', storage);
  const secondAccount = createReleaseAnnouncementPersistence('user/two', storage);

  assert.equal(firstAccount.read(), undefined);
  assert.equal(firstAccount.write('0.0.8'), true);
  assert.equal(firstAccount.read(), '0.0.8');
  assert.equal(secondAccount.read(), undefined);
  assert.equal(firstAccount.write('0.0.9'), true);
  assert.equal(firstAccount.read(), '0.0.9');
});

test('公告使用发布元数据、通知总开关并等待其他弹窗结束', () => {
  assert.match(workbench, /lfaaProjectBuildInfo\.releaseNotes\.map/u);
  assert.match(workbench, /settings\.general\.notificationPopupsEnabled/u);
  assert.match(workbench, /setupReminderBusy \|\| passkeyPromptBusy \|\| desktopUpdateActivity/u);
  assert.match(workbench, /<Button type="primary" onClick=\{acknowledgeReleaseAnnouncement\}>我知道了<\/Button>/u);
  assert.match(workbench, /rootClassName="release-announcement-modal"/u);
  assert.doesNotMatch(workbench, /className="lfaa-update-modal"[\s\S]{0,80}release-announcement/u);
  assert.match(settings, /本次版本公告 · LFAA \{currentVersion\}/u);
  assert.match(settings, /lfaaProjectBuildInfo\.releaseNotes\.map/u);
  assert.match(settings, /关闭首次公告后，也可以随时在这里重新查看/u);
});

test('公告内容在独立滚动区内，窄短屏保留确认操作', () => {
  assert.match(styles, /\.release-announcement__body\s*\{[^}]*overflow:\s*auto[^}]*overscroll-behavior:\s*contain/su);
  assert.match(styles, /\.release-announcement__footer\s*\{[^}]*flex:\s*0 0 auto/su);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.release-announcement__footer \.ant-btn\s*\{[^}]*width:\s*100%/u);
  assert.match(styles, /\.release-announcement-modal \.ant-modal\s*\{[^}]*max-height:\s*calc\(100dvh - 48px\)/su);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.release-announcement \{ max-height: calc\(100dvh - 40px\);/u);
  assert.doesNotMatch(styles, /display:\s*inline-block/u);
});
