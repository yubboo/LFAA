import test from "node:test";
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import * as userApproval from "lfaa-user-approval/src/index.js";

test("一次性审批通知按账户隔离并在结束时清理等待者", async () => {
  const ctx = new Context();
  const fiber = await ctx.plugin(userApproval);
  const approvals = ctx.lfaaUserApproval;
  const approvalId = "a67d91ab-b7c2-4ad9-9c1d-f5878d229454";
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const first = approvals.watch({ userId: "account-a", approvalId, signal: firstAbort.signal, timeoutMs: 1_000 });
  const second = approvals.watch({ userId: "account-b", approvalId, signal: secondAbort.signal, timeoutMs: 1_000 });
  assert.throws(() => approvals.watch({ userId: "account-a", approvalId, signal: new AbortController().signal, timeoutMs: 1_000 }), /等待者/u);

  approvals.notify("account-a", approvalId);
  assert.equal(await first.result, "changed");
  secondAbort.abort();
  assert.equal(await second.result, "aborted");

  const timed = approvals.watch({ userId: "account-c", approvalId, signal: new AbortController().signal, timeoutMs: 5 });
  assert.equal(await timed.result, "timeout");

  const closing = approvals.watch({ userId: "account-d", approvalId, signal: new AbortController().signal, timeoutMs: 1_000 });
  await fiber.dispose();
  assert.equal(await closing.result, "closed");
  assert.equal((await approvals.watch({ userId: "account-e", approvalId, signal: new AbortController().signal, timeoutMs: 1_000 }).result), "closed");
});
