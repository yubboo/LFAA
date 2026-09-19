/**
 * 文件：import-path-check.mjs
 * 作用：检查 TypeScript/TSX 导入路径是否符合 LFAA 模块边界。
 * 负责：阻止深层相对导入、跨 package 内部深链，以及可复用 package 依赖宿主无法解析的 tsconfig-only alias。
 * 不负责：TypeScript 类型检查、Rust import；@lfaa package subpath 的 exports 运行时解析由 runtime-import-resolution-check.mjs 负责。
 * 状态归属：无运行时状态。
 * 对外接口：`node scripts/import-path-check.mjs`。
 * 关联文件：DEVELOPMENT.md、ARCHITECTURE.md。
 * 修改注意事项：规则变化必须先更新对应 Standards，再调整检查器。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["apps", "packages", "scripts"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignored = new Set(["node_modules", "dist", "target", "coverage", ".git"]);

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;

    const text = fs.readFileSync(full, "utf8");
    const relative = path.relative(root, full).replaceAll("\\", "/");

    // static import/export ... from "..."
    const staticPattern = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
    // dynamic import("...")
    const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
    // require("...")
    const requirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

    const specs = [];
    for (const pattern of [staticPattern, dynamicPattern, requirePattern]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        specs.push(match[1]);
      }
    }

    for (const spec of specs) {
      if (relative.startsWith("packages/") && spec.startsWith("@/")) {
        violations.push({
          file: relative,
          spec,
          reason: "可复用 packages 禁止依赖 tsconfig-only @/ alias；请使用 package 公共 Export/Subpath Export。"
        });
      }

      if (/^(?:\.\.\/){2,}/.test(spec)) {
        violations.push({
          file: relative,
          spec,
          reason: "禁止 ../../ 及更深相对导入；跨 Feature/子域请通过当前 package 公共子入口或 @lfaa/* Export 复用。"
        });
      }

      if (/^@lfaa\/[^/]+\/src(?:\/|$)/.test(spec) || /^@lfaa\/[^/]+\/.*\/internal(?:\/|$)/.test(spec)) {
        violations.push({
          file: relative,
          spec,
          reason: "禁止跨 package 访问 src/internal；必须从 package 公共 Export 导入。"
        });
      }
    }
  }
}

for (const name of roots) {
  walk(path.join(root, name));
}

if (violations.length > 0) {
  console.error("LFAA import path check failed:\n");
  for (const item of violations) {
    console.error(`- ${item.file}`);
    console.error(`  import: ${item.spec}`);
    console.error(`  reason: ${item.reason}`);
  }
  process.exit(1);
}

console.log("LFAA import path check passed.");
