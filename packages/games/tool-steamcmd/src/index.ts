/**
 * 功能：lfaa-tool-steamcmd 领域工具合同与真实服务适配。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：core/tools/tool-contract.ts、同领域服务、bundle/base。
 */
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { makeTool, strictObject, parseWithSchema, idSchema, safeTaskView, waitForTask, type AiBusinessTool } from "lfaa-tools/src/tool-contract.js";
import { listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createSteamcmdServer, createSteamcmdServerTask, createSteamcmdTask, getSteamcmdServer, getSteamcmdTask, listSteamcmdServers } from "lfaa-games-steamcmd/src/service.js";
const steamcmdTools: AiBusinessTool[] = [
  makeTool({
    id: "steamcmd.list-nodes", name: "steamcmd_list_nodes", applicationIds: ["steamcmd"],
    description: "读取已登记 SteamCMD Daemon 节点的 ID、名称、平台、在线状态和 SteamCMD 能力。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async () => listDaemonNodes().filter((node) => node.platform === "win32" && node.architecture === "x64").map(({ id, displayName, status, capabilities, version }) => ({ id, displayName, status, version, steamcmdReady: status === "online" && capabilities.includes("steamcmd-ready-v1"), fileOperationsSupported: status === "online" && capabilities.includes("node-filesystem-v1") }))
  }),
  makeTool({
    id: "steamcmd.run-task", name: "steamcmd_run_task", applicationIds: ["steamcmd"],
    description: "为指定在线 Windows x64 daemon 安装或校验 SteamCMD 工具本身。游戏专用服务端使用 steamcmd_list_servers、steamcmd_create_server、steamcmd_server_task。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" }, kind: { type: "string", enum: ["install", "verify"] } }, ["nodeId", "kind"]),
    parse: (value) => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId"), kind: Joi.string().valid("install", "verify").required() }).unknown(false), value),
    risk: () => "write",
    approval: (parameters) => ({ scopeKey: `steamcmd-node:${parameters.nodeId}`, scopeSummary: `SteamCMD 节点 ${parameters.nodeId}`, summary: `${parameters.kind === "install" ? "安装" : "校验"} SteamCMD 工具` }),
    execute: async (parameters, context) => {
      const task = createSteamcmdTask({ nodeId: String(parameters.nodeId), kind: parameters.kind as "install" | "verify", createdBy: context.userId });
      const finalTask = await waitForTask({ read: () => getSteamcmdTask(task.id), signal: context.signal, onProgress: context.onProgress, missingMessage: "找不到 SteamCMD 任务。" });
      return safeTaskView(finalTask as unknown as Record<string, unknown>);
    }
  }),
  makeTool({
    id: "steamcmd.list-servers", name: "steamcmd_list_servers", adminOnly: true, applicationIds: ["steamcmd"],
    description: "查看指定节点上已配置的 Steam Dedicated Server 服务端记录、Tool AppID、安装和运行状态。不会把客户端商店 AppID 推断为可匿名安装的服务端。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" } }, ["nodeId"]),
    parse: value => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId") }).unknown(false), value),
    execute: async parameters => listSteamcmdServers(String(parameters.nodeId)).map(({ launchArguments: _arguments, stopCommand: _stop, ...server }) => server)
  }),
  makeTool({
    id: "steamcmd.create-server", name: "steamcmd_create_server", adminOnly: true, applicationIds: ["steamcmd"],
    description: "创建 Steam Dedicated Server 服务端配置，toolAppId 必须是该游戏已发布的 Dedicated Server Tool AppID。只有用户明确说已阅读并接受此服务端许可/EULA 时才传 eulaAccepted=true；不得用客户端商店 AppID 或猜测的 EULA 同意替代。启动程序路径、参数、停服指令可先留空，稍后在游戏库维护。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" }, name: { type: "string", maxLength: 80 }, toolAppId: { type: "integer", minimum: 1, maximum: 2147483647 }, installDirectory: { type: "string", maxLength: 512 }, eulaAccepted: { type: "boolean", const: true }, executablePath: { type: "string", maxLength: 1024 }, launchArguments: { type: "array", items: { type: "string", maxLength: 1024 }, maxItems: 64 }, stopCommand: { type: "string", maxLength: 120 }, stopTimeoutSeconds: { type: "integer", minimum: 5, maximum: 300 } }, ["nodeId", "name", "toolAppId", "installDirectory", "eulaAccepted"]),
    parse: value => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId"), name: Joi.string().trim().min(1).max(80).required(), toolAppId: Joi.number().integer().min(1).max(2147483647).required(), installDirectory: Joi.string().trim().min(1).max(512).required(), eulaAccepted: Joi.boolean().valid(true).required(), executablePath: Joi.string().max(1024).allow(""), launchArguments: Joi.array().items(Joi.string().max(1024).pattern(/^[^\r\n\u0000]*$/u)).max(64), stopCommand: Joi.string().max(120).pattern(/^[^\r\n\u0000-\u001f\u007f]*$/u).allow(""), stopTimeoutSeconds: Joi.number().integer().min(5).max(300) }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `steamcmd-server:${parameters.nodeId}:${parameters.toolAppId}`, scopeSummary: `${parameters.name} · Tool AppID ${parameters.toolAppId}`, summary: `记录用户已明确接受该服务端许可/EULA 并创建 Steam 游戏服务器配置` }),
    execute: async (parameters, context) => {
      const server = createSteamcmdServer({ nodeId: String(parameters.nodeId), createdBy: context.userId, name: String(parameters.name), toolAppId: Number(parameters.toolAppId), installDirectory: String(parameters.installDirectory), executablePath: String(parameters.executablePath ?? ""), launchArguments: Array.isArray(parameters.launchArguments) ? parameters.launchArguments.map(String) : [], stopCommand: String(parameters.stopCommand ?? ""), stopTimeoutSeconds: Number(parameters.stopTimeoutSeconds ?? 60), eulaAccepted: true });
      const { launchArguments: _arguments, stopCommand: _stop, ...safe } = server;
      return safe;
    }
  }),
  makeTool({
    id: "steamcmd.server-task", name: "steamcmd_server_task", adminOnly: true, applicationIds: ["steamcmd"], retryAfterRecovery: true,
    description: "在已配置 Steam 专用服务端上安装、更新、启动或停止任务。安装/更新只接受 Steamworks 已发布的 Dedicated Server Tool AppID；启动需要服务器配置包含已确认的 EULA、.exe、启动参数和停服指令。状态以目标 Daemon 回报为准；启动任务确认进程启动，不代表网络可连接。",
    schema: strictObject({ serverId: { type: "string", format: "uuid" }, kind: { type: "string", enum: ["install-server", "update-server", "start-server", "stop-server"] } }, ["serverId", "kind"]),
    parse: value => parseWithSchema(Joi.object({ serverId: idSchema("serverId"), kind: Joi.string().valid("install-server", "update-server", "start-server", "stop-server").required() }).unknown(false), value),
    risk: parameters => parameters.kind === "start-server" || parameters.kind === "stop-server" ? "dangerous" : "write",
    approval: parameters => ({ scopeKey: `steamcmd-server:${parameters.serverId}`, scopeSummary: `Steam 游戏服务器 ${parameters.serverId}`, summary: `Steam 游戏服务器操作：${parameters.kind}` }),
    execute: async (parameters, context) => {
      const server = getSteamcmdServer(String(parameters.serverId));
      if (!server) throw new Error("找不到指定 Steam 游戏服务器。");
      const task = createSteamcmdServerTask({ serverId: server.id, nodeId: server.nodeId, createdBy: context.userId, kind: parameters.kind as "install-server" | "update-server" | "start-server" | "stop-server" });
      const result = await waitForTask({ read: () => getSteamcmdTask(task.id), signal: context.signal, onProgress: context.onProgress, missingMessage: "找不到 Steam 游戏服务任务。" });
      return safeTaskView(result as unknown as Record<string, unknown>);
    }
  })
];


export const name = "lfaaToolSteamcmd";
export const inject = ["lfaaTools", "lfaaSteamcmd"];
export function apply(ctx: Context): void { for (const tool of steamcmdTools) ctx.lfaaTools.registerTool(ctx, { ...tool, applicationIds: [...APPLICATION_IDS], coreManaged: true, onDemand: true }); }
