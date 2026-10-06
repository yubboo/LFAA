/**
 * 功能：回归验证 Wallpaper Engine 与 LFAA 背景的工作台画布归属。
 * 作用：确保 Owner 在首帧可由账户设置确定，且 LFAA 壁纸偏好不会被清空。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWallpaperCanvasOwnership } from '../../../packages/client/ui-layout/src/wallpaper-canvas-ownership.ts';

test('引擎启用且选择项目时首帧将画布交给插件，但仍标记有壁纸表面', () => {
  assert.deepEqual(resolveWallpaperCanvasOwnership({
    wallpaperEngineEnabled: true,
    wallpaperProjectId: ' 3111685591 ',
    accountBackgroundAvailable: true
  }), {
    wallpaperEngineOwnsCanvas: true,
    hasWallpaperBackground: true
  });
});

test('引擎关闭或没有有效项目时仍由账户背景绘制', () => {
  for (const settings of [
    { wallpaperEngineEnabled: false, wallpaperProjectId: '3111685591', accountBackgroundAvailable: true },
    { wallpaperEngineEnabled: true, wallpaperProjectId: '  ', accountBackgroundAvailable: true }
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
    accountBackgroundAvailable: false
  }), {
    wallpaperEngineOwnsCanvas: false,
    hasWallpaperBackground: false
  });
});
