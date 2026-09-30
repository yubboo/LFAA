/**
 * 功能：在启动 Vite 前等待 LFAA 控制端健康就绪。
 * 作用：将前端 API 代理启动放在控制端健康检查之后，避免并行启动期间重复输出连接拒绝错误。
 * 关联文件：apps/web/package.json、apps/web/vite.config.ts、packages/api/gateway/src/index.ts、根目录 .env。
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(frontendRoot, "../..");
const environmentFile = resolve(repositoryRoot, ".env");

if (existsSync(environmentFile)) {
  try {
    process.loadEnvFile(environmentFile);
  } catch (error) {
    console.error(`无法读取根目录 .env：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const configuredPort = process.env.SERVER_PORT?.trim() || "3000";
if (!/^\d{1,5}$/u.test(configuredPort) || Number(configuredPort) < 1 || Number(configuredPort) > 65535) {
  console.error("SERVER_PORT 必须是 1–65535 之间的端口号。");
  process.exit(1);
}

const healthUrl = `http://127.0.0.1:${configuredPort}/api/health`;
const startupTimeoutMilliseconds = 120_000;
const retryIntervalMilliseconds = 500;
const progressIntervalMilliseconds = 15_000;
const startedAt = Date.now();
let nextProgressAt = startedAt + progressIntervalMilliseconds;

console.log(`等待 LFAA 控制端就绪：${healthUrl}`);

while (Date.now() - startedAt < startupTimeoutMilliseconds) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
    if (response.ok) {
      const health = await response.json();
      if (health.status === "ok" && health.service === "lfaa-server" && health.persistence === "ready") {
        console.log("LFAA 控制端已就绪，正在启动前端。");
        process.exit(0);
      }
    }
  } catch {
    // 控制端启动前的拒绝连接由就绪等待吸收；只在超时或就绪时输出一次状态。
  }

  if (Date.now() >= nextProgressAt) {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000);
    console.log(`控制端仍在启动，已等待 ${elapsedSeconds} 秒。请留意 server 终端的启动错误。`);
    nextProgressAt += progressIntervalMilliseconds;
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, retryIntervalMilliseconds));
}

console.error(`等待控制端超过 ${startupTimeoutMilliseconds / 1_000} 秒，前端未启动。请检查 server 终端日志和 SERVER_PORT 配置。`);
process.exitCode = 1;
