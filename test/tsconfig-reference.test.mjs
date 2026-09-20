/**
 * 文件：tsconfig-reference.test.mjs
 * 作用：锁住 Harness capability-family 目录下的 tsconfig 继承关系，防止目录迁移后再次到 Vite 启动阶段才暴露 extends 失效。
 * 负责：验证当前仓库合法继承、两层 package 旧深度错误、私有 @/* paths alias 回流三类场景。
 * 不负责：TypeScript 业务类型检查、Vite 构建、依赖安装。
 * 状态归属：无状态；每个测试使用当前仓库或临时目录。
 * 对外接口：node --test test/tsconfig-reference.test.mjs。
 * 关联文件：scripts/tsconfig-reference-check.mjs、tsconfig.base.json、tsconfig.base.client.json。
 * 修改注意事项：只测试工程配置继承规则；不得把允许的 tsconfig ../ 误扩展为业务源码跨 package 相对引用。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.join(repoRoot, "scripts/tsconfig-reference-check.mjs");

function run(cwd) {
  return spawnSync(process.execPath, [checker], { cwd, encoding: "utf8" });
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-tsconfig-"));
  fs.mkdirSync(path.join(root, "apps/web"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages/client/ui"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages/core/agent-runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.base.json"), JSON.stringify({ compilerOptions: { strict: true } }));
  fs.writeFileSync(path.join(root, "tsconfig.base.client.json"), JSON.stringify({ extends: "./tsconfig.base.json" }));
  fs.writeFileSync(path.join(root, "apps/web/tsconfig.json"), JSON.stringify({ extends: "../../tsconfig.base.client.json" }));
  fs.writeFileSync(path.join(root, "packages/client/ui/tsconfig.json"), JSON.stringify({ extends: "../../../tsconfig.base.client.json" }));
  fs.writeFileSync(path.join(root, "packages/core/agent-runtime/tsconfig.json"), JSON.stringify({ extends: "../../../tsconfig.base.json" }));
  return root;
}

test("当前仓库 tsconfig 引用检查通过", () => {
  const result = run(repoRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("两层 package 仍使用旧 ../../ extends 时必须失败", () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, "packages/core/agent-runtime/tsconfig.json"), JSON.stringify({ extends: "../../tsconfig.base.json" }));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /extends 应为/);
});

test("仅 TypeScript 可见的 @\/* 私有 alias 回流时必须失败", () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, "packages/client/ui/tsconfig.json"), JSON.stringify({
    extends: "../../../tsconfig.base.client.json",
    compilerOptions: { paths: { "@/*": ["./src/*"] } }
  }));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /@\/\*/);
});
