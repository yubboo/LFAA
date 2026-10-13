import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function getDesktopPackageArtifactPaths(repositoryRoot, version) {
  assertVersion(version);
  const root = resolve(repositoryRoot);
  const stagingDirectory = resolve(root, "dist/.tmp/desktop-electron", `LFAA-${version}`);
  const deliveryDirectory = resolve(root, "dist/apps/desktop-electron", `LFAA-${version}`);
  return {
    stagingDirectory,
    deliveryDirectory,
    installerName: `LFAA-${version}.exe`,
    installerPath: resolve(deliveryDirectory, `LFAA-${version}.exe`),
    blockmapPath: resolve(deliveryDirectory, `LFAA-${version}.exe.blockmap`),
    latestPath: resolve(deliveryDirectory, "latest.yml")
  };
}

export async function verifyDesktopPackageArtifacts(directory, version) {
  assertVersion(version);
  const resolvedDirectory = resolve(directory);
  const installerName = `LFAA-${version}.exe`;
  const installerPath = resolve(resolvedDirectory, installerName);
  const blockmapPath = resolve(resolvedDirectory, `${installerName}.blockmap`);
  const latestPath = resolve(resolvedDirectory, "latest.yml");
  const [installerInfo, blockmapInfo, latestYaml, entries] = await Promise.all([
    stat(installerPath),
    stat(blockmapPath),
    readFile(latestPath, "utf8"),
    readdir(resolvedDirectory, { withFileTypes: true })
  ]).catch(() => { throw new Error(`LFAA ${version} 发行目录缺少安装器、blockmap 或 latest.yml。`); });
  if (!installerInfo.isFile() || installerInfo.size <= 0 || !blockmapInfo.isFile() || blockmapInfo.size <= 0) {
    throw new Error(`LFAA ${version} 安装器或 blockmap 不是有效文件。`);
  }
  const listedVersion = latestYaml.match(/^version:\s*(\S+)\s*$/mu)?.[1];
  const listedPath = latestYaml.match(/^path:\s*(\S+)\s*$/mu)?.[1];
  const listedSha512 = latestYaml.match(/^\s+sha512:\s*(\S+)\s*$/mu)?.[1];
  const listedSize = Number(latestYaml.match(/^\s+size:\s*(\d+)\s*$/mu)?.[1]);
  const actualSha512 = await hashFile(installerPath, "sha512", "base64");
  if (listedVersion !== version || listedPath !== installerName
    || listedSha512 !== actualSha512 || listedSize !== installerInfo.size) {
    throw new Error(`LFAA ${version} 的 latest.yml 版本、文件名、大小或 SHA-512 与安装器不一致。`);
  }
  const expectedNames = new Set([installerName, `${installerName}.blockmap`, "latest.yml"]);
  if (entries.some(entry => !entry.isFile() || !expectedNames.has(entry.name))
    || entries.length !== expectedNames.size) {
    throw new Error(`LFAA ${version} 发行目录必须只包含安装器、blockmap 与 latest.yml。`);
  }
  return { version, installerPath, blockmapPath, latestPath, size: installerInfo.size, sha512: actualSha512 };
}

