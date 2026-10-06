import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { validateLfaaUpdateManifest } from "../apps/desktop-electron/src/update-manifest.mjs";

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const PRODUCT_PACKAGES = ["apps/cli/package.json", "apps/web/package.json", "apps/desktop-electron/package.json"];

export function incrementPatchVersion(version) {
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new Error("项目版本必须是稳定版 SemVer x.y.z。" );
  }
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger) || parts[2] === Number.MAX_SAFE_INTEGER) {
    throw new Error("项目修订号超出可递增范围。" );
  }
  parts[2] += 1;
  return parts.join(".");
}

export async function prepareDesktopPackageVersion(repositoryRoot, { notes } = {}) {
  let current = await readCurrentRelease(repositoryRoot);
  if (current.packageStatus === "pending" && await hasBuiltArtifact(repositoryRoot, current.version)) {
    await markDesktopPackageBuilt(repositoryRoot);
    current = await readCurrentRelease(repositoryRoot);
  }

  if (current.packageStatus === "pending") {
    return { version: current.version, incremented: false };
  }
  if (current.packageStatus !== "built") {
    throw new Error("最新更新日志缺少有效的 Windows Electron 包状态。" );
  }

  const releaseNotes = normalizeReleaseNotes(notes);
  const nextVersion = incrementPatchVersion(current.version);
  const nextReleaseNumber = nextChangelogNumber(current.changelog);
  const date = shanghaiDate();
  const updatedManifest = {
    ...current.updateManifest,
    version: nextVersion,
    title: `LFAA ${nextVersion}`,
    publishedAt: date,
    releaseNotes
  };
  validateLfaaUpdateManifest(updatedManifest, current.publisherUrl);

  const newSection = [
    `## #${nextReleaseNumber} Electron 桌面安装包`,
    "",
    `- **项目版本：** \`LFAA ${nextVersion}\``,
    `- **日期：** ${date}`,
    `- **更新内容：** ${releaseNotes.join("；")}`,
    "- **Windows Electron 包状态：** 待构建",
    "",
    ""
  ].join("\n");
  const insertAt = current.latestHeaderIndex;
  const updatedChangelog = `${current.changelog.slice(0, insertAt)}${newSection}${current.changelog.slice(insertAt)}`;

  const writes = [];
  for (const relativePath of PRODUCT_PACKAGES) {
    const manifest = current.productManifests.get(relativePath);
    writes.push([resolve(repositoryRoot, relativePath), `${JSON.stringify({ ...manifest, version: nextVersion }, null, 2)}\n`]);
  }
  writes.push([resolve(repositoryRoot, "update.json"), `${JSON.stringify(updatedManifest, null, 2)}\n`]);
  writes.push([resolve(repositoryRoot, "docs/updata-log.md"), updatedChangelog]);
  await writeFilesAtomically(writes);

  return { version: nextVersion, incremented: true };
}

export async function markDesktopPackageBuilt(repositoryRoot) {
  const current = await readCurrentRelease(repositoryRoot);
  if (current.packageStatus === "built") return { version: current.version, alreadyMarked: true };
  if (current.packageStatus !== "pending") throw new Error("当前更新日志不是待构建的 Windows Electron 版本。" );

  const outputDirectory = resolve(
    repositoryRoot,
    "apps/desktop-electron",
    current.electronManifest.build?.directories?.output ?? ""
  );
  const installerName = `LFAA-${current.version}.exe`;
  const installerPath = resolve(outputDirectory, installerName);
  const latestPath = resolve(outputDirectory, "latest.yml");
  await access(installerPath).catch(() => { throw new Error(`未找到 Electron 安装器：${installerPath}`); });
  const latestYaml = await readFile(latestPath, "utf8");
  const latestVersion = latestYaml.match(/^version:\s*(\S+)\s*$/mu)?.[1];
  const latestPathName = latestYaml.match(/^path:\s*(\S+)\s*$/mu)?.[1];
  if (latestVersion !== current.version || latestPathName !== installerName) {
    throw new Error(`latest.yml 与 ${installerName} 版本不一致，未登记本次安装器。`);
  }

  const updatedChangelog = replaceLatestReleaseStatus(
    current.changelog,
    current.latestHeaderIndex,
    `已生成：${installerName}`
  );
  await writeFilesAtomically([[resolve(repositoryRoot, "docs/updata-log.md"), updatedChangelog]]);
  return { version: current.version, alreadyMarked: false };
}

