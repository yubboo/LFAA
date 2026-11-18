// 定义浏览器 Shell 共用的导航与最近列表类型，项目类型由公共契约提供。
import type { WorkbenchProjectItem } from "../src/index";

export type LocalProject = WorkbenchProjectItem;

export type NavigationView =
  | "workspace"
  | "appearance"
  | `settings:${string}`
  | "images"
  | "scheduled"
  | "library"
  | "plugins"
  | "projects"
  | "sites"
  | "maps"
  | "gpt"
  | "codeReview"
  | "openAiDevelopers"
  | "canva"
  | "data"
  | "project";

// 判断当前视图是否属于设置中心，供左二栏切换设置菜单。
export function isSettingsView(view: string): boolean {
  return view === "appearance" || view.startsWith("settings:");
}

export type WorkspaceMode = "chatgpt" | "codex";

export interface RecentItem {
  id: string;
  label: string;
  view: NavigationView;
  projectId?: string;
  sessionId?: string;
  active?: boolean;
  onSelect?: () => void;
}

export interface NavigationTarget extends RecentItem {
  description: string;
}
