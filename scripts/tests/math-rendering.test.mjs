/** 功能：验证数学渲染安全补丁与 Markdown 适配。作用：覆盖公式 AST、直接/间接版本及继承 trust 拒绝。关联文件：client/modules/package.json、pnpm-workspace.yaml。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "packages/client/modules/package.json"));
test("数学公式保持语法和显示模式，直接与 Markdown 间接渲染器都采用补丁版", async () => {
  const katex = require("katex"); assert.equal(katex.version, "0.18.2");
  assert.match(katex.renderToString(String.raw`\frac{a}{b}+\sqrt{x}`, { throwOnError: true }), /katex/);
  assert.match(katex.renderToString(String.raw`\sum_{i=1}^{n}i`, { displayMode: true, throwOnError: true }), /katex-display/);
  const mathPath = require.resolve("micromark-extension-math");
  const mathRequire = createRequire(mathPath); assert.equal(mathRequire("katex").version, "0.18.2");
  const { fromMarkdown } = await import(pathToFileURL(require.resolve("mdast-util-from-markdown")).href);
  const { math } = await import(pathToFileURL(mathPath).href);
  const { mathFromMarkdown } = await import(pathToFileURL(require.resolve("mdast-util-math")).href);
  const tree = fromMarkdown("行内 $x^2$\n\n$$\n\\frac{a}{b}\n$$", { extensions: [math()], mdastExtensions: [mathFromMarkdown()] });
  assert.equal(tree.children[0].children[1].type, "inlineMath"); assert.equal(tree.children[1].type, "math");
});
test("其他库污染 Object.prototype.trust 也不能使默认数学渲染信任外部资源", () => {
  // 污染只发生在专用子进程，不能影响测试运行器或产品进程。
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(resolve(root, "packages/client/modules/package.json"))});
    const katex=require('katex');Object.prototype.trust=true;
    try{process.stdout.write(katex.renderToString('\\\\includegraphics{https://example.com/fixture.png}',{throwOnError:false,strict:'ignore'}));}
    finally{delete Object.prototype.trust;}
  `], { encoding: "utf8", timeout: 10_000, windowsHide: true });
  assert.doesNotMatch(output, /<img\b/u); assert.doesNotMatch(output, /src="https:\/\/example\.com/u);
});
