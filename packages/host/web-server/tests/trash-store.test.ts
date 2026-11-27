// 统一回收站 TrashStore 回归测试：覆盖软删除、30 天自动清理、预览解析、彻底删除与清空。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TRASH_RETENTION_MS, TrashStore, resolveConflictPath } from "../src/trash/trash-store";

describe("TrashStore", () => {
  it("preserves payloads whose metadata is pending, corrupt, or incomplete during cleanup", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-pending-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const store = new TrashStore(join(root, "trash"));
    const now = 1_700_000_000_000;
    const item = await store.trashProject({
      project: { id: "expired", name: "Expired project", rootPath: join(root, "workspace") },
      now: now - TRASH_RETENTION_MS,
    });

    for (const id of ["pending", "corrupt", "incomplete"]) {
      await mkdir(store.payloadDir(id), { recursive: true });
      await writeFile(join(store.payloadDir(id), "content.txt"), id, "utf8");
    }
    await writeFile(join(store.itemDir("corrupt"), "meta.json"), "{", "utf8");
    await writeFile(join(store.itemDir("incomplete"), "meta.json"), '{"id":"incomplete","expiresAt":null}', "utf8");

    assert.equal(await store.purgeExpired(now), 1);
    assert.equal(await store.getMeta(item.id), null);
    assert.deepEqual(await store.list("all", now), []);
    for (const id of ["pending", "corrupt", "incomplete"]) {
      assert.equal(await readFile(join(store.payloadDir(id), "content.txt"), "utf8"), id);
    }
  });

  it("soft-deletes canvas board, media file, project, and asset, then purges expired items", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-test-"));
    try {
      const store = new TrashStore(join(root, "trash"));
      const now = 1_700_000_000_000;

      // 1. 软删除画布目录
      const boardDir = join(root, "boards", "b1");
      await mkdir(join(boardDir, "assets"), { recursive: true });
      await writeFile(join(boardDir, "board.json"), JSON.stringify({ title: "画布 2" }), "utf8");
      await writeFile(join(boardDir, "assets", "a1.png"), Buffer.from([137, 80, 78, 71]));
      const canvasMeta = await store.trashCanvasBoard({
        projectId: "proj-1",
        projectName: "未命名项目",
        canvasId: "b1",
        boardTitle: "画布 2",
        boardDir,
        coverRelPath: join("assets", "a1.png"),
        coverMime: "image/png",
        now,
      });
      assert.equal(existsSync(boardDir), false);
      const preview = await store.resolvePreview(canvasMeta.id);
      assert.ok(preview && preview.mime === "image/png");

      // 2. 软删除素材文件（含 sidecar .json）
      const mediaFile = join(root, "media", "demo.png");
      await mkdir(join(root, "media"), { recursive: true });
      await writeFile(mediaFile, Buffer.from([1, 2, 3]));
      await writeFile(`${mediaFile}.json`, JSON.stringify({ prompt: "cat" }), "utf8");
      const mediaMeta = await store.trashMediaFile({ filePath: mediaFile, now: now + 1000 });
      assert.equal(existsSync(mediaFile), false);
      assert.equal(existsSync(`${mediaFile}.json`), false);

      // 3. 软删除项目与资料库资产
      const projectMeta = await store.trashProject({
        project: { id: "proj-1", name: "未命名项目", rootPath: join(root, "workspace-code") },
        now: now + 2000,
      });
      const assetMeta = await store.trashLibraryAsset({
        asset: {
          id: "asset-1",
          title: "脚本大纲",
          fileName: "outline.md",
          category: "artifact",
          mimeType: "text/markdown",
          tags: ["script"],
          projectId: null,
        },
        content: "# 大纲",
        now: now + 3000,
      });

      const listAll = await store.list("all", now + 4000);
      assert.equal(listAll.length, 4);
      assert.equal(listAll[0]?.id, assetMeta.id);
      assert.equal(listAll[0]?.remainingDays, 30);

      const listCanvas = await store.list("canvas", now + 4000);
      assert.equal(listCanvas.length, 1);
      assert.equal(listCanvas[0]?.originLabel, "未命名项目");

      // 4. 手动彻底删除单条
      assert.equal(await store.purge(projectMeta.id), true);
      assert.equal((await store.list("all", now + 4000)).length, 3);

      // 5. 超过 30 天自动清理
      const after31Days = await store.list("all", now + TRASH_RETENTION_MS + 10_000);
      assert.equal(after31Days.length, 0);
      assert.equal(await store.getMeta(mediaMeta.id), null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("generates conflict-free restored paths when target file already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-conflict-"));
    try {
      const target = join(root, "shot.png");
      await writeFile(target, "a", "utf8");
      const next = resolveConflictPath(target);
      assert.notEqual(next, target);
      assert.match(next, /shot \(恢复\)\.png$/u);
      await writeFile(next, "b", "utf8");
      const content = await readFile(next, "utf8");
      assert.equal(content, "b");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
