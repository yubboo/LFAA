// 消息反馈 Hook：读取已保存的赞/踩状态，并在切换时立即落盘；失败回滚界面状态。
import { useCallback, useEffect, useState } from "react";

/** 每个会话的反馈映射缓存：避免每条消息的操作栏各自发一次请求。 */
const sessionFeedback = new Map<string, Promise<Map<string, string>>>();

function loadSessionFeedback(sessionId: string): Promise<Map<string, string>> {
  const cached = sessionFeedback.get(sessionId);
  if (cached) return cached;
  const pending = fetch(`/api/feedback?sessionId=${encodeURIComponent(sessionId)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { feedback?: Array<{ messageId: string; rating: string }> } | null) => {
      const map = new Map<string, string>();
      for (const item of data?.feedback ?? []) map.set(item.messageId, item.rating);
      return map;
    })
    .catch(() => {
      // 失败不缓存，下次挂载或切换时重试。
      sessionFeedback.delete(sessionId);
      return new Map<string, string>();
    });
  sessionFeedback.set(sessionId, pending);
  return pending;
}

/** 管理单条助手消息的反馈状态；sessionId/messageId 为空时不发请求。 */
export function useMessageFeedback(sessionId: string, messageId: string) {
  const [liked, setLiked] = useState(false);

  // 刷新后回读已保存的赞；同一会话的多次挂载共用一个请求。
  useEffect(() => {
    if (!sessionId || !messageId) return;
    let cancelled = false;
    void loadSessionFeedback(sessionId).then((map) => {
      if (!cancelled) setLiked(map.get(messageId) === "up");
    });
    return () => { cancelled = true; };
  }, [sessionId, messageId]);

  // 点赞/取消都立即落盘；失败回滚界面状态，避免显示与服务端不一致。
  const toggleLiked = useCallback(async () => {
    if (!sessionId || !messageId) return;
    const next = !liked;
    setLiked(next);
    try {
      if (next) {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, messageId, rating: "up" }),
        });
        if (!res.ok) throw new Error(`feedback ${res.status}`);
      } else {
        await fetch(
          `/api/feedback?sessionId=${encodeURIComponent(sessionId)}&messageId=${encodeURIComponent(messageId)}`,
          { method: "DELETE" },
        );
      }
      const map = await loadSessionFeedback(sessionId);
      if (next) map.set(messageId, "up");
      else map.delete(messageId);
    } catch {
      setLiked(!next);
    }
  }, [liked, messageId, sessionId]);

  return { liked, toggleLiked };
}