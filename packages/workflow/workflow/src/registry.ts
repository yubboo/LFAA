/**
 * 功能：管理可插拔的工作流节点与执行引擎。
 * 作用：按 App 和版本解析能力，注册生命周期由 Cordis Owner 自动撤销。
 * 安全边界：注册目录不授予权限；节点回调仍必须调用原领域 Owner。
 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { WorkflowDefinitionShape, WorkflowNodeDefinition, WorkflowNodeTypeContract } from "./graph.js";

export interface WorkflowNodeExecutionContext {
  userId: string;
  userRole: string;
  appId: ApplicationId;
  workflowId: string;
  runId: string;
  node: WorkflowNodeDefinition;
  inputs: Record<string, unknown>;
  options: Record<string, unknown>;
  signal: AbortSignal;
  state: Map<string, unknown>;
  runtimeServices: unknown;
  reportReference(reference: { kind: string; id: string }): void;
  updateNodeStatus(status: WorkflowNodeRunStatus, details?: { output?: string; references?: Array<{ kind: string; id: string }>; progress?: Record<string, unknown>; error?: string }): void;
}
export interface WorkflowNodeExecutionResult { outputs: Record<string, unknown>; references?: Array<{ kind: string; id: string }> }
export interface WorkflowNodeRegistration extends WorkflowNodeTypeContract {
  name: string;
  description: string;
  defaultData: Record<string, unknown>;
  execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> | WorkflowNodeExecutionResult;
  listConfigurationOptions?(userId: string, userRole: string): Promise<unknown> | unknown;
}
export interface WorkflowNodeProvider {
  id: string;
  applicationIds: readonly ApplicationId[];
  nodes: readonly WorkflowNodeRegistration[];
  validateRun?(context: { userId: string; userRole: string; appId: ApplicationId; definition: WorkflowDefinitionShape; options: Record<string, unknown> }): void;
}
export interface WorkflowNodePublicInfo extends Omit<WorkflowNodeRegistration, "execute" | "listConfigurationOptions" | "normalizeData"> {
  configurationOptions?: unknown;
}

export type WorkflowNodeRunStatus = "waiting" | "running" | "succeeded" | "failed" | "interrupted";
export interface WorkflowEngineNodeResult extends WorkflowNodeExecutionResult { nodeId: string }
export interface WorkflowEngineContext {
  definition: WorkflowDefinitionShape;
  signal: AbortSignal;
  executeNode(nodeId: string, inputs: Record<string, unknown>): Promise<WorkflowEngineNodeResult>;
  reportNodeState(nodeId: string, status: WorkflowNodeRunStatus, details?: { output?: string; references?: Array<{ kind: string; id: string }>; progress?: Record<string, unknown>; error?: string }): void;
}
export interface WorkflowEngineRegistration {
  id: string;
  version: number;
  applicationIds: readonly ApplicationId[];
  name: string;
  execute(context: WorkflowEngineContext): Promise<void>;
}

const providers = new Map<string, WorkflowNodeProvider>();
const nodeTypes = new Map<string, { providerId: string; registration: WorkflowNodeRegistration }>();
const engines = new Map<string, WorkflowEngineRegistration>();
const TYPE_ID = /^[a-z0-9][a-z0-9._-]{1,119}$/;

function validateId(value: string, label: string): void {
  if (!TYPE_ID.test(value)) throw new Error(`${label}格式无效：${value}`);
}

export function registerWorkflowNodeProvider(owner: Context, provider: WorkflowNodeProvider): void {
  owner.effect(() => {
    validateId(provider.id, "工作流节点提供方 ID");
    if (!provider.applicationIds.length || provider.nodes.length === 0) throw new Error("工作流节点提供方必须声明 App 范围和节点类型。");
    if (provider.applicationIds.some((appId) => !APPLICATION_IDS.includes(appId))) throw new Error("工作流节点提供方声明了未知 App。");
    if (providers.has(provider.id)) throw new Error(`工作流节点提供方已注册：${provider.id}`);
    const ids = new Set<string>();
    for (const node of provider.nodes) {
      validateId(node.type, "工作流节点类型");
      if (ids.has(node.type) || nodeTypes.has(node.type)) throw new Error(`工作流节点类型重复：${node.type}`);
      if (!Number.isInteger(node.version) || node.version < 1) throw new Error(`工作流节点版本无效：${node.type}`);
      if (JSON.stringify(node.defaultData).length > 4_000) throw new Error(`工作流节点默认配置过大：${node.type}`);
      if (!provider.applicationIds.every((appId) => node.applicationIds.includes(appId))) throw new Error(`节点 ${node.type} 的 App 范围必须覆盖提供方声明的范围。`);
      for (const direction of [node.inputPorts, node.outputPorts]) {
        const portIds = new Set<string>();
        for (const port of direction) {
          validateId(port.id, `节点 ${node.type} 端口 ID`);
          if (portIds.has(port.id)) throw new Error(`节点 ${node.type} 的端口 ID 重复：${port.id}`);
          if (!["text", "json", "artifact", "any"].includes(port.valueType)) throw new Error(`节点 ${node.type} 的端口类型无效：${port.valueType}`);
          portIds.add(port.id);
        }
      }
      ids.add(node.type);
    }
    providers.set(provider.id, provider);
    for (const node of provider.nodes) nodeTypes.set(node.type, { providerId: provider.id, registration: Object.freeze({ ...node }) });
    return () => {
      if (providers.get(provider.id) !== provider) return;
      providers.delete(provider.id);
      for (const node of provider.nodes) if (nodeTypes.get(node.type)?.providerId === provider.id) nodeTypes.delete(node.type);
    };
  }, `workflow-node-provider:${provider.id}`);
}

export function registerWorkflowEngine(owner: Context, engine: WorkflowEngineRegistration): void {
  owner.effect(() => {
    validateId(engine.id, "工作流引擎 ID");
    if (!Number.isInteger(engine.version) || engine.version < 1 || !engine.applicationIds.length) throw new Error("工作流引擎版本或 App 范围无效。");
    if (engine.applicationIds.some((appId) => !APPLICATION_IDS.includes(appId))) throw new Error("工作流引擎声明了未知 App。");
    if (engines.has(engine.id)) throw new Error(`工作流引擎已注册：${engine.id}`);
    engines.set(engine.id, Object.freeze({ ...engine, applicationIds: Object.freeze([...engine.applicationIds]) }));
    return () => { if (engines.get(engine.id)?.execute === engine.execute) engines.delete(engine.id); };
  }, `workflow-engine:${engine.id}`);
}

export function resolveWorkflowNodeType(appId: ApplicationId, type: string, version: number): WorkflowNodeTypeContract | undefined {
  const found = nodeTypes.get(type)?.registration;
  return found && found.version === version && found.applicationIds.includes(appId) ? found : undefined;
}

export function getWorkflowNodeRegistration(appId: ApplicationId, type: string, version: number): WorkflowNodeRegistration | undefined {
  return resolveWorkflowNodeType(appId, type, version) ? nodeTypes.get(type)?.registration : undefined;
}

export function listWorkflowEngines(appId: ApplicationId): Array<Pick<WorkflowEngineRegistration, "id" | "version" | "name">> {
  return [...engines.values()].filter((engine) => engine.applicationIds.includes(appId))
    .map(({ id, version, name }) => ({ id, version, name })).sort((a, b) => a.id.localeCompare(b.id));
}

export function getWorkflowEngine(appId: ApplicationId, engineId: string): WorkflowEngineRegistration | undefined {
  const engine = engines.get(engineId);
  return engine?.applicationIds.includes(appId) ? engine : undefined;
}

export async function listWorkflowNodes(appId: ApplicationId, userId: string, userRole: string): Promise<WorkflowNodePublicInfo[]> {
  const result: WorkflowNodePublicInfo[] = [];
  for (const { registration } of nodeTypes.values()) {
    if (!registration.applicationIds.includes(appId)) continue;
    const { execute: _execute, listConfigurationOptions, normalizeData: _normalizeData, ...publicInfo } = registration;
    result.push({ ...publicInfo, ...(listConfigurationOptions ? { configurationOptions: await listConfigurationOptions(userId, userRole) } : {}) });
  }
  return result.sort((a, b) => a.type.localeCompare(b.type));
}

export function validateWorkflowRun(context: { userId: string; userRole: string; appId: ApplicationId; definition: WorkflowDefinitionShape; options: Record<string, unknown> }): void {
  for (const provider of providers.values()) {
    if (provider.applicationIds.includes(context.appId)) provider.validateRun?.(context);
  }
  for (const node of context.definition.nodes) {
    if (!getWorkflowNodeRegistration(context.appId, node.type, node.version)) throw new Error(`节点“${node.title}”所需的提供方未启用，当前工作流不可运行。`);
  }
}

export async function executeWorkflowNode(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
  const registration = getWorkflowNodeRegistration(context.appId, context.node.type, context.node.version);
  if (!registration) throw new Error(`节点“${context.node.title}”所需的提供方未启用，当前工作流不可运行。`);
  return registration.execute(context);
}

export function clearWorkflowRegistrations(): void {
  providers.clear();
  nodeTypes.clear();
  engines.clear();
}
