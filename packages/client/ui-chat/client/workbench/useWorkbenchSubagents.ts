// 管理右侧工作台的子智能体多标签页状态：按需新建、切换、关闭，并与会话汇总状态实时同步。
import { useCallback, useEffect, useState } from "react";
import type { ChatClientStore } from "../store/chat-store";
import type { RightSubagentItem } from "./RightSubagentsPane";

export interface SubagentStageTab {
  id: string;
  role: string;
  status: "running" | "done" | "error" | "stopped";
}

export function useWorkbenchSubagents({
  sessionId,
  store,
  subagents,
}: {
  sessionId: string;
  store: ChatClientStore;
  subagents: RightSubagentItem[];
}) {
  const [subagentTabs, setSubagentTabs] = useState<SubagentStageTab[]>([]);
  const [activeSubagentTabId, setActiveSubagentTabId] = useState<string | null>(null);

  // 切换会话时清空旧会话的子智能体标签。
  useEffect(() => {
    setSubagentTabs([]);
    setActiveSubagentTabId(null);
  }, [sessionId]);

  // 与后端汇总状态同步各标签的运行态与角色名。
  useEffect(() => {
    if (subagents.length === 0) return;
    const byId = new Map(subagents.map((item) => [item.id, item]));
    setSubagentTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        const latest = byId.get(tab.id);
        if (!latest || (latest.status === tab.status && latest.role === tab.role)) return tab;
        changed = true;
        return { ...tab, role: latest.role, status: latest.status };
      });
      return changed ? next : prev;
    });
  }, [subagents]);

  const openSubagentTab = useCallback((id: string, role?: string) => {
    setSubagentTabs((prev) => {
      if (prev.some((tab) => tab.id === id)) return prev;
      const matched = subagents.find((item) => item.id === id);
      return [
        ...prev,
        {
          id,
          role: role?.trim() || matched?.role || id,
          status: matched?.status ?? "running",
        },
      ];
    });
    setActiveSubagentTabId(id);
    store.setRightStageKind("subagent");
  }, [store, subagents]);

  const selectSubagentTab = useCallback((id: string) => {
    setActiveSubagentTabId(id);
    store.setRightStageKind("subagent");
  }, [store]);

  const closeSubagentTab = useCallback((id: string, fallbackStage: () => "file" | "browser" | "review" | null) => {
    setSubagentTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      if (activeSubagentTabId === id) {
        const nextActive = next.at(-1)?.id ?? null;
        setActiveSubagentTabId(nextActive);
        if (!nextActive && store.getSnapshot().rightStageKind === "subagent") {
          store.setRightStageKind(fallbackStage());
        }
      }
      return next;
    });
  }, [activeSubagentTabId, store]);

  return {
    subagentTabs,
    activeSubagentTabId,
    openSubagentTab,
    selectSubagentTab,
    closeSubagentTab,
  };
}