export async function collectDesktopPackageArtifacts(repositoryRoot, version) {
  const root = resolve(repositoryRoot);
  const paths = getDesktopPackageArtifactPaths(root, version);
  const packagePath = resolve(root, "apps/desktop-electron/package.json");
  const packageManifest = JSON.parse(await readFile(packagePath, "utf8"));
  if (packageManifest.version !== version) throw new Error(`Electron 包版本 ${packageManifest.version} 与待输出版本 ${version} 不一致。`);
  const configuredOutput = packageManifest.build?.directories?.output;
  const packageRoot = resolve(root, "apps/desktop-electron");
  const configuredStagingDirectory = resolve(packageRoot, configuredOutput ?? "");
  if (configuredStagingDirectory !== paths.stagingDirectory) {
    throw new Error(`Electron 构建目录不是本版本隔离暂存目录：${configuredStagingDirectory}`);
  }
  const stagingArtifacts = await verifyStagingArtifacts(paths.stagingDirectory, version);
  await mkdir(paths.deliveryDirectory, { recursive: true });
  for (const name of [`LFAA-${version}.exe`, `LFAA-${version}.exe.blockmap`, "latest.yml"]) {
    const source = resolve(paths.stagingDirectory, name);
    const target = resolve(paths.deliveryDirectory, name);
    try {
      await access(target);
      if (await hashFile(source, "sha256", "hex") !== await hashFile(target, "sha256", "hex")) {
        throw new Error(`拒绝覆盖版本目录中已存在且内容不同的发行文件：${target}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await copyFile(source, target, 1);
    }
  }
  const delivered = await verifyDesktopPackageArtifacts(paths.deliveryDirectory, version);
  if (delivered.size !== stagingArtifacts.size || delivered.sha512 !== stagingArtifacts.sha512) {
    throw new Error("版本目录中的安装器与本轮 electron-builder 输出不一致。");
  }
  const stagingRoot = resolve(root, "dist/.tmp/desktop-electron");
  if (dirname(paths.stagingDirectory) !== stagingRoot || basename(paths.stagingDirectory) !== `LFAA-${version}`) {
    throw new Error("暂存目录未通过精确路径校验，拒绝清理。 ");
  }
  await rm(paths.stagingDirectory, { recursive: true, force: false });
  return delivered;
}

async function verifyStagingArtifacts(directory, version) {
  const resolvedDirectory = resolve(directory);
  const installerName = `LFAA-${version}.exe`;
  const installerPath = resolve(resolvedDirectory, installerName);
  const blockmapPath = resolve(resolvedDirectory, `${installerName}.blockmap`);
  const latestPath = resolve(resolvedDirectory, "latest.yml");
  const [installerInfo, blockmapInfo, latestYaml] = await Promise.all([
    stat(installerPath), stat(blockmapPath), readFile(latestPath, "utf8")
  ]).catch(() => { throw new Error(`构建暂存目录缺少 LFAA ${version} 安装器、blockmap 或 latest.yml。`); });
  const listedVersion = latestYaml.match(/^version:\s*(\S+)\s*$/mu)?.[1];
  const listedPath = latestYaml.match(/^path:\s*(\S+)\s*$/mu)?.[1];
  const listedSha512 = latestYaml.match(/^\s+sha512:\s*(\S+)\s*$/mu)?.[1];
  const listedSize = Number(latestYaml.match(/^\s+size:\s*(\d+)\s*$/mu)?.[1]);
  const sha512 = await hashFile(installerPath, "sha512", "base64");
  if (!installerInfo.isFile() || installerInfo.size <= 0 || !blockmapInfo.isFile() || blockmapInfo.size <= 0
    || listedVersion !== version || listedPath !== installerName
    || listedSha512 !== sha512 || listedSize !== installerInfo.size) {
    throw new Error(`构建暂存目录中的 LFAA ${version} 文件与 latest.yml 不匹配。`);
  }
  return { size: installerInfo.size, sha512 };
}

async function hashFile(path, algorithm, encoding) {
  const digest = createHash(algorithm);
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", chunk => digest.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolvePromise);
  });
  return digest.digest(encoding);
}

function assertVersion(version) {
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) throw new Error("发行版本必须是稳定版 SemVer x.y.z。");
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const command = process.argv[2];
  const packageManifest = JSON.parse(await readFile(resolve(root, "apps/desktop-electron/package.json"), "utf8"));
  if (command !== "collect") throw new Error("用法：node scripts/desktop-package-artifacts.mjs collect");
  const result = await collectDesktopPackageArtifacts(root, packageManifest.version);
  process.stdout.write(`已校验并整理 LFAA ${result.version} 发行文件：${result.installerPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`Electron 发行文件整理失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
