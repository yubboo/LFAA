/**
 * 文件：release-path-encoding.test.mjs
 * 作用：锁定发布包中最容易被错误归档器破坏的 Unicode 路径与 Harness 主骨架事实。
 * 负责：源码树必须存在中文代码地图、capability-family 主骨架；仓库不得重新出现项目级 .lfaa。
 * 不负责：直接解析 ZIP；正式打包仍必须执行 ZIP round-trip 再在解压根运行 workspace-preflight。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const required = [
  "docs/项目结构与代码地图.md",
  "packages/core/agent-runtime/package.json",
  "packages/client/web/package.json",
  "packages/bundle/web-app/package.json",
  "packages/util/home-paths/package.json",
  "native/secret-store/Cargo.toml",
];

function walk(relative = "") {
  const absolute = path.join(root, relative);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git", "target", "dist"].includes(entry.name)) return [];
    const next = path.join(relative, entry.name);
    return entry.isDirectory() ? [next, ...walk(next)] : [next];
  });
}

test("release-critical Unicode and Harness paths exist exactly", () => {
  for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
  assert.equal(fs.existsSync(path.join(root, ".lfaa")), false, "repository-local .lfaa must stay removed");
});

test("repository paths contain no known mojibake markers", () => {
  const suspicious = walk().filter((name) => /(?:�|Θí╣|τ¢«|τ╗ô|µ₧ä|Σ╕Ä|σ£░|σ¢╛)/u.test(name));
  assert.deepEqual(suspicious, []);
});
