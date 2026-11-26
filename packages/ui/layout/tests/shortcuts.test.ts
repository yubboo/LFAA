// 快捷键基础设施单测：键位标准化、展示、默认值与用户覆盖合并、冲突检测。
import assert from "node:assert/strict";
import test from "node:test";
import {
  findShortcutConflict,
  formatShortcutKeys,
  normalizeShortcutEvent,
  resolveShortcutBindings,
  type WorkbenchShortcutAction,
} from "../client/shortcuts";

const event = (key: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {}) => ({
  key,
  ctrlKey: Boolean(mods.ctrl),
  altKey: Boolean(mods.alt),
  shiftKey: Boolean(mods.shift),
  metaKey: Boolean(mods.meta),
});

test("组合键标准化：修饰键顺序固定、字母大写、方向键与标点有稳定 token", () => {
  assert.equal(normalizeShortcutEvent(event("w", { ctrl: true, alt: true })), "Ctrl+Alt+W");
  assert.equal(normalizeShortcutEvent(event("ArrowRight", { alt: true, ctrl: true })), "Ctrl+Alt+Right");
  assert.equal(normalizeShortcutEvent(event("W", { shift: true, ctrl: true })), "Ctrl+Shift+W");
  assert.equal(normalizeShortcutEvent(event(",", { ctrl: true })), "Ctrl+Comma");
  assert.equal(normalizeShortcutEvent(event("F5")), "F5");
});

test("裸按键、纯 Shift 与单独修饰键不会占用成快捷键", () => {
  assert.equal(normalizeShortcutEvent(event("a")), null);
  assert.equal(normalizeShortcutEvent(event("A", { shift: true })), null);
  assert.equal(normalizeShortcutEvent(event("Control", { ctrl: true })), null);
});

test("展示文本把存储 token 还原成符号", () => {
  assert.equal(formatShortcutKeys("Ctrl+Comma"), "Ctrl+,");
  assert.equal(formatShortcutKeys("Ctrl+Alt+Right"), "Ctrl+Alt+Right");
  assert.equal(formatShortcutKeys(null), "");
});

const actions: WorkbenchShortcutAction[] = [
  {
    id: "a.one",
    group: "global",
    title: { zh: "一", en: "One" },
    description: { zh: "", en: "" },
    defaultKeys: "Ctrl+K",
    run: () => {},
  },
  {
    id: "a.two",
    group: "workbench",
    title: { zh: "二", en: "Two" },
    description: { zh: "", en: "" },
    defaultKeys: null,
    run: () => {},
  },
];

test("合并默认键位与用户覆盖：缺失用默认，null 表示主动清除", () => {
  assert.deepEqual(resolveShortcutBindings(actions, {})?.map((item) => item.keys), ["Ctrl+K", null]);
  assert.deepEqual(resolveShortcutBindings(actions, { "a.one": "Ctrl+Alt+O" }).map((item) => item.keys), ["Ctrl+Alt+O", null]);
  assert.deepEqual(resolveShortcutBindings(actions, { "a.one": null }).map((item) => item.keys), [null, null]);
  assert.deepEqual(resolveShortcutBindings(actions, { "a.two": "Alt+T" }).map((item) => item.keys), ["Ctrl+K", "Alt+T"]);
});

test("冲突检测跨动作比较，忽略自身且不区分大小写", () => {
  const bindings = resolveShortcutBindings(actions, { "a.two": "ctrl+k" });
  assert.equal(findShortcutConflict(bindings, "Ctrl+K", "a.one"), bindings[1]);
  assert.equal(findShortcutConflict(bindings, "Ctrl+K", "a.two"), bindings[0]);
  assert.equal(findShortcutConflict(bindings, "Ctrl+J", "a.one"), undefined);
});