/**
 * 文件：language-ownership-check.mjs
 * 作用：防止 LFAA 演变成 TypeScript / Rust / Python 三套重复业务实现。
 * 负责：检查 Product Plane、Frozen Rust Native Kernel 与未来 Python Optional Runtime 的物理目录边界。
 * 不负责：判断某段算法应该用什么语言、编译代码、扫描第三方依赖。
 * 修改注意事项：新增语言 Runtime 必须先更新 ARCHITECTURE.md，再扩展本门禁；不得为单次功能临时放宽。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const ignored = new Set(["node_modules", "dist", "target", "coverage", ".git", ".cache", ".tmp"]);

function walk(relativeRoot, visitor) {
  const start = path.join(root, relativeRoot);
  if (!fs.existsSync(start)) return;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else visitor(path.relative(root, full).replaceAll("\\", "/"));
    }
  }
}

// Product / Agent Plane 默认 TypeScript。普通产品功能不得偷塞 Rust/Python 形成第二套业务层。
for (const area of ["apps", "packages"]) {
  walk(area, (relative) => {
    if (/\.(?:rs|py)$/i.test(relative)) {
      failures.push(`${relative}: apps/packages 属于 TypeScript Product & Agent Plane，禁止放入 Rust/Python 产品实现。`);
    }
  });
}

// Rust 是稳定 Native Kernel，只允许 Rust/Cargo/文档类文件；不能反向承载 TS/Python Agent 业务。
walk("native", (relative) => {
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/i.test(relative)) {
    failures.push(`${relative}: native 只属于 Rust Native Kernel，禁止混入 TypeScript/Python 产品实现。`);
    return;
  }
  if (/\.rs$/i.test(relative)) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    if (/\b(?:openai|chatgpt|deepseek|codex|minecraft|workbench)\b/i.test(source)) {
      failures.push(`${relative}: Frozen Rust Native Kernel 不得认识厂商、Harness 或产品场景业务名。`);
    }
  }
});

// Python 产品代码未来只能进入明确的 Optional Runtime；scripts/ 下的开发工具脚本不属于产品 Runtime。
walk("runtimes", (relative) => {
  if (relative.startsWith("runtimes/python/") && !/\.(?:py|md|toml|json|txt|lock)$/i.test(relative)) {
    failures.push(`${relative}: runtimes/python 只能承载 Python Optional Runtime 及其声明文件。`);
  }
});

if (failures.length) {
  console.error("LFAA language ownership check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("LFAA language ownership check passed.");
