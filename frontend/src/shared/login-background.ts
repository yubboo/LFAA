/**
 * 功能：管理登录页在未认证状态下使用的内置背景。
 * 作用：缓存当前设备最近加载的背景标识，并解析为静态资源路径；不缓存账户私有的上传图片。
 * 关联文件：frontend/src/components/AuthView.tsx、frontend/src/components/SettingsPage.tsx、frontend/src/components/Workbench.tsx。
 */
import { minecraftSceneBackgrounds } from "../assets/minecraftScenes.js";

const loginBackgroundStorageKey = "lfaa:login-background";
export const defaultLoginBackgroundId = "forest-bridge-evening";

const loginBackgroundFiles: Record<string, string> = {
  "service-room": "/backgrounds/service-room.jpg",
  "steamcmd-world": "/backgrounds/steamcmd-world.jpg",
  "minecraft-world": "/backgrounds/minecraft-world.jpg",
  "writing-desk": "/backgrounds/writing-desk.jpg",
  ...Object.fromEntries(minecraftSceneBackgrounds.map(({ id, file }) => [id, file]))
};

function hasLoginBackground(backgroundId: string): boolean {
  return Object.prototype.hasOwnProperty.call(loginBackgroundFiles, backgroundId);
}

export function getCachedLoginBackgroundId(): string {
  try {
    const backgroundId = window.localStorage.getItem(loginBackgroundStorageKey);
    if (backgroundId === "none" || (backgroundId !== null && hasLoginBackground(backgroundId))) {
      return backgroundId;
    }
    return defaultLoginBackgroundId;
  } catch {
    return defaultLoginBackgroundId;
  }
}

export function cacheLoginBackground(backgroundId: string): void {
  if (backgroundId !== "none" && !hasLoginBackground(backgroundId)) return;
  try {
    window.localStorage.setItem(loginBackgroundStorageKey, backgroundId);
  } catch {
    // 浏览器禁用本地存储时，账户设置仍保存在控制端，登录页使用默认背景。
  }
}

export function resolveLoginBackgroundImage(backgroundId = getCachedLoginBackgroundId()): string | null {
  if (backgroundId === "none") return null;
  return loginBackgroundFiles[backgroundId] ?? loginBackgroundFiles[defaultLoginBackgroundId] ?? null;
}
