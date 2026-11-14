/**
 * Connectivity API DTOs and authenticated endpoint adapters.
 */
import { request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";



export interface ConnectivityTarget {
  id: string;
  applicationId: ApplicationId;
  name: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  transport: "tcp" | "udp";
  localHost: "127.0.0.1";
  localPort: number;
  state: "running";
}


export interface ConnectivityRoute {
  id: string;
  sourceAppId: ApplicationId | "custom";
  targetId: string | null;
  name: string;
  mode: "provider" | "self-managed" | "room-domain";
  transport: "tcp" | "udp";
  target: { nodeId: string; localHost: "127.0.0.1"; localPort: number };
  roomName: string | null;
  publicPort: number | null;
  playerAddress: string | null;
  state: "manual" | "waiting-for-node" | "connected" | "offline" | "failed";
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
}


export interface ConnectivityProvider {
  id: string;
  name: string;
  officialUrl: string;
  status: "ready";
  transports: Array<"tcp" | "udp">;
  configured: boolean;
}


export interface ConnectivityOverview {
  deployment: { roomDomain: { configured: boolean; publicDomain: string | null; relayUrl: string | null; reason: string | null; tcpPortStart: number | null; tcpPortEnd: number | null; udpPortStart: number | null; udpPortEnd: number | null; minecraftPort: number | null } };
  easyTier: { version: string; license: "LGPL-3.0"; installCapability: string; runtimeCapability: string };
  providers: ConnectivityProvider[];
  routes: ConnectivityRoute[];
  targets: ConnectivityTarget[];
  nodes: Array<{ id: string; displayName: string; platform: string; architecture: string; capabilities: string[] }>;
}


export interface ConnectivityEasyTierTask {
  id: string;
  nodeId: string;
    status: "queued" | "running" | "succeeded" | "failed" | "unknown";
  message: string;
  createdAt: string;
  finishedAt: string | null;
}


export function loadConnectivityOverview(signal?: AbortSignal): Promise<ConnectivityOverview> {
  return request("/connectivity/overview", signal ? { signal } : {});
}


export function loadConnectivityEasyTierTasks(): Promise<{ tasks: ConnectivityEasyTierTask[] }> {
  return request("/connectivity/easytier/tasks");
}


export function installConnectivityEasyTier(nodeId: string): Promise<{ task: ConnectivityEasyTierTask }> {
  return request("/connectivity/easytier/install", { method: "POST", body: JSON.stringify({ nodeId }) });
}


export function loadConnectivityEasyTierTask(taskId: string): Promise<{ task: ConnectivityEasyTierTask }> {
  return request(`/connectivity/easytier/tasks/${encodeURIComponent(taskId)}`);
}


export function createConnectivityRoute(input: { sourceAppId: ApplicationId | "custom"; targetId?: string | null; name: string; mode: ConnectivityRoute["mode"]; transport: ConnectivityRoute["transport"]; nodeId?: string; localPort?: number; playerAddress?: string }): Promise<{ route: ConnectivityRoute }> {
  return request("/connectivity/routes", { method: "POST", body: JSON.stringify(input) });
}


export function deleteConnectivityRoute(routeId: string): Promise<void> {
  return request(`/connectivity/routes/${encodeURIComponent(routeId)}`, { method: "DELETE" });
}


export function saveConnectivityProviderCredential(providerId: string, token: string): Promise<void> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/credential`, { method: "POST", body: JSON.stringify({ token }) });
}


export function deleteConnectivityProviderCredential(providerId: string): Promise<void> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/credential`, { method: "DELETE" });
}


export function loadConnectivityProviderCatalog(providerId: string): Promise<{ result: unknown }> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/catalog`, { method: "POST", body: JSON.stringify({ kind: "nodes" }) });
}