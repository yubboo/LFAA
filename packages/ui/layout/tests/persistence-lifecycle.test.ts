// 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、左右栏折叠、分组收起、分区折叠、排序与模式）。
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import {
  buildSidebarWidthVars,
  computeKeyResizeWidth,
  computeMaxPanelWidth,
  computePushedRightWidth,
  computeResizeOutcome,
  DRAG_THRESHOLD_PX,
  hasExceededDragThreshold,
  MIN_PANEL_WIDTH,
  SNAP_REOPEN_THRESHOLD_WIDTH,
  SNAP_THRESHOLD_WIDTH,
} from "../client/sidebar-resize";
import {
  LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  readActiveRoutePref,
  readNavGroupExpandedPref,
  readPanelWidthPref,
  readProjectSortPref,
  readRecentSortPref,
  readSectionExpandedPref,
  readWorkspaceModePref,
  writeNavGroupExpandedPref,
  writePanelWidthPref,
  writeProjectSortPref,
  writeRecentSortPref,
  writeSectionExpandedPref,
  writeWorkspaceModePref,
} from "../client/ui-preferences";
import { locales } from "../client/locales";
import { resolveWorkbenchDomain } from "../client/workbench-domains";
import { WorkbenchClientService } from "../client/workbench-service";

function installMockWindowStorage() {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  };
  return {
    store,
    restore() {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window: unknown }).window = prevWindow;
      }
    },
  };
}

test("WorkbenchClientService 持久化并恢复路由、项目打开状态及非持久化临时抽屉切换", () => {
  const mock = installMockWindowStorage();
  try {
    const ctx1 = new Context();
    const service1 = new WorkbenchClientService(ctx1);

    service1.openProject("proj-123");
    service1.setLeftSidebarOpen(false, true);
    service1.setRightPanelOpen(false, false);

    assert.deepEqual(readActiveRoutePref(), {
      activeView: "project",
      activeProjectId: "proj-123",
    });

    const ctx2 = new Context();
    const service2 = new WorkbenchClientService(ctx2);
    const restored = service2.getSnapshot();
    assert.equal(restored.activeView, "project");
    assert.equal(restored.activeProjectId, "proj-123");
    assert.equal(restored.leftSidebarOpen, false);
    assert.equal(restored.rightPanelOpen, true);

    service2.navigate("appearance");
    const ctx3 = new Context();
    const service3 = new WorkbenchClientService(ctx3);
    assert.equal(service3.getSnapshot().activeView, "appearance");
    assert.equal(service3.getSnapshot().activeProjectId, null);
  } finally {
    mock.restore();
  }
});

test("ui-preferences 正确读写分组收起、自定义分区折叠、排序与工作模式", () => {
  const mock = installMockWindowStorage();
  try {
    assert.deepEqual(readNavGroupExpandedPref(), {});
    assert.deepEqual(readSectionExpandedPref(), {});
    assert.equal(readProjectSortPref(), "created");
    assert.equal(readRecentSortPref(), "created");
    assert.equal(readWorkspaceModePref(), "chatgpt");

    writeNavGroupExpandedPref({ pinned: false, projects: false, recent: true });
    writeSectionExpandedPref({ "sec-1": false, "sec-2": true });
    writeProjectSortPref("name");
    writeRecentSortPref("name");
    writeWorkspaceModePref("codex");

    assert.deepEqual(readNavGroupExpandedPref(), { pinned: false, projects: false, recent: true });
    assert.deepEqual(readSectionExpandedPref(), { "sec-1": false, "sec-2": true });
    assert.equal(readProjectSortPref(), "name");
    assert.equal(readRecentSortPref(), "name");
    assert.equal(readWorkspaceModePref(), "codex");

    mock.store.set("lfaa:nav-group-expanded", "{invalid-json");
    assert.deepEqual(readNavGroupExpandedPref(), {});
  } finally {
    mock.restore();
  }
});

