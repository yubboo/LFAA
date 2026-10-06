/**
 * 功能：回归验证直接刷新工作台路由时的模块预热顺序。
 * 作用：确保设置中心代码在认证恢复期间与账户读取并行准备，并复用 Workbench 的设置页模块入口。
 * 关联文件：packages/client/ui-renderer/src/workbench-preload.ts、App.tsx、ui-layout/src/Workbench.tsx。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  preloadWorkbenchForRoute,
  shouldPreloadSettingsPageForRoute,
  shouldPreloadWorkbenchForRoute
} from "../../../packages/client/ui-renderer/src/workbench-preload.ts";

test("设置与旧账户管理直达路由先加载 Workbench 再预热 SettingsPage", async () => {
  for (const pathname of ["/settings", "/admin/users"]) {
    const calls = [];
    await preloadWorkbenchForRoute(pathname, async () => {
      calls.push("workbench");
      return {
        preloadSettingsPageForRoute: async () => { calls.push("settings-page"); }
      };
    });

    assert.deepEqual(calls, ["workbench", "settings-page"]);
    assert.equal(shouldPreloadSettingsPageForRoute(pathname), true);
  }
});

test("其他直接工作区路由只预热共享 Workbench", async () => {
  for (const pathname of ["/tasks", "/files", "/apps/workspace/ai-work", "/apps/minecraft/normal/instances"]) {
    const calls = [];
    assert.equal(shouldPreloadWorkbenchForRoute(pathname), true);
    await preloadWorkbenchForRoute(pathname, async () => {
      calls.push("workbench");
      return { preloadSettingsPageForRoute: async () => { calls.push("settings-page"); } };
    });
    assert.deepEqual(calls, ["workbench"]);
  }
});

test("登录页和应用中心不在认证前下载工作台，认证后则可预热", async () => {
  for (const pathname of ["/", "/login"]) {
    let calls = 0;
    assert.equal(shouldPreloadWorkbenchForRoute(pathname), false);
    await preloadWorkbenchForRoute(pathname, async () => {
      calls += 1;
      return { preloadSettingsPageForRoute: async () => undefined };
    });
    assert.equal(calls, 0);
    await preloadWorkbenchForRoute(pathname, async () => {
      calls += 1;
      return { preloadSettingsPageForRoute: async () => undefined };
    }, true);
    assert.equal(calls, 1);
  }
});

test("预热模块失败时收敛为无副作用，认证流程仍可继续", async () => {
  await assert.doesNotReject(preloadWorkbenchForRoute("/settings", async () => {
    throw new Error("module unavailable");
  }));
  await assert.doesNotReject(preloadWorkbenchForRoute("/settings", async () => ({
    preloadSettingsPageForRoute: async () => { throw new Error("settings chunk unavailable"); }
  })));
});
