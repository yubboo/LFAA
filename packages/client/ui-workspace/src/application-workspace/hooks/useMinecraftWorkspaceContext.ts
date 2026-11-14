/**
 * 文件：useMinecraftWorkspaceContext.ts
 * 功能：转接 Minecraft 实例运行摘要和服务器信息上下文。
 * 作用：按当前账户、App 与路由范围保存 UI 快照并提供现有文件/设置 Owner 回调。
 * 关联文件：../../ApplicationWorkspace.tsx、packages/client/ui-minecraft/MinecraftWorkspace.tsx。
 */
import { useCallback, useRef, useState } from "react";
import { message } from "antd";
import { getErrorMessage, loadMinecraftStorageSettings, loadSteamcmdSettings, type ApplicationId, type UserRole } from "lfaa-client-connection/src/api.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import type { MinecraftInstanceRuntimeContext } from "lfaa-client-ui-minecraft/src/MinecraftWorkspace.js";

export function useMinecraftWorkspaceContext(userId: string, role: UserRole, app: ApplicationId, mode: "normal" | "ai-work", section: string, onNavigate: (path: string) => void) {
  const [contentReady, setContentReady] = useState(app !== "minecraft");
  const contextScope = userId + "\u001f" + role;
  const [contextState, setContextState] = useState<{ scope: string; context: MinecraftInstanceRuntimeContext } | null>(null);
  const gameFileEntryInFlight = useRef(false);
  const onRuntimeContextChange = useCallback((context: MinecraftInstanceRuntimeContext | null) => {
    setContextState(context ? { scope: contextScope, context } : null);
  }, [contextScope]);
  const runtimeContext = app === "minecraft" && mode === "normal" && contextState?.scope === contextScope && contextState.context.routeSection === section
    ? contextState.context
    : null;
  const overviewInstanceId = /^instance\/([0-9a-f-]{36})\/overview$/iu.exec(section)?.[1] ?? null;
  const serverInfoContext = runtimeContext?.instanceId === overviewInstanceId ? runtimeContext : null;

  const openGameFiles = useCallback(async (sourceApp: "minecraft" | "steamcmd") => {
    if (gameFileEntryInFlight.current) return;
    gameFileEntryInFlight.current = true;
    const sourceLocation = window.location.pathname + window.location.search;
    const returnPath = window.location.pathname;
    try {
      const nodes: Array<{ id: string; status: "online" | "offline" }> = sourceApp === "minecraft"
        ? (await loadMinecraftStorageSettings()).nodes
        : (await loadSteamcmdSettings()).nodes;
      if (window.location.pathname + window.location.search !== sourceLocation) return;
      const preferredNodeId = (sourceApp === "minecraft" ? runtimeContext?.nodeId : null) ?? new URLSearchParams(window.location.search).get("target");
      const node = (preferredNodeId ? nodes.find(candidate => candidate.id === preferredNodeId) : undefined)
        ?? nodes.find(candidate => candidate.status === "online")
        ?? nodes[0];
      if (!node) throw new Error(`没有登记的 ${sourceApp === "minecraft" ? "Minecraft" : "Steam"} 存储节点，无法定位游戏主目录。`);
      const storageKind = sourceApp === "minecraft" ? "minecraft" : "steamcmd";
      setFileManagerLocation(userId, `.lfaa-library/game-storage/${encodeURIComponent(node.id)}/${storageKind}`, returnPath, sourceApp);
      onNavigate("/files");
    } catch (error) {
      if (window.location.pathname + window.location.search === sourceLocation) message.error(getErrorMessage(error));
    } finally {
      gameFileEntryInFlight.current = false;
    }
  }, [onNavigate, runtimeContext?.nodeId, userId]);

  return { contentReady, setContentReady, runtimeContext, serverInfoContext, onRuntimeContextChange, openGameFiles };
}
