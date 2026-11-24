// 管理空会话项目起步建议与首轮回复追问建议的异步拉取及本地缓存。
import { useEffect, useState } from "react";
import type { ChatMessageItem } from "../store/chat-types";
import { extractAdviceOptions } from "./advice-options";

/** 按项目缓存空会话起步建议，并在首轮纯文本回复结束后请求追问建议。 */
export function useChatSuggestions({
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
  const [suggestionsByMessage, setSuggestionsByMessage] = useState<Record<string, string[]>>({});

  // 空会话且绑定项目时，向 Host 请求围绕该项目的起步建议（按项目缓存，失败回退通用引导）。
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

  // 底部生成式推荐只在新会话的第一轮触发；已有内联编号选项或媒体结果时不重复生成。
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (activeKind && activeKind !== "chat") return;
    if (!last || last.role !== "assistant" || last.status === "streaming" || last.clarification || !last.content.trim()) return;
    if (suggestionsByMessage[last.id]) return;
    if (/!\[[^\]]*\]\(\/api\/media\/file\?/u.test(last.content)) return;
    if (extractAdviceOptions(last.content).length >= 2) return;
    const assistantTurns = messages.filter((message) => message.role === "assistant").length;
    if (assistantTurns !== 1) return;
    const prompt = messages[messages.length - 2]?.role === "user" ? (messages[messages.length - 2]?.content ?? "") : "";
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt: prompt, assistantReply: last.content }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (cancelled || !Array.isArray(data.suggestions)) return;
        const fresh = data.suggestions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 3);
        if (fresh.length === 0) return;
        setSuggestionsByMessage((prev) => ({ ...prev, [last.id]: fresh }));
      } catch {
        // 生成失败时不出选项，不回退到模板。
      }
    })();
    return () => { cancelled = true; };
  }, [activeKind, messages, suggestionsByMessage]);

  return {
    starterSuggestions: activeProjectId ? startersByProject[activeProjectId] ?? null : null,
    suggestionsByMessage,
  };
}
