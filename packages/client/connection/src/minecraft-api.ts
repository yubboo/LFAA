/**
 * Minecraft API DTOs and authenticated endpoint adapters.
 */
import { request } from "./http-client.js";
import type { FileManagerNode } from "./file-manager-api.js";



export interface MinecraftNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  capabilities: string[];
  javaRuntimes: Array<{ runtimeId: string; distribution?: "temurin" | "zulu"; version?: string; architecture?: string; os?: string; major: number; vendor: string; managed: boolean; source?: "managed" | "system" | "custom"; executablePath?: string }>;
  lastSeenAt: string;
}


export interface MinecraftNodeResourceSample {
  sampledAt: string;
  cpuUsagePercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  memoryUsagePercent: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  diskUsagePercent: number | null;
  networkReceiveBytesPerSecond: number | null;
  networkSendBytesPerSecond: number | null;
}


export interface MinecraftNodeResourceTelemetry {
  status: "unsupported" | "waiting" | "ready" | "stale" | "offline";
  lastUpdatedAt: string | null;
  samples: MinecraftNodeResourceSample[];
}


export interface MinecraftRelease {
  id: string;
  type: "release";
  releaseTime: string;
}


export interface MinecraftCatalog {
  latestRelease: string;
  releases: MinecraftRelease[];
}


export interface MinecraftServerProperties {
  motd?: string;
  difficulty?: "peaceful" | "easy" | "normal" | "hard";
  gamemode?: "survival" | "creative" | "adventure" | "spectator";
  maxPlayers?: number;
  serverPort?: number;
  onlineMode?: boolean;
  pvp?: boolean;
  whiteList?: boolean;
  viewDistance?: number;
  simulationDistance?: number;
  levelName?: string;
  levelSeed?: string;
  fileSnapshot?: MinecraftServerPropertiesFileSnapshot;
}


export interface MinecraftServerPropertiesFileSnapshot {
  source: "node";
  observedAt: string;
  entries: Array<{ key: string; value: string | null; sensitive: boolean }>;
}


export interface MinecraftInstance {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  releaseId: string;
  javaMajor: number;
  javaRuntimeId: string | null;
  memoryMb: number;
  initialHeapMb: number;
  jvmArguments: string[];
  jvmArgumentsConfigured: boolean;
  coreType: string;
  coreBuild: string;
  executionMode: "native" | "appcontainer";
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}


export interface MinecraftServerTelemetry {
  onlinePlayers: number | null;
  maxPlayers: number | null;
  pingMs: number | null;
  advertisedVersion: string | null;
  observedAt: string | null;
  processStartedAt: string | null;
  tps: number | null;
  tpsObservedAt: string | null;
  tpsStatus: "available" | "pending" | "unsupported" | "waiting" | "unavailable";
  availability: "available" | "waiting" | "unavailable";
  reason: "instance_not_running" | "node_offline" | "awaiting_node_sample" | "sample_stale" | "server_not_responding" | null;
}


