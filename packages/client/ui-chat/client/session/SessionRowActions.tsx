// 渲染左二聊天会话行右侧的三个快捷图标按钮（归档对话、置顶、⋮ 更多操作）。
import { useSyncExternalStore } from "react";
import { IconArchive, IconArchiveOff, IconDotsVertical, IconPin, IconPinFilled } from "@tabler/icons-react";
import type { WorkbenchChatSessionSummary } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import type { SessionMenuStore } from "./session-menu-store";
import styles from "./SessionRowActions.module.css";

/** 为会话行提供就地操作入口，使按钮点击独立于打开会话的行点击。 */
export function SessionRowActions({
  isZh,
  session,
  chatStore,
  menuStore,
}: {
  isZh: boolean;
  session: WorkbenchChatSessionSummary;
  chatStore: ChatClientStore;
  menuStore: SessionMenuStore;
}) {
  // 仅订阅当前行的菜单展开态，避免悬停其它会话行更新 hoverCard 时触发整列所有行按钮重渲染。
  const isMenuOpen = useSyncExternalStore(
    menuStore.subscribe,
    () => menuStore.getSnapshot().actionMenu?.sessionId === session.id,
    () => false,
  );
  const archiveLabel = session.archived
    ? (isZh ? "取消归档" : "Unarchive")
    : (isZh ? "归档对话" : "Archive");
  const pinLabel = session.pinned
    ? (isZh ? "取消置顶" : "Unpin")
    : (isZh ? "置顶" : "Pin");
  const moreLabel = isZh ? "更多操作" : "More actions";

  return (
    <>
      <button
        type="button"
        className={styles.actionBtn}
        aria-label={`${archiveLabel}: ${session.title}`}
        title={archiveLabel}
        data-tooltip={archiveLabel}
        onClick={(event) => {
          event.stopPropagation();
          menuStore.closeAll();
          void chatStore.updateSessionMeta(session.id, { archived: !session.archived });
        }}
      >
        {session.archived ? <IconArchiveOff aria-hidden="true" /> : <IconArchive aria-hidden="true" />}
      </button>

      <button
        type="button"
        className={`${styles.actionBtn} ${session.pinned ? styles.actionBtnPinned : ""}`}
        aria-label={`${pinLabel}: ${session.title}`}
        aria-pressed={Boolean(session.pinned)}
        title={pinLabel}
        data-tooltip={pinLabel}
        onClick={(event) => {
          event.stopPropagation();
          menuStore.closeAll();
          void chatStore.updateSessionMeta(session.id, { pinned: !session.pinned });
        }}
      >
        {session.pinned ? <IconPinFilled aria-hidden="true" /> : <IconPin aria-hidden="true" />}
      </button>

      <button
        type="button"
        className={`${styles.actionBtn} ${isMenuOpen ? styles.actionBtnActive : ""}`}
        aria-label={`${moreLabel}: ${session.title}`}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        data-session-more={session.id}
        title={moreLabel}
        onClick={(event) => {
          event.stopPropagation();
          menuStore.toggleActionMenu(session.id, event.currentTarget);
        }}
      >
        <IconDotsVertical aria-hidden="true" />
      </button>
    </>
  );
}
