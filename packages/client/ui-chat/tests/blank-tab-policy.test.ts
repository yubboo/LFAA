// 右栏空白占位标签策略单测：空面板才补「新标签页」，切到真实内容标签后必须让位。
import assert from "node:assert/strict";
import test from "node:test";
import {
  hasContentTab,
  shouldBootstrapBlankTab,
  shouldCreateHostTab,
  shouldDropBlankTabForContent,
  type WorkbenchTabCounts,
} from "../client/workbench/blank-tab-policy";

const empty: WorkbenchTabCounts = { fileTabs: 0, auxTabs: 0, subagentTabs: 0, reviewTabOpen: false };

test("空面板且没有浏览器标签时才补空白占位标签", () => {
  assert.equal(shouldBootstrapBlankTab({ ...empty, browserOpen: false }), true);
  assert.equal(shouldBootstrapBlankTab({ ...empty, browserOpen: true }), false);
});

test("已有任意真实内容标签时不再补空白占位标签", () => {
  const filled: WorkbenchTabCounts[] = [
    { ...empty, fileTabs: 1 },
    { ...empty, auxTabs: 1 },
    { ...empty, subagentTabs: 2 },
    { ...empty, reviewTabOpen: true },
  ];
  for (const counts of filled) {
    assert.equal(hasContentTab(counts), true);
    assert.equal(shouldBootstrapBlankTab({ ...counts, browserOpen: false }), false);
  }
});

test("点「+」/ 新建标签快捷键始终能继续新建：空白标签在场时不再吞掉点击", () => {
  // 首次打开：只露出空态占位，不向宿主要标签页。
  assert.equal(shouldCreateHostTab({ browserOpen: false, browserTabs: 0 }), false);
  // 已经打开（哪怕手上只有一个空白标签）：每次点击都要新建一个标签页。
  assert.equal(shouldCreateHostTab({ browserOpen: true, browserTabs: 0 }), true);
  assert.equal(shouldCreateHostTab({ browserOpen: true, browserTabs: 1 }), true);
  assert.equal(shouldCreateHostTab({ browserOpen: true, browserTabs: 5 }), true);
  // 浏览器关着但宿主仍留着标签时也要能再开一个。
  assert.equal(shouldCreateHostTab({ browserOpen: false, browserTabs: 2 }), true);
});

test("切到文件等真实内容舞台时空白标签让位，真实浏览器页面不动", () => {
  const blankOpen = { browserOpen: true, browserTabs: 0, browserBlank: true };
  for (const stageKind of ["file", "review", "subagent", "utility"] as const) {
    assert.equal(shouldDropBlankTabForContent({ stageKind, ...blankOpen }), true, `${stageKind} 舞台应让位`);
  }
  // 仍停留在空白标签自己身上时保留。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "browser", ...blankOpen }), false);
  assert.equal(shouldDropBlankTabForContent({ stageKind: "welcome", ...blankOpen }), false);
  // 有宿主浏览器页面时不关，避免误伤用户正在看的网页。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: true, browserTabs: 1, browserBlank: true }), false);
  // 空白标签已载入真实地址时同样不动。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: true, browserTabs: 0, browserBlank: false }), false);
  // 浏览器已关闭：不该再重复触发关闭（避免 effect 死循环）。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: false, browserTabs: 0, browserBlank: true }), false);
});
