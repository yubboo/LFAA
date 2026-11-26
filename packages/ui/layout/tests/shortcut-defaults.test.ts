// 默认快捷键表守护：键位不重复，且不落在浏览器 / 系统会截走的组合上（避免「设了没反应」）。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { DEFAULT_SHORTCUT_KEYS, defaultShortcutKeys, shortcutHint } = await import("../client/shortcut-defaults");

const entries = Object.entries(DEFAULT_SHORTCUT_KEYS);
/** 允许直接占用方向键的动作：三栏开合用方向直觉，浏览器不保留 Ctrl+方向键。 */
const DIRECTIONAL_IDS = new Set([
  "global.toggle-left-sidebar",
  "global.toggle-right-panel",
  "workbench.terminal",
]);

test("默认快捷键互不重复", () => {
  const seen = new Map();
  for (const [id, keys] of entries) {
    assert.equal(seen.has(keys), false, `${id} 与 ${seen.get(keys)} 撞键：${keys}`);
    seen.set(keys, id);
  }
});

test("默认快捷键避开浏览器与系统保留组合", () => {
  for (const [id, keys] of entries) {
    const parts = keys.split("+");
    assert.ok(parts.includes("Ctrl"), `${id} 缺少 Ctrl：${keys}`);
    if (DIRECTIONAL_IDS.has(id)) {
      // 方向键只允许裸 Ctrl：Ctrl+Alt+方向键会被显卡驱动当成屏幕旋转。
      assert.equal(parts.includes("Alt"), false, `${id} 不能带 Alt：${keys}`);
      assert.match(keys, /^Ctrl\+(Left|Right|Down|Up)$/u, `${id} 只能用一个方向键：${keys}`);
      continue;
    }
    assert.ok(parts.includes("Alt"), `${id} 缺少 Alt（会被浏览器截走）：${keys}`);
    // 非方向动作一律不许占用真方向键（PageUp/PageDown 不算），避免与光标移动语义打架。
    const arrows = ["Left", "Right", "Up", "Down"];
    assert.equal(parts.some((part) => arrows.includes(part)), false, `${id} 不该用方向键：${keys}`);
  }
});

test("三栏开合与终端用方向键直觉组合", () => {
  assert.equal(defaultShortcutKeys("global.toggle-left-sidebar"), "Ctrl+Left");
  assert.equal(defaultShortcutKeys("global.toggle-right-panel"), "Ctrl+Right");
  assert.equal(defaultShortcutKeys("workbench.terminal"), "Ctrl+Down");
});

test("关键动作落在约定的新默认键位上", () => {
  assert.equal(defaultShortcutKeys("global.search"), "Ctrl+Alt+K");
  assert.equal(defaultShortcutKeys("global.maximize-right-panel"), "Ctrl+Alt+M");
  assert.equal(defaultShortcutKeys("session.abort"), "Ctrl+Alt+X");
  assert.equal(defaultShortcutKeys("composer.reasoning"), "Ctrl+Alt+R");
  assert.equal(defaultShortcutKeys("workbench.new-tab"), "Ctrl+Alt+B");
  assert.equal(defaultShortcutKeys("workbench.next-tab"), "Ctrl+Alt+PageDown");
});

test("提示文本按展示规则还原符号，清空绑定后不显示键位", () => {
  assert.equal(shortcutHint("navigation.settings"), "Ctrl+Alt+,");
  assert.equal(shortcutHint("navigation.shortcuts"), "Ctrl+Alt+/");
  assert.equal(shortcutHint("global.toggle-right-panel"), "Ctrl+Right");
});