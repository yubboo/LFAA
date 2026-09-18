/**
 * 文件：App.tsx
 * 作用：连接 Vite 开发资源桥接与共享工作台壳。
 * 不负责：读取资源正文、Secret 或正式 Runtime 状态。
 */
import { useCallback, useEffect, useState } from "react";
import { AgentWorkbench, type DevResourceItem } from "@lfaa/app-shell";

interface ResourceResponse { resources: DevResourceItem[]; }

type BridgeStatus = "connected" | "refreshing" | "offline";

export function App() {
  const [resources, setResources] = useState<DevResourceItem[]>([]);
  const [status, setStatus] = useState<BridgeStatus>("refreshing");

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

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => { void refresh(); };
    import.meta.hot.on("lfaa:resources-changed", handler);
    return () => import.meta.hot?.off("lfaa:resources-changed", handler);
  }, [refresh]);

  return <AgentWorkbench resources={resources} resourceBridgeStatus={status} />;
}
