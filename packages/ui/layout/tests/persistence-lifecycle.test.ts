// 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、左右栏折叠、分组收起、分区折叠、排序与模式）。
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import {
  buildSidebarWidthVars,
  computeMaxPanelWidth,
  computeResizeOutcome,
  DRAG_THRESHOLD_PX,
  hasExceededDragThreshold,
  MAX_PANEL_WIDTH,
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

test("computeResizeOutcome 正确处理最小/最大宽度限制、中心区保护与半阈值吸附收起", () => {
  // 宽屏 1440px：左一约 70px、对侧约 280px，中心区至少保留 360px 时上限为 MAX_PANEL_WIDTH (440)
  assert.equal(
    computeMaxPanelWidth({ shellWidth: 1440, railWidth: 70, oppositeWidth: 280 }),
    MAX_PANEL_WIDTH,
  );

  // 窄桌面 1060px：1060 - 70 - 360 - 360 = 270，对中心区保护生效
  assert.equal(
    computeMaxPanelWidth({ shellWidth: 1060, railWidth: 70, oppositeWidth: 360 }),
    270,
  );

  // 低于半阈值 (< 110px) 触发吸附收起，视觉宽度收至 0px 同时保留回退展开宽度
  assert.deepEqual(
    computeResizeOutcome({ rawWidth: SNAP_THRESHOLD_WIDTH - 1, shellWidth: 1440, railWidth: 70, oppositeWidth: 280 }),
    { snappedCollapsed: true, width: MIN_PANEL_WIDTH, visualWidth: 0, tension: 1 },
  );

  // 位于 [110, 220) 区间内提供弹性阻尼收缩 visualWidth 与张力值
  const elasticOutcome = computeResizeOutcome({
    rawWidth: SNAP_THRESHOLD_WIDTH,
    shellWidth: 1440,
    railWidth: 70,
    oppositeWidth: 280,
  });
  assert.equal(elasticOutcome.snappedCollapsed, false);
  assert.equal(elasticOutcome.width, MIN_PANEL_WIDTH);
  assert.equal(elasticOutcome.visualWidth, 187);
  assert.equal(elasticOutcome.tension, 1);

  // 已处于吸附收起态时，带 14px 滞回窗口避免 110px 临界抖动；拉回超过 124px 即平滑重开
  assert.equal(
    computeResizeOutcome({
      rawWidth: SNAP_REOPEN_THRESHOLD_WIDTH - 1,
      shellWidth: 1440,
      railWidth: 70,
      oppositeWidth: 280,
      wasCollapsed: true,
    }).snappedCollapsed,
    true,
  );
  assert.equal(
    computeResizeOutcome({
      rawWidth: SNAP_REOPEN_THRESHOLD_WIDTH,
      shellWidth: 1440,
      railWidth: 70,
      oppositeWidth: 280,
      wasCollapsed: true,
    }).snappedCollapsed,
    false,
  );

  // 正常区间内四舍五入，超过上限时钳制到 MAX_PANEL_WIDTH
  assert.deepEqual(
    computeResizeOutcome({ rawWidth: 340.4, shellWidth: 1440, railWidth: 70, oppositeWidth: 280 }),
    { snappedCollapsed: false, width: 340, visualWidth: 340, tension: 0 },
  );
  assert.deepEqual(
    computeResizeOutcome({ rawWidth: 620, shellWidth: 1440, railWidth: 70, oppositeWidth: 280 }),
    { snappedCollapsed: false, width: MAX_PANEL_WIDTH, visualWidth: MAX_PANEL_WIDTH, tension: 0 },
  );
});

test("ui-preferences 正确读写并钳制左右侧边栏自定义宽度", () => {
  const mock = installMockWindowStorage();
  try {
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), null);
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), null);

    writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, 332.6);
    writePanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY, 290);
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), 333);
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), 290);

    // 超出范围或非法值时安全忽略并回退到 null
    mock.store.set(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, "90");
    assert.equal(readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY), null);

    mock.store.set(RIGHT_PANEL_WIDTH_STORAGE_KEY, "999");
    assert.equal(readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY), null);

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
