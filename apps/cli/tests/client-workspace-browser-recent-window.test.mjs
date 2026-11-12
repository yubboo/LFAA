import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BROWSER_RECENT_SITES_WINDOW_MS, resolveVisibleBrowserRecentSites } from "../../../packages/client/ui-workspace/src/browser-recent-sites-window.ts";

const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");

test("最近网站仅显示滚动 72 小时内的有效访问时间", () => {
  const now = Date.parse("2026-11-12T12:00:00.000Z");
  const sites = [
    { url: "https://fresh.example/", visitedAt: new Date(now - BROWSER_RECENT_SITES_WINDOW_MS + 1).toISOString() },
    { url: "https://boundary.example/", visitedAt: new Date(now - BROWSER_RECENT_SITES_WINDOW_MS).toISOString() },
    { url: "https://future.example/", visitedAt: new Date(now + 1).toISOString() },
    { url: "https://invalid.example/", visitedAt: "not-a-date" },
  ];

  assert.deepEqual(resolveVisibleBrowserRecentSites(sites, now).sites, [sites[0]]);
});

test("最近网站返回最早到期点，便于单个定时器收起过期内容", () => {
  const now = Date.parse("2026-11-12T12:00:00.000Z");
  const older = { url: "https://older.example/", visitedAt: new Date(now - 20).toISOString() };
  const newer = { url: "https://newer.example/", visitedAt: new Date(now - 10).toISOString() };
  const result = resolveVisibleBrowserRecentSites([newer, older], now);

  assert.deepEqual(result.sites, [newer, older]);
  assert.equal(result.nextExpiryAt, Date.parse(older.visitedAt) + BROWSER_RECENT_SITES_WINDOW_MS);
  assert.match(workspace, /window\.setTimeout\([\s\S]*?window\.clearTimeout\(timeoutId\)/u, "页面打开期间安排到期刷新，并在 effect 清理时取消计时器");
});
