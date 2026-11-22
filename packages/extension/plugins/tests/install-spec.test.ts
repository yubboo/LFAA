// 验证插件安装来源解析：npm 包名、GitHub 地址、本地目录与压缩包各自归类，非法输入明确拒绝。
import assert from "node:assert/strict";
import test from "node:test";
import { InvalidInstallSpecError, parseInstallSpec } from "../src/catalog/install-spec";

test("npm 包名与版本", () => {
  assert.deepEqual(parseInstallSpec("@lfaa/browser"), { kind: "registry", spec: "@lfaa/browser", name: "@lfaa/browser" });
  const versioned = parseInstallSpec("dsh-plugin-whale-pet@1.2.3");
  assert.equal(versioned.kind, "registry");
  assert.equal(versioned.name, "dsh-plugin-whale-pet");
  assert.equal(versioned.target, "1.2.3");
});

test("GitHub 与 Git 仓库地址", () => {
  for (const spec of [
    "github:owner/repo",
    "git+https://github.com/owner/repo.git",
    "git@github.com:owner/repo.git",
    "https://github.com/owner/repo",
  ]) {
    const parsed = parseInstallSpec(spec);
    assert.equal(parsed.kind, "git", spec);
    assert.ok(parsed.host, spec);
  }
});

test("本地目录与压缩包", () => {
  const dir = parseInstallSpec("C:\\plugins\\my-plugin");
  assert.equal(dir.kind, "path");
  assert.equal(dir.target, "C:\\plugins\\my-plugin");

  const linked = parseInstallSpec("link:C:\\plugins\\my-plugin");
  assert.equal(linked.kind, "path");

  const tgz = parseInstallSpec("C:\\plugins\\my-plugin.tgz");
  assert.equal(tgz.kind, "tarball");

  const url = parseInstallSpec("https://example.com/plugin.tgz");
  assert.equal(url.kind, "tarball");
  assert.equal(url.host, "example.com");
});

test("非法输入明确拒绝", () => {
  for (const spec of ["", "   ", "./relative-plugin", "https://example.com/not-a-repo", "@bad name"]) {
    assert.throws(() => parseInstallSpec(spec), InvalidInstallSpecError, spec);
  }
});