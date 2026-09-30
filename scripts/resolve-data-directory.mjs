/** 功能：提供数据目录解析命令。作用：调用 home-paths 包并保留原启动脚本合同。关联文件：packages/util/home-paths、start-dev.ps1、桌面外壳。 */
import { resolveDataDirectory } from "../packages/util/home-paths/src/resolve-data-directory.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export { resolveDataDirectory };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [projectRoot, configuredValue] = process.argv.slice(2);
  if (!projectRoot) throw new Error("用法：node scripts/resolve-data-directory.mjs <项目根目录> [LFAA_DATA_DIR]");
  process.stdout.write(`${resolveDataDirectory(projectRoot, configuredValue)}\n`);
}
