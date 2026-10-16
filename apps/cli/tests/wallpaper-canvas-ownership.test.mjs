/**
 * 功能：回归验证 Wallpaper Engine 与 LFAA 背景的工作台画布归属。
 * 作用：确保 Owner 在首帧可由账户设置确定，且 LFAA 壁纸偏好不会被清空。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveWallpaperCanvasOwnership } from '../../../packages/client/ui-layout/src/wallpaper-canvas-ownership.ts';
import { createDshWallpaperAppearanceTokens } from '../../../packages/client/ui-theme/src/dsh-wallpaper-appearance.ts';

const workbenchCss = readFileSync(new URL('../../../packages/client/ui-layout/src/workbench.css', import.meta.url), 'utf8');
const workbenchSource = readFileSync(new URL('../../../packages/client/ui-layout/src/Workbench.tsx', import.meta.url), 'utf8');
const chatCss = readFileSync(new URL('../../../packages/client/ui-chat/src/ai-work-chat.css', import.meta.url), 'utf8');

test('账户选择有效且 DSH Profile Client 图已装配时首帧交给引擎', () => {
  assert.deepEqual(resolveWallpaperCanvasOwnership({
    wallpaperEngineEnabled: true,
    wallpaperProjectId: ' 3111685591 ',
    wallpaperEngineClientAvailable: true,
    accountBackgroundAvailable: true
  }), {
    wallpaperEngineOwnsCanvas: true,
    hasWallpaperBackground: true
  });
});

test('账户关闭、没有有效项目或 Profile 未装配引擎时仍由账户背景绘制', () => {
  for (const settings of [
    { wallpaperEngineEnabled: false, wallpaperProjectId: '3111685591', wallpaperEngineClientAvailable: true, accountBackgroundAvailable: true },
    { wallpaperEngineEnabled: true, wallpaperProjectId: '  ', wallpaperEngineClientAvailable: true, accountBackgroundAvailable: true },
    { wallpaperEngineEnabled: true, wallpaperProjectId: '3111685591', wallpaperEngineClientAvailable: false, accountBackgroundAvailable: true }
  ]) {
    assert.deepEqual(resolveWallpaperCanvasOwnership(settings), {
      wallpaperEngineOwnsCanvas: false,
      hasWallpaperBackground: true
    });
  }
});

test('双方都没有已选壁纸时不声明壁纸背景', () => {
  assert.deepEqual(resolveWallpaperCanvasOwnership({
    wallpaperEngineEnabled: false,
    wallpaperProjectId: '',
    wallpaperEngineClientAvailable: false,
    accountBackgroundAvailable: false
  }), {
    wallpaperEngineOwnsCanvas: false,
    hasWallpaperBackground: false
  });
});

test('工作台订阅 DSH Profile Client 可用状态，停用时恢复账户画布并撤销订阅', () => {
  assert.match(workbenchSource, /attributeFilter:\s*\["data-lfaa-wallpaper-engine-client"\]/u);
  assert.match(workbenchSource, /return\s*\(\)\s*=>\s*observer\.disconnect\(\)/u);
});

test('插件在当前页面开始显示壁纸后立即启用现有 LFAA 表面外观', () => {
  assert.match(workbenchCss, /body\[data-we-wallpaper\] \.workbench-shell\[data-wallpaper-engine-owner="true"\] :is\([^)]*\.settings-content/s);
  assert.match(workbenchCss, /body\[data-we-wallpaper\] \.workbench-shell\[data-wallpaper-engine-owner="true"\]\[data-translucent-sidebar="true"\] :is\([^)]*\.settings-sidebar/s);
  assert.match(workbenchCss, /body\[data-we-wallpaper\] \.workbench-shell\[data-wallpaper-engine-owner="true"\] \.lfaa-workbench__pane--left/);
});

test('活动 DSH 外观层映射插件 Profile 色彩与玻璃配置，未活动时工作台保留 LFAA 设置', () => {
  const pluginTokens = createDshWallpaperAppearanceTokens({
    theme: 'light',
    accentColor: '#d64d8f',
    overlay: 15,
    blur: 11,
    canvasColor: '#ffffff',
    surfaceColor: '#ffffff',
    mutedSurfaceColor: '#f5f5f5',
    hoverSurfaceColor: '#ededed',
    selectedSurfaceColor: '#eaf0ff',
    inverseTextColor: '#fafafa'
  });
  assert.equal(pluginTokens['--settings-accent'], 'var(--we-accent, #d64d8f)');
  assert.equal(pluginTokens['--settings-glass-blur'], 'var(--we-blur, 11px)');
  assert.equal(pluginTokens['--settings-background-surface-opacity'], '100%');
  assert.match(pluginTokens['--color-surface'], /--we-readability-floor/u);
  assert.match(pluginTokens['--color-surface'], /--we-glass-alpha/u);
  assert.match(pluginTokens['--settings-wallpaper-window-surface'], /--we-settings-window-alpha/u);
  assert.match(pluginTokens['--settings-wallpaper-chat-surface'], /--we-chat-glass-fill/u);
  assert.match(pluginTokens['--settings-wallpaper-left-sidebar-surface'], /--we-left-sidebar-alpha/u);
  assert.match(pluginTokens['--settings-wallpaper-sidebar-surface'], /--we-sidebar-tint/u);
  assert.match(pluginTokens['--settings-wallpaper-floaters-surface'], /--we-floaters-alpha/u);
  const darkTokens = createDshWallpaperAppearanceTokens({
    theme: 'dark',
    accentColor: '#d64d8f',
    overlay: 15,
    blur: 11,
    canvasColor: '#181818',
    surfaceColor: '#202020',
    mutedSurfaceColor: '#262626',
    hoverSurfaceColor: '#303030',
    selectedSurfaceColor: '#262626',
    inverseTextColor: '#f7f7f7'
  });
  assert.match(darkTokens['--settings-wallpaper-sidebar-surface'], /--we-sidebar-tint[\s\S]*\* 0\.65/u);
  assert.match(workbenchSource, /wallpaperCanvasOwnership\.wallpaperEngineOwnsCanvas\s*\?\s*createDshWallpaperAppearanceTokens/u);
  assert.match(workbenchSource, /^\s*:\s*\{\};/mu);
});

test('DSH 表面开关分别门控 LFAA 设置、左右侧栏、聊天与浮层扩展点', () => {
  assert.match(workbenchCss, /body\[data-we-wallpaper\]\[data-we-glass-window\][\s\S]*?--settings-wallpaper-window-surface/u);
  assert.match(workbenchCss, /body\[data-we-wallpaper\]\[data-we-left-sidebar\][\s\S]*?--settings-wallpaper-left-sidebar-surface/u);
  assert.match(workbenchCss, /body\[data-we-wallpaper\]\[data-we-sidebar-glass\][\s\S]*?--settings-wallpaper-sidebar-surface/u);
  assert.match(workbenchCss, /body\[data-we-wallpaper\]\[data-we-glass-floaters\][\s\S]*?--settings-wallpaper-floaters-surface/u);
  assert.match(chatCss, /body\[data-we-wallpaper\]\[data-we-glass-chat\][\s\S]*?--settings-wallpaper-chat-surface/u);
  assert.match(workbenchCss, /brightness\(var\(--we-glass-brightness, 1\.04\)\) contrast\(1\.01\)/u);
  assert.match(chatCss, /brightness\(var\(--we-glass-brightness, 1\.04\)\) contrast\(1\.01\)/u);
});
