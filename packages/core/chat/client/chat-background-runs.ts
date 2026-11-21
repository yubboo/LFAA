// 后台运行与待处理跟踪：维护运行中会话、需要用户确认/回答的会话，并在收尾或升级为待处理时触发通知。
import { fetchJson } from "./chat-http";
import type { ChatSessionAttention, ChatStoreSnapshot } from "./chat-types";

/** 会话状态轮询间隔：有运行任务时更频繁，只剩待回答问题时放慢。 */
const RUNNING_POLL_MS = 1_500;
const ATTENTION_POLL_MS = 4_000;

export class ChatBackgroundRuns {
  private readonly sessionIds = new Set<string>();
  private attention = new Map<string, ChatSessionAttention>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getState: () => ChatStoreSnapshot,
    private readonly publishRunning: (sessionIds: string[]) => void,
    private readonly publishAttention: (items: ChatSessionAttention[]) => void,
    private readonly notifyAttention: (item: ChatSessionAttention) => void,
    private readonly notifyRunFinished: (sessionId: string) => void,
    private readonly refreshMeta: (projectPath?: string) => Promise<void>,
  ) {}

  /** 首屏同步：以 Host 为准恢复运行中与待处理会话，但不补发历史通知。 */
  sync(input: { sessionIds: string[]; attention: ChatSessionAttention[] }): void {
    this.replaceRunning(input.sessionIds);
    this.replaceAttention(input.attention, false);
    this.schedule();
  }

  /** 本客户端确认任务开始/结束时立即更新，避免转圈等到下一次轮询才出现或消失。 */
  markRunning(sessionId: string, running: boolean): void {
    const changed = running ? !this.sessionIds.has(sessionId) : this.sessionIds.delete(sessionId);
    if (!changed) {
      if (running) this.schedule();
      return;
    }
    if (running) this.sessionIds.add(sessionId);
    this.publishRunning([...this.sessionIds]);
    this.schedule();
  }

  /** 用户已回应/已处理某个会话，先从侧栏撤掉徽标；Host 轮询随后校正。 */
  markAttentionResolved(sessionId: string): void {
    if (!this.attention.delete(sessionId)) return;
    this.publishAttention([...this.attention.values()]);
  }

  /** 切走正在生成中的会话时保留其运行标记，转圈提示不因切换会话消失。 */
  trackLeavingActiveRun(nextSessionId: string | null): void {
    const state = this.getState();
    const prevId = state.activeSessionId;
    if (state.runningRunId && prevId && prevId !== nextSessionId) {
      this.markRunning(prevId, true);
    }
  }

  schedule(): void {
    if (typeof window === "undefined") return;
    if (this.timer !== null) return;
    if (this.sessionIds.size === 0 && this.attention.size === 0) return;
    const delay = this.sessionIds.size > 0 ? RUNNING_POLL_MS : ATTENTION_POLL_MS;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, delay);
  }

  // 同时校正运行集合与待处理集合；集合变化时刷新会话列表，并只对新出现/升级的状态发通知。
  private async poll(): Promise<void> {
    const runningBefore = new Set(this.sessionIds);
    let runningChanged = false;
    let attentionChanged = false;
    try {
      const [activeRes, attentionRes] = await Promise.all([
        fetchJson<{ sessionIds: string[] }>("/api/agent/active-sessions").catch(() => null),
        fetchJson<{ items: ChatSessionAttention[] }>("/api/agent/attention").catch(() => null),
      ]);
      if (activeRes && Array.isArray(activeRes.sessionIds)) {
        runningChanged = this.replaceRunning(activeRes.sessionIds);
      }
      if (attentionRes && Array.isArray(attentionRes.items)) {
        attentionChanged = this.replaceAttention(attentionRes.items, true);
      }
      if (runningChanged || attentionChanged) {
        await this.refreshMeta();
      }
      // 已结束的后台任务：若同一轮出现了待回答徽标，由问题通知覆盖，避免双重提示。
      for (const sessionId of runningBefore) {
        if (!this.sessionIds.has(sessionId)) this.notifyRunFinished(sessionId);
      }
    } catch {
      // 一次轮询失败不中断状态机：保留当前集合，下一轮继续校正。
    } finally {
      this.schedule();
    }
  }

  private replaceRunning(sessionIds: string[]): boolean {
    const next = new Set(
      sessionIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    );
    const before = [...this.sessionIds].sort().join("\n");
    const after = [...next].sort().join("\n");
    if (before === after) return false;
    this.sessionIds.clear();
    for (const id of next) this.sessionIds.add(id);
    this.publishRunning([...this.sessionIds]);
    return true;
  }

  private replaceAttention(items: ChatSessionAttention[], notify: boolean): boolean {
    const next = new Map<string, ChatSessionAttention>();
    for (const item of items) {
      if (!item || typeof item.sessionId !== "string") continue;
      if (item.kind !== "approval" && item.kind !== "question") continue;
      next.set(item.sessionId, item);
    }
    const previous = this.attention;
    const before = [...previous.entries()].map(([id, item]) => `${id}:${item.kind}`).sort().join("\n");
    const after = [...next.entries()].map(([id, item]) => `${id}:${item.kind}`).sort().join("\n");
    const changed = before !== after;
    this.attention = next;
    if (changed) this.publishAttention([...next.values()]);
    if (notify && changed) {
      for (const [sessionId, item] of next) {
        const prev = previous.get(sessionId);
        if (!prev || prev.kind !== item.kind) this.notifyAttention(item);
      }
    }
    return changed;
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.sessionIds.clear();
    this.attention.clear();
  }
}