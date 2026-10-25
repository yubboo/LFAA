import test from "node:test";
import assert from "node:assert/strict";
import { bindExternalChildCancellation } from "lfaa-subagent/src/out-of-process.js";
import { SubagentManager } from "lfaa-subagent/src/manager.js";

function childProcess(pid = 4172) {
  return {
    pid,
    exitCode: null,
    killed: false,
    kill() { this.killed = true; this.exitCode = 1; return true; }
  };
}

const stopped = detail => ({ stopped: true, detail });

test("已取消信号在子进程监听器注册前到达时仍委托进程树 Owner", async () => {
  const child = childProcess();
  const controller = new AbortController();
  controller.abort();
  const calls = [];
  const cancellation = bindExternalChildCancellation(child, controller.signal, async pid => {
    calls.push(pid);
    child.exitCode = 0;
    return stopped("已停止进程树。");
  });

  assert.deepEqual(calls, [4172]);
  assert.deepEqual(await cancellation.wait(), stopped("已停止进程树。"));
  assert.equal(child.killed, false);
  cancellation.dispose();
});

test("运行中取消等待进程树 Owner 完成，再结束直接子进程", async () => {
  const child = childProcess();
  const controller = new AbortController();
  let releaseOwner;
  const ownerFinished = new Promise(resolve => { releaseOwner = resolve; });
  const cancellation = bindExternalChildCancellation(child, controller.signal, async pid => {
    assert.equal(pid, 4172);
    await ownerFinished;
    child.exitCode = 0;
    return stopped("已停止进程树。");
  });

  controller.abort();
  let settled = false;
  void cancellation.wait().then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  releaseOwner();
  assert.deepEqual(await cancellation.wait(), stopped("已停止进程树。"));
  assert.equal(child.killed, false);
  cancellation.dispose();
});

test("进程树 Owner 报告失败时退回停止直接子进程并保留诊断", async () => {
  const child = childProcess();
  const controller = new AbortController();
  const cancellation = bindExternalChildCancellation(child, controller.signal, async () => ({ stopped: false, detail: "权限不足。" }));

  controller.abort();
  assert.deepEqual(await cancellation.wait(), { stopped: false, detail: "权限不足。" });
  assert.equal(child.killed, true);
  cancellation.dispose();
});

test("SubagentManager 将唯一进程树 Owner 传给外部驱动", async () => {
  const manager = new SubagentManager(async pid => ({ stopped: true, detail: String(pid) }));
  let terminateProcessTree;
  manager.registerDriver({
    name: "fixture",
    displayName: "隔离驱动",
    async run(_task, context) {
      terminateProcessTree = context.terminateProcessTree;
      return { runId: "", stopReason: "completed", answer: "完成" };
    }
  });
  const handle = manager.start(
    { driver: "fixture", description: "验证 Process Owner", prompt: "fixture", appId: "workspace" },
    { userId: "isolated-user", userRole: "admin", signal: new AbortController().signal, onProgress() {} }
  );

  assert.equal((await handle.done).stopReason, "completed");
  assert.equal(typeof terminateProcessTree, "function");
  assert.deepEqual(await terminateProcessTree(4172), { stopped: true, detail: "4172" });
  manager.close();
});
