/**
 * 文件：ApplicationSidebar.tsx
 * 功能：组合左侧应用导航、通知入口与会话/项目子面板。
 * 作用：维护侧栏外壳和通知弹层；业务状态由相邻子模块及对应 Owner 提供。
 * 关联文件：./ApplicationSidebarSessions.tsx、./ApplicationNavigationPanel.tsx、./sidebar-types.ts、../../css/secondary-navigation.css。
 */
import { useEffect, useState } from "react";
import { Popover } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { ApplicationNavigationPanel } from "./ApplicationNavigationPanel.js";
import { ApplicationSidebarSessions } from "./ApplicationSidebarSessions.js";
import type { ApplicationSidebarProps } from "./sidebar-types.js";
export type { ApplicationSidebarProps } from "./sidebar-types.js";
export function ApplicationSidebar(props: ApplicationSidebarProps) {
  const { userId, app, mode, section, gameLibrary, workspaceTitle, apps, applicationNavigationItems, layoutMode, onWritingLibraryPortalTargetChange, onNavigate, onOpenApplication, onOpenSelectedApplication, onOpenGameFiles, onToggleLeft, notifications, onMarkNotificationsRead, onClearNotifications, onOpenNotification, onCloseGitSummary, onPreviewMouseLeave, onPreviewBlur } = props;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const nextMode = mode === "normal" ? "ai-work" : "normal";
  const nextModeLabel = nextMode === "normal" ? "应用" : "工作";
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  useEffect(() => {
    if (!notificationsOpen) return;
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", dismissEscape);
    return () => window.removeEventListener("keydown", dismissEscape);
  }, [notificationsOpen]);

  return (
    <div className="module-sidebar" data-ui="left-sidebar" data-layout-mode={layoutMode} onMouseLeave={onPreviewMouseLeave} onBlur={onPreviewBlur}>
      <header className="module-sidebar__brand-row">
        <button className="module-sidebar__brand" type="button" onClick={() => { if (mode === "ai-work") void onOpenSelectedApplication(); else void onOpenApplication("workspace", "ai-work"); }} aria-label={app === "workspace" ? "切换到上次使用的应用" : `切换到${nextModeLabel}`} title={app === "workspace" ? "切换到上次使用的应用" : `切换到${nextModeLabel}`}>
          <span className="module-sidebar__brand-mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="module-sidebar__brand-actions">
          <Popover
            arrow={false}
            content={<section className="module-sidebar__notifications" id="module-sidebar-notifications" role="dialog" aria-labelledby="module-sidebar-notifications-title">
              <header>
                <div><strong id="module-sidebar-notifications-title">通知</strong><span>小鱼会话提醒</span></div>
                <button type="button" disabled={!notifications.length} onClick={onClearNotifications}>清空</button>
              </header>
              {notifications.length ? <div className="module-sidebar__notification-list" aria-live="polite">
                {notifications.map((notification) => <button className={`module-sidebar__notification${notification.read ? " is-read" : ""}`} key={notification.id} type="button" aria-label={`${notification.applicationName}：${notification.title}，点击查看会话`} onClick={() => { setNotificationsOpen(false); onOpenNotification(notification); }}>
                  <span className="module-sidebar__notification-dot" aria-hidden="true" />
                  <div><strong>{notification.applicationName} · {notification.title}</strong><span>{notification.body}</span></div>
                  <time dateTime={new Date(notification.createdAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(notification.createdAt)}</time>
                </button>)}
              </div> : <div className="module-sidebar__notification-empty"><WorkbenchIcon name="bell" size={20} /><strong>暂无通知</strong><span>回复完成、审批待处理或会话失败时会显示在这里。</span></div>}
            </section>}
            getPopupContainer={(trigger) => trigger.closest(".workbench-shell") ?? document.body}
            onOpenChange={(open) => {
              if (open) onMarkNotificationsRead();
              setNotificationsOpen(open);
            }}
            open={notificationsOpen}
            overlayClassName="module-sidebar-notification-overlay"
            placement="bottomLeft"
            trigger="click"
          >
            <button className={`module-icon-button module-icon-button--notifications${unreadNotifications ? " has-unread" : ""}`} type="button" aria-label={unreadNotifications ? `通知，${unreadNotifications} 条未读` : "通知"} title="通知" aria-haspopup="dialog" aria-expanded={notificationsOpen} aria-controls="module-sidebar-notifications">
              <WorkbenchIcon name="bell" size={16} />
              {unreadNotifications ? <span className="module-sidebar__notification-badge" aria-hidden="true">{unreadNotifications}</span> : null}
            </button>
          </Popover>
          <button className="module-icon-button module-sidebar__close" type="button" aria-label="收起应用导航" title="收起应用导航" onClick={() => { setNotificationsOpen(false); onCloseGitSummary(); onToggleLeft(); }}><WorkbenchIcon name="close" size={16} /></button>
        </div>
      </header>
      {mode === "normal" ? <ApplicationNavigationPanel
        userId={userId}
        app={app}
        mode={mode}
        section={section}
        gameLibrary={gameLibrary}
        workspaceTitle={workspaceTitle}
        apps={apps}
        applicationNavigationItems={applicationNavigationItems}
        onNavigate={onNavigate}
        onOpenApplication={onOpenApplication}
        onOpenGameFiles={app === "minecraft" || app === "steamcmd" ? onOpenGameFiles : undefined}
        onWritingLibraryPortalTargetChange={onWritingLibraryPortalTargetChange}
        hidden={false}
      /> : null}
      <ApplicationSidebarSessions {...props} />
      <div className="module-sidebar__footer">
        <span>当前区域</span>
        <strong>{mode === "normal" ? "应用面板" : "智能体工作区"}</strong>
      </div>

    </div>
  );
}

