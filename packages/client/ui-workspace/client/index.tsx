// 导出工作区包 Client 插件入口，通过 Cordis inject 获取 workbench 服务并贡献项目、悬停/操作卡片及右侧上下文。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ProjectContextCard, WorkspaceContextContent } from "./project/ProjectContextPanel";
import { ProjectDialog } from "./project/ProjectDialog";
import { ProjectOverlays } from "./project/ProjectOverlays";
import { ProjectRowActions } from "./project/ProjectRowActions";
import { ProjectDetailView, ProjectsOverview } from "./project/ProjectWorkspace";
import { LocalProjectStore } from "./store/local-project-store";
import { getWorkspaceLocale } from "./locales";
import { ProjectMenuStore } from "./store/project-menu-store";

declare module "@deepseek-ai/cordis" {
  interface Events {
    "workspace/section-removed"(sectionId: string): void;
  }
}

/** 安装项目导航、项目视图和右栏上下文，把工作台动作交给项目 Store。 */
export const workspaceClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/client-ui-workspace/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new LocalProjectStore();
    const menuStore = new ProjectMenuStore();
    const locale = getWorkspaceLocale();

    const offSectionRemoved = context.on("workspace/section-removed", () => {
      void store.refreshProjects();
    });

    const unregisterProvider = context.workbench.registerProjectProvider({
      getProjects: store.getProjects,
      hasLoaded: store.hasLoaded,
      openProject: (projectId) => context.workbench.openProject(projectId),
      subscribe: (listener) => {
        const offProjects = store.subscribe(listener);
        const offMenus = menuStore.subscribe(listener);
        return () => {
          offProjects();
          offMenus();
        };
      },
      renderCreateDialog: ({ onCreated, onClose }) => (
        <ProjectDialog
          locale={locale}
          store={store}
          onClose={onClose}
          onCreated={onCreated}
        />
      ),
      quickCreateProject: async (baseName) => {
        const prefix = baseName?.trim() || "未命名项目";
        const existing = new Set(store.getProjects().map((item) => item.name.trim().toLowerCase()));
        let candidate = prefix;
        let suffix = 2;
        while (existing.has(candidate.toLowerCase())) {
          candidate = `${prefix} ${suffix}`;
          suffix += 1;
        }
        const resolved = await store.resolveDefaultPath(candidate);
        return store.createProject({
          name: candidate,
          trusted: true,
          confirmedDefaultPath: resolved.targetPath,
        });
      },
      assignProjectSection: (projectId, sectionId) => store.assignSection(projectId, sectionId),
      renameProject: (projectId, name) => store.updateProject(projectId, { name }),
      removeProject: (projectId) => store.removeProject(projectId),
      refreshProjects: async () => { await store.refreshProjects(); },
      togglePinProject: (projectId) => store.togglePinProject(projectId),
      onProjectRowEnter: (project, element) => menuStore.onRowEnter(project.id, element),
      onProjectRowLeave: (project) => menuStore.onRowLeave(project.id),
      closeProjectMenus: () => menuStore.closeAll(),
      isProjectRowHighlighted: (projectId, rowKey) => menuStore.isRowHighlighted(projectId, rowKey),
      renderProjectRowActions: ({ project, onNewChatInProject }) => (
        <ProjectRowActions
          locale={locale}
          project={project}
          menuStore={menuStore}
          onNewChatInProject={onNewChatInProject}
        />
      ),
      renderProjectOverlays: ({ sections, onCreateSection, onProjectUpdated, onProjectRemoved }) => (
        <ProjectOverlays
          locale={locale}
          projectStore={store}
          menuStore={menuStore}
          sections={sections}
          getChatCount={(projectId) =>
            context.workbench.getSnapshot().projects.find((item) => item.id === projectId)?.chatCount ?? 0
          }
          onCreateSection={onCreateSection}
          onProjectUpdated={onProjectUpdated}
          onProjectRemoved={onProjectRemoved}
          onStartWorktreeChat={(project, worktree) => {
            const provider = context.workbench.getSnapshot().chatProvider;
            if (!provider) return;
            context.workbench.navigate("workspace", project.id);
            void provider.startNewChat({ projectId: project.id, worktree });
          }}
          onOpenProject={(projectId) => context.workbench.openProject(projectId)}
        />
      ),
      renderProjectView: (project) => (
        <ProjectDetailView locale={locale} project={project} store={store} />
      ),
      renderProjectContext: (project) => (
        <ProjectContextCard
          locale={locale}
          project={project}
          onRemove={(projectId) => menuStore.openRemoveConfirm(projectId)}
        />
      ),
    });

    const unregisterProjectsView = context.workbench.registerView({
      id: "projects",
      title: locale.projects,
      render: () => (
        <ProjectsOverview
          locale={locale}
          projects={store.getProjects()}
          onOpenProject={(projectId) => context.workbench.openProject(projectId)}
        />
      ),
    });

    const unregisterContextPanel = context.workbench.registerContextPanel({
      id: "workspace-context",
      title: locale.contextTitle,
      order: 10,
      placement: "utility",
      match: (activeView) => activeView === "workspace" || activeView === "projects",
      render: () => (
        <WorkspaceContextContent locale={locale} projectCount={store.getProjects().length} />
      ),
    });

    context.effect(() => () => {
      offSectionRemoved();
      unregisterContextPanel();
      unregisterProjectsView();
      unregisterProvider();
      menuStore.dispose();
      store.dispose();
    });
  },
};
