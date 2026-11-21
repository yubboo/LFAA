// 验证通知策略：轮次完成档位与不支持 Notification API 时的安全回退。
import assert from "node:assert/strict";
import test from "node:test";
import { notificationPermission, shouldNotifyTurn, showDesktopNotification } from "../client/notifications";
import { BUILTIN_NOTIFICATION_SOUNDS, isBuiltinSoundId, playNotificationSound } from "../client/notification-sounds";

test("轮次完成通知按档位判断：关闭、始终、仅未聚焦", () => {
  const original = (globalThis as { document?: unknown }).document;
  try {
    (globalThis as { document?: unknown }).document = { hidden: false, hasFocus: () => true };
    assert.equal(shouldNotifyTurn("off"), false);
    assert.equal(shouldNotifyTurn("always"), true);
    assert.equal(shouldNotifyTurn("unfocused"), false);

    (globalThis as { document?: unknown }).document = { hidden: false, hasFocus: () => false };
    assert.equal(shouldNotifyTurn("unfocused"), true);

    (globalThis as { document?: unknown }).document = { hidden: true, hasFocus: () => true };
    assert.equal(shouldNotifyTurn("unfocused"), true);
  } finally {
    (globalThis as { document?: unknown }).document = original;
  }
});

test("无系统通知支持时权限为 unsupported 且不抛错", () => {
  assert.equal(notificationPermission(), "unsupported");
  assert.equal(showDesktopNotification({ title: "t", body: "b" }), false);
});

test("内置提示音提供多款可选音色，静音与未知值安全忽略", async () => {
  assert.ok(BUILTIN_NOTIFICATION_SOUNDS.length >= 5);
  assert.equal(new Set(BUILTIN_NOTIFICATION_SOUNDS.map((item) => item.id)).size, BUILTIN_NOTIFICATION_SOUNDS.length);
  assert.equal(isBuiltinSoundId("bell"), true);
  assert.equal(isBuiltinSoundId("custom:unknown"), false);
  await playNotificationSound("mute");
  await playNotificationSound("custom:00000000-0000-0000-0000-000000000000");
});