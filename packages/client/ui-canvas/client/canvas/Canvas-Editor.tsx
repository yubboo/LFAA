// 画布编辑器在右侧工作台内承载节点、连线、视口和属性面板。
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type Connection, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { inputPorts, outputPorts, type BoardDetail, type CanvasAsset, type CanvasGraph, type CanvasNode, type CanvasNodeKind, type StageScene } from "@lfaa/canvas/contract";
import { assetUrl, uploadAsset, type CanvasModel } from "../api/canvas-api";
import { labels } from "../locales";
import { NodeInspector } from "./Node-Inspector";
import { GraphNode, type FlowNode } from "./Graph-Node";
import { useCanvasDocument } from "./useCanvasDocument";
import styles from "./Canvas.module.css";

const PrevisEditor = lazy(() => import("../previs/Previs-Editor"));
const nodeTypes = { canvas: GraphNode };
const kinds: CanvasNodeKind[] = ["prompt", "asset", "previs", "image", "video"];

interface EditorProps { path: string; initial: BoardDetail; models: CanvasModel[]; isZh: boolean; onBack: () => void }

function connectionAsset(connection: Connection | Edge, graph: CanvasGraph, assets: CanvasAsset[]): string | null | undefined {
  const source = graph.nodes.find((node) => node.id === connection.source);
  const target = graph.nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.id === target.id || graph.edges.some((edge) => edge.target === target.id && edge.targetPort === connection.targetHandle)) return null;
  const out = outputPorts(source, assets).find((port) => port.id === connection.sourceHandle);
  const into = inputPorts(target).find((port) => port.id === connection.targetHandle);
  if (!out || out.kind !== into?.kind || (out.kind !== "text" && !out.assetId)) return null;
  const seen = new Set<string>();
  const pending = [target.id];
  while (pending.length) {
    const current = pending.pop()!;
    if (current === source.id) return null;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...graph.edges.filter((edge) => edge.source === current).map((edge) => edge.target));
  }
  return out.assetId;
}

