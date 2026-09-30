/** 功能：登记 gateway 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { database } from "lfaa-storage-sqlite/src/database.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {

router.get("/health", (_request, response) => {
    try {
      database.prepare("SELECT 1 AS ready").get();
      response.json({
        status: "ok",
        service: "lfaa-server",
        persistence: "ready",
        timestamp: new Date().toISOString()
      });
    } catch {
      response.status(503).json({
        status: "error",
        service: "lfaa-server",
        persistence: "unavailable",
        timestamp: new Date().toISOString()
      });
    }
  });
}
