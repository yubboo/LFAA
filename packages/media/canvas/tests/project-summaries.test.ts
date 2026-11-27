// 画布项目摘要存储回归测试：验证过滤无画布项目、统计画布数量、取最新画布与封面图片资产。
// 关联：packages/media/canvas/src/canvas-store.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CanvasStore } from "../src/canvas-store";

const ONE_PIXEL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082",
  "hex",
);

describe("CanvasStore.summarizeProject", () => {
  it("returns null for projects without any canvas boards", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-canvas-summary-"));
    try {
      const store = new CanvasStore(root);
      assert.equal(await store.summarizeProject("proj-empty"), null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("summarizes board count, latest board title, updatedAt, and image cover asset", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-canvas-summary-"));
    try {
      const store = new CanvasStore(root);
      const firstId = "11111111-1111-4111-8111-111111111111";
      const secondId = "22222222-2222-4222-8222-222222222222";

      const firstDir = store.boardDir("proj-1", firstId);
      await store.saveBoard(firstDir, {
        schemaVersion: 1,
        projectId: "proj-1",
        canvasId: firstId,
        title: "首块画布",
        revision: 0,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      await new Promise((resolve) => setTimeout(resolve, 25));

      const secondDir = store.boardDir("proj-1", secondId);
      await store.saveBoard(secondDir, {
        schemaVersion: 1,
        projectId: "proj-1",
        canvasId: secondId,
        title: "最新画布",
        revision: 1,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
      const cover = await store.addAsset(secondDir, "cover.png", "image/png", ONE_PIXEL_PNG);

      const summary = await store.summarizeProject("proj-1");
      assert.ok(summary);
      assert.equal(summary.projectId, "proj-1");
      assert.equal(summary.boardCount, 2);
      assert.equal(summary.latestCanvasId, secondId);
      assert.equal(summary.latestTitle, "最新画布");
      assert.equal(summary.coverAssetId, cover.id);
      assert.ok(summary.updatedAt > 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
