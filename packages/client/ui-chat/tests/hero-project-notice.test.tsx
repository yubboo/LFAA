// 验证项目范围提示条：只在「工作」模式、且会话绑定项目时渲染在输入栏上方，聊天模式不出现。
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

/** 空会话引导区的最小属性集：本用例只关心模式与项目范围对提示条的影响。 */
function renderEmptyHero(options: {
  mode: "chatgpt" | "codex";
  scope: { name: string; description: string } | null;
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
    projectScope: options.scope,
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
  }));
}

test("工作模式下绑定项目的空会话显示项目范围提示条", () => {
  const html = renderEmptyHero({ mode: "codex", scope: { name: "app1", description: "" } });
  assert.match(html, /role="note"/u);
  assert.match(html, /本项目专注「app1」/u);
  assert.match(html, /项目简介尚未填写/u);
});

test("提示条带出项目简介，未填写时回退到确认目标提示", () => {
  const withBrief = renderEmptyHero({ mode: "codex", scope: { name: "app1", description: "做一个插件市场" } });
  assert.match(withBrief, /本项目专注「app1」 · 做一个插件市场/u);
  assert.doesNotMatch(withBrief, /项目简介尚未填写/u);
});

test("聊天模式不显示项目范围提示条", () => {
  const html = renderEmptyHero({ mode: "chatgpt", scope: { name: "app1", description: "" } });
  assert.doesNotMatch(html, /role="note"/u);
  assert.doesNotMatch(html, /本项目专注/u);
});

test("未绑定项目的工作模式不显示提示条", () => {
  const html = renderEmptyHero({ mode: "codex", scope: null });
  assert.doesNotMatch(html, /本项目专注/u);
});

test("项目起步建议统一使用轻量无边框行样式，不再渲染重卡片与推荐徽章", () => {
  const html = renderEmptyHero({
    mode: "codex",
    scope: { name: "app1", description: "" },
    showHomeSuggestions: true,
    starterSuggestions: ["检查 package.json 依赖与脚本", "梳理 src 目录结构"],
  });
  assert.match(html, /class="heroSuggestions"/u);
  assert.match(html, /检查 package\.json 依赖与脚本/u);
  assert.doesNotMatch(html, /projectStarters|projectStarterRecommended|推荐/u);
});