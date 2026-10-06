/**
 * 功能：规范化 App 无关的工作流图文档。
 * 作用：校验有界图结构、节点版本、端口连接与无环约束；节点业务由注册适配器负责。
 * 数据归属：纯图合同，不读取数据库、App Owner 或运行时服务。
 */
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export const DEFAULT_WORKFLOW_ENGINE_ID = "lfaa.workflow.dag-sequential";
export type WorkflowValueType = "text" | "json" | "artifact" | "any";

export interface WorkflowPortDefinition { id: string; valueType: WorkflowValueType; required?: boolean }
export interface WorkflowNodeDefinition {
  id: string;
  type: string;
  version: number;
  title: string;
  data: Record<string, unknown>;
  x: number;
  y: number;
}
export interface WorkflowEdgeDefinition { id: string; from: string; fromPort: string; to: string; toPort: string }
export interface WorkflowDefinitionShape {
  schemaVersion: 1;
  appId: ApplicationId;
  engineId: string;
  title: string;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
}
export interface WorkflowNodeTypeContract {
  type: string;
  version: number;
  applicationIds: readonly ApplicationId[];
  inputPorts: readonly WorkflowPortDefinition[];
  outputPorts: readonly WorkflowPortDefinition[];
  normalizeData?(value: Record<string, unknown>): Record<string, unknown>;
}

const MAX_NODES = 64;
const MAX_EDGES = 128;
const MAX_COORDINATE = 50_000;
const MAX_DOCUMENT_CHARS = 60 * 1024;

function fail(message: string): never { throw new Error(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") return fail(`${name} 必须是文本。`);
  const result = value.trim();
  if (!result || result.length > max) return fail(`${name}不能为空，且不能超过 ${max} 个字符。`);
  return result;
}
function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(value)) return fail(`${name}无效。`);
  return value;
}
function jsonRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return fail("工作流节点 data 必须是对象。");
  const encoded = JSON.stringify(value);
  if (encoded.length > MAX_DOCUMENT_CHARS) return fail("工作流节点配置过大。");
  return JSON.parse(encoded) as Record<string, unknown>;
}

function normalizeLegacyNode(raw: Record<string, unknown>): Pick<WorkflowNodeDefinition, "type" | "version" | "data"> {
  if (typeof raw.type === "string") {
    return { type: raw.type, version: Number.isInteger(raw.version) ? Number(raw.version) : 1, data: jsonRecord(raw.data ?? {}) };
  }
  const kind = raw.kind === undefined ? "agent" : raw.kind;
  if (kind === "text-input") return { type: "core.text-input", version: 1, data: { text: typeof raw.value === "string" ? raw.value : "" } };
  if (kind === "result") return { type: "core.result", version: 1, data: {} };
  if (kind === "agent") return {
    type: "minecraft.agent",
    version: 1,
    data: {
      prompt: typeof raw.prompt === "string" ? raw.prompt : "",
      toolNames: Array.isArray(raw.toolNames) ? raw.toolNames : []
    }
  };
  return fail("旧工作流包含无法识别的节点格式。");
}

function portsFor(type: WorkflowNodeTypeContract | undefined, direction: "input" | "output"): readonly WorkflowPortDefinition[] | null {
  return type ? direction === "input" ? type.inputPorts : type.outputPorts : null;
}

