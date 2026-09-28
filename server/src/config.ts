/**
 * 功能：读取并校验控制端运行配置。
 * 作用：加载仓库根目录的本地环境文件，规范监听地址、数据目录、签名密钥与本机 Daemon 通信密钥。
 * 关联文件：server/src/index.ts、server/src/database.ts、根目录 .env.example。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Joi from "joi";
import { randomBytes } from "node:crypto";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const environmentFile = resolve(repositoryRoot, ".env");

if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  SERVER_HOST: Joi.string().trim().min(1).default("127.0.0.1"),
  SERVER_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  LFAA_DATA_DIR: Joi.string().trim().min(1).default("data"),
  JWT_SECRET: Joi.string().allow("").max(512).default(""),
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
  LFAA_DATA_DIR: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
}

const environment = validation.value as ParsedEnvironment;
const configuredJwtSecret = environment.JWT_SECRET.trim();

if (environment.NODE_ENV === "production" && configuredJwtSecret.length < 32) {
  throw new Error("生产环境必须设置至少 32 个字符的 JWT_SECRET。");
}

if (configuredJwtSecret.length > 0 && configuredJwtSecret.length < 32) {
  throw new Error("JWT_SECRET 至少需要 32 个字符；开发环境可留空以使用本机持久密钥。");
}

const dataDirectory = isAbsolute(environment.LFAA_DATA_DIR)
  ? environment.LFAA_DATA_DIR
  : resolve(repositoryRoot, environment.LFAA_DATA_DIR);

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

// 开发环境未设置固定密钥时持久保存本机签名密钥，避免控制端重启使所有会话失效。
const localDevelopmentJwtSecret = configuredJwtSecret.length === 0 && environment.NODE_ENV === "development"
  ? loadOrCreateLocalJwtSecret(resolve(dataDirectory, "credentials", "jwt-secret"))
  : "";
const localDaemonToken = loadOrCreateLocalDaemonToken(resolve(dataDirectory, "credentials", "daemon-token"));

export const config = {
  nodeEnvironment: environment.NODE_ENV,
  host: environment.SERVER_HOST,
  port: environment.SERVER_PORT,
  dataDirectory,
  databasePath: resolve(dataDirectory, "database", "lfaa.sqlite"),
  daemonToken: localDaemonToken,
  logLevel: environment.LOG_LEVEL,
  jwtSecret: configuredJwtSecret || localDevelopmentJwtSecret || randomBytes(48).toString("base64url")
};