function Editor({ path, initial, models, isZh, onBack }: EditorProps) {
  const t = labels[isZh ? "zh" : "en"];
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [previsId, setPrevisId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState("");
  const diagram = useRef<HTMLDivElement>(null);
  const doc = useCanvasDocument(path, initial);
  const { graph, assets, runs } = doc;
  const flow = useReactFlow<FlowNode, Edge>();
  const current = graph.nodes.find((node) => node.id === selected[0]);
  const previs = graph.nodes.find((node) => node.id === previsId);
  useEffect(() => {
    if (!added || !flow.getNode(added)) return;
    const frame = requestAnimationFrame(() => { void flow.fitView({ maxZoom: 1, padding: 0.18, duration: 120 }); });
    return () => cancelAnimationFrame(frame);
  }, [added, flow, graph.nodes.length]);
  const nodes: FlowNode[] = graph.nodes.map((node) => {
    const latest = runs.find((run) => run.nodeId === node.id);
    const chosen = runs.find((run) => run.assetId && run.assetId === node.settings.resultId);
    const inbound = graph.edges.filter((edge) => edge.target === node.id);
    const promptLink = inbound.find((edge) => edge.targetPort === "prompt");
    const upstream = graph.nodes.find((item) => item.id === promptLink?.source);
    const prompt = [upstream?.settings.prompt, node.settings.prompt].filter(Boolean).join("\n").trim();
    const assetCount = inbound.filter((edge) => edge.assetId).length;
    const checked = ["profileId", "modelId", "ratio", "duration", "resolution", "mode", "seed"] as const;
    const outdated = chosen && (chosen.prompt !== prompt || Object.keys(chosen.inputs).length !== assetCount ||
      inbound.some((edge) => edge.assetId && chosen.inputs[edge.targetPort] !== edge.assetId) ||
      checked.some((field) => chosen.settings[field] !== node.settings[field]));
    return { id: node.id, type: "canvas", position: node.position, selected: selected.includes(node.id),
      data: { node, assets, path, t, ...(latest ? { runStatus: outdated && latest.status === "succeeded" ? t.outdated : t[latest.status] } : {}) } };
  });
  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id, source: edge.source, sourceHandle: edge.sourcePort, target: edge.target, targetHandle: edge.targetPort,
    selected: selectedEdges.includes(edge.id), ...(edge.assetId ? { ariaLabel: t[edge.targetPort as keyof typeof t] } : {}),
  }));

  function add(kind: CanvasNodeKind) {
    const viewport = flow.getViewport();
    const last = graph.nodes.at(-1);
    const wide = (diagram.current?.clientWidth ?? 0) >= 560;
    const position = last
      ? { x: last.position.x + (wide ? 270 : 0), y: last.position.y + (wide ? 0 : 245) }
      : { x: (38 - viewport.x) / viewport.zoom, y: (38 - viewport.y) / viewport.zoom };
    const id = crypto.randomUUID();
    const settings = kind === "image" ? { ratio: "16:9" }
      : kind === "video" ? { ratio: "16:9", resolution: "720p", duration: 5 } : {};
    doc.change({ ...graph, nodes: [...graph.nodes, { id, kind, position, settings }] });
    setSelected([id]);
    setAdded(id);
  }

  function remove(nodeIds: string[], edgeIds: string[]) {
    doc.change((latest) => ({
      ...latest, nodes: latest.nodes.filter((node) => !nodeIds.includes(node.id)),
      edges: latest.edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target) && !edgeIds.includes(edge.id)),
    }));
    setSelected((items) => items.filter((id) => !nodeIds.includes(id)));
  }

  function updateNodes(changes: NodeChange<FlowNode>[]) {
    for (const event of changes) {
      if (event.type === "select") setSelected((ids) => event.selected ? [...ids.filter((id) => id !== event.id), event.id] : ids.filter((id) => id !== event.id));
    }
    const removals = changes.flatMap((event) => event.type === "remove" ? [event.id] : []);
    if (removals.length) remove(removals, []);
    const positions = new Map(changes.flatMap((event) => event.type === "position" && event.position ? [[event.id, event.position] as const] : []));
    if (positions.size) doc.change((latest) => ({
      ...latest, nodes: latest.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      }),
    }));
  }

  function updateEdges(changes: EdgeChange[]) {
    for (const event of changes) {
      if (event.type === "select") setSelectedEdges((ids) => event.selected ? [...ids.filter((id) => id !== event.id), event.id] : ids.filter((id) => id !== event.id));
    }
    const ids = changes.flatMap((event) => event.type === "remove" ? [event.id] : []);
    if (ids.length) remove([], ids);
  }

  function patchNode(id: string, update: (settings: CanvasNode["settings"]) => CanvasNode["settings"]) {
    doc.change((latest) => {
      const nodes = latest.nodes.map((node) => node.id === id ? { ...node, settings: update(node.settings) } : node);
      const edited = nodes.find((node) => node.id === id);
      const ports = edited && inputPorts(edited);
      return { ...latest, nodes, edges: latest.edges.filter((edge) => edge.target !== id || ports?.some((port) => port.id === edge.targetPort)) };
    });
  }

  async function upload(id: string, file: Blob, name: string, field: "assetId" | "imageId" | "videoId") {
    try {
      const snapshot = doc.getGraph();
      const previous = snapshot.nodes.find((node) => node.id === id);
      const existing = assets.find((asset) => asset.id === previous?.settings.assetId);
      if (field === "assetId" && existing && !file.type.startsWith(existing.kind + "/") && snapshot.edges.some((edge) => edge.source === id)) {
        throw new Error(t.invalid);
      }
      const asset = await uploadAsset(path, file, name);
      doc.addAsset(asset);
      patchNode(id, (settings) => ({ ...settings, [field]: asset.id }));
      return asset;
    } catch (error) {
      doc.report(error);
      throw error;
    }
  }

  function connect(connection: Connection) {
    const assetId = connectionAsset(connection, graph, assets);
    if (assetId === null || !connection.sourceHandle || !connection.targetHandle) {
      setMessage(t.invalid);
      return;
    }
    setMessage("");
    const { source, target, sourceHandle, targetHandle } = connection;
    doc.change({ ...graph, edges: [...graph.edges, { id: crypto.randomUUID(), source, target, sourcePort: sourceHandle, targetPort: targetHandle, ...(assetId ? { assetId } : {}) }] });
  }

  if (previs) return <Suspense fallback={<div role="status">{t.previs}</div>}>
    <PrevisEditor isZh={isZh} scene={previs.settings.scene} onExit={() => setPrevisId(null)}
      onChange={(scene: StageScene) => patchNode(previs.id, (settings) => ({ ...settings, scene }))}
      onExport={(file, field) => upload(previs.id, file, field === "imageId" ? "Previs frame" : "Previs clip", field)}
      frameUrl={previs.settings.imageId ? assetUrl(path, previs.settings.imageId) : undefined}
      clipUrl={previs.settings.videoId ? assetUrl(path, previs.settings.videoId) : undefined} />
  </Suspense>;

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button onClick={() => void doc.flush().then(onBack).catch(doc.report)}>{t.boards}</button>
        <strong title={initial.board.title}>{initial.board.title}</strong>
        <label><span className={styles.visuallyHidden}>{t.add}</span><select value="" onChange={(event) => add(event.target.value as CanvasNodeKind)}>
          <option value="" disabled>{t.add}</option>
          {kinds.map((kind) => <option key={kind} value={kind}>{t[kind]}</option>)}
        </select></label>
        <button disabled={!doc.dirty || doc.conflict} onClick={() => void doc.flush().catch(doc.report)}>{t.save}</button>
        {selectedEdges.length > 0 && <button onClick={() => remove([], selectedEdges)}>{t.remove}</button>}
        <span className={styles.status} role="status">{doc.dirty ? t.saving : t.saved}</span>
      </div>
      {(doc.error || message) && <div role="alert" className={styles.error}>
        {doc.error || message}{doc.conflict && <button onClick={() => void doc.reload().then(() => flow.setViewport(doc.getGraph().viewport))}>{t.reload}</button>}
      </div>}
      <div className={styles.layout} data-inspecting={Boolean(current)}>
        <div ref={diagram} className={styles.diagram}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultViewport={graph.viewport}
            minZoom={0.1} maxZoom={3} onNodesChange={updateNodes} onEdgesChange={updateEdges}
            onConnect={connect} isValidConnection={(connection) => connectionAsset(connection, graph, assets) !== null}
            onMoveEnd={(_, viewport) => doc.change((latest) => ({ ...latest, viewport }))}
            onNodeDoubleClick={(_, node) => { if (node.data.node.kind === "previs") setPrevisId(node.id); }}
            deleteKeyCode={["Delete", "Backspace"]} nodesConnectable edgesReconnectable={false} colorMode="system"
            proOptions={{ hideAttribution: true }}>
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {current && <NodeInspector key={current.id} node={current} models={models} assets={assets} runs={runs.filter((run) => run.nodeId === current.id)}
          path={path} t={t} onUpdate={(settings) => patchNode(current.id, () => settings)} onRun={() => void doc.run(current.id)}
          onPick={doc.addRunOutput} onPrevis={() => setPrevisId(current.id)}
          onUpload={(file) => void upload(current.id, file, file.name, "assetId").catch(() => undefined)}
          onRemove={() => remove([current.id], [])} />}
      </div>
    </div>
  );
}

export function CanvasEditor(props: EditorProps) {
  return <ReactFlowProvider><Editor {...props} /></ReactFlowProvider>;
}
