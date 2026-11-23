// 会话操作菜单的四个二级面板：项目归属、分区归属、分叉、复制。
// 从 SessionActionMenu 拆出：主组件只负责定位、开合与一级动作，面板集合单独维护。
import type { WorkbenchChatSessionSummary, WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import type { SessionMenuStore } from "./session-menu-store";
import { IconCheck } from "@tabler/icons-react";
import styles from "./SessionActionMenu.module.css";

/** 复制失败不打断菜单：剪贴板不可用时静默忽略。 */
export async function copyTextSafe(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text).catch(() => {});
  }
}

/** 二级面板共用的定位类：空间不足时翻到左侧。 */
function submenuClass(subOnLeft: boolean): string {
  return `${styles.submenu} ${subOnLeft ? styles.submenuLeft : ""}`;
}

interface BaseProps {
  isZh: boolean;
  session: WorkbenchChatSessionSummary;
  subOnLeft: boolean;
  chatStore: ChatClientStore;
  menuStore: SessionMenuStore;
}

/** 项目归属：可选「项目外」或某个项目，当前项打勾。 */
export function ProjectSubmenu({ isZh, session, projects, subOnLeft, chatStore, menuStore }: BaseProps & {
  projects: WorkbenchProjectItem[];
}) {
  return (
    <div className={submenuClass(subOnLeft)} role="menu">
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
  );
}

/** 分区归属：可选「移出分区」或某个分区，当前项打勾。 */
export function SectionSubmenu({ isZh, session, sections, subOnLeft, chatStore, menuStore }: BaseProps & {
  sections: WorkbenchSectionItem[];
}) {
  return (
    <div className={submenuClass(subOnLeft)} role="menu">
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
  );
}

/** 分叉：把当前会话复制成一个新会话。 */
export function ForkSubmenu({ isZh, session, subOnLeft, chatStore, menuStore }: BaseProps) {
  return (
    <div className={submenuClass(subOnLeft)} role="menu">
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
  );
}

/** 复制：标题、完整对话与会话 ID 三个入口。 */
export function CopySubmenu({ isZh, session, subOnLeft, chatStore, menuStore }: BaseProps) {
  return (
    <div className={submenuClass(subOnLeft)} role="menu">
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
  );
}