/**
 * SteamCMD API DTOs and authenticated endpoint adapters.
 */
import { request } from "./http-client.js";
import type { FileManagerNode } from "./file-manager-api.js";



export interface SteamcmdSettingsNode extends FileManagerNode {
  dataRoot: string | null;
  configurationConfigured: boolean;
  storageConfigured: boolean;
  steamcmdInstalled: boolean;
  configuration: {
    nodeId: string;
    installMode: "online" | "manual";
    steamcmdDirectory: string;
  };
  storage: {
    nodeId: string;
    gameDirectory: string;
  };
}


export interface SteamcmdTask {
  id: string;
  nodeId: string;
  createdBy: string;
  kind: "install" | "verify" | "uninstall" | "install-server" | "update-server" | "start-server" | "stop-server";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}


export interface SteamcmdServer {
  id: string;
  nodeId: string;
  createdBy: string;
  name: string;
  toolAppId: number;
  installDirectory: string;
  executablePath: string;
  launchArguments: string[];
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: boolean;
  installationStatus: "unknown" | "installing" | "installed" | "failed";
  status: "unknown" | "stopped" | "running" | "starting" | "stopping";
  processId: number | null;
  lastSeenAt: string | null;
  dstClusterId: string | null;
  dstClusterName: string | null;
  dstShard: "Master" | "Caves" | null;
  createdAt: string;
  updatedAt: string;
}


export interface SteamcmdServerInput {
  nodeId: string;
  name: string;
  toolAppId: number;
  installDirectory: string;
  executablePath: string;
  launchArguments: string[];
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: boolean;
}


export interface SteamcmdDstClusterInput {
  nodeId: string;
  clusterName: string;
  toolAppId: number;
  installDirectory: string;
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: true;
}


export interface SteamcmdConfigurationValues {
  installMode: "online" | "manual";
  steamcmdDirectory: string;
}


export interface SteamcmdStorageValues {
  gameDirectory: string;
}


export function loadSteamcmdSettings(): Promise<{
  nodes: SteamcmdSettingsNode[];
  configurationDefaults: SteamcmdConfigurationValues;
  configurationDefaultsConfigured: boolean;
  storageDefaults: SteamcmdStorageValues;
  storageDefaultsConfigured: boolean;
}> {
  return request("/steamcmd/settings");
}


export function saveSteamcmdNodeConfiguration(nodeId: string, settings: SteamcmdConfigurationValues): Promise<{ settings: SteamcmdConfigurationValues & { nodeId: string } }> {
  return request(`/steamcmd/configuration-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}


export function saveSteamcmdConfigurationDefaults(settings: SteamcmdConfigurationValues): Promise<{ settings: SteamcmdConfigurationValues }> {
  return request("/steamcmd/configuration-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}


export function saveSteamcmdNodeStorageSettings(nodeId: string, settings: SteamcmdStorageValues): Promise<{ settings: SteamcmdStorageValues & { nodeId: string } }> {
  return request(`/steamcmd/storage-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}


export function saveSteamcmdStorageDefaults(settings: SteamcmdStorageValues): Promise<{ settings: SteamcmdStorageValues }> {
  return request("/steamcmd/storage-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}


export function loadSteamcmdServers(nodeId?: string): Promise<{ servers: SteamcmdServer[] }> {
  const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : "";
  return request(`/steamcmd/servers${query}`);
}


export function createSteamcmdServer(input: SteamcmdServerInput): Promise<{ server: SteamcmdServer }> {
  return request("/steamcmd/servers", { method: "POST", body: JSON.stringify(input) });
}


export function createSteamcmdDstCluster(input: SteamcmdDstClusterInput): Promise<{ clusterId: string; servers: SteamcmdServer[] }> {
  return request("/steamcmd/dst-clusters", { method: "POST", body: JSON.stringify(input) });
}


export function updateSteamcmdServer(serverId: string, input: SteamcmdServerInput): Promise<{ server: SteamcmdServer }> {
  return request(`/steamcmd/servers/${encodeURIComponent(serverId)}`, { method: "PUT", body: JSON.stringify(input) });
}


export function createSteamcmdServerTask(serverId: string, kind: "install-server" | "update-server" | "start-server" | "stop-server"): Promise<{ task: SteamcmdTask }> {
  return request(`/steamcmd/servers/${encodeURIComponent(serverId)}/tasks`, { method: "POST", body: JSON.stringify({ kind }) });
}


export function createSteamcmdTask(input: { nodeId: string; kind: "install" | "verify" | "uninstall" }): Promise<{ task: SteamcmdTask }> {
  return request("/steamcmd/tasks", { method: "POST", body: JSON.stringify(input) });
}


export function loadSteamcmdTask(taskId: string, signal?: AbortSignal): Promise<{ task: SteamcmdTask }> {
  return request(`/steamcmd/tasks/${encodeURIComponent(taskId)}`, signal ? { signal } : {});
}