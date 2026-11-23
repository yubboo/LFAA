// 定义浏览器 Shell 共用的导航与最近列表类型，项目类型由公共契约提供。
import type { WorkbenchProjectItem } from "../../contract/index";

/** 描述工作台导航使用的项目摘要与绑定信息。 */
export type LocalProject = WorkbenchProjectItem;

/** 描述工作台可以打开的中心视图名称。 */
export type NavigationView =
  | "workspace"
  | "group"
  | "agents"
  | "appearance"
  | `settings:${string}`
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

/** 区分工作台保存和恢复的工作模式。 */
export type WorkspaceMode = "chatgpt" | "codex";

/** 描述侧栏会话行共享的可展示状态。 */
export interface RecentItem {
  id: string;
  label: string;
  view: NavigationView;
  projectId?: string;
  sessionId?: string;
  unread?: boolean;
  updatedAt?: number;
  active?: boolean;
  onSelect?: () => void;
}

/** 组合目标视图及其项目或业务上下文，供工作台统一跳转。 */
export interface NavigationTarget extends RecentItem {
  description: string;
}
