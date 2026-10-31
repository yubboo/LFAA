import assert from "node:assert/strict";
import test from "node:test";
import { resolveFileCodeLanguage } from "lfaa-client-ui-sidebar-files/src/file-code-language.js";

test("文件预览按扩展名按需加载真实语言解析器并对未知扩展保持纯文本", async () => {
  for (const [name, label] of [
    ["lfaa-instance.json", "JSON"],
    ["server.ts", "TypeScript"],
    ["plugin.jsx", "JavaScript"],
    ["page.html", "HTML"],
    ["theme.css", "CSS"],
    ["README.md", "Markdown"],
    ["service.py", "Python"],
    ["config.yml", "YAML"],
    ["document.svg", "XML"],
    ["query.sql", "SQL"]
  ]) {
    const language = resolveFileCodeLanguage(name);
    assert.equal(language.label, label, name);
    assert.ok(await language.loadSupport(), `${name} 应使用实际语言解析器`);
  }
  const plainText = resolveFileCodeLanguage("server.properties");
  assert.equal(plainText.label, "纯文本");
  assert.equal(await plainText.loadSupport(), null);
});

test("只有标准 JSON 文件启用 JSON 语法检查", () => {
  assert.equal(resolveFileCodeLanguage("settings.json").isJson, true);
  assert.equal(resolveFileCodeLanguage("settings.jsonc").isJson, false);
  assert.equal(resolveFileCodeLanguage("notes.txt").isJson, false);
});
