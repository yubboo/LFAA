import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readWebAssetHistory, retainWebAssetGenerations } from "../../web/scripts/web-asset-retention.mjs";

test("保留当前和最近两代哈希资源，并清理更早的资源", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-web-assets-"));
  try {
    const output = join(root, "dist", "apps", "web");
    const assets = join(output, "assets");
    await mkdir(assets, { recursive: true });
    const files = [
      "assets/index-current123.js",
      "assets/ApplicationWorkspace-current12.js",
      "assets/index-previous12.js",
      "assets/ApplicationWorkspace-previous1.js",
      "assets/index-expired123.js",
      "assets/index-oldest123.js"
    ];
    await Promise.all(files.map((file) => writeFile(resolve(output, file), file, "utf8")));

    const result = await retainWebAssetGenerations(output, files.slice(0, 2), [files.slice(2, 4), [files[4]], [files[5]]]);

    assert.equal(result.generations.length, 3);
    assert.deepEqual(result.removed, [files[5]]);
    await assert.rejects(readFile(resolve(output, files[5])));
    assert.equal(await readFile(resolve(output, files[4]), "utf8"), files[4]);
    assert.equal(await readFile(resolve(output, files[1]), "utf8"), files[1]);
    assert.deepEqual(await readWebAssetHistory(output), result.generations.slice(0, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("忽略历史记录中的非哈希路径和路径穿越内容", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-web-assets-"));
  try {
    const output = join(root, "dist", "apps", "web");
    await mkdir(join(output, "assets"), { recursive: true });
    await writeFile(join(output, ".lfaa-web-asset-history.json"), JSON.stringify({
      schemaVersion: 1,
      generations: [["assets/app-Abcdef12.js", "../../outside.js", "assets/logo.svg"]]
    }), "utf8");
    assert.deepEqual(await readWebAssetHistory(output), [["assets/app-Abcdef12.js"]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
