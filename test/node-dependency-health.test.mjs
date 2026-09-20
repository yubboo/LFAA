/**
 * 文件：node-dependency-health.test.mjs
 * 作用：证明真实依赖健康检查覆盖 pnpm-workspace.yaml 的全部 importer，不会被旧目录层级、残留 package.json 或旧缓存欺骗。
 * 负责：根 importer、两层 capability-family workspace、lockfile importer/specifier、入口损坏、依赖缺失回归。
 * 不负责：Windows PowerShell、pnpm 网络下载或真实 registry。
 * 状态归属：测试临时目录。
 * 对外接口：Node test runner。
 * 关联文件：scripts/node-dependency-health-check.mjs、pnpm-workspace.yaml、pnpm-lock.yaml。
 * 修改注意事项：至少保留 capability-family 两层 workspace 扫描和“package.json 仍在但入口已删”两个核心用例。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkNodeDependencyHealth, listWorkspacePackageFiles } from "../scripts/node-dependency-health-check.mjs";

function writeExternalDependency(importerDir, name = "demo-dep", version = "1.2.3") {
  const depDir = path.join(importerDir, "node_modules", ...name.split("/"));
  fs.mkdirSync(depDir, { recursive: true });
  fs.writeFileSync(path.join(depDir, "package.json"), JSON.stringify({ name, version, main: "index.js" }, null, 2));
  fs.writeFileSync(path.join(depDir, "index.js"), "module.exports = 42;\n");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-dependency-health-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "fixture",
    version: "1.0.0",
    dependencies: { "demo-dep": "1.2.3" },
  }, null, 2));
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .:",
    "    dependencies:",
    "      demo-dep:",
    "        specifier: 1.2.3",
    "        version: 1.2.3",
    "",
  ].join("\n"));
  writeExternalDependency(root);
  return root;
}

function nestedWorkspaceFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-dependency-workspace-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture-root", version: "1.0.0" }, null, 2));
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*/*"\n');

  const pkgDir = path.join(root, "packages", "client", "widget");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({
    name: "@fixture/widget",
    version: "1.0.0",
    dependencies: { "demo-dep": "1.2.3" },
  }, null, 2));
  writeExternalDependency(pkgDir);

  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .: {}",
    "  packages/client/widget:",
    "    dependencies:",
    "      demo-dep:",
    "        specifier: 1.2.3",
    "        version: 1.2.3",
    "",
  ].join("\n"));
  return { root, pkgDir };
}

test("healthy dependency is resolved from the real importer", () => {
  const root = fixture();
  try {
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, true);
    assert.equal(result.workspacePackages, 1);
    assert.equal(result.checked, 1);
    assert.equal(result.externalChecked, 1);
    assert.equal(result.externalResolved, 1);
    assert.equal(result.lockComplete, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("capability-family packages two levels deep are discovered from pnpm-workspace.yaml", () => {
  const { root } = nestedWorkspaceFixture();
  try {
    const files = listWorkspacePackageFiles(root).map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
    assert.deepEqual(files, ["package.json", "packages/client/widget/package.json"]);
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, true);
    assert.equal(result.workspacePackages, 2);
    assert.equal(result.externalChecked, 1);
    assert.equal(result.externalResolved, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a new dependency in a nested workspace is detected when importer node_modules has not been synchronized", () => {
  const { root, pkgDir } = nestedWorkspaceFixture();
  try {
    fs.rmSync(path.join(pkgDir, "node_modules", "demo-dep"), { recursive: true, force: true });
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, false);
    assert.match(result.issues.join("\n"), /packages\/client\/widget\/package\.json: 缺少 demo-dep/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a package.json dependency that is not recorded in the same lockfile importer is detected", () => {
  const { root } = nestedWorkspaceFixture();
  try {
    const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8").replace(/\n      demo-dep:[\s\S]*?\n        version: 1\.2\.3/u, "");
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), lock);
    const result = checkNodeDependencyHealth(root);
    assert.equal(result.complete, false);
    assert.equal(result.lockComplete, false);
    assert.match(result.lockIssues.join("\n"), /packages\/client\/widget: lockfile 缺少 dependencies\.demo-dep/);
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


test("workspace dependency links are verified against the declared workspace owner", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-workspace-link-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture-root", version: "1.0.0" }, null, 2));
    fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*/*"\n');
    const baseDir = path.join(root, "packages", "core", "base");
    const consumerDir = path.join(root, "packages", "client", "consumer");
    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, "package.json"), JSON.stringify({ name: "@fixture/base", version: "1.0.0", exports: "./index.js" }, null, 2));
    fs.writeFileSync(path.join(baseDir, "index.js"), "export const value = 1;\n");
    fs.writeFileSync(path.join(consumerDir, "package.json"), JSON.stringify({
      name: "@fixture/consumer",
      version: "1.0.0",
      dependencies: { "@fixture/base": "workspace:*" },
    }, null, 2));
    const link = path.join(consumerDir, "node_modules", "@fixture", "base");
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(baseDir, link, process.platform === "win32" ? "junction" : "dir");
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), [
      "lockfileVersion: '9.0'",
      "importers:",
      "  .: {}",
      "  packages/core/base: {}",
      "  packages/client/consumer:",
      "    dependencies:",
      "      '@fixture/base':",
      "        specifier: workspace:*",
      "        version: link:../../core/base",
      "",
    ].join("\n"));
    const healthy = checkNodeDependencyHealth(root);
    assert.equal(healthy.complete, true);
    assert.equal(healthy.workspaceChecked, 1);
    assert.equal(healthy.workspaceResolved, 1);

    fs.rmSync(link, { recursive: true, force: true });
    const broken = checkNodeDependencyHealth(root);
    assert.equal(broken.complete, false);
    assert.match(broken.runtimeIssues.join("\n"), /缺少 @fixture\/base 的直接 node_modules 链接/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("current LFAA repository dependency scanner sees every workspace importer after capability-family migration", () => {
  const root = process.cwd();
  const files = listWorkspacePackageFiles(root).map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
  assert.equal(files.length, 25);
  assert.ok(files.includes("apps/web/package.json"));
  assert.ok(files.includes("packages/core/agent-runtime/package.json"));
  assert.ok(files.includes("packages/client/ui-terminal/package.json"));
  assert.ok(files.includes("packages/terminal/terminal-vite/package.json"));
  assert.equal(files.some((file) => /^packages\/[^/]+\/package\.json$/u.test(file)), false, "old flat packages must not be the scanner model");
});
