/**
 * 文件：release-consistency-check.mjs
 * 作用：保证当前发布版本、代码包版本和发布记录使用同一个版本事实。
 * 负责：检查 lfaa.release.json、package.json、workspace package、Rust crate、README、CHANGELOG、Changelog 文档和 Release 文档。
 * 不负责：修改版本号、生成 ZIP、验证业务功能。
 * 状态归属：无运行时状态；以 lfaa.release.json 为唯一版本事实源。
 * 对外接口：`node scripts/release-consistency-check.mjs`。
 * 关联文件：lfaa.release.json、package.json、README.md、CHANGELOG.md、docs/changelog/、docs/releases/。
 * 修改注意事项：新增会携带产品版本号的清单文件时，应同步加入本检查，避免新旧版本事实混杂。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA release consistency check failed: ${message}`);
  process.exit(1);
};

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const release = readJson("lfaa.release.json");
const version = String(release.displayVersion ?? "").trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`invalid displayVersion: ${version || "<empty>"}`);

const packageFiles = [
  "package.json",
  ...["apps", "packages"].flatMap((base) => {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.isDirectory() && ["node_modules", "dist", "target", ".git"].includes(entry.name)) continue;
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (entry.isFile() && entry.name === "package.json") out.push(rel.replaceAll("\\", "/"));
      }
    };
    walk(base);
    return out;
  }),
];

for (const relative of [...new Set(packageFiles)]) {
  const data = readJson(relative);
  if (data.version !== version) fail(`${relative} version ${data.version} != ${version}`);
}

for (const entry of fs.readdirSync(path.join(root, "crates"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const relative = `crates/${entry.name}/Cargo.toml`;
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, "utf8");
  const match = text.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match || match[1] !== version) fail(`${relative} version ${match?.[1] ?? "<missing>"} != ${version}`);
}

const readText = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
if (!readText("README.md").includes(`LFAA-v${version}`)) fail("README.md does not identify the current package version");
if (!readText("CHANGELOG.md").includes(`v${version}`)) fail("CHANGELOG.md does not identify the current version");

for (const relative of [
  `docs/changelog/v${version}.md`,
  `docs/releases/v${version}/RELEASE.md`,
]) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing current release record: ${relative}`);
}

console.log(`LFAA release consistency check passed (v${version}).`);
