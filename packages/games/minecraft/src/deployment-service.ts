/**
 * 功能：一次提交传统面板的多核心自动开服请求。
 * 作用：确认真实工件、节点、EULA 和配置，原子登记部署/实例/任务；自动化由节点执行，网页关闭不取消。
 * 关联文件：core-sources.ts、service.ts、jobs/minecraft-queue.ts、api/minecraft-controller 与节点 minecraft-provisioner.mjs。
 */
import { randomUUID } from "node:crypto";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { getDaemonNode } from "lfaa-host-daemon/src/local-daemon.js";
import { createMinecraftTask, listMinecraftTasks } from "lfaa-jobs/src/minecraft-queue.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { getMinecraftInstance, getMinecraftNodeStorageSettings, listMinecraftDeployments, validateMinecraftServerProperties } from "./service.js";
import { resolveMinecraftCoreArtifact } from "./core-sources.js";

export interface MinecraftProvisionInput {
  nodeId: string; name: string; core: string; version: string; build: string; userId: string;
  eulaAccepted: boolean; memoryMb?: number; serverPort?: number; javaRuntimeId?: string | null;
  proxyBackendInstanceId?: string;
}
export async function provisionMinecraftServer(input: MinecraftProvisionInput) {
  if (input.eulaAccepted !== true) throw new ApiError(400, "minecraft_eula_required", "请先阅读并明确同意 Minecraft EULA 和所选核心的许可。");
  const name = input.name.trim().normalize("NFC");
  if (!name || name.length > 48 || /[<>:"/\\|?*\u0000-\u001f]/u.test(name) || /[ .]$/u.test(name) || name === "." || name === ".." || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(name)) throw new ApiError(400, "minecraft_instance_name_invalid", "实例名称不能包含路径或 Windows 保留名称。");
  const userSettings = getUserSettings(input.userId), settings = userSettings.minecraftRuntime;
  if (settings.minecraftExecutionMode !== "native") throw new ApiError(409, "minecraft_automatic_boundary_unsupported", "多核心自动安装使用本机原生执行。请在设置中心选择推荐的本机原生进程；AppContainer 继续支持旧 Vanilla 实例，不会静默降级。");
  const memoryMb = input.memoryMb ?? settings.minecraftDefaultMemoryMb;
  if (!Number.isInteger(memoryMb) || memoryMb < 1024 || memoryMb > 32768) throw new ApiError(400, "minecraft_memory_invalid", "实例内存须为 1024–32768 MB。");
  const artifact = await resolveMinecraftCoreArtifact(input.core, input.version, input.build);
  const serverPort = input.serverPort ?? (artifact.category === "bedrock" ? settings.minecraftBedrockDefaultPort : settings.minecraftDefaultPort);
  validateMinecraftServerProperties({ serverPort });
  // 解析网络目录后再核实节点，避免慢请求期间节点离线却仍派发。
  const node = getDaemonNode(input.nodeId);
  if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64") throw new ApiError(409, "minecraft_node_offline", "请选择在线 Windows x64 Daemon。");
  if (!node.capabilities.includes("minecraft-multicore-v1")) throw new ApiError(409, "minecraft_multicore_unavailable", "目标 Daemon 尚未报告多核心部署能力，请更新并重启目标节点。");
  const javaRuntimeId = input.javaRuntimeId ?? null;
  if (javaRuntimeId) {
    const runtime = node.javaRuntimes.find(r => r.runtimeId === javaRuntimeId);
    if (!runtime || runtime.major !== artifact.javaMajor) throw new ApiError(400, "minecraft_java_mismatch", `请选择目标节点上 Java ${artifact.javaMajor} 的有效运行环境，或使用自动准备。`);
  }
  const storageDirectory = getMinecraftNodeStorageSettings(node.id).instanceDirectory;
  let proxyBackend: { name: string; address: string } | undefined;
  if (artifact.category === "proxy") {
    const backend = input.proxyBackendInstanceId ? getMinecraftInstance(input.proxyBackendInstanceId) : null;
    if (!backend || backend.nodeId !== node.id || backend.nodeStatus !== "online" || backend.state !== "running" || ["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(backend.coreType) || !backend.serverProperties.serverPort || backend.serverProperties.onlineMode !== false) throw new ApiError(409, "minecraft_proxy_backend_required", "代理需要同一节点上已运行且关闭正版验证的 Java 后端实例；请先配置并启动后端。LFAA 不会自动降低后端认证设置。");
    proxyBackend = { name: "backend", address: `127.0.0.1:${backend.serverProperties.serverPort}` };
  }
  const deploymentId = randomUUID(), instanceId = randomUUID(), now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE;");
  try {
    const names = database.prepare("SELECT name FROM minecraft_instances WHERE node_id = ? UNION ALL SELECT name FROM minecraft_deployments WHERE node_id = ?").all(node.id, node.id) as Array<{ name: string }>;
    if (names.some(row => row.name.normalize("NFC").toLowerCase() === name.toLowerCase())) throw new ApiError(409, "minecraft_name_exists", "节点上已存在这个实例或部署目录，请换一个名称。");
    const occupied = database.prepare("SELECT name FROM minecraft_instances WHERE node_id = ? AND json_extract(server_properties_json, '$.serverPort') = ? AND state NOT IN ('error')").get(node.id, serverPort);
    if (occupied) throw new ApiError(409, "minecraft_port_reserved", "这个节点已有实例使用该端口，请选择其他端口。");
    database.prepare(`INSERT INTO minecraft_instances (id,node_id,created_by,name,storage_directory,release_id,java_major,memory_mb,state,eula_accepted_at,java_runtime_id,core_type,core_build,execution_mode,sandbox_status,server_properties_json)
      VALUES (?,?,?,?,?,?,?,?,'installing',?,?,?,?,'native','unsupported',?)`).run(instanceId,node.id,input.userId,name,storageDirectory,input.version,artifact.javaMajor,memoryMb,now,javaRuntimeId,artifact.core,artifact.build,JSON.stringify({ serverPort }));
    database.prepare(`INSERT INTO minecraft_deployments (id,node_id,created_by,name,storage_directory,server_type,release_id,java_major,state,instance_id,core_build,artifact_json,automatic)
      VALUES (?,?,?,?,?,?,?,?,'queued',?,?,?,1)`).run(deploymentId,node.id,input.userId,name,storageDirectory,artifact.core,input.version,artifact.javaMajor,instanceId,artifact.build,JSON.stringify(artifact));
    const task = createMinecraftTask({ nodeId: node.id, instanceId, deploymentId, createdBy: input.userId, kind: "install", message: "等待节点自动准备环境、安装并启动服务端。", payload: {
      operation: "provision", instanceName: name, storageDirectory, artifact, releaseId: input.version, javaMajor: artifact.javaMajor, javaRuntimeId, memoryMb, properties: { serverPort }, eulaAccepted: true, executionMode: "native",
      language: userSettings.general.language,
      readyTimeoutSeconds: settings.minecraftReadyTimeoutSeconds, stopTimeoutSeconds: settings.minecraftStopTimeoutSeconds,
      downloadTimeoutSeconds: settings.minecraftDownloadTimeoutSeconds, installTimeoutSeconds: settings.minecraftInstallTimeoutSeconds, proxyBackend
    } });
    database.exec("COMMIT;");
    return { instance: getMinecraftInstance(instanceId)!, deployment: listMinecraftDeployments().find(d => d.id === deploymentId)!, task };
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
}

/** 已确认失败才允许用户显式恢复；沿用同一工件，节点必须核对目录归属和已有文件。 */
export async function retryMinecraftProvision(deploymentId: string, userId: string) {
  const deployment = listMinecraftDeployments().find(item => item.id === deploymentId);
  if (!deployment?.automatic || deployment.state !== "failed") throw new ApiError(409, "minecraft_retry_unavailable", "只有失败的自动开服记录可以恢复。");
  const previous = listMinecraftTasks().find(task => task.deploymentId === deploymentId);
  if (!previous || previous.status !== "failed" || previous.result?.outcome === "unknown") throw new ApiError(409, "minecraft_retry_unknown", "上次执行结果未确认，须先核查真实节点和实例，不能重放任务。");
  const artifact = await resolveMinecraftCoreArtifact(deployment.serverType, deployment.releaseId, deployment.coreBuild);
  const original = previous.payload.artifact as { digest?: string } | undefined;
  if (original?.digest !== artifact.digest) throw new ApiError(409, "minecraft_retry_artifact_changed", "来源构建内容已改变，请核查后新建部署，不覆盖已有工件。");
  const node = getDaemonNode(deployment.nodeId);
  if (!node || node.status !== "online" || !node.capabilities.includes("minecraft-multicore-v1")) throw new ApiError(409, "minecraft_node_offline", "请先连接支持多核心的执行节点。");
  const settings = getUserSettings(userId).minecraftRuntime;
  if (settings.minecraftExecutionMode !== "native") throw new ApiError(409, "minecraft_retry_boundary_changed", "此部署采用原生执行，请先在设置中心选择原生方式。");
  if (artifact.category === "proxy") {
    const address = (previous.payload.proxyBackend as { address?: string } | undefined)?.address;
    const backend = address && database.prepare("SELECT state, server_properties_json FROM minecraft_instances WHERE node_id=? AND json_extract(server_properties_json,'$.serverPort')=? AND core_type NOT IN ('BungeeCord','Velocity','Nukkit','PocketMine')").get(node.id, Number(address.split(":")[1])) as { state: string; server_properties_json: string } | undefined;
    if (!backend || backend.state !== "running" || JSON.parse(backend.server_properties_json).onlineMode !== false) throw new ApiError(409, "minecraft_proxy_backend_required", "恢复代理前请先核查并启动原来的后端实例。");
  }
  database.exec("BEGIN IMMEDIATE;");
  try {
    const latest = database.prepare("SELECT id,status,result_json FROM minecraft_tasks WHERE deployment_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1").get(deploymentId) as { id: string; status: string; result_json: string } | undefined;
    const instance = getMinecraftInstance(deployment.instanceId!);
    if (latest?.id !== previous.id || latest.status !== "failed" || JSON.parse(latest.result_json || "{}").outcome === "unknown" || !instance || !["error", "stopped"].includes(instance.state)) throw new ApiError(409, "minecraft_retry_state_changed", "实例或最近任务状态已变化，请刷新并核查真实节点。");
    if (database.prepare("SELECT 1 FROM minecraft_tasks WHERE instance_id = ? AND status IN ('queued','running')").get(deployment.instanceId)) throw new ApiError(409, "minecraft_instance_busy", "实例已有未完成任务。");
    if (database.prepare("UPDATE minecraft_deployments SET state='queued' WHERE id=? AND state='failed'").run(deploymentId).changes !== 1) throw new ApiError(409, "minecraft_retry_state_changed", "部署状态已变化，请刷新。");
    database.prepare("UPDATE minecraft_instances SET state='installing' WHERE id=?").run(deployment.instanceId);
    const task = createMinecraftTask({ nodeId: node.id, instanceId: deployment.instanceId, deploymentId, createdBy: userId, kind: "install", message: "等待节点核对已有文件并恢复自动开服。", payload: { ...previous.payload, artifact, resume: true, readyTimeoutSeconds: settings.minecraftReadyTimeoutSeconds, stopTimeoutSeconds: settings.minecraftStopTimeoutSeconds, downloadTimeoutSeconds: settings.minecraftDownloadTimeoutSeconds, installTimeoutSeconds: settings.minecraftInstallTimeoutSeconds } });
    database.exec("COMMIT;"); return task;
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
}
