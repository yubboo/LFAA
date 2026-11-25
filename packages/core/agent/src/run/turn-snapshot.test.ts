// 回归测试：验证每轮改动快照在编辑与新建文件后可完整一键撤销。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { captureBeforeMutation, undoTurnChanges } from "./turn-snapshot";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("turn-snapshot capture and undo", () => {
  it("restores modified files and removes newly created files in one turn", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-turn-snap-"));
    const snapRoot = await mkdtemp(join(tmpdir(), "lfaa-turn-snap-store-"));
    tempDirs.push(root, snapRoot);
    const existingFile = join(root, "existing.txt");
    const createdFile = join(root, "created.txt");
    await writeFile(existingFile, "original-content", "utf8");

    await captureBeforeMutation("sess-test", "msg-1", "existing.txt", [root], snapRoot);
    await writeFile(existingFile, "mutated-content", "utf8");
    // 同一轮再次写入时应保留首次快照，不被中间态覆盖。
    await captureBeforeMutation("sess-test", "msg-1", "existing.txt", [root], snapRoot);
    await writeFile(existingFile, "mutated-again", "utf8");

    await captureBeforeMutation("sess-test", "msg-1", "created.txt", [root], snapRoot);
    await writeFile(createdFile, "brand-new", "utf8");

    const result = await undoTurnChanges("sess-test", "msg-1", snapRoot);
    assert.ok(result.restored.includes(existingFile));
    assert.ok(result.removed.includes(createdFile));
    assert.equal(await readFile(existingFile, "utf8"), "original-content");
    await assert.rejects(() => stat(createdFile));
  });
});
