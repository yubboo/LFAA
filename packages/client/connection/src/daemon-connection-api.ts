/**
 * Daemon 连接凭据状态与已认证管理端点适配。
 */
import { request } from "./http-client.js";



export interface DaemonCredentialSummary { nodeId: string; displayName: string; revoked: boolean }

export function loadDaemonCredentials(): Promise<{ nodes: DaemonCredentialSummary[] }> {
  return request("/daemon-nodes/credentials");
}

export function issueDaemonConnection(displayName: string, controlPlaneUrl: string, nodeId?: string): Promise<{ nodeId: string; displayName: string }> {
  return request("/daemon-nodes/credentials", { method: "POST", body: JSON.stringify({ displayName, controlPlaneUrl, nodeId }) });
}

export function revokeDaemonConnection(nodeId: string): Promise<void> {
  return request(`/daemon-nodes/credentials/${encodeURIComponent(nodeId)}`, { method: "DELETE" });
}