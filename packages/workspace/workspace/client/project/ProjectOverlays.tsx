// 宿主工作区项目悬浮卡片、操作下拉菜单与“编辑项目”整页弹窗的统一挂载宿主。
import { useSyncExternalStore } from "react";
import type { WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import type { ProjectMenuStore } from "../store/project-menu-store";
import type { ProjectWorktreeItem } from "../worktree/worktree-types";
import { EditProjectDialog } from "./EditProjectDialog";
import { ProjectActionMenu } from "./ProjectActionMenu";
import { ProjectHoverCard } from "./ProjectHoverCard";
import { RemoveProjectDialog } from "./RemoveProjectDialog";
import { WorktreeDialog } from "../worktree/WorktreeDialog";

/** 统一挂载项目卡片、操作菜单及确认表单，使不同层级共享当前项目上下文。 */
export function ProjectOverlays({
  locale,
  projectStore,
  menuStore,
  sections,
  getChatCount,
  onCreateSection,
  onProjectUpdated,
  onProjectRemoved,
  onStartWorktreeChat,
  onOpenProject,
}: {
  locale: WorkspaceLocaleMessages;
  projectStore: LocalProjectStore;
  menuStore: ProjectMenuStore;
  sections: WorkbenchSectionItem[];
  getChatCount?: (projectId: string) => number;
  onCreateSection: (projectId?: string) => void;
  onProjectUpdated: (project: WorkbenchProjectItem) => void;
  onProjectRemoved: (projectId: string) => void;
  /** 工作树创建成功后打开绑定的新会话。 */
  onStartWorktreeChat: (project: WorkbenchProjectItem, worktree: ProjectWorktreeItem) => void;
  /** 打开项目详情视图（菜单入口与双击行一致）。 */
  onOpenProject: (projectId: string) => void;
}) {
  const projects = useSyncExternalStore(projectStore.subscribe, projectStore.getProjects, projectStore.getProjects);
  const snapshot = useSyncExternalStore(menuStore.subscribe, menuStore.getSnapshot, menuStore.getSnapshot);

  const rawHoverProject = snapshot.hoverCard
    ? projects.find((item) => item.id === snapshot.hoverCard?.projectId) ?? null
    : null;
  const activeHoverProject = rawHoverProject
    ? {
        ...rawHoverProject,
        chatCount: getChatCount ? getChatCount(rawHoverProject.id) : (rawHoverProject.chatCount ?? 0),
      }
    : null;
  const activeMenuProject = snapshot.actionMenu
    ? projects.find((item) => item.id === snapshot.actionMenu?.projectId) ?? null
    : null;
  const editingProject = snapshot.editingProjectId
    ? projects.find((item) => item.id === snapshot.editingProjectId) ?? null
    : null;
  const removingProject = snapshot.removingProjectId
    ? projects.find((item) => item.id === snapshot.removingProjectId) ?? null
    : null;
  const worktreeProject = snapshot.worktreeProjectId
    ? projects.find((item) => item.id === snapshot.worktreeProjectId) ?? null
    : null;

  return (
    <>
      {activeHoverProject
        && snapshot.hoverCard
        && (!snapshot.actionMenu || snapshot.actionMenu.projectId !== activeHoverProject.id) && (
        <ProjectHoverCard
          locale={locale}
          project={activeHoverProject}
          anchorRect={snapshot.hoverCard.anchorRect}
          pinnedMode={false}
          canPin
          canEdit
          onMouseEnter={menuStore.clearHoverTimer}
          onMouseLeave={menuStore.scheduleHoverClose}
          onTogglePin={() => {
            menuStore.clearHoverTimer();
            void projectStore.togglePinProject(activeHoverProject.id);
          }}
          onEdit={() => menuStore.openEdit(activeHoverProject.id)}
          onClose={menuStore.closeHoverCard}
        />
      )}

      {activeMenuProject && snapshot.actionMenu && (
        <ProjectActionMenu
          locale={locale}
          project={activeMenuProject}
          sections={sections}
          anchorRect={snapshot.actionMenu.anchorRect}
          canPin
          canEdit
          canOpenExplorer
          canRemove
          onTogglePin={() => projectStore.togglePinProject(activeMenuProject.id)}
          onAssignSection={(sectionId) => projectStore.assignSection(activeMenuProject.id, sectionId)}
          onCreateSection={() => {
            menuStore.closeAll();
            onCreateSection(activeMenuProject.id);
          }}
          onEdit={() => menuStore.openEdit(activeMenuProject.id)}
          onOpenProject={() => onOpenProject(activeMenuProject.id)}
          onNewWorktreeSession={() => menuStore.openWorktree(activeMenuProject.id)}
          onOpenInExplorer={() => projectStore.openProjectInExplorer(activeMenuProject.id)}
          onRemove={() => menuStore.openRemoveConfirm(activeMenuProject.id)}
          onClose={menuStore.closeActionMenu}
        />
      )}

      {editingProject && (
        <EditProjectDialog
          locale={locale}
          project={editingProject}
          store={projectStore}
          onUpdated={(updated) => {
            menuStore.closeEdit();
            onProjectUpdated(updated);
          }}
          onRequestRemove={(projectId) => menuStore.openRemoveConfirm(projectId)}
          onClose={menuStore.closeEdit}
        />
      )}

      {removingProject && (
        <RemoveProjectDialog
          locale={locale}
          project={removingProject}
          store={projectStore}
          onRemoved={(projectId) => {
            menuStore.closeRemoveConfirm();
            menuStore.closeEdit();
            onProjectRemoved(projectId);
          }}
          onClose={menuStore.closeRemoveConfirm}
        />
      )}

      {worktreeProject && (
        <WorktreeDialog
          locale={locale}
          project={worktreeProject}
          store={projectStore}
          onCreated={(worktree) => onStartWorktreeChat(worktreeProject, worktree)}
          onClose={menuStore.closeWorktree}
        />
      )}
    </>
  );
}
