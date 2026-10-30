/**
 * 功能：准备 Windows 本机一体版 Electron 应用所需的运行目录。
 * 作用：把独立构建的桌面候选 Web、控制端、生产依赖、Daemon、数据目录解析脚本和 Windows Sandbox Host 组装到根 dist 的临时工作区。
 * 关联文件：apps/web/package.json、apps/desktop-electron/package.json、apps/desktop-electron/src/main.mjs、根目录 package.json、apps/cli/package.json、scripts/apply-data-directory-migration.mjs、packages/host/daemon/src/daemon.mjs。
 */
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLAUDE_SDK_COMPONENT_INTEGRITY,
  CLAUDE_SDK_COMPONENT_PACKAGE,
  CLAUDE_SDK_COMPONENT_TARBALL_URL,
  CLAUDE_SDK_COMPONENT_VERSION
} from "../../../packages/subagent/subagent-claude-code/src/claude-sdk-component-contract.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const desktopTempRoot = resolve(repositoryRoot, "dist", ".tmp", "desktop-electron");
const runtimeRoot = resolve(desktopTempRoot, "runtime");
const serverDeployRoot = resolve(desktopTempRoot, "server-deploy");
const webCandidateRoot = resolve(desktopTempRoot, "web-candidate");

function assertManagedTemporaryPath(targetPath) {
  const relativePath = relative(desktopTempRoot, targetPath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || resolve(desktopTempRoot, relativePath) !== targetPath) {
    throw new Error(`拒绝清理桌面端临时目录之外的路径：${targetPath}`);
  }
}

async function copyDirectory(sourcePath, destinationPath, options = {}) {
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true, ...options });
}

async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function createClaudeSdkComponentManifest() {
  const sourcePackagePath = resolve(repositoryRoot, "packages", "subagent", "subagent-claude-code", "package.json");
  const sourcePackage = JSON.parse(await readFile(sourcePackagePath, "utf8"));
  if (sourcePackage.dependencies?.["@anthropic-ai/claude-agent-sdk"] !== CLAUDE_SDK_COMPONENT_VERSION) {
    throw new Error("Claude Agent SDK 源码依赖版本与按需组件合同不一致。");
  }

  const lockText = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  const lockKey = `${CLAUDE_SDK_COMPONENT_PACKAGE}@${CLAUDE_SDK_COMPONENT_VERSION}`;
  const escapedLockKey = lockKey.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const lockEntry = lockText.match(new RegExp(`^  '${escapedLockKey}':\\r?\\n    resolution: \\{integrity: (sha512-[^}]+)\\}`, "mu"));
  if (!lockEntry || lockEntry[1] !== CLAUDE_SDK_COMPONENT_INTEGRITY) {
    throw new Error(`Claude Agent SDK Windows x64 包与 pnpm-lock.yaml 的完整性锁定不一致：${lockKey}`);
  }

  const packageRoot = resolve(serverDeployRoot, "node_modules", "@anthropic-ai", "claude-agent-sdk-win32-x64");
  const packageManifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
  const executablePath = resolve(packageRoot, "claude.exe");
  const executableInfo = await lstat(executablePath);
  if (packageManifest.version !== CLAUDE_SDK_COMPONENT_VERSION || executableInfo.isSymbolicLink()
    || !executableInfo.isFile() || executableInfo.size < 1 || executableInfo.size > 512 * 1024 * 1024) {
    throw new Error("Claude Agent SDK Windows x64 包缺少预期版本的真实 claude.exe。");
  }

  return {
    schemaVersion: 1,
    platform: "win32-x64",
    packageName: CLAUDE_SDK_COMPONENT_PACKAGE,
    version: CLAUDE_SDK_COMPONENT_VERSION,
    tarballUrl: CLAUDE_SDK_COMPONENT_TARBALL_URL,
    integrity: CLAUDE_SDK_COMPONENT_INTEGRITY,
    binaryArchivePath: "package/claude.exe",
    binaryFileName: "claude.exe",
    binarySizeBytes: executableInfo.size,
    binarySha256: await sha256File(executablePath)
  };
}

function requireWindowsX64Node() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("Windows 安装包必须在 Windows x64 主机上构建。");
  }

  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  if (major < 24 || (major === 24 && (minor < 15 || (minor === 15 && patch < 0)))) {
    throw new Error(`构建安装包需要 Node.js 24.15.0 或更高版本；当前为 ${process.versions.node}。`);
  }
}

