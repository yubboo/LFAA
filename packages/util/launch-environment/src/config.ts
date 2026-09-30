/**
 * 功能：读取并校验控制端运行配置。
 * 作用：加载仓库根目录的本地环境文件，规范监听地址、数据目录、签名密钥与本机 Daemon 通信密钥，并识别数据目录迁移的受支持启动方式。
 * 关联文件：packages/host/webserver/src/server.ts、packages/storage/storage-sqlite/src/database.ts、packages/workspace/data-directory/src/service.ts、scripts/resolve-data-directory.mjs、scripts/start-dev.ps1、apps/desktop-electron/src/main.mjs、apps/desktop-tauri/src-tauri/src/main.rs、根目录 .env.example。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { isIP } from "node:net";
import { findRepositoryRoot } from "lfaa-home-paths/src/index.mjs";
import Joi from "joi";
import { randomBytes } from "node:crypto";
import { resolveDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";

const repositoryRoot = findRepositoryRoot(import.meta.url);
const environmentFile = resolve(repositoryRoot, ".env");
// 保留 .env 加载前的值，以区分部署显式覆盖和项目启动器注入的解析结果。
const externallyConfiguredDataDirectory = process.env.LFAA_DATA_DIR?.trim() ?? "";
const dataDirectoryWasResolvedByProjectLauncher = process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER === "1";
const fullLauncherSupportsDataDirectoryMigration = process.env.LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED === "1";
const dataDirectoryWasResolvedByDesktopShell = process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP === "1";
const desktopShellSupportsDataDirectoryMigration = process.env.LFAA_DESKTOP_MODE === "true"
  && process.env.LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED === "1"
  && dataDirectoryWasResolvedByDesktopShell;
const dataDirectoryIsExternallyManaged = Boolean(externallyConfiguredDataDirectory)
  && !dataDirectoryWasResolvedByProjectLauncher
  && !dataDirectoryWasResolvedByDesktopShell;

if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  SERVER_HOST: Joi.string().trim().min(1).default("127.0.0.1"),
  SERVER_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  LFAA_DESKTOP_MODE: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_LOCAL_MODE: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_SERVE_FRONTEND: Joi.boolean().truthy("1").falsy("0").default(false),
  LFAA_DATA_DIR: Joi.string().trim().min(1).default("data"),
  JWT_SECRET: Joi.string().allow("").max(512).default(""),
  WEBAUTHN_RP_ID: Joi.string().trim().allow("").max(253).default(""),
  WEBAUTHN_ORIGIN: Joi.string().trim().allow("").max(512).default(""),
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
  LFAA_DATA_DIR: string;
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
  LOG_LEVEL: string;
}

const environment = validation.value as ParsedEnvironment;
// 本机 CLI 只在回环监听地址使用持久签名密钥；外部监听仍遵循生产部署配置要求。
const loopbackHost = environment.SERVER_HOST.toLocaleLowerCase();
const localCliMode = environment.LFAA_LOCAL_MODE && (loopbackHost === "localhost" || loopbackHost === "::1" || (isIP(loopbackHost) === 4 && loopbackHost.startsWith("127.")));
const dataDirectoryChangeSupported = process.platform === "win32"
  && ((environment.NODE_ENV === "development"
    && fullLauncherSupportsDataDirectoryMigration
    && (!externallyConfiguredDataDirectory || dataDirectoryWasResolvedByProjectLauncher))
    || (environment.LFAA_DESKTOP_MODE && desktopShellSupportsDataDirectoryMigration
      && (!externallyConfiguredDataDirectory || dataDirectoryWasResolvedByDesktopShell)));
const dataDirectoryChangeUnavailableReason = dataDirectoryIsExternallyManaged
  ? "LFAA_DATA_DIR 由启动进程的环境变量显式指定；请修改该部署配置。"
  : environment.NODE_ENV === "production"
    ? environment.LFAA_DESKTOP_MODE
      ? "桌面端数据位置由平台外壳管理；请重启 LFAA 桌面程序后再修改。"
      : "服务器数据目录由部署环境配置管理；Linux 服务请在持久化卷上设置绝对路径 LFAA_DATA_DIR。"
    : process.platform !== "win32"
      ? "当前运行环境不支持通过设置页迁移数据目录；请在启动环境中配置 LFAA_DATA_DIR。"
      : "请通过项目启动器完整启动 Windows 开发服务后，再从设置页修改；完整启动器会在服务停止后执行数据迁移。";
// 生产控制端必须显式使用持久化绝对路径，避免把数据库和凭据写入源码仓库。
if (environment.NODE_ENV === "production" && !localCliMode && !isAbsolute(environment.LFAA_DATA_DIR)) {
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

const dataDirectory = resolveDataDirectory(repositoryRoot, environment.LFAA_DATA_DIR);

mkdirSync(dataDirectory, { recursive: true });

function readLocalJwtSecret(secretPath: string): string {
  const secret = readFileSync(secretPath, "utf8").trim();
  if (secret.length < 32) {
    throw new Error(`本机 JWT 密钥文件无效：${secretPath}`);
  }
  return secret;
}

function loadOrCreateLocalJwtSecret(secretPath: string): string {
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

// 开发、桌面和回环监听的本机 CLI 持久保存签名密钥，避免重启使所有会话失效。
const localJwtSecret = configuredJwtSecret.length === 0
  && (environment.NODE_ENV === "development" || environment.LFAA_DESKTOP_MODE || localCliMode)
  ? loadOrCreateLocalJwtSecret(resolve(dataDirectory, "credentials", "jwt-secret"))
  : "";
const localDaemonToken = loadOrCreateLocalDaemonToken(resolve(dataDirectory, "credentials", "daemon-token"));

export const config = {
  nodeEnvironment: environment.NODE_ENV,
  host: environment.SERVER_HOST,
  port: environment.SERVER_PORT,
  repositoryRoot,
  dataDirectory,
  dataDirectoryMigrationRequestPath: process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH?.trim()
    ? resolve(process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH.trim())
    : resolve(repositoryRoot, ".lfaa-data-directory.pending.json"),
  dataDirectoryChangeSupported,
  dataDirectoryChangeUnavailableReason,
  desktopMode: environment.LFAA_DESKTOP_MODE,
  desktopDataDirectoryManaged: dataDirectoryWasResolvedByDesktopShell,
  desktopInstallDirectory: process.env.LFAA_DESKTOP_INSTALL_DIRECTORY?.trim()
    ? resolve(process.env.LFAA_DESKTOP_INSTALL_DIRECTORY.trim())
    : null,
  databasePath: resolve(dataDirectory, "database", "lfaa.sqlite"),
  daemonToken: localDaemonToken,
  logLevel: environment.LOG_LEVEL,
  webauthn: webauthnConfiguration,
  jwtSecret: configuredJwtSecret || localJwtSecret || randomBytes(48).toString("base64url")
};
