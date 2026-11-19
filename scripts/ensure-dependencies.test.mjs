// 依赖预检脚本的回归测试：覆盖 Windows 换行与 pnpm 规范化副本的兼容性。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectPackages, lockfilesMatch } from "./ensure-dependencies.mjs";

// 在临时 workspace 中验证一级显式包与分组内二级包都会被识别。
test("workspace scan includes package manifests at both allowed depths", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-workspace-scan-"));
  try {
    for (const project of ["apps/web", "packages/skills", "packages/plugins", "packages/core/agent"]) {
      const folder = join(root, project);
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, "package.json"), "{}", "utf8");
    }

    assert.deepEqual((await collectPackages("apps", 1, root)).sort(), ["apps/web"]);
    assert.deepEqual((await collectPackages("packages", 2, root)).sort(), [
      "packages/core/agent",
      "packages/plugins",
      "packages/skills",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// 比较仓库 CRLF lockfile 与 pnpm 写入 LF 副本时应视为内容一致。
test("lockfile comparison ignores CRLF versus LF line endings", () => {
  assert.equal(lockfilesMatch("lockfileVersion: '9.0'\r\nimporters:\r\n", "lockfileVersion: '9.0'\nimporters:\n"), true);
});

// 规范化换行不应掩盖实际依赖清单变化。
test("lockfile comparison still detects content changes", () => {
  assert.equal(lockfilesMatch("importers:\r\n", "packages:\n"), false);
});
