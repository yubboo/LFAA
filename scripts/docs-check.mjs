/**
 * 文件：docs-check.mjs
 * 作用：检查 docs 顶层结构、中文编号文档命名和日志分类。
 * 负责：稳定 docs 目录、固定 README/INDEX 入口、编号类中文文件名。
 * 不负责：检查文档事实正确性、代码注释、业务测试。
 * 状态归属：无运行时状态。
 * 对外接口：`node scripts/docs-check.mjs`。
 * 关联文件：docs/README.md、docs/standards/NAMING.md、docs/standards/DEV_LOGS.md。
 * 修改注意事项：新增 docs 顶层目录必须先更新规范和 allowedTopDirs。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs");

const fail = (message) => {
  console.error(`LFAA docs check failed: ${message}`);
  process.exit(1);
};

const allowedTopDirs = new Set([
  "standards",
  "architecture",
  "modules",
  "plans",
  "progress",
  "prompts",
  "logs",
  "changelog",
  "releases",
  "testing",
]);

if (!fs.existsSync(path.join(docsRoot, "README.md"))) {
  fail("docs/README.md is required");
}

for (const entry of fs.readdirSync(docsRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && !allowedTopDirs.has(entry.name)) {
    fail(`unexpected docs top-level directory: ${entry.name}`);
  }
}

for (const dir of allowedTopDirs) {
  const full = path.join(docsRoot, dir);
  if (!fs.existsSync(full)) {
    fail(`missing docs/${dir}/`);
  }
}

const numberedChinese = /^\d{4}-(?:\d{2}-)?[^./\\]{2,28}\.md$/u;

function hasChinese(name) {
  return /[\u3400-\u9fff]/u.test(name);
}

function checkNumberedDocs(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      checkNumberedDocs(full);
      continue;
    }

    if (!entry.name.endsWith(".md")) continue;
    if (!/^\d{4}/.test(entry.name)) continue;

    if (!numberedChinese.test(entry.name)) {
      fail(`invalid numbered document name: ${path.relative(root, full).replaceAll("\\", "/")}`);
    }

    if (!hasChinese(entry.name)) {
      fail(`numbered human document must contain Chinese: ${path.relative(root, full).replaceAll("\\", "/")}`);
    }

    if (/\d{4}\.\d+/.test(entry.name)) {
      fail(`numbered document must not use decimal-dot filename: ${entry.name}`);
    }
  }
}

checkNumberedDocs(path.join(docsRoot, "logs", "development"));
checkNumberedDocs(path.join(docsRoot, "prompts"));

for (const legacy of [
  path.join(docsRoot, "logs", "workspace-sync"),
  path.join(docsRoot, "logs", "github-push"),
  path.join(docsRoot, "logs", "source-update"),
]) {
  if (fs.existsSync(legacy)) {
    fail(`legacy runtime log directory must not remain: ${path.relative(root, legacy).replaceAll("\\", "/")}`);
  }
}

for (const required of [
  "logs/development/README.md",
  "logs/development/INDEX.md",
  "logs/runtime/README.md",
  "logs/runtime/workspace-sync/README.md",
  "logs/runtime/github-push/README.md",
  "logs/runtime/source-update/README.md",
  "standards/README.md",
  "architecture/README.md",
  "plans/README.md",
  "progress/README.md",
  "prompts/README.md",
  "changelog/README.md",
  "releases/README.md",
  "testing/README.md",
]) {
  if (!fs.existsSync(path.join(docsRoot, required))) {
    fail(`missing docs/${required}`);
  }
}

console.log("LFAA docs structure check passed.");
