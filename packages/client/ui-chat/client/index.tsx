// 导出 @lfaa/chat/client Cordis 插件：装配对话工作区、最近会话来源、右栏工作台与设置中心页面。
// 同时把浏览器端会话 Store 注册为 `chatStore` 服务，供资料库、代码审查等同领域客户端包复用同一份状态。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ChatClientStore } from "./store/chat-store";
import { RightWorkbenchActions } from "./workbench/RightWorkbenchActions";
import { RightWorkbenchPane } from "./workbench/RightWorkbenchPane";
import { AgentSettingsView } from "./settings/AgentSettingsView";
import { ChatWorkspace } from "./conversation/ChatWorkspace";
import { GeneralSettingsView } from "./settings/GeneralSettingsView";
import { NotificationSettingsView } from "./settings/NotificationSettingsView";
import { SessionOverlays } from "./session/SessionOverlays";
import { SessionModeBar } from "./composer/SessionModeBar";
import { SessionRowActions } from "./session/SessionRowActions";
import { getChatLocale } from "./locales";
import { SessionMenuStore } from "./session/session-menu-store";

export { ChatClientStore } from "./store/chat-store";
// 会话类型与编码设置客户端仍由 chat 对外共享；媒体素材与资料库视图改由 @lfaa/tool-media/client 提供。
export * from "./store/chat-types";
export * from "./settings/coding-settings-client";
export * from "./locales";
export { enMessages } from "./locales.en";
export { zhMessages } from "./locales.zh";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 浏览器端会话 Store：对话、资料库与代码审查视图共享同一实例。 */
    chatStore: ChatClientStore;
  }
}

