// 读取并持久化侧栏固定的应用入口，默认固定参考图中的站点。
import { useState } from "react";
import type { NavigationView } from "./navigation";

const STORAGE_KEY = "lfaa:pinned-apps";
const PINNABLE_VIEWS: NavigationView[] = ["projects", "sites", "maps", "gpt", "codeReview", "openAiDevelopers", "canva", "data"];
const DEFAULT_PINNED: NavigationView[] = ["sites"];

function loadPinnedApps(): NavigationView[] {
  if (typeof window === "undefined") return DEFAULT_PINNED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PINNED;
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return DEFAULT_PINNED;
    return value.filter((item): item is NavigationView =>
      typeof item === "string" && PINNABLE_VIEWS.includes(item as NavigationView),
    );
  } catch {
    return DEFAULT_PINNED;
  }
}

// 写入成功后才更新视图，避免界面显示未能保存的固定状态。
export function usePinnedApps() {
  const [pinnedApps, setPinnedApps] = useState(loadPinnedApps);

  const togglePinnedApp = (view: NavigationView): boolean => {
    if (!PINNABLE_VIEWS.includes(view)) return false;
    const next = pinnedApps.includes(view)
      ? pinnedApps.filter((item) => item !== view)
      : [...pinnedApps, view];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPinnedApps(next);
      return true;
    } catch {
      return false;
    }
  };

  return { pinnedApps, togglePinnedApp };
}
