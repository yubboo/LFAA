/** 功能：装配各能力包的 HTTP 接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { registerRoutes as registerGateway } from "lfaa-api-gateway/src/health-controller.js";
import { registerRoutes as registerJobController } from "lfaa-api-job-controller/src/index.js";
import { registerRoutes as registerAccountController } from "lfaa-api-account-controller/src/index.js";
import { registerRoutes as registerSettingsController } from "lfaa-api-settings-controller/src/index.js";
import { registerRoutes as registerWritingController } from "lfaa-api-writing-controller/src/index.js";
import { registerRoutes as registerSessionController } from "lfaa-api-session-controller/src/index.js";
import { registerRoutes as registerMinecraftController } from "lfaa-api-minecraft-controller/src/index.js";
import { registerRoutes as registerWorkspaceFiles } from "lfaa-api-workspace-files/src/index.js";
import { registerRoutes as registerSteamcmdController } from "lfaa-api-steamcmd-controller/src/index.js";
export function createApiRouter(aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): Router {
  const router = Router();
  registerGateway(router, aiPluginHost, realtime);
  registerJobController(router, aiPluginHost, realtime);
  registerAccountController(router, aiPluginHost, realtime);
  registerSettingsController(router, aiPluginHost, realtime);
  registerWritingController(router, aiPluginHost, realtime);
  registerSessionController(router, aiPluginHost, realtime);
  registerMinecraftController(router, aiPluginHost, realtime);
  registerWorkspaceFiles(router, aiPluginHost, realtime);
  registerSteamcmdController(router, aiPluginHost, realtime);
  return router;
}
