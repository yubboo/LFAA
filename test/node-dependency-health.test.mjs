/**
 * 文件：node-dependency-health.test.mjs
 * 作用：证明真实依赖健康检查不会被残留 package.json 或旧缓存欺骗。
 * 负责：健康 fixture、入口损坏、依赖缺失三类纯本地回归。
 * 不负责：Windows PowerShell、pnpm 网络下载或真实 registry。
 * 状态归属：测试临时目录。
 * 对外接口：Node test runner。
 * 关联文件：scripts/node-dependency-health-check.mjs。
 * 修改注意事项：至少保留“package.json 仍在但入口已删”这一核心防回归用例。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkNodeDependencyHealth } from "../scripts/node-dependency-health-check.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-dependency-health-"));
  fs.mkdirSync(path.join(root, "node_modules", "demo-dep"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "fixture",
    version: "1.0.0",
    dependencies: { "demo-dep": "1.2.3" },
  }, null, 2));
  fs.writeFileSync(path.join(root, "node_modules", "demo-dep", "package.json"), JSON.stringify({
    name: "demo-dep",
    version: "1.2.3",
    main: "index.js",
  }, null, 2));
  fs.writeFileSync(path.join(root, "node_modules", "demo-dep", "index.js"), "module.exports = 42;\n");
  return root;
}

test("healthy dependency is resolved from the real importer", () => {
  const root = fixture();
  try {
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, true);
    assert.equal(result.checked, 1);
    assert.equal(result.resolved, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remaining package.json cannot hide a deleted runtime entry", () => {
  const root = fixture();
  try {
    fs.rmSync(path.join(root, "node_modules", "demo-dep", "index.js"));
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, false);
    assert.match(result.issues.join("\n"), /无法从当前 workspace 真实解析|不存在的入口/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("missing dependency directory is reported", () => {
  const root = fixture();
  try {
    fs.rmSync(path.join(root, "node_modules", "demo-dep"), { recursive: true, force: true });
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, false);
    assert.match(result.issues.join("\n"), /缺少 demo-dep/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