test("拖拽和键盘采用同一比例上限，同时保留中央的百分比和像素下限", () => {
  const wide = { shellWidth: 4050, railWidth: 50 };
  assert.equal(computeMaxPanelWidth({ ...wide, side: "left", oppositeWidth: 3000 }), 1000);
  assert.equal(computeMaxPanelWidth({ ...wide, side: "right", oppositeWidth: 1000 }), 2600);
  assert.equal(computeMaxPanelWidth({ ...wide, side: "right", oppositeWidth: 0 }), 3000);
  const narrow = { shellWidth: 1250, railWidth: 50 };
  assert.equal(computeMaxPanelWidth({ ...narrow, side: "left", oppositeWidth: 660 }), 300);
  assert.equal(computeMaxPanelWidth({ ...narrow, side: "right", oppositeWidth: 180 }), 660);
  assert.equal(computeKeyResizeWidth({
    ...narrow, side: "right", key: "ArrowLeft", shiftKey: true, currentWidth: 650, oppositeWidth: 180,
  }), 660);
  assert.equal(computeKeyResizeWidth({
    ...narrow, side: "left", key: "ArrowRight", shiftKey: true, currentWidth: 180, oppositeWidth: 660,
  }), 228);
  assert.equal(computeKeyResizeWidth({
    ...wide, side: "left", key: "ArrowRight", shiftKey: true, currentWidth: 980, oppositeWidth: 2600,
  }), 1000);
});

test("computeResizeOutcome 保留弹性阻尼、半阈值吸附与重开滞回", () => {
  const metrics = { side: "left" as const, shellWidth: 2050, railWidth: 50, oppositeWidth: 280 };
  // 低于半阈值 (< 110px) 触发吸附收起，视觉宽度收至 0px 同时保留回退展开宽度
  assert.deepEqual(
    computeResizeOutcome({ ...metrics, rawWidth: SNAP_THRESHOLD_WIDTH - 1 }),
    { snappedCollapsed: true, width: MIN_PANEL_WIDTH, visualWidth: 0, tension: 1 },
  );

  // 位于 [110, 220) 区间内提供弹性阻尼收缩 visualWidth 与张力值
  const elasticOutcome = computeResizeOutcome({
    ...metrics,
    rawWidth: SNAP_THRESHOLD_WIDTH,
  });
  assert.equal(elasticOutcome.snappedCollapsed, false);
  assert.equal(elasticOutcome.width, MIN_PANEL_WIDTH);
  assert.equal(elasticOutcome.visualWidth, 187);
  assert.equal(elasticOutcome.tension, 1);

  // 已处于吸附收起态时，带 14px 滞回窗口避免 110px 临界抖动；拉回超过 124px 即平滑重开
  assert.equal(
    computeResizeOutcome({
      ...metrics,
      rawWidth: SNAP_REOPEN_THRESHOLD_WIDTH - 1,
      wasCollapsed: true,
    }).snappedCollapsed,
    true,
  );
  assert.equal(
    computeResizeOutcome({
      ...metrics,
      rawWidth: SNAP_REOPEN_THRESHOLD_WIDTH,
      wasCollapsed: true,
    }).snappedCollapsed,
    false,
  );

  // 拖拽画面保留小数，只有写入偏好的宽度才取整。
  assert.deepEqual(
    computeResizeOutcome({ ...metrics, rawWidth: 270.4 }),
    { snappedCollapsed: false, width: 270, visualWidth: 270.4, tension: 0 },
  );
  assert.deepEqual(
    computeResizeOutcome({ ...metrics, rawWidth: 620 }),
    { snappedCollapsed: false, width: 500, visualWidth: 500, tension: 0 },
  );

  // 窄桌面的默认 180px 宽度可直接开始拖动，同时保留原有吸附阈值。
  const narrow = { ...metrics, shellWidth: 1250, oppositeWidth: 660 };
  assert.equal(computeResizeOutcome({ ...narrow, rawWidth: 183 }).visualWidth, 183);
  assert.deepEqual(computeResizeOutcome({ ...narrow, rawWidth: 89 }),
    { snappedCollapsed: true, width: 180, visualWidth: 0, tension: 1 });
  assert.deepEqual(computeResizeOutcome({ ...narrow, rawWidth: 180, wasCollapsed: true }),
    { snappedCollapsed: false, width: 180, visualWidth: 180, tension: 0 });
});

test("左二能跨过 15%，在带小数的 25% 上限继续右拖时不会回退", () => {
  const metrics = { side: "left" as const, shellWidth: 2056, railWidth: 50, oppositeWidth: 250 };
  const available = metrics.shellWidth - metrics.railWidth;
  const expanded = available * 0.2;
  const cap = available * 0.25;
  assert.equal(computeResizeOutcome({ ...metrics, rawWidth: expanded }).visualWidth, expanded);
  for (const delta of [0, 0.25, 3, 40]) {
    const outcome = computeResizeOutcome({ ...metrics, rawWidth: cap + delta });
    assert.equal(outcome.visualWidth, cap);
  }

  // 上限的小数不足半像素时也要保存能触达上限的偏好值，由 Shell 按比例限制实际宽度。
  assert.equal(computeResizeOutcome({ ...metrics, shellWidth: 2051, rawWidth: 600 }).width, 501);
});

