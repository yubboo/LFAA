// 独立展示当前会话的真实消息与 Agent 步骤，实时复用聊天 Store 中的快照。
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentStepItem, ChatMessageItem, PendingApprovalBanner } from "../chat-types";
import type { ChatLocaleMessages } from "../locales";
import { latestSessionTodos } from "../session-todos";
import { describeStep, TimelineApproval } from "./StepTraceList";
import { StepDetail } from "./Step-Detail";
import { TodoDock } from "./TodoDock";
import styles from "./Conversation-Trace.module.css";

/** 轨迹行与详情共用步骤对象，更新时按 id 重新读取而非保存旧快照。 */
export function ConversationTrace({ messages, locale, target, pendingApproval, onResolveApproval }: {
  messages: ChatMessageItem[];
  locale: ChatLocaleMessages;
  target?: { messageId: string; stepId: string } | null | undefined;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => target ? `${target.messageId}:${target.stepId}` : null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: "nearest" }); }, [selectedId]);
  const rows = useMemo(() => messages.flatMap((message) => {
    const result: Array<{ id: string; label: string; kind: string; step?: AgentStepItem }> = [];
    if (message.role === "user") result.push({ id: message.id, kind: locale.isZh ? "输入" : "Input", label: message.content });
    else {
      const text = message.status === "streaming" ? message.content : (message.progressText || message.content);
      let offset = 0;
      for (const step of message.steps ?? []) {
        const next = Math.max(offset, Math.min(text.length, step.textOffset ?? offset));
        const progress = text.slice(offset, next).trim();
        if (progress) result.push({ id: `${message.id}:text:${offset}`, kind: locale.isZh ? "助手" : "Assistant", label: progress });
        offset = next;
        result.push({ id: `${message.id}:${step.id}`, kind: step.phase === "act" ? (locale.isZh ? "工具" : "Tool") : (locale.isZh ? "助手" : "Assistant"), label: describeStep(step, locale.isZh), step });
      }
      if (text.slice(offset).trim()) result.push({ id: `${message.id}:text:${offset}`, kind: locale.isZh ? "助手" : "Assistant", label: text.slice(offset) });
      if (message.progressText && message.content.trim()) result.push({ id: `${message.id}:answer`, kind: locale.isZh ? "助手" : "Assistant", label: message.content });
    }
    return result;
  }), [messages, locale.isZh]);
  const filtered = rows.filter((row) => `${row.kind} ${row.label} ${row.step?.argsPreview ?? ""} ${row.step?.resultPreview ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = filtered.find((row) => row.id === selectedId);
  // 轨迹视图同样展示会话当前清单，便于对照「第几轮做了什么、还剩哪些」。
  const sessionTodos = useMemo(() => latestSessionTodos(messages), [messages]);

  return (
    <section className={styles.root} aria-label={locale.isZh ? "会话轨迹" : "Conversation trace"}>
      {sessionTodos && sessionTodos.length > 0 && <TodoDock todos={sessionTodos} isZh={locale.isZh} defaultCollapsed />}
      <div className={styles.toolbar}>
        <span>{locale.isZh ? `${rows.length} 条记录` : `${rows.length} events`}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale.isZh ? "搜索轨迹" : "Search trace"} aria-label={locale.isZh ? "搜索轨迹" : "Search trace"} />
      </div>
      {pendingApproval && <TimelineApproval locale={locale} pendingApproval={pendingApproval} onResolveApproval={onResolveApproval} />}
      <div className={styles.body} data-detail={Boolean(selected)}>
        <div className={styles.list}>
          {filtered.length === 0 && <p className={styles.empty}>{query ? (locale.isZh ? "没有匹配的轨迹" : "No matching events") : (locale.isZh ? "暂无轨迹" : "No events yet")}</p>}
          {filtered.map((row) => <button type="button" key={row.id} ref={row.id === selectedId ? selectedRef : undefined} className={styles.row} aria-pressed={row.id === selectedId} onClick={() => setSelectedId(row.id)}>
            <span className={styles.kind} data-kind={row.step?.phase}>{row.kind}</span>
            <span className={styles.label}>{row.label}</span>
            {row.step && <span className={styles.meta}>{locale.isZh ? `第 ${row.step.iteration} 轮` : `Round ${row.step.iteration}`} · {({ preparing: locale.isZh ? "准备中" : "Preparing", running: locale.isZh ? "进行中" : "Running", waiting_approval: locale.isZh ? "等待审批" : "Awaiting approval", done: locale.isZh ? "已完成" : "Done", error: locale.isZh ? "失败" : "Failed" })[row.step.status]}</span>}
          </button>)}
        </div>
        {selected && <aside className={styles.detail} aria-label={locale.isZh ? "轨迹详情" : "Event details"}>
          <div className={styles.detailHead}><strong>{selected.kind}</strong><button type="button" onClick={() => setSelectedId(null)} aria-label={locale.isZh ? "关闭详情" : "Close details"}>×</button></div>
          {selected.step ? <StepDetail key={selected.id} step={selected.step} isZh={locale.isZh} /> : <p className={styles.text}>{selected.label}</p>}
        </aside>}
      </div>
    </section>
  );
}
