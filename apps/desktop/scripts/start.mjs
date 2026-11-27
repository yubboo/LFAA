// 启动桌面端：先校验构建产物存在，再在 Windows 下修复低完整性标记/ACL，最后用本机 Electron 打开 apps/desktop。
// 关联：apps/desktop/scripts/start-diagnostics.mjs；运行环境：Node.js。
// 不静默失败——缺产物、低完整性降权或目录 ACL 缺失时自动修复并给出明确命令。
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  ALL_APP_PACKAGES_GRANT,
  MEDIUM_INTEGRITY_LEVEL,
  classifyLaunchFailure,
  formatIntegrityRepairCommand,
  hasAllApplicationPackagesAcl,
  hasLowIntegrityLabel,
  isBreakpointExit,
} from "./start-diagnostics.mjs";

const APP_DIR = resolve(import.meta.dirname, "..");
const ROOT = resolve(APP_DIR, "..", "..");
const require = createRequire(join(APP_DIR, "package.json"));

const requiredArtifacts = [
  { path: join(ROOT, "packages", "host", "web-server", "lib", "index.js"), hint: "pnpm build" },
  { path: join(ROOT, "apps", "web", "dist", "index.html"), hint: "pnpm build" },
  { path: join(APP_DIR, "dist", "main.cjs"), hint: "pnpm build:desktop:app" },
  { path: join(ROOT, "apps", "desktop-host", "lib", "index.js"), hint: "pnpm build:desktop:host" },
];

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

const missing = requiredArtifacts.filter((item) => !existsSync(item.path));
if (missing.length > 0) {
  console.error("桌面端构建产物不完整，请先执行对应的构建命令：");
  for (const item of missing) console.error(`  · ${item.path}\n    → ${item.hint}`);
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
