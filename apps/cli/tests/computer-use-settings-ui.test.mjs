/** 功能：验证电脑操控设置页兼容缺失的旧账户设置字段，并将非布尔值按关闭处理。 */
import assert from "node:assert/strict";
import test from "node:test";
import { isComputerControlEnabled } from "../../../packages/client/ui-settings/src/computer-control-settings.ts";

test("电脑操控设置兼容旧版或不完整对象，并将非布尔 enabled 按关闭处理", () => {
  assert.equal(isComputerControlEnabled(undefined), false);
  assert.equal(isComputerControlEnabled(null), false);
  assert.equal(isComputerControlEnabled({}), false);
  assert.equal(isComputerControlEnabled({ computerControl: undefined }), false);
  assert.equal(isComputerControlEnabled({ computerControl: { enabled: "true" } }), false);
  assert.equal(isComputerControlEnabled({ computerControl: { enabled: false } }), false);
  assert.equal(isComputerControlEnabled({ computerControl: { enabled: true } }), true);
});
