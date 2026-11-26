// 静态护栏：背景图模式下四栏必须统一走同一档薄纱（--color-column / --column-wash），
// 否则会出现「中间有图、侧栏还是黑底」的半张脸效果。改这些文件的底色时必须仍然引用这两个变量。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

/** 四栏的底色落点：任意一栏漏掉都会让背景图在那一段断开。 */
const COLUMN_FILES: Array<[string, string]> = [
  ["左一图标栏", "../../layout/client/navigation/NavigationRail.module.css"],
  ["左二会话栏", "../../layout/client/navigation/NavigationSidebar.module.css"],
  ["中间工作区", "../../layout/client/shell/WorkbenchShell.module.css"],
  ["右侧菜单栏", "../../layout/client/panels/ContextPanel.module.css"],
  ["右工作台", "../../../client/ui-chat/client/workbench/RightWorkbenchPane.module.css"],
];

test("四栏的底色都消费统一的背景图薄纱变量", () => {
  for (const [name, file] of COLUMN_FILES) {
    const css = read(file);
    assert.match(
      css,
      /--color-column|--column-wash/u,
      `${name}（${file}）没有消费 --color-column / --column-wash，背景图模式下会退回不透明底色`,
    );
  }
});

test("令牌层定义了薄纱变量，并按明暗给不同比例", () => {
  const tokens = read("../client/tokens.css");
  assert.match(tokens, /--color-column:\s*color-mix\(in srgb, var\(--color-shell\) var\(--column-wash/u);
  const lightWash = /html\[data-resolved-theme="light"\]\s*\{[^}]*--column-wash:\s*(\d+)%/u.exec(tokens);
  const darkWash = /html\[data-resolved-theme="dark"\]\s*\{[^}]*--column-wash:\s*(\d+)%/u.exec(tokens);
  assert.ok(lightWash, "浅色档缺少 --column-wash");
  assert.ok(darkWash, "深色档缺少 --column-wash");
  // 浅色底上的亮图更需要白纱压住正文，比例应不低于深色档。
  assert.ok(Number(lightWash[1]) >= Number(darkWash[1]), "浅色档薄纱不应比深色档更薄");
});