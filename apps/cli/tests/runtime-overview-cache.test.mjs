/** 功能：回归运行环境页的按账户首屏快照。作用：回访立即显示真实缓存，并保留认证后状态核对。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../../packages/client/ui-layout/src/GameLibraryPage.tsx", import.meta.url), "utf8");

test("运行环境页按账户与角色恢复最近真实环境快照", () => {
  assert.match(source, /const snapshotKey=`\$\{user\.id\}\\u001f\$\{user\.role\}`/u);
  assert.match(source, /runtimeOverviewSnapshots\.get\(snapshotKey\)/u);
  assert.match(source, /runtimeOverviewSnapshots\.set\(snapshotKey,snapshot\)/u);
  assert.match(source, /RUNTIME_OVERVIEW_FRESHNESS_MS = 30_000/u);
  assert.match(source, /Date\.now\(\) - cached\.refreshedAt < RUNTIME_OVERVIEW_FRESHNESS_MS/u);
  assert.match(source, /loadRuntimeOverview\(controller\.signal\)/u);
  assert.match(source, /overviewState\.key===snapshotKey\?overviewState\.snapshot\?\.overview\?\?null:null/u);
});
