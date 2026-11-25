// 按项目拉取并缓存空会话的起步建议；追问建议不再单独请求，由模型在回复末尾随答案一起给出。
import { useEffect, useState } from "react";
import type { ChatMessageItem } from "../store/chat-types";

/** 空会话且绑定项目时，向 Host 请求围绕该项目的起步建议（按项目缓存，失败回退通用引导）。 */
export function useStarterSuggestions({
  messages,
  activeProjectId,
  activeKind,
  homeSuggestions,
}: {
  messages: ChatMessageItem[];
  activeProjectId: string | null;
  activeKind: string | undefined;
  homeSuggestions: boolean;
}) {
  const [startersByProject, setStartersByProject] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (messages.length > 0 || !activeProjectId || !homeSuggestions || (activeKind && activeKind !== "chat")) return;
    if (startersByProject[activeProjectId]) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/starter-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: activeProjectId }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (cancelled || !Array.isArray(data.suggestions) || data.suggestions.length === 0) return;
        setStartersByProject((prev) => ({ ...prev, [activeProjectId]: data.suggestions ?? [] }));
      } catch {
        // 生成失败时回退到通用引导。
      }
    })();
    return () => { cancelled = true; };
  }, [messages.length, activeProjectId, activeKind, homeSuggestions, startersByProject]);

  return activeProjectId ? startersByProject[activeProjectId] ?? null : null;
}