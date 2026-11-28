// 启动桌面端：先校验构建产物存在，再在 Windows 下修复低完整性标记/ACL，最后用本机 Electron 打开 apps/desktop。
// 关联：apps/desktop/scripts/start-diagnostics.mjs；运行环境：Node.js。
// 不静默失败——缺产物、低完整性降权或目录 ACL 缺失时自动修复并给出明确命令。
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  ALL_APP_PACKAGES_GRANT,
  MEDIUM_INTEGRITY_LEVEL,
  classifyLaunchFailure,
  findStaleArtifacts,
  formatIntegrityRepairCommand,
  hasAllApplicationPackagesAcl,
  hasLowIntegrityLabel,
  isBreakpointExit,
} from "./start-diagnostics.mjs";

const APP_DIR = resolve(import.meta.dirname, "..");
const ROOT = resolve(APP_DIR, "..", "..");
const require = createRequire(join(APP_DIR, "package.json"));
const TSDOWN = join(ROOT, "node_modules", "tsdown", "dist", "run.mjs");

const artifactSpecs = [
  {
    name: "@lfaa/web-server",
    outputPath: join(ROOT, "packages", "host", "web-server", "lib", "index.js"),
    sourceDirs: [join(ROOT, "packages", "host", "web-server", "src")],
    rebuildKind: "workspace",
  },
  {
    name: "@lfaa/workspace",
    outputPath: join(ROOT, "packages", "workspace", "workspace", "lib", "index.js"),
    sourceDirs: [join(ROOT, "packages", "workspace", "workspace", "src")],
    rebuildKind: "workspace",
  },
  {
    name: "@lfaa/canvas",
    outputPath: join(ROOT, "packages", "media", "canvas", "lib", "index.js"),
    sourceDirs: [join(ROOT, "packages", "media", "canvas", "src")],
    rebuildKind: "workspace",
  },
  {
    name: "@lfaa/bundle-web",
    outputPath: join(ROOT, "packages", "bundle", "web", "lib", "index.js"),
    sourceDirs: [join(ROOT, "packages", "bundle", "web", "src")],
    rebuildKind: "workspace",
  },
  {
    name: "@lfaa/app-web",
    outputPath: join(ROOT, "apps", "web", "dist", "index.html"),
    sourceDirs: [join(ROOT, "apps", "web", "src")],
    rebuildKind: "workspace",
  },
  {
    name: "@lfaa/app-desktop",
    outputPath: join(APP_DIR, "dist", "main.cjs"),
    sourceDirs: [join(APP_DIR, "src")],
    rebuildKind: "desktop-app",
  },
  {
    name: "@lfaa/app-desktop-host",
    outputPath: join(ROOT, "apps", "desktop-host", "lib", "index.js"),
    sourceDirs: [join(ROOT, "apps", "desktop-host", "src")],
    rebuildKind: "desktop-host",
  },
];

function rebuildStep(command, args, cwd, label) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

/** 启动前确保核心包 lib、Web 产物与桌面端入口均存在且未落后于源码。 */
function ensureFreshArtifacts() {
  const stale = findStaleArtifacts(artifactSpecs);
  if (stale.length === 0) return true;
  const names = stale.map((item) => `${item.name}(${item.reason === "missing" ? "缺失" : "已过期"})`).join("、");
  console.warn(`检测到桌面端构建产物需要更新：${names}，正在自动重建…`);
  if (stale.some((item) => item.rebuildKind === "workspace")) {
    if (!rebuildStep(process.execPath, [join(ROOT, "scripts", "build.mjs")], ROOT, "重建包 lib 与 Web 产物")) return false;
  }
  if (stale.some((item) => item.rebuildKind === "desktop-app")) {
    if (!rebuildStep(process.execPath, [TSDOWN], APP_DIR, "重建桌面主进程")) return false;
  }
  if (stale.some((item) => item.rebuildKind === "desktop-host")) {
    if (!rebuildStep(process.execPath, [TSDOWN], join(ROOT, "apps", "desktop-host"), "重建桌面宿主入口")) return false;
  }
  return findStaleArtifacts(artifactSpecs).every((item) => item.reason !== "missing");
}

/** Windows 下查询目录 ACL，判断 Electron dist 是否缺少 ALL APPLICATION PACKAGES 读取权限。 */
function isMissingAppPackagesAcl(dir) {
  if (process.platform !== "win32") return false;
  const result = spawnSync("icacls", [dir], { encoding: "utf8" });
  if (result.status !== 0) return false;
  return !hasAllApplicationPackagesAcl(result.stdout);
}

/**
 * Windows 下检查 electron.exe 是否继承了 Low Mandatory Level（低完整性级别）。
 * 若存在则先尝试恢复为 Medium，避免 Windows 在启动时强制把 Electron 降权导致 0x80000003 与 EPERM lstat。
 */
