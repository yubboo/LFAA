/**
 * 功能：组装并制作 LFAA Windows x64 本机一体 Setup 安装包。
 * 作用：从根 dist 收集 Web、控制端、Node.js、Daemon 和 Sandbox Host；扁平化控制端生产依赖，预检后交给 Tauri/NSIS 打包。
 * 关联文件：apps/desktop-tauri/package.json、apps/desktop-tauri/src-tauri/tauri.conf.json、apps/desktop-tauri/src-tauri/src/main.rs、根目录 package.json、apps/cli/package.json、packages/host/daemon/src/daemon.mjs。
 */
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const distRoot = resolve(repositoryRoot, "dist");
const temporaryParent = resolve(distRoot, ".tmp");
const temporaryRoot = resolve(temporaryParent, "desktop-tauri");
const runtimeRoot = resolve(temporaryRoot, "app-runtime");
const serverDeployRoot = resolve(temporaryRoot, "server-deploy");
const desktopOutputRoot = resolve(distRoot, "apps", "desktop-tauri");
const cargoTargetRoot = resolve(desktopOutputRoot, "target");
const installerPath = resolve(desktopOutputRoot, "LFAA-Setup-0.1.1-x64.exe");
const targetTriple = "x86_64-pc-windows-msvc";

function assertManagedPath(parentPath, targetPath, allowParent = false) {
  const relativePath = relative(parentPath, targetPath);
  if ((!allowParent && !relativePath) || relativePath === ".." || relativePath.startsWith(`..${sep}`) || resolve(parentPath, relativePath) !== targetPath) {
    throw new Error(`拒绝访问目标目录之外的路径：${targetPath}`);
  }
}

function requireWindowsX64Node() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("LFAA Windows Setup 必须在 Windows x64 主机上构建。");
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 24 || (major === 24 && minor < 15)) {
    throw new Error(`构建 Setup 需要 Node.js 24.15.0 或更高版本；当前为 ${process.versions.node}。`);
  }
}

function runCommand(command, args, cwd, environment = process.env) {
  const result = spawnSync(command, args, { cwd, env: environment, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令失败，退出码 ${result.status ?? "未知"}：${command} ${args.join(" ")}`);
}

function runPnpm(command, cwd, environment = process.env) {
  const childEnvironment = {
    ...environment,
    CI: "true",
    PNPM_CONFIG_CONFIRM_MODULES_PURGE: "false",
    npm_config_confirm_modules_purge: "false"
  };
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", `pnpm ${command}`], {
    cwd,
    env: childEnvironment,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm 命令失败，退出码 ${result.status ?? "未知"}：${command}`);
}

function iconBitmap(size) {
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const xorSize = size * size * 4;
  const bitmap = Buffer.alloc(40 + xorSize + maskRowBytes * size);
  bitmap.writeUInt32LE(40, 0);
  bitmap.writeInt32LE(size, 4);
  bitmap.writeInt32LE(size * 2, 8);
  bitmap.writeUInt16LE(1, 12);
  bitmap.writeUInt16LE(32, 14);
  bitmap.writeUInt32LE(xorSize, 20);

  const sampleGrid = size < 32 ? 4 : 3;
  const cornerRadius = size * 0.23;
  const pixelsStart = 40;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let backgroundSamples = 0;
      let markSamples = 0;
      for (let sampleY = 0; sampleY < sampleGrid; sampleY += 1) {
        for (let sampleX = 0; sampleX < sampleGrid; sampleX += 1) {
          const x = column + (sampleX + 0.5) / sampleGrid;
          const y = size - row - 1 + (sampleY + 0.5) / sampleGrid;
          const nearestX = Math.max(cornerRadius, Math.min(size - cornerRadius, x));
          const nearestY = Math.max(cornerRadius, Math.min(size - cornerRadius, y));
          const insideTile = (x - nearestX) ** 2 + (y - nearestY) ** 2 <= cornerRadius ** 2;
          if (!insideTile) continue;
          backgroundSamples += 1;
          const verticalLeg = x >= size * 0.32 && x <= size * 0.48 && y >= size * 0.24 && y <= size * 0.76;
          const lowerLeg = x >= size * 0.32 && x <= size * 0.70 && y >= size * 0.60 && y <= size * 0.76;
          if (verticalLeg || lowerLeg) markSamples += 1;
        }
      }
      const coverage = backgroundSamples / (sampleGrid * sampleGrid);
      const markCoverage = markSamples / (sampleGrid * sampleGrid);
      const offset = pixelsStart + (row * size + column) * 4;
      if (coverage === 0) continue;
      const markMix = markCoverage / coverage;
      bitmap[offset] = Math.round(213 * (1 - markMix) + 255 * markMix);
      bitmap[offset + 1] = Math.round(87 * (1 - markMix) + 255 * markMix);
      bitmap[offset + 2] = Math.round(52 * (1 - markMix) + 255 * markMix);
      bitmap[offset + 3] = Math.round(255 * coverage);
    }
  }
  return bitmap;
}

