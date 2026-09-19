/**
 * 文件：release-gates.test.mjs
 * 作用：验证快速、完整、正式发布三层检查不会再次绑死到 Windows 菜单编号。
 * 负责：检查 package scripts 分层语义和 Setup 菜单 Adapter 契约。
 * 不负责：执行真实 pnpm install、Rust 编译、Windows 交互或用户验收。
 * 状态归属：无运行时状态；直接读取当前工作树。
 * 对外接口：Node test runner。
 * 关联文件：package.json、scripts/windows/lfaa-setup.ps1、scripts/release-gates-check.mjs。
 * 修改注意事项：未来 CLI/GUI 增加入口时应复用同一 quality/release 命令，不得把菜单编号升级为 API。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = pkg.scripts ?? {};
const setup = fs.readFileSync("scripts/windows/lfaa-setup.ps1", "utf8");

test("quality:quick is lightweight and does not install/build/require Rust", () => {
  const value = String(scripts["quality:quick"] ?? "");
  for (const token of ["governance:check", "typecheck", "test"]) assert.match(value, new RegExp(token.replace(":", "\\:")));
  assert.doesNotMatch(value, /\binstall\b/);
  assert.doesNotMatch(value, /\bbuild\b/);
  assert.doesNotMatch(value, /release:rust/);
});

test("quality:full adds build but does not install or require Rust", () => {
  const value = String(scripts["quality:full"] ?? "");
  assert.match(value, /quality:quick/);
  assert.match(value, /build/);
  assert.doesNotMatch(value, /\binstall\b/);
  assert.doesNotMatch(value, /release:rust/);
});

test("release:full owns environment + frozen install + release verification", () => {
  const full = String(scripts["release:full"] ?? "");
  const verify = String(scripts["release:verify"] ?? "");
  assert.match(full, /release:environment/);
  assert.match(full, /install --frozen-lockfile/);
  assert.match(full, /release:verify/);
  assert.match(verify, /quality:full/);
  assert.match(verify, /release:rust/);
});

test("Windows Setup treats menu 1 as optional dependency preparation", () => {
  assert.match(setup, /【1】" "【按需依赖】/);
  assert.match(setup, /不是每次开发都必须执行/);
});

test("Windows Setup menu 10 is a layered check center", () => {
  assert.match(setup, /【10】" "【检查中心】/);
  for (const token of ["【快速检查】", "【完整检查】", "【正式发布】", 'Invoke-PnpmScript "quality:quick"', 'Invoke-PnpmScript "quality:full"', 'Invoke-PnpmScript "release:full"']) {
    assert.ok(setup.includes(token), `missing Setup token: ${token}`);
  }
});
