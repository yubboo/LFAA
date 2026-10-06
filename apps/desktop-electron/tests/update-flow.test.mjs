import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopUpdateFlow } from "../src/update-flow.mjs";

function createHarness(overrides = {}) {
  const calls = { readManifest: 0, checkReleaseFeed: 0, promptForUpdate: 0, beginDownload: 0, ignored: [], availability: [], errors: [] };
  const manifest = {
    enabled: true,
    version: "0.0.3",
    releaseNotes: ["更新说明"],
    mandatory: false,
    minimumSupportedVersion: "0.0.1"
  };
  const flow = createDesktopUpdateFlow({
    isSupported: () => true,
    getCurrentVersion: () => "0.0.2",
    readManifest: async () => { calls.readManifest += 1; return manifest; },
    checkReleaseFeed: async () => { calls.checkReleaseFeed += 1; return { isUpdateAvailable: true, updateInfo: { version: manifest.version } }; },
    promptForUpdate: async () => { calls.promptForUpdate += 1; return "accept"; },
    getPreferences: async () => ({ autoDownloadAndInstall: false, ignoredVersion: "" }),
    ignoreVersion: async version => { calls.ignored.push(version); },
    onUpdateAvailable: manifest => { calls.availability.push(manifest?.version ?? null); },
    beginDownload: () => { calls.beginDownload += 1; },
    onError: (_error, phase, _manifest, safeMessage) => calls.errors.push({ message: safeMessage, phase }),
    ...overrides
  });
  return { calls, flow, manifest };
}

test("非打包或不支持的平台不读取远端清单", async () => {
  const { calls, flow } = createHarness({ isSupported: () => false });
  assert.deepEqual(await flow.check({ manual: true }), { status: "unsupported", currentVersion: "0.0.2" });
  assert.equal(calls.readManifest, 0);
});

test("当前版本与清单一致时报告已是最新且不访问安装源", async () => {
  const { calls, flow, manifest } = createHarness({
    readManifest: async () => { calls.readManifest += 1; return { ...manifest, version: "0.0.2" }; }
  });
  const result = await flow.check({ manual: true });
  assert.equal(result.status, "up-to-date");
  assert.equal(result.currentVersion, "0.0.2");
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

test("跳过只持久忽略当前版本，随后清除顶部更新入口", async () => {
  const { calls, flow } = createHarness({
    promptForUpdate: async () => { calls.promptForUpdate += 1; return "skip"; }
  });
  const result = await flow.check({ manual: true });
  assert.equal(result.status, "ignored");
  assert.deepEqual(calls.ignored, ["0.0.3"]);
  assert.deepEqual(calls.availability, ["0.0.3", null]);
  assert.equal(calls.beginDownload, 0);
});

test("已跳过版本不会再次提示，新版本仍进入真实 Release feed 校验", async () => {
  const { calls, flow, manifest } = createHarness({
    getPreferences: async () => ({ autoDownloadAndInstall: false, ignoredVersion: "0.0.3" })
  });
  assert.equal((await flow.check()).status, "ignored");
  assert.equal(calls.checkReleaseFeed, 0);
  assert.equal(calls.promptForUpdate, 0);

  manifest.version = "0.0.4";
  assert.equal((await flow.check()).status, "downloading");
  assert.equal(calls.checkReleaseFeed, 1);
  assert.equal(calls.promptForUpdate, 1);
  assert.deepEqual(calls.availability, [null, "0.0.4"]);
});

test("本机自动更新偏好开启时跳过提示并带上自动安装决策开始下载", async () => {
  let downloadOptions;
  const { calls, flow } = createHarness({
    getPreferences: async () => ({ autoDownloadAndInstall: true, ignoredVersion: "" }),
    promptForUpdate: async () => { calls.promptForUpdate += 1; return "defer"; },
    beginDownload: (_manifest, options) => { calls.beginDownload += 1; downloadOptions = options; }
  });
  assert.equal((await flow.check()).status, "downloading");
  assert.equal(calls.promptForUpdate, 0);
  assert.equal(calls.beginDownload, 1);
  assert.deepEqual(downloadOptions, { automaticInstall: true });
});

test("清单与 Release feed 版本不一致时拒绝弹出更新并拒绝下载", async () => {
  const { calls, flow } = createHarness({
    checkReleaseFeed: async () => { calls.checkReleaseFeed += 1; return { isUpdateAvailable: true, updateInfo: { version: "0.0.4" } }; }
  });
  const result = await flow.check({ manual: true });
  assert.equal(result.status, "error");
  assert.match(result.message, /版本不一致/);
  assert.equal(calls.promptForUpdate, 0);
  assert.equal(calls.beginDownload, 0);
  assert.equal(calls.errors[0]?.phase, "check");
});

test("HTTP 404 错误向 UI 和日志返回脱敏摘要", async () => {
  const marker = "COOKIE_MUST_NOT_BE_EXPOSED";
  const { calls, flow } = createHarness({
    checkReleaseFeed: async () => {
      calls.checkReleaseFeed += 1;
      const error = new Error(`HttpError: 404 response headers: Set-Cookie: _gh_sess=${marker}`);
      error.statusCode = 404;
      throw error;
    }
  });

  const result = await flow.check({ manual: true });
  const expectedMessage = "官方更新文件尚未发布或暂时不可用（HTTP 404），请稍后重试。";
  assert.equal(result.status, "error");
  assert.equal(result.message, expectedMessage);
  assert.equal(calls.errors[0]?.message, expectedMessage);
  assert.doesNotMatch(JSON.stringify([result, calls.errors]), /COOKIE_MUST_NOT_BE_EXPOSED|Set-Cookie|headers|HttpError/u);
  assert.equal(calls.promptForUpdate, 0);
  assert.equal(calls.beginDownload, 0);
});

test("用户暂缓后自动和手动检查都不再提示同一版本；重启后可重新询问", async () => {
  const { calls, flow } = createHarness({
    promptForUpdate: async () => { calls.promptForUpdate += 1; return "defer"; }
  });
  assert.equal((await flow.check()).status, "deferred");
  assert.equal(calls.beginDownload, 0);
  assert.equal((await flow.check()).status, "deferred");
  assert.equal((await flow.check({ manual: true })).status, "deferred");
  assert.equal(calls.readManifest, 3);
  assert.equal(calls.promptForUpdate, 1);
  assert.equal(calls.checkReleaseFeed, 1);
  assert.equal(calls.beginDownload, 0);

  const restarted = createHarness();
  assert.equal((await restarted.flow.check()).status, "downloading");
  assert.equal(restarted.calls.promptForUpdate, 1);
  assert.equal(restarted.calls.beginDownload, 1);
});

test("低于最低支持版本时向宿主传递强制更新状态", async () => {
  const { calls, flow, manifest } = createHarness({
    readManifest: async () => { calls.readManifest += 1; return { ...manifest, minimumSupportedVersion: "0.0.3", mandatory: true }; },
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
  assert.equal(flow.markDownloaded("0.0.2"), false);
  assert.equal(flow.markDownloaded("0.0.3"), true);
  assert.deepEqual(await flow.check({ manual: true }), { status: "downloaded", currentVersion: "0.0.2", latestVersion: "0.0.3" });
});

test("并发手动检查合并为一次远端检查与一次用户提示", async () => {
  let finishCheck;
  const { calls, flow } = createHarness({
    checkReleaseFeed: () => {
      calls.checkReleaseFeed += 1;
      return new Promise(resolve => { finishCheck = () => resolve({ isUpdateAvailable: true, updateInfo: { version: "0.0.3" } }); });
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
