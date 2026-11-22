// 根据左一导航栏选中的功能域（资料库、图像、定时任务、插件、代码审查与扩展），动态渲染对应的左二功能菜单。
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { WorkbenchViewContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "./navigation";
import { resolveViewLabel, type WorkbenchDomainConfig } from "./workbench-domains";
import type { LibraryTabKey } from "../workbench-service";
import type { NavigationIconName } from "./NavigationIcon";
import { SidebarSectionList, type SidebarGroupConfig } from "../panels/SidebarSectionList";

/** 把当前业务域的左侧导航配置转交共享列表，统一选中状态和路由入口。 */
export function DomainSidebarMenu({
  locale,
  domain,
  activeView,
  activeLibraryTab,
  activeDomainItem,
  pluginViews,
  onSelectLibraryTab,
  onSelectDomainItem,
  onNavigate,
}: {
  locale: LocaleMessages;
  domain: WorkbenchDomainConfig;
  activeView: NavigationView;
  activeLibraryTab: LibraryTabKey;
  activeDomainItem: string;
  pluginViews: WorkbenchViewContribution<ReactNode>[];
  onSelectLibraryTab: (tab: LibraryTabKey) => void;
  onSelectDomainItem: (id: string) => void;
  onNavigate: (view: NavigationView) => void;
}) {
  const [query, setQuery] = useState("");
  const isZh = locale.settings === "设置";
  const normalized = query.trim().toLowerCase();

  const rawGroups = useMemo<SidebarGroupConfig[]>(() => {
    if (domain.id === "library") {
      return [
        {
          id: "library-categories",
          title: isZh ? "资料库分类" : "Library Categories",
          items: [
            {
              id: "lib-all",
              label: isZh ? "全部资产与记忆" : "All Items",
              icon: "library",
              active: activeLibraryTab === "all",
              onClick: () => onSelectLibraryTab("all"),
            },
            {
              id: "lib-media",
              label: isZh ? "图像" : "Images",
              icon: "images",
              active: activeLibraryTab === "media",
              onClick: () => onSelectLibraryTab("media"),
            },
            {
              id: "lib-artifact",
              label: isZh ? "Agent 产物" : "Agent Outputs",
              icon: "gpt",
              active: activeLibraryTab === "artifact",
              onClick: () => onSelectLibraryTab("artifact"),
            },
            {
              id: "lib-asset",
              label: isZh ? "本地资产" : "User Assets",
              icon: "project",
              active: activeLibraryTab === "asset",
              onClick: () => onSelectLibraryTab("asset"),
            },
            {
              id: "lib-memory",
              label: isZh ? "Agent 记忆" : "Long-Term Memory",
              icon: "companion",
              active: activeLibraryTab === "memory",
              onClick: () => onSelectLibraryTab("memory"),
            },
          ],
        },
        {
          id: "library-manage",
          title: isZh ? "管理与存储" : "Storage & Navigation",
          items: [
            {
              id: "lib-storage",
              label: isZh ? "存储位置设置" : "Storage Settings",
              icon: "settings",
              onClick: () => onNavigate("settings:storage" as NavigationView),
            },
            {
              id: "lib-home",
              label: locale.backToWorkspace,
              icon: "home",
              onClick: () => onNavigate("workspace"),
            },
          ],
        },
      ];
    }

    if (domain.id === "scheduled") {
      return [
        {
          id: "scheduled-tasks",
          title: isZh ? "任务管理" : "Tasks",
          items: [
            { id: "sched-new", label: isZh ? "新建任务" : "New Task", icon: "plus", active: activeDomainItem === "sched-new", onClick: () => onSelectDomainItem("sched-new") },
            { id: "sched-paused", label: isZh ? "已暂停" : "Paused", icon: "scheduled", active: activeDomainItem === "sched-paused", onClick: () => onSelectDomainItem("sched-paused") },
          ],
        },
        {
          id: "scheduled-links",
          title: isZh ? "快速跳转" : "Navigation",
          items: [
            { id: "sched-home", label: locale.backToWorkspace, icon: "home", onClick: () => onNavigate("workspace") },
          ],
        },
      ];
    }

    if (domain.id === "plugins") {
      const installedItems = [
        ...pluginViews.map((view) => ({
          id: `ext-${view.id}`,
          label: view.title,
          icon: "plugins" as NavigationIconName,
          active: activeView === (view.id as NavigationView),
          onClick: () => onNavigate(view.id as NavigationView),
        })),
        { id: "plug-codereview", label: locale.codeReview, icon: "codeReview" as NavigationIconName, onClick: () => onNavigate("codeReview") },
      ];
      return [
        {
          id: "plugins-main",
          title: isZh ? "扩展与技能" : "Extensions",
          items: [
            { id: "plug-list", label: locale.plugins, icon: "plugins", active: activeView === "plugins", onClick: () => onNavigate("plugins") },
            { id: "plug-skills", label: isZh ? "技能" : "Skills", icon: "filter", active: activeView === ("skills" as NavigationView), onClick: () => onNavigate("skills" as NavigationView) },
          ],
        },
        {
          id: "plugins-installed",
          title: locale.installedPlugins,
          items: installedItems,
        },
      ];
    }

    if (domain.id === "codeReview") {
      return [
        {
          id: "cr-queues",
          title: isZh ? "内置 Git 与审查" : "Git & Code Review",
          items: [
            { id: "cr-changes", label: isZh ? "工作区变更与 Diff" : "Changes & Diff", icon: "codeReview", active: !activeDomainItem || activeDomainItem === "cr-changes", onClick: () => onSelectDomainItem("cr-changes") },
            { id: "cr-commits", label: isZh ? "提交记录与分支" : "Commits & Branches", icon: "project", active: activeDomainItem === "cr-commits", onClick: () => onSelectDomainItem("cr-commits") },
            { id: "cr-reports", label: isZh ? "代码审查报告" : "Review Reports", icon: "bell", active: activeDomainItem === "cr-reports", onClick: () => onSelectDomainItem("cr-reports") },
          ],
        },
        {
          id: "cr-nav",
          title: isZh ? "编码设置与跳转" : "Settings & Navigation",
          items: [
            { id: "cr-settings-review", label: isZh ? "代码审查设置" : "Review Settings", icon: "settings", onClick: () => onNavigate("settings:codeReview" as NavigationView) },
            { id: "cr-settings-git", label: isZh ? "Git 设置" : "Git Settings", icon: "filter", onClick: () => onNavigate("settings:git" as NavigationView) },
            { id: "cr-home", label: locale.backToWorkspace, icon: "home", onClick: () => onNavigate("workspace") },
          ],
        },
      ];
    }

    const iconMap: Partial<Record<NavigationView, NavigationIconName>> = {
      sites: "sites",
      maps: "map",
      gpt: "gpt",
      openAiDevelopers: "openai",
      canva: "canva",
      data: "data",
    };

    return [
      {
        id: "ext-current",
        title: resolveViewLabel(activeView, locale),
        items: [
          {
            id: `ext-${activeView}`,
            label: resolveViewLabel(activeView, locale),
            icon: iconMap[activeView] ?? "plugins",
            active: true,
            onClick: () => onSelectDomainItem(`ext-${activeView}`),
          },
          {
            id: "ext-plugins",
            label: isZh ? "查看全部插件" : "All Plugins",
            icon: "plugins",
            onClick: () => onNavigate("plugins"),
          },
          {
            id: "ext-home",
            label: locale.backToWorkspace,
            icon: "home",
            onClick: () => onNavigate("workspace"),
          },
        ],
      },
    ];
  }, [activeDomainItem, activeLibraryTab, activeView, domain.id, isZh, locale, onNavigate, onSelectDomainItem, onSelectLibraryTab, pluginViews]);

  const filteredGroups = useMemo<SidebarGroupConfig[]>(() => {
    if (!normalized) return rawGroups;
    return rawGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalized)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalized, rawGroups]);

  return (
    <SidebarSectionList
      ariaLabel={domain.sidebarAriaLabel}
      search={{
        value: query,
        placeholder: isZh ? "筛选当前功能菜单..." : "Filter menu...",
        onChange: setQuery,
      }}
      groups={filteredGroups}
      emptySearchText={locale.noMatchingSettings}
    />
  );
}
