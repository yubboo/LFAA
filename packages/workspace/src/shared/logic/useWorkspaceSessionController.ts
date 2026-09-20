/**
 * 文件：useWorkspaceSessionController.ts
 * 作用：Workspace / Chat+Work 共用 Run 业务状态唯一 Owner。
 * 负责：surface、permission、chat projection、Runtime event subscription、startRun、最近一次 Run 输入投影。
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
  AgentSurfaceMode,
} from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { ChatProjectionMessage } from "../contracts/workspace.types";

const AGENT_SURFACE_KEY = "lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY = "lfaa.agent.permission-profile.v1";

function initialAgentSurface(): AgentSurfaceMode {
  if (typeof window === "undefined") return "chat";
  return window.localStorage.getItem(AGENT_SURFACE_KEY) === "work" ? "work" : "chat";
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
  const [agentSurface, setAgentSurface] = useState<AgentSurfaceMode>(initialAgentSurface);
  const [permissionProfileId, setPermissionProfileId] = useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [chatMessages, setChatMessages] = useState<readonly ChatProjectionMessage[]>([]);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);

  useEffect(() => { window.localStorage.setItem(AGENT_SURFACE_KEY, agentSurface); }, [agentSurface]);
  useEffect(() => { window.localStorage.setItem(AGENT_PERMISSION_KEY, permissionProfileId); }, [permissionProfileId]);
  useEffect(() => {
    if (!runtimeHost) return;
    return runtimeHost.subscribe((event: AgentRuntimeEvent) => {
      if (event.type === "assistant.completed") {
        setChatMessages((messages) => [...messages, { id: `${event.runId}:assistant`, role: "assistant", text: event.text, runId: event.runId }]);
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
    if (agentSurface === "chat") {
      setChatMessages((messages) => [...messages, { id: `user:${Date.now()}:${messages.length}`, role: "user", text: input }]);
    }
    const handle = await runtimeHost.startRun({
      surface: agentSurface,
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
    agentSurface,
    setAgentSurface,
    permissionProfileId,
    setPermissionProfileId,
    chatMessages,
    lastRunInput,
    startAgentRun,
    runtimeConnected: Boolean(runtimeHost),
  };
}

export type WorkspaceSessionController = ReturnType<typeof useWorkspaceSessionController>;
