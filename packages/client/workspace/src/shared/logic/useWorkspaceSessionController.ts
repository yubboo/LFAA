/**
 * 文件：useWorkspaceSessionController.ts
 * 作用：Chat / Work 共用的 Workspace Session Controller。
 * 负责：三种表现模式、权限、统一 Agent Run、人工干预、Run Timeline 事件投影与 Chat 消息派生。
 * 不负责：Provider 协议、Tool 执行实现、Canvas Pointer 状态、正式 Session 持久化。
 * 状态归属：Agent 运行真值来自 AgentRuntimeEvent；本 Hook 只维护当前客户端投影。
 * 对外接口：useWorkspaceSessionController({ runtimeHost, workspaceId, activeModelBinding })。
 * 关联文件：workspace.types.ts、@lfaa/agent-runtime、@lfaa/app-shell AgentWorkbench。
 * 修改注意事项：Chat/Work 禁止拆成两套 startRun；Run Timeline 只能由真实 Runtime Event 驱动，禁止 UI 伪造工具/推理结果。
 */
import { useEffect, useState } from "react";
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
import type { AgentRunActivityViewModel, AgentRunProcessViewModel, ChatMessageViewModel, WorkspaceMode } from "../contracts/workspace.types";

const WORKSPACE_MODE_KEY = "lfaa.workspace.mode.v1";
const LEGACY_AGENT_SURFACE_KEY = "lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY = "lfaa.agent.permission-profile.v1";

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
  return {
    id: `${runId}:run`,
    role: "run",
    runId,
    process: {
      runId,
      phase: "starting",
      label: "正在启动",
      status: "running",
      startedAt,
      reasoningSummary: "",
      plan: "",
      activities: [],
    },
  };
}

function activityView(activity: AgentRuntimeActivity, previous?: AgentRunActivityViewModel): AgentRunActivityViewModel {
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    ...(activity.detail ? { detail: activity.detail } : previous?.detail ? { detail: previous.detail } : {}),
    status: activity.status,
    output: previous?.output ?? "",
    ...(activity.startedAt !== undefined ? { startedAt: activity.startedAt } : previous?.startedAt !== undefined ? { startedAt: previous.startedAt } : {}),
    ...(activity.completedAt !== undefined ? { completedAt: activity.completedAt } : previous?.completedAt !== undefined ? { completedAt: previous.completedAt } : {}),
  };
}

function updateRunMessage(messages: readonly ChatMessageViewModel[], runId: string, update: (process: AgentRunProcessViewModel) => AgentRunProcessViewModel): readonly ChatMessageViewModel[] {
  const index = messages.findIndex((message) => message.role === "run" && message.runId === runId);
  if (index < 0) return messages;
  const current = messages[index]!;
  if (current.role !== "run" || !current.process) return messages;
  const next = [...messages];
  next[index] = { ...current, process: update(current.process) };
  return next;
}

function upsertActivity(items: readonly AgentRunActivityViewModel[], activity: AgentRuntimeActivity): readonly AgentRunActivityViewModel[] {
  const index = items.findIndex((item) => item.id === activity.id);
  if (index < 0) return [...items, activityView(activity)];
  const next = [...items];
  next[index] = activityView(activity, next[index]);
  return next;
}

function appendActivityOutput(items: readonly AgentRunActivityViewModel[], activityId: string, delta: string): readonly AgentRunActivityViewModel[] {
  const index = items.findIndex((item) => item.id === activityId);
  if (index < 0) return items;
  const next = [...items];
  next[index] = { ...next[index]!, output: `${next[index]!.output}${delta}`.slice(-8_000) };
  return next;
}

