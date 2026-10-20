/**
 * 功能：读取并校验控制端运行配置。
 * 作用：加载仓库根目录的本地环境文件，规范监听地址、数据目录、签名密钥与本机 Daemon 通信密钥，并识别数据目录迁移的受支持启动方式。
 * 关联文件：packages/host/webserver/src/server.ts、packages/storage/storage-sqlite/src/database.ts、packages/workspace/data-directory/src/service.ts、scripts/resolve-data-directory.mjs、scripts/start-dev.ps1、apps/desktop-electron/src/main.mjs、apps/desktop-tauri/src-tauri/src/main.rs、根目录 .env.example。
 */
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { isIP } from "node:net";
import { findRepositoryRoot } from "lfaa-home-paths/src/index.mjs";
import Joi from "joi";
import { randomBytes } from "node:crypto";
import { resolveDataDirectory, resolveHomeDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";
import { ensureDataDirectories, ensureHomeDirectories, resolveDataPaths, resolveHomePaths } from "lfaa-home-paths/src/data-layout.mjs";

const repositoryRoot = findRepositoryRoot(import.meta.url);
const environmentFile = resolve(repositoryRoot, ".env");
// 保留 .env 加载前的值，以区分部署显式覆盖和项目启动器注入的解析结果。
const externallyConfiguredDataDirectory = process.env.LFAA_DATA_DIR?.trim() ?? "";
const dataDirectoryWasResolvedByProjectLauncher = process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER === "1";
const dataDirectoryWasResolvedByDesktopShell = process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP === "1";
const dataDirectoryIsConfiguredByDeployment = process.env.LFAA_DATA_DIR_CONFIGURED === "1";
const dataDirectoryAtProcessStartIsExternal = Boolean(externallyConfiguredDataDirectory)
  && !dataDirectoryWasResolvedByProjectLauncher
  && !dataDirectoryWasResolvedByDesktopShell;

if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}
const dataDirectoryLoadedFromEnvironmentFile = !externallyConfiguredDataDirectory && Boolean(process.env.LFAA_DATA_DIR?.trim());
const dataDirectoryIsExternallyManaged = dataDirectoryAtProcessStartIsExternal
  || dataDirectoryIsConfiguredByDeployment
  || dataDirectoryLoadedFromEnvironmentFile;

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  SERVER_HOST: Joi.string().trim().min(1).default("127.0.0.1"),
  SERVER_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  LFAA_DESKTOP_MODE: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_LOCAL_MODE: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_SERVE_FRONTEND: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_HOME: Joi.string().trim().allow("").default(""),
  LFAA_DATA_DIR: Joi.string().trim().allow("").default(""),
  JWT_SECRET: Joi.string().allow("").max(512).default(""),
  WEBAUTHN_RP_ID: Joi.string().trim().allow("").max(253).default(""),
  WEBAUTHN_ORIGIN: Joi.string().trim().allow("").max(512).default(""),
  LFAA_GITHUB_APP_CLIENT_ID: Joi.string().trim().allow("").max(128).pattern(/^[A-Za-z0-9_-]*$/u).default(""),
  LFAA_GITHUB_APP_CLIENT_SECRET: Joi.string().trim().allow("").max(512),
  LOG_LEVEL: Joi.string().valid("error", "warn", "info", "http", "verbose", "debug", "silly").default("info")
}).unknown(true);

const validation = environmentSchema.validate(process.env, { abortEarly: false, convert: true });

if (validation.error) {
  throw new Error(`控制端配置无效：${validation.error.details.map((item) => item.message).join("；")}`);
}

interface ParsedEnvironment {
  NODE_ENV: "development" | "test" | "production";
  SERVER_HOST: string;
  SERVER_PORT: number;
  LFAA_DESKTOP_MODE: boolean;
  LFAA_LOCAL_MODE: boolean;
  LFAA_SERVE_FRONTEND: boolean;
  LFAA_HOME: string;
  LFAA_DATA_DIR: string;
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
  LFAA_GITHUB_APP_CLIENT_ID: string;
  LFAA_GITHUB_APP_CLIENT_SECRET?: string;
  LOG_LEVEL: string;
}

