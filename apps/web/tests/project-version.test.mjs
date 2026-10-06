import assert from "node:assert/strict";
import test from "node:test";
import { createProjectBuildMetadata } from "../scripts/project-version.mjs";

const packages = {
  projectPackage: {
    version: "0.0.3",
    repository: { url: "git+https://github.com/yubboo/LFAA.git" }
  },
  webPackage: { version: "0.0.3" },
  electronPackage: { version: "0.0.3" }
};

test("从当前产品包版本生成受限的官方更新地址", () => {
  assert.deepEqual(createProjectBuildMetadata(packages), {
    currentVersion: "0.0.3",
    updateManifestUrl: "https://raw.githubusercontent.com/yubboo/LFAA/main/update.json",
    feedUrl: "https://github.com/yubboo/LFAA/releases/latest/download/",
    releasePage: "https://github.com/yubboo/LFAA/releases"
  });
});

test("拒绝不一致或非稳定版的产品包版本", () => {
  assert.throws(() => createProjectBuildMetadata({
    ...packages,
    webPackage: { version: "0.0.2" }
  }), /项目版本不一致/u);
  assert.throws(() => createProjectBuildMetadata({
    ...packages,
    projectPackage: { ...packages.projectPackage, version: "0.0.3-beta.1" }
  }), /稳定版/u);
});

test("拒绝非 GitHub HTTPS 仓库或多段仓库路径", () => {
  for (const url of [
    "http://github.com/yubboo/LFAA.git",
    "https://example.com/yubboo/LFAA.git",
    "https://github.com/yubboo/LFAA/other.git",
    "https://user:pass@github.com/yubboo/LFAA.git"
  ]) {
    assert.throws(() => createProjectBuildMetadata({
      ...packages,
      projectPackage: { ...packages.projectPackage, repository: { url } }
    }), /仓库地址必须/u);
  }
});
