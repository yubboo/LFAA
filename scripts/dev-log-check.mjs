/**
 * 文件：dev-log-check.mjs
 * 作用：检查开发日志分层、中文命名、索引、历史状态与主编号连续性。
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const logRoot = path.join(root, "docs", "logs", "development");
const activeRoot = path.join(logRoot, "active");
const archiveRoot = path.join(logRoot, "archive");
const indexFile = path.join(logRoot, "INDEX.md");

const fail = (message) => {
  console.error(`LFAA development log check failed: ${message}`);
  process.exit(1);
};

for (const required of [logRoot, activeRoot, archiveRoot, indexFile]) {
  if (!fs.existsSync(required)) {
    fail(`missing ${path.relative(root, required).replaceAll("\\", "/")}`);
  }
}

const indexText = fs.readFileSync(indexFile, "utf8");
const activeName = /^(\d{4})-([^./\\]{2,28})\.md$/u;
const archiveName = /^(\d{4})(?:-(\d{2}))?-([^./\\]{2,28})\.md$/u;
const mainNumbers = new Set();

function hasChinese(text) {
  return /[\u3400-\u9fff]/u.test(text);
}

const activeFiles = fs
  .readdirSync(activeRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"));

if (activeFiles.length === 0) {
  fail("active/ must contain at least one current development log");
}

for (const entry of activeFiles) {
  const match = entry.name.match(activeName);
  if (!match) fail(`invalid active log name: ${entry.name}`);
  if (!hasChinese(entry.name)) fail(`active log must use readable Chinese name: ${entry.name}`);

  mainNumbers.add(Number(match[1]));

  const text = fs.readFileSync(path.join(activeRoot, entry.name), "utf8");
  for (const requiredText of [
    "主编号：",
    "名称：",
    "最新变更：",
    "状态：",
    "关键词：",
    "当前文件：",
    "## 当前结论",
    "## 最新变更",
    "## 影响范围",
    "## 验证结果",
    "## 历史索引",
  ]) {
    if (!text.includes(requiredText)) {
      fail(`${entry.name} missing "${requiredText}"`);
    }
  }

  if (!indexText.includes(entry.name)) {
    fail(`INDEX.md does not reference active log ${entry.name}`);
  }
}

for (const entry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

  const match = entry.name.match(archiveName);
  if (!match) fail(`invalid archived log name: ${entry.name}`);
  if (!hasChinese(entry.name)) fail(`archived log must use readable Chinese name: ${entry.name}`);

  mainNumbers.add(Number(match[1]));

  const text = fs.readFileSync(path.join(archiveRoot, entry.name), "utf8");

  for (const requiredText of ["主编号：", "名称：", "状态："]) {
    if (!text.includes(requiredText)) {
      fail(`${entry.name} missing "${requiredText}"`);
    }
  }

  const superseded = text.includes("superseded");
  const delivered = text.includes("delivered");
  const archived = text.includes("archived");
  const deprecated = text.includes("deprecated");

  if (!superseded && !delivered && !archived && !deprecated) {
    fail(`${entry.name} has unsupported archive status`);
  }

  if (superseded) {
    for (const requiredText of ["已由：", "当前查看："]) {
      if (!text.includes(requiredText)) {
        fail(`${entry.name} missing "${requiredText}"`);
      }
    }
  } else if (!text.includes("## 原始来源")) {
    fail(`${entry.name} must contain "## 原始来源"`);
  }

  if (!indexText.includes(entry.name)) {
    fail(`INDEX.md does not reference archived log ${entry.name}`);
  }
}

const maxMain = Math.max(...mainNumbers);
for (let number = 1; number <= maxMain; number += 1) {
  if (!mainNumbers.has(number)) {
    fail(`missing main development log #${number}`);
  }
  if (!indexText.includes(`#${number}`)) {
    fail(`INDEX.md missing main development log #${number}`);
  }
}

if (!indexText.includes("没有真实 `#0`")) {
  fail("INDEX.md must document why #0 is not present");
}

console.log("LFAA development log check passed.");
