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
import { createSteamcmdTask, getSteamcmdTask } from "lfaa-games-steamcmd/src/service.js";
const steamcmdTools: AiBusinessTool[] = [
  makeTool({
    id: "steamcmd.list-nodes", name: "steamcmd_list_nodes", applicationIds: ["steamcmd"],
    description: "读取已登记 SteamCMD Daemon 节点的 ID、名称、平台、在线状态和 SteamCMD 能力。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async () => listDaemonNodes().filter((node) => node.platform === "win32" && node.architecture === "x64").map(({ id, displayName, status, capabilities, version }) => ({ id, displayName, status, version, steamcmdReady: status === "online" && capabilities.includes("steamcmd-ready-v1"), fileOperationsSupported: status === "online" && capabilities.includes("node-filesystem-v1") }))
  }),
  makeTool({
    id: "steamcmd.run-task", name: "steamcmd_run_task", applicationIds: ["steamcmd"],
    description: "为指定在线 Windows x64 daemon 安装或校验 SteamCMD 工具本身。选择 install 或 verify。此工具不能安装游戏专用服务端。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" }, kind: { type: "string", enum: ["install", "verify"] } }, ["nodeId", "kind"]),
    parse: (value) => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId"), kind: Joi.string().valid("install", "verify").required() }).unknown(false), value),
    risk: () => "write",
    approval: (parameters) => ({ scopeKey: `steamcmd-node:${parameters.nodeId}`, scopeSummary: `SteamCMD 节点 ${parameters.nodeId}`, summary: `${parameters.kind === "install" ? "安装" : "校验"} SteamCMD 工具` }),
    execute: async (parameters, context) => {
      const task = createSteamcmdTask({ nodeId: String(parameters.nodeId), kind: parameters.kind as "install" | "verify", createdBy: context.userId });
      const finalTask = await waitForTask({ read: () => getSteamcmdTask(task.id), signal: context.signal, onProgress: context.onProgress, missingMessage: "找不到 SteamCMD 任务。" });
      return safeTaskView(finalTask as unknown as Record<string, unknown>);
    }
  })
];


export const name = "lfaaToolSteamcmd";
export const inject = ["lfaaTools", "lfaaSteamcmd"];
export function apply(ctx: Context): void { for (const tool of steamcmdTools) ctx.lfaaTools.registerTool(ctx, { ...tool, applicationIds: [...APPLICATION_IDS], coreManaged: true, onDemand: true }); }
