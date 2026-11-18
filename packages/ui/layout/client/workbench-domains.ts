// 集中定义四栏/三栏工作台域配置、共用导航目标与视图标题解析，避免各组件分散硬编码。
import type { WorkbenchChatProvider, WorkbenchChatSessionSummary } from "../src/index";
import type { LocaleMessages } from "./locales";
import { isSettingsView, type LocalProject, type NavigationTarget, type NavigationView, type RecentItem } from "./navigation";
import { findSettingsCatalogItem } from "./settings-catalog";

export type WorkbenchDomainId = "workspace" | "settings";

export type SidebarHeaderConfig =
  | { kind: "modeSwitcher" }
  | { kind: "backTitle"; title: string; backLabel: string; backView: NavigationView };

export interface WorkbenchDomainConfig {
  id: WorkbenchDomainId;
  // 工作区启用四栏（含右侧上下文栏）；设置中心复用左一+左二+中间呈现三栏。
  columns: 3 | 4;
  sidebarAriaLabel: string;
  sidebarHeader: SidebarHeaderConfig;
}

// 根据当前视图解析所属工作台域配置，统一驱动栏数、左二头部与左一高亮态。
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
    ["workspace", locale.home, locale.chatModeDescription],
    ["images", locale.images, locale.imagesUnavailable],
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
    images: locale.images,
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

export function buildChatRecentItems({
  chatSessions,
  chatProvider,
  activeView,
  activeChatSessionId,
  onSelectSession,
}: {
  chatSessions: WorkbenchChatSessionSummary[];
  chatProvider: WorkbenchChatProvider;
  activeView: string;
  activeChatSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}): RecentItem[] {
  return chatSessions
    .filter((item) => !item.archived)
    .map((item) => ({
      id: item.id,
      sessionId: item.id,
      label: item.title,
      view: "workspace",
      ...(item.projectId ? { projectId: item.projectId } : {}),
      active: activeView === "workspace" && activeChatSessionId === item.id,
      onSelect: () => {
        onSelectSession(item.id);
        void chatProvider.openSession(item.id);
      },
    }));
}
