// 主聊天多 Agent 回合流式订阅：复用于单聊同一会话界面，实时推送各位协作 Agent 的增量与步骤。
// 关联：packages/client/ui-chat/client/store/chat-run-actions.ts；运行环境：浏览器。
import { fetchJson } from "./chat-http";
import type { ChatStorePort } from "./chat-store-port";
import type { AgentStepItem, ChatMessageItem, ChatSessionDetail } from "./chat-types";

interface GroupTurnEvent {
  type: "turn_started" | "speaker_started" | "delta" | "step_update" | "speaker_finished" | "turn_finished";
  turnId: string;
  sessionId?: string;
  agentId?: string;
  runId?: string;
  assistantMessageId?: string;
  task?: string;
  kind?: "reasoning" | "text";
  text?: string;
  step?: AgentStepItem;
  status?: "done" | "error" | "aborted";
  error?: string;
}

export interface GroupTurnStreamHandle {
  turnId: string;
  dispose: () => void;
}

/** 从用户输入解析 @提及，命中当前会话成员时返回对应 agentId 列表。 */
export function extractGroupMentions(text: string, memberIds: string[]): string[] {
  const hits: string[] = [];
  const regex = /@([^\s@，。！？,.:;]+)/gu;
  for (const match of text.matchAll(regex)) {
    const token = match[1]?.trim().toLowerCase();
    if (!token) continue;
    const found = memberIds.find((id) => {
      const lower = id.toLowerCase();
      if (lower === token) return true;
      if (lower === `cli:${token}`) return true;
      if (lower === "xiaoyu" && (token === "小鱼" || token === "xiaoyu")) return true;
      return false;
    });
    if (found && !hits.includes(found)) hits.push(found);
  }
  return hits;
}

function patchSessionMessages(
  port: ChatStorePort,
  sessionId: string,
  updater: (messages: ChatMessageItem[]) => ChatMessageItem[],
): void {
  const active = port.getState().activeSession;
  if (!active || active.id !== sessionId) return;
  port.patchState({ activeSession: { ...active, messages: updater(active.messages) } });
}

function upsertStep(steps: AgentStepItem[], next: AgentStepItem): { steps: AgentStepItem[]; previous?: AgentStepItem } {
  const idx = steps.findIndex((s) => s.id === next.id);
  if (idx === -1) return { steps: [...steps, next] };
  const copy = steps.slice();
  const previous = copy[idx];
  copy[idx] = next;
  return previous ? { steps: copy, previous } : { steps: copy };
}

/** 启动一次多 Agent 协作回合并订阅 SSE 事件，将每位发言者的内容与工具轨迹实时归并到主聊天线程。 */
export async function startGroupTurnStream(options: {
  port: ChatStorePort;
  sessionId: string;
  userMessage: string;
  mentions: string[];
  onClosed: () => void;
}): Promise<GroupTurnStreamHandle> {
  const { port, sessionId, userMessage, mentions, onClosed } = options;
  const started = await fetchJson<{ turnId: string; sessionId: string }>("/api/group/runs", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      userMessage,
      stream: true,
      ...(mentions.length > 0 ? { mentions } : {}),
    }),
  });

  // 先乐观追加用户消息，让气泡立刻出现；回合结束后由服务端完整会话覆盖对齐。
  patchSessionMessages(port, sessionId, (msgs) => [
    ...msgs,
    { id: `local-group-user-${Date.now()}`, role: "user", content: userMessage, createdAt: Date.now() },
  ]);
  port.patchState({ runningRunId: started.turnId });
  port.markSessionRunning(sessionId, true);

  const runIdToMsgId = new Map<string, string>();
  const es = new EventSource(`/api/group/turns/${encodeURIComponent(started.turnId)}/events`);
  let closed = false;

  const finish = async (notify: boolean) => {
    if (closed) return;
    closed = true;
    es.close();
    onClosed();
    if (port.getState().runningRunId === started.turnId) {
      port.patchState({ runningRunId: null });
    }
    port.markSessionRunning(sessionId, false);
    if (notify) port.notifyRunFinished(sessionId);
    const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`).catch(() => null);
    if (detail && port.getState().activeSessionId === sessionId) {
      port.patchState({
        activeSession: detail.session,
        sessions: port.getState().sessions.map((s) => (s.id === detail.session.id ? detail.session : s)),
      });
    }
    void port.refreshMeta();
  };

  es.onmessage = (raw) => {
    try {
      const ev = JSON.parse(raw.data) as GroupTurnEvent;
      if (ev.type === "speaker_started" && ev.runId && ev.assistantMessageId) {
        runIdToMsgId.set(ev.runId, ev.assistantMessageId);
        patchSessionMessages(port, sessionId, (msgs) => {
          if (msgs.some((m) => m.id === ev.assistantMessageId)) return msgs;
          return [
            ...msgs,
            {
              id: ev.assistantMessageId!,
              role: "assistant",
              content: "",
              reasoning: "",
              status: "streaming",
              createdAt: Date.now(),
              steps: [],
              ...(ev.agentId ? { authorAgentId: ev.agentId } : {}),
              ...(ev.task ? { speakerTask: ev.task } : {}),
            },
          ];
        });
      } else if (ev.type === "delta" && ev.runId && typeof ev.text === "string") {
        const msgId = runIdToMsgId.get(ev.runId);
        if (!msgId) return;
        patchSessionMessages(port, sessionId, (msgs) =>
          msgs.map((m) => {
            if (m.id !== msgId) return m;
            return ev.kind === "reasoning"
              ? { ...m, reasoning: `${m.reasoning ?? ""}${ev.text}` }
              : { ...m, content: `${m.content}${ev.text}` };
          }),
        );
      } else if (ev.type === "step_update" && ev.runId && ev.step) {
        const msgId = runIdToMsgId.get(ev.runId);
        if (!msgId) return;
        let prevStep: AgentStepItem | undefined;
        patchSessionMessages(port, sessionId, (msgs) =>
          msgs.map((m) => {
            if (m.id !== msgId) return m;
            const updated = upsertStep(m.steps ?? [], ev.step!);
            prevStep = updated.previous;
            return { ...m, steps: updated.steps };
          }),
        );
        port.applyAgentStepWorkbenchAction?.(sessionId, msgId, ev.step, prevStep);
      } else if (ev.type === "speaker_finished" && ev.runId && ev.status) {
        const msgId = runIdToMsgId.get(ev.runId);
        if (!msgId) return;
        patchSessionMessages(port, sessionId, (msgs) =>
          msgs.map((m) => {
            if (m.id !== msgId) return m;
            const fallbackError = !m.content.trim() && ev.error ? ev.error : m.content;
            return { ...m, status: ev.status!, content: fallbackError };
          }),
        );
      } else if (ev.type === "turn_finished") {
        void finish(true);
      }
    } catch {
      // 忽略单帧解析异常
    }
  };

  es.onerror = () => {
    void finish(false);
  };

  return {
    turnId: started.turnId,
    dispose: () => {
      if (closed) return;
      closed = true;
      es.close();
    },
  };
}
