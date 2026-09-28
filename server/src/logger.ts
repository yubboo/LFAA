/**
 * 功能：创建控制端结构化日志器。
 * 作用：以 JSON 输出运行和请求日志，不记录请求正文、Cookie 或认证凭据。
 * 关联文件：server/src/index.ts。
 */
import winston from "winston";
import { config } from "./config.js";

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});
