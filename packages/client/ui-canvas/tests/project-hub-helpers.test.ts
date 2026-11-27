// 画布项目大厅纯逻辑回归测试：覆盖画布项目过滤、关键字搜索、排序与相对时间格式化。
// 关联：packages/client/ui-canvas/client/projects/project-hub-helpers.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHubProjectItems,
  filterAndSortHubProjects,
  formatRelativeEditedTime,
  pickFallbackCoverPath,
} from "../client/projects/project-hub-helpers";

describe("project-hub-helpers", () => {
  it("only includes projects that have canvas summaries", () => {
    const items = buildHubProjectItems(
      [
        { id: "p1", name: "普通代码项目" },
        { id: "p2", name: "剧本策划助手 项目" },
        { id: "p3", name: "未命名项目" },
      ],
      [
        { projectId: "p2", boardCount: 2, latestCanvasId: "c2", latestTitle: "分镜板", updatedAt: 2000 },
        { projectId: "p3", boardCount: 1, latestCanvasId: "c3", latestTitle: "未命名画布", updatedAt: 5000, coverAssetId: "a1" },
      ],
    );
    assert.deepEqual(items.map((item) => item.id), ["p2", "p3"]);
    assert.equal(items[1]?.coverAssetId, "a1");
  });

  it("filters by name/title and sorts by recent or name", () => {
    const items = buildHubProjectItems(
      [
        { id: "p1", name: "B 项目" },
        { id: "p2", name: "A 项目" },
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
});
