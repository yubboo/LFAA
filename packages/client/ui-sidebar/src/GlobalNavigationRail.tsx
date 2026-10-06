/**
 * 文件：GlobalNavigationRail.tsx
 * 功能：提供应用工作区、文件页和设置中心共用的全局导航轨。
 * 作用：统一首页、应用中心、最近 AI Work 会话、工具、设置、快捷键、账户状态与退出登录入口；会话列表从既有 API 读取，打开操作交给工作台处理。
 * 关联文件：packages/client/ui-sidebar/src/GlobalNavigationRail.css、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.tsx、packages/client/connection/src/api.ts、packages/client/resources/src/notification-runtime.ts。
 */
import { useEffect, useRef, useState } from "react";
import { getErrorMessage, loadAiSessions, userRoleLabel, type AiSession, type UserRole, type UserSettings } from "lfaa-client-connection/src/api.js";
import { aiWorkSessionOpenEventName, type AiWorkSessionTarget } from "lfaa-client-resources/src/notification-runtime.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./GlobalNavigationRail.css";

export const GLOBAL_NAVIGATION_RAIL_WIDTH = 64;
export const GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH = 48;

const applicationLabels: Record<AiSession["appId"], string> = {
  workspace: "通用任务",
  steamcmd: "SteamCMD 游戏服务",
  minecraft: "Minecraft 管理",
  connectivity: "LFAA 联机服务",
  writing: "写作空间"
};

function formatSessionUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

interface GlobalNavigationRailProps {
  username: string;
  role: UserRole;
  serverState: ServiceState;
  shortcuts: UserSettings["shortcuts"];
  activePage: "home" | "files" | "settings";
  homeLabel: string;
  onHome: () => void;
  onApplicationsHome: () => void;
  onOpenFiles: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleTools?: () => void;
}

