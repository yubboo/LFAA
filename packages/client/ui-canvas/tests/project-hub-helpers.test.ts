// 画布项目大厅纯逻辑回归测试：覆盖画布项目过滤、关键字搜索、排序与相对时间格式化。
// 关联：packages/client/ui-canvas/client/projects/project-hub-helpers.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHubProjectItems,
  filterAndSortHubProjects,
  formatRelativeEditedTime,
  pickFallbackCoverPath,
  resolveUniqueCanvasProjectName,
} from "../client/projects/project-hub-helpers";

describe("project-hub-helpers", () => {
  it("only includes canvas projects and the default sample workspace", () => {
    const items = buildHubProjectItems(
      [
        { id: "p1", name: "普通代码项目", kind: "workspace" },
        { id: "p2", name: "剧本策划助手 项目", kind: "canvas", canvasFolderId: "f1" },
        { id: "p3", name: "默认工作区", kind: "workspace", isDefault: true },
      ],
      [
        { projectId: "p1", boardCount: 1, latestCanvasId: "c1", latestTitle: "不应出现", updatedAt: 9000 },
        { projectId: "p2", boardCount: 2, latestCanvasId: "c2", latestTitle: "分镜板", updatedAt: 2000, coverAssetId: "a1" },
      ],
    );
    assert.deepEqual(items.map((item) => item.id), ["p2", "p3"]);
    assert.equal(items[0]?.coverAssetId, "a1");
    assert.equal(items[0]?.canvasFolderId, "f1");
    assert.equal(items[1]?.isDefault, true);
  });

  it("filters by name/title and sorts by recent or name", () => {
    const items = buildHubProjectItems(
      [
        { id: "p1", name: "B 项目", kind: "canvas" },
        { id: "p2", name: "A 项目", kind: "canvas" },
      ],
      [
        { projectId: "p1", boardCount: 1, latestCanvasId: "c1", latestTitle: "分镜", updatedAt: 9000 },
        { projectId: "p2", boardCount: 1, latestCanvasId: "c2", latestTitle: "角色", updatedAt: 3000 },
      ],
    );
    assert.deepEqual(filterAndSortHubProjects(items, "", "recent").map((i) => i.id), ["p1", "p2"]);
    assert.deepEqual(filterAndSortHubProjects(items, "", "name").map((i) => i.id), ["p2", "p1"]);
    assert.deepEqual(filterAndSortHubProjects(items, "角色", "recent").map((i) => i.id), ["p2"]);
  });

  it("formats relative edited times in Chinese and English", () => {
    const now = 1_700_000_000_000;
    assert.equal(formatRelativeEditedTime(now - 20_000, now, true), "刚刚");
    assert.equal(formatRelativeEditedTime(now - 2 * 3_600_000, now, true), "2 小时前");
    assert.equal(formatRelativeEditedTime(now - 9 * 86_400_000, now, true), "9 天前");
    assert.equal(formatRelativeEditedTime(now - 20_000, now, false), "just now");
    assert.equal(formatRelativeEditedTime(now - 3 * 3_600_000, now, false), "3h ago");
  });

  it("deterministically picks a fallback cover image per projectId", () => {
    assert.equal(pickFallbackCoverPath("p1", []), undefined);
    const pool = ["/a.png", "/b.png", "/c.png"];
    const first = pickFallbackCoverPath("proj-alpha", pool);
    assert.ok(first && pool.includes(first));
    assert.equal(pickFallbackCoverPath("proj-alpha", pool), first);
  });

  it("resolves duplicate canvas project names without spaces starting from 1", () => {
    assert.equal(resolveUniqueCanvasProjectName(" 短剧 ", ["默认工作区"]), "短剧");
    assert.equal(resolveUniqueCanvasProjectName("短剧", ["短剧"]), "短剧1");
    assert.equal(resolveUniqueCanvasProjectName("短剧", ["短剧", "短剧1"]), "短剧2");
    assert.equal(resolveUniqueCanvasProjectName("Drama", ["drama", "DRAMA1"]), "Drama2");
    assert.equal(resolveUniqueCanvasProjectName("   ", ["短剧"]), "");
  });
});
