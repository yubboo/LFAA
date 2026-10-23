import assert from "node:assert/strict";
import test from "node:test";
import { getControlPlaneStartupError } from "../src/control-plane-startup-error.mjs";

test("已有控制端持有数据锁时显示安全且可执行的提示", () => {
  const message = getControlPlaneStartupError("Error: 插件加载失败：storage-domain\n此数据目录已由另一个控制端使用");
  assert.match(message, /正常关闭/u);
  assert.match(message, /桌面端、Web 或 CLI/u);
  assert.match(message, /没有删除数据锁/u);
});

test("其他启动失败仍指向桌面日志", () => {
  assert.match(getControlPlaneStartupError("EADDRINUSE"), /请查看桌面日志/u);
  assert.match(getControlPlaneStartupError(""), /请查看桌面日志/u);
});
