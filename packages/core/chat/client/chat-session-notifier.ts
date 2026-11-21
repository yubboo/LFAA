// 会话通知器：按通用设置决定何时播放提示音、弹桌面通知，并对轮次完成提醒做短时去重。
import { playNotificationSound } from "./notification-sounds";
import { shouldNotifyTurn, showDesktopNotification } from "./notifications";
import type { ChatSessionAttention, ChatStoreSnapshot } from "./chat-types";

export class ChatSessionNotifier {
  /** 近期已发过「轮次完成」通知的会话，避免 SSE 收尾与轮询兜底重复提醒。 */
  private readonly finishedNotified = new Map<string, number>();

  constructor(private readonly getState: () => ChatStoreSnapshot) {}

  /** 开始新一轮时清掉上一轮的完成提醒记录。 */
  markRunStarted(sessionId: string): void {
    this.finishedNotified.delete(sessionId);
  }

  /** 会话进入待确认/待回答时提醒；当前会话由界面自身提示，避免重复打扰。 */
  notifyAttention(item: ChatSessionAttention): void {
    const state = this.getState();
    if (item.sessionId === state.activeSessionId) return;
    const settings = state.generalSettings;
    if (item.kind === "approval" && !settings.enableApprovalNotification) return;
    if (item.kind === "question" && !settings.enableQuestionNotification) return;
    const sound = item.kind === "approval"
      ? settings.approvalSound ?? settings.notificationSound
      : settings.questionSound ?? settings.notificationSound;
    void playNotificationSound(sound);
    const title = this.sessionTitle(item.sessionId);
    showDesktopNotification({
      title: item.kind === "approval" ? "会话等待确认 · LFAA" : "会话等待回答 · LFAA",
      body: item.kind === "approval"
        ? `${title}：${item.toolName ? `需要批准 ${item.toolName}` : "需要你的批准"}`
        : `${title}：${item.question ?? "有一个问题需要你回答"}`,
      tag: `lfaa-attention-${item.sessionId}`,
    });
  }

  /** SSE 收尾与轮询兜底共用：同一会话短时间只提醒一次。 */
  notifyTurnFinished(sessionId: string): void {
    const now = Date.now();
    const last = this.finishedNotified.get(sessionId) ?? 0;
    if (now - last < 4_000) return;
    const state = this.getState();
    // 同一轮已经出现待回答徽标时，问题通知已经提示过，不再叠加完成提醒。
    if (state.attention.some((item) => item.sessionId === sessionId && item.kind === "question")) return;
    if (!shouldNotifyTurn(state.generalSettings.turnCompleteNotification)) return;
    this.finishedNotified.set(sessionId, now);
    void playNotificationSound(state.generalSettings.completionSound ?? state.generalSettings.notificationSound);
    showDesktopNotification({
      title: "轮次完成 · LFAA",
      body: `“${this.sessionTitle(sessionId)}”已完成本轮回复`,
      tag: `lfaa-finished-${sessionId}`,
    });
  }

  private sessionTitle(sessionId: string): string {
    return this.getState().sessions.find((session) => session.id === sessionId)?.title ?? "聊天会话";
  }
}