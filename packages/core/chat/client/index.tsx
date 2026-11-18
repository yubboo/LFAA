// 导出 @lfaa/chat/client Cordis 插件，装配主聊天工作台、最近会话提供方、能力上下文栏与模型规则设置页。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ChatClientStore } from "./chat-store";
import { AgentContextPanel } from "./components/AgentContextPanel";
import { AgentSettingsView } from "./components/AgentSettingsView";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { getChatLocale } from "./locales";

export { ChatClientStore } from "./chat-store";

export const chatClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/chat/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new ChatClientStore();
    const locale = getChatLocale();

    const unregisterProvider = context.workbench.registerChatProvider({
      getSessions: () => store.getSnapshot().sessions,
      getActiveSessionId: () => store.getSnapshot().activeSessionId,
      subscribe: store.subscribe,
      startNewChat: (options) => {
        store.startNewChatDraft(options);
      },
      openSession: (sessionId) => store.openSession(sessionId),
    });

    const unregisterWorkspace = context.workbench.registerView({
      id: "workspace",
      title: locale.workspaceTitle,
      render: () => (
        <ChatWorkspace
          locale={locale}
          store={store}
          projects={context.workbench.getSnapshot().projects}
          onOpenSettings={() => context.workbench.navigate("settings:config")}
        />
      ),
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

    const unregisterContextPanel = context.workbench.registerContextPanel({
      id: "agent-capabilities",
      title: locale.contextTitle,
      order: 5,
      match: (activeView) => activeView === "workspace" || activeView === "project",
      render: () => {
        const chatSnap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundId = chatSnap.activeSession?.projectId ?? chatSnap.draftProjectId ?? wbSnap.activeProjectId;
        const boundName = boundId ? (wbSnap.projects.find((p) => p.id === boundId)?.name ?? null) : null;
        return (
          <AgentContextPanel
            locale={locale}
            store={store}
            boundProjectName={boundName}
            onOpenSettings={() => context.workbench.navigate("settings:config")}
          />
        );
      },
    });

    void store.hydrate();

    context.effect(() => () => {
      unregisterContextPanel();
      unregisterConfigView();
      unregisterWorkspace();
      unregisterProvider();
      store.dispose();
    });
  },
};
