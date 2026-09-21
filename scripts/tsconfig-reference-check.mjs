/**
 * 文件：tsconfig-reference-check.mjs
 * 作用：验证 Monorepo 中共享 TypeScript 配置继承关系，避免 capability-family 目录迁移后留下失效 extends。
 * 负责：扫描 apps 一层与 packages 两层 workspace 的 tsconfig.json，解析 extends，校验根级 base/client base Owner，并阻止私有 @/* paths alias 回流。
 * 不负责：TypeScript 类型检查、业务源码 import 解析、替代 tsc/vite。
 * 状态归属：无状态；仓库根级 tsconfig.base*.json 是工程配置唯一 Owner。
 * 对外接口：node scripts/tsconfig-reference-check.mjs。
 * 关联文件：tsconfig.base.json、tsconfig.base.client.json、docs/DEVELOPMENT.md、scripts/workspace-preflight.mjs。
 * 修改注意事项：源码跨 package 仍必须走 @lfaa/*；这里允许的 ../ 只用于工程配置继承，不得扩展成业务源码跨包相对 import。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA tsconfig reference check failed: ${message}`);
  process.exit(1);
};

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  } catch (error) {
    fail(`${relative} 无法解析：${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertRelativeExtends(relative, expected) {
  const data = readJson(relative);
  const actual = String(data.extends ?? "").trim();
  if (actual !== expected) fail(`${relative} extends 应为 ${expected}，实际为 ${actual || "<missing>"}`);
  const target = path.resolve(root, path.dirname(relative), actual);
  if (!fs.existsSync(target)) fail(`${relative} extends 目标不存在：${actual}`);
  if (data.compilerOptions?.paths?.["@/*"] !== undefined) {
    fail(`${relative} 不得恢复仅 TypeScript 可见的 @/* 私有 paths alias`);
  }
}

if (!fs.existsSync(path.join(root, "tsconfig.base.json"))) fail("缺少根级 tsconfig.base.json");
assertRelativeExtends("tsconfig.base.client.json", "./tsconfig.base.json");

const appsRoot = path.join(root, "apps");
if (fs.existsSync(appsRoot)) {
  for (const entry of fs.readdirSync(appsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = `apps/${entry.name}/tsconfig.json`;
    if (fs.existsSync(path.join(root, relative))) assertRelativeExtends(relative, "../../tsconfig.base.client.json");
  }
}

const packagesRoot = path.join(root, "packages");
if (fs.existsSync(packagesRoot)) {
  for (const family of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue;
    const familyRoot = path.join(packagesRoot, family.name);
    for (const pkg of fs.readdirSync(familyRoot, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const relative = `packages/${family.name}/${pkg.name}/tsconfig.json`;
      if (!fs.existsSync(path.join(root, relative))) continue;
      const expected = family.name === "client" ? "../../../tsconfig.base.client.json" : "../../../tsconfig.base.json";
      assertRelativeExtends(relative, expected);
    }
  }
}

console.log("LFAA tsconfig reference check passed.");
