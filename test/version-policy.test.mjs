/**
 * 文件：version-policy.test.mjs
 * 作用：锁定 LFAA 每一版本位 0-99、满 99 自动向前一位进位的开发规范。
 * 负责：验证合法版本、非法 0.0.100、patch/minor 进位。
 * 不负责：修改发布元数据或生成 ZIP。
 * 状态归属：无状态。
 * 对外接口：Node test runner。
 * 关联文件：scripts/version-policy.mjs、scripts/release-consistency-check.mjs。
 * 修改注意事项：版本规范变更必须先更新 DEVELOPMENT.md / docs/RELEASES.md，再同步本测试。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nextLfaaVersion, validateLfaaVersion } from "../scripts/version-policy.mjs";

test("LFAA version segments are limited to 0-99", () => {
  assert.deepEqual(validateLfaaVersion("0.1.0"), { major: 0, minor: 1, patch: 0, value: "0.1.0" });
  assert.throws(() => validateLfaaVersion("0.0.100"), /0-99/);
  assert.throws(() => validateLfaaVersion("0.100.0"), /0-99/);
});

test("patch 99 carries into the minor segment", () => {
  assert.equal(nextLfaaVersion("0.0.98"), "0.0.99");
  assert.equal(nextLfaaVersion("0.0.99"), "0.1.0");
  assert.equal(nextLfaaVersion("0.1.0"), "0.1.1");
});

test("minor 99 plus patch 99 carries into the major segment", () => {
  assert.equal(nextLfaaVersion("0.99.99"), "1.0.0");
});
