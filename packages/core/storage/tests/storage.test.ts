// 验证资料库资产的保存、列出、读取与删除。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AssetLibraryStore, VAULT_DIRS } from "../src";

test("资产可保存、列出、读取并删除", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-storage-"));
  try {
    const store = new AssetLibraryStore(root);
    const saved = await store.save({
      category: "artifact",
      title: "验收报告",
      fileName: "report.txt",
      content: "hello storage",
      tags: ["验收"],
    });
    assert.ok(saved.relativePath.startsWith(VAULT_DIRS.artifacts));
    const list = await store.list({});
    assert.equal(list[0]?.id, saved.id);
    const read = await store.readContent(saved.id);
    assert.equal(read?.isText, true);
    assert.equal(read?.content, "hello storage");
    assert.equal(await store.remove(saved.id), true);
    assert.equal((await store.list({})).length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
