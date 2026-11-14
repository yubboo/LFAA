/**
 * 文件：ApplicationCenterWorkspace.tsx
 * 功能：渲染工作区中心标题栏与聊天、画布、领域工作区内容。
 * 作用：只组合已有领域 UI 和 Owner 回调，不持有其业务数据与执行规则。
 * 关联文件：../../ApplicationWorkspace.tsx、./ApplicationChatSurface.tsx、../hooks/*。
 */
import { Suspense, type ReactNode } from "react";
import { Alert, Button, Popover, Segmented, Tag, Typography } from "antd";
import { hasAdminAccess, type ApplicationId, type ApplicationMode } from "lfaa-client-connection/src/api.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { PanelControl } from "./PanelControl.js";
import { WorkbenchHeader } from "lfaa-client-ui-primitives/src/WorkbenchHeader.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { ApplicationContentLoading, CanvasWorkspace, MinecraftWorkflowCanvas, ApplicationWorkflowCanvas, MinecraftWorkspace, ConnectivityWorkspace, WritingWorkspace, AiVideoCanvasWorkspace } from "./workspace-lazy-modules.js";
import type { ApplicationWorkspaceProps } from "../types.js";
import type { useCanvasWorkspaceContext } from "../hooks/useCanvasWorkspaceContext.js";
import type { useGitWorkspace } from "../hooks/useGitWorkspace.js";
import type { useMinecraftWorkspaceContext } from "../hooks/useMinecraftWorkspaceContext.js";
import type { useWorkspaceUtilityTabs } from "../hooks/useWorkspaceUtilityTabs.js";
import type { useWorkbenchChrome } from "../hooks/useWorkbenchChrome.js";
import type { useWritingWorkspace } from "../hooks/useWritingWorkspace.js";

type CenterModeState = {
  activeApplicationTitle: string;
  modeLabel: string;
  writingNormal: boolean;
  aiVideoNormal: boolean;
  terminalPanelAvailable: boolean;
  activeChatSessionTitle: string;
  chatAppId: string;
  applicationModeScopeId: string | null;
  modeSwitchAppId: string | null;
  statusLabel: string;
  gitManagerAvailable: boolean;
  showCenterPanelControls: boolean;
  gitSummaryContent: ReactNode;
  writingLibraryPortalTarget: HTMLDivElement | null;
};

interface ApplicationCenterWorkspaceProps {
  workspace: ApplicationWorkspaceProps;
  chrome: ReturnType<typeof useWorkbenchChrome>;
  utility: ReturnType<typeof useWorkspaceUtilityTabs>;
  canvas: ReturnType<typeof useCanvasWorkspaceContext>;
  minecraft: ReturnType<typeof useMinecraftWorkspaceContext>;
  writing: ReturnType<typeof useWritingWorkspace>;
  git: ReturnType<typeof useGitWorkspace>;
  state: CenterModeState;
  openApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  navigateWithinApplication: (path: string) => void;
  renderAiWorkChatContent: (workspaceHeader?: ReactNode) => ReactNode;
  toggleRight: () => void;
  toggleTerminal: () => void;
}

