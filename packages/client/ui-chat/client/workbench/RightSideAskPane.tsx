// 右栏「侧边提问」面板：在不打断主聊天长流的前提下进行轻量上下文问答。
import { useState, type FormEvent } from "react";
import { IconSend } from "@tabler/icons-react";
import styles from "./AgentContextPanel.module.css";

interface SideQaEntry {
  id: string;
  question: string;
  answer: string;
}

export function RightSideAskPane({
  isZh,
  profileId,
  contextHint,
}: {
  isZh: boolean;
  profileId?: string | undefined;
  contextHint: string;
}) {
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<SideQaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agent/side-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, contextHint, ...(profileId ? { profileId } : {}) }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "请求失败");
      setItems((prev) => [{ id: String(Date.now()), question: q, answer: data.answer ?? "" }, ...prev]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.subviewStack}>
      <form className={styles.inlineForm} onSubmit={(e) => void handleSubmit(e)}>
        <input
          className={styles.inlineInput}
          value={question}
          placeholder={isZh ? "就当前项目或页面提个小问题…" : "Ask a quick side question…"}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className={styles.inlineBtn} disabled={loading || !question.trim()}>
          <IconSend size={13} aria-hidden="true" />
        </button>
      </form>
      {error && <p className={styles.errorBanner} role="alert">{error}</p>}
      {items.length === 0 ? (
        <div className={styles.emptyBox}>
          <span>{isZh ? "侧边提问不会写入主对话历史，适合随手查概念、正则或报错解释。" : "Side questions stay separate from your main chat thread."}</span>
        </div>
      ) : (
        <div className={styles.listStack}>
          {items.map((item) => (
            <div key={item.id} className={styles.taskCard}>
              <div className={styles.sideAskQ}>{item.question}</div>
              <div className={styles.sideAskA}>{item.answer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