function createApplicationIcon() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const headerSize = 6 + sizes.length * 16;
  const bitmaps = sizes.map(iconBitmap);
  const icon = Buffer.alloc(headerSize + bitmaps.reduce((total, bitmap) => total + bitmap.length, 0));
  icon.writeUInt16LE(0, 0);
  icon.writeUInt16LE(1, 2);
  icon.writeUInt16LE(sizes.length, 4);
  let imageOffset = headerSize;
  sizes.forEach((size, index) => {
    const entryOffset = 6 + index * 16;
    icon[entryOffset] = size === 256 ? 0 : size;
    icon[entryOffset + 1] = size === 256 ? 0 : size;
    icon.writeUInt16LE(1, entryOffset + 4);
    icon.writeUInt16LE(32, entryOffset + 6);
    icon.writeUInt32LE(bitmaps[index].length, entryOffset + 8);
    icon.writeUInt32LE(imageOffset, entryOffset + 12);
    bitmaps[index].copy(icon, imageOffset);
    imageOffset += bitmaps[index].length;
  });
  return icon;
}

async function copyDirectory(sourcePath, destinationPath) {
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true });
}

async function verifyNoPnpmLinks() {
  const serverModules = resolve(runtimeRoot, "apps", "cli", "node_modules");
  const packagePaths = [
    "express",
    "@deepseek-ai/cordis",
    "@deepseek-ai/cosmokit"
  ];
  for (const packageName of packagePaths) {
    const packagePath = resolve(serverModules, packageName);
    const details = await lstat(packagePath);
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new Error(`服务器依赖没有部署成普通目录：${packageName}。请检查 pnpm 的 hoisted deploy 结果。`);
    }
  }

  const nodePath = resolve(runtimeRoot, "node.exe");
  const loaderPath = pathToFileURL(resolve(runtimeRoot, "apps", "cli", "register-package-loader.mjs")).href;
  runCommand(nodePath, [
    "--import",
    loaderPath,
    "--input-type=module",
    "--eval",
    "await import('express'); await import('@deepseek-ai/cordis');"
  ], runtimeRoot);
}

async function prepareRuntime() {
  const webBuild = resolve(distRoot, "apps", "web");
  const controlPlaneBuild = resolve(distRoot, "apps", "control-plane");
  const sandboxHost = resolve(distRoot, "apps", "daemon", "target", targetTriple, "release", "lfaa-sandbox-host.exe");
  await stat(webBuild);
  await stat(resolve(controlPlaneBuild, "index.js"));
  await stat(sandboxHost);
  await stat(resolve(repositoryRoot, "scripts", "apply-data-directory-migration.mjs"));

  assertManagedPath(temporaryRoot, runtimeRoot);
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(resolve(runtimeRoot, "dist", "apps", "web"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "dist", "apps", "control-plane"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "scripts"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "apps", "cli"), { recursive: true });
  await mkdir(resolve(runtimeRoot, "dist", "apps", "daemon", "target", targetTriple, "release"), { recursive: true });

  await copyDirectory(webBuild, resolve(runtimeRoot, "dist", "apps", "web"));
  await copyDirectory(controlPlaneBuild, resolve(runtimeRoot, "dist", "apps", "control-plane"));
  for (const filename of ["resolve-data-directory.mjs", "apply-data-directory-migration.mjs", "get-project-drive-type.ps1"]) {
    await cp(resolve(repositoryRoot, "scripts", filename), resolve(runtimeRoot, "scripts", filename));
  }
  for (const filename of ["package.json", "register-package-loader.mjs", "package-loader.mjs"]) {
    const sourcePath = filename === "package.json" ? resolve(repositoryRoot, "apps", "cli", filename) : resolve(repositoryRoot, "apps", "cli", filename);
    await cp(sourcePath, resolve(runtimeRoot, "apps", "cli", filename));
  }
  await copyDirectory(resolve(repositoryRoot, "packages", "util", "home-paths", "src"), resolve(runtimeRoot, "packages", "util", "home-paths", "src"));
  await cp(resolve(repositoryRoot, "scripts", "harness-workspace.mjs"), resolve(runtimeRoot, "scripts", "harness-workspace.mjs"));
  await cp(process.execPath, resolve(runtimeRoot, "node.exe"));
  await copyDirectory(
    resolve(serverDeployRoot, "node_modules"),
    resolve(runtimeRoot, "apps", "cli", "node_modules")
  );
  await cp(sandboxHost, resolve(runtimeRoot, "dist", "apps", "daemon", "target", targetTriple, "release", "lfaa-sandbox-host.exe"));
  await mkdir(desktopOutputRoot, { recursive: true });
  await mkdir(temporaryRoot, { recursive: true });
  await writeFile(resolve(temporaryRoot, "LFAA.ico"), createApplicationIcon());

  const requiredRuntimeFiles = [
    "node.exe",
    "apps/cli/package.json",
    "apps/cli/register-package-loader.mjs",
    "apps/cli/package-loader.mjs",
    "dist/apps/control-plane/packages/host/daemon/src/daemon.mjs",
    "scripts/resolve-data-directory.mjs",
    "scripts/apply-data-directory-migration.mjs",
    `dist/apps/daemon/target/${targetTriple}/release/lfaa-sandbox-host.exe`,
    "dist/apps/web/index.html",
    "dist/apps/control-plane/index.js"
  ];
  for (const relativePath of requiredRuntimeFiles) await stat(resolve(runtimeRoot, relativePath));
  await verifyNoPnpmLinks();
  process.stdout.write(`Tauri 本机运行资源已准备并通过模块预检：${runtimeRoot}\n`);
}

