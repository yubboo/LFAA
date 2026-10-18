/**
 * 功能：回归验证刷新前的浅色/深色主题提示。
 * 作用：保证标签页提示只接受现有主题枚举、system 遵循系统主题且存储失败不阻断权威设置应用。
 * 关联文件：packages/client/ui-theme/src/appearance-theme-bootstrap.ts、apps/web/index.html、ui-layout/src/Workbench.tsx。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY,
  APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY,
  applyAppearanceThemeBootstrap,
  cacheAppearanceCanvasBootstrap,
  clearAppearanceThemeBootstrap,
  readAppearanceThemeBootstrap,
  resolveAppearanceThemeBootstrap
} from "../../../packages/client/ui-theme/src/appearance-theme-bootstrap.ts";

function createStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY, initial);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test("只接受已有的 light、dark、system 主题值", () => {
  for (const value of ["light", "dark", "system"]) {
    assert.equal(readAppearanceThemeBootstrap(createStorage(value)), value);
  }
  for (const value of [null, "auto", "invalid"]) {
    assert.equal(readAppearanceThemeBootstrap(createStorage(value)), null);
  }
});

test("system 主题按当前系统明暗解析", () => {
  assert.equal(resolveAppearanceThemeBootstrap("system", true), "dark");
  assert.equal(resolveAppearanceThemeBootstrap("system", false), "light");
  assert.equal(resolveAppearanceThemeBootstrap("dark", false), "dark");
  assert.equal(resolveAppearanceThemeBootstrap("light", true), "light");
});

test("刷新画布缓存把安全壁纸与遮罩透明度一起保存", () => {
  const storage = createStorage();
  storage.setItem("lfaa.appearance-canvas-bootstrap.v1", JSON.stringify({ route: "/settings", background: "/images/minecraft/cherry-blossom-village.png" }));
  cacheAppearanceCanvasBootstrap("/settings", "/images/minecraft/cherry-blossom-village.png", 65, storage);
  assert.equal(storage.getItem("lfaa.appearance-canvas-bootstrap.v1"), null);
  assert.deepEqual(JSON.parse(storage.getItem(APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY)), {
    route: "/settings",
    background: "/images/minecraft/cherry-blossom-village.png",
    overlay: 65
  });

  cacheAppearanceCanvasBootstrap("/settings", "/private/custom.png", 65, storage);
  assert.deepEqual(JSON.parse(storage.getItem(APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY)), {
    route: "/settings",
    background: null,
    overlay: 65
  });
});

test("刷新画布缓存拒绝不支持的遮罩值", () => {
  const storage = createStorage();
  cacheAppearanceCanvasBootstrap("/settings", "/images/minecraft/cherry-blossom-village.png", 76, storage);
  assert.equal(storage.getItem(APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY), null);
});

test("HTML 首帧按缓存主题与遮罩绘制壁纸并拒绝其他路由", () => {
  const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
  const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/u)?.[1];
  assert.ok(inlineScript, "Web 入口包含同步首帧脚本");

  for (const [preference, systemDark, expectedTheme, expectedMask] of [
    ["light", true, "light", "rgba(255, 255, 255, 0.65)"],
    ["dark", false, "dark", "rgba(24, 24, 24, 0.65)"],
    ["system", true, "dark", "rgba(24, 24, 24, 0.65)"],
    ["system", false, "light", "rgba(255, 255, 255, 0.65)"]
  ]) {
    const values = new Map([
      [APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY, preference],
      [APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY, JSON.stringify({ route: "/settings", background: "/images/minecraft/cherry-blossom-village.png", overlay: 65 })]
    ]);
    const root = { dataset: {}, style: { setProperty(name, value) { this[name] = value; } } };
    const themeMeta = { setAttribute(name, value) { this[name] = value; } };
    runInNewContext(inlineScript, {
      window: { sessionStorage: { getItem: key => values.get(key) ?? null }, matchMedia: () => ({ matches: systemDark }), location: { pathname: "/settings" } },
      document: { documentElement: root, querySelector: () => themeMeta }
    });

    assert.equal(root.dataset.lfaaBootstrapTheme, expectedTheme);
    assert.equal(root.dataset.lfaaBootstrapCanvas, "true");
    assert.equal(root.style["--lfaa-bootstrap-canvas-image"], `linear-gradient(${expectedMask}, ${expectedMask}), url("/images/minecraft/cherry-blossom-village.png")`);
  }

  const values = new Map([[APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY, JSON.stringify({ route: "/work", background: "/images/minecraft/cherry-blossom-village.png", overlay: 65 })]]);
  const root = { dataset: {}, style: { setProperty() {} } };
  runInNewContext(inlineScript, {
    window: { sessionStorage: { getItem: key => values.get(key) ?? null }, matchMedia: () => ({ matches: false }), location: { pathname: "/settings" } },
    document: { documentElement: root, querySelector: () => null }
  });
  assert.equal(root.dataset.lfaaBootstrapCanvas, undefined);
});

test("应用设置主题时更新首帧提示与浏览器画布色", () => {
  const storage = createStorage();
  const root = { dataset: {}, style: { colorScheme: "" }, removeAttribute() { delete this.dataset.lfaaBootstrapTheme; } };
  const themeColorMeta = { content: "" };
  applyAppearanceThemeBootstrap("system", "dark", { storage, root, themeColorMeta });

  assert.equal(storage.getItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY), "system");
  assert.equal(root.dataset.lfaaBootstrapTheme, "dark");
  assert.equal(root.style.colorScheme, "dark");
  assert.equal(themeColorMeta.content, "#181818");

  clearAppearanceThemeBootstrap({ storage, root, themeColorMeta });
  assert.equal(storage.getItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY), null);
  assert.equal(storage.getItem(APPEARANCE_CANVAS_BOOTSTRAP_STORAGE_KEY), null);
  assert.equal(storage.getItem("lfaa.appearance-canvas-bootstrap.v1"), null);
  assert.equal(root.dataset.lfaaBootstrapTheme, undefined);
  assert.equal(root.style.colorScheme, "");
  assert.equal(themeColorMeta.content, "#f3f5f8");
});

test("标签页存储异常不会阻断当前主题应用", () => {
  const blockedStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); }
  };
  const root = { dataset: {}, style: { colorScheme: "" }, removeAttribute() { delete this.dataset.lfaaBootstrapTheme; } };
  assert.equal(readAppearanceThemeBootstrap(blockedStorage), null);
  assert.doesNotThrow(() => applyAppearanceThemeBootstrap("dark", "dark", { storage: blockedStorage, root }));
  assert.equal(root.dataset.lfaaBootstrapTheme, "dark");
  assert.doesNotThrow(() => clearAppearanceThemeBootstrap({ storage: blockedStorage, root }));
});
