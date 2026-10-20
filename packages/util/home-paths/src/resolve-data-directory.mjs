/** 功能：解析账户 Home 与业务 Data 根。作用：Home 默认是当前系统账户 .lfaa；业务 Data 默认是 Home/data，显式配置仍使用用户给定目录。关联文件：launch-environment、CLI、启动器、桌面外壳。 */
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  const homeDirectory = options.lfaaHome ?? process.env.LFAA_HOME ?? "";
  const resolvedHome = resolveHomeDirectory(projectRoot, homeDirectory, options);
  if (options.useStoredDataDirectory === true || (!configured && options.useStoredDataDirectory !== false)) {
    const storedDirectory = readStoredDataDirectory(resolvedHome, platform);
    if (storedDirectory) return storedDirectory;
  }
  if (configured) {
    const resolvedConfigured = pathApi.resolve(projectRoot, configured);
    // 旧版本把 Home 本身保存为 Data 根；只将这个精确旧值规范化到 Home/data，绝不移动或删除旧目录。
    const isLegacyHomeRoot = platform === "win32"
      ? resolvedConfigured.toLocaleLowerCase("en-US") === resolvedHome.toLocaleLowerCase("en-US")
      : resolvedConfigured === resolvedHome;
    return isLegacyHomeRoot ? pathApi.resolve(resolvedHome, "data") : resolvedConfigured;
  }
  return pathApi.resolve(resolvedHome, "data");
}

const storedDataDirectoryFileName = "data-directory.json";

/** Read the Project & Storage selection stored with account/control configuration. */
export function readStoredDataDirectory(homeDirectory, platform = process.platform) {
  const pathApi = platform === "win32" ? win32 : posix;
  const file = pathApi.resolve(homeDirectory, "storages", storedDataDirectoryFileName);
  if (!existsSync(file)) return "";
  let record;
  try { record = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`项目与存储配置无法读取：${file}`); }
  if (!record || record.version !== 1 || typeof record.directory !== "string" || !record.directory.trim() || !pathApi.isAbsolute(record.directory)) {
    throw new Error(`项目与存储配置无效：${file}`);
  }
  const directory = pathApi.resolve(record.directory);
  const home = pathApi.resolve(homeDirectory);
  const isWindows = platform === "win32";
  const equals = (left, right) => isWindows
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;
  if (equals(directory, home)) throw new Error("项目与存储配置不能把 LFAA Home 本身用作业务 Data 根。");
  return directory;
}

/** Persist the selected business Data root without moving or deleting files at either location. */
export function saveStoredDataDirectory(homeDirectory, directory, platform = process.platform) {
  const pathApi = platform === "win32" ? win32 : posix;
  const home = pathApi.resolve(homeDirectory);
  if (typeof directory !== "string" || !pathApi.isAbsolute(directory.trim())) {
    throw new Error("业务 Data 根必须是本机绝对路径。");
  }
  const selected = pathApi.resolve(directory.trim());
  const equals = platform === "win32"
    ? selected.toLocaleLowerCase("en-US") === home.toLocaleLowerCase("en-US")
    : selected === home;
  if (equals) throw new Error("业务 Data 根不能覆盖 LFAA Home。");
  const storageDirectory = pathApi.resolve(home, "storages");
  mkdirSync(storageDirectory, { recursive: true });
  const destination = pathApi.resolve(storageDirectory, storedDataDirectoryFileName);
  const temporary = pathApi.resolve(storageDirectory, `.${storedDataDirectoryFileName}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify({ version: 1, directory: selected })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
  return selected;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [projectRoot, configured] = process.argv.slice(2);
  if (!projectRoot) throw new Error("请指定项目根目录。");
  process.stdout.write(resolveDataDirectory(projectRoot, configured) + "\n");
}
