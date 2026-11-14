/**
 * Terminal Controller Client 合同与经过认证的终端操作端点。
 */
import { request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { AiToolApproval } from "./ai-permission-types.js";
export type { TerminalInfo, TerminalTarget } from "lfaa-api-terminal-controller/src/protocol.js";


export interface TerminalNode { id: string; displayName: string; connected: boolean }

export interface CreateTerminalInput { id: string; nodeId: string; appId: ApplicationId; target?: import("lfaa-api-terminal-controller/src/protocol.js").TerminalTarget; sessionId?: string | null; approvalId?: string; cols: number; rows: number }

export function loadTerminalNodes(): Promise<{ nodes: TerminalNode[] }> { return request("/terminals/nodes"); }

export function createTerminal(input: CreateTerminalInput, signal?: AbortSignal): Promise<{ terminal?: import("lfaa-api-terminal-controller/src/protocol.js").TerminalInfo; approval?: AiToolApproval }> {
  return request("/terminals", { method: "POST", body: JSON.stringify(input), signal });
}

export function sendTerminalInput(id: string, data: string): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}/input`, { method: "POST", body: JSON.stringify({ data }) }); }

export function resizeTerminal(id: string, cols: number, rows: number): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}/resize`, { method: "POST", body: JSON.stringify({ cols, rows }) }); }

export function closeTerminal(id: string): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}`, { method: "DELETE" }); }
