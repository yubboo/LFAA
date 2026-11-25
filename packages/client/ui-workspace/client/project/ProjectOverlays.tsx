// 宿主工作区项目悬浮卡片、操作下拉菜单与“编辑项目”整页弹窗的统一挂载宿主。
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import type { ProjectMenuStore } from "../store/project-menu-store";
import type { ProjectWorktreeItem } from "../shared/worktree-types";
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

  // 悬浮卡关闭时保留 160ms 做淡出，避免卡片瞬间消失的生硬感。
  const liveHover = activeHoverProject && snapshot.hoverCard
    && (!snapshot.actionMenu || snapshot.actionMenu.projectId !== activeHoverProject.id)
    ? { project: activeHoverProject, anchorRect: snapshot.hoverCard.anchorRect }
    : null;
  const lastHoverRef = useRef<typeof liveHover>(null);
  const [, forceRender] = useState(0);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (liveHover) {
      // 只有从“没有卡片”变成“有卡片”才播入场；关闭后快速重开沿用旧卡片，不重播。
      if (!lastHoverRef.current) setEntering(true);
      lastHoverRef.current = liveHover;
      return;
    }
    if (!lastHoverRef.current) return;
    const timer = window.setTimeout(() => {
      lastHoverRef.current = null;
      forceRender((value) => value + 1);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [liveHover]);
  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(false), 220);
    return () => window.clearTimeout(timer);
  }, [entering]);
  // 关闭阶段继续渲染上一帧数据，避免中间出现空帧造成闪烁。
  const shownHover = liveHover ?? lastHoverRef.current;

  return (
    <>
      {shownHover && (
        <ProjectHoverCard
          locale={locale}
          project={shownHover.project}
          anchorRect={shownHover.anchorRect}
          pinnedMode={false}
          canPin
          canEdit
          closing={!liveHover}
          entering={entering}
          onMouseEnter={menuStore.clearHoverTimer}
          onMouseLeave={menuStore.scheduleHoverClose}
          onTogglePin={() => {
            menuStore.clearHoverTimer();
            void projectStore.togglePinProject(shownHover.project.id);
          }}
          onEdit={() => menuStore.openEdit(shownHover.project.id)}
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