export function normalizeWorkflowDefinition(
  input: unknown,
  appId: ApplicationId,
  resolveType: (appId: ApplicationId, type: string, version: number) => WorkflowNodeTypeContract | undefined
): WorkflowDefinitionShape {
  if (!isRecord(input)) return fail("工作流定义格式无效。");
  const title = text(input.title, "工作流名称", 80);
  const engineId = identifier(input.engineId ?? DEFAULT_WORKFLOW_ENGINE_ID, "工作流引擎 ID");
  if (!Array.isArray(input.nodes) || input.nodes.length > MAX_NODES) return fail(`节点数量不能超过 ${MAX_NODES} 个。`);
  if (!Array.isArray(input.edges) || input.edges.length > MAX_EDGES) return fail(`连线数量不能超过 ${MAX_EDGES} 条。`);

  const nodeIds = new Set<string>();
  const nodes = input.nodes.map((value, index): WorkflowNodeDefinition => {
    if (!isRecord(value)) return fail(`第 ${index + 1} 个节点格式无效。`);
    const id = identifier(value.id, "节点 ID");
    if (nodeIds.has(id)) return fail("节点 ID 重复。");
    nodeIds.add(id);
    const legacy = normalizeLegacyNode(value);
    const type = identifier(legacy.type, "节点类型");
    if (!Number.isInteger(legacy.version) || legacy.version < 1 || legacy.version > 10_000) return fail("节点版本无效。");
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) return fail("节点坐标超出画布范围。");
    const contract = resolveType(appId, type, legacy.version);
    if (contract && !contract.applicationIds.includes(appId)) return fail(`节点“${type}”不支持当前 App。`);
    if (contract && contract.version !== legacy.version) return fail(`节点“${type}”版本不兼容，请保留原数据或安装匹配的节点包。`);
    const data = contract?.normalizeData ? contract.normalizeData(legacy.data) : legacy.data;
    return {
      id, type, version: legacy.version, title: text(value.title, "节点名称", 80), data,
      x: Math.round(x), y: Math.round(y)
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeIds = new Set<string>();
  const connections = new Set<string>();
  const occupiedInputs = new Set<string>();
  const edges = input.edges.map((value, index): WorkflowEdgeDefinition => {
    if (!isRecord(value)) return fail(`第 ${index + 1} 条连线格式无效。`);
    const id = identifier(value.id, "连线 ID");
    const from = identifier(value.from, "连线起点");
    const to = identifier(value.to, "连线终点");
    if (edgeIds.has(id)) return fail("连线 ID 重复。");
    if (from === to || !nodeById.has(from) || !nodeById.has(to)) return fail("连线必须连接两个不同的现有节点。");
    const source = nodeById.get(from)!;
    const target = nodeById.get(to)!;
    const sourceType = resolveType(appId, source.type, source.version);
    const targetType = resolveType(appId, target.type, target.version);
    const defaultFrom = source.type === "core.text-input" ? "text" : "result";
    const defaultTo = target.type === "core.result" ? "value" : "context";
    const fromPort = identifier(value.fromPort ?? value.sourceHandle ?? defaultFrom, "输出端口");
    const toPort = identifier(value.toPort ?? value.targetHandle ?? defaultTo, "输入端口");
    const sourcePorts = portsFor(sourceType, "output");
    const targetPorts = portsFor(targetType, "input");
    const sourcePort = sourcePorts?.find((port) => port.id === fromPort);
    const targetPort = targetPorts?.find((port) => port.id === toPort);
    if (sourcePorts && !sourcePort) return fail(`节点“${source.title}”没有输出端口“${fromPort}”。`);
    if (targetPorts && !targetPort) return fail(`节点“${target.title}”没有输入端口“${toPort}”。`);
    if (sourcePort && targetPort && sourcePort.valueType !== "any" && targetPort.valueType !== "any" && sourcePort.valueType !== targetPort.valueType) {
      return fail(`端口类型不匹配：${sourcePort.valueType} 不能连接到 ${targetPort.valueType}。`);
    }
    const inputKey = `${to}\0${toPort}`;
    if (occupiedInputs.has(inputKey)) return fail(`输入端口“${target.title}.${toPort}”当前只接受一条连线。`);
    const key = `${from}\0${fromPort}\0${to}\0${toPort}`;
    if (connections.has(key)) return fail("相同端口之间不能重复连线。");
    edgeIds.add(id);
    connections.add(key);
    occupiedInputs.add(inputKey);
    return { id, from, fromPort, to, toPort };
  });

  const definition: WorkflowDefinitionShape = { schemaVersion: 1, appId, engineId, title, nodes, edges };
  if (JSON.stringify(definition).length > MAX_DOCUMENT_CHARS) return fail("工作流定义总大小超过 60 KB。");
  topologicalOrder(definition);
  return definition;
}

export function topologicalOrder(definition: Pick<WorkflowDefinitionShape, "nodes" | "edges">): WorkflowNodeDefinition[] {
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  const indegree = new Map(definition.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(definition.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of definition.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) return fail("连线引用了不存在的节点。");
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }
  const ready = definition.nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.id.localeCompare(b.id));
  const result: WorkflowNodeDefinition[] = [];
  while (ready.length) {
    const node = ready.shift()!;
    result.push(node);
    for (const nextId of outgoing.get(node.id)!) {
      const next = (indegree.get(nextId) ?? 1) - 1;
      indegree.set(nextId, next);
      if (next === 0) {
        ready.push(byId.get(nextId)!);
        ready.sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }
  if (result.length !== definition.nodes.length) return fail("连线形成了循环；当前工作流只支持无环流程图。");
  return result;
}
