// 验证输入框目标条：进行中/受阻文案、进度、编辑入口，以及完成后不渲染。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { GoalBar } = await import("../client/session/GoalBar");

const GOAL = {
  id: "g1",
  title: "重组包",
  objective: "把 core/chat 拆成 chat / library / review 三个包",
  status: "active" as const,
  progress: { done: 1, total: 7 },
  updatedAt: 1,
  rounds: 0,
  maxRounds: 10,
  autoContinue: true,
};

test("进行中的目标显示文案、文字、进度与编辑入口", () => {
  const html = renderToStaticMarkup(createElement(GoalBar, {
    goal: GOAL,
    isZh: true,
    onEdit: async () => true,
    onToggleAutoContinue: async () => true,
  }));
  assert.match(html, /data-testid="goal-bar"/u);
  assert.match(html, /进行中的目标/u);
  assert.match(html, /把 core\/chat 拆成/u);
  assert.match(html, /1\/7/u);
  assert.match(html, /自动继续 0\/10/u);
  assert.match(html, /暂停自动继续/u);
  assert.match(html, /编辑目标文字/u);
  assert.doesNotMatch(html, /删除目标|标记完成/u);
});

test("暂停自动续跑后显示恢复入口", () => {
  const html = renderToStaticMarkup(createElement(GoalBar, {
    goal: { ...GOAL, autoContinue: false, rounds: 2 },
    isZh: true,
    onEdit: async () => true,
    onToggleAutoContinue: async () => true,
  }));
  assert.match(html, /自动继续已暂停/u);
  assert.match(html, /恢复自动继续/u);
  assert.doesNotMatch(html, /暂停自动继续/u);
});

test("受阻目标使用受阻文案，仍可编辑文字", () => {
  const html = renderToStaticMarkup(createElement(GoalBar, {
    goal: { ...GOAL, status: "blocked" as const },
    isZh: true,
    onEdit: async () => true,
    onToggleAutoContinue: async () => true,
  }));
  assert.match(html, /已受阻的目标/u);
  assert.match(html, /编辑目标文字/u);
});

test("已完成的目标不渲染任何节点", () => {
  const html = renderToStaticMarkup(createElement(GoalBar, {
    goal: { ...GOAL, status: "complete" as const },
    isZh: true,
    onEdit: async () => true,
    onToggleAutoContinue: async () => true,
  }));
  assert.equal(html, "");
});