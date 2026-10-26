/**
 * 功能：回归 AI Work 自动与手动恢复断开的 Agent Run。
 * 作用：保证空内容续接不受新消息输入守卫阻断，普通空消息仍无效。
 * 关联文件：packages/client/ui-chat/src/AiWorkChat.tsx、connection/src/api.ts。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");

test("自动和手动跟随用空正文续接同一个 Run，空的新消息仍被拦截", () => {
  assert.match(source, /if \(!typed && pendingAttachments\.length === 0 && !followRunId\) return;/u);
  assert.match(source, /void sendMessage\("", running\.id\)/u);
  assert.match(source, /void sendMessage\("", run\.id\)/u);
});
