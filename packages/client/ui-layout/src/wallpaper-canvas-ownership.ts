/**
 * 功能：解析 LFAA 账户背景与已装配 DSH Wallpaper Engine Client 之间的工作台画布归属。
 * 作用：在首帧按账户偏好和 Profile Client 图确定 Owner，避免插件初始化前闪现账户背景。
 */
export interface WallpaperCanvasOwnershipInput {
  wallpaperEngineEnabled: boolean;
  wallpaperProjectId: string;
  wallpaperEngineClientAvailable: boolean;
  accountBackgroundAvailable: boolean;
}

export interface WallpaperCanvasOwnership {
  wallpaperEngineOwnsCanvas: boolean;
  hasWallpaperBackground: boolean;
}

export function resolveWallpaperCanvasOwnership(
  input: WallpaperCanvasOwnershipInput
): WallpaperCanvasOwnership {
  const wallpaperEngineOwnsCanvas = input.wallpaperEngineEnabled
    && input.wallpaperProjectId.trim().length > 0
    && input.wallpaperEngineClientAvailable;
  return {
    wallpaperEngineOwnsCanvas,
    hasWallpaperBackground: wallpaperEngineOwnsCanvas || input.accountBackgroundAvailable
  };
}
