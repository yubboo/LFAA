/**
 * Minecraft UI Workflow 兼容 DTO 与通用 Workflow Connection 的适配。
 */
import { isRecord } from "./value-guards.js";
import { cancelWorkflowRun, createWorkflow, deleteWorkflow, loadWorkflowNodeTypes, loadWorkflowRuns, loadWorkflows, saveWorkflow, startWorkflowRun } from "./workflow-api.js";
import type { WorkflowDefinition, WorkflowRun, WorkflowRunNode, WorkflowStatus } from "./workflow-api.js";


export async function cancelMinecraftWorkflowRun(runId: string): Promise<{ run: MinecraftWorkflowRun }> {
  const result = await cancelWorkflowRun("minecraft", runId);
  return { run: asMinecraftRun(result.run) };
}

export async function startMinecraftWorkflowRun(workflowId: string, eulaAccepted: boolean): Promise<{ run: MinecraftWorkflowRun }> {
  const result = await startWorkflowRun("minecraft", workflowId, { eulaAccepted });
  return { run: asMinecraftRun(result.run) };
}

export async function loadMinecraftWorkflowRuns(workflowId: string): Promise<{ runs: MinecraftWorkflowRun[] }> {
  const result = await loadWorkflowRuns("minecraft", workflowId);
  return { runs: result.runs.map(asMinecraftRun) };
}

export function deleteMinecraftWorkflow(workflowId: string): Promise<void> { return deleteWorkflow("minecraft", workflowId); }

export async function saveMinecraftWorkflow(workflowId: string, input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">): Promise<{ workflow: MinecraftWorkflow }> {
  const result = await saveWorkflow("minecraft", workflowId, asGenericWorkflowInput(input));
  return { workflow: asMinecraftWorkflow(result.workflow) };
}

export async function createMinecraftWorkflow(input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">): Promise<{ workflow: MinecraftWorkflow }> {
  const result = await createWorkflow("minecraft", asGenericWorkflowInput(input));
  return { workflow: asMinecraftWorkflow(result.workflow) };
}

export async function loadMinecraftWorkflows(): Promise<{ workflows: MinecraftWorkflow[] }> {
  const result = await loadWorkflows("minecraft");
  return { workflows: result.workflows.map(asMinecraftWorkflow) };
}

export async function loadMinecraftWorkflowTools(): Promise<{ tools: MinecraftWorkflowTool[] }> {
  const { nodes } = await loadWorkflowNodeTypes("minecraft");
  const configuration = nodes.find((node) => node.type === "minecraft.agent")?.configurationOptions;
  return { tools: isRecord(configuration) && Array.isArray(configuration.tools) ? configuration.tools as MinecraftWorkflowTool[] : [] };
}

function asMinecraftRun(run: WorkflowRun): MinecraftWorkflowRun {
  const nodes = run.nodes.map((node) => {
    const aiRunId = node.references?.find((reference) => reference.kind === "ai-run")?.id ?? null;
    const progress = node.progress ?? {};
    return {
      ...node, aiRunId,
      agentStatus: typeof progress.agentStatus === "string" ? progress.agentStatus : null,
      pendingQuestion: progress.pendingQuestion && typeof progress.pendingQuestion === "object" ? progress.pendingQuestion as MinecraftWorkflowRun["nodes"][number]["pendingQuestion"] : null,
      pendingApproval: progress.pendingApproval && typeof progress.pendingApproval === "object" ? progress.pendingApproval as MinecraftWorkflowRun["nodes"][number]["pendingApproval"] : null
    };
  });
  return { ...run, nodes, currentAgentRunId: nodes.find((node) => node.aiRunId)?.aiRunId ?? null, sessionId: null, eulaAccepted: false };
}

function asGenericWorkflowInput(input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">) {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  return {
    title: input.title,
    nodes: input.nodes.map((node) => ({
      id: node.id, type: node.type ?? (node.kind === "text-input" ? "core.text-input" : node.kind === "result" ? "core.result" : "minecraft.agent"),
      version: node.version ?? 1, title: node.title,
      data: node.kind === "text-input" ? { text: node.value ?? "" }
        : node.kind === "result" ? {}
          : node.kind === "agent" || !node.type ? { prompt: node.prompt, toolNames: node.toolNames }
            : node.data ?? {},
      x: node.x, y: node.y
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      fromPort: edge.fromPort ?? (nodeById.get(edge.from)?.type === "core.text-input" ? "text" : "result"),
      to: edge.to,
      toPort: edge.toPort ?? (nodeById.get(edge.to)?.type === "core.result" ? "value" : "context")
    }))
  };
}

function asMinecraftWorkflow(workflow: WorkflowDefinition): MinecraftWorkflow {
  return {
    ...workflow,
    appId: "minecraft",
    nodes: workflow.nodes.map((node) => ({
      id: node.id, type: node.type, version: node.version,
      kind: node.type === "core.text-input" ? "text-input" : node.type === "core.result" ? "result" : node.type === "minecraft.agent" ? "agent" : undefined,
      title: node.title,
      prompt: typeof node.data.prompt === "string" ? node.data.prompt : "",
      value: typeof node.data.text === "string" ? node.data.text : "",
      toolNames: Array.isArray(node.data.toolNames) ? node.data.toolNames.filter((name): name is string => typeof name === "string") : [],
      data: node.data, x: node.x, y: node.y
    }))
  };
}

export interface MinecraftWorkflowRun extends Omit<WorkflowRun, "nodes"> {
  nodes: Array<WorkflowRunNode & { aiRunId: string | null; agentStatus?: string | null; pendingQuestion?: { questionId: string; question: string; options: string[] } | null; pendingApproval?: { approvalId: string; title: string; detail: string } | null }>;
  currentAgentRunId: string | null; sessionId: string | null; eulaAccepted: boolean;
}

export type MinecraftWorkflowStatus = WorkflowStatus;

export interface MinecraftWorkflowTool { id: string; name: string; description: string }

export interface MinecraftWorkflow { id: string; appId: "minecraft"; schemaVersion: 1; engineId: string; title: string; nodes: MinecraftWorkflowNode[]; edges: MinecraftWorkflowEdge[]; createdAt: string; updatedAt: string }

export interface MinecraftWorkflowEdge { id: string; from: string; fromPort?: string; to: string; toPort?: string }


// Minecraft 页面适配器：旧 UI DTO 转成共享版本化图合同，数据库与 API 只保存通用定义。
export interface MinecraftWorkflowNode { id: string; type?: string; version?: number; kind?: "agent" | "text-input" | "result"; title: string; prompt: string; value?: string; toolNames: string[]; data?: Record<string, unknown>; x: number; y: number }
