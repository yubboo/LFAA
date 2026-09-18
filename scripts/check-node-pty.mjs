/**
 * 文件：check-node-pty.mjs
 * 作用：验证 apps/web 使用的 node-pty 原生模块能够被 Node 实际加载。
 * 原因：Windows PowerShell 5 对 node -e 的内嵌引号传递存在兼容差异，
 *       因此 smoke check 必须使用独立脚本文件，不能依赖命令行 JS 字符串。
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
