// 管理左二项目行的 Hover 信息卡、Click 操作菜单、抑制滞留悬停与“编辑项目”弹窗状态。
import type { HoverAnchorRect } from "./components/ProjectHoverCard";

/** 记录项目菜单锚点与位置，供菜单和预览共用。 */
export interface PopoverAnchorState {
  projectId: string;
  anchorRect: HoverAnchorRect;
}

/** 描述项目预览、菜单和表单的当前目标与开关状态。 */
export interface ProjectMenuSnapshot {
  hoverCard: PopoverAnchorState | null;
  actionMenu: PopoverAnchorState | null;
  editingProjectId: string | null;
  removingProjectId: string | null;
}

function toSidebarAnchorRect(element: Element): HoverAnchorRect {
  const row = element.closest("[data-sidebar-item]") ?? element;
  const sidebar = element.closest("[data-region='section-navigation']");
  const rect = row.getBoundingClientRect();
  const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : rect.right;
  return { top: rect.top, right: Math.max(rect.right, sidebarRight), bottom: rect.bottom, left: rect.left };
}

function toButtonRect(element: Element): HoverAnchorRect {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
}

/** 协调项目行产生的浮层动作，并向独立浮层宿主发布状态。 */
export class ProjectMenuStore {
  private readonly listeners = new Set<() => void>();
  private hoverCardValue: PopoverAnchorState | null = null;
  private actionMenuValue: PopoverAnchorState | null = null;
  private editingProjectIdValue: string | null = null;
  private removingProjectIdValue: string | null = null;
  private suppressHoverId: string | null = null;
  private hoverTimer: number | null = null;
  private cachedSnapshot: ProjectMenuSnapshot | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ProjectMenuSnapshot => {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        hoverCard: this.hoverCardValue,
        actionMenu: this.actionMenuValue,
        editingProjectId: this.editingProjectIdValue,
        removingProjectId: this.removingProjectIdValue,
      };
    }
    return this.cachedSnapshot;
  };

  private emit(): void {
    this.cachedSnapshot = null;
    for (const listener of this.listeners) listener();
  }

  clearHoverTimer = (): void => {
    if (this.hoverTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  };

  scheduleHoverClose = (): void => {
    this.clearHoverTimer();
    if (typeof window === "undefined") return;
    this.hoverTimer = window.setTimeout(() => {
      if (this.hoverCardValue) {
        this.hoverCardValue = null;
        this.emit();
      }
    }, 220);
  };

  dispose(): void {
    this.clearHoverTimer();
    this.listeners.clear();
  }

  isRowHighlighted(projectId: string): boolean {
    return this.hoverCardValue?.projectId === projectId || this.actionMenuValue?.projectId === projectId;
  }

  onRowEnter(projectId: string, element: Element): void {
    this.clearHoverTimer();
    if (
      this.actionMenuValue?.projectId === projectId
      || this.suppressHoverId === projectId
      || this.editingProjectIdValue
      || this.removingProjectIdValue
    ) {
      return;
    }
    const anchorRect = toSidebarAnchorRect(element);
    if (
      this.hoverCardValue?.projectId === projectId
      && this.hoverCardValue.anchorRect.top === anchorRect.top
      && this.hoverCardValue.anchorRect.right === anchorRect.right
    ) {
      return;
    }
    this.hoverCardValue = { projectId, anchorRect };
    this.emit();
  }

  onRowLeave(projectId: string): void {
    this.scheduleHoverClose();
    if (this.suppressHoverId === projectId) {
      this.suppressHoverId = null;
    }
  }

  onMoreClick(projectId: string, element: Element): void {
    this.clearHoverTimer();
    this.hoverCardValue = null;
    this.suppressHoverId = projectId;
    const anchorRect = toButtonRect(element);
    this.actionMenuValue = this.actionMenuValue?.projectId === projectId
      ? null
      : { projectId, anchorRect };
    this.emit();
  }

  openEdit(projectId: string): void {
    this.clearHoverTimer();
    this.hoverCardValue = null;
    this.actionMenuValue = null;
    this.suppressHoverId = null;
    this.editingProjectIdValue = projectId;
    this.emit();
  }

  openRemoveConfirm(projectId: string): void {
    this.clearHoverTimer();
    this.hoverCardValue = null;
    this.actionMenuValue = null;
    this.suppressHoverId = null;
    this.removingProjectIdValue = projectId;
    this.emit();
  }

  closeHoverCard = (): void => {
    if (!this.hoverCardValue) return;
    this.hoverCardValue = null;
    this.emit();
  };

  closeActionMenu = (): void => {
    if (!this.actionMenuValue) return;
    this.actionMenuValue = null;
    this.emit();
  };

  closeEdit = (): void => {
    if (!this.editingProjectIdValue) return;
    this.editingProjectIdValue = null;
    this.emit();
  };

  closeRemoveConfirm = (): void => {
    if (!this.removingProjectIdValue) return;
    this.removingProjectIdValue = null;
    this.emit();
  };

  closeAll = (): void => {
    this.clearHoverTimer();
    const hadAny = Boolean(
      this.hoverCardValue
      || this.actionMenuValue
      || this.editingProjectIdValue
      || this.removingProjectIdValue
      || this.suppressHoverId,
    );
    this.hoverCardValue = null;
    this.actionMenuValue = null;
    this.suppressHoverId = null;
    if (hadAny) this.emit();
  };
}
