// 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、设置子页、左右栏折叠、分组收起、分区折叠、排序与模式）。
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
  LEFT_MIN_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  SNAP_REOPEN_THRESHOLD_WIDTH,
  SNAP_THRESHOLD_WIDTH,
} from "../client/shell/sidebar-resize";
import {
  LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  readActiveGroupKeyPref,
  readActiveRoutePref,
  readNavGroupExpandedPref,
  readPanelWidthPref,
  readProjectExpandedPref,
  readProjectSortPref,
  readRecentSortPref,
  readSectionExpandedPref,
  readSettingsViewPref,
  readWorkspaceModePref,
  writeActiveGroupKeyPref,
  writeNavGroupExpandedPref,
  writePanelWidthPref,
  writeProjectExpandedPref,
  writeProjectSortPref,
  writeRecentSortPref,
  writeSectionExpandedPref,
  writeWorkspaceModePref,
} from "../client/shell/ui-preferences";
import { locales } from "../client/locales";
import { resolveWorkbenchDomain } from "../client/navigation/workbench-domains";
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
    // 设置中心以弹窗呈现：只记录子页，不改写背景路由，刷新后仍停在同一个设置子页。
    assert.deepEqual(readActiveRoutePref(), {
      activeView: "project",
      activeProjectId: "proj-123",
    });
    const ctx3 = new Context();
    const service3 = new WorkbenchClientService(ctx3);
    const restoredSettings = service3.getSnapshot();
    assert.equal(restoredSettings.activeView, "appearance");
    assert.equal(restoredSettings.activeProjectId, "proj-123");
    assert.equal(restoredSettings.settingsReturnView, "project");

    // 关闭设置中心：回到打开前的项目视图，并清掉设置子页记忆。
    service3.navigate("project", "proj-123");
    assert.deepEqual(readActiveRoutePref(), {
      activeView: "project",
      activeProjectId: "proj-123",
    });
    assert.equal(readSettingsViewPref(), null);
    assert.equal(new WorkbenchClientService(new Context()).getSnapshot().activeView, "project");
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
    ...narrow, side: "left", key: "ArrowRight", shiftKey: true, currentWidth: 240, oppositeWidth: 660,
  }), 288);
  assert.equal(computeKeyResizeWidth({
    ...wide, side: "left", key: "ArrowRight", shiftKey: true, currentWidth: 980, oppositeWidth: 2600,
  }), 1000);
});

test("computeResizeOutcome 保留弹性阻尼、半阈值吸附与重开滞回", () => {
  const metrics = { side: "left" as const, shellWidth: 2050, railWidth: 50, oppositeWidth: 280 };
  // 低于半阈值 (< 120px) 触发吸附收起，视觉宽度收至 0px 同时保留回退展开宽度
  assert.deepEqual(
    computeResizeOutcome({ ...metrics, rawWidth: SNAP_THRESHOLD_WIDTH - 1 }),
    { snappedCollapsed: true, width: LEFT_MIN_PANEL_WIDTH, visualWidth: 0, tension: 1 },
  );

  // 位于 [120, 240) 区间内提供弹性阻尼收缩 visualWidth 与张力值
  const elasticOutcome = computeResizeOutcome({
    ...metrics,
    rawWidth: SNAP_THRESHOLD_WIDTH,
  });
  assert.equal(elasticOutcome.snappedCollapsed, false);
  assert.equal(elasticOutcome.width, LEFT_MIN_PANEL_WIDTH);
  assert.equal(elasticOutcome.visualWidth, 204);
  assert.equal(elasticOutcome.tension, 1);

  // 已处于吸附收起态时，带 14px 滞回窗口避免 120px 临界抖动；拉回超过 134px 即平滑重开
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

  // 窄桌面下左二仍保底 240px（不再压窄变形），按 120px 半阈值吸附。
  const narrow = { ...metrics, shellWidth: 1250, oppositeWidth: 660 };
  assert.equal(computeResizeOutcome({ ...narrow, rawWidth: 245 }).visualWidth, 245);
  assert.deepEqual(computeResizeOutcome({ ...narrow, rawWidth: 119 }),
    { snappedCollapsed: true, width: LEFT_MIN_PANEL_WIDTH, visualWidth: 0, tension: 1 });
  assert.deepEqual(computeResizeOutcome({ ...narrow, rawWidth: LEFT_MIN_PANEL_WIDTH, wasCollapsed: true }),
    { snappedCollapsed: false, width: LEFT_MIN_PANEL_WIDTH, visualWidth: LEFT_MIN_PANEL_WIDTH, tension: 0 });
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
      "--left-default-max-share": "0.18",
      "--left-max-share": "0.25",
      "--right-max-share": "0.75",
      "--center-min-share": "0.1",
      "--center-min-pixels": "360px",
      "--panel-min-pixels": "220px",
      "--left-min-pixels": "240px",
      "--left-sidebar-base-width": "232px",
      "--right-panel-base-width": "310px",
    },
  );
  assert.deepEqual(
    buildSidebarWidthVars({ isCompact: false, leftWidth: 232, rightWidth: 310, rightWide: true }),
    {
      "--left-default-max-share": "0.18",
      "--left-max-share": "0.25",
      "--right-max-share": "0.75",
      "--center-min-share": "0.1",
      "--center-min-pixels": "360px",
      "--panel-min-pixels": "220px",
      "--left-min-pixels": "240px",
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
    // 「图像」入口已并入资料库：旧视图不再有独立领域，退回工作区默认配置。
    assert.equal(resolveWorkbenchDomain("images", zh).id, "workspace");
    assert.equal(resolveWorkbenchDomain("canva", zh).id, "extension");

    const ctx = new Context();
    const service = new WorkbenchClientService(ctx);
    assert.equal(service.getSnapshot().activeLibraryTab, "all");
    service.setLibraryTab("artifact");
    assert.equal(service.getSnapshot().activeLibraryTab, "artifact");
    service.setLibraryTab("media");
    assert.equal(service.getSnapshot().activeLibraryTab, "media");
    // 分类标签只在左二：刷新后要能恢复上次查看的分类。
    const reloaded = new WorkbenchClientService(new Context());
    assert.equal(reloaded.getSnapshot().activeLibraryTab, "media");
    service.setDomainItem("plugins:installed");
    assert.equal(service.getSnapshot().activeDomainItem, "plugins:installed");
  } finally {
    mock.restore();
  }
});

