/**
 * 功能：创建控制端结构化日志器。
 * 作用：以 JSON 输出运行和请求日志，不记录请求正文、Cookie 或认证凭据。
 * 关联文件：packages/host/webserver/src/server.ts。
 */
import winston from "winston";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

let fileTransport: winston.transports.FileTransportInstance | null = null;
let fileDirectory = "";

/** 切换控制端结构化日志目录；Winston 限制单文件 5 MiB，并保留最多 5 个轮转文件。 */
export function configureFileLogDirectory(directory: string): void {
  const target = resolve(directory);
  if (target === fileDirectory) return;
  mkdirSync(target, { recursive: true });
  if (fileTransport) {
    const old = fileTransport
    logger.remove(old)
    if (typeof old.close === "function") old.close()
  }
  fileTransport = new winston.transports.File({
    dirname: target,
    filename: "control-plane.log",
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
    tailable: true
  });
  fileDirectory = target;
  logger.add(fileTransport);
}