export function ApplicationCenterWorkspace({ workspace, chrome: chromeWorkspace, utility, canvas, minecraft, writing, git, state, openApplication, navigateWithinApplication, renderAiWorkChatContent, toggleRight, toggleTerminal }: ApplicationCenterWorkspaceProps) {
  const { userId, app, mode, section, applicationContent, canvasWorkspace, role, serverState, settings, onSettingsChange, onOpenSettings, onNavigate, aiDraft, onAiDraftChange } = workspace;
  const { metrics, shortcuts, chrome, setChrome, leftPreviewTriggerRef, leftPreviewOpen, openLeftPreview, closeLeftPreview } = chromeWorkspace;
  const { activeApplicationTitle, modeLabel, writingNormal, aiVideoNormal, terminalPanelAvailable, activeChatSessionTitle, chatAppId, applicationModeScopeId, modeSwitchAppId, statusLabel, gitManagerAvailable, showCenterPanelControls, gitSummaryContent, writingLibraryPortalTarget } = state;
  const { aiWorkView } = utility;
  const { activeCanvasProjectId, canvasAgentChange, canvasChatOpen, setCanvasChatOpen, setCanvasChatOpenOverride, onCanvasProjectContextChange, onWorkflowContextChange, onApplicationProjectContextChange } = canvas;
  const { setContentReady, onRuntimeContextChange } = minecraft;
  const { workspace: writingData, setWorkspace: setWritingWorkspace, loading: writingLoading, error: writingError, retry: retryWritingWorkspace, registerFlush } = writing;
  const { visibleStatus, gitSummaryText, summaryOpen: gitSummaryOpen, handleSummaryOpenChange: handleGitSummaryOpenChange, openGitManager } = git;
  const moduleContentScroll = useScrollRestoration(
    mode === "ai-work" ? "" : createScrollRestorationKey(userId, "module-page", app, mode, section),
    minecraft.contentReady,
  );
  const canOpenSystemFiles = role === "super_admin" && settings.permissions.mode === "full_access";

  const centerHeader = (
    <WorkbenchHeader className="module-center__header" layoutMode={metrics.mode} moduleMode={mode}>
      <div className="lfaa-workbench-header__leading module-center__heading" data-workbench-header-slot="leading">
        <button ref={leftPreviewTriggerRef} className="module-shell-icon-button module-shell-icon-button--left-preview lfaa-workbench-header__toggle" type="button" aria-label={mode === "normal" ? "切换当前应用功能菜单" : "切换会话与项目栏"} aria-expanded={!chrome.leftCollapsed || leftPreviewOpen} aria-keyshortcuts={shortcuts.toggleSidebar.map(chord => chord.replace("Ctrl", "Control")).join(" ")} title={`${mode === "normal" ? "切换当前应用功能菜单" : "切换会话与项目栏"} · ${shortcuts.toggleSidebar.join(" / ") || "未分配"}`} onClick={chromeWorkspace.toggleLeft} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) openLeftPreview(); }} onBlur={closeLeftPreview}><WorkbenchIcon name="panelLeft" size={16} /></button>
        <div className={`lfaa-workbench-header__title module-center__title${mode === "ai-work" ? " module-center__title--chat" : ""}`} title={mode === "ai-work" ? activeChatSessionTitle?.trim() || "小鱼智能体" : activeApplicationTitle}><WorkbenchIcon name={mode === "normal" ? "folder" : "spark"} size={16} /><strong>{mode === "ai-work" ? activeChatSessionTitle?.trim() || "小鱼智能体" : activeApplicationTitle}</strong></div>
      </div>
      {modeSwitchAppId && section !== "voice" ? <div className="lfaa-workbench-header__center module-center__mode-switch-slot" data-workbench-header-slot="center"><Segmented
        className="module-center__mode-switch"
        size="small"
        aria-label={applicationModeScopeId ? "当前应用工作模式" : "聊天与画布工作模式"}
        value={canvasWorkspace ? "canvas" : mode === "normal" ? "manual" : "chat"}
        options={[{ label: <span className="module-center__mode-option" title="聊天"><WorkbenchIcon name="chat" size={16} /><span className="module-center__mode-option-accessible-name">聊天</span></span>, value: "chat" }, { label: <span className="module-center__mode-option" title="画布"><WorkbenchIcon name="grid" size={16} /><span className="module-center__mode-option-accessible-name">画布</span></span>, value: "canvas" }, ...(applicationModeScopeId && applicationModeScopeId !== "workspace" ? [{ label: <span className="module-center__mode-option" title="手动"><WorkbenchIcon name="new" size={16} /><span className="module-center__mode-option-accessible-name">手动</span></span>, value: "manual" }] : [])]}
        onChange={value => {
          if (value === "chat") void openApplication(modeSwitchAppId as ApplicationId, "ai-work");
          else if (value === "canvas") {
            if (mode === "ai-work") setCanvasChatOpenOverride(userId, modeSwitchAppId, true);
            onNavigate(`/apps/${encodeURIComponent(modeSwitchAppId)}/canvas${activeCanvasProjectId ? `/${encodeURIComponent(activeCanvasProjectId)}` : ""}`);
          }
          else if (value === "manual" && applicationModeScopeId) void openApplication(applicationModeScopeId as ApplicationId, "normal");
        }}
      /></div> : null}
      <div className="lfaa-workbench-header__actions module-center__actions" data-workbench-header-slot="actions">
        {app === "workspace" && mode === "ai-work" && section !== "voice" ? <Button className="module-center__voice-button" type="text" size="small" aria-label="语音主脑" title="语音主脑" icon={<WorkbenchIcon name="microphone" size={15} />} onClick={() => onNavigate("/voice")}>语音主脑</Button> : null}
        {settings.general.showServiceStatus ? <span className={`module-runtime-state${serverState === "online" ? " is-connected" : ""}`} role="img" aria-label={statusLabel} title={statusLabel}><i aria-hidden="true" />{statusLabel}</span> : null}
        {gitManagerAvailable ? <div className="module-center__work-tabs" aria-label="Agent Git">
          <button type="button" aria-label={`当前 Agent 的 Git 变更：${gitSummaryText}`} aria-pressed={aiWorkView === "git"} className={aiWorkView === "git" ? "is-active" : ""} onClick={() => openGitManager()} title={`当前 Agent 的 Git 变更：${gitSummaryText}`}>
            <WorkbenchIcon name="branch" size={14} />变更{visibleStatus.status && visibleStatus.status.repositoryState !== "not-repository" ? <span>+{visibleStatus.status.insertions} −{visibleStatus.status.deletions}</span> : null}
          </button>
          {metrics.mode === "mobile" ? <Button className="module-git-summary-trigger" type="text" aria-label="在左侧打开 Git 摘要" title="Git 摘要" aria-haspopup="dialog" aria-expanded={gitSummaryOpen} aria-controls="module-sidebar-git-summary" onClick={() => {
            const open = !gitSummaryOpen;
            if (open) setChrome(current => ({ ...current, leftCollapsed: false, rightCollapsed: true }));
            handleGitSummaryOpenChange(open);
          }}><WorkbenchIcon name="summary" size={17} /></Button> : <Popover
            arrow={false}
            content={gitSummaryContent}
            getPopupContainer={trigger => trigger.closest(".module-center") ?? document.body}
            onOpenChange={handleGitSummaryOpenChange}
            open={gitSummaryOpen}
            overlayClassName="module-git-summary-popover"
            placement="bottomRight"
            trigger="click"
          >
            <Button className="module-git-summary-trigger" type="text" aria-label="打开 Git 摘要" title="Git 摘要" aria-haspopup="dialog" aria-expanded={gitSummaryOpen}><WorkbenchIcon name="summary" size={17} /></Button>
          </Popover>}
        </div> : null}
        {terminalPanelAvailable && settings.general.showBottomPanelControl && showCenterPanelControls ? <PanelControl name="terminal" title="底部终端" shortcut={shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
        {canvasWorkspace ? <PanelControl name="panelRight" title={canvasChatOpen ? "收起小鱼会话" : chrome.rightCollapsed ? "展开上下文栏" : "展开小鱼会话"} shortcut={shortcuts.toggleContextPanel.join(" / ")} active={canvasChatOpen || !chrome.rightCollapsed} onClick={() => {
          if (canvasChatOpen) setCanvasChatOpen(false);
          else if (chrome.rightCollapsed) setChrome(current => ({ ...current, rightCollapsed: false }));
          else setCanvasChatOpen(true);
        }} /> : (mode === "ai-work" ? showCenterPanelControls : chrome.rightCollapsed) ? <PanelControl name="panelRight" title={chrome.rightCollapsed ? "展开上下文栏" : "收起上下文栏"} shortcut={shortcuts.toggleContextPanel.join(" / ")} active={!chrome.rightCollapsed} onClick={toggleRight} /> : null}
      </div>
    </WorkbenchHeader>
  );

  const center = (
    <div className="module-center">
      {mode === "ai-work" && !canvasWorkspace ? null : centerHeader}
      <main ref={moduleContentScroll.ref} onScroll={moduleContentScroll.onScroll} className={`module-center__content${mode === "ai-work" ? " module-center__content--ai-work" : ""}${canvasWorkspace ? " module-center__content--canvas" : ""}${mode === "normal" && !writingNormal && !aiVideoNormal ? " module-center__content--application" : ""}${writingNormal ? " module-center__content--writing-normal" : ""}${aiVideoNormal ? " module-center__content--aivideo" : ""}`} aria-label={canvasWorkspace ? "应用共享画布工作区" : mode === "ai-work" ? chatAppId === "workspace" ? "小鱼智能体对话" : `${activeApplicationTitle}聊天` : writingNormal ? "写作正文编辑区" : aiVideoNormal ? "AI 漫剧手动工作区" : undefined} aria-labelledby={applicationContent ? "game-library-heading" : mode === "normal" && app !== "minecraft" && !writingNormal && !aiVideoNormal ? "module-heading" : undefined}>
        {canvasWorkspace ? <Suspense fallback={<ApplicationContentLoading />}>
          <CanvasWorkspace
            applicationId={canvasWorkspace.applicationId}
            initialProjectId={canvasWorkspace.initialProjectId}
            agentChangesRevision={canvasAgentChange.revision}
            agentChangedProjectId={canvasAgentChange.projectId}
            agentPanelOpen={canvasChatOpen}
            settings={settings}
            applications={canvasWorkspace.applications}
            onNavigate={navigateWithinApplication}
            onOpenSettings={onOpenSettings}
            onOpenAgentChat={() => setCanvasChatOpen(true)}
            onProjectContextChange={onCanvasProjectContextChange}
            applicationWorkflowPanel={canvasWorkspace.applicationId === "aivideo" ? undefined : visible => canvasWorkspace.applicationId === "minecraft"
              ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkflowCanvas userId={userId} visible={visible} onWorkflowContextChange={onWorkflowContextChange} /></Suspense>
              : <Suspense fallback={<ApplicationContentLoading />}><ApplicationWorkflowCanvas applicationId={canvasWorkspace.applicationId} userId={userId} visible={visible} onWorkflowContextChange={onWorkflowContextChange} /></Suspense>}
          />
        </Suspense> : mode === "ai-work" ? renderAiWorkChatContent(centerHeader) : applicationContent ? applicationContent : app === "minecraft" ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkspace onPrepareWithAi={prompt => { onAiDraftChange(aiDraft.trim() ? `${aiDraft}\n\n${prompt}` : prompt); void openApplication("minecraft", "ai-work"); }} userId={userId} section={section} role={role} settings={settings} onNavigate={navigateWithinApplication} onOpenConnectivity={() => { void openApplication("connectivity", "normal"); }} onContentReady={setContentReady} onInstanceRuntimeContextChange={onRuntimeContextChange} /></Suspense> : app === "connectivity" && mode === "normal" ? <Suspense fallback={<ApplicationContentLoading />}><ConnectivityWorkspace section={section} isAdmin={hasAdminAccess(role)} /></Suspense> : writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingWorkspace settings={settings} onSettingsChange={onSettingsChange} workspace={writingData} loading={writingLoading} loadError={writingError} libraryPortalTarget={writingLibraryPortalTarget} onRetry={() => { void retryWritingWorkspace(); }} onWorkspaceChange={setWritingWorkspace} onRegisterFlush={registerFlush} /></Suspense> : aiVideoNormal ? <Suspense fallback={<ApplicationContentLoading />}><AiVideoCanvasWorkspace canOpenFileManager={canOpenSystemFiles} onOpenFileManager={projectId => { setFileManagerLocation(userId, `.lfaa-library/aivideo-projects/${projectId}`); onNavigate("/files"); }} onOpenSharedCanvas={projectId => onNavigate(`/apps/aivideo/canvas/${encodeURIComponent(projectId)}`)} onProjectContextChange={onApplicationProjectContextChange} /></Suspense> : <>
          <div className={`module-heading module-heading--workspace module-heading--${app}`}>
            <div className="module-heading__labels"><Tag className="development-tag">开发中</Tag><Tag className="module-mode-tag">{modeLabel}</Tag></div>
            <Typography.Title id="module-heading" level={2}>{activeApplicationTitle}</Typography.Title>
            <Typography.Paragraph>{modeLabel} · 应用工作区</Typography.Paragraph>
          </div>
          {workspace.error ? <Alert className="page-alert" type="error" showIcon message={workspace.error} /> : null}
          <section className="module-notice-card" aria-label="模块状态">
            <span className="module-notice-card__icon" aria-hidden="true"><WorkbenchIcon name="spark" size={19} /></span>
            <div><Typography.Title level={4}>这个入口尚未连接业务能力</Typography.Title><Typography.Paragraph>常规模式的游戏安装、主机文件操作和作品存储需要对应业务模块与 Daemon 节点；小鱼智能体 对话已接入独立的模型 Runtime。</Typography.Paragraph></div>
          </section>
          <div className="module-content-placeholder"><span className="module-content-placeholder__dot" aria-hidden="true" /><span>业务面板接入后会显示在这里。</span></div>
        </>}
      </main>
    </div>
  );

  return center;
}
