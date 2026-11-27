// 画布复制与删除服务回归测试：验证复制画布节点与资产、以及删除画布目录。
// 关联：packages/media/canvas/src/canvas-service.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { CanvasService } from "../src/canvas-service";

const ONE_PIXEL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082",
  "hex",
);

describe("CanvasService duplicate and remove", () => {
  it("duplicates board graph and assets into a new board and removes boards cleanly", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-canvas-actions-"));
    const ctx = new Context();
    ctx.provide("llm");
    ctx.set("llm", {} as never);
    const service = new CanvasService(ctx, { root });
    try {
      const created = await service.create("proj-a", "画布 1");
      const dir = service.store.boardDir("proj-a", created.canvasId);
      await service.store.addAsset(dir, "sample.png", "image/png", ONE_PIXEL_PNG);

      const duplicated = await service.duplicate("proj-a", created.canvasId, "画布 1 副本");
      assert.notEqual(duplicated.canvasId, created.canvasId);
      assert.equal(duplicated.title, "画布 1 副本");
      const dupAssets = await service.store.assets(service.store.boardDir("proj-a", duplicated.canvasId));
      assert.equal(dupAssets.length, 1);

      await service.remove("proj-a", duplicated.canvasId);
      const remaining = await service.store.list("proj-a");
      assert.deepEqual(remaining.map((item) => item.canvasId), [created.canvasId]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
