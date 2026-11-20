// 导出 @lfaa/chat/client Cordis 插件，装配主聊天工作台、最近会话提供方、能力上下文栏与模型规则设置页。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ChatClientStore } from "./chat-store";
import { RightWorkbenchActions } from "./components/RightWorkbenchActions";
import { RightWorkbenchPane } from "./components/RightWorkbenchPane";
import { AgentSettingsView } from "./components/AgentSettingsView";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { CodeReviewSettingsView } from "./components/CodeReviewSettingsView";
import { CodeReviewView } from "./components/CodeReviewView";
import { GeneralSettingsView } from "./components/GeneralSettingsView";
import { GitSettingsView } from "./components/GitSettingsView";
import { LibraryView } from "./components/LibraryView";
import { SessionOverlays } from "./components/SessionOverlays";
import { SessionModeBar } from "./components/SessionModeBar";
import { SessionRowActions } from "./components/SessionRowActions";
import { StorageSettingsView } from "./components/StorageSettingsView";
import { getChatLocale } from "./locales";
import { SessionMenuStore } from "./session-menu-store";

export { ChatClientStore } from "./chat-store";

/** 向工作台注册聊天视图、会话来源和上下文面板，卸载时释放相关贡献。 */
export const chatClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/chat/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new ChatClientStore();
    const menuStore = new SessionMenuStore();
    const locale = getChatLocale();

    const unregisterProvider = context.workbench.registerChatProvider({
      getSessions: () => store.getSnapshot().sessions,
      getActiveSessionId: () => store.getSnapshot().activeSessionId,
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
      isSessionRowHighlighted: (sessionId) => menuStore.isHighlighted(sessionId),
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

    const unregisterLibraryView = context.workbench.registerView({
      id: "library",
      title: locale.libraryTitle,
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <LibraryView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
            activeTab={wbSnap.activeLibraryTab}
            onChangeTab={(nextTab) => context.workbench.setLibraryTab(nextTab)}
            onOpenStorageSettings={() => context.workbench.navigate("settings:storage")}
          />
        );
      },
    });

    const unregisterGeneralView = context.workbench.registerView({
      id: "settings:general",
      title: locale.isZh ? "常规" : "General",
      render: () => <GeneralSettingsView locale={getChatLocale()} store={store} />,
    });

    const unregisterStorageView = context.workbench.registerView({
      id: "settings:storage",
      title: locale.storageTitle,
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <StorageSettingsView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
          />
        );
      },
    });

    const unregisterGitSettingsView = context.workbench.registerView({
      id: "settings:git",
      title: "Git",
      render: () => (
        <GitSettingsView
          locale={getChatLocale()}
          onOpenCodeReviewWorkbench={() => context.workbench.navigate("codeReview")}
        />
      ),
    });

    const unregisterCodeReviewSettingsView = context.workbench.registerView({
      id: "settings:codeReview",
      title: locale.isZh ? "代码审查" : "Code Review",
      render: () => (
        <CodeReviewSettingsView
          locale={getChatLocale()}
          onOpenCodeReviewWorkbench={() => context.workbench.navigate("codeReview")}
        />
      ),
    });

    const unregisterCodeReviewView = context.workbench.registerView({
      id: "codeReview",
      title: locale.isZh ? "代码审查" : "Code Review",
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <CodeReviewView
            locale={getChatLocale()}
            store={store}
            boundProjectId={boundProjectId}
            activeDomainItem={wbSnap.activeDomainItem}
            onSelectDomainItem={(item) => context.workbench.setDomainItem(item)}
            onOpenGitSettings={() => context.workbench.navigate("settings:git")}
            onOpenReviewSettings={() => context.workbench.navigate("settings:codeReview")}
            onNavigateToChat={() => context.workbench.navigate("workspace")}
          />
        );
      },
    });

    const unregisterContextPanel = context.workbench.registerContextPanel({
      id: "agent-capabilities",
      title: locale.isZh ? "工作台" : "Workbench",
      order: 5,
      chrome: "workbench",
      match: (activeView) =>
        activeView === "workspace"
        || activeView === "project"
        || activeView === "library"
        || activeView === "settings:storage",
      render: (renderCtx) => {
        const chatSnap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundId = chatSnap.activeSession?.projectId ?? chatSnap.draftProjectId ?? wbSnap.activeProjectId;
        const boundName = boundId ? (wbSnap.projects.find((p) => p.id === boundId)?.name ?? null) : null;
        return (
          <RightWorkbenchPane
            locale={locale}
            store={store}
            boundProjectId={boundId}
            boundProjectName={boundName}
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
      unregisterWorkspaceAction();
      unregisterTitleAction();
      unregisterContextPanel();
      unregisterCodeReviewView();
      unregisterCodeReviewSettingsView();
      unregisterGitSettingsView();
      unregisterStorageView();
      unregisterGeneralView();
      unregisterLibraryView();
      unregisterConfigView();
      unregisterWorkspace();
      unregisterProvider();
      menuStore.dispose();
      store.dispose();
    });
  },
};
