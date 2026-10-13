import assert from "node:assert/strict";
import test from "node:test";
import { fetchLfaaUpdateManifest } from "../src/update-manifest-fetch.mjs";

const feedUrl = "https://github.com/yubboo/LFAA/releases/latest/download";
const manifestUrl = "https://raw.githubusercontent.com/yubboo/LFAA/main/update.json";
const manifest = {
  schemaVersion: 1,
  enabled: true,
  channel: "stable",
  version: "0.0.7",
  title: "LFAA 0.0.7",
  publishedAt: "2026-10-07",
  releaseNotes: ["更新下载进度"],
  mandatory: false,
  minimumSupportedVersion: "0.0.1",
  releasePage: "https://github.com/yubboo/LFAA/releases",
  feedUrl
};

test("使用注入的 Electron 网络请求器读取并校验官方版本清单", async () => {
  let request;
  const result = await fetchLfaaUpdateManifest(async (url, options) => {
    request = { url, options };
    return { ok: true, url: manifestUrl, text: async () => JSON.stringify(manifest) };
  }, feedUrl);

  assert.equal(request.url, manifestUrl);
  assert.equal(request.options.signal instanceof AbortSignal, true);
  assert.equal(result.version, "0.0.7");
});

test("拒绝 HTTP 错误与非预期 URL 跳转", async () => {
  await assert.rejects(fetchLfaaUpdateManifest(async () => ({ ok: false, status: 404 }), feedUrl), /HTTP 404/u);
  await assert.rejects(fetchLfaaUpdateManifest(async () => ({
    ok: true,
    url: "https://attacker.example/main/update.json",
    text: async () => JSON.stringify(manifest)
  }), feedUrl), /非预期/u);
  await assert.rejects(fetchLfaaUpdateManifest(async () => ({
    ok: true,
    url: "https://raw.githubusercontent.com/yubboo/LFAA/attacker/update.json",
    text: async () => JSON.stringify(manifest)
  }), feedUrl), /非预期/u);
});
