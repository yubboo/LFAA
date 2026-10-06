import assert from "node:assert/strict";
import test from "node:test";
import { compareStableVersions, getElectronUpdateFeedUrl, getLfaaUpdateManifestUrl, validateLfaaUpdateManifest } from "../src/update-manifest.mjs";

const feedUrl = "https://github.com/yubboo/LFAA/releases/latest/download/";
const validManifest = {
  schemaVersion: 1,
  enabled: true,
  channel: "stable",
  version: "0.1.1",
  title: "LFAA 0.1.1",
  publishedAt: "2026-09-28",
  releaseNotes: ["工作区布局与交互状态修复。"],
  mandatory: false,
  minimumSupportedVersion: "0.0.1",
  releasePage: "https://github.com/yubboo/LFAA/releases",
  feedUrl: feedUrl.replace(/\/$/, "")
};

test("稳定版语义版本按每段数字排序", () => {
  assert.equal(compareStableVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareStableVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareStableVersions("0.1.1", "0.2.0"), -1);
});

test("从已配置的 GitHub Releases 源定位 main 分支更新清单", () => {
  assert.equal(
    getLfaaUpdateManifestUrl(feedUrl),
    "https://raw.githubusercontent.com/yubboo/LFAA/main/update.json"
  );
});

test("从 Electron Builder 生成的 app-update.yml 读取 Generic 更新源", () => {
  assert.equal(getElectronUpdateFeedUrl(`provider: generic\nurl: ${feedUrl}\n`), feedUrl.replace(/\/$/, ""));
  assert.throws(() => getElectronUpdateFeedUrl("provider: github\nowner: yubboo\nrepo: LFAA\n"), /Generic/);
  assert.throws(() => getElectronUpdateFeedUrl("provider: generic\nurl: https://attacker.example/releases/latest/download\n"), /GitHub/);
});

test("接受与 Electron 发布源一致的 LFAA 清单", () => {
  assert.deepEqual(validateLfaaUpdateManifest(validManifest, feedUrl), validManifest);
});

test("拒绝被替换到其他主机的更新源", () => {
  assert.throws(() => validateLfaaUpdateManifest({
    ...validManifest,
    feedUrl: "https://attacker.example/releases/latest/download"
  }, feedUrl), /HTTPS GitHub Releases/);
});

test("拒绝与安装包内发布源不一致的清单", () => {
  assert.throws(() => validateLfaaUpdateManifest({
    ...validManifest,
    feedUrl: "https://github.com/another/project/releases/latest/download"
  }, feedUrl), /不一致/);
});

test("拒绝非法日期、无效版本与不支持的渠道", () => {
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, publishedAt: "2026-02-30" }, feedUrl), /日期/);
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, version: "v0.1.1" }, feedUrl), /SemVer/);
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, channel: "beta" }, feedUrl), /stable/);
});

test("拒绝格式错误或超限的版本说明列表", () => {
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, releaseNotes: "纯文本" }, feedUrl), /releaseNotes/);
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, releaseNotes: [""] }, feedUrl), /releaseNotes/);
  assert.throws(() => validateLfaaUpdateManifest({ ...validManifest, releaseNotes: ["a".repeat(12_001)] }, feedUrl), /releaseNotes/);
});

test("拒绝最低支持版本高于发布版本", () => {
  assert.throws(() => validateLfaaUpdateManifest({
    ...validManifest,
    minimumSupportedVersion: "0.2.0"
  }, feedUrl), /不能高于清单版本/);
});
