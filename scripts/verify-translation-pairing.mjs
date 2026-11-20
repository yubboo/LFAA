// 包 README 双语配对校验：按英文标题分段哈希，记录到 README.i18n.yaml，并在校验模式下报告漂移。
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
const WRITE = process.argv.includes("--write");
const PKG_ROOT = join(ROOT, "packages");

/** 枚举 packages 下的包目录。 */
function discover() {
  const found = [];
  for (const group of readdirSync(PKG_ROOT)) {
    const groupDir = join(PKG_ROOT, group);
    if (!statSync(groupDir).isDirectory()) continue;
    if (existsSync(join(groupDir, "package.json"))) {
      found.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (existsSync(join(childDir, "package.json"))) found.push(childDir);
    }
  }
  return found;
}

/** 标题转 slug：只有小写字母数字与连字符。 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** 去掉围栏代码块并归一化空白，避免代码差异干扰双语配对。 */
function normalize(body) {
  return body
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** 按 `## ` 分段：第一段是文件头，键为 `/`。 */
function splitSections(text) {
  const parts = text.split(/^## /mu);
  const sections = [{ key: "/", body: parts.shift() ?? "" }];
  for (const part of parts) {
    const lines = part.split("\n");
    const title = lines.shift() ?? "";
    sections.push({ key: `/${slugify(title)}`, body: lines.join("\n") });
  }
  return sections;
}

function hash(text) {
  return createHash("sha256").update(normalize(text)).digest("hex").slice(0, 16);
}

const results = [];
const problems = [];

for (const pkgDir of discover()) {
  const enPath = join(pkgDir, "README.md");
  const zhPath = join(pkgDir, "README.zh.md");
  const recordPath = join(pkgDir, "README.i18n.yaml");
  const label = relative(ROOT, pkgDir).split(sep).join("/");

  if (!existsSync(enPath) || !existsSync(zhPath)) {
    problems.push(`${label}: 缺少 README.md 或 README.zh.md`);
    continue;
  }

  const en = splitSections(readFileSync(enPath, "utf8").replace(/^\uFEFF/u, ""));
  const zh = splitSections(readFileSync(zhPath, "utf8").replace(/^\uFEFF/u, ""));

  if (en.length !== zh.length) {
    problems.push(`${label}: 双语段落数不一致（en=${en.length} zh=${zh.length}）`);
    continue;
  }

  const lines = [
    "# 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。",
    "# 修改任意一侧后，同步另一侧并重新生成：pnpm run readme:pair -- . --write",
  ];
  const record = {};
  for (let index = 0; index < en.length; index += 1) {
    const key = en[index].key;
    record[key] = { en: hash(en[index].body), zh: hash(zh[index].body) };
    lines.push(`${key}:`);
    lines.push(`  en: ${record[key].en}`);
    lines.push(`  zh: ${record[key].zh}`);
  }

  const next = `${lines.join("\n")}\n`;
  if (WRITE) {
    writeFileSync(recordPath, next, "utf8");
    results.push(`WRITE ${label}`);
    continue;
  }

  if (!existsSync(recordPath)) {
    problems.push(`${label}: 缺少 README.i18n.yaml（先执行 --write 生成）`);
    continue;
  }

  // 旧记录可能来自 Windows CRLF 检出：统一行尾再比较，避免把换行差异误报成"记录过期"。
  const previous = readFileSync(recordPath, "utf8").replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n");
  if (previous !== next) {
    problems.push(`${label}: 双语配对记录过期（运行 pnpm run readme:pair -- . --write 更新）`);
    continue;
  }
  results.push(`OK    ${label}`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`✖ ${problem}`);
  console.error(`\n${problems.length} 个包存在 README 双语配对问题。`);
  process.exitCode = 1;
} else {
  console.log(`✔ ${results.length} 个包的 README 双语配对一致。`);
}
