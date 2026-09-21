/**
 * 文件：useWorkspaceSessionController.ts
 * 作用：Workspace / Chat+Work+Manual 共用业务状态唯一 Owner。
 * 负责：Workspace Mode、权限、Chat ViewModel、Runtime event subscription、Agent Run、Manual 模式守卫与最近一次 Run 输入。
 * 不负责：Work/Manual Canvas 节点坐标、模型账户配置、Composer draft、Shell chrome、具体 Tool Host。
 * 状态归属：Workspace Session；Chat 与 Work 共用一套 AgentRuntimeHost / permission / model binding；Manual 不启动 Agent Run。
 * 对外接口：useWorkspaceSessionController({ runtimeHost, workspaceId, activeModelBinding })。
 * 关联文件：workspace.types.ts、@lfaa/agent-runtime、@lfaa/app-shell AgentWorkbench。
 * 修改注意事项：Chat/Work 禁止拆成两套 startRun；Manual 禁止伪造模型结果或复制 Runtime。
 */
import { useEffect, useState } from "react";
import type {
  AgentExecutionHints,
  AgentModelBinding,
  AgentPermissionProfileId,
  AgentRunHandle,
  AgentRuntimeEvent,
  AgentRuntimeHost,
  AgentWorkspaceMode,
} from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { ChatMessageViewModel, WorkspaceMode } from "../contracts/workspace.types";

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
      } else if (event.type === "run.intervention.accepted") {
        if (workspaceMode === "chat") {
          setChatMessages((messages) => [...messages, { id: `user:intervention:${Date.now()}:${messages.length}`, role: "user", text: event.input, runId: event.runId }]);
        }
        setActiveRunId(event.runId);
      } else if (event.type === "assistant.delta") {
        setLastAssistantText((current) => `${current ?? ""}${event.delta}`);
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.delta, runId: event.runId }];
          const next = [...messages];
          next[index] = { ...next[index]!, text: `${next[index]!.text}${event.delta}` };
          return next;
        });
      } else if (event.type === "assistant.completed") {
        setLastAssistantText(event.text);
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.text, runId: event.runId }];
          const next = [...messages];
          next[index] = { ...next[index]!, text: event.text };
          return next;
        });
        setActiveRunId((current) => current === event.runId ? null : current);
      } else if (event.type === "run.failed") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [...messages, { id: `${event.runId}:error`, role: "error", text: event.error, runId: event.runId }]);
      } else if (event.type === "run.cancelled") {
        setActiveRunId((current) => current === event.runId ? null : current);
        setChatMessages((messages) => [...messages, { id: `${event.runId}:cancelled`, role: "error", text: "本次 Run 已取消。", runId: event.runId }]);
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
    // Chat 用户消息由 run.intervention.accepted 事件统一写入，避免客户端重复插入。
    // Work 的干预仍通过同一 Composer 发送，但表现层由画布负责。
    void agentMode;
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
