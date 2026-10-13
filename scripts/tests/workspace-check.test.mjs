/** 功能：回归工作区门禁。作用：用隔离仓库证明入口/依赖/环/版本/产物违规会失败。关联文件：check-workspace.mjs、harness-workspace.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, rmdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
test("同步 TSX 入口后门禁拒绝缺失入口、漏声明、依赖环、版本与包内产物", () => {
  const parent = resolve(root, "dist/.tmp"); mkdirSync(parent, { recursive: true });
  const fixture = mkdtempSync(join(parent, "lfaa-workspace-check-"));
  const write = (path, content) => { const target = resolve(fixture, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content)); };
  const a = { name: "lfaa-a", exports: { ".": "./src/index.tsx" } }, b = { name: "lfaa-b", exports: { ".": "./src/index.mjs" } };
  const run = (...args) => spawnSync(process.execPath, [resolve(fixture, "scripts/check-workspace.mjs"), ...args], { encoding: "utf8" });
  const rejected = pattern => { const result = run(); assert.equal(result.status, 1); assert.match(result.stderr, pattern); };
  try {
    for (const path of ["scripts/check-workspace.mjs", "scripts/harness-workspace.mjs"]) { mkdirSync(resolve(fixture, "scripts"), { recursive: true }); cpSync(resolve(root, path), resolve(fixture, path)); }
    write("package.json", { type: "module" }); write("packages/util/a/package.json", a); write("packages/util/a/src/index.tsx", "export const a = 1;");
    write("packages/util/b/package.json", b); write("packages/util/b/src/index.mjs", "export const b = 1;");
    for (const path of ["apps/cli/package.json", "apps/web/package.json", "apps/desktop-electron/package.json", "update.json"]) write(path, { version: "0.0.7" });
    for (const path of ["tsconfig.client.json", "tsconfig.host.json"]) write(path, { compilerOptions: { paths: {} } });
    write("docs/harness-packages.json", { reference: "https://github.com/deepseek-ai/deepseek-harness", commit: "fixture", packages: [] });
    write("docs/updata-log.md", "**项目版本：** `LFAA 0.0.7`\n## #1 fixture\n"); write("README.md", "fixture"); write("开发规范.md", "fixture");
    write("docs/系统总体架构.md", "fixture"); write("docs/archive/audits/harness-p0-audit.md", "fixture");
    const synced = run("--write"); assert.equal(synced.status, 0, synced.stderr); assert.equal(run().status, 0);
    write("packages/util/a/package.json", { ...a, exports: { ".": "./src/missing.ts" } }); rejected(/公开入口不存在/); write("packages/util/a/package.json", a);
    write("packages/util/a/src/index.tsx", 'import {b} from "lfaa-b/src/index.mjs";'); rejected(/未声明内部依赖/);
    write("packages/util/a/package.json", { ...a, dependencies: { "lfaa-b": "workspace:*" } });
    write("packages/util/b/package.json", { ...b, dependencies: { "lfaa-a": "workspace:*" } }); rejected(/包依赖环/); write("packages/util/b/package.json", b);
    write("packages/util/a/src/index.tsx", "export const a = 1;"); write("packages/util/a/package.json", a);
    write("update.json", { version: "0.0.8" }); rejected(/产品版本/); write("update.json", { version: "0.0.7" });
    mkdirSync(resolve(fixture, "packages/util/a/dist")); rejected(/包内构建目录/); rmdirSync(resolve(fixture, "packages/util/a/dist"));
    write("docs/broken.md", "[missing](missing.md)"); rejected(/链接不存在/);
    write("docs/broken.md", "[contract](#lfaa-missing)"); rejected(/合同锚点不存在/);
    write("docs/broken.md", "fixture"); write("docs/topic.zh.md", "fixture"); rejected(/配对英文/);
  } finally { assert.equal(dirname(fixture), parent); rmSync(fixture, { recursive: true, force: true }); }
});
