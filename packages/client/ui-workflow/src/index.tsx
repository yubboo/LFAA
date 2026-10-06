/** 功能：提供跨 App 共享节点画布。作用：视图适配 React Flow，图文档仍由服务端 Owner 保存。 */
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Alert, Button, Input, Tag, Typography, theme } from "antd";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeChange,
  type EdgeChange
} from "@xyflow/react";
import type { WorkflowEdge, WorkflowNode, WorkflowNodeStatus, WorkflowNodeType, WorkflowRunNode } from "lfaa-client-connection/src/api.js";
import "@xyflow/react/dist/style.css";
import "./workflow-editor.css";

export interface WorkflowNodeEditorProps {
  node: WorkflowNode;
  nodeType: WorkflowNodeType;
  disabled: boolean;
  runtime?: WorkflowRunNode;
  updateData(update: Record<string, unknown>): void;
}
export type WorkflowNodeEditors = Readonly<Record<string, ComponentType<WorkflowNodeEditorProps>>>;
export interface WorkflowGraphEditorProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeTypes: WorkflowNodeType[];
  runtimeNodes?: WorkflowRunNode[];
  nodeEditors?: WorkflowNodeEditors;
  disabled?: boolean;
  onChange(nodes: WorkflowNode[], edges: WorkflowEdge[]): void;
}

interface FlowNodeData extends Record<string, unknown> {
  definition: WorkflowNode;
  nodeType?: WorkflowNodeType;
  runtime?: WorkflowRunNode;
  nodeEditors: WorkflowNodeEditors;
  disabled: boolean;
  updateNode(node: WorkflowNode): void;
  removeNode(nodeId: string): void;
}
type FlowNode = Node<FlowNodeData, "workflow-node">;

function statusColor(status?: WorkflowNodeStatus): string {
  return status === "succeeded" ? "green" : status === "failed" ? "red" : status === "interrupted" ? "orange" : status === "running" ? "blue" : "default";
}

function GenericNode({ id, data: rawData, selected }: NodeProps<Node>) {
  const data = rawData as unknown as FlowNodeData;
  const { token } = theme.useToken();
  const Editor = data.nodeEditors[data.definition.type];
  const updateData = useCallback((patch: Record<string, unknown>) => data.updateNode({ ...data.definition, data: { ...data.definition.data, ...patch } }), [data]);
  const inputs = data.nodeType?.inputPorts ?? [];
  const outputs = data.nodeType?.outputPorts ?? [];
  const runtimeStatus = data.runtime?.status;
  const resultText = data.runtime?.output ?? "";
  return <article className={`workflow-node${selected ? " is-selected" : ""}${data.nodeType ? "" : " is-unavailable"}`}>
    <NodeResizer isVisible={selected && !data.disabled} minWidth={260} minHeight={120} color={token.colorPrimary} />
    {inputs.map((port, index) => <Handle key={`in-${port.id}`} id={port.id} type="target" position={Position.Left} style={{ top: `${Math.round(((index + 1) / (inputs.length + 1)) * 100)}%`, background: token.colorSuccess }} aria-label={`输入端口 ${port.id}`} />)}
    {outputs.map((port, index) => <Handle key={`out-${port.id}`} id={port.id} type="source" position={Position.Right} style={{ top: `${Math.round(((index + 1) / (outputs.length + 1)) * 100)}%`, background: token.colorPrimary }} aria-label={`输出端口 ${port.id}`} />)}
    <header className="workflow-node__header">
      <div><Typography.Text type="secondary">{data.nodeType?.name ?? "缺少节点插件"}</Typography.Text><Tag color={statusColor(runtimeStatus)}>{runtimeStatus ?? "未运行"}</Tag></div>
      {!data.disabled ? <Button type="text" danger size="small" aria-label={`删除节点 ${data.definition.title}`} onClick={() => data.removeNode(id)}>删除</Button> : null}
    </header>
    <div className="workflow-node__body">
      {!data.disabled
        ? <Input aria-label="节点名称" value={data.definition.title} maxLength={80} onChange={(event) => data.updateNode({ ...data.definition, title: event.target.value })} />
        : <strong>{data.definition.title}</strong>}
      {Editor && data.nodeType
        ? <Editor node={data.definition} nodeType={data.nodeType} disabled={data.disabled} runtime={data.runtime} updateData={updateData} />
        : data.definition.type === "core.text-input"
          ? <Input.TextArea aria-label="文本输入节点内容" value={String(data.definition.data.text ?? "")} maxLength={12_000} rows={3} disabled={data.disabled} onChange={(event) => updateData({ text: event.target.value })} placeholder="输入要传递给下游节点的文本" />
          : data.definition.type === "core.result"
            ? <div className="workflow-node__result">{resultText || "连接上游节点后显示真实输出。"}</div>
            : <Alert type="warning" showIcon message="此节点所需的插件未启用" description="节点数据已保留；启用原插件后才能编辑或运行。" />}
      {data.runtime?.error ? <Typography.Text type="danger">{data.runtime.error}</Typography.Text> : null}
    </div>
  </article>;
}

