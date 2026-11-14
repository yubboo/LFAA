/**
 * 文件：ApplicationChatSurface.tsx
 * 功能：装配 AI Work 与领域 App 的共享聊天内容。
 * 作用：把工作区目标与已有 Session、Provider、Capability、Canvas、Git Owner 传给唯一 AiWorkChat。
 * 关联文件：../../ApplicationWorkspace.tsx、./workspace-lazy-modules.ts、packages/client/ui-chat。
 */
import { Suspense, type ReactNode } from "react";
import { Alert } from "antd";
import type { AiWorkbenchView, ApplicationId } from "lfaa-client-connection/src/api.js";
import { AiWorkChat, ApplicationContentLoading } from "./workspace-lazy-modules.js";
import type { ApplicationWorkspaceProps } from "../types.js";
import type { useWorkspaceCapabilities } from "../hooks/useWorkspaceCapabilities.js";
import type { useWorkspaceSessionsAndProjects } from "../hooks/useWorkspaceSessionsAndProjects.js";
import type { useWorkspaceUtilityTabs } from "../hooks/useWorkspaceUtilityTabs.js";
import type { useWritingWorkspace } from "../hooks/useWritingWorkspace.js";
import type { useCanvasWorkspaceContext } from "../hooks/useCanvasWorkspaceContext.js";
import type { useGitWorkspace } from "../hooks/useGitWorkspace.js";

interface ApplicationChatSurfaceProps {
  workspace: ApplicationWorkspaceProps;
  appId: ApplicationId;
  sessionId: string | null;
  projectDirectoryMissing: boolean;
  workspaceView: AiWorkbenchView;
  workspaceHeader?: ReactNode;
  capabilities: ReturnType<typeof useWorkspaceCapabilities>;
  sessions: ReturnType<typeof useWorkspaceSessionsAndProjects>;
  utility: ReturnType<typeof useWorkspaceUtilityTabs>;
  writing: ReturnType<typeof useWritingWorkspace>;
  canvas: ReturnType<typeof useCanvasWorkspaceContext>;
  git: ReturnType<typeof useGitWorkspace>;
  onProviderStatusChange: (status: string | null) => void;
}

export function ApplicationChatSurface({ workspace, appId, sessionId, projectDirectoryMissing, workspaceView, workspaceHeader, capabilities, sessions, utility, writing, canvas, git, onProviderStatusChange }: ApplicationChatSurfaceProps) {
  const { userId, settings, onSettingsChange, workContextApplicationId, canvasWorkspace, aiDraft, aiWorkGoal, onAiWorkGoalConsumed, onActiveAiSessionChange, onAiDraftChange, onOpenSettings, onNotification, onNavigate, section } = workspace;
  const availableCapabilities = [
    ...capabilities.registeredExtensions.filter(item => ["skill", "prompt", "expert"].includes(item.kind)
      && (item.kind !== "skill" || !settings.plugins.disabledSkillNames.includes(item.id.startsWith("skill.") ? item.id.slice("skill.".length).split(".").at(-1) ?? item.id : item.id))),
    ...capabilities.skillReferences.filter(skill => !settings.plugins.disabledSkillNames.includes(skill.name)),
  ];

  return <>
    {workspace.error ? <Alert className="page-alert" type="error" showIcon message={workspace.error} /> : null}
    <div className="module-ai-work-chat">
      <Suspense fallback={workspaceHeader ? <div className="module-ai-work-chat__loading">{workspaceHeader}<ApplicationContentLoading /></div> : <ApplicationContentLoading />}>
        <AiWorkChat
          workspaceHeader={workspaceHeader}
          userId={userId}
          capabilities={availableCapabilities}
          capabilitiesError={capabilities.skillReferencesError}
          appId={appId}
          contextApplicationId={canvasWorkspace && canvasWorkspace.applicationId !== "workspace" ? canvasWorkspace.applicationId : workContextApplicationId}
          workspaceView={workspaceView}
          settings={settings}
          onSettingsChange={onSettingsChange}
          sessions={sessions.sessions}
          activeSessionId={sessionId}
          projectDirectoryMissing={projectDirectoryMissing}
          newSessionProjectId={sessions.newAiSessionProjectId}
          defaultWorkspaceProjectId={sessions.defaultWorkspaceProjectId}
          newSessionGitRepositoryId={null}
          workspaceProjects={sessions.workspaceProjects}
          workspaceProjectsLoadStatus={sessions.workspaceProjectsLoadStatus}
          workspaceProjectsTruncated={sessions.workspaceProjectsTruncated}
          workspaceNodes={sessions.workspaceNodes}
          workspaceProjectsError={sessions.workspaceProjectsError}
          onRetryWorkspaceProjects={sessions.retryWorkspaceProjects}
          onWorkspaceProjectCreated={sessions.handleWorkspaceProjectCreated}
          onWorkspaceProjectsChange={sessions.onWorkspaceProjectsChange}
          initialDraft={aiDraft}
          autoSubmitGoal={canvasWorkspace ? null : aiWorkGoal}
          onAutoSubmitGoalConsumed={onAiWorkGoalConsumed}
          newSessionKey={sessions.newAiSessionKey}
          onSessionsChange={nextSessions => sessions.updateSessions(() => nextSessions)}
          onSessionChange={sessions.updateKnownSession}
          onActiveSessionChange={onActiveAiSessionChange}
          onDraftChange={onAiDraftChange}
          onProviderStatusChange={onProviderStatusChange}
          onBusyChange={git.onAiChatBusyChange}
          onSelectedProjectChange={sessions.setNewAiSessionProjectId}
          onOpenSettings={onOpenSettings}
          onNotification={onNotification}
          onOpenSideChat={utility.openSideChat}
          onWritingWorkspaceChange={writing.setWorkspace}
          onOpenProjectFile={utility.openProjectFile}
          onSessionFileChanges={git.onSessionFileChanges}
          onBrowserToolCompleted={utility.openBrowserDockForAgent}
          onCanvasToolsCompleted={canvas.onCanvasToolsCompleted}
          onOpenApplicationCanvas={canvasWorkspace ? () => {
            const canvasApplicationId = canvasWorkspace.applicationId;
            onNavigate(`/apps/${encodeURIComponent(canvasApplicationId)}/canvas${canvas.activeCanvasProjectId ? `/${encodeURIComponent(canvas.activeCanvasProjectId)}` : ""}`);
          } : undefined}
          voiceMode={section === "voice"}
          onExitVoice={() => onNavigate("/work")}
        />
      </Suspense>
    </div>
  </>;
}
