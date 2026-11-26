// 聊天工作台提供方：把会话列表、新会话草稿行、行内菜单与项目工作区注入四栏 Shell。
// 单独成文件是为了让聊天插件入口只负责装配，不把 provider 的全部行内视图堆在入口里。
import type { ReactNode } from "react";
import type { WorkbenchChatProvider } from "@lfaa/ui-layout";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "./store/chat-store";
import type { ChatLocaleMessages } from "./locales";
import { SessionRowActions } from "./session/SessionRowActions";
import { SessionOverlays } from "./session/SessionOverlays";
import { ProjectWorkspacePane } from "./workbench/ProjectWorkspacePane";
import type { SessionMenuStore } from "./session/session-menu-store";

/** 组装聊天 provider：侧栏、搜索、菜单与项目工作区共享同一个 Store 与工作台服务。 */
export function createChatProvider({
  store,
  workbench,
  menuStore,
  locale,
}: {
  store: ChatClientStore;
  workbench: WorkbenchClientService;
  menuStore: SessionMenuStore;
  locale: ChatLocaleMessages;
}): WorkbenchChatProvider<ReactNode> {
  return {
    getSessions: () => {
      const snapshot = store.getSnapshot();
      // 正在收起的草稿仍留在列表里一个动画时长，行高收完后再由 store 移除。
      const draft = snapshot.draftSession ?? snapshot.exitingDraftSession;
      // 草稿不是历史记录：只在用户主动开了新会话后临时排在最前，切到历史会话即撤下。
      return draft ? [{ ...draft, title: locale.newChat }, ...snapshot.sessions] : snapshot.sessions;
    },
    getActiveSessionId: () => store.getSnapshot().activeSessionId,
    getDraftProjectId: () => store.getSnapshot().draftProjectId,
    // 左二栏据此在后台仍在工作的会话上显示转圈；与当前打开了哪条会话无关。
    isSessionRunning: (sessionId: string) => store.isSessionRunning(sessionId),
    // 会话需要确认/回答时，左二栏显示对应徽标；由通知设置控制是否展示。
    getSessionAttention: (sessionId: string) => store.getSessionAttention(sessionId),
    searchChat: (query: string) => store.searchChat(query),
    // 左二单击项目行时把未发送的草稿改绑到该项目，避免输入区绑定与高亮项目不一致。
    setActiveProjectBinding: (projectId: string | null) => store.setActiveProjectBinding(projectId),
    openSessionMessage: async (sessionId: string, messageId?: string) => {
      menuStore.closeAll();
      await store.openSession(sessionId);
      workbench.setActiveProject(store.getSnapshot().activeSession?.projectId ?? null);
      if (messageId) store.requestMessageJump(sessionId, messageId);
    },
    subscribe: (listener) => {
      // 只在侧栏/工作台摘要相关字段真正变化时通知 workbench，杜绝流式正文/思考增量触发整页四栏重渲染。
      let prev = store.getSnapshot();
      const u1 = store.subscribe(() => {
        const next = store.getSnapshot();
        const sidebarChanged =
          prev.sessions !== next.sessions
          || prev.activeSessionId !== next.activeSessionId
          || prev.draftSession !== next.draftSession
          || prev.exitingDraftSession !== next.exitingDraftSession
          || prev.draftProjectId !== next.draftProjectId
          || prev.runningSessionIds !== next.runningSessionIds
          || prev.attention !== next.attention
          || prev.generalSettings.enableDotNotification !== next.generalSettings.enableDotNotification;
        prev = next;
        if (sidebarChanged) listener();
      });
      const u2 = menuStore.subscribe(listener);
      return () => {
        u1();
        u2();
      };
    },
    startNewChat: (options) => {
      menuStore.closeAll();
      const projectId = options?.projectId ?? store.getSnapshot().draftProjectId;
      // 草稿行点击与顶部「新聊天」共用同一入口：先回到聊天工作区，再开新会话草稿。
      workbench.navigate("workspace", projectId);
      store.startNewChatDraft(options);
    },
    openSession: (sessionId) => {
      menuStore.closeAll();
      if (sessionId.startsWith("draft:")) {
        const draft = store.getSnapshot().draftSession;
        workbench.navigate("workspace", draft?.projectId ?? null);
        store.startNewChatDraft({ projectId: draft?.projectId ?? null, sectionId: draft?.sectionId ?? null });
        return;
      }
      const target = store.getSnapshot().sessions.find((s) => s.id === sessionId);
      if (target?.unread) {
        void store.updateSessionMeta(sessionId, { unread: false });
      }
      return store.openSession(sessionId);
    },
    onSessionRowEnter: (session, rowEl) => {
      if (!session.draft) menuStore.onRowEnter(session.id, rowEl);
    },
    onSessionRowLeave: (session) => {
      if (!session.draft) menuStore.onRowLeave(session.id);
    },
    onSessionRowDoubleClick: (session) => {
      if (!session.draft) menuStore.openRename(session.id);
    },
    closeSessionMenus: () => menuStore.closeAll(),
    isSessionRowHighlighted: (sessionId, rowKey) =>
      !sessionId.startsWith("draft:") && menuStore.isHighlighted(sessionId, rowKey),
    renderSessionRowActions: (session) => session.draft ? null : (
      <SessionRowActions
        isZh={locale.isZh}
        session={session}
        chatStore={store}
        menuStore={menuStore}
      />
    ),
    renderSessionOverlays: ({ projects, sections }) => (
      <SessionOverlays
        isZh={locale.isZh}
        chatStore={store}
        menuStore={menuStore}
        projects={projects}
        sections={sections}
      />
    ),
    // 左二「项目工作区」：把同一棵工作区文件树注入左栏，避免布局包直接依赖聊天 store。
    renderProjectWorkspace: ({ projectId }) => {
      const chatSnap = store.getSnapshot();
      const wbSnap = workbench.getSnapshot();
      const boundId = projectId ?? chatSnap.activeSession?.projectId ?? chatSnap.draftProjectId ?? null;
      const boundName = boundId ? (wbSnap.projects.find((item) => item.id === boundId)?.name ?? null) : null;
      return (
        <ProjectWorkspacePane
          store={store}
          projectId={boundId}
          projectName={boundName}
          worktreeId={chatSnap.activeSession?.worktree?.id ?? chatSnap.draftWorktree?.id}
          isZh={locale.isZh}
          ensurePanelOpen={() => workbench.setRightPanelOpen(true, false)}
        />
      );
    },
  };
}