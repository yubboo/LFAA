/**
 * 界面包内部分区检查：client/ 下按区域分目录后，区域之间不允许成环，也不许反向依赖入口。
 * 关联：docs/architecture/structure.md（§3 包内结构）· scripts/check-workspace.mjs（仓库级检查）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ROOT = join(ROOT, 'packages/client');

/** 入口与公共声明文件不算业务文件。 */
const ENTRY_FILES = new Set(['index.ts', 'index.tsx', 'css-modules.d.ts']);
/** 扁平包超过这个数量就提示按职责分区。 */
const FLAT_FILE_HINT = 10;

const warnings = [];
const errors = [];

/** 目录存在且是目录。 */
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** 递归列 ts / tsx。 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

/** 相对 import 的说明符。 */
function relativeImports(source) {
  const matches = source.matchAll(/(?:from\s+|import\s+)['"](\.[^'"]+)['"]/gu);
  return [...matches].map((match) => match[1]);
}

/** 文件所属区域：顶层返回 null，区域外返回 '..'。 */
function regionOf(clientDir, file) {
  const parts = relative(clientDir, file).split(/[\\/]/u);
  if (parts[0] === '..') return '..';
  return parts.length === 1 ? null : parts[0];
}

/** 有向图找环，返回环上的区域顺序。 */
function findCycle(graph) {
  const state = new Map();
  const stack = [];
  const visit = (node) => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 'visiting') return [...stack.slice(stack.indexOf(next)), next];
      if (!state.has(next)) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };
  for (const node of graph.keys()) {
    if (!state.has(node)) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

for (const pkg of readdirSync(CLIENT_ROOT)) {
  const clientDir = join(CLIENT_ROOT, pkg, 'client');
  if (!isDir(clientDir)) continue;

  const entries = readdirSync(clientDir, { withFileTypes: true });
  const topCode = entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/u.test(entry.name) && !ENTRY_FILES.has(entry.name))
    .map((entry) => entry.name);
  const regions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  if (regions.length === 0) {
    if (topCode.length > FLAT_FILE_HINT) {
      warnings.push(`${pkg}：client/ 顶层 ${topCode.length} 个文件，建议按职责分区（见 structure.md §3）`);
    }
    continue;
  }

  const graph = new Map();
  for (const region of regions) graph.set(region, new Set());

  for (const file of walk(clientDir)) {
    const from = regionOf(clientDir, file);
    if (from === null || from === '..') continue;

    for (const specifier of relativeImports(readFileSync(file, 'utf8'))) {
      const target = resolve(dirname(file), specifier);
      const to = regionOf(clientDir, target);

      if (to === '..') continue;
      if (to === null) {
        const name = specifier.split('/').pop();
        if (name === 'index' || name === 'index.tsx' || name === 'index.ts') {
          errors.push(`${relative(ROOT, file)} 反向 import 了入口 ${specifier}（区域不得依赖入口）`);
        }
        continue;
      }
      if (to !== from) graph.get(from)?.add(to);
    }
  }

  const cycle = findCycle(graph);
  if (cycle) {
    // 循环依赖先报告不拦截：存量 store 与视图耦合需要逐条拆 shared，列为待还债务。
    warnings.push(`${pkg}：区域循环依赖 ${cycle.join(' → ')}（建议把共用类型/常量抽到 shared/）`);
  }
}

for (const item of warnings) console.warn(`⚠ [client-layout] ${item}`);
if (errors.length > 0) {
  console.error('✖ 界面包分区检查失败：');
  for (const item of errors) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`✔ 界面包分区检查通过（${readdirSync(CLIENT_ROOT).length} 个界面包，${warnings.length} 条提示）`);