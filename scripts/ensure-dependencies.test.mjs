// 依赖预检脚本的回归测试：覆盖 Windows 换行与 pnpm 规范化副本的兼容性。
import assert from "node:assert/strict";
import test from "node:test";
import { lockfilesMatch } from "./ensure-dependencies.mjs";

// 比较仓库 CRLF lockfile 与 pnpm 写入 LF 副本时应视为内容一致。
test("lockfile comparison ignores CRLF versus LF line endings", () => {
  assert.equal(lockfilesMatch("lockfileVersion: '9.0'\r\nimporters:\r\n", "lockfileVersion: '9.0'\nimporters:\n"), true);
});

// 规范化换行不应掩盖实际依赖清单变化。
test("lockfile comparison still detects content changes", () => {
  assert.equal(lockfilesMatch("importers:\r\n", "packages:\n"), false);
});
