// 桌面端主题桥接回归测试：验证 AppearanceStore 优先从桌面持久化桥恢复主题，并在切换明暗时实时同步给桌面主进程。
// 关联：packages/ui/theme/client/appearance-store.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppearanceStore } from "../client/appearance-store";

describe("AppearanceStore desktop theme bridge", () => {
  it("restores saved light mode from desktop bridge and syncs subsequent changes", () => {
    const synced: Array<{ mode: string; resolvedScheme: string; configJson: string }> = [];
    const savedJson = JSON.stringify({ mode: "light" });
    const fakeDataset: Record<string, string> = {};
    const fakeStyle = new Map<string, string>();
    const fakeStorage = new Map<string, string>();

    const prevWindow = globalThis.window;
    const prevDocument = globalThis.document;
    try {
      (globalThis as unknown as { document: unknown }).document = {
        documentElement: {
          dataset: fakeDataset,
          style: { setProperty: (k: string, v: string) => fakeStyle.set(k, v) },
        },
      };
      (globalThis as unknown as { window: unknown }).window = {
        matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
        localStorage: {
          getItem: (k: string) => fakeStorage.get(k) ?? null,
          setItem: (k: string, v: string) => fakeStorage.set(k, v),
        },
        __LFAA_DESKTOP_THEME__: {
          readConfig: () => savedJson,
          syncTheme: (payload: { mode: string; resolvedScheme: string; configJson: string }) => {
            synced.push(payload);
          },
        },
      };

      const store = new AppearanceStore();
      assert.equal(store.getSnapshot().config.mode, "light");
      assert.equal(store.getSnapshot().resolvedScheme, "light");

      store.mount();
      assert.equal(synced.length, 1);
      assert.equal(synced[0]?.mode, "light");
      assert.equal(synced[0]?.resolvedScheme, "light");

      store.setMode("dark");
      assert.equal(synced.length, 2);
      assert.equal(synced[1]?.mode, "dark");
      assert.equal(synced[1]?.resolvedScheme, "dark");
      assert.equal(JSON.parse(synced[1]!.configJson).mode, "dark");

      store.dispose();
    } finally {
      (globalThis as unknown as { window: unknown }).window = prevWindow;
      (globalThis as unknown as { document: unknown }).document = prevDocument;
    }
  });
});
