// 集中定义四栏/三栏工作台域配置、共用导航目标与视图标题解析，避免各组件分散硬编码。
import type { WorkbenchChatProvider, WorkbenchChatSessionSummary } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import { isSettingsView, type LocalProject, type NavigationTarget, type NavigationView, type RecentItem } from "./navigation";
import { findSettingsCatalogItem } from "../panels/settings-catalog";
import { isWithinChatWindow } from "./chat-time-buckets";

/** 定义一级导航可选择的业务域。 */
export type WorkbenchDomainId =
  | "workspace"
  | "settings"
  | "library"
  | "scheduled"
  | "plugins"
  | "codeReview"
  | "extension";

/** 描述业务域对左栏头部的布局需求。 */
export type SidebarHeaderConfig =
  | { kind: "modeSwitcher" }
  | { kind: "backTitle"; title: string; backLabel: string; backView: NavigationView }
  | { kind: "sectionTitle"; title: string };

/** 把当前业务域的导航形态和侧栏配置交给工作台。 */
export interface WorkbenchDomainConfig {
  id: WorkbenchDomainId;
  // 工作区与资料库启用四栏（含右侧上下文栏）；设置与独立功能视图复用左一+左二+中间呈现三栏。
  columns: 3 | 4;
  sidebarAriaLabel: string;
  sidebarHeader: SidebarHeaderConfig;
}

const EXTENSION_VIEWS = new Set(["sites", "maps", "gpt", "openAiDevelopers", "canva", "data"]);

// 根据当前视图解析所属工作台域配置，统一驱动栏数、左二头部与左二功能菜单内容。
export function resolveWorkbenchDomain(view: string, locale: LocaleMessages): WorkbenchDomainConfig {
  if (isSettingsView(view)) {
    return {
      id: "settings",
      columns: 3,
      sidebarAriaLabel: locale.settingsCenter,
      sidebarHeader: {
        kind: "backTitle",
        title: locale.settings,
        backLabel: locale.backToWorkspace,
        backView: "workspace",
      },
    };
  }
  if (view === "library") {
    return {
      id: "library",
      columns: 4,
      sidebarAriaLabel: locale.library,
      sidebarHeader: {
        kind: "sectionTitle",
        title: locale.library,
      },
    };
  }
  if (view === "scheduled") {
    return {
      id: "scheduled",
      columns: 3,
      sidebarAriaLabel: locale.scheduled,
      sidebarHeader: { kind: "sectionTitle", title: locale.scheduled },
    };
  }
  if (view === "plugins" || view === "skills" || view.startsWith("ext:")) {
    return {
      id: "plugins",
      columns: 3,
      sidebarAriaLabel: locale.plugins,
      sidebarHeader: {
        kind: "sectionTitle",
        title: locale.settings === "设置" ? "自定义" : "Customize",
      },
    };
  }
  if (view === "codeReview") {
    return {
      id: "codeReview",
      columns: 3,
      sidebarAriaLabel: locale.codeReview,
      sidebarHeader: { kind: "sectionTitle", title: locale.codeReview },
    };
  }
  if (EXTENSION_VIEWS.has(view)) {
    return {
      id: "extension",
      columns: 3,
      sidebarAriaLabel: resolveViewLabel(view, locale),
      sidebarHeader: { kind: "sectionTitle", title: resolveViewLabel(view, locale) },
    };
  }
  return {
    id: "workspace",
    columns: 4,
    sidebarAriaLabel: locale.sectionNavigation,
    sidebarHeader: { kind: "modeSwitcher" },
  };
}

// 生成全局搜索与快捷跳转的统一目标列表，避免在侧栏和弹层重复维护。
export function buildNavigationTargets(locale: LocaleMessages, projects: LocalProject[]): NavigationTarget[] {
  const destinations: Array<[NavigationView, string, string]> = [
    ["workspace", locale.home, locale.workspaceDescription],
    ["scheduled", locale.scheduled, locale.scheduledUnavailable],
    ["library", locale.library, locale.libraryUnavailable],
    ["plugins", locale.plugins, locale.pluginsUnavailable],
    ["projects", locale.projects, locale.projectLocalNote],
    ["sites", locale.sites, locale.sitesUnavailable],
    ["maps", locale.maps, locale.mapsUnavailable],
    ["gpt", locale.gpt, locale.gptUnavailable],
    ["codeReview", locale.codeReview, locale.codeReviewUnavailable],
    ["openAiDevelopers", locale.openAiDevelopers, locale.openAiUnavailable],
    ["canva", locale.canva, locale.canvaUnavailable],
    ["data", locale.data, locale.dataUnavailable],
    ["appearance", locale.appearance, locale.appearanceDescription],
  ];

  return [
    ...destinations.map(([view, label, description]) => ({ id: view, label, description, view })),
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      description: locale.localProject,
      view: "project" as const,
      projectId: project.id,
    })),
  ];
}

// 统一解析页面标题，供顶栏、最近访问和未接入页共用。
export function resolveViewLabel(view: string, locale: LocaleMessages, registeredTitle?: string): string {
  if (registeredTitle) return registeredTitle;
  const settingsItem = findSettingsCatalogItem(view);
  if (settingsItem) {
    return locale.settings === "设置" ? settingsItem.labelZh : settingsItem.labelEn;
  }
  const labels: Record<string, string> = {
    workspace: locale.home,
    appearance: locale.appearance,
    scheduled: locale.scheduled,
    library: locale.library,
    plugins: locale.plugins,
    projects: locale.projects,
    sites: locale.sites,
    maps: locale.maps,
    gpt: locale.gpt,
    codeReview: locale.codeReview,
    openAiDevelopers: locale.openAiDevelopers,
    canva: locale.canva,
    data: locale.data,
    project: locale.projectHome,
  };
  return labels[view] ?? view;
}

/** 将会话摘要映射为侧栏可排序、可选择的列表行；超过 7 天的聊天会话不再列出（仍在搜索中）。 */
export function buildChatRecentItems({
  chatSessions,
  chatProvider,
  activeView,
  activeChatSessionId,
  existingProjectIds,
  onSelectSession,
  now = Date.now(),
}: {
  chatSessions: WorkbenchChatSessionSummary[];
  chatProvider: WorkbenchChatProvider;
  activeView: string;
  activeChatSessionId: string | null;
  existingProjectIds?: Set<string>;
  onSelectSession: (sessionId: string) => void;
  now?: number;
}): RecentItem[] {
  return chatSessions
    .filter((item) => !item.archived
      && isWithinChatWindow(item.updatedAt, now)
      && (!item.projectId || (existingProjectIds ? !existingProjectIds.has(item.projectId) : false)))
    .map((item) => ({
      id: item.id,
      sessionId: item.id,
      label: item.title,
      view: "workspace",
      ...(item.projectId ? { projectId: item.projectId } : {}),
      ...(item.unread ? { unread: true } : {}),
      updatedAt: item.updatedAt,
      active: activeView === "workspace" && activeChatSessionId === item.id,
      onSelect: () => {
        chatProvider.closeSessionMenus?.();
        onSelectSession(item.id);
        void chatProvider.openSession(item.id);
      },
    }));
}
