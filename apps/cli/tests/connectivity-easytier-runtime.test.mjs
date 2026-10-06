/** 功能：验收 EasyTier 固定版本安装器。作用：使用临时目录和注入的下载/解压器验证真实性边界，不下载或启动上游程序。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";
import { installEasyTierRuntime, readInstalledEasyTierVersion, validateEasyTierInstallRequest } from "lfaa-host-daemon/src/easytier-runtime.mjs";

async function createFixture(t, version = EASYTIER_RUNTIME_RELEASE.version) {
  const dataDirectory = await mkdtemp(join(tmpdir(), "lfaa-easytier-runtime-"));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));
  const downloaded = [];
  const ensureManagedDirectory = async directory => {
    const path = resolve(directory);
    const rel = relative(dataDirectory, path);
    assert.notEqual(rel, "..");
    assert.equal(rel.startsWith(`..${sep}`) || resolve(rel) === rel, false);
    await mkdir(path, { recursive: true });
  };
  const downloadAndVerify = async (url, destinationPath, integrity) => {
    assert.equal(url, EASYTIER_RUNTIME_RELEASE.url);
    assert.deepEqual(integrity, {
      algorithm: "sha256", digest: EASYTIER_RUNTIME_RELEASE.sha256,
      size: EASYTIER_RUNTIME_RELEASE.sizeBytes, maxBytes: EASYTIER_RUNTIME_RELEASE.maximumBytes
    });
    downloaded.push(url);
    await writeFile(destinationPath, "verified-fixture-archive");
  };
  const expandArchive = async (archivePath, destinationPath) => {
    assert.equal(await readFile(archivePath, "utf8"), "verified-fixture-archive");
    const packageDirectory = join(destinationPath, "easytier-windows-x86_64");
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(join(packageDirectory, "easytier-core.exe"), `fixture:${version}`);
    await writeFile(join(packageDirectory, "LICENSE"), "LGPL-3.0 fixture");
  };
  const probeVersion = async executable => {
    const contents = await readFile(executable, "utf8");
    return contents.startsWith("fixture:") ? contents.slice("fixture:".length) : "";
  };
  return { dataDirectory, downloaded, ensureManagedDirectory, downloadAndVerify, expandArchive, probeVersion };
}

test("只接受注册的 EasyTier 操作、固定版本和精确字段", () => {
  assert.deepEqual(validateEasyTierInstallRequest({ operation: "install-easytier-runtime", version: "2.6.4" }), { operation: "install-easytier-runtime", version: "2.6.4" });
  assert.throws(() => validateEasyTierInstallRequest({ operation: "install-easytier-runtime", version: "latest" }), /未登记/u);
  assert.throws(() => validateEasyTierInstallRequest({ operation: "install-easytier-runtime", version: "2.6.4", command: "whoami" }), /未登记/u);
});

test("校验固定官方资产与核心版本后原子安装，重复操作只做版本回读", async t => {
  const fixture = await createFixture(t);
  const first = await installEasyTierRuntime({ ...fixture, id: "123e4567-e89b-42d3-a456-426614174000" });
  assert.deepEqual(first, { version: "2.6.4", alreadyInstalled: false, capability: EASYTIER_RUNTIME_RELEASE.runtimeCapability });
  assert.deepEqual(fixture.downloaded, [EASYTIER_RUNTIME_RELEASE.url]);
  assert.equal(await readInstalledEasyTierVersion({ dataDirectory: fixture.dataDirectory, probeVersion: fixture.probeVersion }), "2.6.4");
  const installedFiles = await readdir(resolve(fixture.dataDirectory, "environments", "easytier", "v2.6.4", "easytier-windows-x86_64"));
  assert.deepEqual(installedFiles.sort(), ["LICENSE", "easytier-core.exe"]);
  const second = await installEasyTierRuntime({
    ...fixture,
    id: "123e4567-e89b-42d3-a456-426614174001",
    downloadAndVerify: async () => assert.fail("已核验运行包不得重复下载"),
    expandArchive: async () => assert.fail("已核验运行包不得重复解压")
  });
  assert.deepEqual(second, { version: "2.6.4", alreadyInstalled: true, capability: EASYTIER_RUNTIME_RELEASE.runtimeCapability });
});

test("拒绝版本不符的上游程序并清理仅由本次任务创建的暂存文件", async t => {
  const fixture = await createFixture(t, "99.0.0");
  await assert.rejects(installEasyTierRuntime({ ...fixture, id: "123e4567-e89b-42d3-a456-426614174002" }), /版本与固定官方清单不符/u);
  assert.deepEqual(fixture.downloaded, [EASYTIER_RUNTIME_RELEASE.url]);
  assert.equal(await readInstalledEasyTierVersion({ dataDirectory: fixture.dataDirectory, probeVersion: fixture.probeVersion }), null);
  assert.deepEqual(await readdir(resolve(fixture.dataDirectory, "cache", "easytier")), []);
});
