/**
 * 文件：App.tsx
 * 作用：LFAA Web 宿主层，把 Vite 开发资源桥接和共享 AgentWorkbench 连接起来。
 * 负责：请求 .lfaa 资源元数据、监听资源变更事件、把资源状态和 LocalTerminal 注入共享工作台。
 * 不负责：读取资源正文、保存 Secret、实现工作台布局、创建 PTY 进程。
 * 状态归属：本文件拥有 Web 开发资源列表与桥接连接状态。
 * 对外接口：App()。
 * 关联文件：LocalTerminal.tsx、vite.config.ts、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：浏览器只接收资源元数据；不要在这里绕过 Runtime 读取 Secret 或执行系统命令。
 */
import { useCallback, useEffect, useState } from "react";
import { AgentWorkbench, type DevResourceItem } from "@lfaa/app-shell";
import { LocalTerminal } from "./LocalTerminal";
import { webAiSettingsHost } from "./host/ai-settings-client";
import { webPluginSettingsHost } from "./host/plugin-settings-client";

// Vite 资源桥只返回资源元数据，不返回文件正文。
interface ResourceResponse { resources: DevResourceItem[]; }

type BridgeStatus = "connected" | "refreshing" | "offline";

export function App() {
  const [resources, setResources] = useState<DevResourceItem[]>([]);
  const [status, setStatus] = useState<BridgeStatus>("refreshing");

  // 主动刷新资源快照；失败时只把桥标记为 offline，不让整个 UI 崩溃。
  const refresh = useCallback(async () => {
    setStatus("refreshing");
    try {
      const response = await fetch("/__lfaa/dev/resources", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json() as ResourceResponse;
      setResources(payload.resources);
      setStatus("connected");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Vite watcher 发现 .lfaa 变化后，只发送“发生变化”的通知，再由浏览器重新拉快照。
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => { void refresh(); };
    import.meta.hot.on("lfaa:resources-changed", handler);
    return () => import.meta.hot?.off("lfaa:resources-changed", handler);
  }, [refresh]);

  return <AgentWorkbench resources={resources} resourceBridgeStatus={status} terminal={<LocalTerminal />} aiSettingsHost={webAiSettingsHost} pluginSettingsHost={webPluginSettingsHost} />;
}
