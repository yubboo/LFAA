/**
 * 功能：回归 Windows 工作台的 npm CLI 发布入口。
 * 作用：确认菜单复用唯一发布命令，取消时不触发构建或 npm 操作。
 * 关联文件：scripts/install-dependencies.ps1、package.json。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const menuPath = resolve(projectRoot, "scripts/install-dependencies.ps1");
const menuSource = readFileSync(menuPath, "utf8");
const rootManifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const cliManifest = JSON.parse(readFileSync(resolve(projectRoot, "apps/cli/package.json"), "utf8"));

test("npm menu option routes through the official-registry CLI publisher", () => {
  assert.match(menuSource, /【7】一键发布 npm CLI/);
  assert.match(menuSource, /'7'\s*\{\s*Publish-NpmCli\s*\}/);
  assert.match(menuSource, /Read-Confirmation -Prompt .*到 npm/);
  assert.match(menuSource, /npmCommand\.Source 'whoami'/);
  assert.match(menuSource, /npmCommand\.Source 'view'/);
  assert.match(menuSource, /Invoke-WorkspacePnpm -Arguments @\('run', 'publish:cli'\)/);
  assert.match(rootManifest.scripts["publish:cli"], /--registry=https:\/\/registry\.npmjs\.org\//);
});

test("declining npm publish from the menu performs no npm lookup or build", { skip: process.platform !== "win32" }, () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "lfaa-npm-publish-menu-"));
  const markerPath = join(temporaryRoot, "invocations.txt");
  const fakeCommand = '@echo off\r\necho %*>>"%LFAA_TEST_NPM_MARKER%"\r\nexit /b 0\r\n';
  writeFileSync(join(temporaryRoot, "npm.cmd"), fakeCommand);
  writeFileSync(join(temporaryRoot, "pnpm.cmd"), fakeCommand);

  try {
    const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", menuPath], {
      cwd: projectRoot,
      env: { ...process.env, PATH: `${temporaryRoot}${delimiter}${process.env.PATH ?? ""}`, LFAA_TEST_NPM_MARKER: markerPath },
      input: "7\nn\n\n0\n",
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
    });

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes(`${cliManifest.name}@${cliManifest.version}`));
    assert.equal(existsSync(markerPath), false, "declining must not invoke npm or pnpm");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
