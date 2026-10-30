/** 功能：回归 Electron Claude SDK 按需组件的锁定清单、单并发和完整性失败闭锁。关联 Owner：subagent-claude-code、home-paths、desktop-electron。 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureClaudeSdkExecutable } from "../../../packages/subagent/subagent-claude-code/src/claude-sdk-component.mjs";
import {
  CLAUDE_SDK_COMPONENT_INTEGRITY,
  CLAUDE_SDK_COMPONENT_PACKAGE,
  CLAUDE_SDK_COMPONENT_TARBALL_URL,
  CLAUDE_SDK_COMPONENT_VERSION
} from "../../../packages/subagent/subagent-claude-code/src/claude-sdk-component-contract.mjs";

const root = await mkdtemp(join(tmpdir(), "lfaa-claude-sdk-component-test-"));
const manifestPath = join(root, "claude-sdk-component.json");
const homeDirectory = join(root, "home");
await mkdir(homeDirectory, { recursive: true });

function createManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    platform: "win32-x64",
    packageName: CLAUDE_SDK_COMPONENT_PACKAGE,
    version: CLAUDE_SDK_COMPONENT_VERSION,
    tarballUrl: CLAUDE_SDK_COMPONENT_TARBALL_URL,
    integrity: CLAUDE_SDK_COMPONENT_INTEGRITY,
    binaryArchivePath: "package/claude.exe",
    binaryFileName: "claude.exe",
    binarySizeBytes: 3,
    binarySha256: "a".repeat(64),
    ...overrides
  };
}

async function writeManifest(overrides = {}) {
  await writeFile(manifestPath, `${JSON.stringify(createManifest(overrides))}\n`, "utf8");
}

test("非打包环境不触发 Claude SDK 下载", async () => {
  let called = false;
  const result = await ensureClaudeSdkExecutable({ manifestPath: "", fetcher: async () => { called = true; throw new Error("unexpected network"); } });
  assert.equal(result, undefined);
  assert.equal(called, false);
});

test("组件清单不能替换锁定版本、官方来源或包完整性", async () => {
  await writeManifest({ tarballUrl: "https://example.invalid/claude.tgz" });
  await assert.rejects(
    ensureClaudeSdkExecutable({ manifestPath, homeDirectory, fetcher: async () => { throw new Error("unexpected network"); } }),
    /清单与当前 Windows x64 锁定版本不匹配/u
  );
  await writeManifest({ integrity: "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" });
  await assert.rejects(
    ensureClaudeSdkExecutable({ manifestPath, homeDirectory, fetcher: async () => { throw new Error("unexpected network"); } }),
    /清单与当前 Windows x64 锁定版本不匹配/u
  );
});

test("并发首次调用共用下载，归档完整性失败时不留可执行文件或临时包", async () => {
  await writeManifest();
  const archive = Buffer.from("untrusted test archive", "utf8");
  let fetchCount = 0;
  let resolveFetchStarted;
  const fetchStarted = new Promise(resolvePromise => { resolveFetchStarted = resolvePromise; });
  let resolveResponse;
  const responseGate = new Promise(resolvePromise => { resolveResponse = resolvePromise; });
  const fetcher = async (url, options) => {
    fetchCount += 1;
    assert.equal(url, CLAUDE_SDK_COMPONENT_TARBALL_URL);
    assert.equal(options.redirect, "error");
    resolveFetchStarted();
    await responseGate;
    return new Response(archive, { status: 200, headers: { "content-length": String(archive.length) } });
  };
  const options = { manifestPath, homeDirectory, fetcher };
  const first = ensureClaudeSdkExecutable(options);
  await fetchStarted;
  const second = ensureClaudeSdkExecutable(options);
  resolveResponse();
  const results = await Promise.allSettled([first, second]);
  assert.equal(fetchCount, 1);
  assert.ok(results.every(result => result.status === "rejected"));
  assert.ok(results.every(result => /完整性校验失败/u.test(result.reason.message)));

  const runtimeComponents = join(homeDirectory, "runtime-components");
  const componentEntries = await readdir(join(runtimeComponents, "claude-agent-sdk"));
  assert.deepEqual(componentEntries, []);
  assert.deepEqual(await readdir(runtimeComponents), ["claude-agent-sdk"]);
});

after(async () => {
  assert.ok(root.startsWith(join(tmpdir(), "lfaa-claude-sdk-component-test-")));
  await rm(root, { recursive: true, force: true });
});
