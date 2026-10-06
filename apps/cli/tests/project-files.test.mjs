/**
 * 功能：回归真实项目文件执行器。
 * 作用：在临时目录验证 UTF-8、唯一锚点、摘要冲突、越界拒绝及 Node 标准输入执行，结束后清理夹具。
 * 关联文件：packages/host/daemon/src/project-files.mjs、core/tools/project-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { executeProjectFile } from "../../../packages/host/daemon/src/project-files.mjs";

test("项目文本操作返回真实证据且拒绝覆盖、重复锚点和越界", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-files-"));
  const base = { rootDirectory: root, path: "src/example.txt" };
  try {
    await executeProjectFile({ ...base, operation: "create", content: "第一行\r\n修复位置\r\n" });
    await assert.rejects(executeProjectFile({ ...base, operation: "create", content: "覆盖" }), /EEXIST/u);
    const initial = await executeProjectFile({ ...base, operation: "read" });
    assert.equal(initial.content, "第一行\r\n修复位置\r\n");
    const replaced = await executeProjectFile({ ...base, operation: "replace", sha256: initial.sha256, oldText: "修复位置", newText: "已修复" });
    assert.equal(replaced.changed, true);
    await assert.rejects(executeProjectFile({ ...base, operation: "replace", sha256: initial.sha256, oldText: "已修复", newText: "覆盖" }), /文件已变化/u);
    const current = await executeProjectFile({ ...base, operation: "read" });
    await executeProjectFile({ ...base, path: ".agents/skills/reviewer/SKILL.md", operation: "create", content: "---\nname: reviewer\n---\n检查项目差异和测试证据。" });
    const discovered = await executeProjectFile({ ...base, path: ".", operation: "discover_skills" });
    assert.equal(discovered.skills[0].name, "reviewer");
    assert.match((await executeProjectFile({ ...base, path: discovered.skills[0].path, operation: "read" })).content, /检查项目差异/u);
    await assert.rejects(executeProjectFile({ ...base, operation: "replace", sha256: current.sha256, oldText: "\r\n", newText: "\n" }), /不唯一/u);
    assert.equal((await executeProjectFile({ ...base, path: ".", operation: "search", query: "已修复" })).matches[0].line, 2);
    await assert.rejects(executeProjectFile({ ...base, path: "../outside.txt", operation: "create", content: "越界" }), /超出/u);
    writeFileSync(join(root, "bom.txt"), "\ufeff保留 BOM");
    assert.equal((await executeProjectFile({ ...base, path: "bom.txt", operation: "read" })).content, "\ufeff保留 BOM");
    const runner = fileURLToPath(new URL("../../../packages/host/daemon/src/project-files.mjs", import.meta.url));
    const result = execFileSync(process.execPath, [runner], { input: JSON.stringify({ ...base, operation: "read" }), encoding: "utf8", windowsHide: true });
    assert.equal(JSON.parse(result).sha256, current.sha256);
    const page = await executeProjectFile({ ...base, operation: "read", offset: 1, limit: 3 });
    assert.equal(page.content, current.content.slice(1, 4));
    assert.equal(page.offset, 1);
    assert.equal(page.truncated, true);
    const saved = await executeProjectFile({ ...base, operation: "write", sha256: current.sha256, content: "保存后的文本🙂\r\n" });
    assert.equal(saved.changed, true);
    assert.equal((await executeProjectFile({ ...base, operation: "read" })).content, "保存后的文本🙂\r\n");
    await assert.rejects(executeProjectFile({ ...base, operation: "write", sha256: current.sha256, content: "不应覆盖" }), /文件已变化/u);
    await assert.rejects(executeProjectFile({ ...base, operation: "write", sha256: saved.sha256, content: "含\0二进制标记" }), /二进制标记/u);
    try {
      symlinkSync("src/example.txt", join(root, "inside-link.txt"), "file");
      const linked = await executeProjectFile({ ...base, path: "inside-link.txt", operation: "read" });
      await assert.rejects(executeProjectFile({ ...base, path: "inside-link.txt", operation: "write", sha256: linked.sha256, content: "不要替换链接" }), /不支持符号链接/u);
    } catch (error) {
      if (!error || !["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    }
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("Skill 文件树只在新目录内原子创建并拒绝路径穿越或覆盖", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-skill-tree-"));
  const base = { rootDirectory: root, path: ".agents/skills/reviewer", operation: "create_tree" };
  try {
    const result = await executeProjectFile({ ...base, files: [
      { path: "SKILL.md", content: "---\nname: reviewer\n---\n审阅项目内容。" },
      { path: "references/checklist.md", content: "逐项核对证据。" },
      { path: "参考/核对表.md", content: "确认中文目录和文件名。" }
    ] });
    assert.equal(result.created, true);
    assert.equal(result.files.length, 3);
    assert.equal((await executeProjectFile({ rootDirectory: root, path: ".", operation: "discover_skills" })).skills[0].name, "reviewer");
    await assert.rejects(executeProjectFile({ ...base, files: [{ path: "../escape.txt", content: "越界" }] }), /不安全的相对路径/u);
    await assert.rejects(executeProjectFile({ ...base, files: [{ path: "SKILL.md", content: "覆盖" }] }), /目标目录已存在/u);
    await assert.rejects(executeProjectFile({ ...base, path: ".agents/skills/duplicate", files: [
      { path: "SKILL.md", content: "a" }, { path: "skill.md", content: "b" }
    ] }), /重复路径/u);
    await assert.rejects(executeProjectFile({ rootDirectory: root, path: ".agents/skills/duplicate", operation: "list" }), /ENOENT/u, "拒绝的文件树没有留下部分目录");
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("项目目录选择只列一级文件夹，且不会暴露或进入 LFAA_DATA_DIR", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-picker-"));
  const dataRoot = join(root, "lfaa-data");
  mkdirSync(dataRoot);
  writeFileSync(join(dataRoot, "private.txt"), "受保护的数据");
  const runner = fileURLToPath(new URL("../../../packages/host/daemon/src/project-files.mjs", import.meta.url));
  const env = { ...process.env, LFAA_DAEMON_DATA_ROOT: dataRoot };
  const run = input => JSON.parse(execFileSync(process.execPath, [runner], { input: JSON.stringify(input), encoding: "utf8", windowsHide: true, env, stdio: ["pipe", "pipe", "pipe"] }));
  const assertProtectedPathRejected = input => {
    let failure;
    try { run(input); } catch (error) { failure = error; }
    assert.ok(failure);
    assert.match(String(failure.stderr), /LFAA_DATA_DIR/u);
  };
  try {
    const home = await executeProjectFile({ operation: "home" });
    assert.ok(home.path);
    assert.ok(Array.isArray(home.roots));
    const listing = run({ operation: "list_directories", path: root });
    assert.equal(listing.entries.includes("lfaa-data"), false);
    const created = run({ operation: "create_directory", path: root, name: "new project" });
    assert.equal(created.created, true);
    assert.equal(run({ operation: "inspect_directory", path: created.path }).directory, true);

    const toolListing = run({ rootDirectory: root, path: ".", operation: "list" });
    assert.equal(toolListing.entries.some(entry => entry.name === "lfaa-data"), false);
    assertProtectedPathRejected({ rootDirectory: root, path: "lfaa-data/private.txt", operation: "read" });
    assertProtectedPathRejected({ operation: "create_directory", path: dataRoot, name: "blocked" });
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});
