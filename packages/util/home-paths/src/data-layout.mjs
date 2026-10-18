/**
 * 功能：列出既有 LFAA_DATA_DIR 内的系统数据分类目录。
 * 作用：游戏、小说与漫剧业务内容由 Settings 内容根管理；插件包、适配副本和私有运行数据由 LFAA_HOME/Profile 与对应 Plugin Runtime 管理。
 * 关联文件：storage-domain、settings、workflow、knowledge-library。
 */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { protectPrivateDirectory } from "./private-directory.mjs";

const dataDirectoryKeys = Object.freeze([
  "database", "users", "sessions", "credentials", "games", "environments", "lib",
  "cache", "tmp", "logs", "backups", "models", "connectivity", "storages"
]);

export function resolveDataPaths(dataDirectory) {
  const root = resolve(dataDirectory);
  const path = (name) => resolve(root, name);
  return Object.freeze({
    root,
    database: path("database"),
    users: path("users"),
    sessions: path("sessions"),
    credentials: path("credentials"),
    games: path("games"),
    environments: path("environments"),
    lib: path("lib"),
    cache: path("cache"),
    tmp: path("tmp"),
    logs: path("logs"),
    backups: path("backups"),
    models: path("models"),
    connectivity: path("connectivity"),
    storages: path("storages")
  });
}

/**
 * 首次启动或切换到新数据根时，创建完整的顶层存储分类；不会预建账户、项目或业务内容。
 * 凭据目录使用既有私有目录 Owner 设置系统 ACL，其他目录拒绝符号链接替换。
 */
export function ensureDataDirectories(dataDirectory) {
  const paths = resolveDataPaths(dataDirectory);
  mkdirSync(paths.root, { recursive: true });
  const rootInfo = lstatSync(paths.root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error("LFAA 数据根必须是实际目录，不能是符号链接或普通文件。");
  }

  for (const key of dataDirectoryKeys) {
    const directory = paths[key];
    if (key === "credentials") protectPrivateDirectory(directory);
    else mkdirSync(directory, { recursive: true });
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`LFAA 数据分类目录无效：${key} 必须是实际目录。`);
    }
  }
  return paths;
}

export function resolveUserDataPaths(dataDirectory, userId) {
  if (typeof userId !== "string" || !userId.trim() || userId.length > 160 || userId.includes("\0")) {
    throw new Error("用户数据目录标识无效。");
  }
  const paths = resolveDataPaths(dataDirectory);
  const userRoot = resolve(paths.users, createHash("sha256").update(userId, "utf8").digest("hex"));
  const withinUser = (...segments) => resolve(userRoot, ...segments);
  return Object.freeze({
    root: userRoot,
    settings: withinUser("settings"),
    preferences: withinUser("settings", "preferences.json"),
    settingsDocument: withinUser("settings", "settings.json"),
    assets: withinUser("assets"),
    backgrounds: withinUser("assets", "backgrounds"),
    projects: withinUser("projects"),
    workflows: (applicationId) => {
      if (typeof applicationId !== "string" || !/^[a-z][a-z0-9-]{0,31}$/u.test(applicationId)) {
        throw new Error("工作流 App 目录标识无效。");
      }
      return withinUser("projects", applicationId, "workflows");
    },
    knowledge: withinUser("knowledge")
  });
}
