/**
 * 文件：dev-log-check.mjs
 * 作用：检查开发日志分层、命名、索引、历史状态与主编号连续性。
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

const rootMarkdown = fs
  .readdirSync(logRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .filter((name) => !["README.md", "INDEX.md"].includes(name));

if (rootMarkdown.length > 0) {
  fail(`development logs cannot be flat at root: ${rootMarkdown.join(", ")}`);
}

const indexText = fs.readFileSync(indexFile, "utf8");
const activeName = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+){0,3}\.md$/;
const archiveName = /^(\d{4})\.(\d+)-[a-z0-9]+(?:-[a-z0-9]+){0,3}\.md$/;
const mainNumbers = new Set();

const activeFiles = fs
  .readdirSync(activeRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"));

if (activeFiles.length === 0) {
  fail("active/ must contain at least one current development log");
}

for (const entry of activeFiles) {
  const match = entry.name.match(activeName);
  if (!match) {
    fail(`invalid active log name: ${entry.name}`);
  }

  mainNumbers.add(Number(match[1]));

  const full = path.join(activeRoot, entry.name);
  const text = fs.readFileSync(full, "utf8");

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

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    if (entry.isFile()) results.push(full);
  }
  return results;
}

for (const file of walk(archiveRoot)) {
  const relative = path.relative(archiveRoot, file).replaceAll("\\", "/");
  const name = path.basename(file);

  if (!name.endsWith(".md") || name === "INDEX.md" || name === "README.md") {
    continue;
  }

  const match = name.match(archiveName);
  if (!match) {
    fail(`invalid archived log name: ${relative}`);
  }

  mainNumbers.add(Number(match[1]));

  const text = fs.readFileSync(file, "utf8");

  for (const requiredText of [
    "主编号：",
    "名称：",
    "状态：",
  ]) {
    if (!text.includes(requiredText)) {
      fail(`${relative} missing "${requiredText}"`);
    }
  }

  const isSuperseded = text.includes("状态：** superseded") || text.includes("状态：superseded");
  const isDelivered = text.includes("状态：** delivered") || text.includes("状态：delivered");
  const isArchived = text.includes("状态：** archived") || text.includes("状态：archived");
  const isDeprecated = text.includes("状态：** deprecated") || text.includes("状态：deprecated");

  if (!isSuperseded && !isDelivered && !isArchived && !isDeprecated) {
    fail(`${relative} has unsupported archive status`);
  }

  if (isSuperseded) {
    for (const requiredText of ["已由：", "当前查看："]) {
      if (!text.includes(requiredText)) {
        fail(`${relative} missing "${requiredText}"`);
      }
    }
  } else if (!text.includes("## 原始来源")) {
    fail(`${relative} must contain "## 原始来源"`);
  }

  if (!indexText.includes(name)) {
    fail(`INDEX.md does not reference archived log ${name}`);
  }
}

if (mainNumbers.size === 0) {
  fail("no numbered development logs found");
}

const maxMain = Math.max(...mainNumbers);
for (let number = 1; number <= maxMain; number += 1) {
  if (!mainNumbers.has(number)) {
    fail(`missing main development log #${number}; historical numbers cannot silently disappear`);
  }

  if (!indexText.includes(`#${number}`)) {
    fail(`INDEX.md missing main development log #${number}`);
  }
}

if (!indexText.includes("没有发现真实 `#0`")) {
  fail("INDEX.md must explicitly document why #0 is not present");
}

console.log("LFAA development log check passed.");