function ensureElectronIntegrityLevel(electronPath, electronDistDir) {
  if (process.platform !== "win32") return true;
  const probe = spawnSync("icacls", [electronPath], { encoding: "utf8" });
  if (probe.status !== 0 || !hasLowIntegrityLabel(probe.stdout)) return true;

  console.warn("检测到 electron.exe 继承了 Windows 低完整性标记（Low Mandatory Level），正在恢复为中等完整性…");
  const repair = spawnSync("icacls", [electronDistDir, "/setintegritylevel", MEDIUM_INTEGRITY_LEVEL, "/T"], {
    encoding: "utf8",
  });
  if (repair.status === 0) {
    console.warn("已恢复 Electron 目录完整性级别，正在启动桌面端…");
    return true;
  }

  const detail = (repair.stderr || repair.stdout || repair.error?.message || "").trim();
  console.error("\nElectron 启动受阻：electron.exe 继承了 Windows 低完整性标记（Low Mandatory Level），会被系统强制降权并报 0x80000003 / EPERM lstat。");
  if (detail) console.error(`自动恢复未成功：${detail}`);
  console.error("请以管理员身份打开终端执行以下命令后重试：");
  console.error(`  ${formatIntegrityRepairCommand(electronDistDir)}`);
  return false;
}

/** 输出 Windows 目录 ACL 缺失的手动修复提示。 */
function printAclGuidance(grantCommand, detail) {
  console.error("\nElectron 启动自检失败：目录 ACL 缺少 ALL APPLICATION PACKAGES（*S-1-15-2-1）读取权限，--no-sandbox 也无法绕过。");
  if (detail) console.error(`自动授权未成功：${detail}`);
  console.error("请以管理员身份打开终端执行以下命令后重试：");
  console.error(`  ${grantCommand}`);
  console.error(`如需一并修复整个仓库目录（避免重装依赖后复现），可执行：\n  icacls "${ROOT}" /grant ${ALL_APP_PACKAGES_GRANT}\n`);
}

if (!ensureFreshArtifacts()) {
  console.error("桌面端构建产物重建失败，请手动执行：pnpm build && pnpm build:desktop:app");
  process.exitCode = 1;
} else {
  // electron 包在 Node 下导出可执行文件路径。
  const electronPath = require("electron");
  const electronDistDir = dirname(electronPath);
  if (!ensureElectronIntegrityLevel(electronPath, electronDistDir)) {
    process.exitCode = 1;
  } else {
    // 有些宿主环境（如以 Electron 运行的编辑器/代理）会带 ELECTRON_RUN_AS_NODE=1，
    // 它会让 electron.exe 退化成纯 Node 进程，必须剔除后再启动桌面端。
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    // 命中 0x80000003 时，Windows 下先通过 icacls 核实是否缺少 ALL APPLICATION PACKAGES 权限：
    // Electron 45 的 install_dir_access.cc 校验即使加 --no-sandbox 也会失败，须先补权再重拉；
    // 只有在 ACL 正常时才按原逻辑以 --no-sandbox 重试一次。
    const launchElectron = (noSandbox, aclRepairAttempted) => {
      const args = noSandbox ? ["--no-sandbox", APP_DIR] : [APP_DIR];
      const child = spawn(electronPath, args, { stdio: "inherit", cwd: ROOT, env });
      child.on("exit", (code) => {
        const missingAppPackagesAcl = isBreakpointExit(code) && isMissingAppPackagesAcl(electronDistDir);
        const decision = classifyLaunchFailure({
          code,
          noSandbox,
          aclRepairAttempted,
          missingAppPackagesAcl,
          targetDir: electronDistDir,
        });

        if (decision.kind === "repair-acl") {
          console.warn("检测到 Electron 目录缺少 Windows ALL APPLICATION PACKAGES 权限，正在尝试自动授权…");
          const repair = spawnSync("icacls", [decision.targetDir, "/grant", ALL_APP_PACKAGES_GRANT], { encoding: "utf8" });
          if (repair.status === 0) {
            console.warn("权限已补充，正在重新启动桌面端…");
            launchElectron(noSandbox, true);
            return;
          }
          const detail = (repair.stderr || repair.stdout || repair.error?.message || "").trim();
          printAclGuidance(decision.grantCommand, detail);
          process.exitCode = code ?? 1;
          return;
        }

        if (decision.kind === "acl-failed") {
          printAclGuidance(decision.grantCommand, "");
          process.exitCode = code ?? 1;
          return;
        }

        if (decision.kind === "retry-no-sandbox") {
          console.warn("检测到当前终端会话限制了 Chromium 沙箱（0x80000003），正在自动以 --no-sandbox 重试启动桌面端…");
          launchElectron(true, aclRepairAttempted);
          return;
        }

        process.exitCode = code ?? 0;
      });
    };

    launchElectron(process.env.LFAA_DESKTOP_NO_SANDBOX === "1", false);
  }
}
