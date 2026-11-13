/**
 * 功能：展示当前应用功能导航与工作区共享能力入口。
 * 作用：只消费上层传入的应用清单、区段和导航回调，工作区仍负责装配，领域页面仍由各自 Owner 实现。
 */
import { useMemo } from "react";
import type { ApplicationId, ApplicationMode } from "lfaa-client-connection/src/api.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { SecondaryNavigation } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { buildApplicationNavigationGroups } from "../application-navigation-model.js";
import type { ApplicationSummary } from "../types.js";

interface ApplicationNavigationPanelProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  section: string;
  gameLibrary?: boolean;
  workspaceTitle?: string;
  apps: ApplicationSummary[];
  applicationNavigationItems: ApplicationNavigationItem[];
  hidden: boolean;
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  onOpenGameFiles?: (app: "minecraft" | "steamcmd") => void;
  onWritingLibraryPortalTargetChange: (target: HTMLDivElement | null) => void;
}

export function ApplicationNavigationPanel({ userId, app, mode, section, gameLibrary = false, workspaceTitle, apps, applicationNavigationItems, hidden, onNavigate, onOpenApplication, onOpenGameFiles, onWritingLibraryPortalTargetChange }: ApplicationNavigationPanelProps) {
  const appMenuScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-menu", app));
  const minecraftMenuCategory = section === "java" ? "environment" : section === "overview" || section === "nodes" ? "monitor" : "management";
  const minecraftLogsSection = section === "logs" || section.startsWith("logs/") || /^instance\/[0-9a-f-]{36}\/logs$/iu.test(section);
  const minecraftInstanceSection = section.startsWith("instance/") && !minecraftLogsSection;
  const currentApplicationTitle = workspaceTitle ?? apps.find(item => item.id === app)?.title ?? "当前应用";
  const applicationNavigationGroups = useMemo(
    () => buildApplicationNavigationGroups(app, applicationNavigationItems, gameLibrary, onNavigate, onOpenApplication),
    [app, applicationNavigationItems, gameLibrary, onNavigate, onOpenApplication]
  );

  const locationClassName = mode === "normal" ? "module-context__applications module-sidebar__application-navigation" : "module-context__applications";
  return <section className={locationClassName} id="module-context-applications" aria-label={mode === "normal" ? `${currentApplicationTitle}功能导航` : "领域应用与共享能力导航"} hidden={hidden}>
    <div ref={appMenuScroll.ref} onScroll={appMenuScroll.onScroll} className="module-context__application-menu">
      <header className="module-context__heading"><div><strong>{mode === "normal" ? currentApplicationTitle : "应用与能力"}</strong><span>{mode === "normal" ? "当前应用功能" : "领域应用 · 跨应用共享能力"}</span></div></header>
      {mode === "ai-work" ? <button className="module-context__canvas-entry" type="button" onClick={() => onNavigate(`/apps/${app}/canvas`)} aria-label={`打开 ${applicationNavigationItems.find(item => item.applicationId === app)?.title ?? app} 的项目画布`} title="系统级共享能力：画布可绑定当前领域项目">
        <WorkbenchIcon name="grid" size={16} />
        <span><strong>当前项目画布</strong><small>系统共享能力 · 绑定当前领域</small></span>
        <WorkbenchIcon name="chevron" size={14} />
      </button> : null}
      {app === "writing" && mode === "normal" ? <div ref={onWritingLibraryPortalTargetChange} className="module-context__writing-library-portal" /> : null}
      {mode === "ai-work" ? <SecondaryNavigation ariaLabel="工作台入口导航" className="module-context__application-navigation" groups={applicationNavigationGroups} activateOnArrow /> : null}
      {gameLibrary && app === "workspace" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="游戏服务菜单">
        <div className="module-context__section-title"><span>游戏服务</span></div>
        {([ ["/games", "服务总览"], ["/games/environments", "运行环境"], ["/games/minecraft", "Minecraft 服务端"], ["/games/steamcmd", "Steam 游戏服务器"] ] as const).map(([path, label]) => {
          const active = path === "/games" ? section === "library" : path.endsWith("/environments") && section === "environments";
          return <button type="button" key={path} className={`module-context__menu-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => onNavigate(path)}><span aria-hidden="true" />{label}</button>;
        })}
      </nav> : null}
      {app === "steamcmd" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="Steam 游戏服务器菜单">
        <div className="module-context__section-title"><span>Steam 游戏服务器</span></div>
        <button type="button" className={`module-context__menu-item${section === "overview" ? " is-active" : ""}`} aria-current={section === "overview" ? "page" : undefined} onClick={() => onNavigate("/games/steamcmd")}><span aria-hidden="true" />服务器工作区</button>
        <button type="button" className="module-context__menu-item" onClick={() => onOpenGameFiles?.("steamcmd")}><span aria-hidden="true" />文件管理</button>
      </nav> : null}
      {app === "minecraft" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="Minecraft 工作区菜单">
        <div className="module-context__section-title"><span>Minecraft 工作区</span></div>
        <div className="module-context__menu-tabs" role="group" aria-label="Minecraft 工作区分类">
          <button type="button" aria-pressed={minecraftMenuCategory === "monitor"} onClick={() => onNavigate("/games/minecraft/overview")}>监控</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "management"} onClick={() => onNavigate("/games/minecraft/instances")}>管理</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "environment"} onClick={() => onNavigate("/games/minecraft/java")}>环境</button>
        </div>
        {(minecraftMenuCategory === "monitor"
          ? [["overview", "总览"], ["nodes", "控制节点"]]
          : minecraftMenuCategory === "management"
            ? [["deployment", "部署"], ["instances", "实例"], ["tasks", "任务"], ["workflows", "工作流"], ["files", "文件管理"], ["logs", "日志"]]
            : [["java", "Java 环境"]]
        ).map(([key, label]) => {
          const active = key === "logs" ? minecraftLogsSection : section === key || key === "instances" && minecraftInstanceSection;
          return <button type="button" key={key} className={`module-context__menu-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => key === "files" ? onOpenGameFiles?.("minecraft") : onNavigate(`/games/minecraft/${key}`)}><span aria-hidden="true" />{label}</button>;
        })}
      </nav> : null}
      {app === "connectivity" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="联机管理菜单">
        <div className="module-context__section-title"><span>联机管理</span></div>
        {[ ["overview", "总览"], ["room-domain", "房间域名"], ["self-managed", "自备穿透"], ["providers", "穿透 Provider"], ["plugins", "组网与扩展"] ].map(([key, label]) => <button type="button" key={key} className={`module-context__menu-item${section === key ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => onNavigate(`/apps/connectivity/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
      </nav> : null}
    </div>
  </section>;
}
