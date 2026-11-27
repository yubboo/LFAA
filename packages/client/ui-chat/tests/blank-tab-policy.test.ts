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
import { useWorkbenchTabClose } from "../client/workbench/useWorkbenchTabClose";
import { reconcileTabOrder } from "../client/workbench/tab-order";

const empty: WorkbenchTabCounts = { fileTabs: 0, auxTabs: 0, subagentTabs: 0, reviewTabOpen: false };

test("空面板且没有浏览器标签时才补空白占位标签", () => {
  assert.equal(shouldBootstrapBlankTab({ ...empty, browserOpen: false }), true);
  assert.equal(shouldBootstrapBlankTab({ ...empty, browserOpen: true }), false);
});

test("已有任意真实内容标签（含无限画布等插件标签）时不再补空白占位标签", () => {
  const filled: WorkbenchTabCounts[] = [
    { ...empty, fileTabs: 1 },
    { ...empty, auxTabs: 1 },
    { ...empty, subagentTabs: 2 },
    { ...empty, reviewTabOpen: true },
    { ...empty, extensionTabs: 1 },
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
  // 打开无限画布等插件标签时，空白占位同样必须让位，不留下多余的「新标签页」。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "browser", ...blankOpen, extensionActive: true }), true);
  // 用户主动点「+」创建的新标签页，切换到侧边聊天/无限画布等标签时绝不自动消失。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "utility", ...blankOpen, manualBlankTab: true }), false);
  assert.equal(shouldDropBlankTabForContent({ stageKind: "browser", ...blankOpen, extensionActive: true, manualBlankTab: true }), false);
  // 有宿主浏览器页面时不关，避免误伤用户正在看的网页。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: true, browserTabs: 1, browserBlank: true }), false);
  // 空白标签已载入真实地址时同样不动。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: true, browserTabs: 0, browserBlank: false }), false);
  // 浏览器已关闭：不该再重复触发关闭（避免 effect 死循环）。
  assert.equal(shouldDropBlankTabForContent({ stageKind: "file", browserOpen: false, browserTabs: 0, browserBlank: true }), false);
});

test("旁边还有无限画布标签时关闭新标签页绝不收起右栏；关闭最后一个标签才收起", () => {
  let collapsed = 0;
  const withExt = useWorkbenchTabClose({
    browserTabs: 0, fileTabs: 0, browserOpen: true, activeFileTab: false,
    reviewTabOpen: false, subagentTabs: 0, auxTabs: 0, extensionTabs: 1,
    closeBrowserTab: () => {}, closeFileTab: () => {}, closeReviewTab: () => {}, closeAuxTab: () => {},
    collapse: () => { collapsed += 1; },
  });
  withExt.closeBrowserTab();
  assert.equal(collapsed, 0, "旁边仍有无限画布标签时不能收起右栏");

  // 只剩最后一个无限画布标签且无其它标签时，关闭它应自动收起右栏。
  const onlyExt = useWorkbenchTabClose({
    browserTabs: 0, fileTabs: 0, browserOpen: false, activeFileTab: false,
    reviewTabOpen: false, subagentTabs: 0, auxTabs: 0, extensionTabs: 1,
    closeBrowserTab: () => {}, closeFileTab: () => {}, closeReviewTab: () => {}, closeAuxTab: () => {},
    collapse: () => { collapsed += 1; },
  });
  onlyExt.closeExtensionTab(() => {});
  assert.equal(collapsed, 1, "关闭最后一个标签后应自动收起右栏");
});

test("标签栏稳定保序：选中第 2 个新标签页变身为无限画布时原位替换，不跳到最左或最右", () => {
  const initial = ["browser:t1", "browser:t2", "browser:t3"];
  // t2 变身为无限画布：t2 消失且 ext:infinite-canvas 出现，应精准落回索引 1。
  const replaced = reconcileTabOrder(initial, ["ext:infinite-canvas", "browser:t1", "browser:t3"]);
  assert.deepEqual(replaced, ["browser:t1", "ext:infinite-canvas", "browser:t3"]);

  // 点「+」新增第 4 个标签：追加到最右侧。
  const appended = reconcileTabOrder(replaced, ["ext:infinite-canvas", "browser:t1", "browser:t3", "browser:t4"]);
  assert.deepEqual(appended, ["browser:t1", "ext:infinite-canvas", "browser:t3", "browser:t4"]);

  // 关闭 t1：其余标签保持原有相对顺序。
  const afterClose = reconcileTabOrder(appended, ["ext:infinite-canvas", "browser:t3", "browser:t4"]);
  assert.deepEqual(afterClose, ["ext:infinite-canvas", "browser:t3", "browser:t4"]);
});
