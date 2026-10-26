/**
 * 文件：GlobalNavigationRail.tsx
 * 功能：提供应用工作区、文件页和设置中心共用的全局导航轨。
 * 作用：统一首页、应用菜单、最近 小鱼智能体 会话、工具、设置、快捷键、账户状态与退出登录入口；最近会话展开共享工作区 Dock，不持有会话列表副本。
 * 关联文件：packages/client/ui-sidebar/src/GlobalNavigationRail.css、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.tsx、packages/client/connection/src/api.ts、packages/client/resources/src/notification-runtime.ts。
 */
import { useEffect, useRef, useState } from "react";
import { userRoleLabel, type UserRole, type UserSettings } from "lfaa-client-connection/src/api.js";
import type { ApplicationId, ApplicationNavigationId } from "lfaa-util-values/src/application-id.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./GlobalNavigationRail.css";

export const GLOBAL_NAVIGATION_RAIL_WIDTH = 64;
export const GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH = 48;

export interface ApplicationNavigationItem {
  id: ApplicationNavigationId;
  title: string;
  description?: string;
  route?: string;
  applicationId?: ApplicationId;
}

interface NavigationFeatureItem {
  id: string;
  title: string;
  description: string;
  icon: WorkbenchIconName;
  active: boolean;
  onSelect: () => void;
}

interface NavigationFeatureGroup {
  title: string;
  items: NavigationFeatureItem[];
}

interface GlobalNavigationRailProps {
  className?: string;
  username: string;
  role: UserRole;
  serverState: ServiceState;
  shortcuts: UserSettings["shortcuts"];
  activePage: "home" | "files" | "plugins" | "settings" | "canvas" | "office";
  homeLabel: string;
  applications: ApplicationNavigationItem[];
  navigationApplications?: ApplicationNavigationItem[];
  onOpenRecentSessions: () => void;
  showServiceStatus: boolean;
  onHome: () => void;
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenFiles: () => void;
  onOpenCanvas?: () => void;
  onOpenWork?: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleTools?: () => void;
  applicationsExpanded?: boolean;
  applicationsTargetId?: string;
  onToggleApplications?: () => void;
}

