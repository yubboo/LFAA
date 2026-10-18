/** 功能：回归客户端自动通知总开关。作用：关闭时无 Toast 回调、浏览器系统通知或提示音副作用。 */
import test from "node:test";
import assert from "node:assert/strict";

test("关闭通知总开关时完成和操作提醒均无弹出副作用", async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  let audioContextLookups = 0;
  let notificationLookups = 0;
  globalThis.window = {
    isSecureContext: true,
    get AudioContext() { audioContextLookups += 1; return class AudioContext {}; },
    get Notification() { notificationLookups += 1; return class Notification {}; }
  };
  globalThis.document = { visibilityState: "hidden", hasFocus: () => false };
  try {
    const { notifyAiWorkAction, notifyAiWorkCompletion } = await import("../../../packages/client/resources/src/notification-runtime.ts");
    const notification = { appId: "workspace", applicationName: "小鱼智能体", sessionId: "session-a", kind: "issue", title: "会话遇到问题", body: "请查看详情。" };
    let callbackCount = 0;
    const onNotification = () => { callbackCount += 1; };
    const actionInput = { notification, enabled: false, sound: "default", onNotification };
    notifyAiWorkAction(actionInput);
    const completionNotified = notifyAiWorkCompletion({ notification: { ...notification, kind: "complete" }, enabled: false, policy: "always", sound: "default", onNotification });
    assert.equal(completionNotified, false);
    assert.equal(callbackCount, 0, "关闭时不产生通知中心/Toast 回调");
    assert.equal(audioContextLookups, 0, "关闭时不初始化声音");
    assert.equal(notificationLookups, 0, "关闭时不检查或创建浏览器系统通知");
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
