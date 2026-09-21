/**
 * 文件：useWorkspaceSessionController.ts
 * 作用：Chat / Work / Manual 共用的 Workspace Session Controller。
 * 负责：统一 Session 恢复/保存、三种表现模式、权限、Agent Run、人工干预、Run Timeline 投影与最近会话。
 * 不负责：Provider 协议、Tool 执行实现、Canvas Pointer 状态、Node 磁盘实现。
 * 状态归属：Agent 运行真值来自 AgentRuntimeEvent；长期会话真值来自 @lfaa/session Host。
 * 对外接口：useWorkspaceSessionController({ runtimeHost, sessionHost, workspaceId, activeModelBinding })。
 * 关联文件：workspace.types.ts、@lfaa/agent-runtime、@lfaa/session、AgentWorkbench。
 * 修改注意事项：Chat/Work 禁止拆成两套 startRun；刷新恢复必须来自 Session Host，禁止用 localStorage 复制聊天记录。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentExecutionHints,
  AgentModelBinding,
  AgentPermissionProfileId,
  AgentRunHandle,
  AgentRuntimeActivity,
  AgentRuntimeEvent,
  AgentRuntimeHost,
  AgentWorkspaceMode,
} from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type {
  SessionMessageRecord,
  WorkspaceProjectRecord,
  WorkspaceProjectSnapshot,
  WorkspaceSessionHost,
  WorkspaceSessionRecord,
  WorkspaceSessionSummary,
} from "@lfaa/session";
import type { AgentRunActivityViewModel, AgentRunProcessViewModel, ChatMessageViewModel, WorkspaceMode } from "../contracts/workspace.types";

const WORKSPACE_MODE_KEY = "lfaa.workspace.mode.v1";
const LEGACY_AGENT_SURFACE_KEY = "lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY = "lfaa.agent.permission-profile.v1";
const SESSION_SAVE_DELAY_MS = 180;

function initialWorkspaceMode(): WorkspaceMode {
  if (typeof window === "undefined") return "chat";
  const stored = window.localStorage.getItem(WORKSPACE_MODE_KEY) ?? window.localStorage.getItem(LEGACY_AGENT_SURFACE_KEY);
  return stored === "work" || stored === "manual" ? stored : "chat";
}
function initialPermissionProfile(): AgentPermissionProfileId {
  if (typeof window === "undefined") return "ask";
  const stored = window.localStorage.getItem(AGENT_PERMISSION_KEY);
  return stored === "approve-for-me" || stored === "full-access" ? stored : "ask";
}
function requireAgentMode(mode: WorkspaceMode): AgentWorkspaceMode {
  if (mode === "manual") throw new Error("手动模式不启动 Agent Run；请直接使用画布、终端或已注册工具。");
  return mode;
}
function processMessage(runId: string, startedAt: number): ChatMessageViewModel {
  return { id: `${runId}:run`, role: "run", text: "", runId, process: { runId, phase: "starting", label: "正在启动", status: "running", startedAt, reasoningSummary: "", plan: "", phases: [{ phase: "starting", label: "正在启动", at: startedAt }], activities: [] } };
}
function activityView(activity: AgentRuntimeActivity, previous?: AgentRunActivityViewModel): AgentRunActivityViewModel {
  return {
    id: activity.id, kind: activity.kind, title: activity.title,
    ...(activity.detail ? { detail: activity.detail } : previous?.detail ? { detail: previous.detail } : {}),
    status: activity.status, output: previous?.output ?? "",
    ...(activity.startedAt !== undefined ? { startedAt: activity.startedAt } : previous?.startedAt !== undefined ? { startedAt: previous.startedAt } : {}),
    ...(activity.completedAt !== undefined ? { completedAt: activity.completedAt } : previous?.completedAt !== undefined ? { completedAt: previous.completedAt } : {}),
  };
}
function updateRunMessage(messages: readonly ChatMessageViewModel[], runId: string, update: (process: AgentRunProcessViewModel) => AgentRunProcessViewModel): readonly ChatMessageViewModel[] {
  const index = messages.findIndex((message) => message.role === "run" && message.runId === runId);
  if (index < 0) return messages;
  const current = messages[index]!;
  if (current.role !== "run" || !current.process) return messages;
  const next = [...messages]; next[index] = { ...current, process: update(current.process) }; return next;
}
function upsertActivity(items: readonly AgentRunActivityViewModel[], activity: AgentRuntimeActivity): readonly AgentRunActivityViewModel[] {
  const index = items.findIndex((item) => item.id === activity.id);
  if (index < 0) return [...items, activityView(activity)];
  const next = [...items]; next[index] = activityView(activity, next[index]); return next;
}
function appendActivityOutput(items: readonly AgentRunActivityViewModel[], activityId: string, delta: string): readonly AgentRunActivityViewModel[] {
  const index = items.findIndex((item) => item.id === activityId);
  if (index < 0) return items;
  const next = [...items]; next[index] = { ...next[index]!, output: `${next[index]!.output}${delta}`.slice(-8_000) }; return next;
}
function deriveTitle(messages: readonly ChatMessageViewModel[], fallback: string): string {
  const firstUser = messages.find((item) => item.role === "user" && item.text.trim());
  const text = firstUser?.text.replace(/\s+/gu, " ").trim();
  return text ? text.slice(0, 34) : fallback;
}
function fromSessionMessages(messages: readonly SessionMessageRecord[]): readonly ChatMessageViewModel[] {
  return messages.map((message) => ({ ...message } as ChatMessageViewModel));
}
function toSessionMessages(messages: readonly ChatMessageViewModel[]): readonly SessionMessageRecord[] {
  return messages.map((message) => ({ ...message } as SessionMessageRecord));
}

export function useWorkspaceSessionController({ runtimeHost, sessionHost, workspaceId, activeModelBinding }: {
  runtimeHost: AgentRuntimeHost | undefined;
  sessionHost: WorkspaceSessionHost | undefined;
  workspaceId: string | undefined;
  activeModelBinding: AgentModelBinding | null;
}) {
  const defaultProjectId = workspaceId?.trim() || "lfaa";
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>(initialWorkspaceMode);
  const [permissionProfileId, setPermissionProfileId] = useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [chatMessages, setChatMessages] = useState<readonly ChatMessageViewModel[]>([]);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null);
  const [workContext, setWorkContext] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("新对话");
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number>(() => Date.now());
  const [sessionPinned, setSessionPinned] = useState(false);
  const [projects, setProjects] = useState<readonly WorkspaceProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(defaultProjectId);
  const [pinnedSessions, setPinnedSessions] = useState<readonly WorkspaceSessionSummary[]>([]);
  const [recentSessions, setRecentSessions] = useState<readonly WorkspaceSessionSummary[]>([]);
  const [sessionReady, setSessionReady] = useState(!sessionHost);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const loadingRef = useRef(0);
  const lastSavedRef = useRef("");
  const latestSessionRef = useRef<WorkspaceSessionRecord | null>(null);

  const applyProjectSnapshot = useCallback((snapshot: WorkspaceProjectSnapshot) => {
    setProjects(snapshot.projects); setPinnedSessions(snapshot.pinnedSessions); setActiveProjectId(snapshot.activeProjectId);
  }, []);

  const applySession = useCallback((record: WorkspaceSessionRecord) => {
    loadingRef.current += 1;
    setSessionId(record.id); setSessionTitle(record.title); setSessionCreatedAt(record.createdAt); setSessionPinned(Boolean(record.pinned));
    setWorkspaceModeState(record.mode); setChatMessages(fromSessionMessages(record.messages)); setWorkContext(record.workContext ?? "");
    setActiveRunId(null);
    const assistant = [...record.messages].reverse().find((item) => item.role === "assistant");
    setLastAssistantText(assistant?.text ?? null);
    const user = [...record.messages].reverse().find((item) => item.role === "user");
    setLastRunInput(user?.text ?? null);
    queueMicrotask(() => { loadingRef.current = Math.max(0, loadingRef.current - 1); });
  }, []);

  const refreshRecent = useCallback(async () => {
    if (!sessionHost) return;
    const snapshot = await sessionHost.snapshot(activeProjectId);
    setRecentSessions(snapshot.sessions);
    const projectSnapshot = await sessionHost.projects(defaultProjectId);
    setProjects(projectSnapshot.projects); setPinnedSessions(projectSnapshot.pinnedSessions);
  }, [activeProjectId, defaultProjectId, sessionHost]);

  useEffect(() => {
    if (!sessionHost) { setSessionReady(true); return; }
    let cancelled = false;
    setSessionReady(false); setSessionError(null);
    void (async () => {
      try {
        const projectSnapshot = await sessionHost.projects(defaultProjectId);
        const projectId = projectSnapshot.activeProjectId;
        const snapshot = await sessionHost.snapshot(projectId);
        let record = snapshot.activeSessionId ? await sessionHost.load(snapshot.activeSessionId) : null;
        if (!record) record = await sessionHost.create({ workspaceId: projectId, mode: initialWorkspaceMode() });
        if (cancelled) return;
        applyProjectSnapshot(projectSnapshot);
        setRecentSessions(snapshot.sessions.length ? snapshot.sessions : [{ id: record.id, workspaceId: record.workspaceId, title: record.title, mode: record.mode, preview: "", pinned: record.pinned, updatedAt: record.updatedAt }]);
        applySession(record);
        setSessionReady(true);
      } catch (error) {
        if (cancelled) return;
        setSessionError(error instanceof Error ? error.message : String(error)); setSessionReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [applyProjectSnapshot, applySession, defaultProjectId, sessionHost]);

  useEffect(() => { window.localStorage.setItem(WORKSPACE_MODE_KEY, workspaceMode); }, [workspaceMode]);
  useEffect(() => { window.localStorage.setItem(AGENT_PERMISSION_KEY, permissionProfileId); }, [permissionProfileId]);

  const setWorkspaceMode = useCallback((mode: WorkspaceMode) => setWorkspaceModeState(mode), []);

  useEffect(() => {
    if (!sessionHost || !sessionReady || !sessionId || loadingRef.current > 0) return;
    const title = deriveTitle(chatMessages, sessionTitle);
    const payload: WorkspaceSessionRecord = {
      id: sessionId,
      workspaceId: activeProjectId,
      title,
      mode: workspaceMode,
      messages: toSessionMessages(chatMessages),
      workContext,
      pinned: sessionPinned,
      createdAt: sessionCreatedAt,
      updatedAt: Date.now(),
    };
    latestSessionRef.current = payload;
    const serialized = JSON.stringify({ ...payload, updatedAt: 0 });
    if (serialized === lastSavedRef.current) return;
    const timer = window.setTimeout(() => {
      void sessionHost.save(payload).then((saved) => {
        lastSavedRef.current = JSON.stringify({ ...saved, updatedAt: 0 });
        setSessionTitle(saved.title);
        return refreshRecent();
      }).catch((error) => setSessionError(error instanceof Error ? error.message : String(error)));
    }, SESSION_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, chatMessages, refreshRecent, sessionCreatedAt, sessionHost, sessionId, sessionPinned, sessionReady, sessionTitle, workContext, workspaceMode]);

  useEffect(() => {
    if (!sessionHost) return;
    const flush = () => { const latest = latestSessionRef.current; if (latest) void sessionHost.save(latest); };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [sessionHost]);

  const createSession = useCallback(async (mode: WorkspaceMode = workspaceMode) => {
    if (!sessionHost) {
      setChatMessages([]); setWorkContext(""); setActiveRunId(null); setLastRunInput(null); setLastAssistantText(null); setWorkspaceModeState(mode); return;
    }
    const record = await sessionHost.create({ workspaceId: activeProjectId, mode });
    applySession(record); await refreshRecent();
  }, [activeProjectId, applySession, refreshRecent, sessionHost, workspaceMode]);

  const selectSession = useCallback(async (id: string) => {
    if (!sessionHost || id === sessionId) return;
    const record = await sessionHost.load(id);
    await sessionHost.setActiveProject(record.workspaceId); await sessionHost.setActive(record.workspaceId, id);
    setActiveProjectId(record.workspaceId); setRecentSessions((await sessionHost.snapshot(record.workspaceId)).sessions); applySession(record);
    applyProjectSnapshot(await sessionHost.projects(defaultProjectId));
  }, [applyProjectSnapshot, applySession, defaultProjectId, sessionHost, sessionId]);

  const selectProject = useCallback(async (projectId: string) => {
    if (!sessionHost) return;
    applyProjectSnapshot(await sessionHost.setActiveProject(projectId));
    const snapshot = await sessionHost.snapshot(projectId);
    let record = snapshot.activeSessionId ? await sessionHost.load(snapshot.activeSessionId) : null;
    if (!record) record = await sessionHost.create({ workspaceId: projectId, mode: workspaceMode });
    setRecentSessions(snapshot.sessions.length ? snapshot.sessions : [{ id: record.id, workspaceId: record.workspaceId, title: record.title, mode: record.mode, preview: "", pinned: record.pinned, updatedAt: record.updatedAt }]);
    applySession(record);
  }, [applyProjectSnapshot, applySession, sessionHost, workspaceMode]);

  const createProject = useCallback(async (name: string) => {
    if (!sessionHost) return;
    const projectSnapshot = await sessionHost.createProject({ name }); applyProjectSnapshot(projectSnapshot);
    const record = await sessionHost.create({ workspaceId: projectSnapshot.activeProjectId, mode: workspaceMode });
    setRecentSessions([{ id: record.id, workspaceId: record.workspaceId, title: record.title, mode: record.mode, preview: "", pinned: false, updatedAt: record.updatedAt }]); applySession(record);
  }, [applyProjectSnapshot, applySession, sessionHost, workspaceMode]);

  const updateProject = useCallback(async (projectId: string, input: { name?: string; pinned?: boolean; expanded?: boolean }) => {
    if (!sessionHost) return;
    applyProjectSnapshot(await sessionHost.updateProject(projectId, input));
  }, [applyProjectSnapshot, sessionHost]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!sessionHost) return;
    const projectSnapshot = await sessionHost.deleteProject(projectId); applyProjectSnapshot(projectSnapshot);
    const nextId = projectSnapshot.activeProjectId; const snapshot = await sessionHost.snapshot(nextId);
    let record = snapshot.activeSessionId ? await sessionHost.load(snapshot.activeSessionId) : null;
    if (!record) record = await sessionHost.create({ workspaceId: nextId, mode: workspaceMode });
    setRecentSessions(snapshot.sessions); applySession(record);
  }, [applyProjectSnapshot, applySession, sessionHost, workspaceMode]);

  const toggleSessionPinned = useCallback(async (id: string) => {
    if (!sessionHost) return;
    const record = await sessionHost.load(id); await sessionHost.save({ ...record, pinned: !record.pinned }); await refreshRecent();
    if (id === sessionId) setSessionPinned(!record.pinned);
  }, [refreshRecent, sessionHost, sessionId]);

  useEffect(() => {
    if (!runtimeHost) return;
    return runtimeHost.subscribe((event: AgentRuntimeEvent) => {
      if (!sessionId || event.sessionId !== sessionId) return;
      if (event.type === "run.started") {
        setActiveRunId(event.runId);
        setChatMessages((messages) => messages.some((message) => message.role === "run" && message.runId === event.runId) ? messages : [...messages, processMessage(event.runId, event.startedAt)]);
      } else if (event.type === "run.phase.changed") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => {
          const label = event.label ?? process.label;
          const previous = process.phases.at(-1);
          const phases = previous?.phase === event.phase && previous.label === label ? process.phases : [...process.phases, { phase: event.phase, label, at: Date.now() }];
          return { ...process, phase: event.phase, label, phases };
        }));
      } else if (event.type === "run.intervention.accepted") {
        setChatMessages((messages) => [...messages, { id: `user:intervention:${Date.now()}:${messages.length}`, role: "user", text: event.input, runId: event.runId }]);
        setActiveRunId(event.runId);
      } else if (event.type === "reasoning.summary.delta") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, reasoningSummary: `${process.reasoningSummary}${event.delta}` })));
      } else if (event.type === "plan.updated") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, plan: event.text })));
      } else if (event.type === "activity.started" || event.type === "activity.completed") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, activities: upsertActivity(process.activities, event.activity) })));
      } else if (event.type === "activity.output.delta") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, activities: appendActivityOutput(process.activities, event.activityId, event.delta) })));
      } else if (event.type === "assistant.delta") {
        setLastAssistantText((current) => `${current ?? ""}${event.delta}`);
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`; const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.delta, runId: event.runId }];
          const current = messages[index]!; if (current.role !== "assistant") return messages;
          const next = [...messages]; next[index] = { ...current, text: `${current.text}${event.delta}` }; return next;
        });
      } else if (event.type === "assistant.completed") {
        setLastAssistantText(event.text);
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`; const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.text, runId: event.runId }];
          const current = messages[index]!; if (current.role !== "assistant") return messages;
          const next = [...messages]; next[index] = { ...current, text: event.text }; return next;
        });
      } else if (event.type === "run.completed") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "completed", label: "已完成", completedAt: event.completedAt })));
      } else if (event.type === "run.failed") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [...updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "failed", label: "运行失败", completedAt: event.completedAt })), { id: `${event.runId}:error`, role: "error", text: event.error, runId: event.runId }]);
      } else if (event.type === "run.cancelled") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [...updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "cancelled", label: "已停止", completedAt: event.completedAt })), { id: `${event.runId}:cancelled`, role: "error", text: "本次 Run 已取消。", runId: event.runId }]);
      }
    });
  }, [runtimeHost, sessionId]);

  const startAgentRun = async (input: string, executionHints?: AgentExecutionHints, modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>): Promise<AgentRunHandle> => {
    const agentMode = requireAgentMode(workspaceMode); setLastAssistantText(null);
    if (!runtimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!sessionId) throw new Error("会话尚未就绪。");
    if (!activeModelBinding) throw new Error("请先在设置中配置并选择模型；或切换到手动模式直接使用本地工具。");
    const runModelBinding: AgentModelBinding = modelSettingOverrides ? { ...activeModelBinding, settings: { ...(activeModelBinding.settings ?? {}), ...modelSettingOverrides } } : activeModelBinding;
    setChatMessages((messages) => [...messages, { id: `user:${Date.now()}:${messages.length}`, role: "user", text: input }]);
    const handle = await runtimeHost.startRun({ workspaceMode: agentMode, input, model: runModelBinding, permissionProfileId, ...(executionHints ? { executionHints } : {}), sessionId, workspaceId: activeProjectId, ...(agentMode === "work" && workContext.trim() ? { workspaceContext: workContext.trim() } : {}) });
    setLastRunInput(input); setActiveRunId(handle.runId); return handle;
  };
  const interveneAgentRun = async (input: string): Promise<AgentRunHandle> => {
    const agentMode = requireAgentMode(workspaceMode);
    if (!runtimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!activeRunId) return startAgentRun(input);
    const result = await runtimeHost.interveneRun(activeRunId, { input, ...(agentMode === "work" && workContext.trim() ? { workspaceContext: workContext.trim() } : {}) });
    if (result.disposition === "restarted") setLastAssistantText(null);
    setLastRunInput(input); setActiveRunId(result.handle.runId); return result.handle;
  };

  const submitAgentInput = activeRunId ? interveneAgentRun : startAgentRun;
  return {
    workspaceMode, setWorkspaceMode, permissionProfileId, setPermissionProfileId, chatMessages, lastRunInput, lastAssistantText,
    startAgentRun, interveneAgentRun, submitAgentInput, activeRunId, runtimeConnected: Boolean(runtimeHost), automationReady: Boolean(runtimeHost && activeModelBinding),
    manualMode: workspaceMode === "manual", workContext, setWorkContext, sessionId, recentSessions, sessionReady, sessionError, createSession, selectSession,
    projects, activeProjectId, pinnedSessions, selectProject, createProject, updateProject, deleteProject, toggleSessionPinned,
  };
}
export type WorkspaceSessionController = ReturnType<typeof useWorkspaceSessionController>;
