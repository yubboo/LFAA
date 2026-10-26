/**
 * 功能：验证 AI Work 右侧应用菜单按容器宽度排版。
 * 作用：防止宽栏退化为占据左侧的单列长菜单，并锁定窄栏下的主题卡片样式。
 * 关联文件：packages/client/ui-workspace/src/css/right-menu.css、packages/client/ui-workspace/src/ApplicationWorkspace.tsx。
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../../../packages/client/ui-workspace/src/css/right-menu.css', import.meta.url), 'utf8');

test('right application menu uses content width to auto-fit app cards', () => {
  const navigation = css.match(/\.module-context__application-navigation \.secondary-navigation__items-inner\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(navigation, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*320px\),\s*1fr\)\)/u);
  assert.match(navigation, /gap:\s*8px/u);
  assert.doesNotMatch(navigation, /@media/u, 'column count must follow the menu container, not viewport breakpoints');
});

test('right application cards retain readable size and existing appearance tokens', () => {
  const item = css.match(/\.module-context__application-navigation \.secondary-navigation__item\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(item, /min-height:\s*72px/u);
  assert.match(item, /border:\s*1px solid var\(--color-border-subtle\)/u);
  assert.match(item, /background:\s*var\(--color-surface-muted\)/u);
  assert.match(item, /color:\s*var\(--color-text-primary\)/u);

  const active = css.match(/\.module-context__application-navigation \.secondary-navigation__item\.is-active\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(active, /var\(--settings-accent,\s*var\(--color-brand\)\)/u);
  assert.match(active, /var\(--color-surface-selected\)/u);
});

test('right application menu remains vertically scrollable in a short viewport', () => {
  const applications = css.match(/\.module-context__applications\s*\{([^}]+)\}/u)?.[1] ?? '';
  const menu = css.match(/\.module-context__application-menu\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(applications, /min-height:\s*0/u);
  assert.match(applications, /overflow:\s*hidden/u);
  assert.match(menu, /min-height:\s*0/u);
  assert.match(menu, /flex:\s*1/u);
  assert.match(menu, /overflow-y:\s*auto/u);
});
