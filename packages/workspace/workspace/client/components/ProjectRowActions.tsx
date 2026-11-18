// 渲染左二项目行右侧的两个快捷操作图标（··· 详情/操作菜单 与 ✎ 项目内新建聊天）。
import { useSyncExternalStore } from "react";
import { IconDots, IconEdit } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { WorkspaceLocaleMessages } from "../locales";
import type { ProjectMenuStore } from "../project-menu-store";
import styles from "./ProjectRowActions.module.css";

/** 为项目列表行提供独立的操作菜单与绑定项目的新聊天入口。 */
export function ProjectRowActions({
  locale,
  project,
  menuStore,
  onNewChatInProject,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  menuStore: ProjectMenuStore;
  onNewChatInProject: (project: WorkbenchProjectItem) => void;
}) {
  const snapshot = useSyncExternalStore(menuStore.subscribe, menuStore.getSnapshot, menuStore.getSnapshot);
  const isMenuOpen = snapshot.actionMenu?.projectId === project.id;

  return (
    <>
      <button
        type="button"
        className={`${styles.actionBtn} ${isMenuOpen ? styles.actionBtnActive : ""}`}
        aria-label={`${locale.projectMoreOptions}: ${project.name}`}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        data-project-more={project.id}
        title={locale.projectMoreOptions}
        onClick={(event) => {
          event.stopPropagation();
          menuStore.onMoreClick(project.id, event.currentTarget);
        }}
      >
        <IconDots aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.actionBtn}
        aria-label={`${locale.newChatInProject}: ${project.name}`}
        title={locale.newChatInProject}
        onClick={(event) => {
          event.stopPropagation();
          menuStore.closeAll();
          onNewChatInProject(project);
        }}
      >
        <IconEdit aria-hidden="true" />
      </button>
    </>
  );
}