test("旧「图像」路由恢复时归一化为资料库图像分类，并写回偏好", () => {
  const mock = installMockWindowStorage();
  try {
    mock.store.set("lfaa:active-route", JSON.stringify({ activeView: "images", activeProjectId: null }));
    const ctx = new Context();
    const service = new WorkbenchClientService(ctx);
    const snapshot = service.getSnapshot();
    assert.equal(snapshot.activeView, "library");
    assert.equal(snapshot.activeProjectId, null);
    assert.equal(snapshot.activeLibraryTab, "media");
    assert.deepEqual(readActiveRoutePref(), { activeView: "library", activeProjectId: null });
    assert.equal(mock.store.get("lfaa:library-tab"), JSON.stringify("media"));
  } finally {
    mock.restore();
  }
});

test("历史遗留的设置路由刷新后回退到工作区，不再自动弹出设置面板", () => {
  const mock = installMockWindowStorage();
  try {
    mock.store.set("lfaa:active-route", JSON.stringify({ activeView: "settings:general", activeProjectId: null }));
    const service = new WorkbenchClientService(new Context());
    const snapshot = service.getSnapshot();
    assert.equal(snapshot.activeView, "workspace");
    assert.equal(snapshot.activeProjectId, null);
    assert.deepEqual(readActiveRoutePref(), { activeView: "workspace", activeProjectId: null });
  } finally {
    mock.restore();
  }
});

test("设置中心打开状态与子页写入独立记忆键，F5 后回到同一子页", () => {
  const mock = installMockWindowStorage();
  try {
    const service1 = new WorkbenchClientService(new Context());
    service1.navigate("workspace", null);
    service1.navigate("settings:notifications");

    // 设置子页不污染主路由：背景仍是工作区，刷新后靠独立键恢复。
    assert.deepEqual(readActiveRoutePref(), { activeView: "workspace", activeProjectId: null });
    assert.equal(readSettingsViewPref(), "settings:notifications");

    // 在设置中心内部切换子页，只更新子页记忆。
    service1.navigate("settings:git");
    assert.equal(readSettingsViewPref(), "settings:git");
    assert.equal(service1.getSnapshot().activeView, "settings:git");

    const service2 = new WorkbenchClientService(new Context());
    const restored = service2.getSnapshot();
    assert.equal(restored.activeView, "settings:git");
    assert.equal(restored.settingsReturnView, "workspace");

    // 切到普通视图等于关闭设置中心：清掉子页记忆。
    service2.navigate("library");
    assert.equal(readSettingsViewPref(), null);
    assert.equal(new WorkbenchClientService(new Context()).getSnapshot().activeView, "library");
  } finally {
    mock.restore();
  }
});

test("setActiveProject 与项目展开/分组键记忆持久化并在重建后恢复", () => {
  const mock = installMockWindowStorage();
  try {
    const service1 = new WorkbenchClientService(new Context());
    service1.navigate("workspace", null);
    service1.setActiveProject("proj-app1");
    assert.equal(service1.getSnapshot().activeView, "workspace");
    assert.equal(service1.getSnapshot().activeProjectId, "proj-app1");
    assert.deepEqual(readActiveRoutePref(), { activeView: "workspace", activeProjectId: "proj-app1" });

    const service2 = new WorkbenchClientService(new Context());
    assert.equal(service2.getSnapshot().activeView, "workspace");
    assert.equal(service2.getSnapshot().activeProjectId, "proj-app1");

    writeProjectExpandedPref({ "project:proj-app1": false, "pinned:proj-app1": true });
    writeActiveGroupKeyPref("pinned");
    assert.deepEqual(readProjectExpandedPref(), { "project:proj-app1": false, "pinned:proj-app1": true });
    assert.equal(readActiveGroupKeyPref(), "pinned");

    mock.store.set("lfaa:project-expanded", "{bad-json");
    assert.deepEqual(readProjectExpandedPref(), {});
  } finally {
    mock.restore();
  }
});