export function GlobalNavigationRail({ username, role, serverState, shortcuts, activePage, homeLabel, onHome, onApplicationsHome, onOpenFiles, onOpenSettings, onLogout, onToggleTools }: GlobalNavigationRailProps) {
  const [openPopover, setOpenPopover] = useState<"menu" | "recent" | "shortcuts" | "profile" | null>(null);
  const [recentSessions, setRecentSessions] = useState<AiSession[]>([]);
  const [recentSessionsLoading, setRecentSessionsLoading] = useState(false);
  const [recentSessionsError, setRecentSessionsError] = useState("");
  const railRef = useRef<HTMLElement>(null);

  const loadRecentSessions = () => {
    setRecentSessionsError("");
    setRecentSessionsLoading(true);
    void loadAiSessions({ archived: false }).then(({ sessions }) => {
      setRecentSessions(sessions.slice(0, 20));
    }).catch((error: unknown) => {
      setRecentSessionsError(getErrorMessage(error));
    }).finally(() => {
      setRecentSessionsLoading(false);
    });
  };

  const openRecentSession = (session: AiSession) => {
    setOpenPopover(null);
    const target: AiWorkSessionTarget = { appId: session.appId, sessionId: session.id };
    window.dispatchEvent(new CustomEvent<AiWorkSessionTarget>(aiWorkSessionOpenEventName, { detail: target }));
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

  return (
    <nav className="module-navigation-rail" aria-label="LFAA 主导航" ref={railRef}>
      <div className="module-navigation-rail__primary">
        <button className={`module-navigation-rail__button${activePage === "home" ? " is-active" : ""}`} type="button" aria-label={homeLabel} aria-current={activePage === "home" ? "page" : undefined} title={homeLabel} onClick={() => { setOpenPopover(null); onHome(); }}><WorkbenchIcon name="home" size={19} /></button>
        {activePage === "home" ? <button className="module-navigation-rail__button" type="button" aria-label="应用中心" title="应用中心" onClick={() => { setOpenPopover(null); onApplicationsHome(); }}><WorkbenchIcon name="grid" size={19} /></button> : null}
        <button className={`module-navigation-rail__button${openPopover === "recent" ? " is-active" : ""}`} type="button" aria-label="最近会话" title="最近会话" aria-haspopup="dialog" aria-expanded={openPopover === "recent"} aria-controls={openPopover === "recent" ? "module-navigation-rail-recent-sessions" : undefined} onClick={() => {
          if (openPopover === "recent") setOpenPopover(null);
          else {
            setOpenPopover("recent");
            loadRecentSessions();
          }
        }}><WorkbenchIcon name="history" size={19} /></button>
        <button className={`module-navigation-rail__button${activePage === "files" ? " is-active" : ""}`} type="button" aria-label="文件管理" aria-current={activePage === "files" ? "page" : undefined} title="文件管理" onClick={() => { setOpenPopover(null); onOpenFiles(); }}><WorkbenchIcon name="folder" size={19} /></button>
        <button className="module-navigation-rail__button" type="button" aria-label="工具与资源" title={onToggleTools ? "工具与资源" : "当前页面没有工具资源栏"} aria-keyshortcuts="Control+Alt+B Meta+Alt+B" disabled={!onToggleTools} onClick={() => { setOpenPopover(null); onToggleTools?.(); }}><WorkbenchIcon name="tools" size={19} /></button>
        <button className={`module-navigation-rail__button${activePage === "settings" ? " is-active" : ""}`} type="button" aria-label="设置中心" aria-current={activePage === "settings" ? "page" : undefined} title="设置中心" aria-keyshortcuts="Control+, Meta+," onClick={() => { setOpenPopover(null); onOpenSettings(); }}><WorkbenchIcon name="settings" size={19} /></button>
      </div>
      <div className="module-navigation-rail__footer">
        {openPopover === "recent" ? <section className={`module-navigation-rail__popover module-navigation-rail__popover--recent module-navigation-rail__popover--recent-${activePage}`} id="module-navigation-rail-recent-sessions" role="dialog" aria-label="最近会话">
          <header><div><strong>最近会话</strong><span>当前账户最近更新的 AI Work 会话</span></div><button type="button" aria-label="关闭最近会话" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          {recentSessionsLoading ? <p className="module-navigation-rail__recent-state" role="status">正在读取最近会话…</p>
            : recentSessionsError ? <div className="module-navigation-rail__recent-state module-navigation-rail__recent-state--error" role="alert"><span>读取失败：{recentSessionsError}</span><button type="button" onClick={loadRecentSessions}>重试</button></div>
              : recentSessions.length ? <div className="module-navigation-rail__recent-list">
                {recentSessions.map((session) => {
                  const updatedAt = formatSessionUpdatedAt(session.updatedAt);
                  return <button className="module-navigation-rail__recent-item" key={session.id} type="button" title={`${applicationLabels[session.appId]} · ${session.title}`} aria-label={`${applicationLabels[session.appId]}：${session.title}，${updatedAt}，打开会话`} onClick={() => openRecentSession(session)}>
                    <strong>{session.title || "未命名会话"}</strong><span><span>{applicationLabels[session.appId]}</span><time>{updatedAt}</time></span>
                  </button>;
                })}
              </div> : <p className="module-navigation-rail__recent-state">暂无未归档的 AI Work 会话。</p>}
        </section> : null}
        {openPopover === "menu" ? <section className="module-navigation-rail__popover" role="dialog" aria-label="更多入口">
          <header><strong>更多入口</strong><button type="button" aria-label="关闭更多入口" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <div className="module-navigation-rail__popover-actions">
            <button type="button" onClick={() => { setOpenPopover(null); onApplicationsHome(); }}><WorkbenchIcon name="home" size={16} /><span>应用中心</span></button>
            <button type="button" onClick={() => { setOpenPopover(null); onOpenFiles(); }}><WorkbenchIcon name="folder" size={16} /><span>文件管理</span></button>
            {onToggleTools ? <button type="button" onClick={() => { setOpenPopover(null); onToggleTools(); }}><WorkbenchIcon name="tools" size={16} /><span>工具与资源</span></button> : null}
            <button type="button" onClick={() => setOpenPopover("shortcuts")}><WorkbenchIcon name="keyboard" size={16} /><span>键盘快捷键</span></button>
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
              <div><dt>常规模式</dt><dd><kbd>{shortcuts.switchNormalMode.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>AI Work</dt><dd><kbd>{shortcuts.switchAiWorkMode.join(" / ") || "未分配"}</kbd></dd></div>
            </> : <>
              <div><dt>应用中心</dt><dd><kbd>{shortcuts.openHome.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>SteamCMD</dt><dd><kbd>{shortcuts.openSteamcmd.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>Minecraft</dt><dd><kbd>{shortcuts.openMinecraft.join(" / ") || "未分配"}</kbd></dd></div>
              <div><dt>写作空间</dt><dd><kbd>{shortcuts.openWriting.join(" / ") || "未分配"}</kbd></dd></div>
            </>}
          </dl>
        </section> : null}
        <button className={`module-navigation-rail__button${openPopover === "shortcuts" ? " is-active" : ""}`} type="button" aria-label="键盘快捷键" title="键盘快捷键" aria-expanded={openPopover === "shortcuts"} onClick={() => setOpenPopover((current) => current === "shortcuts" ? null : "shortcuts")}><WorkbenchIcon name="keyboard" size={18} /></button>
        <button className={`module-navigation-rail__button${openPopover === "menu" ? " is-active" : ""}`} type="button" aria-label="更多入口" title="更多入口" aria-expanded={openPopover === "menu"} onClick={() => setOpenPopover((current) => current === "menu" ? null : "menu")}><WorkbenchIcon name="dots" size={19} /></button>
        <span className={`module-navigation-rail__status module-navigation-rail__status--${serverState}`} title={serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接"} />
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
