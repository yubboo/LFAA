/**
 * 文件：docs-check.mjs
 * 作用：保证 docs 使用少量固定长期文档，而不是重新膨胀为“一任务一个 Markdown”。
 * 负责：固定文档存在性、Markdown 数量上限、禁止旧 active/archive/version-folder 文档结构、Runtime Log 目录存在性。
 * 不负责：判断文档事实是否正确、业务测试、用户验收。
 * 状态归属：无运行时状态；直接读取当前工作树。
 * 对外接口：`node scripts/docs-check.mjs`。
 * 关联文件：docs/README.md、DEVELOPMENT.md、docs/PROMPTS.md、docs/DEVELOPMENT_LOG.md。
 * 修改注意事项：新增长期文档必须先说明独立职责；禁止为单次任务或单个版本新增 Markdown。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs");
const fail = (message) => {
  console.error(`LFAA docs check failed: ${message}`);
  process.exit(1);
};

const requiredMarkdown = new Set([
  "README.md",
  "项目结构与代码地图.md",
  "PROMPTS.md",
  "DEVELOPMENT_LOG.md",
  "MODULES.md",
  "UI.md",
  "TESTING.md",
  "RELEASES.md",
  "RUNTIME.md",
]);

for (const relative of requiredMarkdown) {
  if (!fs.existsSync(path.join(docsRoot, relative))) fail(`missing docs/${relative}`);
}

const markdownFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(path.relative(docsRoot, full).replaceAll("\\", "/"));
  }
};
walk(docsRoot);

for (const relative of markdownFiles) {
  if (!requiredMarkdown.has(relative)) fail(`unexpected fragmented Markdown: docs/${relative}`);
}
if (markdownFiles.length !== requiredMarkdown.size) {
  fail(`docs must keep exactly ${requiredMarkdown.size} long-lived Markdown files, got ${markdownFiles.length}`);
}

for (const legacy of [
  "prompts",
  "standards",
  "architecture",
  "modules",
  "plans",
  "progress",
  "changelog",
  "releases",
  "testing",
  "logs/development",
]) {
  if (fs.existsSync(path.join(docsRoot, legacy))) fail(`legacy fragmented docs directory must not return: docs/${legacy}`);
}

for (const relative of [
  "logs/runtime/workspace-sync",
  "logs/runtime/github-push",
  "logs/runtime/source-update",
]) {
  const full = path.join(docsRoot, relative);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) fail(`missing runtime log directory: docs/${relative}`);
}

console.log(`LFAA docs structure check passed (${markdownFiles.length} long-lived Markdown files).`);
