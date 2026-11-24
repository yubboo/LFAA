// 运行事件归并：把 Host 推送的快照、增量、步骤、审批与结束事件写进当前会话，断流时记录降级状态。
// 从 ChatRunActions 拆出：回调工厂不持有客户端实例，便于用假 store 单测每个事件的分支。
import type { AgentStreamClientHandlers } from "./stream-client";
import { fetchJson } from "./chat-http";
import { playNotificationSound } from "../shared/notification-sounds";
import { isBrowserAutomationStep } from "../shared/agent-workbench-sync";
import { takeQueuedHead } from "./chat-queue";
import type { AgentStepItem, ChatMessageItem, ChatSessionDetail } from "./chat-types";
import type { ChatStorePort } from "./chat-store-port";

/** 一个运行的事件上下文：会话归属、消息归属与关闭回调。 */
export interface RunStreamContext {
  port: ChatStorePort;
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  /** 流已终止（正常结束或降级）：调用方据此清理持有的客户端实例。 */
  onStreamClosed: () => void;
  /** 运行正常收尾后回调：调度层用它探测目标自动续跑是否已经启动。 */
  onSettled?: () => void;
}

/** 组装十个事件回调；每个回调只做「读取当前状态 → 必要校验 → patch」。 */
export function createRunStreamHandlers({
  port,
  runId,
  sessionId,
  assistantMessageId,
  onStreamClosed,
  onSettled,
}: RunStreamContext): AgentStreamClientHandlers {
  const revealedBrowserPreviews = new Set<string>();
  const applyWorkbenchStep = (step: AgentStepItem, previousStep?: AgentStepItem) => {
    if (step.toolName === "browser_present" && step.status === "done") {
      if (port.getState().activeSessionId !== sessionId || revealedBrowserPreviews.has(step.id)) return;
      revealedBrowserPreviews.add(step.id);
      // 快速轮次可能在 SSE 连上前完成，详情已有结果也不能当成右栏已展开。
      port.applyAgentStepWorkbenchAction?.(sessionId, assistantMessageId, step);
      return;
    }
    port.applyAgentStepWorkbenchAction?.(sessionId, assistantMessageId, step, previousStep);
  };

  const revealSavedPreview = (steps: AgentStepItem[] = []) => {
    const preview = steps.filter((step) => step.toolName === "browser_present" && step.status === "done").at(-1);
    if (preview) applyWorkbenchStep(preview);
  };

  const patchAssistant = (updater: (msg: ChatMessageItem) => ChatMessageItem) => {
    const curr = port.getState().activeSession;
    if (!curr || curr.id !== sessionId) return;
    port.patchState({
      activeSession: {
        ...curr,
        messages: curr.messages.map((m) => (m.id === assistantMessageId ? updater(m) : m)),
      },
    });
  };

  return {
    onSnapshot: (run, reconnect) => {
      const previous = port.getState().activeSession?.messages.find((item) => item.id === assistantMessageId)?.steps;
      patchAssistant((m) => ({
        ...m,
        ...(!reconnect ? { content: run.content, reasoning: run.reasoning } : {}),
        steps: run.steps,
        ...(run.tokenUsage ? { tokenUsage: run.tokenUsage } : {}),
        ...(run.metrics ? { metrics: run.metrics } : {}),
        ...(run.cost ? { cost: run.cost } : {}),
      }));
      revealSavedPreview(run.steps);
      const currentBrowser = run.steps?.find((step) => step.status === "running" && isBrowserAutomationStep(step));
      if (currentBrowser) applyWorkbenchStep(currentBrowser, previous?.find((step) => step.id === currentBrowser.id));
      const firstPending = run.pendingApprovals?.[0];
      if (port.getState().activeSessionId === sessionId) {
        port.patchState({ pendingApproval: firstPending ? { ...firstPending, runId } : null });
      }
    },
    onDeltaBatch: (batch) => {
      patchAssistant((m) => {
        let nextSteps = m.steps;
        // 同步把流式思考增量写到对应轮次的 think 步骤，支持多轮思维链实时逐字展示。
        if (batch.reasoning) {
          const existing = m.steps ?? [];
          if (existing.length > 0) {
            const iterEntries = batch.reasoningByIteration && batch.reasoningByIteration.length > 0
              ? batch.reasoningByIteration
              : null;
            let mutated = false;
            const updated = existing.slice();
            if (iterEntries) {
              for (const entry of iterEntries) {
                const idx = updated.findIndex((s) => s.id === `think-${entry.iteration}`);
                if (idx >= 0) {
                  const prev = updated[idx]!;
                  const detail = `${prev.detail ?? ""}${entry.text}`;
                  updated[idx] = { ...prev, detail: detail.length > 24_000 ? detail.slice(-24_000) : detail };
                  mutated = true;
                }
              }
            } else {
              let activeThinkIdx = -1;
              for (let i = updated.length - 1; i >= 0; i -= 1) {
                const candidate = updated[i];
                if (candidate && candidate.phase === "think" && candidate.status === "running") {
                  activeThinkIdx = i;
                  break;
                }
              }
              if (activeThinkIdx >= 0) {
                const prev = updated[activeThinkIdx]!;
                const detail = `${prev.detail ?? ""}${batch.reasoning}`;
                updated[activeThinkIdx] = { ...prev, detail: detail.length > 24_000 ? detail.slice(-24_000) : detail };
                mutated = true;
              }
            }
            if (mutated) nextSteps = updated;
          }
        }
        return {
          ...m,
          ...(batch.reasoning ? { reasoning: `${m.reasoning ?? ""}${batch.reasoning}` } : {}),
          ...(batch.text ? { content: `${m.content}${batch.text}` } : {}),
          ...(nextSteps !== m.steps ? { steps: nextSteps } : {}),
        };
      });
    },
    onStepUpdate: (step) => {
      let effectiveStep = step;
      let previousStep: AgentStepItem | undefined;
      patchAssistant((m) => {
        const existing = m.steps ?? [];
        const idx = existing.findIndex((s) => s.id === step.id);
        previousStep = existing[idx];
        // Host 4 秒活动心跳不含 detail 时，保留浏览器端已流式累积的思考正文不被清空。
        const mergedStep = idx >= 0 && step.phase === "think" && !step.detail && existing[idx]?.detail
          ? { ...step, detail: existing[idx]!.detail }
          : step;
        effectiveStep = mergedStep;
        const nextSteps = idx >= 0
          ? existing.map((s, i) => (i === idx ? mergedStep : s))
          : [...existing, mergedStep];
        return { ...m, steps: nextSteps };
      });
      applyWorkbenchStep(effectiveStep, previousStep);
      if (step.toolName?.startsWith("goal_") && step.status === "done") void port.refreshGoal(sessionId);
    },
    onTodos: (todos) => {
      const active = port.getState().activeSession;
      if (active?.id === sessionId) port.patchState({ activeSession: { ...active, todos } });
    },
    // 实时用量随每轮模型/工具结束推送，保证统计栏在运行中也持续变化。
    onUsage: ({ tokenUsage, metrics, cost }) => {
      patchAssistant((m) => ({
        ...m,
        tokenUsage,
        ...(metrics ? { metrics } : {}),
        ...(cost ? { cost } : {}),
      }));
    },
    onApprovalRequired: (approval) => {
      // 只有当前打开的会话才占用审批横幅与提示音；后台会话交给侧栏徽标和轮询通知。
      if (port.getState().activeSessionId !== sessionId) return;
      const settings = port.getState().generalSettings;
      if (settings.enableApprovalNotification) {
        void playNotificationSound(settings.approvalSound ?? settings.notificationSound);
      }
      port.patchState({ pendingApproval: { ...approval, runId } });
    },
    onApprovalResolved: (approvalId) => {
      const pending = port.getState().pendingApproval;
      if (pending?.runId === runId && pending.approvalId === approvalId) port.patchState({ pendingApproval: null });
    },
    onStatusNotice: (notice) => {
      if (port.getState().activeSessionId === sessionId && port.getState().streamStatusNotice !== notice) {
        port.patchState({ streamStatusNotice: notice, degradedStream: null });
      }
    },
    onFinished: ({ fps, message, status, error }) => {
      onStreamClosed();
      // 结束即撤掉侧栏转圈；即使已切到别的会话，后台轮询也会兜底校正。
      port.markSessionRunning(sessionId, false);
      void port.refreshGoal(sessionId);
      if (message?.id === assistantMessageId) {
        patchAssistant(() => message);
        revealSavedPreview(message.steps);
      }
      if (fps !== undefined) {
        void fetchJson("/api/agent/metrics/render", {
          method: "POST",
          body: JSON.stringify({ fps }),
        }).catch(() => {});
      }
      const isActiveSession = port.getState().activeSessionId === sessionId;
      // 澄清问题在后台由轮询的「待回答」通知统一提示；普通结束才发轮次完成提醒。
      const hasQuestion = Boolean(message?.clarification);
      if (!hasQuestion || isActiveSession) {
        port.notifyRunFinished(sessionId);
      }
      if (isActiveSession) {
        const { head: nextQueued, rest: restQueued } = takeQueuedHead(port.getState().queuedMessages);
        port.patchState({
          runningRunId: null,
          pendingApproval: null,
          streamStatusNotice: "",
          degradedStream: null,
          ...(status === "error" && error ? { errorMessage: error } : {}),
          queuedMessages: message?.clarification ? port.getState().queuedMessages : restQueued,
        });
        void port.updateSessionMeta(sessionId, { unread: false });
        const ready = message ? Promise.resolve() : port.openSession(sessionId);
        void ready.then(() => {
          void port.refreshMeta();
          if (nextQueued && !message?.clarification) {
            void port.sendMessage(nextQueued.text);
          }
        });
      } else {
        void port.refreshMeta();
      }
      onSettled?.();
    },
    onDegraded: (lastSeq, reason) => {
      onStreamClosed();
      if (port.getState().activeSessionId === sessionId) {
        port.patchState({
          runningRunId: null,
          streamStatusNotice: `流式连接中断（${reason}），已加载服务端已保存内容，可手动重试恢复。`,
          degradedStream: { runId, sessionId, assistantMessageId, lastSeq },
        });
      }
      void fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`)
        .then((res) => {
          if (port.getState().activeSessionId === sessionId) {
            port.patchState({ activeSession: res.session });
          }
        })
        .catch(() => {});
    },
  };
}
