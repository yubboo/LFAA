/**
 * 文件：release-archive.test.mjs
 * 作用：防止发布 ZIP 再次丢失 Unicode filename flag 或必要空目录。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertReleaseCandidateMetadata, createReleaseArchive, readCentralDirectoryEntries } from "../scripts/release-archive.mjs";

test("release archive writes exact Unicode path with ZIP UTF-8 flag", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-archive-"));
  const output = path.join(os.tmpdir(), `lfaa-archive-${process.pid}-${Date.now()}.zip`);
  try {
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, "packages", "empty-family"), { recursive: true });
    fs.mkdirSync(path.join(root, ".test-runtime-home", "state"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs", "logs", "runtime", "workspace-sync"), { recursive: true });
    fs.writeFileSync(path.join(root, "lfaa.release.json"), '{"displayVersion":"0.0.0"}', "utf8");
    fs.writeFileSync(path.join(root, "docs", "项目结构与代码地图.md"), "ok", "utf8");
    fs.writeFileSync(
      path.join(root, "docs", "PROMPTS.md"),
      "# v0.0.0 Prompt / Requirement Note — test\n\n| 任务 | 功能名称 | 版本 | 状态 | AI 验证 | 用户验收 |\n|---|---|---|---|---|---|\n| #1.1 | test | v0.0.0 | pending-user-acceptance | pass | pending |\n",
      "utf8",
    );
    fs.writeFileSync(path.join(root, ".test-runtime-home", "state", "session.json"), "test-only", "utf8");
    fs.writeFileSync(path.join(root, "docs", "logs", "runtime", "workspace-sync", "sync-test.log"), "local-only", "utf8");

    createReleaseArchive({ root, output });
    const entries = readCentralDirectoryEntries(output);
    const unicode = entries.find((entry) => entry.name === "docs/项目结构与代码地图.md");
    assert.ok(unicode);
    assert.equal(unicode.utf8, true);
    assert.ok(entries.some((entry) => entry.name === "packages/empty-family/"));
    assert.equal(entries.some((entry) => entry.name.startsWith(".test-runtime-home/")), false);
    assert.ok(entries.some((entry) => entry.name === "docs/logs/runtime/workspace-sync/"));
    assert.equal(entries.some((entry) => entry.name.endsWith(".log")), false);
    assert.equal(entries.some((entry) => /Θí╣|τ¢«|�/u.test(entry.name)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(output, { force: true });
  }
});


test("release candidate metadata rejects a missing current Prompt ledger entry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-archive-metadata-"));
  try {
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.writeFileSync(path.join(root, "lfaa.release.json"), '{"displayVersion":"0.1.14"}', "utf8");
    fs.writeFileSync(path.join(root, "docs", "PROMPTS.md"), "# v0.1.13 Prompt / Requirement Note — stale\n", "utf8");
    assert.throws(() => assertReleaseCandidateMetadata(root), /缺少当前版本 v0\.1\.14/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
