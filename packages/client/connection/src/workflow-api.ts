/**
 * App Workflow 通用 Connection DTO 与认证端点。
 */
import { request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";


export type WorkflowValueType = "text" | "json" | "artifact" | "any";

export interface WorkflowPort { id: string; valueType: WorkflowValueType; required?: boolean }

export interface WorkflowNode { id: string; type: string; version: number; title: string; data: Record<string, unknown>; x: number; y: number }

export interface WorkflowEdge { id: string; from: string; fromPort: string; to: string; toPort: string }

export interface WorkflowDefinition { id: string; appId: ApplicationId; schemaVersion: 1; engineId: string; title: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; createdAt: string; updatedAt: string }

export interface WorkflowNodeType { type: string; version: number; applicationIds: ApplicationId[]; name: string; description: string; defaultData: Record<string, unknown>; inputPorts: WorkflowPort[]; outputPorts: WorkflowPort[]; configurationOptions?: unknown }

export interface WorkflowEngineType { id: string; version: number; name: string }

export type WorkflowStatus = "queued" | "running" | "succeeded" | "failed" | "interrupted";

export type WorkflowNodeStatus = "waiting" | "running" | "succeeded" | "failed" | "interrupted";

export interface WorkflowRunNode { nodeId: string; type: string; title: string; startedAt: string | null; completedAt: string | null; status: WorkflowNodeStatus; output?: string; outputTruncated?: boolean; references?: Array<{ kind: string; id: string }>; progress?: Record<string, unknown>; error?: string }

export interface WorkflowRun { id: string; appId: ApplicationId; workflowId: string; status: WorkflowStatus; nodes: WorkflowRunNode[]; currentNodeId: string | null; createdAt: string; updatedAt: string }

export function loadWorkflows(appId: ApplicationId): Promise<{ workflows: WorkflowDefinition[] }> { return request(workflowPath(appId)); }

export function loadWorkflowNodeTypes(appId: ApplicationId): Promise<{ nodes: WorkflowNodeType[] }> { return request(`${workflowPath(appId)}/nodes`); }

export function loadWorkflowEngineTypes(appId: ApplicationId): Promise<{ engines: WorkflowEngineType[] }> { return request(`${workflowPath(appId)}/engines`); }

export function createWorkflow(appId: ApplicationId, input: Pick<WorkflowDefinition, "title" | "nodes" | "edges"> & Partial<Pick<WorkflowDefinition, "engineId">>): Promise<{ workflow: WorkflowDefinition }> {
  return request(workflowPath(appId), { method: "POST", body: JSON.stringify(input) });
}

export function saveWorkflow(appId: ApplicationId, workflowId: string, input: Pick<WorkflowDefinition, "title" | "nodes" | "edges"> & Partial<Pick<WorkflowDefinition, "engineId">>): Promise<{ workflow: WorkflowDefinition }> {
  return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteWorkflow(appId: ApplicationId, workflowId: string): Promise<void> { return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}`, { method: "DELETE" }); }

export function loadWorkflowRuns(appId: ApplicationId, workflowId: string, signal?: AbortSignal): Promise<{ runs: WorkflowRun[] }> { return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}/runs`, signal ? { signal } : {}); }

export function startWorkflowRun(appId: ApplicationId, workflowId: string, options: Record<string, unknown> = {}): Promise<{ run: WorkflowRun }> {
  return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}/runs`, { method: "POST", body: JSON.stringify({ options }) });
}

export function cancelWorkflowRun(appId: ApplicationId, runId: string): Promise<{ run: WorkflowRun }> {
  return request(`/apps/${encodeURIComponent(appId)}/workflow-runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
}


const workflowPath = (appId: ApplicationId) => `/apps/${encodeURIComponent(appId)}/workflows`;