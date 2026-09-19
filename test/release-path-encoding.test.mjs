/**
 * 文件：release-path-encoding.test.mjs
 * 作用：锁定发布包中最容易被错误归档器破坏的 Unicode/隐藏路径事实。
 * 负责：源码树必须存在中文代码地图与 .lfaa 隐藏骨架；路径名不得出现常见 mojibake/替换字符。
 * 不负责：直接解析 ZIP；正式打包仍必须执行 ZIP round-trip 再在解压根运行 workspace-preflight。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const required = [
  "docs/项目结构与代码地图.md",
  ".lfaa/README.md",
  ".lfaa/manifest.json",
  ".lfaa/lock.json",
  ".lfaa/skills/README.md",
  ".lfaa/experts/README.md",
  ".lfaa/plugins/README.md",
  ".lfaa/extensions/README.md",
  ".lfaa/mcp/README.md",
];

function walk(relative = "") {
  const absolute = path.join(root, relative);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git", "target", "dist"].includes(entry.name)) return [];
    const next = path.join(relative, entry.name);
    return entry.isDirectory() ? [next, ...walk(next)] : [next];
  });
}

test("release-critical Unicode and hidden paths exist exactly", () => {
  for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
});

test("repository paths contain no known mojibake markers", () => {
  const suspicious = walk().filter((name) => /(?:�|Θí╣|τ¢«|τ╗ô|µ₧ä|Σ╕Ä|σ£░|σ¢╛)/u.test(name));
  assert.deepEqual(suspicious, []);
});
