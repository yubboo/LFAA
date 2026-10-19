import assert from "node:assert/strict";
import test from "node:test";
import { createProjectBuildMetadata } from "../scripts/project-version.mjs";

const packages = {
  projectPackage: {
    version: "0.0.3",
    repository: { url: "git+https://github.com/yubboo/LFAA.git" }
  },
  webPackage: { version: "0.0.3" },
  electronPackage: { version: "0.0.3" },
  releaseManifest: {
    version: "0.0.3",
    title: "LFAA 0.0.3",
    publishedAt: "2026-10-01",
    releaseNotes: ["修复工作台显示问题", "改善更新检查"]
  }
};

test("从当前产品包版本生成受限的官方更新地址", () => {
  assert.deepEqual(createProjectBuildMetadata(packages), {
    currentVersion: "0.0.3",
    publishedAt: "2026-10-01",
    releaseNotes: ["修复工作台显示问题", "改善更新检查"],
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

test("拒绝与产品版本不一致或内容无效的公告清单", () => {
  assert.throws(() => createProjectBuildMetadata({
    ...packages,
    releaseManifest: { ...packages.releaseManifest, version: "0.0.4", title: "LFAA 0.0.4" }
  }), /当前产品版本一致/u);
  assert.throws(() => createProjectBuildMetadata({
    ...packages,
    releaseManifest: { ...packages.releaseManifest, publishedAt: "2026-02-31" }
  }), /发布日期无效/u);
  assert.throws(() => createProjectBuildMetadata({
    ...packages,
    releaseManifest: { ...packages.releaseManifest, releaseNotes: [] }
  }), /公告内容/u);
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