async function resetRuntimeDirectory() {
  assertManagedTemporaryPath(runtimeRoot);
  const temporaryEntries = await readdir(desktopTempRoot, { withFileTypes: true });
  for (const entry of temporaryEntries) {
    if (entry.name === "server-deploy" || entry.name === "web-candidate") continue;
    const targetPath = resolve(desktopTempRoot, entry.name);
    assertManagedTemporaryPath(targetPath);
    await rm(targetPath, { recursive: true, force: true });
  }
  await mkdir(runtimeRoot, { recursive: true });
}

async function prepareDeployDirectory() {
  const temporaryParent = resolve(repositoryRoot, "dist", ".tmp");
  const expectedRoot = resolve(temporaryParent, "desktop-electron");
  if (desktopTempRoot !== expectedRoot || !desktopTempRoot.startsWith(`${temporaryParent}${sep}`)) {
    throw new Error(`拒绝重建桌面端临时根目录之外的路径：${desktopTempRoot}`);
  }

  await rm(desktopTempRoot, { recursive: true, force: true });
  await mkdir(serverDeployRoot, { recursive: true });
}

async function prepareRuntime() {
  requireWindowsX64Node();
  assertManagedTemporaryPath(runtimeRoot);
  assertManagedTemporaryPath(serverDeployRoot);
  await resetRuntimeDirectory();
  await stat(resolve(serverDeployRoot, "node_modules"));

  const cuaManifestPath = resolve(serverDeployRoot, "node_modules", "@trycua", "cua-driver", "package.json");
  const cuaSourceManifestPath = resolve(repositoryRoot, "packages", "computer-use", "computer-use", "package.json");
  const [cuaManifest, cuaSourceManifest] = await Promise.all([
    readFile(cuaManifestPath, "utf8").then(JSON.parse),
    readFile(cuaSourceManifestPath, "utf8").then(JSON.parse)
  ]);
  const requiredCuaVersion = cuaSourceManifest.dependencies?.["@trycua/cua-driver"];
  if (cuaManifest.name !== "@trycua/cua-driver" || cuaManifest.version !== requiredCuaVersion) {
    throw new Error(`Electron 运行依赖版本不匹配：${cuaManifestPath} 应为 @trycua/cua-driver@${requiredCuaVersion}，实际为 ${cuaManifest.version ?? "未知版本"}。`);
  }
  process.stdout.write(`已核验桌面 Profile 运行依赖：@trycua/cua-driver@${cuaManifest.version}\n`);

  // 原生依赖必须真的进入部署树：缺失时打包失败，而不是等用户上传图片才发现在运行期加载不到。
  const sharpManifestPath = resolve(serverDeployRoot, "node_modules", "sharp", "package.json");
  const sharpBinaryRoot = resolve(serverDeployRoot, "node_modules", "@img", "sharp-win32-x64");
  let sharpVersion;
  try {
    sharpVersion = JSON.parse(await readFile(sharpManifestPath, "utf8")).version;
  } catch {
    throw new Error(`Electron 部署树缺少 sharp（${sharpManifestPath}）；图片重编码会静默退化为不压缩。请在打包前执行完整依赖部署。`);
  }
  const sharpBinaryNames = await readdir(resolve(sharpBinaryRoot, "lib")).catch(() => []);
  if (!sharpBinaryNames.some(name => name.endsWith(".node"))) {
    throw new Error(`Electron 部署树缺少 Windows x64 的 sharp 原生二进制（${sharpBinaryRoot}/lib/*.node）。`);
  }
  process.stdout.write(`已核验桌面图片重编码依赖：sharp@${sharpVersion} + @img/sharp-win32-x64\n`);

  const claudeSdkManifest = await createClaudeSdkComponentManifest();
  await writeFile(resolve(runtimeRoot, "claude-sdk-component.json"), `${JSON.stringify(claudeSdkManifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`已登记 Claude SDK 首次使用下载合同：@anthropic-ai/claude-agent-sdk@${claudeSdkManifest.version}，运行组件 ${Math.ceil(claudeSdkManifest.binarySizeBytes / (1024 * 1024))} MiB。\n`);

  // pnpm 11 的部署自链接可能指回源码仓库，打包前解除该链接。
  const workspaceSelfLink = resolve(serverDeployRoot, "node_modules", ".pnpm", "node_modules", "@yubboo/lfaa");
  try {
    const linkMetadata = await lstat(workspaceSelfLink);
    if (linkMetadata.isSymbolicLink()) await rm(workspaceSelfLink, { force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const sandboxHost = resolve(repositoryRoot, "dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe");
  await stat(sandboxHost);

  await copyDirectory(webCandidateRoot, resolve(runtimeRoot, "dist", "apps", "web"));
  await copyDirectory(resolve(repositoryRoot, "dist", "apps", "control-plane"), resolve(runtimeRoot, "dist", "apps", "control-plane"));
  await mkdir(resolve(runtimeRoot, "scripts"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "apps", "cli"), { recursive: true });
  await cp(resolve(repositoryRoot, "scripts", "resolve-data-directory.mjs"), resolve(runtimeRoot, "scripts", "resolve-data-directory.mjs"));
  await cp(resolve(repositoryRoot, "scripts", "apply-data-directory-migration.mjs"), resolve(runtimeRoot, "scripts", "apply-data-directory-migration.mjs"));
  await cp(resolve(repositoryRoot, "scripts", "extract-data-directory-archive.ps1"), resolve(runtimeRoot, "scripts", "extract-data-directory-archive.ps1"));
  await cp(resolve(repositoryRoot, "scripts", "create-business-content-archive.ps1"), resolve(runtimeRoot, "scripts", "create-business-content-archive.ps1"));
  await cp(resolve(repositoryRoot, "scripts", "extract-business-content-archive.ps1"), resolve(runtimeRoot, "scripts", "extract-business-content-archive.ps1"));
  await cp(resolve(repositoryRoot, "scripts", "get-project-drive-type.ps1"), resolve(runtimeRoot, "scripts", "get-project-drive-type.ps1"));
  await cp(resolve(repositoryRoot, "apps", "cli", "package.json"), resolve(runtimeRoot, "apps", "cli", "package.json"));
  await mkdir(resolve(runtimeRoot, "apps", "cli", "bin"), { recursive: true });
  await cp(resolve(repositoryRoot, "apps", "cli", "bin", "lfaa.mjs"), resolve(runtimeRoot, "apps", "cli", "bin", "lfaa.mjs"));
  await cp(resolve(repositoryRoot, "apps", "cli", "register-package-loader.mjs"), resolve(runtimeRoot, "apps", "cli", "register-package-loader.mjs"));
  await cp(resolve(repositoryRoot, "apps", "cli", "package-loader.mjs"), resolve(runtimeRoot, "apps", "cli", "package-loader.mjs"));
  await copyDirectory(resolve(repositoryRoot, "packages", "util", "home-paths", "src"), resolve(runtimeRoot, "packages", "util", "home-paths", "src"));
  await cp(resolve(repositoryRoot, "scripts", "harness-workspace.mjs"), resolve(runtimeRoot, "scripts", "harness-workspace.mjs"));
  const buildResourcesRoot = resolve(desktopTempRoot, "build-resources");
  await mkdir(buildResourcesRoot, { recursive: true });
  await cp(resolve(repositoryRoot, "apps", "desktop-electron", "assets", "lfaa.ico"), resolve(buildResourcesRoot, "lfaa.ico"));
  const noticeSourcePath = resolve(repositoryRoot, "apps", "desktop-electron", "assets", "installation-notice.txt");
  const noticeBytes = await readFile(noticeSourcePath);
  if (!noticeBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    throw new Error(`NSIS 安装须知必须是带 UTF-8 BOM 的 UTF-8 文本：${noticeSourcePath}`);
  }
  await writeFile(resolve(buildResourcesRoot, "installation-notice.txt"), noticeBytes);
  await cp(process.execPath, resolve(runtimeRoot, "node.exe"));
  await cp(sandboxHost, resolve(runtimeRoot, "dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe"));

  const requiredRuntimeFiles = [
    "node.exe",
    "apps/cli/package.json",
    "apps/cli/bin/lfaa.mjs",
    "apps/cli/register-package-loader.mjs",
    "apps/cli/package-loader.mjs",
    "dist/apps/control-plane/packages/host/daemon/src/daemon.mjs",
    "scripts/resolve-data-directory.mjs",
    "scripts/apply-data-directory-migration.mjs",
    "scripts/extract-data-directory-archive.ps1",
    "scripts/get-project-drive-type.ps1",
    "claude-sdk-component.json",
    "dist/apps/web/index.html",
    "dist/apps/web/build-state.json",
    "dist/apps/control-plane/index.js",
    "dist/apps/control-plane/build-state.json",
    "dist/apps/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe"
  ];

  for (const relativePath of requiredRuntimeFiles) await stat(resolve(runtimeRoot, relativePath));
  process.stdout.write(`Electron 本机运行目录已准备：${runtimeRoot}\n`);
}

if (process.argv[2] === "prepare-deploy") await prepareDeployDirectory();
else await prepareRuntime();
