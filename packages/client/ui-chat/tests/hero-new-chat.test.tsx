// 验证新会话空态引导：不再渲染项目范围提示条与额外说明，只保留标题、模式、输入栏与起步建议。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { ChatMessageList } = await import("../client/conversation/ChatMessageList");
const { zhMessages } = await import("../client/locales.zh");

/** 空会话引导区的最小属性集：本用例只关心新会话是否还带额外提示。 */
function renderEmptyHero(options: {
  mode: "chatgpt" | "codex";
  projectName?: string | null;
  starterSuggestions?: string[] | null;
  showHomeSuggestions?: boolean;
}): string {
  const noop = () => {};
  return renderToStaticMarkup(createElement(ChatMessageList, {
    locale: zhMessages,
    messages: [],
    lastMessage: undefined,
    clarification: undefined,
    starterSuggestions: options.starterSuggestions ?? null,
    heroProject: options.projectName
      ? {
          name: options.projectName,
          projects: [],
          selectedProjectId: "p1",
          canCreateProject: false,
          onSelectProject: noop,
          onCreateProject: noop,
        }
      : null,
    workspaceMode: options.mode,
    heroComposer: createElement("div", null, "composer"),
    onWorkspaceModeChange: noop,
    selectedFile: undefined,
    pendingApproval: null,
    memoriesCount: 0,
    isRunning: false,
    showHomeSuggestions: options.showHomeSuggestions ?? false,
    brandWatermark: false,
    activeSessionId: "",
    assistantBodyClass: undefined,
    noticeLinkClass: undefined,
    onOpenFilePreview: noop,
    onOpenTurnChanges: undefined,
    onEditContent: noop,
    onOpenTrace: noop,
    onBranchToNewChat: noop,
    onContinueInterrupted: noop,
    onSubmitQuestion: noop,
    onResolveApproval: noop,
    mediaActions: { busy: false, onQuote: noop, onRegenerate: noop },
    threadRef: { current: null },
    scrollElementRef: { current: null },
  }));
}

test("新会话工作模式不再渲染项目范围提示条", () => {
  const html = renderEmptyHero({ mode: "codex" });
  assert.doesNotMatch(html, /role="note"/u);
  assert.doesNotMatch(html, /本项目专注/u);
  assert.doesNotMatch(html, /项目简介尚未填写/u);
  assert.match(html, /你想让我们构建什么/u);
  // 输入栏仍嵌在中心引导区，只是上方不再多一条常驻提示。
  assert.match(html, /composer/u);
});

test("新会话聊天模式同样没有范围提示条", () => {
  const html = renderEmptyHero({ mode: "chatgpt" });
  assert.doesNotMatch(html, /role="note"/u);
  assert.doesNotMatch(html, /本项目专注/u);
  assert.match(html, /我们要聊些什么/u);
  assert.match(html, /composer/u);
});

test("项目内新会话标题显示真实项目名变量，并固定为工作形态", () => {
  const work = renderEmptyHero({ mode: "codex", projectName: "lfaa" });
  assert.match(work, /你想让我们在/u);
  assert.match(work, /class="projectName"[^>]*>lfaa<\/button>/u);
  assert.match(work, /中构建什么/u);

  // 项目内已经是工作形态：即使全局模式是聊天，标题也按工作渲染。
  const chat = renderEmptyHero({ mode: "chatgpt", projectName: "lfaa" });
  assert.match(chat, /你想让我们在/u);
  assert.match(chat, /class="projectName"[^>]*>lfaa<\/button>/u);
  assert.match(chat, /中构建什么/u);
});

test("进入项目后不再显示聊天 / 工作切换", () => {
  const unbound = renderEmptyHero({ mode: "codex" });
  assert.match(unbound, /aria-label="模式"/u);

  const project = renderEmptyHero({ mode: "codex", projectName: "lfaa" });
  assert.doesNotMatch(project, /aria-label="模式"/u);
  assert.doesNotMatch(project, /heroModeBtn/u);
});

test("项目起步建议统一使用轻量无边框行样式，不再渲染重卡片与推荐徽章", () => {
  const html = renderEmptyHero({
    mode: "codex",
    showHomeSuggestions: true,
    starterSuggestions: ["检查 package.json 依赖与脚本", "梳理 src 目录结构"],
  });
  assert.match(html, /class="heroSuggestions"/u);
  assert.match(html, /检查 package\.json 依赖与脚本/u);
  assert.doesNotMatch(html, /projectStarters|projectStarterRecommended|推荐/u);
});