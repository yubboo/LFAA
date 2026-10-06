/**
 * 功能：列出既有 LFAA_DATA_DIR 内的分类目录。
 * 作用：只映射数据根内的用途，不解析或改变安装版、项目版的数据根规则。
 * 关联文件：storage-domain、settings、workflow、knowledge-library。
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";

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
    plugins: path("plugins"),
    cache: path("cache"),
    logs: path("logs"),
    backups: path("backups"),
    models: path("models"),
    connectivity: path("connectivity"),
    storages: path("storages")
  });
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