export interface MinecraftDeployment {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  serverType: string;
  coreBuild: string;
  automatic: boolean;
  releaseId: string;
  javaMajor: number;
  state: "queued" | "downloading" | "ready" | "failed" | "registering" | "registered";
  instanceId: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface MinecraftTask {
  id: string;
  nodeId: string;
  instanceId: string | null;
  deploymentId: string | null;
  createdBy: string;
  kind: "install" | "start" | "stop" | "properties" | "properties-read" | "backup" | "java-install" | "restart" | "console" | "delete";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}


export interface MinecraftTaskDetails {
  task: MinecraftTask;
  logs: MinecraftLog[];
  logsTruncated: boolean;
}


export interface MinecraftStorageNode extends FileManagerNode {
  dataRoot: string | null;
  settingsConfigured: boolean;
  instanceDirectory: string;
}


export interface MinecraftStorageSettings {
  instanceDirectory: string;
}



export interface MinecraftLog {
  id: number;
  stream: string;
  line: string;
  createdAt: string;
}


export function loadMinecraftStorageSettings(): Promise<{ nodes: MinecraftStorageNode[]; defaults: MinecraftStorageSettings; defaultsConfigured: boolean }> {
  return request("/minecraft/storage-settings");
}


export function saveMinecraftStorageDefaults(settings: MinecraftStorageSettings): Promise<{ settings: MinecraftStorageSettings }> {
  return request("/minecraft/storage-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}


export function saveMinecraftNodeStorageSettings(nodeId: string, settings: MinecraftStorageSettings): Promise<{ settings: MinecraftStorageSettings & { nodeId: string } }> {
  return request(`/minecraft/storage-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}


export function loadMinecraftOverview(signal?: AbortSignal): Promise<{ overview: { latestRelease: string | null; node: MinecraftNode | null; instanceCount: number; runningCount: number; activeTaskCount: number } }> {
  return request("/minecraft/overview", signal ? { signal } : {});
}


export function loadMinecraftNodes(signal?: AbortSignal): Promise<{ nodes: MinecraftNode[] }> {
  return request("/minecraft/nodes", signal ? { signal } : {});
}


export function loadMinecraftNodeResources(nodeId: string, signal?: AbortSignal): Promise<{ nodeId: string; nodeName: string; telemetry: MinecraftNodeResourceTelemetry }> {
  return request(`/minecraft/nodes/${encodeURIComponent(nodeId)}/resources`, signal ? { signal } : {});
}


export function loadMinecraftReleases(): Promise<{ catalog: MinecraftCatalog }> {
  return request("/minecraft/releases");
}

export interface MinecraftCore {
  name: string; category: "pure" | "mod" | "vanilla" | "proxy" | "bedrock"; versions: string[];
  homepage: string; source: "fastmirror" | "mohist"; launchKind: string;
}

export function loadMinecraftCoreNames(): Promise<{ cores: string[] }> { return request("/minecraft/core-names"); }

export interface MinecraftCoreBuild { id: string; updatedAt: string; digest: string; }

export function loadMinecraftCores(signal?: AbortSignal): Promise<{ cores: MinecraftCore[]; errors: string[] }> { return request("/minecraft/cores", signal ? { signal } : {}); }

export function loadMinecraftCoreBuilds(core: string, version: string, offset = 0, signal?: AbortSignal): Promise<{ builds: MinecraftCoreBuild[]; count: number }> {
  return request(`/minecraft/cores/${encodeURIComponent(core)}/versions/${encodeURIComponent(version)}/builds?offset=${offset}`, signal ? { signal } : {});
}

export function provisionMinecraftServer(input: { nodeId: string; name: string; core: string; version: string; build: string; eulaAccepted: true; memoryMb: number; serverPort: number; javaRuntimeId?: string | null; proxyBackendInstanceId?: string }): Promise<{ instance: MinecraftInstance; deployment: MinecraftDeployment; task: MinecraftTask }> {
  return request("/minecraft/provision", { method: "POST", body: JSON.stringify(input) });
}


export function loadMinecraftJava(signal?: AbortSignal): Promise<{ nodes: Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: MinecraftNode["javaRuntimes"] }> }> {
  return request("/minecraft/java", signal ? { signal } : {});
}


export function loadMinecraftInstances(signal?: AbortSignal): Promise<{ instances: MinecraftInstance[] }> {
  return request("/minecraft/instances", signal ? { signal } : {});
}


export function loadMinecraftServerTelemetry(instanceId: string, signal?: AbortSignal): Promise<{ telemetry: MinecraftServerTelemetry }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/telemetry`, signal ? { signal } : {});
}


export function loadMinecraftInstanceDirectory(instanceId: string, signal?: AbortSignal): Promise<{ instanceId: string; directory: string }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/directory`, signal ? { signal } : {});
}


export function loadMinecraftDeployments(signal?: AbortSignal): Promise<{ deployments: MinecraftDeployment[] }> {
  return request("/minecraft/deployments", signal ? { signal } : {});
}


export function loadMinecraftInstanceLogs(instanceId: string, signal?: AbortSignal): Promise<{ logs: MinecraftLog[] }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/logs`, signal ? { signal } : {});
}


export function loadMinecraftTasks(signal?: AbortSignal): Promise<{ tasks: MinecraftTask[] }> {
  return request("/minecraft/tasks", signal ? { signal } : {});
}


export function loadMinecraftTaskDetails(taskId: string, signal?: AbortSignal): Promise<MinecraftTaskDetails> {
  return request(`/minecraft/tasks/${encodeURIComponent(taskId)}`, signal ? { signal } : {});
}


export function deleteMinecraftTaskRecords(taskIds: string[]): Promise<{ deletedCount: number }> {
  return request("/minecraft/tasks", { method: "DELETE", body: JSON.stringify({ taskIds }) });
}


export function createMinecraftDeployment(input: { nodeId: string; name: string; serverType: "vanilla"; releaseId: string }): Promise<{ deployment: MinecraftDeployment; task: MinecraftTask }> {
  return request("/minecraft/deployments", { method: "POST", body: JSON.stringify(input) });
}


export function retryMinecraftDeployment(deploymentId: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/deployments/${encodeURIComponent(deploymentId)}/retry`, { method: "POST" });
}


export function registerMinecraftDeployment(deploymentId: string, input: { memoryMb: number; eulaAccepted: true; javaRuntimeId: string | null }): Promise<{ instance: MinecraftInstance; task: MinecraftTask }> {
  return request(`/minecraft/deployments/${encodeURIComponent(deploymentId)}/instance`, { method: "POST", body: JSON.stringify(input) });
}


export function setMinecraftInstanceJavaRuntime(instanceId: string, javaRuntimeId: string | null): Promise<{ instance: MinecraftInstance }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/java-runtime`, { method: "PATCH", body: JSON.stringify({ javaRuntimeId }) });
}


