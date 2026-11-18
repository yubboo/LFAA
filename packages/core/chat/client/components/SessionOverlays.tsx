// 聚合渲染左二聊天会话行的右侧悬浮卡片、操作菜单、重命名/删除确认弹窗与全局快捷键。
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import { ConfirmDialog, ModalDialog } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../chat-store";
import type { SessionMenuStore } from "../session-menu-store";
import { SessionActionMenu } from "./SessionActionMenu";
import { SessionHoverCard } from "./SessionHoverCard";
import styles from "./ModelProviderGrid.module.css";

export function SessionOverlays({
  isZh,
  chatStore,
  menuStore,
  projects,
  sections,
}: {
  isZh: boolean;
  chatStore: ChatClientStore;
  menuStore: SessionMenuStore;
  projects: WorkbenchProjectItem[];
  sections: WorkbenchSectionItem[];
}) {
  const menuSnap = useSyncExternalStore(menuStore.subscribe, menuStore.getSnapshot, menuStore.getSnapshot);
  const chatSnap = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, chatStore.getSnapshot);
  const [renameDraft, setRenameDraft] = useState("");

  const renameSession = menuSnap.renameTargetId
    ? chatSnap.sessions.find((s) => s.id === menuSnap.renameTargetId)
    : undefined;
  const deleteSession = menuSnap.deleteTargetId
    ? chatSnap.sessions.find((s) => s.id === menuSnap.deleteTargetId)
    : undefined;

  useEffect(() => {
    if (renameSession) setRenameDraft(renameSession.title);
  }, [renameSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) {
        return;
      }
      const activeId = chatStore.getSnapshot().activeSessionId;
      if (!activeId) return;
      const activeSession = chatStore.getSnapshot().sessions.find((s) => s.id === activeId);
      if (!activeSession) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && event.altKey && key === "r") {
        event.preventDefault();
        menuStore.openRename(activeId);
      } else if ((event.ctrlKey || event.metaKey) && event.altKey && key === "p") {
        event.preventDefault();
        void chatStore.updateSessionMeta(activeId, { pinned: !activeSession.pinned });
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "u") {
        event.preventDefault();
        void chatStore.updateSessionMeta(activeId, { unread: !activeSession.unread });
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "a") {
        event.preventDefault();
        void chatStore.updateSessionMeta(activeId, { archived: !activeSession.archived });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatStore, menuStore]);

  const hoverSession = menuSnap.hoverCard
    ? chatSnap.sessions.find((s) => s.id === menuSnap.hoverCard!.sessionId)
    : undefined;

  // 兜底清理悬浮卡片：指针离开会话行与卡片区域、页面滚动或窗口失焦时立即关闭，防止残留在工作区
  useEffect(() => {
    const activeHoverId = hoverSession?.id;
    if (!activeHoverId) return;

    const isInsideHoverTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (target.closest(`[data-session-hover-card="${activeHoverId}"]`)) return true;
      const row = target.closest<HTMLElement>("[data-sidebar-item]");
      const rowId = row?.dataset.sidebarItem ?? "";
      return rowId === activeHoverId || rowId.endsWith(`:${activeHoverId}`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (isInsideHoverTarget(event.target)) {
        menuStore.onCardEnter();
      } else {
        menuStore.onRowLeave(activeHoverId);
      }
    };
    const onDismiss = () => menuStore.closeHoverCard();
    const onPointerDown = (event: PointerEvent) => {
      if (!isInsideHoverTarget(event.target)) {
        menuStore.closeHoverCard();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("scroll", onDismiss, { capture: true, passive: true });
    window.addEventListener("blur", onDismiss);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("scroll", onDismiss, { capture: true });
      window.removeEventListener("blur", onDismiss);
    };
  }, [hoverSession?.id, menuStore]);
  const menuSession = menuSnap.actionMenu
    ? chatSnap.sessions.find((s) => s.id === menuSnap.actionMenu!.sessionId)
    : undefined;

  return (
    <>
      {hoverSession && menuSnap.hoverCard && !menuSession && (
        <SessionHoverCard
          isZh={isZh}
          session={hoverSession}
          projects={projects}
          anchorRect={menuSnap.hoverCard.rect}
          onMouseEnter={() => menuStore.onCardEnter()}
          onMouseLeave={() => menuStore.onCardLeave()}
        />
      )}

      {menuSession && menuSnap.actionMenu && (
        <SessionActionMenu
          isZh={isZh}
          session={menuSession}
          projects={projects}
          sections={sections}
          anchorRect={menuSnap.actionMenu.rect}
          chatStore={chatStore}
          menuStore={menuStore}
        />
      )}

      <ModalDialog
        open={Boolean(renameSession)}
        title={isZh ? "重命名会话" : "Rename Chat"}
        size="sm"
        closeLabel={isZh ? "关闭" : "Close"}
        onClose={() => menuStore.closeDialogs()}
        footer={(
          <div className={styles.footerRight}>
            <button type="button" className={styles.btn} onClick={() => menuStore.closeDialogs()}>
              {isZh ? "取消" : "Cancel"}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!renameDraft.trim()}
              onClick={() => {
                if (renameSession && renameDraft.trim()) {
                  void chatStore.updateSessionMeta(renameSession.id, { title: renameDraft.trim() });
                }
                menuStore.closeDialogs();
              }}
            >
              {isZh ? "保存" : "Save"}
            </button>
          </div>
        )}
      >
        <input
          className={styles.input}
          value={renameDraft}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameSession && renameDraft.trim()) {
              void chatStore.updateSessionMeta(renameSession.id, { title: renameDraft.trim() });
              menuStore.closeDialogs();
            }
          }}
        />
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deleteSession)}
        title={isZh ? `永久删除「${deleteSession?.title ?? ""}」？` : `Delete "${deleteSession?.title ?? ""}"?`}
        description={
          isZh
            ? "删除后该会话的所有聊天记录将从本地永久移除，无法恢复。"
            : "This will permanently remove all messages in this chat from local storage and cannot be undone."
        }
        cancelLabel={isZh ? "取消" : "Cancel"}
        confirmLabel={isZh ? "永久删除" : "Delete"}
        closeLabel={isZh ? "关闭" : "Close"}
        onClose={() => menuStore.closeDialogs()}
        onConfirm={() => {
          if (deleteSession) void chatStore.deleteSession(deleteSession.id);
          menuStore.closeDialogs();
        }}
      />
    </>
  );
}
