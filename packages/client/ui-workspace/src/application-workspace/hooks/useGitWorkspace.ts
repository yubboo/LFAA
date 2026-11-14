/**
 * 文件：useGitWorkspace.ts
 * 功能：协调当前 Agent Session 的 Git 摘要、项目仓库和 Host Task 视图状态。
 * 作用：请求取消、事件订阅与回调仍使用 Git/Agent Loop 原 Owner，不复制仓库或任务规则。
 * 关联文件：../../ApplicationWorkspace.tsx、../components/ApplicationGitSummary.tsx、Workspace Git/Host Task Owners。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import {
  cancelAiHostTask,
  ensureAgentGitSessionRepository,
  getErrorMessage,
  loadAgentGitRepositories,
  loadAgentGitStatus,
  loadAiHostTask,
  loadAiHostTasks,
  loadWorkspaceProjectGitSummary,
  registerAgentGitRepository,
  type AgentGitRepository,
  type AiActivityFileChange,
  type AiHostTask,
  type AiSession,
  type ApplicationId,
  type WorkspaceGitStatus,
  type WorkspaceProjectGitSummaryFolder,
} from "lfaa-client-connection/src/api.js";
import { isAiHostTaskActive, sameAiHostTaskSummaries } from "../pure-utils.js";
import type { WorkspaceUtilityTab } from "../types.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";

const emptySessionFileChanges: AiActivityFileChange[] = [];

export interface UseGitWorkspaceOptions {
  userId: string;
  app: ApplicationId;
  mode: "normal" | "ai-work";
  voiceMode: boolean;
  activeSessionId: string | null;
  activeSession: AiSession | null;
  workspaceProjectsRevision: number;
  activeTab: WorkspaceUtilityTab | null;
  activeTabKind: WorkspaceUtilityTab["kind"] | null;
  layoutMode: WorkbenchLayoutMode;
  openWorkspaceUtility: (kind: "git") => void;
}

export function useGitWorkspace({ userId, app, mode, voiceMode, activeSessionId, activeSession, workspaceProjectsRevision, activeTab, activeTabKind, layoutMode, openWorkspaceUtility }: UseGitWorkspaceOptions) {
  const [repositoryState, setRepositoryState] = useState<{ userId: string; repositories: AgentGitRepository[] }>({ userId, repositories: [] });
  const repositories = repositoryState.userId === userId ? repositoryState.repositories : [];
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState("");
  const [sessionGitBinding, setSessionGitBinding] = useState<{ sessionId: string; repositoryId: string | null; loading: boolean }>({ sessionId: "", repositoryId: null, loading: false });
  const [statusSnapshot, setStatusSnapshot] = useState<{ repositoryId: string | null; status: WorkspaceGitStatus | null; loading: boolean; error: string }>({ repositoryId: null, status: null, loading: false, error: "" });
  const [managerRepositoryState, setManagerRepositoryState] = useState<{ userId: string; repositoryId: string | null }>({ userId, repositoryId: null });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryActionFolderKey, setSummaryActionFolderKey] = useState<string | null>(null);
  const [managerActionRequest, setManagerActionRequest] = useState<{ repositoryId: string; action: "commit" | "push" | "branch-create" | "branch-switch"; requestId: number } | null>(null);
  const [summaryFolderState, setSummaryFolderState] = useState<{ userId: string; app: ApplicationId; projectId: string | null; folders: WorkspaceProjectGitSummaryFolder[]; loading: boolean; error: string }>({ userId, app, projectId: null, folders: [], loading: false, error: "" });
  const [sessionFileChangesState, setSessionFileChangesState] = useState<{ sessionId: string | null; changes: AiActivityFileChange[] }>({ sessionId: null, changes: emptySessionFileChanges });
  const [repositoryChangeError, setRepositoryChangeError] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const statusRequestRevision = useRef(0);
  const ensureRequests = useRef(new Map<string, Promise<AgentGitRepository | null>>());
  const managerActionRequestRevision = useRef(0);
  const summaryActionMenuRef = useRef<HTMLDivElement | null>(null);
  const summaryActionTriggerRefs = useRef(new Map<string, HTMLElement>());
  const summaryCacheRef = useRef<{ key: string; revision: number; folders: WorkspaceProjectGitSummaryFolder[] } | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const [hostTasksState, setHostTasksState] = useState<{ userId: string; appId: ApplicationId; tasks: AiHostTask[]; loading: boolean; error: string }>({ userId, appId: app, tasks: [], loading: false, error: "" });
  const [hostTaskDetailState, setHostTaskDetailState] = useState<{ userId: string; taskId: string; task: AiHostTask | null; loading: boolean; error: string }>({ userId, taskId: "", task: null, loading: false, error: "" });
  const [stoppingHostTaskId, setStoppingHostTaskId] = useState<string | null>(null);
  const [hostTaskStopError, setHostTaskStopError] = useState("");
  const aiChatBusyRef = useRef(false);

  const activeSessionGitRepositoryId = activeSessionId && sessionGitBinding.sessionId === activeSessionId ? sessionGitBinding.repositoryId : null;
  const activeSessionAssetRepository = repositories.find(repository => repository.id === activeSessionGitRepositoryId) ?? null;
  const activeSessionAssetRepositoryLoading = Boolean(activeSessionId && (sessionGitBinding.sessionId !== activeSessionId || sessionGitBinding.loading || repositoriesLoading));
  const selectedRepositoryId = managerRepositoryState.userId === userId && managerRepositoryState.repositoryId
    ? managerRepositoryState.repositoryId
    : activeSessionGitRepositoryId;
  const selectedRepository = repositories.find(repository => repository.id === selectedRepositoryId) ?? null;

  const refreshGitStatus = useCallback(async (repository: AgentGitRepository | null): Promise<void> => {
    const revision = ++statusRequestRevision.current;
    if (!repository) { setStatusSnapshot({ repositoryId: null, status: null, loading: false, error: "" }); return; }
    setStatusSnapshot(current => ({ repositoryId: repository.id, status: current.repositoryId === repository.id ? current.status : null, loading: true, error: "" }));
    try {
      const result = await loadAgentGitStatus(repository.id);
      if (statusRequestRevision.current === revision) setStatusSnapshot({ repositoryId: repository.id, status: result.status, loading: false, error: "" });
    } catch (error) {
      if (statusRequestRevision.current === revision) setStatusSnapshot(current => ({ repositoryId: repository.id, status: current.repositoryId === repository.id ? current.status : null, loading: false, error: getErrorMessage(error) }));
    }
  }, []);
  const updateGitStatus = useCallback((repositoryId: string, status: WorkspaceGitStatus) => {
    setStatusSnapshot(current => current.repositoryId === repositoryId ? { repositoryId, status, loading: false, error: "" } : current);
  }, []);
  const ensureSessionGitRepository = useCallback((sessionId: string): Promise<AgentGitRepository | null> => {
    const pending = ensureRequests.current.get(sessionId);
    if (pending) return pending;
    setRepositoryChangeError("");
    setSessionGitBinding({ sessionId, repositoryId: null, loading: true });
    const request = ensureAgentGitSessionRepository(sessionId).then(({ repository }) => {
      if (activeSessionIdRef.current === sessionId) {
        setSessionGitBinding({ sessionId, repositoryId: repository?.id ?? null, loading: false });
        if (repository) {
          setRepositoryState(current => ({ userId, repositories: [repository, ...(current.userId === userId ? current.repositories : []).filter(item => item.id !== repository.id)] }));
          setManagerRepositoryState({ userId, repositoryId: repository.id });
        }
      }
      return repository;
    }).catch(error => {
      if (activeSessionIdRef.current === sessionId) {
        setSessionGitBinding({ sessionId, repositoryId: null, loading: false });
        const expectedBusy = typeof error === "object" && error !== null && "code" in error && error.code === "agent_git_session_busy";
        if (!expectedBusy) setRepositoryChangeError(getErrorMessage(error));
      }
      return null;
    }).finally(() => { if (ensureRequests.current.get(sessionId) === request) ensureRequests.current.delete(sessionId); });
    ensureRequests.current.set(sessionId, request);
    return request;
  }, [userId]);

  useEffect(() => {
    if (mode !== "ai-work" || !summaryOpen) return;
    let disposed = false;
    let requestActive = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let nextDelay = 5_000;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const schedule = (delay = 5_000) => { clearTimer(); if (!disposed && document.visibilityState === "visible") timer = window.setTimeout(() => void refresh(), delay); };
    const refresh = async () => {
      if (disposed || requestActive || document.visibilityState !== "visible") return;
      requestActive = true;
      const current = new AbortController(); controller = current;
      setHostTasksState(previous => previous.userId === userId && previous.appId === app ? previous : { userId, appId: app, tasks: [], loading: true, error: "" });
      try {
        const snapshot = await loadAiHostTasks(current.signal);
        if (!disposed && !current.signal.aborted) {
          const tasks = snapshot.tasks.filter(task => task.appId === app && task.shell !== "project-files" && isAiHostTaskActive(task));
          nextDelay = tasks.length ? 3_000 : 5_000;
          setHostTasksState(previous => previous.userId === userId && previous.appId === app && !previous.loading && !previous.error && sameAiHostTaskSummaries(previous.tasks, tasks) ? previous : { userId, appId: app, tasks, loading: false, error: "" });
        }
      } catch (error) {
        if (!disposed && !current.signal.aborted) {
          const errorMessage = getErrorMessage(error);
          setHostTasksState(previous => previous.userId === userId && previous.appId === app && !previous.loading && previous.error === errorMessage ? previous : { userId, appId: app, tasks: previous.userId === userId && previous.appId === app ? previous.tasks : [], loading: false, error: errorMessage });
          nextDelay = 5_000;
        }
      } finally { if (controller === current) controller = undefined; requestActive = false; if (!disposed) schedule(nextDelay); }
    };
    const onVisibilityChange = () => { clearTimer(); if (document.visibilityState === "hidden") controller?.abort(); else if (!requestActive) void refresh(); };
    void refresh(); document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { disposed = true; clearTimer(); controller?.abort(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [app, mode, summaryOpen, userId]);

  useEffect(() => {
    if (mode !== "ai-work" || activeTabKind !== "agent-host-task" || !activeTab?.hostTaskId) return;
    const taskId = activeTab.hostTaskId;
    let disposed = false; let requestActive = false; let timer: number | undefined; let controller: AbortController | undefined; let nextDelay: number | null = 3_000;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const schedule = (delay = 3_000) => { clearTimer(); if (!disposed && document.visibilityState === "visible") timer = window.setTimeout(() => void refresh(), delay); };
    const refresh = async () => {
      if (disposed || requestActive || document.visibilityState !== "visible") return;
      requestActive = true; const current = new AbortController(); controller = current;
      setHostTaskDetailState(previous => previous.userId === userId && previous.taskId === taskId ? { ...previous, loading: !previous.task, error: "" } : { userId, taskId, task: activeTab.hostTaskSnapshot ?? null, loading: true, error: "" });
      try {
        const { task } = await loadAiHostTask(taskId, current.signal);
        if (!disposed && !current.signal.aborted) {
          setHostTaskDetailState(previous => previous.userId === userId && previous.taskId === taskId && previous.task && sameAiHostTaskSummaries([previous.task], [task]) && previous.task.command === task.command && previous.task.result?.stdout === task.result?.stdout && previous.task.result?.stderr === task.result?.stderr && previous.task.result?.exitCode === task.result?.exitCode && previous.task.result?.outputTruncated === task.result?.outputTruncated ? { ...previous, loading: false, error: "" } : { userId, taskId, task, loading: false, error: "" });
          nextDelay = task.status === "queued" || task.status === "running" ? 3_000 : null;
        }
      } catch (error) { if (!disposed && !current.signal.aborted) { setHostTaskDetailState(previous => ({ ...previous, userId, taskId, loading: false, error: getErrorMessage(error) })); nextDelay = 5_000; } }
      finally { if (controller === current) controller = undefined; requestActive = false; if (!disposed && nextDelay !== null) schedule(nextDelay); }
    };
    const onVisibilityChange = () => { clearTimer(); if (document.visibilityState === "hidden") controller?.abort(); else if (!requestActive) void refresh(); };
    void refresh(); document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { disposed = true; clearTimer(); controller?.abort(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [activeTab?.hostTaskId, activeTab?.hostTaskSnapshot, activeTab?.id, activeTabKind, app, mode, userId]);

  useEffect(() => {
    if (mode !== "ai-work" || activeTabKind !== "git") return;
    const controller = new AbortController(); setRepositoriesLoading(true); setRepositoriesError("");
    void loadAgentGitRepositories(controller.signal).then(({ repositories: loaded }) => setRepositoryState({ userId, repositories: loaded })).catch(error => { if (!controller.signal.aborted) setRepositoriesError(getErrorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setRepositoriesLoading(false); });
    return () => controller.abort();
  }, [activeTabKind, mode, refreshRevision, userId]);
  useEffect(() => {
    if (mode !== "ai-work" || voiceMode || !activeSessionId) setSessionGitBinding({ sessionId: "", repositoryId: null, loading: false });
    else setSessionGitBinding({ sessionId: activeSessionId, repositoryId: null, loading: false });
    setManagerRepositoryState({ userId, repositoryId: null });
  }, [activeSessionId, mode, userId, voiceMode]);
  useEffect(() => {
    if (mode !== "ai-work" || activeTabKind !== "git" || !selectedRepository) { statusRequestRevision.current += 1; setStatusSnapshot({ repositoryId: null, status: null, loading: false, error: "" }); return; }
    void refreshGitStatus(selectedRepository);
    return () => { statusRequestRevision.current += 1; };
  }, [activeTabKind, mode, refreshRevision, refreshGitStatus, selectedRepository?.id]);
  useEffect(() => { summaryCacheRef.current = null; }, [app, userId]);
  useEffect(() => {
    const projectId = app === "workspace" && !voiceMode && activeSession?.appId === "workspace" ? activeSession.projectId ?? null : null;
    if (!summaryOpen) return;
    if (mode !== "ai-work" || !projectId) { setSummaryFolderState({ userId, app, projectId, folders: [], loading: false, error: "" }); return; }
    const key = JSON.stringify([userId, app, projectId, workspaceProjectsRevision]);
    const cached = summaryCacheRef.current;
    if (cached?.key === key && cached.revision === refreshRevision) { setSummaryFolderState({ userId, app, projectId, folders: cached.folders, loading: false, error: "" }); return; }
    const controller = new AbortController(); let active = true;
    setSummaryFolderState(current => ({ userId, app, projectId, folders: current.userId === userId && current.app === app && current.projectId === projectId ? current.folders : [], loading: true, error: "" }));
    const timer = window.setTimeout(() => { void loadWorkspaceProjectGitSummary(projectId, controller.signal).then(({ folders }) => { if (!active) return; summaryCacheRef.current = { key, revision: refreshRevision, folders }; setSummaryFolderState({ userId, app, projectId, folders, loading: false, error: "" }); }).catch(error => { if (active && !controller.signal.aborted) setSummaryFolderState({ userId, app, projectId, folders: [], loading: false, error: getErrorMessage(error) }); }); }, 180);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [activeSession?.appId, activeSession?.projectId, app, mode, refreshRevision, summaryOpen, userId, voiceMode, workspaceProjectsRevision]);

  const handleSummaryOpenChange = useCallback((open: boolean) => { setSummaryOpen(open); if (!open) setSummaryActionFolderKey(null); }, []);
  const onAiChatBusyChange = useCallback((busy: boolean) => { const previous = aiChatBusyRef.current; aiChatBusyRef.current = busy; if (previous && !busy) setRefreshRevision(revision => revision + 1); }, []);
  const onSessionFileChanges = useCallback((sessionId: string | null, changes: AiActivityFileChange[]) => setSessionFileChangesState({ sessionId, changes }), []);
  const currentSessionFileChanges = sessionFileChangesState.sessionId === activeSessionId ? sessionFileChangesState.changes : emptySessionFileChanges;
  const sessionFileSummary = useMemo(() => {
    const writes = new Map<string, AiActivityFileChange>(); const sources = new Map<string, AiActivityFileChange>();
    for (const change of currentSessionFileChanges) { const key = `${change.projectId ?? ""}:${change.path}`; if (change.operation !== "read") writes.set(key, change); else sources.set(key, change); }
    return { outputs: [...writes.values()].filter(change => change.operation === "created" || change.operation === "modified"), sources: [...sources.values()].reverse() };
  }, [currentSessionFileChanges]);
  const stopHostTask = useCallback(async (task: AiHostTask) => {
    setStoppingHostTaskId(task.id); setHostTaskStopError("");
    try {
      const { task: updated } = await cancelAiHostTask(task.id);
      setHostTasksState(current => ({ ...current, tasks: isAiHostTaskActive(updated) ? current.tasks.map(item => item.id === updated.id ? updated : item) : current.tasks.filter(item => item.id !== updated.id) }));
      setHostTaskDetailState(current => current.taskId === updated.id ? { ...current, task: updated, loading: false, error: "" } : current);
    } catch (error) { setHostTaskStopError(`停止后台进程失败：${getErrorMessage(error)}`); }
    finally { setStoppingHostTaskId(current => current === task.id ? null : current); }
  }, []);
  const openGitManager = useCallback((repositoryId?: string, action?: "commit" | "push" | "branch-create" | "branch-switch") => {
    const targetId = repositoryId ?? selectedRepositoryId ?? repositories[0]?.id ?? null;
    if (targetId) setManagerRepositoryState({ userId, repositoryId: targetId });
    setSummaryActionFolderKey(null);
    setManagerActionRequest(action && targetId ? { repositoryId: targetId, action, requestId: ++managerActionRequestRevision.current } : null);
    setSummaryOpen(false); openWorkspaceUtility("git");
    if (!targetId && activeSessionId) void ensureSessionGitRepository(activeSessionId).then(repository => { if (repository && activeSessionIdRef.current === activeSessionId) setManagerRepositoryState({ userId, repositoryId: repository.id }); });
  }, [activeSessionId, ensureSessionGitRepository, openWorkspaceUtility, repositories, selectedRepositoryId, userId]);
  const openGitSummaryFolder = useCallback(async (folder: WorkspaceProjectGitSummaryFolder, action?: "commit" | "push" | "branch-create" | "branch-switch") => {
    const title = folder.path.split(/[\\/]/u).filter(Boolean).at(-1) || folder.path;
    try { const { repository } = await registerAgentGitRepository(folder.path, title); setRepositoryState(current => ({ userId, repositories: [repository, ...(current.userId === userId ? current.repositories : []).filter(item => item.id !== repository.id)] })); openGitManager(repository.id, action); }
    catch (error) { message.error(`打开 ${title} 的 Git 管理失败：${getErrorMessage(error)}`); }
  }, [openGitManager, userId]);
  const visibleStatus = statusSnapshot.repositoryId === selectedRepository?.id ? statusSnapshot : { repositoryId: selectedRepository?.id ?? null, status: null, loading: false, error: "" };
  const gitSummaryText = !selectedRepository ? "当前会话尚未写入项目文件" : visibleStatus.loading && !visibleStatus.status ? "读取中…" : visibleStatus.error ? "读取失败" : !visibleStatus.status ? "等待状态" : visibleStatus.status.repositoryState === "not-repository" ? "等待 Agent 首次写入" : visibleStatus.status.repositoryState === "unborn" ? `新仓库 · ${visibleStatus.status.changedFileCount} 项` : visibleStatus.status.clean ? "工作区干净" : `${visibleStatus.status.changedFileCount} 项 · +${visibleStatus.status.insertions} −${visibleStatus.status.deletions}`;
  const summaryFolderMatches = summaryFolderState.userId === userId && summaryFolderState.app === app && summaryFolderState.projectId === activeSession?.projectId;
  const hostTasks = hostTasksState.userId === userId && hostTasksState.appId === app ? hostTasksState.tasks : [];
  const hostTasksLoading = hostTasksState.userId !== userId || hostTasksState.appId !== app || hostTasksState.loading;
  const activeHostTaskId = activeTabKind === "agent-host-task" ? activeTab?.hostTaskId ?? "" : "";
  const activeHostTask = hostTaskDetailState.userId === userId && hostTaskDetailState.taskId === activeHostTaskId ? hostTaskDetailState.task : activeHostTaskId ? activeTab?.hostTaskSnapshot ?? null : null;
  useEffect(() => setHostTaskStopError(""), [app, userId]);
  useEffect(() => {
    if (!summaryActionFolderKey) return;
    const frame = window.requestAnimationFrame(() => summaryActionMenuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [summaryActionFolderKey]);
  useEffect(() => {
    const folderKey = summaryActionFolderKey; if (!folderKey) return;
    const closeOnOutsidePointer = (event: PointerEvent) => { const target = event.target; if (!(target instanceof Node)) return; if (summaryActionMenuRef.current?.contains(target) || summaryActionTriggerRefs.current.get(folderKey)?.contains(target)) return; setSummaryActionFolderKey(null); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key !== "Escape") return; event.preventDefault(); summaryActionTriggerRefs.current.get(folderKey)?.focus(); setSummaryActionFolderKey(null); };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true); document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePointer, true); document.removeEventListener("keydown", closeOnEscape); };
  }, [summaryActionFolderKey]);
  useEffect(() => {
    if (layoutMode !== "mobile" || !summaryOpen || summaryActionFolderKey) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key !== "Escape") return; event.preventDefault(); handleSummaryOpenChange(false); };
    window.addEventListener("keydown", closeOnEscape, true); return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [handleSummaryOpenChange, layoutMode, summaryActionFolderKey, summaryOpen]);

  return {
    repositories, repositoriesLoading, repositoriesError, sessionGitBinding,
    activeSessionGitRepositoryId, activeSessionAssetRepository, activeSessionAssetRepositoryLoading,
    selectedRepositoryId, selectedRepository, setManagerRepositoryState,
    statusSnapshot, visibleStatus, gitSummaryText, refreshGitStatus, updateGitStatus,
    summaryOpen, handleSummaryOpenChange, summaryActionFolderKey, setSummaryActionFolderKey,
    summaryActionMenuRef, summaryActionTriggerRefs, managerActionRequest, setManagerActionRequest,
    summaryFolderState, summaryFolderMatches, hostTasks, hostTasksLoading,
    hostTasksError: hostTasksState.userId === userId && hostTasksState.appId === app ? hostTasksState.error : "",
    hostTaskDetailState, activeHostTaskId, activeHostTask, stoppingHostTaskId, hostTaskStopError,
    sessionFileChangesState, sessionFileSummary, onSessionFileChanges,
    repositoryChangeError, openGitManager, openGitSummaryFolder,
    onAiChatBusyChange, stopHostTask,
  };
}