export function useWorkspaceSessionController({ runtimeHost, workspaceId, activeModelBinding }: {
  runtimeHost: AgentRuntimeHost | undefined;
  workspaceId: string | undefined;
  activeModelBinding: AgentModelBinding | null;
}) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(initialWorkspaceMode);
  const [permissionProfileId, setPermissionProfileId] = useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [chatMessages, setChatMessages] = useState<readonly ChatMessageViewModel[]>([]);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null);
  const [workContext, setWorkContext] = useState<string>("");

  useEffect(() => { window.localStorage.setItem(WORKSPACE_MODE_KEY, workspaceMode); }, [workspaceMode]);
  useEffect(() => { window.localStorage.setItem(AGENT_PERMISSION_KEY, permissionProfileId); }, [permissionProfileId]);
  useEffect(() => {
    if (!runtimeHost) return;
    return runtimeHost.subscribe((event: AgentRuntimeEvent) => {
      if (event.type === "run.started") {
        setActiveRunId(event.runId);
        setChatMessages((messages) => messages.some((message) => message.role === "run" && message.runId === event.runId)
          ? messages
          : [...messages, processMessage(event.runId, event.startedAt)]);
      } else if (event.type === "run.phase.changed") {
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, phase: event.phase, label: event.label ?? process.label })));
      } else if (event.type === "run.intervention.accepted") {
        if (workspaceMode === "chat") {
          setChatMessages((messages) => [...messages, { id: `user:intervention:${Date.now()}:${messages.length}`, role: "user", text: event.input, runId: event.runId }]);
        }
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
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.delta, runId: event.runId }];
          const current = messages[index]!;
          if (current.role !== "assistant") return messages;
          const next = [...messages];
          next[index] = { ...current, text: `${current.text}${event.delta}` };
          return next;
        });
      } else if (event.type === "assistant.completed") {
        setLastAssistantText(event.text);
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.text, runId: event.runId }];
          const current = messages[index]!;
          if (current.role !== "assistant") return messages;
          const next = [...messages];
          next[index] = { ...current, text: event.text };
          return next;
        });
      } else if (event.type === "run.completed") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "completed", label: "已完成", completedAt: event.completedAt })));
      } else if (event.type === "run.failed") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [
          ...updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "failed", label: "运行失败", completedAt: event.completedAt })),
          { id: `${event.runId}:error`, role: "error", text: event.error, runId: event.runId },
        ]);
      } else if (event.type === "run.cancelled") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [
          ...updateRunMessage(messages, event.runId, (process) => ({ ...process, status: "cancelled", label: "已停止", completedAt: event.completedAt })),
          { id: `${event.runId}:cancelled`, role: "error", text: "本次 Run 已取消。", runId: event.runId },
        ]);
      }
    });
  }, [runtimeHost, workspaceMode]);

  const startAgentRun = async (
    input: string,
    executionHints?: AgentExecutionHints,
    modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>,
  ): Promise<AgentRunHandle> => {
    const agentMode = requireAgentMode(workspaceMode);
    setLastAssistantText(null);
    if (!runtimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!activeModelBinding) throw new Error("请先在设置中配置并选择模型；或切换到手动模式直接使用本地工具。");
    const runModelBinding: AgentModelBinding = modelSettingOverrides
      ? { ...activeModelBinding, settings: { ...(activeModelBinding.settings ?? {}), ...modelSettingOverrides } }
      : activeModelBinding;
    if (agentMode === "chat") {
      setChatMessages((messages) => [...messages, { id: `user:${Date.now()}:${messages.length}`, role: "user", text: input }]);
    }
    const handle = await runtimeHost.startRun({
      workspaceMode: agentMode,
      input,
      model: runModelBinding,
      permissionProfileId,
      ...(executionHints ? { executionHints } : {}),
      workspaceId: workspaceId ?? "lfaa",
      ...(agentMode === "work" && workContext.trim() ? { workspaceContext: workContext.trim() } : {}),
    });
    setLastRunInput(input);
    setActiveRunId(handle.runId);
    return handle;
  };

  const interveneAgentRun = async (input: string): Promise<AgentRunHandle> => {
    const agentMode = requireAgentMode(workspaceMode);
    if (!runtimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!activeRunId) return startAgentRun(input);
    const result = await runtimeHost.interveneRun(activeRunId, {
      input,
      ...(agentMode === "work" && workContext.trim() ? { workspaceContext: workContext.trim() } : {}),
    });
    if (result.disposition === "restarted") setLastAssistantText(null);
    setLastRunInput(input);
    setActiveRunId(result.handle.runId);
    return result.handle;
  };

  const submitAgentInput = activeRunId ? interveneAgentRun : startAgentRun;

  return {
    workspaceMode,
    setWorkspaceMode,
    permissionProfileId,
    setPermissionProfileId,
    chatMessages,
    lastRunInput,
    lastAssistantText,
    startAgentRun,
    interveneAgentRun,
    submitAgentInput,
    activeRunId,
    runtimeConnected: Boolean(runtimeHost),
    automationReady: Boolean(runtimeHost && activeModelBinding),
    manualMode: workspaceMode === "manual",
    workContext,
    setWorkContext,
  };
}

export type WorkspaceSessionController = ReturnType<typeof useWorkspaceSessionController>;
