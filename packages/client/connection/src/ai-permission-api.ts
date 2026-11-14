/**
 * AI Permission Owner 的审批与授权读取/决定请求适配。
 */
import { request } from "./http-client.js";
import type { AiToolApproval, AiToolPermissionGrant } from "./ai-permission-types.js";



export function loadAiApprovals(): Promise<{ approvals: AiToolApproval[] }> {
  return request<{ approvals: AiToolApproval[] }>("/ai/approvals");
}


export function loadAiPermissionGrants(): Promise<{ grants: AiToolPermissionGrant[] }> {
  return request<{ grants: AiToolPermissionGrant[] }>("/ai/permissions/grants");
}


export function revokeAiPermissionGrant(grantId: string): Promise<void> {
  return request<void>(`/ai/permissions/grants/${encodeURIComponent(grantId)}`, { method: "DELETE" });
}


export function decideAiApproval(approvalId: string, decision: "approved" | "denied", remember = false): Promise<{ approval: AiToolApproval }> {
  return request<{ approval: AiToolApproval }>(`/ai/approvals/${encodeURIComponent(approvalId)}`, { method: "PATCH", body: JSON.stringify({ decision, remember }) });
}
