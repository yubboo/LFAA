import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopUpdateFlow } from "../src/update-flow.mjs";

function createHarness(overrides = {}) {
  const calls = { readManifest: 0, checkReleaseFeed: 0, promptForUpdate: 0, beginDownload: 0, errors: [] };
  const manifest = {
    enabled: true,
    version: "0.2.0",
    releaseNotes: ["更新说明"],
    mandatory: false,
    minimumSupportedVersion: "0.0.1"
  };
  const flow = createDesktopUpdateFlow({
    isSupported: () => true,
    getCurrentVersion: () => "0.1.1",
    readManifest: async () => { calls.readManifest += 1; return manifest; },
    checkReleaseFeed: async () => { calls.checkReleaseFeed += 1; return { isUpdateAvailable: true, updateInfo: { version: "0.2.0" } }; },
    promptForUpdate: async () => { calls.promptForUpdate += 1; return "accept"; },
    beginDownload: () => { calls.beginDownload += 1; },
    onError: (error, phase) => calls.errors.push({ message: error.message, phase }),
    ...overrides
  });
  return { calls, flow, manifest };
}

test("非打包或不支持的平台不读取远端清单", async () => {
  const { calls, flow } = createHarness({ isSupported: () => false });
  assert.deepEqual(await flow.check({ manual: true }), { status: "unsupported", currentVersion: "0.1.1" });
  assert.equal(calls.readManifest, 0);
});

test("当前版本与清单一致时报告已是最新且不访问安装源", async () => {
  const { calls, flow, manifest } = createHarness({
    readManifest: async () => { calls.readManifest += 1; return { ...manifest, version: "0.1.1" }; }
  });
  const result = await flow.check({ manual: true });
  assert.equal(result.status, "up-to-date");
  assert.equal(result.currentVersion, "0.1.1");
  assert.equal(calls.checkReleaseFeed, 0);
  assert.equal(calls.promptForUpdate, 0);
});

test("发布清单关闭更新时报告当前策略且不访问安装源", async () => {
  const { calls, flow, manifest } = createHarness({
    readManifest: async () => { calls.readManifest += 1; return { ...manifest, enabled: false }; }
  });
  assert.equal((await flow.check({ manual: true })).status, "disabled");
  assert.equal(calls.checkReleaseFeed, 0);
  assert.equal(calls.promptForUpdate, 0);
});

test("清单与 Release feed 版本不一致时拒绝弹出更新并拒绝下载", async () => {
  const { calls, flow } = createHarness({
    checkReleaseFeed: async () => { calls.checkReleaseFeed += 1; return { isUpdateAvailable: true, updateInfo: { version: "0.3.0" } }; }
  });
  const result = await flow.check({ manual: true });
  assert.equal(result.status, "error");
  assert.match(result.message, /版本不一致/);
  assert.equal(calls.promptForUpdate, 0);
  assert.equal(calls.beginDownload, 0);
  assert.equal(calls.errors[0]?.phase, "check");
});

test("用户暂缓后不下载；再次手动检查可重新询问", async () => {
  const { calls, flow } = createHarness({
    promptForUpdate: async () => { calls.promptForUpdate += 1; return calls.promptForUpdate === 1 ? "defer" : "accept"; }
  });
  assert.equal((await flow.check()).status, "deferred");
  assert.equal(calls.beginDownload, 0);
  assert.equal((await flow.check()).status, "deferred");
  assert.equal(calls.promptForUpdate, 1);
  assert.equal((await flow.check({ manual: true })).status, "downloading");
  assert.equal(calls.promptForUpdate, 2);
  assert.equal(calls.beginDownload, 1);
});

test("低于最低支持版本时向宿主传递强制更新状态", async () => {
  const { calls, flow, manifest } = createHarness({
    readManifest: async () => { calls.readManifest += 1; return { ...manifest, minimumSupportedVersion: "0.2.0", mandatory: true }; },
    promptForUpdate: async (_manifest, options) => {
      calls.promptForUpdate += 1;
      assert.equal(options.mustInstall, true);
      return "accept";
    }
  });
  assert.equal((await flow.check({ manual: true })).status, "downloading");
  assert.equal(calls.beginDownload, 1);
});

test("接受更新后开始下载，完成后后续检查报告已下载", async () => {
  const { calls, flow } = createHarness();
  assert.equal((await flow.check({ manual: true })).status, "downloading");
  assert.equal(calls.beginDownload, 1);
  assert.equal(flow.markDownloaded("0.3.0"), false);
  assert.equal(flow.markDownloaded("0.2.0"), true);
  assert.deepEqual(await flow.check({ manual: true }), { status: "downloaded", currentVersion: "0.1.1", latestVersion: "0.2.0" });
});

test("并发手动检查合并为一次远端检查与一次用户提示", async () => {
  let finishCheck;
  const { calls, flow } = createHarness({
    checkReleaseFeed: () => {
      calls.checkReleaseFeed += 1;
      return new Promise(resolve => { finishCheck = () => resolve({ isUpdateAvailable: true, updateInfo: { version: "0.2.0" } }); });
    }
  });
  const first = flow.check({ manual: true });
  const second = flow.check({ manual: true });
  await new Promise(resolve => setImmediate(resolve));
  finishCheck();
  const results = await Promise.all([first, second]);
  assert.equal(results[0].status, "downloading");
  assert.equal(results[1].status, "downloading");
  assert.equal(calls.readManifest, 1);
  assert.equal(calls.checkReleaseFeed, 1);
  assert.equal(calls.promptForUpdate, 1);
  assert.equal(calls.beginDownload, 1);
});

test("下载失败后释放下载锁并记录诊断", async () => {
  const { calls, flow } = createHarness({
    beginDownload: async () => { calls.beginDownload += 1; throw new Error("network failed"); }
  });
  assert.equal((await flow.check({ manual: true })).status, "downloading");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(flow.markDownloadFailed("0.2.0"), false);
  assert.equal(calls.errors[0]?.phase, "download");
});
