import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RECENT_WINDOW_DAY_MS, RECENT_WINDOW_DEFAULT_DAYS, resolveRecentItems } from "../../../packages/util/values/src/recent-window.ts";

const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const defaultWindowMs = RECENT_WINDOW_DEFAULT_DAYS * RECENT_WINDOW_DAY_MS;

test("最近网站仅显示共享默认三天窗口内的有效访问时间", () => {
  const now = Date.parse("2026-11-12T12:00:00.000Z");
  const sites = [
    { url: "https://fresh.example/", visitedAt: new Date(now - defaultWindowMs + 1).toISOString() },
    { url: "https://boundary.example/", visitedAt: new Date(now - defaultWindowMs).toISOString() },
    { url: "https://future.example/", visitedAt: new Date(now + 1).toISOString() },
    { url: "https://invalid.example/", visitedAt: "not-a-date" },
    { url: "https://current.example/", visitedAt: new Date(now).toISOString() },
  ];

  assert.deepEqual(resolveRecentItems(sites, site => site.visitedAt, now).items, [sites[0], sites[4]]);
});

test("共享时间窗允许调用者覆盖天数，并保留来源顺序与最早到期时刻", () => {
  const now = Date.parse("2026-11-12T12:00:00.000Z");
  const older = { url: "https://older.example/", visitedAt: new Date(now - 20).toISOString() };
  const newer = { url: "https://newer.example/", visitedAt: new Date(now - 10).toISOString() };
  const result = resolveRecentItems([newer, older], site => site.visitedAt, now, 1);

  assert.deepEqual(result.items, [newer, older]);
  assert.equal(result.nextExpiryAt, Date.parse(older.visitedAt) + RECENT_WINDOW_DAY_MS);
});

test("右侧网站与左侧聊天均使用同一函数，并清理各自最早到期计时器", () => {
  assert.match(workspace, /resolveRecentItems\(browserRecentSitesState\.sites,\s*site\s*=>\s*site\.visitedAt,\s*browserRecentSitesNow\)/u);
  assert.match(workspace, /resolveRecentItems\(\s*appSessions\.filter\(session\s*=>\s*!session\.projectId\s*&&\s*!pinnedSessionSet\.has\(session\.id\)\),\s*session\s*=>\s*session\.updatedAt,/u);
  assert.match(workspace, /recentSessionsView\.nextExpiryAt[\s\S]*?window\.setTimeout[\s\S]*?window\.clearTimeout\(timeoutId\)/u);
  assert.match(workspace, /const \{\s*nextExpiryAt\s*\} = browserRecentSitesForDisplay;[\s\S]*?window\.setTimeout[\s\S]*?window\.clearTimeout\(timeoutId\)/u, "网站到期计时器仍在 effect 清理时撤销");
});