export function GlobalNavigationRail({ className, username, role, serverState, shortcuts, activePage, homeLabel, applications, navigationApplications = applications, onOpenRecentSessions, showServiceStatus, onHome, onNavigate, onOpenApplication, onOpenFiles, onOpenCanvas, onOpenWork, onOpenSettings, onLogout, onToggleTools, applicationsExpanded = false, applicationsTargetId = "module-sidebar-applications", onToggleApplications }: GlobalNavigationRailProps) {
  const [openPopover, setOpenPopover] = useState<"applications" | "menu" | "shortcuts" | "profile" | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const railRef = useRef<HTMLElement>(null);

  const toggleApplications = () => {
    if (onToggleApplications) {
      setOpenPopover(null);
      onToggleApplications();
      return;
    }
    setOpenPopover(current => current === "applications" ? null : "applications");
  };

  useEffect(() => {
    if (!openPopover) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !railRef.current?.contains(event.target)) setOpenPopover(null);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPopover(null);
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("keydown", dismissEscape);
    };
  }, [openPopover]);

  const featureGroups: NavigationFeatureGroup[] = [
    {
      title: "工作区",
      items: [
        { id: "office", title: "AI 员工办公室", description: "查看员工任务与待命状态", icon: "summary", active: activePage === "office", onSelect: () => onNavigate("/agent-office") },
        { id: "files", title: "文件管理", description: "浏览当前账户可访问的文件", icon: "folder", active: activePage === "files", onSelect: onOpenFiles },
        { id: "canvas", title: "无限画布", description: "打开工作区画布", icon: "grid", active: activePage === "canvas", onSelect: () => { if (onOpenCanvas) onOpenCanvas(); else onNavigate("/canvas"); } },
      ],
    },
    {
      title: "管理与工具",
      items: [
        { id: "plugins", title: "插件管理", description: "查看已接入的扩展能力", icon: "extension", active: activePage === "plugins", onSelect: () => onNavigate("/plugin-manager") },
        ...(onToggleTools ? [{ id: "tools", title: "工具与资源", description: "打开当前工作区的上下文工具", icon: "tools" as const, active: false, onSelect: () => onToggleTools() }] : []),
      ],
    },
  ];
  const normalizedMenuSearch = menuSearch.trim().toLocaleLowerCase();
  const visibleFeatureGroups = featureGroups
    .map(group => ({ ...group, items: group.items.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase().includes(normalizedMenuSearch)) }))
    .filter(group => group.items.length > 0);
  const featurePageActive = activePage === "office" || activePage === "files" || activePage === "canvas" || activePage === "plugins";

  return (
    <nav className={`module-navigation-rail${className ? ` ${className}` : ""}`} aria-label="LFAA 主导航" ref={railRef}>
      <div className="module-navigation-rail__top" role="group" aria-label="顶部入口">
        <button className={`module-navigation-rail__button${activePage === "home" ? " is-active" : ""}`} type="button" aria-label={homeLabel} aria-current={activePage === "home" ? "page" : undefined} title={homeLabel} onClick={() => { setOpenPopover(null); onHome(); }}><WorkbenchIcon name="home" size={19} /></button>
      </div>
      <div className="module-navigation-rail__primary" role="group" aria-label="中部导航">
        <button className={`module-navigation-rail__button${(onToggleApplications ? applicationsExpanded : openPopover === "applications") ? " is-active" : ""}`} type="button" aria-label="应用" title="应用" aria-haspopup={onToggleApplications ? undefined : "dialog"} aria-expanded={onToggleApplications ? applicationsExpanded : openPopover === "applications"} aria-controls={onToggleApplications ? applicationsTargetId : openPopover === "applications" ? "module-navigation-rail-applications" : undefined} onClick={toggleApplications}><WorkbenchIcon name="grid" size={19} /></button>
        {onOpenWork ? <button className="module-navigation-rail__button" type="button" aria-label="工作 · 小鱼智能体" title="工作 · 小鱼智能体" onClick={() => { setOpenPopover(null); onOpenWork(); }}><WorkbenchIcon name="spark" size={19} /></button> : null}
        <button className="module-navigation-rail__button" type="button" aria-label="最近会话" title="最近会话" aria-expanded={applicationsExpanded} aria-controls={applicationsExpanded ? "module-sidebar-applications" : undefined} onClick={() => {
          setOpenPopover(null);
          onOpenRecentSessions();
        }}><WorkbenchIcon name="history" size={19} /></button>
        <button className={`module-navigation-rail__button${activePage === "settings" ? " is-active" : ""}`} type="button" aria-label="设置中心" aria-current={activePage === "settings" ? "page" : undefined} title="设置中心" aria-keyshortcuts="Control+, Meta+," onClick={() => { setOpenPopover(null); onOpenSettings(); }}><WorkbenchIcon name="settings" size={19} /></button>
      </div>
      <div className="module-navigation-rail__footer" role="group" aria-label="底部辅助区">
        {!onToggleApplications && openPopover === "applications" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--applications" id="module-navigation-rail-applications" role="dialog" aria-label="应用">
          <header><div><strong>应用</strong><span>打开专业工作区</span></div><button type="button" aria-label="关闭应用菜单" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <div className="module-navigation-rail__application-list">
            {navigationApplications.length === 0 ? <div className="module-navigation-rail__application-empty"><span>暂无显示中的应用</span><button type="button" onClick={() => { setOpenPopover(null); onOpenSettings(); }}>前往设置</button></div> : navigationApplications.map(application => <button key={application.id} type="button" onClick={() => {
              setOpenPopover(null);
              if (application.route) onNavigate(application.route);
              else if (application.applicationId) void onOpenApplication(application.applicationId, "normal").catch(() => undefined);
            }}>
              <span><strong>{application.title}</strong>{application.description ? <small>{application.description}</small> : null}</span>
              <WorkbenchIcon name="chevron" size={14} />
            </button>)}
          </div>
        </section> : null}
        {openPopover === "menu" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--features" id="module-navigation-rail-features" role="dialog" aria-label="更多功能">
          <header><div><strong>更多功能</strong><span>搜索或浏览其他工作区</span></div><button type="button" aria-label="关闭更多功能" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <label className="module-navigation-rail__feature-search"><WorkbenchIcon name="search" size={16} /><input type="search" value={menuSearch} onChange={event => setMenuSearch(event.currentTarget.value)} placeholder="搜索功能" aria-label="搜索功能" autoComplete="off" /></label>
          <div className="module-navigation-rail__feature-list">
            {visibleFeatureGroups.length === 0 ? <div className="module-navigation-rail__feature-empty"><span>没有匹配的功能</span><button type="button" onClick={() => setMenuSearch("")}>清空搜索</button></div> : visibleFeatureGroups.map(group => <section key={group.title} className="module-navigation-rail__feature-group" aria-label={group.title}>
              <h3>{group.title}</h3>
              {group.items.map(item => <button key={item.id} type="button" aria-current={item.active ? "page" : undefined} className={item.active ? "is-active" : ""} onClick={() => { setOpenPopover(null); item.onSelect(); }}>
                <WorkbenchIcon name={item.icon} size={17} />
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
              </button>)}
            </section>)}
          </div>
        </section> : null}
        {openPopover === "shortcuts" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--shortcuts" role="dialog" aria-label="工作台键盘快捷键">
          <header><strong>键盘快捷键</strong><button type="button" aria-label="关闭快捷键列表" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <dl>
            {activePage === "home" ? <>
              <div><dt>切换应用导航</dt><dd><kbd>{shortcuts.toggleSidebar.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>切换工具与资源</dt><dd><kbd>{shortcuts.toggleContextPanel.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>切换底部面板</dt><dd><kbd>{shortcuts.toggleBottomPanel.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>打开终端面板</dt><dd><kbd>{shortcuts.openTerminal.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>应用</dt><dd><kbd>{shortcuts.switchNormalMode.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>小鱼智能体</dt><dd><kbd>{shortcuts.switchAiWorkMode.join(" / ") || "未分配"}</kbd></dd></div>
            </> : <>
              <div><dt>首页</dt><dd><kbd>{shortcuts.openHome.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>SteamCMD</dt><dd><kbd>{shortcuts.openSteamcmd.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>Minecraft</dt><dd><kbd>{shortcuts.openMinecraft.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>写作空间</dt><dd><kbd>{shortcuts.openWriting.join(" / ") || "未分配"}</kbd></dd></div>
            </>}
          </dl>
        </section> : null}
        <div className="module-navigation-rail__footer-actions" role="group" aria-label="快捷入口">
          <button className={`module-navigation-rail__button${openPopover === "shortcuts" ? " is-active" : ""}`} type="button" aria-label="键盘快捷键" title="键盘快捷键" aria-expanded={openPopover === "shortcuts"} onClick={() => setOpenPopover((current) => current === "shortcuts" ? null : "shortcuts")}><WorkbenchIcon name="keyboard" size={18} /></button>
          <button className={`module-navigation-rail__button${openPopover === "menu" || featurePageActive ? " is-active" : ""}`} type="button" aria-label="更多功能" title="更多功能" aria-haspopup="dialog" aria-expanded={openPopover === "menu"} aria-controls={openPopover === "menu" ? "module-navigation-rail-features" : undefined} aria-current={featurePageActive ? "page" : undefined} onClick={() => { setMenuSearch(""); setOpenPopover(current => current === "menu" ? null : "menu"); }}><WorkbenchIcon name="dots" size={19} /></button>
        </div>
        {showServiceStatus ? <div className="module-navigation-rail__status-box"><span className={`module-navigation-rail__status module-navigation-rail__status--${serverState}`} title={serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接"} /></div> : null}
        {openPopover === "profile" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--profile" role="dialog" aria-label="个人账户">
          <header><div><strong>{username}</strong><span>{userRoleLabel(role)}</span></div><button type="button" aria-label="关闭个人账户" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <div className="module-navigation-rail__popover-actions">
            <button type="button" onClick={() => { setOpenPopover(null); onOpenSettings(); }}><WorkbenchIcon name="settings" size={16} /><span>设置中心</span></button>
            <button type="button" onClick={() => { setOpenPopover(null); onLogout(); }}><WorkbenchIcon name="user" size={16} /><span>退出登录</span></button>
          </div>
        </section> : null}
        <div className="module-navigation-rail__profile">
          <button className="module-navigation-rail__avatar" type="button" aria-label={`个人中心：${username}`} title={`个人中心：${username}`} aria-expanded={openPopover === "profile"} onClick={() => setOpenPopover((current) => current === "profile" ? null : "profile")}>{username.slice(0, 1).toLocaleUpperCase()}</button>
        </div>
      </div>
    </nav>
  );
}
