// 验证文件活动行的彩标渲染、真实语义状态、悬停精准路径、真实行号展示，以及 read_file 点击打开右栏预览逻辑。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getChatLocale } from "../client/locales";
import { ChatFileActions } from "../client/store/chat-file-actions";
import type { ChatStorePort } from "../client/store/chat-store-port";
import type { AgentStepItem, ChatStoreSnapshot } from "../client/store/chat-types";
import {
  formatReadLineRange,
  getActivityReadRange,
  getFileActivityKind,
  getOpenableActivityFilePath,
} from "../client/shared/file-activity";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { ToolStepRow } = await import("../client/conversation/Tool-Step-Row");

function renderRow(step: AgentStepItem, live = false) {
  const locale = getChatLocale();
  return renderToStaticMarkup(
    createElement(ToolStepRow, {
      step,
      locale,
      live,
      onOpenFile: () => {},
    }),
  );
}

test("已完成的文件创建、编辑、删除与分析行均渲染真实语义、彩色文件图标与悬停精准路径", () => {
  const cases: { step: AgentStepItem; kind: string; verbZh: string; name: string; fullPath: string; lineTag?: string }[] = [
    {
      step: {
        id: "s-create",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "创建",
        toolName: "write_file",
        toolTarget: "src/site/SiteApp.tsx",
        addedLines: 120,
        fileChange: { path: "src/site/SiteApp.tsx", operation: "created", firstLine: 1, before: "", after: "x", truncated: false },
        timestamp: 2000,
      },
      kind: "created",
      verbZh: "已创建",
      name: "SiteApp.tsx",
      fullPath: "src/site/SiteApp.tsx",
    },
    {
      step: {
        id: "s-edit",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "编辑",
        toolName: "edit_file",
        toolTarget: "vite.config.ts",
        addedLines: 9,
        removedLines: 1,
        fileChange: { path: "vite.config.ts", operation: "edited", firstLine: 4, before: "a", after: "b", truncated: false },
        timestamp: 2000,
      },
      kind: "edited",
      verbZh: "已编辑",
      name: "vite.config.ts",
      fullPath: "vite.config.ts",
    },
    {
      step: {
        id: "s-del",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "删除",
        toolName: "delete_file",
        toolTarget: "src/legacy/old.js",
        timestamp: 2000,
      },
      kind: "deleted",
      verbZh: "已删除",
      name: "old.js",
      fullPath: "src/legacy/old.js",
    },
    {
      step: {
        id: "s-read",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "行动：read_file (读取 src/styles/cursor-glow.css (1-38/38))",
        toolName: "read_file",
        toolTarget: "src/styles/cursor-glow.css",
        readRange: { startLine: 1, endLine: 38, totalLines: 38 },
        timestamp: 2000,
      },
      kind: "analyzed",
      verbZh: "已分析",
      name: "cursor-glow.css",
      fullPath: "src/styles/cursor-glow.css",
      lineTag: "#L1-38",
    },
  ];

  for (const item of cases) {
    const html = renderRow(item.step);
    assert.match(html, new RegExp(`data-kind="${item.kind}"`, "u"));
    assert.match(html, /data-glyph="/u);
    assert.ok(html.includes(item.name));
    assert.ok(html.includes(`title="${item.fullPath}"`));
    assert.match(html, /role="tooltip"/u);
    assert.ok(html.includes(item.fullPath));
    if (item.lineTag) {
      assert.ok(html.includes(item.lineTag));
    }
    if (getChatLocale().isZh) {
      assert.ok(html.includes(item.verbZh));
    }
  }
});

test("运行中或失败的读/写文件步骤绝不提前伪装为已完成文件行，且无真实行号时不编造 #L 标签", () => {
  const runningRead: AgentStepItem = {
    id: "r-run",
    iteration: 1,
    phase: "act",
    status: "running",
    title: "读取文件",
    toolName: "read_file",
    toolTarget: "src/styles/cursor-glow.css",
    timestamp: 2000,
  };
  const runningHtml = renderRow(runningRead, true);
  assert.doesNotMatch(runningHtml, /data-kind="analyzed"/u);
  assert.match(runningHtml, /data-live="true"/u);
  assert.match(runningHtml, /data-glyph="/u);

  const doneNoRange: AgentStepItem = {
    id: "r-no-range",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "读取文件",
    toolName: "read_file",
    toolTarget: "README.md",
    timestamp: 2000,
  };
  assert.equal(getActivityReadRange(doneNoRange), undefined);
  assert.equal(formatReadLineRange(undefined), undefined);
  const doneHtml = renderRow(doneNoRange);
  assert.match(doneHtml, /data-kind="analyzed"/u);
  assert.doesNotMatch(doneHtml, /#L\d+/u);
});

test("ChatFileActions.openFilePreview 支持点击已完成的 read_file 步骤并带入真实行号定位", () => {
  const step: AgentStepItem = {
    id: "step-read-1",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "行动：read_file (读取 src/styles/cursor-glow.css (12-45/100))",
    toolName: "read_file",
    toolTarget: "src/styles/cursor-glow.css",
    readRange: { startLine: 12, endLine: 45, totalLines: 100, resolvedPath: "/repo/src/styles/cursor-glow.css" },
    timestamp: 1000,
  };
  assert.equal(getOpenableActivityFilePath(step), "src/styles/cursor-glow.css");
  assert.equal(getFileActivityKind(step), "analyzed");

  let state = {
    activeSession: {
      id: "sess-1",
      projectId: "proj-1",
      messages: [{ id: "msg-1", role: "assistant", content: "", createdAt: 1, steps: [step] }],
    },
    filePreviewTabs: [],
    activeFilePreviewId: null,
    rightStageKind: null,
  } as unknown as ChatStoreSnapshot;

  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => {
      state = { ...state, ...patch };
    },
  } as unknown as ChatStorePort;

  const actions = new ChatFileActions(port);
  const opened = actions.openFilePreview("msg-1", "step-read-1");
  assert.equal(opened, true);
  assert.equal(state.rightStageKind, "file");
  assert.equal(state.filePreviewTabs.length, 1);
  assert.equal(state.filePreviewTabs[0]?.relativePath, "src/styles/cursor-glow.css");
  assert.equal(state.filePreviewTabs[0]?.targetLine, 12);
  assert.equal(state.filePreviewTabs[0]?.endLine, 45);
});
