/**
 * 文档链接检查：docs/ 下的相对链接必须指向真实文件，避免移动文档后留下死链。
 * 关联：docs/README.md（文档地图）· scripts/check-workspace.mjs（仓库级检查）
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

/** 日志归档按卷存放，不做逐篇链接检查。 */
const SKIP_DIRS = new Set(['updata-log', 'dev-log']);

/** 递归收集 markdown。 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** 抽出 markdown 行内链接的目标。 */
function links(source) {
  return [...source.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => match[1]);
}

const broken = [];
let checked = 0;

for (const file of walk(DOCS)) {
  const source = readFileSync(file, 'utf8');
  for (const target of links(source)) {
    if (/^(https?:|mailto:|#)/u.test(target)) continue;
    const path = target.split('#')[0];
    if (path === '') continue;
    checked += 1;
    const absolute = join(dirname(file), path);
    // 目录链接（如 dev-log/）同样有效。
    if (!existsSync(absolute)) {
      broken.push(`${relative(ROOT, file)} -> ${target}`);
    }
  }
}

if (broken.length > 0) {
  console.error(`✖ 文档死链 ${broken.length} 条（共检查 ${checked} 条）：`);
  for (const item of broken) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`✔ 文档链接通过（${checked} 条，${walk(DOCS).length} 份文档）`);