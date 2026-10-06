import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  getDesktopPackageBuildState,
  markDesktopPackageBuilt,
  prepareDesktopPackageVersion
} from "../../../scripts/desktop-package-version.mjs";

const version = "0.0.4";
const feedUrl = "https://github.com/yubboo/LFAA/releases/latest/download/";
const initialNotes = ["桌面端新增顶部更新入口", "自动下载并安装默认关闭"];

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "lfaa-desktop-version-"));
  const packageManifests = {
    "apps/cli/package.json": { name: "lfaa-cli", version },
    "apps/web/package.json": { name: "lfaa-web", version },
    "apps/desktop-electron/package.json": {
      name: "lfaa-desktop-electron",
      version,
      build: {
        directories: { output: "../../dist/apps/desktop-electron" },
        publish: [{ provider: "generic", url: feedUrl }]
      }
    }
  };
  for (const [path, manifest] of Object.entries(packageManifests)) {
    const absolutePath = resolve(root, path);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }

  const updateManifest = {
    schemaVersion: 1,
    enabled: true,
    channel: "stable",
    version,
    title: "LFAA " + version,
    publishedAt: "2026-10-07",
    releaseNotes: initialNotes,
    mandatory: false,
    minimumSupportedVersion: "0.0.1",
    releasePage: "https://github.com/yubboo/LFAA/releases",
    feedUrl: feedUrl.replace(/\/$/u, "")
  };
  await writeFile(resolve(root, "update.json"), JSON.stringify(updateManifest, null, 2) + "\n", "utf8");
  const tick = String.fromCharCode(96);
  const changelog = [
    "# LFAA 更新日志",
    "",
    "## #15 当前桌面更新",
    "",
    "- **项目版本：** " + tick + "LFAA " + version + tick,
    "- **日期：** 2026-10-07",
    "- **更新内容：** " + initialNotes.join("；"),
    "- **Windows Electron 包状态：** 待构建",
    "",
    "## #14 上一版本",
    "",
    "- 历史内容",
    ""
  ].join("\r\n");
  await mkdir(resolve(root, "docs"), { recursive: true });
  await writeFile(resolve(root, "docs/updata-log.md"), changelog, "utf8");
  return { root, packageManifests };
}

async function writeMatchingInstaller(root, targetVersion = version) {
  const outputDirectory = resolve(root, "dist/apps/desktop-electron");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "LFAA-" + targetVersion + ".exe"), "installer", "utf8");
  await writeFile(resolve(outputDirectory, "latest.yml"), "version: " + targetVersion + "\npath: LFAA-" + targetVersion + ".exe\n", "utf8");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("首次构建复用待构建的 0.0.4，不提前递增", async (t) => {
  const { root, packageManifests } = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await prepareDesktopPackageVersion(root);

  assert.deepEqual(result, { version, incremented: false });
  assert.equal((await readFile(resolve(root, "docs/updata-log.md"), "utf8")).includes("待构建"), true);
  for (const path of Object.keys(packageManifests)) {
    assert.equal((await readJson(resolve(root, path))).version, version);
  }
});

test("只有安装器与 latest.yml 版本匹配时才登记完成，并保留日志段落换行", async (t) => {
  const { root } = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(markDesktopPackageBuilt(root), /未找到 Electron 安装器/);
  await writeMatchingInstaller(root);
  assert.deepEqual(await markDesktopPackageBuilt(root), { version, alreadyMarked: false });
  const changelog = await readFile(resolve(root, "docs/updata-log.md"), "utf8");
  assert.match(changelog, /Windows Electron 包状态：\*\* 已生成：LFAA-0\.0\.4\.exe\r?\n\r?\n## #14/u);
  assert.deepEqual(await getDesktopPackageBuildState(root), { version, packageStatus: "built" });
});

test("0.0.4 安装器生成后，下一次构建同步递增到 0.0.5", async (t) => {
  const { root, packageManifests } = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMatchingInstaller(root);
  await markDesktopPackageBuilt(root);

  const result = await prepareDesktopPackageVersion(root, { notes: ["修复桌面端启动流程", "优化安装器构建入口"] });

  assert.deepEqual(result, { version: "0.0.5", incremented: true });
  for (const path of Object.keys(packageManifests)) {
    assert.equal((await readJson(resolve(root, path))).version, "0.0.5");
  }
  const manifest = await readJson(resolve(root, "update.json"));
  assert.equal(manifest.title, "LFAA 0.0.5");
  assert.deepEqual(manifest.releaseNotes, ["修复桌面端启动流程", "优化安装器构建入口"]);
  const changelog = await readFile(resolve(root, "docs/updata-log.md"), "utf8");
  assert.match(changelog, /## #16 Electron 桌面安装包\r?\n\r?\n- \*\*项目版本：\*\* \x60LFAA 0\.0\.5\x60/u);
  assert.match(changelog, /Windows Electron 包状态：\*\* 待构建\r?\n\r?\n## #15/u);
});

test("发现未记账但与 latest.yml 匹配的安装器时先消耗当前版本", async (t) => {
  const { root } = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMatchingInstaller(root);

  assert.deepEqual(await getDesktopPackageBuildState(root), { version, packageStatus: "built" });
  const changelog = await readFile(resolve(root, "docs/updata-log.md"), "utf8");
  assert.match(changelog, /Windows Electron 包状态：\*\* 已生成：LFAA-0\.0\.4\.exe/u);
});

test("产品包版本与唯一更新日志不一致时拒绝准备新版本", async (t) => {
  const { root } = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifestPath = resolve(root, "apps/web/package.json");
  const manifest = await readJson(manifestPath);
  manifest.version = "0.0.3";
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const changelogBefore = await readFile(resolve(root, "docs/updata-log.md"), "utf8");

  await assert.rejects(prepareDesktopPackageVersion(root), /与更新日志 0\.0\.4 不一致/u);
  assert.equal(await readFile(resolve(root, "docs/updata-log.md"), "utf8"), changelogBefore);
});
