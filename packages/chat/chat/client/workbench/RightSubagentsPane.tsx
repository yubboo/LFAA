// 右栏「子智能体与多 Agent 协作」面板：实时展示子智能体角色、状态、步骤数与输出结论。
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconCircleX, IconClock, IconPlayerStop, IconRobot } from "@tabler/icons-react";
import styles from "./AgentContextPanel.module.css";

export interface RightSubagentItem {
  id: string;
  sessionId: string;
  role: string;
  mode: "read" | "write";
  status: "running" | "done" | "error" | "stopped";
  prompt: string;
  output: string;
  stepsCount: number;
  startedAt: number;
  endedAt?: number;
}

export function RightSubagentsPane({
  sessionId,
  isZh,
  selectedSubagentId,
}: {
  sessionId: string;
  isZh: boolean;
  selectedSubagentId?: string | undefined;
}) {
  const [items, setItems] = useState<RightSubagentItem[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(selectedSubagentId);

  const loadSubagents = useCallback(async () => {
    try {
      const res = await fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { subagents?: RightSubagentItem[] };
      if (Array.isArray(data.subagents)) {
        setItems(data.subagents);
        if (!activeId && data.subagents[0]) setActiveId(data.subagents[0].id);
      }
    } catch {
      // 忽略偶发轮询异常
    }
  }, [activeId, sessionId]);

  useEffect(() => {
    if (selectedSubagentId) setActiveId(selectedSubagentId);
  }, [selectedSubagentId]);

  useEffect(() => {
    void loadSubagents();
    const timer = setInterval(() => void loadSubagents(), 1600);
    return () => clearInterval(timer);
  }, [loadSubagents]);

  const handleStop = async (id: string) => {
    await fetch(`/api/subagents/${encodeURIComponent(id)}/stop`, { method: "POST" }).catch(() => {});
    await loadSubagents();
  };

  const current = items.find((s) => s.id === activeId) ?? items[0];

  if (items.length === 0) {
    return (
      <div className={styles.emptyBox}>
        <IconRobot size={18} aria-hidden="true" />
        <span>
          {isZh
            ? "当前会话尚未派发子智能体。对话中让小鱼 Agent 并行调研或自测时，子智能体协作轨迹会实时显示在此。"
            : "No subagents dispatched in this session yet."}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.listStack}>
      {items.map((sub) => {
        const Icon = sub.status === "running" ? IconClock : sub.status === "done" ? IconCheck : IconCircleX;
        return (
          <div key={sub.id} className={`${styles.taskCard} ${current?.id === sub.id ? styles.taskCardActive : ""}`}>
            <div className={styles.taskHeader}>
              <button type="button" className={styles.taskSelectBtn} onClick={() => setActiveId(sub.id)}>
                <Icon size={14} className={styles.statusIcon} data-status={sub.status} aria-hidden="true" />
                <span className={styles.taskTitle}>{sub.role}</span>
                <span className={styles.metaTag}>{sub.mode === "read" ? (isZh ? "只读" : "Read") : (isZh ? "协作" : "Write")}</span>
              </button>
              {sub.status === "running" && (
                <button
                  type="button"
                  className={styles.stopMiniBtn}
                  aria-label={isZh ? "中止子智能体" : "Stop subagent"}
                  onClick={() => void handleStop(sub.id)}
                >
                  <IconPlayerStop size={13} />
                </button>
              )}
            </div>
            {current?.id === sub.id && (
              <div className={styles.subagentDetail}>
                <div className={styles.subagentPrompt}>{sub.prompt}</div>
                <pre className={styles.logOutput}>
                  {sub.output || (sub.status === "running" ? (isZh ? "子智能体正在执行…" : "Subagent running…") : "-")}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
