/**
 * 功能：回归真实项目文件执行器。
 * 作用：在临时目录验证 UTF-8、唯一锚点、摘要冲突、越界拒绝及 Node 标准输入执行，结束后清理夹具。
 * 关联文件：packages/host/daemon/src/project-files.mjs、core/tools/project-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});
