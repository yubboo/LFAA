// 右侧子智能体流式工作舞台：通过 /api/subagents/:id/stream 实时订阅并复用 AssistantTimeline 展示思考、工具链、回传提示与追问输入。
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconCheck, IconLoader2, IconPlayerStop, IconRobot, IconSend } from "@tabler/icons-react";
import type { ChatLocaleMessages } from "../locales";
import type { AgentStepItem } from "../store/chat-types";
import { AssistantTimeline } from "../conversation/AssistantTimeline";
import styles from "./Subagent-Stage-View.module.css";

interface SubagentSnapshot {
  id: string;
  role: string;
  kind?: string;
  mode: string;
  status: "running" | "done" | "error" | "stopped";
  prompt: string;
  reasoning?: string;
  output: string;
  error?: string;
  steps: AgentStepItem[];
  startedAt: number;
  endedAt?: number;
}

type SubagentSsePayload =
  | { type: "snapshot"; subagent: SubagentSnapshot }
  | { type: "delta"; channel: "text" | "reasoning"; delta: string; timestamp: number }
  | { type: "step_update"; step: AgentStepItem; timestamp: number }
  | { type: "run_finished"; subagent: SubagentSnapshot; timestamp: number };

const KIND_LABELS: Record<string, { zh: string; en: string }> = {
  research: { zh: "调研", en: "Research" },
  coder: { zh: "实现", en: "Coder" },
  reviewer: { zh: "审查", en: "Reviewer" },
  browser: { zh: "浏览器", en: "Browser" },
  general: { zh: "协作", en: "Subagent" },
};

export function SubagentStageView({
  subagentId,
  fallbackRole,
  locale,
}: {
  subagentId: string;
  fallbackRole?: string | undefined;
  locale: ChatLocaleMessages;
}) {
  const [snap, setSnap] = useState<SubagentSnapshot | null>(null);
  const [steps, setSteps] = useState<AgentStepItem[]>([]);
  const [content, setContent] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSnap(null);
    setSteps([]);
    setContent("");
    setReasoning("");
    setActionError(null);

    const es = new EventSource(`/api/subagents/${encodeURIComponent(subagentId)}/stream`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SubagentSsePayload;
        if (data.type === "snapshot") {
          setSnap(data.subagent);
          setSteps(data.subagent.steps ?? []);
          setContent(data.subagent.output ?? "");
          setReasoning(data.subagent.reasoning ?? "");
        } else if (data.type === "delta" && data.delta) {
          if (data.channel === "text") {
            setContent((prev) => `${prev}${data.delta}`);
          } else {
            setReasoning((prev) => `${prev}${data.delta}`);
          }
        } else if (data.type === "step_update") {
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.id === data.step.id);
            return idx >= 0 ? prev.map((s, i) => (i === idx ? data.step : s)) : [...prev, data.step];
          });
        } else if (data.type === "run_finished") {
          setSnap(data.subagent);
          setSteps(data.subagent.steps ?? []);
          setContent(data.subagent.output ?? "");
          if (data.subagent.reasoning !== undefined) setReasoning(data.subagent.reasoning);
        }
      } catch {
        // 忽略格式异常的 SSE 心跳或残片。
      }
    };
    return () => {
      es.close();
    };
  }, [subagentId]);

  const isRunning = snap?.status === "running";
  const isDone = snap?.status === "done";
  const isError = snap?.status === "error";
  const role = snap?.role || fallbackRole || subagentId;
  const kindInfo = KIND_LABELS[snap?.kind ?? "general"] ?? KIND_LABELS.general!;
  const durationMs = snap?.endedAt && snap.startedAt ? Math.max(0, snap.endedAt - snap.startedAt) : undefined;

  const handleStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await fetch(`/api/subagents/${encodeURIComponent(subagentId)}/stop`, { method: "POST" });
    } finally {
      setStopping(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || sending || isRunning) return;
    setSending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/subagents/${encodeURIComponent(subagentId)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(body.error ?? (locale.isZh ? "发送追问失败" : "Failed to send follow-up"));
        return;
      }
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.stage} aria-label={role}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <IconRobot size={16} aria-hidden="true" />
          <span className={styles.roleTitle} title={role}>{role}</span>
          <span className={styles.kindBadge}>{locale.isZh ? kindInfo.zh : kindInfo.en}</span>
          <span
            className={`${styles.statusBadge} ${
              isRunning ? styles.statusRunning : isDone ? styles.statusDone : isError ? styles.statusError : ""
            }`}
          >
            {isRunning && <IconLoader2 size={13} aria-hidden="true" />}
            {isDone && <IconCheck size={13} aria-hidden="true" />}
            {isRunning
              ? (locale.isZh ? "正在工作" : "Working")
              : isDone
                ? (locale.isZh ? "已完成" : "Done")
                : isError
                  ? (locale.isZh ? "出错" : "Error")
                  : (locale.isZh ? "已停止" : "Stopped")}
          </span>
        </div>
        {isRunning && (
          <button type="button" className={styles.stopBtn} disabled={stopping} onClick={() => void handleStop()}>
            <IconPlayerStop size={13} aria-hidden="true" />
            <span>{locale.isZh ? "停止" : "Stop"}</span>
          </button>
        )}
      </header>

      <div ref={scrollRef} className={styles.scrollBody}>
        {snap?.prompt && (
          <details className={styles.promptBox}>
            <summary className={styles.promptSummary}>
              {locale.isZh ? "来自主智能体的任务指令" : "Message from Parent Agent"}
            </summary>
            <div className={styles.promptBody}>{snap.prompt}</div>
          </details>
        )}

        <div className={styles.timelineWrap}>
          <AssistantTimeline
            locale={locale}
            content={content}
            reasoning={reasoning}
            steps={steps}
            createdAt={snap?.startedAt ?? Date.now()}
            runDurationMs={durationMs}
            isStreaming={Boolean(isRunning)}
            defaultCollapsed={isDone}
            pendingApproval={null}
            onResolveApproval={() => {}}
            onOpenFile={() => {}}
          />
        </div>

        {isDone && (
          <div className={styles.receiptBanner} role="status">
            <IconCheck size={15} className={styles.receiptIcon} aria-hidden="true" />
            <span>
              {locale.isZh
                ? "任务已完成，结果已回传给主智能体。"
                : "Task complete; result has been sent back to the parent agent."}
            </span>
          </div>
        )}

        {(isError || actionError) && (
          <div className={styles.errorBanner} role="alert">
            {actionError || snap?.error || (locale.isZh ? "子智能体执行异常" : "Subagent error")}
          </div>
        )}
      </div>

      <form className={styles.footer} onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          className={styles.input}
          value={draft}
          disabled={isRunning || sending}
          placeholder={locale.isZh ? "向此子智能体继续提问或补充指令…" : "Message subagent…"}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className={styles.sendBtn} disabled={isRunning || sending || !draft.trim()}>
          <IconSend size={14} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
