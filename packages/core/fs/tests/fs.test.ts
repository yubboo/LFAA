// 验证工作区路径边界、私有路径过滤与遍历忽略规则。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPrivatePathFilter, resolveSafeWorkspacePath, walkWorkspaceFiles } from "../src";

test("拒绝工作区之外的路径", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-fs-root-"));
  try {
    await fs.writeFile(path.join(root, "a.txt"), "ok", "utf8");
    // 解析结果按真实路径返回（防符号链接逃逸）；Windows CI 的临时目录可能是 RUNNER~1 短路径，比较前先归一。
    const realRoot = await fs.realpath(root);
    const inside = await resolveSafeWorkspacePath("a.txt", [root]);
    assert.equal(inside.path, path.join(realRoot, "a.txt"));
    await assert.rejects(() => resolveSafeWorkspacePath("../escape.txt", [root]), /路径越界拦截/u);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("私有路径不可访问", async () => {
  const isPrivate = await createPrivatePathFilter();
  assert.equal(isPrivate(path.join(os.homedir(), ".lfaa", "llm-config.json")), true);
  assert.equal(isPrivate(path.join(os.homedir(), ".lfaa", "sessions", "a.json")), true);
  assert.equal(isPrivate(path.join(os.tmpdir(), "normal.txt")), false);
});

test("遍历跳过依赖目录并返回相对路径", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-fs-walk-"));
  try {
    await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
    await fs.writeFile(path.join(root, "node_modules", "pkg", "x.js"), "x", "utf8");
    await fs.writeFile(path.join(root, "a.txt"), "ok", "utf8");
    const controller = new AbortController();
    const files = await walkWorkspaceFiles(root, { signal: controller.signal });
    assert.deepEqual(files.map((file) => file.relativePath), ["a.txt"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
