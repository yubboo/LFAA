// 启动桌面端：先校验构建产物存在，再用本机 Electron 打开 apps/desktop。
// 不静默失败——缺产物时直接告诉负责人该跑哪条构建命令。
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const APP_DIR = resolve(import.meta.dirname, "..");
const ROOT = resolve(APP_DIR, "..", "..");
const require = createRequire(join(APP_DIR, "package.json"));

const requiredArtifacts = [
  { path: join(ROOT, "packages", "host", "web-server", "lib", "index.js"), hint: "pnpm build" },
  { path: join(ROOT, "apps", "web", "dist", "index.html"), hint: "pnpm build" },
  { path: join(APP_DIR, "dist", "main.js"), hint: "pnpm build:desktop:app" },
  { path: join(ROOT, "apps", "desktop-host", "lib", "index.js"), hint: "pnpm build:desktop:host" },
];

const missing = requiredArtifacts.filter((item) => !existsSync(item.path));
if (missing.length > 0) {
  console.error("桌面端构建产物不完整，请先执行对应的构建命令：");
  for (const item of missing) console.error(`  · ${item.path}\n    → ${item.hint}`);
  process.exitCode = 1;
} else {
  // electron 包在 Node 下导出可执行文件路径。
  const electronPath = require("electron");
  // 有些宿主环境（如以 Electron 运行的编辑器/代理）会带 ELECTRON_RUN_AS_NODE=1，
  // 它会让 electron.exe 退化成纯 Node 进程，必须剔除后再启动桌面端。
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  // 少数受限终端/IDE 会话里 Chromium sandbox 初始化会直接失败（进程以 0x80000003 / 2147483651 退出）。
  // 默认先启用沙箱；若命中 0x80000003 则自动以 --no-sandbox 重试一次，避免用户卡在晦涩的退出码。
  const launchElectron = (noSandbox) => {
    const args = noSandbox ? ["--no-sandbox", APP_DIR] : [APP_DIR];
    const child = spawn(electronPath, args, { stdio: "inherit", cwd: ROOT, env });
    child.on("exit", (code) => {
      const isSandboxCrash = !noSandbox && (code === 0x80000003 || code === -2147483645);
      if (isSandboxCrash) {
        console.warn("检测到当前终端会话限制了 Chromium 沙箱（0x80000003），正在自动以 --no-sandbox 重试启动桌面端…");
        launchElectron(true);
        return;
      }
      process.exitCode = code ?? 0;
    });
  };
  launchElectron(process.env.LFAA_DESKTOP_NO_SANDBOX === "1");
}