/**
 * 文件：root-layout-check.mjs
 * 作用：锁定 LFAA 根目录最小入口集合，防止长期文档、临时归档和运行产物重新堆回仓库根目录。
 * 负责：根 Markdown allowlist、长期文档归位、临时 ZIP/LOG/TMP 禁止回流。
 * 不负责：docs 内容正确性、package ownership、构建输出内部结构。
 * 状态归属：无状态；只读取指定工作区物理路径。
 * 对外接口：`node scripts/root-layout-check.mjs [--root <workspace>]`、`checkRootLayout(root)`。
 * 关联文件：docs/DEVELOPMENT.md、docs/README.md、scripts/docs-check.mjs、scripts/workspace-preflight.mjs。
 * 修改注意事项：新增根级长期入口前必须先在 docs/DEVELOPMENT.md 说明其独立职责，再更新本 Gate；禁止为单次任务放宽。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT_MARKDOWN_ALLOWLIST = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "NOTICE.md",
  "README.md",
]);

const MOVED_LONG_LIVED_DOCS = [
  "ARCHITECTURE.md",
  "DEVELOPMENT.md",
  "PROJECT_PLAN.md",
];

const REQUIRED_DOC_TARGETS = MOVED_LONG_LIVED_DOCS.map((name) => `docs/${name}`);
const TEMP_ROOT_SUFFIXES = [".log", ".tmp", ".zip"];

export function checkRootLayout(root = process.cwd()) {
  const rootAbs = path.resolve(root);
  const fail = (message) => {
    throw new Error(`LFAA root layout check failed: ${message}`);
  };

  for (const relative of REQUIRED_DOC_TARGETS) {
    const absolute = path.join(rootAbs, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`missing ${relative}`);
  }

  for (const legacy of MOVED_LONG_LIVED_DOCS) {
    if (fs.existsSync(path.join(rootAbs, legacy))) fail(`${legacy} must live under docs/`);
  }

  for (const entry of fs.readdirSync(rootAbs, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (lower.endsWith(".md") && !ROOT_MARKDOWN_ALLOWLIST.has(entry.name)) {
      fail(`unexpected root Markdown: ${entry.name}`);
    }
    if (TEMP_ROOT_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      fail(`temporary/release artifact must not live in repository root: ${entry.name}`);
    }
  }

  return {
    root: rootAbs,
    markdown: [...ROOT_MARKDOWN_ALLOWLIST].sort(),
    docs: REQUIRED_DOC_TARGETS,
  };
}

function parseRoot(argv) {
  const index = argv.indexOf("--root");
  return path.resolve(index >= 0 && argv[index + 1] ? argv[index + 1] : process.cwd());
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = checkRootLayout(parseRoot(process.argv.slice(2)));
    console.log(`LFAA root layout check passed (${result.markdown.length} root Markdown entry files).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
