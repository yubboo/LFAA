// 右栏「终端与后台任务」面板：支持快速发起后台命令、查看实时 stdout/stderr 输出与一键停止进程。
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { IconCheck, IconCircleX, IconClock, IconPlayerStop, IconTerminal2 } from "@tabler/icons-react";
import { useVisibleInterval } from "@lfaa/ui-primitives/client";
import styles from "./AgentContextPanel.module.css";

export interface RightJobItem {
  id: string;
  sessionId: string;
  title: string;
  command: string;
  cwd: string;
  status: "running" | "done" | "error" | "killed";
  exitCode?: number;
  output: string;
  startedAt: number;
  endedAt?: number;
}

export function RightTerminalPane({
  sessionId,
  isZh,
  selectedJobId,
}: {
  sessionId: string;
  isZh: boolean;
  selectedJobId?: string | undefined;
}) {
  const [jobs, setJobs] = useState<RightJobItem[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(selectedJobId);
  const [commandInput, setCommandInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { jobs?: RightJobItem[] };
      if (Array.isArray(data.jobs)) {
        setJobs(data.jobs);
        if (!activeId && data.jobs[0]) setActiveId(data.jobs[0].id);
      }
    } catch {
      // 忽略偶发轮询异常
    }
  }, [activeId, sessionId]);

  useEffect(() => {
    if (selectedJobId) setActiveId(selectedJobId);
  }, [selectedJobId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);
  // 后台标签页不轮询任务列表，回前台立即补一次。
  useVisibleInterval(loadJobs, 1600);

  const handleRun = async (e: FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, command: cmd }),
      });
      const data = (await res.json()) as { job?: RightJobItem; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error || "启动命令失败");
      setCommandInput("");
      setActiveId(data.job.id);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async (id: string) => {
    await fetch(`/api/jobs/${encodeURIComponent(id)}/stop`, { method: "POST" }).catch(() => {});
    await loadJobs();
  };

  const current = jobs.find((j) => j.id === activeId) ?? jobs[0];

  return (
    <div className={styles.subviewStack}>
      <form className={styles.inlineForm} onSubmit={(e) => void handleRun(e)}>
        <input
          className={styles.inlineInput}
          value={commandInput}
          placeholder={isZh ? "输入要在工作区后台运行的命令…" : "Run background command…"}
          onChange={(e) => setCommandInput(e.target.value)}
        />
        <button type="submit" className={styles.inlineBtn} disabled={busy || !commandInput.trim()}>
          {isZh ? "运行" : "Run"}
        </button>
      </form>
      {error && <p className={styles.errorBanner} role="alert">{error}</p>}

      {jobs.length === 0 ? (
        <div className={styles.emptyBox}>
          <IconTerminal2 size={18} aria-hidden="true" />
          <span>{isZh ? "当前会话暂无后台任务，可直接输入命令或让 Agent 启动后台任务。" : "No background tasks in this session yet."}</span>
        </div>
      ) : (
        <div className={styles.listStack}>
          {jobs.map((job) => {
            const Icon = job.status === "running" ? IconClock : job.status === "done" ? IconCheck : IconCircleX;
            return (
              <div
                key={job.id}
                className={`${styles.taskCard} ${current?.id === job.id ? styles.taskCardActive : ""}`}
              >
                <div className={styles.taskHeader}>
                  <button type="button" className={styles.taskSelectBtn} onClick={() => setActiveId(job.id)}>
                    <Icon size={14} className={styles.statusIcon} data-status={job.status} aria-hidden="true" />
                    <span className={styles.taskTitle}>{job.title}</span>
                  </button>
                  {job.status === "running" && (
                    <button
                      type="button"
                      className={styles.stopMiniBtn}
                      aria-label={isZh ? "停止任务" : "Stop task"}
                      onClick={() => void handleStop(job.id)}
                    >
                      <IconPlayerStop size={13} />
                    </button>
                  )}
                </div>
                {current?.id === job.id && (
                  <pre className={styles.logOutput}>
                    {job.output || (job.status === "running" ? (isZh ? "正在等待命令输出…" : "Waiting for output…") : (isZh ? "(无输出)" : "(no output)"))}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
