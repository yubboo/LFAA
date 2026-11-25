// 依赖预检脚本的回归测试：覆盖 Windows 换行、BOM 与「仅包块顺序不同」的锁文件兼容性。
// 顺序差异是真实踩过的坑：pnpm 只在写盘时排序，仓库锁文件被手改后会让启动器的字节比对永久失败。
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
test("lockfile comparison ignores CRLF versus LF line endings", async () => {
  assert.equal(await lockfilesMatch("lockfileVersion: '9.0'\r\nimporters:\r\n", "lockfileVersion: '9.0'\nimporters:\n"), true);
});

// pnpm 只在真正写盘时按名称排序：仓库锁文件被手改成别的块顺序时，语义仍然相同。
test("lockfile comparison ignores package block order", async () => {
  const ordered = [
    "lockfileVersion: '9.0'",
    "packages:",
    "  accepts@2.0.0:",
    "    resolution: {integrity: sha512-a}",
    "  agent-base@7.0.2:",
    "    resolution: {integrity: sha512-b}",
    "",
  ].join("\n");
  const shuffled = [
    "lockfileVersion: '9.0'",
    "packages:",
    "  agent-base@7.0.2:",
    "    resolution: {integrity: sha512-b}",
    "  accepts@2.0.0:",
    "    resolution: {integrity: sha512-a}",
    "",
  ].join("\n");

  assert.equal(await lockfilesMatch(ordered, shuffled), true);
});

// 放宽顺序后仍必须抓到真实的依赖变化，否则会把过期安装当成已就绪。
test("lockfile comparison still detects content changes", async () => {
  assert.equal(await lockfilesMatch("importers:\r\n", "packages:\n"), false);
});

// 同一个包换了解析结果（版本 / 完整性）必须判为不一致。
test("lockfile comparison detects a changed resolution", async () => {
  const before = "packages:\n  accepts@2.0.0:\n    resolution: {integrity: sha512-a}\n";
  const after = "packages:\n  accepts@2.0.0:\n    resolution: {integrity: sha512-c}\n";

  assert.equal(await lockfilesMatch(before, after), false);
});

// 编辑器给锁文件写 BOM 时不应影响语义比较。
test("lockfile comparison ignores a UTF-8 BOM", async () => {
  assert.equal(await lockfilesMatch("\uFEFFlockfileVersion: '9.0'\n", "lockfileVersion: '9.0'\n"), true);
});