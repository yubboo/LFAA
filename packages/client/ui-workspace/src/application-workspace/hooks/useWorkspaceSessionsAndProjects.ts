/**
 * 文件：useWorkspaceSessionsAndProjects.ts
 * 功能：装配侧栏所需的 AI Session 与 Workspace Project 状态和动作。
 * 作用：调用 Session/Workspace API 并管理请求取消、分页和选择；不取代任一数据 Owner。
 * 关联文件：../../ApplicationWorkspace.tsx、../types.ts、Session/Workspace Connection Owners。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  archiveAiSession,
  getErrorMessage,
  initializeDefaultWorkspace,
  loadAiSessions,
  loadWorkspaceProjects,
  loadWorkspaceSessionDirectoryAvailability,
  renameAiSession,
  type AiSession,
  type ApplicationId,
  type WorkspaceDaemonNode,
  type WorkspaceProject,
  type WorkspaceProjectApplicationId,
} from "lfaa-client-connection/src/api.js";
import { MAX_PINNED_AI_SESSIONS, readPinnedAiSessionIds, writePinnedAiSessionIds } from "lfaa-client-store/src/ai-session-pins.js";

const aiSessionSnapshots = new Map<string, AiSession[]>();
const workspaceProjectSnapshots = new Map<string, { projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }>();
const initializedDefaultWorkspaceUsers = new Set<string>();
const emptySessionDirectoryIds: ReadonlySet<string> = new Set();

export interface UseWorkspaceSessionsAndProjectsOptions {
  userId: string;
  app: ApplicationId;
  mode: "normal" | "ai-work";
  voiceMode: boolean;
  workspaceProjectAppId: WorkspaceProjectApplicationId | null;
  chatSessionAppId: ApplicationId;
  activeSessionId: string | null;
  onActiveSessionChange: (sessionId: string | null) => void;
  onSessionsContextReset?: () => void;
}

export function useWorkspaceSessionsAndProjects({ userId, app, mode, voiceMode, workspaceProjectAppId, chatSessionAppId, activeSessionId, onActiveSessionChange, onSessionsContextReset }: UseWorkspaceSessionsAndProjectsOptions) {
  const [sessionsState, setSessionsState] = useState(() => ({ userId, sessions: aiSessionSnapshots.get(userId) ?? [] }));
  const sessions = sessionsState.userId === userId ? sessionsState.sessions : aiSessionSnapshots.get(userId) ?? [];
  const [sessionsLoading, setSessionsLoading] = useState(() => mode === "ai-work" && !aiSessionSnapshots.has(userId));
  const [sessionsError, setSessionsError] = useState("");
  const sessionsRequestRef = useRef<{ userId: string; controller: AbortController } | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const activeSessionChangeRef = useRef(onActiveSessionChange);
  activeSessionChangeRef.current = onActiveSessionChange;

  const [pinnedSessionState, setPinnedSessionState] = useState(() => ({ userId, ids: readPinnedAiSessionIds(userId) }));
  const pinnedSessionIds = pinnedSessionState.userId === userId ? pinnedSessionState.ids : [];
  const [recentSessionsExpandRequestId, setRecentSessionsExpandRequestId] = useState(0);
  const [newSessionKey, setNewSessionKey] = useState(0);
  const [newSessionProjectId, setNewSessionProjectId] = useState<string | null>(null);
  const [sessionDirectoryCheckRequest, setSessionDirectoryCheckRequest] = useState<{ sessionId: string; requestId: number } | null>(null);
  const sessionDirectoryCheckSequence = useRef(0);
  const sessionDirectoryBindings = useMemo(() => sessions.filter(session => !session.archived && session.projectId).slice(0, 200).map(session => [session.id, session.projectId] as [string, string | null]).sort(([firstId], [secondId]) => firstId.localeCompare(secondId)), [sessions]);
  const sessionDirectorySignature = useMemo(() => JSON.stringify(sessionDirectoryBindings), [sessionDirectoryBindings]);

  const projectsScopeKey = `${userId}:${workspaceProjectAppId ?? app}`;
  const [projects, setProjects] = useState<WorkspaceProject[]>(() => workspaceProjectSnapshots.get(projectsScopeKey)?.projects ?? []);
  const [projectsDataScope, setProjectsDataScope] = useState(projectsScopeKey);
  const [workspaceNodes, setWorkspaceNodes] = useState<WorkspaceDaemonNode[]>(() => workspaceProjectSnapshots.get(projectsScopeKey)?.nodes ?? []);
  const [projectsTruncated, setProjectsTruncated] = useState(() => workspaceProjectSnapshots.get(projectsScopeKey)?.truncated ?? false);
  const [defaultWorkspaceProjectId, setDefaultWorkspaceProjectId] = useState<string | null>(() => workspaceProjectSnapshots.get(projectsScopeKey)?.defaultProjectId ?? null);
  const [projectsLoadStatus, setProjectsLoadStatus] = useState<"loading" | "ready" | "error">(() => workspaceProjectSnapshots.has(projectsScopeKey) ? "ready" : "loading");
  const [projectsError, setProjectsError] = useState("");
  const [projectsRevision, setProjectsRevision] = useState(0);
  const [missingSessionDirectoryState, setMissingSessionDirectoryState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: "", ids: new Set() });
  const projectDirectorySignature = useMemo(() => {
    const sessionProjectIds = new Set(sessionDirectoryBindings.map(([, projectId]) => projectId));
    return JSON.stringify(projects.filter(project => sessionProjectIds.has(project.id)).map(project => [project.id, project.nodeId, project.sources.map(source => source.path), project.path]).sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId))));
  }, [projects, sessionDirectoryBindings]);
  const missingSessionDirectoryKey = `${userId}:${app}:${projectsRevision}:${sessionDirectorySignature}:${projectDirectorySignature}`;
  const missingSessionDirectoryIds = missingSessionDirectoryState.key === missingSessionDirectoryKey ? missingSessionDirectoryState.ids : emptySessionDirectoryIds;

  const updateSessions = useCallback((update: (current: AiSession[]) => AiSession[]) => {
    const pendingRequest = sessionsRequestRef.current;
    if (pendingRequest) {
      pendingRequest.controller.abort();
      sessionsRequestRef.current = null;
    }
    setSessionsState(currentState => {
      const current = currentState.userId === userId ? currentState.sessions : aiSessionSnapshots.get(userId) ?? [];
      const next = update(current);
      aiSessionSnapshots.set(userId, next);
      return { userId, sessions: next };
    });
    setSessionsLoading(false);
    setSessionsError("");
  }, [userId]);

  const rememberSession = useCallback((session: AiSession) => {
    updateSessions(current => [session, ...current.filter(item => item.id !== session.id)]);
  }, [updateSessions]);

  const updateKnownSession = useCallback((session: AiSession) => {
    updateSessions(current => {
      const index = current.findIndex(item => item.id === session.id);
      if (index < 0) return [session, ...current];
      return current.map(item => item.id === session.id ? session : item);
    });
  }, [updateSessions]);

  const refreshSessions = useCallback(() => {
    if (mode !== "ai-work") return;
    const pendingRequest = sessionsRequestRef.current;
    if (pendingRequest?.userId === userId && !pendingRequest.controller.signal.aborted) return;
    pendingRequest?.controller.abort();
    const controller = new AbortController();
    const request = { userId, controller };
    sessionsRequestRef.current = request;
    setSessionsLoading(true);
    setSessionsError("");
    void loadAiSessions({ appId: chatSessionAppId, signal: controller.signal }).then(({ sessions: loadedSessions }) => {
      if (controller.signal.aborted || sessionsRequestRef.current !== request) return;
      aiSessionSnapshots.set(userId, loadedSessions);
      setSessionsState({ userId, sessions: loadedSessions });
      const currentActiveSessionId = activeSessionIdRef.current;
      if (currentActiveSessionId && !loadedSessions.some(session => session.id === currentActiveSessionId && !session.archived)) activeSessionChangeRef.current(null);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted && sessionsRequestRef.current === request) setSessionsError(getErrorMessage(loadError));
    }).finally(() => {
      if (sessionsRequestRef.current === request) {
        sessionsRequestRef.current = null;
        setSessionsLoading(false);
      }
    });
  }, [chatSessionAppId, mode, userId]);

  const retryProjects = useCallback(() => setProjectsRevision(revision => revision + 1), []);
  const handleProjectCreated = useCallback(() => {
    setProjectsRevision(revision => revision + 1);
    refreshSessions();
  }, [refreshSessions]);

  const togglePinnedSession = useCallback((sessionId: string) => {
    setPinnedSessionState(current => {
      const ids = current.userId === userId ? current.ids : readPinnedAiSessionIds(userId);
      const nextIds = ids.includes(sessionId) ? ids.filter(id => id !== sessionId) : [sessionId, ...ids].slice(0, MAX_PINNED_AI_SESSIONS);
      return { userId, ids: nextIds };
    });
  }, [userId]);

  const requestRecentSessions = useCallback(() => setRecentSessionsExpandRequestId(current => current + 1), []);
  const startNewSession = useCallback((projectId?: string) => {
    onActiveSessionChange(null);
    setNewSessionProjectId(projectId ?? null);
    setNewSessionKey(current => current + 1);
    setSessionsError("");
  }, [onActiveSessionChange]);
  const selectSession = useCallback((sessionId: string) => {
    onActiveSessionChange(sessionId);
    setNewSessionProjectId(null);
    setSessionsError("");
    setSessionDirectoryCheckRequest({ sessionId, requestId: ++sessionDirectoryCheckSequence.current });
  }, [onActiveSessionChange]);
  const archiveSession = useCallback(async (session: AiSession) => {
    try {
      await archiveAiSession(session.id, true);
      updateSessions(current => current.filter(item => item.id !== session.id));
      if (activeSessionId === session.id) onActiveSessionChange(null);
    } catch (archiveError: unknown) {
      setSessionsError(getErrorMessage(archiveError));
    }
  }, [activeSessionId, onActiveSessionChange, updateSessions]);
  const renameSession = useCallback(async (sessionId: string, title: string) => {
    const { session } = await renameAiSession(sessionId, title);
    updateKnownSession(session);
    return session;
  }, [updateKnownSession]);
  const onProjectsChange = useCallback((nextProjects: WorkspaceProject[]) => {
    const truncated = projectsTruncated || nextProjects.length > 200;
    workspaceProjectSnapshots.set(projectsScopeKey, { projects: nextProjects.slice(0, 200), nodes: workspaceNodes, truncated, defaultProjectId: defaultWorkspaceProjectId });
    setProjects(nextProjects.slice(0, 200));
    setProjectsTruncated(truncated);
  }, [defaultWorkspaceProjectId, projectsScopeKey, projectsTruncated, workspaceNodes]);

  useEffect(() => {
    if (pinnedSessionState.userId !== userId) {
      setPinnedSessionState({ userId, ids: readPinnedAiSessionIds(userId) });
      return;
    }
    writePinnedAiSessionIds(userId, pinnedSessionState.ids);
  }, [pinnedSessionState, userId]);

  useEffect(() => {
    onSessionsContextReset?.();
    setSessionsError("");
    if (mode !== "ai-work") {
      setSessionsLoading(false);
      return;
    }
    const cachedSessions = aiSessionSnapshots.get(userId);
    setSessionsState({ userId, sessions: cachedSessions ?? [] });
    setSessionsLoading(cachedSessions === undefined);
    refreshSessions();
    return () => {
      const pendingRequest = sessionsRequestRef.current;
      if (pendingRequest?.userId === userId) {
        pendingRequest.controller.abort();
        sessionsRequestRef.current = null;
      }
    };
  }, [mode, onSessionsContextReset, refreshSessions, userId]);

  useEffect(() => {
    const cacheKey = projectsScopeKey;
    if (!workspaceProjectAppId) {
      setProjects([]);
      setWorkspaceNodes([]);
      setProjectsTruncated(false);
      setDefaultWorkspaceProjectId(null);
      setProjectsError("");
      setProjectsDataScope(cacheKey);
      setProjectsLoadStatus("ready");
      setNewSessionProjectId(null);
      return;
    }
    const cached = workspaceProjectSnapshots.get(cacheKey);
    setProjects(cached?.projects ?? []);
    setProjectsDataScope(cacheKey);
    setWorkspaceNodes(cached?.nodes ?? []);
    setProjectsTruncated(cached?.truncated ?? false);
    setDefaultWorkspaceProjectId(cached?.defaultProjectId ?? null);
    setProjectsError("");
    setProjectsLoadStatus(cached ? "ready" : "loading");
    if (mode !== "ai-work") return;
    const controller = new AbortController();
    let projectLoadSequence = 0;
    let initializationError = "";
    const refreshProjects = async () => {
      const sequence = ++projectLoadSequence;
      try {
        const { projects: loadedProjects, nodes, truncated, defaultProjectId } = await loadWorkspaceProjects({ appId: workspaceProjectAppId, signal: controller.signal });
        if (controller.signal.aborted || sequence !== projectLoadSequence) return;
        workspaceProjectSnapshots.set(cacheKey, { projects: loadedProjects, nodes, truncated, defaultProjectId });
        setProjects(loadedProjects);
        setProjectsDataScope(cacheKey);
        setWorkspaceNodes(nodes);
        setProjectsTruncated(truncated);
        setDefaultWorkspaceProjectId(defaultProjectId ?? null);
        setProjectsLoadStatus("ready");
        setProjectsError(initializationError);
      } catch (projectError) {
        if (!controller.signal.aborted && sequence === projectLoadSequence) {
          setProjectsLoadStatus("error");
          setProjectsError(initializationError || getErrorMessage(projectError));
        }
      }
    };
    void refreshProjects();
    if (workspaceProjectAppId === "workspace" && !voiceMode && !initializedDefaultWorkspaceUsers.has(userId)) {
      void initializeDefaultWorkspace(controller.signal).then(() => {
        if (controller.signal.aborted) return;
        initializedDefaultWorkspaceUsers.add(userId);
        if (initializedDefaultWorkspaceUsers.size > 8) {
          const oldestUserId = initializedDefaultWorkspaceUsers.values().next().value;
          if (oldestUserId) initializedDefaultWorkspaceUsers.delete(oldestUserId);
        }
        return refreshProjects();
      }).catch(projectError => {
        if (controller.signal.aborted) return;
        initializationError = `默认工作区初始化失败：${getErrorMessage(projectError)}`;
        setProjectsError(initializationError);
      });
    }
    return () => controller.abort();
  }, [app, mode, projectsRevision, projectsScopeKey, userId, voiceMode, workspaceProjectAppId]);

  useEffect(() => {
    const key = missingSessionDirectoryKey;
    if (mode !== "ai-work") {
      setMissingSessionDirectoryState({ key, ids: new Set() });
      return;
    }
    const sessionId = sessionDirectoryCheckRequest?.sessionId;
    if (sessionsLoading || !sessionId || sessionId !== activeSessionId) return;
    const hasProjectBinding = (JSON.parse(sessionDirectorySignature) as Array<[string, string | null]>).some(([id, projectId]) => id === sessionId && projectId !== null);
    if (!hasProjectBinding) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadWorkspaceSessionDirectoryAvailability([sessionId], controller.signal).then(({ sessions: directorySessions }) => {
        if (controller.signal.aborted) return;
        const status = directorySessions[sessionId] ?? "unknown";
        setMissingSessionDirectoryState(current => {
          const ids = new Set(current.key === key ? current.ids : []);
          if (status === "missing") ids.add(sessionId);
          else if (status === "available") ids.delete(sessionId);
          return { key, ids };
        });
      }).catch(() => {
        // 未知状态不标记为目录缺失；聊天与历史内容不等待后台目录检查。
      });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeSessionId, app, missingSessionDirectoryKey, mode, sessionDirectoryCheckRequest?.requestId, sessionDirectoryCheckRequest?.sessionId, sessionDirectorySignature, sessionsLoading]);

  return {
    sessions,
    sessionsLoading,
    sessionsError,
    setSessionsError,
    sessionsDataReady: !sessionsLoading && sessionsState.userId === userId,
    updateSessions,
    rememberSession,
    updateKnownSession,
    refreshSessions,
    workspaceProjects: projects,
    workspaceProjectsDataScope: projectsDataScope,
    workspaceProjectsReady: projectsLoadStatus === "ready" && projectsDataScope === projectsScopeKey,
    workspaceNodes,
    workspaceProjectsTruncated: projectsTruncated,
    defaultWorkspaceProjectId,
    workspaceProjectsLoadStatus: projectsLoadStatus,
    workspaceProjectsError: projectsError,
    workspaceProjectsRevision: projectsRevision,
    retryWorkspaceProjects: retryProjects,
    handleWorkspaceProjectCreated: handleProjectCreated,
    onWorkspaceProjectsChange: onProjectsChange,
    missingSessionDirectoryIds,
    pinnedSessionIds,
    togglePinnedSession,
    recentSessionsExpandRequestId,
    requestRecentSessions,
    newAiSessionKey: newSessionKey,
    newAiSessionProjectId: newSessionProjectId,
    setNewAiSessionProjectId: setNewSessionProjectId,
    startNewAiSession: startNewSession,
    selectSession,
    archiveSession,
    renameSession,
  };
}