function isLoopbackHost(value: string): boolean {
  const host = value.toLocaleLowerCase().replace(/^\[|\]$/gu, "");
  return host === "localhost" || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
}

/** Local MCP endpoints remain available to desktop/development users; remote production stays public-network only. */
export function allowsPrivateMcpNetwork(environment: Pick<ParsedEnvironment, "LFAA_DESKTOP_MODE" | "LFAA_LOCAL_MODE" | "NODE_ENV" | "SERVER_HOST">): boolean {
  const loopback = isLoopbackHost(environment.SERVER_HOST);
  return environment.LFAA_DESKTOP_MODE
    || environment.LFAA_LOCAL_MODE && loopback
    || (environment.NODE_ENV !== "production" && loopback);
}

/** 本机 Windows UI 操控只有显式本机模式且 HTTP 仅绑定 loopback 时启用。 */
export function allowsLocalComputerUse(environment: Pick<ParsedEnvironment, "LFAA_LOCAL_MODE" | "SERVER_HOST">, platform = process.platform): boolean {
  return platform === "win32" && environment.LFAA_LOCAL_MODE && isLoopbackHost(environment.SERVER_HOST);
}

const environment = validation.value as ParsedEnvironment;
// 本机 CLI 只在回环监听地址使用持久签名密钥；外部监听仍遵循生产部署配置要求。
const loopbackHost = environment.SERVER_HOST.toLocaleLowerCase();
const localCliMode = environment.LFAA_LOCAL_MODE && isLoopbackHost(loopbackHost);
// 账户/Provider/会话根固定由本机 Home 管理；可选业务内容由 Settings Owner 管理。
const dataDirectoryChangeSupported = false;
const dataDirectoryChangeUnavailableReason = dataDirectoryIsExternallyManaged
  ? "LFAA_DATA_DIR 由启动进程的环境变量显式指定；请修改该部署配置。"
  : "业务 Data 根由设置中心的项目与存储配置管理；账户数据固定保存在 LFAA Home。";
// 未配置时使用系统账户持久目录；显式生产部署路径仍必须为绝对路径，避免数据依赖启动工作目录。
if (environment.NODE_ENV === "production" && !localCliMode && environment.LFAA_DATA_DIR && !isAbsolute(environment.LFAA_DATA_DIR)) {
  throw new Error("生产环境必须将 LFAA_DATA_DIR 配置为绝对路径并指向持久化目录。");
}

const configuredJwtSecret = environment.JWT_SECRET.trim();

