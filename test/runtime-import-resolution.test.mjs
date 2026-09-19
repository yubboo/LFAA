/**
 * 文件：runtime-import-resolution.test.mjs
 * 作用：锁定可复用 UI package 的运行时公共子入口可解析，防止 TypeScript path alias 假通过。
 * 负责：验证 Settings 不再使用 @/ 私有 alias、@lfaa/ui/workbench 已由 package exports 公开并可由 Node package resolver 从真实 importer 位置解析。
 * 不负责：启动 Vite dev server、视觉验收、业务测试。
 * 状态归属：无运行时状态。
 * 对外接口：`node --test test/runtime-import-resolution.test.mjs`。
 * 关联文件：packages/ui/package.json、packages/ui/src/features/settings/SettingsPage.tsx、scripts/runtime-import-resolution-check.mjs。
 * 修改注意事项：若更换公共子入口，必须同步 package exports 与运行时解析门禁，禁止恢复 tsconfig-only @/ alias。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const settingsFile = path.join(root, "packages/ui/src/features/settings/SettingsPage.tsx");
const uiPackageFile = path.join(root, "packages/ui/package.json");

test("Settings 通过 @lfaa/ui/workbench 公共子入口复用布局", () => {
  const source = fs.readFileSync(settingsFile, "utf8");
  assert.match(source, /from\s+["']@lfaa\/ui\/workbench["']/);
  assert.doesNotMatch(source, /from\s+["']@\//);
});

test("@lfaa/ui/workbench 在 package exports 中公开且目标存在", () => {
  const pkg = JSON.parse(fs.readFileSync(uiPackageFile, "utf8"));
  assert.equal(pkg.exports["./workbench"], "./src/workbench/index.ts");
  assert.equal(fs.existsSync(path.join(root, "packages/ui/src/workbench/index.ts")), true);
});

test("@lfaa/ui 不再声明 @/* 私有 paths alias", () => {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/tsconfig.json"), "utf8"));
  assert.equal(tsconfig.compilerOptions?.paths?.["@/*"], undefined);
});

test("从真实 Settings importer 位置可解析 @lfaa/ui/workbench", () => {
  const resolver = createRequire(pathToFileURL(settingsFile));
  const resolved = resolver.resolve("@lfaa/ui/workbench");
  assert.equal(path.normalize(resolved), path.normalize(path.join(root, "packages/ui/src/workbench/index.ts")));
});

test("Node/Vite Host 直接加载的 plugin-runtime 使用显式 .ts 相对导入", () => {
  const source = fs.readFileSync(path.join(root, "packages/plugin-runtime/src/index.ts"), "utf8");
  assert.match(source, /from\s+["']\.\/registry\.ts["']/);
  assert.match(source, /from\s+["']\.\/install-spec\.ts["']/);
  assert.match(source, /from\s+["']\.\/lifecycle\.ts["']/);
  assert.doesNotMatch(source, /from\s+["']\.\/(?:registry|install-spec|lifecycle)["']/);
});

test("plugin-sdk 的 source export 可被 Node TypeScript ESM 解析", () => {
  const source = fs.readFileSync(path.join(root, "packages/plugin-sdk/src/index.ts"), "utf8");
  assert.match(source, /from\s+["']\.\/contracts\.ts["']/);
  assert.doesNotMatch(source, /from\s+["']\.\/contracts["']/);
});

test("runtime import Gate 会检查 Node source ESM 扩展名", () => {
  const gate = fs.readFileSync(path.join(root, "scripts/runtime-import-resolution-check.mjs"), "utf8");
  assert.match(gate, /nodeSourceLayers/);
  assert.match(gate, /显式扩展名/);
  assert.match(gate, /apps\/web\/vite\.config\.ts/);
});
