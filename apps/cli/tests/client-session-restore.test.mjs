/**
 * 功能：回归验证浏览器端登录状态恢复顺序。
 * 作用：确保有效会话不等待初始化状态接口，且未登录与服务端错误仍走正确分支。
 * 关联文件：packages/client/ui-renderer/src/session-bootstrap.ts、App.tsx。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveSessionBootstrap } from "../../../packages/client/ui-renderer/src/session-bootstrap.ts";

test("有效会话只验证身份，不读取首次设置状态", async () => {
  const calls = [];
  const user = { id: "user-1" };
  const result = await resolveSessionBootstrap(
    async () => { calls.push("me"); return { user }; },
    async () => { calls.push("setup-status"); return { requiresSetup: false }; },
    (error) => error?.status === 401
  );

  assert.deepEqual(result, { kind: "authenticated", user });
  assert.deepEqual(calls, ["me"]);
});

test("只有明确未登录时才读取首次设置状态", async () => {
  const calls = [];
  const unauthorized = Object.assign(new Error("未登录"), { status: 401 });
  const result = await resolveSessionBootstrap(
    async () => { calls.push("me"); throw unauthorized; },
    async () => { calls.push("setup-status"); return { requiresSetup: true }; },
    (error) => error?.status === 401
  );

  assert.deepEqual(result, { kind: "anonymous", requiresSetup: true });
  assert.deepEqual(calls, ["me", "setup-status"]);
});

test("身份检查的暂时错误直接保留，不伪装成未登录", async () => {
  const calls = [];
  const unavailable = Object.assign(new Error("控制端暂不可用"), { status: 503 });
  await assert.rejects(
    resolveSessionBootstrap(
      async () => { calls.push("me"); throw unavailable; },
      async () => { calls.push("setup-status"); return { requiresSetup: false }; },
      (error) => error?.status === 401
    ),
    unavailable
  );
  assert.deepEqual(calls, ["me"]);
});
