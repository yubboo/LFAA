/**
 * 功能：集中解析账户 Home 与业务 Data 的目录布局。
 * 作用：账户/控制数据由 Home 管理；业务、模型、输入和输出文件由 LFAA_DATA_DIR 管理。
 * 关联文件：storage-domain、settings、workflow、knowledge-library。
 */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { protectPrivateDirectory } from "./private-directory.mjs";

const accountDirectoryKeys = Object.freeze(["database", "users", "sessions", "credentials", "storages"]);
const businessDirectoryKeys = Object.freeze(["users", "games", "environments", "lib", "cache", "tmp", "logs", "backups", "models", "input", "output", "connectivity"]);
// LFAA model library categories; model family adapters define the native files stored under each category.
const modelDirectoryNames = Object.freeze(["text", "image", "video", "audio", "encoders", "vae", "adapters", "acceleration", "upscalers"]);

export function resolveHomePaths(homeDirectory) {
  const root = resolve(homeDirectory);
  const path = (name) => resolve(root, name);
  return Object.freeze({
    root,
    database: path("database"),
    users: path("users"),
    sessions: path("sessions"),
    credentials: path("credentials"),
    storages: path("storages")
  });
}

export function resolveDataPaths(dataDirectory) {
  const root = resolve(dataDirectory);
  const path = (name) => resolve(root, name);
  return Object.freeze({
    root,
    users: path("users"),
    games: path("games"),
    environments: path("environments"),
    lib: path("lib"),
    cache: path("cache"),
    tmp: path("tmp"),
    logs: path("logs"),
    backups: path("backups"),
    models: path("models"),
    input: path("input"),
    output: path("output"),
    connectivity: path("connectivity")
  });
}

/**
 * 首次启动或切换到新 Home 时创建账户/控制分类；凭据由私有目录 Owner 保护。
 */
export function ensureHomeDirectories(homeDirectory) {
  const paths = resolveHomePaths(homeDirectory);
  mkdirSync(paths.root, { recursive: true });
  const rootInfo = lstatSync(paths.root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error("LFAA Home 必须是实际目录，不能是符号链接或普通文件。");
  }

  for (const key of accountDirectoryKeys) {
    const directory = paths[key];
    if (key === "credentials") protectPrivateDirectory(directory);
    else mkdirSync(directory, { recursive: true });
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`LFAA Home 分类目录无效：${key} 必须是实际目录。`);
    }
  }
  return paths;
}

/** 首次启动或切换到新业务 Data 根时创建业务分类；不会创建账户、项目或实际内容。 */
export function ensureDataDirectories(dataDirectory) {
  const paths = resolveDataPaths(dataDirectory);
  mkdirSync(paths.root, { recursive: true });
  const rootInfo = lstatSync(paths.root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error("LFAA 业务数据根必须是实际目录，不能是符号链接或普通文件。");
  }
  for (const key of businessDirectoryKeys) {
    const directory = paths[key];
    mkdirSync(directory, { recursive: true });
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`LFAA 业务数据分类目录无效：${key} 必须是实际目录。`);
    }
  }
  for (const name of modelDirectoryNames) {
    const directory = resolve(paths.models, name);
    mkdirSync(directory, { recursive: true });
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`LFAA 模型分类目录无效：models/${name} 必须是实际目录。`);
    }
  }
  return paths;
}

/** 用户设置、偏好和外观素材属于账户 Home；不混入业务 Data 根。 */
export function resolveUserAccountPaths(homeDirectory, userId) {
  const userRoot = resolve(resolveHomePaths(homeDirectory).users, createUserDirectoryId(userId));
  const withinUser = (...segments) => resolve(userRoot, ...segments);
  return Object.freeze({
    root: userRoot,
    settings: withinUser("settings"),
    preferences: withinUser("settings", "preferences.json"),
    settingsDocument: withinUser("settings", "settings.json"),
    assets: withinUser("assets"),
    backgrounds: withinUser("assets", "backgrounds")
  });
}

export function resolveUserDataPaths(dataDirectory, userId) {
  const paths = resolveDataPaths(dataDirectory);
  const userDirectoryId = createUserDirectoryId(userId);
  const userRoot = resolve(paths.users, userDirectoryId);
  const withinUser = (...segments) => resolve(userRoot, ...segments);
  return Object.freeze({
    root: userRoot,
    projects: withinUser("projects"),
    input: resolve(paths.input, userDirectoryId),
    output: resolve(paths.output, userDirectoryId),
    workflows: (applicationId) => {
      if (typeof applicationId !== "string" || !/^[a-z][a-z0-9-]{0,31}$/u.test(applicationId)) {
        throw new Error("工作流 App 目录标识无效。");
      }
      return withinUser("projects", applicationId, "workflows");
    },
    knowledge: withinUser("knowledge")
  });
}

function createUserDirectoryId(userId) {
  if (typeof userId !== "string" || !userId.trim() || userId.length > 160 || userId.includes("\0")) {
    throw new Error("用户数据目录标识无效。");
  }
  return createHash("sha256").update(userId, "utf8").digest("hex");
}
