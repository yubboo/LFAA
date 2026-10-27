/**
 * 功能：验证登录页未认证外观缓存只接受安全的 Appearance 白名单字段。
 * 作用：覆盖服务器确认值写入、系统主题解析、内置背景限制与损坏缓存回退。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_USER_SETTINGS } from "../../../packages/util/values/src/settings-contract.ts";

const appearanceModule = await import("../../../packages/client/ui-theme/src/login-appearance.ts");
const areaEffectsModule = await import("../../../packages/client/ui-theme/src/appearance-area-effects.ts");

test("登录壁纸遮罩保留 Appearance 联动但不过度冲淡图片", () => {
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(65, "light"), "rgba(255, 255, 255, 0.26)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(65, "dark"), "rgba(24, 24, 24, 0.26)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(0, "light"), "rgba(255, 255, 255, 0)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(0, "dark"), "rgba(24, 24, 24, 0)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(75, "light"), "rgba(255, 255, 255, 0.3)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(75, "dark"), "rgba(24, 24, 24, 0.3)");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(65, "light", 11), "rgba(255, 255, 255, 0.11)", "显式登录页覆盖直接按区域百分比呈现");
  assert.equal(appearanceModule.resolveLoginBackgroundOverlayColor(65, "light", null), "rgba(255, 255, 255, 0.26)", "清除覆盖后回到现有全局 40% 映射");
});

test("Workbench 区域效果只覆盖本区域并逐字段继承全局值", () => {
  const appearance = structuredClone(DEFAULT_USER_SETTINGS.appearance);
  appearance.overlay = 42;
  appearance.blur = 9;
  appearance.areaEffects.settings.overlay = 18;
  assert.deepEqual(areaEffectsModule.resolveWorkbenchAreaEffects(appearance, "settings"), { overlay: 18, blur: 9 });
  assert.deepEqual(areaEffectsModule.resolveWorkbenchAreaEffects(appearance, "writing"), { overlay: 42, blur: 9 });
  assert.deepEqual(DEFAULT_USER_SETTINGS.appearance.areaEffects.settings, { overlay: null, blur: null }, "新区域设置默认继承且不改变全局默认");
});

function withLocalStorage(run) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    } }
  });
  try {
    return run(values);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
}

test("登录外观缓存仅保存已确认设置中的白名单视觉值", () => withLocalStorage((values) => {
  const appearance = structuredClone(DEFAULT_USER_SETTINGS.appearance);
  appearance.theme = "system";
  appearance.accentColor = "#1976d2";
  appearance.backgrounds.login = "service-room";
  appearance.overlay = 17;
  appearance.areaEffects.login.overlay = 12;
  appearance.advanced.interfaceFontSize = 19;
  appearance.advanced.reducedMotion = "on";
  appearance.advanced.separateModes = true;
  appearance.advanced.modeStyles.dark.accentColor = "#8e44ad";
  appearance.advanced.modeStyles.dark.fonts.interface = "serif";
  appearance.advanced.contrast = 88;

  appearanceModule.cacheLoginAppearance("admin", appearance);
  const cached = appearanceModule.getCachedLoginAppearance("admin");
  const resolved = appearanceModule.resolveLoginAppearance(cached, true);
  const serialized = values.get("lfaa:login-appearance.v1");

  assert.equal(cached.theme, "system");
  assert.equal(resolved.theme, "dark");
  assert.equal(resolved.accentColor, "#8e44ad");
  assert.equal(resolved.loginBackgroundId, "service-room");
  assert.equal(resolved.overlay, 17);
  assert.equal(resolved.loginOverlayOverride, 12);
  assert.equal(resolved.interfaceFontSize, 19);
  assert.equal(resolved.reducedMotion, "on");
  assert.equal(resolved.fonts.interface, "serif");
  assert.equal(resolved.contrast, 88);
  assert.equal(appearanceModule.resolveLoginBackgroundImage(resolved.loginBackgroundId), "/backgrounds/service-room.jpg");
  assert.equal(values.get("lfaa:login-background"), "service-room");
  assert.doesNotMatch(serialized, /password|token|userId|upload|plugin/iu);
  const otherAccount = appearanceModule.getCachedLoginAppearance("another-user");
  assert.equal(otherAccount.theme, DEFAULT_USER_SETTINGS.appearance.theme);
  assert.equal(otherAccount.accentColor, DEFAULT_USER_SETTINGS.appearance.accentColor);
  assert.equal(otherAccount.loginBackgroundId, "service-room");
}));

test("登录外观缓存拒绝账户私有图片并在值损坏时回到产品默认值", () => withLocalStorage((values) => {
  values.set("lfaa:login-background", "writing-desk");
  values.set("lfaa:login-appearance.v1", JSON.stringify({
    theme: "unexpected",
    accentColor: "url(javascript:alert(1))",
    backgrounds: { login: "user-private-upload" },
    overlay: 999,
    advanced: { interfaceFontSize: 400, contrast: -1, separateModes: "yes" }
  }));

  const cached = appearanceModule.getCachedLoginAppearance();

  assert.equal(cached.theme, DEFAULT_USER_SETTINGS.appearance.theme);
  assert.equal(cached.accentColor, DEFAULT_USER_SETTINGS.appearance.accentColor);
  assert.equal(cached.loginBackgroundId, "writing-desk");
  assert.equal(cached.overlay, DEFAULT_USER_SETTINGS.appearance.overlay);
  assert.equal(cached.advanced.interfaceFontSize, DEFAULT_USER_SETTINGS.appearance.advanced.interfaceFontSize);
  assert.equal(cached.advanced.reducedMotion, DEFAULT_USER_SETTINGS.appearance.advanced.reducedMotion);
  assert.equal(cached.advanced.contrast, DEFAULT_USER_SETTINGS.appearance.advanced.contrast);
  assert.equal(cached.advanced.separateModes, DEFAULT_USER_SETTINGS.appearance.advanced.separateModes);
  assert.equal(appearanceModule.resolveLoginBackgroundImage("user-private-upload"), null, "invalid cached backgrounds fall back to the theme canvas");
}));
