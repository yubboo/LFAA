/**
 * 文件：root-layout.test.mjs
 * 作用：验证根目录长期文档归位与临时文件防回归规则。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkRootLayout } from "../scripts/root-layout-check.mjs";

function createMinimumRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-root-layout-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  for (const name of ["ARCHITECTURE.md", "DEVELOPMENT.md", "PROJECT_PLAN.md"]) {
    fs.writeFileSync(path.join(root, "docs", name), "ok\n", "utf8");
  }
  for (const name of ["AGENTS.md", "CHANGELOG.md", "NOTICE.md", "README.md"]) {
    fs.writeFileSync(path.join(root, name), "ok\n", "utf8");
  }
  return root;
}

test("current repository keeps long-lived development docs under docs", () => {
  const result = checkRootLayout(process.cwd());
  assert.deepEqual(result.docs, ["docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/PROJECT_PLAN.md"]);
});

test("root layout rejects a long-lived development doc moved back to root", () => {
  const root = createMinimumRoot();
  try {
    fs.writeFileSync(path.join(root, "ARCHITECTURE.md"), "legacy\n", "utf8");
    assert.throws(() => checkRootLayout(root), /ARCHITECTURE\.md must live under docs\//);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("root layout rejects task markdown and archive artifacts in root", () => {
  const root = createMinimumRoot();
  try {
    fs.writeFileSync(path.join(root, "TODO.md"), "temporary\n", "utf8");
    assert.throws(() => checkRootLayout(root), /unexpected root Markdown: TODO\.md/);
    fs.rmSync(path.join(root, "TODO.md"));
    fs.writeFileSync(path.join(root, "candidate.zip"), "temporary", "utf8");
    assert.throws(() => checkRootLayout(root), /candidate\.zip/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
