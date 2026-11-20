// 后台运行轮询：切走生成中的会话后定期检查 Host 是否收尾，以便刷新未读与列表。
import { fetchJson } from "./chat-http";
import type { ChatStoreSnapshot } from "./chat-types";

export class ChatBackgroundRuns {
  private readonly sessionIds = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getState: () => ChatStoreSnapshot,
    private readonly refreshMeta: (projectPath?: string) => Promise<void>,
  ) {}

  /** 切走正在生成中的会话时登记后台轮询，以便完成后即时刷新未读小点。 */
  trackLeavingActiveRun(nextSessionId: string | null): void {
    const state = this.getState();
    const prevId = state.activeSessionId;
    if (state.runningRunId && prevId && prevId !== nextSessionId) {
      this.sessionIds.add(prevId);
      this.schedule();
    }
    if (nextSessionId) {
      this.sessionIds.delete(nextSessionId);
    }
  }

  schedule(): void {
    if (typeof window === "undefined") return;
    if (this.timer !== null || this.sessionIds.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, 1500);
  }

  private async poll(): Promise<void> {
    const ids = Array.from(this.sessionIds);
    if (ids.length === 0) return;
    let finishedAny = false;
    await Promise.all(
      ids.map(async (id) => {
        const res = await fetchJson<{ run: { status: string } | null }>(
          `/api/agent/sessions/${encodeURIComponent(id)}/active-run`,
        ).catch(() => null);
        if (res && (!res.run || res.run.status !== "running")) {
          this.sessionIds.delete(id);
          finishedAny = true;
        }
      }),
    );
    if (finishedAny) {
      await this.refreshMeta();
    }
    if (this.sessionIds.size > 0) {
      this.schedule();
    }
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.sessionIds.clear();
  }
}