async function buildInstaller() {
  requireWindowsX64Node();
  await mkdir(temporaryParent, { recursive: true });
  await mkdir(temporaryRoot, { recursive: true });
  await mkdir(desktopOutputRoot, { recursive: true });
  assertManagedPath(distRoot, desktopOutputRoot);
  assertManagedPath(distRoot, cargoTargetRoot);
  assertManagedPath(temporaryParent, temporaryRoot);

  await rm(installerPath, { force: true });
  const bundleDirectory = resolve(cargoTargetRoot, targetTriple, "release", "bundle", "nsis");
  assertManagedPath(cargoTargetRoot, bundleDirectory);
  await rm(bundleDirectory, { recursive: true, force: true });
  await mkdir(bundleDirectory, { recursive: true });

  const rustup = spawnSync("rustup", ["target", "list", "--installed"], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (rustup.error || rustup.status !== 0 || !rustup.stdout.split(/\r?\n/u).includes(targetTriple)) {
    throw new Error(`Rust 工具链缺少 ${targetTriple} target，无法构建 Windows 安装程序。`);
  }

  const deploymentTarget = resolve(serverDeployRoot);
  assertManagedPath(temporaryRoot, deploymentTarget);
  await rm(deploymentTarget, { recursive: true, force: true });
  runPnpm(
    `--filter @yubboo/lfaa deploy --prod --legacy --config.node-linker=hoisted --config.confirmModulesPurge=false ${deploymentTarget}`,
    repositoryRoot,
    {
      ...process.env,
      CI: "true",
      PNPM_CONFIG_CONFIRM_MODULES_PURGE: "false"
    }
  );
  await prepareRuntime();

  const environment = {
    ...process.env,
    CARGO_TARGET_DIR: cargoTargetRoot
  };
  const tauriCliPackage = JSON.parse(await readFile(resolve(appRoot, "package.json"), "utf8"));
  const tauriCliVersion = tauriCliPackage.devDependencies?.["@tauri-apps/cli"];
  if (!tauriCliVersion) throw new Error("桌面包缺少 @tauri-apps/cli 构建依赖。");
  const tauriCliEntry = resolve(repositoryRoot, "node_modules", ".pnpm", `@tauri-apps+cli@${tauriCliVersion}`, "node_modules", "@tauri-apps", "cli", "tauri.js");
  await stat(tauriCliEntry);
  runCommand(process.execPath, [tauriCliEntry, "build", "--bundles", "nsis", "--target", targetTriple], appRoot, environment);

  const bundleFiles = (await readdir(bundleDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /-setup\.exe$/iu.test(entry.name));
  if (bundleFiles.length !== 1) {
    throw new Error(`Tauri 生成的 NSIS Setup 数量应为 1，实际找到 ${bundleFiles.length} 个。`);
  }
  const sourceInstaller = resolve(bundleDirectory, bundleFiles[0].name);
  await cp(sourceInstaller, installerPath);
  const installerDetails = await stat(installerPath);
  process.stdout.write(`Windows Setup 已生成：${installerPath}\n`);
  process.stdout.write(`Setup 体积：${(installerDetails.size / 1024 / 1024).toFixed(1)} MiB（${installerDetails.size} 字节）\n`);
}

try {
  await buildInstaller();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Windows Setup 打包失败。"}\n`);
  process.exitCode = 1;
}
