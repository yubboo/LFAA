// 渲染四栏 Shell 中央工作区：顶部栏、插件视图、项目视图、欢迎页与功能占位页。
import { WORKBENCH_REGIONS } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { WorkspaceMode } from "../navigation/navigation";
import { resolveViewLabel } from "../navigation/workbench-domains";
import type { WorkbenchSnapshot } from "../workbench-service";
import { WorkspaceBar } from "./WorkspaceBar";
import styles from "./WorkbenchShell.module.css";

/** 按工作台快照装配中央列；标题与占位内容只依赖传入的展示状态。 */
export function ShellWorkspace({
  snapshot,
  locale,
  view,
  mode,
  workspaceNotice,
  isCompact,
  isRightMaximized,
  hasRightColumn,
  hasWorkbenchHost,
  leftDragCollapsed,
  rightDragCollapsed,
  onToggleLeft,
  onToggleRight,
  showRightToggleAlways = false,
}: {
  snapshot: WorkbenchSnapshot;
  locale: LocaleMessages;
  /** 中央列要呈现的视图；设置弹窗打开时仍传入背景视图，使工作区停在原页面。 */
  view?: string;
  mode: WorkspaceMode;
  workspaceNotice: string;
  isCompact: boolean;
  isRightMaximized: boolean;
  hasRightColumn: boolean;
  hasWorkbenchHost: boolean;
  leftDragCollapsed: boolean;
  rightDragCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
/** 右侧收起/展开按钮是否常显：「预览区在左」时会话列在最右，需要始终可见。 */
  showRightToggleAlways?: boolean;
}) {
  const { activeView, activeProjectId, activeChatSessionId, leftSidebarOpen, rightPanelOpen, projects, views, chatSessions, projectProvider, workspaceActions, titleActions } = snapshot;
  // 「预览区在左」下分屏才算展开：预览列收起时那枚开关应显示「展开」，点它先把分屏补回来。
  const rightExpanded = snapshot.layoutMode === "preview-center"
    ? rightPanelOpen && snapshot.previewPaneOpen
    : rightPanelOpen;
  // 设置弹窗打开时 activeView 指向设置页，中央列改按背景视图渲染。
  const shownView = view ?? activeView;
  const registeredView = views.find((entry) => entry.id === shownView);
  const currentProject = projects.find((project) => project.id === activeProjectId);
  const activeChatSession = activeChatSessionId
    ? chatSessions.find((session) => session.id === activeChatSessionId)
    : undefined;
  // 新会话和空会话不显示标题：用户真正开始对话（会话已有消息）后才出现会话名。
  const title = shownView === "project" && currentProject
    ? currentProject.name
    : shownView === "workspace"
      ? (activeChatSession && activeChatSession.messageCount > 0 ? activeChatSession.title : "")
      : resolveViewLabel(shownView, locale, registeredView?.title);

  return (
    <main className={styles.workspace} data-region={WORKBENCH_REGIONS[2]} data-pane="right">
      <WorkspaceBar
        locale={locale}
        title={title}
        leftOpen={leftSidebarOpen}
        leftDragCollapsed={leftDragCollapsed}
        hasRightColumn={hasRightColumn}
        rightOpen={rightExpanded}
        hideRightToggleWhenOpen={showRightToggleAlways ? false : hasWorkbenchHost}
        rightDragCollapsed={rightDragCollapsed}
        compact={isCompact}
        rightPanelMaximized={isRightMaximized}
        titleActions={titleActions}
        workspaceActions={workspaceActions}
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
      />

      {/* 顶栏固定在滚动区之外，页面内容只在下方内容区滚动，滚动条不会压住标题栏。 */}
      <div className={styles.workspaceViewport}>
        {registeredView ? (
          registeredView.render()
        ) : shownView === "project" && currentProject && projectProvider ? (
          <div key={currentProject.id} className={styles.projectViewHost}>
            {workspaceNotice && (
              <p className={styles.projectNotice} role="status">{workspaceNotice}</p>
            )}
            {projectProvider.renderProjectView(currentProject)}
          </div>
        ) : shownView === "project" && projectProvider && !projectProvider.hasLoaded?.() ? (
          <section className={styles.page} aria-busy="true" />
        ) : shownView === "workspace" ? (
          <section className={styles.welcome} aria-labelledby="workspace-title">
            <p className={styles.welcomeLabel}>{mode === "chatgpt" ? locale.chatModeTitle : locale.codexModeTitle}</p>
            <h1 id="workspace-title">{locale.headline}</h1>
            <p className={styles.introduction} role={workspaceNotice ? "status" : undefined}>{workspaceNotice || locale.introduction}</p>
          </section>
        ) : (
          <section className={styles.page} aria-labelledby="feature-title">
            <p className={styles.welcomeLabel}>{locale.localMode}</p>
            <h1 id="feature-title">{title}</h1>
            <p>{locale.featureUnavailable}</p>
          </section>
        )}
      </div>
    </main>
  );
}