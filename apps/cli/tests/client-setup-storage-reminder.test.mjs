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
