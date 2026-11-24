// 静态层级守卫：外观页的下拉菜单 Portal 到 body，层级必须高于设置中心弹窗；
// 菜单层低于弹窗时会被遮罩压住——触发器看得见、选项点不到，整页设置看起来全部失灵。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

/** 从 tokens.css 读取层级令牌的数值，缺失时直接失败。 */
function layerValue(css: string, token: string): number {
  const match = new RegExp(`${token}:\\s*(\\d+)`, "u").exec(css);
  assert.ok(match, `tokens.css 缺少层级令牌 ${token}`);
  return Number(match[1]);
}

test("浮层菜单层级高于设置中心弹窗", () => {
  const tokens = read("../client/tokens.css");
  const dialog = layerValue(tokens, "--z-dialog");
  const popover = layerValue(tokens, "--z-popover");
  assert.ok(popover > dialog, `--z-popover(${popover}) 必须大于 --z-dialog(${dialog})`);
});

test("设置弹窗与外观下拉分别消费弹窗层与浮层令牌", () => {
  const dialogCss = read("../../layout/client/panels/SettingsDialog.module.css");
  assert.match(dialogCss, /\.backdrop\s*\{[^}]*z-index:\s*var\(--z-dialog\)/su);
  const menuCss = read("../client/components/AccentSelect.module.css");
  assert.match(menuCss, /\.menu\s*\{[^}]*z-index:\s*var\(--z-popover\)/su);
});

test("动效令牌已在 tokens.css 集中定义", () => {
  const tokens = read("../client/tokens.css");
  for (const token of [
    "--motion-duration-fast",
    "--motion-duration-base",
    "--motion-duration-slow",
    "--motion-ease-standard",
    "--motion-ease-emphasized",
  ]) {
    assert.ok(tokens.includes(`${token}:`), `tokens.css 缺少动效令牌 ${token}`);
  }
});