export function WorkflowGraphEditor({ nodes, edges, nodeTypes, runtimeNodes = [], nodeEditors = {}, disabled = false, onChange }: WorkflowGraphEditorProps) {
  const { token } = theme.useToken();
  const typeById = useMemo(() => new Map(nodeTypes.map((item) => [item.type, item])), [nodeTypes]);
  const runtimeById = useMemo(() => new Map(runtimeNodes.map((item) => [item.nodeId, item])), [runtimeNodes]);
  const runtimeActive = useMemo(() => runtimeNodes.some((node) => node.status === "running" || node.status === "waiting"), [runtimeNodes]);
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const updateNode = useCallback((next: WorkflowNode) => onChange(nodes.map((node) => node.id === next.id ? next : node), edges), [edges, nodes, onChange]);
  const removeNode = useCallback((id: string) => onChange(nodes.filter((node) => node.id !== id), edges.filter((edge) => edge.from !== id && edge.to !== id)), [edges, nodes, onChange]);

  useEffect(() => {
    setFlowNodes(nodes.map((node) => ({
      id: node.id,
      type: "workflow-node",
      position: { x: node.x, y: node.y },
      data: { definition: node, nodeType: typeById.get(node.type), runtime: runtimeById.get(node.id), nodeEditors, disabled: disabled || runtimeActive, updateNode, removeNode },
      draggable: !disabled && !runtimeActive,
      selectable: true
    })));
    setFlowEdges(edges.map((edge) => ({ id: edge.id, source: edge.from, sourceHandle: edge.fromPort, target: edge.to, targetHandle: edge.toPort, type: "smoothstep", animated: runtimeActive })));
  }, [disabled, edges, nodeEditors, nodes, removeNode, runtimeActive, runtimeById, typeById, updateNode]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current));
    if (changes.some((change) => change.type === "remove")) {
      const removed = new Set(changes.flatMap((change) => change.type === "remove" ? [change.id] : []));
      onChange(nodes.filter((node) => !removed.has(node.id)), edges.filter((edge) => !removed.has(edge.from) && !removed.has(edge.to)));
    }
  }, [edges, nodes, onChange]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setFlowEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((change) => change.type === "remove")) {
      const removed = new Set(changes.flatMap((change) => change.type === "remove" ? [change.id] : []));
      onChange(nodes, edges.filter((edge) => !removed.has(edge.id)));
    }
  }, [edges, nodes, onChange]);
  const onNodeDragStop = useCallback((_event: unknown, flowNode: FlowNode) => {
    onChange(nodes.map((node) => node.id === flowNode.id ? { ...node, x: Math.round(flowNode.position.x), y: Math.round(flowNode.position.y) } : node), edges);
  }, [edges, nodes, onChange]);
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);
    if (!source || !target) return;
    const fromPort = connection.sourceHandle ?? typeById.get(source.type)?.outputPorts[0]?.id;
    const toPort = connection.targetHandle ?? typeById.get(target.type)?.inputPorts[0]?.id;
    if (!fromPort || !toPort) return;
    const next: WorkflowEdge = { id: crypto.randomUUID(), from: source.id, fromPort, to: target.id, toPort };
    onChange(nodes, [...edges, next]);
    setFlowEdges((current) => addEdge({ id: next.id, source: next.from, sourceHandle: next.fromPort, target: next.to, targetHandle: next.toPort, type: "smoothstep" }, current));
  }, [edges, nodes, onChange, typeById]);

  const nodeTypesMap = useMemo(() => ({ "workflow-node": GenericNode }), []);
  return <div className="workflow-graph-editor" aria-label="节点工作流画布">
    <ReactFlow<FlowNode, Edge>
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypesMap}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      nodesConnectable={!disabled && !runtimeActive}
      nodesDraggable={!disabled && !runtimeActive}
      elementsSelectable={!runtimeActive}
      deleteKeyCode={disabled || runtimeActive ? null : ["Backspace", "Delete"]}
      fitView
      fitViewOptions={{ padding: 0.18, minZoom: 0.2, maxZoom: 1.2 }}
      snapToGrid
      snapGrid={[16, 16]}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={token.colorBorderSecondary} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(node) => typeById.has(((node.data as unknown as FlowNodeData).definition.type)) ? token.colorPrimaryBg : token.colorErrorBg} />
    </ReactFlow>
  </div>;
}