/** 向工作台注册聊天视图、会话来源和上下文面板，卸载时释放相关贡献。 */
export const chatClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/client-ui-chat/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new ChatClientStore();
    const menuStore = new SessionMenuStore();
    const locale = getChatLocale();
    // 同领域客户端包通过服务拿到同一份会话状态，避免各自再建一份。
    const disposeChatStore = context.provide("chatStore", store);

    // 点击系统通知时打开对应会话并回到聊天工作区；会话打开后审批横幅/澄清卡片自然出现。
    const onOpenSessionNotification = (event: Event) => {
      const sessionId = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId;
      if (!sessionId) return;
      menuStore.closeAll();
      context.workbench.navigate("workspace");
      void store.openSession(sessionId);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("lfaa:open-session", onOpenSessionNotification);
    }

    const unregisterProvider = context.workbench.registerChatProvider({
      getSessions: () => store.getSnapshot().sessions,
      getActiveSessionId: () => store.getSnapshot().activeSessionId,
      // 左二栏据此在后台仍在工作的会话上显示转圈；与当前打开了哪条会话无关。
      isSessionRunning: (sessionId: string) => store.isSessionRunning(sessionId),
      // 会话需要确认/回答时，左二栏显示对应徽标；由通知设置控制是否展示。
      getSessionAttention: (sessionId: string) => store.getSessionAttention(sessionId),
      searchChat: (query: string) => store.searchChat(query),
      openSessionMessage: async (sessionId: string, messageId?: string) => {
        menuStore.closeAll();
        await store.openSession(sessionId);
        if (messageId) store.requestMessageJump(sessionId, messageId);
      },
      subscribe: (listener) => {
        const u1 = store.subscribe(listener);
        const u2 = menuStore.subscribe(listener);
        return () => {
          u1();
          u2();
        };
      },
      startNewChat: (options) => {
        menuStore.closeAll();
        store.startNewChatDraft(options);
      },
      openSession: (sessionId) => {
        menuStore.closeAll();
        const target = store.getSnapshot().sessions.find((s) => s.id === sessionId);
        if (target?.unread) {
          void store.updateSessionMeta(sessionId, { unread: false });
        }
        return store.openSession(sessionId);
      },
      onSessionRowEnter: (session, rowEl) => menuStore.onRowEnter(session.id, rowEl),
      onSessionRowLeave: (session) => menuStore.onRowLeave(session.id),
      onSessionRowDoubleClick: (session) => menuStore.openRename(session.id),
      closeSessionMenus: () => menuStore.closeAll(),
      isSessionRowHighlighted: (sessionId, rowKey) => menuStore.isHighlighted(sessionId, rowKey),
      renderSessionRowActions: (session) => (
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
    });

    const unregisterWorkspace = context.workbench.registerView({
      id: "workspace",
      title: locale.workspaceTitle,
      render: () => {
        const wbSnap = context.workbench.getSnapshot();
        return (
          <ChatWorkspace
            locale={locale}
            store={store}
            projects={wbSnap.projects}
            projectProvider={wbSnap.projectProvider}
            onOpenSettings={() => context.workbench.navigate("settings:config")}
            onOpenTurnChanges={(messageId) => {
              store.requestRightPanel("review", messageId);
              context.workbench.setRightPanelOpen(true, false);
            }}
            onOpenFilePreview={(messageId, stepId) => {
              if (store.openFilePreview(messageId, stepId)) {
                store.requestRightPanel("file-preview");
                context.workbench.setRightPanelOpen(true, false);
              }
            }}
            onOpenBrowser={() => {
              store.requestRightPanel("browser");
              context.workbench.setRightWorkbenchWide(true);
              context.workbench.setRightPanelOpen(true, false);
            }}
          />
        );
      },
    });

    const unregisterConfigView = context.workbench.registerView({
      id: "settings:config",
      title: locale.settingsTitle,
      render: () => {
        const snap = store.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId;
        return (
          <AgentSettingsView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
          />
        );
      },
    });

    const unregisterGeneralView = context.workbench.registerView({
      id: "settings:general",
      title: locale.isZh ? "常规" : "General",
      render: () => <GeneralSettingsView locale={getChatLocale()} store={store} />,
    });

    const unregisterNotificationView = context.workbench.registerView({
      id: "settings:notifications",
      title: locale.isZh ? "通知" : "Notifications",
      render: () => <NotificationSettingsView locale={getChatLocale()} store={store} />,
    });

    const unregisterContextPanel = context.workbench.registerContextPanel({
      id: "agent-capabilities",
      title: locale.isZh ? "工作台" : "Workbench",
      order: 5,
      chrome: "workbench",
      match: (activeView) =>
        activeView === "workspace"
        || activeView === "project"
        || activeView === "settings:storage",
      render: (renderCtx) => {
        const chatSnap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundId = chatSnap.activeSession?.projectId ?? chatSnap.draftProjectId ?? wbSnap.activeProjectId;
        const boundName = boundId ? (wbSnap.projects.find((p) => p.id === boundId)?.name ?? null) : null;
        const boundWorktreeId = chatSnap.activeSession?.worktree?.id ?? chatSnap.draftWorktree?.id;
        return (
          <RightWorkbenchPane
            locale={locale}
            store={store}
            boundProjectId={boundId}
            boundProjectName={boundName}
            boundWorktreeId={boundWorktreeId}
            showFilePreview={wbSnap.activeView === "workspace"}
            utilityPanels={renderCtx?.utilityPanels}
            projectContext={renderCtx?.projectContext}
            compact={renderCtx?.compact}
            rightPanelMaximized={renderCtx?.rightPanelMaximized}
            onToggleMaximizeRightPanel={renderCtx?.onToggleMaximizeRightPanel}
            onCollapseRightPanel={renderCtx?.onCollapseRightPanel}
            onCloseDrawer={renderCtx?.onCloseDrawer}
            onStageWideChange={(wide) => context.workbench.setRightWorkbenchWide(wide)}
            onOpenSettings={() => context.workbench.navigate("settings:config")}
            onOpenCodeReview={() => context.workbench.navigate("codeReview")}
            onOpenExtensions={() => context.workbench.navigate("plugins")}
          />
        );
      },
    });

    const unregisterTitleAction = context.workbench.registerTitleAction({
      id: "chat-session-mode",
      order: 10,
      render: () => {
        if (context.workbench.getSnapshot().activeView !== "workspace") return null;
        return <SessionModeBar store={store} isZh={locale.isZh} />;
      },
    });

    const unregisterWorkspaceAction = context.workbench.registerWorkspaceAction({
      id: "agent-session-actions",
      order: 5,
      render: (actionCtx) => {
        const wbSnap = context.workbench.getSnapshot();
        const showHere =
          wbSnap.activeView === "workspace"
          || wbSnap.activeView === "project"
          || wbSnap.activeView === "library"
          || wbSnap.activeView === "settings:storage";
        if (!showHere || actionCtx.compact || actionCtx.rightPanelMaximized) return null;
        const chatSnap = store.getSnapshot();
        const boundId = chatSnap.activeSession?.projectId ?? chatSnap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <RightWorkbenchActions
            variant="sessionOnly"
            isZh={locale.isZh}
            store={store}
            projectId={boundId}
            projectName={wbSnap.projects.find((project) => project.id === boundId)?.name}
            onEnsureRightPanelOpen={() => context.workbench.setRightPanelOpen(true)}
            onOpenExtensions={() => context.workbench.navigate("plugins")}
          />
        );
      },
    });

    void store.hydrate().then(() => {
      if (typeof window !== "undefined") {
        const paramId = new URLSearchParams(window.location.search).get("sessionId");
        if (paramId) {
          void store.openSession(paramId);
        }
      }
    });

    context.effect(() => () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("lfaa:open-session", onOpenSessionNotification);
      }
      unregisterWorkspaceAction();
      unregisterTitleAction();
      unregisterContextPanel();
      unregisterNotificationView();
      unregisterGeneralView();
      unregisterConfigView();
      unregisterWorkspace();
      unregisterProvider();
      menuStore.dispose();
      store.dispose();
      disposeChatStore();
    });
  },
};