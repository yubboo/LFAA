/**
 * 文件：useCanvasWorkspaceContext.ts
 * 功能：维护画布聊天开合以及 Canvas/Workflow/App 项目提示状态。
 * 作用：只提供当前界面的临时提示和回调，项目数据与工具执行继续由 Canvas/领域 Owner 管理。
 * 关联文件：../../ApplicationWorkspace.tsx、../components/ApplicationCenterWorkspace.tsx、Canvas Owner。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiWorkbenchView, ApplicationId, UserSettings } from "lfaa-client-connection/src/api.js";

const canvasChatOpenByApplication = new Map<string, boolean>();
let canvasChatStateOwnerId: string | null = null;

function getCanvasChatOpenOverride(userId: string, applicationId: string): boolean | undefined {
  if (canvasChatStateOwnerId !== userId) {
    canvasChatOpenByApplication.clear();
    canvasChatStateOwnerId = userId;
  }
  return canvasChatOpenByApplication.get(applicationId);
}

function setCanvasChatOpenOverride(userId: string, applicationId: string, open: boolean): void {
  if (canvasChatStateOwnerId !== userId) {
    canvasChatOpenByApplication.clear();
    canvasChatStateOwnerId = userId;
  }
  if (!canvasChatOpenByApplication.has(applicationId) && canvasChatOpenByApplication.size >= 32) {
    const oldestApplicationId = canvasChatOpenByApplication.keys().next().value;
    if (oldestApplicationId) canvasChatOpenByApplication.delete(oldestApplicationId);
  }
  canvasChatOpenByApplication.set(applicationId, open);
}

export function useCanvasWorkspaceContext(userId: string, app: ApplicationId, chatAppId: ApplicationId, canvasApplicationId: ApplicationId | undefined, settings: UserSettings) {
  const currentApplicationId = canvasApplicationId ?? app;
  const [canvasChatOpen, setCanvasChatOpenState] = useState(() => getCanvasChatOpenOverride(userId, currentApplicationId) ?? settings.canvas.agentPanelDefaultOpen);
  const contextRef = useRef({ userId, applicationId: currentApplicationId, isCanvas: Boolean(canvasApplicationId), defaultOpen: settings.canvas.agentPanelDefaultOpen });
  const [agentCanvasContext, setAgentCanvasContext] = useState<{ canvas: AiWorkbenchView["canvas"]; workflow: AiWorkbenchView["workflow"] }>({ canvas: undefined, workflow: undefined });
  const [applicationProjectContextState, setApplicationProjectContextState] = useState<{ userId: string; project: AiWorkbenchView["applicationProject"] }>({ userId, project: undefined });
  const [canvasAgentChange, setCanvasAgentChange] = useState<{ revision: number; projectId: string | null }>({ revision: 0, projectId: null });

  const setCanvasChatOpen = useCallback((open: boolean) => {
    if (canvasApplicationId) setCanvasChatOpenOverride(userId, canvasApplicationId, open);
    setCanvasChatOpenState(open);
  }, [canvasApplicationId, userId]);

  useEffect(() => {
    const previous = contextRef.current;
    const isCanvas = Boolean(canvasApplicationId);
    const applicationId = canvasApplicationId ?? chatAppId;
    const ownerChanged = previous.userId !== userId;
    const applicationChanged = previous.applicationId !== applicationId || ownerChanged;
    const enteredCanvas = isCanvas && !previous.isCanvas;
    const defaultChanged = previous.defaultOpen !== settings.canvas.agentPanelDefaultOpen;
    if (canvasApplicationId) {
      const explicitState = getCanvasChatOpenOverride(userId, canvasApplicationId);
      if (applicationChanged || enteredCanvas) setCanvasChatOpenState(explicitState ?? settings.canvas.agentPanelDefaultOpen);
      else if (defaultChanged && explicitState === undefined) setCanvasChatOpenState(settings.canvas.agentPanelDefaultOpen);
    }
    contextRef.current = { userId, applicationId, isCanvas, defaultOpen: settings.canvas.agentPanelDefaultOpen };
  }, [app, chatAppId, canvasApplicationId, settings.canvas.agentPanelDefaultOpen, userId]);

  const applicationProjectContext = applicationProjectContextState.userId === userId ? applicationProjectContextState.project : undefined;
  const onCanvasProjectContextChange = useCallback((project: AiWorkbenchView["canvas"] | null) => {
    setAgentCanvasContext(current => {
      const previous = current.canvas;
      if (previous?.applicationId === project?.applicationId && previous?.projectId === project?.projectId && previous?.title === project?.title && previous?.updatedAt === project?.updatedAt) return current;
      return { ...current, canvas: project ?? undefined };
    });
    if (canvasApplicationId === "aivideo") setApplicationProjectContextState({ userId, project: project ?? undefined });
  }, [canvasApplicationId, userId]);

  const onWorkflowContextChange = useCallback((workflow: AiWorkbenchView["workflow"] | null) => {
    setAgentCanvasContext(current => {
      const previous = current.workflow;
      if (previous?.applicationId === workflow?.applicationId && previous?.workflowId === workflow?.workflowId && previous?.title === workflow?.title && previous?.updatedAt === workflow?.updatedAt) return current;
      return { ...current, workflow: workflow ?? undefined };
    });
  }, []);

  const onApplicationProjectContextChange = useCallback((project: AiWorkbenchView["applicationProject"] | null) => {
    setApplicationProjectContextState({ userId, project: project ?? undefined });
  }, [userId]);

  const onCanvasToolsCompleted = useCallback((projectId?: string) => {
    const applicationId = canvasApplicationId ?? chatAppId;
    const activeCanvas = agentCanvasContext.canvas;
    const activeProjectId = projectId ?? (activeCanvas?.applicationId === applicationId ? activeCanvas.projectId : undefined);
    setCanvasAgentChange(current => ({ revision: current.revision + 1, projectId: activeProjectId ?? null }));
  }, [agentCanvasContext.canvas, canvasApplicationId, chatAppId]);

  const activeCanvasProjectId = useMemo(() => agentCanvasContext.canvas?.applicationId === (canvasApplicationId ?? app)
    ? agentCanvasContext.canvas.projectId
    : (canvasApplicationId ?? (app === "workspace" ? null : app)) === "aivideo" && applicationProjectContext?.applicationId === "aivideo"
      ? applicationProjectContext.projectId
      : null, [agentCanvasContext.canvas, app, applicationProjectContext, canvasApplicationId]);

  return {
    canvasChatOpen,
    setCanvasChatOpen,
    setCanvasChatOpenOverride,
    agentCanvasContext,
    applicationProjectContext,
    canvasAgentChange,
    activeCanvasProjectId,
    onCanvasProjectContextChange,
    onWorkflowContextChange,
    onApplicationProjectContextChange,
    onCanvasToolsCompleted,
  };
}
