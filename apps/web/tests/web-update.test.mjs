import assert from "node:assert/strict";
import test from "node:test";
import { inspectWebUpdateManifest } from "../../../packages/client/ui-settings/src/web-update.mjs";

const options = {
  currentVersion: "0.0.2",
  expectedFeedUrl: "https://github.com/yubboo/LFAA/releases/latest/download/",
  expectedReleasePage: "https://github.com/yubboo/LFAA/releases"
};

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    channel: "stable",
    version: "0.0.3",
    title: "LFAA 0.0.3",
    publishedAt: "2026-10-06",
    releaseNotes: ["改进工作区稳定性。"],
    mandatory: false,
    minimumSupportedVersion: "0.0.1",
    releasePage: options.expectedReleasePage,
    feedUrl: options.expectedFeedUrl,
    ...overrides
  };
}

test("识别新版并只返回经过校验的说明和官方发布页", () => {
  const result = inspectWebUpdateManifest(manifest(), options);
  assert.equal(result.status, "available");
  assert.equal(result.currentVersion, "0.0.2");
  assert.equal(result.latestVersion, "0.0.3");
  assert.deepEqual(result.releaseNotes, ["改进工作区稳定性。"]);
  assert.equal(result.releasePage, options.expectedReleasePage);
});

test("当前版本相同或更新时报告已是最新", () => {
  assert.equal(inspectWebUpdateManifest(manifest({ version: "0.0.2", title: "LFAA 0.0.2" }), options).status, "up-to-date");
  assert.equal(inspectWebUpdateManifest(manifest({
    version: "0.0.1",
    title: "LFAA 0.0.1",
    minimumSupportedVersion: "0.0.0"
  }), options).status, "up-to-date");
});

test("清单停用时不报告为可更新", () => {
  assert.equal(inspectWebUpdateManifest(manifest({ enabled: false }), options).status, "disabled");
});

test("拒绝错误版本、说明、发布日期、更新源和发布链接", () => {
  const invalidCases = [
    { version: "0.0.3-beta", title: "LFAA 0.0.3-beta" },
    { title: "LFAA 9.9.9" },
    { publishedAt: "2026-02-30" },
    { releaseNotes: [" "] },
    { feedUrl: "https://evil.example/download/" },
    { releasePage: "https://evil.example/releases" },
    { minimumSupportedVersion: "0.0.4" }
  ];
  for (const override of invalidCases) assert.throws(() => inspectWebUpdateManifest(manifest(override), options));
});
