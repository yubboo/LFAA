/**
 * 功能：准备 Windows 本机一体版 Electron 应用所需的运行目录。
 * 作用：把 Web、控制端、生产依赖、Daemon、数据目录解析脚本和 Windows Sandbox Host 组装到根 dist 的临时工作区。
 * 关联文件：apps/desktop-electron/package.json、apps/desktop-electron/src/main.mjs、根目录 package.json、apps/cli/package.json、scripts/apply-data-directory-migration.mjs、packages/host/daemon/src/daemon.mjs。
 */
import { cp, lstat, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const desktopTempRoot = resolve(repositoryRoot, "dist", ".tmp", "desktop-electron");
const runtimeRoot = resolve(desktopTempRoot, "runtime");
const serverDeployRoot = resolve(desktopTempRoot, "server-deploy");

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
    if (entry.name === "server-deploy") continue;
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

  await copyDirectory(resolve(repositoryRoot, "dist", "apps", "web"), resolve(runtimeRoot, "dist", "apps", "web"));
  await copyDirectory(resolve(repositoryRoot, "dist", "apps", "control-plane"), resolve(runtimeRoot, "dist", "apps", "control-plane"));
  await mkdir(resolve(runtimeRoot, "scripts"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "apps", "cli"), { recursive: true });
  await cp(resolve(repositoryRoot, "scripts", "resolve-data-directory.mjs"), resolve(runtimeRoot, "scripts", "resolve-data-directory.mjs"));
  await cp(resolve(repositoryRoot, "scripts", "apply-data-directory-migration.mjs"), resolve(runtimeRoot, "scripts", "apply-data-directory-migration.mjs"));
  await cp(resolve(repositoryRoot, "scripts", "get-project-drive-type.ps1"), resolve(runtimeRoot, "scripts", "get-project-drive-type.ps1"));
  await cp(resolve(repositoryRoot, "apps", "cli", "package.json"), resolve(runtimeRoot, "apps", "cli", "package.json"));
  await cp(resolve(repositoryRoot, "apps", "cli", "register-package-loader.mjs"), resolve(runtimeRoot, "apps", "cli", "register-package-loader.mjs"));
  await cp(resolve(repositoryRoot, "apps", "cli", "package-loader.mjs"), resolve(runtimeRoot, "apps", "cli", "package-loader.mjs"));
  await copyDirectory(resolve(repositoryRoot, "packages", "util", "home-paths", "src"), resolve(runtimeRoot, "packages", "util", "home-paths", "src"));
  await cp(resolve(repositoryRoot, "scripts", "harness-workspace.mjs"), resolve(runtimeRoot, "scripts", "harness-workspace.mjs"));
  await cp(process.execPath, resolve(runtimeRoot, "node.exe"));
  await cp(sandboxHost, resolve(runtimeRoot, "dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe"));

  const requiredRuntimeFiles = [
    "node.exe",
    "apps/cli/package.json",
    "apps/cli/register-package-loader.mjs",
    "apps/cli/package-loader.mjs",
    "dist/apps/control-plane/packages/host/daemon/src/daemon.mjs",
    "scripts/resolve-data-directory.mjs",
    "scripts/apply-data-directory-migration.mjs",
    "scripts/get-project-drive-type.ps1",
    "dist/apps/web/index.html",
    "dist/apps/control-plane/index.js",
    "dist/apps/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe"
  ];

  for (const relativePath of requiredRuntimeFiles) await stat(resolve(runtimeRoot, relativePath));
  process.stdout.write(`Electron 本机运行目录已准备：${runtimeRoot}\n`);
}

if (process.argv[2] === "prepare-deploy") await prepareDeployDirectory();
else await prepareRuntime();
