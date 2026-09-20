/**
 * 文件：useWorkspaceSessionController.ts
 * 作用：Workspace / Chat+Work 共用 Run 业务状态唯一 Owner。
 * 负责：workspaceMode、permission、Chat ViewModel、Runtime event subscription、startRun、最近一次 Run 输入。
 * 不负责：Work Canvas 节点坐标/viewport、模型账户配置、Composer draft、Shell chrome、UI 布局。
 * 状态归属：Workspace Session；Chat 与 Work 共用一套 AgentRuntimeHost / permission / model binding。
 * 对外接口：useWorkspaceSessionController({ runtimeHost, workspaceId, activeModelBinding })。
 * 关联文件：workspace.types.ts、@lfaa/agent-runtime、@lfaa/app-shell AgentWorkbench。
 * 修改注意事项：不得拆成 Chat/Work 两套 startRun；Canvas 视觉布局不得提升进 Session。
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
import type { ChatMessageViewModel } from "../contracts/workspace.types";

const WORKSPACE_MODE_KEY = "lfaa.workspace.mode.v1";
const LEGACY_AGENT_SURFACE_KEY = "lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY = "lfaa.agent.permission-profile.v1";

function initialWorkspaceMode(): AgentWorkspaceMode {
  if (typeof window === "undefined") return "chat";
  const stored = window.localStorage.getItem(WORKSPACE_MODE_KEY) ?? window.localStorage.getItem(LEGACY_AGENT_SURFACE_KEY);
  return stored === "work" ? "work" : "chat";
}

function initialPermissionProfile(): AgentPermissionProfileId {
  if (typeof window === "undefined") return "ask";
  const stored = window.localStorage.getItem(AGENT_PERMISSION_KEY);
  return stored === "approve-for-me" || stored === "full-access" ? stored : "ask";
}

export function useWorkspaceSessionController({ runtimeHost, workspaceId, activeModelBinding }: {
  runtimeHost: AgentRuntimeHost | undefined;
  workspaceId: string | undefined;
  activeModelBinding: AgentModelBinding | null;
}) {
  const [workspaceMode, setWorkspaceMode] = useState<AgentWorkspaceMode>(initialWorkspaceMode);
  const [permissionProfileId, setPermissionProfileId] = useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [chatMessages, setChatMessages] = useState<readonly ChatMessageViewModel[]>([]);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);

  useEffect(() => { window.localStorage.setItem(WORKSPACE_MODE_KEY, workspaceMode); }, [workspaceMode]);
  useEffect(() => { window.localStorage.setItem(AGENT_PERMISSION_KEY, permissionProfileId); }, [permissionProfileId]);
  useEffect(() => {
    if (!runtimeHost) return;
    return runtimeHost.subscribe((event: AgentRuntimeEvent) => {
      if (event.type === "assistant.delta") {
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.delta, runId: event.runId }];
          const next = [...messages];
          next[index] = { ...next[index]!, text: `${next[index]!.text}${event.delta}` };
          return next;
        });
      } else if (event.type === "assistant.completed") {
        setChatMessages((messages) => {
          const id = `${event.runId}:assistant`;
          const index = messages.findIndex((message) => message.id === id);
          if (index < 0) return [...messages, { id, role: "assistant", text: event.text, runId: event.runId }];
          const next = [...messages];
          next[index] = { ...next[index]!, text: event.text };
          return next;
        });
      } else if (event.type === "run.failed") {
        setChatMessages((messages) => [...messages, { id: `${event.runId}:error`, role: "error", text: event.error, runId: event.runId }]);
      } else if (event.type === "run.cancelled") {
        setChatMessages((messages) => [...messages, { id: `${event.runId}:cancelled`, role: "error", text: "本次 Run 已取消。", runId: event.runId }]);
      }
    });
  }, [runtimeHost]);

  const startAgentRun = async (
    input: string,
    executionHints?: AgentExecutionHints,
    modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>,
  ): Promise<AgentRunHandle> => {
    if (!runtimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!activeModelBinding) throw new Error("请先在设置中配置并选择模型。");
    const runModelBinding: AgentModelBinding = modelSettingOverrides
      ? { ...activeModelBinding, settings: { ...(activeModelBinding.settings ?? {}), ...modelSettingOverrides } }
      : activeModelBinding;
    if (workspaceMode === "chat") {
      setChatMessages((messages) => [...messages, { id: `user:${Date.now()}:${messages.length}`, role: "user", text: input }]);
    }
    const handle = await runtimeHost.startRun({
      workspaceMode,
      input,
      model: runModelBinding,
      permissionProfileId,
      ...(executionHints ? { executionHints } : {}),
      workspaceId: workspaceId ?? "lfaa",
    });
    setLastRunInput(input);
    return handle;
  };

  return {
    workspaceMode,
    setWorkspaceMode,
    permissionProfileId,
    setPermissionProfileId,
    chatMessages,
    lastRunInput,
    startAgentRun,
    runtimeConnected: Boolean(runtimeHost),
  };
}

export type WorkspaceSessionController = ReturnType<typeof useWorkspaceSessionController>;
