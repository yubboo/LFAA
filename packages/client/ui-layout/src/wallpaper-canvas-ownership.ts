/**
 * 功能：解析 LFAA 账户背景与 Wallpaper Engine 之间的工作台画布归属。
 * 作用：引擎已启用且选择项目后，避免工作台首帧绘制第二张 LFAA 背景。
 */
export interface WallpaperCanvasOwnershipInput {
  wallpaperEngineEnabled: boolean;
  wallpaperProjectId: string;
  accountBackgroundAvailable: boolean;
}

export interface WallpaperCanvasOwnership {
  wallpaperEngineOwnsCanvas: boolean;
  hasWallpaperBackground: boolean;
}

export function resolveWallpaperCanvasOwnership(
  input: WallpaperCanvasOwnershipInput
): WallpaperCanvasOwnership {
  const wallpaperEngineOwnsCanvas = input.wallpaperEngineEnabled && input.wallpaperProjectId.trim().length > 0;
  return {
    wallpaperEngineOwnsCanvas,
    hasWallpaperBackground: wallpaperEngineOwnsCanvas || input.accountBackgroundAvailable
  };
}