function resolveWebAuthnConfiguration(): { rpId: string | null; origin: string | null; enabled: boolean } {
  const configuredRpId = environment.WEBAUTHN_RP_ID.toLocaleLowerCase();
  const configuredOrigin = environment.WEBAUTHN_ORIGIN;
  const invalidConfiguration = (message: string): { rpId: null; origin: null; enabled: false } => {
    if (environment.NODE_ENV === "production") return { rpId: null, origin: null, enabled: false };
    throw new Error(message);
  };

  if (!configuredRpId && !configuredOrigin) {
    return environment.NODE_ENV === "development"
      ? { rpId: "localhost", origin: "http://localhost:5173", enabled: true }
      : { rpId: null, origin: null, enabled: false };
  }

  if (!configuredRpId || !configuredOrigin) {
    return invalidConfiguration("通行密钥配置必须同时提供 WEBAUTHN_RP_ID 与 WEBAUTHN_ORIGIN。");
  }

  if (!/^(?:localhost|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/u.test(configuredRpId) || isIP(configuredRpId)) {
    return invalidConfiguration("WEBAUTHN_RP_ID 必须是有效域名；本地开发可使用 localhost，不可填写 IP 地址或端口。");
  }

  let originUrl: URL;
  try {
    originUrl = new URL(configuredOrigin);
  } catch {
    return invalidConfiguration("WEBAUTHN_ORIGIN 必须是完整的 HTTP 或 HTTPS Origin。");
  }

  const normalizedOrigin = originUrl.origin;
  const localDevelopmentOrigin = (environment.NODE_ENV !== "production" || environment.LFAA_DESKTOP_MODE)
    && originUrl.protocol === "http:"
    && originUrl.hostname === "localhost";
  if (normalizedOrigin !== configuredOrigin || originUrl.pathname !== "/" || originUrl.search || originUrl.hash || originUrl.username || originUrl.password) {
    return invalidConfiguration("WEBAUTHN_ORIGIN 只能包含协议、域名和可选端口，不得包含路径、查询参数或凭据。");
  }
  if (originUrl.protocol !== "https:" && !localDevelopmentOrigin) {
    return invalidConfiguration("通行密钥仅允许 HTTPS；开发环境可使用 http://localhost。");
  }
  if (environment.NODE_ENV === "production" && !environment.LFAA_DESKTOP_MODE && configuredRpId === "localhost") {
    return invalidConfiguration("生产环境 WEBAUTHN_RP_ID 必须使用实际部署域名。");
  }

  const originHost = originUrl.hostname.toLocaleLowerCase();
  if (originHost !== configuredRpId && !originHost.endsWith(`.${configuredRpId}`)) {
    return invalidConfiguration("WEBAUTHN_RP_ID 必须与 WEBAUTHN_ORIGIN 的域名一致或为其父域。");
  }

  return { rpId: configuredRpId, origin: normalizedOrigin, enabled: true };
}

const webauthnConfiguration = resolveWebAuthnConfiguration();

if (environment.NODE_ENV === "production" && !environment.LFAA_DESKTOP_MODE && !localCliMode && configuredJwtSecret.length < 32) {
  throw new Error("生产环境必须设置至少 32 个字符的 JWT_SECRET。");
}

if (configuredJwtSecret.length > 0 && configuredJwtSecret.length < 32) {
  throw new Error("JWT_SECRET 至少需要 32 个字符；开发环境可留空以使用本机持久密钥。");
}

function isWithinDirectory(parentDirectory: string, candidateDirectory: string): boolean {
  const relativePath = relative(resolve(parentDirectory), resolve(candidateDirectory));
  return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

const homeDirectory = resolveHomeDirectory(repositoryRoot, environment.LFAA_HOME);
const dataDirectory = resolveDataDirectory(repositoryRoot, environment.LFAA_DATA_DIR, {
  lfaaHome: homeDirectory,
  useStoredDataDirectory: !dataDirectoryIsExternallyManaged
});
const homePaths = resolveHomePaths(homeDirectory);
const pluginInstallDirectory = resolve(homeDirectory, "profiles");
const accountDirectories = Object.entries(homePaths).filter(([name]) => name !== "root").map(([, path]) => path);
const businessDirectories = Object.entries(resolveDataPaths(dataDirectory)).filter(([name]) => name !== "root").map(([, path]) => path);
if (accountDirectories.some(path => isWithinDirectory(path, dataDirectory) || isWithinDirectory(dataDirectory, path))
  || businessDirectories.some(path => isWithinDirectory(pluginInstallDirectory, path) || isWithinDirectory(path, pluginInstallDirectory))) {
  throw new Error("LFAA_DATA_DIR 必须与账户分类目录和 LFAA_HOME/profiles 分开；默认位置为 LFAA_HOME/data。");
}

mkdirSync(dataDirectory, { recursive: true });
ensureHomeDirectories(homeDirectory);

function readLocalJwtSecret(secretPath: string): string {
  const secret = readFileSync(secretPath, "utf8").trim();
  if (secret.length < 32) {
    throw new Error(`本机 JWT 密钥文件无效：${secretPath}`);
  }
  return secret;
}

function loadOrCreateLocalJwtSecret(secretPath: string): string {
  protectPrivateDirectory(dirname(secretPath));
  mkdirSync(dirname(secretPath), { recursive: true });
  try {
    return readLocalJwtSecret(secretPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const secret = randomBytes(48).toString("base64url");
  try {
    writeFileSync(secretPath, `${secret}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return secret;
  } catch (error) {
    // 多个本机控制端同时首次启动时，采用先创建成功的密钥，确保共享数据目录中的会话可互验。
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return readLocalJwtSecret(secretPath);
    }
    throw error;
  }
}

function loadOrCreateLocalDaemonToken(tokenPath: string): string {
  protectPrivateDirectory(dirname(tokenPath));
  mkdirSync(dirname(tokenPath), { recursive: true });
  try {
    const existing = readFileSync(tokenPath, "utf8").trim();
    if (existing.length < 32) throw new Error("本机 Daemon 通信密钥文件无效。");
    return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const token = randomBytes(48).toString("base64url");
  try {
    writeFileSync(tokenPath, `${token}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const existing = readFileSync(tokenPath, "utf8").trim();
      if (existing.length >= 32) return existing;
    }
    throw error;
  }
}

// 开发、桌面和回环监听的本机 CLI 持久保存签名密钥在账户 Home，避免重启使所有会话失效。
const localJwtSecret = configuredJwtSecret.length === 0
  && (environment.NODE_ENV === "development" || environment.LFAA_DESKTOP_MODE || localCliMode)
  ? loadOrCreateLocalJwtSecret(resolve(homePaths.credentials, "jwt-secret"))
  : "";
const localDaemonToken = loadOrCreateLocalDaemonToken(resolve(homePaths.credentials, "daemon-token"));
// 账户分类只进入 Home；游戏、环境、缓存和日志等业务分类只进入 Data 根。
ensureDataDirectories(dataDirectory);

export const config = {
  nodeEnvironment: environment.NODE_ENV,
  host: environment.SERVER_HOST,
  port: environment.SERVER_PORT,
  repositoryRoot,
  homeDirectory,
  pluginInstallDirectory,
  dataDirectory,
  dataDirectoryExternallyManaged: dataDirectoryIsExternallyManaged,
  dataDirectoryMigrationRequestPath: process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH?.trim()
    ? resolve(process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH.trim())
    : resolve(repositoryRoot, ".lfaa-data-directory.pending.json"),
  dataDirectoryChangeSupported,
  dataDirectoryChangeUnavailableReason,
  desktopMode: environment.LFAA_DESKTOP_MODE,
  /** 本机 Profile 的宿主能力；远程控制端必须通过目标 Daemon 执行文件与进程操作。 */
  localHostExecution: environment.LFAA_DESKTOP_MODE || localCliMode,
  localComputerUse: allowsLocalComputerUse(environment),
  allowPrivateMcpNetwork: allowsPrivateMcpNetwork(environment),
  desktopDataDirectoryManaged: dataDirectoryWasResolvedByDesktopShell,
  desktopInstallDirectory: process.env.LFAA_DESKTOP_INSTALL_DIRECTORY?.trim()
    ? resolve(process.env.LFAA_DESKTOP_INSTALL_DIRECTORY.trim())
    : null,
  databasePath: resolve(homePaths.database, "lfaa.sqlite"),
  daemonToken: localDaemonToken,
  logLevel: environment.LOG_LEVEL,
  webauthn: webauthnConfiguration,
  githubApp: {
    clientId: environment.LFAA_GITHUB_APP_CLIENT_ID,
    clientSecret: environment.LFAA_GITHUB_APP_CLIENT_SECRET?.trim() ?? ""
  },
  jwtSecret: configuredJwtSecret || localJwtSecret || randomBytes(48).toString("base64url")
};