/** 更新已停止实例实际使用的 JVM 参数；服务端再次验证节点状态、实例状态和参数白名单。 */
export function setMinecraftInstanceJvmConfiguration(instanceId: string, configuration: { memoryMb: number; initialHeapMb: number; jvmArguments: string }): Promise<{ instance: MinecraftInstance }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/jvm-configuration`, { method: "PATCH", body: JSON.stringify(configuration) });
}


export function installMinecraftJava(input: { nodeId: string; major: number }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/install", { method: "POST", body: JSON.stringify(input) });
}


export function uninstallMinecraftJava(input: { nodeId: string; major: number }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/uninstall", { method: "POST", body: JSON.stringify(input) });
}


export function saveMinecraftJavaPath(input: { nodeId: string; executablePath: string; runtimeId?: string }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/paths", { method: "POST", body: JSON.stringify(input) });
}


export function forgetMinecraftJavaPath(nodeId: string, runtimeId: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/java/paths/${encodeURIComponent(runtimeId)}`, { method: "DELETE", body: JSON.stringify({ nodeId }) });
}


export function deleteMinecraftInstance(instanceId:string):Promise<{task:MinecraftTask}> {return request(`/minecraft/instances/${encodeURIComponent(instanceId)}`,{method:"DELETE"});}


export function runMinecraftInstanceAction(instanceId: string, action: "start" | "stop" | "backup" | "restart"): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/${action}`, { method: "POST" });
}

export function sendMinecraftConsole(instanceId: string, command: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/console`, { method: "POST", body: JSON.stringify({ command }) });
}


export function saveMinecraftServerProperties(instanceId: string, properties: MinecraftServerProperties): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties`, { method: "PATCH", body: JSON.stringify({ properties }) });
}


export function saveMinecraftServerFileProperties(instanceId: string, fileProperties: Record<string, string | null>): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties`, { method: "PATCH", body: JSON.stringify({ fileProperties }) });
}


export function readMinecraftServerProperties(instanceId: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties/read`, { method: "POST" });
}