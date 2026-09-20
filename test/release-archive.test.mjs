/**
 * 文件：release-archive.test.mjs
 * 作用：防止发布 ZIP 再次丢失 Unicode filename flag 或隐藏目录。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createReleaseArchive, readCentralDirectoryEntries } from "../scripts/release-archive.mjs";

test("release archive writes exact Unicode path with ZIP UTF-8 flag", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-archive-"));
  const output = path.join(os.tmpdir(), `lfaa-archive-${process.pid}-${Date.now()}.zip`);
  try {
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, ".lfaa", "logs"), { recursive: true });
    fs.writeFileSync(path.join(root, "lfaa.release.json"), '{"displayVersion":"0.0.0"}', "utf8");
    fs.writeFileSync(path.join(root, "docs", "项目结构与代码地图.md"), "ok", "utf8");
    fs.writeFileSync(path.join(root, ".lfaa", "README.md"), "hidden", "utf8");

    createReleaseArchive({ root, output });
    const entries = readCentralDirectoryEntries(output);
    const unicode = entries.find((entry) => entry.name === "docs/项目结构与代码地图.md");
    assert.ok(unicode);
    assert.equal(unicode.utf8, true);
    assert.ok(entries.some((entry) => entry.name === ".lfaa/"));
    assert.ok(entries.some((entry) => entry.name === ".lfaa/logs/"));
    assert.equal(entries.some((entry) => /Θí╣|τ¢«|�/u.test(entry.name)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(output, { force: true });
  }
});
