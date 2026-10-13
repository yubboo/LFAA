import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { collectDesktopPackageArtifacts } from "../desktop-package-artifacts.mjs";

const version = "0.0.7";

async function createFixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "lfaa-desktop-artifacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = resolve(root, "apps/desktop-electron/package.json");
  await mkdir(dirname(packagePath), { recursive: true });
  await writeFile(packagePath, JSON.stringify({
    version,
    build: { directories: { output: `../../dist/.tmp/desktop-electron/LFAA-${version}` } }
  }, null, 2));
  const staging = resolve(root, "dist/.tmp/desktop-electron", `LFAA-${version}`);
  await mkdir(staging, { recursive: true });
  const installerName = `LFAA-${version}.exe`;
  const installer = Buffer.from("test-installer");
  const sha512 = createHash("sha512").update(installer).digest("base64");
  await writeFile(resolve(staging, installerName), installer);
  await writeFile(resolve(staging, `${installerName}.blockmap`), "blockmap");
  await writeFile(resolve(staging, "latest.yml"), [
    `version: ${version}`,
    "files:",
    `  - url: ${installerName}`,
    `    sha512: ${sha512}`,
    `    size: ${installer.length}`,
    `path: ${installerName}`,
    `sha512: ${sha512}`,
    ""
  ].join("\n"));
  return { root, staging };
}

test("仅将验证过的版本包复制到版本目录，并在核验后清理精确暂存目录", async t => {
  const { root, staging } = await createFixture(t);
  const result = await collectDesktopPackageArtifacts(root, version);
  const finalDirectory = resolve(root, "dist/apps/desktop-electron", `LFAA-${version}`);
  assert.equal(result.version, version);
  assert.deepEqual((await readdir(finalDirectory)).sort(), [`LFAA-${version}.exe`, `LFAA-${version}.exe.blockmap`, "latest.yml"].sort());
  assert.equal((await readFile(result.installerPath, "utf8")), "test-installer");
  await assert.rejects(readFile(resolve(staging, `LFAA-${version}.exe`)), { code: "ENOENT" });
  await assert.rejects(readFile(resolve(root, "dist/apps/desktop-electron", `LFAA-${version}.exe`)), { code: "ENOENT" });
});

test("暂存路径不匹配时拒绝复制或清理构建内容", async t => {
  const { root, staging } = await createFixture(t);
  const packagePath = resolve(root, "apps/desktop-electron/package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  manifest.build.directories.output = "../../dist/apps/desktop-electron";
  await writeFile(packagePath, JSON.stringify(manifest));
  await assert.rejects(collectDesktopPackageArtifacts(root, version), /隔离暂存目录/u);
  assert.equal((await readFile(resolve(staging, `LFAA-${version}.exe`), "utf8")), "test-installer");
});
