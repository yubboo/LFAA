// 会话与右栏的快捷键动作注册：只登记真实可执行的功能；动作与界面按钮共用同一实现，键位由设置中心改写。
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "./store/chat-store";
import { runComposerCommand } from "./composer/composer-commands";
import { openNewWorkbenchTab } from "./workbench/new-tab";
import { readTerminalPlacement } from "./workbench/terminal-placement";
import { defaultShortcutKeys } from "@lfaa/ui-layout/client";

/** 注册会话/工作台动作，返回逐项注销函数；插件卸载时调用。 */
export function registerChatShortcuts(input: {
  workbench: WorkbenchClientService;
  store: ChatClientStore;
  closeSessionMenus: () => void;
}): Array<() => void> {
  const { workbench, store, closeSessionMenus } = input;
  const openWorkbenchTab = (tab: string) => {
    // 终端可能被用户挪到底部面板：此时不再开右栏标签，直接展开底部面板。
    if (tab === "shell" && readTerminalPlacement() === "bottom") {
      // 底部模式：展开底部终端并聚焦，而不是开右栏标签。
      window.dispatchEvent(new CustomEvent("lfaa:terminal-focus"));
      return;
    }
    store.requestRightPanel(tab);
    workbench.setRightPanelOpen(true, false);
  };

  return [
    workbench.registerShortcut({
      id: "session.new-chat",
      group: "session",
      title: { zh: "新聊天", en: "New chat" },
      description: { zh: "在当前项目里开一条新对话", en: "Start a chat in the current project" },
      defaultKeys: defaultShortcutKeys("session.new-chat"),
      run: () => {
        closeSessionMenus();
        const snap = store.getSnapshot();
        const projectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? null;
        workbench.navigate("workspace", projectId);
        store.startNewChatDraft({ projectId });
      },
    }),
    workbench.registerShortcut({
      id: "session.archive",
      group: "session",
      title: { zh: "归档/取消归档当前会话", en: "Archive current chat" },
      description: { zh: "归档当前会话；已归档则取消归档", en: "Archive or unarchive the current chat" },
      defaultKeys: defaultShortcutKeys("session.archive"),
      run: () => {
        const session = store.getSnapshot().activeSession;
        if (session) void store.updateSessionMeta(session.id, { archived: !session.archived });
      },
    }),
    workbench.registerShortcut({
      id: "session.pin",
      group: "session",
      title: { zh: "置顶/取消置顶当前会话", en: "Pin current chat" },
      description: { zh: "把当前会话固定到左二置顶分组", en: "Pin or unpin the current chat" },
      defaultKeys: defaultShortcutKeys("session.pin"),
      run: () => {
        const session = store.getSnapshot().activeSession;
        if (session) void store.updateSessionMeta(session.id, { pinned: !session.pinned });
      },
    }),
    workbench.registerShortcut({
      id: "session.mark-unread",
      group: "session",
      title: { zh: "标记当前会话未读", en: "Mark chat unread" },
      description: { zh: "在左二会话行上保留未读圆点", en: "Keep the unread dot on the chat row" },
      defaultKeys: defaultShortcutKeys("session.mark-unread"),
      run: () => {
        const session = store.getSnapshot().activeSession;
        if (session) void store.updateSessionMeta(session.id, { unread: true });
      },
    }),
    workbench.registerShortcut({
      id: "session.abort",
      group: "session",
      title: { zh: "中止当前回复", en: "Stop current reply" },
      description: { zh: "停止正在运行的 Agent 轮次", en: "Stop the running agent turn" },
      defaultKeys: defaultShortcutKeys("session.abort"),
      run: () => {
        if (!store.getSnapshot().runningRunId) return;
        // 输入栏挂载时由它统一收口；否则直接中止运行，保证快捷键始终可用。
        if (!runComposerCommand("stop")) void store.abortActiveRun();
      },
    }),
    workbench.registerShortcut({
      id: "composer.dictation",
      group: "session",
      title: { zh: "语音听写", en: "Dictation" },
      description: { zh: "开始或结束输入栏语音听写", en: "Start or stop voice dictation in the composer" },
      defaultKeys: defaultShortcutKeys("composer.dictation"),
      run: () => { runComposerCommand("dictation"); },
    }),
    workbench.registerShortcut({
      id: "composer.reasoning",
      group: "session",
      title: { zh: "选择推理强度", en: "Reasoning effort" },
      description: { zh: "打开模型/推理强度选择浮窗", en: "Open the model and reasoning picker" },
      defaultKeys: defaultShortcutKeys("composer.reasoning"),
      run: () => { runComposerCommand("reasoning"); },
    }),
    workbench.registerShortcut({
      id: "workbench.new-tab",
      group: "workbench",
      title: { zh: "新建标签页", en: "New tab" },
      description: { zh: "在右侧工作台新建一个标签页，工作台收起时先自动展开", en: "Open a workbench tab, expanding the workbench when collapsed" },
      defaultKeys: defaultShortcutKeys("workbench.new-tab"),
      run: () => openNewWorkbenchTab({ workbench, store }),
    }),
    workbench.registerShortcut({
      id: "workbench.terminal",
      group: "workbench",
      title: { zh: "打开终端", en: "Open terminal" },
      description: { zh: "在右侧工作台打开真实终端（PTY）", en: "Open the real terminal (PTY) in the right workbench" },
      defaultKeys: defaultShortcutKeys("workbench.terminal"),
      run: () => openWorkbenchTab("shell"),
    }),
    workbench.registerShortcut({
      id: "workbench.review",
      group: "workbench",
      title: { zh: "打开变更审查", en: "Open changes review" },
      description: { zh: "在右侧工作台打开本轮/工作区变更", en: "Open turn or workspace changes" },
      defaultKeys: defaultShortcutKeys("workbench.review"),
      run: () => openWorkbenchTab("review"),
    }),
    workbench.registerShortcut({
      id: "workbench.side-ask",
      group: "workbench",
      title: { zh: "打开侧边提问", en: "Open side ask" },
      description: { zh: "在右侧工作台开一个不打断主对话的短问", en: "Ask a quick side question" },
      defaultKeys: defaultShortcutKeys("workbench.side-ask"),
      run: () => openWorkbenchTab("sideAsk"),
    }),
  ];
}
