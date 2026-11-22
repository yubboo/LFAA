// 右侧工作台后台概览轮询：按会话拉取后台任务与子智能体列表，供顶栏与欢迎页状态行展示。
import { useEffect, useState } from "react";
import type { RightSubagentItem } from "./RightSubagentsPane";
import type { RightJobItem } from "./RightTerminalPane";

export function useWorkbenchSummary(sessionId: string) {
  const [jobs, setJobs] = useState<RightJobItem[]>([]);
  const [subagents, setSubagents] = useState<RightSubagentItem[]>([]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const [jobsRes, subsRes] = await Promise.all([
          fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { jobs: [] })),
          fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { subagents: [] })),
        ]);
        if (!active) return;
        if (Array.isArray(jobsRes.jobs)) setJobs(jobsRes.jobs);
        if (Array.isArray(subsRes.subagents)) setSubagents(subsRes.subagents);
      } catch {
        // 忽略后台概览轮询偶发失败
      }
    };
    void loadSummary();
    const timer = setInterval(() => void loadSummary(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  return { jobs, subagents };
}