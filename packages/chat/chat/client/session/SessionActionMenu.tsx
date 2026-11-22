// 渲染聊天会话「⋮」完整上下文操作菜单（重命名、置顶、标记未读、项目/分区归属、分叉、分享、复制、新窗口、归档与永久删除）。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconAppWindow,
  IconArchive,
  IconArchiveOff,
  IconBell,
  IconBellOff,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFolderUp,
  IconGitFork,
  IconList,
  IconPencil,
  IconPin,
  IconPinFilled,
  IconShare2,
  IconTrash,
} from "@tabler/icons-react";
import type { WorkbenchChatSessionSummary, WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import type { SessionAnchorRect, SessionMenuStore } from "./session-menu-store";
import styles from "./SessionActionMenu.module.css";

type SubmenuKind = "project" | "section" | "fork" | "copy" | null;

async function copyTextSafe(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text).catch(() => {});
  }
}

/** 将归档、置顶、归属变更与删除等会话动作绑定到打开菜单时的会话。 */
export function SessionActionMenu({
  isZh,
  session,
  projects,
  sections,
  anchorRect,
  chatStore,
  menuStore,
}: {
  isZh: boolean;
  session: WorkbenchChatSessionSummary;
  projects: WorkbenchProjectItem[];
  sections: WorkbenchSectionItem[];
  anchorRect: SessionAnchorRect;
  chatStore: ChatClientStore;
  menuStore: SessionMenuStore;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<SubmenuKind>(null);
  const [sharedCopied, setSharedCopied] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[data-session-more="${session.id}"]`)) return;
      menuStore.closeAll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") menuStore.closeAll();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuStore, session.id]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const menuWidth = 236;
  const menuHeightEst = 418;
  const left = Math.max(10, Math.min(anchorRect.right + 6, vw - menuWidth - 12));
  const top = Math.max(10, Math.min(anchorRect.top - 8, vh - menuHeightEst - 12));
  const subOnLeft = left + menuWidth + 190 > vw;

  const menuNode = (
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label={session.title}
      data-session-action-menu={session.id}
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px` }}
    >
      <button type="button" className={styles.item} role="menuitem" onClick={() => menuStore.openRename(session.id)}>
        <IconPencil aria-hidden="true" />
        <span className={styles.label}>{isZh ? "重命名" : "Rename"}</span>
        <span className={styles.shortcut}>Alt+Ctrl+R</span>
      </button>

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          menuStore.closeAll();
          void chatStore.updateSessionMeta(session.id, { pinned: !session.pinned });
        }}
      >
        {session.pinned ? <IconPinFilled aria-hidden="true" /> : <IconPin aria-hidden="true" />}
        <span className={styles.label}>{session.pinned ? (isZh ? "取消置顶" : "Unpin") : (isZh ? "置顶" : "Pin")}</span>
        <span className={styles.shortcut}>Alt+Ctrl+P</span>
      </button>

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          menuStore.closeAll();
          void chatStore.updateSessionMeta(session.id, { unread: !session.unread });
        }}
      >
        {session.unread ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
        <span className={styles.label}>
          {session.unread ? (isZh ? "标为已读" : "Mark read") : (isZh ? "标记为未读" : "Mark unread")}
        </span>
        <span className={styles.shortcut}>Ctrl+Shift+U</span>
      </button>

      <button type="button" className={styles.item} role="menuitem" onClick={() => {
        menuStore.closeAll();
        void chatStore.updateSessionMeta(session.id, { muted: !session.muted });
      }}>
        {session.muted ? <IconBell aria-hidden="true" /> : <IconBellOff aria-hidden="true" />}
        <span className={styles.label}>{session.muted ? (isZh ? "开启通知" : "Unmute notifications") : (isZh ? "静音通知" : "Mute notifications")}</span>
      </button>

      <div
        className={styles.subTriggerWrap}
        onMouseEnter={() => setSubmenu("project")}
        onMouseLeave={() => setSubmenu((c) => (c === "project" ? null : c))}
      >
        <button
          type="button"
          className={styles.item}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={submenu === "project"}
          onClick={() => setSubmenu((c) => (c === "project" ? null : "project"))}
        >
          <IconFolderUp aria-hidden="true" />
          <span className={styles.label}>{isZh ? "项目" : "Project"}</span>
          <IconChevronRight className={styles.arrow} aria-hidden="true" />
        </button>
        {submenu === "project" && (
          <div className={`${styles.submenu} ${subOnLeft ? styles.submenuLeft : ""}`} role="menu">
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                menuStore.closeAll();
                void chatStore.updateSessionMeta(session.id, { projectId: null });
              }}
            >
              <span className={styles.label}>{isZh ? "移出项目（项目外）" : "Outside project"}</span>
              {!session.projectId && <IconCheck aria-hidden="true" />}
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.item}
                onClick={() => {
                  menuStore.closeAll();
                  void chatStore.updateSessionMeta(session.id, { projectId: p.id });
                }}
              >
                <span className={styles.label}>{p.name}</span>
                {session.projectId === p.id && <IconCheck aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={styles.subTriggerWrap}
        onMouseEnter={() => setSubmenu("section")}
        onMouseLeave={() => setSubmenu((c) => (c === "section" ? null : c))}
      >
        <button
          type="button"
          className={styles.item}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={submenu === "section"}
          onClick={() => setSubmenu((c) => (c === "section" ? null : "section"))}
        >
          <IconList aria-hidden="true" />
          <span className={styles.label}>{isZh ? "分区" : "Section"}</span>
          <IconChevronRight className={styles.arrow} aria-hidden="true" />
        </button>
        {submenu === "section" && (
          <div className={`${styles.submenu} ${subOnLeft ? styles.submenuLeft : ""}`} role="menu">
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                menuStore.closeAll();
                void chatStore.updateSessionMeta(session.id, { sectionId: null });
              }}
            >
              <span className={styles.label}>{isZh ? "移出分区" : "No section"}</span>
              {!session.sectionId && <IconCheck aria-hidden="true" />}
            </button>
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                className={styles.item}
                onClick={() => {
                  menuStore.closeAll();
                  void chatStore.updateSessionMeta(session.id, { sectionId: sec.id });
                }}
              >
                <span className={styles.label}>{sec.name}</span>
                {session.sectionId === sec.id && <IconCheck aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.divider} role="separator" />

      <div
        className={styles.subTriggerWrap}
        onMouseEnter={() => setSubmenu("fork")}
        onMouseLeave={() => setSubmenu((c) => (c === "fork" ? null : c))}
      >
        <button
          type="button"
          className={styles.item}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={submenu === "fork"}
          onClick={() => {
            menuStore.closeAll();
            void chatStore.forkSession(session.id);
          }}
        >
          <IconGitFork aria-hidden="true" />
          <span className={styles.label}>{isZh ? "分叉" : "Fork"}</span>
          <IconChevronRight className={styles.arrow} aria-hidden="true" />
        </button>
        {submenu === "fork" && (
          <div className={`${styles.submenu} ${subOnLeft ? styles.submenuLeft : ""}`} role="menu">
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                menuStore.closeAll();
                void chatStore.forkSession(session.id);
              }}
            >
              <span className={styles.label}>{isZh ? "分叉到新会话" : "Fork to new chat"}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} role="separator" />

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          void chatStore.exportSessionMarkdown(session.id).then((exported) => {
            if (exported) void copyTextSafe(exported.markdown);
            setSharedCopied(true);
            setTimeout(() => menuStore.closeAll(), 450);
          });
        }}
      >
        {sharedCopied ? <IconCheck aria-hidden="true" /> : <IconShare2 aria-hidden="true" />}
        <span className={styles.label}>{sharedCopied ? (isZh ? "已复制分享内容" : "Copied") : (isZh ? "分享" : "Share")}</span>
      </button>

      <div
        className={styles.subTriggerWrap}
        onMouseEnter={() => setSubmenu("copy")}
        onMouseLeave={() => setSubmenu((c) => (c === "copy" ? null : c))}
      >
        <button
          type="button"
          className={styles.item}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={submenu === "copy"}
          onClick={() => setSubmenu((c) => (c === "copy" ? null : "copy"))}
        >
          <IconCopy aria-hidden="true" />
          <span className={styles.label}>{isZh ? "复制" : "Copy"}</span>
          <IconChevronRight className={styles.arrow} aria-hidden="true" />
        </button>
        {submenu === "copy" && (
          <div className={`${styles.submenu} ${subOnLeft ? styles.submenuLeft : ""}`} role="menu">
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                void copyTextSafe(session.title);
                menuStore.closeAll();
              }}
            >
              <span className={styles.label}>{isZh ? "复制标题" : "Copy title"}</span>
            </button>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                void chatStore.exportSessionMarkdown(session.id).then((exp) => {
                  if (exp) void copyTextSafe(exp.markdown);
                });
                menuStore.closeAll();
              }}
            >
              <span className={styles.label}>{isZh ? "复制对话内容" : "Copy markdown"}</span>
            </button>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                void copyTextSafe(session.id);
                menuStore.closeAll();
              }}
            >
              <span className={styles.label}>{isZh ? "复制会话 ID" : "Copy ID"}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} role="separator" />

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          menuStore.closeAll();
          if (typeof window !== "undefined") {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("sessionId", session.id);
            window.open(nextUrl.toString(), "_blank", "noopener,noreferrer");
          }
        }}
      >
        <IconAppWindow aria-hidden="true" />
        <span className={styles.label}>{isZh ? "在新窗口中打开" : "Open in new window"}</span>
      </button>

      <div className={styles.divider} role="separator" />

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          menuStore.closeAll();
          void chatStore.updateSessionMeta(session.id, { archived: !session.archived });
        }}
      >
        {session.archived ? <IconArchiveOff aria-hidden="true" /> : <IconArchive aria-hidden="true" />}
        <span className={styles.label}>{session.archived ? (isZh ? "取消归档" : "Unarchive") : (isZh ? "归档" : "Archive")}</span>
        <span className={styles.shortcut}>Ctrl+Shift+A</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${styles.itemDanger}`}
        role="menuitem"
        onClick={() => menuStore.openDelete(session.id)}
      >
        <IconTrash aria-hidden="true" />
        <span className={styles.label}>{isZh ? "永久删除" : "Delete permanently"}</span>
      </button>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(menuNode, document.body);
  }
  return menuNode;
}
