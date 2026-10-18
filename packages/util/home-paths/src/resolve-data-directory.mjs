/** 功能：解析 Server/Daemon 使用的 LFAA Home 根。作用：未配置时使用当前系统账户 .lfaa；业务内容根由 Settings Owner 单独解析为 Home/data。关联文件：launch-environment、CLI、启动器、桌面外壳。 */
import { homedir } from "node:os";
import { posix, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
export function resolveHomeDirectory(projectRoot, configuredValue = "", options = {}) {
  const platform = options.platform ?? process.platform;
  const pathApi = platform === "win32" ? win32 : posix;
  const configured = String(configuredValue ?? "").trim();
  if (configured) {
    if (!pathApi.isAbsolute(configured)) throw new Error("LFAA_HOME 必须是绝对路径。请配置绝对安装目录。");
    return pathApi.resolve(configured);
  }
  const home = options.userProfile ?? (platform === "win32" ? process.env.USERPROFILE : homedir());
  if (!home || !pathApi.isAbsolute(home)) throw new Error("当前系统账户的主目录无效，请配置绝对路径 LFAA_HOME。");
  return pathApi.resolve(home, ".lfaa");
}

export function resolveDataDirectory(projectRoot, configuredValue = "", options = {}) {
  const platform = options.platform ?? process.platform;
  const pathApi = platform === "win32" ? win32 : posix;
  const configured = String(configuredValue ?? "").trim();
  // 已保存的相对/绝对配置保持原意，包括旧环境显式设置的 data，不偷偷搬迁用户文件。
  if (configured) return pathApi.resolve(projectRoot, configured);
  const homeDirectory = options.lfaaHome ?? process.env.LFAA_HOME ?? "";
  return pathApi.resolve(resolveHomeDirectory(projectRoot, homeDirectory, options));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [projectRoot, configured] = process.argv.slice(2);
  if (!projectRoot) throw new Error("请指定项目根目录。");
  process.stdout.write(resolveDataDirectory(projectRoot, configured) + "\n");
}