test("左二扩宽先使用右栏余量，到右栏最小宽度后停止推挤", () => {
  assert.equal(computePushedRightWidth(300, 500, 700), 500);
  assert.equal(computePushedRightWidth(220, 280, 700), 640);
  assert.equal(computePushedRightWidth(220.25, 221.5, 700.5), 699.25);
  assert.equal(computePushedRightWidth(220, 300, 250), MIN_PANEL_WIDTH);
  assert.equal(computePushedRightWidth(220, 300, MIN_PANEL_WIDTH), null);
  assert.equal(computePushedRightWidth(240, 220, 700), null);
});

test("ui-preferences 保留宽屏设置并过滤无效的侧栏宽度偏好", () => {
  const mock = installMockWindowStorage();
  try {
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), null);
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), null);

    writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, 332.6);
    writePanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY, 290);
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), 333);
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), 290);

    // 保留窄桌面可出现的宽度，非法值和非正宽度回退。
    writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, 180);
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), 180);
    mock.store.set(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, "0");
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), null);

    mock.store.set(RIGHT_PANEL_WIDTH_STORAGE_KEY, "999");
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), 999);

    mock.store.set(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, "not-a-number");
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), null);
  } finally {
    mock.restore();
  }
});

test("buildSidebarWidthVars 保留基础宽度变量且仅在跨过拖拽阈值后才视作拖拽", () => {
  assert.deepEqual(
    buildSidebarWidthVars({ isCompact: false, leftWidth: 232, rightWidth: 310 }),
    {
      "--left-default-max-share": "0.15",
      "--left-max-share": "0.25",
      "--right-max-share": "0.75",
      "--center-min-share": "0.1",
      "--center-min-pixels": "360px",
      "--panel-min-pixels": "220px",
      "--left-sidebar-base-width": "232px",
      "--right-panel-base-width": "310px",
    },
  );
  assert.deepEqual(
    buildSidebarWidthVars({ isCompact: false, leftWidth: 232, rightWidth: 310, rightWide: true }),
    {
      "--left-default-max-share": "0.15",
      "--left-max-share": "0.25",
      "--right-max-share": "0.75",
      "--center-min-share": "0.1",
      "--center-min-pixels": "360px",
      "--panel-min-pixels": "220px",
      "--left-sidebar-base-width": "232px",
      "--right-panel-base-width": "310px",
    },
  );
  assert.deepEqual(
    buildSidebarWidthVars({ isCompact: true, leftWidth: 232, rightWidth: 310 }),
    {},
  );
  assert.equal(hasExceededDragThreshold(300, 300), false);
  assert.equal(hasExceededDragThreshold(300, 300 + DRAG_THRESHOLD_PX - 1), false);
  assert.equal(hasExceededDragThreshold(300, 300 + DRAG_THRESHOLD_PX), true);
  assert.equal(hasExceededDragThreshold(300, 300 - DRAG_THRESHOLD_PX), true);
});

test("resolveWorkbenchDomain 与 WorkbenchClientService 支持领域左二切换及资料库标签页同步", () => {
  const mock = installMockWindowStorage();
  try {
    const zh = locales.zh;
    assert.equal(resolveWorkbenchDomain("library", zh).id, "library");
    assert.equal(resolveWorkbenchDomain("library", zh).columns, 4);
    assert.equal(resolveWorkbenchDomain("plugins", zh).id, "plugins");
    assert.equal(resolveWorkbenchDomain("plugins", zh).sidebarHeader.kind, "sectionTitle");
    assert.equal(resolveWorkbenchDomain("scheduled", zh).id, "scheduled");
    assert.equal(resolveWorkbenchDomain("codeReview", zh).id, "codeReview");
    assert.equal(resolveWorkbenchDomain("images", zh).id, "images");
    assert.equal(resolveWorkbenchDomain("canva", zh).id, "extension");

    const ctx = new Context();
    const service = new WorkbenchClientService(ctx);
    assert.equal(service.getSnapshot().activeLibraryTab, "all");
    service.setLibraryTab("artifact");
    assert.equal(service.getSnapshot().activeLibraryTab, "artifact");
    service.setDomainItem("plugins:installed");
    assert.equal(service.getSnapshot().activeDomainItem, "plugins:installed");
  } finally {
    mock.restore();
  }
});
