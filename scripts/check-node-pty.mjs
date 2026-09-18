/**
 * 文件：check-node-pty.mjs
 * 作用：验证当前项目安装的 node-pty 能否被 Node 实际加载并提供 pty.spawn。
 * 负责：Windows Setup 安装后的原生依赖 Smoke Check。
 * 不负责：启动交互终端、验证 xterm UI、安装 node-pty。
 * 状态归属：无运行时状态。
 * 对外接口：`node scripts/check-node-pty.mjs`。
 * 关联文件：scripts/windows/lfaa-setup.ps1、apps/web/vite.config.ts、pnpm-workspace.yaml。
 * 修改注意事项：保持独立脚本，避免在 PowerShell 中用复杂 `node -e` 引号拼接。
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const webPackageJson = path.join(projectRoot, "apps", "web", "package.json");
const requireFromWeb = createRequire(webPackageJson);

try {
  const pty = requireFromWeb("node-pty");
  if (!pty || typeof pty.spawn !== "function") {
    console.error("node-pty loaded, but pty.spawn is unavailable.");
    process.exit(2);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
