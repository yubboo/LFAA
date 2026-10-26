/**
 * 功能：lfaa-tool-minecraft 领域工具合同与真实服务适配。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：core/tools/tool-contract.ts、同领域服务、bundle/base。
 */
import { createHash } from "node:crypto";
import { getUserSettings } from "lfaa-settings/src/service.js";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { makeTool, strictObject, parseWithSchema, idSchema, oneString, objectValue, safeTaskView, waitForTask, type AiBusinessTool, type AiBusinessToolContext } from "lfaa-tools/src/tool-contract.js";
import { listMinecraftCores, listMinecraftCoreBuilds, getPaperCoreSummary, getMinecraftCoreCompatibility, requireMinecraftCore, resolveMinecraftCoreArtifact } from "lfaa-games-minecraft/src/core-sources.js";
import { provisionMinecraftServer, MinecraftProvisionPreparationError } from "lfaa-games-minecraft/src/deployment-service.js";
import { deleteMinecraftInstance, restartMinecraftInstance, sendMinecraftConsoleCommand } from "lfaa-games-minecraft/src/service.js";
import { getDaemonDataRoot, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { getMinecraftInstance, getMinecraftInstanceLogs, getMinecraftReleases, listMinecraftDeployments, listMinecraftInstances, createMinecraftDeployment, retryMinecraftDeployment, startMinecraftInstance, stopMinecraftInstance, backupMinecraftWorld, updateMinecraftServerProperties } from "lfaa-games-minecraft/src/service.js";
import { getMinecraftTask,requestMinecraftTaskCancellation } from "lfaa-jobs/src/minecraft-queue.js";
async function waitForMinecraftTask(id:string,context:AiBusinessToolContext,missingMessage:string) {
  const cancel=()=>{const task=getMinecraftTask(id);if(task&&task.createdBy===context.userId&&["install","start"].includes(task.kind)&&task.payload.executionMode==="native")requestMinecraftTaskCancellation(id,context.userId);};
  context.signal.addEventListener("abort",cancel,{once:true});
  try{if(context.signal.aborted)cancel();return await waitForTask({read:()=>getMinecraftTask(id),signal:context.signal,onProgress:context.onProgress,missingMessage});}
  finally{context.signal.removeEventListener("abort",cancel);}
}
const minecraftTools: AiBusinessTool[] = [
  makeTool({
    id: "minecraft.list-cores", name: "minecraft_list_cores", applicationIds: ["minecraft"],
    description: "读取真实核心版本和适用类型。serverType/compatibleContent 是核心 Owner 维护的插件、模组、混合、代理/基岩兼容信息；category 是下载目录原分类，不能单独用来判断是否支持插件。指定 core 时只返回该核心，避免无关版本占用上下文。core=Paper 只查询 PaperMC 官方目录；用户指定核心或提出插件/模组兼容目标时按需读取并遵守此结果，不静默换核心。",
    schema: strictObject({ core: { type: "string" } }), parse: value => parseWithSchema(Joi.object({ core: oneString("core", 32).optional() }).unknown(false), value),
    execute: async parameters => {
      const core = parameters.core ? requireMinecraftCore(String(parameters.core)) : null;
      if (core === "Paper") return { cores: [await getPaperCoreSummary()], errors: [] };
      const catalog = await listMinecraftCores();
      return core ? { ...catalog, cores: catalog.cores.filter(item => item.name === core) } : catalog;
    }
  }),
  makeTool({
    id: "minecraft.list-core-builds", name: "minecraft_list_core_builds", applicationIds: ["minecraft"],
    description: "查询选定核心版本的真实构建列表，自动开服前确认构建 ID。",
    schema: strictObject({ core: { type: "string" }, version: { type: "string" }, offset: { type: "integer", minimum: 0 } }, ["core", "version"]),
    parse: value => parseWithSchema(Joi.object({ core: oneString("core", 32), version: oneString("version", 120), offset: Joi.number().integer().min(0).max(100000) }).unknown(false), value),
    execute: async parameters => listMinecraftCoreBuilds(String(parameters.core), String(parameters.version), Number(parameters.offset ?? 0))
  }),
  makeTool({
    id: "minecraft.resolve-artifact", name: "minecraft_resolve_core_artifact", applicationIds: ["minecraft"],
    description: "只读核实核心版本/构建、官方来源摘要及部署 Owner 实际采用的 Java 主版本；不安装、不创建实例、不接受许可。需要预检或用户指定 Java 时用此证据核对 runtime_list/runtime_resolve，不能把已安装版本当核心要求。普通自动开服可直接由部署工具解析。",
    schema: strictObject({ core: { type: "string" }, version: { type: "string" }, build: { type: "string" } }, ["core", "version"]),
    parse: value => parseWithSchema(Joi.object({ core: oneString("core", 32), version: oneString("version", 120), build: oneString("build", 120).optional() }).unknown(false), value),
    execute: async parameters => {
      const artifact = await resolveMinecraftCoreArtifact(String(parameters.core), String(parameters.version), parameters.build === undefined ? undefined : String(parameters.build));
      // PHP 核心保留历史 Java 列，但不能把它当作运行环境需求交给模型。
      return { core: artifact.core, ...getMinecraftCoreCompatibility(artifact.core), version: artifact.version, build: artifact.build, source: artifact.source, filename: artifact.filename, algorithm: artifact.algorithm, digest: artifact.digest,
        javaMajor: artifact.launchKind === "php" ? null : artifact.javaMajor, runtimeType: artifact.launchKind === "php" ? "php" : "java" };
    }
  }),
  makeTool({
    id: "minecraft.provision", name: "minecraft_provision_server", applicationIds: ["minecraft"],
    description: "一次任务自动准备匹配 Java、下载校验核心、配置、登记并启动，等待真实就绪结果。无需单独安装 Java 或手写实例元数据。build 可省略，Paper 自动选择该版本最新稳定构建；端口省略时从设置默认值起分配未登记端口。eulaAccepted=true 包含接受 Minecraft EULA 与核心许可，沿用三种权限模式。失败后读取任务/日志，确认失败可用恢复工具；未知结果不重放。代理须提供同节点真实运行且显式关闭正版验证的后端。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" }, name: { type: "string", maxLength: 48 }, core: { type: "string" }, version: { type: "string" }, build: { type: "string" }, javaRuntimeId: { type: "string", maxLength: 128, description: "用户明确选择 Java 时传入目标节点真实运行时 ID；与核心要求不匹配会拒绝，省略表示由 Owner 自动选择，不代表用户指定版本已采用。" }, eulaAccepted: { type: "boolean", const: true }, memoryMb: { type: "integer" }, serverPort: { type: "integer" }, proxyBackendInstanceId: { type: "string", format: "uuid" } }, ["nodeId", "name", "core", "version", "eulaAccepted"]),
    parse: value => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId"), name: oneString("name", 48), core: oneString("core", 32), version: oneString("version", 120), build: oneString("build", 120).optional(), javaRuntimeId: oneString("javaRuntimeId", 128).optional(), eulaAccepted: Joi.boolean().valid(true).required(), memoryMb: Joi.number().integer().min(1024).max(32768), serverPort: Joi.number().integer().min(1024).max(65535), proxyBackendInstanceId: Joi.string().guid() }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({ scopeKey: `node:${parameters.nodeId}:minecraft-provision:${String(parameters.name).normalize("NFC").toLowerCase()}`, scopeSummary: `Minecraft ${parameters.core} ${parameters.version} · ${parameters.name}`, summary: "接受 Minecraft EULA 与所选核心许可，下载、安装并启动服务器；使用节点当前系统账户权限。" }),
    execute: async (parameters, context) => {
      const compatibility = getMinecraftCoreCompatibility(String(parameters.core));
      let created: Awaited<ReturnType<typeof provisionMinecraftServer>>;
      try {
        created = await provisionMinecraftServer({ ...parameters, userId: context.userId, signal: context.signal } as unknown as Parameters<typeof provisionMinecraftServer>[0]);
      } catch (error) {
        if (!(error instanceof MinecraftProvisionPreparationError)) throw error;
        return { error: error.message, errorCode: error.errorCode, executionState: error.executionState, executed: false, retryable: error.retryable,
          recovery: error.retryable ? "工件准备连接失败；尚未创建实例、部署或节点任务。检查来源连接后可重试，仍受当前权限和预算限制。" : "工件准备校验失败；尚未创建任务。按真实版本/构建目录纠正参数，不重复相同无效请求。" };
      }
      const task = await waitForMinecraftTask(created.task.id, context, "找不到自动开服任务。");
      return { instanceId: created.instance.id, deploymentId: created.deployment.id, core: created.instance.coreType, serverType: compatibility.serverType, compatibleContent: compatibility.compatibleContent,
        version: created.instance.releaseId, javaRequirementMajor: created.instance.javaMajor, task: safeTaskView(task as unknown as Record<string, unknown>) };
    }
  }),
  makeTool({
    id: "minecraft.list-nodes", name: "minecraft_list_nodes", applicationIds: ["minecraft"],
    description: "读取已登记 Minecraft Daemon 节点的 ID、名称、平台、在线状态和 Minecraft 能力。部署前确认目标节点在线。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async (_, context) => listDaemonNodes().filter((node) => node.platform === "win32" && node.architecture === "x64").map(({ id, displayName, status, capabilities, version, javaRuntimes }) => ({ id, displayName, status, version, minecraftSupported: capabilities.includes("minecraft-vanilla"), fileOperationsSupported: capabilities.includes("node-filesystem-v1"), integratedShell: getUserSettings(context.userId).general.integratedShell, ...(context.userRole === "admin" || context.userRole === "super_admin" ? { dataRoot: getDaemonDataRoot(id), javaRuntimes } : { javaRuntimes: javaRuntimes.map(({ runtimeId, major, managed }) => ({ runtimeId, major, managed })) }) }))
  }),
  makeTool({
    id: "minecraft.list-instances", name: "minecraft_list_instances", applicationIds: ["minecraft"],
    description: "读取 Minecraft 实例名称、ID、节点、版本与当前运行状态。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async () => listMinecraftInstances().slice(0, 100).map(({ id, nodeId, nodeName, nodeStatus, name, releaseId, javaMajor, memoryMb, state, sandboxStatus, coreType, coreBuild, executionMode, serverProperties }) => ({ id, nodeId, nodeName, nodeStatus, name, releaseId, javaMajor, memoryMb, state, sandboxStatus, coreType, coreBuild, executionMode, serverPort: serverProperties.serverPort }))
  }),
  makeTool({
    id: "minecraft.get-instance", name: "minecraft_get_instance", applicationIds: ["minecraft"],
    description: "读取指定 Minecraft 实例的运行状态、服务器属性、Java 版本和节点信息。",
    schema: strictObject({ instanceId: { type: "string", format: "uuid" } }, ["instanceId"]),
    parse: (value) => parseWithSchema(Joi.object({ instanceId: idSchema("instanceId") }).unknown(false), value),
    execute: async (parameters, context) => {
      const instance = getMinecraftInstance(String(parameters.instanceId));
      if (!instance) throw new Error("找不到这个 Minecraft 实例。");
      return { id: instance.id, nodeId: instance.nodeId, nodeName: instance.nodeName, nodeStatus: instance.nodeStatus, name: instance.name, releaseId: instance.releaseId, javaMajor: instance.javaMajor, javaRuntimeId: instance.javaRuntimeId, memoryMb: instance.memoryMb, state: instance.state, sandboxStatus: instance.sandboxStatus, coreType: instance.coreType, coreBuild: instance.coreBuild, executionMode: instance.executionMode, serverProperties: instance.serverProperties, updatedAt: instance.updatedAt, ...(context.userRole === "admin" || context.userRole === "super_admin" ? { storageDirectory: instance.storageDirectory, dataRoot: getDaemonDataRoot(instance.nodeId) } : {}) };
    }
  }),
  makeTool({
    id: "minecraft.list-releases", name: "minecraft_list_releases", applicationIds: ["minecraft"],
    description: "读取 Mojang 官方可部署 Vanilla Java 版本清单。部署前先用此工具确认有效版本 ID。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async () => { const catalog = await getMinecraftReleases(); return { latestRelease: catalog.latestRelease, releases: catalog.releases.slice(0, 80) }; }
  }),
  makeTool({
    id: "minecraft.list-deployments", name: "minecraft_list_deployments", applicationIds: ["minecraft"],
    description: "读取最近 Minecraft 部署任务的状态。",
    schema: strictObject({}), parse: (value) => parseWithSchema(Joi.object({}).unknown(false), value),
    execute: async () => listMinecraftDeployments().slice(0, 50)
  }),
  makeTool({
    id: "minecraft.get-logs", name: "minecraft_get_logs", applicationIds: ["minecraft"],
    description: "读取指定 Minecraft 实例最近的日志。",
    schema: strictObject({ instanceId: { type: "string", format: "uuid" } }, ["instanceId"]),
    parse: (value) => parseWithSchema(Joi.object({ instanceId: idSchema("instanceId") }).unknown(false), value),
    execute: async (parameters) => {
      const logs = getMinecraftInstanceLogs(String(parameters.instanceId));
      return logs.slice(-100).map(({ stream, line, createdAt }) => ({ stream, line: line.slice(0, 2000), createdAt }));
    }
  }),
  makeTool({
    id: "minecraft.deploy", name: "minecraft_deploy_server", applicationIds: ["minecraft"],
    description: "已废弃：仅供旧 Vanilla 下载任务兼容；新开服使用 minecraft_provision_server。此工具在指定在线 Windows x64 节点部署官方 Vanilla 服务端。必须先读发行版和节点；此操作会下载并创建服务器目录。后续许可接受按当前权限模式执行。",
    schema: strictObject({ nodeId: { type: "string", format: "uuid" }, name: { type: "string", minLength: 1, maxLength: 48 }, releaseId: { type: "string", maxLength: 40 } }, ["nodeId", "name", "releaseId"]),
    parse: (value) => parseWithSchema(Joi.object({ nodeId: idSchema("nodeId"), name: oneString("name", 48), releaseId: oneString("releaseId", 40) }).unknown(false), value),
    risk: () => "write",
    approval: (parameters) => ({ scopeKey: `node:${parameters.nodeId}:minecraft-deploy:${String(parameters.name).normalize("NFC").toLowerCase()}`, scopeSummary: `节点 ${parameters.nodeId} · Minecraft 目录 ${parameters.name}`, summary: `部署 Minecraft Vanilla ${parameters.releaseId}：${parameters.name}` }),
    execute: async (parameters, context) => {
      const created = await createMinecraftDeployment({ nodeId: String(parameters.nodeId), name: String(parameters.name), releaseId: String(parameters.releaseId), serverType: "vanilla", userId: context.userId });
      context.onProgress("Mojang 官方服务端工件校验通过，部署任务已排入 Daemon 队列。");
      const task = await waitForMinecraftTask(created.task.id, context, "找不到 Minecraft 部署任务。");
      return { deployment: created.deployment, task: safeTaskView(task as unknown as Record<string, unknown>), note: task.status === "queued" || task.status === "running" ? "任务仍在运行，之后可通过 Minecraft 部署列表查看。" : undefined };
    }
  }),
  makeTool({
    id: "minecraft.retry-deployment", name: "minecraft_retry_deployment", applicationIds: ["minecraft"],
    description: "仅重试状态为失败的 Minecraft 部署任务。",
    schema: strictObject({ deploymentId: { type: "string", format: "uuid" } }, ["deploymentId"]),
    parse: (value) => parseWithSchema(Joi.object({ deploymentId: idSchema("deploymentId") }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters) => ({ scopeKey: `minecraft-deployment:${parameters.deploymentId}`, scopeSummary: `Minecraft 部署 ${parameters.deploymentId}`, summary: `重试失败的 Minecraft 部署 ${parameters.deploymentId}` }),
    execute: async (parameters, context) => {
      const task = await retryMinecraftDeployment(String(parameters.deploymentId), context.userId);
      const finalTask = await waitForMinecraftTask(task.id, context, "找不到 Minecraft 重试任务。");
      return safeTaskView(finalTask as unknown as Record<string, unknown>);
    }
  }),
  ...(["start", "stop", "backup", "restart", "delete"] as const).map((operation) => makeTool({
    id: `minecraft.${operation}`, name: `minecraft_${operation}_instance`, applicationIds: ["minecraft"],
    retryAfterRecovery: operation === "start" || operation === "stop",
    adminOnly: operation === "delete",
    description: operation === "start" ? "启动指定 Minecraft 实例。"
      : operation === "stop" ? "安全停止指定 Minecraft 实例。"
      : operation === "restart" ? "安全停止后重新启动同一 Minecraft 实例，并等待服务就绪；强制停服后不自动启动。"
        : operation === "delete" ? "删除已停止/失败且无活动任务的实例；状态未知时先由节点核实进程与目录：节点先将完整目录移入备份归档，确认归档后移除登记。仍有进程或安装标记时拒绝；不会永久清除存档。" : "备份已停止的 Minecraft 世界存档。若实例正在运行，业务服务会拒绝。",
    schema: strictObject({ instanceId: { type: "string", format: "uuid" } }, ["instanceId"]),
    parse: (value) => parseWithSchema(Joi.object({ instanceId: idSchema("instanceId") }).unknown(false), value),
    risk: () => "write",
    approval: (parameters) => {
      const instance = getMinecraftInstance(String(parameters.instanceId));
      return { scopeKey: `minecraft-instance:${parameters.instanceId}`, scopeSummary: instance ? `${instance.nodeName} · ${instance.name}` : `Minecraft 实例 ${parameters.instanceId}`, summary: `${operation === "start" ? "启动" : operation === "stop" ? "停止" : operation === "restart" ? "重启" : operation === "delete" ? "归档并删除" : "备份"} Minecraft 实例 ${instance?.name ?? parameters.instanceId}` };
    },
    execute: async (parameters, context) => {
      const instanceId = String(parameters.instanceId);
      const task = operation === "start" ? startMinecraftInstance(instanceId, context.userId)
        : operation === "stop" ? stopMinecraftInstance(instanceId, context.userId)
          : operation === "restart" ? restartMinecraftInstance(instanceId, context.userId) : operation === "delete" ? deleteMinecraftInstance(instanceId,context.userId) : backupMinecraftWorld(instanceId, context.userId);
      const finalTask = await waitForMinecraftTask(task.id, context, "找不到 Minecraft 实例任务。");
      return safeTaskView(finalTask as unknown as Record<string, unknown>);
    }
  })),
  makeTool({
    id: "minecraft.console", name: "minecraft_console_command", applicationIds: ["minecraft"],
    description: "向已就绪 Minecraft 实例发送单行服务器指令。不是操作系统 Shell；stop/restart 通常优先使用生命周期工具保持状态同步，也可按用户目标发送控制台命令。写入标准输入不等于命令效果已验证，须读取后续日志。",
    schema: strictObject({ instanceId: { type: "string", format: "uuid" }, command: { type: "string", minLength: 1, maxLength: 1024 } }, ["instanceId", "command"]),
    parse: value => parseWithSchema(Joi.object({ instanceId: idSchema("instanceId"), command: Joi.string().min(1).max(1024).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `minecraft-console:${parameters.instanceId}:${createHash("sha256").update(String(parameters.command)).digest("hex")}`, scopeSummary: `实例 ${parameters.instanceId}`, summary: "发送 Minecraft 控制台指令" }),
    execute: async (parameters, context) => {
      const task = sendMinecraftConsoleCommand(String(parameters.instanceId), context.userId, String(parameters.command));
      return safeTaskView(await waitForMinecraftTask(task.id, context, "找不到控制台任务。") as unknown as Record<string, unknown>);
    }
  }),
  makeTool({
    id: "minecraft.update-properties", name: "minecraft_update_server_properties", applicationIds: ["minecraft"],
    description: "更新 Minecraft 支持的 server.properties 字段；只能修改已停止的实例。",
    schema: strictObject({
      instanceId: { type: "string", format: "uuid" },
      properties: strictObject({
        motd: { type: "string", maxLength: 120 }, difficulty: { type: "string", enum: ["peaceful", "easy", "normal", "hard"] },
        gamemode: { type: "string", enum: ["survival", "creative", "adventure", "spectator"] }, maxPlayers: { type: "integer", minimum: 1, maximum: 200 },
        serverPort: { type: "integer", minimum: 1024, maximum: 65535 }, onlineMode: { type: "boolean" }, pvp: { type: "boolean" },
        whiteList: { type: "boolean" }, viewDistance: { type: "integer", minimum: 2, maximum: 32 }, simulationDistance: { type: "integer", minimum: 2, maximum: 32 },
        levelName: { type: "string", maxLength: 64 }, levelSeed: { type: "string", maxLength: 80 }
      })
    }, ["instanceId", "properties"]),
    parse: (value) => parseWithSchema(Joi.object({ instanceId: idSchema("instanceId"), properties: Joi.object().min(1).required().unknown(false) }).unknown(false), value),
    risk: () => "write",
    approval: (parameters) => {
      const instance = getMinecraftInstance(String(parameters.instanceId));
      const fields = Object.keys(objectValue(parameters.properties)).join("、");
      const preview = JSON.stringify(parameters.properties).slice(0, 300);
      return { scopeKey: `minecraft-instance:${parameters.instanceId}:server-properties`, scopeSummary: `${instance?.nodeName ?? "Minecraft 节点"} · ${instance?.name ?? parameters.instanceId} · server.properties`, summary: `修改 Minecraft 配置字段 ${fields}：${preview}` };
    },
    execute: async (parameters, context) => {
      const task = updateMinecraftServerProperties(String(parameters.instanceId), context.userId, parameters.properties);
      const finalTask = await waitForMinecraftTask(task.id, context, "找不到 Minecraft 配置任务。");
      return safeTaskView(finalTask as unknown as Record<string, unknown>);
    }
  })
];


export const name = "lfaaToolMinecraft";
export const inject = ["lfaaTools", "lfaaMinecraft"];
export function apply(ctx: Context): void { for (const tool of minecraftTools) ctx.lfaaTools.registerTool(ctx, { ...tool, applicationIds: [...APPLICATION_IDS], coreManaged: true, onDemand: true }); }
