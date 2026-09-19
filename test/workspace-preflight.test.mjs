/**
 * 文件：workspace-preflight.test.mjs
 * 作用：保证 Windows Sync/GitHub 共用同一个可诊断 workspace preflight。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("workspace preflight reports the exact failing gate instead of only a log path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-preflight-"));
  const result = spawnSync(process.execPath, ["scripts/workspace-preflight.mjs", "--root", root], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\[LFAA-PREFLIGHT\]\[FAIL\] governance: missing scripts\/governance-check\.mjs/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("Sync and GitHub scripts invoke the same workspace-preflight entry", () => {
  const sync = fs.readFileSync("scripts/windows/lfaa-sync.ps1", "utf8");
  const github = fs.readFileSync("scripts/windows/lfaa-github.ps1", "utf8");
  for (const source of [sync, github]) {
    assert.match(source, /scripts\\workspace-preflight\.mjs/);
    assert.match(source, /【失败详情】/);
  }
});

test("runtime log folders survive Git/ZIP because tracked placeholders exist", () => {
  for (const folder of ["workspace-sync", "github-push", "source-update"]) {
    assert.ok(fs.existsSync(`docs/logs/runtime/${folder}/.gitkeep`));
  }
});
