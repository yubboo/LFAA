// 验证输入框绝对路径识别与上下文拼装：粘贴/手打路径都能进入消息上下文。
import assert from "node:assert/strict";
import test from "node:test";
import { extractAbsolutePaths, matchAbsolutePath } from "../client/composer/composer-paths";
import { buildContextualMessage, type ComposerAttachment } from "../client/composer/composer-context";

test("绝对路径识别：Windows 盘符、UNC、POSIX 均命中，协议与普通文本不命中", () => {
  assert.equal(matchAbsolutePath("E:\\lfaa\\AGENTS.md"), "E:\\lfaa\\AGENTS.md");
  assert.equal(matchAbsolutePath("C:/Users/yu/.lfaa/llm-config.json"), "C:/Users/yu/.lfaa/llm-config.json");
  assert.equal(matchAbsolutePath("\\\\server\\share\\a.txt"), "\\\\server\\share\\a.txt");
  assert.equal(matchAbsolutePath("/home/yu/project/README.md"), "/home/yu/project/README.md");
  assert.equal(matchAbsolutePath('"E:\\lfaa\\AGENTS.md"'), "E:\\lfaa\\AGENTS.md");
  assert.equal(matchAbsolutePath("https://example.com/a.md"), undefined);
  assert.equal(matchAbsolutePath("hello world"), undefined);
  assert.equal(matchAbsolutePath("E:\\"), undefined);
});

test("从一段文字里提取多个绝对路径并去重", () => {
  const paths = extractAbsolutePaths("看下 E:\\lfaa\\AGENTS.md 和 C:\\Users\\yu\\.lfaa\\llm-config.json，再看 /home/x/a.ts");
  assert.equal(paths.length, 3);
  assert.ok(paths.includes("E:\\lfaa\\AGENTS.md"));
  assert.ok(paths.includes("/home/x/a.ts"));
});

test("路径附件与手打路径都会进入上下文，且不重复", () => {
  const attachment: ComposerAttachment = {
    id: "path-1",
    kind: "file",
    label: "AGENTS.md",
    detail: "绝对路径",
    path: "E:\\lfaa\\AGENTS.md",
  };
  const message = buildContextualMessage("按这个规范改代码", [attachment]);
  assert.match(message, /\[本地文件路径：E:\\lfaa\\AGENTS\.md\]/u);
  // 文本里手打的路径也会补上下文，但同一条路径不重复
  const typed = buildContextualMessage("参考 E:\\lfaa\\AGENTS.md 修改", []);
  assert.match(typed, /\[本地文件路径：E:\\lfaa\\AGENTS\.md\]/u);
  assert.equal(typed.match(/E:\\lfaa\\AGENTS\.md/gu)?.length, 2);
});