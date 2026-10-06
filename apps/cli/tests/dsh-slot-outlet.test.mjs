/**
 * 功能：回归 DSH Slot 的通用空内容反馈。
 * 作用：确保 renderer 缺失时本地 fallback 可见，且上游 renderer 收到完整 fallback/entryKey 选项。
 * 关联文件：packages/client/modules/src/client/index.ts、ui-renderer/src/render.tsx、SettingsPage.tsx、ApplicationWorkspace.tsx。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { DshSlotOutlet, DshSlotRoot } from 'lfaa-client-modules/src/client/slots.js';

const requireClient = createRequire(new URL('../../../packages/client/modules/package.json', import.meta.url));
const React = requireClient('react');
const { renderToStaticMarkup } = requireClient('react-dom/server');
const fallback = React.createElement('p', { role: 'status' }, '扩展面板尚未加载内容');

test('DshSlotOutlet renders its fallback when the DSH renderer is absent', () => {
  const markup = renderToStaticMarkup(React.createElement(DshSlotOutlet, {
    name: 'settings.section',
    fallback
  }));
  assert.equal(markup, '<p role="status">扩展面板尚未加载内容</p>');
});

test('DshSlotOutlet forwards keyed slot fallback to the DSH renderer', () => {
  const calls = [];
  const renderer = (name, owner, options) => {
    calls.push({ name, owner, options });
    return options?.fallback ?? null;
  };
  const markup = renderToStaticMarkup(React.createElement(DshSlotRoot, {
    renderer,
    children: React.createElement(DshSlotOutlet, {
      name: 'sidebar.right.pane.tab',
      entryKey: 'wallpaper-engine',
      fallback
    })
  }));

  assert.equal(markup, '<p role="status">扩展面板尚未加载内容</p>');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'sidebar.right.pane.tab');
  assert.equal(calls[0].options.entryKey, 'wallpaper-engine');
  assert.equal(calls[0].options.fallback, fallback);
});

test('Settings and right-panel consumers show actionable empty states; optional overlay stays silent', () => {
  const root = new URL('../../../', import.meta.url);
  const settings = readFileSync(new URL('packages/client/ui-settings/src/SettingsPage.tsx', root), 'utf8');
  const workspace = readFileSync(new URL('packages/client/ui-workspace/src/ApplicationWorkspace.tsx', root), 'utf8');
  const workbench = readFileSync(new URL('packages/client/ui-layout/src/Workbench.tsx', root), 'utf8');

  assert.match(settings, /<DshSlotOutlet name="settings\.section" fallback=/u);
  assert.match(settings, /壁纸插件界面尚未加载/u);
  assert.match(settings, /selectSection\("plugins"\)/u);
  assert.match(workspace, /name: "sidebar\.right\.pane\.tab", entryKey: tab\.id, fallback:/u);
  assert.match(workspace, /扩展面板尚未加载内容/u);
  assert.match(workbench, /<DshSlotOutlet name="shell\.overlay" \/>/u);
});

