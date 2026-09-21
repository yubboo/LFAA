/**
 * 文件：release-consistency-check.mjs
 * 作用：保证当前发布版本、代码包版本和单文件发布记录使用同一个版本事实。
 * 负责：检查 lfaa.release.json、workspace package、Rust crate、README、CHANGELOG、docs/RELEASES.md。
 * 不负责：修改版本号、生成 ZIP、验证业务功能、替代用户验收。
 * 状态归属：无运行时状态；以 lfaa.release.json 为唯一版本事实源。
 * 对外接口：`node scripts/release-consistency-check.mjs`。
 * 关联文件：lfaa.release.json、package.json、README.md、CHANGELOG.md、docs/RELEASES.md。
 * 修改注意事项：新增携带产品版本号的清单文件时同步加入本检查；禁止恢复每版本一个 Release 文件。
 */
import fs from "node:fs";
import path from "node:path";
import { validateLfaaVersion } from "./version-policy.mjs";
import { validateCargoLockConsistency } from "./cargo-lock-consistency-check.mjs";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA release consistency check failed: ${message}`);
  process.exit(1);
};
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const readText = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const release = readJson("lfaa.release.json");
const version = String(release.displayVersion ?? "").trim();
try {
  validateLfaaVersion(version);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const packageFiles = ["package.json"];
for (const base of ["apps", "packages"]) {
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isDirectory() && ["node_modules", "dist", "target", ".git"].includes(entry.name)) continue;
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile() && entry.name === "package.json") packageFiles.push(next.replaceAll("\\", "/"));
    }
  };
  walk(base);
}
for (const relative of [...new Set(packageFiles)]) {
  const data = readJson(relative);
  if (data.version !== version) fail(`${relative} version ${data.version} != ${version}`);
}

for (const entry of fs.readdirSync(path.join(root, "native"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const relative = `native/${entry.name}/Cargo.toml`;
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) continue;
  const match = readText(relative).match(/^version\s*=\s*"([^"]+)"/m);
  if (!match || match[1] !== version) fail(`${relative} version ${match?.[1] ?? "<missing>"} != ${version}`);
}

try {
  validateCargoLockConsistency(root);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (!readText("README.md").includes(`LFAA-v${version}`)) fail("README.md does not identify the current package version");
if (!readText("CHANGELOG.md").includes(`v${version}`)) fail("CHANGELOG.md does not identify the current version");
if (!readText("docs/RELEASES.md").includes(`v${version}`)) fail("docs/RELEASES.md does not identify the current version");

for (const legacy of ["docs/changelog", "docs/releases"]) {
  if (fs.existsSync(path.join(root, legacy))) fail(`legacy per-version release directory must not return: ${legacy}`);
}
console.log(`LFAA release consistency check passed (v${version}).`);
