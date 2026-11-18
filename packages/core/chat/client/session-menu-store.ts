// 管理左二聊天会话行的右侧悬浮信息卡与「⋮」操作菜单状态，支持悬停延迟平滑过渡。
export interface SessionAnchorRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SessionMenuSnapshot {
  hoverCard: { sessionId: string; rect: SessionAnchorRect } | null;
  actionMenu: { sessionId: string; rect: SessionAnchorRect } | null;
  renameTargetId: string | null;
  deleteTargetId: string | null;
}

function toRect(el: HTMLElement): SessionAnchorRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
}

export class SessionMenuStore {
  private snapshot: SessionMenuSnapshot = {
    hoverCard: null,
    actionMenu: null,
    renameTargetId: null,
    deleteTargetId: null,
  };
  private listeners = new Set<() => void>();
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSessionId: string | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionMenuSnapshot => this.snapshot;

  private update(patch: Partial<SessionMenuSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private clearTimers(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.openTimer = null;
    this.closeTimer = null;
    this.pendingSessionId = null;
  }

  onRowEnter(sessionId: string, rowEl: HTMLElement): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.snapshot.actionMenu) return;
    if (this.snapshot.hoverCard?.sessionId === sessionId) return;
    if (this.openTimer) clearTimeout(this.openTimer);
    this.pendingSessionId = sessionId;
    const rect = toRect(rowEl);
    const delay = this.snapshot.hoverCard ? 65 : 110;
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.pendingSessionId = null;
      if (this.snapshot.actionMenu || !rowEl.isConnected) return;
      this.update({ hoverCard: { sessionId, rect } });
    }, delay);
  }

  closeHoverCard(): void {
    this.clearTimers();
    if (!this.snapshot.hoverCard) return;
    this.update({ hoverCard: null });
  }

  onRowLeave(sessionId: string): void {
    if (this.openTimer && this.pendingSessionId === sessionId) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
      this.pendingSessionId = null;
    }
    if (this.snapshot.hoverCard?.sessionId !== sessionId) return;
    if (this.closeTimer) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (this.snapshot.hoverCard?.sessionId === sessionId) {
        this.update({ hoverCard: null });
      }
    }, 130);
  }

  onCardEnter(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  onCardLeave(): void {
    this.closeTimer = setTimeout(() => {
      this.update({ hoverCard: null });
    }, 120);
  }

  toggleActionMenu(sessionId: string, triggerEl: HTMLElement): void {
    this.clearTimers();
    const isSame = this.snapshot.actionMenu?.sessionId === sessionId;
    this.update({
      hoverCard: null,
      actionMenu: isSame ? null : { sessionId, rect: toRect(triggerEl) },
    });
  }

  openRename(sessionId: string): void {
    this.clearTimers();
    this.update({ hoverCard: null, actionMenu: null, renameTargetId: sessionId });
  }

  openDelete(sessionId: string): void {
    this.clearTimers();
    this.update({ hoverCard: null, actionMenu: null, deleteTargetId: sessionId });
  }

  closeDialogs(): void {
    this.update({ renameTargetId: null, deleteTargetId: null });
  }

  closeAll(): void {
    this.clearTimers();
    if (!this.snapshot.hoverCard && !this.snapshot.actionMenu) return;
    this.update({ hoverCard: null, actionMenu: null });
  }

  isHighlighted(sessionId: string): boolean {
    return (
      this.snapshot.actionMenu?.sessionId === sessionId
      || this.snapshot.hoverCard?.sessionId === sessionId
    );
  }

  dispose(): void {
    this.clearTimers();
    this.listeners.clear();
  }
}
