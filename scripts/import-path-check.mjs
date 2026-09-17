/**
 * 文件：scripts/import-path-check.mjs
 * 作用：自动检查 LFAA TypeScript/JavaScript 导入路径是否违反模块边界。
 * 负责：
 * - 阻止 ../../ 及更深的相对导入；
 * - 阻止 @lfaa/* 跨包访问 src/internal 或 src；
 * - 给开发者和 AI 提供明确错误位置。
 *
 * 不负责：
 * - 判断单层 ../ 是否属于合理 Feature 内部引用；
 * - 解析 Rust use 路径；
 * - 取代 ESLint / TypeScript 类型检查。
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
      if (/^(?:\.\.\/){2,}/.test(spec)) {
        violations.push({
          file: relative,
          spec,
          reason: "禁止 ../../ 及更深相对导入；当前 workspace 内请使用 @/，跨 package 请使用 @lfaa/*。"
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
