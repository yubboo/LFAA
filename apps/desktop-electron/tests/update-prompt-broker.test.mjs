import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDesktopUpdatePromptBroker } from "../src/update-prompt-broker.mjs";

function createFakeTimers() {
  const timers = new Map();
  let sequence = 0;
  return {
    setTimeoutFn(callback) {
      const id = ++sequence;
      timers.set(id, callback);
      return id;
    },
    clearTimeoutFn(id) {
      timers.delete(id);
    },
    fireAll() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
    get size() { return timers.size; }
  };
}

test("渲染端就绪前保留提示，收到有效下载决策后清理请求和计时器", async () => {
  const timers = createFakeTimers();
  const broker = createDesktopUpdatePromptBroker({ setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });
  const result = broker.request({ kind: "download", version: "0.0.2", mandatory: false });
  assert.equal(broker.pendingCount, 1);
  assert.equal(timers.size, 1);

  let received;
  broker.setRendererReady(7, prompt => { received = prompt; });
  assert.equal(received.version, "0.0.2");
  assert.equal(broker.respond(received.requestId, "accept"), true);
  assert.equal(await result, "accept");
  assert.equal(broker.pendingCount, 0);
  assert.equal(timers.size, 0);
});

test("强制更新不能延后，未知请求和无效动作会被拒绝", async () => {
  const broker = createDesktopUpdatePromptBroker();
  let received;
  broker.setRendererReady(1, prompt => { received = prompt; });
  const result = broker.request({ kind: "download", version: "0.2.0", mandatory: true });
  assert.equal(broker.respond("unknown", "accept"), false);
  assert.equal(broker.respond(received.requestId, "defer"), false);
  assert.equal(broker.pendingCount, 1);
  assert.equal(broker.respond(received.requestId, "accept"), true);
  assert.equal(await result, "accept");
});

test("渲染端重载后重发未决提示，窗口关闭或超时均安全延后", async () => {
  const timers = createFakeTimers();
  const broker = createDesktopUpdatePromptBroker({ setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });
  let firstDelivery;
  let secondDelivery;
  broker.setRendererReady(10, prompt => { firstDelivery = prompt; });
  const result = broker.request({ kind: "install", version: "0.0.2", mandatory: false });
  broker.setRendererNotReady(10);
  broker.setRendererReady(11, prompt => { secondDelivery = prompt; });
  assert.equal(secondDelivery.requestId, firstDelivery.requestId);
  broker.cancelAll();
  assert.equal(await result, "later");
  assert.equal(timers.size, 0);

  const timeoutResult = broker.request({ kind: "download", version: "0.0.2", mandatory: false });
  timers.fireAll();
  assert.equal(await timeoutResult, "defer");
  assert.equal(broker.pendingCount, 0);
});

test("强制安装不能选择稍后，错误通知只允许确认", async () => {
  const broker = createDesktopUpdatePromptBroker();
  let received;
  broker.setRendererReady(2, prompt => { received = prompt; });
  const installResult = broker.request({ kind: "install", version: "0.2.0", mandatory: true });
  assert.equal(broker.respond(received.requestId, "later"), false);
  assert.equal(broker.respond(received.requestId, "install"), true);
  assert.equal(await installResult, "install");

  const noticeResult = broker.request({ kind: "notice", title: "更新失败", message: "无法下载" });
  assert.equal(broker.respond(received.requestId, "accept"), false);
  assert.equal(broker.respond(received.requestId, "dismiss"), true);
  assert.equal(await noticeResult, "dismiss");
});

test("同一时刻只保留一个更新提示，重复请求安全延后且不新增计时器", async () => {
  const timers = createFakeTimers();
  const broker = createDesktopUpdatePromptBroker({ setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });
  let received;
  broker.setRendererReady(3, prompt => { received = prompt; });
  const activeResult = broker.request({ kind: "download", version: "0.0.2", mandatory: false });
  assert.equal(await broker.request({ kind: "install", version: "0.0.2", mandatory: false }), "later");
  assert.equal(broker.pendingCount, 1);
  assert.equal(timers.size, 1);
  broker.respond(received.requestId, "defer");
  assert.equal(await activeResult, "defer");
  assert.equal(broker.pendingCount, 0);
  assert.equal(timers.size, 0);
});

test("桌面更新决策和错误提示不再调用 Windows 原生消息框", () => {
  const mainProcess = readFileSync(new URL("../src/main.mjs", import.meta.url), "utf8");
  const updateFlowStart = mainProcess.indexOf("async function promptToDownloadUpdate");
  const updateFlowEnd = mainProcess.indexOf("function getDesktopUpdateRuntimeInfo", updateFlowStart);
  assert.notEqual(updateFlowStart, -1);
  assert.notEqual(updateFlowEnd, -1);
  const updateFlowSource = mainProcess.slice(updateFlowStart, updateFlowEnd);
  assert.match(updateFlowSource, /desktopUpdatePromptBroker\.request/u);
  assert.doesNotMatch(updateFlowSource, /showMessageBox|showErrorBox/u);

  const renderer = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");
  assert.match(renderer, /className="lfaa-update-modal"/u);
  assert.match(renderer, /respondToDesktopUpdatePrompt/u);
  assert.doesNotMatch(renderer, /playNotificationSound/u);
});

test("更新检查错误在主进程日志与界面前经过脱敏", () => {
  const mainProcess = readFileSync(new URL("../src/main.mjs", import.meta.url), "utf8");
  const errorListenerStart = mainProcess.indexOf('autoUpdater.on("error"');
  const errorListenerEnd = mainProcess.indexOf("\n  });", errorListenerStart);
  assert.notEqual(errorListenerStart, -1);
  assert.notEqual(errorListenerEnd, -1);
  const errorListener = mainProcess.slice(errorListenerStart, errorListenerEnd);
  assert.match(errorListener, /getDesktopUpdateErrorMessage\(error/u);
  assert.doesNotMatch(errorListener, /error\.message|String\(error\)/u);

  const flow = readFileSync(new URL("../src/update-flow.mjs", import.meta.url), "utf8");
  assert.match(flow, /getDesktopUpdateErrorMessage\(error, phase\)/u);
  assert.match(flow, /getDesktopUpdateErrorMessage\(error, "check"\)/u);
});
