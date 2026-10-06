import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLfaaUpdateManifest } from "../src/update-manifest.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const packagePath = resolve(scriptDirectory, "../package.json");
const manifestPath = resolve(repositoryRoot, "update.json");
const changelogPath = resolve(repositoryRoot, "docs/updata-log.md");

async function loadAndValidate() {
  const [packageText, manifestText, changelog] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(changelogPath, "utf8")
  ]);
  const packageMetadata = JSON.parse(packageText);
  const publisher = (Array.isArray(packageMetadata.build?.publish)
    ? packageMetadata.build.publish
    : [packageMetadata.build?.publish]).find(item => item?.provider === "generic");
  if (!publisher?.url) throw new Error("Electron 构建配置缺少 Generic 更新源。");

  const versionMatch = changelog.match(/^\s*- \*\*项目版本：\*\*\s+`?LFAA (\d+\.\d+\.\d+)`?\s*$/m);
  if (!versionMatch) throw new Error("无法从 docs/updata-log.md 读取当前 LFAA SemVer。");
  const dateMatch = changelog.match(/^\s*- \*\*日期：\*\*\s+(\d{4}-\d{2}-\d{2})\s*$/m);
  const releaseNotesMatch = changelog.match(/^\s*- \*\*更新内容：\*\*\s+(.+)\s*$/m);
  if (!dateMatch || !releaseNotesMatch) throw new Error("无法从 docs/updata-log.md 读取最新版本日期或更新内容。");
  const manifest = validateLfaaUpdateManifest(manifestText, publisher.url);
  if (packageMetadata.version !== versionMatch[1] || manifest.version !== versionMatch[1]) {
    throw new Error(`版本不一致：docs/updata-log.md=${versionMatch[1]}，Electron=${packageMetadata.version}，update.json=${manifest.version}。`);
  }
  if (manifest.publishedAt !== dateMatch[1] || manifest.releaseNotes.join("；") !== releaseNotesMatch[1]) {
    throw new Error("update.json 的 publishedAt 或 releaseNotes 与 docs/updata-log.md 最新版本条目不一致。");
  }
  return { manifest, packageMetadata };
}

const command = process.argv[2] ?? "validate";
if (command === "validate") {
  const { manifest } = await loadAndValidate();
  process.stdout.write(`LFAA ${manifest.version} 更新清单、版本日志与 Electron Generic 更新源一致。\n`);
} else {
  throw new Error(`未知命令：${command}`);
}