export async function getDesktopPackageBuildState(repositoryRoot) {
  let current = await readCurrentRelease(repositoryRoot);
  if (current.packageStatus === "pending" && await hasBuiltArtifact(repositoryRoot, current.version)) {
    await markDesktopPackageBuilt(repositoryRoot);
    current = await readCurrentRelease(repositoryRoot);
  }
  return { version: current.version, packageStatus: current.packageStatus };
}

function normalizeReleaseNotes(value) {
  if (typeof value === "string") value = value.split(/[；;]/u);
  if (!Array.isArray(value)) throw new Error("新版本需要填写本次更新说明。" );
  const notes = value.map((note) => typeof note === "string" ? note.trim() : "");
  if (notes.length < 1 || notes.length > 32 || notes.some((note) => !note)
    || notes.reduce((total, note) => total + note.length, 0) > 12_000) {
    throw new Error("更新说明需为 1 至 32 条非空内容，合计不超过 12000 个字符。" );
  }
  return notes;
}

async function readCurrentRelease(repositoryRoot) {
  const changelogPath = resolve(repositoryRoot, "docs/updata-log.md");
  const changelog = await readFile(changelogPath, "utf8");
  const headers = [...changelog.matchAll(/^## #(\d+)\s+[^\r\n]*$/gmu)];
  const latestHeader = headers[0];
  if (!latestHeader || latestHeader.index === undefined) throw new Error("更新日志缺少最新版本记录。" );
  const latestHeaderIndex = latestHeader.index;
  const latestEnd = headers[1]?.index ?? changelog.length;
  const latestSection = changelog.slice(latestHeaderIndex, latestEnd);
  const releaseNumber = Number(latestHeader[1]);
  const version = latestSection.match(/^- \*\*项目版本：\*\*\s+`LFAA (\d+\.\d+\.\d+)`\s*$/mu)?.[1];
  const date = latestSection.match(/^- \*\*日期：\*\*\s+(\d{4}-\d{2}-\d{2})\s*$/mu)?.[1];
  const notesText = latestSection.match(/^- \*\*更新内容：\*\*\s+(.+)\s*$/mu)?.[1];
  const packageState = latestSection.match(/^- \*\*Windows Electron 包状态：\*\*\s+(待构建|已生成：LFAA-\d+\.\d+\.\d+\.exe)\s*$/mu)?.[1];
  if (!version || !date || !notesText || !packageState) {
    throw new Error("最新更新日志必须包含版本、日期、更新内容和 Windows Electron 包状态。" );
  }

  const productManifests = new Map();
  for (const relativePath of PRODUCT_PACKAGES) {
    const manifest = JSON.parse(await readFile(resolve(repositoryRoot, relativePath), "utf8"));
    if (manifest.version !== version) throw new Error(`${relativePath} 版本 ${manifest.version} 与更新日志 ${version} 不一致。`);
    productManifests.set(relativePath, manifest);
  }
  const electronManifest = productManifests.get("apps/desktop-electron/package.json");
  const publisher = (Array.isArray(electronManifest.build?.publish)
    ? electronManifest.build.publish
    : [electronManifest.build?.publish]).find((item) => item?.provider === "generic");
  if (typeof publisher?.url !== "string") throw new Error("Electron package.json 缺少 Generic 更新源。" );

  const updateManifest = JSON.parse(await readFile(resolve(repositoryRoot, "update.json"), "utf8"));
  const validatedManifest = validateLfaaUpdateManifest(updateManifest, publisher.url);
  if (validatedManifest.version !== version || validatedManifest.publishedAt !== date
    || validatedManifest.releaseNotes.join("；") !== notesText) {
    throw new Error("update.json 与 docs/updata-log.md 最新版本记录不一致。" );
  }

  const packageStatus = packageState === "待构建" ? "pending" : "built";
  return {
    changelog,
    electronManifest,
    latestHeaderIndex,
    latestSection,
    notesText,
    packageStatus,
    productManifests,
    publisherUrl: publisher.url,
    releaseNumber,
    updateManifest: validatedManifest,
    version
  };
}

function nextChangelogNumber(changelog) {
  const numbers = [...changelog.matchAll(/^## #(\d+)\s+/gmu)].map((match) => Number(match[1]));
  if (numbers.length === 0 || numbers.some((number) => !Number.isSafeInteger(number))) {
    throw new Error("无法从更新日志读取连续编号。" );
  }
  return Math.max(...numbers) + 1;
}

async function hasBuiltArtifact(repositoryRoot, version) {
  const outputDirectory = resolve(repositoryRoot, "dist/apps/desktop-electron");
  const installerPath = resolve(outputDirectory, `LFAA-${version}.exe`);
  const latestPath = resolve(outputDirectory, "latest.yml");
  try {
    const latestYaml = await readFile(latestPath, "utf8");
    const latestVersion = latestYaml.match(/^version:\s*(\S+)\s*$/mu)?.[1];
    const latestPathName = latestYaml.match(/^path:\s*(\S+)\s*$/mu)?.[1];
    await access(installerPath);
    return latestVersion === version && latestPathName === `LFAA-${version}.exe`;
  } catch {
    return false;
  }
}

function replaceLatestReleaseStatus(changelog, headerIndex, status) {
  const nextHeaderIndex = changelog.indexOf("\n## #", headerIndex + 1);
  const end = nextHeaderIndex < 0 ? changelog.length : nextHeaderIndex + 1;
  const section = changelog.slice(headerIndex, end);
  const updatedSection = section.replace(
    /^(- \*\*Windows Electron 包状态：\*\*[ \t]+)(?:待构建|已生成：LFAA-\d+\.\d+\.\d+\.exe)(\r?)$/mu,
    `$1${status}$2`
  );
  if (updatedSection === section) throw new Error("无法更新最新版本的 Windows Electron 包状态。" );
  return `${changelog.slice(0, headerIndex)}${updatedSection}${changelog.slice(end)}`;
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function writeFilesAtomically(entries) {
  const staged = [];
  try {
    for (const [path, contents] of entries) {
      await mkdir(dirname(path), { recursive: true });
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
      staged.push({ path, temporaryPath });
    }
    for (const file of staged) await rename(file.temporaryPath, file.path);
  } catch (error) {
    await Promise.all(staged.map((file) => unlink(file.temporaryPath).catch(() => {})));
    throw error;
  }
}

async function promptForReleaseNotes() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("下一个版本需要更新说明；请在交互终端运行菜单 3 或 pnpm run build:win。" );
  }
  const { createInterface } = await import("node:readline/promises");
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await input.question("请输入本次更新说明（多条内容用中文分号分隔）：");
    return normalizeReleaseNotes(answer);
  } finally {
    input.close();
  }
}

async function main() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const command = process.argv[2];
  if (command === "prepare") {
    const state = await getDesktopPackageBuildState(repositoryRoot);
    const result = await prepareDesktopPackageVersion(repositoryRoot, {
      notes: state.packageStatus === "built" ? await promptForReleaseNotes() : undefined
    });
    process.stdout.write(result.incremented
      ? `已准备 LFAA ${result.version} Windows Electron 安装包，更新说明和版本清单已同步。\n`
      : `本次沿用待构建版本 LFAA ${result.version}，完成安装器生成后下次构建会递增修订号。\n`);
    return;
  }
  if (command === "complete") {
    const result = await markDesktopPackageBuilt(repositoryRoot);
    process.stdout.write(`已登记 LFAA ${result.version} 安装器已生成；下一次新包会递增修订号。\n`);
    return;
  }
  throw new Error("用法：node scripts/desktop-package-version.mjs <prepare|complete>" );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Electron 版本准备失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
