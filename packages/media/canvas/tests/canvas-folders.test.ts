// 画布分类文件夹存储单测：覆盖创建、列出、重名拦截、重命名与删除。
// 关联：packages/media/canvas/src/canvas-folders.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CanvasFolderStore } from "../src/canvas-folders";

describe("CanvasFolderStore", () => {
  it("supports create, list, duplicate rejection, rename and remove", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lfaa-canvas-folders-"));
    try {
      const store = new CanvasFolderStore(dir);
      assert.deepEqual(await store.list(), []);

      const created = await store.create("AI 短剧第一季");
      assert.equal(created.name, "AI 短剧第一季");
      assert.equal((await store.list()).length, 1);

      await assert.rejects(() => store.create("ai 短剧第一季"), /已存在/);

      const renamed = await store.rename(created.id, "短剧分镜合集");
      assert.equal(renamed?.name, "短剧分镜合集");

      assert.equal(await store.remove(created.id), true);
      assert.deepEqual(await store.list(), []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
