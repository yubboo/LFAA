// 验证主题包 Host/契约预设导出及 Client 插件在工作台注册与卸载清理。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { DEFAULT_APPEARANCE_CONFIG, THEME_PRESETS } from "../src/index";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

test("THEME_PRESETS 提供默认参考配色且不依赖 DOM", () => {
  assert.equal(DEFAULT_APPEARANCE_CONFIG.preset, "liquidGlass");
  assert.equal(THEME_PRESETS.liquidGlass.glassEnabled, true);
  assert.equal(THEME_PRESETS.liquidGlass.light.background, "#FFFFFF");
  assert.equal(THEME_PRESETS.liquidGlass.light.foreground, "#171717");
  assert.equal(THEME_PRESETS.liquidGlass.dark.background, "#181818");
  assert.equal(THEME_PRESETS.liquidGlass.dark.foreground, "#F3F3F3");
});

test("AppearanceStore 自动迁移旧版默认背景色并保留用户自定义配色", async () => {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  store.set(
    "lfaa:appearance-config-v1",
    JSON.stringify({
      ...DEFAULT_APPEARANCE_CONFIG,
      light: { ...DEFAULT_APPEARANCE_CONFIG.light, background: "#EEF2EE", foreground: "#1E221F" },
      dark: { ...DEFAULT_APPEARANCE_CONFIG.dark, background: "#121519", foreground: "#F2F4F2" },
    }),
  );
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  try {
    const { AppearanceStore } = await import("../client/appearance-store");
    const migrated = new AppearanceStore().getSnapshot();
    assert.equal(migrated.config.light.background, "#FFFFFF");
    assert.equal(migrated.config.light.foreground, "#171717");
    assert.equal(migrated.config.dark.background, "#181818");
    assert.equal(migrated.config.dark.foreground, "#F3F3F3");

    // 用户显式设置的自定义背景色不应被覆盖
    store.set(
      "lfaa:appearance-config-v1",
      JSON.stringify({
        ...DEFAULT_APPEARANCE_CONFIG,
        dark: { ...DEFAULT_APPEARANCE_CONFIG.dark, background: "#101820" },
      }),
    );
    const custom = new AppearanceStore().getSnapshot();
    assert.equal(custom.config.dark.background, "#101820");
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  }
});

test("Client themeClientPlugin 向 workbench 注册 appearance 视图并在 dispose 时清理", async () => {
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { themeClientPlugin } = await import("../client/index");

  const ctx = new Context();
  const service = new WorkbenchClientService(ctx);

  const fiber = ctx.plugin(themeClientPlugin);
  await fiber;

  assert.ok(service.getSnapshot().views.some((v) => v.id === "appearance"), "应注册 appearance 视图");
  assert.ok(service.getSnapshot().accountActions.some((f) => f.id === "theme-mode-switch"), "应注册用户菜单头部快捷切换入口");

  await fiber.dispose();
  assert.equal(service.getSnapshot().views.some((v) => v.id === "appearance"), false);
  assert.equal(service.getSnapshot().accountActions.some((f) => f.id === "theme-mode-switch"), false);
});
