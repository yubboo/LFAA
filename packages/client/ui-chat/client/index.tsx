// 导出 @lfaa/chat/client Cordis 插件：装配对话工作区、最近会话来源、右栏工作台与设置中心页面。
// 同时把浏览器端会话 Store 注册为 `chatStore` 服务，供资料库、代码审查等同领域客户端包复用同一份状态。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ChatClientStore } from "./store/chat-store";
import { RightWorkbenchActions } from "./workbench/RightWorkbenchActions";
import { RightWorkbenchPane } from "./workbench/RightWorkbenchPane";
import { createChatProvider } from "./workbench-provider";
import { AgentSettingsView } from "./settings/AgentSettingsView";
import { ChatWorkspace } from "./conversation/ChatWorkspace";
import { registerTerminalDock } from "./workbench/terminal-dock";

import { GeneralSettingsView } from "./settings/GeneralSettingsView";
import { NotificationSettingsView } from "./settings/NotificationSettingsView";
import { ShortcutsSettingsView } from "./settings/ShortcutsSettingsView";
import { TerminalSettingsView } from "./settings/TerminalSettingsView";
import { SessionModeTitleAction } from "./composer/SessionModeBar";
import { getChatLocale } from "./locales";
import { registerChatShortcuts } from "./shortcut-actions";
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
    // 稳定持有工作台服务引用：Cordis 服务访问器每次取值可能返回新的代理，传进组件会击穿 effect 依赖。
    const workbench = context.workbench;
    const menuStore = new SessionMenuStore();
    const locale = getChatLocale();
    // 底部终端面板：注册失败不影响聊天视图，注销由 effect 兜底。
    const unregisterBottomTerminal = registerTerminalDock(workbench, store, locale);
    context.effect(() => () => unregisterBottomTerminal());
    // 同领域客户端包通过服务拿到同一份会话状态，避免各自再建一份。
    const disposeChatStore = context.provide("chatStore", store);

    // 点击系统通知时打开对应会话并回到聊天工作区；会话打开后审批横幅/澄清卡片自然出现。
    const onOpenSessionNotification = (event: Event) => {
      const sessionId = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId;
      if (!sessionId) return;
      menuStore.closeAll();
      const target = store.getSnapshot().sessions.find((s) => s.id === sessionId);
      context.workbench.navigate("workspace", target?.projectId ?? null);
      void store.openSession(sessionId).then(() => {
        context.workbench.setActiveProject(store.getSnapshot().activeSession?.projectId ?? null);
      });
    };
    if (typeof window !== "undefined") {
      window.addEventListener("lfaa:open-session", onOpenSessionNotification);
    }

    // 当 Agent 触发自动跟随请求时，自动展开右侧工作台（仅在 workspace/project 视图下生效，避免打断设置页）。
    let lastAutoExpandNonce = 0;
    const unsubscribeAutopilotExpand = store.subscribe(() => {
      const req = store.getSnapshot().rightPanelRequest;
      if (!req?.autoExpand || req.nonce === lastAutoExpandNonce) return;
      lastAutoExpandNonce = req.nonce;
      const wb = context.workbench.getSnapshot();
      if (wb.activeView !== "workspace" && wb.activeView !== "project") return;
      context.workbench.setRightWorkbenchWide(true);
      context.workbench.setRightPanelOpen(true, false);
    });

    const unregisterProvider = context.workbench.registerChatProvider(
      createChatProvider({ store, workbench, menuStore, locale }),
    );

    // 会话与右栏动作注册：只登记真实可执行的功能，键位由设置中心统一改写。
    const unregisterShortcuts = registerChatShortcuts({
      workbench,
      store,
      closeSessionMenus: () => menuStore.closeAll(),
    });

    // 稳定回调引用：避免 WorkbenchShell 刷新时重建内联函数击穿长对话 ChatMessageRow 的 React.memo。
    const onWorkspaceModeChange = (mode: "chatgpt" | "codex") => context.workbench.setWorkspaceMode(mode);
    const onProjectContextChange = (projectId: string | null) => context.workbench.setActiveProject(projectId);
    const onOpenSettings = () => context.workbench.navigate("settings:config");
    const onOpenTurnChanges = (messageId: string) => {
      store.requestRightPanel("review", messageId);
      context.workbench.setRightPanelOpen(true, false);
    };
    const onOpenFilePreview = (messageId: string, stepId: string) => {
      if (store.openFilePreview(messageId, stepId)) {
        store.requestRightPanel("file-preview");
        context.workbench.setRightPanelOpen(true, false);
      }
    };
    const onOpenBrowser = () => {
      store.requestRightPanel("browser", undefined, { refreshBrowser: true });
      context.workbench.setRightWorkbenchWide(true);
      context.workbench.setRightPanelOpen(true, false);
    };

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
            workspaceMode={wbSnap.workspaceMode}
            onWorkspaceModeChange={onWorkspaceModeChange}
            onProjectContextChange={onProjectContextChange}
            onOpenSettings={onOpenSettings}
            onOpenTurnChanges={onOpenTurnChanges}
            onOpenFilePreview={onOpenFilePreview}
            onOpenBrowser={onOpenBrowser}
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
      render: () => {
        const wbSnap = context.workbench.getSnapshot();
        return (
          <GeneralSettingsView
            locale={getChatLocale()}
            store={store}
            layoutMode={wbSnap.layoutMode}
            onLayoutModeChange={(mode) => context.workbench.setLayoutMode(mode)}
          />
        );
      },
    });

    const unregisterNotificationView = context.workbench.registerView({
      id: "settings:notifications",
      title: locale.isZh ? "通知" : "Notifications",
      render: () => <NotificationSettingsView locale={getChatLocale()} store={store} />,
    });

    const unregisterTerminalView = context.workbench.registerView({ id: "settings:terminal", title: locale.isZh ? "终端" : "Terminal", render: () => <TerminalSettingsView isZh={locale.isZh} /> });

    const unregisterShortcutsView = context.workbench.registerView({
      id: "settings:shortcuts",
      title: locale.isZh ? "键盘快捷键" : "Keyboard shortcuts",
      render: () => <ShortcutsSettingsView locale={getChatLocale()} workbench={workbench} />,
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
        const previewCenter = renderCtx?.layoutMode === "preview-center";
        const collapseWorkbench = () => {
          store.pauseAutopilotForCurrentRun();
          renderCtx?.onCollapseRightPanel?.();
        };
        return (
          <RightWorkbenchPane
            locale={locale}
            store={store}
            sessionMenuStore={menuStore}
            workbench={workbench}
            boundProjectId={boundId}
            boundProjectName={boundName}
            boundWorktreeId={boundWorktreeId}
            showFilePreview={wbSnap.activeView === "workspace"}
            utilityPanels={renderCtx?.utilityPanels}
            projectContext={renderCtx?.projectContext}
            compact={renderCtx?.compact}
            layoutMode={renderCtx?.layoutMode ?? "chat-center"}
            rightPanelMaximized={renderCtx?.rightPanelMaximized}
            onToggleMaximizeRightPanel={renderCtx?.onToggleMaximizeRightPanel}
            hideCollapse={previewCenter && wbSnap.rightPanelOpen}
            // 预览区在左时最右一列是会话列：这枚按钮仍按「谁在最右就管谁」切换它。
            onCollapseRightPanel={previewCenter ? () => context.workbench.toggleRightPanel() : collapseWorkbench}
            // 关掉预览列最后一个标签：收起预览列，把整片宽度让给会话列。
            onLastTabClose={previewCenter ? () => context.workbench.setPreviewPaneOpen(false) : collapseWorkbench}
            onCloseDrawer={() => {
              store.pauseAutopilotForCurrentRun();
              renderCtx?.onCloseDrawer?.();
            }}
            onStageWideChange={(wide) => context.workbench.setRightWorkbenchWide(wide)}
            onOpenSettings={() => context.workbench.navigate("settings:config")}
            onOpenCodeReview={() => context.workbench.navigate("codeReview")}
            onOpenExtensions={() => context.workbench.navigate("plugins")}
          />
        );
      },
    });

    // 会话模式徽标：只有在真的进入某个会话（已有消息）时才挂到顶栏标题右侧，
    // 空会话仍由输入栏里的胶囊承担，标题栏不出现空占位。
    const unregisterTitleAction = context.workbench.registerTitleAction({
      id: "chat-session-mode",
      order: 5,
      render: () => <SessionModeTitleAction store={store} isZh={locale.isZh} />,
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
        // 没有已开始的对话时不挂「更多操作 / 概览」；首条消息落库并回读后才出现。
        const hasConversation = Boolean(chatSnap.activeSessionId && (chatSnap.activeSession?.messages.length ?? 0) > 0);
        // 预览区在左时顶栏只留一枚侧面板开关（由 WorkspaceBar 的最右端那颗承担），这里不再重复。
        const previewCenter = wbSnap.layoutMode === "preview-center";
        return (
          <RightWorkbenchActions
            variant={previewCenter ? "full" : "sessionOnly"}
            isZh={locale.isZh}
            store={store}
            projectId={boundId}
            projectName={wbSnap.projects.find((project) => project.id === boundId)?.name}
            onEnsureRightPanelOpen={() => context.workbench.setRightPanelOpen(true)}
            onOpenExtensions={() => context.workbench.navigate("plugins")}
            onToggleMaximize={() => context.workbench.toggleRightPanelMaximized()}
            hideSessionControls={!hasConversation}
          />
        );
      },
    });

    void store.hydrate().then(() => {
      const snap = store.getSnapshot();
      const wb = context.workbench.getSnapshot();
      const restoredProjectId = snap.activeSession?.projectId ?? snap.draftProjectId;
      if (wb.activeView === "workspace" && !wb.activeProjectId && restoredProjectId) {
        context.workbench.setActiveProject(restoredProjectId);
      }
      if (typeof window !== "undefined") {
        const paramId = new URLSearchParams(window.location.search).get("sessionId");
        if (paramId) {
          void store.openSession(paramId).then(() => {
            context.workbench.setActiveProject(store.getSnapshot().activeSession?.projectId ?? null);
          });
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
      unregisterShortcutsView();
      unregisterGeneralView();
      unregisterConfigView();
      unregisterWorkspace();
      unregisterProvider();
      for (const dispose of unregisterShortcuts) dispose();
      unsubscribeAutopilotExpand();
      menuStore.dispose();
      store.dispose();
      disposeChatStore();
    });
  },
};

