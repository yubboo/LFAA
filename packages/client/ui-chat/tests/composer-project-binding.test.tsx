// 验证输入区项目入口融合（工作模式不重复显示项目、聊天模式紧跟 + 展示独立胶囊）及草稿项目记忆持久化。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { ChatComposer } = await import("../client/composer/ChatComposer");
const { ChatClientStore } = await import("../client/store/chat-store");
const { readStoredDraftProjectId, readStoredDraftSectionId } = await import("../client/store/chat-preferences");
const { zhMessages } = await import("../client/locales.zh");

function installMockStorage() {
  const map = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
      removeItem: (key: string) => { map.delete(key); },
    },
  };
  return {
    restore() {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window: unknown }).window = prevWindow;
    },
  };
}

function renderComposerHtml(options: {
  mode: "chatgpt" | "codex";
  activeProjectId: string | null;
}): string {
  const noop = () => {};
  const store = new ChatClientStore();
  const state = store.getSnapshot();
  const projects = [{ id: "p-app1", name: "app1", rootPath: "D:\\Documents\\lfaa\\app1", createdAt: 1 }];
  return renderToStaticMarkup(createElement(ChatComposer, {
    locale: zhMessages,
    store,
    state,
    composer: {
      draft: "",
      setDraft: noop,
      attachments: [],
      setAttachments: noop,
      appendAttachments: noop,
      contextNotice: "",
      setContextNotice: noop,
      mentionTrigger: null,
      setMentionTrigger: noop,
      mentionIndex: 0,
      setMentionIndex: noop,
      slashTrigger: null,
      setSlashTrigger: noop,
      slashIndex: 0,
      setSlashIndex: noop,
      skillTrigger: null,
      setSkillTrigger: noop,
      skillIndex: 0,
      setSkillIndex: noop,
      openProjectSignal: 0,
      requestProjectPicker: noop,
      visibleMentionEntries: [],
      visibleSlashCommands: [],
      visibleSkillEntries: [],
      textareaRef: { current: null },
      fileInputRef: { current: null },
      syncMentionFromText: noop,
      focusTextareaAt: noop,
      handleSelectSkillEntry: noop,
      handleTabCompleteSlashCommand: noop,
      handleSelectSlashCommand: noop,
      handleSelectMentionEntry: noop,
      handleSubmit: async () => {},
      selectedMediaKind: undefined,
      mediaRatio: "auto",
      setMediaRatio: noop,
      mediaStyle: "auto",
      setMediaStyle: noop,
      removeAttachment: noop,
      undoAttachmentInsert: () => false,
    },
    projects,
    workspaceMode: options.mode,
    docked: false,
    canCreateProject: true,
    activeProjectId: options.activeProjectId,
    activeSession: null,
    messages: [],
    messagesCount: 0,
    isRunning: false,
    needsApiKey: false,
    clarification: undefined,
    lastMessageId: undefined,
    bindingProject: false,
    stats: { filesCount: 0, countedChanges: false, added: 0, removed: 0 },
    worktree: null,
    onSelectProject: noop,
    onCreateProject: noop,
    onSkipClarification: noop,
    onAnswerClarification: noop,
    onOpenSettings: noop,
    onDeleteRequest: noop,
  }));
}

test("工作模式绑定项目空会话：项目与模式在头行，+ 留在工具行且不再单列素材库按钮", () => {
  const html = renderComposerHtml({ mode: "codex", activeProjectId: "p-app1" });
  const app1Triggers = html.match(/<button[^>]*>[^<]*<svg[\s\S]*?<\/svg>[^<]*<span[^>]*>app1<\/span><\/button>/gu) ?? [];
  assert.equal(app1Triggers.length, 1);
  assert.doesNotMatch(html, /data-project-picker-trigger="true"/u);
  assert.match(html, /aria-label="添加上下文"/u);
  assert.match(html, /输入任何问题，输入 @ 提及，\/ 触发操作/u);
  // 模式胶囊进卡片头行（textarea 之前）；+ 在工具行，素材库入口已并入「添加上下文」菜单。
  assert.ok(html.indexOf('aria-label="会话模式') > -1);
  assert.ok(html.indexOf('aria-label="会话模式') < html.indexOf("<textarea"));
  assert.ok(html.indexOf('aria-label="添加上下文"') > html.indexOf("<textarea"));
  assert.doesNotMatch(html, /aria-label="生成素材库"/u);
});

test("项目内会话固定工作形态：聊天模式也按工作布局渲染项目入口", () => {
  const html = renderComposerHtml({ mode: "chatgpt", activeProjectId: "p-app1" });
  // 项目内不再出现聊天模式独有的独立项目胶囊，项目入口进卡片头行。
  assert.doesNotMatch(html, /data-project-picker-trigger="true"/u);
  assert.doesNotMatch(html, /aria-label="绑定项目 · app1"/u);
  assert.match(html, /aria-label="绑定项目"/u);
  assert.ok(html.indexOf('aria-label="绑定项目"') < html.indexOf("<textarea"));
  assert.match(html, /aria-label="添加上下文"/u);
  assert.match(html, /输入任何问题，输入 @ 提及，\/ 触发操作/u);
});

test("聊天模式未绑定项目（如从最近开新会话）：无项目胶囊且使用默认占位", () => {
  const html = renderComposerHtml({ mode: "chatgpt", activeProjectId: null });
  assert.doesNotMatch(html, /data-project-picker-trigger="true"/u);
  assert.doesNotMatch(html, /app1/u);
  assert.match(html, /询问 小鱼/u);
});

test("ChatClientStore 持久化新会话草稿的项目与分区绑定，刷新重建后自动恢复", async () => {
  const mock = installMockStorage();
  try {
    const store1 = new ChatClientStore();
    store1.startNewChatDraft({ projectId: "p-app1", sectionId: "sec-1" });
    assert.equal(readStoredDraftProjectId(), "p-app1");
    assert.equal(readStoredDraftSectionId(), "sec-1");

    const store2 = new ChatClientStore();
    assert.equal(store2.getSnapshot().draftProjectId, "p-app1");
    assert.equal(store2.getSnapshot().draftSectionId, "sec-1");
    // 刷新后仍停在草稿：左二项目下要继续看到可返回的新会话行。
    assert.equal(store2.getSnapshot().draftSession?.id, "draft:p-app1");
    assert.equal(store2.getSnapshot().draftSession?.draft, true);

    await store2.setActiveProjectBinding(null);
    assert.equal(readStoredDraftProjectId(), null);
    const store3 = new ChatClientStore();
    assert.equal(store3.getSnapshot().draftProjectId, null);
  } finally {
    mock.restore();
  }
});
